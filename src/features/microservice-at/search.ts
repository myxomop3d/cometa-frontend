import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

/** A type alias, not an interface: it must stay assignable to
 *  `Record<string, unknown>`, which `useDataTable` requires of its search. */
export type MicroserviceAtSearch = {
  page: number;
  pageSize: number | undefined;
  sort: string;
  name: string | undefined;
};

export const DEFAULT_SORT = "name.asc";

/** `name` is the only sortable field. `sort` flows unchecked into `$orderby`,
 *  so anything else in a hand-edited URL is replaced here. */
const ALLOWED_SORTS = new Set(["name.asc", "name.desc"]);

export function validateMicroserviceAtSearch(
  search: Record<string, unknown>,
): MicroserviceAtSearch {
  return {
    page: typeof search.page === "number" && search.page >= 1 ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort:
      typeof search.sort === "string" && ALLOWED_SORTS.has(search.sort)
        ? search.sort
        : DEFAULT_SORT,
    name:
      typeof search.name === "string" && search.name.length > 0
        ? search.name
        : undefined,
  };
}

export const microserviceAtFilterDescriptors: readonly FilterDescriptor[] = [
  { id: "name", variant: "text" },
];

export function deriveColumnFilters(
  search: MicroserviceAtSearch,
): { id: string; value: unknown }[] {
  return search.name ? [{ id: "name", value: search.name }] : [];
}
