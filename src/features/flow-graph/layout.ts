import dagre from "@dagrejs/dagre";
import type { FlowGraphNode, FlowGraphEdge } from "./types";

// Fallbacks for nodes React Flow has not measured yet (e.g. in unit tests, or
// the very first frame before measurement). Real layout uses each node's
// measured DOM size, so long names never overlap regardless of font.
const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 80;

function nodeSize(n: FlowGraphNode): { width: number; height: number } {
  return {
    width: n.measured?.width ?? n.width ?? DEFAULT_NODE_WIDTH,
    height: n.measured?.height ?? n.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/**
 * Position nodes left-to-right with dagre, using each node's real rendered size
 * so wider (long-named) nodes get the horizontal room they actually occupy.
 * Callers should pass nodes React Flow has already measured (see
 * FlowGraphCanvas), so `measured.width`/`measured.height` are populated.
 */
export function layoutGraph(
  nodes: FlowGraphNode[],
  edges: FlowGraphEdge[],
): FlowGraphNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  const sizeById = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const size = nodeSize(n);
    sizeById.set(n.id, size);
    g.setNode(n.id, size);
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const { width, height } = sizeById.get(n.id) ?? {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    };
    // dagre positions are node centres; React Flow wants the top-left corner.
    return { ...n, position: { x: pos.x - width / 2, y: pos.y - height / 2 } };
  });
}
