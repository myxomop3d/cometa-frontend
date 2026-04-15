# RelationFilter Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `RelationFilter` into two independent, data-agnostic components — `RelationFilterDropdown` and `RelationFilterModal` — and update the consumer in `box/index.tsx`.

**Architecture:** Two new files replace one. Both components receive `data: T[]` from the parent. The dropdown does client-side search filtering in a popover. The modal renders a dialog with server-side filter inputs and a data table, communicating filter changes upward via `onFiltersChange`. The parent owns all data fetching via TanStack Query.

**Tech Stack:** React, TypeScript, TanStack Table, TanStack Query, shadcn/ui (Popover, Dialog, Button, ButtonGroup, Badge, Checkbox, Table), DebouncedInput.

**Spec:** `docs/superpowers/specs/2026-03-28-relation-filter-split-design.md`

---

### Task 1: Create RelationFilterDropdown

**Files:**
- Create: `src/components/filters/RelationFilterDropdown.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { useState, useMemo } from "react";
import { Search, Delete } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ButtonGroup } from "@/components/ui/button-group";

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

export function RelationFilterDropdown<T>({
  multi,
  value,
  onChange,
  data,
  getLabel,
  getId,
  placeholder = "Select...",
  className,
}: RelationFilterDropdownProps<T>) {
  const [search, setSearch] = useState("");

  const selectedItems: T[] = multi
    ? Array.isArray(value) ? value : []
    : value !== undefined ? [value as T] : [];

  const selectedIds = new Set(selectedItems.map(getId));

  const displayText = selectedItems.length === 0
    ? placeholder
    : multi
      ? `${selectedItems.length} selected`
      : getLabel(selectedItems[0]);

  const hasSelection = selectedItems.length > 0;

  const filtered = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((item) => getLabel(item).toLowerCase().includes(lower));
  }, [data, search, getLabel]);

  const toggleItem = (item: T) => {
    const id = getId(item);
    if (multi) {
      if (selectedIds.has(id)) {
        const next = selectedItems.filter((s) => getId(s) !== id);
        onChange(next.length > 0 ? next : undefined);
      } else {
        onChange([...selectedItems, item]);
      }
    } else {
      if (selectedIds.has(id)) {
        onChange(undefined);
      } else {
        onChange(item);
      }
    }
  };

  return (
    <div className={className}>
      <ButtonGroup className="w-full">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="flex-1 justify-start text-left font-normal min-w-0"
              />
            }
          >
            {displayText}
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-0 p-0 h-8 focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.map((item) => {
                const id = getId(item);
                const isSelected = selectedIds.has(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent ${
                      isSelected ? "bg-accent/50" : ""
                    }`}
                    onClick={() => toggleItem(item)}
                  >
                    {multi && <Checkbox checked={isSelected} />}
                    <span className="text-sm">{getLabel(item)}</span>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No results
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {hasSelection && (
          <Button
            variant="outline"
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <Delete />
          </Button>
        )}
      </ButtonGroup>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `RelationFilterDropdown.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/filters/RelationFilterDropdown.tsx
git commit -m "feat: add RelationFilterDropdown component"
```

---

### Task 2: Create RelationFilterModal

