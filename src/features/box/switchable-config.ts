import { boxApi } from "./api";
import { getBoxColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { BoxDto } from "@/types/api";
import type { BoxRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const boxSimpleFilterKeys = [
  "name",
  "objectCode",
  "shape",
  "numMin",
  "numMax",
  "checkbox",
  "dateStrFrom",
  "dateStrTo",
  "tags",
  "itemId",
  "thingIds",
  "oldItemId",
  "oldThingIds",
] as const;

export const boxSwitchableConfig: SwitchableTableConfig<BoxDto, BoxRowAction> = {
  queryKey: ["boxes"],
  simpleQueryOptions: (p) => boxApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => boxApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: boxSimpleFilterKeys,
  getColumns: getBoxColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
  initialColumnVisibility: { "item.name": false },
};
