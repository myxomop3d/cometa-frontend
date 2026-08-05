import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, TeamDto, TeamFilters } from "@/types/api";
import type { TeamWritePayload } from "./schema";
import { teamFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<TeamDto, TeamFilters, TeamWritePayload>({
  basePath: "/api/v1/team",
  // Reads go through the entity-graph endpoint so the backend populates the
  // nested `leader` relation; create/patch/fetchOne/remove stay on the plain
  // resource path (`/graph` is read-only). See `issue/relationSorting.md`.
  listPath: "/api/v1/team/graph",
  queryKey: ["teams"],
  filterDescriptors: teamFilterDescriptors,
  staticParams: { "$fields": "leader" },
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

/**
 * Resolve a selected team's label by id (may fall outside the top-20 set).
 *
 * This is now behaviourally identical to the `detailQueryOptions` that
 * `createCrudApi` generates on `baseApi` (same query key, same URL). It is
 * kept — and placed after `...baseApi` in the exported `teamApi` below so it
 * wins — because the user-registration flow pins its resolution to this
 * local implementation. Do not delete this as dead duplication.
 */
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
