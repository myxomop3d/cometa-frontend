import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, LinkDto } from "@/types/api";
import { buildGraph } from "./build-graph";

const nodeA: NodeDto = {
  id: 1, insertedAt: null, updatedAt: null,
  nodeType: "MICROSERVICE", name: "A", environment: "PROD", automatedSystem: null,
};
const nodeB: NodeDto = {
  id: 2, insertedAt: null, updatedAt: null,
  nodeType: "TOPIC", name: "B", environment: "PROD", automatedSystem: null,
};
const link: LinkDto = {
  id: 100, insertedAt: null, updatedAt: null,
  flowId: 1, clientNodeId: 1, serverNodeId: 2,
  protocol: "KAFKA", dataFlowDirection: "ltr", principalId: null,
};

const dto: FlowGraphDto = { flowId: 1, env: "PROD", nodes: [nodeA, nodeB], links: [link] };

describe("buildGraph", () => {
  it("creates one RF node per NodeDto with string id", () => {
    const g = buildGraph(dto);
    expect(g.nodes).toHaveLength(2);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
    expect(g.nodes[0].type).toBe("flowGraphNode");
    expect(g.nodes[0].data.node).toBe(nodeA);
  });

  it("creates one RF edge per LinkDto wired client→server with protocol label", () => {
    const g = buildGraph(dto);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({
      id: "100",
      source: "1",
      target: "2",
      label: "KAFKA",
    });
    expect(g.edges[0].data?.link).toBe(link);
  });

  it("exposes lookup maps for details panel", () => {
    const g = buildGraph(dto);
    expect(g.nodeById.get(1)).toBe(nodeA);
    expect(g.linkById.get(100)).toBe(link);
  });
});
