# Split RelationFilter into RelationFilterDropdown and RelationFilterModal

## Summary

Split the monolithic `RelationFilter` component (~505 lines) into two independent, focused components: `RelationFilterDropdown` (client-side search popover) and `RelationFilterModal` (server-side filtered dialog with table). Delete the original `RelationFilter.tsx`. Update `box/index.tsx` to use the new components.

Both components are **data-agnostic** — they receive `data: T[]` from the parent instead of fetching data themselves. This keeps data-fetching concerns in the parent and makes the components simpler and more reusable.

The `mode="both"` combined layout is dropped — it is unused in practice (both usages in `box/index.tsx` use `mode="modal"`). Each usage site picks one component.

## Components

### RelationFilterDropdown

**File:** `src/components/filters/RelationFilterDropdown.tsx`

**Props:**
```ts
interface RelationFilterDropdownProps<T> {
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  data: T[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
}
```

**Behavior:**
- Receives `data` from parent, filters client-side with a search input inside a Popover.
- Popover trigger shows: placeholder when empty, item label for single select, "N selected" for multi.
- Clear button (ButtonGroup + Delete icon) appears when selection exists.
- Single select: clicking an item toggles selection on/off.
- Multi select: checkboxes shown, clicking toggles individual items.

### RelationFilterModal

**File:** `src/components/filters/RelationFilterModal.tsx`

**Props:**
```ts
interface RelationFilterModalProps<T> {
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  data: T[];
  isLoading?: boolean;
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
  tableColumns?: ColumnDef<T, unknown>[];
  filterFields?: FilterField[];
  onFiltersChange?: (filters: Record<string, unknown>) => void;
}
```

**Behavior:**
- Receives `data` from parent. The component is stateless for data — parent owns fetching.
- Modal manages its own filter input state. When filter inputs change, calls `onFiltersChange(filters)` so the parent can re-query and pass updated `data` back.
- `filterFields` and `onFiltersChange` are paired: if `filterFields` is provided, `onFiltersChange` must also be provided. If neither is provided, the modal shows only the data table with no filter inputs.
- When `isLoading` is true, the table shows a loading indicator. This covers the window between `onFiltersChange` firing and the parent providing fresh `data`.
- Filter inputs use `DebouncedInput` component built from `filterFields`.
- Trigger is always a full-width labeled button.
- Button trigger shows: placeholder when empty, item label for single select, "N selected" for multi.
- Clear button (ButtonGroup + Delete icon) appears when selection exists.
- Dialog contains filter inputs and a paginated data table.
- Pagination uses TanStack Table's default page size with no explicit page navigation controls (matches current behavior).
- Single select: clicking a row selects it and closes the dialog immediately.
- Multi select: checkboxes, badge chips for selected items, Cancel/Confirm footer.
- Default single "Name" column via `getLabel` if no `tableColumns` provided.
- Uses `useReactTable` with `getCoreRowModel`, `getFilteredRowModel`, `getPaginationRowModel`.

**Implementation note:** The `getLabel` callback must be stabilized via `useRef` to prevent infinite render loops from `useReactTable` (the original code uses this pattern at lines 293-295).

## Deletions

- Delete `src/components/filters/RelationFilter.tsx` — replaced entirely by the two new components.

## box/index.tsx Changes

- Replace `RelationFilter<ItemDto>` with `RelationFilterModal<ItemDto>`, and `RelationFilter<ThingDto>` with `RelationFilterModal<ThingDto>`.
- Update imports: remove `RelationFilter`, add `RelationFilterModal`.
- Parent owns data fetching using existing filtered query options:
  - Use `itemsFilteredQueryOptions(modalFilters)` from `src/api/item.ts` (uses `fetchItemsFiltered`).
  - Use `thingsFilteredQueryOptions(modalFilters)` from `src/api/thing.ts` (uses `fetchThingsFiltered`).
  - Add `useState` for modal filter state per filter instance; pass to query options and wire to `onFiltersChange`.
  - Pass `isLoading` from query's `isFetching` state.
- Add `filterFields` prop to both usages.
- Existing hydration queries (`allItems`, `allThings`) and derived `selectedItem`/`selectedThings` remain unchanged.

## API Changes

No API changes needed. `fetchItemsFiltered` and `fetchThingsFiltered` already exist in `src/api/item.ts` and `src/api/thing.ts` and accept filter parameters.
