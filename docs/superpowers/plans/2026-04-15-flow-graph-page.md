# Flow Graph Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/flow-graph` page that visualizes the selected `Flow` as an interactive React Flow graph with a server-filtered flow picker and a details panel for the selected node/interface/link.

**Architecture:** Feature folder at `src/features/flow-graph/` exposes `flowGraphQueryOptions`, pure graph-building and dagre layout modules, and a tree of UI components composed by a nested shadcn `Resizable` layout. The route file is thin: defines the `flowId` search param, preloads the query, renders `FlowGraphPage`.

**Tech Stack:** React 19, TanStack Router/Query, `@xyflow/react`, `@dagrejs/dagre`, shadcn `resizable`, Tailwind v4, MSW for mock API.

**Spec:** `docs/superpowers/specs/2026-04-15-flow-graph-page-design.md`.

---

## File Map

Created:
- `src/features/flow-graph/api.ts`
- `src/features/flow-graph/types.ts`
- `src/features/flow-graph/build-graph.ts`
- `src/features/flow-graph/build-graph.test.ts`
- `src/features/flow-graph/layout.ts`
- `src/features/flow-graph/layout.test.ts`
- `src/features/flow-graph/components/flow-graph-page.tsx`
- `src/features/flow-graph/components/flow-graph-header.tsx`
- `src/features/flow-graph/components/flow-combobox.tsx`
- `src/features/flow-graph/components/flow-graph-canvas.tsx`
- `src/features/flow-graph/components/custom-node.tsx`
- `src/features/flow-graph/components/custom-handle.tsx`
- `src/features/flow-graph/components/details-panel.tsx`
- `src/features/flow-graph/components/field-row.tsx`
- `src/features/flow-graph/components/markdown-block.tsx`
- `src/components/ui/resizable.tsx` (via shadcn CLI)

Modified:
- `src/routes/flow-graph/index.tsx` (search schema, loader, render page)
- `src/mocks/handlers/flow-graph.ts` (POST/create/:flowId → GET /:flowId)
- `package.json` (add `@dagrejs/dagre`, `react-resizable-panels`)

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`
- Create: `src/components/ui/resizable.tsx`

- [ ] **Step 1: Install dagre**

Run: `npm install @dagrejs/dagre`
Expected: adds `@dagrejs/dagre` to `dependencies` and installs cleanly.

- [ ] **Step 2: Add shadcn resizable**

Run: `npx shadcn@latest add resizable`
Expected: installs `react-resizable-panels` and creates `src/components/ui/resizable.tsx` exporting `ResizablePanel`, `ResizablePanelGroup`, `ResizableHandle`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/resizable.tsx
git commit -m "chore: add dagre and shadcn resizable for flow-graph page"
```

---

## Task 2: Switch mock handler to GET

**Files:**
- Modify: `src/mocks/handlers/flow-graph.ts`

- [ ] **Step 1: Replace the handler**

Replace the file contents with:

```ts
import { http } from "msw";
import { nodes } from "../data/nodes";
import { links } from "../data/links";
import { flows } from "../data/flows";
import { interfaces } from "../data/interfaces";
import { apiResponse } from "../lib/response";
import type { FlowGraphDto } from "@/types/api";

export const flowGraphHandlers = [
  http.get("/api/v1/flow-graph/:flowId", ({ params }) => {
    const flowId = Number(params.flowId);
    const flow = flows.find((f) => f.id === flowId);
    if (!flow) return new Response(null, { status: 404 });

    const flowLinks = links.filter((l) => l.flowId === flowId);

    const nodeIds = new Set<number>();
    for (const link of flowLinks) {
      const clientIface = interfaces.find((i) => i.id === link.clientInterface.id);
      const serverIface = interfaces.find((i) => i.id === link.serverInterface.id);
      if (clientIface) nodeIds.add(clientIface.nodeId!);
      if (serverIface) nodeIds.add(serverIface.nodeId!);
    }

    const flowNodes = nodes
      .filter((n) => nodeIds.has(n.id))
      .map((n) => ({
        ...n,
        interfaces: interfaces.filter((i) => i.nodeId === n.id),
      }));

    const graph: FlowGraphDto = {
      flow,
      nodes: flowNodes,
      links: flowLinks,
    };

    return apiResponse(graph);
  }),
];
```

- [ ] **Step 2: Commit**

```bash
git add src/mocks/handlers/flow-graph.ts
git commit -m "feat(mocks): expose GET /api/v1/flow-graph/:flowId"
```

---

## Task 3: Feature types

**Files:**
- Create: `src/features/flow-graph/types.ts`

- [ ] **Step 1: Write the file**

