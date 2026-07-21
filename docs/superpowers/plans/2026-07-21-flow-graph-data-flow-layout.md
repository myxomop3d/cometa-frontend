# Flow Graph — Data-Flow Layout, Animated Edges & Bigger Arrows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orient flow-graph edges by data-flow direction (source left → consumer right), animate each edge with a running circle, and enlarge the server-end arrowhead.

**Architecture:** `build-graph.ts` decides each React Flow edge's `source`/`target` from a canonical `dataFlowDirection` enum so dagre (`rankdir: LR`) lays data sources on the left and consumers on the right. The client→server arrowhead is anchored to the server end via `markerStart`/`markerEnd` (React Flow orients start-markers with `auto-start-reverse`, so it points at the server on either side). A new custom edge (`data-flow-edge.tsx`) draws a Bezier path plus an SVG `<animateMotion>` circle that runs source→target, doing a `0→1→0` round trip for bidirectional links.

**Tech Stack:** React 19, TypeScript 5.9, `@xyflow/react` ^12.10, `@dagrejs/dagre`, Vitest ^4.1 (`environment: "node"` — logic tests only, no DOM rendering), Tailwind v4 + shadcn tokens.

## Global Constraints

- Path alias `@/` → `src/`.
- Test command: `npx vitest run <file>` (single file) or `npm test` (all). Test environment is `node` — **no jsdom**; only pure-logic units are unit-tested. Presentational components are verified by `npm run build` (which runs `tsc -b`) plus manual run.
- `dataFlowDirection` canonical values: `"CODIRECTIONAL"` | `"COUNTERDIRECTIONAL"` | `"BIDIRECTIONAL"`. `null`/unknown → treat as `CODIRECTIONAL`.
- Arrow marker size constant: `ARROW_SIZE = 22` (React Flow default is 12.5).
- Circle animation duration: `dur="2s"`, `repeatCount="indefinite"`.
- `src/routeTree.gen.ts` is auto-generated — never edit.
- `example/*.json` are reference docs, not imported — do not touch.
- Commit after each task. End commit messages with the two trailer lines this repo uses (Co-Authored-By + Claude-Session) if your tooling adds them; otherwise a plain message is fine.

## File Structure

| File | Responsibility |
|---|---|
| `src/types/api.ts` | Add `DataFlowDirection` union; narrow `LinkDto.dataFlowDirection` to `DataFlowDirection \| null`. |
| `src/mocks/data/links.ts` | Migrate the 7 mock links from `REQUEST`/`PRODUCE`/`CONSUME` to canonical values covering all three directions. |
| `src/features/flow-graph/types.ts` | Extend `FlowGraphEdgeData` with `direction` + `roundTrip`. |
| `src/features/flow-graph/build-graph.ts` | `normalizeDirection()` helper; orient edges by data flow; place sized arrow on the server end; populate edge `data`; set edge `type: "dataFlow"`. |
| `src/features/flow-graph/components/data-flow-edge.tsx` | **New.** Custom edge: Bezier path + animated circle (round trip when bidirectional) + protocol label + server-end arrow. |
| `src/features/flow-graph/components/flow-graph-canvas.tsx` | Register `edgeTypes = { dataFlow: DataFlowEdge }`. |
| `src/features/flow-graph/build-graph.test.ts` | Orientation / marker / data / type assertions per direction. |

**Unchanged on purpose:** `custom-node.tsx` (handles stay target-left / source-right — orienting the RF edge is what makes them read as data-flow endpoints), `layout.ts` (dagre stays `rankdir: LR`), `details-panel.tsx` (shows the canonical string as-is).

---

### Task 1: Canonical direction type + data migration

Narrow the type and migrate all in-repo data/fixtures so the project type-checks and existing tests stay green. This is foundational: narrowing `dataFlowDirection` turns the current mock values (`REQUEST`/`PRODUCE`/`CONSUME`) and the test fixture (`"ltr"`) into type errors, so they must move to canonical values in the same task.

**Files:**
- Modify: `src/types/api.ts` (around lines 119–131)
- Modify: `src/mocks/data/links.ts` (the 7 `dataFlowDirection` fields)
- Modify: `src/features/flow-graph/build-graph.test.ts:16` (fixture value only)

