import { z } from "zod";
import { dataTableConfig } from "@/config/data-table";
import type { ExtendedColumnFilter } from "@/types/data-table";

export interface BoxDiceSwitchableSearch {
  page: number;
  pageSize: number | undefined;
  sort: string | undefined;
  advanced: boolean;
  // simple-mode filter params (mirrors /box-dice)
  name: string | undefined;
  objectCode: string | undefined;
  shape: string[] | undefined;
  numMin: number | undefined;
  numMax: number | undefined;
  checkbox: boolean | undefined;
  dateStrFrom: string | undefined;
  dateStrTo: string | undefined;
  tags: string | undefined;
  itemId: number | undefined;
  thingIds: number[] | undefined;
  oldItemId: number | undefined;
  oldThingIds: number[] | undefined;
  // advanced-mode filter params (used when the "Advanced filters" toggle is on)
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

/** Simple-mode URL param keys — all cleared when the filter mode toggles. */
export const SIMPLE_FILTER_KEYS = [
  "name",
  "objectCode",
  "shape",
  "numMin",
  "numMax",
  "checkbox",
  "dateStrFrom",
  "dateStrTo",
  "tags",
  "itemId",
  "thingIds",
  "oldItemId",
  "oldThingIds",
] as const;

const filterSchema = z.array(
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

export function validateSearch(
  search: Record<string, unknown>,
): BoxDiceSwitchableSearch {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    advanced: search.advanced === true || search.advanced === "true",
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode:
      typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape: Array.isArray(search.shape)
      ? (search.shape as string[])
      : typeof search.shape === "string"
        ? search.shape.split(",")
        : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox:
      typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom:
      typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo:
      typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId:
      typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
    filters: parseFilters(search.filters),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
  };
}

/**
 * Updates object that flips the filter mode and clears every mode-specific
 * param (simple flat fields + advanced filters/joinOperator), resetting to
 * page 1. `advanced` is set to `undefined` when switching to simple so the URL
 * param drops entirely. The page's `onNavigate` strips undefined/null keys,
 * so this fully clears the previous mode's filters.
 */
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
