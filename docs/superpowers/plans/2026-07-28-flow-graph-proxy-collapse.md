# Flow Graph Proxy-Collapse Display Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each `crossGuid` link-pair as a single merged link that hides the intermediate proxy node, with per-link "show node", per-node "hide node", and a global expand/collapse toggle; default on load is fully collapsed.

**Architecture:** Two new pure modules — `pairs.ts` (detect mergeable pairs) and `collapse.ts` (produce the collapsed nodes/edges) — slot between the existing pure `buildGraph` and `layoutGraph`. A third pure module `expand-state.ts` holds the `Set<crossGuid>` transitions. All behavior derives from one page-level state value, `expandedGuids: Set<string>` (the pairs currently *split*; empty = all merged). React components (page, canvas, header, details panel, edge) are thin wiring over these pure functions.

**Tech Stack:** React 19 + TypeScript 5.9, @xyflow/react (React Flow), @dagrejs/dagre, Vitest (node env, pure-logic unit tests only — no component test runner), shadcn/ui (`button`, `collapsible`).

## Global Constraints

- **Frontend only.** No backend changes; `crossGuid` is already transmitted and already on `edge.data.crossGuid`.
- **Type-check with `npx tsc -b`.** Bare `tsc --noEmit` checks nothing here (solution-style root tsconfig). `tsc -b` must be clean at the end of every task.
- **Tests:** `npm run test` (vitest run, node environment). New pure modules are unit-tested. There is **no** jsdom/testing-library — do **not** add one; UI components are verified by `tsc -b` + suite-still-green + manual smoke.
- **A pair is valid iff:** exactly 2 links share the `crossGuid`; they share exactly one node (the proxy); that node is the graph-**target** of one edge and the graph-**source** of the other (a real chain `outerIn → proxy → outerOut`); the two outer endpoints differ (no self-loop). Any other group (singleton, "two-incoming", 3+, self-loop) is **not** a pair and never merges.
- **Default state:** `expandedGuids` starts empty (all pairs merged) and resets to empty on flow/env change.
- Path alias `@/` → `src/`. Merged synthetic edge id format: `` `merged:${crossGuid}` ``. Merged edge label: single protocol if both halves match, else `"<in>/<out>"`, always suffixed `" (proxy)"`.

---

### Task 1: Pair analysis (`pairs.ts`)

Pure module that scans a `BuiltGraph`'s edges and returns the valid pairs, the pure-proxy (hideable) node ids, and the node→pairs map.

**Files:**
- Create: `src/features/flow-graph/pairs.ts`
- Test: `src/features/flow-graph/pairs.test.ts`

