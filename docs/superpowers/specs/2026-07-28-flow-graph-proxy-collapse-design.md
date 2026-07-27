# Flow Graph — Proxy-collapse display mode

**Date:** 2026-07-28
**Status:** Approved (design)
**Scope:** Frontend only (cometa-frontend React). No backend changes.

## Problem

In a flow graph, some nodes (e.g. **egress** nodes) act only as proxies: data
enters on one link and continues out on another. When such a node sits between
many pairs of links, the diagram is cluttered with intermediate hops that add
no information — the user just wants to see "source talks to destination".

The `gmsb.link.cross_guid` column already ties together the two links that form
one continuation path through a proxy node (verified previous feature: groups
are size **1** = standalone, or **2** = one link *into* a proxy + one link *out*;
both links share the same `flow_id`). `crossGuid` is already transmitted on
every `LinkDto` and already lands on each React Flow edge's `data.crossGuid`.

**Goal:** a display mode where each such **pair** renders as a single "merged"
link that omits the intermediate proxy node, with per-link / per-node / global
controls to expand (split) and collapse (re-merge) proxies. On load, every node
that is *purely* a proxy is hidden and its links merged.

## Core concepts

### Pair

A **pair** is a `crossGuid` group that can be validly merged. A group qualifies
as a pair **iff all** of these hold:

- It contains **exactly 2** links.
- The two links share **exactly one** common node — the **proxy**.
- The proxy is the **target of one** link and the **source of the other** (a
  real continuation *chain* `outerIn → proxy → outerOut`), using the
  source/target already assigned by `buildGraph` (which encodes flow direction).
- The two **outer** endpoints differ (merging would not create a self-loop).

