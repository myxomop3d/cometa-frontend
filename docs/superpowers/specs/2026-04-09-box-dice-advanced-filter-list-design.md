# Box-Dice Advanced: Notion/Airtable-style FilterList

**Date:** 2026-04-09
**Status:** Approved

## Overview

A new `/box-dice-advanced/` page that clones `/box-dice/` but replaces the basic `DataTableToolbar` with a Notion/Airtable-style `FilterList` — per-clause operator choice, flat list joined by a single `and`/`or` toggle. Columns, sheet, and CRUD API are shared with `/box-dice/`; the data path is distinct so the two URL shapes stay cleanly separated.

## Decisions

- **URL state:** JSON-serialized `filters` param + `joinOperator` (new shape; does not touch `/box-dice/`)
- **Code sharing:** Hybrid — reuse columns + `BoxSheet` + CRUD mutations; new sibling query-options factory
- **Join operator:** Flat list, single `and`/`or` toggle (no nested groups)
- **Operator set:** Matches the spec in `2026-04-03-box-dice-data-table-design.md` §Operator→OData mapping
- **Field registry:** TanStack column `meta` (added to existing columns; additive, ignored by `/box-dice/`)
- **Components:** Reusable under `src/components/data-table/`
- **Sort UI:** Header-click sorting only (no SortList component in this iteration)
- **Existing `/box-dice/` page:** Unchanged

## URL Shape

```
/box-dice-advanced/?page=1&pageSize=20&sort=name.asc&filters=<json>&joinOperator=and
```

- `filters` — JSON-encoded `ExtendedColumnFilter[]`
- `joinOperator` — `"and" | "or"`, default `"and"`
- `sort` — unchanged from `/box-dice/` (`"field.dir"`, single column)
- `page`, `pageSize` — unchanged

`validateSearch` parses `filters` via `JSON.parse` inside try/catch, validates with a zod schema (`z.array(z.object({id: z.string(), operator: z.string(), value: z.unknown()}))`), silently drops malformed entries. Any change to `filters`/`joinOperator` resets `page` to 1. URL writes from FilterList edits are debounced 300 ms.

## Type System

### `src/types/data-table.ts` (modified)

```typescript
type FilterOperator =
  | "iLike" | "eq" | "ne"
  | "lt" | "lte" | "gt" | "gte" | "isBetween"
  | "inArray" | "notInArray"
  | "isEmpty" | "isNotEmpty"

interface ExtendedColumnFilter {
  id: string            // column id
  operator: FilterOperator
  value: unknown        // string | number | [min,max] | string[] | {id,label} | ...
}

interface DataTableColumnMeta {
  label: string
  variant: FilterVariant
  placeholder?: string
  options?: { label: string; value: string; icon?: React.FC }[]
  range?: [number, number]
  unit?: string
  relationConfig?: {
    queryOptionsFn: (filters: Record<string, unknown>) => QueryOptions
    columns: ColumnDef<any, unknown>[]
    getLabel: (item: any) => string
    getId: (item: any) => number
  }
}
```

## Operator Config

### `src/config/data-table.ts` (modified)

```typescript
const operatorsByVariant: Record<FilterVariant, FilterOperator[]> = {
  text:          ["iLike", "eq", "ne", "isEmpty", "isNotEmpty"],
  number:        ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  range:         ["isBetween", "eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  date:          ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  dateRange:     ["isBetween", "eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  boolean:       ["eq"],
  select:        ["eq", "ne", "isEmpty", "isNotEmpty"],
  multiSelect:   ["inArray", "notInArray", "isEmpty", "isNotEmpty"],
  relation:      ["eq", "ne", "isEmpty", "isNotEmpty"],
  multiRelation: ["inArray", "notInArray", "isEmpty", "isNotEmpty"],
}

const operatorLabels: Record<FilterOperator, string> = {
  iLike: "contains", eq: "is", ne: "is not",
  lt: "<", lte: "≤", gt: ">", gte: "≥", isBetween: "is between",
  inArray: "is any of", notInArray: "is none of",
  isEmpty: "is empty", isNotEmpty: "is not empty",
}
```

## OData Builder

### `src/lib/odata/build-advanced-filter-params.ts` (new)

```typescript
interface BuildAdvancedFilterParamsInput {
  page: number
  pageSize: number
  sort?: string
  filters: ExtendedColumnFilter[]
  joinOperator: "and" | "or"
  fieldByColumnId: Record<string, { field: string; variant: FilterVariant }>
}
```

Behavior:

- Iterates `filters`, skips any with empty/missing value unless operator is `isEmpty`/`isNotEmpty`
- Emits one clause per filter, joins with ` ${joinOperator} `
- Reuses `odataString` for escaping
- `$skip`, `$top`, `$orderby` handled identically to existing `buildFilterParams`
- When `joinOperator === "or"`, multi-part clauses (`isBetween`, `notInArray`) are wrapped in parens to protect precedence

### Operator → OData mapping

| Operator | Emitted |
|---|---|
| `iLike` | `contains_ignoring_case(field, 'val')` |
| `eq` | `field eq 'val'` (string) / `field eq val` (number, bool) |
| `ne` | `field ne ...` |
| `lt`/`lte`/`gt`/`gte` | `field lt/le/gt/ge val` |
| `isBetween` | `(field ge min and field le max)` |
| `inArray` (select/multiSelect) | `field in ('a','b')` |
| `inArray` (multiRelation) | `field/any(x: x/id in (1,2))` |
| `notInArray` | `not (…inArray…)` |
| `isEmpty` | `field eq null` |
| `isNotEmpty` | `field ne null` |
| relation `eq`/`ne` | `field/id eq/ne N` |