**Interfaces:**
- Consumes: `BuiltGraph`, `FlowGraphEdge` from `./types`; `LinkDto` from `@/types/api`. Each edge has `.source`/`.target` (string node ids) and `.data.link` / `.data.crossGuid`.
- Produces:
  ```ts
  export interface Pair {
    crossGuid: string;
    proxyNodeId: number;
    outerSourceId: number;   // graph source of the merged edge
    outerTargetId: number;   // graph target of the merged edge
    linkIn: LinkDto;         // link whose graph-target is the proxy
    linkOut: LinkDto;        // link whose graph-source is the proxy
  }
  export interface PairIndex {
    pairs: Map<string, Pair>;          // valid pairs only, keyed by crossGuid
    hideableNodes: Set<number>;        // pure-proxy node ids
    nodePairs: Map<number, string[]>;  // proxyNodeId → its crossGuids
  }
  export function analyzePairs(graph: BuiltGraph): PairIndex;
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/features/flow-graph/pairs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, LinkDto } from "@/types/api";
import { buildGraph } from "./build-graph";
import { analyzePairs } from "./pairs";

const node = (id: number): NodeDto => ({
  id, insertedAt: null, updatedAt: null,
  nodeType: "MICROSERVICE", name: `n${id}`, environment: "PROD", automatedSystem: null,
});
const link = (id: number, client: number, server: number, guid: string): LinkDto => ({
  id, insertedAt: null, updatedAt: null, flowId: 1,
  clientNodeId: client, serverNodeId: server,
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null, crossGuid: guid,
});
const dto = (nodes: NodeDto[], links: LinkDto[]): FlowGraphDto => ({
  flowId: 1, env: "PROD", nodes, links,
});

describe("analyzePairs", () => {
  it("detects a valid chain 1→2→3 as one pair with proxy 2", () => {
    // CODIRECTIONAL: source=client, target=server. l1: 1→2, l2: 2→3.
    const g = buildGraph(dto([node(1), node(2), node(3)], [
      link(10, 1, 2, "g"), link(11, 2, 3, "g"),
    ]));
    const idx = analyzePairs(g);
    const pair = idx.pairs.get("g")!;
    expect(idx.pairs.size).toBe(1);
    expect(pair.proxyNodeId).toBe(2);
    expect(pair.outerSourceId).toBe(1);
    expect(pair.outerTargetId).toBe(3);
    expect(pair.linkIn.id).toBe(10);
    expect(pair.linkOut.id).toBe(11);
    expect(idx.hideableNodes.has(2)).toBe(true);
    expect(idx.nodePairs.get(2)).toEqual(["g"]);
  });

  it("does not pair a singleton crossGuid", () => {
    const g = buildGraph(dto([node(1), node(2)], [link(10, 1, 2, "solo")]));
    const idx = analyzePairs(g);
    expect(idx.pairs.size).toBe(0);
    expect(idx.hideableNodes.size).toBe(0);
  });

  it("rejects a 'two-incoming' group (both edges target the shared node)", () => {
    // l1: 1→2, l2: 3→2 — node 2 is target of both, no continuation.
    const g = buildGraph(dto([node(1), node(2), node(3)], [
      link(10, 1, 2, "g"), link(11, 3, 2, "g"),
    ]));
    expect(analyzePairs(g).pairs.size).toBe(0);
  });

  it("rejects a 3-link group", () => {
    const g = buildGraph(dto([node(1), node(2), node(3), node(4)], [
      link(10, 1, 2, "g"), link(11, 2, 3, "g"), link(12, 3, 4, "g"),
    ]));
    expect(analyzePairs(g).pairs.size).toBe(0);
  });

  it("rejects a self-loop pair (outer endpoints equal)", () => {
    // l1: 1→2, l2: 2→1 — chain would be 1→1.
    const g = buildGraph(dto([node(1), node(2)], [
      link(10, 1, 2, "g"), link(11, 2, 1, "g"),
    ]));
    expect(analyzePairs(g).pairs.size).toBe(0);
  });

  it("excludes a proxy node that also has a non-pair link", () => {
    // Pair 1→2→3 (proxy 2), plus an extra singleton link 2→4 touching node 2.
    const g = buildGraph(dto([node(1), node(2), node(3), node(4)], [
      link(10, 1, 2, "g"), link(11, 2, 3, "g"), link(12, 2, 4, "solo"),
    ]));
    const idx = analyzePairs(g);
    expect(idx.pairs.size).toBe(1);
    expect(idx.hideableNodes.has(2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- pairs`
Expected: FAIL — `analyzePairs` is not defined / module missing.

- [ ] **Step 3: Implement `pairs.ts`**

Create `src/features/flow-graph/pairs.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- pairs`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc -b`
Expected: exit 0.

```bash
git add src/features/flow-graph/pairs.ts src/features/flow-graph/pairs.test.ts
git commit -m "feat(flow-graph): analyzePairs — detect mergeable crossGuid link-pairs"
```

---

### Task 2: Collapse transform (`collapse.ts`) + `merged` edge data

Pure module that, given the built graph + `PairIndex` + `expandedGuids`, produces the nodes/edges actually rendered: merged pairs become one synthetic edge and their pure-proxy node disappears; split pairs keep their real edges.

**Files:**
- Modify: `src/features/flow-graph/types.ts` (add `merged?` to `FlowGraphEdgeData`)
- Create: `src/features/flow-graph/collapse.ts`
- Test: `src/features/flow-graph/collapse.test.ts`

**Interfaces:**
- Consumes: `BuiltGraph`, `FlowGraphNode`, `FlowGraphEdge` from `./types`; `PairIndex`, `Pair` from `./pairs`; `normalizeDirection` from `./build-graph` (already exported); `MarkerType` from `@xyflow/react`.
- Produces:
  ```ts
  export function collapseGraph(
    graph: BuiltGraph,
    pairIndex: PairIndex,
    expandedGuids: Set<string>,
  ): { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] };
  ```

- [ ] **Step 1: Add the `merged` field to `FlowGraphEdgeData`**

In `src/features/flow-graph/types.ts`, extend the interface (leave `link`, `direction`, `roundTrip`, `crossGuid`, `highlighted` as-is):

```ts
export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
  direction: DataFlowDirection;
  roundTrip: boolean;
  crossGuid: string;
  highlighted?: boolean;
  merged?: {
    crossGuid: string;
    proxyNodeId: number;
    linkIn: LinkDto;
    linkOut: LinkDto;
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/flow-graph/collapse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, LinkDto } from "@/types/api";
import { buildGraph } from "./build-graph";
import { analyzePairs } from "./pairs";
import { collapseGraph } from "./collapse";

