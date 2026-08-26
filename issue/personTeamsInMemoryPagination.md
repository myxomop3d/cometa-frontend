# `PersonDto.teams` forces Hibernate into in-memory pagination

**Status:** open, deliberately deferred (updated 2026-08-26). The Teams
display column has shipped and `$fields=teams` is now requested on every
Person list read, so the in-memory pagination described below is **active in
production**, not hypothetical. This is a known, accepted cost — the owner
decided to ship the column and live with it for now, and separately declined
gating the fetch on column visibility (see option 1). The real fix, when this
starts to hurt, is option 2 or 3.

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
Nothing is blocked by this issue anymore — it is now a live performance debt
being paid on every Person list read, not a blocker on any pending work.

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
