# Flow Graph cross_guid Link Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user hovers a link in the flow graph, highlight that link and every other link sharing its `cross_guid`.

**Architecture:** The backend already loads full `Link` entities, so it only needs a new `crossGuid` field on the entity + DTO (MapStruct auto-maps it). The frontend surfaces `crossGuid` on each React Flow edge's `data`, tracks a `hoveredCrossGuid` in `FlowGraphCanvas`, and `DataFlowEdge` applies an amber accent to any edge whose `crossGuid` matches. Group-by-equality; no dimming of other elements.

**Tech Stack:** Frontend — React 19, TypeScript 5.9, TanStack Router/Query, @xyflow/react, Vitest, Tailwind v4. Backend — Java 17, Spring Boot, JPA, MapStruct, Lombok.

## Global Constraints

- TypeScript is strict with `noUnusedLocals` / `noUnusedParameters` — no unused imports/vars.
- Type-check the frontend with `npx tsc -b` (the root tsconfig is solution-style; bare `tsc --noEmit` checks nothing).
- Run frontend tests with `npm run test` (alias for `vitest run`).
- Path alias `@/` → `src/`.
- `src/routeTree.gen.ts` is auto-generated — never edit.
- Highlight rule: an edge is highlighted iff `hoveredCrossGuid != null && edge.crossGuid === hoveredCrossGuid`. No dimming of other edges/nodes.
- Accent color for highlight: amber `#f59e0b` (distinct from the click-`selected` state).
- Backend build/verify uses the JDK-17 reactor recipe (see Task 5); the DB `gmsb.link.cross_guid` column already exists (`uuid`, NOT NULL).

---

### Task 1: Frontend — plumb `crossGuid` from DTO onto edge data

**Files:**
- Modify: `src/types/api.ts` (`LinkDto` interface, ~line 130-140)
- Modify: `src/features/flow-graph/types.ts` (`FlowGraphEdgeData`, ~line 13-17)
- Modify: `src/features/flow-graph/build-graph.ts` (edge `data` object, ~line 58)
- Modify: `src/mocks/data/links.ts` (all fixtures)
- Test: `src/features/flow-graph/build-graph.test.ts` (fixture + new assertion)

**Interfaces:**
- Produces: `LinkDto.crossGuid: string`; `FlowGraphEdgeData.crossGuid: string`. Each built edge exposes `edge.data.crossGuid`.

- [ ] **Step 1: Add `crossGuid` to the failing test fixture + assertion**

In `src/features/flow-graph/build-graph.test.ts`, add `crossGuid` to the shared `link` fixture (it becomes a required field) and assert it is surfaced on the edge. Change the `link` literal (~line 13-17) to include the field, and add an assertion inside the existing `"CODIRECTIONAL: ..."` test (or a new `it`):

```ts
const link: LinkDto = {
  id: 100, insertedAt: null, updatedAt: null,
  flowId: 1, clientNodeId: 1, serverNodeId: 2,
  protocol: "KAFKA", dataFlowDirection: "CODIRECTIONAL", principalId: null,
  crossGuid: "11111111-1111-1111-1111-111111111111",
};
```

Add this test to the `describe("buildGraph", ...)` block:

```ts
it("surfaces crossGuid on the edge data", () => {
  const e = buildGraph(dto).edges[0];
  expect(e.data?.crossGuid).toBe("11111111-1111-1111-1111-111111111111");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- build-graph`
Expected: TypeScript/compile error or FAIL — `crossGuid` is not on `LinkDto` / not on edge data yet.

- [ ] **Step 3: Add `crossGuid` to `LinkDto`**

In `src/types/api.ts`, inside `interface LinkDto` (after `principalId`):

```ts
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
  crossGuid: string;
}
```

- [ ] **Step 4: Add `crossGuid` to `FlowGraphEdgeData`**

In `src/features/flow-graph/types.ts`:

```ts
export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
  direction: DataFlowDirection;
  roundTrip: boolean;
  crossGuid: string;
}
```

- [ ] **Step 5: Surface `crossGuid` in `build-graph.ts`**

In `src/features/flow-graph/build-graph.ts`, extend the edge `data` object (~line 58):

```ts
      data: {
        link: l,
        direction,
        roundTrip: direction === "BIDIRECTIONAL",
        crossGuid: l.crossGuid,
      },
```

