# Microservices & AT page — design

Date: 2026-09-23
Repos: `cometa-frontend` only (no backend change)
Status: approved design, not yet implemented — Implemented on feature/gm 2026-09-23

## Goal

A table page, **Microservices & AT**, with one row per microservice name. For each
microservice it shows what is deployed on each environment, and whether the
microservice needs automated tests (AT):

| Microservice | IFT | UAT | PROD | Need AT | AT |
|---|---|---|---|---|---|
| `mc` | `tc: artifact - version` (one line per link) | same | same | toggle | link (TBD) |

Shortcut names used throughout:

| Name | Source |
|---|---|
| `mc` | `node.name` (via `node_aggr.name`, which equals it by construction) |
| `tc` | `tech_component.name` |
| `artifact` | `node_tech_component_link.data.artifactId` |
| `version` | `node_tech_component_link.data.version` |
| `isNeedAT` | `node_aggr.data.isNeedAT` |

The rows are the `MICROSERVICE_NAME_AGGR` aggregators maintained by the reconcile job
(`cometa/docs/superpowers/specs/2026-09-22-microservice-name-aggr-reconcile-design.md`):
one aggregator per distinct microservice name, linked to every `MICROSERVICE` node with
that name across all automated systems and environments.

## Scope

**In scope:** a read page with server-side pagination, name search and name sort; an
inline `isNeedAT` toggle; one generalized option on `createCrudApi`; types, mapper,
columns, route and sidebar entry; unit tests for the mapper and the new option.

**Out of scope (v1):** filtering by tc, artifact, version or `isNeedAT`; the AT link
(the column exists as a placeholder, because the target does not exist in the DB yet);
trimming `node.data` out of the payload; any backend change.

## Facts established live (2026-09-23)

Against the development database and a backend built from `cometa` `c66cf8e`, logged in
as the standing test user `16674475`.

- **Reconcile populated the data.** `node_aggr` was empty before this work. Calling
  `POST /api/v1/node-aggregator/microservice-name/reconcile` returned `202`, and the job
  logged `aggregators +660 -0, links +1209 -0`. This is the first call to that endpoint;
  it closes the "remains an outstanding manual step" note in the reconcile spec.
- **The test user already holds `CREATE`, `UPDATE` and `DELETE`.** Migration 012 rebuilt
  `user_right` as `create`/`update`/`delete` and linked all three to role `admin`, which
  `16674475` has. `/api/v1/auth/me` confirms the authorities. The reconcile spec's "no
  seeded role carries an `UPDATE` authority" gap is out of date.
- **One call returns everything a row needs.** `GET /api/v1/node-aggregator/graph` with
  `$fields=nodes,nodes.techComponentLinks,nodes.techComponentLinks.techComponent` returns
  each aggregator with its nodes, each node's links, each link's `data` and its
  tech component. `$filter`, `$orderby=name`, `$top` and `$skip` all work, and `count` is
  660. Cost: about 78 KB and 90 ms per 20 rows. Most of that is each node's `data`
  (its full config YAML), which the page does not use.
- **Environment.** `MICROSERVICE` nodes exist only on `IFT` (653) and `UAT` (556). There are
  none on `PROD`, so the PROD column is empty on every row until PROD nodes are loaded.
  Every microservice has at least one tech-component link, and `node.environment` equals
  `techComponent.environment` on all 1918 links. The page still groups by
  `node.environment`, which is the source of truth.
- **What OData can and cannot filter here:**

  | Filter | Result |
  |---|---|
  | `contains_ignoring_case(name, '…')`, `$orderby=name` | 200 |
  | `nodes/any(x: contains_ignoring_case(x/name, '…'))` (single-level lambda) | 200 |
  | `nodes/any(x: x/techComponentLinks/any(it: …))` (nested lambda) | 500. `Could not resolve attribute 'x' of NodeAggregator`: the odata-mini alias-stack bug, see `2026-08-26-odata-relation-filter-sort-design.md` |
  | `data/isNeedAT eq true` | 500. `Could not interpret attribute 'isNeedAT' of basic-valued path …data`: jsonb is opaque to the JPQL path |

  So tc/artifact/version filtering fails twice over (nested lambda, then jsonb), and
  `isNeedAT` fails on jsonb. Only name search and name sort are available without
  backend work.
- **The `isNeedAT` write works.** `PATCH /api/v1/node-aggregator/{id}` with
  `{"nodeAggrType":"MICROSERVICE_NAME_AGGR","data":{"isNeedAT":false}}` persisted, and
  node membership was unchanged because `nodes` was absent. The row was then restored to
  `true`. Reconcile never touches an existing aggregator's `data`, so a toggled value
  survives every run.

