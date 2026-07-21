# Table Page Unification — Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Make the switchable simple/advanced filter page the single table-page pattern for
box and flow resources, then extract the shared logic into a reusable hook so
future table pages can adopt it with a small config object.

Three phases:

1. **Consolidate box pages** — delete the three legacy/duplicate box routes; the
   switchable page becomes the sole `/box-dice`.
2. **Flow switchable page** — build a switchable `/flow` (by duplicating the
   proven box pattern) and remove the advanced-only `/flow-advanced`.
3. **Extract abstraction** — pull the shared logic into a
   `useSwitchableTablePage(config)` hook + a generic search factory, and refactor
   both `/box-dice` and `/flow` onto it.

## Background

Four route files currently duplicate a ~200-line switchable/advanced table
pattern: `box-dice` (simple), `box-dice-advanced`, `box-dice-switchable`, and
`flow-advanced`. The only per-resource variance is: the two query-option
functions, columns, sheet component, row-action type, filter descriptors +
simple field keys, labels/title, invalidation key, and initial column
pinning/visibility.

Two other pages — `/box` and `/automated-system` — use a *different*, older stack
(`SimpleTable` + `useFilters` + `FilterBar`/`TextFilter`, with inline row
editing). These are NOT part of the switchable pattern.

## Decisions (locked)

- **URLs:** rename to clean paths — switchable box → `/box-dice`; switchable flow
  → `/flow`. The `-switchable` suffix is dropped.
- **Flow:** the switchable page replaces `/flow-advanced` (removed).
- **Abstraction shape:** a shared **hook** (`useSwitchableTablePage(config)`),
  not a monolithic generic component. Each page keeps its own JSX (header,
  toolbar swap, sheet).
- **Scope:** remove `/box` entirely; **leave `/automated-system` as-is** (it is a
  genuinely different inline-edit page type — forcing it into the switchable mold
  would drop inline editing and fabricate an advanced mode it never had). The
  abstraction covers only `/box-dice` and `/flow` now, built so future pages can
  adopt it.

## Phase 1 — Consolidate box pages

- **Delete** route folders: `src/routes/box-dice/` (simple),
  `src/routes/box-dice-advanced/`, `src/routes/box/` (legacy inline-edit).
- **Rename** the switchable page into the freed `/box-dice` path: move
  `src/routes/box-dice-switchable/*` → `src/routes/box-dice/`, updating
  `createFileRoute("/box-dice/")` and `useNavigate({ from: "/box-dice/" })`.
- **Sidebar** (`src/components/app-sidebar.tsx`): remove the "Boxes",
  "Boxes (Dice) Advanced", and "Boxes (Dice) Switchable" entries; keep a single
  `{ to: "/box-dice", label: "Boxes (Dice)" }`.
- **Cleanup:** after deletion, if `src/api/box.ts` is imported by no remaining
  file, delete it. Same check for any `@/api/item` / `@/api/thing` query
  functions that only `/box` used. Leave shared `components/filters/*` untouched
  (low risk, potentially reused).
- The router plugin regenerates `src/routeTree.gen.ts`.

**Acceptance:** `/box-dice` serves the switchable page; `/box`,
`/box-dice-advanced`, `/box-dice-switchable` 404; `tsc --noEmit` clean; full
vitest suite green.

## Phase 2 — Flow switchable page

The flow feature already has everything needed: `flowApi.dataTableQueryOptions`
(simple), `flowApi.advancedDataTableQueryOptions`, `deriveColumnFiltersFromSearch`
(flow), `getFlowColumns`, `FlowSheet`, `FlowRowAction`.

- **Create** `src/routes/flow/-search.ts` — flow's union search schema +
  `buildModeToggleUpdates`, mirroring box's `-search.ts`. Flow's simple-mode
  fields are the 6 flat text/select params: `key`, `caption`, `integrity`,
  `confidentiality`, `dataClass`, `dataType`.
- **Create** `src/routes/flow/index.tsx` — switchable page mirroring the box
  switchable page, wired to the flow feature and `["flows"]` invalidation. Title
  "Flows", unit "flows", add button "Add Flow".
- **Delete** `src/routes/flow-advanced/`.
- **Sidebar:** replace `{ to: "/flow-advanced", label: "Flows (Advanced)" }` with
  `{ to: "/flow", label: "Flows" }`.

**Acceptance:** `/flow` serves a switchable flow page (both modes work);
`/flow-advanced` 404s; `tsc` clean; suite green.

## Phase 3 — Extract the shared hook + search factory

Per the "shared hook" decision, logic centralizes but each page keeps its JSX.

### New shared modules

**`src/lib/data-table/switchable-search.ts`** (pure, unit-tested):
- `filterSchema` (zod), `parseFilters(raw): ExtendedColumnFilter[]`,
  `parseIdList(raw): number[] | undefined` — moved here once, eliminating the
  triplication across box/flow route files.
