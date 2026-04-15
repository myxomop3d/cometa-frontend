import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, FlowDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

export const flowFieldByColumnId: Record<string, FieldEntry> = {
  code:            { field: "code",            variant: "text" },
  caption:         { field: "caption",         variant: "text" },
  integrity:       { field: "integrity",       variant: "select" },
  confidentiality: { field: "confidentiality", variant: "select" },
  dataClass:       { field: "dataClass",       variant: "select" },
  dataType:        { field: "dataType",        variant: "text" },
  state:           { field: "state",           variant: "select" },
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
      "flows",
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
        fieldByColumnId: flowFieldByColumnId,
      });
      return apiFetch<ApiResponse<FlowDto[]>>(
        `/api/v1/flow?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
