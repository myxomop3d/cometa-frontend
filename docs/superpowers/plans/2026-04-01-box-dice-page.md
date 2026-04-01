# Box Dice Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new `/box-dice/` page with a data grid showing BoxDto, built by cherry-picking tablecn components with server-side filtering, multi-column sorting, pagination, editable cells, column pinning/hiding, and row creation.

**Architecture:** Trimmed fork of tablecn data grid components adapted for server-side operations. The tablecn `useDataGrid` hook (3200+ lines) is replaced by a focused `useServerDataGrid` hook wired to TanStack Query + URL-synced filters. Cell variants are cherry-picked and adapted; relation cells are new.

**Tech Stack:** React, TypeScript, TanStack Router/Query/Table/Virtual, Zod, shadcn/ui, Tailwind CSS v4

**Reference:** `F:\programming\tablecn` (tablecn source to cherry-pick from)

---

## File Structure

### New files to create

| File | Responsibility |
|---|---|
| `src/types/data-grid.ts` | CellOpts, CellPosition, DataGridCellProps, module augmentation for ColumnMeta/TableMeta |
| `src/lib/data-grid.ts` | Utility functions: flexRender, getCellKey, getColumnPinningStyle, getColumnBorderVisibility, scrollCellIntoView, parseLocalDate, formatDateToString, formatDateForDisplay, getIsInPopover, getColumnVariant |
| `src/hooks/use-as-ref.ts` | useAsRef hook (keeps latest value in ref) |
| `src/hooks/use-lazy-ref.ts` | useLazyRef hook (lazy-initialized ref) |
| `src/hooks/use-debounced-callback.ts` | useDebouncedCallback hook |
| `src/lib/compose-refs.ts` | useComposedRefs hook (merge multiple refs) |
| `src/hooks/useServerDataGrid.ts` | Main hook: TanStack Table + Virtual + cell focus/edit state + keyboard nav |
| `src/components/data-grid/data-grid.tsx` | Grid shell: virtual scrolling body, header, layout |
| `src/components/data-grid/data-grid-row.tsx` | Row rendering with memoization |
| `src/components/data-grid/data-grid-cell.tsx` | Cell variant dispatcher |
| `src/components/data-grid/data-grid-cell-wrapper.tsx` | Cell click/focus/edit trigger handling |
| `src/components/data-grid/data-grid-cell-variants.tsx` | Cell editors: ShortText, Number, Select, MultiSelect, Checkbox, Date |
| `src/components/data-grid/data-grid-column-header.tsx` | Sortable headers with pin/hide controls |
| `src/components/data-grid/data-grid-view-menu.tsx` | Column visibility toggle popover |
| `src/components/data-grid/data-grid-pagination.tsx` | Previous/Next + page indicator |
| `src/components/data-grid/data-grid-relation-cell.tsx` | RelationSingleCell and RelationMultiCell (popover with server-side search) |
| `src/routes/box-dice/index.tsx` | Route: validateSearch, loader, BoxDicePage component with column defs |

### Files to modify

| File | Change |
|---|---|
| `src/types/api.ts` | Add `SortByParams`, `CreateBoxDto`, extend `BoxFilters` with `Partial<SortByParams>` |
| `src/api/box.ts` | Add `$orderby` support in `buildListParams`, add `createBox` function |
| `src/components/app-sidebar.tsx` | Add "Box Dice" nav entry |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install npm packages**

```bash
npm install @tanstack/react-virtual react-hook-form @hookform/resolvers
```

- [ ] **Step 2: Add shadcn components**

```bash
npx shadcn@latest add command
npx shadcn@latest add form
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/command.tsx src/components/ui/form.tsx
git commit -m "feat(box-dice): install dependencies for data grid"
```

---

