# Box-Dice Advanced FilterList Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/box-dice-advanced/` route that clones `/box-dice/` but swaps the basic toolbar for a Notion/Airtable-style FilterList (per-clause operator choice, flat list joined by a single `and`/`or` toggle), backed by a JSON-encoded `filters` URL param and a new OData builder.

**Architecture:** Hybrid sharing — the new route reuses `getBoxColumns`, `BoxSheet`, `BoxRowAction`, and the same `GET /api/v1/box` endpoint as `/box-dice/`. The data path is distinct: a new `advancedDataTableQueryOptions` factory on `boxApi` uses a new `buildAdvancedFilterParams` OData builder that takes an `ExtendedColumnFilter[]` and a `joinOperator`. URL state uses a JSON-serialized `filters` query param + `joinOperator`. A new `DataTableFilterList` component renders the popover; new `DataTableAdvancedToolbar` wraps it. Column `meta` is extended (additively) so `/box-dice/` keeps working untouched.

**Tech Stack:** React 19, TanStack Router 1.167 (file-based), TanStack Query 5, TanStack Table 8, shadcn/ui, Tailwind v4, zod, vitest.

**Testing note:** Project has `vitest` installed (`npm run test`). Only the OData builder has unit tests here — UI tests are out of scope for this plan. After each task, also run `npx tsc --noEmit` to type-check.

---

## File Structure

**New:**
- `src/routes/box-dice-advanced/index.tsx` — route, loader, validateSearch, page component
- `src/components/data-table/data-table-advanced-toolbar.tsx` — container with FilterList + ViewOptions + children slot
- `src/components/data-table/data-table-filter-list.tsx` — popover, flat filter rows, add/remove/join-toggle
- `src/lib/odata/build-advanced-filter-params.ts` — new OData builder
- `src/lib/odata/build-advanced-filter-params.test.ts` — vitest unit tests
- `src/features/box/advanced-api.ts` — `advancedDataTableQueryOptions` factory + field registry

**Modified:**
- `src/types/data-table.ts` — add `ExtendedColumnFilter`, `FilterOperator` (already present, verify), extend `ColumnMeta` module augmentation with `relationConfig` (already present, verify)
- `src/config/data-table.ts` — add `operatorsByVariant`, `operatorLabels` (additive)
- `src/features/box/api.ts` — merge `advancedDataTableQueryOptions` into exported `boxApi`
- `src/lib/api/create-crud-api.ts` — export `apiFetch` so the advanced factory can reuse it
- `src/components/app-sidebar.tsx` — nav entry for `/box-dice-advanced`

**Unchanged:** `/box-dice/` route, `boxFilterDescriptors`, `buildFilterParams`, `BoxSheet`, CRUD mutations, `getBoxColumns` (no code change — its existing `meta` is already sufficient for the field registry; no edits needed there).

---

## Task 1: Export `apiFetch` from create-crud-api

**Files:**
- Modify: `src/lib/api/create-crud-api.ts`

- [ ] **Step 1: Change `apiFetch` from internal function to an exported function**

In `src/lib/api/create-crud-api.ts`, change:

```typescript
async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
```

to:

```typescript
export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/create-crud-api.ts
git commit -m "refactor(api): export apiFetch for reuse by advanced factory"
```

---

## Task 2: Extend types — `ExtendedColumnFilter`

**Files:**
- Modify: `src/types/data-table.ts`

- [ ] **Step 1: Add `ExtendedColumnFilter` and re-confirm `FilterOperator`**

