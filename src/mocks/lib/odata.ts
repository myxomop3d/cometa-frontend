export interface ODataParams {
  skip: number;
  top: number;
  filter: string | null;
  orderby: string | null;
}

export function parseOData(url: URL): ODataParams {
  return {
    skip: Number(url.searchParams.get("$skip") ?? 0),
    top: Number(url.searchParams.get("$top") ?? 0),
    filter: url.searchParams.get("$filter"),
    orderby: url.searchParams.get("$orderby"),
  };
}

export function applyOData<T extends object>(
  items: T[],
  params: ODataParams,
): { items: T[]; total: number } {
  let result = [...items];

  if (params.filter) {
    result = applyFilter(result, params.filter);
  }

  const total = result.length;

  if (params.orderby) {
    result = applyOrderBy(result, params.orderby);
  }

  if (params.top > 0) {
    result = result.slice(params.skip, params.skip + params.top);
  } else if (params.skip > 0) {
    result = result.slice(params.skip);
  }

  return { items: result, total };
}

function applyFilter<T extends object>(
  items: T[],
  filter: string,
): T[] {
  // Split by " and " to handle multiple conditions
  const conditions = filter.split(/\s+and\s+/i);
  return items.filter((item) => conditions.every((c) => matchCondition(item, c.trim())));
}

/** Resolves a potentially nested path like "item/id" on an object */
function resolveField(rec: Record<string, unknown>, field: string): unknown {
  const parts = field.split("/");
  let current: unknown = rec;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Parses an OData literal: 'string', number, true/false */
function parseODataValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  const num = Number(trimmed);
  if (!isNaN(num)) return num;
  return trimmed;
}

/** Compares a field value against a parsed OData value using the given operator */
function compareValues(
  fieldVal: unknown,
  op: string,
  compareVal: string | number | boolean,
): boolean {
  if (typeof compareVal === "boolean") {
    return op === "eq" ? Boolean(fieldVal) === compareVal : false;
  }
  if (typeof compareVal === "number") {
    const numField = Number(fieldVal);
    if (isNaN(numField)) return false;
    switch (op) {
      case "eq": return numField === compareVal;
      case "ge": return numField >= compareVal;
      case "le": return numField <= compareVal;
      case "gt": return numField > compareVal;
      case "lt": return numField < compareVal;
    }
  }
  const strField = String(fieldVal ?? "");
  switch (op) {
    case "eq": return strField === compareVal;
    case "ge": return strField >= compareVal;
    case "le": return strField <= compareVal;
    case "gt": return strField > compareVal;
    case "lt": return strField < compareVal;
  }
  return true;
}

function matchCondition<T extends object>(
  item: T,
  condition: string,
): boolean {
  const rec = item as Record<string, unknown>;

  // any(alias: innerConditions) — collection lambda
  const anyMatch = condition.match(/^([\w]+)\/any\((\w+):\s*(.+)\)$/i);
  if (anyMatch) {
    const [, collection, alias, innerExpr] = anyMatch;
    const arr = rec[collection];
    if (!Array.isArray(arr)) return false;
    const orConditions = innerExpr.split(/\s+or\s+/i);
    return arr.some((element) => {
      return orConditions.some((orCond) => {
        const resolved = orCond.trim();
        // Function call with alias as argument: contains_ignoring_case(t,'v')
        const funcWithAlias = resolved.match(
          /^(contains(?:_ignoring_case)?)\((\w+),\s*'([^']*)'\)$/i
        );
        if (funcWithAlias && funcWithAlias[2] === alias) {
          const val = String(element ?? "").toLowerCase();
          return val.includes(funcWithAlias[3].toLowerCase());
        }
        // alias/field op value: t/id eq 5
        const eqParts = resolved.match(
          /^(\w+)\/(\w+)\s+(eq|ge|le|gt|lt)\s+(.+)$/i
        );
        if (eqParts && eqParts[1] === alias) {
          const field = eqParts[2];
          const op = eqParts[3].toLowerCase();
          const rawVal = eqParts[4];
          const fieldVal =
            typeof element === "object" && element != null
              ? (element as Record<string, unknown>)[field]
              : undefined;
          const compareVal = parseODataValue(rawVal);
          return compareValues(fieldVal, op, compareVal);
        }
        return true;
      });
    });
  }

  // contains(field,'value') or contains_ignoring_case(field,'value')
  const containsMatch = condition.match(
    /^contains(?:_ignoring_case)?\(([\w/]+),\s*'([^']*)'\)$/i
  );
  if (containsMatch) {
    const [, field, value] = containsMatch;
    const fieldVal = String(resolveField(rec, field) ?? "").toLowerCase();
    return fieldVal.includes(value.toLowerCase());
  }

  // startswith(field,'value')
  const startsMatch = condition.match(
    /^startswith\(([\w/]+),\s*'([^']*)'\)$/i
  );
  if (startsMatch) {
    const [, field, value] = startsMatch;
    const fieldVal = String(resolveField(rec, field) ?? "").toLowerCase();
    return fieldVal.startsWith(value.toLowerCase());
  }

  // field op value — handles eq, ge, le, gt, lt with quoted strings, numbers, booleans
  const opMatch = condition.match(
    /^([\w/]+)\s+(eq|ge|le|gt|lt)\s+(.+)$/i
  );
  if (opMatch) {
    const [, field, op, rawVal] = opMatch;
    const fieldVal = resolveField(rec, field);
    const compareVal = parseODataValue(rawVal);
    return compareValues(fieldVal, op.toLowerCase(), compareVal);
  }

  return true;
}

function applyOrderBy<T extends object>(
  items: T[],
  orderby: string,
): T[] {
  const parts = orderby.split(",").map((p) => p.trim());
  const sorted = [...items];

  sorted.sort((a, b) => {
    const aRec = a as Record<string, unknown>;
    const bRec = b as Record<string, unknown>;
    for (const part of parts) {
      const [field, dir] = part.split(/\s+/);
      const aVal = String(aRec[field] ?? "");
      const bVal = String(bRec[field] ?? "");
      const cmp = aVal.localeCompare(bVal);
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });

  return sorted;
}
