# Flow Advanced Table — Design Spec

## Overview

Add a new `Flow` resource with full CRUD feature structure and an advanced filter data table page, following the `box` / `box-dice-advanced` pattern exactly.

## FlowDto

```typescript
export interface FlowDto {
  id: number;
  code: string;
  caption: string;
  integrity: "I_1" | "I_2" | "I_3" | "I_4" | null;
  confidentiality: "K_1" | "K_2" | "K_3" | "K_4" | null;
  dataClass: string;
  dataType: string;
  state: string;
  descriptionMd: string | null;
}
```

Derived from `example/flow_202604140012.json`. Fields converted from `snake_case` to `camelCase` to match existing DTO conventions.

### FlowFilters

```typescript
export interface FlowFilters extends Partial<PaginationParams> {
  code?: string;
  caption?: string;
  integrity?: string;
  confidentiality?: string;
  dataClass?: string;
  dataType?: string;
  state?: string;
}
```

All flat — no relations, ranges, or date fields.

## Feature Structure (`src/features/flow/`)

| File | Purpose |
|---|---|
| `api.ts` | `createCrudApi<FlowDto, FlowFilters, FlowWritePayload>` at `/api/v1/flow`, queryKey `["flows"]`. Re-exports `advancedDataTableQueryOptions`. |
| `advanced-api.ts` | `flowFieldByColumnId` record mapping column ids to OData fields/variants. `advancedDataTableQueryOptions` using `buildAdvancedFilterParams`. |
| `columns.tsx` | `getFlowColumns({ setRowAction })` returning column defs: select, id, code, caption, integrity, confidentiality, dataClass, dataType, state, actions. |
| `filter-descriptors.ts` | `flowFilterDescriptors` array + `deriveColumnFiltersFromSearch`. |
| `row-action.ts` | `FlowRowAction = { variant: "create" } \| { variant: "update"; row: FlowDto }` |
| `schema.ts` | `flowFormSchema` (zod), `FlowFormValues`, `FlowWritePayload` |
| `mappers.ts` | `flowDtoToForm`, `flowFormToCreate`, `flowFormToPatch` |
| `components/FlowSheet.tsx` | Create/edit side sheet with react-hook-form + zod resolver |

### Column Filter Variants

| Column | Variant | Options |
|---|---|---|
| `code` | `text` | — |
| `caption` | `text` | — |
| `dataType` | `text` | — |
| `integrity` | `select` | I_1, I_2, I_3, I_4 |
| `confidentiality` | `select` | K_1, K_2, K_3, K_4 |
| `dataClass` | `select` | Client Data, Static Data, Market Data, System Data, Technical Data, Trades, Other, etc. |
| `state` | `select` | ACTUAL |

### Advanced API Field Mapping

```typescript
export const flowFieldByColumnId: Record<string, FieldEntry> = {
  code:            { field: "code",            variant: "text" },
  caption:         { field: "caption",         variant: "text" },
  integrity:       { field: "integrity",       variant: "select" },
  confidentiality: { field: "confidentiality", variant: "select" },
  dataClass:       { field: "dataClass",       variant: "select" },
  dataType:        { field: "dataType",        variant: "text" },
  state:           { field: "state",           variant: "select" },
};
```

### Form Schema

```typescript
const flowFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  caption: z.string().min(1, "Caption is required"),
  integrity: z.enum(["I_1", "I_2", "I_3", "I_4"]).nullable(),
  confidentiality: z.enum(["K_1", "K_2", "K_3", "K_4"]).nullable(),
  dataClass: z.string().min(1, "Data class is required"),
  dataType: z.string().min(1, "Data type is required"),
  state: z.string().min(1, "State is required"),
  descriptionMd: z.string().nullable().transform(v => v === "" ? null : v),
});
```

### Write Payload

```typescript
export interface FlowWritePayload {
  code: string;
  caption: string;
  integrity: "I_1" | "I_2" | "I_3" | "I_4" | null;
  confidentiality: "K_1" | "K_2" | "K_3" | "K_4" | null;
  dataClass: string;
  dataType: string;
  state: string;
  descriptionMd: string | null;
}
```

No relations, so `FlowWritePayload` mirrors `FlowDto` minus `id`. Mappers are straightforward 1:1.

## Mocks

### Mock Data (`src/mocks/data/flows.ts`)

~40 entries converted from the JSON file. Fields mapped to camelCase:
- `data_class` → `dataClass`
- `data_type` → `dataType`
- `description_md` → `descriptionMd`

### Mock Handler (`src/mocks/handlers/flow.ts`)

Full CRUD at `/api/v1/flow`:
- `GET /api/v1/flow` — LIST with OData filtering/sorting/pagination
- `GET /api/v1/flow/:id` — GET by ID
- `POST /api/v1/flow` — CREATE
- `PUT /api/v1/flow/:id` — FULL UPDATE
- `PATCH /api/v1/flow/:id` — PARTIAL UPDATE
- `DELETE /api/v1/flow/:id` — DELETE

Uses `parseOData` / `applyOData` from `src/mocks/lib/odata.ts`.

Registered in `src/mocks/handlers.ts`.

## Route (`src/routes/flow-advanced/index.tsx`)

Clones `box-dice-advanced/index.tsx`:
- `validateSearch` with page, pageSize, sort, filters, joinOperator
- `loaderDeps` → `loader` using `flowApi.advancedDataTableQueryOptions`
- `DataTable` + `DataTableAdvancedToolbar`
- FlowSheet for create/edit via row action state
- Title: "Flows — Advanced"

## Sidebar

Add `{ to: "/flow-advanced", label: "Flows (Advanced)" }` to `navItems` in `src/components/app-sidebar.tsx`.
