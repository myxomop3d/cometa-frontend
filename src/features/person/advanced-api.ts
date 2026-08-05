import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, PersonDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

export const personFieldByColumnId: Record<string, FieldEntry> = {
  email:      { field: "email",      variant: "text" },
  lastName:   { field: "lastName",   variant: "text" },
  firstName:  { field: "firstName",  variant: "text" },
  middleName: { field: "middleName", variant: "text" },
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
      });
      return apiFetch<ApiResponse<PersonDto[]>>(
        `/api/v1/person?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
