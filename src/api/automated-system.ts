import type { ApiResponse, AutomatedSystemDto, AutomatedSystemFilters } from "@/types/api";

const STRING_FILTER_FIELDS = [
  "name",
  "ci",
  "block",
  "tribe",
  "cluster",
  "status",
  "leader",
] as const;

export async function fetchAutomatedSystems(
  filters: AutomatedSystemFilters = {},
): Promise<ApiResponse<AutomatedSystemDto[]>> {
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;

  const params = new URLSearchParams();
  params.set("$skip", String((page - 1) * pageSize));
  params.set("$top", String(pageSize));

  const filterClauses = STRING_FILTER_FIELDS.filter(
    (f) => fieldFilters[f] !== undefined && fieldFilters[f] !== "",
  ).map((f) => `contains(${f},'${fieldFilters[f]}')`);

  if (filterClauses.length > 0) {
    params.set("$filter", filterClauses.join(" and "));
  }

  const response = await fetch(`/api/v1/automated-system?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated systems: ${response.status}`);
  }
  return response.json();
}
