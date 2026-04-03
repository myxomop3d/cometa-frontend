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
    filterKey?: string;
    filterKeys?: [string, string];
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