const node = (id: number): NodeDto => ({
  id, insertedAt: null, updatedAt: null,
  nodeType: "MICROSERVICE", name: `n${id}`, environment: "PROD", automatedSystem: null,
});
const link = (id: number, client: number, server: number, guid: string): LinkDto => ({
  id, insertedAt: null, updatedAt: null, flowId: 1,
  clientNodeId: client, serverNodeId: server,
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null, crossGuid: guid,
});

// Two pairs through proxy 2: 1→2→3 (g1) and 4→2→3 (g2). Node 2 is a pure proxy.
function fixture() {
  const dto: FlowGraphDto = {
    flowId: 1, env: "PROD",
    nodes: [node(1), node(2), node(3), node(4)],
    links: [
      link(10, 1, 2, "g1"), link(11, 2, 3, "g1"),
      link(12, 4, 2, "g2"), link(13, 2, 3, "g2"),
    ],
  };
  const graph = buildGraph(dto);
  return { graph, idx: analyzePairs(graph) };
}

describe("collapseGraph", () => {
  it("default (empty set): hides the proxy and emits one merged edge per pair", () => {
    const { graph, idx } = fixture();
    const out = collapseGraph(graph, idx, new Set());
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["1", "3", "4"]); // node 2 hidden
    const merged = out.edges.filter((e) => e.data?.merged);
    expect(merged).toHaveLength(2);
    const g1 = out.edges.find((e) => e.id === "merged:g1")!;
    expect(g1.source).toBe("1");
    expect(g1.target).toBe("3");
    expect(g1.label).toBe("KAFKA (proxy)");
    expect(g1.data?.merged?.proxyNodeId).toBe(2);
    expect(g1.data?.crossGuid).toBe("g1"); // hover-highlight still keyed on crossGuid
    // The two real edges of g1 are gone.
    expect(out.edges.find((e) => e.id === "10")).toBeUndefined();
    expect(out.edges.find((e) => e.id === "11")).toBeUndefined();
  });

  it("expanding one guid splits that pair and reveals the proxy; sibling stays merged", () => {
    const { graph, idx } = fixture();
    const out = collapseGraph(graph, idx, new Set(["g1"]));
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["1", "2", "3", "4"]); // node 2 back
    expect(out.edges.find((e) => e.id === "10")).toBeDefined();  // g1 real edges present
    expect(out.edges.find((e) => e.id === "11")).toBeDefined();
    expect(out.edges.find((e) => e.id === "merged:g1")).toBeUndefined();
    expect(out.edges.find((e) => e.id === "merged:g2")).toBeDefined(); // g2 still merged
  });

  it("expanding all guids reproduces the original topology", () => {
    const { graph, idx } = fixture();
    const out = collapseGraph(graph, idx, new Set(["g1", "g2"]));
    expect(out.nodes.map((n) => n.id).sort()).toEqual(graph.nodes.map((n) => n.id).sort());
    expect(out.edges.map((e) => e.id).sort()).toEqual(graph.edges.map((e) => e.id).sort());
    expect(out.edges.some((e) => e.data?.merged)).toBe(false);
  });

  it("labels a mixed-protocol pair with both protocols", () => {
    const dto: FlowGraphDto = {
      flowId: 1, env: "PROD",
      nodes: [node(1), node(2), node(3)],
      links: [
        { ...link(10, 1, 2, "g"), protocol: "REST" },
        { ...link(11, 2, 3, "g"), protocol: "KAFKA" },
      ],
    };
    const graph = buildGraph(dto);
    const out = collapseGraph(graph, analyzePairs(graph), new Set());
    expect(out.edges.find((e) => e.id === "merged:g")!.label).toBe("REST/KAFKA (proxy)");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- collapse`
Expected: FAIL — `collapseGraph` not defined.

- [ ] **Step 4: Implement `collapse.ts`**

Create `src/features/flow-graph/collapse.ts`:

```ts
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
```

- [ ] **Step 5: Run tests + type-check**

Run: `npm run test -- collapse` → Expected: PASS (4 tests).
Run: `npx tsc -b` → Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/flow-graph/collapse.ts src/features/flow-graph/collapse.test.ts src/features/flow-graph/types.ts
git commit -m "feat(flow-graph): collapseGraph — merge pairs and hide pure-proxy nodes"
```

---

### Task 3: Expand-state transitions (`expand-state.ts`)

Pure `Set<crossGuid>` transition helpers driving the four controls.

**Files:**
- Create: `src/features/flow-graph/expand-state.ts`
- Test: `src/features/flow-graph/expand-state.test.ts`

**Interfaces:**
- Consumes: `PairIndex` from `./pairs`.
- Produces:
  ```ts
  export function collapseAll(): Set<string>;
  export function expandAll(pairIndex: PairIndex): Set<string>;
  export function showNode(current: Set<string>, crossGuid: string): Set<string>;
  export function hideNode(current: Set<string>, pairIndex: PairIndex, nodeId: number): Set<string>;
  ```
  All return a **new** Set (never mutate the input).

- [ ] **Step 1: Write the failing tests**

Create `src/features/flow-graph/expand-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PairIndex } from "./pairs";
import { collapseAll, expandAll, showNode, hideNode } from "./expand-state";

const idx: PairIndex = {
  pairs: new Map([
    ["g1", {} as never],
    ["g2", {} as never],
    ["g3", {} as never],
  ]),
  hideableNodes: new Set([2]),
  nodePairs: new Map([
    [2, ["g1", "g2"]], // node 2 proxies g1 and g2
    [5, ["g3"]],
  ]),
};

describe("expand-state", () => {
  it("collapseAll returns an empty set", () => {
    expect(collapseAll().size).toBe(0);
  });
  it("expandAll returns every pair guid", () => {
    expect([...expandAll(idx)].sort()).toEqual(["g1", "g2", "g3"]);
  });
  it("showNode adds one guid without mutating the input", () => {
    const before = new Set<string>();
    const after = showNode(before, "g1");
    expect(before.size).toBe(0);
    expect([...after]).toEqual(["g1"]);
  });
  it("hideNode removes all guids proxied by the node", () => {
    const after = hideNode(new Set(["g1", "g2", "g3"]), idx, 2);
    expect([...after]).toEqual(["g3"]); // g1,g2 removed; g3 (node 5) kept
  });
  it("hideNode is a no-op for a node with no pairs", () => {
    const after = hideNode(new Set(["g1"]), idx, 99);
    expect([...after]).toEqual(["g1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- expand-state`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `expand-state.ts`**

Create `src/features/flow-graph/expand-state.ts`:

```ts
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
```

- [ ] **Step 4: Run tests + type-check**

Run: `npm run test -- expand-state` → Expected: PASS (5 tests).
Run: `npx tsc -b` → Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/flow-graph/expand-state.ts src/features/flow-graph/expand-state.test.ts
git commit -m "feat(flow-graph): expand-state — pure crossGuid set transitions"
```

---

### Task 4: Mock demo data — second pair through the proxy

Add a second pair through node 2 (plus a fresh source node) so the mock flow 99 PROD reproduces the design example (two proxy-collapsed links into one topic). Pure-logic tests use inline fixtures, so this only affects the runtime demo — but the full suite must still pass.

**Files:**
- Modify: `src/mocks/data/nodes.ts` (add node 6)
- Modify: `src/mocks/data/links.ts` (add links 105, 106)

**Interfaces:**
- Consumes: `NodeDto`, `LinkDto`. No code depends on these ids beyond the mock handlers.

- [ ] **Step 1: Add node 6 (a second microservice source)**

In `src/mocks/data/nodes.ts`, add this object to the `nodes` array immediately after node id 5 (the `calypso-egress` object), before the `// ── Flow 99, DEV` comment:

```ts
  {
    id: 6,
    insertedAt: "2025-11-03T10:16:00",
    updatedAt: "2025-11-03T10:16:00",
    nodeType: "MICROSERVICE",
    name: "quote-publisher",
    environment: "PROD",
    automatedSystem: as(1451),
  },
```

- [ ] **Step 2: Add links 105 & 106 (the second pair, sharing a new crossGuid)**

In `src/mocks/data/links.ts`, add these two objects immediately after link id 104, before the `// ── Flow 99, DEV chain` comment:

```ts
  {
    id: 105,
    insertedAt: "2025-11-03T10:22:00",
    updatedAt: "2025-11-03T10:22:00",
    flowId: 99,
    clientNodeId: 6,
    serverNodeId: 2,
    protocol: "KAFKA",
    dataFlowDirection: "CODIRECTIONAL",
    principalId: null,
    crossGuid: "dddddddd-0000-4000-8000-0000000000dd",
  },
  {
    id: 106,
    insertedAt: "2025-11-03T10:22:00",
    updatedAt: "2025-11-03T10:22:00",
    flowId: 99,
    clientNodeId: 2,
    serverNodeId: 3,
    protocol: "KAFKA",
    dataFlowDirection: "CODIRECTIONAL",
    principalId: null,
    crossGuid: "dddddddd-0000-4000-8000-0000000000dd",
  },
```

This makes node 2 the pure proxy for two pairs — `cccccccc…cc` (1→2→3) and `dddddddd…dd` (6→2→3) — so the default collapsed view shows two `(proxy)` edges into topic node 3, and "show node" on one leaves the other merged.

- [ ] **Step 3: Verify the whole suite still passes and type-checks**

Run: `npm run test` → Expected: PASS (all existing + Task 1-3 tests; no regressions).
Run: `npx tsc -b` → Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/mocks/data/nodes.ts src/mocks/data/links.ts
git commit -m "test(flow-graph): mock a second crossGuid pair through the proxy node"
```

---

### Task 5: Wire the collapse mode into page, canvas, header, and edge styling

Feed the collapsed graph through the render pipeline, add page-level `expandedGuids` state + handlers, add the header global toggle, and give merged edges a dashed style. Per-item selection/details come in Task 6 — this task is demoable end-to-end via the global toggle.

**Files:**
- Modify: `src/features/flow-graph/components/flow-graph-page.tsx`
- Modify: `src/features/flow-graph/components/flow-graph-canvas.tsx`
- Modify: `src/features/flow-graph/components/flow-graph-header.tsx`
- Modify: `src/features/flow-graph/components/data-flow-edge.tsx`

**Interfaces:**
- Consumes: `analyzePairs` (Task 1), `collapseGraph` (Task 2), `collapseAll`/`expandAll` (Task 3), existing `buildGraph`, `layoutGraph`.
- Produces: canvas now accepts `graph: { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] }` (the collapsed result) rather than `BuiltGraph`. Header gains optional proxy-toggle props.

- [ ] **Step 1: Page — add state, memos, handlers**

In `src/features/flow-graph/components/flow-graph-page.tsx`:

Add imports at the top with the other feature imports:

```ts
import { analyzePairs } from "../pairs";
import { collapseGraph } from "../collapse";
import { collapseAll, expandAll } from "../expand-state";
```

In `LoadedFlowGraphPage`, replace the state/`useEffect` block (currently `const graph = useMemo(...)`, `const [selection...]`, `useEffect(() => setSelection(null), ...)`) with:

```ts
  const graph = useMemo(() => buildGraph(data.data), [data]);
  const pairIndex = useMemo(() => analyzePairs(graph), [graph]);
  const [selection, setSelection] = useState<Selection>(null);
  const [expandedGuids, setExpandedGuids] = useState<Set<string>>(new Set());
  const collapsed = useMemo(
    () => collapseGraph(graph, pairIndex, expandedGuids),
    [graph, pairIndex, expandedGuids],
  );

  useEffect(() => {
    setSelection(null);
    setExpandedGuids(new Set());
  }, [flowId, env]);

  const hasPairs = pairIndex.pairs.size > 0;
  const allCollapsed = expandedGuids.size === 0;
  const allExpanded = hasPairs && expandedGuids.size === pairIndex.pairs.size;
```

Pass the toggle props to `FlowGraphHeader` (the one inside `LoadedFlowGraphPage`) by adding these props to its JSX:

```tsx
          hasPairs={hasPairs}
          allCollapsed={allCollapsed}
          allExpanded={allExpanded}
          onCollapseAll={() => setExpandedGuids(collapseAll())}
          onExpandAll={() => setExpandedGuids(expandAll(pairIndex))}
```

Change the canvas usage to pass the collapsed graph:

```tsx
          <FlowGraphCanvas graph={collapsed} selection={selection} onSelect={setSelection} />
```

Leave the `DetailsPanel` usage unchanged in this task (Task 6 extends it).

- [ ] **Step 2: Canvas — accept collapsed `{nodes, edges}`**

In `src/features/flow-graph/components/flow-graph-canvas.tsx`, change the prop type (the canvas only ever reads `nodes`/`edges`, never the lookup maps):

```ts
import type { Selection, FlowGraphNode, FlowGraphEdge } from "../types";

interface FlowGraphCanvasProps {
  graph: { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] };
  selection: Selection;
  onSelect: (sel: Selection) => void;
}
```

Remove the now-unused `BuiltGraph` import. The rest of the component (the `useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph])`, the local state, the effect syncing on `graph`) already works against `{nodes, edges}` unchanged. Leave `onEdgeClick` as-is for now (Task 6 handles merged-edge selection).

- [ ] **Step 3: Header — global proxy toggle**

In `src/features/flow-graph/components/flow-graph-header.tsx`:

Add the import:

```ts
import { Button } from "@/components/ui/button";
```

Extend `FlowGraphHeaderProps`:

```ts
interface FlowGraphHeaderProps {
  flow?: FlowDto;
  flowId?: number;
  env: EnvironmentCode;
  onFlowChange: (id: number) => void;
  onEnvChange: (env: EnvironmentCode) => void;
  hasPairs?: boolean;
  allCollapsed?: boolean;
  allExpanded?: boolean;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
}
```

Destructure the new props in the function signature, then render the toggle inside the right-hand `<div className="flex shrink-0 items-center gap-2">`, before the `<Select>`:

```tsx
        {hasPairs && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={allCollapsed ? "default" : "outline"}
              onClick={onCollapseAll}
            >
              Collapse proxies
            </Button>
            <Button
              size="sm"
              variant={allExpanded ? "default" : "outline"}
              onClick={onExpandAll}
            >
              Expand proxies
            </Button>
          </div>
        )}
