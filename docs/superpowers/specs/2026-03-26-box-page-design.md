# Box Page Design

## Overview

Create a new `/box` page for `BoxDto` entities, following the existing automated-system page pattern but with a richer set of filter input types. The page features a filterable, paginated, inline-editable data table with server-side operations.

The key architectural change is moving from SimpleTable's built-in text-only filters to **composable filter components** — each filter type is an independent component that the page composes into a filter bar.

## Design Decisions

- **`BoxFilters` is a standalone interface**, not `Filters<BoxDto>`. Unlike `AutomatedSystemFilters` where filter params mirror DTO fields 1:1, Box filters use transformed names (`numMin`/`numMax`, `dateStrFrom`/`dateStrTo`, `itemId`, `thingIds`) because range and relation filters don't map directly to DTO field types. This is intentional.
- **SimpleTable filter refactor is atomic** — both the Box page and automated-system page are updated in the same change. The old filter props are removed, not deprecated.
- **`FilterField` type** is extracted from SimpleTable and exported from a shared location (e.g., `src/types/table.ts`) since `RelationFilter` also uses it for modal filter definitions.

## BoxDto Fields & Filter Mapping

| Field | Type | Filter Component | URL Params | OData Clause |
|-------|------|-----------------|------------|-------------|
| `name` | `string` | `TextFilter` | `name` | `contains_ignoring_case(name,'v')` |
| `objectCode` | `string \| null` | `TextFilter` | `objectCode` | `contains_ignoring_case(objectCode,'v')` |
| `shape` | `"O" \| "X"` | `SelectFilter` | `shape` | `shape eq 'O'` |
| `num` | `number` | `NumberRangeFilter` | `numMin`, `numMax` | `num ge 100 and num le 500` |
| `item` | `ItemDto \| null` | `RelationFilter` (single) | `itemId` | `item/id eq 5` |
| `things` | `ThingDto[] \| null` | `RelationFilter` (multi) | `thingIds` | `things/any(t: t/id eq 1 or t/id eq 3)` |
| `dateStr` | `string` | `DateRangeFilter` | `dateStrFrom`, `dateStrTo` | `dateStr ge '2025-01-01' and dateStr le '2025-12-31'` |
| `checkbox` | `boolean` | `CheckboxFilter` | `checkbox` | `checkbox eq true` |
| `tags` | `string[]` | `TextFilter` | `tags` | `tags/any(t: contains_ignoring_case(t,'v'))` |

## Architecture: Composable Filter Components

### Approach

Instead of extending SimpleTable with filter type knowledge, each filter is a standalone component. The page composes them into a `FilterBar` and passes the assembled bar to SimpleTable via a `filterSlot` prop.

### SimpleTable Changes

Remove the old `filterFields`, `filters`, and `onFilterChange` props. Replace with a single `filterSlot: React.ReactNode` prop. SimpleTable renders `{filterSlot}` in the filter area. The existing automated-system page is refactored to use the new composable approach.

### Filter Component Contract

Most filter components follow a common pattern:

```ts
// Each component receives value + onChange, plus type-specific config props
value: T | undefined;
onChange: (value: T | undefined) => void;
```

**Exceptions:** Range filters (`NumberRangeFilter`, `DateRangeFilter`) use split props (`valueMin`/`valueMax`/`onChangeMin`/`onChangeMax`) since they map to separate URL params.

### FilterBar

Thin grid wrapper: `<div className="grid grid-cols-4 gap-2 my-4">{children}</div>`. Each filter defaults to 1 column. Wider filters (date range, relation selectors) use `className="col-span-2"`.

## Filter Components

### TextFilter

Wraps the existing `DebouncedInput`. Props: `placeholder`, `value`, `onChange`.

### NumberRangeFilter

Two number inputs side-by-side within one grid cell. Props: `valueMin`, `valueMax`, `onChangeMin`, `onChangeMax`, `placeholderMin`, `placeholderMax`.

### CheckboxFilter

Three-state filter using a shadcn Select with "All" / "Yes" / "No" options. Props: `label`, `value` (boolean | undefined), `onChange`. When `undefined`, no filter is applied (shows all rows). Default state is "All".

### SelectFilter

shadcn Select dropdown. Props: `options: { label: string; value: string }[]`, `placeholder`, `value`, `onChange`.

### DateRangeFilter

Two shadcn Calendar popovers (from/to) within a `col-span-2` cell. Props: `valueFrom`, `valueTo`, `onChangeFrom`, `onChangeTo`.

Requires new shadcn components: `calendar`, `popover`.

### RelationFilter

The most complex filter. Handles three modes for both single and multi-select.

**Props:**

Note: The `multi` prop creates a type-level trade-off — `value` is `T | T[] | undefined` regardless of `multi`. This is a known simplification; runtime checks enforce correctness. If this proves problematic, split into `SingleRelationFilter` / `MultiRelationFilter` during implementation.

```ts
interface RelationFilterProps<T> {
  mode: "dropdown" | "modal" | "both";
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  // Data
  queryFn: () => Promise<ApiResponse<T[]>>;
  queryKey: string[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  // Modal config (when mode is "modal" or "both")
  tableColumns?: ColumnDef<T>[];
  modalFilterFields?: FilterField[];
  modalQueryFn?: (filters: Record<string, unknown>) => Promise<ApiResponse<T[]>>;
}
```

**Mode behavior:**

| Mode | UI | Modal filtering |
|------|-----|----------------|
| `dropdown` | Searchable dropdown only | n/a |
| `modal` | Button opens dialog with table | Server-side via `modalQueryFn` |
| `both` | Dropdown + browse button | Client-side (reuses dropdown data) |

