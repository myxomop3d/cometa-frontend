import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, ItemDto } from "@/types/api";

const BASE = "/api/v1/item";

export async function fetchItems(): Promise<ApiResponse<ItemDto[]>> {
  const response = await fetch(BASE);
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.status}`);
  }
  return response.json();
}

export async function fetchItemsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<ItemDto[]>> {
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
    throw new Error(`Failed to fetch items: ${response.status}`);
  }
  return response.json();
}

export function itemsQueryOptions() {
  return queryOptions({
    queryKey: ["items", "all"],
    queryFn: () => fetchItems(),
    placeholderData: keepPreviousData,
  });
}

export function itemsFilteredQueryOptions(filters: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: ["items", "list", filters],
    queryFn: () => fetchItemsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}
