import { createCrudApi } from "@/lib/api/create-crud-api";
import type { BoxDto, BoxFilters } from "@/types/api";
import type { BoxWritePayload } from "./schema";
import { boxFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<BoxDto, BoxFilters, BoxWritePayload>({
  basePath: "/api/v1/box",
  queryKey: ["boxes"],
  filterDescriptors: boxFilterDescriptors,
});

export const boxApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
};
