/**
 * Legacy shim — delegates to the new feature module where possible. The older
 * `/box` route still imports from this path; the preferred entry point for new
 * code is `@/features/box/api`.
 *
 * The legacy route uses the flat `BoxFilters` shape (not TanStack Table's
 * `ColumnFiltersState`), so we keep a dedicated OData query builder here that
 * supports the route's exact filter set — including the `tags/any(...)` clause
 * that the generic `buildFilterParams` doesn't model.
 */
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, BoxDto, BoxFilters } from "@/types/api";
import { boxApi } from "@/features/box/api";
import type { BoxWritePayload } from "@/features/box/schema";

const BASE = "/api/v1/box";

function escape(v: string): string {
  return v.replace(/'/g, "''");
}

function buildLegacyBoxParams(filters: BoxFilters): URLSearchParams {
  const { page = 1, pageSize = 20, ...rest } = filters;
  const params = new URLSearchParams();
  params.set("$skip", String((page - 1) * pageSize));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];

  if (rest.name) {
    clauses.push(`contains_ignoring_case(name,'${escape(rest.name)}')`);
  }
  if (rest.objectCode) {
    clauses.push(
      `contains_ignoring_case(objectCode,'${escape(rest.objectCode)}')`,
    );
  }
  if (rest.tags) {
    clauses.push(
      `tags/any(t: contains_ignoring_case(t,'${escape(rest.tags)}'))`,
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
    clauses.push(`dateStr ge '${escape(rest.dateStrFrom)}'`);
  }
  if (rest.dateStrTo) {
    clauses.push(`dateStr le '${escape(rest.dateStrTo)}'`);
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
  const params = buildLegacyBoxParams(filters);
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch boxes: ${res.status}`);
  }
  return res.json();
}

export function boxesQueryOptions(filters: BoxFilters = {}) {
  return queryOptions({
    queryKey: ["boxes", "legacy-list", filters] as const,
    queryFn: () => fetchBoxes(filters),
    placeholderData: keepPreviousData,
  });
}

export function boxQueryOptions(id: number) {
  return boxApi.detailQueryOptions(id);
}

/**
 * Legacy patch entry point. The legacy route only edits flat scalar fields
 * (name, objectCode, shape, num, dateStr, checkbox), which are structurally
 * identical between `BoxDto` and `BoxWritePayload`, so the cast is safe for
 * that caller. Do not use this for relation edits — go through `boxApi.patch`
 * with a proper `BoxWritePayload` instead.
 */
export function patchBox(id: number, data: Partial<BoxDto>) {
  return boxApi.patch(id, data as Partial<BoxWritePayload>);
}

export async function fetchBox(id: number) {
  return boxApi.fetchOne(id);
}