```ts
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { NodeDto, InterfaceFlatDto, LinkDto } from "@/types/api";

export type Selection =
  | { kind: "node"; id: number }
  | { kind: "interface"; id: number }
  | { kind: "link"; id: number }
  | null;

export type HandleSide = "left" | "right";

export interface HandleDescriptor {
  interfaceId: number;
  dtoType: string;
  side: HandleSide;
  label: string;
}

export interface FlowGraphNodeData extends Record<string, unknown> {
  node: NodeDto;
  handles: HandleDescriptor[];
}

export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
}

export type FlowGraphNode = RFNode<FlowGraphNodeData>;
export type FlowGraphEdge = RFEdge<FlowGraphEdgeData>;

export interface BuiltGraph {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  /** lookup helpers for the details panel */
  nodeById: Map<number, NodeDto>;
  interfaceById: Map<number, InterfaceFlatDto>;
  linkById: Map<number, LinkDto>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/flow-graph/types.ts
git commit -m "feat(flow-graph): add feature-level types"
```

---

## Task 4: build-graph — tests first

**Files:**
- Create: `src/features/flow-graph/build-graph.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import type { FlowGraphDto, NodeDto, InterfaceFlatDto, LinkDto, FlowDto } from "@/types/api";
import { buildGraph } from "./build-graph";

const flow: FlowDto = {
  id: 1, code: "f", caption: "F",
  integrity: null, confidentiality: null,
  dataClass: "", dataType: "", state: "", descriptionMd: null,
};

const iClient: InterfaceFlatDto = {
  id: 10, dtoType: "restClient", name: "c", protocol: "http",
  segment: "s", localWhiteListHeaders: null, descriptionMd: null,
  nodeId: 1, linksInIds: null, linksOutIds: [100],
};
const iServer: InterfaceFlatDto = {
  id: 20, dtoType: "restServer", name: "s", protocol: "http",
  segment: "s", localWhiteListHeaders: null, descriptionMd: null,
  nodeId: 2, linksInIds: [100], linksOutIds: null,
};
const nodeA: NodeDto = { id: 1, dtoType: "microservice", name: "A", descriptionMd: null, interfaces: [iClient] };
const nodeB: NodeDto = { id: 2, dtoType: "microservice", name: "B", descriptionMd: null, interfaces: [iServer] };
const link: LinkDto = { id: 100, flowId: 1, clientInterface: iClient, serverInterface: iServer, dataFlowDirection: "ltr" };

const dto: FlowGraphDto = { flow, nodes: [nodeA, nodeB], links: [link] };

describe("buildGraph", () => {
  it("creates one RF node per NodeDto with string id", () => {
    const g = buildGraph(dto);
    expect(g.nodes).toHaveLength(2);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
    expect(g.nodes[0].type).toBe("flowGraphNode");
  });

  it("assigns client interfaces to the right side, server to the left", () => {
    const g = buildGraph(dto);
    const a = g.nodes.find((n) => n.id === "1")!;
    const b = g.nodes.find((n) => n.id === "2")!;
    expect(a.data.handles).toEqual([
      { interfaceId: 10, dtoType: "restClient", side: "right", label: "c" },
    ]);
    expect(b.data.handles).toEqual([
      { interfaceId: 20, dtoType: "restServer", side: "left", label: "s" },
    ]);
  });

  it("creates one RF edge per LinkDto wired to handle ids", () => {
    const g = buildGraph(dto);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({
      id: "100",
      source: "1",
      target: "2",
      sourceHandle: "10",
      targetHandle: "20",
    });
  });

  it("exposes lookup maps for details panel", () => {
    const g = buildGraph(dto);
    expect(g.nodeById.get(1)).toBe(nodeA);
    expect(g.interfaceById.get(10)).toBe(iClient);
    expect(g.linkById.get(100)).toBe(link);
  });

  it("defaults orphan interfaces to the right side", () => {
    const orphan: InterfaceFlatDto = { ...iClient, id: 30, linksOutIds: null };
    const dtoWithOrphan: FlowGraphDto = {
      flow,
      nodes: [{ ...nodeA, interfaces: [iClient, orphan] }, nodeB],
      links: [link],
    };
    const g = buildGraph(dtoWithOrphan);
    const handles = g.nodes.find((n) => n.id === "1")!.data.handles;
    expect(handles.find((h) => h.interfaceId === 30)?.side).toBe("right");
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/features/flow-graph/build-graph.test.ts`
Expected: cannot resolve `./build-graph`.

---

## Task 5: build-graph — implementation

**Files:**
- Create: `src/features/flow-graph/build-graph.ts`

- [ ] **Step 1: Implement**

