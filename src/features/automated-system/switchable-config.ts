import { automatedSystemApi } from "./api";
import { getAutomatedSystemColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { AutomatedSystemDto } from "@/types/api";
import type { AutomatedSystemRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const automatedSystemSimpleFilterKeys = [
  "name",
  "ci",
  "block",
  "tribe",
  "cluster",
  "status",
  "leaderComment",
  "leaderId",
] as const;

export const automatedSystemSwitchableConfig: SwitchableTableConfig<
  AutomatedSystemDto,
  AutomatedSystemRowAction
> = {
  queryKey: ["automated-systems"],
  simpleQueryOptions: (p) => automatedSystemApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => automatedSystemApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: automatedSystemSimpleFilterKeys,
  getColumns: getAutomatedSystemColumns,
  // `name` is pinned left to preserve the sticky first column the old page had.
  initialColumnPinning: { left: ["select", "id", "name"], right: ["actions"] },
  initialColumnVisibility: { guid: false },
};
