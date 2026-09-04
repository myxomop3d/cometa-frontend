import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import {
  automatedSystemFilterDescriptors,
  deriveColumnFiltersFromSearch,
} from "./filter-descriptors";

function build(sort?: string, columnFilters: { id: string; value: unknown }[] = []) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors: automatedSystemFilterDescriptors,
  });
}

describe("automated system leader relation filter", () => {
  it("filters the leader through the to-one navigation path", () => {
    const p = build(undefined, [{ id: "leader", value: 30 }]);
    expect(p.get("$filter")).toBe("leader/id eq 30");
  });

  it("sorts by the leader's surname through the navigation path", () => {
    expect(build("leader.asc").get("$orderby")).toBe("leader/lastName asc");
    expect(build("leader.desc").get("$orderby")).toBe("leader/lastName desc");
  });
});

describe("automated system scalar filters", () => {
  it("uses contains_ignoring_case for the renamed leaderComment field", () => {
    const p = build(undefined, [{ id: "leaderComment", value: "фил" }]);
    expect(p.get("$filter")).toBe("contains_ignoring_case(leaderComment, 'фил')");
  });

  it("uses eq for status", () => {
    const p = build(undefined, [{ id: "status", value: ["Выведен из эксплуатации"] }]);
    expect(p.get("$filter")).toBe("status eq 'Выведен из эксплуатации'");
  });
});

describe("deriveColumnFiltersFromSearch", () => {
  it("maps URL param names onto column ids, wrapping select values in an array", () => {
    expect(
      deriveColumnFiltersFromSearch({
        name: "Aspect",
        leaderId: 30,
        status: ["Находится в эксплуатации"],
      }),
    ).toEqual([
      { id: "name", value: "Aspect" },
      { id: "status", value: ["Находится в эксплуатации"] },
      { id: "leader", value: 30 },
    ]);
  });

  it("ignores params that are absent", () => {
    expect(deriveColumnFiltersFromSearch({})).toEqual([]);
  });
});
