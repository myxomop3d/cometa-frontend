# Relation filtering and sorting via odata-mini-repo — the standard

**Date:** 2026-08-26
**Status:** design approved; behaviour verified against a live backend
**Supersedes:** the analysis in `issue/relationSorting.md` (see §8)

## Problem

Cometa's data tables need to filter and sort by fields of *related* objects —
`Team` by its leader's surname, `Person` by the teams they belong to. Today
leader sorting is disabled outright and no table filters by a relation's
fields.

Prior investigation (`issue/relationSorting.md`) concluded nested paths were
essentially unusable. That conclusion was drawn from the wrong code path and is
wrong. This document replaces it with the verified mechanism.

## Background: which code path actually runs

odata-mini-repo has **two** independent query builders:

- `ODataCriteriaService` — JPA Criteria API. Builds a second root for the count
  query, hard-throws on `any`/`all`, calls `root.fetch()` for dotted paths.
- `BaseCrudRepository.readAll(ODataParams)` — assembles a **JPQL string** from
  `ODataFilter.getWhereJpql()` and `ODataOrderby.getOrderbyJpql()`.

Cometa uses **only the second**. `TeamCrudRepository` →
`EntityGraphBaseCrudRepository` → `BaseCrudRepository`, all JPQL-string
builders; `ODataCriteriaService` is never instantiated anywhere in the backend.

Every hazard in findings 1, 2, 3 and 6 of `issue/relationSorting.md` is a
property of `ODataCriteriaService`, so none of them applies.

## Verified behaviour

Two independent sources: a probe compiled against the actual jars (printing the
field set handed to `checkFields` and the generated JPQL), and a live run
against the running backend — odata-mini 2.2.0-SNAPSHOT, odata-parser 1.2.2,
Hibernate ORM 7.2.12.Final, Postgres, 111 teams / 222 persons.

| spelling | strict `checkFields` | generated JPQL | live result |
|---|---|---|---|
| `name desc` | pass | `Team.name desc` | 200 |
| `leader/lastName desc` | **`FieldNotFoundException`** | `leader.lastName desc` (no root alias) | **200 when strict is off** |
| `leader.lastName desc` | — | ANTLR parse error | 500 |
| `leaderLastName desc` (`@ODataMapping`) | pass | `Team.leader.lastName desc` | not exercised |
| `contains_ignoring_case(leader/lastName,'мох')` | `FieldNotFoundException` | `LOWER(leader.lastName) LIKE …` | 200, count=1 when strict is off |
| `teams/any(x: x/id eq N)` | `FieldNotFoundException` | `EXISTS (SELECT x FROM Person.teams x WHERE x.id = N)` | 200, correct rows when strict is off |
| `teams/any(Teams: Teams/id eq N)` | pass | `EXISTS (SELECT Teams FROM Person.teams Teams …)` | 200, correct rows |
| clause *following* an `any()` | pass | root alias corrupted | **500** — see §3 |
| `type eq 'CHANGE'` (enum) | pass | `Team.type = 'CHANGE'` | 200, count=85 |

### The decisive result

```
GET /api/v1/team/graph?$top=5&$fields=leader&$orderby=leader/lastName desc
HTTP 200  count=111
  1450 SberCIB Terminal Processing    Яковлева
  1451 eFX FIX Channels               Южаков
  1518 SberCIB Terminal FX Products   Южаков
  1437 [Service] Index Platform       Юдаков
  1436 [Service] Emission Platform    Юдаков
```

Identical to `SELECT … ORDER BY p.last_name DESC` in SQL.

The library emits `ORDER BY leader.lastName` — **without** the root alias that
a flat field gets (`ORDER BY Team.name`). Hibernate 7.2 resolves the
unqualified path against the single root, so it works. `readAll` always
produces exactly one root, so there is no ambiguity for it to trip over. This
is a real dependency on Hibernate's implicit-root resolution and is recorded as
risk 1 in §6.

### Two mechanisms behind the table

1. **`ODataChecker` (2.2.0) registers**: flat entity field names (`leader`,
   `name`); `<Entity>.<flat>` forms (`Team.leader`); and — **only for
   `Collection`-typed fields** — `Capitalize(field).<child>` (`Teams.id`). A
   to-one association gets no nested registration, so `leader.lastName` is
   unknown to it. `@ODataMapping` aliases are registered separately.
