import {
  type ColumnDef,
  type ColumnPinningState,
  type RowSelectionState,
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
  void totalCount;
  // Refs
  const dataGridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cellMapRef = useLazyRef(() => new Map<string, HTMLDivElement>());
  const tableRef = useRef<ReturnType<typeof useReactTable<TData>> | null>(
    null,
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  // Cell event handlers
  const onCellClick = useCallback(
    (rowIndex: number, columnId: string, _event?: React.MouseEvent) => {
      setFocusedCell({ rowIndex, columnId });
      if (!readOnly) {
        setEditingCell(null);
      }
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
        nextColIndex = Math.min(
          visibleColumns.length - 1,
          currentColIndex + 1,
        );
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
              tableRef: tableRef as React.RefObject<ReturnType<
                typeof useReactTable<TData>
              > | null>,
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
  const onGridBlur = useCallback((event: React.FocusEvent) => {
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
  }, []);

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
