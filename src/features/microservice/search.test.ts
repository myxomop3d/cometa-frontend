import { describe, expect, it } from "vitest";
import { validateMicroserviceSearch } from "./search";

describe("validateMicroserviceSearch", () => {
  it("fills defaults for an empty URL", () => {
    expect(validateMicroserviceSearch({})).toEqual({
      page: 1,
      pageSize: undefined,
      sort: "name.asc",
      name: undefined,
      env: undefined,
      artifactId: undefined,
      topic: undefined,
    });
  });

  it("keeps valid values", () => {
    expect(
      validateMicroserviceSearch({
        page: 3,
        pageSize: 25,
        sort: "environment.desc",
        name: "zeus",
        env: ["IFT", "PROD"],
        artifactId: "kafka-payload",
        topic: "CALYPSO.PAYMENTS",
      }),
    ).toEqual({
      page: 3,
      pageSize: 25,
      sort: "environment.desc",
      name: "zeus",
      env: ["IFT", "PROD"],
      artifactId: "kafka-payload",
      topic: "CALYPSO.PAYMENTS",
    });
  });

  it("only lets whitelisted sorts through to $orderby", () => {
    expect(validateMicroserviceSearch({ sort: "name.desc" }).sort).toBe("name.desc");
    expect(validateMicroserviceSearch({ sort: "environment.asc" }).sort).toBe("environment.asc");
    expect(validateMicroserviceSearch({ sort: "guid.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceSearch({ sort: "topics.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceSearch({ sort: "name.asc,environment.desc" }).sort).toBe("name.asc");
  });

  it("keeps only known environments, deduplicated", () => {
    expect(validateMicroserviceSearch({ env: ["IFT", "QA", "IFT", 5] }).env).toEqual(["IFT"]);
    expect(validateMicroserviceSearch({ env: ["QA"] }).env).toBeUndefined();
    expect(validateMicroserviceSearch({ env: [] }).env).toBeUndefined();
  });

  it("accepts a single env string from a hand-edited URL", () => {
    expect(validateMicroserviceSearch({ env: "UAT" }).env).toEqual(["UAT"]);
    expect(validateMicroserviceSearch({ env: "QA" }).env).toBeUndefined();
  });

  it("drops empty or non-string text filters", () => {
    const s = validateMicroserviceSearch({ name: "", artifactId: 42, topic: "" });
    expect(s.name).toBeUndefined();
    expect(s.artifactId).toBeUndefined();
    expect(s.topic).toBeUndefined();
  });

  it("falls back on junk page and pageSize", () => {
    expect(validateMicroserviceSearch({ page: 0 }).page).toBe(1);
    expect(validateMicroserviceSearch({ page: 1.5 }).page).toBe(1);
    expect(validateMicroserviceSearch({ page: -2 }).page).toBe(1);
    expect(validateMicroserviceSearch({ pageSize: 7 }).pageSize).toBeUndefined();
    expect(validateMicroserviceSearch({ pageSize: "20" }).pageSize).toBeUndefined();
  });
});