## Decisions

| Decision | Rationale |
|---|---|
| Frontend only, server-paged (approach A) | Every column the page shows is already reachable in one existing call. Alternatives: fetching all 660 rows for client-side filtering costs about 3 MB per load; a flattened backend read model is the right home for the deferred filters but is too large for v1 |
| Filters: name search only | The only filter the backend supports today; see *Facts*. The user's fallback rule was "artifact/version, else name + isNeedAT", and `isNeedAT` failed for the same jsonb reason, so it is deferred with the rest |
| Group deployments by `node.environment` | User decision. `techComponent.environment` happens to agree today, but the node is the source of truth |
| `isNeedAT` is an inline toggle | User decision; the write is verified |
| New generalized `baseFilter` option on `createCrudApi` rather than a page-local fetch | `staticParams` uses `params.set`, so a `$filter` passed there would overwrite the user's filter. A fixed leading clause is a reusable need for any typed sub-resource |
| Plain `useDataTable`, not the switchable simple/advanced page | With one filter, an advanced mode has nothing to offer |
| `Checkbox` for the toggle | The existing primitive; no new shadcn component |

## Components

### `src/lib/api/create-crud-api.ts` — `baseFilter`

New option `baseFilter?: string`, an OData boolean expression. When set:

- `fetchDataTable`: the final `$filter` is `baseFilter` alone, or
  `baseFilter and (<built filter>)` when `buildFilterParams` produced one. The built filter
  is parenthesized so an `or` inside it cannot escape, and `baseFilter` goes first so a
  trailing `any()` lambda stays last, as the odata-mini rule requires.
- `fetchList`: the same, combined with a caller-supplied `$filter` if there is one.
- `staticParams` is applied as before. A `$filter` key in `staticParams` is not
  supported alongside `baseFilter`, and the JSDoc says so.

Existing callers pass no `baseFilter`, so their output is byte-identical.

### `src/types/api.ts`

Trimmed to the fields the page reads, following the Flat/Full DTO naming already in the
file:

```ts
export interface MicroserviceNameAggrData { isNeedAT: boolean }

export interface NodeTechComponentLinkDto {
  id: number;
  techComponent?: { id: number; name: string; environment: string };
  data: { artifactId?: string; version?: string };
}

export interface AggrNodeDto {
  id: number;
  name: string;
  environment: string;
  techComponentLinks?: NodeTechComponentLinkDto[];
}

export interface MicroserviceNameAggrDto {
  id: number;
  name: string;
  nodeAggrType: "MICROSERVICE_NAME_AGGR";
  data: MicroserviceNameAggrData;
  nodes?: AggrNodeDto[];
}

export interface MicroserviceNameAggrPatch {
  nodeAggrType: "MICROSERVICE_NAME_AGGR";
  data: MicroserviceNameAggrData;
}
```

No link or tech-component type exists in `src/` yet (checked), so these are new.

### `src/features/microservice-at/`

- **`api.ts`** calls `createCrudApi<MicroserviceNameAggrDto, …, MicroserviceNameAggrPatch>`
  with:
  - `basePath: "/api/v1/node-aggregator"`, `listPath: "/api/v1/node-aggregator/graph"`;
  - `queryKey: ["microservice-at"]`;
  - `baseFilter: "nodeAggrType eq 'MICROSERVICE_NAME_AGGR'"`;
  - `staticParams: { $fields: "nodes,nodes.techComponentLinks,nodes.techComponentLinks.techComponent" }`.

  It exports `microserviceAtApi` with `dataTableQueryOptions` and `patch`.
- **`search.ts`**: `validateMicroserviceAtSearch` (page/pageSize/sort/name validation —
  `page` must be a positive integer or falls back to `1`; `pageSize` must be one of
  `PAGE_SIZE_STEPS` from `@/lib/data-table` or falls back to `undefined`; `sort` is
  restricted to the allowed `name.asc`/`name.desc`), the `microserviceAtFilterDescriptors`
  (`[{ id: "name", variant: "text" }]`), and `deriveColumnFilters(search)`, which maps
  `search.name` to the `name` column filter. This is where `filter-descriptors.ts` and a
  separate `deriveColumnFiltersFromSearch` would have lived in an earlier sketch of the
  page; the implementation folded both into `search.ts` alongside search validation,
  since they're all one small concern (URL search state -> table state).