- [ ] **Step 6: Update mock fixtures**

In `src/mocks/data/links.ts`, add a `crossGuid` to every link. Make the flow-99 PROD chain demoable: links `101` (ingress→adapter) and `102` (adapter→topic) share ONE guid — a genuine continuation *through* the adapter node (node 2 is the server end of 101 and the client end of 102, i.e. one link in, one link out through the proxy). All other links get unique guids. Set these exact values:

- `id: 101` → `crossGuid: "cccccccc-0000-4000-8000-0000000000cc"`  ← same as 102 (the demo pair)
- `id: 102` → `crossGuid: "cccccccc-0000-4000-8000-0000000000cc"`
- `id: 103` → `crossGuid: "aaaaaaa1-0000-4000-8000-000000000103"`
- `id: 104` → `crossGuid: "aaaaaaa1-0000-4000-8000-000000000104"`
- `id: 111` → `crossGuid: "aaaaaaa1-0000-4000-8000-000000000111"`
- `id: 112` → `crossGuid: "aaaaaaa1-0000-4000-8000-000000000112"`
- `id: 201` → `crossGuid: "aaaaaaa1-0000-4000-8000-000000000201"`

For each fixture object, add the `crossGuid` line after `principalId`, e.g. for link 102:

```ts
  {
    id: 102,
    insertedAt: "2025-11-03T10:20:00",
    updatedAt: "2025-11-03T10:20:00",
    flowId: 99,
    clientNodeId: 2,
    serverNodeId: 3,
    protocol: "KAFKA",
    dataFlowDirection: "CODIRECTIONAL",
    principalId: 501,
    crossGuid: "cccccccc-0000-4000-8000-0000000000cc",
  },
```

- [ ] **Step 7: Run test to verify it passes + type-check**

Run: `npm run test -- build-graph`
Expected: PASS.
Run: `npx tsc -b`
Expected: no errors (all `LinkDto` literals now include `crossGuid`).

- [ ] **Step 8: Commit**

```bash
git add src/types/api.ts src/features/flow-graph/types.ts src/features/flow-graph/build-graph.ts src/mocks/data/links.ts src/features/flow-graph/build-graph.test.ts
git commit -m "feat(flow-graph): plumb crossGuid from LinkDto onto edge data"
```

---

### Task 2: Frontend — `isHighlighted` predicate helper

**Files:**
- Create: `src/features/flow-graph/highlight.ts`
- Test: `src/features/flow-graph/highlight.test.ts`

**Interfaces:**
- Produces: `isHighlighted(edgeCrossGuid: string | undefined, hoveredCrossGuid: string | null): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/features/flow-graph/highlight.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isHighlighted } from "./highlight";

describe("isHighlighted", () => {
  it("true when the edge guid equals the hovered guid", () => {
    expect(isHighlighted("g1", "g1")).toBe(true);
  });
  it("false when guids differ", () => {
    expect(isHighlighted("g1", "g2")).toBe(false);
  });
  it("false when nothing is hovered", () => {
    expect(isHighlighted("g1", null)).toBe(false);
  });
  it("false when the edge has no guid", () => {
    expect(isHighlighted(undefined, "g1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- highlight`
Expected: FAIL — cannot find module `./highlight` / `isHighlighted` is not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/flow-graph/highlight.ts`:

```ts
/**
 * A link is highlighted when the user is hovering a link whose cross_guid
 * matches. Group-by-equality — a shared cross_guid means the links are one
 * continuation path through a proxy node.
 */
