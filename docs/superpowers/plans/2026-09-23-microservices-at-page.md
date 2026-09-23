# Microservices & AT Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server-paged table page, "Microservices & AT". Each row is one `MICROSERVICE_NAME_AGGR` aggregator and shows the microservice name, its `tc: artifact - version` deployments per IFT/UAT/PROD, an inline `isNeedAT` toggle, and a placeholder AT column.

**Architecture:** Frontend only. `createCrudApi` gains a general `baseFilter` option that is always ANDed in *first*, so every request is pinned to `nodeAggrType eq 'MICROSERVICE_NAME_AGGR'`. The list reads `/api/v1/node-aggregator/graph` with nested `$fields`. A pure mapper groups each row's `nodes[].techComponentLinks[]` by **`node.environment`**. The page follows the route-loader + `useSuspenseQuery` convention with plain `useDataTable`, not the switchable page. The toggle is a `useMutation` with an optimistic cache write and rollback.

**Tech Stack:** React 19, TypeScript 5.9, TanStack Router/Query/Table, shadcn/ui on `@base-ui/react`, sonner, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-23-microservices-at-page-design.md`

## Global Constraints

- No backend change. Endpoints used: `GET /api/v1/node-aggregator/graph`, `PATCH /api/v1/node-aggregator/{id}`.
- Base filter literal, exactly: `nodeAggrType eq 'MICROSERVICE_NAME_AGGR'`.
- `$fields` literal, exactly: `nodes,nodes.techComponentLinks,nodes.techComponentLinks.techComponent`.
- PATCH body, exactly: `{ "nodeAggrType": "MICROSERVICE_NAME_AGGR", "data": { "isNeedAT": <boolean> } }`. Never send `nodes`: absent means membership unchanged. Never send `null` (no-null write standard).
- Group deployments by `node.environment`, never `techComponent.environment`. Only `IFT`, `UAT`, `PROD` are shown; any other environment is dropped.
- Only `name` is filterable (text, `contains_ignoring_case`) and sortable. `sort` values other than `name.asc`/`name.desc` must never reach `$orderby`.
- Render empty values with `dash()` from `@/lib/format`.
- Route path `/microservice-at`, page title `Microservices & AT`, sidebar label `Microservices & AT`, placed after `Flows`.
- `src/routeTree.gen.ts` is generated. Never hand-edit it; regenerate it with `npx vite build`.
- Type-check with `npx tsc -b`. A bare `npx tsc --noEmit` checks nothing in this repo.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/api/create-crud-api.ts` | modify | add `baseFilter` option + `withBaseFilter` helper |
| `src/lib/api/create-crud-api.test.ts` | create | `baseFilter` tests (stubbed `fetch`) |
| `src/types/api.ts` | modify | aggregator/node/link DTOs + PATCH payload |
| `src/features/microservice-at/mappers.ts` | create | `toDeployments`, `toMicroserviceAtRow`, `setNeedAT` (pure) |
| `src/features/microservice-at/mappers.test.ts` | create | mapper tests |
| `src/features/microservice-at/search.ts` | create | URL search validation + `deriveColumnFilters` |
| `src/features/microservice-at/search.test.ts` | create | search tests |
| `src/features/microservice-at/api.ts` | create | `microserviceAtApi` (createCrudApi config) |
| `src/features/microservice-at/columns.tsx` | create | column defs + deployment cell |
| `src/features/microservice-at/use-toggle-need-at.ts` | create | toggle mutation hook |
| `src/routes/microservice-at/index.tsx` | create | route: search, loader, page |
| `src/components/app-sidebar.tsx` | modify | nav entry |

---

### Task 1: `baseFilter` option on `createCrudApi`

**Files:**
- Modify: `src/lib/api/create-crud-api.ts` (options interface around lines 55-70, `fetchList` lines 79-95, `fetchDataTable` lines 124-138)
- Test: `src/lib/api/create-crud-api.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CreateCrudApiOptions.baseFilter?: string`. When set, every list request's `$filter` is `baseFilter`, or `` `${baseFilter} and (${built})` `` when another filter exists. Existing callers are unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/create-crud-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCrudApi } from "./create-crud-api";

const BASE = "nodeAggrType eq 'MICROSERVICE_NAME_AGGR'";

