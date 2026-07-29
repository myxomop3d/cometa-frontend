import { describe, it, expect } from "vitest";
import { layoutGraph } from "./layout";
import type { FlowGraphNode, FlowGraphEdge } from "./types";

const mkNode = (id: string, width = 220, height = 80): FlowGraphNode => ({
  id, type: "flowGraphNode", position: { x: 0, y: 0 },
  measured: { width, height },
  data: {
    node: {
      id: Number(id), insertedAt: null, updatedAt: null,
      nodeType: "MICROSERVICE", name: id, environment: "PROD", automatedSystem: null,
    },
  },
});

const edge = (source: string, target: string): FlowGraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { link: {} as never, direction: "CODIRECTIONAL", roundTrip: false, crossGuid: "" },
});

describe("layoutGraph", () => {
  it("assigns non-zero positions to connected nodes (LR)", () => {
    const nodes: FlowGraphNode[] = [mkNode("1"), mkNode("2")];
    const out = layoutGraph(nodes, [edge("1", "2")]);
    const a = out.find((n) => n.id === "1")!;
    const b = out.find((n) => n.id === "2")!;
    expect(b.position.x).toBeGreaterThan(a.position.x);
  });

  it("still returns a position for disconnected nodes", () => {
    const nodes: FlowGraphNode[] = [mkNode("1")];
    const out = layoutGraph(nodes, []);
    expect(out[0].position.x).toBeGreaterThanOrEqual(0);
    expect(out[0].position.y).toBeGreaterThanOrEqual(0);
  });

  it("reserves each node's measured width so a wide node does not overlap its neighbour", () => {
    const wide = mkNode("1", 400);
    const narrow = mkNode("2", 220);
    const out = layoutGraph([wide, narrow], [edge("1", "2")]);
    const a = out.find((n) => n.id === "1")!;
    const b = out.find((n) => n.id === "2")!;
    // Gap between the wide node's right edge and the next node's left edge.
    const gap = b.position.x - (a.position.x + 400);
    expect(gap).toBeGreaterThan(0);
  });

  it("falls back to a default size when a node is unmeasured", () => {
    const unmeasured: FlowGraphNode = { ...mkNode("1"), measured: undefined };
    const out = layoutGraph([unmeasured], []);
    expect(Number.isFinite(out[0].position.x)).toBe(true);
    expect(Number.isFinite(out[0].position.y)).toBe(true);
  });
});
