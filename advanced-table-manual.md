# Advanced Table Manual

Step-by-step guide for creating a new page with a server-side filtered, sorted, and paginated data table using the advanced filtering pattern.

**Reference implementation:** `src/routes/box-dice-advanced/index.tsx` with `src/features/box/`

---

## Architecture Overview

```
URL search params
  │
  ▼
validateSearch()          ← parse & validate ?page, ?sort, ?filters (JSON), ?joinOperator
  │
  ▼
advancedDataTableQueryOptions()   ← build OData query ($skip, $top, $filter, $orderby)
  │
  ▼
useSuspenseQuery()        ← fetch ApiResponse<T[]> { count, data }
  │
  ▼
useDataTable()            ← create TanStack Table instance (manual mode)
  │
  ▼
<DataTable>               ← render table rows
  <DataTableAdvancedToolbar>  ← filter UI (add/remove filters, pick operators, enter values)
```

All state lives in URL search params — the page is fully bookmarkable and shareable.

---

## Files You Will Create

Assuming your entity is called **Widget** with API path `/api/v1/widget`:

```
src/
  features/widget/
    api.ts                  # combined API object
    advanced-api.ts         # advancedDataTableQueryOptions + field mapping
    columns.tsx             # column definitions with filter metadata
    row-action.ts           # discriminated union type for sheet actions
    schema.ts               # Zod form schema + write payload type
    mappers.ts              # DTO ↔ form ↔ API payload converters
    components/
      WidgetSheet.tsx       # create/update side sheet (form)
  routes/widget-advanced/
    index.tsx               # the page
  types/
    api.ts                  # add WidgetDto (if not already there)
```

You also edit:
- `src/components/app-sidebar.tsx` — add nav entry

---

## Step 1: Define the DTO

Add your entity type to `src/types/api.ts`:

```ts
export interface WidgetDto {
  id: number;
  name: string;
  category: string;
  price: number;
  createdAt: string;
  active: boolean;
  // relations
  owner: { id: number; name: string } | null;
  tags: { id: number; label: string }[];
}
```

---

## Step 2: Create the Feature Folder

### 2a. Row Action Type

**`src/features/widget/row-action.ts`**

```ts
import type { WidgetDto } from "@/types/api";

export type WidgetRowAction =
  | { variant: "create" }
  | { variant: "update"; row: WidgetDto };
```

### 2b. Column-to-OData Field Mapping + Query Options

**`src/features/widget/advanced-api.ts`**

This file maps column IDs to OData field names and filter variants, then builds the query.

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, WidgetDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

