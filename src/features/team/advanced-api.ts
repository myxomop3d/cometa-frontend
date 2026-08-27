import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, TeamDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";
import { notifyLambdaCapped } from "@/lib/odata/notify-lambda-capped";

export const teamFieldByColumnId: Record<string, FieldEntry> = {
  name:       { field: "name",       variant: "text" },
  code:       { field: "code",       variant: "range" },
  type:       { field: "type",       variant: "select" },
  leader:     { field: "leader/id",  variant: "relation", sortField: "leader/lastName" },
  leaderRole: { field: "leaderRole", variant: "text" },
  structure:  { field: "structure",  variant: "text" },
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
      "teams",
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
        fieldByColumnId: teamFieldByColumnId,
        onLambdaCapped: notifyLambdaCapped,
      });
      searchParams.set("$fields", "leader");
      return apiFetch<ApiResponse<TeamDto[]>>(
        `/api/v1/team/graph?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
