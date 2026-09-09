import { describe, it, expect } from "vitest";
import { dash } from "./format";

describe("dash", () => {
  it("renders an em dash for null and undefined", () => {
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
  });

  it("renders an em dash for the empty string, which is now how a cleared field is stored", () => {
    expect(dash("")).toBe("—");
  });

  it("passes a real value through unchanged", () => {
    expect(dash("Финансы")).toBe("Финансы");
  });

  it("does not swallow 0, which is a value and not an empty state", () => {
    expect(dash(0)).toBe("0");
  });
});
