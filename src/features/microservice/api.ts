import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/create-crud-api";
import type { ApiResponse } from "@/types/api";
import type { MicroserviceSearch } from "./search";
import type { MicroserviceOverviewDto } from "./types";

export const MICROSERVICE_QUERY_KEY = ["microservice"] as const;

const ENDPOINT = "/api/v1/microservice-overview";

/** Plain params, not OData: the endpoint is a native-SQL read model that
 *  OData cannot express (a jsonb field inside a to-many relation, and a
 *  `cross_guid` self-join). Only `$top`/`$skip`/`$orderby` keep the CRUD
 *  names. Spec: docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md */
export function buildMicroserviceParams(
  search: MicroserviceSearch,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("$top", String(pageSize));
  params.set("$skip", String((search.page - 1) * pageSize));
  // `sort` is whitelisted to a single `field.dir` in validateMicroserviceSearch.
  const [field, dir] = search.sort.split(".");
  params.set("$orderby", `${field} ${dir}`);
  if (search.name) params.set("name", search.name);
  for (const env of search.env ?? []) params.append("env", env);
  if (search.artifactId) params.set("artifactId", search.artifactId);
  if (search.topic) params.set("topic", search.topic);
  return params;
}

export function microserviceQueryOptions(
  search: MicroserviceSearch,
  pageSize: number,
) {
  return queryOptions({
    queryKey: [...MICROSERVICE_QUERY_KEY, "table", search, pageSize] as const,
    queryFn: () =>
      apiFetch<ApiResponse<MicroserviceOverviewDto[]>>(
        `${ENDPOINT}?${buildMicroserviceParams(search, pageSize)}`,
      ),
  });
}
