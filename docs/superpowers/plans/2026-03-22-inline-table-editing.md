# Inline Table Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generic inline row editing to `SimpleTable` with validation, and wire it up on the Automated Systems page.

**Architecture:** `SimpleTable` receives an optional `editConfig` prop that enables an actions column with Edit/Save/Discard buttons. Editing state (which row, form values, validation errors) lives inside `SimpleTable`. The consumer provides field type definitions, a zod schema, and an async save handler. On the Automated Systems page, save calls PUT `/api/v1/automated-system/{id}` via TanStack Query mutation.

**Tech Stack:** React, TypeScript, TanStack Table, TanStack Query, zod, sonner, shadcn/ui (Input, Select, Checkbox), lucide-react

**Spec:** `docs/superpowers/specs/2026-03-22-inline-table-editing-design.md`

---

## File Structure

| File | Role |
|------|------|
| `src/types/table.ts` | **New** — `EditConfig`, `EditFieldConfig` type definitions |
| `src/components/SimpleTable.tsx` | **Modified** — add `editConfig` prop, editing state, actions column, edit cell renderers, row styling |
| `src/api/mutations/automated-system.ts` | **New** — `updateAutomatedSystem()` fetch wrapper |
| `src/routes/automated-system/index.tsx` | **Modified** — expand columns, add zod schema, useMutation, editConfig |
| `src/routes/__root.tsx` | **Modified** — add `<Toaster />` from sonner |
| `package.json` | **Modified** — add `zod` and `sonner` dependencies |

---

### Task 1: Install dependencies and add missing shadcn components

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zod and sonner**

```bash
cd F:/programming/react/cometa-frontend && npm install zod sonner
```

- [ ] **Step 2: Add shadcn Select component**

```bash
cd F:/programming/react/cometa-frontend && npx shadcn@latest add select
```

- [ ] **Step 3: Verify installation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/select.tsx
git commit -m "deps: add zod, sonner, and shadcn select component"
```

---

### Task 2: Create EditConfig types

**Files:**
- Create: `src/types/table.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/types/table.ts
import type { ZodSchema } from "zod";

export interface TextFieldConfig {
  type: "text";
}

export interface NumberFieldConfig {
  type: "number";
}

export interface SelectFieldConfig {
  type: "select";
  options: { label: string; value: string }[];
}

export interface CheckboxFieldConfig {
  type: "checkbox";
}

export type EditFieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | CheckboxFieldConfig;

export interface EditConfig<TData> {
  /** Field type definitions. All editable fields should be explicitly listed. */
  fields: Partial<Record<keyof TData, EditFieldConfig>>;

  /** Fields that render as read-only even in edit mode. Include the identity field here. */
  disabledFields?: (keyof TData)[];

  /** Zod schema to validate editable fields. */
  schema: ZodSchema;

  /** Called on save with the row ID and the full merged row data. Reject to trigger error toast. */
  onSave: (rowId: string | number, data: TData) => Promise<void>;

  /** Extracts the unique row identity from the data. */
  rowId: (row: TData) => string | number;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types/table.ts
git commit -m "feat: add EditConfig and EditFieldConfig types for inline table editing"
```

---

### Task 3: Add Toaster to root layout

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add sonner Toaster component**

Add import at top:
```ts
import { Toaster } from "sonner";
```

Add `<Toaster />` inside `RootLayout`, after `<ReactQueryDevtools>`:
```tsx
<Toaster />
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: add sonner Toaster to root layout"
```

---

### Task 4: Add inline editing to SimpleTable

This is the main task. `SimpleTable` gains an optional `editConfig` prop. When provided, it:
1. Renders an actions column (header + cell) with Edit/Save/Discard icon buttons
2. Manages editing state internally (editingRowId, formValues, validationErrors)
3. Renders edit inputs (text, number, select, checkbox) for the editing row
4. Highlights the editing row and dims others
5. Validates on every change via zod, disables Save when invalid
6. On save: merges edits into original row, calls `onSave`, shows toast on error
7. Escape key discards
8. Tab/Shift+Tab moves between fields (native browser focus order — works because inputs are rendered in DOM order within a single row)

**Files:**
- Modify: `src/components/SimpleTable.tsx`

- [ ] **Step 1: Add imports and update props interface**

Add new imports (keep existing ones):
```ts
import { useState, useCallback, useEffect } from "react";
import type { EditConfig, EditFieldConfig } from "@/types/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
```

Update `SimpleTableProps` to add `editConfig`:
```ts
interface SimpleTableProps<TData> {
  table: TanStackTable<TData>;

