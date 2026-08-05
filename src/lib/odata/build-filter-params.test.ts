import { describe, it, expect } from "vitest";
import { buildFilterParams } from "./build-filter-params";
import type { FilterDescriptor } from "./build-filter-params";

const descriptors: readonly FilterDescriptor[] = [
  { id: "name", variant: "text" },
  { id: "item", variant: "relation", field: "itemId" },
  { id: "things", variant: "multiRelation" },
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
