import { techComponentApi } from "./api";
import { getTechComponentColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { TechComponentDto } from "@/types/api";
import type { TechComponentRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const techComponentSimpleFilterKeys = [
  "name",
  "groupName",
  "technology",
  "environment",
  "automatedSystemId",
] as const;

export const techComponentSwitchableConfig: SwitchableTableConfig<
  TechComponentDto,
  TechComponentRowAction
> = {
  queryKey: ["tech-components"],
  simpleQueryOptions: (p) => techComponentApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => techComponentApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: techComponentSimpleFilterKeys,
  getColumns: getTechComponentColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
  // 7 / 2 of 30 rows have a value (2026-09-24).
  initialColumnVisibility: { consoleUrl: false, infoUrl: false },
};
