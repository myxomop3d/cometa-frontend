import { describe, it, expect } from "vitest";
import {
  validateSearch,
  parseFilters,
  buildModeToggleUpdates,
  SIMPLE_FILTER_KEYS,
} from "./-search";

describe("flow validateSearch", () => {
  it("applies defaults for an empty search", () => {
    const s = validateSearch({});
    expect(s.page).toBe(1);
    expect(s.advanced).toBe(false);
    expect(s.filters).toEqual([]);
    expect(s.joinOperator).toBe("and");
    expect(s.key).toBeUndefined();
    expect(s.integrity).toBeUndefined();
  });

  it("coerces advanced from boolean/string", () => {
    expect(validateSearch({ advanced: true }).advanced).toBe(true);
    expect(validateSearch({ advanced: "true" }).advanced).toBe(true);
    expect(validateSearch({}).advanced).toBe(false);
  });

  it("reads text and select simple params", () => {
    const s = validateSearch({ caption: "abc", integrity: "high,low" });
    expect(s.caption).toBe("abc");
    expect(s.integrity).toEqual(["high", "low"]);
  });

  it("parses advanced filters from JSON string; [] on malformed", () => {
    const raw = JSON.stringify([{ id: "key", operator: "iLike", value: "x" }]);
    expect(validateSearch({ filters: raw }).filters).toEqual([
      { id: "key", operator: "iLike", value: "x" },
    ]);
    expect(validateSearch({ filters: "nope" }).filters).toEqual([]);
  });
});

describe("flow buildModeToggleUpdates", () => {
  it("clears all 6 simple fields + filters/joinOperator, sets page=1", () => {
    const u = buildModeToggleUpdates(true);
    expect(u.advanced).toBe(true);
    expect(u.page).toBe(1);
    for (const k of SIMPLE_FILTER_KEYS) {
      expect(u).toHaveProperty(k);
      expect(u[k]).toBeUndefined();
    }
    expect(u.filters).toBeUndefined();
    expect(u.joinOperator).toBeUndefined();
  });
  it("advanced=false drops the param", () => {
    expect(buildModeToggleUpdates(false).advanced).toBeUndefined();
  });
});