- **`mappers.ts`**:
  `toDeployments(row): Record<"IFT" | "UAT" | "PROD", Deployment[]>`, where
  `Deployment = { tc: string; artifact: string; version: string }`.
  - It groups by **`node.environment`**, flattening each node's `techComponentLinks`.
  - Environments outside IFT/UAT/PROD (e.g. DEV) are dropped.
  - Entries within an environment are sorted by `tc`, then `artifact`.
  - A missing `artifactId`/`version`/`techComponent` becomes `""`. Under the no-null
    standard `""` means unset, and the cell renders it with `dash()`.
  - A pure function with no React.
- **`columns.tsx`**:

  | id | header | cell | sort / filter |
  |---|---|---|---|
  | `name` | Microservice | name; pinned left | sortable; text filter |
  | `ift`, `uat`, `prod` | IFT / UAT / PROD | one line per deployment: `tc:` muted, then `artifact - version` in mono; `dash()` for an empty environment | neither |
  | `isNeedAT` | Need AT | `Checkbox` bound to `data.isNeedAT` | neither |
  | `at` | AT | `dash()` placeholder | neither |

  `toDeployments` runs once per row (memoized by row object), not once per environment
  cell. The toggle handler reaches the columns through a `getMicroserviceAtColumns({
  onToggleNeedAT, isPending })` factory argument, where `isPending: (id: number) =>
  boolean` is a stable getter (backed by a ref inside `useToggleNeedAT`), not a `Set`.
  That keeps `getMicroserviceAtColumns`'s result referentially stable across a toggle's
  pending-state changes — see *Toggle data flow* below for why that matters.

### `src/routes/microservice-at/index.tsx`

- `validateSearch` accepts `page`, `pageSize`, `sort` and `name`. `sort` is accepted only
  when its field is `name`; anything else is dropped, so a hand-edited URL cannot reach
  `$orderby`. That is the guard the odata-mini notes call for.
- `loaderDeps`: the search. The loader runs `queryClient.ensureQueryData(...)`, and the
  component reads with `useSuspenseQuery`, following the project's route-loader
  convention.
- `useDataTable` feeds `DataTable` and `DataTableToolbar` (the toolbar renders the name
  search from the column's text-filter meta). The default sort is `name asc` when `sort`
  is absent.
- The header reads **Microservices & AT**, with the subtitle `{count} microservices`.

### Sidebar

A new entry in `app-sidebar.tsx` after Flows: `{ to: "/microservice-at", label:
"Microservices & AT", icon: <a lucide icon, e.g. Boxes> }`.

## Toggle data flow

1. The user clicks the checkbox on row `id`.
2. `useMutation` → `microserviceAtApi.patch(id, { nodeAggrType: "MICROSERVICE_NAME_AGGR",
   data: { isNeedAT: next } })`.
3. `onMutate`: add `id` to `pendingIds` (which disables that checkbox), then cancel
   in-flight queries and write `next` into the row optimistically — both scoped to the
   `["microservice-at", "table", …]` sub-key (the `dataTableQueryOptions` cache entries),
   not the root `["microservice-at"]` key. The `cancelQueries` call also carries
   `predicate: (q) => q.state.data !== undefined`, so a page the route loader is
   fetching for the first time is never cancelled. Without that scoping and predicate, a
   toggle fired during a route transition could cancel the loader's first-time
   `ensureQueryData` fetch; query-core 5.90's cancel-with-revert on a query with no data
   rethrows `CancelledError` instead of resolving, which fails `ensureQueryData` and trips
   the route's error boundary. Before writing the optimistic value, `onMutate` records
   only that row's own previous `isNeedAT` (not a snapshot of the whole cached page) —
   this is the rollback state used in step 4.
4. `onError`: roll back just the failed row to the `isNeedAT` value recorded in step 3
   (same table-subkey scoping), and show a `sonner` error toast with `ApiError.message`.
   The rollback is row-scoped, not a whole-page snapshot restore: two toggles can be in
   flight on different rows of the same page at once, and restoring the whole page on one
   failure would silently revert the other row's still-pending or already-settled
   optimistic write.
5. `onSettled`: remove `id` from `pendingIds` and invalidate the root `["microservice-at"]`
   key (invalidation, unlike cancellation, is safe on a query with no data, so it does not
   need the sub-key/predicate treatment).

A user without `UPDATE` gets a 403. That takes the `onError` path: rollback plus toast.
The checkbox is not hidden or disabled up front for such users in v1.

The Need AT checkbox's disabled state reads pending status through a stable `isPending(id)`
getter, backed by a ref inside `useToggleNeedAT` (not a `Set` passed straight through), so
that `getMicroserviceAtColumns`'s result — and therefore the route's `columns` array — stays
referentially stable while a toggle is pending. This matters because `useDataTable`'s
`urlColumnFilters` depends on `columns` and resets local column filters when it changes; a
new `columns` array on every toggle would wipe a name search typed shortly before the click.
The checkbox still re-renders as disabled: toggling updates React state inside
`useToggleNeedAT`, which re-renders the route component and, since `DataTable` is a plain,
unmemoized component, re-renders the table body, so each cell's `isPending(id)` call reads
the current ref value on that render even though `columns` itself never changed.

## Error handling

- A list-load failure goes to the route's error boundary, as on the other table pages.
  Every backend error surfaces as an empty 403 (see the odata-mini notes), so the toast and
  boundary text are generic, and the real cause is in the server log.
- A malformed `sort` is stripped in `validateSearch` and never reaches the server.

## Testing

- **Vitest, `mappers.test.ts`**:
  - groups by `node.environment`, including a fixture where node and tc environments
    disagree; node wins;
  - drops unknown environments;
  - maps missing `artifactId`/`version`/`techComponent` to `""`;
  - sorts by tc, then artifact;
  - returns all three keys with empty arrays for an aggregator with no nodes.
- **Vitest, `create-crud-api` `baseFilter`**:
  - emitted alone when no column filter exists;
  - `base and (built)` when one does;
  - a `multiRelation` lambda still comes last;
  - output unchanged when `baseFilter` is not set.
- **Vitest, `search.test.ts`**: `validateMicroserviceAtSearch` and `deriveColumnFilters`,
  including `page`/`pageSize` validation (non-integer or negative `page` -> `1`; a
  `pageSize` outside `PAGE_SIZE_STEPS` -> `undefined`).
- **No unit test for `useToggleNeedAT`** (the optimistic-update/rollback hook): the repo
  has no React testing library or DOM test environment (vitest runs under `node`, not
  `jsdom`/`happy-dom`), and adding one is out of scope for this page. The hook's
  behavior is covered indirectly by `mappers.test.ts`'s `setNeedAT` tests (the pure
  function it delegates the cache write to) and by the live check below.
