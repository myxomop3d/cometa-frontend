# Box-Dice Page: DiceUI-Style Data Table

**Date:** 2026-04-03
**Status:** Approved

## Overview

New `/box-dice/` page displaying `BoxDto` data using a reusable data-table component system ported from [tablecn](https://github.com/sadmann7/tablecn). All data-table components are generic and reusable for future tables. The box-dice page is the first consumer.

## Decisions

- **URL state:** Extend existing `useFilters` pattern (TanStack Router search params) — no `nuqs`
- **Advanced filtering:** Notion/Airtable-style FilterList only (no Linear command-palette)
- **Edit/Add UI:** Sheet (slide-out panel) with react-hook-form + zod
- **Relation filter modals:** Use the same data-table components recursively
- **Page size:** Calculated on mount, snapped to discrete steps (10, 20, 30, 40, 50)
- **Existing box page:** Unchanged

## File Structure

```
src/
  components/
    data-table/
      data-table.tsx                    # Base table wrapper
      data-table-column-header.tsx      # Sortable/hideable column headers
      data-table-pagination.tsx         # Pagination with dynamic page sizes
      data-table-toolbar.tsx            # Basic toolbar (auto-generated filters)
      data-table-advanced-toolbar.tsx   # Container for FilterList + SortList
      data-table-filter-list.tsx        # Notion/Airtable structured filter rows
      data-table-sort-list.tsx          # Multi-column sort UI
      data-table-view-options.tsx       # Column visibility toggles
      data-table-action-bar.tsx         # Bulk action bar on row selection
      data-table-faceted-filter.tsx     # Select/multi-select filter
      data-table-date-filter.tsx        # Date/date-range filter
      data-table-slider-filter.tsx      # Range slider filter
      data-table-range-filter.tsx       # Min/max number inputs
      data-table-skeleton.tsx           # Loading skeleton
    relation-picker.tsx                 # Button + modal for selecting related items
    ui/
      action-bar.tsx                    # Base action-bar primitives
      sortable.tsx                      # dnd-kit sortable wrapper
  hooks/
    use-data-table.ts                   # Table + URL state integration
  types/
    data-table.ts                       # ColumnMeta, FilterVariant, operators
  config/
    data-table.ts                       # Operator definitions per variant
  routes/
    box-dice/
      index.tsx                         # Page component, route definition
      components/
        box-table-columns.tsx           # BoxDto column defs with meta
        box-table-action-bar.tsx        # Bulk actions for boxes
        box-sheet.tsx                   # Add/edit sheet with form + relation pickers
```

## Type System

### `src/types/data-table.ts`

```typescript
// Filter variants — includes relation types
type FilterVariant =
  | "text" | "number" | "range" | "date" | "dateRange"
  | "boolean" | "select" | "multiSelect"
  | "relation" | "multiRelation"

// Extended column meta — drives auto-generated filters
interface DataTableColumnMeta<TData> {
  label: string
  placeholder?: string
  variant?: FilterVariant
  options?: { label: string; value: string; count?: number; icon?: React.FC }[]
  range?: [number, number]
  unit?: string
  icon?: React.FC
  relationConfig?: {
    queryOptionsFn: (filters: Record<string, unknown>) => QueryOptions
    columns: ColumnDef<any, unknown>[]
    getLabel: (item: any) => string
    getId: (item: any) => number
  }
}

// Extended filter with operator support
interface ExtendedColumnFilter<TData> {
  id: string & keyof TData
  filterId: string
  value: unknown
  variant: FilterVariant
  operator: FilterOperator
}

// Extended sort
interface ExtendedColumnSort<TData> {
  id: string & keyof TData
  desc: boolean
}

// Row action for sheet
interface DataTableRowAction<TData> {
  row: Row<TData>
  variant: "update" | "delete" | "create"
}
```

### `src/types/api.ts` — new `SortByParams`

```typescript
interface SortByParams {
  sortBy?: string  // comma-separated: "name.asc,num.desc"
}
```

### Relation filter values

Selected items store both ID and label to avoid fetching the full list for hydration:

```typescript
// relation: { id: number; label: string } | undefined
// multiRelation: { id: number; label: string }[] | undefined
```

## `useDataTable` Hook

Extends existing `useFilters` pattern for structured filters and sorts.

### URL shape

```
/box-dice/?page=1&pageSize=20&filters=[...]&sort=[...]&joinOperator=and
```

- `filters` — JSON-serialized `ExtendedColumnFilter[]`
- `sort` — JSON-serialized `ExtendedColumnSort[]`
- `joinOperator` — `"and" | "or"`

### Interface

```typescript
function useDataTable<TData>(opts: {
  routeId: string
  columns: ColumnDef<TData, any>[]
  data: TData[]
  rowCount: number
  defaultPageSize?: number
  defaultSort?: ExtendedColumnSort<TData>[]
}): {
  table: Table<TData>
  filters: ExtendedColumnFilter<TData>[]
  setFilters: (filters: ExtendedColumnFilter<TData>[]) => void
  sorts: ExtendedColumnSort<TData>[]
  setSorts: (sorts: ExtendedColumnSort<TData>[]) => void
  joinOperator: "and" | "or"
  setJoinOperator: (op: "and" | "or") => void
  page: number
  pageSize: number
  pageCount: number
  setPage: (page: number) => void
  resetAll: () => void
}
```

### Key behaviors

- All state changes reset page to 1 (except `setPage`)
- Filter/sort changes debounced 300ms before URL write
- Creates TanStack Table instance internally (manual mode)
- Column visibility is local state (not URL-persisted)
- Default page size calculated on mount from window height, snapped to [10, 20, 30, 40, 50]

## Dynamic Page Size

```typescript
function calculatePageSize(): number {
  const available = window.innerHeight - 280
  const ideal = Math.floor(available / 40)
  const steps = [10, 20, 30, 40, 50]
  return steps.reduce((prev, curr) =>
    Math.abs(curr - ideal) < Math.abs(prev - ideal) ? curr : prev
  )
}
```

Runs once on mount. The 280px offset is tunable via parameter.

## RelationPicker Component

Shared between FilterList relation filters and BoxSheet relation fields.

```typescript
interface RelationPickerProps<TRelated> {
  multi: boolean
  value: { id: number; label: string }[] | { id: number; label: string } | undefined
  onChange: (value: ...) => void
  queryOptionsFn: (filters: Record<string, unknown>) => QueryOptions
  columns: ColumnDef<TRelated, unknown>[]
  getLabel: (item: TRelated) => string
  getId: (item: TRelated) => number
  placeholder: string
}
```

- Opens a Dialog with a data-table (reuses same components)
- Server-side filtered, always `pageSize=10`
- Local filter/sort state (not URL-persisted)
- Single mode: click row to select and close
- Multi mode: checkboxes + Confirm/Cancel buttons

## BoxSheet (Add/Edit)

Sheet component with react-hook-form + zod validation.

### Form schema

```typescript
const boxFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z.string().nullable(),
  shape: z.enum(["O", "X"]),
  num: z.number(),
  dateStr: z.string(),
  checkbox: z.boolean(),
  itemId: z.number().nullable(),
  thingIds: z.array(z.number()),
  oldItemId: z.number().nullable(),
  oldThingIds: z.array(z.number()),
})
```

### Relation fields

Each relation field renders as a button with selected label(s) as badges. Clicking opens the `RelationPicker` modal. Uses the same `relationConfig` from column meta.

### Save flow

- **Edit:** `patchBox(id, changedFields)` → invalidate `["boxes"]` → close sheet → toast
- **Add:** `createBox(data)` (new) → invalidate `["boxes"]` → close sheet → toast

### State

```typescript
const [rowAction, setRowAction] = useState<DataTableRowAction<BoxDto> | null>(null)
```

Sheet open derived from `rowAction !== null`. Add button sets `variant: "create"`.

## API Layer Changes

### New in `src/api/box.ts`

- `createBox(data)` — `POST /api/v1/box`
- `boxDiceQueryOptions(params)` — query options using `buildDataTableParams`
- `buildDataTableParams(params)` — translates structured filters/sorts to OData

### Operator → OData mapping

| Operator | OData |
|----------|-------|
| `iLike` | `contains_ignoring_case(field, 'value')` |
| `eq` | `field eq value` |
| `ne` | `field ne value` |
| `lt/lte/gt/gte` | `field lt/le/gt/ge value` |
| `isBetween` | `field ge min and field le max` |
| `inArray` | `field/any(x: x/id in (1,2,3))` |
| `notInArray` | negation of inArray |
| `isEmpty` | `field eq null` |
| `isNotEmpty` | `field ne null` |

Sorts → `$orderby=name asc,num desc`

Join operator connects filter clauses with `and`/`or`.

## New Dependencies

### npm packages

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`
- `react-hook-form`, `@hookform/resolvers`

### shadcn components to add

- `command`, `slider`, `toggle-group`, `label`

## Components Summary

### Reusable (17 files)

- 14 data-table components
- `RelationPicker`
- `ui/action-bar`, `ui/sortable`
- `hooks/use-data-table.ts`
- `types/data-table.ts`, `config/data-table.ts`

### Box-dice specific (4 files)

- `routes/box-dice/index.tsx`
- `box-table-columns.tsx`
- `box-table-action-bar.tsx`
- `box-sheet.tsx`

### Modified (2 files)

- `api/box.ts` — add `createBox`, `boxDiceQueryOptions`, `buildDataTableParams`
- `types/api.ts` — add `SortByParams`
