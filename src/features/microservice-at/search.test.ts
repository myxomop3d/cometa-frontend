import { describe, expect, it } from "vitest";
import { deriveColumnFilters, validateMicroserviceAtSearch } from "./search";

describe("validateMicroserviceAtSearch", () => {
  it("fills defaults for an empty URL", () => {
    expect(validateMicroserviceAtSearch({})).toEqual({
      page: 1,
      pageSize: undefined,
      sort: "name.asc",
      name: undefined,
    });
  });

  it("keeps valid values", () => {
    expect(
      validateMicroserviceAtSearch({ page: 3, pageSize: 25, sort: "name.desc", name: "pos" }),
    ).toEqual({ page: 3, pageSize: 25, sort: "name.desc", name: "pos" });
  });

  it("never lets a sort on another field through to $orderby", () => {
    expect(validateMicroserviceAtSearch({ sort: "guid.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceAtSearch({ sort: "nodes.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceAtSearch({ sort: "name.asc,id.desc" }).sort).toBe("name.asc");
  });

  it("drops junk page and empty name", () => {
    const s = validateMicroserviceAtSearch({ page: 0, name: "" });
    expect(s.page).toBe(1);
    expect(s.name).toBeUndefined();
  });
});

describe("deriveColumnFilters", () => {
  it("maps name to the name column filter", () => {
    const s = validateMicroserviceAtSearch({ name: "pos" });
    expect(deriveColumnFilters(s)).toEqual([{ id: "name", value: "pos" }]);
  });

  it("is empty without a name", () => {
    expect(deriveColumnFilters(validateMicroserviceAtSearch({}))).toEqual([]);
  });
});
