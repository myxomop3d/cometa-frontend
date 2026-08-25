# Relation filtering and sorting via odata-mini-repo — the standard

**Date:** 2026-08-26
**Status:** design approved, not yet implemented
**Supersedes:** the analysis in `issue/relationSorting.md` (see §7)

## Problem

Cometa's data tables need to filter and sort by fields of *related* objects —
`Team` by its leader's surname, `Person` by the teams they belong to. Today
neither works: leader sorting is disabled outright, and the `multiRelation`
filter variant has never emitted a parseable OData clause.

Prior investigation (`issue/relationSorting.md`) concluded that nested paths
were essentially unusable. That conclusion was drawn from the wrong code path
and is wrong. This document replaces it with the verified mechanism and a
standard to apply to every future table.

## Background: which code path actually runs

odata-mini-repo has **two** independent query builders:

- `ODataCriteriaService` — JPA Criteria API. Builds a second root for the
  count query, hard-throws on `any`/`all`, calls `root.fetch()` for dotted
  paths.
- `BaseCrudRepository.readAll(ODataParams)` — assembles a **JPQL string** from
  `ODataFilter.getWhereJpql()` and `ODataOrderby.getOrderbyJpql()`.

Cometa uses **only the second**. `TeamCrudRepository` →
`EntityGraphBaseCrudRepository` → `BaseCrudRepository`, all of which build JPQL
strings; `ODataCriteriaService` is never instantiated anywhere in the backend.

Every hazard in findings 1, 2, 3 and 6 of `issue/relationSorting.md` is a
property of `ODataCriteriaService`. None of them applies. Conversely, the two
failure modes that *do* apply were not identified there at all.

## Verified behaviour (odata-mini 2.2.0-SNAPSHOT + odata-parser 1.2.2)

Established by compiling a probe against the actual jars and printing both the
field set handed to `checkFields` and the generated JPQL, for `Team`/`Person`
stand-in entities. Not inferred from source reading.

| `$orderby` / `$filter` spelling | `checkFields` (strict) | generated JPQL |
|---|---|---|
| `name desc` | pass | `Team.name desc` |
| `leader/lastName desc` | **`FieldNotFoundException`** | `leader.lastName desc` — **root alias missing** |
| `leader.lastName desc` | — | **ANTLR parse error** |
| `leaderLastName desc` (via `@ODataMapping`) | pass | `Team.leader.lastName desc` |
| `contains_ignoring_case(leaderLastName,'iv')` | pass | `LOWER(Team.leader.lastName) LIKE LOWER('%iv%')` |
| `teams/any(t: t/id eq 5)` | — | **ANTLR parse error** (1-char lambda variable) |
| `teams/any(Teams: Teams/id eq 5)` | pass | `EXISTS (SELECT Teams FROM Person.teams Teams WHERE Teams.id = 5)` |
| `type eq 'CHANGE'` (enum) | pass | `Team.type = 'CHANGE'` |
| any clause *following* an `any()` | pass | **root alias corrupted — see §2.1** |

Three mechanisms explain the table:

1. **`ODataChecker` (2.2.0) registers**: flat entity field names (`leader`,
   `name`); `<Entity>.<flat>` forms (`Team.leader`); and — **only for
   `Collection`-typed fields** — `Capitalize(field).<child>` (`Teams.id`,
   `Teams.name`). A to-one association gets no nested registration, so
   `leader.lastName` is unknown. Aliases declared via `@ODataMapping` are
   registered separately and always pass.

2. **`odata.mini.repo.throw-on-field-not-found`** is new in 2.2.0 and defaults
   to `true`. Cometa sets it nowhere, so validation is strict: an unregistered
   field is a hard `FieldNotFoundException`, not a warning.

3. **The root alias.** `OData2JpqlExpressionVisitor` prefixes the bind variable
   only when the property node's grandparent is a `FirstMemberExprContext`.
   For a raw nav path that test fails on the trailing segment, so the emitted
   JPQL is `ORDER BY leader.lastName` where a flat field yields
   `ORDER BY Team.name`. Resolving an `@ODataMapping` alias takes a different
   route and does emit the prefix.

