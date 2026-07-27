import { MarkerType } from "@xyflow/react";
import type {
  FlowGraphDto,
  NodeDto,
  LinkDto,
  DataFlowDirection,
} from "@/types/api";
import type { BuiltGraph, FlowGraphNode, FlowGraphEdge } from "./types";

const ARROW_SIZE = 22;

/** null / unknown falls back to CODIRECTIONAL (client → server). */
export function normalizeDirection(
  raw: DataFlowDirection | null,
): DataFlowDirection {
  switch (raw) {
    case "COUNTERDIRECTIONAL":
    case "BIDIRECTIONAL":
    case "CODIRECTIONAL":
      return raw;
    default:
      return "CODIRECTIONAL";
  }
}

export function buildGraph(dto: FlowGraphDto): BuiltGraph {
  const rfNodes: FlowGraphNode[] = dto.nodes.map((n) => ({
    id: String(n.id),
    type: "flowGraphNode",
    position: { x: 0, y: 0 },
    data: { node: n },
  }));

  const rfEdges: FlowGraphEdge[] = dto.links.map((l) => {
    const direction = normalizeDirection(l.dataFlowDirection);
    // Data flows source(left) → target(right). Server is the target for
    // CO/BIDIRECTIONAL; for COUNTERDIRECTIONAL the server is the data source.
    const serverIsTarget = direction !== "COUNTERDIRECTIONAL";
    const source = serverIsTarget ? l.clientNodeId : l.serverNodeId;
    const target = serverIsTarget ? l.serverNodeId : l.clientNodeId;

    // Arrow (client→server relationship) sits on the server end. React Flow
    // orients start-markers with auto-start-reverse, so it points at the
    // server whether that end is the source or the target.
    const marker = {
      type: MarkerType.ArrowClosed,
      width: ARROW_SIZE,
      height: ARROW_SIZE,
    };

    return {
      id: String(l.id),
      type: "dataFlow",
      source: String(source),
      target: String(target),
      label: l.protocol,
      ...(serverIsTarget ? { markerEnd: marker } : { markerStart: marker }),
      data: {
        link: l,
        direction,
        roundTrip: direction === "BIDIRECTIONAL",
        crossGuid: l.crossGuid,
      },
    };
  });

  const nodeById = new Map<number, NodeDto>(dto.nodes.map((n) => [n.id, n]));
  const linkById = new Map<number, LinkDto>(dto.links.map((l) => [l.id, l]));

  return { nodes: rfNodes, edges: rfEdges, nodeById, linkById };
}