function stubFetch() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo, _init?: RequestInit) =>
      new Response(JSON.stringify({ count: 0, data: [], messages: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentParams(fetchMock: ReturnType<typeof stubFetch>): URLSearchParams {
  const url = String(fetchMock.mock.calls[0]![0]);
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
}

function makeApi(baseFilter?: string) {
  return createCrudApi<{ id: number }, Record<string, unknown>, object>({
    basePath: "/api/v1/thing",
    listPath: "/api/v1/thing/graph",
    queryKey: ["thing"],
    filterDescriptors: [
      { id: "name", variant: "text" },
      { id: "teams", variant: "multiRelation" },
    ],
    staticParams: { $fields: "nodes" },
    baseFilter,
  });
}

const page = { page: 1, pageSize: 20, sort: undefined };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCrudApi baseFilter", () => {
  it("sends the base filter alone when no column filter is set", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({ ...page, columnFilters: [] });
    expect(sentParams(fetchMock).get("$filter")).toBe(BASE);
  });

  it("puts the base filter first and parenthesizes the built filter", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({
      ...page,
      columnFilters: [{ id: "name", value: "pos" }],
    });
    expect(sentParams(fetchMock).get("$filter")).toBe(
      `${BASE} and (contains_ignoring_case(name, 'pos'))`,
    );
  });

  it("keeps a collection any() lambda last", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({
      ...page,
      columnFilters: [
        { id: "teams", value: [1, 2] },
        { id: "name", value: "pos" },
      ],
    });
    const filter = sentParams(fetchMock).get("$filter")!;
    expect(filter.startsWith(`${BASE} and (contains_ignoring_case(name, 'pos') and `)).toBe(true);
    expect(filter).toMatch(/any\([^)]*\)\)\)$/);
  });

  it("is not overwritten by staticParams", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({ ...page, columnFilters: [] });
    const params = sentParams(fetchMock);
    expect(params.get("$fields")).toBe("nodes");
    expect(params.get("$filter")).toBe(BASE);
  });

  it("applies to fetchList, combined with a caller $filter", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchList({ $filter: "id eq 5" });
    expect(sentParams(fetchMock).get("$filter")).toBe(`${BASE} and (id eq 5)`);
  });

  it("changes nothing when baseFilter is not set", async () => {
    const fetchMock = stubFetch();
    await makeApi().fetchDataTable({
      ...page,
      columnFilters: [{ id: "name", value: "pos" }],
    });
    expect(sentParams(fetchMock).get("$filter")).toBe(
      "contains_ignoring_case(name, 'pos')",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/api/create-crud-api.test.ts`
Expected: FAIL. `tsc` in the editor flags `baseFilter` as an unknown option. At runtime the "base filter alone" test fails: `expected null to be "nodeAggrType eq 'MICROSERVICE_NAME_AGGR'"`. The "changes nothing" test passes.

If the "keeps a collection any() lambda last" regex fails even after Step 3, print the actual `$filter`, check the `multiRelation` clause shape in `src/lib/odata/build-filter-params.ts`, and adjust **only the regex** to that shape. The assertion's intent is: the base comes first, the text clause comes second, and the lambda closes the string.

- [ ] **Step 3: Implement**

In `src/lib/api/create-crud-api.ts`, add to `CreateCrudApiOptions` right after `staticParams`:

```ts
  /** OData boolean expression ANDed into every list request's `$filter`,
   *  e.g. `nodeAggrType eq 'MICROSERVICE_NAME_AGGR'` to pin a polymorphic
   *  resource to one subtype. Emitted FIRST: odata-mini corrupts the root
   *  alias for every clause after an `any()` lambda, so the lambda must stay
   *  last. Any other filter is parenthesized so an `or` inside it cannot
   *  escape. Do not also pass `$filter` in `staticParams`: it would be
   *  combined, not replaced. */
  baseFilter?: string;
```

Add this helper above `export function createCrudApi`:

```ts
function withBaseFilter(params: URLSearchParams, baseFilter: string | undefined) {
  if (!baseFilter) return;
  const built = params.get("$filter");
  params.set("$filter", built ? `${baseFilter} and (${built})` : baseFilter);
}
```

Destructure `baseFilter` in the `createCrudApi` parameter list:

```ts
>({ basePath, listPath, queryKey, filterDescriptors, staticParams, baseFilter }: CreateCrudApiOptions) {
```

In `fetchList`, after the `staticParams` loop and before `return`:

```ts
    withBaseFilter(params, baseFilter);
```

In `fetchDataTable`, after the `staticParams` loop and before `return`:

```ts
    withBaseFilter(searchParams, baseFilter);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/api/create-crud-api.test.ts`
Expected: PASS, 6 tests.

Run: `npm test`
Expected: the whole suite passes, since existing callers pass no `baseFilter`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/create-crud-api.ts src/lib/api/create-crud-api.test.ts
git commit -m "feat(api): baseFilter option on createCrudApi

A fixed clause ANDed first into every list \$filter, so a polymorphic
resource can be pinned to one subtype without staticParams overwriting
the user's filter. First keeps a trailing any() lambda last.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: DTO types and pure mappers

**Files:**
- Modify: `src/types/api.ts` (append at end of file)
- Create: `src/features/microservice-at/mappers.ts`
- Test: `src/features/microservice-at/mappers.test.ts`

**Interfaces:**
- Consumes: `ApiResponse<T>` from `@/types/api`.
- Produces:
  - types `MicroserviceNameAggrData`, `NodeTechComponentLinkDto`, `AggrNodeDto`, `MicroserviceNameAggrDto`, `MicroserviceNameAggrPatch` (in `@/types/api`);
  - from `@/features/microservice-at/mappers`:
    - `ENVIRONMENTS: readonly ["IFT","UAT","PROD"]`
    - `type Environment`
    - `interface Deployment { tc; artifact; version }` (all `string`)
    - `type DeploymentsByEnv = Record<Environment, Deployment[]>`
    - `toDeployments(row): DeploymentsByEnv`
    - `interface MicroserviceAtRow extends MicroserviceNameAggrDto { deployments: DeploymentsByEnv }`
    - `toMicroserviceAtRow(dto): MicroserviceAtRow`
    - `setNeedAT(page, id, isNeedAT): ApiResponse<MicroserviceNameAggrDto[]>`

- [ ] **Step 1: Add the types**

Append to `src/types/api.ts`:

```ts
// ── Node aggregator (MICROSERVICE_NAME_AGGR) ─────────────────────────────
// Read shape of GET /api/v1/node-aggregator/graph with
// $fields=nodes,nodes.techComponentLinks,nodes.techComponentLinks.techComponent.
// Trimmed to the fields the Microservices & AT page reads; the backend sends
// more (each node's full config `data`, timestamps, …).

export interface MicroserviceNameAggrData {
  isNeedAT: boolean;
}

export interface NodeTechComponentLinkDto {
  id: number;
  techComponent?: { id: number; name: string; environment: string } | null;
  /** Deployment parameters (jsonb). Only the two keys the page reads. */
  data: { artifactId?: string; version?: string } | null;
}

export interface AggrNodeDto {
  id: number;
  name: string;
  /** "IFT" | "UAT" | "PROD" | "DEV"; the source of truth for grouping. */
  environment: string;
  techComponentLinks?: NodeTechComponentLinkDto[] | null;
}

export interface MicroserviceNameAggrDto {
  id: number;
  name: string;
  nodeAggrType: "MICROSERVICE_NAME_AGGR";
  data: MicroserviceNameAggrData | null;
  nodes?: AggrNodeDto[] | null;
}

/** PATCH body. `nodeAggrType` is required (the DTO is polymorphic); `nodes`
 *  is deliberately absent so membership stays unchanged. */
export interface MicroserviceNameAggrPatch {
  nodeAggrType: "MICROSERVICE_NAME_AGGR";
  data: MicroserviceNameAggrData;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/microservice-at/mappers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AggrNodeDto, ApiResponse, MicroserviceNameAggrDto } from "@/types/api";
import { setNeedAT, toDeployments, toMicroserviceAtRow } from "./mappers";

function node(
  environment: string,
  links: { tc?: string; tcEnv?: string; artifactId?: string; version?: string }[],
): AggrNodeDto {
  return {
    id: Math.floor(Math.random() * 1e6),
    name: "svc",
    environment,
    techComponentLinks: links.map((l, i) => ({
      id: i,
      techComponent:
        l.tc === undefined
          ? null
          : { id: i, name: l.tc, environment: l.tcEnv ?? environment },
      data: { artifactId: l.artifactId, version: l.version },
    })),
  };
}

function aggr(nodes: AggrNodeDto[] | null, isNeedAT = true, id = 1): MicroserviceNameAggrDto {
  return { id, name: "svc", nodeAggrType: "MICROSERVICE_NAME_AGGR", data: { isNeedAT }, nodes };
}

describe("toDeployments", () => {
  it("groups by node.environment", () => {
    const result = toDeployments(
      aggr([
        node("IFT", [{ tc: "ift-k8s-bk1", artifactId: "a", version: "1" }]),
        node("UAT", [
          { tc: "psi-k8s-bk2", artifactId: "a", version: "1" },
          { tc: "psi-k8s-bk1", artifactId: "a", version: "1" },
        ]),
      ]),
    );
    expect(result.IFT).toEqual([{ tc: "ift-k8s-bk1", artifact: "a", version: "1" }]);
    expect(result.UAT.map((d) => d.tc)).toEqual(["psi-k8s-bk1", "psi-k8s-bk2"]);
    expect(result.PROD).toEqual([]);
  });

  it("uses node.environment when the tech component disagrees", () => {
    const result = toDeployments(
      aggr([node("UAT", [{ tc: "x", tcEnv: "PROD", artifactId: "a", version: "1" }])]),
    );
    expect(result.UAT).toHaveLength(1);
    expect(result.PROD).toEqual([]);
  });

  it("drops environments other than IFT/UAT/PROD", () => {
    const result = toDeployments(aggr([node("DEV", [{ tc: "x", artifactId: "a", version: "1" }])]));
    expect(result).toEqual({ IFT: [], UAT: [], PROD: [] });
  });

  it("maps missing techComponent, artifactId and version to empty strings", () => {
    const result = toDeployments(aggr([node("IFT", [{}])]));
    expect(result.IFT).toEqual([{ tc: "", artifact: "", version: "" }]);
  });

  it("maps a null link data to empty strings", () => {
    const n = node("IFT", [{ tc: "x" }]);
    n.techComponentLinks![0]!.data = null;
    expect(toDeployments(aggr([n])).IFT).toEqual([{ tc: "x", artifact: "", version: "" }]);
  });

  it("sorts by tc, then artifact", () => {
    const result = toDeployments(
      aggr([
        node("IFT", [
          { tc: "b", artifactId: "z", version: "1" },
          { tc: "a", artifactId: "y", version: "1" },
          { tc: "b", artifactId: "x", version: "1" },
        ]),
      ]),
    );
    expect(result.IFT.map((d) => `${d.tc}/${d.artifact}`)).toEqual(["a/y", "b/x", "b/z"]);
  });

  it("returns all three environments empty for an aggregator without nodes", () => {
    expect(toDeployments(aggr(null))).toEqual({ IFT: [], UAT: [], PROD: [] });
    expect(toDeployments(aggr([]))).toEqual({ IFT: [], UAT: [], PROD: [] });
  });
});

describe("toMicroserviceAtRow", () => {
  it("keeps the DTO fields and adds deployments", () => {
    const dto = aggr([node("IFT", [{ tc: "t", artifactId: "a", version: "1" }])]);
    const row = toMicroserviceAtRow(dto);
    expect(row.id).toBe(dto.id);
    expect(row.data).toEqual({ isNeedAT: true });
    expect(row.deployments.IFT).toHaveLength(1);
  });
});

describe("setNeedAT", () => {
  const page: ApiResponse<MicroserviceNameAggrDto[]> = {
    count: 2,
    messages: [],
    data: [aggr([], true, 1), aggr([], true, 2)],
  };

  it("changes only the matching row, immutably", () => {
    const next = setNeedAT(page, 2, false);
    expect(next.data[0]).toBe(page.data[0]);
    expect(next.data[1]!.data).toEqual({ isNeedAT: false });
    expect(page.data[1]!.data).toEqual({ isNeedAT: true });
    expect(next.count).toBe(2);
  });

  it("creates data when the row had none", () => {
    const nullData: ApiResponse<MicroserviceNameAggrDto[]> = {
      ...page,
      data: [{ ...aggr([], true, 7), data: null }],
    };
    expect(setNeedAT(nullData, 7, true).data[0]!.data).toEqual({ isNeedAT: true });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/features/microservice-at/mappers.test.ts`
Expected: FAIL with `Failed to resolve import "./mappers"`.

- [ ] **Step 4: Implement**

Create `src/features/microservice-at/mappers.ts`:

```ts
import type { ApiResponse, MicroserviceNameAggrDto } from "@/types/api";

export const ENVIRONMENTS = ["IFT", "UAT", "PROD"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** One `tc: artifact - version` line. `""` means unset; render with dash(). */
export interface Deployment {
  tc: string;
  artifact: string;
  version: string;
}

export type DeploymentsByEnv = Record<Environment, Deployment[]>;

export interface MicroserviceAtRow extends MicroserviceNameAggrDto {
  deployments: DeploymentsByEnv;
}

function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Deployments of one microservice, per environment. Grouped by
 * `node.environment` — the node is the source of truth, even though
 * `techComponent.environment` agrees on every link today. Environments other
 * than IFT/UAT/PROD (e.g. DEV) are dropped.
 */
export function toDeployments(
  row: Pick<MicroserviceNameAggrDto, "nodes">,
): DeploymentsByEnv {
  const result: DeploymentsByEnv = { IFT: [], UAT: [], PROD: [] };
  for (const node of row.nodes ?? []) {
    if (!isEnvironment(node.environment)) continue;
    for (const link of node.techComponentLinks ?? []) {
      result[node.environment].push({
        tc: link.techComponent?.name ?? "",
        artifact: link.data?.artifactId ?? "",
        version: link.data?.version ?? "",
      });
    }
  }
  for (const env of ENVIRONMENTS) {
    result[env].sort(
      (a, b) => a.tc.localeCompare(b.tc) || a.artifact.localeCompare(b.artifact),
    );
  }
  return result;
}

export function toMicroserviceAtRow(dto: MicroserviceNameAggrDto): MicroserviceAtRow {
  return { ...dto, deployments: toDeployments(dto) };
}

/** Cached page with one row's `isNeedAT` replaced — for the optimistic toggle. */
export function setNeedAT(
  page: ApiResponse<MicroserviceNameAggrDto[]>,
  id: number,
  isNeedAT: boolean,
): ApiResponse<MicroserviceNameAggrDto[]> {
  return {
    ...page,
    data: page.data.map((row) =>
      row.id === id ? { ...row, data: { ...row.data, isNeedAT } } : row,
    ),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/microservice-at/mappers.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/types/api.ts src/features/microservice-at/mappers.ts src/features/microservice-at/mappers.test.ts
git commit -m "feat(microservice-at): aggregator DTOs and deployment mappers

toDeployments groups each aggregator's node tech-component links by
node.environment into IFT/UAT/PROD.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: URL search validation and the API module

**Files:**
- Create: `src/features/microservice-at/search.ts`
- Test: `src/features/microservice-at/search.test.ts`
- Create: `src/features/microservice-at/api.ts`

**Interfaces:**
- Consumes: `createCrudApi` with `baseFilter` (Task 1); `MicroserviceNameAggrDto`, `MicroserviceNameAggrPatch` (Task 2); `FilterDescriptor` from `@/lib/odata/build-filter-params`.
- Produces:
  - `type MicroserviceAtSearch = { page: number; pageSize: number | undefined; sort: string; name: string | undefined }`. A **type alias**, not an interface, so it is assignable to `Record<string, unknown>` as `useDataTable` requires.
  - `DEFAULT_SORT = "name.asc"`
  - `validateMicroserviceAtSearch(search: Record<string, unknown>): MicroserviceAtSearch`
  - `deriveColumnFilters(search: MicroserviceAtSearch): { id: string; value: unknown }[]`
  - `microserviceAtFilterDescriptors: readonly FilterDescriptor[]`
  - `MICROSERVICE_AT_QUERY_KEY = ["microservice-at"] as const`
  - `microserviceAtApi`: the `createCrudApi` return, used as `.dataTableQueryOptions(params)` and `.patch(id, body)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/microservice-at/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveColumnFilters, validateMicroserviceAtSearch } from "./search";

describe("validateMicroserviceAtSearch", () => {
  it("fills defaults for an empty URL", () => {
    expect(validateMicroserviceAtSearch({})).toEqual({
      page: 1,
      pageSize: undefined,
      sort: "name.asc",
      name: undefined,
    });
  });

  it("keeps valid values", () => {
    expect(
      validateMicroserviceAtSearch({ page: 3, pageSize: 25, sort: "name.desc", name: "pos" }),
    ).toEqual({ page: 3, pageSize: 25, sort: "name.desc", name: "pos" });
  });

  it("never lets a sort on another field through to $orderby", () => {
    expect(validateMicroserviceAtSearch({ sort: "guid.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceAtSearch({ sort: "nodes.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceAtSearch({ sort: "name.asc,id.desc" }).sort).toBe("name.asc");
  });

  it("drops junk page and empty name", () => {
    const s = validateMicroserviceAtSearch({ page: 0, name: "" });
    expect(s.page).toBe(1);
    expect(s.name).toBeUndefined();
  });
});

describe("deriveColumnFilters", () => {
  it("maps name to the name column filter", () => {
    const s = validateMicroserviceAtSearch({ name: "pos" });
    expect(deriveColumnFilters(s)).toEqual([{ id: "name", value: "pos" }]);
  });

  it("is empty without a name", () => {
    expect(deriveColumnFilters(validateMicroserviceAtSearch({}))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/microservice-at/search.test.ts`
Expected: FAIL with `Failed to resolve import "./search"`.

- [ ] **Step 3: Implement `search.ts`**

Create `src/features/microservice-at/search.ts`:

```ts
import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

/** A type alias, not an interface: it must stay assignable to
 *  `Record<string, unknown>`, which `useDataTable` requires of its search. */
export type MicroserviceAtSearch = {
  page: number;
  pageSize: number | undefined;
  sort: string;
  name: string | undefined;
};

export const DEFAULT_SORT = "name.asc";

/** `name` is the only sortable field. `sort` flows unchecked into `$orderby`,
 *  so anything else in a hand-edited URL is replaced here. */
const ALLOWED_SORTS = new Set(["name.asc", "name.desc"]);

export function validateMicroserviceAtSearch(
  search: Record<string, unknown>,
): MicroserviceAtSearch {
  return {
    page: typeof search.page === "number" && search.page >= 1 ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort:
      typeof search.sort === "string" && ALLOWED_SORTS.has(search.sort)
        ? search.sort
        : DEFAULT_SORT,
    name:
      typeof search.name === "string" && search.name.length > 0
        ? search.name
        : undefined,
  };
}

export const microserviceAtFilterDescriptors: readonly FilterDescriptor[] = [
  { id: "name", variant: "text" },
];

export function deriveColumnFilters(
  search: MicroserviceAtSearch,
): { id: string; value: unknown }[] {
  return search.name ? [{ id: "name", value: search.name }] : [];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/microservice-at/search.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement `api.ts`**

Create `src/features/microservice-at/api.ts`:

```ts
import { createCrudApi } from "@/lib/api/create-crud-api";
import type {
  MicroserviceNameAggrDto,
  MicroserviceNameAggrPatch,
} from "@/types/api";
import { microserviceAtFilterDescriptors } from "./search";

export const MICROSERVICE_AT_QUERY_KEY = ["microservice-at"] as const;

/**
 * MICROSERVICE_NAME_AGGR aggregators, one per microservice name, maintained
 * by the backend reconcile job. Reads go through `/graph` so `$fields` can
 * pull each aggregator's nodes, their tech-component links and each link's
 * tech component in one call; the PATCH stays on the plain resource path.
 * Spec: docs/superpowers/specs/2026-09-23-microservices-at-page-design.md
 */
export const microserviceAtApi = createCrudApi<
  MicroserviceNameAggrDto,
  object,
  MicroserviceNameAggrPatch
>({
  basePath: "/api/v1/node-aggregator",
  listPath: "/api/v1/node-aggregator/graph",
  queryKey: MICROSERVICE_AT_QUERY_KEY,
  filterDescriptors: microserviceAtFilterDescriptors,
  baseFilter: "nodeAggrType eq 'MICROSERVICE_NAME_AGGR'",
  staticParams: {
    $fields: "nodes,nodes.techComponentLinks,nodes.techComponentLinks.techComponent",
  },
});
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: exit 0, no output.

- [ ] **Step 7: Commit**

```bash
git add src/features/microservice-at/search.ts src/features/microservice-at/search.test.ts src/features/microservice-at/api.ts
git commit -m "feat(microservice-at): search validation and API module

Only name.asc/name.desc reach \$orderby. The API pins every list read to
MICROSERVICE_NAME_AGGR via baseFilter and pulls nodes, links and tech
components through \$fields.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Columns, route page and sidebar entry

**Files:**
- Create: `src/features/microservice-at/columns.tsx`
- Create: `src/routes/microservice-at/index.tsx`
- Modify: `src/components/app-sidebar.tsx` (lucide import list around lines 3-14, `navItems` around lines 54-60)
- Regenerated (do not hand-edit): `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `MicroserviceAtRow`, `toMicroserviceAtRow`, `ENVIRONMENTS`, `Environment`, `Deployment` (Task 2); `microserviceAtApi` (Task 3); `validateMicroserviceAtSearch`, `deriveColumnFilters`, `MicroserviceAtSearch` (Task 3); `useDataTable` (`@/hooks/use-data-table`); `DEFAULT_PAGE_SIZE` (`@/lib/data-table/switchable-page`).
- Produces: `getMicroserviceAtColumns(opts: { onToggleNeedAT?: (id: number, isNeedAT: boolean) => void; pendingIds: ReadonlySet<number> }): ColumnDef<MicroserviceAtRow>[]`. With no `onToggleNeedAT`, the Need AT checkbox renders disabled; Task 5 supplies the handler.

- [ ] **Step 1: Create `columns.tsx`**

```tsx
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import { dash } from "@/lib/format";
import {
  ENVIRONMENTS,
  type Deployment,
  type Environment,
  type MicroserviceAtRow,
} from "./mappers";

interface GetMicroserviceAtColumnsProps {
  /** Absent → the Need AT checkbox is read-only. */
  onToggleNeedAT?: (id: number, isNeedAT: boolean) => void;
  /** Rows with a toggle in flight; their checkbox is disabled. */
  pendingIds: ReadonlySet<number>;
}

function DeploymentCell({ items }: { items: Deployment[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">{dash("")}</span>;
  }
  return (
    <ul className="space-y-0.5">
      {items.map((d, i) => (
        <li
          key={`${d.tc}|${d.artifact}|${d.version}|${i}`}
          className="whitespace-nowrap text-xs leading-5"
        >
          <span className="text-muted-foreground">{dash(d.tc)}:</span>{" "}
          <span className="font-mono">
            {dash(d.artifact)} - {dash(d.version)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function environmentColumn(env: Environment): ColumnDef<MicroserviceAtRow> {
  return {
    id: env.toLowerCase(),
    header: env,
    cell: ({ row }) => <DeploymentCell items={row.original.deployments[env]} />,
    meta: { label: env },
    enableSorting: false,
    size: 360,
  };
}

export function getMicroserviceAtColumns({
  onToggleNeedAT,
  pendingIds,
}: GetMicroserviceAtColumnsProps): ColumnDef<MicroserviceAtRow>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Microservice" />
      ),
      cell: ({ cell }) => (
        <span className="font-medium">{dash(cell.getValue<string>())}</span>
      ),
      meta: {
        label: "Microservice",
        placeholder: "Search microservices...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: false,
      size: 300,
    },
    ...ENVIRONMENTS.map(environmentColumn),
    {
      id: "isNeedAT",
      header: "Need AT",
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Need AT for ${row.original.name}`}
          checked={row.original.data?.isNeedAT === true}
          disabled={!onToggleNeedAT || pendingIds.has(row.original.id)}
          onCheckedChange={(value) => onToggleNeedAT?.(row.original.id, value === true)}
        />
      ),
      meta: { label: "Need AT" },
      enableSorting: false,
      size: 90,
    },
    {
      // The AT link is not in the DB yet — placeholder until it is.
      id: "at",
      header: "AT",
      cell: () => <span className="text-muted-foreground">{dash("")}</span>,
      meta: { label: "AT" },
      enableSorting: false,
      size: 80,
    },
  ];
}
```

- [ ] **Step 2: Create the route `src/routes/microservice-at/index.tsx`**

```tsx
import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/data-table/switchable-page";
import { microserviceAtApi } from "@/features/microservice-at/api";
import { getMicroserviceAtColumns } from "@/features/microservice-at/columns";
import { toMicroserviceAtRow } from "@/features/microservice-at/mappers";
import {
  deriveColumnFilters,
  validateMicroserviceAtSearch,
  type MicroserviceAtSearch,
} from "@/features/microservice-at/search";

function tableQueryOptions(search: MicroserviceAtSearch) {
  return microserviceAtApi.dataTableQueryOptions({
    page: search.page,
    pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
    sort: search.sort,
    columnFilters: deriveColumnFilters(search),
  });
}

export const Route = createFileRoute("/microservice-at/")({
  validateSearch: validateMicroserviceAtSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(tableQueryOptions(deps)),
  component: MicroserviceAtPage,
});

function MicroserviceAtPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/microservice-at/" });
  const { data } = useSuspenseQuery(tableQueryOptions(search));

  const rows = React.useMemo(() => data.data.map(toMicroserviceAtRow), [data.data]);
  const columns = React.useMemo(
    () => getMicroserviceAtColumns({ pendingIds: new Set<number>() }),
    [],
  );

  const onNavigate = React.useCallback(
    (updates: Partial<MicroserviceAtSearch>) => {
      navigate({
        search: (prev) => validateMicroserviceAtSearch({ ...prev, ...updates }),
      });
    },
    [navigate],
  );

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const { table } = useDataTable({
    columns,
    data: rows,
    pageCount: Math.ceil(data.count / pageSize),
    search,
    onNavigate,
    initialColumnPinning: { left: ["name"] },
  });

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Microservices &amp; AT</h1>
        <p className="mt-2 text-muted-foreground">{data.count} microservices</p>
      </div>

      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  );
}
```

About `validateMicroserviceAtSearch` in `onNavigate`: `useDataTable` sends `undefined` to clear a key (e.g. an emptied search box). Re-validating turns that back into the canonical shape (`name: undefined`, which the router drops from the URL). It also keeps the updater's return type exactly `MicroserviceAtSearch`, so no cast is needed.

- [ ] **Step 3: Add the sidebar entry**

In `src/components/app-sidebar.tsx`, add `Boxes` to the `lucide-react` import (alphabetical, before `Cpu`):

```ts
import {
  Boxes,
  Cpu,
```

and insert the entry after Flows in `navItems`:

```ts
  { to: "/flow", label: "Flows", icon: Workflow },
  { to: "/microservice-at", label: "Microservices & AT", icon: Boxes },
  { to: "/person", label: "Persons", icon: User },
```

- [ ] **Step 4: Regenerate the route tree and type-check**

Run: `npx vite build`
Expected: build succeeds, and `git status` shows `src/routeTree.gen.ts` modified to include `/microservice-at/`. `npm run build` would not work here: it runs `tsc -b` *before* the router plugin regenerates the tree.

Run: `npx tsc -b`
Expected: exit 0.

If `tsc` reports that `Route.useSearch()` or `deps` is `{}` (TanStack's inference widening, which the Team route works around), follow the Team route's pattern: `const search = Route.useSearch() as MicroserviceAtSearch;` and `tableQueryOptions(deps as MicroserviceAtSearch)`, each with a one-line comment saying the assertion is type-only.

Run: `npm run lint`
Expected: no errors in the new or modified files.

- [ ] **Step 5: Commit**

```bash
git add src/features/microservice-at/columns.tsx src/routes/microservice-at/index.tsx src/components/app-sidebar.tsx src/routeTree.gen.ts
git commit -m "feat(microservice-at): Microservices & AT page

Server-paged table of microservice aggregators: name search and sort,
per-environment tc: artifact - version cells, read-only Need AT, AT
placeholder. Sidebar entry after Flows.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Inline `isNeedAT` toggle

**Files:**
- Create: `src/features/microservice-at/use-toggle-need-at.ts`
- Modify: `src/routes/microservice-at/index.tsx` (the `columns` memo from Task 4)

**Interfaces:**
- Consumes: `microserviceAtApi.patch`, `MICROSERVICE_AT_QUERY_KEY` (Task 3); `setNeedAT` (Task 2); `getMicroserviceAtColumns({ onToggleNeedAT, pendingIds })` (Task 4).
- Produces: `useToggleNeedAT(): { toggle: (id: number, isNeedAT: boolean) => void; pendingIds: ReadonlySet<number> }`.

- [ ] **Step 1: Create the hook**

Create `src/features/microservice-at/use-toggle-need-at.ts`:

```ts
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiResponse, MicroserviceNameAggrDto } from "@/types/api";
import { MICROSERVICE_AT_QUERY_KEY, microserviceAtApi } from "./api";
import { setNeedAT } from "./mappers";

type Page = ApiResponse<MicroserviceNameAggrDto[]>;

/**
 * PATCH one aggregator's `data.isNeedAT`, optimistically. The cached pages
 * are updated before the request and restored if it fails. The body carries
 * no `nodes`, so membership is left unchanged. Reconcile never rewrites an
 * existing aggregator's `data`, so the value survives the 3-hourly job.
 */
export function useToggleNeedAT() {
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const { mutate } = useMutation({
    mutationFn: ({ id, isNeedAT }: { id: number; isNeedAT: boolean }) =>
      microserviceAtApi.patch(id, {
        nodeAggrType: "MICROSERVICE_NAME_AGGR",
        data: { isNeedAT },
      }),
    onMutate: async ({ id, isNeedAT }) => {
      setPendingIds((prev) => new Set(prev).add(id));
      await queryClient.cancelQueries({ queryKey: MICROSERVICE_AT_QUERY_KEY });
      const snapshot = queryClient.getQueriesData<Page>({
        queryKey: MICROSERVICE_AT_QUERY_KEY,
      });
      queryClient.setQueriesData<Page>(
        { queryKey: MICROSERVICE_AT_QUERY_KEY },
        (old) => (old ? setNeedAT(old, id, isNeedAT) : old),
      );
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      for (const [key, value] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, value);
      }
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update Need AT",
      );
    },
    onSettled: (_data, _err, { id }) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return queryClient.invalidateQueries({ queryKey: MICROSERVICE_AT_QUERY_KEY });
    },
  });

  const toggle = React.useCallback(
    (id: number, isNeedAT: boolean) => mutate({ id, isNeedAT }),
    [mutate],
  );

  return { toggle, pendingIds };
}
```

- [ ] **Step 2: Wire it into the page**

In `src/routes/microservice-at/index.tsx`, add the import:

```ts
import { useToggleNeedAT } from "@/features/microservice-at/use-toggle-need-at";
```

and replace the Task 4 `columns` memo:

```tsx
  const columns = React.useMemo(
    () => getMicroserviceAtColumns({ pendingIds: new Set<number>() }),
    [],
  );
```

with:

```tsx
  const { toggle, pendingIds } = useToggleNeedAT();
  const columns = React.useMemo(
    () => getMicroserviceAtColumns({ onToggleNeedAT: toggle, pendingIds }),
    [toggle, pendingIds],
  );
```

- [ ] **Step 3: Type-check, lint, test**

Run: `npx tsc -b`
Expected: exit 0.

Run: `npm run lint`
Expected: no errors in the new or modified files.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/microservice-at/use-toggle-need-at.ts src/routes/microservice-at/index.tsx
git commit -m "feat(microservice-at): inline Need AT toggle

Optimistic PATCH of data.isNeedAT with rollback and a toast on failure;
the row's checkbox is disabled while its request is in flight.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Live verification

No code changes, unless a check fails. A failure is a bug in the task that introduced it: fix it there, with its own commit.

**Preconditions:**
- The backend is running on `http://localhost:8080`, built from `cometa` `c66cf8e` or later, with the `local` profile.
- `node_aggr` holds the 660 `MICROSERVICE_NAME_AGGR` rows from the 2026-09-23 reconcile run.
- The `vite.config.ts` proxy target is `http://localhost:8080` (it already is).
- The test login is sigmaLogin `16674475`, password `qweqweqwe`.

- [ ] **Step 1: Full static checks**

Run: `npx tsc -b && npm run lint && npm test`
Expected: all three pass.

- [ ] **Step 2: Start the dev server**

Run (in the background): `npm run dev -- --host`. The plain dev server is unreachable on this machine.
Expected: Vite prints its `Local:` URL on port 5173.

- [ ] **Step 3: Check the page in a browser (Playwright MCP)**

1. Open `http://localhost:5173/login` and log in as `16674475` / `qweqweqwe`.
2. Click **Microservices & AT** in the sidebar.
   Expected: URL `/microservice-at?page=1&sort=name.asc`. Header `Microservices & AT`, subtitle `660 microservices`. The first row is `acgr-master-agreements-murex-in-out`, with IFT `ift-k8s-bk1: acgr-master-agreements-murex-in-out - 4.0.8_m971j17r` and two UAT lines (`psi-k8s-bk1`, `psi-k8s-bk2`). PROD shows `—`, Need AT is checked, AT shows `—`.
3. Type `positions` in the toolbar search.
   Expected: after about 300 ms, the URL gains `name=positions` and the subtitle reads `54 microservices`.
4. Click the Microservice column header and choose descending.
   Expected: `sort=name.desc`, and the row order reverses.
5. Open `http://localhost:5173/microservice-at?sort=guid.asc`.
   Expected: the page renders sorted by name ascending, with no error boundary. The network request's `$orderby` is `name asc`.
6. Note the first row's name, then uncheck its Need AT.
   Expected: the checkbox flips at once, is briefly disabled, and there is no toast. After a page reload it is still unchecked.
7. Re-check it and reload.
   Expected: it is checked again. **This restores the dev-DB value.**

- [ ] **Step 4: Confirm the database was restored**

Run via `mcp__cometa-postgres__pg_execute_query` (select):
```sql
SELECT count(*) FILTER (WHERE (data->>'isNeedAT')::boolean IS NOT TRUE) AS not_true
  FROM gmsb.node_aggr WHERE node_aggr_type = 'MICROSERVICE_NAME_AGGR'
```
Expected: `not_true = 0`, the same as right after reconcile.

- [ ] **Step 5: Stop the dev server** started in Step 2. Leave the backend running unless told otherwise.