Point 3 is likely why a raw `release/dateProduction desc` works on another
project: that project almost certainly runs `throw-on-field-not-found: false`,
and Hibernate resolves the unqualified path against the single root. That is
leaning on Hibernate's implicit-root resolution rather than on the library
emitting a correct path. Under cometa's strict default the question never
arises — such a spelling dies at `checkFields` long before Hibernate sees it.

`$fields` is orthogonal to all of this. It feeds cometa's own
`CometaEntityGraph` (`EntityGraphBaseCrudService.parseFields`) to shape the
response JSON, and never touches field validation or JPQL generation.

## Precedent in the official samples

`F:\programming\cs-odata-mini-samples`, samples 1–5. **Every** sample maps
relation fields with `@ODataMapping`; **none** uses a raw `a/b` nav path.

- To-one: `HeaderDto` declares
  `@ODataMapping(entityField="status.code", dtoField="statusCode")` and exposes
  a flat `statusCode` field. `ItemDto` inverts the same idea with
  `@ODataMapping(entityField="header.headerNum", dtoField="headerNum")`.
- To-many (`Header.items`) is handled three ways, **none of them `any()`**:
  - *Display*: a separate DTO + controller pair — `HeaderWithItemsDto` with
    `List<ItemDto> items` at `/api/v1/headeri`, while plain `HeaderDto` has no
    items. It annotates `status.*` only, **never `items`**.
  - *Children of one parent*: a sub-resource `GET /header/{headerId}/items`
    building `ODataFilter` with `parentIdMap(Map.of("header.id", headerId))`,
    which renders as `Item.header.id = '<uuid>'` — note the library prefixes
    the root alias itself here.
  - *Children filtered by parent attributes*: the inverse to-one alias above.

The samples never filter a parent by its collection. We do — see §2 Rule B —
because the alternative (a sub-resource) cannot compose with a data table's
other column filters. `any()` is verified to work; we are simply the first
consumers of that path on this stack, which is why §5 gates it on live checks.

Sample 2's `Header.status` is `@ManyToOne(EAGER)` and its `@ODataMapping`
produces `fetchTablesSet={"status"}` → an unqualified `JOIN FETCH status` in
`readAll`. Those samples ship and work, which materially de-risks the
equivalent `JOIN FETCH leader` for Team.

---

## 1. Scope

- **Team.leader** (`@ManyToOne`) — sort and filter by leader name.
- **Person.teams** (`@ManyToMany`) — filter people by team; display a Teams
  column.
- A written standard both follow, so future tables have a template for either
  cardinality.

Explicitly out of scope: sorting Person by teams (ill-defined over a to-many);
a `/team/{id}/person` sub-resource (build it when a team-members view is
actually wanted); the library's `@Metadata`/`@MetadataField` JSON generator.

## 2. The standard: two rules, keyed on cardinality

### Rule A — to-one relation → `@ODataMapping` alias

Declare on the DTO **class**:

```java
@ODataMapping(entityField = "leader.lastName", dtoField = "leaderLastName")
```

- Wire spelling is the flat alias: `$orderby=leaderLastName desc`,
  `$filter=contains_ignoring_case(leaderLastName,'iva')`.
- **Sortable and filterable.**
- The annotation alone registers the alias. A matching DTO *field* is needed
  only if the scalar should appear in the response body — verified: a DTO class
  carrying the annotation but no such field filters and sorts correctly.
- Naming: `<relationField><CapitalizedProperty>` — `leader` + `lastName` →
  `leaderLastName`.

### Rule B — to-many relation → `any()` lambda, never an annotation

```
$filter=teams/any(Teams: Teams/id in (1,2))
```

- The lambda variable **must** be `Capitalize(collectionField)`. That is
  exactly what `ODataChecker` registers for collection children, and it is what
  makes the clause pass strict validation. A 1-character variable such as `x`
  or `t` is rejected by the ANTLR grammar before validation is even reached.
