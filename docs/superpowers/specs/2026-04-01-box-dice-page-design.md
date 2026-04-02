# Box Dice Page — Design Spec

## Overview

New `/box-dice/` page displaying BoxDto data in a feature-rich data grid, built by cherry-picking components from the [tablecn](https://github.com/sadmann7/tablecn) reference implementation. The grid supports server-side filtering, multi-column sorting, pagination, hideable/pinnable columns, inline cell editing, and row creation (inline + modal).

## Decisions

- **Pagination:** Traditional server-side (page/pageSize with $skip/$top), not virtual infinite scroll.
- **Add row:** Both inline blank row and modal form dialog.
- **Cell editing:** All fields editable inline, including relation fields (item, things, oldItem, oldThings) via popover pickers.
- **Sorting:** Multi-column with $orderby backend support.
- **Architecture:** Trimmed fork of tablecn — copy only needed components, strip undo/redo, paste, dnd, cell range selection, TanStack DB. Wire to existing TanStack Query + URL-synced filters.

## Component Architecture

### Components to cherry-pick from tablecn

Copied into `src/components/data-grid/`:

| Component | Purpose | Adaptations |
|---|---|---|
| `data-grid.tsx` | Grid shell, virtual scrolling, layout | Remove paste dialog, context menu, search. Add pagination footer. |
| `data-grid-row.tsx` | Row rendering with memoization | Remove cell range selection, simplify focus tracking |
| `data-grid-cell.tsx` | Cell variant dispatcher | Keep as-is |
| `data-grid-cell-wrapper.tsx` | Cell click/focus handling | Remove range selection logic |
| `data-grid-cell-variants.tsx` | Cell editors (text, number, select, multi-select, checkbox, date) | Remove file/url variants. Add relation picker variants. |
| `data-grid-column-header.tsx` | Sortable headers with pin/hide controls | Keep as-is |
| `data-grid-filter-menu.tsx` | Advanced filter UI | Adapt to emit BoxFilters (OData-compatible) instead of client-side FilterFn |
| `data-grid-sort-menu.tsx` | Multi-column sort UI | Adapt to emit $orderby params |
| `data-grid-view-menu.tsx` | Column visibility toggle | Keep as-is |
| `data-grid-select-column.tsx` | Row selection checkboxes | Keep for potential bulk actions |

### Components to skip

- `data-grid-keyboard-shortcuts.tsx` (help dialog)
- `data-grid-context-menu.tsx` (right-click menu)
- `data-grid-paste-dialog.tsx` (clipboard paste)
- `data-grid-row-height-menu.tsx` (row height controls)
- Undo/redo hook (`use-data-grid-undo-redo.ts`)
- TanStack DB collections

### New components to create

- `data-grid-pagination.tsx` — Previous/Next buttons + page indicator
- `data-grid-add-row.tsx` — Footer "Add row" button + inline blank row
- `data-grid-relation-cell.tsx` — Inline relation picker for single/multi entity fields (popover with searchable table)
- `AddBoxDialog` — Modal form for full row creation (in the route file or a dedicated component)

### New hook

- `useServerDataGrid` — Bridges grid state (sorting, filtering, column visibility, pagination) to URL-synced filters and TanStack Query. Replaces tablecn's `useDataGrid` + TanStack DB.

## Data Flow

```
URL search params (source of truth for filters/sort/page)
    |  validateSearch()
BoxDiceFilters (typed filter object, extends BoxFilters with sortBy)
    |  useFilters("/box-dice/")
    |--- filters --> boxesQueryOptions(filters) --> useSuspenseQuery --> grid data
    |--- setFilters() <-- filter menu changes
    |--- setPage() <-- pagination changes
    |--- setSorting() <-- sort menu changes (sortBy URL param)
```

### State ownership

| State | Location | Why |
|---|---|---|
| Filters, sorting, pagination | URL search params | Shareable, bookmarkable, survives refresh |
| Column visibility, pinning | Local React state | UI preference, not server-side concern |
| Cell edit mode | Local React state (per-row) | Transient UI state |
| Add-row temp data | Local React state | Uncommitted until saved |

### Mutations

- **Inline edit:** `patchBox(id, changedFields)` via `useMutation`. Invalidate `["boxes"]` on success. No optimistic updates.
- **Add row (inline):** Temporary blank row in local state. On save: `createBox(data)` via `useMutation`. On success: invalidate `["boxes"]`, remove temp row.
- **Add row (modal):** Form dialog with `react-hook-form` + Zod validation. On submit: `createBox(data)`, invalidate, close dialog.

## API Layer Changes

### New function: `createBox`

```typescript
// POST /api/v1/box
export async function createBox(data: CreateBoxDto): Promise<BoxDto> { ... }
```

### New type: `CreateBoxDto`

```typescript
export type CreateBoxDto = {
  name: string;
  objectCode?: string | null;
  shape: "O" | "X";
  num: number;
  dateStr: string;
  checkbox: boolean;
  tags?: string[];
  itemId?: number | null;
  thingIds?: number[];
  oldItemId?: number | null;
  oldThingIds?: number[];
};
```

### New SortByParams interface

Reusable sorting params, defined in `src/types/api.ts` alongside `PaginationParams`:

```typescript
export interface SortByParams {
  sortBy?: string;  // e.g. "name:asc,num:desc"
}
```

Other table filter interfaces (e.g. `AutomatedSystemFilters`) can extend `Partial<SortByParams>` the same way when multi-column sorting is needed.

### Extended BoxFilters

```typescript
export interface BoxFilters extends Partial<PaginationParams>, Partial<SortByParams> {
  // ... existing fields unchanged ...
}
```

### Extended fetchBoxes

Add `$orderby` query param support. Parse `sortBy` string (e.g. `"name:asc,num:desc"`) into OData format (`$orderby=name asc,num desc`).

## Route & Page Structure

### New route: `src/routes/box-dice/index.tsx`

- Same pattern as `/box/`: `validateSearch`, `loaderDeps`, `loader` with `ensureQueryData`
- Extended `validateSearch` to parse `sortBy` param
- Uses data grid components instead of SimpleTable

### Page component tree

```
BoxDicePage
+-- Header ("Boxes" title + count + "Add Row" button for modal)
+-- DataGrid
|   +-- DataGridColumnHeader (per column: sort/pin/hide controls)
|   +-- DataGridFilterMenu (advanced filters panel)
|   +-- DataGridSortMenu (multi-column sort stack)
|   +-- DataGridViewMenu (column visibility toggles)
|   +-- DataGridRow (virtualized rows)
|   |   +-- DataGridCell --> cell variant (text/number/select/checkbox/date/relation)
|   +-- DataGridAddRow (inline blank row at bottom)
|   +-- DataGridPagination (Previous/Next + page info)
+-- AddBoxDialog (modal form for full row creation)
```

### Sidebar navigation

Add "Box Dice" entry to `__root.tsx` sidebar, linking to `/box-dice/`.

## Cell Variants

| BoxDto Field | Cell Variant | Edit Behavior |
|---|---|---|
| `id` | Read-only text | Not editable |
| `name` | `ShortTextCell` | Double-click -> contenteditable, Enter to save, Escape to cancel |
| `objectCode` | `ShortTextCell` | Same as name, nullable |
| `shape` | `SelectCell` | Click -> dropdown with O/X options |
| `num` | `NumberCell` | Double-click -> number input |
| `dateStr` | `DateCell` | Click -> calendar popover |
| `checkbox` | `CheckboxCell` | Single click toggles, saves immediately |
| `tags` | `ShortTextCell` | Double-click -> text input, comma-separated values (parsed to string[] on save) |
| `item` | `RelationCell` (single) | Click -> popover with searchable Items table, select one |
| `things` | `RelationCell` (multi) | Click -> popover with searchable Things table, select multiple |
| `oldItem` | `RelationCell` (single) | Same as item |
| `oldThings` | `RelationCell` (multi) | Same as things |

### RelationCell design

- **Display:** Entity name(s) as text, "---" if empty
- **Edit:** Popover with compact searchable table
- **Single mode:** Selecting a row closes popover and saves immediately
- **Multi mode:** Checkboxes on rows, "Apply" button to confirm
- **Data fetching:** Always server-side, paginated to 10 items per request. Never fetch all records. Search query is sent to backend, results are filtered server-side. Uses `itemsFilteredQueryOptions` / `thingsFilteredQueryOptions` with `$top=10`.

### Edit triggers

- Double-click cell to enter edit mode
- Start typing while cell is focused (pre-fills with keystroke)
- Tab/Shift+Tab navigates between cells
- Enter confirms, Escape cancels
- Checkbox toggles on single click

### Validation

Same Zod schema approach as current box page. Validate changed fields before sending PATCH. Inline error styling on invalid cells.

## New Dependencies

### npm packages

| Package | Purpose |
|---|---|
| `@tanstack/react-virtual` | Virtual scrolling for grid rows |
| `react-hook-form` | Form state for add-row modal |
| `@hookform/resolvers` | Zod resolver for react-hook-form |

### shadcn components to add

| Component | Purpose |
|---|---|
| `command` | Searchable dropdowns in cell variants & relation pickers |
| `form` | Add-row modal form |

### Packages explicitly NOT needed

- `@dnd-kit/*` (no drag/drop)
- `@tanstack/react-db` / `@tanstack/query-db-collection` (no client-side DB)
- `uploadthing` (no file cells)
- `export-to-csv` (not in scope)
- `nuqs` (existing `useFilters` handles URL state)
- `nanoid` (use `crypto.randomUUID()` for temp row IDs)
