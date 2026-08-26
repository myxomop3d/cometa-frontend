# OData Relation Filter/Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Cometa's data tables sort and filter by related objects — Team by its leader's surname, Person by team membership — using one documented standard.

**Architecture:** Two rules keyed on relation cardinality. A **to-one** relation uses an OData navigation path (`$orderby=leader/lastName desc`); a **to-many** relation uses an `any()` lambda (`teams/any(x: x/id in (1,2))`). Both depend on `odata.mini.repo.throw-on-field-not-found: false`, already shipped in backend commit `6e583ba`. No `@ODataMapping` anywhere. A library bug forces every `any()` clause to be emitted last and limited to one per `$filter`.

**Tech Stack:** React 19, TypeScript 5.9, TanStack Router/Query/Table, Vitest. Backend: Spring Boot, MapStruct, odata-mini-repo 2.2.0-SNAPSHOT.

**Spec:** `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`

## Global Constraints

- Relation path separator is `/`, never `.` — a dot is an ANTLR parse error.
- **At most one `any()` lambda per `$filter`, and it must be the last clause.** `OData2JpqlExpressionVisitor` declares `bindVariables` as a `Queue` but uses it as a stack, so every clause parsed after an `any()` takes the lambda variable as its root. Fails as HTTP 500, never silently.
- The `any()` lambda variable stays `x`. The OData grammar reserves `t, a, e, d, m, n, s` as literal prefixes — those are parse errors. `x` is safe. Do not change it casually.
- Never put `@ODataMapping` on a collection: its `entityField` prefix feeds `fetchTablesSet`, adding an inner `JOIN FETCH` that drops parents with no children and duplicates those with several.
- To-many relations are **filterable only, never sortable**.
- Type-check with `npx tsc -b`. Bare `tsc --noEmit` silently checks nothing in this repo.
- Run tests with `npm run test` (Vitest).
- Backend is already fixed and committed (`f9ce665`, `ec9a892`, `6e583ba`). Do not re-fix it.

---

### Task 1: Shared builders — `any()` last, one only, and split `relation` from `multiRelation`

Two independent defects in the shared OData builders. First, `multiRelation` clauses can currently be emitted before other clauses, which triggers the root-alias bug above. Second, the advanced builder routes the `relation` variant (a scalar FK such as `leaderId`) through `any()`, producing the meaningless `leaderId/any(x: x/id in (…))`.

