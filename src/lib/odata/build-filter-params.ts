import type { ColumnFiltersState } from "@tanstack/react-table";
import type { FilterVariant } from "@/types/data-table";

/**
 * Escape a value for safe inclusion inside an OData string literal.
 * Doubles single-quotes per spec: O'Brien -> O''Brien.
 */
export function odataString(v: unknown): string {
  return String(v).replace(/'/g, "''");
}

/** Reported when more than one collection `any()` lambda was requested and
 *  one had to be dropped. `keptField` is the OData field name of the lambda
 *  that survived (e.g. "things" for "things/any(x: x/id in (1,2))"). */
export interface CappedLambdaInfo {
  keptField: string;
  droppedCount: number;
}

/**
 * Join scalar clauses with the (at most one) collection `any()` lambda
 * appended last, or return null if there's nothing to filter on.
 *
 * odata-mini corrupts the root alias for every clause parsed after the first
 * `any()` lambda, so lambda clauses are capped at one and always emitted
 * last; a second one is dropped with a console warning rather than silently
 * lost. See §3 of
 * docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md
 *
 * `onCapped` is an optional side-channel for a caller in a React layer (e.g.
 * a queryFn) to surface a user-facing toast; this function stays pure aside
 * from that opt-in callback and never triggers UI itself.
 */
export function joinWithCappedLambdas({
  clauses,
  lambdaClauses,
  separator,
  onCapped,
}: {
  clauses: string[];
  lambdaClauses: string[];
  separator: string;
  onCapped?: (info: CappedLambdaInfo) => void;
}): string | null {
  if (lambdaClauses.length > 1) {
    console.warn(
      `[odata] ${lambdaClauses.length} collection filters were requested but only ` +
        `"${lambdaClauses[0]}" was sent: odata-mini corrupts the root alias after ` +
        `the first any() lambda.`,
    );
    onCapped?.({
      keptField: lambdaClauses[0].split("/any(")[0],
      droppedCount: lambdaClauses.length - 1,
    });
  }
  const allClauses = [...clauses, ...lambdaClauses.slice(0, 1)];
  return allClauses.length > 0 ? allClauses.join(separator) : null;
}

export interface FilterDescriptor {
  /** Column id (used as $filter field name, unless overridden). */
  id: string;
  /** OData field name, if different from id. */
  field?: string;
  /** OData field used for $orderby, if different from the filter field.
   *  May be a navigation path using `/` — e.g. "leader/lastName". A dot
   *  ("leader.lastName") is an ANTLR parse error. Only ever emitted, never
   *  parsed out of the URL. */
  sortField?: string;
  variant: FilterVariant;
}

export interface BuildFilterParamsInput {
  page: number;
  pageSize: number;
  sort?: string;
  columnFilters: ColumnFiltersState;
  descriptors: readonly FilterDescriptor[];
  /** Called when a second (or later) collection `any()` filter had to be
   *  dropped. See `joinWithCappedLambdas`. */
  onLambdaCapped?: (info: CappedLambdaInfo) => void;
}

/**
 * Generic OData $skip/$top/$filter/$orderby param builder for data tables.
 * Extracted from the box feature; used by createCrudApi for any entity.
 */
export function buildFilterParams({
  page,
  pageSize,
  sort,
  columnFilters,
  descriptors,
  onLambdaCapped,
}: BuildFilterParamsInput): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("$skip", String((page - 1) * pageSize));
  searchParams.set("$top", String(pageSize));

  const clauses: string[] = [];
  // Collection (multiRelation) filters go here instead of `clauses` — see
  // joinWithCappedLambdas above for why.
  const lambdaClauses: string[] = [];
  const byId = new Map(descriptors.map((d) => [d.id, d]));

  for (const filter of columnFilters) {
    const desc = byId.get(filter.id);
    if (!desc) continue;
    const field = desc.field ?? desc.id;
    const value = filter.value;

    switch (desc.variant) {
      case "text":
        if (typeof value === "string" && value.length > 0) {
          clauses.push(
            `contains_ignoring_case(${field}, '${odataString(value)}')`,
          );
        }
        break;

      case "number":
        if (typeof value === "string" && value.length > 0) {
          clauses.push(`${field} eq ${Number(value)}`);
        } else if (typeof value === "number") {
          clauses.push(`${field} eq ${value}`);
        }
        break;

      case "range": {
        const [minVal, maxVal] = (value as [unknown, unknown]) ?? [];
        if (minVal !== undefined && minVal !== null && minVal !== "")
          clauses.push(`${field} ge ${Number(minVal)}`);
        if (maxVal !== undefined && maxVal !== null && maxVal !== "")
          clauses.push(`${field} le ${Number(maxVal)}`);
        break;
      }

      case "dateRange": {
        const [fromVal, toVal] = (value as [unknown, unknown]) ?? [];
        if (fromVal) clauses.push(`${field} ge '${odataString(fromVal)}'`);
        if (toVal) clauses.push(`${field} le '${odataString(toVal)}'`);
        break;
      }

      case "date":
        if (value) {
          const d = new Date(value as number);
          if (!isNaN(d.getTime())) {
            clauses.push(
              `${field} eq '${d.toISOString().slice(0, 10)}'`,
            );
          }
        }
        break;

      case "select":
      case "multiSelect": {
        const vals = Array.isArray(value) ? value : [];
        if (vals.length === 1) {
          clauses.push(`${field} eq '${odataString(vals[0])}'`);
        } else if (vals.length > 1) {
          const inClause = vals.map((v) => `'${odataString(v)}'`).join(",");
          clauses.push(`${field} in (${inClause})`);
        }
        break;
      }

      case "boolean": {
        const boolVals = Array.isArray(value) ? value : [];
        if (boolVals.length === 1) {
          clauses.push(`${field} eq ${boolVals[0]}`);
        }
        break;
      }

      case "relation": {
        const relId = value as number | undefined;
        if (relId !== undefined && relId !== null) {
          clauses.push(`${field} eq ${Number(relId)}`);
        }
        break;
      }

      case "multiRelation": {
        const relIds = (value as number[] | undefined)
          ?.map(Number)
          .filter((n) => !Number.isNaN(n));
        if (relIds && relIds.length > 0) {
          lambdaClauses.push(`${field}/any(x: x/id in (${relIds.join(",")}))`);
        }
        break;
      }
    }
  }

  const filterStr = joinWithCappedLambdas({
    clauses,
    lambdaClauses,
    separator: " and ",
    onCapped: onLambdaCapped,
  });
  if (filterStr !== null) {
    searchParams.set("$filter", filterStr);
  }

  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [f, dir] = part.split(".");
        const desc = byId.get(f);
        return `${desc?.sortField ?? f} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }

  return searchParams;
}