export function isHighlighted(
  edgeCrossGuid: string | undefined,
  hoveredCrossGuid: string | null,
): boolean {
  return hoveredCrossGuid != null && edgeCrossGuid === hoveredCrossGuid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- highlight`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/flow-graph/highlight.ts src/features/flow-graph/highlight.test.ts
git commit -m "feat(flow-graph): add isHighlighted cross_guid predicate"
```

---

### Task 3: Frontend — hover wiring + edge accent styling

**Files:**
- Modify: `src/features/flow-graph/types.ts` (`FlowGraphEdgeData` — add `highlighted?`)
- Modify: `src/features/flow-graph/components/flow-graph-canvas.tsx`
- Modify: `src/features/flow-graph/components/data-flow-edge.tsx`

**Interfaces:**
- Consumes: `isHighlighted` (Task 2); `edge.data.crossGuid` (Task 1).
- Produces: edges rendered with `data.highlighted: boolean`; `DataFlowEdge` renders amber accent when `data.highlighted` is true.

- [ ] **Step 1: Add `highlighted?` to `FlowGraphEdgeData`**

In `src/features/flow-graph/types.ts`, add the optional render flag:

```ts
export interface FlowGraphEdgeData extends Record<string, unknown> {
  link: LinkDto;
  direction: DataFlowDirection;
  roundTrip: boolean;
  crossGuid: string;
  highlighted?: boolean;
}
```

- [ ] **Step 2: Wire hover state in `FlowGraphCanvas`**

In `src/features/flow-graph/components/flow-graph-canvas.tsx`:

Add the import near the other feature imports:

```ts
import { isHighlighted } from "../highlight";
```

Add hover state next to the existing `useState` calls (after the `edges` state):

```ts
  const [hoveredCrossGuid, setHoveredCrossGuid] = useState<string | null>(null);
```

Add the two handlers next to `onEdgeClick`:

```ts
  const onEdgeMouseEnter: EdgeMouseHandler<FlowGraphEdge> = (_, edge) =>
    setHoveredCrossGuid(edge.data?.crossGuid ?? null);
  const onEdgeMouseLeave: EdgeMouseHandler<FlowGraphEdge> = () =>
    setHoveredCrossGuid(null);
```

Replace the `edges={...}` prop mapping so it also stamps `data.highlighted`:

```tsx
        edges={edges.map((e) => ({
          ...e,
          selected: selection?.kind === "link" && selection.id === Number(e.id),
          data: e.data && {
            ...e.data,
            highlighted: isHighlighted(e.data.crossGuid, hoveredCrossGuid),
          },
        }))}
```

Add the handlers to the `<ReactFlow>` element (next to `onEdgeClick`):

```tsx
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
```

(`EdgeMouseHandler` is already imported in this file.)

- [ ] **Step 3: Apply the accent in `DataFlowEdge`**

In `src/features/flow-graph/components/data-flow-edge.tsx`, replace the body from the `roundTrip` line through the `<circle>` element:

```tsx
  const roundTrip = data?.roundTrip ?? false;
  const highlighted = data?.highlighted ?? false;
  const strokeWidth = highlighted ? 3 : selected ? 2.5 : 1.5;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{ strokeWidth, ...(highlighted ? { stroke: "#f59e0b" } : {}) }}
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
```

(The `{label && (...)}` block and the closing `</>` stay exactly as they are.)

- [ ] **Step 4: Type-check + tests**

Run: `npx tsc -b`
Expected: no errors.
Run: `npm run test`
Expected: all tests PASS.

- [ ] **Step 5: Manual verification**

Run: `VITE_MOCK_API=true npm run dev -- --host`
Open the flow graph for flow 99 (PROD). Hover the ingress→adapter or adapter→topic link — both links of the continuation through the adapter node (ids 101 and 102, sharing `cccccccc-…`) should turn amber and thicken; every other link stays unchanged. Hovering any other (singleton) link emphasizes only that link. Move the mouse off — accent clears.

- [ ] **Step 6: Commit**

```bash
git add src/features/flow-graph/types.ts src/features/flow-graph/components/flow-graph-canvas.tsx src/features/flow-graph/components/data-flow-edge.tsx
git commit -m "feat(flow-graph): highlight links sharing cross_guid on hover"
```

---

### Task 4: Frontend — show `crossGuid` in the details panel

**Files:**
- Modify: `src/features/flow-graph/components/details-panel.tsx` (`LinkDetails`, ~line 99-112)

**Interfaces:**
- Consumes: `LinkDto.crossGuid` (Task 1).

- [ ] **Step 1: Add the field row**

In `src/features/flow-graph/components/details-panel.tsx`, inside the `LinkDetails` "Link" `<Section>`, add a Cross GUID row after the Principal ID row:

```tsx
        <FieldRow label="Principal ID">{link.principalId ?? "—"}</FieldRow>
        <FieldRow label="Cross GUID">{link.crossGuid}</FieldRow>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With the mock dev server running, click a link in the flow graph and confirm the details panel's "Link" section shows the Cross GUID value.

- [ ] **Step 4: Commit**

```bash
git add src/features/flow-graph/components/details-panel.tsx
git commit -m "feat(flow-graph): show crossGuid in link details panel"
```

---

### Task 5: Backend — add `crossGuid` to `Link` entity + `LinkDto`

**Files:**
- Modify: `F:\programming\cometa\cometa-persistence-module\src\main\java\ru\sberbank\cib\gmbus\entity\Link.java`
- Modify: `F:\programming\cometa\cometa-service-module\src\main\java\ru\sberbank\cib\gmbus\service\dto\LinkDto.java`

**Interfaces:**
- Produces: JSON `LinkDto` gains `"crossGuid": "<uuid>"` in the `/api/v1/flow-graph/{flowId}` response.

**Note on MapStruct:** `LinkMapper.toDto` auto-maps same-named fields. `crossGuid` is `UUID` on both entity and DTO, so no `@Mapping` is needed; `LinkMapperImpl` regenerates on compile.

**Note on Lombok `@AllArgsConstructor`:** `Link` has `@AllArgsConstructor`; adding a field changes its generated all-args signature. The class also defines an explicit 5-arg constructor that callers use, so this is normally safe — but the compile in Step 3 will surface any positional all-args caller if one exists.

- [ ] **Step 1: Add `crossGuid` to the `Link` entity**

In `Link.java`, add the import (with the other `jakarta`/`lombok` imports at top):

```java
import java.util.UUID;
```

Add the field after `principalId` (after line 67):

```java
    /**
     * Идентификатор сквозной цепочки (cross_guid).
     * Связывает звенья одного сквозного пути через узел-прокси:
     * два звена с одинаковым cross_guid являются продолжением друг друга.
     */
    @Column(name = "cross_guid", nullable = false)
    private UUID crossGuid;
```

- [ ] **Step 2: Add `crossGuid` to `LinkDto`**

In `LinkDto.java`, add the import:

```java
import java.util.UUID;
```

Add the field after `principalId` (after line 18):

```java
    private UUID crossGuid; // Идентификатор сквозной цепочки (cross_guid).
```

- [ ] **Step 3: Compile (regenerates MapStruct impl) and verify the mapping**

Set up the JDK-17 environment and build the two modules from the root reactor:

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
& "F:\programming\cometa\mvnw.cmd" -pl cometa-service-module -am -DskipTests compile
```

Expected: `BUILD SUCCESS`.

Confirm the generated mapper copies the field:

Run (Grep): search `crossGuid` in
`F:\programming\cometa\cometa-service-module\target\generated-sources\annotations\ru\sberbank\cib\gmbus\service\mapper\LinkMapperImpl.java`
Expected: a line like `linkDto.setCrossGuid( link.getCrossGuid() );`

- [ ] **Step 4: End-to-end verify the field is transmitted**

Start the backend (JDK-17, `local` profile, `DB_PASSWORD` from `F:\programming\cometa\.vscode\backend.env`) per the run recipe, then request a flow graph and confirm `crossGuid` appears on links. Pick a flow id known to have links (e.g. from the DB: `SELECT DISTINCT flow_id FROM gmsb.link LIMIT 1;`).

Alternatively (no HTTP), confirm against the DB that values exist:
Run (pg): `SELECT id, cross_guid FROM gmsb.link LIMIT 3;` — non-null uuids confirm the column the DTO now maps.

Expected: the flow-graph JSON links each include a `crossGuid` uuid string.

- [ ] **Step 5: Commit (backend repo)**

```bash
cd F:/programming/cometa
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/Link.java cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/LinkDto.java
git commit -m "feat(link): expose cross_guid on Link entity and LinkDto"
```

---

## Verification (whole feature)

- Frontend: `npx tsc -b` clean; `npm run test` green (build-graph + highlight suites).
- Frontend manual (mock): hover the shared-guid pair (links 101/102) → both amber; details panel shows Cross GUID.
- Backend: `compile` succeeds; `LinkMapperImpl` sets `crossGuid`; flow-graph JSON includes `crossGuid`.
- End-to-end (real API): `VITE_MOCK_API=false` dev server against the running backend — hover a proxy/egress link and confirm the real counterpart highlights.
