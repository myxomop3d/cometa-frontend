# Flow Advanced Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full CRUD Flow resource with an advanced-filter data table page, following the box / box-dice-advanced pattern.

**Architecture:** New `src/features/flow/` feature module with DTO, form schema, mappers, columns, filter descriptors, advanced API, sheet component, and route. MSW mocks provide the development API. The route uses `DataTableAdvancedToolbar` with server-side OData filtering/sorting/pagination.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query/Table, react-hook-form + zod, shadcn/ui, MSW 2, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/api.ts` | Add `FlowDto`, `FlowFilters` |
| Create | `src/features/flow/schema.ts` | Zod form schema, `FlowFormValues`, `FlowWritePayload` |
| Create | `src/features/flow/mappers.ts` | DTO↔form↔payload converters |
| Create | `src/features/flow/mappers.test.ts` | Mapper unit tests |
| Create | `src/features/flow/row-action.ts` | `FlowRowAction` discriminated union |
| Create | `src/features/flow/filter-descriptors.ts` | Filter descriptor list + `deriveColumnFiltersFromSearch` |
| Create | `src/features/flow/advanced-api.ts` | `flowFieldByColumnId` + `advancedDataTableQueryOptions` |
| Create | `src/features/flow/api.ts` | `createCrudApi` wrapper + re-export advanced |
| Create | `src/features/flow/columns.tsx` | `getFlowColumns()` column definitions |
| Create | `src/features/flow/components/FlowSheet.tsx` | Create/edit sheet |
| Create | `src/mocks/data/flows.ts` | ~40 mock FlowDto records |
| Create | `src/mocks/handlers/flow.ts` | CRUD MSW handlers at `/api/v1/flow` |
| Modify | `src/mocks/handlers.ts` | Register `flowHandlers` |
| Create | `src/routes/flow-advanced/index.tsx` | Advanced table route |
| Modify | `src/components/app-sidebar.tsx` | Add sidebar nav entry |

---

### Task 1: FlowDto & FlowFilters

**Files:**
- Modify: `src/types/api.ts` (append after `FlowGraphDto` interface, around line 214)

- [ ] **Step 1: Add FlowDto and FlowFilters to api.ts**

Add the following at the end of `src/types/api.ts`:

```typescript
// Flow
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types/api.ts
git commit -m "feat: add FlowDto and FlowFilters types"
```

---

### Task 2: Flow Form Schema & Write Payload

**Files:**
- Create: `src/features/flow/schema.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from "zod";

export const flowFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  caption: z.string().min(1, "Caption is required"),
  integrity: z
    .enum(["I_1", "I_2", "I_3", "I_4"])
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  confidentiality: z
    .enum(["K_1", "K_2", "K_3", "K_4"])
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  dataClass: z.string().min(1, "Data class is required"),
  dataType: z.string().min(1, "Data type is required"),
  state: z.string().min(1, "State is required"),
  descriptionMd: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export type FlowFormValues = z.infer<typeof flowFormSchema>;

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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/flow/schema.ts
git commit -m "feat: add Flow form schema and write payload"
```

---

### Task 3: Flow Mappers (TDD)

**Files:**
- Create: `src/features/flow/mappers.ts`
- Create: `src/features/flow/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/flow/mappers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { FlowDto } from "@/types/api";
import { flowDtoToForm, flowFormToCreate, flowFormToPatch } from "./mappers";
import type { FlowFormValues } from "./schema";

const baseDto: FlowDto = {
  id: 2,
  code: "quikpao.non trade orders",
  caption: "Поток Non Trade Orders из Quik PAO",
  integrity: "I_2",
  confidentiality: "K_3",
  dataClass: "Client Data",
  dataType: "Non Trade Orders",
  state: "ACTUAL",
  descriptionMd: null,
};

const baseForm: FlowFormValues = {
  code: "quikpao.non trade orders",
  caption: "Поток Non Trade Orders из Quik PAO",
  integrity: "I_2",
  confidentiality: "K_3",
  dataClass: "Client Data",
  dataType: "Non Trade Orders",
  state: "ACTUAL",
  descriptionMd: null,
};

