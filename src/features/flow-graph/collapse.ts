import { MarkerType } from "@xyflow/react";
import { normalizeDirection } from "./build-graph";
import type { BuiltGraph, FlowGraphNode, FlowGraphEdge } from "./types";
import type { Pair, PairIndex } from "./pairs";

const ARROW_SIZE = 22;

function mergedEdge(pair: Pair): FlowGraphEdge {
  const proto =
    pair.linkIn.protocol === pair.linkOut.protocol
      ? pair.linkIn.protocol
      : `${pair.linkIn.protocol}/${pair.linkOut.protocol}`;
  return {
    id: `merged:${pair.crossGuid}`,
    type: "dataFlow",
    source: String(pair.outerSourceId),
    target: String(pair.outerTargetId),
    label: `${proto} (proxy)`,
    markerEnd: { type: MarkerType.ArrowClosed, width: ARROW_SIZE, height: ARROW_SIZE },
    data: {
      link: pair.linkOut,
      direction: normalizeDirection(pair.linkOut.dataFlowDirection),
      roundTrip: false,
      crossGuid: pair.crossGuid,
      merged: {
        crossGuid: pair.crossGuid,
        proxyNodeId: pair.proxyNodeId,
        linkIn: pair.linkIn,
        linkOut: pair.linkOut,
      },
    },
  };
}

export function collapseGraph(
  graph: BuiltGraph,
  pairIndex: PairIndex,
  expandedGuids: Set<string>,
): { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] } {
  const mergedGuids = new Set<string>();
  for (const guid of pairIndex.pairs.keys()) {
    if (!expandedGuids.has(guid)) mergedGuids.add(guid);
  }

  // A pure-proxy node is hidden only when all of its pairs are merged.
  const hiddenNodes = new Set<number>();
  for (const nodeId of pairIndex.hideableNodes) {
    const guids = pairIndex.nodePairs.get(nodeId) ?? [];
    if (guids.every((g) => mergedGuids.has(g))) hiddenNodes.add(nodeId);
  }

  const nodes = graph.nodes.filter((n) => !hiddenNodes.has(Number(n.id)));

  const edges: FlowGraphEdge[] = [];
  for (const e of graph.edges) {
    const guid = e.data?.crossGuid;
    if (guid && mergedGuids.has(guid)) continue; // replaced by a synthetic merged edge
    edges.push(e);
  }
  for (const guid of mergedGuids) {
    edges.push(mergedEdge(pairIndex.pairs.get(guid)!));
  }

  return { nodes, edges };
}