**Dropdown behavior:**
- Fetches all items via `queryFn` (client-side)
- Text input filters the list by `getLabel(item)`
- Single: selecting sets value, clicking again clears
- Multi: checkboxes, selected shown as chips/count

**Modal behavior:**
- Button labeled "Browse..." (or shows current selection)
- Opens shadcn Dialog with a table + filters
- `mode: "modal"` → server-side filtering via `modalQueryFn`
- `mode: "both"` → client-side filtering from dropdown's cached data
- Single: click row to select, closes dialog
- Multi: checkboxes on rows, confirm button

## BoxFilters Type

```ts
interface BoxFilters extends PaginationParams {
  // String contains
  name?: string;
  objectCode?: string;
  tags?: string;
  // Literal/enum
  shape?: "O" | "X";
  // Number range
  numMin?: number;
  numMax?: number;
  // Boolean
  checkbox?: boolean;
  // Date range
  dateStrFrom?: string;
  dateStrTo?: string;
  // Relations (store IDs)
  itemId?: number;
  thingIds?: number[];
}
```

## Box API Service (`src/api/box.ts`)

Follows the automated-system pattern:

- `buildListParams(filters: BoxFilters)` — converts to OData `$skip`, `$top`, `$filter`
- `fetchBoxes(filters)` — GET `/api/v1/box`
- `fetchBox(id)` — GET `/api/v1/box/:id`
- `patchBox(id, data)` — PATCH `/api/v1/box/:id`
- `boxesQueryOptions(filters)` — queryKey `["boxes", "list", filters]`, `keepPreviousData`
- `boxQueryOptions(id)` — queryKey `["boxes", "detail", id]`

Also create `src/api/item.ts` and `src/api/thing.ts` with fetch + query options for the relation filter dropdowns.

## OData Parser Extensions (`src/mocks/lib/odata.ts`)

The mock OData parser needs new clause types and implementation guidance:

- **`ge` / `le` operators** — for number and date range comparisons. The current parser only supports `gt`/`lt`. Must handle both quoted strings (`dateStr ge '2025-01-01'`) and unquoted numbers (`num ge 100`).
- **Boolean `eq`** — `checkbox eq true` / `checkbox eq false`. Currently `eq` regex expects single-quoted strings; extend to handle unquoted `true`/`false`.
- **Unquoted numeric `eq`** — `item/id eq 5`. Extend `eq` to handle unquoted numbers for relation ID filtering.
- **Nested object paths** — `item/id eq 5`. The current regex uses `(\w+)` for field names which won't match `/`. Implementation: split field on `/` and traverse the object (e.g., `rec["item"]["id"]`). Use `[\w/]+` or similar in the regex.
- **Collection `any()` lambda** — `things/any(t: t/id eq 1 or t/id eq 3)`. Implementation: dedicated regex to extract collection name, alias, and inner conditions. Parse inner `or`-joined conditions, iterate the array, return true if any element matches at least one condition. Also needed for `tags/any(t: contains_ignoring_case(t,'v'))`.
- **Inner `or` parsing** — only needed inside `any()` lambdas. Split inner expression on ` or `, evaluate each sub-condition against the array element.

## Route & Page Component

**Route:** `src/routes/box/index.tsx`

- `validateSearch` parses all BoxFilters fields from URL. For `thingIds` (array param), serialize as comma-separated string in URL (`?thingIds=1,3`) and parse in `validateSearch` by splitting on `,` and mapping to numbers.
- `loaderDeps` + `loader` prefetch via `boxesQueryOptions`
- Page composes filter bar with all filter components
- Inline editing with Zod validation schema

**Filter bar layout (4 columns):**

| Col 1 | Col 2 | Col 3 | Col 4 |
|-------|-------|-------|-------|
| name | objectCode | shape | checkbox |
| num (range) | tags | dateStr (from/to, col-span-2) | |
| item (col-span-2) | things (col-span-2) | | |

**Table columns:** id, name, objectCode, shape, num, item (displays `item.name`), things (count or comma-joined names), dateStr, checkbox, tags (comma-joined).

**Inline editing:** Same pattern as automated-system — `editConfig` with Zod schema, PATCH mutation, query invalidation.

## Navigation

Add `/box` → "Boxes" entry to `src/components/app-sidebar.tsx`.

## New shadcn Components

Install via `npx shadcn@latest add`:
- `dialog` — relation filter modal
- `popover` — datepicker and dropdown popover
- `badge` — selected items chips in multi-select
- `calendar` — datepicker calendar

## File Structure

**New files:**
```
src/
  components/
    filters/
      FilterBar.tsx
      TextFilter.tsx
      NumberRangeFilter.tsx
      CheckboxFilter.tsx
      SelectFilter.tsx
      DateRangeFilter.tsx
      RelationFilter.tsx
  api/
    box.ts
    item.ts
    thing.ts
  routes/
    box/
      index.tsx
```

**Modified files:**
```
src/
  components/
    SimpleTable.tsx          # filterSlot replaces filter props
    app-sidebar.tsx          # add /box nav entry
  routes/
    automated-system/
      index.tsx              # refactor to use FilterBar + TextFilter
  types/
    api.ts                   # add BoxFilters type
  mocks/
    lib/odata.ts             # extend parser
    handlers.ts              # register handlers (if needed)
```

## Automated-System Page Refactor

The existing automated-system page's filter setup (7 `DebouncedInput` fields rendered by SimpleTable) is replaced with:
- A `FilterBar` containing 7 `TextFilter` components
- Passed to SimpleTable via `filterSlot`
- Functionally identical, but uses the new composable pattern
