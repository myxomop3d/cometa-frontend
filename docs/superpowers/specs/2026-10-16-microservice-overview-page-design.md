# Microservice overview page — design

Date: 2026-10-16
Repos: `cometa` (backend: new read endpoint) and `cometa-frontend` (new page)
Status: approved design, not yet implemented

## Goal

A table page, **Microservice overview**, with one row per `MICROSERVICE` node, that
lets a user:

1. find microservices by the `artifactId` of their deployments
   (`node_tech_component_link.data.artifactId`, e.g. `kafka-payload-kafka`);
2. see the `TOPIC`s each microservice consumes from or produces to;
3. find microservices by the name of a linked topic (e.g. `CALYPSO.PAYMENTS`);
4. see which `tech_component`s a microservice is deployed on;
5. filter microservices by environment.

Target shape:

| Microservice | Env | Deployments | Topics | Flows |
|---|---|---|---|---|
| calypso-payments-zeus-out | IFT | `ift-k8s-bk2:` `kafka-payload-kafka - 6.0.2_m121j25r` | ← CALYPSO.PAYMENTS<br>→ CALYPSO.PAYMENTS.ZEUS | Поток PAYMENTS из АС в Alpha (link) |

## Scope

**In scope:** a backend read endpoint with native SQL; a frontend page with
server-side filtering, sorting and paging; topic direction arrows; flow links to the
flow-graph page; a sidebar entry; unit tests on both sides; a live pass.

**Out of scope:** filtering by tech component (display only, user decision); filtering
by topic direction; links that bypass the EGRESS pairing (see *Facts*); any DDL or
index; any change to the **Microservices & AT** page, which stays as is.

## Facts established live (2026-10-16)

Against the development database (`gmsb`).

- **One row = one node.** `MICROSERVICE` nodes are unique on `(name, environment)`:
  1812 nodes — IFT 674, UAT 551, PROD 587. Every node currently has exactly one
  `node_tech_component_link`. The model allows several; the page renders a list.
- **The canonical topic path** is two links sharing one `cross_guid`:
  `MICROSERVICE —l→ EGRESS` and `EGRESS —l2→ TOPIC`, joined
  `l.client_node_id = m.id`, `l2.cross_guid = l.cross_guid AND l2.id <> l.id`,
  `l2.server_node_id = t.id`. 1596 pairs over 982 microservices and 995 topics. Every
  `cross_guid` group has exactly two links.
- **Flow comes from the same join.** `l.flow_id = l2.flow_id` on all 1596 pairs; none
  is null.
- **Direction comes from the same join.** `l.data_flow_direction =
  l2.data_flow_direction` on every pair; values are `COUNTERDIRECTIONAL` (867) and
  `CODIRECTIONAL` (729), all `protocol = KAFKA`.
- **Unpaired links are a data issue, ignored here.** 183 direct MS→TOPIC links and
  227 INGRESS→MS links have no `cross_guid` partner. User decision: DB problem,
  recorded in `issue/wrongLinksInDb.md`; the page reads only the canonical path.
- **OData cannot serve the filters.** `artifactId` is jsonb inside a to-many relation
  and the topic filter is a `cross_guid` self-join, which is not a JPA relation at all.
  Combining two to-many filters needs two `any()` clauses, which odata-mini 2.2.0
  forbids (it corrupts every clause after the first `any()`). See
  `2026-09-23-microservices-at-page-design.md`, *Facts*.

## Decisions

| Decision | Rationale |
|---|---|
| New page, one row per node (name + env) | User decision. Microservices & AT (one row per name) is untouched |
| Dedicated read endpoint with native SQL (approach A) | The only shape that supports combined to-many and jsonb filters. Rejected: a DB view plus an OData relation (still needs two `any()` and a jsonb path); client-side filtering (topics are unreachable through any existing endpoint, and the payload runs to megabytes) |
| Text filters are case-insensitive substrings | User decision. `CALYPSO.PAYMENTS` matches `CALYPSO.PAYMENTS.ZEUS` too |
| Tech component is display only | User decision |
| Direction is translated on the server to `CONSUME` / `PRODUCE` | The frontend does not need to know the link-direction vocabulary |
| Topic shown with a coloured arrow before its name | User decision: green `←` = `COUNTERDIRECTIONAL` (consumes), red `→` = `CODIRECTIONAL` (produces) |
| Keep `$top` / `$skip` / `$orderby` names for paging and sort | The frontend's existing paging and sort serialization work unchanged. Filters are plain params because they are not OData |
| Not `createCrudApi` on the frontend | It builds OData `$filter`; this endpoint takes plain params |
| No DDL, no index | ~1.8k nodes and ~3.4k links. Revisit with a trigram index only if measured slow |

