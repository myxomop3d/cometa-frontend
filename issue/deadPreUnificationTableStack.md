# The pre-unification table stack is now dead code — delete or keep?

**Status:** open, decision needed. Not a defect: the code works, it simply has
no callers any more. Created when `/automated-system` moved to the switchable
DataTable (`docs/superpowers/plans/2026-09-05-automated-system-leader-relation.md`,
frontend `95b6699`), which removed the last consumer.

**The decision is a deletion, so it was deliberately left to the repo owner
rather than folded into that change.** What *was* done is the minimum needed
to stop the docs lying: `CLAUDE.md` now marks these as unused and its "New
tables" convention points at the live stack instead. The files themselves are
untouched.

## What is dead

Eleven files, verified at frontend `d5cb4c4` to have zero importers anywhere
in `src/` (each is referenced only by itself, or by another file in this same
list):

| File | Last consumer |
|---|---|
| `src/components/SimpleTable.tsx` | `/automated-system` |
| `src/hooks/useFilters.ts` | `/automated-system` |
| `src/types/table.ts` (`EditConfig`) | `SimpleTable.tsx` only |
| `src/components/filters/FilterBar.tsx` | `/automated-system` |
| `src/components/filters/TextFilter.tsx` | `/automated-system` |
| `src/components/filters/CheckboxFilter.tsx` | — |
| `src/components/filters/DateRangeFilter.tsx` | — |
| `src/components/filters/NumberRangeFilter.tsx` | — |
| `src/components/filters/SelectFilter.tsx` | — |
| `src/components/filters/RelationFilterDropdown.tsx` | — |
| `src/components/filters/RelationFilterModal.tsx` | — |

The check that establishes it:

```bash
grep -rln "components/filters" src --include=*.ts --include=*.tsx   # no output
grep -rl "useFilters"  src --include=*.ts --include=*.tsx           # only useFilters.ts
grep -rl "SimpleTable" src --include=*.ts --include=*.tsx           # only SimpleTable.tsx
grep -rl "EditConfig"  src --include=*.ts --include=*.tsx           # only SimpleTable.tsx, types/table.ts
```

Four of the six unlisted filter components had already lost their consumers
before this change; `/automated-system` was holding up `FilterBar` and
`TextFilter`, and with them the whole directory.

Note `src/components/relation-picker.tsx` is **live** — it serves the
`relation`/`multiRelation` variants of the new stack and is not part of this
set. Do not sweep it up.

## Why this is worth deciding rather than ignoring

The real cost is not disk space, it is misdirection. Before `d5cb4c4`,
`CLAUDE.md`'s Conventions section told a future agent to "pick filters from
`components/filters/*`" — which would have sent the next person building a
table straight into code that nothing else uses and no page exercises. That
line is corrected, but as long as the files exist, a search for
"TextFilter" or "how do filters work here" still lands on them first.

There is also a live/dead pairing that invites the wrong choice:
`components/filters/RelationFilterModal.tsx` (dead) versus
`components/data-table/*` plus the `filterVariants` in
`src/config/data-table.ts` (live) both look like "the filter code".

## Options

**1. Delete all eleven.** Git history keeps them; the switchable DataTable
covers every variant they implemented (`text`, `number`, `range`, `date`,
`boolean`, `select`, `multiSelect`, `relation`, `multiRelation` — see
`src/config/data-table.ts`). Removes the ambiguity outright. Also drops the
`react-refresh` lint errors those files contribute.

**2. Keep, as-is.** They are a working reference implementation of a simpler
table, and `SimpleTable` is genuinely easier to read than the
`useDataTable` + toolbar + descriptor composition that replaced it. Cost is
the ongoing misdirection, now partly mitigated by the `CLAUDE.md` notes.

**3. Move them to a clearly-marked location** (`src/legacy/` or similar) —
keeps the reference, removes the ambiguity, costs one import-path sweep. But
nothing imports them, so the sweep is empty and this is really option 1 with
extra steps.

**Recommendation:** option 1. Nothing imports them, every capability is
covered by the live stack, and git remembers.

## If you delete

- Remove the four annotated lines from `CLAUDE.md`'s Project Structure block
  (the `filters/`, `SimpleTable.tsx`, `useFilters.ts` and `table.ts` entries)
  rather than leaving "UNUSED" markers pointing at absent files.
- `src/types/table.ts` holds only `EditConfig` and its satellites; confirm
  before deleting the whole file.
- Run `npx tsc -b` and `npx vitest run` — no test imports any of these, so
  both should stay green.
