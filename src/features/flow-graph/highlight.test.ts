import { describe, it, expect } from "vitest";
import { isHighlighted } from "./highlight";

describe("isHighlighted", () => {
  it("true when the edge guid equals the hovered guid", () => {
    expect(isHighlighted("g1", "g1")).toBe(true);
  });
  it("false when guids differ", () => {
    expect(isHighlighted("g1", "g2")).toBe(false);
  });
  it("false when nothing is hovered", () => {
    expect(isHighlighted("g1", null)).toBe(false);
  });
  it("false when the edge has no guid", () => {
    expect(isHighlighted(undefined, "g1")).toBe(false);
  });
});
