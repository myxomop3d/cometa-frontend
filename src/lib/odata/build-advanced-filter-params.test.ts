import { describe, it, expect, vi } from "vitest";
import { buildAdvancedFilterParams } from "./build-advanced-filter-params";
import type { ExtendedColumnFilter } from "@/types/data-table";

const fieldByColumnId = {
  name:      { field: "name",      variant: "text" as const },
  num:       { field: "num",       variant: "range" as const },
  shape:     { field: "shape",     variant: "select" as const },
  tags:      { field: "tags",      variant: "multiSelect" as const },
  checkbox:  { field: "checkbox",  variant: "boolean" as const },
  dateStr:   { field: "dateStr",   variant: "dateRange" as const },
  item:      { field: "itemId",    variant: "relation" as const },
  things:    { field: "things",    variant: "multiRelation" as const },
  oldThings: { field: "oldThings", variant: "multiRelation" as const },
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

  it("relation eq/ne compares the flat scalar field", () => {
    const p = build([
      { id: "item", operator: "eq", value: { id: 7, label: "Seven" } },
    ]);
    expect(p.get("$filter")).toBe("itemId eq 7");
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

describe("buildAdvancedFilterParams $orderby", () => {
  it("substitutes sortField for the column id", () => {
    const p = buildAdvancedFilterParams({
      page: 1,
      pageSize: 10,
      sort: "leader.asc",
      filters: [],
      joinOperator: "and",
      fieldByColumnId: {
        leader: {
          field: "leaderId",
          sortField: "leader.lastName",
          variant: "relation",
        },
      },
    });
    expect(p.get("$orderby")).toBe("leader.lastName asc");
  });
});

describe("buildAdvancedFilterParams relation vs multiRelation", () => {
  it("emits a flat in-list for a to-one relation", () => {
    const p = build([
      { id: "item", operator: "inArray", value: [30, 31] },
    ]);
    expect(p.get("$filter")).toBe("itemId in (30,31)");
  });

  it("emits an any() lambda for a to-many relation", () => {
    const p = build([
      { id: "things", operator: "inArray", value: [1425] },
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1425))");
  });

  it("puts the lambda last regardless of filter order", () => {
    const p = build([
      { id: "things", operator: "inArray", value: [1425] },
      { id: "name", operator: "iLike", value: "мох" },
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(name, 'мох') and things/any(x: x/id in (1425))",
    );
  });

  it("keeps only the first lambda", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = build([
      { id: "things", operator: "inArray", value: [1] },
      { id: "oldThings", operator: "inArray", value: [2] },
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1))");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // Regression for Critical-1: a text filter whose value happens to contain
  // the substring "/any(" must NOT be misclassified as a collection lambda.
  // The old code classified by `clause.includes("/any(")`, so this text
  // clause would win the one-lambda cap slot and the real `things/any(...)`
  // filter would be silently dropped. Partitioning must be structural, on
  // `entry.variant`, not on the rendered clause text.
  it("does not misclassify a text value containing '/any(' as a lambda", () => {
    const p = build([
      { id: "name", operator: "iLike", value: "a/any(b" },
      {
        id: "things",
        operator: "inArray",
        value: [{ id: 7, label: "g" }],
      },
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(name, 'a/any(b') and things/any(x: x/id in (7))",
    );
  });

  // Regression: keptField must be derived structurally (entry.field), not by
  // splitting the rendered clause on "/any(". A negated lambda renders as
  // `not (things/any(...))`, and splitting that on "/any(" used to leak
  // "not (things" into the user-facing toast.
  it("reports the plain field name (no 'not (' prefix) when the kept lambda is negated", () => {
    const onLambdaCapped = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = buildAdvancedFilterParams({
      page: 1,
      pageSize: 20,
      filters: [
        {
          id: "things",
          operator: "notInArray",
          value: [{ id: 1, label: "a" }],
        },
        { id: "oldThings", operator: "inArray", value: [{ id: 2, label: "b" }] },
      ],
      joinOperator: "and",
      fieldByColumnId,
      onLambdaCapped,
    });
    expect(p.get("$filter")).toBe("not (things/any(x: x/id in (1)))");
    expect(onLambdaCapped).toHaveBeenCalledWith({
      keptField: "things",
      droppedCount: 1,
    });
    warn.mockRestore();
  });

  // Regression for the last review item: a multiRelation + isEmpty/isNotEmpty
  // filter must contribute no clause at all. `things eq null` raises a JPQL
  // SemanticException -> HTTP 500 against this backend, and — because
  // partitioning is now structural on entry.variant — a `things eq null`
  // clause has no "/any(" in it yet would still be routed into
  // lambdaClauses, where it could steal the one-lambda cap slot from a real
  // collection filter. The guard in clauseFor must return null before either
  // happens. This filter shape can only reach the builder via a
  // bookmarked/shared URL now that the UI no longer offers these operators
  // for multiRelation (see config/data-table.ts).
  it("multiRelation isEmpty/isNotEmpty contributes no clause (would otherwise 500)", () => {
    const p = build([{ id: "things", operator: "isEmpty", value: undefined }]);
    expect(p.get("$filter")).toBeNull();

    const p2 = build([
      { id: "things", operator: "isNotEmpty", value: undefined },
    ]);
    expect(p2.get("$filter")).toBeNull();
  });

  it("multiRelation isEmpty does not steal the lambda cap from a real collection filter", () => {
    const p = build([
      { id: "things", operator: "isEmpty", value: undefined },
      {
        id: "oldThings",
        operator: "inArray",
        value: [{ id: 9, label: "z" }],
      },
    ]);
    expect(p.get("$filter")).toBe("oldThings/any(x: x/id in (9))");
  });
});
