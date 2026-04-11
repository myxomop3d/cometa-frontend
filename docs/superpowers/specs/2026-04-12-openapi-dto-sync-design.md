# OpenAPI DTO Sync & Mock Data Rewrite

**Date:** 2026-04-12
**Source:** `example/cometa_openapi_12.04.26.json` (OpenAPI 3.1), `example/flow.json` (real flow data)

## Goal

Update `src/types/api.ts` DTOs for Node, Interface, Link, and FlowGraph to match the new backend OpenAPI spec. Rewrite mock data files (`nodes.ts`, `interfaces.ts`, `links.ts`) to represent exactly the data from `flow.json`. Update mock handlers to use new types.

## Approach

In-place rewrite (Option A). Old types are only consumed by mock data/handlers -- no application code references old field names. TypeScript strict mode catches all breakage.

---

## 1. Type Changes in `src/types/api.ts`

### 1.1 Node Hierarchy

**Remove:** `NodeDto`, `MicroserviceNodeDto`, `TopicNodeDto`

**Add:**

```typescript
// Base node (discriminator: dtoType)
export interface NodeDto {
  id: number;
  dtoType: string;
  name: string;
  descriptionMd: string | null;
  interfaces?: InterfaceFlatDto[];
}

export interface NodeMicroserviceDto extends NodeDto {
  dtoType: "microservice";
  artifact: string;
  artifactVersion: string;
  imageVersion: string | null;
  gmsbGen: string | null;
  sourceUrl: string | null;
  configUrl: string | null;
  pelicanUrl: string | null;
  faultTolerance: string | null;
  scalability: string | null;
  loadBalancing: string | null;
  globalWhiteListHeaders: string | null;
  resourceProfile: string | null;
}

export interface NodeTopicDto extends NodeDto {
  dtoType: "topic";
  partitions: number;
  replicationFactor: number;
  compressionType: string;
  maxMessageBytes: number;
  retentionBytes: number;
  retentionMs: number;
}

export interface NodeEgressDto extends NodeDto {
  dtoType: "egress";
  realHosts: string;
  realPort: number;
  tls: string;
  virtualHost: string;
}
```

Plain `NodeDto` with `dtoType: "node"` covers generic nodes.

### 1.2 Interface Hierarchy

**Remove:** `NodeInterfaceFlatDto`, `KafkaClientInterfaceFlatDto`, `KafkaServerInterfaceFlatDto`, `RestClientInterfaceFlatDto`, `RestServerInterfaceFlatDto`

**Add:**

```typescript
// Base flat interface (discriminator: dtoType)
export interface InterfaceFlatDto {
  id: number;
  dtoType: string;
  name: string;
  protocol: string;
  segment: string;
  localWhiteListHeaders: string | null;
  descriptionMd: string | null;
  nodeId: number | null;
  linksInIds: number[] | null;
  linksOutIds: number[] | null;
}

export interface InterfaceKafkaClientFlatDto extends InterfaceFlatDto {
  dtoType: "kafkaClient";
  partitionKey: string | null;
  messageFormat: string;
  messageEncoding: string;
  messageHeaders: string | null;
  consumerGroup: string | null;
}

export interface InterfaceRestClientFlatDto extends InterfaceFlatDto {
  dtoType: "restClient";
  endpoint: string;
  httpMethod: string;
  requestFormat: string;
  responseFormat: string;
  xsdSchema: string | null;
  socketConnectionTimeout: number;
  socketReadTimeout: number;
  authentication: string;
  encryption: string;
  tlsVersion: string;
  errorsMd: string | null;
}

export interface InterfaceRestServerFlatDto extends InterfaceFlatDto {
  dtoType: "restServer";
  endpoint: string;
  httpMethod: string;
  requestFormat: string;
  responseFormat: string;
  xsdSchema: string | null;
  authentication: string;
  encryption: string;
  tlsVersion: string;
  envoyFilter: string | null;
  serverHostsMd: string | null;
  errorsMd: string | null;
}
```

Plain `InterfaceFlatDto` with `dtoType: "interface"` covers generic interfaces.

### 1.3 LinkDto

```typescript
export interface LinkDto {
  id: number;
  flowId: number;
  clientInterface: InterfaceFlatDto;
  serverInterface: InterfaceFlatDto;
  dataFlowDirection: string;
}
```

