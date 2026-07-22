import { flowApi } from "./api";
import { getFlowColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { FlowDto } from "@/types/api";
import type { FlowRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const flowSimpleFilterKeys = [
  "key",
  "caption",
  "integrity",
  "confidentiality",
  "dataClass",
  "dataType",
] as const;

export const flowSwitchableConfig: SwitchableTableConfig<FlowDto, FlowRowAction> = {
  queryKey: ["flows"],
  simpleQueryOptions: (p) => flowApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => flowApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: flowSimpleFilterKeys,
  getColumns: getFlowColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
};
