# Box-Dice Data Table Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable data-table component system (ported from tablecn) and a `/box-dice/` page that displays BoxDto data with server-side filtering, sorting, pagination, column visibility, pinning, inline editing via sheet, and relation filters.

**Architecture:** Port tablecn's data-table components to cometa, adapting from Radix/@base-ui differences and replacing nuqs URL state with TanStack Router search params. The `useDataTable` hook syncs TanStack Table column filter/sort/pagination state with URL params via `useNavigate`. All data-table components are generic; page-specific code lives in `src/routes/box-dice/`.

**Tech Stack:** React 19, TanStack Table v8, TanStack Router, TanStack Query, shadcn/ui (base-nova style with @base-ui/react), react-hook-form, zod v4, Tailwind CSS v4

**Reference repo:** `F:\programming\tablecn` — the tablecn project from which components are ported.

**Important @base-ui adaptation notes:**
- Remove all `"use client"` directives (not needed outside Next.js)
- Separator uses `data-vertical:` / `data-horizontal:` selectors (Tailwind v4), NOT `data-[orientation=vertical]:` (Radix pattern)
- Components import from `@/components/ui/*` which wraps @base-ui primitives (API is shadcn-standard)

---

### Task 1: Install dependencies and shadcn components

**Files:**
- Modify: `package.json`
- Create (via shadcn CLI): `src/components/ui/command.tsx`, `src/components/ui/slider.tsx`, `src/components/ui/label.tsx`, `src/components/ui/form.tsx`

- [ ] **Step 1: Install npm packages**

```bash
npm install react-hook-form @hookform/resolvers
```

- [ ] **Step 2: Install shadcn components**

```bash
npx shadcn@latest add command slider label form
```

If `form` install fails (zod v4 compatibility), skip it — we'll use react-hook-form directly without the shadcn Form wrapper.

- [ ] **Step 3: Verify installation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: install react-hook-form, command, slider, label shadcn components"
```

---

### Task 2: Create data-table types

**Files:**
- Create: `src/types/data-table.ts`
- Modify: `src/types/api.ts`

- [ ] **Step 1: Create `src/types/data-table.ts`**

```typescript
import type { ColumnDef, ColumnSort, Row, RowData } from "@tanstack/react-table";
import type { QueryOptions } from "@tanstack/react-query";
import type { DataTableConfig } from "@/config/data-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    /**
     * URL param key for this column's filter.
     * For range/dateRange, use filterKeys instead.
     */
    filterKey?: string;
    /**
     * URL param keys for range/dateRange filters: [minKey, maxKey] or [fromKey, toKey].
     */
    filterKeys?: [string, string];
    /**
     * Configuration for relation/multiRelation filter variants.
     */
    relationConfig?: RelationConfig<any>;
  }
}