**Files:**
- Create: `src/components/filters/RelationFilterModal.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { useState, useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Search, Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ButtonGroup } from "@/components/ui/button-group";
import { DebouncedInput } from "@/components/DebouncedInput";
import type { FilterField } from "@/types/table";

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

export function RelationFilterModal<T>({
  multi,
  value,
  onChange,
  data,
  isLoading,
  getLabel,
  getId,
  placeholder = "Select...",
  className,
  tableColumns,
  filterFields,
  onFiltersChange,
}: RelationFilterModalProps<T>) {
  const [open, setOpen] = useState(false);
  const [modalSelection, setModalSelection] = useState<T[]>([]);
  const [modalFilters, setModalFilters] = useState<Record<string, unknown>>({});

  // Stabilize getLabel via ref to prevent useReactTable infinite render loop.
  const getLabelRef = useRef(getLabel);
  getLabelRef.current = getLabel;

  const selectedItems: T[] = multi
    ? Array.isArray(value) ? value : []
    : value !== undefined ? [value as T] : [];

  const selectedIds = new Set(selectedItems.map(getId));

  const displayText = selectedItems.length === 0
    ? placeholder
    : multi
      ? `${selectedItems.length} selected`
      : getLabel(selectedItems[0]);

  const hasSelection = selectedItems.length > 0;

  const defaultColumns: ColumnDef<T, unknown>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row: T) => getLabelRef.current(row),
      },
    ],
    [],
  );

  const columns = tableColumns ?? defaultColumns;

  const coreRowModel = useMemo(() => getCoreRowModel<T>(), []);
  const filteredRowModel = useMemo(() => getFilteredRowModel<T>(), []);
  const paginationRowModel = useMemo(() => getPaginationRowModel<T>(), []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
  });

  const handleOpen = () => {
    setModalSelection([...selectedItems]);
    setOpen(true);
  };

  const handleConfirm = () => {
    if (multi) {
      onChange(modalSelection.length > 0 ? modalSelection : undefined);
    } else {
      onChange(modalSelection.length > 0 ? modalSelection[0] : undefined);
    }
    setOpen(false);
  };

  const toggleModalItem = (item: T) => {
    const id = getId(item);
    if (multi) {
      const exists = modalSelection.some((s) => getId(s) === id);
      if (exists) {
        setModalSelection(modalSelection.filter((s) => getId(s) !== id));
      } else {
        setModalSelection([...modalSelection, item]);
      }
    } else {
      onChange(item);
      setOpen(false);
    }
  };

  const modalSelectionIds = new Set(modalSelection.map(getId));

  const handleFilterChange = (key: string, val: string) => {
    const next = { ...modalFilters, [key]: val || undefined };
    setModalFilters(next);
    onFiltersChange?.(next);
  };

  return (
    <div className={className}>
      <ButtonGroup className="w-full">
        <Button
          variant="outline"
          className="flex-1 justify-start text-left font-normal min-w-0"
          onClick={handleOpen}
        >
          {displayText}
        </Button>
        {hasSelection && (
          <Button
            variant="outline"
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <Delete />
          </Button>
        )}
      </ButtonGroup>

      <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select {multi ? "items" : "item"}</DialogTitle>
          </DialogHeader>

          {filterFields && filterFields.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {filterFields.map(({ key, label }) => (
                <DebouncedInput
                  key={key}
                  placeholder={label}
                  value={(modalFilters[key] as string) ?? ""}
                  onChange={(v) => handleFilterChange(key, v)}
                />
              ))}
            </div>
          )}

          {multi && modalSelection.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {modalSelection.map((item) => (
                <Badge
                  key={getId(item)}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => toggleModalItem(item)}
                >
                  {getLabel(item)} ×
                </Badge>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {multi && <TableHead className="w-10" />}
                      {hg.headers.map((header) => (
                        <TableHead key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => {
                    const isSelected = modalSelectionIds.has(getId(row.original));
                    return (
                      <TableRow
                        key={row.id}
                        className={`cursor-pointer ${isSelected ? "bg-accent/50" : ""}`}
                        onClick={() => toggleModalItem(row.original)}
                      >
                        {multi && (
                          <TableCell>
                            <Checkbox checked={isSelected} />
                          </TableCell>
                        )}
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {table.getRowModel().rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + (multi ? 1 : 0)}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {multi && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                Confirm ({modalSelection.length})
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `RelationFilterModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/filters/RelationFilterModal.tsx
git commit -m "feat: add RelationFilterModal component"
```

---

### Task 3: Update box/index.tsx to use new components

**Files:**
- Modify: `src/routes/box/index.tsx`

- [ ] **Step 1: Update imports**

Make these three import changes (no other import changes needed — `useState` and `useQuery` are already imported):

```diff
-import { fetchItems, itemsQueryOptions } from "@/api/item";
-import { fetchThings, thingsQueryOptions } from "@/api/thing";
+import { itemsQueryOptions, itemsFilteredQueryOptions } from "@/api/item";
+import { thingsQueryOptions, thingsFilteredQueryOptions } from "@/api/thing";
```

```diff
-import { RelationFilter } from "@/components/filters/RelationFilter";
+import { RelationFilterModal } from "@/components/filters/RelationFilterModal";
```

- [ ] **Step 2: Add modal filter state and queries inside BoxPage**

Add after the existing `allThings` query block (around line 194):

```tsx
// Modal filter state for RelationFilterModal instances
const [itemModalFilters, setItemModalFilters] = useState<Record<string, unknown>>({});
const [thingModalFilters, setThingModalFilters] = useState<Record<string, unknown>>({});