- `SwitchableSearchBase` — `{ page, pageSize, sort, advanced, filters,
  joinOperator }`.
- `makeSwitchableSearch<TSimple>(validateSimpleFields: (search) => TSimple):
  (search: Record<string, unknown>) => SwitchableSearchBase & TSimple` — builds
  the full `validateSearch`, layering the resource's simple fields onto the
  common + advanced fields.
- `buildModeToggleUpdates(simpleFilterKeys: readonly string[], nextAdvanced:
  boolean): Record<string, unknown>` — sets `advanced` (undefined when false),
  `page: 1`, and every simple key + `filters` + `joinOperator` to `undefined`.

**`src/hooks/use-switchable-table-page.ts`** — the hook:
- Input: `{ config, search, navigate }` where `config` is the per-resource config
  (below).
- Returns: `{ table, advanced, data, count, pageCount, toggleMode,
  handleFilterChange, rowAction, setRowAction }`.
- Encapsulates: the `queryOpts` branch (simple vs advanced), the `onNavigate`
  undefined/null cleaner, the shared `useDataTable` call, `toggleMode` (via
  `buildModeToggleUpdates`), and the advanced `handleFilterChange`
  (JSON-stringify filters / joinOperator to URL).

**`src/components/data-table/advanced-filter-toggle.tsx`** — the shared
"Advanced filters" toggle button (`variant="outline"`, `SlidersHorizontal` icon,
`aria-pressed`, `border-primary text-primary` when active), props `{ advanced,
onToggle }`.

### Per-resource config

`src/features/box/switchable-config.ts` and `src/features/flow/switchable-config.ts`:

```ts
interface SwitchableTableConfig<TDto> {
  queryKey: readonly unknown[];                 // ["boxes"] / ["flows"]
  simpleQueryOptions: (p: SimpleParams) => QueryOptions;
  advancedQueryOptions: (p: AdvancedParams) => QueryOptions;
  deriveColumnFilters: (search: Record<string, unknown>) => { id: string; value: unknown }[];
  validateSimpleFields: (search: Record<string, unknown>) => Record<string, unknown>;
  simpleFilterKeys: readonly string[];
  getColumns: (opts: { setRowAction: (a: RowAction<TDto> | null) => void }) => ColumnDef<TDto, unknown>[];
  initialColumnPinning?: ColumnPinningState;
  initialColumnVisibility?: VisibilityState;
}
```

### Each route file reduces to

- `export const Route = createFileRoute("/box-dice/")({ validateSearch:
  makeSwitchableSearch(boxSwitchableConfig.validateSimpleFields), loaderDeps,
  loader: makeSwitchableLoader(boxSwitchableConfig), component })`
  where `makeSwitchableLoader(config)` returns the branching loader.
- The component calls `useSwitchableTablePage({ config, search, navigate })`,
  then renders: page header (title + count), the `DataTable` with a toolbar
  ternary (`DataTableAdvancedToolbar` when `advanced`, else `DataTableToolbar`),
  `<AdvancedFilterToggle>` + the resource's Add button as toolbar children, and
  its own `Sheet` (`BoxSheet` / `FlowSheet`) driven by `rowAction`.

The resource-specific JSX that stays in the page: the `<h1>`/count text, the Add
button label, and the Sheet element (different prop names `box=` vs `flow=`).

### Behavior preservation

Phase 3 is a pure refactor — no user-visible behavior changes. The box
`-search.ts` and flow `-search.ts` collapse into `validateSimpleFields` functions
+ `simpleFilterKeys` in each config; their generic parts move to
`switchable-search.ts`.

## Global constraints

- Path alias `@/` → `src/`. `src/routeTree.gen.ts` auto-generated (never
  hand-edit); regenerated by the running Vite dev server.
- Dash-prefixed route-folder files (`-search.ts`) are not routes.
- TS strict, `noUnusedLocals`/`noUnusedParameters`.
- `/automated-system` and its stack (`SimpleTable`, `useFilters`, `FilterBar`)
  are out of scope and must remain unchanged.
- Dev server must run with `--host`; browser verification uses
  `VITE_MOCK_API=true` (auth is mocked).

## Verification (each phase)

1. `npx tsc --noEmit` — clean.
2. `npx vitest run` — full suite green.
3. Browser drive under `VITE_MOCK_API=true`:
   - Phase 1: `/box-dice` loads switchable; old box URLs 404.
   - Phase 2: `/flow` both modes — apply a simple filter, toggle to advanced
     (simple cleared), add an advanced filter, toggle back (advanced cleared);
     sort, paginate, Add Flow; zero console errors.
   - Phase 3: re-run the box + flow flows to prove the refactor preserved
     behavior.

## Non-goals

- No changes to `/automated-system`.
- No migration of `/box` to the new stack (it is removed, not migrated).
- No monolithic generic page component — the abstraction is a hook.
- No new features (sort UI, filters, editing) beyond what the pages already have.
