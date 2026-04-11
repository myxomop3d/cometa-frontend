# OpenAPI DTO Sync & Mock Data Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Node/Interface/Link/FlowGraph DTOs to match the new OpenAPI spec and rewrite mock data from `example/flow.json`.

**Architecture:** In-place rewrite of types in `src/types/api.ts` (lines 104–174), complete rewrite of three mock data files, and type-import fixes in two mock handlers. No application code uses the old field names — blast radius is contained to types + mocks.

**Tech Stack:** TypeScript 5.9, MSW 2 mocks

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/api.ts` | Modify lines 104–174 | Replace Node/Interface hierarchies, update LinkDto/FlowGraphDto |
| `src/mocks/data/nodes.ts` | Full rewrite | 12 nodes from flow.json |
| `src/mocks/data/interfaces.ts` | Full rewrite | 33 interfaces from flow.json (with nodeId set) |
| `src/mocks/data/links.ts` | Full rewrite | 14 links from flow.json |
| `src/mocks/handlers/node.ts` | Modify line 2 | Fix type imports |
| `src/mocks/handlers/interface.ts` | Modify line 2 | Fix type imports |

---

### Task 1: Replace Node/Interface/Link/FlowGraph types in `src/types/api.ts`

**Files:**
- Modify: `src/types/api.ts:104-174`

- [ ] **Step 1: Replace the Node/Interface/Link/FlowGraph type block**

Replace everything from line 104 (`// Node hierarchy`) through line 174 (end of `FlowGraphDto`) with:

```typescript
// Node hierarchy
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

// Interface hierarchy
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

// Link
export interface LinkDto {
  id: number;
  flowId: number;
  clientInterface: InterfaceFlatDto;
  serverInterface: InterfaceFlatDto;
  dataFlowDirection: string;
}

// FlowGraph
export interface FlowGraphDto {
  flowId: number;
  nodes: NodeDto[];
  links: LinkDto[];
}
```

- [ ] **Step 2: Verify the types file has no internal errors**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: errors only in mock files (they still reference old types). No errors within `api.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/types/api.ts
git commit -m "feat: update Node/Interface/Link DTOs to match new OpenAPI spec"
```

---

### Task 2: Rewrite `src/mocks/data/interfaces.ts`

**Files:**
- Rewrite: `src/mocks/data/interfaces.ts`

