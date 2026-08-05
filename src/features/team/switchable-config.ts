import { teamApi } from "./api";
import { getTeamColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { TeamDto } from "@/types/api";
import type { TeamRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const teamSimpleFilterKeys = [
  "name",
  "codeMin",
  "codeMax",
  "type",
  "leaderId",
  "leaderRole",
  "structure",
] as const;

export const teamSwitchableConfig: SwitchableTableConfig<TeamDto, TeamRowAction> = {
  queryKey: ["teams"],
  simpleQueryOptions: (p) => teamApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => teamApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: teamSimpleFilterKeys,
  getColumns: getTeamColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
};
