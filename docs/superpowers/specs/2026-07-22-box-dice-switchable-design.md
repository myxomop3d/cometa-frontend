# Box Dice Switchable — Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Combine the two existing box-dice pages — `/box-dice` (simple faceted filters) and
`/box-dice-advanced` (advanced filter list) — into a single new page,
`/box-dice-switchable`, with an "Advanced filters" toggle that swaps the filter
UI in place. Modeled on the tablecn.com example, whose toolbar has an "Advanced
filters" button that switches the filter variant.

The two existing pages remain unchanged. This is a new, isolated route.

## Background

The two pages differ in three coupled ways, not just their toolbar:

| Aspect | Simple (`/box-dice`) | Advanced (`/box-dice-advanced`) |
| --- | --- | --- |
| URL state | flat params (`name`, `shape`, `numMin`…) | `filters` (JSON `ExtendedColumnFilter[]`) + `joinOperator` |
| Query builder | `boxApi.dataTableQueryOptions` (via `deriveColumnFiltersFromSearch` + descriptors) | `boxApi.advancedDataTableQueryOptions` |
| Toolbar | `DataTableToolbar` (faceted chips, filters ↔ flat params via `useDataTable`) | `DataTableAdvancedToolbar` (`DataTableFilterList`, manages `filters`/`joinOperator` via its own `onChange`) |

The table, columns (`getBoxColumns`), and create/update sheet (`BoxSheet`) are
identical between the two pages.

## Design

A single route holds **both** URL state shapes and picks the query builder +
toolbar based on an `advanced` boolean flag in the URL.

### 1. Route & search schema

New file: `src/routes/box-dice-switchable/index.tsx`.

`validateSearch` returns a union of both schemas:

- **Common:** `page: number`, `pageSize: number | undefined`, `sort: string | undefined`, `advanced: boolean` (default `false`).
- **Simple-mode fields** (copied from `box-dice`): `name`, `objectCode`,
  `shape`, `numMin`, `numMax`, `checkbox`, `dateStrFrom`, `dateStrTo`, `tags`,
  `itemId`, `thingIds`, `oldItemId`, `oldThingIds`.
- **Advanced-mode fields** (copied from `box-dice-advanced`):
  `filters: ExtendedColumnFilter[]`, `joinOperator: "and" | "or"`.

Only one mode's filter params are populated at a time. The `parseIdList`,
`parseFilters`, and `filterSchema` helpers are carried over from the two source
pages.

### 2. Loader & query — branch on `advanced`

```ts
loader: ({ context, deps }) =>
  deps.advanced
    ? context.queryClient.ensureQueryData(
        boxApi.advancedDataTableQueryOptions({
          page, pageSize, sort, filters, joinOperator,
        }),
      )
    : context.queryClient.ensureQueryData(
        boxApi.dataTableQueryOptions({
          page, pageSize, sort,
          columnFilters: deriveColumnFiltersFromSearch(flatFilterParams),
        }),
      );
```

The component mirrors this branch to build `queryOpts`, then calls a single
`useSuspenseQuery(queryOpts)`. `advanced` is part of `loaderDeps` (the whole
search object), so toggling it re-runs the loader and prefetches the new mode's
data before render.

### 3. Toolbar swap + toggle control

One shared `useDataTable` instance drives sort / pagination / column visibility /
pinning for both modes, with `initialColumnPinning: { left: ["select", "id"], right: ["actions"] }`
and `initialColumnVisibility: { "item.name": false }` (as the advanced page does).

Toolbar selection:

- `advanced === false` → `<DataTableToolbar>` — faceted chips, driven by
  `useDataTable`'s columnFilters ↔ flat params, exactly as `box-dice`.
- `advanced === true` → `<DataTableAdvancedToolbar filters joinOperator onChange>` —
  the filter list, exactly as `box-dice-advanced` (including its
  `handleFilterChange` that writes `filters`/`joinOperator` to the URL).

A small **"Advanced filters" toggle button** (outline, `SlidersHorizontal`
icon, highlighted / `aria-pressed` when active) is passed as `children` into
whichever toolbar is active, alongside the existing **"Add Box"** button.

Toggling calls:

```ts
onNavigate({
  advanced: !advanced,
  page: 1,
  // clear ALL simple-mode fields AND filters/joinOperator → undefined
  name: undefined, objectCode: undefined, shape: undefined,
  numMin: undefined, numMax: undefined, checkbox: undefined,
  dateStrFrom: undefined, dateStrTo: undefined, tags: undefined,
  itemId: undefined, thingIds: undefined, oldItemId: undefined, oldThingIds: undefined,
  filters: undefined, joinOperator: undefined,
});
```

`onNavigate` already strips `undefined`/`null` keys, so this cleanly clears
every mode-specific param. This is the chosen **clear-on-switch** behavior — no
filter translation across modes.

### 4. Shared, unchanged pieces

`getBoxColumns`, `BoxSheet` (create/update), row-action state
(`useState<BoxRowAction | null>`), and `queryClient.invalidateQueries({ queryKey: ["boxes"] })`
on sheet success — all identical to both existing pages.

### 5. Sidebar

Add `{ to: "/box-dice-switchable", label: "Boxes (Dice) Switchable" }` to
`navItems` in `src/components/app-sidebar.tsx`.

## Non-goals

- No changes to `/box-dice` or `/box-dice-advanced`.
- No filter translation across modes (clear on switch).
- No shared `<BoxDiceTable>` abstraction. Extracting one that all three routes
  share would touch the existing pages and add abstraction beyond what this demo
  needs; it can be a separate refactor later.

## Verification

1. `npx tsc --noEmit` — clean.
2. Drive in the browser under `VITE_MOCK_API=true`:
   - Load `/box-dice-switchable` (defaults to simple mode).
   - Apply a simple filter (e.g. `name`), confirm the table filters and the URL
     gets the flat param.
   - Toggle to advanced: confirm simple filter params are cleared and the filter
     list renders.
   - Add an advanced filter, confirm the table filters and `filters` JSON appears
     in the URL.
   - Toggle back to simple: confirm `filters`/`joinOperator` are cleared.
   - Confirm sort, pagination, and Add Box work in both modes.