**Files:**
- Modify: `src/lib/odata/build-filter-params.ts`
- Modify: `src/lib/odata/build-advanced-filter-params.ts`
- Test: `src/lib/odata/build-filter-params.test.ts`
- Test: `src/lib/odata/build-advanced-filter-params.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `buildFilterParams` and `buildAdvancedFilterParams` keep their existing exported signatures. `FilterDescriptor.sortField?: string` and `FieldEntry.sortField?: string` already exist and are unchanged — Task 2 relies on them.

- [ ] **Step 1: Write the failing tests for the simple builder**

In `src/lib/odata/build-filter-params.test.ts`, extend the shared `descriptors` array at the top of the file to include a second collection field and a nav-path sort field:

```ts
const descriptors: readonly FilterDescriptor[] = [
  { id: "name", variant: "text" },
  { id: "item", variant: "relation", field: "itemId" },
  { id: "things", variant: "multiRelation" },
  { id: "oldThings", variant: "multiRelation" },
  { id: "leader", variant: "relation", field: "leaderId", sortField: "leader/lastName" },
];
```

Then append these blocks to the end of the file:

```ts
describe("buildFilterParams any() clause ordering", () => {
  it("emits the collection lambda last even when it is filtered first", () => {
    const p = build([
      { id: "things", value: [1, 2] },
      { id: "name", value: "abc" },
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(name, 'abc') and things/any(x: x/id in (1,2))",
    );
  });

  it("emits only the first lambda when two collections are filtered", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = build([
      { id: "things", value: [1, 2] },
      { id: "oldThings", value: [3] },
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1,2))");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("buildFilterParams nav-path sortField", () => {
  it("emits the configured navigation path for $orderby", () => {
    const p = build([], "leader.asc");
    expect(p.get("$orderby")).toBe("leader/lastName asc");
  });
});
```

Add `vi` to the existing import from `vitest` at the top of the file (it currently imports `describe`, `it`, `expect`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/odata/build-filter-params.test.ts`
Expected: FAIL — the ordering test reports the lambda first, and the two-collection test reports both lambdas joined with `and`.

- [ ] **Step 3: Implement clause partitioning in the simple builder**

In `src/lib/odata/build-filter-params.ts`, declare a second accumulator next to `clauses`:

```ts
  const clauses: string[] = [];
  // odata-mini corrupts the root alias for every clause parsed after an any()
  // lambda, so collection filters are emitted last and capped at one.
  // See §3 of docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md
  const lambdaClauses: string[] = [];
  const byId = new Map(descriptors.map((d) => [d.id, d]));
```

Change the `multiRelation` case to push onto `lambdaClauses`:

```ts
      case "multiRelation": {
        const relIds = value as number[] | undefined;
        if (relIds && relIds.length > 0) {
          const idList = relIds.map(Number).join(",");
          lambdaClauses.push(`${field}/any(x: x/id in (${idList}))`);
        }
        break;
      }
```

Replace the `if (clauses.length > 0)` block that sets `$filter` with:

```ts
  if (lambdaClauses.length > 1) {
    console.warn(
      `[odata] ${lambdaClauses.length} collection filters were requested but only ` +
        `"${lambdaClauses[0]}" was sent: odata-mini corrupts the root alias after ` +
        `the first any() lambda.`,
    );
  }

  const allClauses = [...clauses, ...lambdaClauses.slice(0, 1)];
  if (allClauses.length > 0) {
    searchParams.set("$filter", allClauses.join(" and "));
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/odata/build-filter-params.test.ts`
Expected: PASS, including the pre-existing `multiRelation` test which asserts `things/any(x: x/id in (1,2))` for a lone collection filter.

- [ ] **Step 5: Write the failing tests for the advanced builder**

In `src/lib/odata/build-advanced-filter-params.test.ts`, add one entry to the existing `fieldByColumnId` fixture so there are two collection fields to test the cap with. The fixture already has `name` (text), `item` (relation, field `itemId`) and `things` (multiRelation), and `build(...)` already defaults `joinOperator` to `"and"`:

```ts
  oldThings: { field: "oldThings", variant: "multiRelation" as const },
```

Add `vi` to the existing `vitest` import, then append:

```ts
describe("buildAdvancedFilterParams relation vs multiRelation", () => {
  it("emits a flat in-list for a to-one relation", () => {
    const p = build([
      { id: "item", operator: "inArray", value: [30, 31] } as ExtendedColumnFilter,
    ]);
    expect(p.get("$filter")).toBe("itemId in (30,31)");
  });

  it("emits an any() lambda for a to-many relation", () => {
    const p = build([
      { id: "things", operator: "inArray", value: [1425] } as ExtendedColumnFilter,
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1425))");
  });

  it("puts the lambda last regardless of filter order", () => {
    const p = build([
      { id: "things", operator: "inArray", value: [1425] } as ExtendedColumnFilter,
      { id: "name", operator: "iLike", value: "мох" } as ExtendedColumnFilter,
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(name, 'мох') and things/any(x: x/id in (1425))",
    );
  });

  it("keeps only the first lambda", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = build([
      { id: "things", operator: "inArray", value: [1] } as ExtendedColumnFilter,
      { id: "oldThings", operator: "inArray", value: [2] } as ExtendedColumnFilter,
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1))");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

Match the object-literal style the surrounding tests already use for `ExtendedColumnFilter` — drop the `as` casts if the existing tests construct filters without them.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/lib/odata/build-advanced-filter-params.test.ts`
Expected: FAIL — the first test reports `leaderId/any(x: x/id in (30,31))`.

- [ ] **Step 7: Implement both fixes in the advanced builder**

In `src/lib/odata/build-advanced-filter-params.ts`, replace the `inArray`/`notInArray` case in `clauseFor` with:

```ts
    case "inArray":
    case "notInArray": {
      if (!Array.isArray(value) || value.length === 0) return null;

      let inner: string;
      if (variant === "multiRelation" || variant === "relation") {
        const ids = value
          .map((v) => (isRelationValue(v) ? v.id : Number(v)))
          .filter((n) => !Number.isNaN(n));
        if (ids.length === 0) return null;
        // A to-one relation is a scalar FK column: `leaderId/any(...)` is
        // meaningless. Only a real collection gets the lambda.
        inner =
          variant === "multiRelation"
            ? `${field}/any(x: x/id in (${ids.join(",")}))`
            : `${field} in (${ids.join(",")})`;
      } else {
        // select / multiSelect / text
        const literals = value.map(quoteString).join(",");
        inner = `${field} in (${literals})`;
      }

      return operator === "notInArray" ? `not (${inner})` : inner;
    }
```

Then partition clauses in `buildAdvancedFilterParams`. Detect a lambda by its text, so that `not (…)`-wrapped lambdas are caught too:

```ts
  const clauses: string[] = [];
  // See §3 of the design spec: any() corrupts the root alias for later clauses.
  const lambdaClauses: string[] = [];
  for (const filter of filters) {
    const entry = fieldByColumnId[filter.id];
    if (!entry) continue;
    const clause = clauseFor(filter, entry);
    if (clause === null) continue;
    if (clause.includes("/any(")) lambdaClauses.push(clause);
    else clauses.push(clause);
  }

  if (lambdaClauses.length > 1) {
    console.warn(
      `[odata] ${lambdaClauses.length} collection filters were requested but only ` +
        `"${lambdaClauses[0]}" was sent: odata-mini corrupts the root alias after ` +
        `the first any() lambda.`,
    );
  }

  const allClauses = [...clauses, ...lambdaClauses.slice(0, 1)];
  if (allClauses.length > 0) {
    searchParams.set("$filter", allClauses.join(` ${joinOperator} `));
  }
```

> **Correction (recorded during final review, after this plan shipped):** the
> text-based check above (`clause.includes("/any(")`) is what was actually
> implemented first, and it is wrong — a *text* filter whose value contains
> the literal substring `/any(` is misclassified as a lambda, so it can win
> the one-lambda cap and silently discard a real `multiRelation` filter. The
> shipped fix partitions **structurally** on `entry.variant ===
> "multiRelation"` instead: it is immune to user text, and since `not (…)`
> wrapping doesn't touch `entry.variant`, it still catches negated lambdas —
> the original rationale for the text check was false. See
> `src/lib/odata/build-advanced-filter-params.ts` (the `entry.variant ===
> "multiRelation"` partition) and the regression test `does not misclassify a
> text value containing '/any(' as a lambda` in
> `src/lib/odata/build-advanced-filter-params.test.ts`.

- [ ] **Step 8: Fix the misleading JSDoc in both files**

In `src/lib/odata/build-filter-params.ts`, replace the `sortField` doc comment on `FilterDescriptor`:

```ts
  /** OData field used for $orderby, if different from the filter field.
   *  May be a navigation path using `/` — e.g. "leader/lastName". A dot
   *  ("leader.lastName") is an ANTLR parse error. Only ever emitted, never
   *  parsed out of the URL. */
  sortField?: string;
```

In `src/lib/odata/build-advanced-filter-params.ts`, apply the same wording to `FieldEntry.sortField`.

- [ ] **Step 9: Run the full test suite and type-check**

Run: `npm run test`
Expected: PASS
Run: `npx tsc -b`
Expected: no output

- [ ] **Step 10: Commit**

```bash
git add src/lib/odata/
git commit -m "fix(odata): emit any() clauses last and stop routing to-one relations through any()"
```

---

### Task 2: Team — sort by leader surname via navigation path

Re-enable sorting on the Leader column and point it at the nav path. This also closes the stale-URL hole recorded as finding 4 in `issue/relationSorting.md`: with `sortField` set, a bookmarked `?sort=leader.asc` resolves to `leader/lastName` instead of falling back to the bare column id `leader`.

**Files:**
- Modify: `src/features/team/columns.tsx:147`
- Modify: `src/features/team/filter-descriptors.ts:12-17`
- Modify: `src/features/team/advanced-api.ts:14`
- Create: `src/features/team/filter-descriptors.test.ts`

**Interfaces:**
- Consumes: `buildFilterParams` / `buildAdvancedFilterParams` from Task 1, and the existing `FilterDescriptor.sortField` / `FieldEntry.sortField` fields.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Create `src/features/team/filter-descriptors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import { teamFilterDescriptors } from "./filter-descriptors";

function build(sort?: string, columnFilters: { id: string; value: unknown }[] = []) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors: teamFilterDescriptors,
  });
}

describe("team leader sorting", () => {
  it("sorts by the leader's surname via a navigation path", () => {
    expect(build("leader.asc").get("$orderby")).toBe("leader/lastName asc");
    expect(build("leader.desc").get("$orderby")).toBe("leader/lastName desc");
  });

  it("still filters the leader by the flat scalar FK", () => {
    const p = build(undefined, [{ id: "leader", value: 30 }]);
    expect(p.get("$filter")).toBe("leaderId eq 30");
  });
});
```

The second case guards a real trap: filtering and sorting the Leader column use **different** fields (`leaderId` vs `leader/lastName`), and it is easy to "tidy" them into one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/team/filter-descriptors.test.ts`
Expected: FAIL — `$orderby` is `leader asc`, because no `sortField` is configured and the builder falls back to the column id.

- [ ] **Step 3: Add `sortField` to the descriptor**

In `src/features/team/filter-descriptors.ts`, change the `leader` entry:

```ts
  {
    id: "leader",
    variant: "relation",
    field: "leaderId",
    sortField: "leader/lastName",
    filterKey: "leaderId",
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/team/filter-descriptors.test.ts`
Expected: PASS

- [ ] **Step 5: Mirror the change in the advanced-mode field map**

In `src/features/team/advanced-api.ts`, change the `leader` entry:

```ts
  leader:     { field: "leaderId",   variant: "relation", sortField: "leader/lastName" },
```

- [ ] **Step 6: Re-enable sorting in the column definition**

In `src/features/team/columns.tsx`, in the `leader` column (currently line 147), change `enableSorting: false` to `enableSorting: true`. Leave `meta.variant`, `meta.filterKey` and `relationConfig` exactly as they are — the filter still uses the flat `leaderId`.

- [ ] **Step 7: Verify against the running backend**

Start the backend if it is not running (see the `backend-run-setup` memory), then:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"sigmaLogin":"16674475","password":"qweqweqwe"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -G http://localhost:8080/api/v1/team/graph \
  --data-urlencode '$top=5' --data-urlencode '$fields=leader' \
  --data-urlencode '$orderby=leader/lastName desc' \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys,json;[print(r['id'], (r.get('leader') or {}).get('lastName')) for r in json.load(sys.stdin)['data']]"
```

Expected exactly:

```
1450 Яковлева
1451 Южаков
1518 Южаков
1437 Юдаков
1436 Юдаков
```

If this returns an empty `403`, the backend is running without commit `6e583ba` — rebuild it.

- [ ] **Step 8: Run the full suite and type-check**

Run: `npm run test` — Expected: PASS
Run: `npx tsc -b` — Expected: no output

- [ ] **Step 9: Commit**

```bash
git add src/features/team/
git commit -m "feat(team): sort by leader surname via the leader/lastName nav path"
```

---

### Task 3: Backend — expose `PersonDto.teams`, and settle the pagination risk

The Person table needs team data to render a Teams column. This task is a **gate**: if fetching a to-many collection alongside `$top` makes Hibernate paginate in memory, the display column is dropped and Task 4 ships filter-only. Decide it here, before any frontend work depends on the answer.

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamSummaryDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/PersonDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/PersonMapper.java`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: JSON shape `PersonDto.teams: [{ id: number, name: string }]`, populated only on `GET /api/v1/person/graph?$fields=teams`. Task 4's `TeamSummaryDto` TypeScript type must match exactly.

- [ ] **Step 1: Create the summary DTO**

`TeamSummaryDto` carries `id` and `name` only. Reusing the full `TeamDto` would nest a `PersonDto leader` inside every team, closing a type cycle (`TeamDto.leader` → `PersonDto.teams` → `TeamDto`) that MapStruct may try to recurse through. The `Ref` suffix is deliberately avoided — in this codebase `*RefMapper` means a write-side id-to-entity-reference resolver, an unrelated concern.

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * Краткое представление команды для вложенных списков (например, PersonDto.teams).
 * Намеренно не содержит leader: полный TeamDto замкнул бы цикл
 * TeamDto.leader -> PersonDto.teams -> TeamDto.
 */
@Getter
@Setter
public class TeamSummaryDto {
    private Long id;
    private String name;
}
```

- [ ] **Step 2: Add the read-only `teams` field to `PersonDto`**

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class PersonDto extends BaseEntityDto {

    private String email;
    private String lastName;
    private String firstName;
    private String middleName;

    /** Только для чтения, заполняется при ?$fields=teams на маршруте /graph. */
    private List<TeamSummaryDto> teams;

}
```

- [ ] **Step 3: Map it, guarding the lazy collection**

Mirror the `@Condition` guard `TeamMapper` already uses for `leader`, so an uninitialised collection serialises as `null` rather than triggering N+1. Ignore `teams` on the write paths — it is read-only.

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.hibernate.Hibernate;
import org.mapstruct.Condition;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;
import ru.sberbank.cib.gmbus.service.dto.TeamSummaryDto;

import java.util.Set;

@Mapper(config = CometaCommonMapperConfig.class)
public interface PersonMapper extends BaseCrudMapper<Person, PersonDto> {

    /**
     * Не инициализировать ленивую коллекцию команд при маппинге в DTO —
     * без ?$fields=teams вложенный teams останется null вместо N+1.
     */
    @Condition
    default boolean isTeamsLoaded(Set<Team> teams) {
        return Hibernate.isInitialized(teams);
    }

    TeamSummaryDto toSummary(Team team);

    @Override
    @Mapping(target = "teams", ignore = true)
    Person fromDto(PersonDto dto);

    @Override
    @Mapping(target = "teams", ignore = true)
    void update(PersonDto source, @MappingTarget Person target);
}
```

- [ ] **Step 4: Rebuild and verify the mappers are not corrupted**

```bash
cd F:/programming/cometa
JAVA_HOME="C:/Program Files/Microsoft/jdk-17.0.19.10-hotspot" ./mvnw -q -DskipTests clean install
javap -v -cp cometa-service-module/target/classes \
  ru.sberbank.cib.gmbus.service.mapper.PersonMapperImpl | grep interfaces
```

Expected: `interfaces: 1`. If it prints `interfaces: 0`, the `-sourcepath` compiler arg from commit `f9ce665` has been lost from `pom.xml` — restore it before continuing. A build that reports SUCCESS with `interfaces: 0` fails at runtime with "required a bean of type '...Mapper' that could not be found".

- [ ] **Step 5: Restart the backend and run the risk gate**

```bash
DB_PASSWORD=$(grep DB_PASSWORD F:/programming/cometa/.vscode/backend.env | cut -d= -f2) \
SPRING_PROFILES_ACTIVE=local \
"C:/Program Files/Microsoft/jdk-17.0.19.10-hotspot/bin/java.exe" \
  -jar F:/programming/cometa/cometa-web-module/target/cometa-web-module-0.0.1-SNAPSHOT.jar
```

Then, with `$TOKEN` obtained as in Task 2 Step 7, run all four checks:

```bash
# a) teams populated
curl -s -G http://localhost:8080/api/v1/person/graph \
  --data-urlencode '$top=5' --data-urlencode '$fields=teams' \
  -H "Authorization: Bearer $TOKEN"

# b) count correct on a later page
curl -s -G http://localhost:8080/api/v1/person/graph \
  --data-urlencode '$top=20' --data-urlencode '$skip=20' --data-urlencode '$fields=teams' \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json;d=json.load(sys.stdin);print('count',d['count'],'returned',len(d['data']))"

# c) a person in no team still appears
curl -s -G http://localhost:8080/api/v1/person/graph \
  --data-urlencode '$top=200' --data-urlencode '$fields=teams' \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json;d=json.load(sys.stdin);print('returned',len(d['data']),'without teams',sum(1 for r in d['data'] if not r.get('teams')))"

# d) no in-memory pagination
# grep the backend's console output for:
#   "firstResult/maxResults specified with collection fetch; applying in memory"
```

**Gate.** Expected: (a) `teams` populated as `[{"id":1425,"name":"[Master] GMSB"}]` for person 31; (b) `count` is 222 and exactly 20 rows return; (c) 222 rows return, most with no teams; (d) the warning is **absent**.

If (b) returns fewer than 20 rows, or (d)'s warning appears, or (c) drops rows — **stop and report**. The fallback is to revert this task entirely and ship Task 4 filter-only: the `any()` filter needs no backend change and is unaffected. Do not attempt to work around in-memory pagination.

- [ ] **Step 6: Commit**

```bash
cd F:/programming/cometa
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamSummaryDto.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/PersonDto.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/PersonMapper.java
git commit -m "feat(person): expose read-only teams collection via \$fields=teams"
```

---

### Task 4: Person — Teams column and membership filter

**Do not start until Task 3's gate has passed.** If it failed, skip every step touching display (2, 3, 6) and ship the filter alone.

**Files:**
- Modify: `src/types/api.ts:199-207`
- Modify: `src/features/team/api.ts` (add `fetchTeamsFiltered` + `teamsFilteredQueryOptions`)
- Modify: `src/features/person/columns.tsx`
- Modify: `src/features/person/filter-descriptors.ts`
- Modify: `src/features/person/advanced-api.ts`
- Modify: `src/features/person/api.ts`
- Modify: `src/features/person/switchable-config.ts:9-14`
- Modify: `src/routes/person/-simple-search.ts`
- Test: `src/features/person/filter-descriptors.test.ts` (create)

**Interfaces:**
- Consumes: `PersonDto.teams` from Task 3; the clause-partitioning from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Create `src/features/person/filter-descriptors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import { personFilterDescriptors } from "./filter-descriptors";

function build(columnFilters: { id: string; value: unknown }[]) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    columnFilters,
    descriptors: personFilterDescriptors,
  });
}

describe("person teams filter", () => {
  it("emits an any() lambda over the teams collection", () => {
    const p = build([{ id: "teams", value: [1425, 1432] }]);
    expect(p.get("$filter")).toBe("teams/any(x: x/id in (1425,1432))");
  });

  it("emits the lambda after a scalar filter", () => {
    const p = build([
      { id: "teams", value: [1425] },
      { id: "lastName", value: "мох" },
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(lastName, 'мох') and teams/any(x: x/id in (1425))",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/person/filter-descriptors.test.ts`
Expected: FAIL — no `teams` descriptor exists, so `$filter` is `null`.

- [ ] **Step 3: Add the descriptor**

In `src/features/person/filter-descriptors.ts`, append to `personFilterDescriptors`:

```ts
  { id: "teams", variant: "multiRelation", field: "teams", filterKey: "teamIds" },
```

Then teach `deriveColumnFiltersFromSearch` to pass the id array through unchanged — the existing loop already handles it, because `search.teamIds` is parsed into an array by Step 7 and the function pushes `{ id, value }` verbatim for non-`select` variants. No change to that function is needed.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/features/person/filter-descriptors.test.ts`
Expected: PASS

- [ ] **Step 5: Add the TypeScript type**

In `src/types/api.ts`, add above `PersonDto` and extend it:

```ts
export interface TeamSummaryDto {
  id: number;
  name: string;
}

export interface PersonDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  /** Read-only; populated only on /api/v1/person/graph?$fields=teams. */
  teams?: TeamSummaryDto[];
}
```

- [ ] **Step 6: Add a filtered team query for the relation picker**

`src/features/team/api.ts` currently exports only `comboboxQueryOptions(search: string)`, but a `relationConfig` needs the `{ name?, ids?, page?, pageSize? }` contract. Add this alongside it, modelled exactly on `fetchPersonsFiltered` in `src/features/person/api.ts`:

```ts
export async function fetchTeamsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<TeamDto[]>> {
  const params = new URLSearchParams();
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  params.set("$skip", String((Number(page) - 1) * Number(pageSize)));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];
  if (fieldFilters.name) {
    clauses.push(`contains_ignoring_case(name, '${odataString(fieldFilters.name)}')`);
  }
  if (Array.isArray(fieldFilters.ids) && fieldFilters.ids.length > 0) {
    const ids = (fieldFilters.ids as unknown[]).map(Number).filter(Number.isFinite);
    if (ids.length > 0) clauses.push(`id in (${ids.join(",")})`);
  }
  if (clauses.length > 0) params.set("$filter", clauses.join(" and "));

  return apiFetch<ApiResponse<TeamDto[]>>(`/api/v1/team?${params.toString()}`);
}

export function teamsFilteredQueryOptions(
  filters: Record<string, unknown> = {},
) {
  return queryOptions({
    queryKey: ["teams", "relation-list", filters] as const,
    queryFn: () => fetchTeamsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}
```

This deliberately uses plain `/api/v1/team`, which works again as of backend commit `ec9a892`.

- [ ] **Step 7: Add the Teams column**

In `src/features/person/columns.tsx`, add a column before the `actions` column. Model the `relationConfig` on the `things` column in `src/features/box/columns.tsx:198-213`, and define the picker's columns near the top of the file the way `personRelationColumns` is defined in `src/features/team/columns.tsx:24`:

```tsx
const teamRelationColumns: ColumnDef<TeamSummaryDto, unknown>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "name", header: "Name" },
];
```

```tsx
    {
      id: "teams",
      accessorKey: "teams",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Teams" />
      ),
      cell: ({ cell }) => {
        const teams = cell.getValue<TeamSummaryDto[] | null>();
        return teams && teams.length > 0
          ? teams.map((t) => t.name).join(", ")
          : "—";
      },
      meta: {
        label: "Teams",
        variant: "multiRelation",
        filterKey: "teamIds",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            teamsFilteredQueryOptions(filters),
          columns: teamRelationColumns,
          getLabel: (team: TeamDto) => team.name ?? String(team.id),
          getId: (team: TeamDto) => team.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 220,
    },
```

`enableSorting` must stay `false` — ordering a row by a to-many is ill-defined and the library offers no aggregate for it.

Add the imports: `TeamSummaryDto` and `TeamDto` from `@/types/api`, `teamsFilteredQueryOptions` from `@/features/team/api`, and `ColumnDef` if not already imported.

- [ ] **Step 8: Wire the URL search param**

In `src/routes/person/-simple-search.ts`:

```ts
import { parseIdList } from "@/lib/data-table/switchable-search";

function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function validatePersonSimpleFields(search: Record<string, unknown>) {
  return {
    email: asStr(search.email),
    lastName: asStr(search.lastName),
    firstName: asStr(search.firstName),
    middleName: asStr(search.middleName),
    teamIds: parseIdList(search.teamIds),
  };
}
```

In `src/features/person/switchable-config.ts`, add `"teamIds"` to `personSimpleFilterKeys` so the param is cleared on mode toggle:

```ts
export const personSimpleFilterKeys = [
  "email",
  "lastName",
  "firstName",
  "middleName",
  "teamIds",
] as const;
```

- [ ] **Step 9: Point the list queries at the graph route**

In `src/features/person/api.ts`, extend the `createCrudApi` call — mirroring what `src/features/team/api.ts:14-17` already does:

```ts
const baseApi = createCrudApi<PersonDto, PersonFilters, PersonWritePayload>({
  basePath: "/api/v1/person",
  listPath: "/api/v1/person/graph",
  queryKey: ["persons"],
  filterDescriptors: personFilterDescriptors,
  staticParams: { "$fields": "teams" },
});
```

Leave `comboboxQueryOptions`, `fetchPersonsFiltered` and `personsFilteredQueryOptions` on plain `/api/v1/person` — they serve relation pickers and never need the teams relation.

In `src/features/person/advanced-api.ts`, add the field entry and repoint the URL:

```ts
export const personFieldByColumnId: Record<string, FieldEntry> = {
  email:      { field: "email",      variant: "text" },
  lastName:   { field: "lastName",   variant: "text" },
  firstName:  { field: "firstName",  variant: "text" },
  middleName: { field: "middleName", variant: "text" },
  teams:      { field: "teams",      variant: "multiRelation" },
};
```

```ts
      searchParams.set("$fields", "teams");
      return apiFetch<ApiResponse<PersonDto[]>>(
        `/api/v1/person/graph?${searchParams.toString()}`,
      );
```

- [ ] **Step 10: Verify end-to-end in the browser**

Run: `npm run dev -- --host` (the plain dev server is unreachable on this machine).

Confirm `vite.config.ts` proxies `/api` to `http://localhost:8080`, not the remote cluster, and that `.env.development.local` has `VITE_MOCK_API=false`. Log in as `16674475` / `qweqweqwe`.

On `/person`: the Teams column shows `[Master] GMSB` for Мохов and Нилов and `—` for everyone else; filtering by team 1425 returns exactly those two; combining that with a lastName filter of `мох` returns only Мохов. On `/team`: the Leader column header sorts, and descending starts with Яковлева.

- [ ] **Step 11: Run the full suite and type-check**

Run: `npm run test` — Expected: PASS
Run: `npx tsc -b` — Expected: no output
Run: `npm run lint` — Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add src/types/api.ts src/features/person/ src/features/team/api.ts src/routes/person/
git commit -m "feat(person): add Teams column and team-membership filter"
```

---

### Task 5: Backend — pin the generated JPQL with a unit test

Every defect in this effort was a silent change in generated JPQL: the `any()` root-alias bug, the `$search` erasure collision, and the strict-validation default. A test asserting the exact JPQL string for each spelling would have caught all three at upgrade time, and costs one file.

**Files:**
- Create: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/ODataJpqlGenerationTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the test**

`OData2Jpql` is a plain object needing no Spring context — construct it directly against the real entity classes.

```java
package ru.sberbank.cib.gmbus.odata;

import org.junit.jupiter.api.Test;
import ru.sber.cs.core.odata.mini.repo.odata.OData2Jpql;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;
import ru.sberbank.cib.gmbus.service.dto.TeamDto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Фиксирует JPQL, который odata-mini генерирует для наших спеллингов.
 * Любое расхождение после обновления библиотеки — сигнал перечитать
 * cometa-frontend/docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md
 */
class ODataJpqlGenerationTest {

    private OData2Jpql team() {
        return new OData2Jpql(Team.class, TeamDto.class);
    }

    private OData2Jpql person() {
        return new OData2Jpql(Person.class, PersonDto.class);
    }

    @Test
    void flatOrderByKeepsRootAlias() {
        assertEquals("Team.name desc",
                team().parseOrderByConditions("name desc", "Team", null));
    }

    @Test
    void navigationPathOrderByOmitsRootAlias() {
        // Известное поведение: корневой алиас не подставляется, Hibernate
        // разрешает путь по единственному root'у. Если это когда-нибудь
        // станет "Team.leader.lastName" — библиотека починила префикс.
        assertEquals("leader.lastName desc",
                team().parseOrderByConditions("leader/lastName desc", "Team", null));
    }

    @Test
    void navigationPathFilterOmitsRootAlias() {
        assertEquals("LOWER(leader.lastName) LIKE LOWER('%мох%')",
                team().parseFilterConditions(
                        "contains_ignoring_case(leader/lastName, 'мох')", "Team", null));
    }

    @Test
    void anyLambdaBuildsExistsSubquery() {
        assertEquals(" EXISTS (SELECT x FROM Person.teams x WHERE x.id = 5)",
                person().parseFilterConditions(
                        "teams/any(x: x/id eq 5)", "Person", null));
    }

    @Test
    void clauseAfterAnyLambdaLosesTheRootAlias() {
        // Баг odata-mini: bindVariables объявлен как Queue, но используется
        // как стек, поэтому visitAnyClause выталкивает КОРЕНЬ. Поэтому
        // any() всегда идёт последним и только один раз.
        // Когда этот тест упадёт — библиотека починена, workaround в
        // build-filter-params.ts / build-advanced-filter-params.ts можно снять.
        String jpql = person().parseFilterConditions(
                "teams/any(x: x/id eq 5) and contains_ignoring_case(lastName, 'мох')",
                "Person", null);
        assertTrue(jpql.contains("LOWER(x.lastName)"),
                "ожидалась испорченная ссылка x.lastName, получено: " + jpql);
    }

    @Test
    void enumFilterKeepsRootAlias() {
        assertEquals("Team.type = 'CHANGE'",
                team().parseFilterConditions("type eq 'CHANGE'", "Team", null));
    }
}
```

- [ ] **Step 2: Run the test**

```bash
cd F:/programming/cometa
JAVA_HOME="C:/Program Files/Microsoft/jdk-17.0.19.10-hotspot" \
  ./mvnw -pl cometa-service-module -am -Dtest=ODataJpqlGenerationTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: PASS, 6 tests. `-Dsurefire.failIfNoSpecifiedTests=false` is required — without it the sibling modules built by `-am`, which do not contain this class, fail the build first.

If `navigationPathOrderByOmitsRootAlias` fails because the actual value is `Team.leader.lastName`, the library has fixed its prefix logic: that is good news, not a regression — update the assertion and note it in the spec.

- [ ] **Step 3: Commit**

```bash
git add cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/ODataJpqlGenerationTest.java
git commit -m "test(odata): pin generated JPQL for relation paths and any() lambdas"
```

---

### Task 6: Documentation

`issue/relationSorting.md` is actively misleading: findings 1, 2, 3 and 6 all reason about `ODataCriteriaService`, a class this backend never instantiates. It must be replaced, not appended to.

**Files:**
- Rewrite: `issue/relationSorting.md`
- Modify: `CLAUDE.md` (Conventions section)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Rewrite `issue/relationSorting.md`**

Replace the whole file with a short document that:

1. States up front that Cometa uses `BaseCrudRepository`'s JPQL-string path, and that `ODataCriteriaService` — the basis of the original findings 1, 2, 3 and 6 — is never instantiated, so those findings do not apply.
2. Reproduces the verified behaviour matrix from the spec's "Verified behaviour" section.
3. States the two rules from spec §2 and the config requirement from §2.2.
4. Records the `any()` root-alias bug from spec §3 with its verified JPQL output.
5. Retains findings 5, 7 and 8 verbatim — those were verified live on 2026-08-05 and remain true.
6. Links to `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md` as the full record.

Do not re-derive any of this; copy the verified values from the spec.

- [ ] **Step 2: Add the rules to `CLAUDE.md`**

Under Conventions, after the `**New API resources**` bullet:

```markdown
- **Relation filters/sorts** (OData): a **to-one** relation uses a navigation
  path with `/` — `sortField: "leader/lastName"`, `contains_ignoring_case(leader/lastName, 'x')`.
  A dot is a parse error. A **to-many** relation uses `field/any(x: x/id in (…))`,
  is filterable only (never sortable), and must be the **last** clause in a
  `$filter` with at most one per request — odata-mini corrupts the root alias
  for every clause after an `any()`. Requires
  `odata.mini.repo.throw-on-field-not-found: false` on the backend. Full record:
  `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add issue/relationSorting.md CLAUDE.md
git commit -m "docs(odata): replace the relation-sorting issue notes with verified findings"
```

---

## Self-Review

**Spec coverage.** §2 Rule A → Task 2. §2 Rule B → Tasks 1 and 4. §2.2 config → already shipped in `6e583ba`, referenced in Global Constraints. §3 bug workaround → Task 1, pinned by Task 5. §4 shared builders → Task 1; Team → Task 2; Person → Task 4; tests → Tasks 1, 2, 4, 5. §5 backend items 1–3 → already shipped; item 4 (`PersonDto.teams`) → Task 3; item 5 (no `@ODataMapping`) → Global Constraints. §5 build fix → shipped, guarded by Task 3 Step 4. §6 risk 1 → pinned by Task 5. §6 risk 2 → Task 3's gate. §7 remaining verification items 1–2 → already verified this session; 3–4 → Task 3 Step 5; 5 → Task 4 Step 10. §8 docs → Task 6.

**Type consistency.** `TeamSummaryDto` is `{ id, name }` in Task 3 (Java) and Task 4 (TypeScript). `teamsFilteredQueryOptions` is defined in Task 4 Step 6 and consumed in Step 7. `personFilterDescriptors` / `teamFilterDescriptors` match their existing exported names. `parseIdList` comes from `@/lib/data-table/switchable-search`, matching `src/routes/box-dice/-simple-search.ts`.

**One deliberate inconsistency:** the Team Leader column filters on `leaderId` but sorts on `leader/lastName`. That is correct — a flat FK scalar for equality, a nav path for ordering — and Task 2 Step 1 has a regression test guarding it.