- **Filterable only, never sortable.**
- **Never** annotate a collection with `@ODataMapping`. Its `entityField`
  prefix feeds `fetchTablesSet`, injecting an inner `JOIN FETCH teams` that
  silently drops parents with no children and duplicates those with several.
  This is why the samples annotate `status.*` but never `items`.
- Count-safe: `count(ODataFilter)` reuses `getWhereJpql()`, and an `EXISTS`
  subquery carries no fetch join.
- **At most one `any()` per `$filter`, and it must be emitted last** — see the
  library bug in §2.1.

### 2.1 Library bug: `any()` corrupts the root alias for every later clause

`OData2JpqlExpressionVisitor:135` declares

```java
Queue<String> bindVariables = new ArrayDeque<>();
```

and uses it as a *stack*. `add()` appends at the tail while `peek()`/`remove()`
read and remove at the **head**. `visitAnyClause` pushes the lambda variable
with `add()` then pops with `remove()` — which evicts the **root** bind
variable, not the lambda variable it just added. Every clause parsed after the
first `any()` therefore takes the lambda variable as its root. A `Deque` used
with `push`/`pop` would be correct.

Verified output:

```
teams/any(Teams: Teams/id eq 5) and contains_ignoring_case(lastName,'iv')
 -> EXISTS (SELECT Teams FROM Person.teams Teams WHERE Teams.id = 5)
    AND LOWER(Teams.lastName) LIKE LOWER('%iv%')          -- want Person.lastName

members/any(Members: Members/email eq 'a') and members/any(Members: Members/lastName eq 'b')
 -> EXISTS (SELECT Members FROM Team.members    Members WHERE Members.email    = 'a')
    AND
    EXISTS (SELECT Members FROM Members.members Members WHERE Members.lastName = 'b')
                                ^^^^^^^ want Team.members
```

Clause order decides the damage: `flat AND any` is correct because the flat
clause is visited first; `any AND flat` is not. The otherwise-passing case
`LOWER(Person.lastName) ... AND EXISTS(...)` works only by luck of ordering.

`Teams` is not a from-element of the outer query, so Hibernate is expected to
reject the query outright rather than return wrong rows — but that is inference
and is on the §6 verification list, not established.

**Consequences for the builders (§4):**

- Emit every `multiRelation` clause **after** all other clauses, regardless of
  descriptor or filter-row order.
- Collapse multiple filter rows targeting the same collection field into a
  single `any(... in (...))` where the operators allow it.
- If two clauses would still require two lambdas (e.g. `teams inArray [1,2]`
  **and** `teams notInArray [3]`, or filters on two different collections at
  once), the second cannot be emitted safely. Person has exactly one collection
  field, so today this is reachable only via the advanced filter mode.
- Report the bug upstream; drop these workarounds once a fixed
  odata-mini-filter-sort ships.

### Supporting constraints

- **Keep `odata.mini.repo.throw-on-field-not-found` at its default `true`.**
  Both rules pass strict validation. Strict is what turns a mistyped field into
  an error instead of a silently ignored clause.
- **Never choose an alias that could occur as a filter literal.**
  `OData2Jpql.changeFieldsNames` runs a global `\b(\w+)\b` replacement over the
  generated JPQL *including inside quoted strings*. Verified:
  `contains_ignoring_case(name,'leaderLastName')` emits
  `LIKE LOWER('%leader.lastName%')`. Compound names like `leaderLastName` are
  safe in practice; single common words are not.

## 3. Backend changes

### `TeamDto`

Add two class-level annotations. Nothing else changes — the nested `leader`
object and `$fields=leader` stay exactly as shipped.

```java
@ODataMapping(entityField = "leader.lastName",  dtoField = "leaderLastName")
@ODataMapping(entityField = "leader.firstName", dtoField = "leaderFirstName")
public class TeamDto extends BaseEntityDto { /* unchanged */ }
```

Consequence to verify (§5, risk 1): `fetchTablesSet` becomes `{"leader"}`, so
`readAll` emits an unqualified `JOIN FETCH leader` alongside the `$fields`
fetchgraph hint.

### `PersonDto`

