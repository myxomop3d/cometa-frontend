import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, PersonDto, PersonFilters } from "@/types/api";
import type { PersonWritePayload } from "./schema";
import { personFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<PersonDto, PersonFilters, PersonWritePayload>({
  basePath: "/api/v1/person",
  // Reads go through the entity-graph endpoint so both plain and any()
  // lambda filters (e.g. teams/any(...)) work consistently; create/patch/
  // fetchOne/remove stay on the plain resource path (`/graph` is read-only).
  // No `staticParams: { "$fields": "teams" }` here — the Teams display
  // column was deliberately deferred (see task-4 scope) to avoid triggering
  // Hibernate in-memory pagination (HHH90003004) on every Person list read.
  listPath: "/api/v1/person/graph",
  queryKey: ["persons"],
  filterDescriptors: personFilterDescriptors,
});

/** Combobox options: server-side search — $top=20 + $filter over last/first name. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["persons", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        const esc = odataString(q);
        params.set(
          "$filter",
          `contains_ignoring_case(lastName, '${esc}') or contains_ignoring_case(firstName, '${esc}')`,
        );
      }
      return apiFetch<ApiResponse<PersonDto[]>>(
        `/api/v1/person?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Options for `RelationPicker` (used by Task 13's Leader column filter).
 * The picker calls this with `{ name?, ids?, page?, pageSize? }` — a different
 * contract from `listQueryOptions`, which takes `PersonFilters` and emits plain
 * key=value params. Modeled on `fetchItemsFiltered` in `src/api/item.ts`.
 */
export async function fetchPersonsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<PersonDto[]>> {
  const params = new URLSearchParams();
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  params.set("$skip", String((Number(page) - 1) * Number(pageSize)));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];
  if (fieldFilters.name) {
    const esc = odataString(fieldFilters.name);
    clauses.push(
      `(contains_ignoring_case(lastName, '${esc}') or contains_ignoring_case(firstName, '${esc}'))`,
    );
  }
  if (Array.isArray(fieldFilters.ids) && fieldFilters.ids.length > 0) {
    const ids = (fieldFilters.ids as unknown[])
      .map(Number)
      .filter(Number.isFinite);
    if (ids.length > 0) {
      clauses.push(`id in (${ids.join(",")})`);
    }
  }
  if (clauses.length > 0) {
    params.set("$filter", clauses.join(" and "));
  }

  return apiFetch<ApiResponse<PersonDto[]>>(
    `/api/v1/person?${params.toString()}`,
  );
}

export function personsFilteredQueryOptions(
  filters: Record<string, unknown> = {},
) {
  return queryOptions({
    queryKey: ["persons", "relation-list", filters] as const,
    queryFn: () => fetchPersonsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}

export const personApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
};