Any group that fails these rules (a singleton; a degenerate "two links both
pointing *into* the shared node"; a 3+ group; a would-be self-loop) is **not a
pair** — its links always render normally and are never merged or hidden. The
"two-incoming" rejection is the exact degenerate case caught during the prior
feature's mock review.

### Merged vs split; the single source of truth

All behavior derives from one piece of state:

```
expandedGuids: Set<string>   // crossGuids currently SPLIT (shown through proxy)
```

- A pair is **merged** when its guid is **absent** from the set (the default).
- A pair is **split** when its guid is **present**.
- **Default on load:** `expandedGuids` is empty → every pair merged.

Node visibility is *derived*, never stored: a node is hidden iff it is a
**pure proxy** (every incident link belongs to a pair that this node proxies)
**and all** of its pairs are currently merged. A pure proxy therefore appears on
the canvas exactly when at least one of its pairs is split.

### Actions (all just mutate `expandedGuids`)

| Control | Location | Effect |
|---|---|---|
| **Show node** | merged link's details panel | `add(guid)` — split this pair; proxy appears if it wasn't already |
| **Hide node** | pure-proxy node's details panel | delete all of that node's pair guids — re-merge them; node hides |
| **Expand all** | header toggle | `expandedGuids = new Set(allPairGuids)` |
| **Collapse all** | header toggle | `expandedGuids = new Set()` |

The task's phrasing "restore the node's visibility, or if node already visible,
split link into two" is a single unified action: `add(guid)` splits this pair
and the proxy is visible as a consequence. The two described outcomes differ
only in whether a *sibling* pair through the same proxy was already split.

## Architecture

Two new **pure, unit-tested** modules slot between the existing `buildGraph` and
`layoutGraph`. Neither of those two functions changes.

```
buildGraph(dto)  →  analyzePairs(graph)  ─┐
                                          ├─→ collapseGraph(graph, pairIndex, expandedGuids)
                    expandedGuids  ───────┘        →  { nodes, edges }  →  layoutGraph  →  <ReactFlow>
```

### `pairs.ts` — `analyzePairs(builtGraph): PairIndex`

Pure; memoized on the built graph. Groups edges by `crossGuid`, applies the Pair
rules above, and returns:

```ts
interface Pair {
  crossGuid: string;
  proxyNodeId: number;
  outerSourceId: number;   // graph source of the merged edge (outerIn)
  outerTargetId: number;   // graph target of the merged edge (outerOut)
  linkIn: LinkDto;         // the link whose target is the proxy
  linkOut: LinkDto;        // the link whose source is the proxy
}

interface PairIndex {
  pairs: Map<string, Pair>;          // keyed by crossGuid, valid pairs only
  hideableNodes: Set<number>;        // pure-proxy node ids
  nodePairs: Map<number, string[]>;  // nodeId → guids it proxies (for "hide node")
}
```

`hideableNodes`: a node id is included iff it is the `proxyNodeId` of ≥1 pair
**and** every edge incident to it is `linkIn`/`linkOut` of some pair it proxies
(no other links touch it).

### `collapse.ts` — `collapseGraph(builtGraph, pairIndex, expandedGuids): { nodes, edges }`

Pure. Produces the nodes/edges actually handed to layout + React Flow:

- For each pair **merged** (guid ∉ `expandedGuids`): omit its two real edges; add
  one synthetic edge:
  - `id = "merged:" + crossGuid`
  - `source = String(outerSourceId)`, `target = String(outerTargetId)`
  - `label = "<proto> (proxy)"` where `<proto>` is the single protocol if
    `linkIn.protocol === linkOut.protocol`, else `"<linkIn>/<linkOut>"`.
  - `markerEnd` arrow at the target end.
  - `data.merged = { crossGuid, proxyNodeId, linkIn, linkOut }`; also carry
    `crossGuid` (so hover-highlight keeps working) and `roundTrip: false`.
- For each pair **split** (guid ∈ `expandedGuids`): keep both real edges as
  `buildGraph` produced them.
- Non-pair edges: passed through unchanged.
- Nodes: drop every `hideableNode` all of whose pairs are merged; keep the rest.

Layout re-runs on the collapsed graph, so positions re-flow when a proxy is
toggled. That is acceptable for an occasional action and keeps layouts tight
(no gaps where hidden proxies were). Animated position transitions are out of
scope.

### State & wiring — `LoadedFlowGraphPage`

- Add `const [expandedGuids, setExpandedGuids] = useState<Set<string>>(new Set())`
  next to `selection`; reset to `new Set()` in the existing
  `useEffect(..., [flowId, env])`.
- `const pairIndex = useMemo(() => analyzePairs(graph), [graph])`.
- `const collapsed = useMemo(() => collapseGraph(graph, pairIndex, expandedGuids), [graph, pairIndex, expandedGuids])`.
- Handlers: `showNode(guid)` → add; `hideNode(nodeId)` → delete `nodePairs`;
  `expandAll()` → set of all `pairs` keys; `collapseAll()` → empty set.
- Pass `collapsed` to the canvas, the handlers + `pairIndex` + `expandedGuids`
  to the header and details panel. The original `graph` (with `nodeById` /
  `linkById`) still feeds the details panel for lookups.

## UI changes

### `types.ts`

- Extend `Selection` with a merged-link case:
  `{ kind: "mergedLink"; crossGuid: string }`.
- Add to `FlowGraphEdgeData`:
  `merged?: { crossGuid: string; proxyNodeId: number; linkIn: LinkDto; linkOut: LinkDto }`.

### `flow-graph-header.tsx`

- Add a global control (e.g. a two-state toggle / segmented control) for
  **Collapse all** ↔ **Expand all**, invoking `collapseAll` / `expandAll`. Its
  active state reflects whether `expandedGuids` is empty vs. holds all pair guids
  (mixed = neither fully active).

### `flow-graph-canvas.tsx`

- Render the collapsed `nodes` / `edges` (topology already derived upstream).
- `onEdgeClick`: if `edge.id` starts with `"merged:"`, call
  `onSelect({ kind: "mergedLink", crossGuid: edge.data.merged.crossGuid })`;
  otherwise the existing `{ kind: "link", id }`.
- Hover-highlight logic is unchanged and remains complementary: a merged edge
  carries the pair's `crossGuid` (highlights itself); a split pair's two halves
  each carry it (hovering one highlights both).

### `data-flow-edge.tsx`

- When `data.merged` is set: **dashed stroke** plus a small **proxy badge/icon**
  near the label, so a collapsed link reads as an abstraction. The `"(proxy)"`
  text is already part of the label from `collapse.ts`. Non-merged edges render
  exactly as today. Highlight (amber) styling still applies on top.

### `details-panel.tsx`

- **Merged-link view** (`selection.kind === "mergedLink"`): resolve the `Pair`
  from `pairIndex.pairs.get(crossGuid)`. Render:
  - A **"Show node"** button at the top → `showNode(crossGuid)`.
  - Details of **both** original links (`linkIn`, `linkOut`) — id, protocol,
    direction, cross GUID — in two labelled sections.
  - A **collapsed-by-default "Proxy node"** `Collapsible` block showing the
    hidden proxy node's fields (reusing the existing node field rows).
- **Node view**: when `selection.kind === "node"` and the node id is in
  `pairIndex.hideableNodes`, render a **"Hide node"** button at the top →
  `hideNode(nodeId)`. (It only appears when the node is a pure proxy, which is
  also exactly when such a node is on-canvas.) Otherwise the node view is
  unchanged.

## Mocks & tests

### Mocks (`src/mocks/data/links.ts`, `nodes.ts`)

Flow 99 PROD already has one valid pair — links **101** (node 1 → node 2) and
**102** (node 2 → node 3), both `CODIRECTIONAL`, sharing
`cccccccc-…cc`, proxy = node 2. Node 2's only links are 101/102, so it is
already a pure proxy.

Add a **second** pair through node 2 to reproduce the design example (two pairs
sharing one egress-style proxy): two new links `node 4 → node 2` and
`node 2 → node 3` sharing a **new** shared `crossGuid`, forming a valid chain
`4 → 2 → 3`. Node 2 then proxies two pairs and stays a pure proxy. Default view:
node 2 hidden, **two** `(proxy)` edges into the topic (1→3 and 4→3); "show node"
on one leaves the other merged. Keep all existing singleton fixtures' guids
unique so they never merge.

### Unit tests

- **`pairs.test.ts`**: valid pair detected (correct proxy, outer endpoints,
  linkIn/linkOut); singleton not a pair; "two-incoming" group rejected; 3-link
  group rejected; self-loop group rejected; `hideableNodes` includes a pure
  proxy and excludes a node that also has a non-pair link.
- **`collapse.test.ts`**: default (empty set) hides the proxy and emits one
  merged edge per pair; adding one guid splits that pair (proxy node present,
  its two real edges present) while a sibling pair stays merged; all guids →
  node set and edge set equal the original built graph; hiding re-merges.
- **`details-panel` render test**: merged selection renders "Show node", both
  link sections, and a "Proxy node" block; a pure-proxy node selection renders
  "Hide node".
- Update existing `build-graph.test.ts`, `layout.test.ts`, `highlight.test.ts`
  fixtures for the two new links (they must keep passing).

### Manual verification (real backend)

Run the Spring Boot backend locally and the frontend against it — **not** the
mock API:

- Create/point `.env.development.local` with `VITE_MOCK_API=false`; start the
  backend (see `backend-run-setup` memory), then `npm run dev -- --host`.
- Open a flow graph that contains a proxy node (a `crossGuid` pair) and confirm:
  default view hides the proxy and shows the merged `(proxy)` link(s); the
  header collapse/expand-all toggle works; "Show node" on a merged link reveals
  the proxy and splits only that pair; "Hide node" on the proxy re-merges and
  hides it; the merged link's details show both links + the collapsed proxy
  block; hover-highlight still works on split halves. Zero console errors.

## Out of scope (YAGNI)

No persistence of expand/collapse state across reloads; no animated position
transitions on toggle; no support for 3+ link `crossGuid` groups (data
guarantees ≤ 2 — larger groups safely render un-merged); no backend changes.

## Verification checklist

- `npx tsc -b` type-checks clean (new required `data.merged` is optional; new
  Selection case handled everywhere `Selection` is switched on).
- `npm run test` — new + updated unit tests pass.
- Manual against the real backend as above.
