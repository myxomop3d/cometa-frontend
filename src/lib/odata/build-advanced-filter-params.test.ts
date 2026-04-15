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
