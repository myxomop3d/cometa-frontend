import { describe, it, expect } from "vitest";
import type { PairIndex } from "./pairs";
import { collapseAll, expandAll, showNode, hideNode } from "./expand-state";

const idx: PairIndex = {
  pairs: new Map([
    ["g1", {} as never],
    ["g2", {} as never],
    ["g3", {} as never],
  ]),
  hideableNodes: new Set([2]),
  nodePairs: new Map([
    [2, ["g1", "g2"]], // node 2 proxies g1 and g2
    [5, ["g3"]],
  ]),
};

describe("expand-state", () => {
  it("collapseAll returns an empty set", () => {
    expect(collapseAll().size).toBe(0);
  });
  it("expandAll returns every pair guid", () => {
    expect([...expandAll(idx)].sort()).toEqual(["g1", "g2", "g3"]);
  });
  it("showNode adds one guid without mutating the input", () => {
    const before = new Set<string>();
    const after = showNode(before, "g1");
    expect(before.size).toBe(0);
    expect([...after]).toEqual(["g1"]);
  });
  it("hideNode removes all guids proxied by the node", () => {
    const after = hideNode(new Set(["g1", "g2", "g3"]), idx, 2);
    expect([...after]).toEqual(["g3"]); // g1,g2 removed; g3 (node 5) kept
  });
  it("hideNode is a no-op for a node with no pairs", () => {
    const after = hideNode(new Set(["g1"]), idx, 99);
    expect([...after]).toEqual(["g1"]);
  });
});