```

- [ ] **Step 4: Edge — dashed style for merged edges**

In `src/features/flow-graph/components/data-flow-edge.tsx`, after the existing `const highlighted = ...` line add:

```ts
  const merged = data?.merged != null;
```

Update the `<BaseEdge>` `style` prop to include a dash when merged:

```tsx
        style={{
          strokeWidth,
          ...(merged ? { strokeDasharray: "6 4" } : {}),
          ...(highlighted ? { stroke: "#f59e0b" } : {}),
        }}
```

- [ ] **Step 5: Type-check + suite**

Run: `npx tsc -b` → Expected: exit 0.
Run: `npm run test` → Expected: PASS (no regressions).

- [ ] **Step 6: Manual smoke (mock API, fast)**

Run: `VITE_MOCK_API=true npm run dev -- --host`, open flow 99 / PROD. Confirm: node 2 (`me-depo-adapter`) is hidden by default; two dashed `(proxy)` edges run into the topic; "Collapse proxies" / "Expand proxies" in the header toggle node 2 and its links in/out; no console errors. (Full real-backend verification is Task 6 / final.)

- [ ] **Step 7: Commit**

```bash
git add src/features/flow-graph/components/flow-graph-page.tsx src/features/flow-graph/components/flow-graph-canvas.tsx src/features/flow-graph/components/flow-graph-header.tsx src/features/flow-graph/components/data-flow-edge.tsx
git commit -m "feat(flow-graph): collapsed render pipeline + global proxy toggle + merged edge style"
```

---

### Task 6: Merged-link selection, details panel, and per-item show/hide

Extend `Selection` for merged links, route merged-edge clicks, and build the details-panel surfaces: the merged-link view ("Show node" + both links + collapsed proxy block) and the "Hide node" button on a pure-proxy node.

**Files:**
- Modify: `src/features/flow-graph/types.ts` (extend `Selection`)
- Modify: `src/features/flow-graph/components/flow-graph-canvas.tsx` (merged-edge click + selected)
- Modify: `src/features/flow-graph/components/details-panel.tsx` (merged view + hide button)
- Modify: `src/features/flow-graph/components/flow-graph-page.tsx` (pass new DetailsPanel props)

**Interfaces:**
- Consumes: `PairIndex`/`Pair` from `../pairs`; `showNode`/`hideNode` from `../expand-state`; `Button` and `Collapsible*` primitives.
- Produces: `DetailsPanel` gains props `pairIndex: PairIndex`, `onShowNode: (crossGuid: string) => void`, `onHideNode: (nodeId: number) => void`.

- [ ] **Step 1: Extend `Selection`**

In `src/features/flow-graph/types.ts`:

```ts
export type Selection =
  | { kind: "node"; id: number }
  | { kind: "link"; id: number }
  | { kind: "mergedLink"; crossGuid: string }
  | null;