### Tests — `build-advanced-filter-params.test.ts`

- Each operator × applicable variants
- `and` vs `or` joining
- `or` precedence parenthesization (`isBetween`, `notInArray`)
- `isEmpty`/`isNotEmpty` emit clauses even when value is absent
- Filters with missing/empty value are skipped (other operators)
- `$orderby`, `$skip`, `$top` wiring

## API Layer

### `src/features/box/api.ts` (modified)

Add one factory next to the existing `dataTableQueryOptions`:

```typescript
boxApi.advancedDataTableQueryOptions(params: {
  page: number
  pageSize: number
  sort?: string
  filters: ExtendedColumnFilter[]
  joinOperator: "and" | "or"
})
```

- Internally calls `buildAdvancedFilterParams(...)` against the same `GET /api/v1/box` endpoint
- Query key: `["boxes", "advanced", params]` (distinct from `["boxes", params]`)
- Builds `fieldByColumnId` from a small override map plus column id defaults
- `invalidateQueries({ queryKey: ["boxes"] })` on save still covers both pages
- `createBox`, `patchBox`, `deleteBox` unchanged

## Page Component

### `src/routes/box-dice-advanced/index.tsx` (new)

Mirrors `/box-dice/index.tsx`:

- `validateSearch` parses `page`, `pageSize`, `sort`, `filters` (JSON+zod), `joinOperator`
- `loader` → `context.queryClient.ensureQueryData(boxApi.advancedDataTableQueryOptions(...))`
- `useSuspenseQuery` for data, `useDataTable` for table state
- Reuses `getBoxColumns` and `BoxSheet` and `BoxRowAction` unchanged
- Renders `<DataTableAdvancedToolbar>` instead of `<DataTableToolbar>`, with the Add button passed as a child
- Sidebar entry added to `app-sidebar.tsx`

## FilterList UI

### `src/components/data-table/data-table-advanced-toolbar.tsx` (new)

Thin container:
- Left: `<DataTableFilterList table={table} />`
- Right: `<DataTableViewOptions />` + children (Add button slot)

### `src/components/data-table/data-table-filter-list.tsx` (new)

Triggered by a `[Filter (N)]` button that opens a popover:

```
┌─ Popover ──────────────────────────────────────┐
│ Where [and ▾]                                  │  ← join toggle, hidden if ≤1 filter
│ ┌────────────────────────────────────────────┐ │
│ │ [Name ▾]  [contains ▾]  [___input___] [×] │ │
│ │ [Shape ▾] [is any of ▾] [O,X ▾]       [×] │ │
│ └────────────────────────────────────────────┘ │
│ [+ Add filter ▾]                   [Reset all] │
└────────────────────────────────────────────────┘
```

Row behavior:

1. **Field picker** — Command menu listing columns where `column.columnDef.meta?.variant` is set
2. **Operator picker** — `operatorsByVariant[variant]`, labels from `operatorLabels`
3. **Value input** — rendered per variant:
   - `text` / `number` → `<Input>` (debounced)
   - `range` / `dateRange` with `isBetween` → two inputs side-by-side
   - `select` → `<Select>` from `meta.options`
   - `multiSelect` → checkbox popover
   - `date` → date picker
   - `boolean` → true/false toggle
   - `relation` / `multiRelation` → existing `RelationPicker` modal, stores `{id, label}`
   - `isEmpty` / `isNotEmpty` → value input hidden
4. **Remove (`×`)** removes the row
5. **"+ Add filter ▾"** pre-selects a field and creates a row with that variant's first operator and `undefined` value

State: local `draft` inside the popover for responsive editing; commits to URL on blur or 300 ms debounce. Rows with `undefined` value are kept in URL but dropped by the OData builder (unless operator is `isEmpty`/`isNotEmpty`). `Reset all` clears `filters`, `joinOperator`, and resets `page` to 1.

## Column Meta on Boxes

### `src/features/box/columns.tsx` (modified)

Attach `meta` to each filterable column: `name`, `objectCode`, `shape`, `num`, `dateStr`, `checkbox`, `tags`, `item`, `things`, `oldItem`, `oldThings`. Each entry provides `label`, `variant`, and — where applicable — `options` (shape), `range` (num), `relationConfig` (item/things/oldItem/oldThings, reusing the same query-options used by the current RelationFilterModal). Additive change — `/box-dice/` ignores `meta`.

## Files Summary

**New**
- `src/routes/box-dice-advanced/index.tsx`
- `src/components/data-table/data-table-advanced-toolbar.tsx`
- `src/components/data-table/data-table-filter-list.tsx`
- `src/lib/odata/build-advanced-filter-params.ts`
- `src/lib/odata/build-advanced-filter-params.test.ts`

**Modified**
- `src/types/data-table.ts` — `ExtendedColumnFilter`, `FilterOperator`, extended `DataTableColumnMeta`
- `src/config/data-table.ts` — `operatorsByVariant`, `operatorLabels`
- `src/features/box/api.ts` — `advancedDataTableQueryOptions`
- `src/features/box/columns.tsx` — attach `meta` to filterable columns
- `src/components/app-sidebar.tsx` — nav entry

**Unchanged**
- `/box-dice/` route and everything it touches
- `boxFilterDescriptors`, `buildFilterParams`
- `BoxSheet`, `createBox`, `patchBox`, `deleteBox`
