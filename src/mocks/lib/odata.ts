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

export function applyOData<T extends Record<string, unknown>>(
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

function applyFilter<T extends Record<string, unknown>>(
  items: T[],
  filter: string,
): T[] {
  // Split by " and " to handle multiple conditions
  const conditions = filter.split(/\s+and\s+/i);
  return items.filter((item) => conditions.every((c) => matchCondition(item, c.trim())));
}

function matchCondition<T extends Record<string, unknown>>(
  item: T,
  condition: string,
): boolean {
  // contains(field,'value')
  const containsMatch = condition.match(/^contains\((\w+),\s*'([^']*)'\)$/i);
  if (containsMatch) {
    const [, field, value] = containsMatch;
    const fieldVal = String(item[field] ?? "").toLowerCase();
    return fieldVal.includes(value.toLowerCase());
  }

  // startswith(field,'value')
  const startsMatch = condition.match(/^startswith\((\w+),\s*'([^']*)'\)$/i);
  if (startsMatch) {
    const [, field, value] = startsMatch;
    const fieldVal = String(item[field] ?? "").toLowerCase();
    return fieldVal.startsWith(value.toLowerCase());
  }

  // field eq 'value'
  const eqMatch = condition.match(/^(\w+)\s+eq\s+'([^']*)'$/i);
  if (eqMatch) {
    const [, field, value] = eqMatch;
    return String(item[field] ?? "") === value;
  }

  // field gt 'value'
  const gtMatch = condition.match(/^(\w+)\s+gt\s+'([^']*)'$/i);
  if (gtMatch) {
    const [, field, value] = gtMatch;
    return String(item[field] ?? "") > value;
  }

  // field lt 'value'
  const ltMatch = condition.match(/^(\w+)\s+lt\s+'([^']*)'$/i);
  if (ltMatch) {
    const [, field, value] = ltMatch;
    return String(item[field] ?? "") < value;
  }

  return true;
}

function applyOrderBy<T extends Record<string, unknown>>(
  items: T[],
  orderby: string,
): T[] {
  const parts = orderby.split(",").map((p) => p.trim());
  const sorted = [...items];

  sorted.sort((a, b) => {
    for (const part of parts) {
      const [field, dir] = part.split(/\s+/);
      const aVal = String(a[field] ?? "");
      const bVal = String(b[field] ?? "");
      const cmp = aVal.localeCompare(bVal);
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });

  return sorted;
}