2. **`odata.mini.repo.throw-on-field-not-found`** is new in 2.2.0 and defaults
   to `true`. It is read once at startup and cached
   (`ThrowOnFieldNotFoundPropertyProvider` ignores later writes).

### Lambda variable names

Under **lenient** validation the name is free: `x`, `team`, `Teams` all
produce valid JPQL and correct rows. Under **strict** validation only
`Capitalize(collectionField)` passes, because that is the only form
`ODataChecker` registers.

Independently of validation, some single letters are **unparseable** — the
OData grammar reserves them as literal prefixes. `t, a, e, d, m, n, s` all
fail with an ANTLR error; `x` parses fine. The frontend's existing `x` is
safe, but the choice is load-bearing and must not be changed casually.

## Precedent in the official samples

`F:\programming\cs-odata-mini-samples`, samples 1–5. Every sample maps relation
fields with `@ODataMapping`; none uses a raw nav path — they predate 2.2.0's
`throw-on-field-not-found` switch, when strict was the only mode.

To-many (`Header.items`) is handled three ways, **none** of them `any()`:
a separate DTO + controller pair for display (`HeaderWithItemsDto` at
`/api/v1/headeri`, annotating `status.*` but **never** `items`); a sub-resource
`GET /header/{headerId}/items` using `parentIdMap`; and the inverse to-one
alias on `ItemDto` for filtering children by parent attributes.

---

## 1. Scope

- **Team.leader** (`@ManyToOne`) — sort and filter by leader name.
- **Person.teams** (`@ManyToMany`) — filter people by team; display a Teams
  column.
- A written standard both follow.

Out of scope: sorting Person by teams (ill-defined over a to-many); a
`/team/{id}/person` sub-resource; the `@Metadata` JSON generator.

## 2. The standard

### Rule A — to-one relation → nav path

```
$orderby=leader/lastName desc
$filter=contains_ignoring_case(leader/lastName, 'мох')
```

- Separator is `/`, **not** `.` — a dot is an ANTLR parse error.
- No backend change per field. Any relation attribute is immediately
  sortable and filterable.
- Frontend spelling: `sortField: "leader/lastName"`.
- Requires lenient validation (§2.2).

`@ODataMapping(entityField="leader.lastName", dtoField="leaderLastName")` +
`$orderby=leaderLastName` remains a **documented fallback**, for when strict
validation is wanted on a specific DTO, or when the association should be
eagerly fetch-joined. It carries two costs the nav path does not: its
`entityField` prefix feeds `fetchTablesSet`, adding an unqualified
`JOIN FETCH leader` to every `readAll`; and its alias participates in
`OData2Jpql.changeFieldsNames`, a global `\b(\w+)\b` replacement over the
generated JPQL that rewrites matching text **inside quoted literals**
(verified: `contains_ignoring_case(name,'leaderLastName')` emits
`LIKE LOWER('%leader.lastName%')`).

### Rule B — to-many relation → `any()` lambda

```
$filter=teams/any(x: x/id in (1425,1432))
```

- **Filterable only, never sortable.**
- Never annotate a collection with `@ODataMapping`: the resulting inner
  `JOIN FETCH` drops parents with no children and duplicates those with
  several. The samples annotate `status.*` but never `items` for this reason.
- Count-safe: `count(ODataFilter)` reuses `getWhereJpql()`, and `EXISTS`
  carries no fetch join.
- **At most one `any()` per `$filter`, emitted last** — see §3.
- The lambda variable stays `x`. See "Lambda variable names" above for why the
  choice matters.

### 2.2 Required configuration

```yaml
# cometa-web-module/src/main/resources/application.yaml
odata.mini.repo:
  throw-on-field-not-found: false
```

Both rules depend on this. It is a deliberate trade: an unknown field becomes a
Hibernate `SemanticException` at execution instead of a `FieldNotFoundException`
at validation. Both are 500s, so the practical loss is error-message quality,
not safety — and §5's `/error` fix is what makes those messages visible at all.

## 3. Library bug: `any()` corrupts the root alias for every later clause

`OData2JpqlExpressionVisitor:135` declares

```java
Queue<String> bindVariables = new ArrayDeque<>();
```

and uses it as a *stack*. `add()` appends at the tail while `peek()`/`remove()`
work on the **head**. `visitAnyClause` pushes the lambda variable with `add()`
then pops with `remove()` — evicting the **root**, not the lambda variable it
just added. Every clause parsed after the first `any()` takes the lambda
variable as its root. A `Deque` used with `push`/`pop` would be correct.

