import { describe, it, expect } from "vitest";
import type { LinkDto } from "@/types/api";
import type { FlowGraphEdge } from "./types";
import { assignParallelOffsets, GAP } from "./parallel";

const edge = (id: string, source: string, target: string): FlowGraphEdge => ({
  id,
  source,
  target,
  type: "dataFlow",
  data: {
    link: {} as LinkDto,
    direction: "CODIRECTIONAL",
    roundTrip: false,
    crossGuid: "g",
  },
});

const offsets = (edges: FlowGraphEdge[]): Record<string, number> =>
  Object.fromEntries(
    assignParallelOffsets(edges).map((e) => [e.id, e.data!.laneOffset]),
  );

describe("assignParallelOffsets", () => {
  it("gives a lone link offset 0", () => {
    expect(offsets([edge("1", "a", "b")])).toEqual({ "1": 0 });
  });

  it("groups A->B and B->A into the same corridor", () => {
    const o = offsets([edge("1", "a", "b"), edge("2", "b", "a")]);
    // count 2 -> gap 22 -> [-11, +11], sorted by id
    expect(o["1"]).toBeCloseTo(-GAP / 2);
    expect(o["2"]).toBeCloseTo(GAP / 2);
    expect(o["1"] + o["2"]).toBeCloseTo(0);
  });

  it("produces symmetric, evenly spaced offsets for a group of 3", () => {
    const o = offsets([
      edge("1", "a", "b"),
      edge("2", "a", "b"),
      edge("3", "a", "b"),
    ]);
    // count 3 -> gap min(22, 60/2=30) = 22 -> [-22, 0, 22]
    expect(o["1"]).toBeCloseTo(-GAP);
    expect(o["2"]).toBeCloseTo(0);
    expect(o["3"]).toBeCloseTo(GAP);
    expect(o["3"] - o["2"]).toBeCloseTo(o["2"] - o["1"]);
  });

  it("caps total spread at MAX_SPREAD for large bundles", () => {
    const edges = Array.from({ length: 6 }, (_, i) =>
      edge(String(i), "a", "b"),
    );
    const vals = Object.values(offsets(edges));
    // count 6 -> gap min(22, 60/5=12) = 12 -> max abs offset 30, spacing 12
    expect(Math.max(...vals)).toBeCloseTo(30);
    expect(Math.min(...vals)).toBeCloseTo(-30);
    const sorted = [...vals].sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeCloseTo(12);
  });

  it("keeps separate corridors independent", () => {
    const o = offsets([
      edge("1", "a", "b"),
      edge("2", "a", "b"),
      edge("3", "c", "d"),
    ]);
    expect(o["1"]).toBeCloseTo(-GAP / 2);
    expect(o["2"]).toBeCloseTo(GAP / 2);
    expect(o["3"]).toBe(0);
  });

  it("is deterministic across calls", () => {
    const edges = [edge("2", "a", "b"), edge("1", "a", "b")];
    expect(offsets(edges)).toEqual(offsets(edges));
  });
});
