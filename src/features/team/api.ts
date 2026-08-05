import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, TeamDto, TeamFilters } from "@/types/api";
import type { TeamWritePayload } from "./schema";
import { teamFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<TeamDto, TeamFilters, TeamWritePayload>({
  basePath: "/api/v1/team",
  queryKey: ["teams"],
  filterDescriptors: teamFilterDescriptors,
  staticParams: { fields: "leader" },
});

/** Combobox options: server-side search — $top=20 + $filter over team name. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["teams", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        const esc = odataString(q);
        params.set("$filter", `contains_ignoring_case(name, '${esc}')`);
      }
      return apiFetch<ApiResponse<TeamDto[]>>(`/api/v1/team?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

/** Resolve a selected team's label by id (may fall outside the top-20 set). */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["teams", "detail", id] as const,
    queryFn: () => apiFetch<ApiResponse<TeamDto>>(`/api/v1/team/${id}`),
  });
}

export const teamApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
  detailQueryOptions,
};
