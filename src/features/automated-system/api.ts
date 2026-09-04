import { queryOptions } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
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

/**
 * Overrides the base `detailQueryOptions`, which would hit `/{id}` — the
 * library's own handler, which ignores `$fields` and so would return
 * `leader: null`. `graph/{id}` is the path that honours it.
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
  detailQueryOptions,
};