```

- [ ] **Step 2: Canvas — route merged-edge clicks and selection**

In `src/features/flow-graph/components/flow-graph-canvas.tsx`, replace `onEdgeClick`:

```ts
  const onEdgeClick: EdgeMouseHandler<FlowGraphEdge> = (_, edge) => {
    const merged = edge.data?.merged;
    if (merged) onSelect({ kind: "mergedLink", crossGuid: merged.crossGuid });
    else onSelect({ kind: "link", id: Number(edge.id) });
  };
```

Update the edge `selected` mapping inside the `edges={edges.map(...)}` block so a selected merged edge highlights:

```tsx
          selected:
            (selection?.kind === "link" && selection.id === Number(e.id)) ||
            (selection?.kind === "mergedLink" &&
              selection.crossGuid === e.data?.merged?.crossGuid),
```

- [ ] **Step 3: Page — pass the new DetailsPanel props**

In `src/features/flow-graph/components/flow-graph-page.tsx`, add the `showNode`/`hideNode` imports:

```ts
import { collapseAll, expandAll, showNode, hideNode } from "../expand-state";
```

Update the `DetailsPanel` usage:

```tsx
            <DetailsPanel
              selection={selection}
              graph={graph}
              pairIndex={pairIndex}
              onShowNode={(guid) => setExpandedGuids((s) => showNode(s, guid))}
              onHideNode={(nodeId) => setExpandedGuids((s) => hideNode(s, pairIndex, nodeId))}
            />