  // Pagination (optional)
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;

  // Filters (optional)
  filterFields?: FilterField[];
  filters?: Record<string, unknown>;
  onFilterChange?: (partial: Record<string, unknown>) => void;

  // Inline editing (optional)
  editConfig?: EditConfig<TData>;
}
```

Add `editConfig` to the destructured props.

- [ ] **Step 2: Add editing state and helper functions inside SimpleTable**

At the top of the `SimpleTable` function body (after the existing `hasPagination`/`hasFilters` checks), add:

```ts
// Editing state
const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
const [formValues, setFormValues] = useState<Record<string, unknown>>({});
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
const [isSaving, setIsSaving] = useState(false);

const isEditing = editingRowId !== null;

// Validate form values against schema
// Note: zod's z.object() ignores extra keys by default (.strip() mode),
// so passing the full row (including id/disabled fields) to a schema
// that only defines editable fields works correctly.
const validate = useCallback(
  (values: Record<string, unknown>) => {
    if (!editConfig) return {};
    const result = editConfig.schema.safeParse(values);
    if (result.success) return {};
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (path && !errors[path]) {
        errors[path] = issue.message;
      }
    }
    return errors;
  },
  [editConfig],
);

// Start editing a row
const startEditing = useCallback(
  (row: { original: TData }) => {
    if (!editConfig) return;
    const rowId = editConfig.rowId(row.original);
    const values = { ...(row.original as Record<string, unknown>) };
    setEditingRowId(rowId);
    setFormValues(values);
    setValidationErrors(validate(values));
  },
  [editConfig, validate],
);

// Update a single field
const updateField = useCallback(
  (field: string, value: unknown) => {
    setFormValues((prev) => {
      const next = { ...prev, [field]: value };
      setValidationErrors(validate(next));
      return next;
    });
  },
  [validate],
);

// Discard changes
const discardEditing = useCallback(() => {
  setEditingRowId(null);
  setFormValues({});
  setValidationErrors({});
  setIsSaving(false);
}, []);

// Save changes
const saveEditing = useCallback(async () => {
  if (!editConfig || editingRowId === null) return;

  const errors = validate(formValues);
  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    return;
  }

  // Find original row to check for changes
  const originalRow = table
    .getRowModel()
    .rows.find((r) => editConfig.rowId(r.original) === editingRowId);
  if (!originalRow) return;

  const original = originalRow.original as Record<string, unknown>;
  const hasChanges = Object.keys(formValues).some(
    (key) => formValues[key] !== original[key],
  );

  if (!hasChanges) {
    discardEditing();
    return;
  }

  const mergedData = { ...original, ...formValues } as TData;

  setIsSaving(true);
  try {
    await editConfig.onSave(editingRowId, mergedData);
    discardEditing();
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Failed to save changes",
    );
    setIsSaving(false);
  }
}, [editConfig, editingRowId, formValues, validate, table, discardEditing]);

