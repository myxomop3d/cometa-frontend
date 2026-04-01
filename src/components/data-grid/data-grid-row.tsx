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
