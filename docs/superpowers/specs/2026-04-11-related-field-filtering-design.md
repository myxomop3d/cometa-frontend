# Related Object Field Filtering — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Problem

The advanced filter toolbar supports filtering by related objects via `relation` / `multiRelation` variants, but only by ID (using the RelationPicker). There is no way to filter by a related object's *fields* — e.g., find boxes where `item.name` contains "foo" or `item.count` is between 10 and 50.

## Solution

Use hidden TanStack Table columns with standard variants (`text`, `range`, etc.) and dot-notation IDs that map to OData nested field paths. No new variants, no toolbar changes, no mock changes.

## Design

### Column Definition

Add a hidden column in `columns.tsx` with:

- **`id`**: dot-notation — `"item.name"`, `"item.count"`, etc.
- **`accessorFn`**: resolves the nested value — `(row) => row.item?.name ?? "—"`
- **`meta.label`**: arrow-notation for the filter dropdown — `"Item → Name"`
- **`meta.variant`**: matches the field's type — `"text"` for name, `"range"` for count, etc.
- **`enableColumnFilter: true`** — makes it available in the advanced filter dropdown
- **`enableHiding: true`** — allows toggling visibility in the column menu
- Hidden by default via `initialColumnVisibility` in the page component

Example:

```tsx
{
  id: "item.name",
  accessorFn: (row) => row.item?.name ?? "—",
  header: ({ column }) => <DataTableColumnHeader column={column} label="Item → Name" />,
  meta: {
    label: "Item → Name",
    variant: "text",
    placeholder: "Search item names...",
  },
  enableColumnFilter: true,
  enableSorting: false,
  enableHiding: true,
  size: 160,
}
```

### OData Field Mapping

In `advanced-api.ts`, add a corresponding entry in `fieldByColumnId`:

```ts
"item.name": { field: "item/name", variant: "text" },
```

The dot in the column ID is a UI convention; the slash in the `field` value is the OData path separator. `buildAdvancedFilterParams` uses the `field` value directly, so `contains_ignoring_case(item/name, 'foo')` is emitted as-is.

### Initial Column Visibility

In the page component, pass `initialColumnVisibility` to `useDataTable`:

```ts
initialColumnVisibility: { "item.name": false },
```

The column is hidden by default but can be toggled visible. The filter remains available regardless of visibility.

### Mock Mechanism

No changes needed. The OData parser in `src/mocks/lib/odata.ts` already:

- Resolves nested field paths (`item/name` traverses `record.item.name`)
- Handles `contains_ignoring_case(item/name, 'value')` by resolving the nested path
- Supports comparisons on nested numeric fields (`item/count ge 10`)

### Reusability

The pattern is fully generic — no framework-level changes required. For any future advanced table:

1. Define a hidden column with `id: "relation.field"`, the appropriate `variant`, and an `accessorFn` that resolves the nested value
2. Add a matching entry in `fieldByColumnId`: `"relation.field": { field: "relation/field", variant: "..." }`
3. Hide it by default in `initialColumnVisibility`

The variant determines the filter UI and operators, just like any other column. Examples:

| Column ID | OData Field | Variant | Filter Behavior |
|-----------|-------------|---------|-----------------|
| `item.name` | `item/name` | `text` | contains, is, is not, empty |
| `item.count` | `item/count` | `range` | between, eq, lt, gt, etc. |
| `item.status` | `item/status` | `select` | is, is not, empty |
| `item.date` | `item/date` | `dateRange` | between, before, after, etc. |

## Files Changed

| File | Change |
|------|--------|
| `src/features/box/columns.tsx` | Add hidden column for `item.name` |
| `src/features/box/advanced-api.ts` | Add `"item.name"` to `boxFieldByColumnId` |
| `src/routes/box-dice-advanced/index.tsx` | Add `initialColumnVisibility: { "item.name": false }` |
| `src/lib/odata/build-advanced-filter-params.ts` | Verify nested paths work with string functions (fix if needed) |
| `advanced-table-manual.md` | Add "Filtering by related object fields" section |

## Files NOT Changed

- `src/config/data-table.ts` — no new variants or operators
- `src/components/data-table/*` — toolbar already reads column meta generically
- `src/mocks/**` — parser already handles nested paths