// Escape key handler
useEffect(() => {
  if (!isEditing) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      discardEditing();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [isEditing, discardEditing]);
```

- [ ] **Step 3: Add EditCell renderer helper**

Add this function inside the `SimpleTable` component body (after the state/helpers):

```tsx
// Render an editable cell based on field config
function renderEditCell(field: string, value: unknown) {
  if (!editConfig) return String(value ?? "");

  // Check if field is disabled
  const disabledFields = editConfig.disabledFields ?? [];
  if ((disabledFields as string[]).includes(field)) {
    return <span className="text-muted-foreground">{String(value ?? "")}</span>;
  }

  // Fields not explicitly listed in editConfig.fields are read-only
  const fieldConfig: EditFieldConfig | undefined = editConfig.fields[field as keyof TData];
  if (!fieldConfig) {
    return <span className="text-muted-foreground">{String(value ?? "")}</span>;
  }

  const error = validationErrors[field];

  const wrapWithError = (input: React.ReactNode) => (
    <div className="space-y-1">
      {input}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );

  switch (fieldConfig.type) {
    case "number":
      return wrapWithError(
        <Input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            updateField(field, e.target.value === "" ? null : Number(e.target.value))
          }
          className={error ? "border-destructive" : ""}
        />,
      );

    case "select":
      return wrapWithError(
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => updateField(field, v || null)}
        >
          <SelectTrigger className={error ? "border-destructive" : ""}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldConfig.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      );

    case "checkbox":
      return wrapWithError(
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked) => updateField(field, Boolean(checked))}
        />,
      );

    case "text":
      return wrapWithError(
        <Input
          type="text"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            updateField(field, e.target.value === "" ? null : e.target.value)
          }
          className={error ? "border-destructive" : ""}
        />,
      );
  }
}
```

- [ ] **Step 4: Update TableHeader to include actions column**

In the `<TableHeader>` section, after `{headerGroup.headers.map(...)}` closing (but still inside the `<TableRow>`), add:

```tsx
{editConfig && (
  <TableHead style={{ width: 100 }} className="text-center">
    Actions
  </TableHead>
)}
```

- [ ] **Step 5: Replace TableBody with editing-aware rendering**

Replace the entire existing `<TableBody>` section with:

```tsx
<TableBody>
  {table.getRowModel().rows.length ? (
    table.getRowModel().rows.map((row) => {
      const rowId = editConfig ? editConfig.rowId(row.original) : null;
      const isRowEditing = rowId !== null && rowId === editingRowId;
      const isDimmed = isEditing && !isRowEditing;

      return (
        <TableRow
          key={row.id}
          className={
            isRowEditing
              ? "ring-2 ring-primary/30 bg-muted/30"
              : isDimmed
                ? "opacity-50"
                : ""
          }
        >
          {row.getVisibleCells().map((cell) => {
            const columnId = cell.column.id;

            // Editing row: render edit inputs
            if (isRowEditing) {
              return (
                <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                  {renderEditCell(columnId, formValues[columnId])}
                </TableCell>
              );
            }

            // Normal row
            return (
              <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            );
          })}

          {/* Actions column — rendered outside TanStack column system */}
          {editConfig && (
            <TableCell style={{ width: 100 }} className="text-center">
              {isRowEditing ? (
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={Object.keys(validationErrors).length > 0 || isSaving}
                    onClick={saveEditing}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isSaving}
                    onClick={discardEditing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isEditing}
                  onClick={() => startEditing(row)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          )}
        </TableRow>
      );
    })
  ) : (
    <TableRow>
      <TableCell
        colSpan={table.getAllColumns().length + (editConfig ? 1 : 0)}
        className="h-24 text-center"
      >
        No results.
      </TableCell>
    </TableRow>
  )}
</TableBody>
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/SimpleTable.tsx
git commit -m "feat: add inline editing support to SimpleTable with actions column"
```

---

### Task 5: Create updateAutomatedSystem API function

**Files:**
- Create: `src/api/mutations/automated-system.ts`

- [ ] **Step 1: Create the mutations file**

```ts
// src/api/mutations/automated-system.ts
import type { ApiResponse, AutomatedSystemDto } from "@/types/api";

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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/api/mutations/automated-system.ts
git commit -m "feat: add updateAutomatedSystem API function"
```

---

### Task 6: Wire up editing on the Automated Systems page

**Files:**
- Modify: `src/routes/automated-system/index.tsx`

- [ ] **Step 1: Add imports**

Add to existing imports:
```ts
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { updateAutomatedSystem } from "@/api/mutations/automated-system";
import type { EditConfig } from "@/types/table";
```

- [ ] **Step 2: Expand columns to all AutomatedSystemDto fields**

Replace the existing `columns` array:

```ts
const columns = [
  columnHelper.accessor("name",            { header: "Name",              size: 200 }),
  columnHelper.accessor("objectCode",      { header: "Object Code",      size: 130 }),
  columnHelper.accessor("fullName",        { header: "Full Name",        size: 250 }),
  columnHelper.accessor("ci",              { header: "CI",               size: 120 }),
  columnHelper.accessor("nameHpsm",        { header: "HPSM Name",       size: 150 }),
  columnHelper.accessor("leader",          { header: "Leader",           size: 180 }),
  columnHelper.accessor("leaderSapId",     { header: "Leader SAP ID",   size: 140 }),
  columnHelper.accessor("block",           { header: "Block",            size: 150 }),
  columnHelper.accessor("tribe",           { header: "Tribe",            size: 150 }),
  columnHelper.accessor("cluster",         { header: "Cluster",          size: 150 }),
  columnHelper.accessor("clusterHpsmId",   { header: "Cluster HPSM ID", size: 150 }),
  columnHelper.accessor("status",          { header: "Status",           size: 200 }),
  columnHelper.accessor("iftMailSupport",  { header: "IFT Mail",        size: 200 }),
  columnHelper.accessor("uatMailSupport",  { header: "UAT Mail",        size: 200 }),
  columnHelper.accessor("prodMailSupport", { header: "Prod Mail",       size: 200 }),
  columnHelper.accessor("guid",            { header: "GUID",            size: 280 }),
];
```

- [ ] **Step 3: Add zod schema**

Add after the `filterFields` array:

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

- [ ] **Step 4: Add useMutation and editConfig inside AutomatedSystemPage**

Inside the `AutomatedSystemPage` function, after the existing `useReactTable` call, add:

```ts
const queryClient = useQueryClient();

const updateMutation = useMutation({
  mutationFn: ({ id, data }: { id: number; data: AutomatedSystemDto }) =>
    updateAutomatedSystem(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["automated-systems"] });
  },
});

