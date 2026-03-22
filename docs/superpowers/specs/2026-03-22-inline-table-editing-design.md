# Inline Table Editing for SimpleTable

**Date:** 2026-03-22
**Status:** Draft

## Overview

Add generic inline row editing to the `SimpleTable` component. When editing is enabled via an `editConfig` prop, an "actions" column is appended with Edit/Save/Discard buttons. Clicking Edit turns the row into editable inputs, highlights it, dims other rows, and disables their Edit buttons. Validation uses zod; save calls the backend via a consumer-provided async handler.

## EditConfig Interface

```ts
// src/types/table.ts

import type { ZodSchema } from "zod";

interface TextFieldConfig {
  type: "text";
}

interface NumberFieldConfig {
  type: "number";
}

interface SelectFieldConfig {
  type: "select";
  options: { label: string; value: string }[];
}

interface CheckboxFieldConfig {
  type: "checkbox";
}

type EditFieldConfig = TextFieldConfig | NumberFieldConfig | SelectFieldConfig | CheckboxFieldConfig;

interface EditConfig<TData> {
  /** Field type definitions. All editable fields must be explicitly listed to avoid type-coercion bugs (e.g. number rendered as text). */
  fields: Partial<Record<keyof TData, EditFieldConfig>>;

  /** Fields that render as read-only even in edit mode. The row identity field should be included here. */
  disabledFields?: (keyof TData)[];

  /** Zod schema to validate the editable row data. Should cover only editable fields (not id or disabled fields). */
  schema: ZodSchema;

  /** Called on save with the row ID and the full merged row data (original + edits). Returns a promise — reject to trigger error toast. */
  onSave: (rowId: string | number, data: TData) => Promise<void>;

  /** Extracts the unique row identity from the data. */
  rowId: (row: TData) => string | number;
}
```

## Editing State (inside SimpleTable)

All editing state is internal to `SimpleTable`:

- `editingRowId: string | number | null` — which row is being edited
- `formValues: Record<string, unknown>` — current field values for the editing row
- `validationErrors: Record<string, string>` — per-field error messages from zod, updated on every change

## Row Behavior When Editing

- **Editing row:** highlighted with `ring-2 ring-primary/30` or similar subtle border/background
- **Other rows:** `opacity-50` for visual de-emphasis
- **Other Edit buttons:** `disabled` while a row is being edited
- **Actions column:** not shown in the column visibility dropdown (`enableHiding: false`), fixed width, not resizable (`enableResizing: false`)

## Cell Rendering in Edit Mode

For each cell in the editing row:

1. Check if the field is in `disabledFields` → render as plain read-only text
2. Otherwise, render the appropriate input based on `EditFieldConfig.type`:
   - `text` → `<Input />` (shadcn)
   - `number` → `<Input type="number" />`
   - `select` → `<Select />` (shadcn) with provided options
   - `checkbox` → `<Checkbox />` (shadcn)
3. `formValues` is initialized as a copy of the full row data (via `row.original`). Validation runs on every field change via `schema.safeParse(formValues)` — the schema should only cover editable fields so disabled/identity fields don't interfere
4. Error display: red border on input + small error text below the field (inline)
5. Save button is disabled when any validation error exists

## Actions Column

Auto-appended as the last column when `editConfig` is provided.

| State | Buttons |
|-------|---------|
| Default | `Pencil` icon button (Edit) |
| Editing | `Check` icon button (Save) + `X` icon button (Discard) |

Icons from `lucide-react`. Save button shows a spinner (`Loader2`) during the save request.

## Save Flow

1. Final `schema.safeParse(formValues)` validation
2. Compare `formValues` against `row.original` — if no fields changed, exit edit mode silently
3. Merge edits into original row data to produce a full `TData` object
4. Set loading state (spinner on Save, both buttons disabled)
5. Call `editConfig.onSave(rowId, mergedData)` — the consumer receives the full merged object, ready to send to the API
6. **On success:** exit edit mode. Consumer handles query invalidation in their `onSave`/mutation `onSuccess`.
7. **On error:** show toast notification (sonner), keep row in editing mode

## Keyboard Interactions

- **Escape** — discard changes and exit edit mode
- **Tab / Shift+Tab** — move between editable fields within the row

## Discard Flow

- Reset `formValues` to original row data
- Clear `validationErrors`
- Exit edit mode
- No confirmation dialog

## Backend Integration (Automated Systems)

### API Function

```ts
// src/api/mutations/automated-system.ts

export async function updateAutomatedSystem(
  id: number,
  data: AutomatedSystemDto,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`/api/v1/automated-system/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update automated system: ${response.status}`);
  }
  return response.json();
}
```

### Page Changes (automated-system/index.tsx)

- Expand columns to include all `AutomatedSystemDto` fields (except `id` which is used internally)
- Define zod validation schema for the editable fields
- Define `editConfig` with:
  - Field types (all `text` except `status` which is `select` with options "Находится в эксплуатации" / "Выведен из эксплуатации")
  - `disabledFields`: `["id"]` (identity field must be listed here)
  - `onSave` using `useMutation` + query invalidation
  - `rowId: (row) => row.id`

### Zod Schema Example

```ts
const automatedSystemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z.string().nullable(),
  fullName: z.string().min(1, "Full name is required"),
  ci: z.string().min(1, "CI is required"),
  nameHpsm: z.string().nullable(),
  leader: z.string().min(1, "Leader is required"),
  leaderSapId: z.string().nullable(),
  block: z.string().min(1, "Block is required"),
  tribe: z.string().min(1, "Tribe is required"),
  cluster: z.string().min(1, "Cluster is required"),
  clusterHpsmId: z.string().nullable(),
  status: z.string().nullable(),
  iftMailSupport: z.string().nullable(),
  uatMailSupport: z.string().nullable(),
  prodMailSupport: z.string().nullable(),
  guid: z.string().nullable(),
});
```

## File Changes

| File | Change |
|------|--------|
| `src/types/table.ts` | **New** — `EditConfig`, `EditFieldConfig` types |
| `src/api/mutations/automated-system.ts` | **New** — `updateAutomatedSystem` function |
| `src/components/SimpleTable.tsx` | **Modified** — add `editConfig` prop, editing state, actions column, edit cell renderers, row highlight/dim styling |
| `src/routes/automated-system/index.tsx` | **Modified** — expand columns to all DTO fields, add zod schema, `useMutation`, `editConfig` |
| `package.json` | **Modified** — add `zod` and `sonner` dependencies |

## Dependencies

| Package | Purpose |
|---------|---------|
| `zod` | Validation schemas |
| `sonner` | Toast notifications (shadcn-recommended) |

## Non-Breaking

SimpleTable without `editConfig` works exactly as before. Existing pagination, filters, column visibility, and column resizing are unaffected.
