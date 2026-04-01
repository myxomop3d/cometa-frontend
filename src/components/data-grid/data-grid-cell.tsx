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
