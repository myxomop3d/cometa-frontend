import type { FlowGraphDto, NodeDto, InterfaceFlatDto, LinkDto } from "@/types/api";
import type { BuiltGraph, FlowGraphNode, FlowGraphEdge, HandleDescriptor, HandleSide } from "./types";

function classifyInterfaces(links: LinkDto[]): Map<number, HandleSide> {
  const sides = new Map<number, HandleSide>();
  for (const link of links) {
    sides.set(link.clientInterface.id, "right");
    sides.set(link.serverInterface.id, "left");
  }
  return sides;
}

function nodeHandles(node: NodeDto, sides: Map<number, HandleSide>): HandleDescriptor[] {
  const list = node.interfaces ?? [];
  return list.map((iface) => ({
    interfaceId: iface.id,
    dtoType: iface.dtoType,
    side: sides.get(iface.id) ?? "right",
    label: iface.name,
  }));
}

export function buildGraph(dto: FlowGraphDto): BuiltGraph {
  const sides = classifyInterfaces(dto.links);

  const rfNodes: FlowGraphNode[] = dto.nodes.map((n) => ({
    id: String(n.id),
    type: "flowGraphNode",
    position: { x: 0, y: 0 },
    data: { node: n, handles: nodeHandles(n, sides) },
  }));

  const rfEdges: FlowGraphEdge[] = dto.links.map((l) => ({
    id: String(l.id),
    source: String(findNodeIdForInterface(dto.nodes, l.clientInterface.id)),
    target: String(findNodeIdForInterface(dto.nodes, l.serverInterface.id)),
    sourceHandle: String(l.clientInterface.id),
    targetHandle: String(l.serverInterface.id),
    data: { link: l },
  }));

  const nodeById = new Map<number, NodeDto>(dto.nodes.map((n) => [n.id, n]));
  const interfaceById = new Map<number, InterfaceFlatDto>();
  for (const n of dto.nodes) for (const i of n.interfaces ?? []) interfaceById.set(i.id, i);
  const linkById = new Map<number, LinkDto>(dto.links.map((l) => [l.id, l]));

  return { nodes: rfNodes, edges: rfEdges, nodeById, interfaceById, linkById };
}

function findNodeIdForInterface(nodes: NodeDto[], interfaceId: number): number {
  for (const n of nodes) {
    if ((n.interfaces ?? []).some((i) => i.id === interfaceId)) return n.id;
  }
  return -1;
}