```ts
import type { FlowGraphDto, NodeDto, InterfaceFlatDto, LinkDto } from "@/types/api";
import type { BuiltGraph, FlowGraphNode, FlowGraphEdge, HandleDescriptor, HandleSide } from "./types";

function classifyInterfaces(links: LinkDto[]): Map<number, HandleSide> {
  const sides = new Map<number, HandleSide>();
  for (const link of links) {
    sides.set(link.clientInterface.id, "right");
    sides.set(link.serverInterface.id, "left");
  }
  return sides;
}

function nodeHandles(node: NodeDto, sides: Map<number, HandleSide>): HandleDescriptor[] {
  const list = node.interfaces ?? [];
  return list.map((iface) => ({
    interfaceId: iface.id,
    dtoType: iface.dtoType,
    side: sides.get(iface.id) ?? "right",
    label: iface.name,
  }));
}

export function buildGraph(dto: FlowGraphDto): BuiltGraph {
  const sides = classifyInterfaces(dto.links);

  const rfNodes: FlowGraphNode[] = dto.nodes.map((n) => ({
    id: String(n.id),
    type: "flowGraphNode",
    position: { x: 0, y: 0 },
    data: { node: n, handles: nodeHandles(n, sides) },
  }));

  const rfEdges: FlowGraphEdge[] = dto.links.map((l) => ({
    id: String(l.id),
    source: String(findNodeIdForInterface(dto.nodes, l.clientInterface.id)),
    target: String(findNodeIdForInterface(dto.nodes, l.serverInterface.id)),
    sourceHandle: String(l.clientInterface.id),
    targetHandle: String(l.serverInterface.id),
    data: { link: l },
  }));

  const nodeById = new Map<number, NodeDto>(dto.nodes.map((n) => [n.id, n]));
  const interfaceById = new Map<number, InterfaceFlatDto>();
  for (const n of dto.nodes) for (const i of n.interfaces ?? []) interfaceById.set(i.id, i);
  const linkById = new Map<number, LinkDto>(dto.links.map((l) => [l.id, l]));

  return { nodes: rfNodes, edges: rfEdges, nodeById, interfaceById, linkById };
}

function findNodeIdForInterface(nodes: NodeDto[], interfaceId: number): number {
  for (const n of nodes) {
    if ((n.interfaces ?? []).some((i) => i.id === interfaceId)) return n.id;
  }
  return -1;
}
```

- [ ] **Step 2: Run — expect pass**

Run: `npx vitest run src/features/flow-graph/build-graph.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/build-graph.ts src/features/flow-graph/build-graph.test.ts
git commit -m "feat(flow-graph): build RF nodes/edges and handle side assignment"
```

---

## Task 6: Dagre layout — tests first

**Files:**
- Create: `src/features/flow-graph/layout.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { layoutGraph } from "./layout";
import type { FlowGraphNode, FlowGraphEdge } from "./types";

const mkNode = (id: string): FlowGraphNode => ({
  id, type: "flowGraphNode", position: { x: 0, y: 0 },
  data: { node: { id: Number(id), dtoType: "microservice", name: id, descriptionMd: null, interfaces: [] }, handles: [] },
});

describe("layoutGraph", () => {
  it("assigns non-zero positions to connected nodes (LR)", () => {
    const nodes: FlowGraphNode[] = [mkNode("1"), mkNode("2")];
    const edges: FlowGraphEdge[] = [
      { id: "e1", source: "1", target: "2", data: { link: {} as never } },
    ];
    const out = layoutGraph(nodes, edges);
    const a = out.find((n) => n.id === "1")!;
    const b = out.find((n) => n.id === "2")!;
    expect(b.position.x).toBeGreaterThan(a.position.x);
  });

  it("still returns a position for disconnected nodes", () => {
    const nodes: FlowGraphNode[] = [mkNode("1")];
    const out = layoutGraph(nodes, []);
    expect(out[0].position.x).toBeGreaterThanOrEqual(0);
    expect(out[0].position.y).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/features/flow-graph/layout.test.ts`
Expected: module not found.

---

## Task 7: Dagre layout — implementation

**Files:**
- Create: `src/features/flow-graph/layout.ts`

- [ ] **Step 1: Implement**

```ts
import dagre from "@dagrejs/dagre";
import type { FlowGraphNode, FlowGraphEdge } from "./types";

const NODE_WIDTH = 220;
const HANDLE_ROW_HEIGHT = 22;
const NODE_MIN_HEIGHT = 80;

function estimateHeight(node: FlowGraphNode): number {
  const handles = node.data.handles.length;
  return Math.max(NODE_MIN_HEIGHT, 40 + handles * HANDLE_ROW_HEIGHT);
}

export function layoutGraph(
  nodes: FlowGraphNode[],
  edges: FlowGraphEdge[],
): FlowGraphNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: estimateHeight(n) });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const height = estimateHeight(n);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - height / 2 },
    };
  });
}
```

