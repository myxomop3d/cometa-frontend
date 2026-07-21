import { z } from "zod";
import { dataTableConfig } from "@/config/data-table";
import type { ExtendedColumnFilter } from "@/types/data-table";

export interface FlowSwitchableSearch {
  page: number;
  pageSize: number | undefined;
  sort: string | undefined;
  advanced: boolean;
  // simple-mode filter params (mirrors flow filter-descriptors)
  key: string | undefined;
  caption: string | undefined;
  integrity: string[] | undefined;
  confidentiality: string[] | undefined;
  dataClass: string[] | undefined;
  dataType: string | undefined;
  // advanced-mode filter params
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export const SIMPLE_FILTER_KEYS = [
  "key",
  "caption",
  "integrity",
  "confidentiality",
  "dataClass",
  "dataType",
] as const;

const filterSchema = z.array(
  z.object({
    id: z.string(),
    operator: z.enum(dataTableConfig.operators),
    value: z.unknown(),
  }),
);

export function parseFilters(raw: unknown): ExtendedColumnFilter[] {
  let parsed: unknown = raw;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const result = filterSchema.safeParse(parsed);
  return result.success ? (result.data as ExtendedColumnFilter[]) : [];
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStrArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v.length > 0) return v.split(",");
  return undefined;
}

export function validateSearch(
  search: Record<string, unknown>,
): FlowSwitchableSearch {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    advanced: search.advanced === true || search.advanced === "true",
    key: asStr(search.key),
    caption: asStr(search.caption),
    integrity: asStrArray(search.integrity),
    confidentiality: asStrArray(search.confidentiality),
    dataClass: asStrArray(search.dataClass),
    dataType: asStr(search.dataType),
    filters: parseFilters(search.filters),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
  };
}

export function buildModeToggleUpdates(
  nextAdvanced: boolean,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    advanced: nextAdvanced ? true : undefined,
    page: 1,
  };
  for (const key of SIMPLE_FILTER_KEYS) updates[key] = undefined;
  updates.filters = undefined;
  updates.joinOperator = undefined;
  return updates;
}
