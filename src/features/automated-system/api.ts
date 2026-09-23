import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type {
  ApiResponse,
  AutomatedSystemDto,
  AutomatedSystemFilters,
} from "@/types/api";
import type { AutomatedSystemWritePayload } from "./schema";
import { automatedSystemFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<
  AutomatedSystemDto,
  AutomatedSystemFilters,
  AutomatedSystemWritePayload
>({
  basePath: "/api/v1/automated-system",
  // Reads go through the entity-graph endpoint so the backend populates the
  // nested `leader`; create/patch/remove stay on the plain resource path
  // (`/graph` is read-only).
  listPath: "/api/v1/automated-system/graph",
  queryKey: ["automated-systems"],
  filterDescriptors: automatedSystemFilterDescriptors,
  staticParams: { "$fields": "leader" },
});

/** Combobox options: server-side search — $top=20 + $filter over name. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["automated-systems", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        params.set("$filter", `contains_ignoring_case(name, '${odataString(q)}')`);
      }
      return apiFetch<ApiResponse<AutomatedSystemDto[]>>(
        `/api/v1/automated-system?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * `RelationPicker` source (Tech Components' Automated System filter). Same
 * `{ name?, ids?, page?, pageSize? }` contract as `fetchPersonsFiltered`.
 * Id 0 (the "Not set" sentinel) is an ordinary row here.
 */
export async function fetchAutomatedSystemsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<AutomatedSystemDto[]>> {
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
    if (ids.length > 0) {
      clauses.push(`id in (${ids.join(",")})`);
    }
  }
  if (clauses.length > 0) {
    params.set("$filter", clauses.join(" and "));
  }

  return apiFetch<ApiResponse<AutomatedSystemDto[]>>(
    `/api/v1/automated-system?${params.toString()}`,
  );
}

export function automatedSystemsFilteredQueryOptions(
  filters: Record<string, unknown> = {},
) {
  return queryOptions({
    queryKey: ["automated-systems", "relation-list", filters] as const,
    queryFn: () => fetchAutomatedSystemsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * Overrides the base `detailQueryOptions`, which would hit `/{id}` — the
 * library's own handler, which ignores `$fields` and so would return
 * `leader: null`. `graph/{id}` is the path that honours it.
 *
 * No consumer today: the sheet seeds its form from `rowAction.row`, which
 * already comes from the `/graph?$fields=leader` list read. Kept per the
 * design spec (§6) as the correct override for any future consumer that
 * fetches a single row directly — do not delete as dead code, and do not
 * "fix" it back onto the base `{id}` path. (Team's equivalent override does
 * have a consumer today: `src/features/team/api.ts` → `team-combobox.tsx`.)
 */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["automated-systems", "detail", id] as const,
    queryFn: () =>
      apiFetch<ApiResponse<AutomatedSystemDto>>(
        `/api/v1/automated-system/graph/${id}?$fields=leader`,
      ),
  });
}

// detailQueryOptions is spread AFTER ...baseApi so this one wins.
export const automatedSystemApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
  detailQueryOptions,
};