```

- [ ] **Step 4: Details panel — merged view + hide button**

In `src/features/flow-graph/components/details-panel.tsx`:

Add imports:

```ts
import { Button } from "@/components/ui/button";
import type { PairIndex, Pair } from "../pairs";
```

Extend the props and dispatch on the new selection kind:

```tsx
interface DetailsPanelProps {
  selection: Selection;
  graph: BuiltGraph;
  pairIndex: PairIndex;
  onShowNode: (crossGuid: string) => void;
  onHideNode: (nodeId: number) => void;
}

export function DetailsPanel({
  selection,
  graph,
  pairIndex,
  onShowNode,
  onHideNode,
}: DetailsPanelProps) {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node or link to see its details.
      </div>
    );
  }

  if (selection.kind === "mergedLink") {
    const pair = pairIndex.pairs.get(selection.crossGuid);
    if (!pair) return <Missing />;
    return <MergedLinkDetails pair={pair} graph={graph} onShowNode={onShowNode} />;
  }

  if (selection.kind === "node") {
    const node = graph.nodeById.get(selection.id);
    if (!node) return <Missing />;
    return (
      <NodeDetails
        node={node}
        hideable={pairIndex.hideableNodes.has(node.id)}
        onHideNode={onHideNode}
      />
    );
  }
  const link = graph.linkById.get(selection.id);
  if (!link) return <Missing />;
  return <LinkDetails link={link} graph={graph} />;
}
```

Update `NodeDetails` to accept the hide affordance and render the button at the top when hideable:

```tsx
function NodeDetails({
  node,
  hideable,
  onHideNode,
}: {
  node: NodeDto;
  hideable: boolean;
  onHideNode: (nodeId: number) => void;
}) {
  return (
    <div>
      {hideable && (
        <div className="border-b px-4 py-3">
          <Button size="sm" variant="outline" onClick={() => onHideNode(node.id)}>
            Hide node
          </Button>
        </div>
      )}
      <Section title={`${node.nodeType} node`}>
        <FieldRow label="ID">{node.id}</FieldRow>
        <FieldRow label="Name">{node.name}</FieldRow>
        <FieldRow label="Type">{node.nodeType}</FieldRow>
        <FieldRow label="Environment">{node.environment}</FieldRow>
        <FieldRow label="Inserted at">{node.insertedAt ?? "—"}</FieldRow>
        <FieldRow label="Updated at">{node.updatedAt ?? "—"}</FieldRow>
      </Section>
      {node.automatedSystem && (
        <Section title="Automated system">
          <FieldRow label="Name">{node.automatedSystem.name}</FieldRow>
          <FieldRow label="Object code">{node.automatedSystem.objectCode ?? "—"}</FieldRow>
          <FieldRow label="CI">{node.automatedSystem.ci}</FieldRow>
          <FieldRow label="Block">{node.automatedSystem.block}</FieldRow>
          <FieldRow label="Tribe">{node.automatedSystem.tribe}</FieldRow>
          <FieldRow label="Cluster">{node.automatedSystem.cluster}</FieldRow>
          <FieldRow label="Leader">{node.automatedSystem.leader}</FieldRow>
        </Section>
      )}
      <DataSection data={node.data} />
    </div>
  );
}
```

Add the `MergedLinkDetails` component at the end of the file. It reuses `Section`, `FieldRow`, and `Collapsible*` (already imported):

```tsx
function MergedLinkDetails({
  pair,
  graph,
  onShowNode,
}: {
  pair: Pair;
  graph: BuiltGraph;
  onShowNode: (crossGuid: string) => void;
}) {
  const proxy = graph.nodeById.get(pair.proxyNodeId);
  const outerSource = graph.nodeById.get(pair.outerSourceId);
  const outerTarget = graph.nodeById.get(pair.outerTargetId);
  return (
    <div>
      <div className="border-b px-4 py-3">
        <Button size="sm" onClick={() => onShowNode(pair.crossGuid)}>
          Show node
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Proxy link — collapses {outerSource?.name ?? pair.outerSourceId} →{" "}
          {proxy?.name ?? pair.proxyNodeId} → {outerTarget?.name ?? pair.outerTargetId}.
        </p>
      </div>
      <LinkSubSection title="Link into proxy" link={pair.linkIn} />
      <LinkSubSection title="Link out of proxy" link={pair.linkOut} />
      <section className="border-b px-4 py-3">
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Proxy node
            <ChevronsUpDown className="size-3.5" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {proxy ? (
              <dl className="mt-2">
                <FieldRow label="ID">{proxy.id}</FieldRow>
                <FieldRow label="Name">{proxy.name}</FieldRow>
                <FieldRow label="Type">{proxy.nodeType}</FieldRow>
                <FieldRow label="Environment">{proxy.environment}</FieldRow>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Proxy node not found.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>
    </div>
  );
}

function LinkSubSection({ title, link }: { title: string; link: LinkDto }) {
  return (
    <Section title={title}>
      <FieldRow label="ID">{link.id}</FieldRow>
      <FieldRow label="Protocol">{link.protocol}</FieldRow>
      <FieldRow label="Direction">{link.dataFlowDirection ?? "—"}</FieldRow>
      <FieldRow label="Cross GUID">{link.crossGuid}</FieldRow>
    </Section>
  );
}
```

- [ ] **Step 5: Type-check + suite**

Run: `npx tsc -b` → Expected: exit 0 (the `Selection` union is exhaustively handled in `DetailsPanel` and `flow-graph-canvas`).
Run: `npm run test` → Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/features/flow-graph/types.ts src/features/flow-graph/components/flow-graph-canvas.tsx src/features/flow-graph/components/details-panel.tsx src/features/flow-graph/components/flow-graph-page.tsx
git commit -m "feat(flow-graph): merged-link details, show node / hide node controls"
```

- [ ] **Step 7: Manual verification against the REAL backend**

This is the acceptance gate the requester asked for — **not** the mock API.

1. Start the Spring Boot backend locally (see `backend-run-setup` memory: JDK 17, `SPRING_PROFILES_ACTIVE=local`, `DB_PASSWORD` from `F:\programming\cometa\.vscode\backend.env`; serves on `:8080`).
2. Ensure the frontend hits it, not MSW: `F:\programming\react\cometa-frontend\.env.development.local` contains `VITE_MOCK_API=false`. Start `npm run dev -- --host`.
3. Open a flow graph that contains a real `crossGuid` pair (a proxy/egress node with a continuation chain). Verify:
   - **Default load:** every pure-proxy node is hidden and its pairs render as dashed `(proxy)` links between the outer nodes.
   - **Header toggle:** "Expand proxies" reveals all proxy nodes and their real links; "Collapse proxies" re-merges everything.
   - **Show node:** selecting a merged link shows "Show node" + both link sub-sections + a collapsed "Proxy node" block; clicking "Show node" reveals that proxy and splits only that pair (sibling pairs through the same node stay merged).
   - **Hide node:** selecting a revealed pure-proxy node shows "Hide node"; clicking it re-merges its pairs and hides it.
   - **Hover-highlight** still works on split halves (hovering one amber-highlights its counterpart).
   - **Zero console errors.**

---

## Notes for the executor

- Files that only *construct* a `FlowGraphEdgeData` literal (e.g. `layout.test.ts`) already compile because `merged` is optional — no fixture change needed there.
- The layout re-flows on every toggle (dagre runs on the collapsed graph). That is intended; do not try to preserve positions.
- Do not add jsdom/testing-library. Component correctness is covered by `tsc -b` + the pure-module tests + the manual checks above.
