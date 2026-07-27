import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, LinkDto } from "@/types/api";
import { buildGraph } from "./build-graph";
import { analyzePairs } from "./pairs";

const node = (id: number): NodeDto => ({
  id, insertedAt: null, updatedAt: null,
  nodeType: "MICROSERVICE", name: `n${id}`, environment: "PROD", automatedSystem: null,
});
const link = (id: number, client: number, server: number, guid: string): LinkDto => ({
  id, insertedAt: null, updatedAt: null, flowId: 1,
  clientNodeId: client, serverNodeId: server,
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null, crossGuid: guid,
});
const dto = (nodes: NodeDto[], links: LinkDto[]): FlowGraphDto => ({
  flowId: 1, env: "PROD", nodes, links,
});

describe("analyzePairs", () => {
  it("detects a valid chain 1→2→3 as one pair with proxy 2", () => {
    // CODIRECTIONAL: source=client, target=server. l1: 1→2, l2: 2→3.
    const g = buildGraph(dto([node(1), node(2), node(3)], [
      link(10, 1, 2, "g"), link(11, 2, 3, "g"),
    ]));
    const idx = analyzePairs(g);
    const pair = idx.pairs.get("g")!;
    expect(idx.pairs.size).toBe(1);
    expect(pair.proxyNodeId).toBe(2);
    expect(pair.outerSourceId).toBe(1);
    expect(pair.outerTargetId).toBe(3);
    expect(pair.linkIn.id).toBe(10);
    expect(pair.linkOut.id).toBe(11);
    expect(idx.hideableNodes.has(2)).toBe(true);
    expect(idx.nodePairs.get(2)).toEqual(["g"]);
  });

  it("does not pair a singleton crossGuid", () => {
    const g = buildGraph(dto([node(1), node(2)], [link(10, 1, 2, "solo")]));
    const idx = analyzePairs(g);
    expect(idx.pairs.size).toBe(0);
    expect(idx.hideableNodes.size).toBe(0);
  });

  it("rejects a 'two-incoming' group (both edges target the shared node)", () => {
    // l1: 1→2, l2: 3→2 — node 2 is target of both, no continuation.
    const g = buildGraph(dto([node(1), node(2), node(3)], [
      link(10, 1, 2, "g"), link(11, 3, 2, "g"),
    ]));
    expect(analyzePairs(g).pairs.size).toBe(0);
  });

  it("rejects a 3-link group", () => {
    const g = buildGraph(dto([node(1), node(2), node(3), node(4)], [
      link(10, 1, 2, "g"), link(11, 2, 3, "g"), link(12, 3, 4, "g"),
    ]));
    expect(analyzePairs(g).pairs.size).toBe(0);
  });

  it("rejects a self-loop pair (outer endpoints equal)", () => {
    // l1: 1→2, l2: 2→1 — chain would be 1→1.
    const g = buildGraph(dto([node(1), node(2)], [
      link(10, 1, 2, "g"), link(11, 2, 1, "g"),
    ]));
    expect(analyzePairs(g).pairs.size).toBe(0);
  });

  it("excludes a proxy node that also has a non-pair link", () => {
    // Pair 1→2→3 (proxy 2), plus an extra singleton link 2→4 touching node 2.
    const g = buildGraph(dto([node(1), node(2), node(3), node(4)], [
      link(10, 1, 2, "g"), link(11, 2, 3, "g"), link(12, 2, 4, "solo"),
    ]));
    const idx = analyzePairs(g);
    expect(idx.pairs.size).toBe(1);
    expect(idx.hideableNodes.has(2)).toBe(false);
  });
});