## Backend (`cometa`)

### Contract

```
GET /api/v1/microservice-overview
    ?name=<text>          case-insensitive substring on node.name
    &env=IFT&env=UAT      repeatable; exact; each in IFT|UAT|PROD|DEV
    &artifactId=<text>    case-insensitive substring on any link's data->>'artifactId'
    &topic=<text>         case-insensitive substring on any canonically linked TOPIC name
    &$top=20&$skip=0      $top defaults to 20; $skip to 0
    &$orderby=name asc    field in {name, environment}; direction in {asc, desc}
→ 200 ResultObj<List<MicroserviceOverviewDto>>, count = total matching rows
→ 400 on an unknown $orderby field/direction, an unknown env, or a negative $top/$skip
```

All filters are optional and combine with AND. A blank text filter counts as absent.
Secured by the existing `anyRequest().authenticated()`; it is read-only, so no
authority check.

### DTO

```java
public record MicroserviceOverviewDto(
        long id,
        String name,
        String environment,
        List<Deployment> deployments,
        List<TopicRef> topics,
        List<FlowRef> flows) {

    public record Deployment(long techComponentId, String techComponentName,
                             String artifactId, String version) {}

    public enum TopicDirection { CONSUME, PRODUCE }

    public record TopicRef(long id, String name, TopicDirection direction) {}

    public record FlowRef(long id, String caption) {}
}
```

- **deployments**: sorted by `techComponentName`, then `artifactId`. A missing
  `artifactId` / `version` key is `""`, per the no-null standard.
- **topics**: distinct by `(id, direction)`, so a topic both consumed and produced
  appears twice. `CONSUME` first, then `PRODUCE`, each sorted by name.
  `COUNTERDIRECTIONAL → CONSUME`, `CODIRECTIONAL → PRODUCE`. Any other value is
  impossible today (see *Facts*). If one appears it is skipped and logged at WARN, so
  one bad row cannot fail the page.
- **flows**: distinct by id, sorted by caption.

### Components

Layout follows the existing modules and the reconcile precedent
(`MicroserviceNameAggrReconcileRepository`: native SQL through `EntityManager`).

- **`MicroserviceOverviewFilter`** (service module): a record holding `name`, `envs`,
  `artifactId`, `topic`, `top`, `skip`, `sortField`, `sortDir`. It is built and
  validated by the controller.
- **`MicroserviceOverviewQuery`** (persistence module): a pure class with no
  `EntityManager`. It turns a filter into:
  - a WHERE fragment containing only the clauses whose filter is present;
  - a `Map<String, Object>` of bound parameters;
  - an `ORDER BY` built from the whitelist only: `n.name` or `n.environment`, then
    `n.id` as a stable tie-breaker.

  User text never enters the SQL string. `%`, `_` and `\` in text filters are escaped
  and the clause uses `ILIKE :p ESCAPE '\'`.
- **`MicroserviceOverviewRepository`** (persistence module): runs four native
  statements:
  1. **page ids**:
     `SELECT n.id FROM gmsb.node n WHERE n.node_type = 'MICROSERVICE' <where> <order> LIMIT :top OFFSET :skip`
  2. **count**: `SELECT count(*) FROM gmsb.node n WHERE …` with the same WHERE and
     params.
  3. **deployments**: `node_tech_component_link ntl JOIN tech_component tc` on
     `ntl.node_id IN (:ids)`, selecting `node_id, tc.id, tc.name,
     ntl.data->>'artifactId', ntl.data->>'version'`.
  4. **topics and flows**: the canonical join restricted to `m.id IN (:ids)`, selecting
     `m.id, t.id, t.name, l.data_flow_direction, f.id, f.caption` (`JOIN gmsb.flow f ON
     f.id = l.flow_id`).

  Statements 3 and 4 are skipped when the page is empty. The filter clauses:

  ```sql
  n.name ILIKE :name ESCAPE '\'
  n.environment IN (:envs)
  EXISTS (SELECT 1 FROM gmsb.node_tech_component_link ntl
           WHERE ntl.node_id = n.id
             AND ntl.data->>'artifactId' ILIKE :artifactId ESCAPE '\')
  EXISTS (SELECT 1 FROM gmsb.link l
            JOIN gmsb.link l2 ON l2.cross_guid = l.cross_guid AND l2.id <> l.id
            JOIN gmsb.node t  ON t.id = l2.server_node_id AND t.node_type = 'TOPIC'
           WHERE l.client_node_id = n.id
             AND t.name ILIKE :topic ESCAPE '\')
  ```

  As in the reconcile repository: `@NonFinal @PersistenceContext EntityManager`, and
  `CAST(... AS ...)` rather than `::` wherever a cast is needed, since Hibernate reads
  `:x` as a named parameter.
