import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import { personFilterDescriptors } from "./filter-descriptors";

function build(columnFilters: { id: string; value: unknown }[]) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    columnFilters,
    descriptors: personFilterDescriptors,
  });
}

describe("person teams filter", () => {
  it("emits an any() lambda over the teams collection", () => {
    const p = build([{ id: "teams", value: [1425, 1432] }]);
    expect(p.get("$filter")).toBe("teams/any(x: x/id in (1425,1432))");
  });

  it("emits the lambda after a scalar filter", () => {
    const p = build([
      { id: "teams", value: [1425] },
      { id: "lastName", value: "мох" },
    ]);
    expect(p.get("$filter")).toBe(
      "contains_ignoring_case(lastName, 'мох') and teams/any(x: x/id in (1425))",
    );
  });
});
