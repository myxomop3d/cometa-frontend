import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import {
  techComponentFilterDescriptors,
  deriveColumnFiltersFromSearch,
} from "./filter-descriptors";

function build(sort?: string, columnFilters: { id: string; value: unknown }[] = []) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors: techComponentFilterDescriptors,
  });
}

describe("tech component automatedSystem relation filter", () => {
  it("filters through the to-one navigation path", () => {
    expect(build(undefined, [{ id: "automatedSystem", value: 582 }]).get("$filter"))
      .toBe("automatedSystem/id eq 582");
  });

  it("matches the not-set sentinel like any id", () => {
    expect(build(undefined, [{ id: "automatedSystem", value: 0 }]).get("$filter"))
      .toBe("automatedSystem/id eq 0");
  });

  it("sorts by the automated system's name through the navigation path", () => {
    expect(build("automatedSystem.asc").get("$orderby")).toBe("automatedSystem/name asc");
    expect(build("automatedSystem.desc").get("$orderby")).toBe("automatedSystem/name desc");
  });
});

describe("tech component scalar filters", () => {
  it("uses contains_ignoring_case for groupName", () => {
    expect(build(undefined, [{ id: "groupName", value: "Kafka" }]).get("$filter"))
      .toBe("contains_ignoring_case(groupName, 'Kafka')");
  });

  it("uses eq for environment", () => {
    expect(build(undefined, [{ id: "environment", value: ["PROD"] }]).get("$filter"))
      .toBe("environment eq 'PROD'");
  });
});

describe("deriveColumnFiltersFromSearch", () => {
  it("maps URL param names onto column ids, wrapping select values in an array", () => {
    expect(
      deriveColumnFiltersFromSearch({
        name: "k8s",
        environment: "PROD",
        automatedSystemId: 0,
      }),
    ).toEqual([
      { id: "name", value: "k8s" },
      { id: "environment", value: ["PROD"] },
      { id: "automatedSystem", value: 0 },
    ]);
  });

  it("ignores params that are absent", () => {
    expect(deriveColumnFiltersFromSearch({})).toEqual([]);
  });
});
