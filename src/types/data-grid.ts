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
