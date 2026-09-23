import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface TechComponentFilterDescriptor extends FilterDescriptor {
  /** URL search-param name. NEVER rename one of these — bookmarked URLs break. */
  filterKey?: string;
}

export const techComponentFilterDescriptors: readonly TechComponentFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  // groupName/technology stay free text on purpose: their distinct-value
  // counts (8 / 3) are unbounded in principle, and a faceted select would
  // silently hide any value added later (the block/tribe/cluster precedent).
  { id: "groupName", variant: "text", filterKey: "groupName" },
  { id: "technology", variant: "text", filterKey: "technology" },
  { id: "environment", variant: "select", filterKey: "environment" },
  {
    id: "automatedSystem",
    variant: "relation",
    // To-one relation: a navigation path with `/`, never a dot. Filterable
    // AND sortable. Id 0 is the "Not set" sentinel — an ordinary row.
    field: "automatedSystem/id",
    sortField: "automatedSystem/name",
    filterKey: "automatedSystemId",
  },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of techComponentFilterDescriptors) {
    if (!d.filterKey) continue;
    const value = search[d.filterKey];
    if (value === undefined || value === null) continue;

    if (d.variant === "select") {
      filters.push({ id: d.id, value: Array.isArray(value) ? value : [value] });
    } else {
      filters.push({ id: d.id, value });
    }
  }
  return filters;
}