- [ ] **Step 2: Run — expect pass**

Run: `npx vitest run src/features/flow-graph/layout.test.ts`
Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/layout.ts src/features/flow-graph/layout.test.ts
git commit -m "feat(flow-graph): add dagre LR layout"
```

---

## Task 8: Feature API

**Files:**
- Create: `src/features/flow-graph/api.ts`

- [ ] **Step 1: Implement**

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/create-crud-api";
import type { ApiResponse, FlowGraphDto } from "@/types/api";

export function flowGraphQueryOptions(flowId: number) {
  return queryOptions({
    queryKey: ["flow-graph", flowId] as const,
    queryFn: () =>
      apiFetch<ApiResponse<FlowGraphDto>>(`/api/v1/flow-graph/${flowId}`),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/api.ts
git commit -m "feat(flow-graph): add flowGraphQueryOptions"
```

---

## Task 9: MarkdownBlock + FieldRow

**Files:**
- Create: `src/features/flow-graph/components/markdown-block.tsx`
- Create: `src/features/flow-graph/components/field-row.tsx`

- [ ] **Step 1: Write markdown-block.tsx**

```tsx
interface MarkdownBlockProps {
  value: string | null | undefined;
}

export function MarkdownBlock({ value }: MarkdownBlockProps) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-xs font-mono">
      {value}
    </pre>
  );
}
```

- [ ] **Step 2: Write field-row.tsx**

```tsx
import type { ReactNode } from "react";

interface FieldRowProps {
  label: string;
  children: ReactNode;
}

export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/components/markdown-block.tsx src/features/flow-graph/components/field-row.tsx
git commit -m "feat(flow-graph): add FieldRow and MarkdownBlock primitives"
```

---

## Task 10: CustomHandle

**Files:**
- Create: `src/features/flow-graph/components/custom-handle.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Handle, Position, type HandleType } from "@xyflow/react";
import type { HandleDescriptor } from "../types";

const DTO_COLORS: Record<string, string> = {
  restClient: "#3b82f6",
  restServer: "#10b981",
  kafkaClient: "#f59e0b",
};

interface CustomHandleProps {
  descriptor: HandleDescriptor;
  topPercent: number;
}

export function CustomHandle({ descriptor, topPercent }: CustomHandleProps) {
  const isRight = descriptor.side === "right";
  const position = isRight ? Position.Right : Position.Left;
  const type: HandleType = isRight ? "source" : "target";
  const color = DTO_COLORS[descriptor.dtoType] ?? "#6b7280";

  return (
    <Handle
      id={String(descriptor.interfaceId)}
      type={type}
      position={position}
      style={{
        top: `${topPercent}%`,
        background: color,
        width: 10,
        height: 10,
        border: "2px solid white",
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/flow-graph/components/custom-handle.tsx
git commit -m "feat(flow-graph): add CustomHandle with dtoType-based styling"
```

---

## Task 11: CustomNode

**Files:**
- Create: `src/features/flow-graph/components/custom-node.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { CustomHandle } from "./custom-handle";
import type { FlowGraphNode } from "../types";

const NODE_TONE: Record<string, string> = {
  microservice: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
  topic: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
  egress: "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30",
};

function FlowGraphNodeView({ data, selected }: NodeProps<FlowGraphNode>) {
  const { node, handles } = data;
  const tone = NODE_TONE[node.dtoType] ?? "border-slate-400 bg-slate-50 dark:bg-slate-900/30";

  const leftHandles = handles.filter((h) => h.side === "left");
  const rightHandles = handles.filter((h) => h.side === "right");

  const spread = (count: number, index: number) =>
    count === 0 ? 50 : ((index + 1) / (count + 1)) * 100;

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-md border-2 shadow-sm",
        tone,
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="border-b px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{node.dtoType}</div>
        <div className="text-sm font-semibold">{node.name}</div>
      </div>
      <ul className="px-3 py-2 text-xs">
        {handles.map((h) => (
          <li key={h.interfaceId} className="flex justify-between gap-2 py-0.5">
            <span className="truncate">{h.label}</span>
            <span className="text-muted-foreground">{h.dtoType}</span>
          </li>
        ))}
      </ul>

      {leftHandles.map((h, i) => (
        <CustomHandle key={h.interfaceId} descriptor={h} topPercent={spread(leftHandles.length, i)} />
      ))}
      {rightHandles.map((h, i) => (
        <CustomHandle key={h.interfaceId} descriptor={h} topPercent={spread(rightHandles.length, i)} />
      ))}
    </div>
  );
}

export const CustomNode = memo(FlowGraphNodeView);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/components/custom-node.tsx
git commit -m "feat(flow-graph): add CustomNode with dtoType-based styling"
```

