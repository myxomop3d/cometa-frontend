import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, BoxDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

/**
 * Column-id -> OData field mapping for the advanced filter builder.
 * Kept separate from the URL-param-driven `boxFilterDescriptors` so the
 * two filter pipelines don't entangle.
 */
export const boxFieldByColumnId: Record<string, FieldEntry> = {
  name:       { field: "name",       variant: "text" },
  objectCode: { field: "objectCode", variant: "text" },
  shape:      { field: "shape",      variant: "select" },
  num:        { field: "num",        variant: "range" },
  dateStr:    { field: "dateStr",    variant: "dateRange" },
  checkbox:   { field: "checkbox",   variant: "boolean" },
  tags:       { field: "tags",       variant: "text" },
  item:       { field: "itemId",     variant: "relation" },
  "item.name": { field: "item/name", variant: "text" },
  things:     { field: "things",     variant: "multiRelation" },
  oldItem:    { field: "oldItemId",  variant: "relation" },
  oldThings:  { field: "oldThings",  variant: "multiRelation" },
};

export interface AdvancedDataTableQueryParams {
  page: number;
  pageSize: number;
  sort?: string;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export function advancedDataTableQueryOptions(
  params: AdvancedDataTableQueryParams,
) {
  return queryOptions({
    queryKey: [
      "boxes",
      "advanced",
      params.page,
      params.pageSize,
      params.sort,
      params.filters,
      params.joinOperator,
    ] as const,
    queryFn: () => {
      const searchParams = buildAdvancedFilterParams({
        ...params,
        fieldByColumnId: boxFieldByColumnId,
      });
      return apiFetch<ApiResponse<BoxDto[]>>(
        `/api/v1/box?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
