import { queryOptions } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import type {
  ApiResponse,
  TechComponentDto,
  TechComponentFilters,
} from "@/types/api";
import type { TechComponentWritePayload } from "./schema";
import { techComponentFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<
  TechComponentDto,
  TechComponentFilters,
  TechComponentWritePayload
>({
  basePath: "/api/v1/tech-component",
  // Reads go through the entity-graph endpoint so the backend populates the
  // nested `automatedSystem`; create/patch/remove stay on the plain resource
  // path (`/graph` is read-only).
  listPath: "/api/v1/tech-component/graph",
  queryKey: ["tech-components"],
  filterDescriptors: techComponentFilterDescriptors,
  staticParams: { "$fields": "automatedSystem" },
});

/** Overrides the base `detailQueryOptions`, which would hit `/{id}` — that
 *  handler ignores `$fields` and would return `automatedSystem: null`.
 *  Same reason as `src/features/automated-system/api.ts`. */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["tech-components", "detail", id] as const,
    queryFn: () =>
      apiFetch<ApiResponse<TechComponentDto>>(
        `/api/v1/tech-component/graph/${id}?$fields=automatedSystem`,
      ),
  });
}

// detailQueryOptions is spread AFTER ...baseApi so this one wins.
export const techComponentApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  detailQueryOptions,
};
