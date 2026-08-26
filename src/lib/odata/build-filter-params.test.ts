import { describe, it, expect, vi } from "vitest";
import { buildFilterParams } from "./build-filter-params";
import type { FilterDescriptor } from "./build-filter-params";

const descriptors: readonly FilterDescriptor[] = [
  { id: "name", variant: "text" },
  { id: "item", variant: "relation", field: "itemId" },
  { id: "things", variant: "multiRelation" },
  { id: "oldThings", variant: "multiRelation" },
  { id: "leader", variant: "relation", field: "leaderId", sortField: "leader/lastName" },
];

function build(columnFilters: { id: string; value: unknown }[], sort?: string) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors,
  });
}

describe("buildFilterParams pagination", () => {
  it("maps page/pageSize to $skip/$top", () => {
    const p = build([]);
    expect(p.get("$skip")).toBe("0");
    expect(p.get("$top")).toBe("10");
  });
});

describe("buildFilterParams relation", () => {
  it("emits a flat scalar comparison, not a navigation path", () => {
    const p = build([{ id: "item", value: 7 }]);
    expect(p.get("$filter")).toBe("itemId eq 7");
  });

  it("omits the clause when the value is undefined", () => {
    const p = build([{ id: "item", value: undefined }]);
    expect(p.get("$filter")).toBeNull();
  });
});

describe("buildFilterParams multiRelation", () => {
  it("still emits the collection navigation form", () => {
    const p = build([{ id: "things", value: [1, 2] }]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1,2))");
  });
});

describe("buildFilterParams $orderby", () => {
  it("emits the column id when no sortField is configured", () => {
    const p = build([], "name.asc");
    expect(p.get("$orderby")).toBe("name asc");
  });

  it("substitutes sortField for the column id", () => {
    const p = buildFilterParams({
      page: 1,
      pageSize: 10,
      sort: "item.desc",
      columnFilters: [],
      descriptors: [
        { id: "item", variant: "relation", field: "itemId", sortField: "item.name" },
      ],
    });
    expect(p.get("$orderby")).toBe("item.name desc");
  });

  it("handles multiple sort parts", () => {
    const p = buildFilterParams({
      page: 1,
      pageSize: 10,
      sort: "item.asc,name.desc",
      columnFilters: [],
      descriptors: [
        { id: "item", variant: "relation", field: "itemId", sortField: "item.name" },
        { id: "name", variant: "text" },
      ],
    });
    expect(p.get("$orderby")).toBe("item.name asc,name desc");
  });
});

describe("buildFilterParams any() clause ordering", () => {
  it("emits the collection lambda last even when it is filtered first", () => {
    const p = build([
      { id: "things", value: [1, 2] },
      { id: "name", value: "abc" },
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(name, 'abc') and things/any(x: x/id in (1,2))",
    );
  });

  it("emits only the first lambda when two collections are filtered", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = build([
      { id: "things", value: [1, 2] },
      { id: "oldThings", value: [3] },
    ]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1,2))");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("buildFilterParams nav-path sortField", () => {
  it("emits the configured navigation path for $orderby", () => {
    const p = build([], "leader.asc");
    expect(p.get("$orderby")).toBe("leader/lastName asc");
  });
});