Interfaces must be written before nodes (nodes file doesn't depend on interfaces, but we need nodeId set on interfaces for the mock handlers). Extract all 33 interfaces from `example/flow.json` → `data.nodes[*].interfaces[*]`, setting `nodeId` to the parent node's `id`.

- [ ] **Step 1: Rewrite the interfaces file**

Replace entire file content with:

```typescript
import type {
  InterfaceFlatDto,
  InterfaceKafkaClientFlatDto,
  InterfaceRestClientFlatDto,
} from "@/types/api";

type AnyInterface =
  | InterfaceFlatDto
  | InterfaceKafkaClientFlatDto
  | InterfaceRestClientFlatDto;

export const interfaces: AnyInterface[] = [
  // ── Microservice me-depo-trades-murex-in-out (nodeId: 1) ──
  {
    dtoType: "restClient",
    authentication: "Basic",
    descriptionMd: null,
    encryption: "SIMPLE",
    endpoint:
      "/books/api/v1/integrations/murex/books?IsOpen=true, /books/api/v1/integrations/murex/books?IsOpen=true&AliasForMOEX={alias}, /books/api/v1/integrations/murex/books?IsOpen=true&BookName={name}",
    errorsMd: null,
    httpMethod: "GET",
    id: 13,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "me-depo-trades-murex-in-out запрашивает Ecosystem BRD (rest-client)",
    nodeId: 1,
    protocol: "REST",
    requestFormat: "Query Parameter",
    responseFormat: "XML",
    segment: "eAz",
    socketConnectionTimeout: 60,
    socketReadTimeout: 30,
    tlsVersion: "1.2",
    xsdSchema: null,
  },
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 9,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: "Book, ContraBook",
    messageEncoding: "UTF-8",
    messageFormat: "FIXML",
    messageHeaders: null,
    name: "me-depo-trades-murex-in-out пишет в ME.DEPO.OTC-TCR.FIXML.PAO.MUREX (kafka-client)",
    nodeId: 1,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 15,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "me-depo-trades-murex-in-out запрашивает БД Murex STR (db-client)",
    nodeId: 1,
    protocol: "TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 8,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "me-depo-trades-murex-in-out читает из ME.DEPO.OTC-TCR.FIX.PAO (kafka-service)",
    nodeId: 1,
    protocol: "Binary over TCP",
    segment: "eAz",
  },

  // ── Topic ME.DEPO.OTC-TCR.FIX.PAO (nodeId: 2) ──
  {
    dtoType: "kafkaClient",
    consumerGroup: "connect-ME.BND.OTC-TCR.FIX.CIB-to-ME.BND.OTC-TCR.FIX.CIB",
    descriptionMd: null,
    id: 3,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIX",
    messageHeaders: null,
    name: "ME.DEPO.OTC-TCR.FIX.PAO возвращает сообщение SEDR (kafka-client)",
    nodeId: 2,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "d36z",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 2,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "ME.DEPO.OTC-TCR.FIX.PAO сохраняет сообщение из ME (kafka-service)",
    nodeId: 2,
    protocol: "Binary over TCP",
    segment: "d36z",
  },

  // ── Topic ME.DEPO.OTC-TCR.FIX.PAO (nodeId: 3) ──
  {
    dtoType: "kafkaClient",
    consumerGroup: "gmsb__me-depo-trades-murex-in-out",
    descriptionMd: null,
    id: 7,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIX",
    messageHeaders: null,
    name: "ME.DEPO.OTC-TCR.FIX.PAO возвращает сообщение me-depo-trades-murex-in-out (kafka-client)",
    nodeId: 3,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 6,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "ME.DEPO.OTC-TCR.FIX.PAO сохраня��т сообщение из SEDR (kafka-service)",
    nodeId: 3,
    protocol: "Binary over TCP",
    segment: "eAz",
  },

  // ── Topic ME.DEPO.OTC-TCR.FIXML.PAO.MUREX (nodeId: 4) ──
  {
    dtoType: "kafkaClient",
    consumerGroup: "murex__ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    descriptionMd: null,
    id: 11,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIXML",
    messageHeaders: null,
    name: "ME.DEPO.OTC-TCR.FIXML.PAO.MUREX возвращает сообщение Murex (kafka-client)",
    nodeId: 4,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 10,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "ME.DEPO.OTC-TCR.FIXML.PAO.MUREX сохраняет сообщение из me-depo-trades-murex-in-out (kafka-service)",
    nodeId: 4,
    protocol: "Binary over TCP",
    segment: "eAz",
  },

  // ── Egress egressgateway-ci01142241-kafka (nodeId: 5) ──
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 21,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIX",
    messageHeaders: null,
    name: "Egress (kafka-client) отправляет запрос на запись в ME.DEPO.OTC-TCR.FIX.PAO",
    nodeId: 5,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 22,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIX",
    messageHeaders: null,
    name: "Egress (kafka-client) получает из me-depo-trades-murex-in-out запрос на чтение из ME.DEPO.OTC-TCR.FIX.PAO",
    nodeId: 5,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 25,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIXML",
    messageHeaders: null,
    name: "Egress (kafka-client) отправляет запрос на запись в ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    nodeId: 5,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 26,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIXML",
    messageHeaders: null,
    name: "Egress (kafka-client) получает из Murex запрос на чтение из ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    nodeId: 5,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 20,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (kafka-service) получает из SEDR запрос на запись в ME.DEPO.OTC-TCR.FIX.PAO",
    nodeId: 5,
    protocol: "Binary over TCP",
    segment: "d36z",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 27,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (kafka-service) читает из ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    nodeId: 5,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 24,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (kafka-service) получает из me-depo-trades-murex-in-out запрос на запись в ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    nodeId: 5,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 23,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (kafka-service) читает из ME.DEPO.OTC-TCR.FIX.PAO",
    nodeId: 5,
    protocol: "Binary over TCP",
    segment: "eAz",
  },

  // ── Egress egressgateway-ci01142241-db-murex-mx-db1 (nodeId: 6) ──
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 30,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (rest-service) получает запрос из me-depo-trades-murex-in-out",
    nodeId: 6,
    protocol: "REST",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 31,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (rest-client) отправляет запрос в Ecosystem BRD",
    nodeId: 6,
    protocol: "REST",
    segment: "eAz",
  },

  // ── Egress egressgateway-ci01142241-http-ecosystem-brd (nodeId: 7) ──
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 32,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (db-service) получает запрос из me-depo-trades-murex-in-out",
    nodeId: 7,
    protocol: "TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 33,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Egress (db-client) отправляет запрос в БД Murex STR",
    nodeId: 7,
    protocol: "TCP",
    segment: "eAz",
  },

  // ── Node АС Matching Engine (nodeId: 8) ──
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 1,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIX",
    messageHeaders: null,
    name: "ME пишет в ME.DEPO.OTC-TCR.FIX.PAO (kafka-client)",
    nodeId: 8,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "d36z",
  },

  // ── Node АС SEDR (nodeId: 9) ──
  {
    dtoType: "kafkaClient",
    consumerGroup: null,
    descriptionMd: null,
    id: 5,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    messageEncoding: "UTF-8",
    messageFormat: "FIX",
    messageHeaders: null,
    name: "SEDR пишет в ME.DEPO.OTC-TCR.FIX.PAO (kafka-client)",
    nodeId: 9,
    partitionKey: null,
    protocol: "Binary over TCP",
    segment: "eAz",
  },
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 4,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "SEDR читает из ME.DEPO.OTC-TCR.FIX.PAO (kafka-service)",
    nodeId: 9,
    protocol: "Binary over TCP",
    segment: "d36z",
  },

  // ── Node АС Murex (nodeId: 10) ──
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 12,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Murex читает из ME.DEPO.OTC-TCR.FIXML.PAO.MUREX (kafka-service)",
    nodeId: 10,
    protocol: "Binary over TCP",
    segment: "eAz",
  },

  // ── Node Веб-сервис Ecosystem BRD (nodeId: 11) ──
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 14,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "Ecosystem BRD возвращает данные me-depo-trades-murex-in-out (rest-service)",
    nodeId: 11,
    protocol: "REST",
    segment: "eAz",
  },

  // ── Node БД Murex STR (nodeId: 12) ──
  {
    dtoType: "interface",
    descriptionMd: null,
    id: 16,
    linksInIds: null,
    linksOutIds: null,
    localWhiteListHeaders: null,
    name: "БД Murex STR возвращает данные me-depo-trades-murex-in-out (db-service)",
    nodeId: 12,
    protocol: "TCP",
    segment: "eAz",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/mocks/data/interfaces.ts
git commit -m "feat: rewrite interface mock data from flow.json"
```

---

### Task 3: Rewrite `src/mocks/data/nodes.ts`

**Files:**
- Rewrite: `src/mocks/data/nodes.ts`

12 nodes from `example/flow.json` → `data.nodes[]`. Nodes are stored **without** embedded interfaces (the handler enriches them on-the-fly).

- [ ] **Step 1: Rewrite the nodes file**

Replace entire file content with:

```typescript
import type {
  NodeDto,
  NodeEgressDto,
  NodeMicroserviceDto,
  NodeTopicDto,
} from "@/types/api";

export const nodes: (
  | NodeMicroserviceDto
  | NodeTopicDto
  | NodeEgressDto
  | NodeDto
)[] = [
  {
    dtoType: "microservice",
    artifact: "me-depo-trades-murex-in-out",
    artifactVersion: "4.0.6",
    configUrl:
      "https://stash.sigma.sbrf.ru/projects/GMBUS/repos/config-repo/browse/me-depo-trades-murex-in-out",
    descriptionMd: null,
    faultTolerance:
      "active-active на нескольких кластерах Open Shift/Kuber",
    globalWhiteListHeaders: "",
    gmsbGen: "Gen4",
    id: 1,
    imageVersion: "m962j17r",
    interfaces: [],
    loadBalancing: "kafka-in: конкуренция потребителей kafka",
    name: "Микросервис me-depo-trades-murex-in-out",
    pelicanUrl:
      "https://stash.sigma.sbrf.ru/projects/GMBUS_UTILS/repos/pelican-gmsb-tests/browse/src/test/kotlin/ru/sberbank/gmsb/cib/pelican/tests/ait/me/depoOtcTcr/murex/MeDepoOtcTcrMurexTest.kt",
    resourceProfile:
      "resources:\r\n  limits:\r\n    cpu: 200m\r\n    memory: 620Mi\r\n  requests:\r\n    cpu: 100m\r\n    memory: 620Mi",
    scalability:
      "запуск дополнительных pod на каждом экземпляре Open Shift/Kuber",
    sourceUrl:
      "https://stash.sigma.sbrf.ru/projects/GMBUS/repos/me-depo-trades-murex-in-out/browse",
  },
  {
    dtoType: "topic",
    compressionType: "producer",
    descriptionMd: null,
    id: 2,
    interfaces: [],
    maxMessageBytes: 10485760,
    name: "Топик ME.DEPO.OTC-TCR.FIX.PAO",
    partitions: 5,
    replicationFactor: 6,
    retentionBytes: 367001600,
    retentionMs: 600000,
  },
  {
    dtoType: "topic",
    compressionType: "zstd",
    descriptionMd: null,
    id: 3,
    interfaces: [],
    maxMessageBytes: 10485760,
    name: "Топик ME.DEPO.OTC-TCR.FIX.PAO",
    partitions: 10,
    replicationFactor: 4,
    retentionBytes: -1,
    retentionMs: 604800000,
  },
  {
    dtoType: "topic",
    compressionType: "zstd",
    descriptionMd: null,
    id: 4,
    interfaces: [],
    maxMessageBytes: 10485760,
    name: "Топик ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    partitions: 10,
    replicationFactor: 4,
    retentionBytes: -1,
    retentionMs: 604800000,
  },
  {
    dtoType: "egress",
    descriptionMd: null,
    id: 5,
    interfaces: [],
    name: "Егрес egressgateway-ci01142241-kafka",
    realHosts:
      "pvlsq-kssh00069.sigma.sbrf.ru, pvlsq-kssh00070.sigma.sbrf.ru, pvlsq-kssh00071.sigma.sbrf.ru, pvlsq-kssh00072.sigma.sbrf.ru, pvlsq-kssh00073.sigma.sbrf.ru, pvlsq-kssh00074.sigma.sbrf.ru",
    realPort: 9093,
    tls: "MTLS",
    virtualHost: "kafka.host",
  },
  {
    dtoType: "egress",
    descriptionMd: null,
    id: 6,
    interfaces: [],
    name: "Егрес egressgateway-ci01142241-db-murex-mx-db1",
    realHosts: "mx-db1.sigma.sbrf.ru",
    realPort: 6000,
    tls: "NONE",
    virtualHost: "mx-db1.db.host",
  },
  {
    dtoType: "egress",
    descriptionMd: null,
    id: 7,
    interfaces: [],
    name: "Егрес egressgateway-ci01142241-http-ecosystem-brd",
    realHosts: "brd.prom-138-139-apps.ocp-geo.ocp.sigma.sbrf.ru",
    realPort: 443,
    tls: "SIMPLE",
    virtualHost: "ecosystem-brd.host",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 8,
    interfaces: [],
    name: "АС Matching Engine",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 9,
    interfaces: [],
    name: "АС SEDR",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 10,
    interfaces: [],
    name: "АС Murex",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 11,
    interfaces: [],
    name: "Веб-сервис Ecosystem BRD",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 12,
    interfaces: [],
    name: "БД Murex STR",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/mocks/data/nodes.ts
git commit -m "feat: rewrite node mock data from flow.json"
```

---

### Task 4: Rewrite `src/mocks/data/links.ts`

**Files:**
- Rewrite: `src/mocks/data/links.ts`

14 links from `example/flow.json` → `data.links[]`. Each link embeds its `clientInterface` and `serverInterface` objects inline (matching the `LinkDto` shape).

- [ ] **Step 1: Rewrite the links file**

Replace entire file content with:

```typescript
import type { LinkDto } from "@/types/api";

export const links: LinkDto[] = [
  {
    id: 1,
    flowId: 99,
    dataFlowDirection: "UPWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 1,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIX",
      messageHeaders: null,
      name: "ME пишет в ME.DEPO.OTC-TCR.FIX.PAO (kafka-client)",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "d36z",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 2,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "ME.DEPO.OTC-TCR.FIX.PAO сохраняет сообщение из ME (kafka-service)",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "d36z",
    },
  },
  {
    id: 2,
    flowId: 99,
    dataFlowDirection: "BACKWARD",
    clientInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 4,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "SEDR читает из ME.DEPO.OTC-TCR.FIX.PAO (kafka-service)",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "d36z",
    },
    serverInterface: {
      dtoType: "kafkaClient",
      consumerGroup: "connect-ME.BND.OTC-TCR.FIX.CIB-to-ME.BND.OTC-TCR.FIX.CIB",
      descriptionMd: null,
      id: 3,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIX",
      messageHeaders: null,
      name: "ME.DEPO.OTC-TCR.FIX.PAO возвращает сообщение SEDR (kafka-client)",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "d36z",
    },
  },
  {
    id: 3,
    flowId: 99,
    dataFlowDirection: "UPWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 5,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIX",
      messageHeaders: null,
      name: "SEDR пишет в ME.DEPO.OTC-TCR.FIX.PAO (kafka-client)",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 6,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "ME.DEPO.OTC-TCR.FIX.PAO сохраняет сообщение из SEDR (kafka-service)",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 4,
    flowId: 99,
    dataFlowDirection: "BACKWARD",
    clientInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 8,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "me-depo-trades-murex-in-out читает из ME.DEPO.OTC-TCR.FIX.PAO (kafka-service)",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "kafkaClient",
      consumerGroup: "gmsb__me-depo-trades-murex-in-out",
      descriptionMd: null,
      id: 7,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIX",
      messageHeaders: null,
      name: "ME.DEPO.OTC-TCR.FIX.PAO возвращает сообщение me-depo-trades-murex-in-out (kafka-client)",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 5,
    flowId: 99,
    dataFlowDirection: "UPWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 9,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: "Book, ContraBook",
      messageEncoding: "UTF-8",
      messageFormat: "FIXML",
      messageHeaders: null,
      name: "me-depo-trades-murex-in-out пишет в ME.DEPO.OTC-TCR.FIXML.PAO.MUREX (kafka-client)",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 10,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "ME.DEPO.OTC-TCR.FIXML.PAO.MUREX сохраняет сообщение из me-depo-trades-murex-in-out (kafka-service)",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 6,
    flowId: 99,
    dataFlowDirection: "BACKWARD",
    clientInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 12,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Murex читает из ME.DEPO.OTC-TCR.FIXML.PAO.MUREX (kafka-service)",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "kafkaClient",
      consumerGroup: "murex__ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
      descriptionMd: null,
      id: 11,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIXML",
      messageHeaders: null,
      name: "ME.DEPO.OTC-TCR.FIXML.PAO.MUREX возвращает сообщение Murex (kafka-client)",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 7,
    flowId: 99,
    dataFlowDirection: "BIDIRECTIONAL",
    clientInterface: {
      dtoType: "restClient",
      authentication: "Basic",
      descriptionMd: null,
      encryption: "SIMPLE",
      endpoint:
        "/books/api/v1/integrations/murex/books?IsOpen=true, /books/api/v1/integrations/murex/books?IsOpen=true&AliasForMOEX={alias}, /books/api/v1/integrations/murex/books?IsOpen=true&BookName={name}",
      errorsMd: null,
      httpMethod: "GET",
      id: 13,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "me-depo-trades-murex-in-out запрашивает Ecosystem BRD (rest-client)",
      nodeId: null,
      protocol: "REST",
      requestFormat: "Query Parameter",
      responseFormat: "XML",
      segment: "eAz",
      socketConnectionTimeout: 60,
      socketReadTimeout: 30,
      tlsVersion: "1.2",
      xsdSchema: null,
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 14,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Ecosystem BRD возвращает данные me-depo-trades-murex-in-out (rest-service)",
      nodeId: null,
      protocol: "REST",
      segment: "eAz",
    },
  },
  {
    id: 8,
    flowId: 99,
    dataFlowDirection: "BIDIRECTIONAL",
    clientInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 15,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "me-depo-trades-murex-in-out запрашивает БД Murex STR (db-client)",
      nodeId: null,
      protocol: "TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 16,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "БД Murex STR возвращает данные me-depo-trades-murex-in-out (db-service)",
      nodeId: null,
      protocol: "TCP",
      segment: "eAz",
    },
  },
  {
    id: 9,
    flowId: 99,
    dataFlowDirection: "UPWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 21,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIX",
      messageHeaders: null,
      name: "Egress (kafka-client) отправляет запрос на запись в ME.DEPO.OTC-TCR.FIX.PAO",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 20,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (kafka-service) получает из SEDR запрос на запись в ME.DEPO.OTC-TCR.FIX.PAO",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "d36z",
    },
  },
  {
    id: 10,
    flowId: 99,
    dataFlowDirection: "BACKWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 22,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIX",
      messageHeaders: null,
      name: "Egress (kafka-client) получает из me-depo-trades-murex-in-out запрос на чтение из ME.DEPO.OTC-TCR.FIX.PAO",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 23,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (kafka-service) читает из ME.DEPO.OTC-TCR.FIX.PAO",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 11,
    flowId: 99,
    dataFlowDirection: "UPWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 25,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIXML",
      messageHeaders: null,
      name: "Egress (kafka-client) отправляет запрос на запись в ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 24,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (kafka-service) получает из me-depo-trades-murex-in-out запрос на запись в ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 12,
    flowId: 99,
    dataFlowDirection: "BACKWARD",
    clientInterface: {
      dtoType: "kafkaClient",
      consumerGroup: null,
      descriptionMd: null,
      id: 26,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      messageEncoding: "UTF-8",
      messageFormat: "FIXML",
      messageHeaders: null,
      name: "Egress (kafka-client) получает из Murex запрос на чтение из ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
      nodeId: null,
      partitionKey: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 27,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (kafka-service) читает из ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
      nodeId: null,
      protocol: "Binary over TCP",
      segment: "eAz",
    },
  },
  {
    id: 13,
    flowId: 99,
    dataFlowDirection: "BIDIRECTIONAL",
    clientInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 31,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (rest-client) отправляет запрос в Ecosystem BRD",
      nodeId: null,
      protocol: "REST",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 30,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (rest-service) получает запрос из me-depo-trades-murex-in-out",
      nodeId: null,
      protocol: "REST",
      segment: "eAz",
    },
  },
  {
    id: 14,
    flowId: 99,
    dataFlowDirection: "BIDIRECTIONAL",
    clientInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 33,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (db-client) отправляет запрос в БД Murex STR",
      nodeId: null,
      protocol: "TCP",
      segment: "eAz",
    },
    serverInterface: {
      dtoType: "interface",
      descriptionMd: null,
      id: 32,
      linksInIds: null,
      linksOutIds: null,
      localWhiteListHeaders: null,
      name: "Egress (db-service) получает запрос из me-depo-trades-murex-in-out",
      nodeId: null,
      protocol: "TCP",
      segment: "eAz",
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/mocks/data/links.ts
git commit -m "feat: rewrite link mock data from flow.json"
```

---

### Task 5: Update mock handler type imports

**Files:**
- Modify: `src/mocks/handlers/node.ts:2`
- Modify: `src/mocks/handlers/interface.ts:2`

- [ ] **Step 1: Fix node handler imports**

In `src/mocks/handlers/node.ts`, replace line 2:

```typescript
// OLD
import type { MicroserviceNodeDto, NodeDto, TopicNodeDto } from "@/types/api";

// NEW
import type { NodeDto, NodeEgressDto, NodeMicroserviceDto, NodeTopicDto } from "@/types/api";
```

Also update the union type on lines 79, 83, 92, 93, 101, 102. Replace every occurrence of `MicroserviceNodeDto | TopicNodeDto` with `NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto`:

Line 79:
```typescript
const body = (await request.json()) as NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto;
```

Line 83:
```typescript
} as NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto;
```

Line 92:
```typescript
const body = (await request.json()) as NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto;
```

Line 93:
```typescript
db[idx] = { ...body, id: db[idx].id } as NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto;
```

Line 101:
```typescript
const body = (await request.json()) as Partial<NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto>;
```

Line 102:
```typescript
db[idx] = { ...db[idx], ...body } as NodeMicroserviceDto | NodeTopicDto | NodeEgressDto | NodeDto;
```

- [ ] **Step 2: Fix interface handler imports**

In `src/mocks/handlers/interface.ts`, replace line 2:

```typescript
// OLD
import type { NodeInterfaceFlatDto } from "@/types/api";

// NEW
import type { InterfaceFlatDto } from "@/types/api";
```

Replace all 3 occurrences of `NodeInterfaceFlatDto` with `InterfaceFlatDto`:

Line 27: `as InterfaceFlatDto;`
Line 40: `as InterfaceFlatDto;`
Line 49: `as Partial<InterfaceFlatDto>;`

- [ ] **Step 3: Commit**

```bash
git add src/mocks/handlers/node.ts src/mocks/handlers/interface.ts
git commit -m "fix: update mock handler type imports for new DTOs"
```

---

### Task 6: Verify everything compiles and lints

**Files:** none (verification only)

- [ ] **Step 1: Run type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: 0 errors (warnings OK).

- [ ] **Step 3: Fix any issues found**

If tsc or lint report errors, fix them in the relevant files. Common issues:
- Missing `as const` or type assertion on link interface objects that have extra properties (kafkaClient fields on a `InterfaceFlatDto` base type) — this is expected since `LinkDto` declares `clientInterface: InterfaceFlatDto` but we pass subtypes. TypeScript structural typing handles this.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -u
git commit -m "fix: resolve type-check and lint issues"
```