---

## Task 12: DetailsPanel

**Files:**
- Create: `src/features/flow-graph/components/details-panel.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type {
  NodeDto,
  InterfaceFlatDto,
  LinkDto,
  NodeMicroserviceDto,
  NodeTopicDto,
  NodeEgressDto,
  InterfaceKafkaClientFlatDto,
  InterfaceRestClientFlatDto,
  InterfaceRestServerFlatDto,
} from "@/types/api";
import { FieldRow } from "./field-row";
import { MarkdownBlock } from "./markdown-block";
import type { Selection, BuiltGraph } from "../types";

interface DetailsPanelProps {
  selection: Selection;
  graph: BuiltGraph;
}

export function DetailsPanel({ selection, graph }: DetailsPanelProps) {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node, interface, or link to see its details.
      </div>
    );
  }

  if (selection.kind === "node") {
    const node = graph.nodeById.get(selection.id);
    if (!node) return <Missing />;
    return <NodeDetails node={node} />;
  }
  if (selection.kind === "interface") {
    const iface = graph.interfaceById.get(selection.id);
    if (!iface) return <Missing />;
    return <InterfaceDetails iface={iface} />;
  }
  const link = graph.linkById.get(selection.id);
  if (!link) return <Missing />;
  return <LinkDetails link={link} />;
}

function Missing() {
  return <div className="p-4 text-sm text-muted-foreground">Selected item not found.</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

function NodeDetails({ node }: { node: NodeDto }) {
  return (
    <div>
      <Section title={`${node.dtoType} node`}>
        <FieldRow label="ID">{node.id}</FieldRow>
        <FieldRow label="Name">{node.name}</FieldRow>
        <FieldRow label="Type">{node.dtoType}</FieldRow>
      </Section>
      <Section title="Type-specific">{renderNodeTypeFields(node)}</Section>
      <Section title="Description">
        <MarkdownBlock value={node.descriptionMd} />
      </Section>
    </div>
  );
}

function renderNodeTypeFields(node: NodeDto) {
  if (node.dtoType === "microservice") {
    const n = node as NodeMicroserviceDto;
    return (
      <>
        <FieldRow label="Artifact">{n.artifact}</FieldRow>
        <FieldRow label="Artifact version">{n.artifactVersion}</FieldRow>
        <FieldRow label="Image version">{n.imageVersion ?? "—"}</FieldRow>
        <FieldRow label="GMSB gen">{n.gmsbGen ?? "—"}</FieldRow>
        <FieldRow label="Source URL">{n.sourceUrl ?? "—"}</FieldRow>
        <FieldRow label="Config URL">{n.configUrl ?? "—"}</FieldRow>
        <FieldRow label="Pelican URL">{n.pelicanUrl ?? "—"}</FieldRow>
        <FieldRow label="Fault tolerance">{n.faultTolerance ?? "—"}</FieldRow>
        <FieldRow label="Scalability">{n.scalability ?? "—"}</FieldRow>
        <FieldRow label="Load balancing">{n.loadBalancing ?? "—"}</FieldRow>
        <FieldRow label="Resource profile">{n.resourceProfile ?? "—"}</FieldRow>
      </>
    );
  }
  if (node.dtoType === "topic") {
    const n = node as NodeTopicDto;
    return (
      <>
        <FieldRow label="Partitions">{n.partitions}</FieldRow>
        <FieldRow label="Replication">{n.replicationFactor}</FieldRow>
        <FieldRow label="Compression">{n.compressionType}</FieldRow>
        <FieldRow label="Max message bytes">{n.maxMessageBytes}</FieldRow>
        <FieldRow label="Retention bytes">{n.retentionBytes}</FieldRow>
        <FieldRow label="Retention ms">{n.retentionMs}</FieldRow>
      </>
    );
  }
  if (node.dtoType === "egress") {
    const n = node as NodeEgressDto;
    return (
      <>
        <FieldRow label="Real hosts">{n.realHosts}</FieldRow>
        <FieldRow label="Real port">{n.realPort}</FieldRow>
        <FieldRow label="TLS">{n.tls}</FieldRow>
        <FieldRow label="Virtual host">{n.virtualHost}</FieldRow>
      </>
    );
  }
  return <FieldRow label="Info">No type-specific fields.</FieldRow>;
}

function InterfaceDetails({ iface }: { iface: InterfaceFlatDto }) {
  return (
    <div>
      <Section title={`${iface.dtoType} interface`}>
        <FieldRow label="ID">{iface.id}</FieldRow>
        <FieldRow label="Name">{iface.name}</FieldRow>
        <FieldRow label="Type">{iface.dtoType}</FieldRow>
        <FieldRow label="Protocol">{iface.protocol}</FieldRow>
        <FieldRow label="Segment">{iface.segment}</FieldRow>
        <FieldRow label="Node ID">{iface.nodeId ?? "—"}</FieldRow>
      </Section>
      <Section title="Type-specific">{renderInterfaceTypeFields(iface)}</Section>
      <Section title="Whitelist headers">
        <MarkdownBlock value={iface.localWhiteListHeaders} />
      </Section>
      <Section title="Description">
        <MarkdownBlock value={iface.descriptionMd} />
      </Section>
    </div>
  );
}

function renderInterfaceTypeFields(iface: InterfaceFlatDto) {
  if (iface.dtoType === "kafkaClient") {
    const i = iface as InterfaceKafkaClientFlatDto;
    return (
      <>
        <FieldRow label="Partition key">{i.partitionKey ?? "—"}</FieldRow>
        <FieldRow label="Message format">{i.messageFormat}</FieldRow>
        <FieldRow label="Message encoding">{i.messageEncoding}</FieldRow>
        <FieldRow label="Consumer group">{i.consumerGroup ?? "—"}</FieldRow>
        <FieldRow label="Message headers">
          <MarkdownBlock value={i.messageHeaders} />
        </FieldRow>
      </>
    );
  }
  if (iface.dtoType === "restClient") {
    const i = iface as InterfaceRestClientFlatDto;
    return (
      <>
        <FieldRow label="Endpoint">{i.endpoint}</FieldRow>
        <FieldRow label="HTTP method">{i.httpMethod}</FieldRow>
        <FieldRow label="Request format">{i.requestFormat}</FieldRow>
        <FieldRow label="Response format">{i.responseFormat}</FieldRow>
        <FieldRow label="Socket connect (ms)">{i.socketConnectionTimeout}</FieldRow>
        <FieldRow label="Socket read (ms)">{i.socketReadTimeout}</FieldRow>
        <FieldRow label="Authentication">{i.authentication}</FieldRow>
        <FieldRow label="Encryption">{i.encryption}</FieldRow>
        <FieldRow label="TLS version">{i.tlsVersion}</FieldRow>
        <FieldRow label="XSD">
          <MarkdownBlock value={i.xsdSchema} />
        </FieldRow>
        <FieldRow label="Errors">
          <MarkdownBlock value={i.errorsMd} />
        </FieldRow>
      </>
    );
  }
  if (iface.dtoType === "restServer") {
    const i = iface as InterfaceRestServerFlatDto;
    return (
      <>
        <FieldRow label="Endpoint">{i.endpoint}</FieldRow>
        <FieldRow label="HTTP method">{i.httpMethod}</FieldRow>
        <FieldRow label="Request format">{i.requestFormat}</FieldRow>
        <FieldRow label="Response format">{i.responseFormat}</FieldRow>
        <FieldRow label="Authentication">{i.authentication}</FieldRow>
        <FieldRow label="Encryption">{i.encryption}</FieldRow>
        <FieldRow label="TLS version">{i.tlsVersion}</FieldRow>
        <FieldRow label="Envoy filter">{i.envoyFilter ?? "—"}</FieldRow>
        <FieldRow label="Server hosts">
          <MarkdownBlock value={i.serverHostsMd} />
        </FieldRow>
        <FieldRow label="XSD">
          <MarkdownBlock value={i.xsdSchema} />
        </FieldRow>
        <FieldRow label="Errors">
          <MarkdownBlock value={i.errorsMd} />
        </FieldRow>
      </>
    );
  }
  return <FieldRow label="Info">No type-specific fields.</FieldRow>;
}

function LinkDetails({ link }: { link: LinkDto }) {
  return (
    <div>
      <Section title="Link">
        <FieldRow label="ID">{link.id}</FieldRow>
        <FieldRow label="Flow ID">{link.flowId}</FieldRow>
        <FieldRow label="Direction">{link.dataFlowDirection}</FieldRow>
      </Section>
      <Section title="Client interface">
        <FieldRow label="ID">{link.clientInterface.id}</FieldRow>
        <FieldRow label="Name">{link.clientInterface.name}</FieldRow>
        <FieldRow label="Type">{link.clientInterface.dtoType}</FieldRow>
      </Section>
      <Section title="Server interface">
        <FieldRow label="ID">{link.serverInterface.id}</FieldRow>
        <FieldRow label="Name">{link.serverInterface.name}</FieldRow>
        <FieldRow label="Type">{link.serverInterface.dtoType}</FieldRow>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/components/details-panel.tsx
git commit -m "feat(flow-graph): add DetailsPanel with type-aware field rendering"
```

