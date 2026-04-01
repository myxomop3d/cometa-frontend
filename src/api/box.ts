import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, BoxDto, BoxFilters, CreateBoxDto } from "@/types/api";

const BASE = "/api/v1/box";

const STRING_FILTER_FIELDS = ["name", "objectCode"] as const;

function buildListParams(filters: BoxFilters): URLSearchParams {
  const { page = 1, pageSize = 20, sortBy, ...rest } = filters;
  const params = new URLSearchParams();
  params.set("$skip", String((page - 1) * pageSize));
  params.set("$top", String(pageSize));

  if (sortBy) {
    const orderby = sortBy
      .split(",")
      .map((s) => s.trim().replace(":", " "))
      .join(",");
    params.set("$orderby", orderby);
  }

  const clauses: string[] = [];

  for (const f of STRING_FILTER_FIELDS) {
    if (rest[f]) {
      clauses.push(
        `contains_ignoring_case(${f},'${String(rest[f]).replace(/'/g, "''")}')`
      );
    }
  }

  if (rest.tags) {
    clauses.push(
      `tags/any(t: contains_ignoring_case(t,'${rest.tags.replace(/'/g, "''")}'))`
    );
  }

  if (rest.shape) {
    clauses.push(`shape eq '${rest.shape}'`);
  }

  if (rest.numMin !== undefined) {
    clauses.push(`num ge ${rest.numMin}`);
  }
  if (rest.numMax !== undefined) {
    clauses.push(`num le ${rest.numMax}`);
  }

  if (rest.checkbox !== undefined) {
    clauses.push(`checkbox eq ${rest.checkbox}`);
  }

  if (rest.dateStrFrom) {
    clauses.push(`dateStr ge '${rest.dateStrFrom}'`);
  }
  if (rest.dateStrTo) {
    clauses.push(`dateStr le '${rest.dateStrTo}'`);
  }

  if (rest.itemId !== undefined) {
    clauses.push(`item/id eq ${rest.itemId}`);
  }

  if (rest.thingIds && rest.thingIds.length > 0) {
    const inner = rest.thingIds.map((id) => `t/id eq ${id}`).join(" or ");
    clauses.push(`things/any(t: ${inner})`);
  }

  if (rest.oldItemId !== undefined) {
    clauses.push(`oldItem/id eq ${rest.oldItemId}`);
  }

  if (rest.oldThingIds && rest.oldThingIds.length > 0) {
    const inner = rest.oldThingIds.map((id) => `t/id eq ${id}`).join(" or ");
    clauses.push(`oldThings/any(t: ${inner})`);
  }

  if (clauses.length > 0) {
    params.set("$filter", clauses.join(" and "));
  }
  return params;
}

export async function fetchBoxes(
  filters: BoxFilters = {},
): Promise<ApiResponse<BoxDto[]>> {
  const params = buildListParams(filters);
  const response = await fetch(`${BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch boxes: ${response.status}`);
  }
  return response.json();
}

export async function fetchBox(
  id: number,
): Promise<ApiResponse<BoxDto>> {
  const response = await fetch(`${BASE}/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch box ${id}: ${response.status}`);
  }
  return response.json();
}

export async function patchBox(
  id: number,
  data: Partial<BoxDto>,
): Promise<ApiResponse<BoxDto>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to patch box ${id}: ${response.status}`);
  }
  return response.json();
}

export async function createBox(
  data: CreateBoxDto,
): Promise<ApiResponse<BoxDto>> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create box: ${response.status}`);
  }
  return response.json();
}

export function boxesQueryOptions(filters: BoxFilters = {}) {
  return queryOptions({
    queryKey: ["boxes", "list", filters],
    queryFn: () => fetchBoxes(filters),
    placeholderData: keepPreviousData,
  });
}

export function boxQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["boxes", "detail", id],
    queryFn: () => fetchBox(id),
  });
}
