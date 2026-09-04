import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, AutomatedSystemDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";
import { notifyLambdaCapped } from "@/lib/odata/notify-lambda-capped";

export const automatedSystemFieldByColumnId: Record<string, FieldEntry> = {
  name:          { field: "name",          variant: "text" },
  ci:            { field: "ci",            variant: "text" },
  block:         { field: "block",         variant: "text" },
  tribe:         { field: "tribe",         variant: "text" },
  cluster:       { field: "cluster",       variant: "text" },
  status:        { field: "status",        variant: "select" },
  leaderComment: { field: "leaderComment", variant: "text" },
  leader:        { field: "leader/id",     variant: "relation", sortField: "leader/lastName" },
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
      "automated-systems",
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
        fieldByColumnId: automatedSystemFieldByColumnId,
        onLambdaCapped: notifyLambdaCapped,
      });
      searchParams.set("$fields", "leader");
      return apiFetch<ApiResponse<AutomatedSystemDto[]>>(
        `/api/v1/automated-system/graph?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
