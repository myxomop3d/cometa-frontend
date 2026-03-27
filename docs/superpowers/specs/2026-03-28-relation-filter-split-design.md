# Split RelationFilter into RelationFilterDropdown and RelationFilterModal

## Summary

Split the monolithic `RelationFilter` component (~505 lines) into two independent, focused components: `RelationFilterDropdown` (client-side search popover) and `RelationFilterModal` (server-side filtered dialog with table). Delete the original `RelationFilter.tsx`. Update `box/index.tsx` to use the new components.

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
- Always server-side filtering — `queryFn` always receives filter values. No client-side fallback. Existing API functions (`fetchItems`, `fetchThings`) must be adapted to accept a filters parameter.
- Trigger is always a full-width labeled button (the small icon-button variant from the old `mode="both"` layout is removed).
- Button trigger shows: placeholder when empty, item label for single select, "N selected" for multi.
- Clear button (ButtonGroup + Delete icon) appears when selection exists.
- Dialog contains debounced filter inputs (`DebouncedInput` component) built from `filterFields`, and a paginated data table.
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
- Pass adapted `fetchItems`/`fetchThings` as `queryFn` (accepting filters parameter).
- Add `filterFields` prop to both usages.
- Existing hydration queries (`allItems`, `allThings`) and derived `selectedItem`/`selectedThings` remain unchanged.

## API Changes

The current `fetchItems` and `fetchThings` do not accept a filters parameter. Adapt both functions to accept an optional `filters: Record<string, unknown>` parameter and pass it as query params to the API. This keeps a single function per entity rather than creating separate variants.