Shape unchanged, but `clientInterface`/`serverInterface` now reference `InterfaceFlatDto` (was `NodeInterfaceFlatDto`).

### 1.4 FlowGraphDto

```typescript
export interface FlowGraphDto {
  flowId: number;
  nodes: NodeDto[];
  links: LinkDto[];
}
```

Shape unchanged, references updated base type.

### 1.5 Unchanged

`ApiResponse<T>`, `AppMessage`, `BoxDto`, `ItemDto`, `ThingDto`, `AutomatedSystemDto`, `BoxFilters`, `PaginationParams`, `SortByParams`, `Filters<T>`, `AutomatedSystemFilters` -- no changes.

---

## 2. Mock Data Rewrite

All three mock data files rewritten to represent exactly the data from `example/flow.json`.

### 2.1 `src/mocks/data/nodes.ts`

11 nodes from flow.json:
- id=1: microservice "me-depo-trades-murex-in-out"
- id=2: topic "ME.DEPO.OTC-TCR.FIX.PAO" (replicationFactor=6, partitions=5)
- id=3: topic "ME.DEPO.OTC-TCR.FIX.PAO" (replicationFactor=4, partitions=10)
- id=4: topic "ME.DEPO.OTC-TCR.FIXML.PAO.MUREX"
- id=5: egress "egressgateway-ci01142241-kafka"
- id=6: egress "egressgateway-ci01142241-db-murex-mx-db1"
- id=7: egress "egressgateway-ci01142241-http-ecosystem-brd"
- id=8: node "AS Matching Engine"
- id=9: node "AS SEDR"
- id=10: node "AS Murex"
- id=11: node "Ecosystem BRD"
- id=12: node "DB Murex STR"

Type: `(NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto)[]`

### 2.2 `src/mocks/data/interfaces.ts`

33 interfaces extracted from all nodes' `interfaces` arrays in flow.json. Mix of:
- `dtoType: "interface"` (generic) -- most common
- `dtoType: "kafkaClient"` -- with consumerGroup, messageFormat, messageEncoding, etc.
- `dtoType: "restClient"` -- with endpoint, httpMethod, authentication, etc.

Type: `(InterfaceFlatDto | InterfaceKafkaClientFlatDto | InterfaceRestClientFlatDto)[]`

### 2.3 `src/mocks/data/links.ts`

14 links from flow.json, all with `flowId: 99`. Interfaces are embedded objects (matching the `LinkDto` shape). `dataFlowDirection` values: `"BIDIRECTIONAL"`, `"UPWARD"`, `"BACKWARD"`.

---

## 3. Mock Handler Updates

### 3.1 `src/mocks/handlers/node.ts`
- Update import: `NodeMicroserviceDto | TopicNodeDto` -> `NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto`
- `enrichWithInterfaces` function: interfaces in flow.json have `nodeId: null`, so we skip nodeId-based enrichment and rely on the interfaces already embedded in node data from flow.json. Alternatively, set nodeId on interfaces in mock data for consistency.

**Decision:** Set `nodeId` on each interface in mock data (derived from which node contains it in flow.json). This keeps the handler logic working.

### 3.2 `src/mocks/handlers/interface.ts`
- Update import: `NodeInterfaceFlatDto` -> `InterfaceFlatDto`

### 3.3 `src/mocks/handlers/link.ts`
- No changes needed (already uses `LinkDto`)

### 3.4 `src/mocks/handlers/flow-graph.ts`
- Handler logic uses `interfaces.find(i => i.id === link.clientInterface.id)` to get `nodeId`. This works if we set `nodeId` in interface mock data. No type changes needed beyond what flows from the type definitions.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/types/api.ts` | Replace Node/Interface hierarchies, update LinkDto/FlowGraphDto refs |
| `src/mocks/data/nodes.ts` | Complete rewrite from flow.json |
| `src/mocks/data/interfaces.ts` | Complete rewrite from flow.json |
| `src/mocks/data/links.ts` | Complete rewrite from flow.json |
| `src/mocks/handlers/node.ts` | Update type imports |
| `src/mocks/handlers/interface.ts` | Update type imports |
| `src/mocks/handlers/flow-graph.ts` | No code changes, types flow through |

## 5. Verification

- `npx tsc --noEmit` must pass
- `npm run lint` must pass
