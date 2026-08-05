import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, TeamDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

export const teamFieldByColumnId: Record<string, FieldEntry> = {
  name:       { field: "name",       variant: "text" },
  code:       { field: "code",       variant: "range" },
  type:       { field: "type",       variant: "select" },
  leader:     { field: "leaderId",   sortField: "leader.lastName", variant: "relation" },
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
      });
      searchParams.set("fields", "leader");
      return apiFetch<ApiResponse<TeamDto[]>>(
        `/api/v1/team?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