Verified live:

```
any THEN flat →  SemanticException: Could not interpret path expression 'Teams.lastName'
flat THEN any →  200, count=1, correct
two any()     →  EXISTS (SELECT Teams FROM Person.teams  Teams …)
                 AND
                 EXISTS (SELECT Teams FROM Teams.teams   Teams …)   -- want Person.teams
```

**It fails loudly** — a 500, never silently wrong rows. So the builder ordering
rule below is a correctness guard, not a data-integrity emergency.

Consequences for §4: emit `multiRelation` clauses last; merge same-field rows
into one lambda; if two lambdas would still be needed, emit the first and warn.
Report upstream and drop the workaround when a fixed version ships.

## 4. Frontend changes

### Shared builders

`build-filter-params.ts` and `build-advanced-filter-params.ts`:

- Collect `multiRelation` clauses separately and append them **after** all
  other clauses (§3). Add a comment pointing at §3 so the workaround is removed
  rather than cargo-culted once the library is fixed.
- Merge filter rows targeting the same collection field into one lambda where
  operators allow. If two lambdas would still be required, emit the first and
  `console.warn` — silently dropping a filter is worse than saying so.
- **Split `relation` off from `multiRelation`** in the advanced builder's
  `inArray`/`notInArray` branch. It currently routes both through `any()`, so a
  to-one FK emits `leaderId/any(...)`, meaningless for a scalar. A `relation`
  must emit `${field} in (${ids})`.
- Fix the `sortField` JSDoc on `FilterDescriptor` and `FieldEntry`: the example
  should be `"leader/lastName"` (slash), not `"leader.lastName"` (dot, which is
  a parse error).
- Leave the `multiRelation` lambda as `x`.

### Team

- `columns.tsx` — `enableSorting: true` on the `leader` column (currently
  `false` at line 147).
- `filter-descriptors.ts` — add `sortField: "leader/lastName"` to the `leader`
  descriptor.
- `advanced-api.ts` — same on `teamFieldByColumnId.leader`.
- The existing flat `leaderId` relation **filter** is untouched.

This also closes the stale-URL hole recorded as finding 4: with `sortField`
set, a bookmarked `?sort=leader.asc` resolves to `leader/lastName` instead of
falling back to the bare column id.

### Person

- `columns.tsx` — a `teams` column rendering chips, `variant: "multiRelation"`,
  `enableSorting: false`, `relationConfig` reusing Team's
  `comboboxQueryOptions`.
- `filter-descriptors.ts` — `{ id: "teams", variant: "multiRelation", field:
  "teams", filterKey: "teamIds" }`.
- `advanced-api.ts` — add `teams` to `personFieldByColumnId`; repoint to
  `/api/v1/person/graph` with `$fields=teams`.
- `api.ts` — `listPath: "/api/v1/person/graph"` and `staticParams: { "$fields":
  "teams" }`. `comboboxQueryOptions`, `fetchPersonsFiltered` and
  `personsFilteredQueryOptions` stay on plain `/api/v1/person`.
- `types/api.ts` — add `TeamSummaryDto` and `teams?: TeamSummaryDto[]` on
  `PersonDto`.

### Tests

Update `multiRelation` expectations; pin `relation` + `inArray` to
`field in (...)`; add a case for nav-path `sortField` emission; add a case
asserting `multiRelation` clauses are ordered last.

## 5. Backend changes

1. **Config** — add `throw-on-field-not-found: false` (§2.2).
2. **Fix the 2.2.0 `getAll` erasure collision (blocking).** 2.2.0 added a
   `$search` parameter to `ODataMiniReadApi.getAll`, making it
   `getAll(Integer, Integer, String, String, String)` — the same erasure as
   cometa's `ODataEntityGraphReadApi.getAll(…, $fields)`.
   `EntityGraphBaseCrudController.getAll` now overrides both, and
   `@GetMapping("")` loses to `@GetMapping("graph")`. Live effect:
   `GET /api/v1/team` and `GET /api/v1/person` return **405**, for all six
   controllers extending `EntityGraphBaseCrudController` (Team, Person, Node,
   Flow, Link, AutomatedSystem). In the frontend this breaks
   `comboboxQueryOptions`, `fetchPersonsFiltered` and
   `personsFilteredQueryOptions` — every relation picker.
   Fix: rename cometa's interface methods to `getAllGraph`/`getGraph`.
