import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface TeamFilterDescriptor extends FilterDescriptor {
  filterKey?: string;
  filterKeys?: [string, string];
}

export const teamFilterDescriptors: readonly TeamFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  { id: "code", variant: "range", filterKeys: ["codeMin", "codeMax"] },
  { id: "type", variant: "select", filterKey: "type" },
  {
    id: "leader",
    variant: "relation",
    field: "leaderId",
    filterKey: "leaderId",
  },
  { id: "leaderRole", variant: "text", filterKey: "leaderRole" },
  { id: "structure", variant: "text", filterKey: "structure" },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of teamFilterDescriptors) {
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

    if (d.variant === "select") {
      filters.push({ id: d.id, value: Array.isArray(value) ? value : [value] });
    } else {
      filters.push({ id: d.id, value });
    }
  }
  return filters;
}
