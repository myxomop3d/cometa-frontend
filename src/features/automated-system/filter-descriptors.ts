import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface AutomatedSystemFilterDescriptor extends FilterDescriptor {
  /** URL search-param name. NEVER rename one of these — bookmarked URLs break. */
  filterKey?: string;
}

export const automatedSystemFilterDescriptors: readonly AutomatedSystemFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  { id: "ci", variant: "text", filterKey: "ci" },
  // block/tribe/cluster stay free text on purpose: their distinct-value counts
  // (16 / 32 / 45) are unbounded in principle, and a faceted select would
  // silently hide any value added later.
  { id: "block", variant: "text", filterKey: "block" },
  { id: "tribe", variant: "text", filterKey: "tribe" },
  { id: "cluster", variant: "text", filterKey: "cluster" },
  { id: "status", variant: "select", filterKey: "status" },
  { id: "leaderComment", variant: "text", filterKey: "leaderComment" },
  {
    id: "leader",
    variant: "relation",
    // To-one relation: a navigation path with `/`, never a dot (a dot is an
    // ANTLR parse error). Filterable AND sortable — the any() restrictions
    // apply only to to-many relations. Requires
    // odata.mini.repo.throw-on-field-not-found: false on the backend.
    field: "leader/id",
    sortField: "leader/lastName",
    filterKey: "leaderId",
  },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of automatedSystemFilterDescriptors) {
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
