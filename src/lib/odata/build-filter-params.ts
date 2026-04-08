import type { ColumnFiltersState } from "@tanstack/react-table";
import type { FilterVariant } from "@/types/data-table";

/**
 * Escape a value for safe inclusion inside an OData string literal.
 * Doubles single-quotes per spec: O'Brien -> O''Brien.
 */
export function odataString(v: unknown): string {
  return String(v).replace(/'/g, "''");
}

export interface FilterDescriptor {
  /** Column id (used as $filter field name, unless overridden). */
  id: string;
  /** OData field name, if different from id. */
  field?: string;
  variant: FilterVariant;
}

export interface BuildFilterParamsInput {
  page: number;
  pageSize: number;
  sort?: string;
  columnFilters: ColumnFiltersState;
  descriptors: readonly FilterDescriptor[];
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
}: BuildFilterParamsInput): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("$skip", String((page - 1) * pageSize));
  searchParams.set("$top", String(pageSize));

  const clauses: string[] = [];
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
          clauses.push(`${field}/id eq ${Number(relId)}`);
        }
        break;
      }

      case "multiRelation": {
        const relIds = value as number[] | undefined;
        if (relIds && relIds.length > 0) {
          const idList = relIds.map(Number).join(",");
          clauses.push(`${field}/any(x: x/id in (${idList}))`);
        }
        break;
      }
    }
  }

  if (clauses.length > 0) {
    searchParams.set("$filter", clauses.join(" and "));
  }

  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [f, dir] = part.split(".");
        return `${f} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }

  return searchParams;
}