Add `teams` for **display only** — `List<TeamSummaryDto>`, read-only, gated by
MapStruct `@Condition isEntityLoaded` the same way `TeamDto.leader` is — plus
the corresponding `PersonMapper` mapping.

`TeamSummaryDto` is **new**: `id` and `name` only. Reusing the full `TeamDto`
would nest a `PersonDto leader` inside each team, which closes a type cycle
(`TeamDto.leader` → `PersonDto.teams` → `TeamDto`) that MapStruct may try to
recurse through. The `Ref` suffix is deliberately avoided — in this backend
`*RefMapper` (e.g. `PersonRefMapper`) means a write-side id-to-entity-reference
resolver, which is an unrelated concern.

**No `@ODataMapping` on `PersonDto`.** Filtering by teams needs no backend
change whatsoever; only the display column does.

`PersonRestController` already extends `EntityGraphBaseCrudController`, so
`/api/v1/person/graph?$fields=teams` needs no new route.

## 4. Frontend changes

### Shared builders

`src/lib/odata/build-filter-params.ts`:

- `multiRelation`: replace the hardcoded `x` with `Capitalize(field)`.

```ts
const lambda = field.charAt(0).toUpperCase() + field.slice(1);
clauses.push(`${field}/any(${lambda}: ${lambda}/id in (${idList}))`);
```

`src/lib/odata/build-advanced-filter-params.ts`:

- Same lambda fix in the `inArray`/`notInArray` branch.
- **Split `relation` off from `multiRelation` there.** The branch currently
  routes both through `any()`, so a to-one FK emits `leaderId/any(...)` —
  meaningless for a scalar column. A `relation` must emit
  `${field} in (${ids})`; only `multiRelation` emits the lambda.

Both files, to work around the §2.1 bug:

- Build `multiRelation` clauses into a separate list and append it **after** all
  other clauses, so no clause is ever parsed following an `any()`.
- Merge filter rows targeting the same collection field into one lambda where
  operators allow. If two lambdas would still be required, emit only the first
  and `console.warn` — silently dropping a filter is worse than saying so.
- Add a comment pointing at §2.1 so the workaround is removed, not cargo-culted,
  once the library is fixed.

Both files: correct the `sortField` JSDoc on `FilterDescriptor` and
`FieldEntry`. Both currently offer `"leader.lastName"` as the example, which is
the one spelling that cannot work under any configuration.

### Team

- `src/features/team/columns.tsx` — `enableSorting: true` on the `leader`
  column (currently `false` at line 147).
- `src/features/team/filter-descriptors.ts` — add
  `sortField: "leaderLastName"` to the `leader` descriptor.
- `src/features/team/advanced-api.ts` — add `sortField: "leaderLastName"` to
  `teamFieldByColumnId.leader`.
- The existing flat `leaderId` relation **filter** is untouched.

This also closes the stale-URL hole recorded as finding 4: with `sortField`
set, a bookmarked `?sort=leader.asc` resolves to `leaderLastName` instead of
falling back to the bare column id `leader`.

### Person

- `src/features/person/columns.tsx` — a `teams` column rendering chips, with
  `variant: "multiRelation"`, `enableSorting: false`, and a `relationConfig`
  reusing Team's existing `comboboxQueryOptions`.
- `src/features/person/filter-descriptors.ts` — `{ id: "teams", variant:
  "multiRelation", field: "teams", filterKey: "teamIds" }`.
- `src/features/person/advanced-api.ts` — add `teams` to
  `personFieldByColumnId`; repoint the URL to `/api/v1/person/graph` and set
  `$fields=teams`.
- `src/features/person/api.ts` — `listPath: "/api/v1/person/graph"` and
  `staticParams: { "$fields": "teams" }` on the `createCrudApi` call, mirroring
  what Team already does. `comboboxQueryOptions`, `fetchPersonsFiltered` and
  `personsFilteredQueryOptions` stay on plain `/api/v1/person` — they serve
  relation pickers and never need the teams relation.
- `src/types/api.ts` — add a `TeamSummaryDto` type and `teams?: TeamSummaryDto[]`
  on `PersonDto`.