- **`MicroserviceOverviewService`** (service module): `@Transactional(readOnly =
  true)`. Runs the repository, groups rows 3 and 4 by node id, applies the ordering and
  distinctness rules from *DTO*, and keeps the page order from statement 1. Returns
  the rows plus the count.
- **`MicroserviceOverviewController`** (web module): `@GetMapping` on
  `/api/${application.api.version}/microservice-overview`. Parses `$orderby` (`<field>
  [asc|desc]`, default `name asc`) and `env`, validates them, builds the filter, and
  answers with `ResponseFactory.create(HttpStatus.OK, resultObj)` with the count set,
  like `ODataEntityGraphReadApi`. Validation failures answer 400.

Cost per page: four statements regardless of page size. No N+1, and node `data` (the
full config YAML) is never read.

## Frontend (`cometa-frontend`)

Same skeleton as the **Microservices & AT** page: plain `useDataTable` with the simple
toolbar, a route loader with `ensureQueryData`, `useSuspenseQuery` in the component,
and the URL search as the single source of truth.

### `src/features/microservice-overview/`

- **`types.ts`**: TypeScript mirrors of the DTO;
  `TopicDirection = "CONSUME" | "PRODUCE"`.
- **`search.ts`**:
  - `MicroserviceOverviewSearch = { page; pageSize; sort; name?; env?; artifactId?;
    topic? }`, a type alias as `useDataTable` requires.
  - `validateMicroserviceOverviewSearch`:
    - `page`: a positive integer, else `1`;
    - `pageSize`: one of `PAGE_SIZE_STEPS`, else `undefined`;
    - `sort`: one of `name.asc|desc` or `environment.asc|desc`, else `name.asc`;
    - `env`: keeps known values only; empty becomes `undefined`;
    - empty strings are dropped.
  - `microserviceOverviewFilterDescriptors` and `deriveColumnFilters(search)`, mapping
    search keys to column ids (`name→name`, `env→environment`,
    `artifactId→deployments`, `topic→topics`).
- **`api.ts`**:
  - `buildMicroserviceOverviewParams(search): URLSearchParams`, a pure function that
    emits repeated `env`, `$top`/`$skip` from page/pageSize, `$orderby` from the sort,
    and nothing for absent filters;
  - `microserviceOverviewQueryOptions(search)`, keyed
    `["microservice-overview", "table", search]`, calling the shared `apiFetch` and
    returning `ApiResponse<MicroserviceOverviewDto[]>`.
- **`columns.tsx`**:

  | id | header | cell | sort / filter |
  |---|---|---|---|
  | `name` | Microservice | name; pinned left | sortable; text filter → `name` |
  | `environment` | Env | `Badge` | sortable; multiSelect IFT/UAT/PROD/DEV → `env` |
  | `deployments` | Deployments | per deployment: `tc:` muted, then `artifactId - version` in mono, one line each | text filter labelled "artifactId" → `artifactId` |
  | `topics` | Topics | one line per topic: `ArrowLeft` green-600 for `CONSUME`, `ArrowRight` red-600 for `PRODUCE`, each with `aria-label` and `title` ("consumes" / "produces"); then the name in mono | text filter labelled "topic" → `topic` |
  | `flows` | Flows | one `<Link to="/flow-graph" search={{ flowId, env: row.environment }}>` per flow, showing its caption | neither |

  An empty list renders `dash()` from `@/lib/format`.

### Route and sidebar

- **`src/routes/microservice-overview/index.tsx`**: `validateSearch`, `loaderDeps:
  search`, the loader, `useDataTable` with `initialColumnPinning: { left: ["name"] }`,
  `DataTable` + `DataTableToolbar`. The header is **Microservice overview** with the
  subtitle `{count} microservices`.
