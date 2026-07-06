import { MarkerType } from "@xyflow/react";
import type { FlowGraphDto, NodeDto, LinkDto } from "@/types/api";
import type { BuiltGraph, FlowGraphNode, FlowGraphEdge } from "./types";

export function buildGraph(dto: FlowGraphDto): BuiltGraph {
  const rfNodes: FlowGraphNode[] = dto.nodes.map((n) => ({
    id: String(n.id),
    type: "flowGraphNode",
    position: { x: 0, y: 0 },
    data: { node: n },
  }));

  const rfEdges: FlowGraphEdge[] = dto.links.map((l) => ({
    id: String(l.id),
    source: String(l.clientNodeId),
    target: String(l.serverNodeId),
    label: l.protocol,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { link: l },
  }));

  const nodeById = new Map<number, NodeDto>(dto.nodes.map((n) => [n.id, n]));
  const linkById = new Map<number, LinkDto>(dto.links.map((l) => [l.id, l]));

  return { nodes: rfNodes, edges: rfEdges, nodeById, linkById };
}
