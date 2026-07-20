import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, FlowDto, FlowFilters } from "@/types/api";
import type { FlowWritePayload } from "./schema";
import { flowFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<FlowDto, FlowFilters, FlowWritePayload>({
  basePath: "/api/v1/flow",
  queryKey: ["flows"],
  filterDescriptors: flowFilterDescriptors,
});

/** Combobox options: server-side search — $top=20 + $filter over caption/key. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["flows", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        const esc = odataString(q);
        params.set(
          "$filter",
          `contains_ignoring_case(caption, '${esc}') or contains_ignoring_case(key, '${esc}')`,
        );
      }
      return apiFetch<ApiResponse<FlowDto[]>>(
        `/api/v1/flow?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

export const flowApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
};
