import { describe, it, expect } from "vitest";
import { boxes } from "./boxes";
import { applyOData } from "../lib/odata";

describe("boxes fixture — itemId/oldItemId derivation", () => {
  it("derives itemId from the nested item on every row", () => {
    for (const box of boxes) {
      expect(box.itemId).toBe(box.item?.id ?? null);
    }
  });

  it("derives oldItemId from the nested oldItem on every row", () => {
    for (const box of boxes) {
      expect(box.oldItemId).toBe(box.oldItem?.id ?? null);
    }
  });

  it("has at least one row with a null item and one with a populated item", () => {
    expect(boxes.some((b) => b.item === null)).toBe(true);
    expect(boxes.some((b) => b.item !== null)).toBe(true);
  });
});

describe("boxes fixture — itemId eq N filters end-to-end through the mock OData engine", () => {
  it("narrows to exactly the rows whose nested item matches the id", () => {
    const targetId = boxes.find((b) => b.item !== null)!.item!.id;
    const expected = boxes
      .filter((b) => b.itemId === targetId)
      .map((b) => b.id)
      .sort((a, b) => a - b);

    const { items, total } = applyOData(boxes, {
      skip: 0,
      top: 0,
      filter: `itemId eq ${targetId}`,
      orderby: null,
    });

    expect(items.map((b) => b.id).sort((a, b) => a - b)).toEqual(expected);
    expect(total).toBe(expected.length);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("narrows to exactly the rows whose nested oldItem matches the id", () => {
    const targetId = boxes.find((b) => b.oldItem !== null)!.oldItem!.id;
    const expected = boxes
      .filter((b) => b.oldItemId === targetId)
      .map((b) => b.id)
      .sort((a, b) => a - b);

    const { items } = applyOData(boxes, {
      skip: 0,
      top: 0,
      filter: `oldItemId eq ${targetId}`,
      orderby: null,
    });

    expect(items.map((b) => b.id).sort((a, b) => a - b)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("things/any(...) multi-relation filtering still works against the fixtures", () => {
    const { items } = applyOData(boxes, {
      skip: 0,
      top: 0,
      filter: "things/any(x: x/id in (1))",
      orderby: null,
    });
    const expected = boxes
      .filter((b) => (b.things ?? []).some((t) => t.id === 1))
      .map((b) => b.id)
      .sort((a, b) => a - b);

    expect(items.map((b) => b.id).sort((a, b) => a - b)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });
});
