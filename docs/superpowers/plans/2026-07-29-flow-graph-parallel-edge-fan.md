# Flow Graph Parallel Edge Fan-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fan overlapping links between the same two nodes into distinct parallel lanes and lift each link's label off its line.

**Architecture:** A new pure module `parallel.ts` stamps each collapsed edge with a `data.laneOffset` (symmetric offset by index within its unordered node-pair group). The edge renderer shifts the edge's endpoints along the perpendicular by that offset before calling `getBezierPath`, so the curve, arrowheads, animated circle, and label all land on the shifted lane. Singletons get offset 0 and render unchanged.

**Tech Stack:** React 19, TypeScript 5.9 (strict), `@xyflow/react`, Vitest 4.

## Global Constraints

- Path alias: `@/` → `src/`.
- TS is strict with `noUnusedLocals`/`noUnusedParameters` — no unused imports/vars.
- Type-check with `npx tsc -b` (bare `tsc --noEmit` checks nothing in this repo).
- Tests use Vitest: `import { describe, it, expect } from "vitest"`, files co-located as `*.test.ts`, run a single file with `npx vitest run <path>`.
- Do not mutate inputs in pure modules; return new objects (matches `pairs.ts`/`collapse.ts`).
- Constants (px): `GAP = 22`, `MAX_SPREAD = 60`, `LABEL_LIFT = 14`.

---

### Task 1: `parallel.ts` — assign lane offsets

**Files:**
- Create: `src/features/flow-graph/parallel.ts`
- Test: `src/features/flow-graph/parallel.test.ts`

**Interfaces:**
- Consumes: `FlowGraphEdge` from `./types` (has `id: string`, `source: string`, `target: string`, `data?: FlowGraphEdgeData`).
- Produces: `assignParallelOffsets(edges: FlowGraphEdge[]): FlowGraphEdge[]` — returns new edge objects, each with `data.laneOffset: number` stamped in (0 for singletons). Also exports `GAP = 22`, `MAX_SPREAD = 60`.

- [ ] **Step 1: Write the failing test**

Create `src/features/flow-graph/parallel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { LinkDto } from "@/types/api";
import type { FlowGraphEdge } from "./types";
import { assignParallelOffsets, GAP } from "./parallel";

const edge = (id: string, source: string, target: string): FlowGraphEdge => ({
  id,
  source,
  target,
  type: "dataFlow",
  data: {
    link: {} as LinkDto,
    direction: "CODIRECTIONAL",
    roundTrip: false,
    crossGuid: "g",
  },
});

const offsets = (edges: FlowGraphEdge[]): Record<string, number> =>
  Object.fromEntries(
    assignParallelOffsets(edges).map((e) => [e.id, e.data!.laneOffset]),
  );

describe("assignParallelOffsets", () => {
  it("gives a lone link offset 0", () => {
    expect(offsets([edge("1", "a", "b")])).toEqual({ "1": 0 });
  });

  it("groups A->B and B->A into the same corridor", () => {
    const o = offsets([edge("1", "a", "b"), edge("2", "b", "a")]);
    // count 2 -> gap 22 -> [-11, +11], sorted by id
    expect(o["1"]).toBeCloseTo(-GAP / 2);
    expect(o["2"]).toBeCloseTo(GAP / 2);
    expect(o["1"] + o["2"]).toBeCloseTo(0);
  });

  it("produces symmetric, evenly spaced offsets for a group of 3", () => {
    const o = offsets([
      edge("1", "a", "b"),
      edge("2", "a", "b"),
      edge("3", "a", "b"),
    ]);
    // count 3 -> gap min(22, 60/2=30) = 22 -> [-22, 0, 22]
    expect(o["1"]).toBeCloseTo(-GAP);
    expect(o["2"]).toBeCloseTo(0);
    expect(o["3"]).toBeCloseTo(GAP);
    expect(o["3"] - o["2"]).toBeCloseTo(o["2"] - o["1"]);
  });

  it("caps total spread at MAX_SPREAD for large bundles", () => {
    const edges = Array.from({ length: 6 }, (_, i) =>
      edge(String(i), "a", "b"),
    );
    const vals = Object.values(offsets(edges));
    // count 6 -> gap min(22, 60/5=12) = 12 -> max abs offset 30, spacing 12
    expect(Math.max(...vals)).toBeCloseTo(30);
    expect(Math.min(...vals)).toBeCloseTo(-30);
    const sorted = [...vals].sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeCloseTo(12);
  });

  it("keeps separate corridors independent", () => {
    const o = offsets([
      edge("1", "a", "b"),
      edge("2", "a", "b"),
      edge("3", "c", "d"),
    ]);
    expect(o["1"]).toBeCloseTo(-GAP / 2);
    expect(o["2"]).toBeCloseTo(GAP / 2);
    expect(o["3"]).toBe(0);
  });

  it("is deterministic across calls", () => {
    const edges = [edge("2", "a", "b"), edge("1", "a", "b")];
    expect(offsets(edges)).toEqual(offsets(edges));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/flow-graph/parallel.test.ts`
Expected: FAIL — cannot resolve `./parallel` / `assignParallelOffsets is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/flow-graph/parallel.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/flow-graph/parallel.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/flow-graph/parallel.ts src/features/flow-graph/parallel.test.ts
git commit -m "feat(flow-graph): assignParallelOffsets for parallel edge lanes"
```

---

### Task 2: Render lanes + lift labels