export interface RelationConfig<TRelated> {
  queryOptionsFn: (filters: Record<string, unknown>) => QueryOptions;
  columns: ColumnDef<TRelated, unknown>[];
  getLabel: (item: TRelated) => string;
  getId: (item: TRelated) => number;
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type FilterOperator = DataTableConfig["operators"][number];
export type FilterVariant = DataTableConfig["filterVariants"][number];
export type JoinOperator = DataTableConfig["joinOperators"][number];

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, "id"> {
  id: Extract<keyof TData, string>;
}

export interface DataTableRowAction<TData> {
  row: Row<TData>;
  variant: "update" | "delete" | "create";
}
```

- [ ] **Step 2: Add `SortByParams` to `src/types/api.ts`**

Add after the existing `PaginationParams` interface:

```typescript
export interface SortByParams {
  sortBy?: string; // comma-separated: "name.asc,num.desc"
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors (DataTableConfig import will fail until Task 3 — that's OK, verify after Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/types/data-table.ts src/types/api.ts
git commit -m "feat: add data-table types and SortByParams"
```

---

### Task 3: Create data-table config

**Files:**
- Create: `src/config/data-table.ts`

- [ ] **Step 1: Create `src/config/data-table.ts`**

```typescript
export type DataTableConfig = typeof dataTableConfig;

export const dataTableConfig = {
  textOperators: [
    { label: "Contains", value: "iLike" as const },
    { label: "Does not contain", value: "notILike" as const },
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  numericOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is less than", value: "lt" as const },
    { label: "Is less than or equal to", value: "lte" as const },
    { label: "Is greater than", value: "gt" as const },
    { label: "Is greater than or equal to", value: "gte" as const },
    { label: "Is between", value: "isBetween" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  dateOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is before", value: "lt" as const },
    { label: "Is after", value: "gt" as const },
    { label: "Is on or before", value: "lte" as const },
    { label: "Is on or after", value: "gte" as const },
    { label: "Is between", value: "isBetween" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  selectOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  multiSelectOperators: [
    { label: "Has any of", value: "inArray" as const },
    { label: "Has none of", value: "notInArray" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  booleanOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
  ],
  relationOperators: [
    { label: "Has any of", value: "inArray" as const },
    { label: "Has none of", value: "notInArray" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  sortOrders: [
    { label: "Asc", value: "asc" as const },
    { label: "Desc", value: "desc" as const },
  ],
  filterVariants: [
    "text",
    "number",
    "range",
    "date",
    "dateRange",
    "boolean",
    "select",
    "multiSelect",
    "relation",
    "multiRelation",
  ] as const,
  operators: [
    "iLike",
    "notILike",
    "eq",
    "ne",
    "inArray",
    "notInArray",
    "isEmpty",
    "isNotEmpty",
    "lt",
    "lte",
    "gt",
    "gte",
    "isBetween",
  ] as const,
  joinOperators: ["and", "or"] as const,
};
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/data-table.ts
git commit -m "feat: add data-table config with operators and filter variants"
```

---

### Task 4: Create data-table utility functions

**Files:**
- Create: `src/lib/data-table.ts`
- Create: `src/lib/format.ts`

- [ ] **Step 1: Create `src/lib/data-table.ts`**

```typescript
import type { Column } from "@tanstack/react-table";

/**
 * Returns CSS styles for pinned columns.
 * Ported from tablecn src/lib/data-table.ts.
 */
export function getColumnPinningStyle<TData>({
  column,
  withBorder = false,
}: {
  column: Column<TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isFirstRightPinnedColumn
          ? "4px 0 4px -4px var(--border) inset"
          : undefined
      : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: isPinned ? "var(--background)" : "var(--background)",
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

/**
 * Calculates optimal page size based on available window height.
 * Snaps to nearest step from [10, 20, 30, 40, 50].
 */
export function calculatePageSize(offsetPx = 280): number {
  if (typeof window === "undefined") return 20;
  const available = window.innerHeight - offsetPx;
  const ideal = Math.floor(available / 40);
  const steps = [10, 20, 30, 40, 50];
  return steps.reduce((prev, curr) =>
    Math.abs(curr - ideal) < Math.abs(prev - ideal) ? curr : prev
  );
}

/**
 * Parses a sort string like "name.asc,num.desc" into TanStack Table SortingState.
 */
export function parseSorting(
  sortStr: string | undefined
): { id: string; desc: boolean }[] {
  if (!sortStr) return [];
  return sortStr.split(",").map((part) => {
    const [id, dir] = part.split(".");
    return { id: id!, desc: dir === "desc" };
  });
}

/**
 * Serializes TanStack Table SortingState to "name.asc,num.desc" format.
 */
export function serializeSorting(
  sorting: { id: string; desc: boolean }[]
): string | undefined {
  if (sorting.length === 0) return undefined;
  return sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(",");
}
```

- [ ] **Step 2: Create `src/lib/format.ts`**

```typescript
import { format } from "date-fns";

export function formatDate(
  date: Date | string | number | undefined | null
): string {
  if (!date) return "";
  const d =
    typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return format(d, "MMM d, yyyy");
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-table.ts src/lib/format.ts
git commit -m "feat: add data-table utilities and format helpers"
```

---

### Task 5: Create DataTable base component

**Files:**
- Create: `src/components/data-table/data-table.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table.tsx`**

Port from `F:\programming\tablecn\src\components\data-table\data-table.tsx`. Changes from tablecn:
- Remove `"use client"`
- Imports stay the same (all from `@/components/ui/table`, `@/lib/data-table`, `@/lib/utils`)

```typescript
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type * as React from "react";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getColumnPinningStyle } from "@/lib/data-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
                      ...getColumnPinningStyle({ column: header.column }),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        ...getColumnPinningStyle({ column: cell.column }),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar &&
          table.getFilteredSelectedRowModel().rows.length > 0 &&
          actionBar}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** (will have import error for DataTablePagination — OK, fixed in next task)

- [ ] **Step 3: Commit**

```bash
git add src/components/data-table/data-table.tsx
git commit -m "feat: add DataTable base component"
```

---

### Task 6: Create DataTableColumnHeader

**Files:**
- Create: `src/components/data-table/data-table-column-header.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-column-header.tsx`**

Port from tablecn. Changes: remove `"use client"`.

```typescript
import type { Column } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  EyeOff,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.ComponentProps<typeof DropdownMenuTrigger> {
  column: Column<TData, TValue>;
  label: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn(className)}>{label}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ml-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {label}
        {column.getCanSort() &&
          (column.getIsSorted() === "desc" ? (
            <ChevronDown />
          ) : column.getIsSorted() === "asc" ? (
            <ChevronUp />
          ) : (
            <ChevronsUpDown />
          ))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-28">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={column.getIsSorted() === "asc"}
              onClick={() => column.toggleSorting(false)}
            >
              <ChevronUp />
              Asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={column.getIsSorted() === "desc"}
              onClick={() => column.toggleSorting(true)}
            >
              <ChevronDown />
              Desc
            </DropdownMenuCheckboxItem>
            {column.getIsSorted() && (
              <DropdownMenuItem
                className="pl-2 [&_svg]:text-muted-foreground"
                onClick={() => column.clearSorting()}
              >
                <X />
                Reset
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem
            className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
            checked={!column.getIsVisible()}
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeOff />
            Hide
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data-table/data-table-column-header.tsx
git commit -m "feat: add DataTableColumnHeader component"
```

---

### Task 7: Create DataTablePagination

**Files:**
- Create: `src/components/data-table/data-table-pagination.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-pagination.tsx`**

Port from tablecn. Changes: remove `"use client"`.

```typescript
import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      <div className="flex-1 whitespace-nowrap text-muted-foreground text-sm">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-18">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center font-medium text-sm">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data-table/data-table-pagination.tsx
git commit -m "feat: add DataTablePagination component"
```

---

### Task 8: Create DataTableViewOptions

**Files:**
- Create: `src/components/data-table/data-table-view-options.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-view-options.tsx`**

Port from tablecn. Changes: remove `"use client"`. Verify that Command component from shadcn works with @base-ui. If Command import fails, fall back to a simpler Popover-based column toggle list.

```typescript
import type { Table } from "@tanstack/react-table";
import { Check, Settings2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DataTableViewOptionsProps<TData>
  extends React.ComponentProps<typeof PopoverContent> {
  table: Table<TData>;
  disabled?: boolean;
}

export function DataTableViewOptions<TData>({
  table,
  disabled,
  ...props
}: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== "undefined" && column.getCanHide(),
        ),
    [table],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Toggle columns"
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 font-normal lg:flex"
          disabled={disabled}
        >
          <Settings2 className="text-muted-foreground" />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" {...props}>
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <span className="truncate">
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto size-4 shrink-0",
                      column.getIsVisible() ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

If Command component causes type errors due to @base-ui incompatibility, check the generated `src/components/ui/command.tsx` and fix any issues. The `cmdk` library (which Command wraps) is framework-agnostic and should work.

- [ ] **Step 3: Commit**

```bash
git add src/components/data-table/data-table-view-options.tsx
git commit -m "feat: add DataTableViewOptions component"
```

---

### Task 9: Create DataTableFacetedFilter

**Files:**
- Create: `src/components/data-table/data-table-faceted-filter.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-faceted-filter.tsx`**

Port from tablecn. Changes: remove `"use client"`, fix Separator data attribute classes for @base-ui (`data-vertical:h-4` instead of `data-[orientation=vertical]:h-4`).

```typescript
import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle, XCircle } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Option } from "@/types/data-table";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: Option[];
  multiple?: boolean;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  multiple,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);

  const columnFilterValue = column?.getFilterValue();
  const selectedValues = new Set(
    Array.isArray(columnFilterValue) ? columnFilterValue : [],
  );

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;

      if (multiple) {
        const newSelectedValues = new Set(selectedValues);
        if (isSelected) {
          newSelectedValues.delete(option.value);
        } else {
          newSelectedValues.add(option.value);
        }
        const filterValues = Array.from(newSelectedValues);
        column.setFilterValue(filterValues.length ? filterValues : undefined);
      } else {
        column.setFilterValue(isSelected ? undefined : [option.value]);
        setOpen(false);
      }
    },
    [column, multiple, selectedValues],
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      column?.setFilterValue(undefined);
    },
    [column],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed font-normal"
        >
          {selectedValues?.size > 0 ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={onReset}
            >
              <XCircle />
            </div>
          ) : (
            <PlusCircle />
          )}
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 h-4"
              />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList className="max-h-full">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden">
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onItemSelect(option, isSelected)}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check />
                    </div>
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    {option.count && (
                      <span className="ml-auto font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onReset()}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data-table/data-table-faceted-filter.tsx
git commit -m "feat: add DataTableFacetedFilter component"
```

---

### Task 10: Create DataTableDateFilter

**Files:**
- Create: `src/components/data-table/data-table-date-filter.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-date-filter.tsx`**

Port from tablecn. Changes: remove `"use client"`, import `formatDate` from `@/lib/format`, fix Separator classes.

```typescript
import type { Column } from "@tanstack/react-table";
import { CalendarIcon, XCircle } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/format";

type DateSelection = Date[] | DateRange;

function getIsDateRange(value: DateSelection): value is DateRange {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const numericTimestamp =
    typeof timestamp === "string" ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return !Number.isNaN(date.getTime()) ? date : undefined;
}

function parseColumnFilterValue(value: unknown) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value))
    return value.map((item) =>
      typeof item === "number" || typeof item === "string" ? item : undefined,
    );
  if (typeof value === "string" || typeof value === "number") return [value];
  return [];
}

interface DataTableDateFilterProps<TData> {
  column: Column<TData, unknown>;
  title?: string;
  multiple?: boolean;
}

export function DataTableDateFilter<TData>({
  column,
  title,
  multiple,
}: DataTableDateFilterProps<TData>) {
  const columnFilterValue = column.getFilterValue();

  const selectedDates = React.useMemo<DateSelection>(() => {
    if (!columnFilterValue) {
      return multiple ? { from: undefined, to: undefined } : [];
    }
    if (multiple) {
      const timestamps = parseColumnFilterValue(columnFilterValue);
      return {
        from: parseAsDate(timestamps[0]),
        to: parseAsDate(timestamps[1]),
      };
    }
    const timestamps = parseColumnFilterValue(columnFilterValue);
    const date = parseAsDate(timestamps[0]);
    return date ? [date] : [];
  }, [columnFilterValue, multiple]);

  const onSelect = React.useCallback(
    (date: Date | DateRange | undefined) => {
      if (!date) {
        column.setFilterValue(undefined);
        return;
      }
      if (multiple && !("getTime" in date)) {
        const from = date.from?.getTime();
        const to = date.to?.getTime();
        column.setFilterValue(from || to ? [from, to] : undefined);
      } else if (!multiple && "getTime" in date) {
        column.setFilterValue(date.getTime());
      }
    },
    [column, multiple],
  );

  const onReset = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      column.setFilterValue(undefined);
    },
    [column],
  );

