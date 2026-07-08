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

// ---------- AST ----------
type Literal = string | number | boolean | null;
type CmpOp = "eq" | "ne" | "ge" | "le" | "gt" | "lt";

type Expr =
  | { type: "and"; left: Expr; right: Expr }
  | { type: "or"; left: Expr; right: Expr }
  | { type: "not"; child: Expr }
  | { type: "cmp"; field: string; op: CmpOp; value: Literal }
  | { type: "in"; field: string; values: Literal[] }
  | { type: "contains"; field: string; value: string; ci: boolean }
  | { type: "startswith"; field: string; value: string }
  | { type: "any"; field: string; alias: string; inner: Expr }
  | { type: "true" };

// ---------- Tokenizer ----------
type Tok =
  | { k: "("; }
  | { k: ")"; }
  | { k: ","; }
  | { k: ":"; }
  | { k: "ident"; v: string }
  | { k: "str"; v: string }
  | { k: "num"; v: number }
  | { k: "kw"; v: string }; // and/or/not/eq/ne/ge/le/gt/lt/in/null/true/false

const KEYWORDS = new Set([
  "and", "or", "not", "eq", "ne", "ge", "le", "gt", "lt", "in", "null", "true", "false",
]);

function tokenize(input: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "(") { toks.push({ k: "(" }); i++; continue; }
    if (c === ")") { toks.push({ k: ")" }); i++; continue; }
    if (c === ",") { toks.push({ k: "," }); i++; continue; }
    if (c === ":") { toks.push({ k: ":" }); i++; continue; }
    if (c === "'") {
      // OData string with '' escape
      let s = "";
      i++;
      while (i < input.length) {
        if (input[i] === "'") {
          if (input[i + 1] === "'") { s += "'"; i += 2; continue; }
          i++; break;
        }
        s += input[i++];
      }
      toks.push({ k: "str", v: s });
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "-" && input[i + 1] >= "0" && input[i + 1] <= "9")) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      toks.push({ k: "num", v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_/]/.test(input[j])) j++;
      const word = input.slice(i, j);
      const lower = word.toLowerCase();
      if (KEYWORDS.has(lower)) {
        toks.push({ k: "kw", v: lower });
      } else {
        toks.push({ k: "ident", v: word });
      }
      i = j;
      continue;
    }
    // Unknown char — skip
    i++;
  }
  return toks;
}

// ---------- Parser ----------
class Parser {
  private toks: Tok[];
  private pos: number;
  constructor(toks: Tok[], pos = 0) {
    this.toks = toks;
    this.pos = pos;
  }
  peek(): Tok | undefined { return this.toks[this.pos]; }
  next(): Tok | undefined { return this.toks[this.pos++]; }
  eat(k: string, v?: string): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k !== k) return false;
    if (v !== undefined && (t as { v: string }).v !== v) return false;
    this.pos++;
    return true;
  }
  expect(k: string, v?: string): Tok {
    const t = this.next();
    if (!t || t.k !== k || (v !== undefined && (t as { v: string }).v !== v)) {
      throw new Error(`Expected ${k}${v ? ` '${v}'` : ""}, got ${JSON.stringify(t)}`);
    }
    return t;
  }

  parseExpr(): Expr { return this.parseOr(); }

  parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peek()?.k === "kw" && (this.peek() as { v: string }).v === "or") {
      this.next();
      const right = this.parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }
  parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peek()?.k === "kw" && (this.peek() as { v: string }).v === "and") {
      this.next();
      const right = this.parseNot();
      left = { type: "and", left, right };
    }
    return left;
  }
  parseNot(): Expr {
    if (this.peek()?.k === "kw" && (this.peek() as { v: string }).v === "not") {
      this.next();
      return { type: "not", child: this.parseNot() };
    }
    return this.parsePrimary();
  }
  parsePrimary(): Expr {
    const t = this.peek();
    if (!t) return { type: "true" };
    if (t.k === "(") {
      this.next();
      const e = this.parseExpr();
      this.expect(")");
      return e;
    }
    if (t.k === "ident") {
      const ident = (this.next() as { v: string }).v;
      // ident/any(alias: expr) — lambda takes precedence over generic func call
      const anySuffix = "/any";
      if (ident.toLowerCase().endsWith(anySuffix) && this.peek()?.k === "(") {
        this.next(); // (
        const alias = (this.expect("ident") as { v: string }).v;
        this.expect(":");
        const inner = this.parseExpr();
        this.expect(")");
        const field = ident.slice(0, ident.length - anySuffix.length);
        return { type: "any", field, alias, inner };
      }
      // function call: ident(...)
      if (this.peek()?.k === "(") {
        this.next();
        const lower = ident.toLowerCase();
        if (lower === "contains" || lower === "contains_ignoring_case") {
          const field = (this.expect("ident") as { v: string }).v;
          this.expect(",");
          const val = (this.expect("str") as { v: string }).v;
          this.expect(")");
          return { type: "contains", field, value: val, ci: lower === "contains_ignoring_case" };
        }
        if (lower === "startswith") {
          const field = (this.expect("ident") as { v: string }).v;
          this.expect(",");
          const val = (this.expect("str") as { v: string }).v;
          this.expect(")");
          return { type: "startswith", field, value: val };
        }
        // unknown function
        let depth = 1;
        while (depth > 0 && this.peek()) {
          const n = this.next()!;
          if (n.k === "(") depth++;
          else if (n.k === ")") depth--;
        }
        return { type: "true" };
      }
      // field in (...)
      if (this.peek()?.k === "kw" && (this.peek() as { v: string }).v === "in") {
        this.next();
        this.expect("(");
        const values: Literal[] = [];
        if (this.peek()?.k !== ")") {
          values.push(this.parseLiteral());
          while (this.peek()?.k === ",") { this.next(); values.push(this.parseLiteral()); }
        }
        this.expect(")");
        return { type: "in", field: ident, values };
      }
      // field op value
      const op = this.peek();
      if (op && op.k === "kw" && ["eq", "ne", "ge", "le", "gt", "lt"].includes((op as { v: string }).v)) {
        this.next();
        const value = this.parseLiteral();
        return { type: "cmp", field: ident, op: (op as { v: string }).v as CmpOp, value };
      }
      return { type: "true" };
    }
    // Fallback
    this.next();
    return { type: "true" };
  }

  parseLiteral(): Literal {
    const t = this.next();
    if (!t) return null;
    if (t.k === "str") return t.v;
    if (t.k === "num") return t.v;
    if (t.k === "kw") {
      if (t.v === "null") return null;
      if (t.v === "true") return true;
      if (t.v === "false") return false;
    }
    if (t.k === "ident") return t.v;
    return null;
  }
}

