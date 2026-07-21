# Flow Graph — Data-Flow Layout, Animated Edges & Bigger Arrows

**Date:** 2026-07-21
**Status:** Approved design
**Area:** `src/features/flow-graph/`

## Problem

The flow graph currently reads **client → server**, left to right, always. Every node has a fixed
target handle on the left and source handle on the right (`custom-node.tsx`), and `build-graph.ts`
always sets the React Flow edge as `source = clientNodeId → target = serverNodeId`. dagre
(`rankdir: "LR"`) then places client left, server right — regardless of which way data actually
moves.

We want the graph to read **by data flow**: data sources on the left, data consumers on the right,
so a user scans left→right and sees where data originates and where it ends up. The client/server
relationship is still meaningful, but it becomes a secondary annotation (the arrowhead) rather than
the thing that drives layout.

Three changes:

1. **Orient each edge by data-flow direction**, not by client/server role.
2. **Animate data flow** with a running circle along each edge (like the
   [reactflow animating-edges example](https://reactflow.dev/examples/edges/animating-edges)).
3. **Enlarge the arrowhead** at the link's server end.

## Data model

`LinkDto.dataFlowDirection` becomes a canonical three-value enum (the backend will send these
values; we migrate the type and mock data to match):

- `CODIRECTIONAL` — data flows **client → server**
- `COUNTERDIRECTIONAL` — data flows **server → client**
- `BIDIRECTIONAL` — data flows **client → server, then back server → client**

`dataFlowDirection` describes the direction of data flow *in relation to* the client/server roles.
It is independent of the client/server relationship itself, which is still carried by
`clientNodeId` / `serverNodeId`.

## Core principle

> **Layout and the running circle follow the data flow. The arrowhead follows the client/server
> role.**

- **Data source** node is placed on the **left**, **data consumer** on the **right**.
- The **running circle** animates from data source → data consumer (the data-flow direction).
- The **arrowhead** always points *at the server node*, whichever side it lands on.

These two only visually diverge for `COUNTERDIRECTIONAL` links, which is intentional: there the
server is the data source (left), so the arrow points right→left (at the server) while the circle
runs left→right (server→client).

## Design

### 1. Orientation — `build-graph.ts`

For each link, normalize `dataFlowDirection` and assign the React Flow `source` / `target` by data
flow. dagre's `rankdir: "LR"` then places the RF source on the left and RF target on the right, so
data source ends up left and consumer right automatically. **No change to node handles** — keeping
target-left / source-right, combined with orienting the RF edge by data flow, is exactly what makes
the handles read as data-flow endpoints (requirement 1).

| Direction | RF `source` (→ left) | RF `target` (→ right) | Server end | Arrow marker |
|---|---|---|---|---|
| `CODIRECTIONAL` | client | server | target (right) | `markerEnd` |
| `COUNTERDIRECTIONAL` | server | client | source (left) | `markerStart` |
| `BIDIRECTIONAL` | client | server | target (right) | `markerEnd` |
| `null` / unknown | client | server | target (right) | `markerEnd` |

- **Fallback:** an unrecognized or `null` direction is treated as `CODIRECTIONAL` (preserves the
  current client→server behavior).
- **Bidirectional tiebreak:** client on the left (data "starts" at the client, per the definition).
- Each edge carries `data: { link, direction, roundTrip }` where `roundTrip = direction === "BIDIRECTIONAL"`.
- The arrow marker (`ArrowClosed`) is placed on the **server end** — `markerEnd` when the server is
  the RF target, `markerStart` when the server is the RF source. Marker sizing per §3.

A small helper `normalizeDirection(raw: string | null): DataFlowDirection` centralizes the mapping
and the fallback.

### 2. Custom animated edge — new `components/data-flow-edge.tsx`

Registered as `edgeTypes = { dataFlow: DataFlowEdge }`; `build-graph.ts` sets `type: "dataFlow"`
on every edge.

The component:

- Computes the path with `getBezierPath()` from the source/target coordinates React Flow passes in.
- Renders `<BaseEdge>` with the arrow marker on the server end (`markerStart` / `markerEnd` supplied
  by build-graph). The marker uses `orient="auto-start-reverse"` semantics so a `markerStart` arrow
  still points *at* the server (into the path start) rather than away from it.
- Renders an animated `<circle>` that runs **source → target** along the path — this is the data-flow
  direction, because build-graph made the RF source the data source:

  ```tsx
  <circle r={4} fill="var(--flow-anim, currentColor)">
    <animateMotion
      dur="2s"
      repeatCount="indefinite"
      path={edgePath}
      {...(roundTrip
        ? { keyPoints: "0;1;0", keyTimes: "0;0.5;1", calcMode: "linear" }
        : {})}
    />
  </circle>
  ```

  - **Directional** links: one circle, source → target, looping.
  - **Bidirectional** links: one circle doing a round trip (`0 → 1 → 0`), reading as
    "request out, response back."
- Preserves the **protocol label** at the edge midpoint via `EdgeLabelRenderer` (currently rendered
  by the default edge through `edge.label`; the custom edge must render it explicitly so we don't
  regress).
- Respects selection styling (thicker / highlighted stroke when `selected`), matching the existing
  behavior where selection is passed down from the canvas.

### 3. Bigger arrowhead — §1 marker config

Define a constant (e.g. `ARROW_SIZE = 22`) and apply it as `width` / `height` on the `ArrowClosed`
marker (default is ~12.5). Applied to whichever of `markerStart` / `markerEnd` is used.

### 4. Data / type migration

- `src/types/api.ts`:
  ```ts
  export type DataFlowDirection = "CODIRECTIONAL" | "COUNTERDIRECTIONAL" | "BIDIRECTIONAL";
  // LinkDto:
  dataFlowDirection: DataFlowDirection | null;
  ```
- `src/mocks/data/links.ts`: rewrite the 7 links from `REQUEST` / `PRODUCE` / `CONSUME` to a
  canonical mix that exercises all three directions (at least one `CODIRECTIONAL`, one
  `COUNTERDIRECTIONAL`, one `BIDIRECTIONAL`) so the visualization is fully demonstrated with
  `VITE_MOCK_API=true`.
- `example/*.json` are reference documents, not imported by the app — **out of scope**.
- `details-panel.tsx` already displays `dataFlowDirection` as a plain string; it will now show the
  canonical value. No structural change required.

## Files touched

| File | Change |
|---|---|
| `src/types/api.ts` | Add `DataFlowDirection` union; narrow `LinkDto.dataFlowDirection`. |
| `src/features/flow-graph/build-graph.ts` | Orient edges by data flow; set edge `type`, `data`, server-end arrow marker; add `normalizeDirection`. |
| `src/features/flow-graph/components/data-flow-edge.tsx` | **New.** Custom animated edge (circle + server-end arrow + label). |
| `src/features/flow-graph/components/flow-graph-canvas.tsx` | Register `edgeTypes`. |
| `src/mocks/data/links.ts` | Migrate to canonical direction values. |
| `src/features/flow-graph/build-graph.test.ts` | Update / add cases for orientation + marker placement per direction. |

**Unchanged on purpose:** `custom-node.tsx` (handles stay target-left / source-right),
`layout.ts` (dagre still `rankdir: LR`; orientation is decided upstream in build-graph),
`details-panel.tsx`.

## Testing

- **`build-graph.test.ts`** (unit, no DOM):
  - `CODIRECTIONAL` → `source == clientNodeId`, `target == serverNodeId`, arrow on `markerEnd`.
  - `COUNTERDIRECTIONAL` → `source == serverNodeId`, `target == clientNodeId`, arrow on `markerStart`.
  - `BIDIRECTIONAL` → `source == clientNodeId`, `target == serverNodeId`, `roundTrip == true`, arrow on `markerEnd`.
  - `null` / unknown → falls back to codirectional orientation.
  - Every edge has `type === "dataFlow"` and a resolvable `direction` in `data`.
- **Type check / build:** `npm run build` (runs `tsc -b`) passes with the narrowed union and the
  migrated mock data.
- **Manual (mock API):** `VITE_MOCK_API=true npm run dev -- --host`, open a flow with all three
  directions, confirm: layout reads source→consumer left-to-right; circles animate in the correct
  direction; bidirectional circle round-trips; arrowheads point at the server on every link and are
  visibly larger.

## Non-goals

- Per-protocol edge coloring.
- Changing node handle positions or adding multiple handles per node.
- Migrating the `example/*.json` reference files.
- Any backend change (this spec assumes the backend emits the canonical three values).
