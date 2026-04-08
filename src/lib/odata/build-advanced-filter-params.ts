import type { ExtendedColumnFilter, FilterVariant } from "@/types/data-table";

export interface FieldEntry {
  /** OData field path, e.g. "name", "item", "things". */
  field: string;
  variant: FilterVariant;
}

export interface BuildAdvancedFilterParamsInput {
  page: number;
  pageSize: number;
  sort?: string;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
  fieldByColumnId: Record<string, FieldEntry>;
}

export function buildAdvancedFilterParams(
  _input: BuildAdvancedFilterParamsInput,
): URLSearchParams {
  throw new Error("not implemented");
}
