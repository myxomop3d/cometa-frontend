---
name: project_nested-relation-write-standard
description: Ongoing multi-task migration (backend+frontend) to Flat/Full DTO split and relation-ref writes; where the $fields=leader landmine lives
type: project
---

The repo is mid-migration (branch `feature/gm`, plan at
`.superpowers/sdd/2026-08-27-nested-relation-write-standard/`) to a
Flat/Full DTO convention: `XFlatDto` = scalars only (what a parent uses to
reference a child; on write only `id` is honoured), `XDto extends XFlatDto`
adds relations, populated only when the caller requests `$fields=<relation>`.
Applied first to Team/Person (`leader`, `teams`). Tasks 1-8 done as of
2026-08-27; Task 9 ("Team filter spelling and detail-path guard") is the one
that's supposed to close the read-path gap described below.

**Why:** backend dropped scalar FK columns/DTO fields (e.g. `TeamDto.leaderId`)
entirely — the id is now reachable only inside the nested ref, and only on
requests that opted into it via `$fields=`.

**The landmine:** `teamDtoToForm` (`src/features/team/mappers.ts`) does
`dto.leader?.id ?? 0`, and `0` trips the required-positive zod rule → shows
"Leader is required" for a team that actually has one. This is currently
*not* triggered through the wired UI path because both team-list queries
(`src/features/team/api.ts` `baseApi` via `staticParams: {"$fields":"leader"}`
and `src/features/team/advanced-api.ts` `advancedDataTableQueryOptions`)
already request `$fields=leader`, and `TeamSheet` is only ever fed
`row.original` from those lists (`src/routes/team/index.tsx`). But
`teamApi.detailQueryOptions` (plain `/api/v1/team/{id}`, used today only by
`team-combobox.tsx` for label display) does NOT request `$fields=leader` — if
anything ever feeds that query's result into `teamDtoToForm`, the trap fires
for real.

**How to apply:** when reviewing later tasks in this plan (Task 9 onward),
check whether the detail-path guard actually closes this — i.e. whether any
new consumer of `detailQueryOptions`/plain-resource fetches gets piped into
a DtoToForm mapper without `$fields=leader`. Same pattern will likely repeat
for `PersonDto.teams` once Task 11/12 (Person form + Teams picker) land —
check `fetchPersonsFiltered`/`personsFilteredQueryOptions` request `/api/v1/person`
with no `$fields=teams`, so `PersonDto.teams` is correctly optional but will
read as `undefined` there.
