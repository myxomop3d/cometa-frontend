# `PersonDto.teams` forces Hibernate into in-memory pagination

**Status:** fixed (updated 2026-08-27). Backend commits `9d84518` (detect
to-many attributes in an entity graph via the JPA metamodel), `3cc44d4` (page
roots then fetch the graph when it pulls a collection), and `b3498cb` (read
the list count and page in one transaction), on branch `feature/gm` in
`F:\programming\cometa`, implement option 2 below. Design record:
`docs/superpowers/specs/2026-08-27-entity-graph-collection-pagination-design.md`.

`$fields=teams` still remains unconditional on every Person list request —
that decision (option 1, declined) is unchanged by this work. What changed is
that the underlying `teams` collection fetch is now cheap: `EntityGraphBaseCrudRepository`
checks the JPA metamodel to see whether a request's entity graph pulls a
to-many collection, and when it does and the request is paged, the read
splits into a plain query that pages the roots (so `LIMIT`/`OFFSET` reach
Postgres) followed by a second query that fetches the graph for exactly those
ids, with the first query's row order restored in Java. To-one graphs such as
`/team`'s `$fields=leader` are unaffected and still take the single-query
path. This is exactly what option 2 promised, and it is what live
verification below confirms.

## The finding

Fetching the `teams` to-many collection alongside `$top`/`$skip` makes Hibernate
abandon SQL-level pagination and paginate in the application layer instead:

```
WARN org.hibernate.orm.query : HHH90003004: firstResult/maxResults specified
with collection fetch; applying in memory
```

The warning fired on **every** paginated request that included `$fields=teams` —
three out of three during the verification run.

This was a **performance** defect, not a correctness one — the answer was
always right. It was verified once more, live, after the fix landed
(`.superpowers/sdd/2026-08-27-entity-graph-collection-pagination/task-4-report.md`
has the full transcript):

| Check | Result |
|---|---|
| `teams` populated with the right shape (`{id, name}`, no `leader` nesting) | PASS |
| `count` correct on a later page (`$top=20&$skip=20`) — 222, 20 rows returned | PASS |
| Persons in no team still appear (`$top=200`) — 200 returned, 198 teamless | PASS |
| `HHH90003004` in-memory-pagination warning count across the whole matrix | **0 (PASS)** |
| Page query for `$top=20&$skip=20&$fields=teams` reaches Postgres as SQL paging | `select ... from gmsb.person p1_0 order by p1_0.id offset 20 rows fetch first 20 rows only`, followed by a separate `where p1_0.id in (83,84,...,102)` fetch for the teams graph — **PASS** |

At the current dataset (222 persons) the fix means each page request pages
20 root rows in SQL and then fetches the graph for exactly those 20 ids,
instead of materialising all 222 matching rows and slicing them in the JVM.
The cost no longer scales with the whole person table, only with the page
size.

## Why it matters more than the row count suggests

`src/features/person/api.ts` wires the Person list query with
`staticParams: { "$fields": "teams" }`, and `src/features/person/advanced-api.ts`
sets `searchParams.set("$fields", "teams")` on every advanced-mode request too —
together these make `$fields=teams` **unconditional for every Person list
request**, not an opt-in. That is what turns a tolerable one-off into the
default path for the whole table.

The unconditional fetch is deliberate and has been signed off (option 1) — so a
fix must make the *underlying* collection fetch cheap, rather than trying to
avoid asking for `teams` in the first place.

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

The Teams **display column** has shipped (`src/features/person/columns.tsx`).
`$fields=teams` is still requested unconditionally on every Person list read
(option 1 remains declined, see below), but the fetch it triggers is now
cheap — see the results table under "The finding" above for the measured
outcome.

## What to do when picking this up

Options, roughly in increasing order of effort:

1. ~~**Fetch `teams` only when the column is visible.**~~ **Considered and
   declined (2026-08-26.)** The obvious cheap win — gating
   `staticParams: { "$fields": "teams" }` on column visibility in
   `src/features/person/api.ts` and `src/features/person/advanced-api.ts` — was
   put to the owner and explicitly turned down: fetching `teams` unconditionally
   is fine, even when the column is hidden.

   Do not implement this without asking first. It is not an oversight, and it
   carries a real cost of its own: the fetch would depend on table UI state, so
   toggling the column in View Options would change the query key and refetch
   the whole page, and the two modes (simple and advanced) would each need to
   thread visibility down into their query builders.

   The accepted position is: pay the in-memory-pagination cost unconditionally,
   and fix the underlying problem via option 2 or 3 when it actually starts to
   hurt.

2. ~~**Two-query fetch.**~~ **Implemented (2026-08-27).** Page the persons
   normally (no collection fetch, so `LIMIT`/`OFFSET` reach the DB), then issue
   one batched follow-up for the team names of the returned ids. This is what
   `EntityGraphBaseCrudRepository` does now: a metamodel check detects when a
   request's entity graph pulls a to-many collection, and when the request is
   also paged, the repository pages the root ids with a plain query first and
   fetches the graph for those ids second, restoring the original row order in
   Java. Keeps pagination in SQL at the cost of one extra round trip, exactly
   as this option predicted. Backend commits `9d84518`, `3cc44d4`, `b3498cb`
   on `feature/gm`; design record
   `docs/superpowers/specs/2026-08-27-entity-graph-collection-pagination-design.md`.
3. **Fix it at the ORM layer.** A `@BatchSize` / `subselect` fetch strategy on
   `Person.teams`, or an explicit projection query, can keep pagination in SQL.
   Needs care: the naive `JOIN FETCH` is exactly what produces the warning.
   Not needed — option 2 resolved the problem without touching the ORM fetch
   strategy.

The triage also ruled out "working around" it by clamping page size or by
fetching the collection eagerly on every entity — both would have traded this
problem for a worse one. Kept here as a record of what was ruled out, since
option 2 made neither necessary.

## Related

- `issue/relationSorting.md` — the broader OData relation filter/sort hazard log.
- `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md` — the
  design that introduced `$fields=teams`.
- `docs/superpowers/specs/2026-08-27-entity-graph-collection-pagination-design.md` —
  the design that fixed the in-memory pagination described in this issue.
