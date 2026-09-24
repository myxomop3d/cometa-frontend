import { describe, it, expect } from "vitest";
import { toSelectedIds } from "./relation-picker";

describe("toSelectedIds", () => {
  it("treats a single-relation value of 0 as selected", () => {
    expect(toSelectedIds(0, false)).toEqual([0]);
  });

  it("treats a to-many value containing 0 as selected", () => {
    expect(toSelectedIds([0, 5], true)).toEqual([0, 5]);
  });

  it("returns an empty array for undefined", () => {
    expect(toSelectedIds(undefined, false)).toEqual([]);
  });

  it("returns an empty array for null", () => {
    expect(toSelectedIds(null, false)).toEqual([]);
  });

  it("wraps a normal single id", () => {
    expect(toSelectedIds(7, false)).toEqual([7]);
  });
});
