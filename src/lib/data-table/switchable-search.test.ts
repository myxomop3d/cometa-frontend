import { describe, it, expect } from "vitest";
import {
  makeSwitchableSearch,
  buildModeToggleUpdates,
  parseFilters,
  parseIdList,
} from "./switchable-search";

// A resource with two simple fields: a text `name` and a comma-select `tags`.
const validateSimple = (s: Record<string, unknown>) => ({
  name: typeof s.name === "string" ? s.name : undefined,
  tags: Array.isArray(s.tags)
    ? (s.tags as string[])
    : typeof s.tags === "string"
      ? s.tags.split(",")
      : undefined,
});

describe("makeSwitchableSearch", () => {
  const validateSearch = makeSwitchableSearch(validateSimple);

  it("layers base + advanced + resource simple fields with defaults", () => {
    const s = validateSearch({});
    expect(s.page).toBe(1);
    expect(s.advanced).toBe(false);
    expect(s.filters).toEqual([]);
    expect(s.joinOperator).toBe("and");
    expect(s.name).toBeUndefined();
    expect(s.tags).toBeUndefined();
  });

  it("reads simple fields and advanced filters together", () => {
    const raw = JSON.stringify([{ id: "name", operator: "iLike", value: "x" }]);
    const s = validateSearch({ name: "abc", tags: "a,b", filters: raw, advanced: true });
    expect(s.name).toBe("abc");
    expect(s.tags).toEqual(["a", "b"]);
    expect(s.filters).toEqual([{ id: "name", operator: "iLike", value: "x" }]);
    expect(s.advanced).toBe(true);
  });
});

describe("buildModeToggleUpdates", () => {
  it("clears the given simple keys + filters/joinOperator, sets page=1", () => {
    const u = buildModeToggleUpdates(["name", "tags"], true);
    expect(u.advanced).toBe(true);
    expect(u.page).toBe(1);
    expect(u.name).toBeUndefined();
    expect(u.tags).toBeUndefined();
    expect(u).toHaveProperty("name");
    expect(u.filters).toBeUndefined();
    expect(u.joinOperator).toBeUndefined();
  });
  it("advanced=false drops the param", () => {
    expect(buildModeToggleUpdates([], false).advanced).toBeUndefined();
  });
});

describe("parseFilters / parseIdList", () => {
  it("parseFilters returns [] for malformed JSON, passes arrays through", () => {
    expect(parseFilters("nope")).toEqual([]);
    const f = [{ id: "n", operator: "eq", value: 1 }];
    expect(parseFilters(f)).toEqual(f);
  });
  it("parseIdList splits strings and keeps 0", () => {
    expect(parseIdList("0,1,2")).toEqual([0, 1, 2]);
    expect(parseIdList("")).toBeUndefined();
  });
});