3. **Unmask errors.** Exceptions forward to `/error`, which is anonymous-denied,
   so every backend error reaches the client as an opaque `403` with an empty
   body. This masked both the `FieldNotFoundException` and the 405 above, and
   makes lenient validation (§2.2) much more expensive to debug. Permit `/error`
   or add an `@ExceptionHandler`.
4. **`PersonDto.teams`** for display only — `List<TeamSummaryDto>`, read-only,
   gated by MapStruct `@Condition isEntityLoaded`, plus the `PersonMapper`
   mapping. `TeamSummaryDto` is new: `id` and `name` only. Reusing full
   `TeamDto` would nest a `PersonDto leader` per team, closing a type cycle
   (`TeamDto.leader` → `PersonDto.teams` → `TeamDto`) that MapStruct may
   recurse through. The `Ref` suffix is avoided — here `*RefMapper` means a
   write-side id-to-entity-reference resolver.
5. **No `@ODataMapping` anywhere.** Neither rule needs it.

### Build fix (already applied, uncommitted)

The reactor was silently producing `*MapperImpl` classes with **no `implements`
clause** — `interfaces: 0` plus `MissingTypes`/`InconsistentHierarchy` — while
reporting BUILD SUCCESS, which at runtime gives "required a bean of type
'...Mapper' that could not be found". `fork=true` did not prevent it.

Cause: the odata-mini jars ship `.java` sources **beside** their `.class` files.
With no explicit `-sourcepath`, javac searches the *classpath* for sources,
finds `BaseCrudRepository.java`, and tries to compile it — where Lombok's
`@Slf4j` `log` does not resolve. javac enters error recovery and corrupts our
generated mappers as collateral damage.

Fix: an explicit `-sourcepath` in the parent pom's `maven-compiler-plugin`
config, limiting source lookup to our own directories. A full reactor build then
yields `interfaces: 1` for every mapper. Verify after any build with:

```
javap -v -cp cometa-service-module/target/classes \
  ru.sberbank.cib.gmbus.service.mapper.TeamMapperImpl | grep interfaces
```

## 6. Remaining risks

**Risk 1 — reliance on Hibernate's implicit-root resolution.** The library
emits `ORDER BY leader.lastName` without the root alias. Verified working on
Hibernate 7.2.12.Final, and `readAll` always produces exactly one root. But it
is undocumented behaviour we depend on, and a library "fix" to the prefix logic
would change it. Mitigation: the §7 checks are cheap to re-run after any
odata-mini or Hibernate bump. Fallback: switch that column to the
`@ODataMapping` alias, which emits a fully-qualified path.

**Risk 2 — Person pagination with a to-many fetch.** `$fields=teams` combined
with `$top` may trip Hibernate's "firstResult/maxResults specified with
collection fetch; applying in memory" path, which paginates in memory and would
desynchronise the envelope `count`. Not yet exercised — `PersonDto.teams` does
not exist. Fallback: drop the Teams display column and keep the `any()` filter,
which is unaffected.

## 7. Verification

Already verified (2026-08-26, live backend): nav-path sort asc/desc/multi;
nav-path filter; `any()` with `x`/`team`/`Teams`; `any()` in-list; the §3
ordering bug; enum filter regression; flat `leaderId` filter regression.

Still to verify, after the §5 changes land:

1. `GET /api/v1/team` and `/api/v1/person` return 200 again (§5.2).
2. A deliberately bad field name surfaces a readable error, not an empty 403
   (§5.3).
3. `GET /api/v1/person/graph?$top=5&$fields=teams` — inspect the log for
   Hibernate's "applying in memory" warning, and confirm `count` is correct at
   `$skip=20` (risk 2).
4. A person in **no** team still appears in an unfiltered listing.
5. Relation pickers work end-to-end in the UI.

## 8. Documentation

- **Rewrite `issue/relationSorting.md`.** Findings 1, 2, 3 and 6 reason about
  `ODataCriteriaService`, which cometa never calls. Findings 5, 7 and 8 were
  verified live and carry over.
- **Add the two rules to `CLAUDE.md`** under Conventions.
- **Add a backend JUnit test** asserting the generated JPQL for each spelling in
  the matrix. Cheap, and it pins library behaviour across version bumps —
  it would have caught both the §3 bug and the §5.2 regression.
