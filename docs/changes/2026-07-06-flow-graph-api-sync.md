# Flow Graph: sync with the new nodes+links backend API

Date: 2026-07-03 … 2026-07-06

## What changed

### DTO sync (`src/types/api.ts`)
- Removed `InterfaceFlatDto` and all its subtypes, and the old node subclass hierarchy — interfaces no longer exist in the backend model.
- `NodeDto`: `{ id, insertedAt, updatedAt, nodeType, name, environment, automatedSystem, data? }`; `nodeType` ∈ `NODE | MICROSERVICE | TOPIC | EGRESS | INGRESS`; `data` is untyped JSONB config.
- `LinkDto`: flattened to node-to-node — `{ flowId, clientNodeId, serverNodeId, protocol, dataFlowDirection, principalId }`; `protocol` ∈ `DB | KAFKA | REST | SOAP | TFS | LDAP | common`.
- `FlowGraphDto`: `{ flowId, env, nodes, links }` (no embedded `flow` anymore).
- `FlowDto`: `integrity`/`confidentiality` are plain strings, added `secretClass`/`description`, removed `state`/`descriptionMd`. Fallout fixed across the flow table feature (schema, mappers, columns, filters, FlowSheet).

### Flow-graph page (`src/features/flow-graph/`)
- **Environment selector** (DEV/IFT/UAT/PROD) in the header; `env` is a URL search param, default `PROD`. `env` is always sent — the backend NPEs when it's omitted.
- **`flowId` is optional**: bare `/flow-graph` shows a "select a flow" empty state and sends no graph request (the old default `flowId=99` caused a 404).
- Graph building simplified: edges connect nodes directly (client → server), labeled with the protocol; per-interface handles and the interface details view are gone.
- Details panel: node common fields + automated-system section + `data` rendered as **YAML in a collapsible block** (new `yaml` dependency, shadcn `collapsible`); link details resolve client/server node names.
- Selection resets when flow or env changes.

### Flow combobox (`components/flow-combobox.tsx`)
- Search is **client-side over the full flow list**, matching **caption or code, case-insensitively** (the backend ignores filter params entirely, so the old server-side `caption` filter never worked).
- The selected flow's label and the header metadata are derived from the same cached list — no more `GET /api/v1/flow/{id}` per flow change. Per-flow-change traffic is exactly one request: `GET /api/v1/flow-graph/{id}?env=…`.

### Mocks (`src/mocks/`)
- Interface fixtures/handlers deleted; node/link/flow fixtures rewritten to the new shapes; flow-graph handler filters by `env` (both link endpoints must match; unknown env → PROD, mirroring the backend).

## Notes / known issues
- Local run: `npm run dev -- --host`; mock vs real API toggled via `.env.development` (`VITE_MOCK_API=true` default) — override locally with `.env.development.local`.
- Pre-existing on `master`/HEAD, not addressed: 4 files fail `tsc` (`data-table-filter-list.tsx`, `box/columns.tsx`, `BoxSheet.tsx`, `mocks/lib/odata.ts`).
- Backend gaps that surface here: flow list has no server-side filtering and no create/update endpoints; `GET /flow-graph/{id}` 500s for some UAT topics (bad `TopicData` JSONB rows).
