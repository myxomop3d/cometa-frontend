import { describe, it, expect } from "vitest";
import {
  validateSearch,
  parseIdList,
  parseFilters,
  buildModeToggleUpdates,
  SIMPLE_FILTER_KEYS,
} from "./-search";

describe("validateSearch", () => {
  it("applies defaults for an empty search", () => {
    const s = validateSearch({});
    expect(s.page).toBe(1);
    expect(s.pageSize).toBeUndefined();
    expect(s.sort).toBeUndefined();
    expect(s.advanced).toBe(false);
    expect(s.filters).toEqual([]);
    expect(s.joinOperator).toBe("and");
    expect(s.name).toBeUndefined();
  });

  it("coerces the advanced flag from boolean and string", () => {
    expect(validateSearch({ advanced: true }).advanced).toBe(true);
    expect(validateSearch({ advanced: "true" }).advanced).toBe(true);
    expect(validateSearch({ advanced: false }).advanced).toBe(false);
    expect(validateSearch({}).advanced).toBe(false);
  });

  it("reads simple-mode flat params", () => {
    const s = validateSearch({ name: "abc", numMin: 2, shape: "a,b" });
    expect(s.name).toBe("abc");
    expect(s.numMin).toBe(2);
    expect(s.shape).toEqual(["a", "b"]);
  });

  it("parses advanced filters from a JSON string", () => {
    const raw = JSON.stringify([{ id: "name", operator: "iLike", value: "x" }]);
    const s = validateSearch({ filters: raw, joinOperator: "or" });
    expect(s.filters).toEqual([{ id: "name", operator: "iLike", value: "x" }]);
    expect(s.joinOperator).toBe("or");
  });

  it("returns [] for malformed filters JSON", () => {
    expect(validateSearch({ filters: "not-json" }).filters).toEqual([]);
  });
});

describe("parseIdList", () => {
  it("splits a comma string into numbers", () => {
    expect(parseIdList("1,2,3")).toEqual([1, 2, 3]);
  });
  it("passes an array through as numbers", () => {
    expect(parseIdList(["4", "5"])).toEqual([4, 5]);
  });
  it("returns undefined for empty/invalid input", () => {
    expect(parseIdList("")).toBeUndefined();
    expect(parseIdList(undefined)).toBeUndefined();
  });
});

describe("parseFilters", () => {
  it("accepts an already-parsed array", () => {
    const f = [{ id: "num", operator: "eq", value: 3 }];
    expect(parseFilters(f)).toEqual(f);
  });
  it("returns [] for a non-array", () => {
    expect(parseFilters({ id: "x" })).toEqual([]);
  });
});

describe("buildModeToggleUpdates", () => {
  it("switching to advanced sets advanced=true, page=1 and clears every simple + advanced param", () => {
    const u = buildModeToggleUpdates(true);
    expect(u.advanced).toBe(true);
    expect(u.page).toBe(1);
    for (const key of SIMPLE_FILTER_KEYS) {
      expect(u).toHaveProperty(key);
      expect(u[key]).toBeUndefined();
    }
    expect(u.filters).toBeUndefined();
    expect(u.joinOperator).toBeUndefined();
  });

  it("switching to simple sets advanced=undefined so the URL param drops", () => {
    const u = buildModeToggleUpdates(false);
    expect(u.advanced).toBeUndefined();
    expect(u.page).toBe(1);
    expect(u.filters).toBeUndefined();
  });
});
