import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, LinkDto } from "@/types/api";
import { buildGraph } from "./build-graph";
import { analyzePairs } from "./pairs";
import { collapseGraph } from "./collapse";

const node = (id: number): NodeDto => ({
  id, insertedAt: null, updatedAt: null,
  nodeType: "MICROSERVICE", name: `n${id}`, environment: "PROD", automatedSystem: null,
});
const link = (id: number, client: number, server: number, guid: string): LinkDto => ({
  id, insertedAt: null, updatedAt: null, flowId: 1,
  clientNodeId: client, serverNodeId: server,
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null, crossGuid: guid,
});

// Two pairs through proxy 2: 1→2→3 (g1) and 4→2→3 (g2). Node 2 is a pure proxy.
function fixture() {
  const dto: FlowGraphDto = {
    flowId: 1, env: "PROD",
    nodes: [node(1), node(2), node(3), node(4)],
    links: [
      link(10, 1, 2, "g1"), link(11, 2, 3, "g1"),
      link(12, 4, 2, "g2"), link(13, 2, 3, "g2"),
    ],
  };
  const graph = buildGraph(dto);
  return { graph, idx: analyzePairs(graph) };
}

describe("collapseGraph", () => {
  it("default (empty set): hides the proxy and emits one merged edge per pair", () => {
    const { graph, idx } = fixture();
    const out = collapseGraph(graph, idx, new Set());
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["1", "3", "4"]); // node 2 hidden
    const merged = out.edges.filter((e) => e.data?.merged);
    expect(merged).toHaveLength(2);
    const g1 = out.edges.find((e) => e.id === "merged:g1")!;
    expect(g1.source).toBe("1");
    expect(g1.target).toBe("3");
    expect(g1.label).toBe("KAFKA (proxy)");
    expect(g1.data?.merged?.proxyNodeId).toBe(2);
    expect(g1.data?.crossGuid).toBe("g1"); // hover-highlight still keyed on crossGuid
    // The two real edges of g1 are gone.
    expect(out.edges.find((e) => e.id === "10")).toBeUndefined();
    expect(out.edges.find((e) => e.id === "11")).toBeUndefined();
  });

  it("expanding one guid splits that pair and reveals the proxy; sibling stays merged", () => {
    const { graph, idx } = fixture();
    const out = collapseGraph(graph, idx, new Set(["g1"]));
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["1", "2", "3", "4"]); // node 2 back
    expect(out.edges.find((e) => e.id === "10")).toBeDefined();  // g1 real edges present
    expect(out.edges.find((e) => e.id === "11")).toBeDefined();
    expect(out.edges.find((e) => e.id === "merged:g1")).toBeUndefined();
    expect(out.edges.find((e) => e.id === "merged:g2")).toBeDefined(); // g2 still merged
  });

  it("expanding all guids reproduces the original topology", () => {
    const { graph, idx } = fixture();
    const out = collapseGraph(graph, idx, new Set(["g1", "g2"]));
    expect(out.nodes.map((n) => n.id).sort()).toEqual(graph.nodes.map((n) => n.id).sort());
    expect(out.edges.map((e) => e.id).sort()).toEqual(graph.edges.map((e) => e.id).sort());
    expect(out.edges.some((e) => e.data?.merged)).toBe(false);
  });

  it("labels a mixed-protocol pair with both protocols", () => {
    const dto: FlowGraphDto = {
      flowId: 1, env: "PROD",
      nodes: [node(1), node(2), node(3)],
      links: [
        { ...link(10, 1, 2, "g"), protocol: "REST" },
        { ...link(11, 2, 3, "g"), protocol: "KAFKA" },
      ],
    };
    const graph = buildGraph(dto);
    const out = collapseGraph(graph, analyzePairs(graph), new Set());
    expect(out.edges.find((e) => e.id === "merged:g")!.label).toBe("REST/KAFKA (proxy)");
  });
});
