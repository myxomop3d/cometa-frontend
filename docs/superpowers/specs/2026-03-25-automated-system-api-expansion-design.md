# Automated System API Expansion

## Goal

Expand the automated-system API layer to cover all endpoints from the OpenAPI spec (`example/cometa_openapi_16.03.26.json`), and consolidate fetch functions, mutations, and query options into a single service file.

## Endpoints

All endpoints use the base path `/api/v1/automated-system`.

### Existing (to preserve)

| Method | Path | Description | Response type |
|--------|------|-------------|---------------|
| GET | `/` | List with OData filters/pagination | `ApiResponse<AutomatedSystemDto[]>` |
| PATCH | `/{id}` | Partial update | `ApiResponse<AutomatedSystemDto>` |

### New

| Method | Path | Description | Response type |
|--------|------|-------------|---------------|
| GET | `/{id}` | Get single by ID | `ApiResponse<AutomatedSystemDto>` |
| PUT | `/{id}` | Full update by ID | `ApiResponse<AutomatedSystemDto>` |
| DELETE | `/{id}` | Delete by ID | `ApiResponse<string>` |
| POST | `/` | Create new | `ApiResponse<AutomatedSystemDto>` |
| GET | `/graph` | List with nested entities (`$fields`) | `ApiResponse<AutomatedSystemDto[]>` |
| GET | `/graph/{id}` | Single with nested entities (`$fields`) | `ApiResponse<AutomatedSystemDto>` |

### Not implementing

- `/count` — not needed
- `/num/{naturalId}` — not requested
- `/$metadata` — not requested

## File changes

### Consolidate into `src/api/automated-system.ts`

Replace the current 3-file split:
- `src/api/automated-system.ts` (fetch functions)
- `src/api/queries/automated-system.ts` (query options)
- `src/api/mutations/automated-system.ts` (mutation functions)

With a single `src/api/automated-system.ts` containing all functions:

**Fetch functions:**
- `fetchAutomatedSystems(filters)` — existing GET list
- `fetchAutomatedSystem(id)` — GET by ID
- `fetchAutomatedSystemsGraph(filters, fields?)` — GET `/graph` with optional `$fields`
- `fetchAutomatedSystemGraph(id, fields?)` — GET `/graph/{id}` with optional `$fields`

**Mutation functions:**
- `createAutomatedSystem(data)` — POST
- `updateAutomatedSystem(id, data)` — PUT (full replace)
- `patchAutomatedSystem(id, data)` — PATCH (partial update, existing)
- `deleteAutomatedSystem(id)` — DELETE

**Query options:**
- `automatedSystemsQueryOptions(filters)` — existing, for the list
- `automatedSystemQueryOptions(id)` — for single by ID
- `automatedSystemsGraphQueryOptions(filters, fields?)` — for graph list
- `automatedSystemGraphQueryOptions(id, fields?)` — for graph single

### Delete old files

- `src/api/queries/automated-system.ts`
- `src/api/mutations/automated-system.ts`

### Update imports

- `src/routes/automated-system/index.tsx` — update imports to point to `@/api/automated-system`

## Types

No type changes. `AutomatedSystemDto` in `src/types/api.ts` stays as-is. Graph endpoints return the same DTO shape; nested entity fields are untyped for now.

## API conventions

All functions follow the existing pattern:
- Use `fetch()` with the proxy prefix `/api/v1/automated-system`
- Throw on non-ok responses with descriptive error messages
- Return typed `ApiResponse<T>` from `.json()`
- OData query params: `$skip`, `$top`, `$filter`, `$orderby`, `$fields`
