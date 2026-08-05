import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

/**
 * Pure descriptor list used by the route loader to derive column filters
 * from search params, and by the CRUD api to build OData $filter clauses.
 *
 * Each entry binds a column id to its variant and (optionally) the URL
 * search-param key(s) it reads from.
 */
export interface BoxFilterDescriptor extends FilterDescriptor {
  /** Single URL search-param key. */
  filterKey?: string;
  /** Paired URL search-param keys for range/dateRange variants. */
  filterKeys?: [string, string];
}

export const boxFilterDescriptors: readonly BoxFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  { id: "objectCode", variant: "text", filterKey: "objectCode" },
  { id: "shape", variant: "select", filterKey: "shape" },
  { id: "num", variant: "range", filterKeys: ["numMin", "numMax"] },
  { id: "item", variant: "relation", field: "itemId", filterKey: "itemId" },
  { id: "things", variant: "multiRelation", filterKey: "thingIds" },
  { id: "oldItem", variant: "relation", field: "oldItemId", filterKey: "oldItemId" },
  { id: "oldThings", variant: "multiRelation", filterKey: "oldThingIds" },
  {
    id: "dateStr",
    variant: "dateRange",
    filterKeys: ["dateStrFrom", "dateStrTo"],
  },
  { id: "checkbox", variant: "boolean", filterKey: "checkbox" },
  { id: "tags", variant: "text", filterKey: "tags" },
] as const;

/**
 * Derive TanStack Table column filters from URL search params using the
 * descriptor list. Pure — no table dependency.
 */
export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of boxFilterDescriptors) {
    if (d.filterKeys) {
      const [k1, k2] = d.filterKeys;
      const v1 = search[k1];
      const v2 = search[k2];
      if (v1 !== undefined || v2 !== undefined) {
        filters.push({ id: d.id, value: [v1, v2] });
      }
      continue;
    }
    if (!d.filterKey) continue;
    const value = search[d.filterKey];
    if (value === undefined || value === null) continue;

    if (d.variant === "multiSelect" || d.variant === "multiRelation") {
      filters.push({
        id: d.id,
        value: Array.isArray(value) ? value : [value],
      });
    } else if (d.variant === "boolean") {
      filters.push({
        id: d.id,
        value: typeof value === "boolean" ? [String(value)] : [value],
      });
    } else {
      filters.push({ id: d.id, value });
    }
  }
  return filters;
}