Append to `src/types/data-table.ts` (keep everything that's already there — the existing `ColumnMeta` module augmentation already contains `label`, `variant`, `options`, `range`, `unit`, and `relationConfig`, so no further changes to that block):

```typescript
export interface ExtendedColumnFilter {
  /** Column id. */
  id: string;
  operator: FilterOperator;
  /** Shape depends on operator + variant:
   *  text/number -> string | number
   *  isBetween   -> [min, max]
   *  inArray/notInArray (select/multiSelect) -> string[]
   *  inArray/notInArray (multiRelation) -> { id: number; label: string }[]
   *  relation eq/ne -> { id: number; label: string }
   *  isEmpty/isNotEmpty -> undefined
   */
  value: unknown;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/data-table.ts
git commit -m "feat(types): add ExtendedColumnFilter for advanced filtering"
```

---

## Task 3: Add operator config (`operatorsByVariant`, `operatorLabels`)

**Files:**
- Modify: `src/config/data-table.ts`

- [ ] **Step 1: Append the two new maps alongside the existing `dataTableConfig`**

Add at the bottom of `src/config/data-table.ts`:

```typescript
import type { FilterOperator, FilterVariant } from "@/types/data-table";

export const operatorsByVariant: Record<FilterVariant, FilterOperator[]> = {
  text:          ["iLike", "eq", "ne", "isEmpty", "isNotEmpty"],
  number:        ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  range:         ["isBetween", "eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  date:          ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  dateRange:     ["isBetween", "eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  boolean:       ["eq"],
  select:        ["eq", "ne", "isEmpty", "isNotEmpty"],
  multiSelect:   ["inArray", "notInArray", "isEmpty", "isNotEmpty"],
  relation:      ["eq", "ne", "isEmpty", "isNotEmpty"],
  multiRelation: ["inArray", "notInArray", "isEmpty", "isNotEmpty"],
};

export const operatorLabels: Record<FilterOperator, string> = {
  iLike: "contains",
  notILike: "does not contain",
  eq: "is",
  ne: "is not",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  isBetween: "is between",
  inArray: "is any of",
  notInArray: "is none of",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};
```

Note: `notILike` already exists in the `operators` tuple at `src/config/data-table.ts:65`, so it must appear in `operatorLabels` to keep the `Record` exhaustive.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/data-table.ts
git commit -m "feat(config): add operatorsByVariant and operatorLabels maps"
```

---

## Task 4: OData builder — scaffold + failing tests

**Files:**
- Create: `src/lib/odata/build-advanced-filter-params.ts`
- Create: `src/lib/odata/build-advanced-filter-params.test.ts`

- [ ] **Step 1: Create the empty builder with its signature**

Create `src/lib/odata/build-advanced-filter-params.ts`:

```typescript
import type { ExtendedColumnFilter, FilterVariant } from "@/types/data-table";
import { odataString } from "./build-filter-params";

export interface FieldEntry {
  /** OData field path, e.g. "name", "item/id", "things". */
  field: string;
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

export function buildAdvancedFilterParams(
  _input: BuildAdvancedFilterParamsInput,
): URLSearchParams {
  throw new Error("not implemented");
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/odata/build-advanced-filter-params.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAdvancedFilterParams } from "./build-advanced-filter-params";
import type { ExtendedColumnFilter } from "@/types/data-table";

const fieldByColumnId = {
  name:      { field: "name",      variant: "text" as const },
  num:       { field: "num",       variant: "range" as const },
  shape:     { field: "shape",     variant: "select" as const },
  tags:      { field: "tags",      variant: "multiSelect" as const },
  checkbox:  { field: "checkbox",  variant: "boolean" as const },
  dateStr:   { field: "dateStr",   variant: "dateRange" as const },
  item:      { field: "item",      variant: "relation" as const },
  things:    { field: "things",    variant: "multiRelation" as const },
};

function build(
  filters: ExtendedColumnFilter[],
  joinOperator: "and" | "or" = "and",
) {
  return buildAdvancedFilterParams({
    page: 1,
    pageSize: 20,
    filters,
    joinOperator,
    fieldByColumnId,
  });
}

describe("buildAdvancedFilterParams", () => {
  it("sets $skip and $top from page/pageSize", () => {
    const p = build([]);
    expect(p.get("$skip")).toBe("0");
    expect(p.get("$top")).toBe("20");
    expect(p.get("$filter")).toBeNull();
  });

  it("paginates: page=3, pageSize=10 => $skip=20", () => {
    const p = buildAdvancedFilterParams({
      page: 3,
      pageSize: 10,
      filters: [],
      joinOperator: "and",
      fieldByColumnId,
    });
    expect(p.get("$skip")).toBe("20");
    expect(p.get("$top")).toBe("10");
  });

  it("text iLike -> contains_ignoring_case", () => {
    const p = build([{ id: "name", operator: "iLike", value: "foo" }]);
    expect(p.get("$filter")).toBe("contains_ignoring_case(name, 'foo')");
  });

  it("text eq/ne as string", () => {
    const p = build([
      { id: "name", operator: "eq", value: "foo" },
      { id: "name", operator: "ne", value: "bar" },
    ]);
    expect(p.get("$filter")).toBe("name eq 'foo' and name ne 'bar'");
  });

  it("escapes single quotes in string values", () => {
    const p = build([{ id: "name", operator: "eq", value: "O'Brien" }]);
    expect(p.get("$filter")).toBe("name eq 'O''Brien'");
  });

  it("number lt/lte/gt/gte", () => {
    const p = build([
      { id: "num", operator: "gt", value: 5 },
      { id: "num", operator: "lte", value: 10 },
    ]);
    expect(p.get("$filter")).toBe("num gt 5 and num le 10");
  });

  it("isBetween wraps as (field ge min and field le max)", () => {
    const p = build([{ id: "num", operator: "isBetween", value: [2, 8] }]);
    expect(p.get("$filter")).toBe("(num ge 2 and num le 8)");
  });

  it("select inArray -> in (...)", () => {
    const p = build([
      { id: "shape", operator: "inArray", value: ["O", "X"] },
    ]);
    expect(p.get("$filter")).toBe("shape in ('O','X')");
  });

  it("multiSelect notInArray -> not (field in (...))", () => {
    const p = build([
      { id: "tags", operator: "notInArray", value: ["a", "b"] },
    ]);
    expect(p.get("$filter")).toBe("not (tags in ('a','b'))");
  });

  it("boolean eq", () => {
    const p = build([{ id: "checkbox", operator: "eq", value: true }]);
    expect(p.get("$filter")).toBe("checkbox eq true");
  });

  it("relation eq/ne uses field/id eq N", () => {
    const p = build([
      { id: "item", operator: "eq", value: { id: 7, label: "Seven" } },
    ]);
    expect(p.get("$filter")).toBe("item/id eq 7");
  });

  it("multiRelation inArray -> field/any(x: x/id in (...))", () => {
    const p = build([
      {
        id: "things",
        operator: "inArray",
        value: [
          { id: 1, label: "a" },
          { id: 2, label: "b" },
        ],
      },
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1,2))");
  });

  it("multiRelation notInArray wraps with not (...)", () => {
    const p = build([
      {
        id: "things",
        operator: "notInArray",
        value: [{ id: 1, label: "a" }],
      },
    ]);
    expect(p.get("$filter")).toBe("not (things/any(x: x/id in (1)))");
  });

  it("isEmpty emits field eq null even with no value", () => {
    const p = build([{ id: "name", operator: "isEmpty", value: undefined }]);
    expect(p.get("$filter")).toBe("name eq null");
  });

  it("isNotEmpty emits field ne null", () => {
    const p = build([{ id: "name", operator: "isNotEmpty", value: undefined }]);
    expect(p.get("$filter")).toBe("name ne null");
  });

  it("dateRange isBetween", () => {
    const p = build([
      { id: "dateStr", operator: "isBetween", value: ["2026-01-01", "2026-02-01"] },
    ]);
    expect(p.get("$filter")).toBe(
      "(dateStr ge '2026-01-01' and dateStr le '2026-02-01')",
    );
  });

  it("skips filters with empty value unless isEmpty/isNotEmpty", () => {
    const p = build([
      { id: "name", operator: "iLike", value: "" },
      { id: "name", operator: "iLike", value: undefined },
      { id: "num",  operator: "gt", value: 5 },
    ]);
    expect(p.get("$filter")).toBe("num gt 5");
  });

  it("joins with 'or' when joinOperator is or", () => {
    const p = build(
      [
        { id: "name", operator: "iLike", value: "foo" },
        { id: "name", operator: "iLike", value: "bar" },
      ],
      "or",
    );
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(name, 'foo') or contains_ignoring_case(name, 'bar')",
    );
  });

  it("with 'or', multi-part clauses (isBetween, notInArray) stay parenthesized", () => {
    const p = build(
      [
        { id: "num", operator: "isBetween", value: [1, 5] },
        { id: "tags", operator: "notInArray", value: ["x"] },
      ],
      "or",
    );
    expect(p.get("$filter")).toBe(
      "(num ge 1 and num le 5) or not (tags in ('x'))",
    );
  });

  it("sort -> $orderby", () => {
    const p = buildAdvancedFilterParams({
      page: 1,
      pageSize: 20,
      sort: "name.asc",
      filters: [],
      joinOperator: "and",
      fieldByColumnId,
    });
    expect(p.get("$orderby")).toBe("name asc");
  });

  it("unknown column id is silently skipped", () => {
    const p = build([
      { id: "nope", operator: "eq", value: "x" },
      { id: "name", operator: "eq", value: "y" },
    ]);
    expect(p.get("$filter")).toBe("name eq 'y'");
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm run test -- build-advanced-filter-params`
Expected: FAIL — every test throws `"not implemented"`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/odata/build-advanced-filter-params.ts src/lib/odata/build-advanced-filter-params.test.ts
git commit -m "test(odata): failing tests for buildAdvancedFilterParams"
```

---

## Task 5: Implement `buildAdvancedFilterParams`

**Files:**
- Modify: `src/lib/odata/build-advanced-filter-params.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

Replace the body of `src/lib/odata/build-advanced-filter-params.ts` (keep the `import` and interfaces from Task 4) with this implementation:

```typescript
import type {
  ExtendedColumnFilter,
  FilterOperator,
  FilterVariant,
} from "@/types/data-table";
import { odataString } from "./build-filter-params";

export interface FieldEntry {
  field: string;
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

/** Operators whose emitted clause is multi-part and must be parenthesized
 *  when joinOperator is "or" (to protect precedence). */
function isCompoundClause(operator: FilterOperator): boolean {
  return operator === "isBetween" || operator === "notInArray";
}

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

    case "notILike":
      return `not contains_ignoring_case(${field}, ${quoteString(value)})`;

    case "eq":
    case "ne": {
      const op = operator === "eq" ? "eq" : "ne";
      if (variant === "relation") {
        const relId = isRelationValue(value)
          ? value.id
          : typeof value === "number"
            ? value
            : Number(value);
        return `${field}/id ${op} ${relId}`;
      }
      if (variant === "number" || variant === "range") {
        return `${field} ${op} ${Number(value)}`;
      }
      if (variant === "boolean") {
        return `${field} ${op} ${Boolean(value)}`;
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
      if (isEmptyValue(min) || isEmptyValue(max)) return null;
      if (variant === "date" || variant === "dateRange") {
        return `(${field} ge ${quoteString(min)} and ${field} le ${quoteString(max)})`;
      }
      return `(${field} ge ${Number(min)} and ${field} le ${Number(max)})`;
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
        inner = `${field}/any(x: x/id in (${ids.join(",")}))`;
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
  for (const filter of filters) {
    const entry = fieldByColumnId[filter.id];
    if (!entry) continue;
    const clause = clauseFor(filter, entry);
    if (clause === null) continue;

    if (joinOperator === "or" && isCompoundClause(filter.operator)) {
      // Already parenthesized in clauseFor for isBetween / wrapped for notInArray.
      clauses.push(clause);
    } else {
      clauses.push(clause);
    }
  }

  if (clauses.length > 0) {
    searchParams.set("$filter", clauses.join(` ${joinOperator} `));
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
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- build-advanced-filter-params`
Expected: all tests PASS.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/odata/build-advanced-filter-params.ts
git commit -m "feat(odata): implement buildAdvancedFilterParams"
```

---

## Task 6: `advancedDataTableQueryOptions` factory + field registry

**Files:**
- Create: `src/features/box/advanced-api.ts`
- Modify: `src/features/box/api.ts`

- [ ] **Step 1: Create the advanced factory**

Create `src/features/box/advanced-api.ts`:

```typescript
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse } from "@/types/api";
import type { BoxDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

/**
 * Column-id -> OData field mapping for the advanced filter builder.
 * Kept separate from the existing `boxFilterDescriptors` (which is
 * URL-param-driven) so the two filter pipelines don't entangle.
 */
export const boxFieldByColumnId: Record<string, FieldEntry> = {
  name:       { field: "name",       variant: "text" },
  objectCode: { field: "objectCode", variant: "text" },
  shape:      { field: "shape",      variant: "select" },
  num:        { field: "num",        variant: "range" },
  dateStr:    { field: "dateStr",    variant: "dateRange" },
  checkbox:   { field: "checkbox",   variant: "boolean" },
  tags:       { field: "tags",       variant: "text" },
  item:       { field: "item",       variant: "relation" },
  things:     { field: "things",     variant: "multiRelation" },
  oldItem:    { field: "oldItem",    variant: "relation" },
  oldThings:  { field: "oldThings",  variant: "multiRelation" },
};

export interface AdvancedDataTableQueryParams {
  page: number;
  pageSize: number;
  sort?: string;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export function advancedDataTableQueryOptions(
  params: AdvancedDataTableQueryParams,
) {
  return queryOptions({
    queryKey: [
      "boxes",
      "advanced",
      params.page,
      params.pageSize,
      params.sort,
      params.filters,
      params.joinOperator,
    ] as const,
    queryFn: () => {
      const searchParams = buildAdvancedFilterParams({
        ...params,
        fieldByColumnId: boxFieldByColumnId,
      });
      return apiFetch<ApiResponse<BoxDto[]>>(
        `/api/v1/box?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: Merge the factory into `boxApi`**

Replace `src/features/box/api.ts` with:

```typescript
import { createCrudApi } from "@/lib/api/create-crud-api";
import type { BoxDto, BoxFilters } from "@/types/api";
import type { BoxWritePayload } from "./schema";
import { boxFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<BoxDto, BoxFilters, BoxWritePayload>({
  basePath: "/api/v1/box",
  queryKey: ["boxes"],
  filterDescriptors: boxFilterDescriptors,
});

export const boxApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/box/advanced-api.ts src/features/box/api.ts
git commit -m "feat(box): advancedDataTableQueryOptions factory"
```

---

## Task 7: `DataTableFilterList` component

**Files:**
- Create: `src/components/data-table/data-table-filter-list.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/data-table/data-table-filter-list.tsx`:

```typescript
import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Filter, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { RelationPicker } from "@/components/relation-picker";
import {
  operatorsByVariant,
  operatorLabels,
} from "@/config/data-table";
import type {
  ExtendedColumnFilter,
  FilterOperator,
  FilterVariant,
} from "@/types/data-table";

interface FilterableColumnInfo {
  id: string;
  label: string;
  variant: FilterVariant;
  options?: { label: string; value: string }[];
  relationConfig?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryOptionsFn: (filters: Record<string, unknown>) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getLabel: (item: any) => string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getId: (item: any) => number;
  };
}

export interface DataTableFilterListProps<TData> {
  table: Table<TData>;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
  onChange: (next: {
    filters: ExtendedColumnFilter[];
    joinOperator: "and" | "or";
  }) => void;
}

const DEBOUNCE_MS = 300;

export function DataTableFilterList<TData>({
  table,
  filters,
  joinOperator,
  onChange,
}: DataTableFilterListProps<TData>) {
  // Draft state for responsive editing. Committed to URL on debounce.
  const [draft, setDraft] = React.useState<ExtendedColumnFilter[]>(filters);
  const [draftJoin, setDraftJoin] = React.useState(joinOperator);

  // Sync external -> draft when props change (e.g., URL edited externally).
  React.useEffect(() => {
    setDraft(filters);
  }, [filters]);
  React.useEffect(() => {
    setDraftJoin(joinOperator);
  }, [joinOperator]);

  // Debounced commit.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (
        draftJoin !== joinOperator ||
        JSON.stringify(draft) !== JSON.stringify(filters)
      ) {
        onChange({ filters: draft, joinOperator: draftJoin });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, draftJoin]);

  const filterableColumns = React.useMemo<FilterableColumnInfo[]>(() => {
    return table
      .getAllColumns()
      .filter((c) => c.columnDef.meta?.variant !== undefined)
      .map((c) => {
        const meta = c.columnDef.meta!;
        return {
          id: c.id,
          label: meta.label ?? c.id,
          variant: meta.variant as FilterVariant,
          options: meta.options as { label: string; value: string }[] | undefined,
          relationConfig: meta.relationConfig,
        };
      });
  }, [table]);

  const columnInfoById = React.useMemo(() => {
    const map = new Map<string, FilterableColumnInfo>();
    for (const c of filterableColumns) map.set(c.id, c);
    return map;
  }, [filterableColumns]);

  const addFilter = (columnId: string) => {
    const info = columnInfoById.get(columnId);
    if (!info) return;
    const op = operatorsByVariant[info.variant][0];
    setDraft((prev) => [
      ...prev,
      { id: columnId, operator: op, value: undefined },
    ]);
  };

  const updateFilter = (index: number, patch: Partial<ExtendedColumnFilter>) => {
    setDraft((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  };

  const removeFilter = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const resetAll = () => {
    setDraft([]);
    setDraftJoin("and");
  };

  const count = filters.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Filter className="mr-1 size-4" />
          Filter{count > 0 ? ` (${count})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[680px] p-3">
        <div className="flex flex-col gap-2">
          {draft.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Where</span>
              <Select
                value={draftJoin}
                onValueChange={(v) => setDraftJoin(v as "and" | "or")}
              >
                <SelectTrigger className="h-7 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">and</SelectItem>
                  <SelectItem value="or">or</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.map((filter, index) => {
            const info = columnInfoById.get(filter.id);
            if (!info) return null;
            const operators = operatorsByVariant[info.variant];
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <FieldPicker
                  columns={filterableColumns}
                  value={filter.id}
                  onChange={(newId) => {
                    const newInfo = columnInfoById.get(newId);
                    if (!newInfo) return;
                    updateFilter(index, {
                      id: newId,
                      operator: operatorsByVariant[newInfo.variant][0],
                      value: undefined,
                    });
                  }}
                />
                <Select
                  value={filter.operator}
                  onValueChange={(op) =>
                    updateFilter(index, {
                      operator: op as FilterOperator,
                      value: undefined,
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {operatorLabels[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1">
                  <ValueInput
                    info={info}
                    operator={filter.operator}
                    value={filter.value}
                    onChange={(value) => updateFilter(index, { value })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => removeFilter(index)}
                  aria-label="Remove filter"
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1">
            <AddFilterButton
              columns={filterableColumns}
              onSelect={addFilter}
            />
            {(draft.length > 0 || draftJoin !== "and") && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                Reset all
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FieldPicker({
  columns,
  value,
  onChange,
}: {
  columns: FilterableColumnInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = columns.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-[140px] justify-start">
          {current?.label ?? "Field"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fields..." />
          <CommandList>
            <CommandEmpty>No fields.</CommandEmpty>
            <CommandGroup>
              {columns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.label}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AddFilterButton({
  columns,
  onSelect,
}: {
  columns: FilterableColumnInfo[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="mr-1 size-4" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fields..." />
          <CommandList>
            <CommandEmpty>No fields.</CommandEmpty>
            <CommandGroup>
              {columns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.label}
                  onSelect={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                >
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ValueInput({
  info,
  operator,
  value,
  onChange,
}: {
  info: FilterableColumnInfo;
  operator: FilterOperator;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    return null;
  }

  const { variant } = info;

  if (operator === "isBetween" && (variant === "range" || variant === "dateRange")) {
    const [a, b] = Array.isArray(value)
      ? (value as [unknown, unknown])
      : [undefined, undefined];
    const type = variant === "range" ? "number" : "date";
    return (
      <div className="flex items-center gap-1">
        <Input
          type={type}
          className="h-8"
          value={(a as string | number | undefined) ?? ""}
          onChange={(e) =>
            onChange([
              type === "number" ? Number(e.target.value) : e.target.value,
              b,
            ])
          }
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type={type}
          className="h-8"
          value={(b as string | number | undefined) ?? ""}
          onChange={(e) =>
            onChange([
              a,
              type === "number" ? Number(e.target.value) : e.target.value,
            ])
          }
        />
      </div>
    );
  }

  if (variant === "select" && info.options) {
    return (
      <Select
        value={(value as string | undefined) ?? ""}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {info.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === "multiSelect" && info.options) {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap items-center gap-2">
        {info.options.map((o) => {
          const checked = arr.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-1 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                  if (next) onChange([...arr, o.value]);
                  else onChange(arr.filter((x) => x !== o.value));
                }}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (variant === "boolean") {
    return (
      <Select
        value={value === undefined ? "" : String(value)}
        onValueChange={(v) => onChange(v === "true")}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Pick..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (variant === "date" || variant === "dateRange") {
    return (
      <Input
        type="date"
        className="h-8"
        value={(value as string | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (variant === "number" || variant === "range") {
    return (
      <Input
        type="number"
        className="h-8"
        value={
          typeof value === "number"
            ? value
            : typeof value === "string"
              ? value
              : ""
        }
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    );
  }

  if (variant === "relation" && info.relationConfig) {
    const rel = value as { id: number; label: string } | undefined;
    return (
      <RelationPicker
        queryOptionsFn={info.relationConfig.queryOptionsFn}
        columns={info.relationConfig.columns}
        getLabel={info.relationConfig.getLabel}
        getId={info.relationConfig.getId}
        value={rel?.id}
        onChange={(id, row) => {
          if (id === undefined || row === undefined) {
            onChange(undefined);
          } else {
            onChange({ id, label: info.relationConfig!.getLabel(row) });
          }
        }}
      />
    );
  }

  if (variant === "multiRelation" && info.relationConfig) {
    const arr = (value as { id: number; label: string }[] | undefined) ?? [];
    return (
      <RelationPicker
        multi
        queryOptionsFn={info.relationConfig.queryOptionsFn}
        columns={info.relationConfig.columns}
        getLabel={info.relationConfig.getLabel}
        getId={info.relationConfig.getId}
        value={arr.map((r) => r.id)}
        onChange={(_ids, rows) => {
          if (!rows || rows.length === 0) {
            onChange(undefined);
          } else {
            onChange(
              rows.map((r) => ({
                id: info.relationConfig!.getId(r),
                label: info.relationConfig!.getLabel(r),
              })),
            );
          }
        }}
      />
    );
  }

  // text fallback
  return (
    <Input
      className="h-8"
      value={(value as string | undefined) ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
}
```

**Note to implementer:** The `RelationPicker` interface used above assumes a `multi` / `value` / `onChange(id, row)` contract. Open `src/components/relation-picker.tsx` and adapt the call-sites above to match the real API — the component exists and is used by the current `RelationFilterModal`, so the shape is discoverable. If the real `RelationPicker` API differs significantly, wrap it here in a small adapter inside this file rather than changing `RelationPicker` itself (don't break `/box-dice/`).

- [ ] **Step 2: Verify shadcn primitives exist**

Run: `ls src/components/ui/popover.tsx src/components/ui/command.tsx src/components/ui/select.tsx src/components/ui/input.tsx src/components/ui/checkbox.tsx src/components/ui/button.tsx`
Expected: all files exist. If any is missing, add with `npx shadcn@latest add <name>`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any `RelationPicker` prop mismatches by reading [src/components/relation-picker.tsx](src/components/relation-picker.tsx) and adjusting the call site. Do not modify `RelationPicker`.

- [ ] **Step 4: Commit**

```bash
git add src/components/data-table/data-table-filter-list.tsx
git commit -m "feat(data-table): DataTableFilterList popover component"
```

---

## Task 8: `DataTableAdvancedToolbar` wrapper

**Files:**
- Create: `src/components/data-table/data-table-advanced-toolbar.tsx`

- [ ] **Step 1: Create the thin container**

Create `src/components/data-table/data-table-advanced-toolbar.tsx`:

```typescript
import * as React from "react";
import type { Table } from "@tanstack/react-table";

import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import {
  DataTableFilterList,
  type DataTableFilterListProps,
} from "@/components/data-table/data-table-filter-list";

export interface DataTableAdvancedToolbarProps<TData>
  extends Omit<DataTableFilterListProps<TData>, "table"> {
  table: Table<TData>;
  children?: React.ReactNode;
}

export function DataTableAdvancedToolbar<TData>({
  table,
  filters,
  joinOperator,
  onChange,
  children,
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2">
        <DataTableFilterList
          table={table}
          filters={filters}
          joinOperator={joinOperator}
          onChange={onChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify `DataTableViewOptions` path**

Run: `ls src/components/data-table/data-table-view-options.tsx`
Expected: exists. If the path differs, adjust the import above.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/data-table/data-table-advanced-toolbar.tsx
git commit -m "feat(data-table): DataTableAdvancedToolbar wrapper"
```

---

## Task 9: Route — `/box-dice-advanced/`

**Files:**
- Create: `src/routes/box-dice-advanced/index.tsx`

- [ ] **Step 1: Create the route file**

Create `src/routes/box-dice-advanced/index.tsx`:

```typescript
import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { z } from "zod";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { calculatePageSize } from "@/lib/data-table";
import { Button } from "@/components/ui/button";

import { boxApi } from "@/features/box/api";
import { getBoxColumns } from "@/features/box/columns";
import { BoxSheet } from "@/features/box/components/BoxSheet";
import type { BoxRowAction } from "@/features/box/row-action";
import type { ExtendedColumnFilter } from "@/types/data-table";

const DEFAULT_PAGE_SIZE = calculatePageSize();

const filterSchema = z.array(
  z.object({
    id: z.string(),
    operator: z.string(),
    value: z.unknown(),
  }),
);

interface AdvancedSearchParams {
  page: number;
  pageSize: number | undefined;
  sort: string | undefined;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

function parseFilters(raw: unknown): ExtendedColumnFilter[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = filterSchema.safeParse(parsed);
    if (!result.success) return [];
    return result.data as ExtendedColumnFilter[];
  } catch {
    return [];
  }
}

function validateSearch(search: Record<string, unknown>): AdvancedSearchParams {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    filters: parseFilters(search.filters),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
  };
}

export const Route = createFileRoute("/box-dice-advanced/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    return context.queryClient.ensureQueryData(
      boxApi.advancedDataTableQueryOptions({
        page: deps.page ?? 1,
        pageSize: deps.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: deps.sort,
        filters: deps.filters,
        joinOperator: deps.joinOperator,
      }),
    );
  },
  component: BoxDiceAdvancedPage,
});

function BoxDiceAdvancedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/box-dice-advanced/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] = useState<BoxRowAction | null>(null);

  const columns = useMemo(() => getBoxColumns({ setRowAction }), [setRowAction]);

  const queryOpts = useMemo(
    () =>
      boxApi.advancedDataTableQueryOptions({
        page: search.page ?? 1,
        pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: search.sort,
        filters: search.filters,
        joinOperator: search.joinOperator,
      }),
    [search],
  );

  const { data } = useSuspenseQuery(queryOpts);

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      navigate({
        search: (prev: AdvancedSearchParams) => {
          const next: Record<string, unknown> = { ...prev, ...updates };
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) cleaned[key] = value;
          }
          return cleaned as unknown as AdvancedSearchParams;
        },
      });
    },
    [navigate],
  );

  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount,
    search: search as unknown as Record<string, unknown>,
    onNavigate,
    initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
  });

  const handleFilterChange = useCallback(
    ({
      filters,
      joinOperator,
    }: {
      filters: ExtendedColumnFilter[];
      joinOperator: "and" | "or";
    }) => {
      navigate({
        search: (prev: AdvancedSearchParams) => ({
          ...prev,
          page: 1,
          filters: filters.length > 0 ? filters : undefined,
          joinOperator: joinOperator === "and" ? undefined : "or",
        }) as unknown as AdvancedSearchParams,
      });
    },
    [navigate],
  );

  // Serialize `filters` as JSON string when writing to URL.
  // TanStack Router serializes object search params as JSON automatically
  // for non-primitive values; if your router config uses the default
  // stringifier this works. If not, wrap the filters array in JSON.stringify
  // here before passing to navigate, and parse in validateSearch.

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["boxes"] });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetBox = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boxes (Dice) — Advanced</h1>
          <p className="mt-2 text-muted-foreground">{data.count} boxes</p>
        </div>
      </div>

      <DataTable table={table}>
        <DataTableAdvancedToolbar
          table={table}
          filters={search.filters}
          joinOperator={search.joinOperator}
          onChange={handleFilterChange}
        >
          <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
            <Plus className="mr-1 size-4" />
            Add Box
          </Button>
        </DataTableAdvancedToolbar>
      </DataTable>

      {sheetOpen && (
        <BoxSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          box={sheetBox}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm URL encoding of `filters`**

Read [src/main.tsx](src/main.tsx) to see how the router is configured. TanStack Router's default behavior for object/array search params is JSON-stringify-in-query. If it is, Task 9 above is complete. **If the configured stringifier keeps arrays as comma lists** (which would break the schema), change `parseFilters` to accept the already-parsed object too, and in `handleFilterChange` stringify the array explicitly:

```typescript
filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
```

and in `parseFilters` accept both a string and an array/object as input.

Verify by navigating the page manually in step 4; the URL should round-trip.

- [ ] **Step 3: Build (triggers route-tree codegen) and type-check**

Run: `npm run build`
Expected: build succeeds. This regenerates `src/routeTree.gen.ts` — do not edit it, it's auto-generated.

- [ ] **Step 4: Commit**

```bash
git add src/routes/box-dice-advanced/ src/routeTree.gen.ts
git commit -m "feat(route): add /box-dice-advanced/ page"
```

---

## Task 10: Sidebar entry

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add the nav item**

In `src/components/app-sidebar.tsx`, replace the `navItems` array with:

```typescript
const navItems = [
  { to: "/automated-system", label: "Automated Systems" },
  { to: "/box", label: "Boxes" },
  { to: "/box-dice", label: "Boxes (Dice)" },
  { to: "/box-dice-advanced", label: "Boxes (Dice) Advanced" },
  { to: "/flow-graph", label: "Flow Graph" },
  { to: "/components", label: "Components" },
] as const;
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(sidebar): add Boxes (Dice) Advanced nav entry"
```

---

## Task 11: Smoke test in the browser

- [ ] **Step 1: Run dev server with MSW**

Run: `VITE_MOCK_API=true npm run dev`
Expected: server at http://localhost:5173.

- [ ] **Step 2: Manual verification checklist**

Navigate to `/box-dice-advanced/` and verify:
- Page loads, table shows boxes, column headers sort on click
- `[Filter]` button opens popover
- `+ Add filter` shows field menu; picking `Name` adds a row with operator `contains`
- Typing into the text input updates URL (check `?filters=...`) after ~300 ms
- Adding a second filter shows the `Where [and/or]` toggle; switching to `or` persists to URL
- `isEmpty` hides the value input and still filters
- Picking `Shape` + `is any of` shows a multi-select; picking `O, X` updates URL
- `Reset all` clears filters and sets page back to 1
- `Add Box` still opens `BoxSheet`, saving invalidates and the list refetches
- `/box-dice/` (the original page) still works exactly as before — open it, confirm its toolbar is the old one and filters still work

- [ ] **Step 3: Lint + type-check + tests**

Run: `npm run lint && npx tsc --noEmit && npm run test`
Expected: all green.

- [ ] **Step 4: Commit any fixes from smoke test**

If issues were found and fixed, commit them:

```bash
git add -A
git commit -m "fix(box-dice-advanced): smoke test fixes"
```

If no fixes were needed, skip this commit.

---

## Self-Review Notes

- **Spec coverage:** URL shape (Task 9), type system (Tasks 2, 3), operator config (Task 3), OData builder + tests (Tasks 4, 5), API layer (Task 6), page component (Task 9), FilterList UI (Task 7), Advanced Toolbar (Task 8), sidebar (Task 10). Column meta extension from spec §"Column Meta on Boxes" is a no-op — the existing [src/features/box/columns.tsx](src/features/box/columns.tsx) already sets `label`, `variant`, `options`, `range`, and `relationConfig` on every filterable column, which is exactly what the FilterList reads. No task needed.
- **Field registry location:** Spec says "TanStack column meta". The implementation uses column meta for the **UI** (FilterList reads `table.getAllColumns()[i].columnDef.meta`) and a small explicit `boxFieldByColumnId` map for the **OData field overrides** (Task 6). This keeps `/box-dice/` unaffected and avoids coupling `getBoxColumns` to the OData field naming.
- **`notILike`:** Present in existing `dataTableConfig.operators` tuple. Included in `operatorLabels` (Task 3) to keep the `Record` exhaustive, and handled in the builder (Task 5). Not listed in `operatorsByVariant` because the spec doesn't require it in any variant — that's intentional; the UI never shows it, but the type stays sound.
- **URL `filters` encoding:** Task 9 step 2 flags the TanStack Router serializer compatibility check — this is the one unknown that requires in-editor verification rather than a prescribed patch.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-09-box-dice-advanced-filter-list.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
