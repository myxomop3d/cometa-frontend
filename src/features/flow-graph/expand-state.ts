import type { PairIndex } from "./pairs";

export function collapseAll(): Set<string> {
  return new Set();
}

export function expandAll(pairIndex: PairIndex): Set<string> {
  return new Set(pairIndex.pairs.keys());
}

export function showNode(current: Set<string>, crossGuid: string): Set<string> {
  const next = new Set(current);
  next.add(crossGuid);
  return next;
}

export function hideNode(
  current: Set<string>,
  pairIndex: PairIndex,
  nodeId: number,
): Set<string> {
  const next = new Set(current);
  for (const guid of pairIndex.nodePairs.get(nodeId) ?? []) next.delete(guid);
  return next;
}