function parseExpression(filter: string): Expr {
  try {
    const toks = tokenize(filter);
    if (toks.length === 0) return { type: "true" };
    const p = new Parser(toks);
    return p.parseExpr();
  } catch {
    return { type: "true" };
  }
}

// ---------- Evaluator ----------
function resolveField(rec: unknown, field: string): unknown {
  const parts = field.split("/");
  let current: unknown = rec;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isNullish(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function cmpLit(fieldVal: unknown, op: CmpOp, compareVal: Literal): boolean {
  if (compareVal === null) {
    const isNull = isNullish(fieldVal);
    if (op === "eq") return isNull;
    if (op === "ne") return !isNull;
    return false;
  }
  if (typeof compareVal === "boolean") {
    const b = Boolean(fieldVal);
    if (op === "eq") return b === compareVal;
    if (op === "ne") return b !== compareVal;
    return false;
  }
  if (typeof compareVal === "number") {
    const numField = Number(fieldVal);
    if (Number.isNaN(numField)) return op === "ne";
    switch (op) {
      case "eq": return numField === compareVal;
      case "ne": return numField !== compareVal;
      case "ge": return numField >= compareVal;
      case "le": return numField <= compareVal;
      case "gt": return numField > compareVal;
      case "lt": return numField < compareVal;
    }
  }
  const strField = String(fieldVal ?? "");
  switch (op) {
    case "eq": return strField === compareVal;
    case "ne": return strField !== compareVal;
    case "ge": return strField >= compareVal;
    case "le": return strField <= compareVal;
    case "gt": return strField > compareVal;
    case "lt": return strField < compareVal;
  }
  return false;
}

function evaluate(expr: Expr, rec: unknown): boolean {
  switch (expr.type) {
    case "true": return true;
    case "and": return evaluate(expr.left, rec) && evaluate(expr.right, rec);
    case "or": return evaluate(expr.left, rec) || evaluate(expr.right, rec);
    case "not": return !evaluate(expr.child, rec);
    case "cmp": {
      const fv = resolveField(rec, expr.field);
      return cmpLit(fv, expr.op, expr.value);
    }
    case "in": {
      const fv = resolveField(rec, expr.field);
      const matches = (val: unknown): boolean => {
        for (const v of expr.values) {
          if (typeof v === "number") {
            if (Number(val) === v) return true;
          } else if (v === null) {
            if (val == null) return true;
          } else {
            if (String(val ?? "") === String(v)) return true;
          }
        }
        return false;
      };
      if (Array.isArray(fv)) return fv.some(matches);
      return matches(fv);
    }
    case "contains": {
      const fv = resolveField(rec, expr.field);
      if (expr.ci) {
        return String(fv ?? "").toLowerCase().includes(expr.value.toLowerCase());
      }
      return String(fv ?? "").includes(expr.value);
    }
    case "startswith": {
      const fv = resolveField(rec, expr.field);
      return String(fv ?? "").toLowerCase().startsWith(expr.value.toLowerCase());
    }
    case "any": {
      const arr = resolveField(rec, expr.field);
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some((element) => {
        const virtual: Record<string, unknown> =
          element && typeof element === "object"
            ? { ...(element as Record<string, unknown>), [expr.alias]: element }
            : { [expr.alias]: element };
        return evaluate(expr.inner, virtual);
      });
    }
  }
}

function applyFilter<T extends object>(items: T[], filter: string): T[] {
  const expr = parseExpression(filter);
  return items.filter((item) => evaluate(expr, item));
}

// Exported for tests
export const __test = { tokenize, parseExpression, evaluate, applyFilter };

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