// Map each filterable column ID to its OData field name and variant.
// The variant determines how values are formatted in the $filter clause.
export const widgetFieldByColumnId: Record<string, FieldEntry> = {
  name:      { field: "name",      variant: "text" },
  category:  { field: "category",  variant: "select" },
  price:     { field: "price",     variant: "range" },
  createdAt: { field: "createdAt", variant: "dateRange" },
  active:    { field: "active",    variant: "boolean" },
  owner:     { field: "owner",     variant: "relation" },
  tags:      { field: "tags",      variant: "multiRelation" },
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
      "widgets",
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
        fieldByColumnId: widgetFieldByColumnId,
      });
      return apiFetch<ApiResponse<WidgetDto[]>>(
        `/api/v1/widget?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

**How `buildAdvancedFilterParams` works:**

It takes the `filters` array (from URL), looks up each filter's column ID in `fieldByColumnId`, and emits an OData `$filter` clause based on the operator:

| Operator     | OData Output                                        |
| ------------ | --------------------------------------------------- |
| `iLike`      | `contains_ignoring_case(field, 'value')`            |
| `eq` / `ne`  | `field eq value` (format depends on variant)        |
| `lt/lte/gt/gte` | `field lt/le/gt/ge value`                        |
| `isBetween`  | `(field ge min and field le max)`                   |
| `inArray`    | `field in ('a','b')` or `field/any(x: x/id in (1,2))` for relations |
| `isEmpty`    | `field eq null`                                     |
| `isNotEmpty` | `field ne null`                                     |

Clauses are joined with the `joinOperator` (`and` or `or`).

### 2c. Combined API Object

**`src/features/widget/api.ts`**

```ts
import { advancedDataTableQueryOptions } from "./advanced-api";

// If you also have basic CRUD, compose them:
// import { createCrudApi } from "@/lib/api/create-crud-api";
// const baseApi = createCrudApi<WidgetDto, WidgetFilters, WidgetWritePayload>({
//   basePath: "/api/v1/widget",
//   queryKey: ["widgets"],
// });
// export const widgetApi = { ...baseApi, advancedDataTableQueryOptions };

// Minimal version (advanced table only):
export const widgetApi = { advancedDataTableQueryOptions };
```

### 2d. Column Definitions

**`src/features/widget/columns.tsx`**

Each column declares its filter `variant` in `meta`. This tells the advanced toolbar which filter UI to render and which operators to offer.

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { WidgetDto } from "@/types/api";
import type { WidgetRowAction } from "./row-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

interface GetWidgetColumnsProps {
  setRowAction: (action: WidgetRowAction) => void;
}

export function getWidgetColumns({
  setRowAction,
}: GetWidgetColumnsProps): ColumnDef<WidgetDto>[] {
  return [
    // --- Selection checkbox (pinned left) ---
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 40,
    },

    // --- Text column ---
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Name" />
      ),
      meta: {
        label: "Name",
        variant: "text",           // renders text input, offers: contains, is, is not, empty
        placeholder: "Search names...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },

    // --- Select column ---
    {
      id: "category",
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Category" />
      ),
      meta: {
        label: "Category",
        variant: "select",         // renders dropdown, offers: is, is not, empty
        options: [
          { label: "Electronics", value: "electronics" },
          { label: "Clothing", value: "clothing" },
          { label: "Food", value: "food" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },

    // --- Numeric range column ---
    {
      id: "price",
      accessorKey: "price",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Price" />
      ),
      meta: {
        label: "Price",
        variant: "range",          // renders number input, offers: eq, between, gt, lt, etc.
        range: [0, 100000],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },

    // --- Date range column ---
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Created" />
      ),
      meta: {
        label: "Created",
        variant: "dateRange",      // renders date picker, offers: is, between, before, after
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },

    // --- Boolean column ---
    {
      id: "active",
      accessorKey: "active",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Active" />
      ),
      cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
      meta: {
        label: "Active",
        variant: "boolean",        // renders true/false select, offers: is, is not
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },

    // --- Relation column (single) ---
    // {
    //   id: "owner",
    //   accessorFn: (row) => row.owner?.name ?? "—",
    //   header: ({ column }) => (
    //     <DataTableColumnHeader column={column} label="Owner" />
    //   ),
    //   meta: {
    //     label: "Owner",
    //     variant: "relation",
    //     relationConfig: {
    //       queryOptionsFn: (filters) => ownerApi.listQueryOptions(filters),
    //       columns: ownerPickerColumns,
    //       getLabel: (o) => o.name,
    //       getId: (o) => o.id,
    //     },
    //   },
    //   enableColumnFilter: true,
    //   size: 180,
    // },

    // --- Actions column (pinned right) ---
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                setRowAction({ variant: "update", row: row.original })
              }
            >
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableHiding: false,
      size: 40,
    },
  ];
}
```

**Available `meta.variant` values and their operators:**

| Variant          | Operators                                             | Value UI              |
| ---------------- | ----------------------------------------------------- | --------------------- |
| `text`           | contains, is, is not, empty, not empty                | text input            |
| `number`         | is, is not, <, <=, >, >=, empty, not empty            | number input          |
| `range`          | is, is not, <, <=, >, >=, between, empty, not empty   | number input(s)       |
| `date`           | is, is not, before, after, between, empty, not empty   | date picker           |
| `dateRange`      | is, is not, before, after, between, empty, not empty   | date picker(s)        |
| `boolean`        | is, is not                                            | true/false select     |
| `select`         | is, is not, empty, not empty                          | options dropdown      |
| `multiSelect`    | includes, excludes, empty, not empty                  | checkboxes            |
| `relation`       | includes, excludes, empty, not empty                  | RelationPicker modal  |
| `multiRelation`  | includes, excludes, empty, not empty                  | RelationPicker modal  |

### 2e. Form Schema (for create/update sheet)

**`src/features/widget/schema.ts`**

```ts
import { z } from "zod";

export const widgetFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.number().min(0),
  active: z.boolean(),
  ownerId: z.number().nullable(),
  tagIds: z.array(z.number()),
});

export type WidgetFormValues = z.infer<typeof widgetFormSchema>;
```

### 2f. Mappers

**`src/features/widget/mappers.ts`**

Convert between DTO, form values, and API write payloads:

```ts
import type { WidgetDto } from "@/types/api";
import type { WidgetFormValues } from "./schema";

export function widgetDtoToForm(dto: WidgetDto): WidgetFormValues {
  return {
    name: dto.name,
    category: dto.category,
    price: dto.price,
    active: dto.active,
    ownerId: dto.owner?.id ?? null,
    tagIds: dto.tags.map((t) => t.id),
  };
}

export function widgetFormToCreate(values: WidgetFormValues) {
  return { ...values };
}

export function widgetFormToPatch(
  values: WidgetFormValues,
  dirtyFields: Partial<Record<keyof WidgetFormValues, boolean>>,
) {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(dirtyFields) as (keyof WidgetFormValues)[]) {
    patch[key] = values[key];
  }
  return patch;
}
```

### 2g. Sheet Component

**`src/features/widget/components/WidgetSheet.tsx`**

A side panel form for creating and editing. Uses `react-hook-form` + Zod resolver. On success, calls `onSuccess` so the page can invalidate queries. See `src/features/box/components/BoxSheet.tsx` for the full reference implementation.

---

## Step 3: Create the Route Page

**`src/routes/widget-advanced/index.tsx`**

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

import { widgetApi } from "@/features/widget/api";
import { getWidgetColumns } from "@/features/widget/columns";
import { WidgetSheet } from "@/features/widget/components/WidgetSheet";
import type { WidgetRowAction } from "@/features/widget/row-action";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { dataTableConfig } from "@/config/data-table";

const DEFAULT_PAGE_SIZE = calculatePageSize();

// --- Search param parsing (same boilerplate for every advanced page) ---

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

function validateSearch(
  search: Record<string, unknown>,
): AdvancedSearchParams {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize:
      typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    filters: parseFilters(search.filters),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
  };
}