**Interfaces:**
- Produces: `export type DataFlowDirection = "CODIRECTIONAL" | "COUNTERDIRECTIONAL" | "BIDIRECTIONAL"` and `LinkDto.dataFlowDirection: DataFlowDirection | null`.

- [ ] **Step 1: Add the union and narrow `LinkDto`**

In `src/types/api.ts`, replace the `LinkProtocol` + `LinkDto` block (lines ~119–132):

```ts
// Link
export type LinkProtocol = "DB" | "KAFKA" | "REST" | "SOAP" | "TFS" | "LDAP" | "common";

/**
 * Direction of data flow relative to the client/server roles.
 * - CODIRECTIONAL: client → server
 * - COUNTERDIRECTIONAL: server → client
 * - BIDIRECTIONAL: client → server, then back server → client
 */
export type DataFlowDirection = "CODIRECTIONAL" | "COUNTERDIRECTIONAL" | "BIDIRECTIONAL";

export interface LinkDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  flowId: number;
  clientNodeId: number;
  serverNodeId: number;
  protocol: LinkProtocol;
  dataFlowDirection: DataFlowDirection | null;
  principalId: number | null;
}
```

- [ ] **Step 2: Verify the type change surfaces the expected errors**

Run: `npx tsc --noEmit`
Expected: FAIL — type errors in `src/mocks/data/links.ts` (values `"REQUEST"`/`"PRODUCE"`/`"CONSUME"` not assignable) and in `src/features/flow-graph/build-graph.test.ts` (`"ltr"` not assignable). This confirms every in-repo usage is caught.

- [ ] **Step 3: Migrate the mock links to canonical values**

In `src/mocks/data/links.ts`, change only the `dataFlowDirection` field on each link so all three directions are represented within flow 99 PROD:

| Link `id` | old value | new value |
|---|---|---|
| 101 | `"REQUEST"` | `"CODIRECTIONAL"` |
| 102 | `"PRODUCE"` | `"CODIRECTIONAL"` |
| 103 | `"CONSUME"` | `"COUNTERDIRECTIONAL"` |
| 104 | `"REQUEST"` | `"BIDIRECTIONAL"` |
| 111 | `"PRODUCE"` | `"CODIRECTIONAL"` |
| 112 | `"CONSUME"` | `"COUNTERDIRECTIONAL"` |
| 201 | `"PRODUCE"` | `"CODIRECTIONAL"` |

- [ ] **Step 4: Fix the existing test fixture value**

In `src/features/flow-graph/build-graph.test.ts:16`, change:

```ts
  protocol: "KAFKA", dataFlowDirection: "ltr", principalId: null,
```

to:

```ts
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null,
```

- [ ] **Step 5: Verify type-check passes and tests still green**

Run: `npx tsc --noEmit && npx vitest run src/features/flow-graph/build-graph.test.ts`
Expected: tsc clean; all 3 existing `buildGraph` tests PASS (orientation is still client→server, unchanged so far).

- [ ] **Step 6: Commit**

```bash
git add src/types/api.ts src/mocks/data/links.ts src/features/flow-graph/build-graph.test.ts
git commit -m "feat(flow-graph): canonical DataFlowDirection enum + mock migration"
```

---

### Task 2: Orient edges by data flow + bigger server-end arrow

Drive edge `source`/`target` from the direction, anchor a larger arrow to the server end, and carry `direction`/`roundTrip` in edge data. Edges still render with React Flow's **default** type here (no custom component yet) — this task delivers correct left-to-right layout and a bigger arrow on its own; animation comes in Task 3.

**Files:**
- Modify: `src/features/flow-graph/types.ts:13-15`
- Modify: `src/features/flow-graph/build-graph.ts`
- Test: `src/features/flow-graph/build-graph.test.ts`

**Interfaces:**
- Consumes: `DataFlowDirection` from `@/types/api` (Task 1).
- Produces:
  - `normalizeDirection(raw: DataFlowDirection | null): DataFlowDirection` (exported from `build-graph.ts`).
  - `FlowGraphEdgeData = { link: LinkDto; direction: DataFlowDirection; roundTrip: boolean }`.
  - Each built edge: `source`/`target` oriented by data flow; exactly one of `markerStart`/`markerEnd` set to `{ type: MarkerType.ArrowClosed, width: 22, height: 22 }` on the server end; `data.direction` and `data.roundTrip` populated. (Edge `type` is added in Task 3.)

- [ ] **Step 1: Extend the edge data type**