---

## Task 13: FlowCombobox

**Files:**
- Create: `src/features/flow-graph/components/flow-combobox.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { flowApi } from "@/features/flow/api";

interface FlowComboboxProps {
  value: number;
  onChange: (flowId: number) => void;
}

const PAGE_SIZE = 10;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function FlowCombobox({ value, onChange }: FlowComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);

  const listQuery = useQuery(
    flowApi.listQueryOptions({
      caption: debouncedSearch || undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    }),
  );
  const selectedQuery = useQuery(flowApi.detailQueryOptions(value));

  const flows = listQuery.data?.data ?? [];
  const selected = selectedQuery.data?.data;
  const displayText = selected
    ? `${selected.caption}`
    : listQuery.isLoading
      ? "Loading…"
      : "Select a flow";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="min-w-[280px] justify-start text-left font-normal"
          />
        }
      >
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by caption…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {flows.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isLoading ? "Loading…" : "No results"}
            </li>
          )}
          {flows.map((flow) => {
            const isSelected = flow.id === value;
            return (
              <li
                key={flow.id}
                onClick={() => {
                  onChange(flow.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{flow.caption}</div>
                <div className="truncate text-xs text-muted-foreground">{flow.code}</div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/flow-graph/components/flow-combobox.tsx
git commit -m "feat(flow-graph): add server-filtered FlowCombobox"
```