- **Sidebar**: an entry after "Microservices & AT":
  `{ to: "/microservice-overview", label: "Microservice overview", icon: Waypoints }`.

The flow-graph route accepts `env` in DEV/IFT/UAT/PROD, a superset of the node
environments, so passing the row's env is safe.

## Error handling

- A list-load failure goes to the route's error boundary, as on the other pages.
- A malformed `sort` or `env` is stripped by `validateSearch` and never reaches the
  backend's 400. The 400 guards hand-made API calls.
- An unexpected `data_flow_direction` is skipped and logged at WARN (see *DTO*).

## Testing

### Backend (plain JUnit + Mockito, as the reconcile tests do; no DB in CI)

- **`MicroserviceOverviewQueryTest`**: no filters; each filter alone; all four
  together; `envs` with several values; wildcard escaping (`a_b%c\` binds as
  `%a\_b\%c\\%`); each sort field and direction plus the `n.id` tie-breaker; and that
  the SQL string never contains filter text.
- **`MicroserviceOverviewServiceTest`** (mocked repository):
  - rows group onto the right node, and page order is preserved;
  - topics are distinct by `(id, direction)`, `CONSUME` before `PRODUCE`, sorted by
    name;
  - the direction mapping, and an unknown direction is skipped;
  - flows are distinct and sorted;
  - a missing `artifactId`/`version` becomes `""`;
  - a node with no links gets empty lists;
  - an empty page skips statements 3 and 4.
- **`MicroserviceOverviewControllerTest`**: a bad `$orderby` field or direction, an
  unknown `env`, or a negative `$top`/`$skip` gives 400; a valid call passes the
  filter through and sets the count.
- **Build gate**: root `mvnw clean install`, then confirm no generated `*MapperImpl`
  lost its `implements` (known build corruption). No mapper is added, but the check is
  cheap.
- **SQL is verified live**, not in CI (the reconcile precedent).

### Frontend

- **Vitest `search.test.ts`**: the sort whitelist, `env` filtering, empty-string
  dropping, page/pageSize fallbacks, `deriveColumnFilters`.
- **Vitest `api.test.ts`**: `buildMicroserviceOverviewParams` emits repeated `env`,
  `$top`/`$skip`/`$orderby`, and omits absent filters.
- `npx tsc -b`, `npm run lint`, `npm test`.

### Live pass (both servers, test user `16674475`)

1. With no filters, the count is 1812.
2. `env=PROD` gives 587.
3. `artifactId=kafka-payload-kafka` includes `calypso-payments-zeus-out` on IFT, UAT
   and PROD.
4. `topic=CALYPSO.PAYMENTS` narrows the rows, and each matching row lists that topic.
   One row's arrows are cross-checked against `data_flow_direction` in SQL.
5. Combined `env` + `topic` + `artifactId` returns the SQL-computed intersection.
6. Sorting by name and by environment flips, and paging works.
7. A flow link opens `/flow-graph` with that flow and env selected.
8. The p6spy log shows four statements per page load.

## Known gaps / future work

- **Unpaired links** (`issue/wrongLinksInDb.md`) are invisible on this page until the
  data is fixed or they are declared legitimate, in which case the read model gets a
  second topic path.
- **Filter by direction** or by tech component: easy additions to
  `MicroserviceOverviewQuery`, deferred as not requested.
- **Performance**: sequential `ILIKE` and `EXISTS` scans are fine at this size. If it
  measures slow, the first step is one `pg_trgm` GIN index on `node.name`, which
  covers both the name and the topic filter, since topics are nodes too.
- **Microservices & AT** still lacks its deferred tc/artifact filters. This endpoint is
  per node, not per name, so it does not serve that page directly. Reusing
  `MicroserviceOverviewQuery`'s clauses there would be a separate change.

## Related

- `docs/superpowers/specs/2026-09-23-microservices-at-page-design.md`: the sibling page
  and the OData limits.
- `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`: the
  `any()` rules.
- `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md`: `""` as unset
  and `dash()`.
- `cometa/docs/superpowers/specs/2026-09-22-node-tech-component-link-design.md`: the
  `node_tech_component_link` table and its jsonb `data`.
- `issue/wrongLinksInDb.md`: the excluded link shapes.