In `src/features/flow-graph/types.ts`, update the import and `FlowGraphEdgeData`:

```ts
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { NodeDto, LinkDto, DataFlowDirection } from "@/types/api";
```

```ts
export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
  direction: DataFlowDirection;
  roundTrip: boolean;
}
```

- [ ] **Step 2: Write the failing orientation tests**

Replace the single edge test (the `it("creates one RF edge ... wired client→server ...")` block) in `src/features/flow-graph/build-graph.test.ts` with this block. Add `DataFlowDirection` to the type import at the top (`import type { FlowGraphDto, NodeDto, LinkDto, DataFlowDirection } from "@/types/api";`):

```ts
describe("buildGraph edge orientation", () => {
  const withDir = (dir: DataFlowDirection | null): FlowGraphDto => ({
    flowId: 1,
    env: "PROD",
    nodes: [nodeA, nodeB],
    links: [{ ...link, dataFlowDirection: dir }],
  });

  it("CODIRECTIONAL: client=source, server=target, arrow on markerEnd", () => {
    const e = buildGraph(withDir("CODIRECTIONAL")).edges[0];
    expect(e.source).toBe("1");
    expect(e.target).toBe("2");
    expect(e.markerEnd).toBeDefined();
    expect(e.markerStart).toBeUndefined();
    expect(e.label).toBe("KAFKA");
    expect(e.data?.direction).toBe("CODIRECTIONAL");
    expect(e.data?.roundTrip).toBe(false);
  });

  it("COUNTERDIRECTIONAL: server=source, client=target, arrow on markerStart", () => {
    const e = buildGraph(withDir("COUNTERDIRECTIONAL")).edges[0];
    expect(e.source).toBe("2");
    expect(e.target).toBe("1");
    expect(e.markerStart).toBeDefined();
    expect(e.markerEnd).toBeUndefined();
    expect(e.data?.direction).toBe("COUNTERDIRECTIONAL");
    expect(e.data?.roundTrip).toBe(false);
  });

  it("BIDIRECTIONAL: client=source, server=target, roundTrip, arrow on markerEnd", () => {
    const e = buildGraph(withDir("BIDIRECTIONAL")).edges[0];
    expect(e.source).toBe("1");
    expect(e.target).toBe("2");
    expect(e.markerEnd).toBeDefined();
    expect(e.markerStart).toBeUndefined();
    expect(e.data?.direction).toBe("BIDIRECTIONAL");
    expect(e.data?.roundTrip).toBe(true);
  });

  it("null / unknown direction falls back to codirectional", () => {
    const e = buildGraph(withDir(null)).edges[0];
    expect(e.source).toBe("1");
    expect(e.target).toBe("2");
    expect(e.markerEnd).toBeDefined();
    expect(e.data?.direction).toBe("CODIRECTIONAL");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/flow-graph/build-graph.test.ts`
Expected: FAIL — COUNTERDIRECTIONAL/BIDIRECTIONAL cases fail (current code always wires client→source→server→target, uses `markerEnd` unconditionally with no size, and sets no `direction`/`roundTrip`).

- [ ] **Step 4: Implement orientation in build-graph**

Replace the full contents of `src/features/flow-graph/build-graph.ts` with:

```ts
import { MarkerType } from "@xyflow/react";
import type {
  FlowGraphDto,
  NodeDto,
  LinkDto,
  DataFlowDirection,
} from "@/types/api";
import type { BuiltGraph, FlowGraphNode, FlowGraphEdge } from "./types";

const ARROW_SIZE = 22;

/** null / unknown falls back to CODIRECTIONAL (client → server). */
export function normalizeDirection(
  raw: DataFlowDirection | null,
): DataFlowDirection {
  switch (raw) {
    case "COUNTERDIRECTIONAL":
    case "BIDIRECTIONAL":
    case "CODIRECTIONAL":
      return raw;
    default:
      return "CODIRECTIONAL";
  }
}

export function buildGraph(dto: FlowGraphDto): BuiltGraph {
  const rfNodes: FlowGraphNode[] = dto.nodes.map((n) => ({
    id: String(n.id),
    type: "flowGraphNode",
    position: { x: 0, y: 0 },
    data: { node: n },
  }));

  const rfEdges: FlowGraphEdge[] = dto.links.map((l) => {
    const direction = normalizeDirection(l.dataFlowDirection);
    // Data flows source(left) → target(right). Server is the target for
    // CO/BIDIRECTIONAL; for COUNTERDIRECTIONAL the server is the data source.
    const serverIsTarget = direction !== "COUNTERDIRECTIONAL";
    const source = serverIsTarget ? l.clientNodeId : l.serverNodeId;
    const target = serverIsTarget ? l.serverNodeId : l.clientNodeId;

    // Arrow (client→server relationship) sits on the server end. React Flow
    // orients start-markers with auto-start-reverse, so it points at the
    // server whether that end is the source or the target.
    const marker = {
      type: MarkerType.ArrowClosed,
      width: ARROW_SIZE,
      height: ARROW_SIZE,
    };

    return {
      id: String(l.id),
      source: String(source),
      target: String(target),
      label: l.protocol,
      ...(serverIsTarget ? { markerEnd: marker } : { markerStart: marker }),
      data: { link: l, direction, roundTrip: direction === "BIDIRECTIONAL" },
    };
  });

  const nodeById = new Map<number, NodeDto>(dto.nodes.map((n) => [n.id, n]));
  const linkById = new Map<number, LinkDto>(dto.links.map((l) => [l.id, l]));

  return { nodes: rfNodes, edges: rfEdges, nodeById, linkById };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/flow-graph/build-graph.test.ts`
Expected: PASS — all node, orientation, and lookup-map tests green.

- [ ] **Step 6: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: clean (the `FlowGraphEdgeData` extension is satisfied by `build-graph`; `data.direction`/`data.roundTrip` reads in tests type-check).

- [ ] **Step 7: Commit**

```bash
git add src/features/flow-graph/types.ts src/features/flow-graph/build-graph.ts src/features/flow-graph/build-graph.test.ts
git commit -m "feat(flow-graph): orient edges by data-flow direction with server-end arrow"
```

---

### Task 3: Custom animated edge (running circle) + registration

Add the running-circle animation and wire the custom edge type. `build-graph` starts stamping `type: "dataFlow"`; the canvas registers the component; the component draws the path, the animated circle (round trip for bidirectional), the server-end arrow (passed through as resolved marker URLs), and the protocol label.

**Files:**
- Create: `src/features/flow-graph/components/data-flow-edge.tsx`
- Modify: `src/features/flow-graph/build-graph.ts` (add `type: "dataFlow"` to each edge)
- Modify: `src/features/flow-graph/components/flow-graph-canvas.tsx` (register `edgeTypes`)
- Test: `src/features/flow-graph/build-graph.test.ts` (assert edge `type`)

**Interfaces:**
- Consumes: `FlowGraphEdge` / `FlowGraphEdgeData` (Task 2), React Flow `EdgeProps`, `BaseEdge`, `EdgeLabelRenderer`, `getBezierPath`.
- Produces: `export const DataFlowEdge` (memoized edge component); `edgeTypes = { dataFlow: DataFlowEdge }`; every built edge has `type === "dataFlow"`.

- [ ] **Step 1: Write the failing edge-type test**

Add to the `describe("buildGraph edge orientation", ...)` block in `src/features/flow-graph/build-graph.test.ts`:

```ts
  it("stamps the custom dataFlow edge type", () => {
    const e = buildGraph(withDir("CODIRECTIONAL")).edges[0];
    expect(e.type).toBe("dataFlow");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/flow-graph/build-graph.test.ts -t "custom dataFlow edge type"`
Expected: FAIL — `e.type` is currently `undefined`.

- [ ] **Step 3: Set the edge type in build-graph**

In `src/features/flow-graph/build-graph.ts`, inside the `dto.links.map(...)` return object, add `type: "dataFlow"` immediately after `id`:

```ts
    return {
      id: String(l.id),
      type: "dataFlow",
      source: String(source),
      target: String(target),
      label: l.protocol,
      ...(serverIsTarget ? { markerEnd: marker } : { markerStart: marker }),
      data: { link: l, direction, roundTrip: direction === "BIDIRECTIONAL" },
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/flow-graph/build-graph.test.ts`
Expected: PASS — all `buildGraph` tests green including the new `type` assertion.

- [ ] **Step 5: Create the custom edge component**

Create `src/features/flow-graph/components/data-flow-edge.tsx`:

