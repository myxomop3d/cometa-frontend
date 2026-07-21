import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, LinkDto, DataFlowDirection } from "@/types/api";
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
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null,
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

  it("exposes lookup maps for details panel", () => {
    const g = buildGraph(dto);
    expect(g.nodeById.get(1)).toBe(nodeA);
    expect(g.linkById.get(100)).toBe(link);
  });
});

describe("buildGraph edge orientation", () => {
  const withDir = (dir: DataFlowDirection | null): FlowGraphDto => ({
    flowId: 1,
    env: "PROD",
    nodes: [nodeA, nodeB],
    links: [{ ...link, dataFlowDirection: dir }],
  });

  it("CODIRECTIONAL: client=source, server=target, arrow on markerEnd", () => {
    const e = buildGraph(withDir("CODIRECTIONAL")).edges[0];
    expect(e.source).toBe("1");
    expect(e.target).toBe("2");
    expect(e.markerEnd).toBeDefined();
    expect(e.markerEnd).toMatchObject({ width: 22, height: 22 });
    expect(e.markerStart).toBeUndefined();
    expect(e.label).toBe("KAFKA");
    expect(e.data?.direction).toBe("CODIRECTIONAL");
    expect(e.data?.roundTrip).toBe(false);
  });

  it("COUNTERDIRECTIONAL: server=source, client=target, arrow on markerStart", () => {
    const e = buildGraph(withDir("COUNTERDIRECTIONAL")).edges[0];
    expect(e.source).toBe("2");
    expect(e.target).toBe("1");
    expect(e.markerStart).toBeDefined();
    expect(e.markerStart).toMatchObject({ width: 22, height: 22 });
    expect(e.markerEnd).toBeUndefined();
    expect(e.data?.direction).toBe("COUNTERDIRECTIONAL");
    expect(e.data?.roundTrip).toBe(false);
  });

  it("BIDIRECTIONAL: client=source, server=target, roundTrip, arrow on markerEnd", () => {
    const e = buildGraph(withDir("BIDIRECTIONAL")).edges[0];
    expect(e.source).toBe("1");
    expect(e.target).toBe("2");
    expect(e.markerEnd).toBeDefined();
    expect(e.markerStart).toBeUndefined();
    expect(e.data?.direction).toBe("BIDIRECTIONAL");
    expect(e.data?.roundTrip).toBe(true);
  });

  it("null / unknown direction falls back to codirectional", () => {
    const e = buildGraph(withDir(null)).edges[0];
    expect(e.source).toBe("1");
    expect(e.target).toBe("2");
    expect(e.markerEnd).toBeDefined();
    expect(e.data?.direction).toBe("CODIRECTIONAL");
  });

  it("stamps the custom dataFlow edge type", () => {
    const e = buildGraph(withDir("CODIRECTIONAL")).edges[0];
    expect(e.type).toBe("dataFlow");
  });
});
