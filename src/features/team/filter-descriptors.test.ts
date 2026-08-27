import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import { teamFilterDescriptors } from "./filter-descriptors";

function build(sort?: string, columnFilters: { id: string; value: unknown }[] = []) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors: teamFilterDescriptors,
  });
}

describe("team leader sorting", () => {
  it("sorts by the leader's surname via a navigation path", () => {
    expect(build("leader.asc").get("$orderby")).toBe("leader/lastName asc");
    expect(build("leader.desc").get("$orderby")).toBe("leader/lastName desc");
  });

  it("filters the leader via the nav path", () => {
    const p = build(undefined, [{ id: "leader", value: 30 }]);
    expect(p.get("$filter")).toBe("leader/id eq 30");
  });
});