## Task 2: API Layer — Types & Functions

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/api/box.ts`

- [ ] **Step 1: Add SortByParams and CreateBoxDto to types**

In `src/types/api.ts`, add after the `PaginationParams` interface:

```typescript
export interface SortByParams {
  sortBy?: string; // e.g. "name:asc,num:desc"
}
```

Add after the `BoxFilters` interface:

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

- [ ] **Step 2: Extend BoxFilters with SortByParams**

Change the `BoxFilters` interface declaration from:

```typescript
export interface BoxFilters extends Partial<PaginationParams> {
```

to:

```typescript
export interface BoxFilters extends Partial<PaginationParams>, Partial<SortByParams> {
```

- [ ] **Step 3: Add $orderby support to buildListParams in `src/api/box.ts`**

In `buildListParams`, after the existing `$top` param line, add:

```typescript
if (rest.sortBy) {
  // Parse "name:asc,num:desc" into OData format "name asc,num desc"
  const orderby = rest.sortBy
    .split(",")
    .map((s) => s.trim().replace(":", " "))
    .join(",");
  params.set("$orderby", orderby);
}
```

Note: Destructure `sortBy` from `rest` alongside the existing fields. Update the destructuring:

```typescript
const { page = 1, pageSize = 20, sortBy, ...rest } = filters;
```

Then add the `$orderby` block using `sortBy` directly:

```typescript
if (sortBy) {
  const orderby = sortBy
    .split(",")
    .map((s) => s.trim().replace(":", " "))
    .join(",");
  params.set("$orderby", orderby);
}
```

- [ ] **Step 4: Add createBox function to `src/api/box.ts`**

Add at the end of the file, before the query options:

```typescript
export async function createBox(
  data: CreateBoxDto,
): Promise<ApiResponse<BoxDto>> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create box: ${response.status}`);
  }
  return response.json();
}
```

Update the import at the top of `src/api/box.ts`:

```typescript
import type { ApiResponse, BoxDto, BoxFilters, CreateBoxDto } from "@/types/api";
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/types/api.ts src/api/box.ts
git commit -m "feat(box-dice): add SortByParams, CreateBoxDto, $orderby support, createBox API"
```

---

## Task 3: Utility Hooks (cherry-pick from tablecn)

**Files:**
- Create: `src/hooks/use-as-ref.ts`
- Create: `src/hooks/use-lazy-ref.ts`
- Create: `src/hooks/use-debounced-callback.ts`
- Create: `src/lib/compose-refs.ts`

These are small utility hooks used by the data grid components. Copy from tablecn and strip the `"use client"` directive (not needed in Vite).

- [ ] **Step 1: Create use-as-ref.ts**

```typescript
// src/hooks/use-as-ref.ts
import { useRef } from "react";

/**
 * Keeps a ref that always points to the latest value.
 * Useful for accessing current values in callbacks without re-creating them.
 */
export function useAsRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
```

- [ ] **Step 2: Create use-lazy-ref.ts**

```typescript
// src/hooks/use-lazy-ref.ts
import { useRef } from "react";

const UNSET = Symbol("UNSET");

/**
 * Like useRef, but accepts an initializer function that runs only once.
 */
export function useLazyRef<T>(init: () => T) {
  const ref = useRef<T | typeof UNSET>(UNSET);
  if (ref.current === UNSET) {
    ref.current = init();
  }
  return ref as React.RefObject<T>;
}
```

- [ ] **Step 3: Create use-debounced-callback.ts**

```typescript
// src/hooks/use-debounced-callback.ts
import { useCallback, useRef } from "react";

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  ) as T;
}
```

- [ ] **Step 4: Create compose-refs.ts**

```typescript
// src/lib/compose-refs.ts
import { useCallback } from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

export function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((node: T) => {
    for (const ref of refs) {
      setRef(ref, node);
    }
  }, refs);
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-as-ref.ts src/hooks/use-lazy-ref.ts src/hooks/use-debounced-callback.ts src/lib/compose-refs.ts
git commit -m "feat(box-dice): add utility hooks (useAsRef, useLazyRef, useDebouncedCallback, useComposedRefs)"
```

---

## Task 4: Data Grid Types & Utils (cherry-pick from tablecn)

**Files:**
- Create: `src/types/data-grid.ts`
- Create: `src/lib/data-grid.ts`

- [ ] **Step 1: Create data-grid types**

Copy from `F:\programming\tablecn\src\types\data-grid.ts` and strip:
- `RowHeightValue` type (we use fixed "short" height)
- `CellSelectOption.icon` and `CellSelectOption.count` (unnecessary)
- `url` and `file` from `CellOpts` union
- `SelectionState`, `CellRange`, `ContextMenuState`, `PasteDialogState` types
- `SearchState` interface
- `FileCellData` interface
- All filter operator types (`TextFilterOperator`, etc.) and `FilterValue` — our filters are server-side
- From `TableMeta`: remove `selectionState`, `searchOpen`, `getIsCellSelected`, `getIsSearchMatch`, `getIsActiveSearchMatch`, `getVisualRowIndex`, `rowHeight`, `onRowHeightChange`, `onCellMouseDown`, `onCellMouseEnter`, `onCellMouseUp`, `onCellContextMenu`, `onCellsCopy`, `onCellsCut`, `onCellsPaste`, `onSelectionClear`, `onFilesUpload`, `onFilesDelete`, `contextMenu`, `onContextMenuOpenChange`, `pasteDialog`, `onPasteDialogOpenChange`

Add new `relation-single` and `relation-multi` variants to `CellOpts`:

```typescript
// src/types/data-grid.ts
import type { Cell, RowData, TableMeta } from "@tanstack/react-table";

export interface CellSelectOption {
  label: string;
  value: string;
}

export type CellOpts =
  | { variant: "short-text" }
  | { variant: "number"; min?: number; max?: number; step?: number }
  | { variant: "select"; options: CellSelectOption[] }
  | { variant: "multi-select"; options: CellSelectOption[] }
  | { variant: "checkbox" }
  | { variant: "date" }
  | {
      variant: "relation-single";
      queryOptions: (filters: Record<string, unknown>) => unknown;
      displayField: string;
      idField?: string;
    }
  | {
      variant: "relation-multi";
      queryOptions: (filters: Record<string, unknown>) => unknown;
      displayField: string;
      idField?: string;
    };

export interface CellUpdate {
  rowIndex: number;
  columnId: string;
  value: unknown;
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    cell?: CellOpts;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    dataGridRef?: React.RefObject<HTMLElement | null>;
    cellMapRef?: React.RefObject<Map<string, HTMLDivElement>>;
    focusedCell?: CellPosition | null;
    editingCell?: CellPosition | null;
    onRowSelect?: (rowId: string, checked: boolean, shiftKey: boolean) => void;
    onDataUpdate?: (params: CellUpdate | Array<CellUpdate>) => void;
    onRowsDelete?: (rowIndices: number[]) => void | Promise<void>;
    onColumnClick?: (columnId: string) => void;
    onCellClick?: (
      rowIndex: number,
      columnId: string,
      event?: React.MouseEvent,
    ) => void;
    onCellDoubleClick?: (rowIndex: number, columnId: string) => void;
    onCellEditingStart?: (rowIndex: number, columnId: string) => void;
    onCellEditingStop?: (opts?: {
      direction?: NavigationDirection;
      moveToNextRow?: boolean;
    }) => void;
    readOnly?: boolean;
  }
}

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export type NavigationDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end";

export interface DataGridCellProps<TData> {
  cell: Cell<TData, unknown>;
  tableMeta: TableMeta<TData>;
  rowIndex: number;
  columnId: string;
  isEditing: boolean;
  isFocused: boolean;
  readOnly: boolean;
}
```

- [ ] **Step 2: Create data-grid utils**

Copy from `F:\programming\tablecn\src\lib\data-grid.ts` and keep only:
- `flexRender`
- `getCellKey`
- `getColumnBorderVisibility`
- `getColumnPinningStyle`
- `scrollCellIntoView`
- `parseLocalDate`
- `formatDateToString`
- `formatDateForDisplay`
- `getIsInPopover`
- `getColumnVariant` (update to include `relation-single` and `relation-multi`)

Strip: `parseTsv`, `matchSelectOption`, `getRowHeightValue`, `getLineCount`, `getEmptyCellValue`, `getUrlHref`, `formatFileSize`, `getFileIcon`, `getIsFileCellData`, `parseCellKey`, `getScrollDirection`, all file-related functions.

```typescript
// src/lib/data-grid.ts
import type { Column } from "@tanstack/react-table";
import {
  BaselineIcon,
  CalendarIcon,
  CheckSquareIcon,
  HashIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
} from "lucide-react";
import type { CellOpts, CellPosition } from "@/types/data-grid";

export function flexRender<TProps extends object>(
  Comp: ((props: TProps) => React.ReactNode) | string | undefined,
  props: TProps,
): React.ReactNode {
  if (typeof Comp === "string") {
    return Comp;
  }
  return Comp?.(props);
}

export function getCellKey(rowIndex: number, columnId: string) {
  return `${rowIndex}:${columnId}`;
}

export function getColumnBorderVisibility<TData>(params: {
  column: Column<TData>;
  nextColumn?: Column<TData>;
  isLastColumn: boolean;
}): {
  showEndBorder: boolean;
  showStartBorder: boolean;
} {
  const { column, nextColumn, isLastColumn } = params;

  const isPinned = column.getIsPinned();
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");
  const isLastRightPinnedColumn =
    isPinned === "right" && column.getIsLastColumn("right");

  const nextIsPinned = nextColumn?.getIsPinned();
  const isBeforeRightPinned =
    nextIsPinned === "right" && nextColumn?.getIsFirstColumn("right");

  const showEndBorder =
    !isBeforeRightPinned && (isLastColumn || !isLastRightPinnedColumn);

  const showStartBorder = isFirstRightPinnedColumn;

  return { showEndBorder, showStartBorder };
}

export function getColumnPinningStyle<TData>(params: {
  column: Column<TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const { column, withBorder = false } = params;

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

export function scrollCellIntoView<TData>(params: {
  container: HTMLDivElement;
  targetCell: HTMLDivElement;
  tableRef: React.RefObject<import("@tanstack/react-table").Table<TData> | null>;
  viewportOffset: number;
}): void {
  const { container, targetCell, tableRef, viewportOffset } = params;

  const containerRect = container.getBoundingClientRect();
  const cellRect = targetCell.getBoundingClientRect();

  const currentTable = tableRef.current;
  const leftPinnedColumns = currentTable?.getLeftVisibleLeafColumns() ?? [];
  const rightPinnedColumns = currentTable?.getRightVisibleLeafColumns() ?? [];

  const leftPinnedWidth = leftPinnedColumns.reduce(
    (sum, c) => sum + c.getSize(),
    0,
  );
  const rightPinnedWidth = rightPinnedColumns.reduce(
    (sum, c) => sum + c.getSize(),
    0,
  );

  const viewportLeft = containerRect.left + leftPinnedWidth + viewportOffset;
  const viewportRight = containerRect.right - rightPinnedWidth - viewportOffset;

  const isFullyVisible =
    cellRect.left >= viewportLeft && cellRect.right <= viewportRight;

  if (isFullyVisible) return;

  if (cellRect.right > viewportRight) {
    container.scrollLeft += cellRect.right - viewportRight;
  } else if (cellRect.left < viewportLeft) {
    container.scrollLeft -= viewportLeft - cellRect.left;
  }
}

export function getIsInPopover(element: unknown): boolean {
  if (!(element instanceof Element)) return false;
  return (
    element.closest("[data-grid-cell-editor]") !== null ||
    element.closest("[data-grid-popover]") !== null ||
    element.closest("[data-slot='dropdown-menu-content']") !== null ||
    element.closest("[data-slot='popover-content']") !== null
  );
}

export function parseLocalDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== "string") return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(dateStr: unknown): string {
  if (!dateStr) return "";
  const date = parseLocalDate(dateStr);
  if (!date) return typeof dateStr === "string" ? dateStr : "";
  return date.toLocaleDateString();
}

export function getColumnVariant(variant?: CellOpts["variant"]): {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
} | null {
  switch (variant) {
    case "short-text":
      return { label: "Short text", icon: BaselineIcon };
    case "number":
      return { label: "Number", icon: HashIcon };
    case "checkbox":
      return { label: "Checkbox", icon: CheckSquareIcon };
    case "select":
      return { label: "Select", icon: ListIcon };
    case "multi-select":
      return { label: "Multi-select", icon: ListChecksIcon };
    case "date":
      return { label: "Date", icon: CalendarIcon };
    case "relation-single":
      return { label: "Relation", icon: LinkIcon };
    case "relation-multi":
      return { label: "Relations", icon: LinkIcon };
    default:
      return null;
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/types/data-grid.ts src/lib/data-grid.ts
git commit -m "feat(box-dice): add data grid types and utility functions"
```

---

## Task 5: useServerDataGrid Hook

**Files:**
- Create: `src/hooks/useServerDataGrid.ts`

This hook replaces tablecn's 3200-line `useDataGrid`. It manages:
- TanStack Table instance with column sizing, pinning, visibility, sorting
- TanStack Virtual for row virtualization
- Cell focus and edit state
- Keyboard navigation (arrow keys, Tab, Enter, Escape, F2)
- Click-outside detection to stop editing
- Column size CSS variables for performant resizing

- [ ] **Step 1: Create useServerDataGrid hook**

```typescript
// src/hooks/useServerDataGrid.ts
import {
  type ColumnDef,
  type ColumnPinningState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import {
  getCellKey,
  getIsInPopover,
  scrollCellIntoView,
} from "@/lib/data-grid";
import type {
  CellPosition,
  CellUpdate,
  NavigationDirection,
} from "@/types/data-grid";

const ROW_HEIGHT = 36;
const OVERSCAN = 6;
const VIEWPORT_OFFSET = 1;

interface UseServerDataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  totalCount: number;
  onDataUpdate?: (params: CellUpdate | CellUpdate[]) => void;
  readOnly?: boolean;
}

export function useServerDataGrid<TData>({
  data,
  columns,
  totalCount,
  onDataUpdate,
  readOnly = false,
}: UseServerDataGridProps<TData>) {
  // Refs
  const dataGridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cellMapRef = useLazyRef(() => new Map<string, HTMLDivElement>());
  const tableRef = useRef<ReturnType<typeof useReactTable<TData>> | null>(null);

  // State
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: [],
    right: [],
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);

  // Refs for latest values in callbacks
  const focusedCellRef = useAsRef(focusedCell);
  const editingCellRef = useAsRef(editingCell);
  const onDataUpdateRef = useAsRef(onDataUpdate);

  // Table instance
  const table = useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    state: {
      columnVisibility,
      columnPinning,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    enableMultiRowSelection: true,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
  });

  tableRef.current = table;

  // Virtualizer
  const rows = table.getRowModel().rows;
  const parentRef = dataGridRef;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  // Column size CSS vars for performant resizing
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const vars: Record<string, number> = {};
    for (const header of headers) {
      vars[`--header-${header.id}-size`] = header.getSize();
      vars[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return vars;
  }, [
    table.getState().columnSizingInfo,
    table.getState().columnSizing,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table,
  ]);

  // Cell event handlers
  const onCellClick = useCallback(
    (rowIndex: number, columnId: string, event?: React.MouseEvent) => {
      if (readOnly) {
        setFocusedCell({ rowIndex, columnId });
        return;
      }
      setFocusedCell({ rowIndex, columnId });
      setEditingCell(null);
    },
    [readOnly],
  );

  const onCellDoubleClick = useCallback(
    (rowIndex: number, columnId: string) => {
      if (readOnly) return;
      setFocusedCell({ rowIndex, columnId });
      setEditingCell({ rowIndex, columnId });
    },
    [readOnly],
  );

  const onCellEditingStart = useCallback(
    (rowIndex: number, columnId: string) => {
      if (readOnly) return;
      setEditingCell({ rowIndex, columnId });
    },
    [readOnly],
  );

  const onCellEditingStop = useCallback(
    (opts?: { direction?: NavigationDirection; moveToNextRow?: boolean }) => {
      const current = focusedCellRef.current;
      setEditingCell(null);

      if (!opts || !current) return;

      const visibleColumns = table.getVisibleLeafColumns();
      const currentColIndex = visibleColumns.findIndex(
        (c) => c.id === current.columnId,
      );

      let nextRowIndex = current.rowIndex;
      let nextColIndex = currentColIndex;

      if (opts.moveToNextRow) {
        nextRowIndex = Math.min(current.rowIndex + 1, rows.length - 1);
      } else if (opts.direction === "left") {
        nextColIndex = Math.max(0, currentColIndex - 1);
      } else if (opts.direction === "right") {
        nextColIndex = Math.min(visibleColumns.length - 1, currentColIndex + 1);
      } else if (opts.direction === "up") {
        nextRowIndex = Math.max(0, current.rowIndex - 1);
      } else if (opts.direction === "down") {
        nextRowIndex = Math.min(rows.length - 1, current.rowIndex + 1);
      }

      const nextCol = visibleColumns[nextColIndex];
      if (nextCol) {
        setFocusedCell({ rowIndex: nextRowIndex, columnId: nextCol.id });
      }
    },
    [focusedCellRef, table, rows.length],
  );

  const handleDataUpdate = useCallback(
    (params: CellUpdate | CellUpdate[]) => {
      onDataUpdateRef.current?.(params);
    },
    [onDataUpdateRef],
  );

  // Keyboard navigation on the grid container
  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const focused = focusedCellRef.current;
      const editing = editingCellRef.current;

      // Don't handle navigation while editing (cell handles its own keys)
      if (editing) return;
      if (!focused) return;

      const visibleColumns = table.getVisibleLeafColumns();
      const colIndex = visibleColumns.findIndex(
        (c) => c.id === focused.columnId,
      );

      let nextRow = focused.rowIndex;
      let nextCol = colIndex;
      let handled = false;

      switch (event.key) {
        case "ArrowUp":
          nextRow = Math.max(0, focused.rowIndex - 1);
          handled = true;
          break;
        case "ArrowDown":
          nextRow = Math.min(rows.length - 1, focused.rowIndex + 1);
          handled = true;
          break;
        case "ArrowLeft":
          nextCol = Math.max(0, colIndex - 1);
          handled = true;
          break;
        case "ArrowRight":
          nextCol = Math.min(visibleColumns.length - 1, colIndex + 1);
          handled = true;
          break;
        case "Tab":
          if (event.shiftKey) {
            nextCol = Math.max(0, colIndex - 1);
          } else {
            nextCol = Math.min(visibleColumns.length - 1, colIndex + 1);
          }
          handled = true;
          break;
        case "Home":
          nextCol = 0;
          handled = true;
          break;
        case "End":
          nextCol = visibleColumns.length - 1;
          handled = true;
          break;
        case "Enter":
        case "F2":
          if (!readOnly) {
            setEditingCell(focused);
          }
          handled = true;
          break;
        case "Escape":
          setFocusedCell(null);
          handled = true;
          break;
      }

      if (handled) {
        event.preventDefault();
        const col = visibleColumns[nextCol];
        if (col) {
          const next = { rowIndex: nextRow, columnId: col.id };
          setFocusedCell(next);

          // Scroll into view
          const cellKey = getCellKey(nextRow, col.id);
          const cellEl = cellMapRef.current.get(cellKey);
          if (cellEl && dataGridRef.current) {
            scrollCellIntoView({
              container: dataGridRef.current,
              targetCell: cellEl,
              tableRef: tableRef as React.RefObject<ReturnType<typeof useReactTable<TData>> | null>,
              viewportOffset: VIEWPORT_OFFSET,
            });
          }

          // Scroll virtualizer to ensure row is visible
          virtualizer.scrollToIndex(nextRow, { align: "auto" });
        }
      }
    },
    [
      focusedCellRef,
      editingCellRef,
      table,
      rows.length,
      readOnly,
      cellMapRef,
      virtualizer,
    ],
  );

  // Click outside to stop editing
  const onGridBlur = useCallback(
    (event: React.FocusEvent) => {
      const relatedTarget = event.relatedTarget;
      if (getIsInPopover(relatedTarget)) return;
      if (
        dataGridRef.current &&
        relatedTarget instanceof Node &&
        dataGridRef.current.contains(relatedTarget)
      ) {
        return;
      }
      setEditingCell(null);
      setFocusedCell(null);
    },
    [],
  );

  // Table meta passed to cells
  const tableMeta = useMemo(
    () => ({
      dataGridRef,
      cellMapRef,
      focusedCell,
      editingCell,
      onCellClick,
      onCellDoubleClick,
      onCellEditingStart,
      onCellEditingStop,
      onDataUpdate: handleDataUpdate,
      readOnly,
    }),
    [
      focusedCell,
      editingCell,
      onCellClick,
      onCellDoubleClick,
      onCellEditingStart,
      onCellEditingStop,
      handleDataUpdate,
      readOnly,
    ],
  );

  return {
    // Refs
    dataGridRef,
    headerRef,
    cellMapRef,
    // Table
    table,
    tableMeta,
    // Virtual
    virtualTotalSize: virtualizer.getTotalSize(),
    virtualItems: virtualizer.getVirtualItems(),
    measureElement: virtualizer.measureElement,
    // Columns
    columns,
    columnSizeVars,
    columnVisibility,
    columnPinning,
    // Cell state
    focusedCell,
    editingCell,
    // Handlers
    onGridKeyDown,
    onGridBlur,
  };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useServerDataGrid.ts
git commit -m "feat(box-dice): add useServerDataGrid hook"
```

---

## Task 6: Core Grid Components (cherry-pick from tablecn)

**Files:**
- Create: `src/components/data-grid/data-grid.tsx`
- Create: `src/components/data-grid/data-grid-row.tsx`
- Create: `src/components/data-grid/data-grid-cell.tsx`
- Create: `src/components/data-grid/data-grid-cell-wrapper.tsx`

Cherry-pick from tablecn and strip:
- `"use client"` directives
- Cell range selection logic
- Search match highlighting
- Context menu handling
- Paste dialog
- Row height variants (use fixed 36px)
- RTL/direction support (LTR only)

- [ ] **Step 1: Create data-grid-cell-wrapper.tsx**

Copy from `F:\programming\tablecn\src\components\data-grid\data-grid-cell-wrapper.tsx`.

Strip: `isSelected`, `isSearchMatch`, `isActiveSearchMatch`, `rowHeight` from props. Remove selection-related CSS classes. Keep: click → focus → edit flow, F2/Enter/Space/type-to-edit keydown handling, cell registration in cellMapRef.

```typescript
// src/components/data-grid/data-grid-cell-wrapper.tsx
import { forwardRef, useCallback } from "react";
import { useComposedRefs } from "@/lib/compose-refs";
import { getCellKey } from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { DataGridCellProps } from "@/types/data-grid";

interface DataGridCellWrapperProps<TData>
  extends DataGridCellProps<TData>,
    Omit<React.ComponentProps<"div">, "children"> {
  children: React.ReactNode;
}

function DataGridCellWrapperInner<TData>(
  {
    tableMeta,
    rowIndex,
    columnId,
    isEditing,
    isFocused,
    readOnly,
    className,
    onClick: onClickProp,
    onKeyDown: onKeyDownProp,
    children,
    // Consume these so they don't spread to the div
    cell: _cell,
    ...props
  }: DataGridCellWrapperProps<TData>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const cellMapRef = tableMeta?.cellMapRef;

  const onCellChange = useCallback(
    (node: HTMLDivElement | null) => {
      if (!cellMapRef) return;
      const cellKey = getCellKey(rowIndex, columnId);
      if (node) {
        cellMapRef.current.set(cellKey, node);
      } else {
        cellMapRef.current.delete(cellKey);
      }
    },
    [rowIndex, columnId, cellMapRef],
  );

  const composedRef = useComposedRefs(ref, onCellChange);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isEditing) {
        event.preventDefault();
        onClickProp?.(event);
        if (isFocused && !readOnly) {
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        } else {
          tableMeta?.onCellClick?.(rowIndex, columnId, event);
        }
      }
    },
    [tableMeta, rowIndex, columnId, isEditing, isFocused, readOnly, onClickProp],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isEditing && !readOnly) {
        event.preventDefault();
        tableMeta?.onCellDoubleClick?.(rowIndex, columnId);
      }
    },
    [tableMeta, rowIndex, columnId, isEditing, readOnly],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDownProp?.(event);

      if (event.defaultPrevented) return;

      if (!isEditing && isFocused && !readOnly) {
        if (
          event.key === "F2" ||
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        } else if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        }
      }
    },
    [isEditing, isFocused, readOnly, tableMeta, rowIndex, columnId, onKeyDownProp],
  );

  return (
    <div
      ref={composedRef}
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      data-row-index={rowIndex}
      data-column-id={columnId}
      data-editing={isEditing || undefined}
      data-focused={isFocused || undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "flex h-full items-center border-b border-r px-2 text-sm outline-none",
        isFocused && "ring-2 ring-ring ring-inset",
        isEditing && "ring-2 ring-primary ring-inset",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const DataGridCellWrapper = forwardRef(DataGridCellWrapperInner) as <TData>(
  props: DataGridCellWrapperProps<TData> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement;
```

- [ ] **Step 2: Create data-grid-cell.tsx**

Copy from `F:\programming\tablecn\src\components\data-grid\data-grid-cell.tsx`.

Strip: `isSelected`, `isSearchMatch`, `isActiveSearchMatch`, `rowHeight` from props and memo comparator. Remove `LongTextCell`, `UrlCell`, `FileCell` cases. Add `RelationSingleCell`, `RelationMultiCell` cases.

```typescript
// src/components/data-grid/data-grid-cell.tsx
import { memo } from "react";
import {
  CheckboxCell,
  DateCell,
  NumberCell,
  SelectCell,
  ShortTextCell,
  MultiSelectCell,
} from "@/components/data-grid/data-grid-cell-variants";
import {
  RelationSingleCell,
  RelationMultiCell,
} from "@/components/data-grid/data-grid-relation-cell";
import type { DataGridCellProps } from "@/types/data-grid";

export const DataGridCell = memo(DataGridCellImpl, (prev, next) => {
  if (prev.isFocused !== next.isFocused) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.columnId !== next.columnId) return false;

  const prevValue = (prev.cell.row.original as Record<string, unknown>)[
    prev.columnId
  ];
  const nextValue = (next.cell.row.original as Record<string, unknown>)[
    next.columnId
  ];
  if (prevValue !== nextValue) return false;
  if (prev.cell.row.id !== next.cell.row.id) return false;

  return true;
}) as typeof DataGridCellImpl;

function DataGridCellImpl<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "short-text";

  const props: DataGridCellProps<TData> = {
    cell,
    tableMeta,
    rowIndex,
    columnId,
    isFocused,
    isEditing,
    readOnly,
  };

  switch (variant) {
    case "short-text":
      return <ShortTextCell {...props} />;
    case "number":
      return <NumberCell {...props} />;
    case "checkbox":
      return <CheckboxCell {...props} />;
    case "select":
      return <SelectCell {...props} />;
    case "multi-select":
      return <MultiSelectCell {...props} />;
    case "date":
      return <DateCell {...props} />;
    case "relation-single":
      return <RelationSingleCell {...props} />;
    case "relation-multi":
      return <RelationMultiCell {...props} />;
    default:
      return <ShortTextCell {...props} />;
  }
}
```

- [ ] **Step 3: Create data-grid-row.tsx**

Copy from `F:\programming\tablecn\src\components\data-grid\data-grid-row.tsx`.

Strip: `cellSelectionKeys`, `searchMatchColumns`, `activeSearchMatch`, `dir`, `stretchColumns`, `adjustLayout` props. Remove selection/search logic from memo comparator and rendering.

```typescript
// src/components/data-grid/data-grid-row.tsx
import type {
  ColumnPinningState,
  Row,
  TableMeta,
  VisibilityState,
} from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo, useCallback } from "react";
import { DataGridCell } from "@/components/data-grid/data-grid-cell";
import { useComposedRefs } from "@/lib/compose-refs";
import {
  getCellKey,
  getColumnBorderVisibility,
  getColumnPinningStyle,
} from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { CellPosition } from "@/types/data-grid";

interface DataGridRowProps<TData> extends React.ComponentProps<"div"> {
  row: Row<TData>;
  tableMeta: TableMeta<TData>;
  virtualItem: VirtualItem;
  measureElement: (node: Element | null) => void;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
  columnVisibility: VisibilityState;
  columnPinning: ColumnPinningState;
  focusedCell: CellPosition | null;
  editingCell: CellPosition | null;
  readOnly: boolean;
}

export const DataGridRow = memo(DataGridRowImpl, (prev, next) => {
  if (prev.row.id !== next.row.id) return false;
  if (prev.row.original !== next.row.original) return false;
  if (prev.virtualItem.start !== next.virtualItem.start) return false;

  const prevRowIndex = prev.virtualItem.index;
  const nextRowIndex = next.virtualItem.index;

  const prevHasFocus = prev.focusedCell?.rowIndex === prevRowIndex;
  const nextHasFocus = next.focusedCell?.rowIndex === nextRowIndex;
  if (prevHasFocus !== nextHasFocus) return false;
  if (nextHasFocus && prevHasFocus) {
    if (prev.focusedCell?.columnId !== next.focusedCell?.columnId) return false;
  }

  const prevHasEditing = prev.editingCell?.rowIndex === prevRowIndex;
  const nextHasEditing = next.editingCell?.rowIndex === nextRowIndex;
  if (prevHasEditing !== nextHasEditing) return false;
  if (nextHasEditing && prevHasEditing) {
    if (prev.editingCell?.columnId !== next.editingCell?.columnId) return false;
  }

  if (prev.columnVisibility !== next.columnVisibility) return false;
  if (prev.columnPinning !== next.columnPinning) return false;
  if (prev.readOnly !== next.readOnly) return false;

  return true;
}) as typeof DataGridRowImpl;

function DataGridRowImpl<TData>({
  row,
  tableMeta,
  virtualItem,
  measureElement,
  rowMapRef,
  columnVisibility,
  columnPinning,
  focusedCell,
  editingCell,
  readOnly,
  className,
  ref,
  ...props
}: DataGridRowProps<TData>) {
  const rowIndex = virtualItem.index;

  const onRowChange = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        rowMapRef.current.set(rowIndex, node);
      } else {
        rowMapRef.current.delete(rowIndex);
      }
    },
    [rowIndex, rowMapRef],
  );

  const composedRef = useComposedRefs(ref, measureElement, onRowChange);

  const visibleCells = row.getVisibleCells();

  return (
    <div
      ref={composedRef}
      role="row"
      data-index={virtualItem.index}
      className={cn("absolute left-0 flex w-full", className)}
      style={{
        transform: `translateY(${virtualItem.start}px)`,
        height: `36px`,
      }}
      {...props}
    >
      {visibleCells.map((cell, cellIndex) => {
        const column = cell.column;
        const columnId = column.id;

        const isFocused =
          focusedCell?.rowIndex === rowIndex &&
          focusedCell?.columnId === columnId;
        const isEditing =
          editingCell?.rowIndex === rowIndex &&
          editingCell?.columnId === columnId;

        const { showEndBorder, showStartBorder } = getColumnBorderVisibility({
          column,
          nextColumn: visibleCells[cellIndex + 1]?.column,
          isLastColumn: cellIndex === visibleCells.length - 1,
        });

        return (
          <div
            key={columnId}
            className={cn(
              "flex-none",
              !showEndBorder && "border-r-0",
              showStartBorder && "border-l",
            )}
            style={{
              ...getColumnPinningStyle({ column, withBorder: true }),
              width: `calc(var(--col-${columnId}-size) * 1px)`,
            }}
          >
            <DataGridCell
              cell={cell}
              tableMeta={tableMeta}
              rowIndex={rowIndex}
              columnId={columnId}
              isFocused={isFocused}
              isEditing={isEditing}
              readOnly={readOnly}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create data-grid.tsx (grid shell)**

```typescript
// src/components/data-grid/data-grid.tsx
import { useMemo, useRef } from "react";
import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { DataGridRow } from "@/components/data-grid/data-grid-row";
import {
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
} from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { useServerDataGrid } from "@/hooks/useServerDataGrid";

interface DataGridProps<TData>
  extends Omit<ReturnType<typeof useServerDataGrid<TData>>, "onGridKeyDown" | "onGridBlur">,
    Omit<React.ComponentProps<"div">, "children"> {
  onGridKeyDown: (event: React.KeyboardEvent) => void;
  onGridBlur: (event: React.FocusEvent) => void;
  height?: number;
}

export function DataGrid<TData>({
  dataGridRef,
  headerRef,
  cellMapRef,
  table,
  tableMeta,
  virtualTotalSize,
  virtualItems,
  measureElement,
  columns,
  columnSizeVars,
  columnVisibility,
  columnPinning,
  focusedCell,
  editingCell,
  onGridKeyDown,
  onGridBlur,
  height = 600,
  className,
  ...props
}: DataGridProps<TData>) {
  const rows = table.getRowModel().rows;
  const readOnly = tableMeta?.readOnly ?? false;
  const rowMapRef = useRef(new Map<number, HTMLDivElement>());

  const headerGroups = table.getHeaderGroups();

  return (
    <div
      role="grid"
      ref={dataGridRef}
      tabIndex={0}
      onKeyDown={onGridKeyDown}
      onBlur={onGridBlur}
      className={cn(
        "relative overflow-auto rounded-md border bg-background focus:outline-none",
        className,
      )}
      style={{
        height,
        ...columnSizeVars,
      } as React.CSSProperties}
      {...props}
    >
      {/* Header */}
      <div
        ref={headerRef}
        role="rowgroup"
        className="sticky top-0 z-10 bg-muted/50"
      >
        {headerGroups.map((headerGroup) => (
          <div key={headerGroup.id} role="row" className="flex">
            {headerGroup.headers.map((header, headerIndex) => {
              const { showEndBorder, showStartBorder } =
                getColumnBorderVisibility({
                  column: header.column,
                  nextColumn: headerGroup.headers[headerIndex + 1]?.column,
                  isLastColumn:
                    headerIndex === headerGroup.headers.length - 1,
                });

              return (
                <div
                  key={header.id}
                  role="columnheader"
                  className={cn(
                    "flex h-9 flex-none items-center border-b border-r px-2 text-xs font-medium text-muted-foreground",
                    !showEndBorder && "border-r-0",
                    showStartBorder && "border-l",
                  )}
                  style={{
                    ...getColumnPinningStyle({
                      column: header.column,
                      withBorder: true,
                    }),
                    width: `calc(var(--header-${header.id}-size) * 1px)`,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}

                  {/* Column resizer */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                      "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                      header.column.getIsResizing() && "bg-primary",
                    )}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        role="rowgroup"
        className="relative"
        style={{ height: virtualTotalSize }}
      >
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (!row) return null;

          return (
            <DataGridRow
              key={row.id}
              row={row}
              tableMeta={tableMeta}
              virtualItem={virtualItem}
              measureElement={measureElement}
              rowMapRef={rowMapRef}
              columnVisibility={columnVisibility}
              columnPinning={columnPinning}
              focusedCell={focusedCell}
              editingCell={editingCell}
              readOnly={readOnly}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors (relation cell imports will fail — that's OK, created in Task 9)

- [ ] **Step 6: Commit**

```bash
git add src/components/data-grid/
git commit -m "feat(box-dice): add core data grid components (shell, row, cell, wrapper)"
```

---

## Task 7: Cell Variants (cherry-pick from tablecn)

**Files:**
- Create: `src/components/data-grid/data-grid-cell-variants.tsx`

Cherry-pick from `F:\programming\tablecn\src\components\data-grid\data-grid-cell-variants.tsx`.

Keep: `ShortTextCell`, `NumberCell`, `SelectCell`, `MultiSelectCell`, `CheckboxCell`, `DateCell`.
Strip: `LongTextCell`, `UrlCell`, `FileCell`, row height logic, search match highlighting, selection styling.

Adapt all cell props to use our trimmed `DataGridCellProps` (no `isSelected`, `isSearchMatch`, `isActiveSearchMatch`, `rowHeight`).

- [ ] **Step 1: Create data-grid-cell-variants.tsx**

Copy the six cell variant components from tablecn. For each variant:
1. Remove `isSelected`, `isSearchMatch`, `isActiveSearchMatch`, `rowHeight` from destructured props
2. Remove CSS classes that reference selection or search match state
3. Remove `getLineCount(rowHeight)` calls — use fixed single-line display
4. Keep the core edit/display logic intact

The file will be large (~800-1000 lines). Here is the structure with key patterns:

```typescript
// src/components/data-grid/data-grid-cell-variants.tsx
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDateForDisplay,
  formatDateToString,
  getCellKey,
  parseLocalDate,
} from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { DataGridCellProps } from "@/types/data-grid";

// ── ShortTextCell ──
// Copy from tablecn ShortTextCell, strip isSelected/isSearchMatch/isActiveSearchMatch/rowHeight.
// Key behavior: contentEditable on edit, onBlur saves, Enter/Tab/Escape handling, type-to-prefill.

export function ShortTextCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const initialValue = cell.getValue() as string;
  const [value, setValue] = useState(initialValue);
  const cellRef = useRef<HTMLDivElement>(null);
  const prevIsEditingRef = useRef(false);

  const prevInitialValueRef = useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue;
    }
  }

  const onBlur = useCallback(() => {
    const currentValue = cellRef.current?.textContent ?? "";
    if (!readOnly && currentValue !== initialValue) {
      tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
    }
    tableMeta?.onCellEditingStop?.();
  }, [tableMeta, rowIndex, columnId, initialValue, readOnly]);

  const onInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      setValue(event.currentTarget.textContent ?? "");
    },
    [],
  );

  const onWrapperKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
          }
          tableMeta?.onCellEditingStop?.({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
          }
          tableMeta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          cellRef.current?.blur();
        }
      } else if (
        isFocused &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        setValue(event.key);
        queueMicrotask(() => {
          if (cellRef.current && cellRef.current.contentEditable === "true") {
            cellRef.current.textContent = event.key;
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(cellRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        });
      }
    },
    [isEditing, isFocused, initialValue, tableMeta, rowIndex, columnId],
  );

  useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (isEditing && !wasEditing && cellRef.current) {
      cellRef.current.focus();
      if (!cellRef.current.textContent && value) {
        cellRef.current.textContent = value;
      }
      if (cellRef.current.textContent) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(cellRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isEditing, value]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
      onKeyDown={onWrapperKeyDown}
    >
      <div
        role="textbox"
        contentEditable={isEditing}
        tabIndex={-1}
        ref={cellRef}
        onBlur={onBlur}
        onInput={onInput}
        suppressContentEditableWarning
        className={cn(
          "size-full overflow-hidden outline-none",
          isEditing && "cursor-text",
          !isEditing && "truncate",
        )}
      >
        {!isEditing ? (value ?? "") : ""}
      </div>
    </DataGridCellWrapper>
  );
}

// ── NumberCell ──
// Same pattern as ShortTextCell but with type="number" input on edit.
// Copy from tablecn NumberCell, strip unused props.

export function NumberCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const min = cellOpts?.variant === "number" ? cellOpts.min : undefined;
  const max = cellOpts?.variant === "number" ? cellOpts.max : undefined;
  const step = cellOpts?.variant === "number" ? cellOpts.step : undefined;

  const initialValue = cell.getValue() as number | null;
  const [value, setValue] = useState<string>(
    initialValue != null ? String(initialValue) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const prevInitialValueRef = useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue != null ? String(initialValue) : "");
  }

  const saveAndStop = useCallback(
    (opts?: { direction?: "left" | "right"; moveToNextRow?: boolean }) => {
      const numVal = value === "" ? null : Number(value);
      if (numVal !== initialValue) {
        tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: numVal });
      }
      tableMeta?.onCellEditingStop?.(opts);
    },
    [value, initialValue, tableMeta, rowIndex, columnId],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          saveAndStop({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          saveAndStop({ direction: event.shiftKey ? "left" : "right" });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue != null ? String(initialValue) : "");
          tableMeta?.onCellEditingStop?.();
        }
      }
    },
    [isEditing, saveAndStop, initialValue, tableMeta],
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
      onKeyDown={onKeyDown}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => saveAndStop()}
          className="size-full bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span className="truncate">{initialValue ?? ""}</span>
      )}
    </DataGridCellWrapper>
  );
}

// ── CheckboxCell ──
// Single click toggles and saves immediately.

export function CheckboxCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const value = cell.getValue() as boolean;

  const onToggle = useCallback(() => {
    if (readOnly) return;
    tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: !value });
  }, [readOnly, tableMeta, rowIndex, columnId, value]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={false}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Checkbox
        checked={value}
        onCheckedChange={onToggle}
        disabled={readOnly}
        className="mx-auto"
      />
    </DataGridCellWrapper>
  );
}

// ── SelectCell ──
// Click opens dropdown with options from column meta.

export function SelectCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options =
    cellOpts?.variant === "select" ? cellOpts.options : [];
  const initialValue = cell.getValue() as string;

  const onValueChange = useCallback(
    (newValue: string) => {
      if (newValue !== initialValue) {
        tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: newValue });
      }
      tableMeta?.onCellEditingStop?.();
    },
    [initialValue, tableMeta, rowIndex, columnId],
  );

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      {isEditing ? (
        <Select
          value={initialValue}
          onValueChange={onValueChange}
          open={isEditing}
          onOpenChange={(open) => {
            if (!open) tableMeta?.onCellEditingStop?.();
          }}
        >
          <SelectTrigger className="h-full border-0 shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent data-grid-cell-editor>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="truncate">
          {options.find((o) => o.value === initialValue)?.label ?? initialValue}
        </span>
      )}
    </DataGridCellWrapper>
  );
}

// ── MultiSelectCell ──
// Click opens Command popover with checkboxes for multi-select.

export function MultiSelectCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options =
    cellOpts?.variant === "multi-select" ? cellOpts.options : [];
  const initialValue = (cell.getValue() as string[]) ?? [];
  const [selected, setSelected] = useState<string[]>(initialValue);

  const prevRef = useRef(initialValue);
  if (initialValue !== prevRef.current) {
    prevRef.current = initialValue;
    setSelected(initialValue);
  }

  const onToggle = useCallback(
    (value: string) => {
      setSelected((prev) => {
        const next = prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
        return next;
      });
    },
    [],
  );

  const onApply = useCallback(() => {
    if (JSON.stringify(selected) !== JSON.stringify(initialValue)) {
      tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: selected });
    }
    tableMeta?.onCellEditingStop?.();
  }, [selected, initialValue, tableMeta, rowIndex, columnId]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) onApply();
        }}
      >
        <PopoverAnchor className="size-full">
          <div className="flex items-center gap-1 overflow-hidden">
            {initialValue.length === 0 ? (
              <span className="text-muted-foreground">---</span>
            ) : (
              initialValue.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs">
                  {options.find((o) => o.value === v)?.label ?? v}
                </Badge>
              ))
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-50 p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => onToggle(opt.value)}
                  >
                    <Checkbox
                      checked={selected.includes(opt.value)}
                      className="mr-2"
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}

// ── DateCell ──
// Click opens calendar popover.

export function DateCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const initialValue = cell.getValue() as string;
  const date = parseLocalDate(initialValue);

  const onSelect = useCallback(
    (newDate: Date | undefined) => {
      if (!newDate) return;
      const dateStr = formatDateToString(newDate);
      if (dateStr !== initialValue) {
        tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: dateStr });
      }
      tableMeta?.onCellEditingStop?.();
    },
    [initialValue, tableMeta, rowIndex, columnId],
  );

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) tableMeta?.onCellEditingStop?.();
        }}
      >
        <PopoverAnchor className="size-full">
          <span className="truncate">
            {formatDateForDisplay(initialValue)}
          </span>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-auto p-0"
          align="start"
        >
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={onSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-grid/data-grid-cell-variants.tsx
git commit -m "feat(box-dice): add cell variant components (text, number, select, checkbox, date)"
```

---

## Task 8: Column Header & View Menu (cherry-pick from tablecn)

**Files:**
- Create: `src/components/data-grid/data-grid-column-header.tsx`
- Create: `src/components/data-grid/data-grid-view-menu.tsx`

- [ ] **Step 1: Create data-grid-column-header.tsx**

Copy from `F:\programming\tablecn\src\components\data-grid\data-grid-column-header.tsx` (290 lines).

This component renders in the column header and provides a dropdown menu with:
- Sort ascending / Sort descending (triggers `onColumnClick` callback)
- Pin left / Pin right / Unpin
- Hide column

Since our sorting is server-side (URL-based), the column header's sort toggle will call a callback that the page component handles (updating URL params via `setFilters`). The component itself doesn't need to know about server-side sorting — it just shows sort indicators and triggers callbacks.

Adapt:
- Remove RTL/direction props
- The sort click callback will be wired at the page level to update URL params
- Keep pin and hide functionality as-is (local state)

```typescript
// src/components/data-grid/data-grid-column-header.tsx
import type { Column } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
  PinIcon,
  PinOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DataGridColumnHeaderProps<TData> {
  column: Column<TData, unknown>;
  title: string;
  sortDirection?: "asc" | "desc" | false;
  onSort?: (columnId: string, direction: "asc" | "desc") => void;
}

export function DataGridColumnHeader<TData>({
  column,
  title,
  sortDirection,
  onSort,
}: DataGridColumnHeaderProps<TData>) {
  const isPinned = column.getIsPinned();

  return (
    <div className="flex w-full items-center justify-between gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 gap-1 text-xs font-medium data-[state=open]:bg-accent"
          >
            <span className="truncate">{title}</span>
            {sortDirection === "asc" ? (
              <ArrowUpIcon className="size-3.5" />
            ) : sortDirection === "desc" ? (
              <ArrowDownIcon className="size-3.5" />
            ) : (
              <ChevronsUpDownIcon className="size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => onSort?.(column.id, "asc")}
          >
            <ArrowUpIcon className="mr-2 size-3.5 text-muted-foreground" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSort?.(column.id, "desc")}
          >
            <ArrowDownIcon className="mr-2 size-3.5 text-muted-foreground" />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isPinned !== "left" && (
            <DropdownMenuItem onClick={() => column.pin("left")}>
              <PinIcon className="mr-2 size-3.5 text-muted-foreground" />
              Pin Left
            </DropdownMenuItem>
          )}
          {isPinned !== "right" && (
            <DropdownMenuItem onClick={() => column.pin("right")}>
              <PinIcon className="mr-2 size-3.5 text-muted-foreground rotate-90" />
              Pin Right
            </DropdownMenuItem>
          )}
          {isPinned && (
            <DropdownMenuItem onClick={() => column.pin(false)}>
              <PinOffIcon className="mr-2 size-3.5 text-muted-foreground" />
              Unpin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOffIcon className="mr-2 size-3.5 text-muted-foreground" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 2: Create data-grid-view-menu.tsx**

Copy from `F:\programming\tablecn\src\components\data-grid\data-grid-view-menu.tsx` (98 lines). Keep as-is — it's a simple popover with column visibility toggles.

```typescript
// src/components/data-grid/data-grid-view-menu.tsx
import type { Table } from "@tanstack/react-table";
import { ColumnsIcon } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

interface DataGridViewMenuProps<TData> {
  table: Table<TData>;
}

export function DataGridViewMenu<TData>({
  table,
}: DataGridViewMenuProps<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => column.getCanHide());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <ColumnsIcon className="size-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="end">
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
                  <Checkbox
                    checked={column.getIsVisible()}
                    className="mr-2"
                  />
                  {column.columnDef.meta?.label ?? column.id}
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

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/data-grid/data-grid-column-header.tsx src/components/data-grid/data-grid-view-menu.tsx
git commit -m "feat(box-dice): add column header and view menu components"
```

---

## Task 9: Relation Cells (new components)

**Files:**
- Create: `src/components/data-grid/data-grid-relation-cell.tsx`

These are new components (not from tablecn). They display relation entity names and open a popover with a searchable, server-side paginated table for editing.

Key behaviors:
- **Display:** Entity name(s) as text, "---" if empty
- **Edit:** Popover with Command (searchable list), data fetched server-side with `$top=10`
- **Single mode:** Selecting a row saves immediately and closes popover
- **Multi mode:** Checkboxes on rows, "Apply" button to confirm

- [ ] **Step 1: Create data-grid-relation-cell.tsx**

```typescript
// src/components/data-grid/data-grid-relation-cell.tsx
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { DataGridCellProps } from "@/types/data-grid";
import type { ApiResponse } from "@/types/api";

// ── RelationSingleCell ──
// For item, oldItem fields. Value is an object with id and name (or null).

export function RelationSingleCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  if (cellOpts?.variant !== "relation-single") return null;

  const { queryOptions: getQueryOptions, displayField, idField = "id" } = cellOpts;
  const value = cell.getValue() as Record<string, unknown> | null;
  const displayValue = value?.[displayField] as string | undefined;

  const [search, setSearch] = useState("");
  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  const { data: response, isLoading } = useQuery({
    ...(getQueryOptions({ name: search, page: 1, pageSize: 10 }) as ReturnType<typeof import("@tanstack/react-query").queryOptions>),
    enabled: isEditing,
  });

  const items = (response as ApiResponse<Record<string, unknown>[]> | undefined)?.data ?? [];

  const onSelect = useCallback(
    (item: Record<string, unknown>) => {
      tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: item });
      tableMeta?.onCellEditingStop?.();
    },
    [tableMeta, rowIndex, columnId],
  );

  const onClear = useCallback(() => {
    tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: null });
    tableMeta?.onCellEditingStop?.();
  }, [tableMeta, rowIndex, columnId]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) tableMeta?.onCellEditingStop?.();
        }}
      >
        <PopoverAnchor className="size-full">
          <span className="truncate">
            {displayValue ?? <span className="text-muted-foreground">---</span>}
          </span>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-70 p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              onValueChange={debouncedSetSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No results."}
              </CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem onSelect={onClear} className="text-muted-foreground">
                    Clear selection
                  </CommandItem>
                )}
                {items.map((item) => (
                  <CommandItem
                    key={String(item[idField])}
                    value={String(item[idField])}
                    onSelect={() => onSelect(item)}
                  >
                    {String(item[displayField])}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}

// ── RelationMultiCell ──
// For things, oldThings fields. Value is an array of objects with id and name (or null/empty).

export function RelationMultiCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  if (cellOpts?.variant !== "relation-multi") return null;

  const { queryOptions: getQueryOptions, displayField, idField = "id" } = cellOpts;
  const initialValue = (cell.getValue() as Record<string, unknown>[] | null) ?? [];
  const [selected, setSelected] = useState<Record<string, unknown>[]>(initialValue);
  const [search, setSearch] = useState("");
  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  // Reset selected when initial value changes (e.g. after save)
  const prevRef = useState(() => initialValue)[0];
  if (initialValue !== prevRef) {
    setSelected(initialValue);
  }

  const { data: response, isLoading } = useQuery({
    ...(getQueryOptions({ name: search, page: 1, pageSize: 10 }) as ReturnType<typeof import("@tanstack/react-query").queryOptions>),
    enabled: isEditing,
  });

  const items = (response as ApiResponse<Record<string, unknown>[]> | undefined)?.data ?? [];

  const isItemSelected = useCallback(
    (item: Record<string, unknown>) => {
      return selected.some(
        (s) => s[idField] === item[idField],
      );
    },
    [selected, idField],
  );

  const onToggle = useCallback(
    (item: Record<string, unknown>) => {
      setSelected((prev) => {
        const exists = prev.some((s) => s[idField] === item[idField]);
        if (exists) {
          return prev.filter((s) => s[idField] !== item[idField]);
        }
        return [...prev, item];
      });
    },
    [idField],
  );

  const onApply = useCallback(() => {
    tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: selected });
    tableMeta?.onCellEditingStop?.();
  }, [selected, tableMeta, rowIndex, columnId]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) onApply();
        }}
      >
        <PopoverAnchor className="size-full">
          <div className="flex items-center gap-1 overflow-hidden">
            {initialValue.length === 0 ? (
              <span className="text-muted-foreground">---</span>
            ) : (
              initialValue.map((item) => (
                <Badge
                  key={String(item[idField])}
                  variant="secondary"
                  className="text-xs"
                >
                  {String(item[displayField])}
                </Badge>
              ))
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-70 p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              onValueChange={debouncedSetSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No results."}
              </CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={String(item[idField])}
                    value={String(item[idField])}
                    onSelect={() => onToggle(item)}
                  >
                    <Checkbox
                      checked={isItemSelected(item)}
                      className="mr-2"
                    />
                    {String(item[displayField])}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t p-2">
            <Button size="sm" className="w-full" onClick={onApply}>
              Apply ({selected.length})
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-grid/data-grid-relation-cell.tsx
git commit -m "feat(box-dice): add relation cell components (single and multi)"
```

---

## Task 10: Pagination Component

**Files:**
- Create: `src/components/data-grid/data-grid-pagination.tsx`

- [ ] **Step 1: Create data-grid-pagination.tsx**

```typescript
// src/components/data-grid/data-grid-pagination.tsx
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataGridPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function DataGridPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: DataGridPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between border-t px-4 py-2">
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({totalCount} total)
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-grid/data-grid-pagination.tsx
git commit -m "feat(box-dice): add pagination component"
```

---

## Task 11: Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add Box Dice nav entry**

In `src/components/app-sidebar.tsx`, add to the `navItems` array:

```typescript
const navItems = [
  { to: "/automated-system", label: "Automated Systems" },
  { to: "/box", label: "Boxes" },
  { to: "/box-dice", label: "Box Dice" },
  { to: "/flow-graph", label: "Flow Graph" },
  { to: "/components", label: "Components" },
] as const;
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(box-dice): add Box Dice to sidebar navigation"
```

---

## Task 12: Route Page — `/box-dice/`

**Files:**
- Create: `src/routes/box-dice/index.tsx`

This is the main page that wires everything together. Pattern follows `src/routes/box/index.tsx` but uses the data grid instead of SimpleTable.

- [ ] **Step 1: Create the route file**

```typescript
// src/routes/box-dice/index.tsx
import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { z } from "zod";
import { boxesQueryOptions, patchBox, createBox } from "@/api/box";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, BoxFilters } from "@/types/api";
import type { CellUpdate } from "@/types/data-grid";
import { useFilters } from "@/hooks/useFilters";
import { useServerDataGrid } from "@/hooks/useServerDataGrid";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { DataGridPagination } from "@/components/data-grid/data-grid-pagination";

// ── URL Search Params ──

function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(",").map(Number).filter((n) => !isNaN(n));
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(Number).filter((n) => !isNaN(n));
  }
  return undefined;
}

interface BoxDiceFilters extends BoxFilters {
  // BoxFilters already extends Partial<SortByParams>
}

function validateSearch(search: Record<string, unknown>): BoxDiceFilters {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : 20,
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode:
      typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape:
      search.shape === "O" || search.shape === "X" ? search.shape : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox:
      typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom:
      typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo:
      typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId: typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
    sortBy: typeof search.sortBy === "string" ? search.sortBy : undefined,
  };
}

// ── Route Definition ──

export const Route = createFileRoute("/box-dice/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(boxesQueryOptions(deps)),
  component: BoxDicePage,
});

// ── Column Definitions ──

const columnHelper = createColumnHelper<BoxDto>();

function getColumns(
  sortBy: string | undefined,
  onSort: (columnId: string, direction: "asc" | "desc") => void,
) {
  // Parse current sort state
  const sortMap = new Map<string, "asc" | "desc">();
  if (sortBy) {
    for (const part of sortBy.split(",")) {
      const [field, dir] = part.trim().split(":");
      if (field && (dir === "asc" || dir === "desc")) {
        sortMap.set(field, dir);
      }
    }
  }

  return [
    columnHelper.accessor("id", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="ID"
          sortDirection={sortMap.get("id") || false}
          onSort={onSort}
        />
      ),
      size: 80,
      meta: { label: "ID" },
      enableHiding: false,
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Name"
          sortDirection={sortMap.get("name") || false}
          onSort={onSort}
        />
      ),
      size: 200,
      meta: { label: "Name", cell: { variant: "short-text" } },
    }),
    columnHelper.accessor("objectCode", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Object Code"
          sortDirection={sortMap.get("objectCode") || false}
          onSort={onSort}
        />
      ),
      size: 150,
      meta: { label: "Object Code", cell: { variant: "short-text" } },
    }),
    columnHelper.accessor("shape", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Shape"
          sortDirection={sortMap.get("shape") || false}
          onSort={onSort}
        />
      ),
      size: 100,
      meta: {
        label: "Shape",
        cell: {
          variant: "select",
          options: [
            { label: "O", value: "O" },
            { label: "X", value: "X" },
          ],
        },
      },
    }),
    columnHelper.accessor("num", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Num"
          sortDirection={sortMap.get("num") || false}
          onSort={onSort}
        />
      ),
      size: 100,
      meta: { label: "Num", cell: { variant: "number" } },
    }),
    columnHelper.accessor("dateStr", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Date"
          sortDirection={sortMap.get("dateStr") || false}
          onSort={onSort}
        />
      ),
      size: 150,
      meta: { label: "Date", cell: { variant: "date" } },
    }),
    columnHelper.accessor("checkbox", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Checkbox"
          sortDirection={sortMap.get("checkbox") || false}
          onSort={onSort}
        />
      ),
      size: 100,
      meta: { label: "Checkbox", cell: { variant: "checkbox" } },
    }),
    columnHelper.accessor("tags", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Tags" />
      ),
      size: 200,
      meta: { label: "Tags", cell: { variant: "short-text" } },
      // Display as comma-separated, edit as text, parse on save
      cell: ({ getValue }) => {
        const tags = getValue();
        return tags?.join(", ") ?? "";
      },
    }),
    columnHelper.accessor("item", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Item" />
      ),
      size: 180,
      meta: {
        label: "Item",
        cell: {
          variant: "relation-single",
          queryOptions: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
    columnHelper.accessor("things", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Things" />
      ),
      size: 220,
      meta: {
        label: "Things",
        cell: {
          variant: "relation-multi",
          queryOptions: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
    columnHelper.accessor("oldItem", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Old Item" />
      ),
      size: 180,
      meta: {
        label: "Old Item",
        cell: {
          variant: "relation-single",
          queryOptions: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
    columnHelper.accessor("oldThings", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Old Things" />
      ),
      size: 220,
      meta: {
        label: "Old Things",
        cell: {
          variant: "relation-multi",
          queryOptions: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
  ];
}

// ── Page Component ──

function BoxDicePage() {
  const { filters, setFilters, setPage } = useFilters("/box-dice/");
  const queryClient = useQueryClient();

  const { data: boxesResponse } = useSuspenseQuery(boxesQueryOptions(filters));
  const boxes = boxesResponse.data;
  const totalCount = boxesResponse.count;

  // Patch mutation
  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BoxDto> }) =>
      patchBox(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
    },
  });

  // Sort handler: toggles or sets sort direction, updates URL
  const onSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      const currentSortBy = filters.sortBy ?? "";
      const parts = currentSortBy
        .split(",")
        .filter((p) => p.trim().length > 0);

      // Remove existing sort for this column
      const filtered = parts.filter(
        (p) => !p.trim().startsWith(columnId + ":"),
      );

      // Check if same direction already set (toggle off)
      const existing = parts.find((p) => p.trim().startsWith(columnId + ":"));
      if (existing === `${columnId}:${direction}`) {
        // Remove sort for this column
        setFilters({
          sortBy: filtered.length > 0 ? filtered.join(",") : undefined,
        } as Partial<BoxFilters>);
      } else {
        // Add/replace sort
        filtered.unshift(`${columnId}:${direction}`);
        setFilters({
          sortBy: filtered.join(","),
        } as Partial<BoxFilters>);
      }
    },
    [filters.sortBy, setFilters],
  );

  const columns = useMemo(
    () => getColumns(filters.sortBy, onSort),
    [filters.sortBy, onSort],
  );

  // Handle cell data updates
  const onDataUpdate = useCallback(
    (params: CellUpdate | CellUpdate[]) => {
      const updates = Array.isArray(params) ? params : [params];
      for (const update of updates) {
        const row = boxes[update.rowIndex];
        if (!row) continue;

        // Build patch payload
        const patch: Partial<BoxDto> = {};
        const columnId = update.columnId as keyof BoxDto;

        if (columnId === "tags") {
          // Parse comma-separated string back to array
          const val = update.value;
          if (typeof val === "string") {
            patch.tags = val
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          } else {
            patch.tags = val as string[];
          }
        } else if (
          columnId === "item" ||
          columnId === "oldItem" ||
          columnId === "things" ||
          columnId === "oldThings"
        ) {
          // Relation fields: value is the full entity object(s)
          (patch as Record<string, unknown>)[columnId] = update.value;
        } else {
          (patch as Record<string, unknown>)[columnId] = update.value;
        }

        patchMutation.mutate({ id: row.id, data: patch });
      }
    },
    [boxes, patchMutation],
  );

  const grid = useServerDataGrid({
    data: boxes,
    columns,
    totalCount,
    onDataUpdate,
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Box Dice</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} boxes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataGridViewMenu table={grid.table} />
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid {...grid} height={600} />

      {/* Pagination */}
      <DataGridPagination
        page={filters.page ?? 1}
        pageSize={filters.pageSize ?? 20}
        totalCount={totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server starts and page renders**

Run: `npm run dev`

Navigate to `http://localhost:5173/box-dice/` in the browser. Verify:
- Page loads without errors
- Grid renders with BoxDto data
- Columns are visible with headers
- Virtual scrolling works

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/box-dice/index.tsx src/routeTree.gen.ts
git commit -m "feat(box-dice): add /box-dice/ route with data grid page"
```

---

## Task 13: Final Verification & Polish

**Files:**
- All files from previous tasks

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual testing checklist**

Navigate to `http://localhost:5173/box-dice/` and verify each feature:

1. **Grid rendering:** All columns visible, data displays correctly
2. **Virtual scrolling:** Scroll down, rows render smoothly
3. **Column resizing:** Drag column borders to resize
4. **Column pinning:** Right-click header → Pin Left/Right, column stays visible while scrolling
5. **Column hiding:** Use View Menu → toggle columns off/on
6. **Cell editing — text:** Double-click a name cell → edit → Enter to save → verify data persists on refresh
7. **Cell editing — number:** Double-click num cell → type number → Enter
8. **Cell editing — select:** Click shape cell → select O/X from dropdown
9. **Cell editing — checkbox:** Single-click checkbox → toggles immediately
10. **Cell editing — date:** Click date cell → calendar popover → select date
11. **Cell editing — tags:** Double-click tags cell → edit comma-separated text → Enter
12. **Relation cells — single:** Click item cell → popover with searchable list → select item
13. **Relation cells — multi:** Click things cell → popover with checkboxes → Apply
14. **Sorting:** Click column header → Sort Asc/Desc → verify URL updates with sortBy param → verify data re-fetches
15. **Pagination:** Click Next/Previous → verify page changes → verify URL updates
16. **Keyboard navigation:** Click a cell → arrow keys → Tab → Enter to edit → Escape to cancel
17. **Sidebar:** "Box Dice" link appears and navigates correctly

- [ ] **Step 4: Fix any issues found during testing**

Address any bugs or issues found during manual testing.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(box-dice): polish data grid after manual testing"
```
