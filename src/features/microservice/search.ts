import { PAGE_SIZE_STEPS } from "@/lib/data-table";
import { ENVIRONMENTS, type Environment } from "./types";

/** A type alias, not an interface: it must stay assignable to
 *  `Record<string, unknown>`, which `useDataTable` requires of its search. */
export type MicroserviceSearch = {
  page: number;
  pageSize: number | undefined;
  sort: string;
  name: string | undefined;
  env: Environment[] | undefined;
  artifactId: string | undefined;
  topic: string | undefined;
};

export const DEFAULT_SORT = "name.asc";

/** The backend answers 400 to any other `$orderby`; strip it here so a
 *  hand-edited or bookmarked URL falls back instead of breaking the page. */
const ALLOWED_SORTS = new Set([
  "name.asc",
  "name.desc",
  "environment.asc",
  "environment.desc",
]);

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function environments(value: unknown): Environment[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const known = ENVIRONMENTS.filter((env) => raw.some((v) => v === env));
  return known.length > 0 ? known : undefined;
}

export function validateMicroserviceSearch(
  search: Record<string, unknown>,
): MicroserviceSearch {
  return {
    page:
      typeof search.page === "number" &&
      Number.isInteger(search.page) &&
      search.page >= 1
        ? search.page
        : 1,
    pageSize:
      typeof search.pageSize === "number" &&
      (PAGE_SIZE_STEPS as readonly number[]).includes(search.pageSize)
        ? search.pageSize
        : undefined,
    sort:
      typeof search.sort === "string" && ALLOWED_SORTS.has(search.sort)
        ? search.sort
        : DEFAULT_SORT,
    name: text(search.name),
    env: environments(search.env),
    artifactId: text(search.artifactId),
    topic: text(search.topic),
  };
}
