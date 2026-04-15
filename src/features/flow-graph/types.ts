import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { NodeDto, InterfaceFlatDto, LinkDto } from "@/types/api";

export type Selection =
  | { kind: "node"; id: number }
  | { kind: "interface"; id: number }
  | { kind: "link"; id: number }
  | null;

export type HandleSide = "left" | "right";

export interface HandleDescriptor {
  interfaceId: number;
  dtoType: string;
  side: HandleSide;
  label: string;
}

export interface FlowGraphNodeData extends Record<string, unknown> {
  node: NodeDto;
  handles: HandleDescriptor[];
}

export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
}

export type FlowGraphNode = RFNode<FlowGraphNodeData>;
export type FlowGraphEdge = RFEdge<FlowGraphEdgeData>;

export interface BuiltGraph {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  /** lookup helpers for the details panel */
  nodeById: Map<number, NodeDto>;
  interfaceById: Map<number, InterfaceFlatDto>;
  linkById: Map<number, LinkDto>;
}
