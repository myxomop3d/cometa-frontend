import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, AutomatedSystemDto, AutomatedSystemFilters } from "@/types/api";

const BASE = "/api/v1/automated-system";

const STRING_FILTER_FIELDS = [
  "name",
  "ci",
  "block",
  "tribe",
  "cluster",
  "status",
  "leader",
] as const;

// ── Fetch functions ─────────────────────────────────────────────────

function buildListParams(filters: AutomatedSystemFilters): URLSearchParams {
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  const params = new URLSearchParams();
  params.set("$skip", String((page - 1) * pageSize));
  params.set("$top", String(pageSize));

  const filterClauses = STRING_FILTER_FIELDS.filter(
    (f) => fieldFilters[f] !== undefined && fieldFilters[f] !== "",
  ).map((f) => `contains_ignoring_case(${f},'${String(fieldFilters[f]).replace(/'/g, "''")}')`);


  if (filterClauses.length > 0) {
    params.set("$filter", filterClauses.join(" and "));
  }
  return params;
}

export async function fetchAutomatedSystems(
  filters: AutomatedSystemFilters = {},
): Promise<ApiResponse<AutomatedSystemDto[]>> {
  const params = buildListParams(filters);
  const response = await fetch(`${BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated systems: ${response.status}`);
  }
  return response.json();
}

export async function fetchAutomatedSystem(
  id: number,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`${BASE}/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated system ${id}: ${response.status}`);
  }
  return response.json();
}

export async function fetchAutomatedSystemsGraph(
  filters: AutomatedSystemFilters = {},
  fields?: string,
): Promise<ApiResponse<AutomatedSystemDto[]>> {
  const params = buildListParams(filters);
  if (fields) {
    params.set("$fields", fields);
  }
  const response = await fetch(`${BASE}/graph?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated systems graph: ${response.status}`);
  }
  return response.json();
}

export async function fetchAutomatedSystemGraph(
  id: number,
  fields?: string,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const params = new URLSearchParams();
  if (fields) {
    params.set("$fields", fields);
  }
  const query = params.toString();
  const response = await fetch(`${BASE}/graph/${id}${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated system graph ${id}: ${response.status}`);
  }
  return response.json();
}

// ── Mutations ───────────────────────────────────────────────────────

export async function createAutomatedSystem(
  data: Omit<AutomatedSystemDto, "id">,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create automated system: ${response.status}`);
  }
  return response.json();
}

export async function updateAutomatedSystem(
  id: number,
  data: AutomatedSystemDto,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update automated system ${id}: ${response.status}`);
  }
  return response.json();
}

export async function patchAutomatedSystem(
  id: number,
  data: Partial<AutomatedSystemDto>,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to patch automated system ${id}: ${response.status}`);
  }
  return response.json();
}

export async function deleteAutomatedSystem(
  id: number,
): Promise<ApiResponse<string>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete automated system ${id}: ${response.status}`);
  }
  return response.json();
}

// ── Query options ───────────────────────────────────────────────────

export function automatedSystemsQueryOptions(filters: AutomatedSystemFilters = {}) {
  return queryOptions({
    queryKey: ["automated-systems", "list", filters],
    queryFn: () => fetchAutomatedSystems(filters),
    placeholderData: keepPreviousData,
  });
}

export function automatedSystemQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["automated-systems", "detail", id],
    queryFn: () => fetchAutomatedSystem(id),
  });
}

export function automatedSystemsGraphQueryOptions(
  filters: AutomatedSystemFilters = {},
  fields?: string,
) {
  return queryOptions({
    queryKey: ["automated-systems", "graph-list", filters, fields],
    queryFn: () => fetchAutomatedSystemsGraph(filters, fields),
    placeholderData: keepPreviousData,
  });
}

export function automatedSystemGraphQueryOptions(id: number, fields?: string) {
  return queryOptions({
    queryKey: ["automated-systems", "graph-detail", id, fields],
    queryFn: () => fetchAutomatedSystemGraph(id, fields),
  });
}
