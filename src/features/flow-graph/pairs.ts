import type { LinkDto } from "@/types/api";
import type { BuiltGraph, FlowGraphEdge } from "./types";

export interface Pair {
  crossGuid: string;
  proxyNodeId: number;
  outerSourceId: number;
  outerTargetId: number;
  linkIn: LinkDto;
  linkOut: LinkDto;
}

export interface PairIndex {
  pairs: Map<string, Pair>;
  hideableNodes: Set<number>;
  nodePairs: Map<number, string[]>;
}

/** Build a Pair from two edges if they form a valid chain, else null. */
function toPair(guid: string, e1: FlowGraphEdge, e2: FlowGraphEdge): Pair | null {
  const l1 = e1.data?.link;
  const l2 = e2.data?.link;
  if (!l1 || !l2) return null;

  // Chain e1 → e2: e1.target (proxy) === e2.source, distinct outer endpoints.
  if (e1.target === e2.source && e1.source !== e2.target) {
    return {
      crossGuid: guid,
      proxyNodeId: Number(e1.target),
      outerSourceId: Number(e1.source),
      outerTargetId: Number(e2.target),
      linkIn: l1,
      linkOut: l2,
    };
  }
  // Chain e2 → e1.
  if (e2.target === e1.source && e2.source !== e1.target) {
    return {
      crossGuid: guid,
      proxyNodeId: Number(e2.target),
      outerSourceId: Number(e2.source),
      outerTargetId: Number(e1.target),
      linkIn: l2,
      linkOut: l1,
    };
  }
  return null;
}

export function analyzePairs(graph: BuiltGraph): PairIndex {
  const byGuid = new Map<string, FlowGraphEdge[]>();
  for (const e of graph.edges) {
    const guid = e.data?.crossGuid;
    if (!guid) continue;
    const arr = byGuid.get(guid);
    if (arr) arr.push(e);
    else byGuid.set(guid, [e]);
  }

  const pairs = new Map<string, Pair>();
  for (const [guid, edges] of byGuid) {
    if (edges.length !== 2) continue;
    const pair = toPair(guid, edges[0], edges[1]);
    if (pair) pairs.set(guid, pair);
  }

  const nodePairs = new Map<number, string[]>();
  for (const pair of pairs.values()) {
    const list = nodePairs.get(pair.proxyNodeId);
    if (list) list.push(pair.crossGuid);
    else nodePairs.set(pair.proxyNodeId, [pair.crossGuid]);
  }

  // Count edges incident to each node (each pair contributes exactly 2 to its proxy).
  const incident = new Map<number, number>();
  for (const e of graph.edges) {
    incident.set(Number(e.source), (incident.get(Number(e.source)) ?? 0) + 1);
    incident.set(Number(e.target), (incident.get(Number(e.target)) ?? 0) + 1);
  }

  const hideableNodes = new Set<number>();
  for (const [nodeId, guids] of nodePairs) {
    if ((incident.get(nodeId) ?? 0) === guids.length * 2) hideableNodes.add(nodeId);
  }

  return { pairs, hideableNodes, nodePairs };
}