**Files:**
- Modify: `src/features/flow-graph/types.ts` (add `laneOffset?` to `FlowGraphEdgeData`)
- Modify: `src/features/flow-graph/components/flow-graph-page.tsx` (wrap `collapsed` memo)
- Modify: `src/features/flow-graph/components/data-flow-edge.tsx` (perpendicular endpoint shift + label lift)

**Interfaces:**
- Consumes: `assignParallelOffsets` from `../parallel` (Task 1); `data.laneOffset: number | undefined` on each edge.
- Produces: no new exported API — visible fan-out + raised labels in the canvas.

- [ ] **Step 1: Add `laneOffset` to the edge data type**

In `src/features/flow-graph/types.ts`, inside `interface FlowGraphEdgeData`, add the field after `highlighted?: boolean;`:

```ts
  highlighted?: boolean;
  /** perpendicular fan offset (px) so parallel links between a pair separate */
  laneOffset?: number;
```

- [ ] **Step 2: Stamp offsets in the page pipeline**

In `src/features/flow-graph/components/flow-graph-page.tsx`, add the import next to the other feature imports (after the `collapseGraph` import):

```ts
import { assignParallelOffsets } from "../parallel";
```

Replace the existing `collapsed` memo:

```ts
  const collapsed = useMemo(
    () => collapseGraph(graph, pairIndex, expandedGuids),
    [graph, pairIndex, expandedGuids],
  );
```

with:

```ts
  const collapsed = useMemo(() => {
    const c = collapseGraph(graph, pairIndex, expandedGuids);
    return { nodes: c.nodes, edges: assignParallelOffsets(c.edges) };
  }, [graph, pairIndex, expandedGuids]);
```

- [ ] **Step 3: Shift endpoints and lift the label in the edge renderer**

Replace the entire contents of `src/features/flow-graph/components/data-flow-edge.tsx` with:

```tsx
import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowGraphEdge } from "../types";

const LABEL_LIFT = 14;

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
  // Shift both endpoints along the perpendicular of the source->target vector so
  // parallel links between the same pair fan into distinct lanes. getBezierPath
  // regenerates horizontal-tangent control points from the shifted endpoints, so
  // the whole curve (and its arrowheads) rides the lane. Offset 0 == unchanged.
  const laneOffset = data?.laneOffset ?? 0;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy);
  const ox = len === 0 ? 0 : (-dy / len) * laneOffset;
  const oy = len === 0 ? 0 : (dx / len) * laneOffset;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX + ox,
    sourceY: sourceY + oy,
    targetX: targetX + ox,
    targetY: targetY + oy,
    sourcePosition,
    targetPosition,
  });

  const roundTrip = data?.roundTrip ?? false;
  const highlighted = data?.highlighted ?? false;
  const strokeWidth = highlighted ? 3 : selected ? 2.5 : 1.5;
  const merged = data?.merged != null;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          strokeWidth,
          ...(merged ? { strokeDasharray: "6 4" } : {}),
          ...(highlighted ? { stroke: "#f59e0b" } : {}),
        }}
      />
      {/* Running circle animates source → target = the data-flow direction.
          Bidirectional links do a 0→1→0 round trip (request out, response back). */}
      <circle
        r={highlighted ? 5 : 4}
        className="fill-primary"
        style={highlighted ? { fill: "#f59e0b" } : undefined}
      >
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
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - LABEL_LIFT}px)`,
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

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Run the full flow-graph test suite (nothing regressed)**

Run: `npx vitest run src/features/flow-graph`
Expected: PASS — all existing suites (`build-graph`, `collapse`, `pairs`, `highlight`, `layout`, `expand-state`) plus `parallel` are green.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors in the touched files.

- [ ] **Step 7: Verify in the browser**

Servers are already running. Open http://localhost:5173/ (login `16674475` / `qweqweqwe`), navigate to the flow graph, and select a flow that has two nodes joined by 2+ links.
Expected:
- The parallel links fan into separate curved lanes (distinct entry/exit points and arrowheads) instead of overlapping.
- A single link between a pair looks unchanged.
- Each link's label sits slightly above its line rather than on it.
- Hovering a link still highlights its cross-guid group, and the highlighted lane is now individually traceable.

- [ ] **Step 8: Commit**

```bash
git add src/features/flow-graph/types.ts src/features/flow-graph/components/flow-graph-page.tsx src/features/flow-graph/components/data-flow-edge.tsx
git commit -m "feat(flow-graph): fan parallel edges into lanes and lift labels"
```

---

## Self-Review

**Spec coverage:**
- Parallel-lane separation mid-span + endpoints → Task 1 (offsets) + Task 2 Step 3 (perpendicular endpoint shift feeds getBezierPath). ✓
- Singletons unchanged → offset 0 by formula; Task 1 test "gives a lone link offset 0" + Task 2 Step 7 browser check. ✓
- Unordered grouping incl. merged proxy edges → `corridorKey` sorts ids; merged edges are ordinary edges in `collapsed.edges`. ✓
- Label lift → Task 2 Step 3 (`labelY - LABEL_LIFT`). ✓
- Spread cap → `Math.min(GAP, MAX_SPREAD / max(count-1,1))`; test "caps total spread". ✓
- `laneOffset?` on type → Task 2 Step 1. ✓
- No node/handle/layout/collapse changes → confirmed by Files lists. ✓
- Degenerate `source === target` guard → `len === 0` branch in Task 2 Step 3. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `assignParallelOffsets(FlowGraphEdge[]) → FlowGraphEdge[]`, `GAP`, `MAX_SPREAD`, `LABEL_LIFT`, and `data.laneOffset` are named identically across the spec, Task 1, and Task 2. Constants match the Global Constraints (22 / 60 / 14). ✓
