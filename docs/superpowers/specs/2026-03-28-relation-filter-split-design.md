# Split RelationFilter into RelationFilterDropdown and RelationFilterModal

## Summary

Split the monolithic `RelationFilter` component (~505 lines) into two independent, focused components: `RelationFilterDropdown` (client-side search popover) and `RelationFilterModal` (server-side filtered dialog with table). Delete the original `RelationFilter.tsx`. Update `box/index.tsx` to use the new components.

## Components

### RelationFilterDropdown

**File:** `src/components/filters/RelationFilterDropdown.tsx`

**Props:**
```ts
interface RelationFilterDropdownProps<T> {
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  queryFn: () => Promise<ApiResponse<T[]>>;
  queryKey: string[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
}
```

**Behavior:**
- Fetches all data via `queryFn`, filters client-side with a search input inside a Popover.
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
  queryFn: (filters: Record<string, unknown>) => Promise<ApiResponse<T[]>>;
  queryKey: string[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
  tableColumns?: ColumnDef<T, unknown>[];
  filterFields?: FilterField[];
}
```

**Behavior:**
- Always server-side filtering — `queryFn` receives current filter values.
- Button trigger shows: placeholder when empty, item label for single select, "N selected" for multi.
- Clear button (ButtonGroup + Delete icon) appears when selection exists.
- Dialog contains filter inputs (from `filterFields`) and a paginated data table.
- Single select: clicking a row selects it and closes the dialog immediately.
- Multi select: checkboxes, badge chips for selected items, Cancel/Confirm footer.
- Default single "Name" column via `getLabel` if no `tableColumns` provided.
- Uses `useReactTable` with `getCoreRowModel`, `getFilteredRowModel`, `getPaginationRowModel`.

## Deletions

- Delete `src/components/filters/RelationFilter.tsx` — replaced entirely by the two new components.
- Remove the `mode` prop concept — no combined dropdown+modal layout.

## box/index.tsx Changes

- Replace `RelationFilter<ItemDto>` and `RelationFilter<ThingDto>` with `RelationFilterModal<ItemDto>` and `RelationFilterModal<ThingDto>`.
- Update imports accordingly.
- Pass `fetchItems`/`fetchThings` as `queryFn` (must accept filters parameter — adapt API functions if needed).
- Add `filterFields` prop to both usages.
- Existing hydration queries (`allItems`, `allThings`) and derived `selectedItem`/`selectedThings` remain unchanged.

## API Considerations

The current `fetchItems` and `fetchThings` may not accept a filters parameter. Implementation should either:
- Adapt existing functions to accept an optional filters object, or
- Create filtered variants (e.g., `fetchItemsFiltered`).