// --- Route definition ---

export const Route = createFileRoute("/widget-advanced/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    return context.queryClient.ensureQueryData(
      widgetApi.advancedDataTableQueryOptions({
        page: deps.page ?? 1,
        pageSize: deps.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: deps.sort,
        filters: deps.filters,
        joinOperator: deps.joinOperator,
      }),
    );
  },
  component: WidgetAdvancedPage,
});

// --- Page component ---

function WidgetAdvancedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/widget-advanced/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] = useState<WidgetRowAction | null>(null);

  const columns = useMemo(
    () => getWidgetColumns({ setRowAction }),
    [setRowAction],
  );

  const queryOpts = useMemo(
    () =>
      widgetApi.advancedDataTableQueryOptions({
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

  // Sync table state changes → URL search params
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
    initialColumnPinning: { left: ["select"], right: ["actions"] },
  });

  // Sync advanced filter toolbar changes → URL search params
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
          next.page = 1; // reset to first page on filter change
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
    queryClient.invalidateQueries({ queryKey: ["widgets"] });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update"
      ? `update-${rowAction.row.id}`
      : "create";
  const sheetWidget =
    rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Widgets — Advanced</h1>
          <p className="mt-2 text-muted-foreground">
            {data.count} widgets
          </p>
        </div>
      </div>

      <DataTable table={table}>
        <DataTableAdvancedToolbar
          table={table}
          filters={search.filters}
          joinOperator={search.joinOperator}
          onChange={handleFilterChange}
        >
          <Button
            size="sm"
            onClick={() => setRowAction({ variant: "create" })}
          >
            <Plus className="mr-1 size-4" />
            Add Widget
          </Button>
        </DataTableAdvancedToolbar>
      </DataTable>

      {sheetOpen && (
        <WidgetSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          widget={sheetWidget}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
```

---

## Step 4: Add Sidebar Navigation

Edit `src/components/app-sidebar.tsx` and add an entry to the navigation items:

```ts
{ to: "/widget-advanced", label: "Widgets Advanced" },
```

---

## Step 5: Run and Verify

```bash
npm run dev
```

1. TanStack Router auto-generates the route tree — no manual wiring needed.
2. Open the sidebar and navigate to your new page.
3. Verify: pagination, sorting (click column headers), adding/removing filters, switching join operator (and/or).

---

## How the Pieces Connect

```
column.meta.variant
       │
       ├──► DataTableAdvancedToolbar reads variant → shows matching operators & value input
       │
       ├──► handleFilterChange serializes filters to URL as JSON string
       │
       ├──► validateSearch parses JSON back to ExtendedColumnFilter[]
       │
       ├──► advancedDataTableQueryOptions receives filters
       │
       ├──► buildAdvancedFilterParams looks up fieldByColumnId[filter.id]
       │    and emits OData clause based on operator + variant
       │
       └──► API receives $filter=contains_ignoring_case(name,'foo') and price ge 10
```

---

## Common Patterns

### Adding a relation filter

1. In `columns.tsx`, set `meta.variant: "relation"` and provide `meta.relationConfig`:

```ts
meta: {
  label: "Owner",
  variant: "relation",
  relationConfig: {
    queryOptionsFn: (filters) => ownerApi.listQueryOptions(filters),
    columns: ownerPickerColumns,   // ColumnDef[] for the picker table
    getLabel: (owner) => owner.name,
    getId: (owner) => owner.id,
  },
}
```

2. In `advanced-api.ts`, map the column: `owner: { field: "owner", variant: "relation" }`.

The `RelationPicker` component opens a modal with a searchable table. Selected values are stored as `{ id, label }` objects in the filter.

### Adding a multi-select filter

```ts
meta: {
  label: "Status",
  variant: "multiSelect",
  options: [
    { label: "Active", value: "active" },
    { label: "Archived", value: "archived" },
  ],
}
```

### Customizing operators per column

Operators are determined globally by variant in `src/config/data-table.ts` (`operatorsByVariant`). If you need to restrict operators for a specific column, the toolbar uses the variant to look up available operators — modify the config or extend the column meta.

---

## Checklist

- [ ] DTO type in `src/types/api.ts`
- [ ] Feature folder: `row-action.ts`, `advanced-api.ts`, `api.ts`, `columns.tsx`
- [ ] Form files (if CRUD needed): `schema.ts`, `mappers.ts`, `components/Sheet.tsx`
- [ ] Route page: `src/routes/<name>/index.tsx`
- [ ] Sidebar nav entry in `app-sidebar.tsx`
- [ ] Each filterable column has correct `meta.variant` matching `fieldByColumnId` entry
- [ ] `queryKey` in `advancedDataTableQueryOptions` is unique (e.g., `["widgets", "advanced", ...]`)
- [ ] Mock handler added if using `VITE_MOCK_API=true`
