import type { ColumnDef, ColumnSort, Row, RowData } from "@tanstack/react-table";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { DataTableConfig } from "@/config/data-table";
import type { ApiResponse } from "@/types/api";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relationConfig?: RelationConfig<any>;
  }
}

export type RelationQueryOptionsFn<TRelated> = (
  filters: Record<string, unknown>,
) => UseQueryOptions<
  ApiResponse<TRelated[]>,
  Error,
  ApiResponse<TRelated[]>,
  // queryOptions() infers a mutable queryKey tuple; widen to avoid
  // contravariant `enabled` mismatch against the default readonly key.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

export interface RelationConfig<TRelated> {
  queryOptionsFn: RelationQueryOptionsFn<TRelated>;
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

export interface ExtendedColumnFilter {
  /** Column id. */
  id: string;
  operator: FilterOperator;
  /** Shape depends on operator + variant:
   *  text/number -> string | number
   *  isBetween   -> [min, max]
   *  inArray/notInArray (select/multiSelect) -> string[]
   *  inArray/notInArray (multiRelation) -> { id: number; label: string }[]
   *  relation eq/ne -> { id: number; label: string }
   *  isEmpty/isNotEmpty -> undefined
   */
  value: unknown;
}
