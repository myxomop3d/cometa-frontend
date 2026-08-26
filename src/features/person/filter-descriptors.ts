import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface PersonFilterDescriptor extends FilterDescriptor {
  filterKey?: string;
}

export const personFilterDescriptors: readonly PersonFilterDescriptor[] = [
  { id: "email", variant: "text", filterKey: "email" },
  { id: "lastName", variant: "text", filterKey: "lastName" },
  { id: "firstName", variant: "text", filterKey: "firstName" },
  { id: "middleName", variant: "text", filterKey: "middleName" },
  { id: "teams", variant: "multiRelation", field: "teams", filterKey: "teamIds" },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of personFilterDescriptors) {
    if (!d.filterKey) continue;
    const value = search[d.filterKey];
    if (value === undefined || value === null) continue;
    filters.push({ id: d.id, value });
  }
  return filters;
}
