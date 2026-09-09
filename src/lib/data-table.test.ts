import { describe, it, expect } from "vitest";
import {
  calculatePageSize,
  PAGE_SIZE_STEPS,
  TABLE_CHROME_PX,
  TABLE_ROW_HEIGHT_PX,
} from "./data-table";

/** How many body rows actually fit in a viewport of `height` px. */
function rowsThatFit(height: number): number {
  return Math.floor((height - TABLE_CHROME_PX) / TABLE_ROW_HEIGHT_PX);
}

describe("PAGE_SIZE_STEPS", () => {
  it("steps by 5, not by 10", () => {
    expect([...PAGE_SIZE_STEPS]).toEqual([
      10, 15, 20, 25, 30, 35, 40, 45, 50,
    ]);
  });
});

describe("calculatePageSize", () => {
  it("never returns more rows than the viewport can show", () => {
    // One px at a time over every viewport height a real screen produces.
    for (let height = 600; height <= 2160; height++) {
      const size = calculatePageSize(height);
      const fits = rowsThatFit(height);
      // The smallest step is a floor: below it there is nothing to pick.
      if (size > PAGE_SIZE_STEPS[0]) {
        expect(size, `viewport ${height}px shows ${fits} rows`).toBeLessThanOrEqual(fits);
      }
    }
  });

  it("picks the largest step that still fits", () => {
    for (let height = 600; height <= 2160; height++) {
      const size = calculatePageSize(height);
      const fits = rowsThatFit(height);
      const next = PAGE_SIZE_STEPS.find((step) => step > size);
      if (next !== undefined) {
        expect(next, `viewport ${height}px shows ${fits} rows`).toBeGreaterThan(fits);
      }
    }
  });

  it("only ever returns one of the steps", () => {
    for (let height = 600; height <= 2160; height += 7) {
      expect(PAGE_SIZE_STEPS).toContain(calculatePageSize(height));
    }
  });

  it("fills a 1080px screen with 15 rows, not the 20 the old 40px-row estimate gave", () => {
    expect(calculatePageSize(1080)).toBe(15);
  });

  it("fills the measured 889px viewport with 10 rows", () => {
    // Measured on /automated-system: 313px of chrome, 49px rows → 11 fit.
    expect(calculatePageSize(889)).toBe(10);
  });

  it("falls back to the smallest step when there is no viewport to measure", () => {
    expect(calculatePageSize(null)).toBe(PAGE_SIZE_STEPS[0]);
  });

  it("never returns less than the smallest step, however short the window", () => {
    expect(calculatePageSize(200)).toBe(PAGE_SIZE_STEPS[0]);
  });
});