const editConfig = useMemo<EditConfig<AutomatedSystemDto>>(
  () => ({
    fields: {
      name:            { type: "text" },
      objectCode:      { type: "text" },
      fullName:        { type: "text" },
      ci:              { type: "text" },
      nameHpsm:        { type: "text" },
      leader:          { type: "text" },
      leaderSapId:     { type: "text" },
      block:           { type: "text" },
      tribe:           { type: "text" },
      cluster:         { type: "text" },
      clusterHpsmId:   { type: "text" },
      status: {
        type: "select",
        options: [
          { label: "Находится в эксплуатации", value: "Находится в эксплуатации" },
          { label: "Выведен из эксплуатации", value: "Выведен из эксплуатации" },
        ],
      },
      iftMailSupport:  { type: "text" },
      uatMailSupport:  { type: "text" },
      prodMailSupport: { type: "text" },
      guid:            { type: "text" },
    },
    disabledFields: ["id"],
    schema: automatedSystemSchema,
    onSave: async (id, data) => {
      await updateMutation.mutateAsync({ id: id as number, data });
    },
    rowId: (row) => row.id,
  }),
  [updateMutation],
);
```

- [ ] **Step 5: Pass editConfig to SimpleTable**

Add the `editConfig` prop to the `<SimpleTable>` JSX:

```tsx
<SimpleTable
  table={table}
  page={page}
  pageCount={pageCount}
  onPageChange={setPage}
  filterFields={filterFields}
  filters={filters}
  onFilterChange={setFilters}
  editConfig={editConfig}
/>
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/routes/automated-system/index.tsx
git commit -m "feat: wire up inline editing on Automated Systems page"
```

---

### Task 7: Verification and final commit

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` (with `VITE_MOCK_API=true`)

Verify:
1. Table shows all AutomatedSystemDto fields
2. Click Edit → row enters edit mode, highlighted, others dimmed
3. Other Edit buttons disabled during editing
4. Change a field → validation runs inline
5. Clear a required field → red border + error text, Save disabled
6. Fix the field → error clears, Save enabled
7. Status field shows dropdown with two options
8. Click Save → spinner, data updates, row exits edit mode
9. Click Discard → reverts, exits edit mode
10. Press Escape → discards
11. Tab/Shift+Tab moves between editable fields in the row

- [ ] **Step 4: Commit any fixes**

If any issues found during testing, fix and commit.