// Server-filtered queries for modal data
const { data: filteredItems, isFetching: isItemsLoading } = useQuery(
  itemsFilteredQueryOptions(itemModalFilters),
);
const { data: filteredThings, isFetching: isThingsLoading } = useQuery(
  thingsFilteredQueryOptions(thingModalFilters),
);
```

- [ ] **Step 3: Replace RelationFilter usages with RelationFilterModal**

Replace the Item `RelationFilter` block:
```tsx
<RelationFilter<ItemDto>
  mode="modal"
  multi={false}
  value={selectedItem}
  onChange={(val) => {
    const item = val as ItemDto | undefined;
    setFilters({ itemId: item?.id });
  }}
  queryFn={fetchItems}
  queryKey={["items", "all"]}
  getLabel={(item) => item.name}
  getId={(item) => item.id}
  placeholder="Item..."
  className="col-span-2"
/>
```

With:
```tsx
<RelationFilterModal<ItemDto>
  multi={false}
  value={selectedItem}
  onChange={(val) => {
    const item = val as ItemDto | undefined;
    setFilters({ itemId: item?.id });
  }}
  data={filteredItems?.data ?? []}
  isLoading={isItemsLoading}
  getLabel={(item) => item.name}
  getId={(item) => item.id}
  placeholder="Item..."
  className="col-span-2"
  filterFields={[{ key: "name", label: "Name" }]}
  onFiltersChange={setItemModalFilters}
/>
```

Replace the Thing `RelationFilter` block:
```tsx
<RelationFilter<ThingDto>
  mode="modal"
  multi={true}
  value={selectedThings}
  onChange={(val) => {
    const things = val as ThingDto[] | undefined;
    setFilters({
      thingIds:
        things && things.length > 0
          ? things.map((t) => t.id)
          : undefined,
    });
  }}
  queryFn={fetchThings}
  queryKey={["things", "all"]}
  getLabel={(thing) => thing.name}
  getId={(thing) => thing.id}
  placeholder="Things..."
  className="col-span-2"
/>
```

With:
```tsx
<RelationFilterModal<ThingDto>
  multi={true}
  value={selectedThings}
  onChange={(val) => {
    const things = val as ThingDto[] | undefined;
    setFilters({
      thingIds:
        things && things.length > 0
          ? things.map((t) => t.id)
          : undefined,
    });
  }}
  data={filteredThings?.data ?? []}
  isLoading={isThingsLoading}
  getLabel={(thing) => thing.name}
  getId={(thing) => thing.id}
  placeholder="Things..."
  className="col-span-2"
  filterFields={[{ key: "name", label: "Name" }]}
  onFiltersChange={setThingModalFilters}
/>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/box/index.tsx
git commit -m "refactor: use RelationFilterModal in box page"
```

---

### Task 4: Delete old RelationFilter

**Files:**
- Delete: `src/components/filters/RelationFilter.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/filters/RelationFilter.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "RelationFilter" src/ --include="*.tsx" --include="*.ts"`
Expected: Only references to `RelationFilterDropdown` and `RelationFilterModal`, no references to the old `RelationFilter`.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git rm src/components/filters/RelationFilter.tsx
git commit -m "refactor: delete old RelationFilter component"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify box page**

Open `http://localhost:5173/box/` in browser:
- Click Item filter — dialog opens with name filter input and table
- Type in the name filter — table updates after debounce
- Click a row — dialog closes, filter value is set, URL updates with `itemId`
- Clear button appears — click it, filter resets
- Click Things filter — dialog opens with name filter, multi-select with checkboxes
- Select multiple items — badges appear, Confirm button shows count
- Click Confirm — filter applied, URL updates with `thingIds`
- Clear button resets the selection

- [ ] **Step 3: Final commit if any fixes needed**
