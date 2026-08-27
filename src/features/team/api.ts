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
 * Kept — and placed after `...baseApi` in the exported `teamApi` below so it
 * wins — for two reasons. (a) The user-registration flow pins its resolution
 * to this local implementation. (b) It is now load-bearing: this is the only
 * `detailQueryOptions` that appends `$fields=leader`. Since `TeamDto.leaderId`
 * was removed, that param is the sole source of the leader's id on this path —
 * without it `teamDtoToForm` yields `leaderId: 0` and the sheet reports
 * "Leader is required". Do not delete this as dead duplication; if it is ever
 * merged back into `baseApi`, the `$fields=leader` param must go with it.
 */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["teams", "detail", id] as const,
    // $fields=leader is required: since TeamDto.leaderId was removed, the
    // leader's id arrives only inside the nested ref. Without it,
    // teamDtoToForm yields leaderId 0 and the sheet reports a missing leader.
    queryFn: () =>
      apiFetch<ApiResponse<TeamDto>>(`/api/v1/team/${id}?$fields=leader`),
  });
}

/**
 * Options for `RelationPicker` (used by the Person table's Teams filter).
 * Same `{ name?, ids?, page?, pageSize? }` contract as `fetchPersonsFiltered`
 * in `src/features/person/api.ts`. Uses plain `/api/v1/team`.
 */
export async function fetchTeamsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<TeamDto[]>> {
  const params = new URLSearchParams();
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  params.set("$skip", String((Number(page) - 1) * Number(pageSize)));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];
  if (fieldFilters.name) {
    clauses.push(`contains_ignoring_case(name, '${odataString(fieldFilters.name)}')`);
  }
  if (Array.isArray(fieldFilters.ids) && fieldFilters.ids.length > 0) {
    const ids = (fieldFilters.ids as unknown[]).map(Number).filter(Number.isFinite);
    if (ids.length > 0) clauses.push(`id in (${ids.join(",")})`);
  }
  if (clauses.length > 0) params.set("$filter", clauses.join(" and "));

  return apiFetch<ApiResponse<TeamDto[]>>(`/api/v1/team?${params.toString()}`);
}

export function teamsFilteredQueryOptions(
  filters: Record<string, unknown> = {},
) {
  return queryOptions({
    queryKey: ["teams", "relation-list", filters] as const,
    queryFn: () => fetchTeamsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}

export const teamApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
  detailQueryOptions,
};
