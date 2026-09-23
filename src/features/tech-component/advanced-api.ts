import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, TechComponentDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";
import { notifyLambdaCapped } from "@/lib/odata/notify-lambda-capped";

export const techComponentFieldByColumnId: Record<string, FieldEntry> = {
  name:            { field: "name",               variant: "text" },
  groupName:       { field: "groupName",          variant: "text" },
  technology:      { field: "technology",         variant: "text" },
  environment:     { field: "environment",        variant: "select" },
  consoleUrl:      { field: "consoleUrl",         variant: "text" },
  infoUrl:         { field: "infoUrl",            variant: "text" },
  automatedSystem: { field: "automatedSystem/id", variant: "relation", sortField: "automatedSystem/name" },
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
      "tech-components",
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
        fieldByColumnId: techComponentFieldByColumnId,
        onLambdaCapped: notifyLambdaCapped,
      });
      searchParams.set("$fields", "automatedSystem");
      return apiFetch<ApiResponse<TechComponentDto[]>>(
        `/api/v1/tech-component/graph?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
