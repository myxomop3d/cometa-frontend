import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, PersonDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";
import { notifyLambdaCapped } from "@/lib/odata/notify-lambda-capped";

export const personFieldByColumnId: Record<string, FieldEntry> = {
  email:      { field: "email",      variant: "text" },
  lastName:   { field: "lastName",   variant: "text" },
  firstName:  { field: "firstName",  variant: "text" },
  middleName: { field: "middleName", variant: "text" },
  teams:      { field: "teams",      variant: "multiRelation" },
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
      "persons",
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
        fieldByColumnId: personFieldByColumnId,
        onLambdaCapped: notifyLambdaCapped,
      });
      return apiFetch<ApiResponse<PersonDto[]>>(
        `/api/v1/person/graph?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