### Tests

- `build-filter-params.test.ts` / `build-advanced-filter-params.test.ts` —
  update the `multiRelation` expectations to the `Capitalize(field)` lambda;
  add a case pinning `relation` + `inArray` to `field in (...)`; add a case for
  alias `sortField` emission.

## 5. Risks, each with a fallback

Neither is settleable statically. Both are checked against the running backend
during implementation, before the work is called done.

**Risk 1 — `JOIN FETCH leader` overlapping the entity-graph hint.**
`@ODataMapping` makes `fetchTablesSet={"leader"}`, so `readAll` emits an
unqualified `JOIN FETCH leader` *and* the `$fields=leader` fetchgraph hint
applies to the same association. Sample 2 ships this exact shape and works, and
`Team.leader` is `optional=false, nullable=false` so an inner join loses no
rows — but the overlap itself is untested.
*Fallback:* drop `$fields=leader` from Team's list queries and let the join
fetch populate the relation.

**Risk 2 — Person pagination with a to-many fetch.** `$fields=teams` combined
with `$top` may trip Hibernate's "firstResult/maxResults specified with
collection fetch; applying in memory" path, which paginates in memory and would
desynchronise the envelope `count`.
*Fallback:* drop the Teams display column and `PersonDto.teams` entirely,
keeping the `any()` filter — which needs no backend change and is unaffected.

## 6. Verification against a live backend

Given that the document this one replaces was wrong precisely because it was
never exercised live, implementation is not complete until this matrix runs
green against a running backend, with results recorded.

1. `GET /api/v1/team/graph?$top=5&$fields=leader&$orderby=leaderLastName desc`
   → 200; rows ordered by leader surname; `leader` populated on every row.
2. Same with `asc`; and combined `$orderby=leaderLastName asc,name desc`.
3. `GET /api/v1/team/graph?$filter=contains_ignoring_case(leaderLastName,'<x>')`
   → envelope `count` matches a direct SQL count.
4. Confirm the logged JPQL contains `JOIN FETCH leader`, and that the unfiltered
   row count equals plain `/api/v1/team`'s (risk 1 — no rows lost).
5. `GET /api/v1/person/graph?$top=5&$fields=teams&$filter=teams/any(Teams: Teams/id in (N))`
   → 200; correct people; `count` matches SQL.
6. Inspect the Person query log for Hibernate's "applying in memory" warning
   (risk 2) and confirm `count` is correct at `$skip=20`.
7. Confirm a person belonging to **no** team still appears in an unfiltered
   `/person/graph?$fields=teams` listing.
8. **§2.1 bug behaviour.** Send the broken ordering deliberately —
   `$filter=teams/any(Teams: Teams/id eq N) and contains_ignoring_case(lastName,'iv')`
   — and record whether Hibernate rejects it (expected) or silently returns
   wrong rows. If it is silent, the §4 builder ordering stops being a
   nice-to-have and becomes the only thing standing between a user and quietly
   incorrect data, which should be reflected in how loudly the workaround is
   documented.
9. Confirm the fixed ordering — the same two clauses with the `any()` last —
   returns rows matching a direct SQL equivalent.
10. Regression: `$filter=leaderId eq N` and `$filter=type eq 'CHANGE'` still
    behave as before.

## 7. Documentation

- **Rewrite `issue/relationSorting.md`**, not append to it. Findings 1, 2, 3
  and 6 reason about `ODataCriteriaService`, which cometa never calls, so they
  describe hazards that do not exist here while missing the two that do (strict
  `checkFields`; the dropped root alias). Findings 5, 7 and 8 were verified
  live and are carried over intact. The rewrite records the §2 rules and the
  verified matrix above.
- **Add the two rules to `CLAUDE.md`** under Conventions, so new tables pick
  them up without reading the spec.
- **Add a JUnit test in the backend** asserting the generated JPQL string for
  each spelling in the matrix. It is cheap, it pins library behaviour across
  future version bumps, and it is what would have caught this class of error a
  version ago.