  const hasValue = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return false;
      return selectedDates.from || selectedDates.to;
    }
    if (!Array.isArray(selectedDates)) return false;
    return selectedDates.length > 0;
  }, [multiple, selectedDates]);

  const formatDateRange = React.useCallback((range: DateRange) => {
    if (!range.from && !range.to) return "";
    if (range.from && range.to)
      return `${formatDate(range.from)} - ${formatDate(range.to)}`;
    return formatDate(range.from ?? range.to);
  }, []);

  const label = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return null;
      const hasSelectedDates = selectedDates.from || selectedDates.to;
      const dateText = hasSelectedDates
        ? formatDateRange(selectedDates)
        : "Select date range";
      return (
        <span className="flex items-center gap-2">
          <span>{title}</span>
          {hasSelectedDates && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              <span>{dateText}</span>
            </>
          )}
        </span>
      );
    }
    if (getIsDateRange(selectedDates)) return null;
    const hasSelectedDate = selectedDates.length > 0;
    const dateText = hasSelectedDate
      ? formatDate(selectedDates[0])
      : "Select date";
    return (
      <span className="flex items-center gap-2">
        <span>{title}</span>
        {hasSelectedDate && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-4" />
            <span>{dateText}</span>
          </>
        )}
      </span>
    );
  }, [selectedDates, multiple, formatDateRange, title]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed font-normal"
        >
          {hasValue ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              onClick={onReset}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <XCircle />
            </div>
          ) : (
            <CalendarIcon />
          )}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {multiple ? (
          <Calendar
            autoFocus
            captionLayout="dropdown"
            mode="range"
            selected={
              getIsDateRange(selectedDates)
                ? selectedDates
                : { from: undefined, to: undefined }
            }
            onSelect={onSelect}
          />
        ) : (
          <Calendar
            captionLayout="dropdown"
            mode="single"
            selected={
              !getIsDateRange(selectedDates) ? selectedDates[0] : undefined
            }
            onSelect={onSelect}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data-table/data-table-date-filter.tsx
git commit -m "feat: add DataTableDateFilter component"
```

---

### Task 11: Create DataTableSliderFilter

**Files:**
- Create: `src/components/data-table/data-table-slider-filter.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-slider-filter.tsx`**

Port from tablecn. Changes: remove `"use client"`, fix Separator classes. Uses Label and Slider from shadcn — verify these were installed in Task 1.

```typescript
import type { Column } from "@tanstack/react-table";
import { PlusCircle, XCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type RangeValue = [number, number];

function parseValuesAsNumbers(value: unknown): RangeValue | undefined {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (v) =>
        (typeof v === "string" || typeof v === "number") && !Number.isNaN(v),
    )
  ) {
    return [Number(value[0]), Number(value[1])];
  }
  return undefined;
}

interface DataTableSliderFilterProps<TData> {
  column: Column<TData, unknown>;
  title?: string;
}

export function DataTableSliderFilter<TData>({
  column,
  title,
}: DataTableSliderFilterProps<TData>) {
  const id = React.useId();

  const columnFilterValue = parseValuesAsNumbers(column.getFilterValue());

  const defaultRange = column.columnDef.meta?.range;
  const unit = column.columnDef.meta?.unit;

  const { min, max, step } = React.useMemo(() => {
    let minValue = 0;
    let maxValue = 100;

    if (
      defaultRange &&
      Array.isArray(defaultRange) &&
      defaultRange.length === 2
    ) {
      [minValue, maxValue] = defaultRange;
    } else {
      const values = column.getFacetedMinMaxValues();
      if (values && Array.isArray(values) && values.length === 2) {
        const [facetMinValue, facetMaxValue] = values;
        if (
          typeof facetMinValue === "number" &&
          typeof facetMaxValue === "number"
        ) {
          minValue = facetMinValue;
          maxValue = facetMaxValue;
        }
      }
    }

    const rangeSize = maxValue - minValue;
    const computedStep =
      rangeSize <= 20
        ? 1
        : rangeSize <= 100
          ? Math.ceil(rangeSize / 20)
          : Math.ceil(rangeSize / 50);

    return { min: minValue, max: maxValue, step: computedStep };
  }, [column, defaultRange]);

  const range = React.useMemo((): RangeValue => {
    return columnFilterValue ?? [min, max];
  }, [columnFilterValue, min, max]);

  const formatValue = React.useCallback((value: number) => {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }, []);

  const onFromInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = Number(event.target.value);
      if (!Number.isNaN(numValue) && numValue >= min && numValue <= range[1]) {
        column.setFilterValue([numValue, range[1]]);
      }
    },
    [column, min, range],
  );

  const onToInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = Number(event.target.value);
      if (!Number.isNaN(numValue) && numValue <= max && numValue >= range[0]) {
        column.setFilterValue([range[0], numValue]);
      }
    },
    [column, max, range],
  );

  const onSliderValueChange = React.useCallback(
    (value: number[]) => {
      if (Array.isArray(value) && value.length === 2) {
        column.setFilterValue(value as RangeValue);
      }
    },
    [column],
  );

  const onReset = React.useCallback(
    (event: React.MouseEvent) => {
      if (event.target instanceof HTMLDivElement) {
        event.stopPropagation();
      }
      column.setFilterValue(undefined);
    },
    [column],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed font-normal"
        >
          {columnFilterValue ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={onReset}
            >
              <XCircle />
            </div>
          ) : (
            <PlusCircle />
          )}
          <span>{title}</span>
          {columnFilterValue ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              {formatValue(columnFilterValue[0])} -{" "}
              {formatValue(columnFilterValue[1])}
              {unit ? ` ${unit}` : ""}
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="font-medium leading-none">{title}</p>
          <div className="flex items-center gap-4">
            <Label htmlFor={`${id}-from`} className="sr-only">
              From
            </Label>
            <div className="relative">
              <Input
                id={`${id}-from`}
                type="number"
                inputMode="numeric"
                placeholder={min.toString()}
                min={min}
                max={max}
                value={range[0]?.toString()}
                onChange={onFromInputChange}
                className={cn("h-8 w-24", unit && "pr-8")}
              />
              {unit && (
                <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-muted-foreground text-sm">
                  {unit}
                </span>
              )}
            </div>
            <Label htmlFor={`${id}-to`} className="sr-only">
              to
            </Label>
            <div className="relative">
              <Input
                id={`${id}-to`}
                type="number"
                inputMode="numeric"
                placeholder={max.toString()}
                min={min}
                max={max}
                value={range[1]?.toString()}
                onChange={onToInputChange}
                className={cn("h-8 w-24", unit && "pr-8")}
              />
              {unit && (
                <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-muted-foreground text-sm">
                  {unit}
                </span>
              )}
            </div>
          </div>
          <Label htmlFor={`${id}-slider`} className="sr-only">
            {title} slider
          </Label>
          <Slider
            id={`${id}-slider`}
            min={min}
            max={max}
            step={step}
            value={range}
            onValueChange={onSliderValueChange}
          />
        </div>
        <Button
          aria-label={`Clear ${title} filter`}
          variant="outline"
          size="sm"
          onClick={onReset}
        >
          Clear
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data-table/data-table-slider-filter.tsx
git commit -m "feat: add DataTableSliderFilter component"
```

---

### Task 12: Create DataTableToolbar with relation filter support

**Files:**
- Create: `src/components/data-table/data-table-toolbar.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-toolbar.tsx`**

Port from tablecn toolbar. Add `relation` and `multiRelation` cases to the filter switch. The relation filter renders a button that opens a RelationPicker (Task 15). For now, add the cases with a placeholder comment — the actual RelationPicker import will be wired in Task 15.

```typescript
import type { Column, Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";

import { DataTableDateFilter } from "@/components/data-table/data-table-date-filter";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { DataTableSliderFilter } from "@/components/data-table/data-table-slider-filter";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table],
  );

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-start justify-between gap-2 p-1",
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} />
        ))}
        {isFiltered && (
          <Button
            aria-label="Reset filters"
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={onReset}
          >
            <X />
            Reset
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  );
}

interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({
  column,
}: DataTableToolbarFilterProps<TData>) {
  const columnMeta = column.columnDef.meta;

  if (!columnMeta?.variant) return null;

  switch (columnMeta.variant) {
    case "text":
      return (
        <Input
          placeholder={columnMeta.placeholder ?? columnMeta.label}
          value={(column.getFilterValue() as string) ?? ""}
          onChange={(event) => column.setFilterValue(event.target.value)}
          className="h-8 w-40 lg:w-56"
        />
      );

    case "number":
      return (
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={columnMeta.placeholder ?? columnMeta.label}
            value={(column.getFilterValue() as string) ?? ""}
            onChange={(event) => column.setFilterValue(event.target.value)}
            className={cn("h-8 w-[120px]", columnMeta.unit && "pr-8")}
          />
          {columnMeta.unit && (
            <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-muted-foreground text-sm">
              {columnMeta.unit}
            </span>
          )}
        </div>
      );

    case "range":
      return (
        <DataTableSliderFilter
          column={column}
          title={columnMeta.label ?? column.id}
        />
      );

    case "date":
    case "dateRange":
      return (
        <DataTableDateFilter
          column={column}
          title={columnMeta.label ?? column.id}
          multiple={columnMeta.variant === "dateRange"}
        />
      );

    case "select":
    case "multiSelect":
      return (
        <DataTableFacetedFilter
          column={column}
          title={columnMeta.label ?? column.id}
          options={columnMeta.options ?? []}
          multiple={columnMeta.variant === "multiSelect"}
        />
      );

    case "boolean":
      return (
        <DataTableFacetedFilter
          column={column}
          title={columnMeta.label ?? column.id}
          options={[
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
          ]}
          multiple={false}
        />
      );

    case "relation":
    case "multiRelation":
      // Implemented in Task 15 — DataTableRelationFilter
      return null;

    default:
      return null;
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data-table/data-table-toolbar.tsx
git commit -m "feat: add DataTableToolbar with auto-generated filters"
```

---

### Task 13: Create DataTableSkeleton

**Files:**
- Create: `src/components/data-table/data-table-skeleton.tsx`

- [ ] **Step 1: Create `src/components/data-table/data-table-skeleton.tsx`**

Port from tablecn verbatim (remove `"use client"`).

```typescript
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableSkeletonProps extends React.ComponentProps<"div"> {
  columnCount: number;
  rowCount?: number;
  filterCount?: number;
  cellWidths?: string[];
  withViewOptions?: boolean;
  withPagination?: boolean;
  shrinkZero?: boolean;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  filterCount = 0,
  cellWidths = ["auto"],
  withViewOptions = true,
  withPagination = true,
  shrinkZero = false,
  className,
  ...props
}: DataTableSkeletonProps) {
  const cozyCellWidths = Array.from(
    { length: columnCount },
    (_, index) => cellWidths[index % cellWidths.length] ?? "auto",
  );

  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      <div className="flex w-full items-center justify-between gap-2 overflow-auto p-1">
        <div className="flex flex-1 items-center gap-2">
          {filterCount > 0
            ? Array.from({ length: filterCount }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-18 border-dashed" />
              ))
            : null}
        </div>
        {withViewOptions ? (
          <Skeleton className="ml-auto hidden h-7 w-18 lg:flex" />
        ) : null}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {Array.from({ length: columnCount }).map((_, j) => (
                <TableHead
                  key={j}
                  style={{
                    width: cozyCellWidths[j],
                    minWidth: shrinkZero ? cozyCellWidths[j] : "auto",
                  }}
                >
                  <Skeleton className="h-6 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell
                    key={j}
                    style={{
                      width: cozyCellWidths[j],
                      minWidth: shrinkZero ? cozyCellWidths[j] : "auto",
                    }}
                  >
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {withPagination ? (
        <div className="flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8">
          <Skeleton className="h-7 w-40 shrink-0" />
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-18" />
            </div>
            <div className="flex items-center justify-center font-medium text-sm">
              <Skeleton className="h-7 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="hidden size-7 lg:block" />
              <Skeleton className="size-7" />
              <Skeleton className="size-7" />
              <Skeleton className="hidden size-7 lg:block" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data-table/data-table-skeleton.tsx
git commit -m "feat: add DataTableSkeleton component"
```

---

### Task 14: Create useDataTable hook

**Files:**
- Create: `src/hooks/use-data-table.ts`

This is the core integration hook. It replaces tablecn's nuqs-based hook with TanStack Router search param integration. Column filter state is derived from URL search params and changes are synced back via navigation.

- [ ] **Step 1: Create `src/hooks/use-data-table.ts`**

```typescript
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  calculatePageSize,
  parseSorting,
  serializeSorting,
} from "@/lib/data-table";

interface UseDataTableOptions<TData, TSearch extends Record<string, unknown>> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  pageCount: number;
  /** Current URL search params (from route's useSearch). */
  search: TSearch;
  /** Navigate function to update URL search params. Receives partial updates merged with current search. */
  onNavigate: (updates: Partial<TSearch>) => void;
  /** URL param key for sort (default: "sort"). */
  sortKey?: string;
  /** URL param key for page (default: "page"). */
  pageKey?: string;
  /** URL param key for pageSize (default: "pageSize"). */
  pageSizeKey?: string;
  /** Default page size (auto-calculated from window height if not provided). */
  defaultPageSize?: number;
}

/**
 * Creates a TanStack Table instance with server-side pagination, sorting, and filtering.
 * Column filter state is derived from URL search params and changes sync back to URL.
 *
 * Filter mapping uses column meta:
 * - `filterKey`: single URL param key (for text, number, boolean, select, multiSelect, relation)
 * - `filterKeys`: [minKey, maxKey] for range/dateRange
 *
 * Sorting is stored in URL as "name.asc,num.desc" format.
 */
export function useDataTable<
  TData,
  TSearch extends Record<string, unknown>,
>({
  columns,
  data,
  pageCount,
  search,
  onNavigate,
  sortKey = "sort",
  pageKey = "page",
  pageSizeKey = "pageSize",
  defaultPageSize,
}: UseDataTableOptions<TData, TSearch>) {
  // Calculate default page size once on mount
  const computedDefaultPageSize = React.useMemo(
    () => defaultPageSize ?? calculatePageSize(),
    [defaultPageSize],
  );

  const page = ((search[pageKey] as number) ?? 1);
  const pageSizeFromUrl = search[pageSizeKey] as number | undefined;
  const pageSize = pageSizeFromUrl ?? computedDefaultPageSize;

  // Derive sorting from URL
  const sorting = React.useMemo(
    () => parseSorting(search[sortKey] as string | undefined),
    [search, sortKey],
  );

  // Derive column filters from URL search params using column meta
  const columnFilters = React.useMemo(() => {
    const filters: ColumnFiltersState = [];
    for (const col of columns) {
      const meta = col.meta;
      if (!meta?.variant) continue;
      const colId = (col as { id?: string; accessorKey?: string }).id ??
        (col as { accessorKey?: string }).accessorKey;
      if (!colId) continue;

      if (meta.filterKeys) {
        // Range/dateRange: two URL params
        const [key1, key2] = meta.filterKeys;
        const v1 = search[key1];
        const v2 = search[key2];
        if (v1 !== undefined || v2 !== undefined) {
          filters.push({ id: colId, value: [v1, v2] });
        }
      } else if (meta.filterKey) {
        const value = search[meta.filterKey];
        if (value !== undefined && value !== null) {
          // For multiSelect/multiRelation, ensure array
          if (meta.variant === "multiSelect" || meta.variant === "multiRelation") {
            const arrValue = Array.isArray(value) ? value : [value];
            filters.push({ id: colId, value: arrValue });
          } else if (meta.variant === "boolean") {
            // Boolean stored as "true"/"false" in select, but URL has boolean
            const boolStr = typeof value === "boolean" ? [String(value)] : [value];
            filters.push({ id: colId, value: boolStr });
          } else {
            filters.push({ id: colId, value });
          }
        }
      }
    }
    return filters;
  }, [search, columns]);

  // Column visibility (local state, not URL-persisted)
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  // Row selection (local state)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Pagination state
  const pagination: PaginationState = React.useMemo(
    () => ({ pageIndex: page - 1, pageSize }),
    [page, pageSize],
  );

  // Debounce timer ref for filter changes
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map column filter changes back to URL params
  const onColumnFiltersChange = React.useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const nextFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;

      // Build URL param updates
      const updates: Record<string, unknown> = { [pageKey]: 1 };

      // Clear all filter params first
      for (const col of columns) {
        const meta = col.meta;
        if (!meta?.variant) continue;
        if (meta.filterKeys) {
          updates[meta.filterKeys[0]] = undefined;
          updates[meta.filterKeys[1]] = undefined;
        } else if (meta.filterKey) {
          updates[meta.filterKey] = undefined;
        }
      }

      // Set filter params from new filter state
      for (const filter of nextFilters) {
        const col = columns.find((c) => {
          const id = (c as { id?: string; accessorKey?: string }).id ??
            (c as { accessorKey?: string }).accessorKey;
          return id === filter.id;
        });
        const meta = col?.meta;
        if (!meta) continue;

        if (meta.filterKeys && Array.isArray(filter.value)) {
          const [v1, v2] = filter.value as [unknown, unknown];
          updates[meta.filterKeys[0]] = v1 ?? undefined;
          updates[meta.filterKeys[1]] = v2 ?? undefined;
        } else if (meta.filterKey) {
          if (meta.variant === "boolean" && Array.isArray(filter.value)) {
            // Convert ["true"] → true, ["false"] → false
            const boolStr = (filter.value as string[])[0];
            updates[meta.filterKey] = boolStr === "true" ? true : boolStr === "false" ? false : undefined;
          } else {
            updates[meta.filterKey] = filter.value;
          }
        }
      }

      // Debounce navigation for text input filters
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onNavigate(updates as Partial<TSearch>);
      }, 300);
    },
    [columnFilters, columns, onNavigate, pageKey],
  );

  const onSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      onNavigate({
        [sortKey]: serializeSorting(nextSorting),
        [pageKey]: 1,
      } as Partial<TSearch>);
    },
    [sorting, onNavigate, sortKey, pageKey],
  );

  const onPaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      const nextPagination =
        typeof updater === "function" ? updater(pagination) : updater;
      onNavigate({
        [pageKey]: nextPagination.pageIndex + 1,
        [pageSizeKey]: nextPagination.pageSize,
      } as Partial<TSearch>);
    },
    [pagination, onNavigate, pageKey, pageSizeKey],
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    defaultColumn: {
      enableColumnFilter: false,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return React.useMemo(() => ({ table }), [table]);
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-data-table.ts
git commit -m "feat: add useDataTable hook with TanStack Router URL sync"
```

---

### Task 15: Create RelationPicker and DataTableRelationFilter

**Files:**
- Create: `src/components/relation-picker.tsx`
- Modify: `src/components/data-table/data-table-toolbar.tsx`

- [ ] **Step 1: Create `src/components/relation-picker.tsx`**

A button + modal component for selecting related items from a server-filtered data table. Used by both the toolbar relation filter and BoxSheet.

```typescript
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { PlusCircle, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

interface RelationPickerProps<TRelated> {
  multi: boolean;
  value: number | number[] | undefined;
  onChange: (value: number | number[] | undefined) => void;
  queryOptionsFn: (filters: Record<string, unknown>) => {
    queryKey: unknown[];
    queryFn: () => Promise<ApiResponse<TRelated>>;
  };
  columns: ColumnDef<TRelated, unknown>[];
  getLabel: (item: TRelated) => string;
  getId: (item: TRelated) => number;
  placeholder: string;
  className?: string;
  /** Render as inline button (for toolbar) vs form field style */
  variant?: "toolbar" | "field";
}

export function RelationPicker<TRelated>({
  multi,
  value,
  onChange,
  queryOptionsFn,
  columns,
  getLabel,
  getId,
  placeholder,
  className,
  variant = "toolbar",
}: RelationPickerProps<TRelated>) {
  const [open, setOpen] = React.useState(false);
  const [modalFilters, setModalFilters] = React.useState<Record<string, unknown>>({});
  const [modalSelection, setModalSelection] = React.useState<number[]>([]);

  // Fetch filtered data for modal (pageSize=10)
  const { data: filteredData, isFetching } = useQuery(
    queryOptionsFn({ ...modalFilters, pageSize: 10, page: 1 }),
  );

  // Hydrate labels for selected IDs by fetching only those items via OData id filter
  const selectedIds = React.useMemo(() => {
    if (!value) return [];
    return multi ? (value as number[]) : [value as number];
  }, [value, multi]);

  const { data: labelData } = useQuery({
    ...queryOptionsFn({ ids: selectedIds }),
    enabled: selectedIds.length > 0,
  });

  // Derive selected labels from the ID-filtered query
  const selectedLabels = React.useMemo(() => {
    if (selectedIds.length === 0) return [];
    if (!labelData?.data) {
      return selectedIds.map((id) => ({ id, label: `#${id}` }));
    }
    return selectedIds.map((id) => {
      const item = labelData.data.find((i: TRelated) => getId(i) === id);
      return { id, label: item ? getLabel(item) : `#${id}` };
    });
  }, [selectedIds, labelData, getLabel, getId]);

  // On modal open, initialize selection from current value
  React.useEffect(() => {
    if (open) {
      const ids = multi
        ? (value as number[] | undefined) ?? []
        : value !== undefined ? [value as number] : [];
      setModalSelection(ids);
      setModalFilters({});
    }
  }, [open, value, multi]);

  const handleRowClick = (item: TRelated) => {
    const id = getId(item);
    if (multi) {
      setModalSelection((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      );
    } else {
      onChange(id);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    if (multi) {
      onChange(modalSelection.length > 0 ? modalSelection : undefined);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  // Modal table
  const modalTable = useReactTable({
    data: filteredData?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasValue = multi
    ? Array.isArray(value) && value.length > 0
    : value !== undefined;

  return (
    <>
      {variant === "toolbar" ? (
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed font-normal", className)}
          onClick={() => setOpen(true)}
        >
          {hasValue ? (
            <div
              role="button"
              aria-label={`Clear ${placeholder} filter`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
              onClick={handleClear}
            >
              <XCircle />
            </div>
          ) : (
            <PlusCircle />
          )}
          {placeholder}
          {hasValue && selectedLabels.length > 0 && (
            <div className="hidden items-center gap-1 lg:flex">
              {selectedLabels.length > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {selectedLabels.length} selected
                </Badge>
              ) : (
                selectedLabels.map((s) => (
                  <Badge key={s.id} variant="secondary" className="rounded-sm px-1 font-normal">
                    {s.label}
                  </Badge>
                ))
              )}
            </div>
          )}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn("h-auto min-h-9 justify-start font-normal", className)}
          onClick={() => setOpen(true)}
        >
          {hasValue && selectedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((s) => (
                <Badge key={s.id} variant="secondary" className="rounded-sm px-1 font-normal">
                  {s.label}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>

          {/* Modal filters */}
          <div className="flex gap-2">
            <Input
              placeholder="Search..."
              value={(modalFilters.name as string) ?? ""}
              onChange={(e) =>
                setModalFilters((prev) => ({
                  ...prev,
                  name: e.target.value || undefined,
                }))
              }
              className="h-8"
            />
          </div>

          {/* Modal table */}
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                {modalTable.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {multi && (
                      <TableHead className="w-10" />
                    )}
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (multi ? 1 : 0)}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : modalTable.getRowModel().rows.length > 0 ? (
                  modalTable.getRowModel().rows.map((row) => {
                    const id = getId(row.original);
                    const isSelected = modalSelection.includes(id);
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        data-state={isSelected && "selected"}
                        onClick={() => handleRowClick(row.original)}
                      >
                        {multi && (
                          <TableCell className="w-10">
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
                  })
                ) : (
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
    </>
  );
}
```

- [ ] **Step 2: Update DataTableToolbar to handle relation filters**

In `src/components/data-table/data-table-toolbar.tsx`, add the import and replace the relation cases:

Add import at top:
```typescript
import { RelationPicker } from "@/components/relation-picker";
```

Replace the `case "relation":` and `case "multiRelation":` blocks:

```typescript
    case "relation":
      return columnMeta.relationConfig ? (
        <RelationPicker
          multi={false}
          value={column.getFilterValue() as number | undefined}
          onChange={(val) => column.setFilterValue(val ?? undefined)}
          queryOptionsFn={columnMeta.relationConfig.queryOptionsFn}

          columns={columnMeta.relationConfig.columns}
          getLabel={columnMeta.relationConfig.getLabel}
          getId={columnMeta.relationConfig.getId}
          placeholder={columnMeta.label ?? column.id}
          variant="toolbar"
        />
      ) : null;

    case "multiRelation":
      return columnMeta.relationConfig ? (
        <RelationPicker
          multi={true}
          value={column.getFilterValue() as number[] | undefined}
          onChange={(val) => column.setFilterValue(val ?? undefined)}
          queryOptionsFn={columnMeta.relationConfig.queryOptionsFn}

          columns={columnMeta.relationConfig.columns}
          getLabel={columnMeta.relationConfig.getLabel}
          getId={columnMeta.relationConfig.getId}
          placeholder={columnMeta.label ?? column.id}
          variant="toolbar"
        />
      ) : null;
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/relation-picker.tsx src/components/data-table/data-table-toolbar.tsx
git commit -m "feat: add RelationPicker and wire relation filters in toolbar"
```

---

### Task 16: Create API layer changes

**Files:**
- Modify: `src/api/box.ts`
- Modify: `src/api/item.ts`
- Modify: `src/api/thing.ts`

- [ ] **Step 0: Add `ids` filter support to item and thing APIs**

In `src/api/item.ts`, update `fetchItemsFiltered` to support an `ids` filter param that builds an OData `id in (1,4,5)` clause:

```typescript
// Inside fetchItemsFiltered, after the existing name filter clause:
if (fieldFilters.ids && Array.isArray(fieldFilters.ids) && fieldFilters.ids.length > 0) {
  const idList = (fieldFilters.ids as number[]).join(",");
  filterClauses.push(`id in (${idList})`);
}
```

Apply the same change to `fetchThingsFiltered` in `src/api/thing.ts`.

- [ ] **Step 1: Add `buildDataTableParams`, `boxDiceQueryOptions`, and `createBox` to `src/api/box.ts`**

Add these functions alongside the existing code (do not modify existing functions):

```typescript
import type { SortByParams } from "@/types/api";
import type { ColumnFiltersState } from "@tanstack/react-table";

/**
 * Builds OData query params from data-table column filters and sorting.
 * Used by the box-dice page.
 */
function buildDataTableParams(params: {
  page: number;
  pageSize: number;
  columnFilters: ColumnFiltersState;
  sort?: string;
  columns: { id: string; meta?: { variant?: string; filterKey?: string; filterKeys?: [string, string] } }[];
}): URLSearchParams {
  const searchParams = new URLSearchParams();
  const { page, pageSize, columnFilters, sort, columns } = params;

  searchParams.set("$skip", String((page - 1) * pageSize));
  searchParams.set("$top", String(pageSize));

  // Build $filter
  const filterClauses: string[] = [];

  for (const filter of columnFilters) {
    const col = columns.find((c) => c.id === filter.id);
    const meta = col?.meta;
    if (!meta) continue;

    const value = filter.value;

    switch (meta.variant) {
      case "text":
        if (typeof value === "string" && value.length > 0) {
          filterClauses.push(
            `contains_ignoring_case(${filter.id}, '${value}')`,
          );
        }
        break;

      case "number":
        if (typeof value === "string" && value.length > 0) {
          filterClauses.push(`${filter.id} eq ${value}`);
        }
        break;

      case "range": {
        const [minVal, maxVal] = (value as [unknown, unknown]) ?? [];
        if (minVal !== undefined && minVal !== null)
          filterClauses.push(`${filter.id} ge ${minVal}`);
        if (maxVal !== undefined && maxVal !== null)
          filterClauses.push(`${filter.id} le ${maxVal}`);
        break;
      }

      case "dateRange": {
        const [fromVal, toVal] = (value as [unknown, unknown]) ?? [];
        if (fromVal)
          filterClauses.push(`${filter.id} ge '${fromVal}'`);
        if (toVal)
          filterClauses.push(`${filter.id} le '${toVal}'`);
        break;
      }

      case "date":
        if (value) {
          const d = new Date(value as number);
          if (!isNaN(d.getTime())) {
            filterClauses.push(`${filter.id} eq '${d.toISOString().slice(0, 10)}'`);
          }
        }
        break;

      case "select":
      case "multiSelect": {
        const vals = Array.isArray(value) ? value : [];
        if (vals.length === 1) {
          filterClauses.push(`${filter.id} eq '${vals[0]}'`);
        } else if (vals.length > 1) {
          const inClause = vals.map((v) => `'${v}'`).join(",");
          filterClauses.push(`${filter.id} in (${inClause})`);
        }
        break;
      }

      case "boolean": {
        const boolVals = Array.isArray(value) ? value : [];
        if (boolVals.length === 1) {
          filterClauses.push(`${filter.id} eq ${boolVals[0]}`);
        }
        break;
      }

      case "relation": {
        const relId = value as number | undefined;
        if (relId !== undefined) {
          filterClauses.push(`${filter.id}/id eq ${relId}`);
        }
        break;
      }

      case "multiRelation": {
        const relIds = value as number[] | undefined;
        if (relIds && relIds.length > 0) {
          const idList = relIds.join(",");
          filterClauses.push(
            `${filter.id}/any(x: x/id in (${idList}))`,
          );
        }
        break;
      }
    }
  }

  if (filterClauses.length > 0) {
    searchParams.set("$filter", filterClauses.join(" and "));
  }

  // Build $orderby from sort string
  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [field, dir] = part.split(".");
        return `${field} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }

  return searchParams;
}

export function boxDiceQueryOptions(params: {
  page: number;
  pageSize: number;
  columnFilters: ColumnFiltersState;
  sort?: string;
  columns: { id: string; meta?: { variant?: string; filterKey?: string; filterKeys?: [string, string] } }[];
}) {
  return {
    queryKey: ["boxes", "dice", params.page, params.pageSize, params.columnFilters, params.sort],
    queryFn: async (): Promise<ApiResponse<BoxDto>> => {
      const searchParams = buildDataTableParams(params);
      const res = await fetch(`/api/v1/box?${searchParams.toString()}`);
      return res.json();
    },
    placeholderData: keepPreviousData,
  };
}

export async function createBox(
  data: Partial<BoxDto>,
): Promise<BoxDto> {
  const res = await fetch("/api/v1/box", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

Note: Add the `keepPreviousData` import at the top of the file if not already imported:
```typescript
import { keepPreviousData } from "@tanstack/react-query";
```

Also add the `ColumnFiltersState` import:
```typescript
import type { ColumnFiltersState } from "@tanstack/react-table";
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/api/box.ts
git commit -m "feat: add boxDiceQueryOptions, createBox, and buildDataTableParams"
```

---

### Task 17: Create box-table-columns

**Files:**
- Create: `src/routes/box-dice/components/box-table-columns.tsx`

- [ ] **Step 1: Create `src/routes/box-dice/components/box-table-columns.tsx`**

Column definitions for BoxDto with meta for auto-generated filters. Includes row actions column.

```typescript
import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis } from "lucide-react";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoxDto, ItemDto, ThingDto } from "@/types/api";
import type { DataTableRowAction } from "@/types/data-table";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";

const itemColumns: ColumnDef<ItemDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const thingColumns: ColumnDef<ThingDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

interface GetBoxColumnsProps {
  setRowAction: React.Dispatch<
    React.SetStateAction<DataTableRowAction<BoxDto> | null>
  >;
}

export function getBoxColumns({
  setRowAction,
}: GetBoxColumnsProps): ColumnDef<BoxDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          className="translate-y-0.5"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          className="translate-y-0.5"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 40,
    },
    {
      id: "id",
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="ID" />
      ),
      enableSorting: true,
      enableHiding: false,
      size: 60,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Name" />
      ),
      meta: {
        label: "Name",
        placeholder: "Search names...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "objectCode",
      accessorKey: "objectCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Object Code" />
      ),
      meta: {
        label: "Object Code",
        placeholder: "Search codes...",
        variant: "text",
        filterKey: "objectCode",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 130,
    },
    {
      id: "shape",
      accessorKey: "shape",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Shape" />
      ),
      meta: {
        label: "Shape",
        variant: "select",
        options: [
          { label: "O", value: "O" },
          { label: "X", value: "X" },
        ],
        filterKey: "shape",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 80,
    },
    {
      id: "num",
      accessorKey: "num",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Num" />
      ),
      meta: {
        label: "Num",
        variant: "range",
        range: [0, 1000],
        filterKeys: ["numMin", "numMax"],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "item",
      accessorKey: "item",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Item" />
      ),
      cell: ({ cell }) => cell.getValue<ItemDto | null>()?.name ?? "—",
      meta: {
        label: "Item",
        variant: "relation",
        filterKey: "itemId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),

          columns: itemColumns,
          getLabel: (item: ItemDto) => item.name,
          getId: (item: ItemDto) => item.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 180,
    },
    {
      id: "things",
      accessorKey: "things",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Things" />
      ),
      cell: ({ cell }) => {
        const things = cell.getValue<ThingDto[] | null>();
        return things && things.length > 0
          ? things.map((t) => t.name).join(", ")
          : "—";
      },
      meta: {
        label: "Things",
        variant: "multiRelation",
        filterKey: "thingIds",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),

          columns: thingColumns,
          getLabel: (thing: ThingDto) => thing.name,
          getId: (thing: ThingDto) => thing.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 200,
    },
    {
      id: "oldItem",
      accessorKey: "oldItem",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Old Item" />
      ),
      cell: ({ cell }) => cell.getValue<ItemDto | null>()?.name ?? "—",
      meta: {
        label: "Old Item",
        variant: "relation",
        filterKey: "oldItemId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),

          columns: itemColumns,
          getLabel: (item: ItemDto) => item.name,
          getId: (item: ItemDto) => item.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 180,
    },
    {
      id: "oldThings",
      accessorKey: "oldThings",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Old Things" />
      ),
      cell: ({ cell }) => {
        const oldThings = cell.getValue<ThingDto[] | null>();
        return oldThings && oldThings.length > 0
          ? oldThings.map((t) => t.name).join(", ")
          : "—";
      },
      meta: {
        label: "Old Things",
        variant: "multiRelation",
        filterKey: "oldThingIds",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),

          columns: thingColumns,
          getLabel: (thing: ThingDto) => thing.name,
          getId: (thing: ThingDto) => thing.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 200,
    },
    {
      id: "dateStr",
      accessorKey: "dateStr",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Date" />
      ),
      meta: {
        label: "Date",
        variant: "dateRange",
        filterKeys: ["dateStrFrom", "dateStrTo"],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },
    {
      id: "checkbox",
      accessorKey: "checkbox",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Checkbox" />
      ),
      cell: ({ cell }) => (cell.getValue<boolean>() ? "Yes" : "No"),
      meta: {
        label: "Checkbox",
        variant: "boolean",
        filterKey: "checkbox",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 90,
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Tags" />
      ),
      cell: ({ cell }) => {
        const tags = cell.getValue<string[]>();
        return tags && tags.length > 0 ? tags.join(", ") : "—";
      },
      meta: {
        label: "Tags",
        placeholder: "Search tags...",
        variant: "text",
        filterKey: "tags",
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 200,
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0"
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={() => setRowAction({ row, variant: "update" })}
              >
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 40,
    },
  ];
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/box-dice/components/box-table-columns.tsx
git commit -m "feat: add BoxDto column definitions with filter meta"
```

---

### Task 18: Create BoxSheet component

**Files:**
- Create: `src/routes/box-dice/components/box-sheet.tsx`

- [ ] **Step 1: Create `src/routes/box-dice/components/box-sheet.tsx`**

Sheet for adding/editing boxes. Uses react-hook-form + zod. Relation fields use RelationPicker.

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RelationPicker } from "@/components/relation-picker";
import { patchBox, createBox } from "@/api/box";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, ItemDto, ThingDto } from "@/types/api";
import type { ColumnDef } from "@tanstack/react-table";

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
});

type BoxFormValues = z.infer<typeof boxFormSchema>;

const itemColumns: ColumnDef<ItemDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const thingColumns: ColumnDef<ThingDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

interface BoxSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  box: BoxDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function BoxSheet({ box, variant, onSuccess, ...props }: BoxSheetProps) {
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<BoxFormValues>({
    resolver: zodResolver(boxFormSchema),
    defaultValues: {
      name: box?.name ?? "",
      objectCode: box?.objectCode ?? null,
      shape: box?.shape ?? "O",
      num: box?.num ?? 0,
      dateStr: box?.dateStr ?? "",
      checkbox: box?.checkbox ?? false,
      itemId: box?.item?.id ?? null,
      thingIds: box?.things?.map((t) => t.id) ?? [],
      oldItemId: box?.oldItem?.id ?? null,
      oldThingIds: box?.oldThings?.map((t) => t.id) ?? [],
    },
  });

  // Reset form when box changes
  React.useEffect(() => {
    form.reset({
      name: box?.name ?? "",
      objectCode: box?.objectCode ?? null,
      shape: box?.shape ?? "O",
      num: box?.num ?? 0,
      dateStr: box?.dateStr ?? "",
      checkbox: box?.checkbox ?? false,
      itemId: box?.item?.id ?? null,
      thingIds: box?.things?.map((t) => t.id) ?? [],
      oldItemId: box?.oldItem?.id ?? null,
      oldThingIds: box?.oldThings?.map((t) => t.id) ?? [],
    });
  }, [box, form]);

  function onSubmit(data: BoxFormValues) {
    startTransition(async () => {
      try {
        if (variant === "update" && box) {
          await patchBox(box.id, data);
          toast.success("Box updated");
        } else {
          await createBox(data);
          toast.success("Box created");
        }
        onSuccess();
        props.onOpenChange?.(false);
      } catch {
        toast.error("Failed to save box");
      }
    });
  }

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>{variant === "update" ? "Edit Box" : "Add Box"}</SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the box details and save changes."
              : "Fill in the details to create a new box."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Object Code */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="objectCode">Object Code</Label>
            <Input id="objectCode" {...form.register("objectCode")} />
          </div>

          {/* Shape */}
          <div className="flex flex-col gap-2">
            <Label>Shape</Label>
            <Controller
              control={form.control}
              name="shape"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="O">O</SelectItem>
                    <SelectItem value="X">X</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Num */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="num">Num</Label>
            <Input
              id="num"
              type="number"
              {...form.register("num", { valueAsNumber: true })}
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dateStr">Date</Label>
            <Input id="dateStr" {...form.register("dateStr")} />
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="checkbox"
              render={({ field }) => (
                <Checkbox
                  id="checkbox"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="checkbox">Checkbox</Label>
          </div>

          {/* Item (relation) */}
          <div className="flex flex-col gap-2">
            <Label>Item</Label>
            <Controller
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <RelationPicker<ItemDto>
                  multi={false}
                  value={field.value ?? undefined}
                  onChange={(val) => field.onChange(val ?? null)}
                  queryOptionsFn={(filters) => itemsFilteredQueryOptions(filters)}

                  columns={itemColumns}
                  getLabel={(item) => item.name}
                  getId={(item) => item.id}
                  placeholder="Select item..."
                  variant="field"
                />
              )}
            />
          </div>

          {/* Things (multiRelation) */}
          <div className="flex flex-col gap-2">
            <Label>Things</Label>
            <Controller
              control={form.control}
              name="thingIds"
              render={({ field }) => (
                <RelationPicker<ThingDto>
                  multi={true}
                  value={field.value.length > 0 ? field.value : undefined}
                  onChange={(val) =>
                    field.onChange(
                      Array.isArray(val) ? val : val !== undefined ? [val] : [],
                    )
                  }
                  queryOptionsFn={(filters) =>
                    thingsFilteredQueryOptions(filters)
                  }

                  columns={thingColumns}
                  getLabel={(thing) => thing.name}
                  getId={(thing) => thing.id}
                  placeholder="Select things..."
                  variant="field"
                />
              )}
            />
          </div>

          {/* Old Item (relation) */}
          <div className="flex flex-col gap-2">
            <Label>Old Item</Label>
            <Controller
              control={form.control}
              name="oldItemId"
              render={({ field }) => (
                <RelationPicker<ItemDto>
                  multi={false}
                  value={field.value ?? undefined}
                  onChange={(val) => field.onChange(val ?? null)}
                  queryOptionsFn={(filters) => itemsFilteredQueryOptions(filters)}

                  columns={itemColumns}
                  getLabel={(item) => item.name}
                  getId={(item) => item.id}
                  placeholder="Select old item..."
                  variant="field"
                />
              )}
            />
          </div>

          {/* Old Things (multiRelation) */}
          <div className="flex flex-col gap-2">
            <Label>Old Things</Label>
            <Controller
              control={form.control}
              name="oldThingIds"
              render={({ field }) => (
                <RelationPicker<ThingDto>
                  multi={true}
                  value={field.value.length > 0 ? field.value : undefined}
                  onChange={(val) =>
                    field.onChange(
                      Array.isArray(val) ? val : val !== undefined ? [val] : [],
                    )
                  }
                  queryOptionsFn={(filters) =>
                    thingsFilteredQueryOptions(filters)
                  }

                  columns={thingColumns}
                  getLabel={(thing) => thing.name}
                  getId={(thing) => thing.id}
                  placeholder="Select old things..."
                  variant="field"
                />
              )}
            />
          </div>

          <SheetFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              )}
              {variant === "update" ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/box-dice/components/box-sheet.tsx
git commit -m "feat: add BoxSheet component for add/edit with relation pickers"
```

---

### Task 19: Create box-dice page

**Files:**
- Create: `src/routes/box-dice/index.tsx`

- [ ] **Step 1: Create `src/routes/box-dice/index.tsx`**

The page component wires everything together: route definition, data fetching, useDataTable hook, toolbar, sheet.

```typescript
import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { boxDiceQueryOptions } from "@/api/box";
import { getBoxColumns } from "./components/box-table-columns";
import { BoxSheet } from "./components/box-sheet";
import { Button } from "@/components/ui/button";
import type { BoxDto } from "@/types/api";
import type { DataTableRowAction } from "@/types/data-table";

function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(",").map(Number).filter((n) => !isNaN(n));
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(Number).filter((n) => !isNaN(n));
  }
  return undefined;
}

interface BoxDiceSearchParams {
  page: number;
  pageSize: number;
  sort: string | undefined;
  name: string | undefined;
  objectCode: string | undefined;
  shape: string[] | undefined;
  numMin: number | undefined;
  numMax: number | undefined;
  checkbox: boolean | undefined;
  dateStrFrom: string | undefined;
  dateStrTo: string | undefined;
  tags: string | undefined;
  itemId: number | undefined;
  thingIds: number[] | undefined;
  oldItemId: number | undefined;
  oldThingIds: number[] | undefined;
}

function validateSearch(search: Record<string, unknown>): BoxDiceSearchParams {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : 20,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode: typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape: Array.isArray(search.shape)
      ? (search.shape as string[])
      : typeof search.shape === "string"
        ? search.shape.split(",")
        : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox: typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom: typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo: typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId: typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
  };
}

export const Route = createFileRoute("/box-dice/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    // We need column meta info to build the query.
    // For the loader, we build a simpler query using the search params directly.
    const { page, pageSize, sort, ...filterParams } = deps;
    const columns = getBoxColumns({ setRowAction: () => {} });
    return context.queryClient.ensureQueryData(
      boxDiceQueryOptions({
        page: page ?? 1,
        pageSize: pageSize ?? 20,
        sort,
        columnFilters: deriveColumnFiltersFromSearch(filterParams, columns),
        columns: columns.map((c) => ({
          id: (c as { id?: string }).id ?? (c as { accessorKey?: string }).accessorKey ?? "",
          meta: c.meta as any,
        })),
      }),
    );
  },
  component: BoxDicePage,
});

/**
 * Derive column filters from search params for the loader.
 * Mirrors the logic in useDataTable hook.
 */
function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
  columns: { id?: string; accessorKey?: string; meta?: any }[],
) {
  const filters: { id: string; value: unknown }[] = [];
  for (const col of columns) {
    const meta = col.meta;
    if (!meta?.variant) continue;
    const colId = col.id ?? col.accessorKey;
    if (!colId) continue;

    if (meta.filterKeys) {
      const [key1, key2] = meta.filterKeys;
      const v1 = search[key1];
      const v2 = search[key2];
      if (v1 !== undefined || v2 !== undefined) {
        filters.push({ id: colId, value: [v1, v2] });
      }
    } else if (meta.filterKey) {
      const value = search[meta.filterKey];
      if (value !== undefined && value !== null) {
        if (meta.variant === "multiSelect" || meta.variant === "multiRelation") {
          filters.push({ id: colId, value: Array.isArray(value) ? value : [value] });
        } else if (meta.variant === "boolean") {
          filters.push({ id: colId, value: typeof value === "boolean" ? [String(value)] : [value] });
        } else {
          filters.push({ id: colId, value });
        }
      }
    }
  }
  return filters;
}

function BoxDicePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/box-dice/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] =
    useState<DataTableRowAction<BoxDto> | null>(null);

  const columns = useMemo(() => getBoxColumns({ setRowAction }), []);

  // Build query options using current search params
  const queryOptions = useMemo(() => {
    const { page, pageSize, sort, ...filterParams } = search;
    return boxDiceQueryOptions({
      page: page ?? 1,
      pageSize: pageSize ?? 20,
      sort,
      columnFilters: deriveColumnFiltersFromSearch(filterParams, columns as any),
      columns: columns.map((c) => ({
        id: (c as any).id ?? (c as any).accessorKey ?? "",
        meta: c.meta as any,
      })),
    });
  }, [search, columns]);

  const { data } = useSuspenseQuery(queryOptions);

  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = useCallback(
    (updates: Partial<BoxDiceSearchParams>) => {
      navigate({
        search: (prev: BoxDiceSearchParams) => {
          const next = { ...prev, ...updates };
          // Clean undefined values
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned as BoxDiceSearchParams;
        },
      });
    },
    [navigate],
  );

  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount,
    search: search as Record<string, unknown>,
    onNavigate: onNavigate as (updates: Partial<Record<string, unknown>>) => void,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["boxes"] });
    setRowAction(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boxes (Dice)</h1>
          <p className="mt-2 text-muted-foreground">{data.count} boxes</p>
        </div>
      </div>

      <DataTable table={table}>
        <DataTableToolbar table={table}>
          <Button
            size="sm"
            onClick={() =>
              setRowAction({ row: null as any, variant: "create" })
            }
          >
            <Plus className="mr-1 size-4" />
            Add Box
          </Button>
        </DataTableToolbar>
      </DataTable>

      {/* Edit/Add Sheet */}
      <BoxSheet
        open={rowAction !== null}
        onOpenChange={(open) => {
          if (!open) setRowAction(null);
        }}
        box={
          rowAction?.variant === "update" ? rowAction.row.original : null
        }
        variant={rowAction?.variant === "create" ? "create" : "update"}
        onSuccess={handleSheetSuccess}
      />
    </div>
  );
}
```

- [ ] **Step 2: Regenerate route tree**

```bash
cd F:/programming/react/cometa-frontend && npx tsr generate
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues:
- Route type generation may need `npm run dev` briefly to trigger file watcher
- Column type mismatches — verify `getBoxColumns` return type matches ColumnDef expectations

- [ ] **Step 4: Commit**

```bash
git add src/routes/box-dice/ src/routeTree.gen.ts
git commit -m "feat: add box-dice page with data-table, toolbar, and sheet"
```

---

### Task 20: Add box-dice to sidebar navigation

**Files:**
- Modify: `src/routes/__root.tsx` (or wherever sidebar navigation items are defined)

- [ ] **Step 1: Find and update sidebar navigation**

Check `src/routes/__root.tsx` and `src/components/` for where nav items are defined. Add a "Boxes (Dice)" link pointing to `/box-dice/`.

Look for the existing "Boxes" link and add the new one nearby:

```typescript
{ label: "Boxes (Dice)", href: "/box-dice/" }
```

The exact format depends on how the sidebar is implemented (likely in `AppSidebar` component).

- [ ] **Step 2: Verify**

```bash
npm run dev
```

Open `http://localhost:5173/box-dice/` and verify:
- Page loads with table
- Toolbar shows filters auto-generated from column meta
- Column header sort/hide dropdown works
- Pagination works
- Column visibility toggle works
- Relation filter opens modal
- Add/Edit sheet works
- URL updates on filter/sort/page changes

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add box-dice to sidebar navigation"
```

---

## Post-Implementation Notes

### Known areas that may need adjustment during implementation:

1. **@base-ui data attributes**: The DropdownMenu trigger's `data-[state=open]:bg-accent` class may need to change to match @base-ui's data attribute naming. Check the generated dropdown-menu component.

2. **Separator vertical styling**: If `<Separator orientation="vertical" className="h-4" />` doesn't render correctly, check the Separator component's data attribute behavior and adjust the className.

3. **Command component**: If `npx shadcn@latest add command` installs a Radix-based Command that conflicts with @base-ui, you may need to install `cmdk` directly and create a minimal wrapper.

4. **Zod v4 + @hookform/resolvers**: If `zodResolver` doesn't work with zod v4, try importing from `zod/v3` compatibility layer or use `@hookform/resolvers/zod/v4` if available.

5. **DateFilter column filter value format**: The date filter stores timestamps as column filter values. The `buildDataTableParams` function needs to convert these to the format your backend expects (likely `yyyy-MM-dd` strings).

6. **Select filter value format**: The FacetedFilter stores values as string arrays `["O"]`. The `buildDataTableParams` must handle single-element arrays correctly for `eq` vs multi-element for `in`.
