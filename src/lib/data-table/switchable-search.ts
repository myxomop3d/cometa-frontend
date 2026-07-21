import { z } from "zod";
import { dataTableConfig } from "@/config/data-table";
import type { ExtendedColumnFilter } from "@/types/data-table";

export interface SwitchableSearchBase {
  page: number;
  pageSize: number | undefined;
  sort: string | undefined;
  advanced: boolean;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export const filterSchema = z.array(
  z.object({
    id: z.string(),
    operator: z.enum(dataTableConfig.operators),
    value: z.unknown(),
  }),
);

export function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(Number).filter((n) => !isNaN(n));
  }
  return undefined;
}

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

/**
 * Builds a route `validateSearch` from a resource's simple-field validator,
 * layering it onto the common (page/pageSize/sort/advanced) and advanced
 * (filters/joinOperator) fields shared by every switchable table page.
 */
export function makeSwitchableSearch<TSimple extends Record<string, unknown>>(
  validateSimpleFields: (search: Record<string, unknown>) => TSimple,
): (search: Record<string, unknown>) => SwitchableSearchBase & TSimple {
  return (search) => ({
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    advanced: search.advanced === true || search.advanced === "true",
    filters: parseFilters(search.filters),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
    ...validateSimpleFields(search),
  });
}

/**
 * Updates that flip filter mode and clear every mode-specific param. `advanced`
 * is set undefined when switching to simple so the URL param drops. The page's
 * onNavigate strips undefined/null keys, fully clearing the previous mode.
 */
export function buildModeToggleUpdates(
  simpleFilterKeys: readonly string[],
  nextAdvanced: boolean,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    advanced: nextAdvanced ? true : undefined,
    page: 1,
  };
  for (const key of simpleFilterKeys) updates[key] = undefined;
  updates.filters = undefined;
  updates.joinOperator = undefined;
  return updates;
}
