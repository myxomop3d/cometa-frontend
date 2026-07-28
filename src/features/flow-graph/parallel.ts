import type { FlowGraphEdge } from "./types";

export const GAP = 22;
export const MAX_SPREAD = 60;

/** Unordered pair key so A->B and B->A share a corridor. */
function corridorKey(edge: FlowGraphEdge): string {
  return edge.source < edge.target
    ? `${edge.source}|${edge.target}`
    : `${edge.target}|${edge.source}`;
}

/**
 * Stamp each edge with data.laneOffset so parallel links between the same pair
 * of nodes fan into distinct lanes. A lone link gets 0 (renders unchanged).
 * Offsets are symmetric about 0 and evenly spaced, capped at MAX_SPREAD total.
 * Returns new edge objects; inputs are not mutated.
 *
 * The renderer applies laneOffset as a vertical shift of both endpoints. The
 * nodes' fixed Left-target / Right-source handles sit on vertical borders, so a
 * vertical shift keeps each connection point on the border for any node
 * alignment, and the offset is direction-independent so same- and
 * reverse-direction siblings in a corridor mirror correctly.
 */
export function assignParallelOffsets(edges: FlowGraphEdge[]): FlowGraphEdge[] {
  const groups = new Map<string, FlowGraphEdge[]>();
  for (const e of edges) {
    const key = corridorKey(e);
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }

  const offsetById = new Map<string, number>();
  for (const group of groups.values()) {
    const count = group.length;
    const gap = Math.min(GAP, MAX_SPREAD / Math.max(count - 1, 1));
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((e, index) => {
      offsetById.set(e.id, (index - (count - 1) / 2) * gap);
    });
  }

  return edges.map((e) => ({
    ...e,
    data: e.data && { ...e.data, laneOffset: offsetById.get(e.id) ?? 0 },
  }));
}
