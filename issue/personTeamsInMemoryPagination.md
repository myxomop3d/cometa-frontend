# `PersonDto.teams` forces Hibernate into in-memory pagination

**Status:** open, deliberately deferred (2026-08-26). The backend mapping is
committed and correct; it is simply **not consumed** by the frontend yet, so
this costs nothing today. Read "What to do when picking this up" before
enabling the Teams column.

## The finding

Fetching the `teams` to-many collection alongside `$top`/`$skip` makes Hibernate
abandon SQL-level pagination and paginate in the application layer instead:

```
WARN org.hibernate.orm.query : HHH90003004: firstResult/maxResults specified
with collection fetch; applying in memory
```

The warning fired on **every** paginated request that included `$fields=teams` —
three out of three during the verification run.

This is a **performance** defect, not a correctness one. Everything still
returns the right answer:

| Check | Result |
|---|---|
| `teams` populated with the right shape (`{id, name}`, no `leader` nesting) | PASS |
| `count` correct on a later page (`$top=20&$skip=20`) — 222, 20 rows returned | PASS |
| Persons in no team still appear (`$top=200`) — 200 returned, 198 teamless | PASS |
| No in-memory-pagination warning | **FAIL** |

At the current dataset (222 persons) the practical cost is that each page
request materialises all 222 matching rows and slices them in the JVM, rather
than pushing `LIMIT`/`OFFSET` to Postgres. It scales linearly with the person
table.

## Why it matters more than the row count suggests

The implementation plan wires the Person list query with
`staticParams: { "$fields": "teams" }` — which makes `$fields=teams`
**unconditional for every Person list request**, not an opt-in. That is what
turns a tolerable one-off into the default path for the whole table. Any fix
should reconsider that too.

## What was verified, and where

Full transcript, including verbatim commands and output:
`.superpowers/sdd/2026-08-26-odata-relation-filter-sort/task-3-report.md`

Backend commit carrying the mapping: `e136533`
(`feat(person): expose read-only teams collection via $fields=teams`) in
`F:/programming/cometa`, on top of `6e583ba`.

Files it added/changed:
- `cometa-service-module/.../service/dto/TeamSummaryDto.java` (new — `id`, `name` only)
- `cometa-service-module/.../service/dto/PersonDto.java` (added `List<TeamSummaryDto> teams`)
- `cometa-service-module/.../service/mapper/PersonMapper.java` (`@Condition` lazy guard,
  `toSummary`, `teams` ignored on both write paths)

The mapping itself is sound and was reviewed: no `@ODataMapping` on the
collection (which would add an inner `JOIN FETCH` and drop teamless persons),
the lazy collection is guarded by `Hibernate.isInitialized` so an unfetched
collection serialises as `null` instead of triggering N+1, and `TeamSummaryDto`
deliberately omits `leader` to avoid the `TeamDto.leader -> PersonDto.teams ->
TeamDto` cycle. `javap` confirmed `PersonMapperImpl implements PersonMapper`
(`interfaces: 1`), so the MapStruct corruption trap did not bite.

## Current state of the frontend

The team-membership **filter** shipped and does not depend on any of this — it
is an OData `any()` lambda evaluated in SQL:

```
teams/any(x: x/id in (1425,1432))
```

The Teams **display column** was not shipped. That is the only piece blocked by
this issue.

## What to do when picking this up

Options, roughly in increasing order of effort:

1. **Accept it.** At a few hundred persons the in-memory slice is survivable.
   If you take this route, drop `staticParams: { "$fields": "teams" }` from the
   default list query anyway and request `teams` only when the column is
   actually visible, so the cost is paid only when the data is used.
2. **Two-query fetch.** Page the persons normally (no collection fetch, so
   `LIMIT`/`OFFSET` reach the DB), then issue one batched follow-up for the team
   names of the returned ids. Keeps pagination in SQL; costs one extra round
   trip.
3. **Fix it at the ORM layer.** A `@BatchSize` / `subselect` fetch strategy on
   `Person.teams`, or an explicit projection query, can keep pagination in SQL.
   Needs care: the naive `JOIN FETCH` is exactly what produces the warning.

Do **not** "work around" it by clamping page size or by fetching the collection
eagerly on every entity — both trade this problem for a worse one.

## Related

- `issue/relationSorting.md` — the broader OData relation filter/sort hazard log.
- `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md` — the
  design this work implements.