---

## Task 14: FlowGraphHeader

**Files:**
- Create: `src/features/flow-graph/components/flow-graph-header.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { FlowDto } from "@/types/api";
import { FlowCombobox } from "./flow-combobox";

interface FlowGraphHeaderProps {
  flow: FlowDto;
  flowId: number;
  onFlowChange: (id: number) => void;
}

export function FlowGraphHeader({ flow, flowId, onFlowChange }: FlowGraphHeaderProps) {
  return (
    <div className="flex h-full items-center justify-between gap-4 border-b px-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="truncate text-lg font-semibold">{flow.caption}</h1>
        <Meta label="Code" value={flow.code} />
        <Meta label="Integrity" value={flow.integrity ?? "—"} />
        <Meta label="Confidentiality" value={flow.confidentiality ?? "—"} />
        <Meta label="Data class" value={flow.dataClass} />
        <Meta label="Data type" value={flow.dataType} />
        <Meta label="State" value={flow.state} />
      </div>
      <FlowCombobox value={flowId} onChange={onFlowChange} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{label}:</span> {value}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/flow-graph/components/flow-graph-header.tsx
git commit -m "feat(flow-graph): add FlowGraphHeader with flow meta and combobox"
```

---

## Task 15: FlowGraphCanvas

**Files:**
- Create: `src/features/flow-graph/components/flow-graph-canvas.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect } from "react";
import { CustomNode } from "./custom-node";
import { layoutGraph } from "../layout";
import type { BuiltGraph, Selection, FlowGraphNode, FlowGraphEdge } from "../types";

const nodeTypes = { flowGraphNode: CustomNode };

interface FlowGraphCanvasProps {
  graph: BuiltGraph;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}

export function FlowGraphCanvas({ graph, selection, onSelect }: FlowGraphCanvasProps) {
  const laidOut = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);
  const [nodes, setNodes] = useState<FlowGraphNode[]>(laidOut);
  const [edges, setEdges] = useState<FlowGraphEdge[]>(graph.edges);

  useEffect(() => {
    setNodes(laidOut);
    setEdges(graph.edges);
  }, [laidOut, graph.edges]);

  const onNodesChange: OnNodesChange<FlowGraphNode> = (changes) =>
    setNodes((ns) => applyNodeChanges(changes, ns));
  const onEdgesChange: OnEdgesChange<FlowGraphEdge> = (changes) =>
    setEdges((es) => applyEdgeChanges(changes, es));

  const onNodeClick: NodeMouseHandler<FlowGraphNode> = (_, node) => {
    onSelect({ kind: "node", id: Number(node.id) });
  };
  const onEdgeClick: EdgeMouseHandler<FlowGraphEdge> = (_, edge) => {
    onSelect({ kind: "link", id: Number(edge.id) });
  };
  const onPaneClick = () => onSelect(null);

  const handleInterfaceClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const handleEl = target.closest<HTMLElement>(".react-flow__handle");
    if (!handleEl) return;
    const id = handleEl.dataset.handleid;
    if (!id) return;
    event.stopPropagation();
    onSelect({ kind: "interface", id: Number(id) });
  };

  return (
    <div className="h-full w-full" onClickCapture={handleInterfaceClick}>
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: selection?.kind === "node" && selection.id === Number(n.id) }))}
        edges={edges.map((e) => ({ ...e, selected: selection?.kind === "link" && selection.id === Number(e.id) }))}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
```

