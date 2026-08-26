import type {
  ExtendedColumnFilter,
  FilterOperator,
  FilterVariant,
} from "@/types/data-table";
import { odataString } from "./build-filter-params";

export interface FieldEntry {
  field: string;
  /** OData field used for $orderby, if different from `field`.
   *  May be a navigation path using `/` — e.g. "leader/lastName". A dot
   *  ("leader.lastName") is an ANTLR parse error. Only ever emitted, never
   *  parsed out of the URL. */
  sortField?: string;
  variant: FilterVariant;
}

export interface BuildAdvancedFilterParamsInput {
  page: number;
  pageSize: number;
  sort?: string;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
  fieldByColumnId: Record<string, FieldEntry>;
}

/** Operators that emit a clause even when value is empty/undefined. */
const NO_VALUE_OPERATORS: FilterOperator[] = ["isEmpty", "isNotEmpty"];

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function quoteString(v: unknown): string {
  return `'${odataString(v)}'`;
}

interface RelationValue {
  id: number;
  label: string;
}

function isRelationValue(v: unknown): v is RelationValue {
  return (
    typeof v === "object" &&
    v !== null &&
    "id" in v &&
    typeof (v as RelationValue).id === "number"
  );
}

/** Map an ExtendedColumnFilter to a single OData clause, or null to skip. */
function clauseFor(
  filter: ExtendedColumnFilter,
  entry: FieldEntry,
): string | null {
  const { field, variant } = entry;
  const { operator, value } = filter;

  if (NO_VALUE_OPERATORS.includes(operator)) {
    return operator === "isEmpty" ? `${field} eq null` : `${field} ne null`;
  }

  if (isEmptyValue(value)) return null;

  switch (operator) {
    case "iLike":
      return `contains_ignoring_case(${field}, ${quoteString(value)})`;

    case "eq":
    case "ne": {
      const op = operator === "eq" ? "eq" : "ne";
      if (variant === "relation") {
        const relId = isRelationValue(value)
          ? value.id
          : typeof value === "number"
            ? value
            : Number(value);
        return `${field} ${op} ${relId}`;
      }
      if (variant === "number" || variant === "range") {
        return `${field} ${op} ${Number(value)}`;
      }
      if (variant === "boolean") {
        const boolVal = value === true || value === "true";
        return `${field} ${op} ${boolVal}`;
      }
      if (variant === "date" || variant === "dateRange") {
        return `${field} ${op} ${quoteString(value)}`;
      }
      // text / select / multiSelect
      return `${field} ${op} ${quoteString(value)}`;
    }

    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const map = { lt: "lt", lte: "le", gt: "gt", gte: "ge" } as const;
      const op = map[operator];
      if (variant === "date" || variant === "dateRange") {
        return `${field} ${op} ${quoteString(value)}`;
      }
      return `${field} ${op} ${Number(value)}`;
    }

    case "isBetween": {
      const [min, max] = Array.isArray(value)
        ? (value as [unknown, unknown])
        : [undefined, undefined];
      const hasMin = !isEmptyValue(min);
      const hasMax = !isEmptyValue(max);
      if (!hasMin && !hasMax) return null;
      const isDate = variant === "date" || variant === "dateRange";
      const fmt = (v: unknown) => (isDate ? quoteString(v) : String(Number(v)));
      if (hasMin && hasMax) {
        return `(${field} ge ${fmt(min)} and ${field} le ${fmt(max)})`;
      }
      if (hasMin) return `${field} ge ${fmt(min)}`;
      return `${field} le ${fmt(max)}`;
    }

    case "inArray":
    case "notInArray": {
      if (!Array.isArray(value) || value.length === 0) return null;

      let inner: string;
      if (variant === "multiRelation" || variant === "relation") {
        const ids = value
          .map((v) => (isRelationValue(v) ? v.id : Number(v)))
          .filter((n) => !Number.isNaN(n));
        if (ids.length === 0) return null;
        // A to-one relation is a scalar FK column: `leaderId/any(...)` is
        // meaningless. Only a real collection gets the lambda.
        inner =
          variant === "multiRelation"
            ? `${field}/any(x: x/id in (${ids.join(",")}))`
            : `${field} in (${ids.join(",")})`;
      } else {
        // select / multiSelect / text
        const literals = value.map(quoteString).join(",");
        inner = `${field} in (${literals})`;
      }

      return operator === "notInArray" ? `not (${inner})` : inner;
    }

    default:
      return null;
  }
}

export function buildAdvancedFilterParams({
  page,
  pageSize,
  sort,
  filters,
  joinOperator,
  fieldByColumnId,
}: BuildAdvancedFilterParamsInput): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("$skip", String((page - 1) * pageSize));
  searchParams.set("$top", String(pageSize));

  const clauses: string[] = [];
  // See §3 of the design spec: any() corrupts the root alias for later clauses.
  const lambdaClauses: string[] = [];
  for (const filter of filters) {
    const entry = fieldByColumnId[filter.id];
    if (!entry) continue;
    const clause = clauseFor(filter, entry);
    if (clause === null) continue;
    if (clause.includes("/any(")) lambdaClauses.push(clause);
    else clauses.push(clause);
  }

  if (lambdaClauses.length > 1) {
    console.warn(
      `[odata] ${lambdaClauses.length} collection filters were requested but only ` +
        `"${lambdaClauses[0]}" was sent: odata-mini corrupts the root alias after ` +
        `the first any() lambda.`,
    );
  }

  const allClauses = [...clauses, ...lambdaClauses.slice(0, 1)];
  if (allClauses.length > 0) {
    searchParams.set("$filter", allClauses.join(` ${joinOperator} `));
  }

  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [f, dir] = part.split(".");
        const entry = fieldByColumnId[f];
        return `${entry?.sortField ?? f} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }

  return searchParams;
}
