# Flow Graph — Parallel Edge Fan-Out & Label Lift

**Date:** 2026-07-29
**Status:** Approved design
**Area:** `src/features/flow-graph/`

## Problem

When several links connect the same two nodes, they draw the *identical* path
and overlap perfectly — you can't tell there are many, and you can't visually
trace one link when its cross-guid group is highlighted.

**Root cause:** every node exposes a single target handle (Left center) and a
single source handle (Right center) — `components/custom-node.tsx`. React Flow
therefore hands each parallel edge the same `sourceX/Y` and `targetX/Y`, so
`getBezierPath` produces the same curve every time.

Secondary annoyance: the edge label sits dead-center *on* the link, blocking the
view of the line.

## Goals

- Parallel links between the same pair of nodes fan into visibly distinct
  **parallel lanes** — separated both mid-span *and* at the endpoints (distinct
  arrowheads), so a highlighted link is easy to trace within a bundle.
- A lone link (no parallel siblings) renders **byte-identical to today**.
- Move each link's label up off its lane so it no longer blocks the line.
- No changes to nodes, handles, layout, or collapse/merge logic.

## Non-Goals

- Floating edges / dynamic perimeter attachment (wrong tool for a fixed
  left→right dagre layout; breaks the "enter-left / exit-right" reading).
- Curved-arc (getSpecialPath quadratic) styling. We use offset-bezier lanes so
  tangents stay horizontal and arrowheads stay axis-aligned.
- Any change to how cross-guid highlighting or selection is computed.

## Approach (Option B — endpoint spread + offset-bezier)

### Key insight

`getBezierPath` already generates horizontal-tangent control points from
whatever endpoints it is given. To produce a parallel lane we do **not** build
control points by hand — we shift the four endpoint coordinates along the
perpendicular of the source→target vector, then call `getBezierPath` with the
shifted coords. The curve, `markerStart`/`markerEnd`, the animated flow circle,
and the returned `labelX/labelY` all land correctly on the shifted lane for free.

### Offset formula

For a group of `count` edges sharing an (unordered) node pair, edge at
`index` (0-based) gets:

```
gap        = min(GAP, MAX_SPREAD / max(count - 1, 1))
laneOffset = (index - (count - 1) / 2) * gap
```

- `count === 1` → `index 0` → `laneOffset 0` → unchanged rendering (singletons
  are handled implicitly, no special case).
- Offsets are symmetric about 0 (they sum to ~0), so a bundle fans evenly around
  the original center line.
- The `MAX_SPREAD` cap keeps a large bundle within the node's side height rather
  than fanning arbitrarily wide.

**Constants:** `GAP = 22`, `MAX_SPREAD = 60`, `LABEL_LIFT = 14` (all px).

## Components & Changes

### 1. New module `parallel.ts` (+ `parallel.test.ts`)

One-concern-per-module, matching `pairs.ts` / `collapse.ts` / `highlight.ts`.

```ts
export function assignParallelOffsets(edges: FlowGraphEdge[]): FlowGraphEdge[]
```

- Group edges by an **unordered** key of `{source, target}` (e.g. sort the two
  ids so `A→B` and `B→A` land in the same corridor). Merged proxy edges
  (`id: "merged:<guid>"`) participate naturally — they are ordinary edges in the
  collapsed set.
- Compute `laneOffset` per the formula above and return new edge objects with
  `data.laneOffset` stamped in (do not mutate inputs).
- Deterministic ordering within a group (by edge `id`) so lane assignment is
  stable across renders.

### 2. Pipeline wiring — `components/flow-graph-page.tsx`

Wrap the existing `collapsed` memo so offsets are stamped once (they depend only
on the edge set, not on hover/selection):

```ts
const collapsed = useMemo(() => {
  const c = collapseGraph(graph, pairIndex, expandedGuids);
  return { nodes: c.nodes, edges: assignParallelOffsets(c.edges) };
}, [graph, pairIndex, expandedGuids]);
```

The canvas's existing `...e.data` spread (when it injects `highlighted` /
`selected`) preserves `laneOffset` unchanged.

### 3. Edge renderer — `components/data-flow-edge.tsx`

- Read `laneOffset = data?.laneOffset ?? 0`.
- Compute the source→target vector `(dx, dy)` and its length `len`. If
  `len === 0` (degenerate / self-loop) skip the offset entirely.
- Unit perpendicular `(px, py) = (-dy/len, dx/len)`; shifted endpoints:
  `sX' = sourceX + px*laneOffset`, `sY' = sourceY + py*laneOffset`, and likewise
  for the target.
- Call `getBezierPath` with the shifted coords + the existing
  `sourcePosition`/`targetPosition`.
- **Label lift:** render the label at `labelY - LABEL_LIFT` (raise it above its
  lane). `labelX` unchanged.

Everything else in the component (stroke width, merged dash, highlight color,
animated circle) is unchanged and automatically follows the new `edgePath`.

### 4. Types — `types.ts`

Add to `FlowGraphEdgeData`:

```ts
laneOffset?: number;
```

## Data Flow

```
buildGraph → analyzePairs → collapseGraph
                                  │  edges
                                  ▼
                        assignParallelOffsets   (new — stamps data.laneOffset)
                                  │
                                  ▼
                          FlowGraphCanvas
                                  │  (spreads ...e.data, adds highlighted/selected)
                                  ▼
                           DataFlowEdge
                       (shifts endpoints by perp*laneOffset → getBezierPath;
                        lifts label by LABEL_LIFT)
```

## Testing

`parallel.test.ts` (pure function, no React):

- Singleton pair → `laneOffset === 0`.
- `A→B` and `B→A` are grouped together (unordered key).
- A group of `n` produces symmetric offsets that sum to ~0 and are evenly spaced.
- Group of 2 → offsets `[-gap/2, +gap/2]`.
- Large bundle (e.g. count 6) triggers the `MAX_SPREAD` cap (effective gap < GAP).
- Assignment is deterministic across calls (stable ordering by id).

Also run `tsc -b`, `npm run lint`, existing `build-graph` / `collapse` /
`pairs` / `highlight` tests (must stay green), and verify in-browser at
http://localhost:5173/ against a flow that has a multi-link bundle.

## Files Touched

| File | Change |
|---|---|
| `src/features/flow-graph/parallel.ts` | **new** — `assignParallelOffsets` |
| `src/features/flow-graph/parallel.test.ts` | **new** — unit tests |
| `src/features/flow-graph/types.ts` | add `laneOffset?` to `FlowGraphEdgeData` |
| `src/features/flow-graph/components/flow-graph-page.tsx` | wrap `collapsed` memo |
| `src/features/flow-graph/components/data-flow-edge.tsx` | perpendicular endpoint shift + label lift |
