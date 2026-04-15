import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, InterfaceFlatDto, LinkDto, FlowDto } from "@/types/api";
import { buildGraph } from "./build-graph";

const flow: FlowDto = {
  id: 1, code: "f", caption: "F",
  integrity: null, confidentiality: null,
  dataClass: "", dataType: "", state: "", descriptionMd: null,
};

const iClient: InterfaceFlatDto = {
  id: 10, dtoType: "restClient", name: "c", protocol: "http",
  segment: "s", localWhiteListHeaders: null, descriptionMd: null,
  nodeId: 1, linksInIds: null, linksOutIds: [100],
};
const iServer: InterfaceFlatDto = {
  id: 20, dtoType: "restServer", name: "s", protocol: "http",
  segment: "s", localWhiteListHeaders: null, descriptionMd: null,
  nodeId: 2, linksInIds: [100], linksOutIds: null,
};
const nodeA: NodeDto = { id: 1, dtoType: "microservice", name: "A", descriptionMd: null, interfaces: [iClient] };
const nodeB: NodeDto = { id: 2, dtoType: "microservice", name: "B", descriptionMd: null, interfaces: [iServer] };
const link: LinkDto = { id: 100, flowId: 1, clientInterface: iClient, serverInterface: iServer, dataFlowDirection: "ltr" };

const dto: FlowGraphDto = { flow, nodes: [nodeA, nodeB], links: [link] };

describe("buildGraph", () => {
  it("creates one RF node per NodeDto with string id", () => {
    const g = buildGraph(dto);
    expect(g.nodes).toHaveLength(2);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
    expect(g.nodes[0].type).toBe("flowGraphNode");
  });

  it("assigns client interfaces to the right side, server to the left", () => {
    const g = buildGraph(dto);
    const a = g.nodes.find((n) => n.id === "1")!;
    const b = g.nodes.find((n) => n.id === "2")!;
    expect(a.data.handles).toEqual([
      { interfaceId: 10, dtoType: "restClient", side: "right", label: "c" },
    ]);
    expect(b.data.handles).toEqual([
      { interfaceId: 20, dtoType: "restServer", side: "left", label: "s" },
    ]);
  });

  it("creates one RF edge per LinkDto wired to handle ids", () => {
    const g = buildGraph(dto);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({
      id: "100",
      source: "1",
      target: "2",
      sourceHandle: "10",
      targetHandle: "20",
    });
  });

  it("exposes lookup maps for details panel", () => {
    const g = buildGraph(dto);
    expect(g.nodeById.get(1)).toBe(nodeA);
    expect(g.interfaceById.get(10)).toBe(iClient);
    expect(g.linkById.get(100)).toBe(link);
  });

  it("defaults orphan interfaces to the right side", () => {
    const orphan: InterfaceFlatDto = { ...iClient, id: 30, linksOutIds: null };
    const dtoWithOrphan: FlowGraphDto = {
      flow,
      nodes: [{ ...nodeA, interfaces: [iClient, orphan] }, nodeB],
      links: [link],
    };
    const g = buildGraph(dtoWithOrphan);
    const handles = g.nodes.find((n) => n.id === "1")!.data.handles;
    expect(handles.find((h) => h.interfaceId === 30)?.side).toBe("right");
  });
});
