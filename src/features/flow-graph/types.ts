import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { NodeDto, LinkDto, DataFlowDirection } from "@/types/api";

export type Selection =
  | { kind: "node"; id: number }
  | { kind: "link"; id: number }
  | null;

export interface FlowGraphNodeData extends Record<string, unknown> {
  node: NodeDto;
}

export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
  direction: DataFlowDirection;
  roundTrip: boolean;
  crossGuid: string;
  highlighted?: boolean;
  merged?: {
    crossGuid: string;
    proxyNodeId: number;
    linkIn: LinkDto;
    linkOut: LinkDto;
  };
}

export type FlowGraphNode = RFNode<FlowGraphNodeData>;
export type FlowGraphEdge = RFEdge<FlowGraphEdgeData>;

export interface BuiltGraph {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  /** lookup helpers for the details panel */
  nodeById: Map<number, NodeDto>;
  linkById: Map<number, LinkDto>;
}