```tsx
import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowGraphEdge } from "../types";

function DataFlowEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  selected,
  label,
  data,
}: EdgeProps<FlowGraphEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const roundTrip = data?.roundTrip ?? false;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{ strokeWidth: selected ? 2.5 : 1.5 }}
      />
      {/* Running circle animates source → target = the data-flow direction.
          Bidirectional links do a 0→1→0 round trip (request out, response back). */}
      <circle r={4} className="fill-primary">
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={edgePath}
          {...(roundTrip
            ? { keyPoints: "0;1;0", keyTimes: "0;0.5;1", calcMode: "linear" as const }
            : {})}
        />
      </circle>
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-background/80 px-1 text-[10px] text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DataFlowEdge = memo(DataFlowEdgeView);
```

- [ ] **Step 6: Register the edge type in the canvas**

In `src/features/flow-graph/components/flow-graph-canvas.tsx`:

Add the import near the other component imports (after the `CustomNode` import on line 16):

```tsx
import { DataFlowEdge } from "./data-flow-edge";
```

Add the `edgeTypes` map next to the existing `nodeTypes` (line 20):

```tsx
const nodeTypes = { flowGraphNode: CustomNode };
const edgeTypes = { dataFlow: DataFlowEdge };
```

Pass it to `<ReactFlow>` — add the `edgeTypes` prop right after `nodeTypes={nodeTypes}` (line 56):

```tsx
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
```

- [ ] **Step 7: Type-check and build**

Run: `npm run build`
Expected: PASS — `tsc -b` clean and Vite build succeeds. (If `fill-primary` is rejected by Tailwind in this project, substitute `style={{ fill: "var(--primary)" }}` on the `<circle>` and drop the `className`; the shadcn `--primary` token is defined in `src/index.css`.)

- [ ] **Step 8: Manual verification with the mock API**

Run: `VITE_MOCK_API=true npm run dev -- --host`

Open `http://localhost:5173/flow-graph?flowId=99&env=PROD` and confirm:
- Layout reads left→right as data source → consumer.
- Links 101/102 (CODIRECTIONAL) and 104 (BIDIRECTIONAL): client on the left, server on the right; link 103 (COUNTERDIRECTIONAL): server (topic, node 3) on the left, client (writer, node 4) on the right.
- A circle runs along each edge in the data-flow direction; the bidirectional link (104) shows the circle going out and coming back.
- The arrowhead points at the server on every link (pointing right→left on the COUNTERDIRECTIONAL link) and is visibly larger than before.
- Clicking a link still opens the details panel with the canonical `Direction` value.

- [ ] **Step 9: Commit**

```bash
git add src/features/flow-graph/components/data-flow-edge.tsx src/features/flow-graph/components/flow-graph-canvas.tsx src/features/flow-graph/build-graph.ts src/features/flow-graph/build-graph.test.ts
git commit -m "feat(flow-graph): animated running-circle edge with data-flow direction"
```

---

## Self-Review

**Spec coverage:**
- Orient handles/edges by data flow (spec §1) → Task 2 (orientation table + `normalizeDirection`).
- Animated running circle, round trip for bidirectional (spec §2) → Task 3 (`<animateMotion>`, `keyPoints="0;1;0"`).
- Bigger arrow (spec §3) → Task 2 (`ARROW_SIZE = 22` on the server-end marker).
- Data/type migration (spec §4) → Task 1 (union + mock migration; `example/*.json` left untouched per non-goals).
- Arrow anchored at server, both sides → Task 2 (`markerStart`/`markerEnd` on server end; `auto-start-reverse` confirmed in `@xyflow/react`).
- Preserve protocol label → Task 3 (`EdgeLabelRenderer`).
- Node handles unchanged, dagre unchanged, details-panel unchanged → honored (not in any task's file list except as "unchanged").

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code; test steps show real assertions and exact commands with expected pass/fail.

**Type consistency:** `DataFlowDirection` (Task 1) is imported and used identically in `types.ts`, `build-graph.ts`, and tests. `normalizeDirection` signature matches its call site. `FlowGraphEdgeData.{direction,roundTrip}` set in `build-graph` (Task 2) and read in `data-flow-edge.tsx` (Task 3). `ARROW_SIZE = 22`, `dur="2s"` consistent with Global Constraints. Edge `type: "dataFlow"` set in build-graph (Task 3) matches `edgeTypes` key in the canvas.
