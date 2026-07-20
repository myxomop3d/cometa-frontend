import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface FlowFilterDescriptor extends FilterDescriptor {
  filterKey?: string;
}

export const flowFilterDescriptors: readonly FlowFilterDescriptor[] = [
  { id: "key", variant: "text", filterKey: "key" },
  { id: "caption", variant: "text", filterKey: "caption" },
  { id: "integrity", variant: "select", filterKey: "integrity" },
  { id: "confidentiality", variant: "select", filterKey: "confidentiality" },
  { id: "dataClass", variant: "select", filterKey: "dataClass" },
  { id: "dataType", variant: "text", filterKey: "dataType" },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of flowFilterDescriptors) {
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
