import { describe, expect, it } from "vitest";
import { buildMicroserviceParams } from "./api";
import type { MicroserviceSearch } from "./search";

const base: MicroserviceSearch = {
  page: 1,
  pageSize: undefined,
  sort: "name.asc",
  name: undefined,
  env: undefined,
  artifactId: undefined,
  topic: undefined,
};

describe("buildMicroserviceParams", () => {
  it("sends only paging and sort when no filter is set", () => {
    expect(buildMicroserviceParams(base, 20).toString()).toBe(
      "%24top=20&%24skip=0&%24orderby=name+asc",
    );
  });

  it("turns page and pageSize into $top/$skip", () => {
    const params = buildMicroserviceParams({ ...base, page: 3 }, 25);
    expect(params.get("$top")).toBe("25");
    expect(params.get("$skip")).toBe("50");
  });

  it("maps field.dir sort to an OData-style $orderby", () => {
    expect(
      buildMicroserviceParams({ ...base, sort: "environment.desc" }, 20).get("$orderby"),
    ).toBe("environment desc");
  });

  it("repeats env once per value", () => {
    const params = buildMicroserviceParams({ ...base, env: ["IFT", "PROD"] }, 20);
    expect(params.getAll("env")).toEqual(["IFT", "PROD"]);
  });

  it("sends text filters verbatim and omits absent ones", () => {
    const params = buildMicroserviceParams(
      { ...base, name: "zeus", topic: "CALYPSO.PAYMENTS" },
      20,
    );
    expect(params.get("name")).toBe("zeus");
    expect(params.get("topic")).toBe("CALYPSO.PAYMENTS");
    expect(params.has("artifactId")).toBe(false);
    expect(params.has("env")).toBe(false);
  });
});
