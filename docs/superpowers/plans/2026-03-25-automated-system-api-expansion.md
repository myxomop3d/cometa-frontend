# Automated System API Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all automated-system API functions into a single service file and add missing endpoints (GET by ID, PUT, DELETE, POST, graph list, graph by ID).

**Architecture:** Replace the 3-file split (`api/automated-system.ts`, `api/queries/automated-system.ts`, `api/mutations/automated-system.ts`) with a single `api/automated-system.ts` containing fetch functions, mutations, and TanStack Query options. Update the one consumer (`routes/automated-system/index.tsx`) to use new imports and renamed functions.

**Tech Stack:** TypeScript, TanStack Query (`queryOptions`, `keepPreviousData`), native `fetch` API

**Spec:** `docs/superpowers/specs/2026-03-25-automated-system-api-expansion-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/api/automated-system.ts` | **Rewrite** | All fetch functions, mutations, and query options |
| `src/api/queries/automated-system.ts` | **Delete** | Absorbed into consolidated file |
| `src/api/mutations/automated-system.ts` | **Delete** | Absorbed into consolidated file |
| `src/routes/automated-system/index.tsx` | **Modify** (imports only) | Update import paths and function name |

---

### Task 1: Rewrite consolidated `src/api/automated-system.ts`

**Files:**
- Rewrite: `src/api/automated-system.ts`

- [ ] **Step 1: Write the consolidated service file**

Replace the entire contents of `src/api/automated-system.ts` with:

```typescript
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, AutomatedSystemDto, AutomatedSystemFilters } from "@/types/api";

const BASE = "/api/v1/automated-system";

const STRING_FILTER_FIELDS = [
  "name",
  "ci",
  "block",
  "tribe",
  "cluster",
  "status",
  "leader",
] as const;

// ── Fetch functions ─────────────────────────────────────────────────

function buildListParams(filters: AutomatedSystemFilters): URLSearchParams {
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  const params = new URLSearchParams();
  params.set("$skip", String((page - 1) * pageSize));
  params.set("$top", String(pageSize));

  const filterClauses = STRING_FILTER_FIELDS.filter(
    (f) => fieldFilters[f] !== undefined && fieldFilters[f] !== "",
  ).map((f) => `contains(${f},'${fieldFilters[f]}')`);

  if (filterClauses.length > 0) {
    params.set("$filter", filterClauses.join(" and "));
  }
  return params;
}

export async function fetchAutomatedSystems(
  filters: AutomatedSystemFilters = {},
): Promise<ApiResponse<AutomatedSystemDto[]>> {
  const params = buildListParams(filters);
  const response = await fetch(`${BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated systems: ${response.status}`);
  }
  return response.json();
}

export async function fetchAutomatedSystem(
  id: number,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`${BASE}/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated system ${id}: ${response.status}`);
  }
  return response.json();
}

export async function fetchAutomatedSystemsGraph(
  filters: AutomatedSystemFilters = {},
  fields?: string,
): Promise<ApiResponse<AutomatedSystemDto[]>> {
  const params = buildListParams(filters);
  if (fields) {
    params.set("$fields", fields);
  }
  const response = await fetch(`${BASE}/graph?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated systems graph: ${response.status}`);
  }
  return response.json();
}

export async function fetchAutomatedSystemGraph(
  id: number,
  fields?: string,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const params = new URLSearchParams();
  if (fields) {
    params.set("$fields", fields);
  }
  const query = params.toString();
  const response = await fetch(`${BASE}/graph/${id}${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch automated system graph ${id}: ${response.status}`);
  }
  return response.json();
}

// ── Mutations ───────────────────────────────────────────────────────

export async function createAutomatedSystem(
  data: Omit<AutomatedSystemDto, "id">,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create automated system: ${response.status}`);
  }
  return response.json();
}

export async function updateAutomatedSystem(
  id: number,
  data: AutomatedSystemDto,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update automated system ${id}: ${response.status}`);
  }
  return response.json();
}

export async function patchAutomatedSystem(
  id: number,
  data: Partial<AutomatedSystemDto>,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to patch automated system ${id}: ${response.status}`);
  }
  return response.json();
}

export async function deleteAutomatedSystem(
  id: number,
): Promise<ApiResponse<string>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete automated system ${id}: ${response.status}`);
  }
  return response.json();
}

// ── Query options ───────────────────────────────────────────────────

export function automatedSystemsQueryOptions(filters: AutomatedSystemFilters = {}) {
  return queryOptions({
    queryKey: ["automated-systems", "list", filters],
    queryFn: () => fetchAutomatedSystems(filters),
    placeholderData: keepPreviousData,
  });
}

export function automatedSystemQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["automated-systems", "detail", id],
    queryFn: () => fetchAutomatedSystem(id),
  });
}

export function automatedSystemsGraphQueryOptions(
  filters: AutomatedSystemFilters = {},
  fields?: string,
) {
  return queryOptions({
    queryKey: ["automated-systems", "graph-list", filters, fields],
    queryFn: () => fetchAutomatedSystemsGraph(filters, fields),
    placeholderData: keepPreviousData,
  });
}

export function automatedSystemGraphQueryOptions(id: number, fields?: string) {
  return queryOptions({
    queryKey: ["automated-systems", "graph-detail", id, fields],
    queryFn: () => fetchAutomatedSystemGraph(id, fields),
  });
}
```

**Note:** The existing query key `["automated-systems", filters]` changes to `["automated-systems", "list", filters]`. This is a deliberate migration to enable structured prefix invalidation. The `invalidateQueries({ queryKey: ["automated-systems"] })` call in the consumer already uses prefix matching, so it continues to work without changes.

**Note:** The `buildListParams` helper is extracted from the existing inline code in `fetchAutomatedSystems` so it can be reused by `fetchAutomatedSystemsGraph`. This is a minor refactor not in the spec but justified by DRY.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in `src/routes/automated-system/index.tsx` because old imports no longer exist. The new file itself should have no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/automated-system.ts
git commit -m "feat: consolidate automated-system API into single service file"
```

---

### Task 2: Update consumer imports and delete old files

**Files:**
- Modify: `src/routes/automated-system/index.tsx` (lines 13, 17)
- Delete: `src/api/queries/automated-system.ts`
- Delete: `src/api/mutations/automated-system.ts`

- [ ] **Step 1: Update imports in `src/routes/automated-system/index.tsx`**

Find and replace:
```typescript
import { automatedSystemsQueryOptions } from "@/api/queries/automated-system";
```
with:
```typescript
import { automatedSystemsQueryOptions, patchAutomatedSystem } from "@/api/automated-system";
```

Find and delete entirely:
```typescript
import { updateAutomatedSystem } from "@/api/mutations/automated-system";
```

- [ ] **Step 2: Rename PATCH function call**

Find and replace in the same file:
```typescript
updateAutomatedSystem(id, data),
```
with:
```typescript
patchAutomatedSystem(id, data),
```

- [ ] **Step 3: Delete old files**

```bash
rm src/api/queries/automated-system.ts
rm src/api/mutations/automated-system.ts
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 5: Run dev server smoke test**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: update imports, rename PATCH fn, delete old split files"
```
