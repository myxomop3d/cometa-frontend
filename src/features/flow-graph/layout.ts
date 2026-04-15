import dagre from "@dagrejs/dagre";
import type { FlowGraphNode, FlowGraphEdge } from "./types";

const NODE_WIDTH = 220;
const HANDLE_ROW_HEIGHT = 22;
const NODE_MIN_HEIGHT = 80;

function estimateHeight(node: FlowGraphNode): number {
  const handles = node.data.handles.length;
  return Math.max(NODE_MIN_HEIGHT, 40 + handles * HANDLE_ROW_HEIGHT);
}

export function layoutGraph(
  nodes: FlowGraphNode[],
  edges: FlowGraphEdge[],
): FlowGraphNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: estimateHeight(n) });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const height = estimateHeight(n);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - height / 2 },
    };
  });
}