describe("flowDtoToForm", () => {
  it("maps a populated DTO to form values", () => {
    expect(flowDtoToForm(baseDto)).toEqual(baseForm);
  });

  it("preserves null integrity and confidentiality", () => {
    const dto: FlowDto = { ...baseDto, integrity: null, confidentiality: null };
    const form = flowDtoToForm(dto);
    expect(form.integrity).toBeNull();
    expect(form.confidentiality).toBeNull();
  });
});

describe("flowFormToCreate", () => {
  it("produces a write payload matching all form fields", () => {
    const payload = flowFormToCreate(baseForm);
    expect(payload).toEqual({
      code: "quikpao.non trade orders",
      caption: "Поток Non Trade Orders из Quik PAO",
      integrity: "I_2",
      confidentiality: "K_3",
      dataClass: "Client Data",
      dataType: "Non Trade Orders",
      state: "ACTUAL",
      descriptionMd: null,
    });
  });
});

describe("flowFormToPatch", () => {
  it("returns {} when nothing is dirty", () => {
    expect(flowFormToPatch(baseForm, {})).toEqual({});
  });

  it("emits only the dirty scalar field", () => {
    const patch = flowFormToPatch(baseForm, { code: true });
    expect(patch).toEqual({ code: "quikpao.non trade orders" });
  });

  it("combines multiple dirty fields", () => {
    const patch = flowFormToPatch(baseForm, {
      caption: true,
      integrity: true,
    });
    expect(patch).toEqual({
      caption: "Поток Non Trade Orders из Quik PAO",
      integrity: "I_2",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/flow/mappers.test.ts`
Expected: FAIL — module `./mappers` not found

- [ ] **Step 3: Write minimal implementation**

Create `src/features/flow/mappers.ts`:

```typescript
import type { FlowDto } from "@/types/api";
import type { FlowFormValues, FlowWritePayload } from "./schema";

export function flowDtoToForm(dto: FlowDto): FlowFormValues {
  return {
    code: dto.code,
    caption: dto.caption,
    integrity: dto.integrity,
    confidentiality: dto.confidentiality,
    dataClass: dto.dataClass,
    dataType: dto.dataType,
    state: dto.state,
    descriptionMd: dto.descriptionMd,
  };
}

export function flowFormToCreate(v: FlowFormValues): FlowWritePayload {
  return {
    code: v.code,
    caption: v.caption,
    integrity: v.integrity,
    confidentiality: v.confidentiality,
    dataClass: v.dataClass,
    dataType: v.dataType,
    state: v.state,
    descriptionMd: v.descriptionMd,
  };
}

export type FlowDirtyFields = Partial<Record<keyof FlowFormValues, unknown>>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function flowFormToPatch(
  v: FlowFormValues,
  dirty: FlowDirtyFields,
): Partial<FlowWritePayload> {
  const out: Partial<FlowWritePayload> = {};
  if (isDirty(dirty.code)) out.code = v.code;
  if (isDirty(dirty.caption)) out.caption = v.caption;
  if (isDirty(dirty.integrity)) out.integrity = v.integrity;
  if (isDirty(dirty.confidentiality)) out.confidentiality = v.confidentiality;
  if (isDirty(dirty.dataClass)) out.dataClass = v.dataClass;
  if (isDirty(dirty.dataType)) out.dataType = v.dataType;
  if (isDirty(dirty.state)) out.state = v.state;
  if (isDirty(dirty.descriptionMd)) out.descriptionMd = v.descriptionMd;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/flow/mappers.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/flow/mappers.ts src/features/flow/mappers.test.ts
git commit -m "feat: add Flow mappers with tests"
```

---

### Task 4: Row Action & Filter Descriptors

**Files:**
- Create: `src/features/flow/row-action.ts`
- Create: `src/features/flow/filter-descriptors.ts`

- [ ] **Step 1: Create row-action.ts**

```typescript
import type { FlowDto } from "@/types/api";

export type FlowRowAction =
  | { variant: "create" }
  | { variant: "update"; row: FlowDto };
```

- [ ] **Step 2: Create filter-descriptors.ts**

```typescript
import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface FlowFilterDescriptor extends FilterDescriptor {
  filterKey?: string;
}

export const flowFilterDescriptors: readonly FlowFilterDescriptor[] = [
  { id: "code", variant: "text", filterKey: "code" },
  { id: "caption", variant: "text", filterKey: "caption" },
  { id: "integrity", variant: "select", filterKey: "integrity" },
  { id: "confidentiality", variant: "select", filterKey: "confidentiality" },
  { id: "dataClass", variant: "select", filterKey: "dataClass" },
  { id: "dataType", variant: "text", filterKey: "dataType" },
  { id: "state", variant: "select", filterKey: "state" },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of flowFilterDescriptors) {
    if (!d.filterKey) continue;
    const value = search[d.filterKey];
    if (value === undefined || value === null) continue;

    if (d.variant === "select") {
      filters.push({ id: d.id, value: Array.isArray(value) ? value : [value] });
    } else {
      filters.push({ id: d.id, value });
    }
  }
  return filters;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/flow/row-action.ts src/features/flow/filter-descriptors.ts
git commit -m "feat: add Flow row action and filter descriptors"
```

---

### Task 5: Flow API Layer

**Files:**
- Create: `src/features/flow/advanced-api.ts`
- Create: `src/features/flow/api.ts`

- [ ] **Step 1: Create advanced-api.ts**

```typescript
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, FlowDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

export const flowFieldByColumnId: Record<string, FieldEntry> = {
  code:            { field: "code",            variant: "text" },
  caption:         { field: "caption",         variant: "text" },
  integrity:       { field: "integrity",       variant: "select" },
  confidentiality: { field: "confidentiality", variant: "select" },
  dataClass:       { field: "dataClass",       variant: "select" },
  dataType:        { field: "dataType",        variant: "text" },
  state:           { field: "state",           variant: "select" },
};

export interface AdvancedDataTableQueryParams {
  page: number;
  pageSize: number;
  sort?: string;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export function advancedDataTableQueryOptions(
  params: AdvancedDataTableQueryParams,
) {
  return queryOptions({
    queryKey: [
      "flows",
      "advanced",
      params.page,
      params.pageSize,
      params.sort,
      params.filters,
      params.joinOperator,
    ] as const,
    queryFn: () => {
      const searchParams = buildAdvancedFilterParams({
        ...params,
        fieldByColumnId: flowFieldByColumnId,
      });
      return apiFetch<ApiResponse<FlowDto[]>>(
        `/api/v1/flow?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: Create api.ts**

```typescript
import { createCrudApi } from "@/lib/api/create-crud-api";
import type { FlowDto, FlowFilters } from "@/types/api";
import type { FlowWritePayload } from "./schema";
import { flowFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<FlowDto, FlowFilters, FlowWritePayload>({
  basePath: "/api/v1/flow",
  queryKey: ["flows"],
  filterDescriptors: flowFilterDescriptors,
});

export const flowApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/flow/advanced-api.ts src/features/flow/api.ts
git commit -m "feat: add Flow API layer with advanced query options"
```

---

### Task 6: Flow Columns

**Files:**
- Create: `src/features/flow/columns.tsx`

- [ ] **Step 1: Create columns.tsx**

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis } from "lucide-react";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FlowDto } from "@/types/api";
import type { FlowRowAction } from "./row-action";

interface GetFlowColumnsProps {
  setRowAction: React.Dispatch<React.SetStateAction<FlowRowAction | null>>;
}

export function getFlowColumns({
  setRowAction,
}: GetFlowColumnsProps): ColumnDef<FlowDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          className="translate-y-0.5"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          className="translate-y-0.5"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 40,
    },
    {
      id: "id",
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="ID" />
      ),
      enableSorting: true,
      enableHiding: false,
      size: 60,
    },
    {
      id: "code",
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Code" />
      ),
      meta: {
        label: "Code",
        placeholder: "Search codes...",
        variant: "text",
        filterKey: "code",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 250,
    },
    {
      id: "caption",
      accessorKey: "caption",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Caption" />
      ),
      meta: {
        label: "Caption",
        placeholder: "Search captions...",
        variant: "text",
        filterKey: "caption",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 300,
    },
    {
      id: "integrity",
      accessorKey: "integrity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Integrity" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Integrity",
        variant: "select",
        options: [
          { label: "I_1", value: "I_1" },
          { label: "I_2", value: "I_2" },
          { label: "I_3", value: "I_3" },
          { label: "I_4", value: "I_4" },
        ],
        filterKey: "integrity",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "confidentiality",
      accessorKey: "confidentiality",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Confidentiality" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Confidentiality",
        variant: "select",
        options: [
          { label: "K_1", value: "K_1" },
          { label: "K_2", value: "K_2" },
          { label: "K_3", value: "K_3" },
          { label: "K_4", value: "K_4" },
        ],
        filterKey: "confidentiality",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 130,
    },
    {
      id: "dataClass",
      accessorKey: "dataClass",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Data Class" />
      ),
      meta: {
        label: "Data Class",
        variant: "select",
        options: [
          { label: "Client Data", value: "Client Data" },
          { label: "Static Data", value: "Static Data" },
          { label: "Market Data", value: "Market Data" },
          { label: "System Data", value: "System Data" },
          { label: "Technical Data", value: "Technical Data" },
          { label: "Trades", value: "Trades" },
          { label: "Instruments", value: "Iinstruments" },
          { label: "Analytics Data", value: "Analitics Data" },
          { label: "Other", value: "Other" },
        ],
        filterKey: "dataClass",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 140,
    },
    {
      id: "dataType",
      accessorKey: "dataType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Data Type" />
      ),
      meta: {
        label: "Data Type",
        placeholder: "Search data types...",
        variant: "text",
        filterKey: "dataType",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "state",
      accessorKey: "state",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="State" />
      ),
      meta: {
        label: "State",
        variant: "select",
        options: [{ label: "ACTUAL", value: "ACTUAL" }],
        filterKey: "state",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "flex size-8 p-0",
              )}
            >
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() =>
                  setRowAction({ variant: "update", row: row.original })
                }
              >
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 40,
    },
  ];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/flow/columns.tsx
git commit -m "feat: add Flow column definitions"
```

---

### Task 7: FlowSheet Component

**Files:**
- Create: `src/features/flow/components/FlowSheet.tsx`

- [ ] **Step 1: Create FlowSheet.tsx**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { FlowDto, AppMessage } from "@/types/api";

import { flowApi } from "../api";
import { flowFormSchema, type FlowFormValues } from "../schema";
import { flowDtoToForm, flowFormToCreate, flowFormToPatch } from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const FLOW_FORM_FIELDS: readonly (keyof FlowFormValues)[] = [
  "code",
  "caption",
  "integrity",
  "confidentiality",
  "dataClass",
  "dataType",
  "state",
  "descriptionMd",
];

function isFlowField(target: string): target is keyof FlowFormValues {
  return (FLOW_FORM_FIELDS as readonly string[]).includes(target);
}

interface FlowSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  flow: FlowDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function FlowSheet({
  flow,
  variant,
  onSuccess,
  ...props
}: FlowSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<FlowFormValues>({
    resolver: zodResolver(flowFormSchema),
    defaultValues: flow
      ? flowDtoToForm(flow)
      : {
          code: "",
          caption: "",
          integrity: null,
          confidentiality: null,
          dataClass: "",
          dataType: "",
          state: "ACTUAL",
          descriptionMd: null,
        },
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      if (m.target && isFlowField(m.target)) {
        form.setError(m.target as Path<FlowFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: FlowFormValues) => {
      if (variant === "update" && flow) {
        const patch = flowFormToPatch(data, form.formState.dirtyFields);
        return flowApi.patch(flow.id, patch);
      }
      return flowApi.create(flowFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && flow) {
        queryClient.setQueryData(["flows", "detail", flow.id], res);
        toast.success("Flow updated");
      } else {
        toast.success("Flow created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save flow");
        }
      } else {
        toast.error("Failed to save flow");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Flow" : "Add Flow"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the flow details and save changes."
              : "Fill in the details to create a new flow."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Code */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" {...form.register("code")} />
            {form.formState.errors.code && (
              <p className="text-sm text-destructive">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          {/* Caption */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="caption">Caption</Label>
            <Input id="caption" {...form.register("caption")} />
            {form.formState.errors.caption && (
              <p className="text-sm text-destructive">
                {form.formState.errors.caption.message}
              </p>
            )}
          </div>

          {/* Integrity */}
          <div className="flex flex-col gap-2">
            <Label>Integrity</Label>
            <Controller
              control={form.control}
              name="integrity"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select integrity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I_1">I_1</SelectItem>
                    <SelectItem value="I_2">I_2</SelectItem>
                    <SelectItem value="I_3">I_3</SelectItem>
                    <SelectItem value="I_4">I_4</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Confidentiality */}
          <div className="flex flex-col gap-2">
            <Label>Confidentiality</Label>
            <Controller
              control={form.control}
              name="confidentiality"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select confidentiality..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K_1">K_1</SelectItem>
                    <SelectItem value="K_2">K_2</SelectItem>
                    <SelectItem value="K_3">K_3</SelectItem>
                    <SelectItem value="K_4">K_4</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Data Class */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataClass">Data Class</Label>
            <Input id="dataClass" {...form.register("dataClass")} />
            {form.formState.errors.dataClass && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dataClass.message}
              </p>
            )}
          </div>

          {/* Data Type */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataType">Data Type</Label>
            <Input id="dataType" {...form.register("dataType")} />
            {form.formState.errors.dataType && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dataType.message}
              </p>
            )}
          </div>

          {/* State */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...form.register("state")} />
            {form.formState.errors.state && (
              <p className="text-sm text-destructive">
                {form.formState.errors.state.message}
              </p>
            )}
          </div>

          {/* Description (Markdown) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="descriptionMd">Description</Label>
            <Controller
              control={form.control}
              name="descriptionMd"
              render={({ field }) => (
                <Textarea
                  id="descriptionMd"
                  rows={4}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? null : e.target.value,
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <SheetFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => closeSheet()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {variant === "update" ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify Textarea component exists**

Run: `ls src/components/ui/textarea.tsx`

If it doesn't exist, run: `npx shadcn@latest add textarea`

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/flow/components/FlowSheet.tsx
git commit -m "feat: add FlowSheet create/edit component"
```

---

### Task 8: Mock Data & Handlers

**Files:**
- Create: `src/mocks/data/flows.ts`
- Create: `src/mocks/handlers/flow.ts`
- Modify: `src/mocks/handlers.ts`

- [ ] **Step 1: Create mock data**

Create `src/mocks/data/flows.ts`. Take the first 40 entries from `example/flow_202604140012.json` and convert to camelCase:

```typescript
import type { FlowDto } from "@/types/api";

export const flows: FlowDto[] = [
  {
    id: 2,
    code: "quikpao.non trade orders",
    caption: "Поток Non Trade Orders из Quik PAO",
    integrity: "I_2",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "Non Trade Orders",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 3,
    code: "dias-clearing.fatca categories",
    caption: "Поток FATCA Categories из Diasoft Clearing",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Static Data",
    dataType: "FATCA Categories",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 4,
    code: "mc.moex.forts-refdata-multileg-dict",
    caption: "Поток MOEX.FORTS-REFDATA-MULTILEG-DICT из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "MOEX.FORTS-REFDATA-MULTILEG-DICT",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 6,
    code: "fitp.equitybasket",
    caption: "Поток EQUITYBASKET из FITP",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "EQUITYBASKET",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 7,
    code: "dias-clearing.licenses",
    caption: "Поток LICENSES из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_2",
    dataClass: "Client Data",
    dataType: "LICENSES",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 8,
    code: "mc.spimex.der-participants",
    caption: "Поток SPIMEX.DER-PARTICIPANTS из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "SPIMEX.DER-PARTICIPANTS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 9,
    code: "merida.vendorsdatareq",
    caption: "Поток Vendorsdatareq из ОФР.Merida",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Market Data",
    dataType: "Vendorsdatareq",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 10,
    code: "dias-portfolio.сorp аction",
    caption: "Поток Сorp Аction из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "Сorp Аction",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 11,
    code: "dias-clearing.clients kyc",
    caption: "Поток Clients KYC из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_2",
    dataClass: "Client Data",
    dataType: "Clients KYC",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 12,
    code: "fe-inst.moex.dealing-all.fix",
    caption: "Поток MOEX.DEALING-ALL.FIX из FixEdge CIB: Instances",
    integrity: "I_2",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "MOEX.DEALING-ALL.FIX",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 13,
    code: "dias-clearing.authorities",
    caption: "Поток AUTHORITIES из Diasoft Clearing",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "AUTHORITIES",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 14,
    code: "dias-clearing.institutions",
    caption: "Поток INSTITUTIONS из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_2",
    dataClass: "Client Data",
    dataType: "INSTITUTIONS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 15,
    code: "dias-portfolio.eq forward trades",
    caption: "Поток EQ Forward Trades из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "EQ Forward Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 16,
    code: "fitp.index",
    caption: "Поток INDEX из FI Trading Platform (FITP)",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Market Data",
    dataType: "INDEX",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 17,
    code: "mc.moex.eq-refdata",
    caption: "Поток MOEX.EQ-REFDATA из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "MOEX.EQ-REFDATA",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 18,
    code: "dias-clearing.contragents",
    caption: "Поток CONTRAGENTS из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_2",
    dataClass: "Client Data",
    dataType: "CONTRAGENTS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 19,
    code: "merida.currencyrates",
    caption: "Поток Currencyrates из ОФР.Merida",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Market Data",
    dataType: "Currencyrates",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 20,
    code: "dias-portfolio.fi trades",
    caption: "Поток FI Trades из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "FI Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 21,
    code: "mc.moex.forts-refdata-options",
    caption: "Поток MOEX.FORTS-REFDATA-OPTIONS из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "MOEX.FORTS-REFDATA-OPTIONS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 22,
    code: "dias-clearing.eq trades",
    caption: "Поток EQ Trades из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "EQ Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 23,
    code: "fitp.bond",
    caption: "Поток BOND из FI Trading Platform (FITP)",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "BOND",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 24,
    code: "mc.moex.forts-deals",
    caption: "Поток MOEX.FORTS-DEALS из Market Connectivity",
    integrity: "I_1",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "MOEX.FORTS-DEALS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 25,
    code: "dias-portfolio.repo trades",
    caption: "Поток REPO Trades из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "REPO Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 26,
    code: "mc.spimex.der-refdata",
    caption: "Поток SPIMEX.DER-REFDATA из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "SPIMEX.DER-REFDATA",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 27,
    code: "merida.vendorsdata",
    caption: "Поток Vendorsdata из ОФР.Merida",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Market Data",
    dataType: "Vendorsdata",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 28,
    code: "dias-clearing.fi trades",
    caption: "Поток FI Trades из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "FI Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 29,
    code: "mc.moex.eq-deals",
    caption: "Поток MOEX.EQ-DEALS из Market Connectivity",
    integrity: "I_1",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "MOEX.EQ-DEALS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 30,
    code: "dias-portfolio.eq trades",
    caption: "Поток EQ Trades из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "EQ Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 31,
    code: "fitp.repo",
    caption: "Поток REPO из FI Trading Platform (FITP)",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "REPO",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 32,
    code: "mc.moex.forts-refdata-futures",
    caption: "Поток MOEX.FORTS-REFDATA-FUTURES из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "MOEX.FORTS-REFDATA-FUTURES",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 33,
    code: "dias-clearing.positions",
    caption: "Поток POSITIONS из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "POSITIONS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 34,
    code: "merida.bondissue",
    caption: "Поток Bondissue из ОФР.Merida",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "Bondissue",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 35,
    code: "dias-portfolio.derivative trades",
    caption: "Поток Derivative Trades из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "Derivative Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 36,
    code: "mc.moex.fx-refdata",
    caption: "Поток MOEX.FX-REFDATA из Market Connectivity",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "MOEX.FX-REFDATA",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 37,
    code: "dias-clearing.derivative trades",
    caption: "Поток Derivative Trades из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "Derivative Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 38,
    code: "fitp.deposit",
    caption: "Поток DEPOSIT из FI Trading Platform (FITP)",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "DEPOSIT",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 39,
    code: "mc.moex.fx-deals",
    caption: "Поток MOEX.FX-DEALS из Market Connectivity",
    integrity: "I_1",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "MOEX.FX-DEALS",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 40,
    code: "dias-portfolio.irs trades",
    caption: "Поток IRS Trades из Diasoft Portfolio",
    integrity: "I_3",
    confidentiality: "K_3",
    dataClass: "Client Data",
    dataType: "IRS Trades",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 41,
    code: "merida.equityissue",
    caption: "Поток Equityissue из ОФР.Merida",
    integrity: "I_3",
    confidentiality: "K_4",
    dataClass: "Static Data",
    dataType: "Equityissue",
    state: "ACTUAL",
    descriptionMd: null,
  },
  {
    id: 42,
    code: "dias-clearing.settlements",
    caption: "Поток SETTLEMENTS из Diasoft Clearing",
    integrity: "I_2",
    confidentiality: "K_2",
    dataClass: "System Data",
    dataType: "SETTLEMENTS",
    state: "ACTUAL",
    descriptionMd: null,
  },
];
```

- [ ] **Step 2: Create mock handler**

Create `src/mocks/handlers/flow.ts`:

```typescript
import { http } from "msw";
import type { FlowDto } from "@/types/api";
import { flows } from "../data/flows";
import { apiError, apiResponse } from "../lib/response";
import { applyOData, parseOData } from "../lib/odata";

let db = [...flows];

export const flowHandlers = [
  // LIST
  http.get("/api/v1/flow", ({ request }) => {
    const url = new URL(request.url);
    const params = parseOData(url);
    const { items, total } = applyOData(db, params);
    return apiResponse(items, total);
  }),

  // GET by ID
  http.get("/api/v1/flow/:id", ({ params }) => {
    const item = db.find((s) => s.id === Number(params.id));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // CREATE
  http.post("/api/v1/flow", async ({ request }) => {
    const body = (await request.json()) as Partial<FlowDto>;
    const newItem = {
      ...body,
      id: Math.max(...db.map((i) => i.id)) + 1,
    } as FlowDto;
    db.push(newItem);
    return apiResponse(newItem);
  }),

  // FULL UPDATE
  http.put("/api/v1/flow/:id", async ({ request, params }) => {
    const idx = db.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as FlowDto;
    db[idx] = { ...body, id: db[idx].id };
    return apiResponse(db[idx]);
  }),

  // PARTIAL UPDATE
  http.patch("/api/v1/flow/:id", async ({ request, params }) => {
    const idx = db.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as Partial<FlowDto>;
    db[idx] = { ...db[idx], ...body };
    return apiResponse(db[idx]);
  }),

  // DELETE
  http.delete("/api/v1/flow/:id", ({ params }) => {
    const idx = db.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    db.splice(idx, 1);
    return apiResponse("Deleted");
  }),
];
```

- [ ] **Step 3: Register handlers in handlers.ts**

Add to `src/mocks/handlers.ts`:

```typescript
import { flowHandlers } from "./handlers/flow";
```

And add `...flowHandlers,` to the `handlers` array.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/mocks/data/flows.ts src/mocks/handlers/flow.ts src/mocks/handlers.ts
git commit -m "feat: add Flow mock data and CRUD handlers"
```

---

### Task 9: Flow Advanced Route

**Files:**
- Create: `src/routes/flow-advanced/index.tsx`

- [ ] **Step 1: Create route file**

```tsx
import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { z } from "zod";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { calculatePageSize } from "@/lib/data-table";
import { Button } from "@/components/ui/button";

import { flowApi } from "@/features/flow/api";
import { getFlowColumns } from "@/features/flow/columns";
import { FlowSheet } from "@/features/flow/components/FlowSheet";
import type { FlowRowAction } from "@/features/flow/row-action";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { dataTableConfig } from "@/config/data-table";

const DEFAULT_PAGE_SIZE = calculatePageSize();

const filterSchema = z.array(
  z.object({
    id: z.string(),
    operator: z.enum(dataTableConfig.operators),
    value: z.unknown(),
  }),
);

interface AdvancedSearchParams {
  page: number;
  pageSize: number | undefined;
  sort: string | undefined;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

function parseFilters(raw: unknown): ExtendedColumnFilter[] {
  let parsed: unknown = raw;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const result = filterSchema.safeParse(parsed);
  return result.success ? result.data : [];
}

function validateSearch(search: Record<string, unknown>): AdvancedSearchParams {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    filters: parseFilters(search.filters),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
  };
}

export const Route = createFileRoute("/flow-advanced/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    return context.queryClient.ensureQueryData(
      flowApi.advancedDataTableQueryOptions({
        page: deps.page ?? 1,
        pageSize: deps.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: deps.sort,
        filters: deps.filters,
        joinOperator: deps.joinOperator,
      }),
    );
  },
  component: FlowAdvancedPage,
});

function FlowAdvancedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/flow-advanced/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] = useState<FlowRowAction | null>(null);

  const columns = useMemo(
    () => getFlowColumns({ setRowAction }),
    [setRowAction],
  );

  const queryOpts = useMemo(
    () =>
      flowApi.advancedDataTableQueryOptions({
        page: search.page ?? 1,
        pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: search.sort,
        filters: search.filters,
        joinOperator: search.joinOperator,
      }),
    [search],
  );

  const { data } = useSuspenseQuery(queryOpts);

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      navigate({
        search: (prev: AdvancedSearchParams) => {
          const next: Record<string, unknown> = { ...prev, ...updates };
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) cleaned[key] = value;
          }
          return cleaned as unknown as AdvancedSearchParams;
        },
      });
    },
    [navigate],
  );

  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount,
    search: search as unknown as Record<string, unknown>,
    onNavigate,
    initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
  });

  const handleFilterChange = useCallback(
    ({
      filters,
      joinOperator,
    }: {
      filters: ExtendedColumnFilter[];
      joinOperator: "and" | "or";
    }) => {
      navigate({
        search: (prev: AdvancedSearchParams) => {
          const next: Record<string, unknown> = { ...prev };
          next.page = 1;
          if (filters.length > 0) {
            next.filters = JSON.stringify(filters);
          } else {
            delete next.filters;
          }
          if (joinOperator === "or") {
            next.joinOperator = "or";
          } else {
            delete next.joinOperator;
          }
          return next as unknown as AdvancedSearchParams;
        },
      });
    },
    [navigate],
  );

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["flows"] });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetFlow = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flows — Advanced</h1>
          <p className="mt-2 text-muted-foreground">{data.count} flows</p>
        </div>
      </div>

      <DataTable table={table}>
        <DataTableAdvancedToolbar
          table={table}
          filters={search.filters}
          joinOperator={search.joinOperator}
          onChange={handleFilterChange}
        >
          <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
            <Plus className="mr-1 size-4" />
            Add Flow
          </Button>
        </DataTableAdvancedToolbar>
      </DataTable>

      {sheetOpen && (
        <FlowSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          flow={sheetFlow}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check (will auto-generate route tree)**

Run: `npx tsc --noEmit`
Expected: no errors (TanStack Router plugin auto-generates the route tree entry)

- [ ] **Step 3: Commit**

```bash
git add src/routes/flow-advanced/index.tsx
git commit -m "feat: add Flow advanced table route"
```

---

### Task 10: Sidebar Navigation & Smoke Test

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add sidebar nav entry**

In `src/components/app-sidebar.tsx`, add to the `navItems` array (after the `flow-graph` entry):

```typescript
{ to: "/flow-advanced", label: "Flows (Advanced)" },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: all tests pass (including the new mapper tests)

- [ ] **Step 4: Smoke test in browser**

Run: `VITE_MOCK_API=true npm run dev`

Verify:
1. Sidebar shows "Flows (Advanced)" link
2. Clicking it navigates to `/flow-advanced`
3. Table renders with ~40 rows of flow data
4. Sorting by columns works (click column headers)
5. Advanced filter toolbar works — add a text filter on "Code", verify filtering
6. Add a select filter on "Integrity", verify filtering
7. Click "Add Flow" — sheet opens with empty form
8. Fill in required fields, submit — new row appears
9. Click row action "Edit" — sheet opens pre-filled
10. Edit a field, save — row updates

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add Flows (Advanced) to sidebar navigation"
```
