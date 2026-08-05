# Team & Person Table Pages — Design

**Date:** 2026-08-05
**Status:** Approved

## Goal

Add `/person` and `/team` switchable table pages at full parity with `/flow`:
simple and advanced filtering, sorting, pagination, column pinning/visibility,
plus create and edit.

Parity with `/flow` means **no delete**. `/flow` and `/box-dice` expose Edit only;
there is no delete UI anywhere in the feature pages and no `AlertDialog`
component, and `createCrudApi.remove` has no caller. Adding one would establish a
new shared pattern and is deliberately out of scope.

Team requires a backend change first. `Team.leader` is a required
`@ManyToOne` to `Person` (`leader_person_id NOT NULL`), but `TeamDto` exposes no
leader field at all — so `POST /api/v1/team` with the DTO as it stands fails on a
not-null constraint. Person needs no backend work; `PersonDto` already covers
every required column.

## Background

Both resources already have `EntityGraphBaseCrudController` endpoints
(`/api/v1/person`, `/api/v1/team`), identical to Flow's. The frontend switchable
abstraction from the 2026-07-22 unification work — `useSwitchableTablePage`,
`SwitchableTableConfig`, `makeSwitchableSearch`, `makeSwitchableLoader` — carries
the whole page pattern. Neither page needs new page-level infrastructure.

`src/features/team/` already exists with a combobox used by the registration
flow. It is extended, not replaced.

## Decisions (locked)

- **Scope:** full `/flow` parity for both pages, including create.
- **Team leader:** exposed on `TeamDto` as a nested `PersonDto leader` (read,
  for display) plus a flat `Long leaderId` (write and filter).
- **Write path:** resolved at the MapStruct layer via
  `EntityManager.getReference`, not by making the entity's relation writable
  through a scalar.
- **Filter path:** a new read-only scalar `leaderId` on the `Team` entity, so
  OData filtering resolves without a join. Required for count-query correctness
  (see Backend below).
- **`relation` filter variant is changed, not duplicated.** It now emits a flat
  `field eq id` instead of `field/id eq id`. Box migrates to match.
- **Leader column is sortable** by `leader.lastName`, via a new optional
  `sortField` on the filter descriptor.
- **Sequencing:** Person first (no backend dependency), then the Team backend
  change, then the Team page.

## Sequencing

1. **Phase 1 — `/person`.** Pure frontend, zero backend dependency. Ships and is
   verifiable on its own, and re-proves the switchable abstraction generalizes to
   a third resource.
2. **Phase 2 — shared filter infrastructure.** The `relation` variant change,
   `sortField`, `staticParams`, and the box migration. Independently testable.
3. **Phase 3 — Team backend.** DTO, entity scalar, mapper, and the four manual
   verification checks.
4. **Phase 4 — `/team`.** Built on a verified backend.

Phase 2 could be folded into Phase 4, but it touches shared code that `/box-dice`
and `/flow` depend on, so it is kept separate to keep the blast radius legible in
review and to isolate any regression to a single commit.

## Phase 1 — `/person`

New `src/features/person/`, mirroring `src/features/flow/`:

| File | Contents |
|---|---|
| `api.ts` | `createCrudApi<PersonDto, PersonFilters, PersonWritePayload>({ basePath: "/api/v1/person", queryKey: ["persons"], filterDescriptors })` plus `comboboxQueryOptions` and `detailQueryOptions` (needed by Team's leader picker in Phase 4); also `personsFilteredQueryOptions` / `fetchPersonsFiltered`, a separate query-options factory serving `RelationPicker`'s `{ name?, ids?, page?, pageSize? }` contract, distinct from the `listQueryOptions` that `createCrudApi` generates (which takes `PersonFilters` and emits plain key=value params). Modeled on `fetchItemsFiltered` in `src/api/item.ts`; consumed by Team's Leader column filter in Phase 4. |
| `advanced-api.ts` | `personFieldByColumnId` + `advancedDataTableQueryOptions` |
| `columns.tsx` | `select`, `id`, `email`, `lastName`, `firstName`, `middleName`, `actions` |
| `filter-descriptors.ts` | four `text` descriptors + `deriveColumnFiltersFromSearch` |
| `schema.ts` | `personFormSchema` (email + three names, all required — they are `NOT NULL` on the entity), `PersonWritePayload` |
| `mappers.ts` | `personDtoToForm` / `personFormToCreate` / `personFormToPatch` |
| `row-action.ts` | `PersonRowAction` |
| `switchable-config.ts` | `personSwitchableConfig`, `personSimpleFilterKeys` |
| `components/PersonSheet.tsx` | four `Input`s |

Routes: `src/routes/person/index.tsx` and `src/routes/person/-simple-search.ts`,
near-copies of the flow equivalents with labels, config, and
`useNavigate({ from })` swapped. Title "Persons", unit "persons", add button
"Add Person".

`PersonDto` already exists in `src/types/api.ts`. `PersonFilters` does not and is
added there (four optional string fields extending `Partial<PaginationParams>`,
mirroring `FlowFilters`).

Sidebar (`src/components/app-sidebar.tsx`): add
`{ to: "/person", label: "Persons" }`.

**Acceptance:** `/person` serves a switchable page, both modes work, create/edit
round-trip against the real backend (no delete, per the Goal), `tsc -b` clean,
vitest green.

## Phase 2 — Shared filter infrastructure

### `relation` emits a flat scalar

Both builders currently hardcode the OData navigation form:

```ts
// build-filter-params.ts
case "relation": clauses.push(`${field}/id eq ${Number(relId)}`);
// build-advanced-filter-params.ts
if (variant === "relation") return `${field}/id ${op} ${relId}`;
```

Both change to emit `${field} eq ${id}` (respectively `${field} ${op} ${id}`).

**Why change rather than add a parallel variant.** The `/id` form has never run
against a real backend — Box, Item, and Thing do not exist in the Java codebase
and are MSW-only demo resources, so the syntax is validated solely by our own
mock OData engine. Against the real backend it cannot work: `getPathExpression`
splits a dotted path and calls `root.fetch(parts[0])`, and
`ODataCriteriaService.createCountQuery` applies the same where-predicate to its
own root, putting a fetch join inside a `SELECT COUNT(...)`, which Hibernate
rejects. Every future entity with a `@ManyToOne` hits this. Making `relation`
mean what the backend can execute means the next such entity just sets
`field: "<x>Id"`.

**Box migration.** `boxFilterDescriptors` gains `field: "itemId"` and
`field: "oldItemId"` on the two relation entries. `BoxDto` and the mock fixtures
gain `itemId` / `oldItemId` scalars alongside the existing nested `item` /
`oldItem`. This mirrors the `TeamDto` shape defined below, so the demo resource
stops teaching a shape the real backend cannot serve. The mock OData engine needs
no changes — `itemId eq 7` is a plain scalar comparison it already supports.

**`multiRelation` is left unchanged.** `things/any(x: x/id in (...))` is a genuine
collection navigation with no flat-scalar equivalent, and it has no real-backend
consumer yet. The first real collection relation — `Person.teams` is the obvious
candidate — will need its own resolution. See Known Limitations.

### `sortField`

Both builders serialize sort as `part.split(".")` → `[field, dir]`, so a dotted
field name in the URL parses as garbage (`leader.lastName.asc` yields field
`leader`, dir `lastName`). Translation therefore happens at emission, not in the
URL:

- Add optional `sortField?: string` to `FilterDescriptor` and to `FieldEntry`.
- In each builder's `$orderby` block, map the parsed column id through the
  descriptor lookup and emit `sortField ?? f`.

The URL carries `sort=leader.asc`; the request carries
`$orderby=leader.lastName asc`. Column ids stay dot-free and
`parseSorting` / `serializeSorting` are untouched.

### `staticParams`

`CreateCrudApiOptions` gains optional `staticParams?: Record<string, string>`,
merged into the built `URLSearchParams`. Needed for Team's `?fields=leader`.
`advanced-api.ts` needs the same treatment. No change for existing callers.

**Acceptance:** `/box-dice` relation filters still work against the mock;
`tsc -b` clean; vitest green including the updated expectations.

## Phase 3 — Team backend

Repository: `F:\programming\cometa`. No DDL or migration — the new scalar maps an
existing column a second time.

### `Team.java`

```java
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "leader_person_id", nullable = false)
private Person leader;                    // unchanged — the write path

@Column(name = "leader_person_id", insertable = false, updatable = false)
private Long leaderId;                    // new — filter/sort target only
```

`getPathExpression` now takes its no-dot branch (`root.get("leaderId")`), so
filtering and the count query stay join-free.

### `TeamDto.java`

```java
private Long leaderId;      // written by the client, filtered on
private PersonDto leader;   // read-only display
```

No `@ODataMapping` alias is needed: `leaderId` is a real entity field name, so
`ODataChecker.checkFields` passes on the identity mapping.

### `PersonRefMapper.java` (new)

```java
@Component
@RequiredArgsConstructor
public class PersonRefMapper {
    private final EntityManager em;
    public Person toPersonRef(Long id) {
        return id == null ? null : em.getReference(Person.class, id);
    }
}
```

`getReference` returns a lazy proxy without a DB hit; Hibernate writes the FK
from its identifier.

### `TeamMapper.java`

```java
@Mapper(config = CometaCommonMapperConfig.class,
        uses = {PersonRefMapper.class, PersonMapper.class})
public interface TeamMapper extends BaseCrudMapper<Team, TeamDto> {

    @Condition
    default boolean isEntityLoaded(Person person) {
        return Hibernate.isInitialized(person);
    }

    @Override
    TeamDto toDto(Team team);          // leaderId by name; leader guarded by @Condition

    @Override
    @Mapping(target = "leader", source = "leaderId")
    @Mapping(target = "leaderId", ignore = true)
    Team fromDto(TeamDto dto);

    @Override
    @Mapping(target = "leader", source = "leaderId")
    @Mapping(target = "leaderId", ignore = true)
    void update(TeamDto source, @MappingTarget Team target);
}
```

The explicit `ignore` on the write side is load-bearing. Without it MapStruct
name-matches `dto.leaderId → entity.leaderId`, which Hibernate discards as
`insertable = false`, and the leader silently never saves. Routing through
`target = "leader"` is what makes the write land.

`@Condition` guards only the nested `leader`; `leaderId` reads off the scalar, so
it is populated on every response. `?fields=leader` is needed only for the nested
object that renders the name.

`nullValuePropertyMappingStrategy = IGNORE` (from `CometaCommonMapperConfig`)
means a PATCH omitting `leaderId` will not null the leader — correct for a
`NOT NULL` column.

The parent pom already sets `<fork>true</fork>`, so regenerating `TeamMapperImpl`
is not exposed to the known MapStruct corruption trap. Keep it.

### Manual verification

The backend module has no integration-test harness (6 test files total) and
building one is out of scope. Four checks against the running backend, in order:

1. `POST /api/v1/team` with `leaderId` → row persists with the correct
   `leader_person_id`. Proves the MapStruct write path.
2. `GET /api/v1/team?fields=leader` → nested `leader` populated, `leaderId`
   present.
3. `GET /api/v1/team?$filter=leaderId eq N` → filters correctly **and returns a
   correct `count`**. This is the count-query check.
4. `GET /api/v1/team?$orderby=leader.lastName asc&fields=leader` → exercises two
   hazards: `getOrderList` runs in the `ODataCriteriaService` constructor and
   calls `root.fetch("leader")`, while `getQuery()` separately runs
   `getFetchTablesSet().forEach(root::fetch)` — potentially a duplicate join; and
   `ODataOrderbyHelper.parseTreeWalk` does a post-order walk that `put`s one order
   entry per matching node, so a two-segment path may register two entries.

**Check 4 is the most likely to fail.** If it does, the fallback is
`enableSorting: false` on the Leader column, which costs nothing else in the
design — filtering is unaffected because it uses the flat scalar.

**Acceptance:** all four checks pass, or check 4 fails and the Leader column is
marked non-sortable with the reason recorded.

## Phase 4 — `/team`

New files in the existing `src/features/team/`, matching the Person set, plus:

- **`api.ts` is extended, not replaced.** `createCrudApi` and
  `advancedDataTableQueryOptions` are added alongside the existing
  `comboboxQueryOptions` / `detailQueryOptions`, so the registration flow is
  untouched. List queries carry `staticParams: { fields: "leader" }`.
- **`columns.tsx`:** `select`, `id`, `name`, `code`, `type`, `leader`,
  `leaderRole`, `structure`, `actions`. The `leader` cell renders
  `row.leader` (nested `PersonDto`), falling back to `—`. The `leader` column's
  filter widget is configured via `meta.relationConfig`, whose
  `queryOptionsFn` is Phase 1's `personsFilteredQueryOptions` — the same
  factory the Leader column filter in both simple and advanced mode goes
  through.
- **`filter-descriptors.ts`:**
  ```ts
  { id: "name",       variant: "text",       filterKey: "name" },
  { id: "code",       variant: "range",      filterKeys: ["codeMin", "codeMax"] },
  { id: "type",       variant: "select",     filterKey: "type" },   // CHANGE / RUN
  { id: "leader",     variant: "relation",   field: "leaderId",
    filterKey: "leaderId", sortField: "leader.lastName" },
  { id: "leaderRole", variant: "text",       filterKey: "leaderRole" },
  { id: "structure",  variant: "text",       filterKey: "structure" },
  ```
- **`schema.ts`:** `leaderId` is a required number; the rest are nullable, matching
  the entity.

One new file lands outside the team feature —
**`src/features/person/components/PersonCombobox.tsx`**, modeled directly on the
existing `TeamCombobox`: `$top=20` server-side search over `lastName` /
`firstName`, plus a detail-by-id query so a selected person outside the top 20
still renders a label. It lives with Person because it is a Person picker; Team
consumes it from both the Leader column filter and `TeamSheet`.

Frontend types (`src/types/api.ts`): `TeamDto` gains `leaderId: number` and
`leader: PersonDto | null`, matching the backend change. `TeamFilters` does not
exist and is added.
- **`components/TeamSheet.tsx`:** `name`, `code`, `type` (select), `leaderRole`,
  `structure`, and a required leader `PersonCombobox`.

Sidebar: add `{ to: "/team", label: "Teams" }`.

**Acceptance:** `/team` serves a switchable page, both modes work, leader filter
and (if check 4 passed) leader sort work, create/edit round-trip against the
real backend (no delete, per the Goal), `tsc -b` clean, vitest green.

## Error handling

`apiFetch` throws `ApiError` carrying the `messages[]` envelope; the sheets map
`message.target` onto form fields via a field-list type guard (the
`isFlowField` pattern). Person and Team sheets replicate that with their own
field lists. Three cases specific to this work:

- **Missing leader on create** — caught client-side by `teamFormSchema`. The DB
  constraint is the backstop, not the primary guard.
- **Invalid `leaderId`** — `getReference` does not verify existence, so a stale id
  surfaces as an FK violation with no field `target`, rendering as a generic toast
  rather than an inline error. Accepted: the combobox only offers real persons.
  Switching to `em.find` with an explicit 404 would cost a query per save.
- **Duplicate Team `(name, code)`** — the entity carries a `@UniqueConstraint` on
  the pair, so a collision fails at the DB. It arrives with no field `target` and
  renders as a generic toast rather than an inline error on either field.

## Testing

| Test | Status |
|---|---|
| `features/person/mappers.test.ts` | new — dto↔form round-trip, `formToPatch` dirty-field behavior |
| `features/team/mappers.test.ts` | new — same, including `leaderId` |
| `lib/odata/build-advanced-filter-params.test.ts` | **update** — line 103's `item/id eq 7` becomes `itemId eq 7` |
| `lib/odata/build-filter-params.test.ts` | **new file** — the simple builder is currently untested and its `relation` case is changing; cover `relation` and `sortField` at minimum |
| `sortField` translation | new cases in both builders — `sort=leader.asc` → `$orderby=leader.lastName asc` |
| `mocks/lib/odata.test.ts` | update for the `itemId` / `oldItemId` fixture fields |
| `mocks/data/boxes.test.ts` | new — end-to-end through the mock OData engine: derives `itemId`/`oldItemId` from the nested `item`/`oldItem` on every fixture row, then filters on the flat scalars (`itemId eq N`, `oldItemId eq N`) and on `things/any(...)` via `applyOData` directly |

Backend verification is manual — see Phase 3.

## Known limitations

- **`multiRelation` still emits `any(x: x/id in (...))`**, which the real backend
  cannot execute for the same count-query reason as `relation`. It is unreachable
  today (only the MSW-only Box resource uses it). The first real collection
  relation will need its own resolution — likely an `EXISTS` subquery on the join
  table, which `ODataFilterHelper` explicitly rejects today
  (`"Операторы any/all пока не поддерживаются"`). Out of scope here.
- **Person's `teams` M2M is not exposed** on `PersonDto` and is not surfaced on
  `/person`. Adding it is a separate piece of work gated on the point above.
- **Phase 3 check 4 (leader sort against a running backend) is still outstanding
  as of this commit.** It requires a running backend and is pending with the
  human partner; no outcome should be assumed either way. The leader column
  currently ships sortable: `src/features/team/filter-descriptors.ts` and
  `src/features/team/advanced-api.ts` both set `sortField: "leader.lastName"`
  on the `leader` entry, and `src/features/team/columns.tsx` sets
  `enableSorting: true` on the `leader` column. If check 4 fails, the reversal
  is exactly three edits: drop `sortField` from the `leader` entry in
  `filter-descriptors.ts` and in `advanced-api.ts`, and set
  `enableSorting: false` on the `leader` column in `columns.tsx`.
- **No delete UI**, per the Goal. One consequence is worth recording for whenever
  delete is added: `leader_person_id` is `NOT NULL` with no cascade, so deleting a
  Person who leads a Team will fail at the DB with an FK violation. A useful
  message ("this person leads N teams") would need a backend pre-check.
