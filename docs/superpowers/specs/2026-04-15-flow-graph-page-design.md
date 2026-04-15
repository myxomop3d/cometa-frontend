# Flow Graph Page — Design

**Date:** 2026-04-15
**Route:** `/flow-graph`
**Status:** Draft for implementation

## Goal

A page that visualizes a selected `Flow` as an interactive node-based graph.
Users can pick a flow from a server-filtered combobox, inspect nodes, interfaces,
and links, and see the details of any selected element in a side panel.
The panel structure should anticipate future editing and node-creation features.

## Page Layout

Nested shadcn `Resizable` composition:

- Vertical `ResizablePanelGroup` — two rows:
  - **Header row** (top)
  - **Body row** (bottom), containing a horizontal `ResizablePanelGroup`:
    - **Graph panel** — default 70%, min size prevents collapse
    - **Details panel** — default 30%, min size prevents collapse

All panels have `minSize` constraints so neither graph nor details can be fully
collapsed.

## Header

Left side — read-only summary of the currently loaded flow:

- `caption`, `code`, `integrity`, `confidentiality`, `dataClass`, `dataType`,
  `state`

Right side — flow combobox (see below).

## Flow Combobox

Visual reference: `src/components/filters/RelationFilterDropdown.tsx`
(single-select variant).

- Server-filtered by `caption` using
  `flowApi.listQueryOptions({ caption, page: 1, pageSize: 10 })`.
- Search input inside the popover; debounced local search string (no route
  state).
- Selecting a flow updates the route search param `flowId`, which drives the
  flow-graph query.

## Graph (Left Panel)

React Flow (`@xyflow/react`) canvas.

### Nodes

- One custom node per `NodeDto`.
- Distinct visual styling per `dtoType` (`microservice`, `topic`, `egress`).
- Component: `custom-node.tsx`.

### Handles (Interfaces)

- Each `InterfaceFlatDto` on a node → one `Handle` with `id = interface.id`.
- Side assignment derived from `LinkDto` relationships over the whole graph:
  - Interface appears as `clientInterface` on any link → **right / source**.
  - Interface appears as `serverInterface` on any link → **left / target**.
  - Orphan interfaces (no link) → stacked on a default side (right) without a
    functional role.
- Distinct handle styles per interface `dtoType` (color/shape). Built on top of
  React Flow custom handle styling
  (https://reactflow.dev/learn/customization/handles#custom-handle-styles).
- Component: `custom-handle.tsx`, consumed by `custom-node.tsx`.

### Edges

- One edge per `LinkDto`. Connects source handle (client interface id) → target
  handle (server interface id).

### Layout

- `@dagrejs/dagre` LR layered layout computed once after data load. Node sizes
  estimated from interface counts so handles do not overlap.
- Layout lives in `layout.ts`, independent of React.

## Details Panel (Right Panel)

Driven by a local `selected` state of shape
`{ kind: 'node' | 'interface' | 'link', id: number } | null`.

Selection sources:

- Node click → `{ kind: 'node', id }`.
- Handle click → `{ kind: 'interface', id }`.
- Edge click → `{ kind: 'link', id }`.

Rendered content switches on `kind`:

- **Node** — all common `NodeDto` fields plus `dtoType`-specific fields
  (`artifact`, `artifactVersion`, `partitions`, `replicationFactor`,
  `realHosts`, …). `descriptionMd` rendered as preformatted markdown text.
- **Interface** — all common `InterfaceFlatDto` fields plus `dtoType`-specific
  fields (`endpoint`, `httpMethod`, `partitionKey`, `consumerGroup`, …).
  `descriptionMd`, `errorsMd`, `xsdSchema` rendered as preformatted text.
- **Link** — client/server interface names, `dataFlowDirection`, `flowId`.

Empty state when `selected === null`: short instructional text.

### FieldRow abstraction

A `FieldRow` component renders a label/value pair in a simple grouped list
(`<dl>`-style). For v1 it is read-only. Future edit/create flows will swap the
value side for a form input without restructuring the panel.

### Markdown

No MD renderer dependency for v1. `MarkdownBlock` wraps raw text in `<pre>` with
preserved whitespace and word-wrap.

## Data Layer

### Route

`src/routes/flow-graph/index.tsx`:

- Search schema: `{ flowId: number }`, default `99`.
- `loader` prefetches `flowGraphQueryOptions(flowId)` using the route context
  `queryClient`.
- Page component uses `useSuspenseQuery(flowGraphQueryOptions(flowId))`.

### Query

`src/features/flow-graph/api.ts`:

```ts
flowGraphQueryOptions(flowId: number) =>
  queryOptions({
    queryKey: ["flow-graph", flowId],
    queryFn: () => apiFetch<ApiResponse<FlowGraphDto>>(`/api/v1/flow-graph/${flowId}`),
  });
```

### Mock Handler

`src/mocks/handlers/flow-graph.ts` — change from
`POST /api/v1/flow-graph/create/:flowId` to `GET /api/v1/flow-graph/:flowId`.
Keep the existing graph-assembly logic (collect nodes touched by the flow's
links, attach interfaces, return `FlowGraphDto`).

## File Structure

```
src/features/flow-graph/
  api.ts                       # flowGraphQueryOptions
  types.ts                     # GraphNode, GraphEdge, Selection, FieldRow types
  build-graph.ts               # FlowGraphDto -> rf nodes/edges + handle side assignment
  layout.ts                    # dagre LR layout
  components/
    flow-graph-page.tsx        # nested resizable composition + selection state
    flow-graph-header.tsx      # flow fields + combobox
    flow-combobox.tsx          # RelationFilterDropdown-styled, server-filtered
    flow-graph-canvas.tsx      # React Flow provider + canvas + selection wiring
    custom-node.tsx            # dtoType-styled node
    custom-handle.tsx          # dtoType-styled handle
    details-panel.tsx          # switch on selection.kind
    field-row.tsx              # read-only v1, swappable for inputs later
    markdown-block.tsx         # <pre>-wrapped MD text

src/routes/flow-graph/
  index.tsx                    # route: search schema, loader, renders FlowGraphPage

src/mocks/handlers/flow-graph.ts   # switch to GET /api/v1/flow-graph/:flowId
```

## Dependencies

- Add `@dagrejs/dagre`.
- `npx shadcn@latest add resizable`.
- `@xyflow/react` already installed.

## Out of Scope (future work)

- Editing fields of the selected item.
- Creating new nodes/interfaces/links on the graph and saving.
- Node drag-to-reposition persistence.
- Markdown rendering with a proper renderer (currently preformatted text).
- `FieldRow` and `build-graph.ts` are factored to support these without
  restructuring.

## Non-Goals

- No multi-flow overlay — one flow visible at a time.
- No graph export / screenshot functionality.
- No selection persistence across page reloads.