- **`npx tsc -b`, `npm run lint`, `npm test`.**
- **Live check** in the browser against the local backend:
  - the page loads with 660 rows counted;
  - name search narrows the rows (`positions` → 54);
  - sorting flips;
  - an `isNeedAT` toggle survives a reload, and is then restored.

## Known gaps / future work

- **Filters on tc, artifact, version and `isNeedAT`** need backend support. The natural
  shape is a flattened read model (a view or dedicated endpoint over mc, env, tc,
  artifact, version and `isNeedAT`) in its own backend spec. A lighter option for
  `isNeedAT` alone is a read-only queryable attribute (e.g. a Hibernate `@Formula` over
  `data->>'isNeedAT'`), but whether odata can reach a formula on a SINGLE_TABLE subtype
  queried from the `NodeAggregator` root is unproven.
- **The AT link column** is a placeholder until the link exists in the DB.
- **Payload weight**: each node carries its full config `data`. That is acceptable at page
  size 20 (about 78 KB). If it becomes a problem, the fix is a backend field projection,
  not a frontend workaround.
- **PROD is empty** until PROD microservice nodes are loaded. This is a data state, not a
  bug.
- **The PATCH sends the whole `data` object.** `microserviceAtApi.patch(id, {
  nodeAggrType: "MICROSERVICE_NAME_AGGR", data: { isNeedAT } })` sends `data` as a
  complete object, not a per-key merge patch. If the backend ever replaces the
  aggregator's `data` jsonb column wholesale on PATCH rather than merging it, any other
  key that gets added to `data` in the future would be silently wiped by an `isNeedAT`
  toggle. This is fine today because `isNeedAT` is the only key `data` carries; revisit
  the write shape (e.g. a dedicated merge endpoint, or reading-then-merging client-side)
  if `data` grows a second key.

## Related

- `cometa/docs/superpowers/specs/2026-09-22-microservice-name-aggr-reconcile-design.md`:
  where the rows come from.
- `docs/superpowers/specs/2026-09-15-node-aggregator-entity-design.md`: the entity and the
  `nodes` relation.
- `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`: the `any()`
  rules and the nested-lambda failure.
- `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md`: `""` as unset and
  `dash()`.
