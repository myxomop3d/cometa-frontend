import { createCrudApi } from "@/lib/api/create-crud-api";
import type { FlowDto, FlowFilters } from "@/types/api";
import type { FlowWritePayload } from "./schema";
import { flowFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<FlowDto, FlowFilters, FlowWritePayload>({
  basePath: "/api/v1/flow",
  queryKey: ["flows"],
  filterDescriptors: flowFilterDescriptors,
});

export const flowApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
};
