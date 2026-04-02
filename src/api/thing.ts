import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, ThingDto } from "@/types/api";

const BASE = "/api/v1/thing";

export async function fetchThings(): Promise<ApiResponse<ThingDto[]>> {
  const response = await fetch(BASE);
  if (!response.ok) {
    throw new Error(`Failed to fetch things: ${response.status}`);
  }
  return response.json();
}

export async function fetchThingsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<ThingDto[]>> {
  const params = new URLSearchParams();
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  params.set("$skip", String((Number(page) - 1) * Number(pageSize)));
  params.set("$top", String(pageSize));

  const filterClauses: string[] = [];
  if (fieldFilters.name) {
    filterClauses.push(
      `contains_ignoring_case(name,'${String(fieldFilters.name).replace(/'/g, "''")}')`
    );
  }
  if (filterClauses.length > 0) {
    params.set("$filter", filterClauses.join(" and "));
  }

  const response = await fetch(`${BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch things: ${response.status}`);
  }
  return response.json();
}

export function thingsQueryOptions() {
  return queryOptions({
    queryKey: ["things", "all"],
    queryFn: () => fetchThings(),
    placeholderData: keepPreviousData,
  });
}

export function thingsFilteredQueryOptions(filters: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: ["things", "list", filters],
    queryFn: () => fetchThingsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}
