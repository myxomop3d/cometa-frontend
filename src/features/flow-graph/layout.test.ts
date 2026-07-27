import { describe, it, expect } from "vitest";
import { layoutGraph } from "./layout";
import type { FlowGraphNode, FlowGraphEdge } from "./types";

const mkNode = (id: string): FlowGraphNode => ({
  id, type: "flowGraphNode", position: { x: 0, y: 0 },
  data: {
    node: {
      id: Number(id), insertedAt: null, updatedAt: null,
      nodeType: "MICROSERVICE", name: id, environment: "PROD", automatedSystem: null,
    },
  },
});

describe("layoutGraph", () => {
  it("assigns non-zero positions to connected nodes (LR)", () => {
    const nodes: FlowGraphNode[] = [mkNode("1"), mkNode("2")];
    const edges: FlowGraphEdge[] = [
      {
        id: "e1",
        source: "1",
        target: "2",
        data: { link: {} as never, direction: "CODIRECTIONAL", roundTrip: false, crossGuid: "" },
      },
    ];
    const out = layoutGraph(nodes, edges);
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
});
