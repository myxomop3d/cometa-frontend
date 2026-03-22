# PATCH Partial Update for Automated Systems

## Problem

The inline editing flow sends a PUT request with all fields when saving changes to an automated system, even if only one field was modified. This is wasteful and semantically incorrect — a partial update should use PATCH.

## Solution

Change the save flow to compute a diff of only changed fields and send them via PATCH instead of PUT.

## Changes

### 1. `src/components/SimpleTable.tsx` — compute diff

In the save handler, replace the full merge (`{ ...original, ...formValues }`) with a diff that extracts only changed fields. Pass `Partial<TData>` to `onSave`.

### 2. `src/types/table.ts` — update `EditConfig.onSave` signature

```ts
onSave: (rowId: string | number, data: Partial<TData>) => Promise<void>;
```

### 3. `src/api/mutations/automated-system.ts` — PUT to PATCH

- Change method from `"PUT"` to `"PATCH"`
- Change `data` parameter type from `AutomatedSystemDto` to `Partial<AutomatedSystemDto>`

### 4. `src/routes/automated-system/index.tsx` — update mutation type

Change `mutationFn` type from `{ id: number; data: AutomatedSystemDto }` to `{ id: number; data: Partial<AutomatedSystemDto> }`.

## Backend

PATCH endpoint already exists at `/api/v1/automated-system/{id}` (confirmed in OpenAPI spec).
