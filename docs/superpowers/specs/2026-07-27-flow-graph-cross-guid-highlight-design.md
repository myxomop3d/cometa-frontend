# Flow Graph — Highlight linked (cross_guid) links on hover

**Date:** 2026-07-27
**Status:** Approved (design)
**Scope:** Backend (Cometa Java/Spring Boot) + Frontend (cometa-frontend React)

## Problem

In a flow graph, some nodes (e.g. **egress** nodes) act as proxies. A proxy can
have several incoming links and several outgoing links. Visually it is
impossible to tell which outgoing link continues which incoming link.

The database `gmsb.link` table already carries a **`cross_guid`** column
(`uuid`, `NOT NULL`) that ties together the links forming one continuation path
through a proxy node. Two links that are a continuation of one another share the
same `cross_guid`.

**Goal:** when the user hovers a link in the flow graph, highlight that link and
its counterpart(s) — the links that share its `cross_guid`.

## Confirmed data model (verified against the live dev DB)

- `gmsb.link.cross_guid` is `uuid`, `NOT NULL` — **every** link has one.
- Group sizes in current data: **1** (1,607 links, standalone) or **2** (833
  groups). A group of 2 is exactly *one link into a proxy node + one link out of
  it*, e.g. guid `00261375-…` = link `246673 → 247082` + link `247082 → 245144`,
  where node `247082` is the shared proxy.
- A singleton link has its own unique guid (a group of 1) and therefore no
  counterpart.
- Both links of a group always share the same `flow_id`, so within a single
  rendered flow graph the counterpart is always present.

**Highlight rule (final):** on hover of a link, highlight every edge whose
`crossGuid` equals the hovered edge's `crossGuid`. Simple group-by-equality.
Handles groups of any size even though today's maximum is 2. A singleton simply
highlights itself.

## Design decisions

- **Visual treatment:** *emphasize only, no dimming.* Accent-color and thicken
  the hovered link and its counterpart(s); leave all other edges and nodes
  untouched. (Chosen over the "spotlight/dim the rest" alternative.)
- **Accent:** a distinct accent (amber) plus a thicker stroke, so the hover
  highlight reads differently from the existing click-`selected` state
  (ring/primary). Hover highlight and selection are independent and may coexist.
- **Interaction:** hover only. Transient — clears on mouse leave. No click-to-pin.
- **Details panel:** show the link's `crossGuid` as a read-only field row.

## Part 1 — Backend: transmit `crossGuid`

Links are loaded as full `Link` JPA entities via `LinkRepository`
(`getAllByFlowIdAndClientNodeEnvironmentAndServerNodeEnvironment`), **not** via
OData, so all columns are already selected. No query/repository changes.

1. **`Link.java`** (`cometa-persistence-module/.../entity/Link.java`)
   add `@Column(name = "cross_guid") private UUID crossGuid;`
2. **`LinkDto.java`** (`cometa-service-module/.../service/dto/LinkDto.java`)
   add `private UUID crossGuid;`. Jackson serializes a `UUID` as a plain JSON
   string. Keeping both sides `UUID` means MapStruct auto-maps the same-named
   field — **no `LinkMapper` change**.
3. **`LinkMapperImpl`** regenerates on next compile; nothing to hand-edit.

Outcome: each link in the `/api/v1/flow-graph/{flowId}` JSON gains
`"crossGuid": "<uuid>"`. The field flows through the separate OData link CRUD
stack too, at no extra cost.

## Part 2 — Frontend: data plumbing

- **`types/api.ts`** — add `crossGuid: string;` to `LinkDto`.
- **`features/flow-graph/types.ts`** — add `crossGuid: string;` to
  `FlowGraphEdgeData`.
- **`features/flow-graph/build-graph.ts`** — set `crossGuid: l.crossGuid` on each
  edge's `data` (alongside `link`, `direction`, `roundTrip`) for O(1) access
  during hover.

## Part 3 — Frontend: hover interaction & styling

- **`FlowGraphCanvas`** (`components/flow-graph-canvas.tsx`)
  - Add `hoveredCrossGuid` state.
  - Wire React Flow `onEdgeMouseEnter` (set to `edge.data.crossGuid`) and
    `onEdgeMouseLeave` (clear to `null`).
  - Where `selected` is computed in the render-time `edges.map(...)`, also set
    `data.highlighted = hoveredCrossGuid != null && e.data.crossGuid === hoveredCrossGuid`.
- **`DataFlowEdge`** (`components/data-flow-edge.tsx`)
  - Read `data.highlighted`; when true, render an accent (amber) stroke with a
    thicker width and brighten the running-dot. Otherwise unchanged.
- **Pure helper** `isHighlighted(edgeCrossGuid, hoveredCrossGuid)` keeps the rule
  unit-testable.

## Part 4 — Frontend: details panel

- **`DetailsPanel`** (`components/details-panel.tsx`) — add a
  `FieldRow label="Cross GUID"` to the `LinkDetails` "Link" section, rendering
  `link.crossGuid`.

## Part 5 — Mocks & tests

- **`mocks/data/links.ts`** — add `crossGuid` to every fixture (now required).
  Wire at least one through-a-proxy pair (an incoming + an outgoing link at a
  shared node within one flow) to share a guid so the highlight is demoable under
  `VITE_MOCK_API=true`; give the rest unique guids.
- **`build-graph.test.ts`** — add `crossGuid` to the test `LinkDto` fixture (now
  required) and assert it lands on `edge.data.crossGuid`.
- New unit test for the `isHighlighted` predicate (equal guid → true; different
  guid → false; null hover → false).

## Out of scope (YAGNI)

No click-to-pin, no dimming of other edges/nodes, no proxy-node ring, no
cross-flow highlighting (counterparts are always same-flow).

## Verification

- `npm run build` / `tsc -b` type-checks (LinkDto gains a required field —
  fixtures and tests must be updated in the same change).
- `npm run test` for the new/updated unit tests.
- Manual: `VITE_MOCK_API=true npm run dev -- --host`, open the flow graph, hover
  the shared-guid pair, confirm both links emphasize and others do not; confirm
  the Cross GUID row appears in the details panel.
- Against real API: verify the flow-graph response now includes `crossGuid`.
