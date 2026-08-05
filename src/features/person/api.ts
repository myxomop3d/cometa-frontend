import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, PersonDto, PersonFilters } from "@/types/api";
import type { PersonWritePayload } from "./schema";
import { personFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<PersonDto, PersonFilters, PersonWritePayload>({
  basePath: "/api/v1/person",
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
  if (
    Array.isArray(fieldFilters.ids) &&
    (fieldFilters.ids as number[]).length > 0
  ) {
    clauses.push(`id in (${(fieldFilters.ids as number[]).join(",")})`);
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
    queryKey: ["persons", "list", filters] as const,
    queryFn: () => fetchPersonsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}

export const personApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
};
