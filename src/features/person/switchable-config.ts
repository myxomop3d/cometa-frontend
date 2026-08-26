import { personApi } from "./api";
import { getPersonColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { PersonDto } from "@/types/api";
import type { PersonRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const personSimpleFilterKeys = [
  "email",
  "lastName",
  "firstName",
  "middleName",
  "teamIds",
] as const;

export const personSwitchableConfig: SwitchableTableConfig<
  PersonDto,
  PersonRowAction
> = {
  queryKey: ["persons"],
  simpleQueryOptions: (p) => personApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => personApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: personSimpleFilterKeys,
  getColumns: getPersonColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
};