Note: handle clicks are not first-class events in React Flow, so we intercept them via `onClickCapture` on the wrapper and read the `data-handleid` attribute that React Flow sets on `.react-flow__handle` elements.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/flow-graph/components/flow-graph-canvas.tsx
git commit -m "feat(flow-graph): add canvas with node/edge/handle selection"
```

---

## Task 16: FlowGraphPage

**Files:**
- Create: `src/features/flow-graph/components/flow-graph-page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { flowGraphQueryOptions } from "../api";
import { buildGraph } from "../build-graph";
import type { Selection } from "../types";
import { FlowGraphHeader } from "./flow-graph-header";
import { FlowGraphCanvas } from "./flow-graph-canvas";
import { DetailsPanel } from "./details-panel";

interface FlowGraphPageProps {
  flowId: number;
  onFlowChange: (id: number) => void;
}

export function FlowGraphPage({ flowId, onFlowChange }: FlowGraphPageProps) {
  const { data } = useSuspenseQuery(flowGraphQueryOptions(flowId));
  const graph = useMemo(() => buildGraph(data.data), [data]);
  const [selection, setSelection] = useState<Selection>(null);

  return (
    <div className="h-[calc(100vh-3rem)] w-full">
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={12} minSize={8} maxSize={25}>
          <FlowGraphHeader flow={data.data.flow} flowId={flowId} onFlowChange={onFlowChange} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={88} minSize={60}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={70} minSize={30}>
              <FlowGraphCanvas graph={graph} selection={selection} onSelect={setSelection} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="h-full overflow-y-auto">
                <DetailsPanel selection={selection} graph={graph} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/flow-graph/components/flow-graph-page.tsx
git commit -m "feat(flow-graph): compose page via nested Resizable"
```

---

## Task 17: Route wiring

**Files:**
- Modify: `src/routes/flow-graph/index.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { FlowGraphPage } from "@/features/flow-graph/components/flow-graph-page";
import { flowGraphQueryOptions } from "@/features/flow-graph/api";

const searchSchema = z.object({
  flowId: z.coerce.number().int().positive().default(99),
});

export const Route = createFileRoute("/flow-graph/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ flowId: search.flowId }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(flowGraphQueryOptions(deps.flowId)),
  component: RouteComponent,
});

function RouteComponent() {
  const { flowId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <FlowGraphPage
      flowId={flowId}
      onFlowChange={(id) => navigate({ search: { flowId: id } })}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/routes/flow-graph/index.tsx
git commit -m "feat(flow-graph): wire route with flowId search param and loader"
```

---

## Task 18: Verify end-to-end

**Files:** none

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass, including `build-graph.test.ts` and `layout.test.ts`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 3: Build (type-check + vite)**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test with mock API**

Run: `VITE_MOCK_API=true npm run dev`

Browser checklist at `http://localhost:5173/flow-graph`:

- Page loads with flow 99 selected by default; header shows caption, code, integrity, confidentiality, dataClass, dataType, state.
- Graph renders with nodes laid out LR; node styling differs per `dtoType`.
- Each interface is a colored handle (color varies by interface `dtoType`); client on right, server on left.
- Edges connect the correct handles.
- Clicking a node → details panel shows node fields including type-specific block.
- Clicking a handle → details panel shows the interface fields.
- Clicking an edge → details panel shows link fields.
- Clicking empty canvas → details panel returns to empty state.
- Flow combobox (top right) opens; typing filters results server-side (debounced); picking a different flow updates the URL `?flowId=…` and reloads the graph.
- Resizing the vertical handle changes header height; resizing horizontal handle changes graph/details ratio; neither collapses.

If any item fails, fix in a follow-up task and recommit.

---

## Self-Review

- **Spec coverage:** Layout (Task 16), header fields (14), combobox (13), nodes/handles (10–11), dagre LR (6–7), details panel with type-aware rendering (12), MarkdownBlock/FieldRow (9), route + search param + loader (17), mock handler (2), deps (1). Smoke test in Task 18.
- **Placeholders:** none — every step has concrete code or commands.
- **Type consistency:** `Selection`, `BuiltGraph`, `FlowGraphNode`, `FlowGraphEdge` defined in Task 3 and used consistently through Tasks 5, 7, 10–12, 15–16. `flowGraphQueryOptions(flowId)` signature matches between Task 8 and Task 17.
- **Scope:** single feature (one page), appropriately-sized for a single plan.
