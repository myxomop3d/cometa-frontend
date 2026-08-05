# Team & Person Table Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/person` and `/team` switchable data-table pages at parity with `/flow`, which requires exposing `Team.leader` through the backend DTO and correcting the shared `relation` filter variant to emit OData the real backend can execute.

**Architecture:** Each page is a `src/features/<name>/` folder (api, columns, filter-descriptors, schema, mappers, row-action, switchable-config, sheet) plus a thin route that wires `makeSwitchableSearch` + `makeSwitchableLoader` + `useSwitchableTablePage`. No new page-level infrastructure. Between the two pages sits a shared-infrastructure phase that changes how `relation` filters serialize and adds sort-field translation, and a backend phase that makes `Team.leader` readable, writable, and filterable.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, TanStack Router/Query/Table, react-hook-form + zod, shadcn/ui on Tailwind v4, vitest, MSW 2. Backend: Java 17 / Spring Boot / MapStruct / Hibernate, in a separate repo.

## Global Constraints

- Frontend repo: `F:\programming\react\cometa-frontend`, branch `feature/gm`. Backend repo: `F:\programming\cometa`.
- **Type-check with `npx tsc -b`.** Bare `tsc --noEmit` silently checks nothing here (solution-style root tsconfig).
- Run tests with `npx vitest run <path>`; full suite with `npx vitest run`.
- Lint with `npm run lint`.
- Path alias `@/` → `src/`.
- `src/routeTree.gen.ts` is auto-generated — never edit it. It regenerates on dev-server start or build.
- TS is strict with `noUnusedLocals` / `noUnusedParameters`. An unused import fails the build.
- Commit after each task. End every commit message with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN
  ```
- **No delete UI.** Row action menus contain Edit only, matching `/flow`.
- The dev server must be started as `npm run dev -- --host` on this machine.

## File Structure

**Phase 1 — Person feature (all new):**
- `src/types/api.ts` (modify) — add `PersonFilters`
- `src/features/person/api.ts` — CRUD + combobox query options
- `src/features/person/advanced-api.ts` — advanced filter query options
- `src/features/person/filter-descriptors.ts` — descriptors + `deriveColumnFiltersFromSearch`
- `src/features/person/schema.ts` — zod form schema + write payload type
- `src/features/person/mappers.ts` — dto↔form↔payload
- `src/features/person/mappers.test.ts` — mapper tests
- `src/features/person/row-action.ts` — row action union
- `src/features/person/columns.tsx` — column defs
- `src/features/person/switchable-config.ts` — the config object
- `src/features/person/components/PersonSheet.tsx` — create/edit form
- `src/routes/person/-simple-search.ts` — simple-mode search validation
- `src/routes/person/index.tsx` — the route
- `src/components/app-sidebar.tsx` (modify) — nav entry

**Phase 2 — Shared filter infrastructure:**
- `src/lib/odata/build-filter-params.ts` (modify) — `relation` emits flat scalar; `sortField` in `$orderby`
- `src/lib/odata/build-filter-params.test.ts` (new) — first tests for this builder
- `src/lib/odata/build-advanced-filter-params.ts` (modify) — same two changes
- `src/lib/odata/build-advanced-filter-params.test.ts` (modify) — update relation expectation, add sortField
- `src/lib/api/create-crud-api.ts` (modify) — `staticParams`
- `src/types/api.ts` (modify) — `BoxDto.itemId` / `oldItemId`
- `src/mocks/data/boxes.ts` (modify) — fixture scalars
- `src/features/box/filter-descriptors.ts` (modify) — `field: "itemId"` / `"oldItemId"`
- `src/features/box/advanced-api.ts` (modify) — same

**Phase 3 — Team backend (`F:\programming\cometa`):**
- `cometa-persistence-module/.../entity/auth/Team.java` (modify) — `leaderId` scalar
- `cometa-service-module/.../service/dto/TeamDto.java` (modify) — `leaderId` + `leader`
- `cometa-service-module/.../service/mapper/PersonRefMapper.java` (new)
- `cometa-service-module/.../service/mapper/TeamMapper.java` (modify)

**Phase 4 — Team feature:**
- `src/types/api.ts` (modify) — `TeamDto.leaderId` / `leader`, `TeamFilters`
- `src/features/person/components/PersonCombobox.tsx` (new)
- `src/features/team/api.ts` (modify — extend, do not replace)
- `src/features/team/advanced-api.ts`, `filter-descriptors.ts`, `schema.ts`, `mappers.ts`, `mappers.test.ts`, `row-action.ts`, `columns.tsx`, `switchable-config.ts` (new)
- `src/features/team/components/TeamSheet.tsx` (new)
- `src/routes/team/-simple-search.ts`, `src/routes/team/index.tsx` (new)
- `src/components/app-sidebar.tsx` (modify) — nav entry

---

## Task 1: Person types, API, and filter descriptors

**Files:**
- Modify: `src/types/api.ts`
- Create: `src/features/person/filter-descriptors.ts`
- Create: `src/features/person/schema.ts`
- Create: `src/features/person/api.ts`
- Create: `src/features/person/advanced-api.ts`

**Interfaces:**
- Consumes: `createCrudApi`, `apiFetch`, `odataString`, `buildAdvancedFilterParams`, `FieldEntry`, existing `PersonDto`.
- Produces: `PersonFilters`; `personFilterDescriptors`; `deriveColumnFiltersFromSearch(search) => {id,value}[]`; `personFormSchema`, `PersonFormValues`, `PersonWritePayload`; `personApi` with `.dataTableQueryOptions`, `.advancedDataTableQueryOptions`, `.create`, `.patch`, `.detailQueryOptions`, `.comboboxQueryOptions`; `personsFilteredQueryOptions(filters: Record<string, unknown>)`; `personFieldByColumnId`.

- [ ] **Step 1: Add `PersonFilters` to `src/types/api.ts`**

Insert directly after the existing `PersonDto` interface:

```ts
export interface PersonFilters extends Partial<PaginationParams> {
  email?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
}
```

- [ ] **Step 2: Create `src/features/person/filter-descriptors.ts`**

```ts
import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface PersonFilterDescriptor extends FilterDescriptor {
  filterKey?: string;
}

export const personFilterDescriptors: readonly PersonFilterDescriptor[] = [
  { id: "email", variant: "text", filterKey: "email" },
  { id: "lastName", variant: "text", filterKey: "lastName" },
  { id: "firstName", variant: "text", filterKey: "firstName" },
  { id: "middleName", variant: "text", filterKey: "middleName" },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of personFilterDescriptors) {
    if (!d.filterKey) continue;
    const value = search[d.filterKey];
    if (value === undefined || value === null) continue;
    filters.push({ id: d.id, value });
  }
  return filters;
}
```

- [ ] **Step 3: Create `src/features/person/schema.ts`**

All four fields are `NOT NULL` on the entity, so all are required.

```ts
import { z } from "zod";

export const personFormSchema = z.object({
  email: z.string().min(1, "Email is required").email("Must be a valid email"),
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().min(1, "Middle name is required"),
});

export type PersonFormValues = z.infer<typeof personFormSchema>;

export interface PersonWritePayload {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
}
```

- [ ] **Step 4: Create `src/features/person/api.ts`**

`comboboxQueryOptions` is used by Task 12's `PersonCombobox`.

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, PersonDto, PersonFilters } from "@/types/api";
import type { PersonWritePayload } from "./schema";
import { personFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<PersonDto, PersonFilters, PersonWritePayload>({
  basePath: "/api/v1/person",
  queryKey: ["persons"],
  filterDescriptors: personFilterDescriptors,
});

/** Combobox options: server-side search — $top=20 + $filter over last/first name. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["persons", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        const esc = odataString(q);
        params.set(
          "$filter",
          `contains_ignoring_case(lastName, '${esc}') or contains_ignoring_case(firstName, '${esc}')`,
        );
      }
      return apiFetch<ApiResponse<PersonDto[]>>(
        `/api/v1/person?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Options for `RelationPicker` (used by Task 13's Leader column filter).
 * The picker calls this with `{ name?, ids?, page?, pageSize? }` — a different
 * contract from `listQueryOptions`, which takes `PersonFilters` and emits plain
 * key=value params. Modeled on `fetchItemsFiltered` in `src/api/item.ts`.
 */
export async function fetchPersonsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<PersonDto[]>> {
  const params = new URLSearchParams();
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  params.set("$skip", String((Number(page) - 1) * Number(pageSize)));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];
  if (fieldFilters.name) {
    const esc = odataString(fieldFilters.name);
    clauses.push(
      `(contains_ignoring_case(lastName, '${esc}') or contains_ignoring_case(firstName, '${esc}'))`,
    );
  }
  if (
    Array.isArray(fieldFilters.ids) &&
    (fieldFilters.ids as number[]).length > 0
  ) {
    clauses.push(`id in (${(fieldFilters.ids as number[]).join(",")})`);
  }
  if (clauses.length > 0) {
    params.set("$filter", clauses.join(" and "));
  }

  return apiFetch<ApiResponse<PersonDto[]>>(
    `/api/v1/person?${params.toString()}`,
  );
}

export function personsFilteredQueryOptions(
  filters: Record<string, unknown> = {},
) {
  return queryOptions({
    queryKey: ["persons", "list", filters] as const,
    queryFn: () => fetchPersonsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}

export const personApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
};
```

The `name` clause is parenthesized because it `or`s two predicates — without the parens an `and`-joined `id in (...)` would bind to only the second one.

- [ ] **Step 5: Create `src/features/person/advanced-api.ts`**

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, PersonDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

export const personFieldByColumnId: Record<string, FieldEntry> = {
  email:      { field: "email",      variant: "text" },
  lastName:   { field: "lastName",   variant: "text" },
  firstName:  { field: "firstName",  variant: "text" },
  middleName: { field: "middleName", variant: "text" },
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
      "persons",
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
        fieldByColumnId: personFieldByColumnId,
      });
      return apiFetch<ApiResponse<PersonDto[]>>(
        `/api/v1/person?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: exits 0, no output.

- [ ] **Step 7: Commit**

```bash
git add src/types/api.ts src/features/person/
git commit -m "feat(person): api layer, filter descriptors, and form schema

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 2: Person mappers (TDD)

**Files:**
- Create: `src/features/person/mappers.ts`
- Test: `src/features/person/mappers.test.ts`

**Interfaces:**
- Consumes: `PersonDto`, `PersonFormValues`, `PersonWritePayload` from Task 1.
- Produces: `personDtoToForm(dto) => PersonFormValues`; `personFormToCreate(v) => PersonWritePayload`; `personFormToPatch(v, dirty) => Partial<PersonWritePayload>`; `PersonDirtyFields`.

- [ ] **Step 1: Write the failing test**

Create `src/features/person/mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PersonDto } from "@/types/api";
import {
  personDtoToForm,
  personFormToCreate,
  personFormToPatch,
} from "./mappers";
import type { PersonFormValues } from "./schema";

const dto: PersonDto = {
  id: 7,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
};

const form: PersonFormValues = {
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
};

describe("personDtoToForm", () => {
  it("drops server-managed fields and keeps the four editable ones", () => {
    expect(personDtoToForm(dto)).toEqual(form);
  });
});

describe("personFormToCreate", () => {
  it("returns the full write payload", () => {
    expect(personFormToCreate(form)).toEqual({
      email: "ivanov@example.com",
      lastName: "Иванов",
      firstName: "Иван",
      middleName: "Иванович",
    });
  });
});

describe("personFormToPatch", () => {
  it("returns only dirty fields", () => {
    expect(personFormToPatch(form, { email: true })).toEqual({
      email: "ivanov@example.com",
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(personFormToPatch(form, {})).toEqual({});
  });

  it("treats a non-empty array flag as dirty", () => {
    expect(personFormToPatch(form, { lastName: [true] })).toEqual({
      lastName: "Иванов",
    });
  });

  it("treats an empty array flag as clean", () => {
    expect(personFormToPatch(form, { lastName: [] })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/person/mappers.test.ts`
Expected: FAIL — cannot resolve `./mappers`.

- [ ] **Step 3: Write the implementation**

Create `src/features/person/mappers.ts`:

```ts
import type { PersonDto } from "@/types/api";
import type { PersonFormValues, PersonWritePayload } from "./schema";

export function personDtoToForm(dto: PersonDto): PersonFormValues {
  return {
    email: dto.email,
    lastName: dto.lastName,
    firstName: dto.firstName,
    middleName: dto.middleName,
  };
}

export function personFormToCreate(v: PersonFormValues): PersonWritePayload {
  return {
    email: v.email,
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
  };
}

export type PersonDirtyFields = Partial<
  Record<keyof PersonFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function personFormToPatch(
  v: PersonFormValues,
  dirty: PersonDirtyFields,
): Partial<PersonWritePayload> {
  const out: Partial<PersonWritePayload> = {};
  if (isDirty(dirty.email)) out.email = v.email;
  if (isDirty(dirty.lastName)) out.lastName = v.lastName;
  if (isDirty(dirty.firstName)) out.firstName = v.firstName;
  if (isDirty(dirty.middleName)) out.middleName = v.middleName;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/person/mappers.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/person/mappers.ts src/features/person/mappers.test.ts
git commit -m "feat(person): dto/form/payload mappers with dirty-field patching

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 3: Person columns, row action, and switchable config

**Files:**
- Create: `src/features/person/row-action.ts`
- Create: `src/features/person/columns.tsx`
- Create: `src/features/person/switchable-config.ts`

**Interfaces:**
- Consumes: `personApi` (Task 1), `deriveColumnFiltersFromSearch` (Task 1).
- Produces: `PersonRowAction`; `getPersonColumns({setRowAction}) => ColumnDef<PersonDto>[]`; `personSwitchableConfig`; `personSimpleFilterKeys`.

- [ ] **Step 1: Create `src/features/person/row-action.ts`**

```ts
import type { PersonDto } from "@/types/api";

export type PersonRowAction =
  | { variant: "create" }
  | { variant: "update"; row: PersonDto };
```

- [ ] **Step 2: Create `src/features/person/columns.tsx`**

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
import type { PersonDto } from "@/types/api";
import type { PersonRowAction } from "./row-action";

interface GetPersonColumnsProps {
  setRowAction: React.Dispatch<React.SetStateAction<PersonRowAction | null>>;
}

export function getPersonColumns({
  setRowAction,
}: GetPersonColumnsProps): ColumnDef<PersonDto>[] {
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
      id: "email",
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Email" />
      ),
      meta: {
        label: "Email",
        placeholder: "Search emails...",
        variant: "text",
        filterKey: "email",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 260,
    },
    {
      id: "lastName",
      accessorKey: "lastName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Last Name" />
      ),
      meta: {
        label: "Last Name",
        placeholder: "Search last names...",
        variant: "text",
        filterKey: "lastName",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      id: "firstName",
      accessorKey: "firstName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="First Name" />
      ),
      meta: {
        label: "First Name",
        placeholder: "Search first names...",
        variant: "text",
        filterKey: "firstName",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      id: "middleName",
      accessorKey: "middleName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Middle Name" />
      ),
      meta: {
        label: "Middle Name",
        placeholder: "Search middle names...",
        variant: "text",
        filterKey: "middleName",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
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

- [ ] **Step 3: Create `src/features/person/switchable-config.ts`**

```ts
import { personApi } from "./api";
import { getPersonColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { PersonDto } from "@/types/api";
import type { PersonRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const personSimpleFilterKeys = [
  "email",
  "lastName",
  "firstName",
  "middleName",
] as const;

export const personSwitchableConfig: SwitchableTableConfig<
  PersonDto,
  PersonRowAction
> = {
  queryKey: ["persons"],
  simpleQueryOptions: (p) => personApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => personApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: personSimpleFilterKeys,
  getColumns: getPersonColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
};
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/person/
git commit -m "feat(person): columns, row action, and switchable table config

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 4: PersonSheet

**Files:**
- Create: `src/features/person/components/PersonSheet.tsx`

**Interfaces:**
- Consumes: `personApi`, `personFormSchema`, `PersonFormValues`, `personDtoToForm`, `personFormToCreate`, `personFormToPatch`, `ApiError`.
- Produces: `PersonSheet` — props `{ person: PersonDto | null; variant: "update" | "create"; onSuccess: () => void }` plus `Sheet` props.

- [ ] **Step 1: Create the component**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, type Path } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PersonDto, AppMessage } from "@/types/api";

import { personApi } from "../api";
import { personFormSchema, type PersonFormValues } from "../schema";
import {
  personDtoToForm,
  personFormToCreate,
  personFormToPatch,
} from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const PERSON_FORM_FIELDS: readonly (keyof PersonFormValues)[] = [
  "email",
  "lastName",
  "firstName",
  "middleName",
];

function isPersonField(target: string): target is keyof PersonFormValues {
  return (PERSON_FORM_FIELDS as readonly string[]).includes(target);
}

interface PersonSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  person: PersonDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function PersonSheet({
  person,
  variant,
  onSuccess,
  ...props
}: PersonSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: person
      ? personDtoToForm(person)
      : { email: "", lastName: "", firstName: "", middleName: "" },
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      if (m.target && isPersonField(m.target)) {
        form.setError(m.target as Path<PersonFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: PersonFormValues) => {
      if (variant === "update" && person) {
        const patch = personFormToPatch(data, form.formState.dirtyFields);
        return personApi.patch(person.id, patch);
      }
      return personApi.create(personFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && person) {
        queryClient.setQueryData(["persons", "detail", person.id], res);
        toast.success("Person updated");
      } else {
        toast.success("Person created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save person");
        }
      } else {
        toast.error("Failed to save person");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Person" : "Add Person"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the person details and save changes."
              : "Fill in the details to create a new person."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" {...form.register("lastName")} />
            {form.formState.errors.lastName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.lastName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" {...form.register("firstName")} />
            {form.formState.errors.firstName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.firstName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="middleName">Middle Name</Label>
            <Input id="middleName" {...form.register("middleName")} />
            {form.formState.errors.middleName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.middleName.message}
              </p>
            )}
          </div>

          <SheetFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => closeSheet()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
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

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/person/components/PersonSheet.tsx
git commit -m "feat(person): create/edit sheet with server-error field mapping

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 5: /person route and sidebar entry

**Files:**
- Create: `src/routes/person/-simple-search.ts`
- Create: `src/routes/person/index.tsx`
- Modify: `src/components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `personSwitchableConfig`, `PersonSheet`, `makeSwitchableSearch`, `makeSwitchableLoader`, `useSwitchableTablePage`.
- Produces: route `/person`.

- [ ] **Step 1: Create `src/routes/person/-simple-search.ts`**

All four Person filters are plain text, so only `asStr` is needed.

```ts
function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function validatePersonSimpleFields(search: Record<string, unknown>) {
  return {
    email: asStr(search.email),
    lastName: asStr(search.lastName),
    firstName: asStr(search.firstName),
    middleName: asStr(search.middleName),
  };
}
```

- [ ] **Step 2: Create `src/routes/person/index.tsx`**

```tsx
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { AdvancedFilterToggle } from "@/components/data-table/advanced-filter-toggle";
import { Button } from "@/components/ui/button";

import { makeSwitchableSearch } from "@/lib/data-table/switchable-search";
import type { SwitchableSearchBase } from "@/lib/data-table/switchable-search";
import { makeSwitchableLoader } from "@/lib/data-table/switchable-page";
import { useSwitchableTablePage } from "@/hooks/use-switchable-table-page";
import { personSwitchableConfig } from "@/features/person/switchable-config";
import { validatePersonSimpleFields } from "./-simple-search";
import { PersonSheet } from "@/features/person/components/PersonSheet";

export const Route = createFileRoute("/person/")({
  validateSearch: makeSwitchableSearch(validatePersonSimpleFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(personSwitchableConfig),
  component: PersonPage,
});

function PersonPage() {
  // Making `loaderDeps`/`loader` type-check forces TanStack to widen this
  // route's inferred search schema to `{}`; the runtime value is the validated
  // search, so assert it back to the shared switchable-search shape. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/person/" });
  const queryClient = useQueryClient();

  const {
    table,
    advanced,
    count,
    rowAction,
    setRowAction,
    toggleMode,
    handleFilterChange,
  } = useSwitchableTablePage({
    config: personSwitchableConfig,
    search,
    navigate,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: personSwitchableConfig.queryKey });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetPerson = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Person
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Persons</h1>
          <p className="mt-2 text-muted-foreground">{count} persons</p>
        </div>
      </div>

      <DataTable table={table}>
        {advanced ? (
          <DataTableAdvancedToolbar
            table={table}
            filters={search.filters}
            joinOperator={search.joinOperator}
            onChange={handleFilterChange}
          >
            {actions}
          </DataTableAdvancedToolbar>
        ) : (
          <DataTableToolbar table={table}>{actions}</DataTableToolbar>
        )}
      </DataTable>

      {sheetOpen && (
        <PersonSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          person={sheetPerson}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar entry**

In `src/components/app-sidebar.tsx`, change the `navItems` array to:

```tsx
const navItems = [
  { to: "/automated-system", label: "Automated Systems" },
  { to: "/box-dice", label: "Boxes (Dice)" },
  { to: "/flow-graph", label: "Flow Graph" },
  { to: "/flow", label: "Flows" },
  { to: "/person", label: "Persons" },
  { to: "/components", label: "Components" },
] as const;
```

- [ ] **Step 4: Regenerate the route tree and type-check**

Run: `npx tsc -b`
Expected: may fail first with "/person/" not assignable — the route tree has not regenerated yet. If so, run `npm run build` once (which runs the router plugin), then re-run `npx tsc -b`.
Expected after regeneration: exits 0.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev -- --host`
Navigate to `http://localhost:5173/person`. Confirm: the table renders with data, the four text filters work in simple mode, the "Advanced filters" toggle switches modes, sorting and pagination work, "Add Person" opens the sheet, and editing a row saves.

- [ ] **Step 6: Commit**

```bash
git add src/routes/person/ src/components/app-sidebar.tsx src/routeTree.gen.ts
git commit -m "feat(person): switchable /person table page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 6: `relation` emits a flat scalar (TDD)

The `relation` variant currently emits `field/id eq N`. That OData navigation form has never run against the real backend — Box/Item/Thing are MSW-only demo resources — and it cannot: `ODataFilterHelper.getPathExpression` splits a dotted path and calls `root.fetch(parts[0])`, while `ODataCriteriaService.createCountQuery` applies the same where-predicate to its own root, putting a fetch join inside `SELECT COUNT(...)`, which Hibernate rejects.

**Files:**
- Create: `src/lib/odata/build-filter-params.test.ts`
- Modify: `src/lib/odata/build-filter-params.ts:115-121`
- Modify: `src/lib/odata/build-advanced-filter-params.ts:71-78`
- Modify: `src/lib/odata/build-advanced-filter-params.test.ts:103`

**Interfaces:**
- Consumes: existing `buildFilterParams`, `buildAdvancedFilterParams`.
- Produces: no signature change. Behavior change — `relation` clauses become `` `${field} eq ${id}` ``.

- [ ] **Step 1: Write the failing test for the simple builder**

Create `src/lib/odata/build-filter-params.test.ts`. This file does not exist today; the simple builder is currently untested.

```ts
import { describe, it, expect } from "vitest";
import { buildFilterParams } from "./build-filter-params";
import type { FilterDescriptor } from "./build-filter-params";

const descriptors: readonly FilterDescriptor[] = [
  { id: "name", variant: "text" },
  { id: "item", variant: "relation", field: "itemId" },
  { id: "things", variant: "multiRelation" },
];

function build(columnFilters: { id: string; value: unknown }[], sort?: string) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors,
  });
}

describe("buildFilterParams pagination", () => {
  it("maps page/pageSize to $skip/$top", () => {
    const p = build([]);
    expect(p.get("$skip")).toBe("0");
    expect(p.get("$top")).toBe("10");
  });
});

describe("buildFilterParams relation", () => {
  it("emits a flat scalar comparison, not a navigation path", () => {
    const p = build([{ id: "item", value: 7 }]);
    expect(p.get("$filter")).toBe("itemId eq 7");
  });

  it("omits the clause when the value is undefined", () => {
    const p = build([{ id: "item", value: undefined }]);
    expect(p.get("$filter")).toBeNull();
  });
});

describe("buildFilterParams multiRelation", () => {
  it("still emits the collection navigation form", () => {
    const p = build([{ id: "things", value: [1, 2] }]);
    expect(p.get("$filter")).toBe("things/any(x: x/id in (1,2))");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/odata/build-filter-params.test.ts`
Expected: FAIL — "buildFilterParams relation > emits a flat scalar comparison" gets `itemId/id eq 7`, expected `itemId eq 7`. The other tests pass.

- [ ] **Step 3: Change the simple builder**

In `src/lib/odata/build-filter-params.ts`, replace the `relation` case:

```ts
      case "relation": {
        const relId = value as number | undefined;
        if (relId !== undefined && relId !== null) {
          clauses.push(`${field} eq ${Number(relId)}`);
        }
        break;
      }
```

Leave the `multiRelation` case exactly as it is.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/odata/build-filter-params.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Update the advanced builder**

In `src/lib/odata/build-advanced-filter-params.ts`, replace the single-value relation branch inside `clauseFor`:

```ts
      if (variant === "relation") {
        const relId = isRelationValue(value)
          ? value.id
          : typeof value === "number"
            ? value
            : Number(value);
        return `${field} ${op} ${relId}`;
      }
```

Leave the array branch (`variant === "multiRelation" || variant === "relation"` at line ~126) unchanged — that path serves `inArray`/`notInArray` operators over collections.

- [ ] **Step 6: Update the advanced builder's test expectation**

Two edits in `src/lib/odata/build-advanced-filter-params.test.ts`.

First, in the shared `fieldByColumnId` at the top of the file (line ~12), change the `item` entry:

```ts
  item:      { field: "itemId",    variant: "relation" as const },
```

Leave `things` as `{ field: "things", variant: "multiRelation" as const }` — `multiRelation` is unchanged.

Second, replace the relation test at line ~99 in full:

```ts
  it("relation eq/ne compares the flat scalar field", () => {
    const p = build([
      { id: "item", operator: "eq", value: { id: 7, label: "Seven" } },
    ]);
    expect(p.get("$filter")).toBe("itemId eq 7");
  });
```

The test name changes too — the old name ("relation eq/ne uses field/id eq N") describes the behavior being removed.

- [ ] **Step 7: Run both builder test files**

Run: `npx vitest run src/lib/odata/`
Expected: PASS, all tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/odata/
git commit -m "fix(odata): relation filters emit a flat scalar instead of a nav path

field/id eq N put a fetch join inside createCountQuery's SELECT COUNT,
which Hibernate rejects. The old form was only ever exercised by the
MSW-only Box resource, never the real backend.

Adds build-filter-params.test.ts — the simple builder had no tests.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 7: Migrate box to flat relation ids

**Files:**
- Modify: `src/types/api.ts` (`BoxDto`)
- Modify: `src/mocks/data/boxes.ts`
- Modify: `src/features/box/filter-descriptors.ts:23,25`
- Modify: `src/features/box/advanced-api.ts:23,26`

**Interfaces:**
- Consumes: the changed `relation` behavior from Task 6.
- Produces: `BoxDto.itemId` and `BoxDto.oldItemId`.

- [ ] **Step 1: Add the scalars to `BoxDto`**

In `src/types/api.ts`, change the `BoxDto` interface to:

```ts
export interface BoxDto {
  id: number;
  name: string;
  objectCode: string | null;
  shape: "O" | "X";
  num: number;
  item: ItemDto | null;
  itemId: number | null;
  things: ThingDto[] | null;
  oldItem: ItemDto | null;
  oldItemId: number | null;
  oldThings: ThingDto[] | null;
  dateStr: string;
  checkbox: boolean;
  tags: string[];
}
```

This mirrors the `TeamDto` shape defined in Task 10 — nested object for display, scalar FK for filtering.

- [ ] **Step 2: Populate the scalars in the fixtures**

In `src/mocks/data/boxes.ts`, the rows are built with `pickItem(n)` / `pickItem(null)`. Rather than editing 24+ rows by hand, add a derivation pass after the array literal. Change the `export const boxes: BoxDto[] = [...]` declaration so the literal is assigned to an intermediate without the new fields, then map:

```ts
type BoxSeed = Omit<BoxDto, "itemId" | "oldItemId">;

const boxSeeds: BoxSeed[] = [
  // ...the existing row literals, unchanged...
];

export const boxes: BoxDto[] = boxSeeds.map((b) => ({
  ...b,
  itemId: b.item?.id ?? null,
  oldItemId: b.oldItem?.id ?? null,
}));
```

Keep every existing row literal byte-identical; only the surrounding declaration changes.

- [ ] **Step 3: Point the box descriptors at the scalars**

In `src/features/box/filter-descriptors.ts`, change the two relation entries:

```ts
  { id: "item", variant: "relation", field: "itemId", filterKey: "itemId" },
```
and
```ts
  { id: "oldItem", variant: "relation", field: "oldItemId", filterKey: "oldItemId" },
```

Leave `things` and `oldThings` (`multiRelation`) untouched.

- [ ] **Step 4: Point the advanced field map at the scalars**

In `src/features/box/advanced-api.ts`, change:

```ts
  item:       { field: "itemId",    variant: "relation" },
```
and
```ts
  oldItem:    { field: "oldItemId", variant: "relation" },
```

Leave `"item.name"`, `things`, and `oldThings` unchanged.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. If `src/mocks/lib/odata.test.ts` fails on a box fixture assertion, update the affected expectation — the fixtures now carry two extra fields.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Verify the box page still filters**

Run: `VITE_MOCK_API=true npm run dev -- --host`
Navigate to `http://localhost:5173/box-dice`. Confirm the Item and Old Item relation filters still narrow the table in both simple and advanced modes, and that the Things multi-relation filter still works.

- [ ] **Step 8: Commit**

```bash
git add src/types/api.ts src/mocks/ src/features/box/
git commit -m "refactor(box): filter relations by flat itemId/oldItemId scalars

Follows the relation-variant change: BoxDto now carries scalar FKs
alongside the nested objects, matching the real-backend DTO shape.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 8: `sortField` translation (TDD)

Both builders serialize sort as `part.split(".")` → `[field, dir]`, so a dotted field name in the URL parses as garbage (`leader.lastName.asc` yields field `leader`, dir `lastName`). Translation therefore happens at emission: the URL stays in column-id space, and the builder maps the id to its `sortField`.

**Files:**
- Modify: `src/lib/odata/build-filter-params.ts` (`FilterDescriptor`, `$orderby` block)
- Modify: `src/lib/odata/build-filter-params.test.ts`
- Modify: `src/lib/odata/build-advanced-filter-params.ts` (`FieldEntry`, `$orderby` block)
- Modify: `src/lib/odata/build-advanced-filter-params.test.ts`

**Interfaces:**
- Produces: optional `sortField?: string` on `FilterDescriptor` and on `FieldEntry`. When present, `$orderby` emits it in place of the column id.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/odata/build-filter-params.test.ts`:

```ts
describe("buildFilterParams $orderby", () => {
  it("emits the column id when no sortField is configured", () => {
    const p = build([], "name.asc");
    expect(p.get("$orderby")).toBe("name asc");
  });

  it("substitutes sortField for the column id", () => {
    const p = buildFilterParams({
      page: 1,
      pageSize: 10,
      sort: "item.desc",
      columnFilters: [],
      descriptors: [
        { id: "item", variant: "relation", field: "itemId", sortField: "item.name" },
      ],
    });
    expect(p.get("$orderby")).toBe("item.name desc");
  });

  it("handles multiple sort parts", () => {
    const p = buildFilterParams({
      page: 1,
      pageSize: 10,
      sort: "item.asc,name.desc",
      columnFilters: [],
      descriptors: [
        { id: "item", variant: "relation", field: "itemId", sortField: "item.name" },
        { id: "name", variant: "text" },
      ],
    });
    expect(p.get("$orderby")).toBe("item.name asc,name desc");
  });
});
```

Note the third case is why translation must key on the column id: `item.name` contains a dot and would be unparseable if it lived in the URL.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/odata/build-filter-params.test.ts`
Expected: FAIL — "substitutes sortField" gets `item desc`, expected `item.name desc`.

- [ ] **Step 3: Add `sortField` to `FilterDescriptor` and use it**

In `src/lib/odata/build-filter-params.ts`, extend the interface:

```ts
export interface FilterDescriptor {
  /** Column id (used as $filter field name, unless overridden). */
  id: string;
  /** OData field name, if different from id. */
  field?: string;
  /** OData field used for $orderby, if different from the filter field.
   *  May contain a navigation path (e.g. "leader.lastName") — it is only
   *  ever emitted, never parsed out of the URL. */
  sortField?: string;
  variant: FilterVariant;
}
```

Then replace the `$orderby` block at the end of `buildFilterParams`:

```ts
  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [f, dir] = part.split(".");
        const desc = byId.get(f);
        return `${desc?.sortField ?? f} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }
```

`byId` is already built above the filter loop and is in scope.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/odata/build-filter-params.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the same to the advanced builder**

In `src/lib/odata/build-advanced-filter-params.ts`, extend `FieldEntry`:

```ts
export interface FieldEntry {
  field: string;
  /** OData field used for $orderby, if different from `field`. May contain a
   *  navigation path — only ever emitted, never parsed out of the URL. */
  sortField?: string;
  variant: FilterVariant;
}
```

and replace its `$orderby` block:

```ts
  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [f, dir] = part.split(".");
        const entry = fieldByColumnId[f];
        return `${entry?.sortField ?? f} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }
```

- [ ] **Step 6: Add a matching test for the advanced builder**

Append to `src/lib/odata/build-advanced-filter-params.test.ts`:

```ts
describe("buildAdvancedFilterParams $orderby", () => {
  it("substitutes sortField for the column id", () => {
    const p = buildAdvancedFilterParams({
      page: 1,
      pageSize: 10,
      sort: "leader.asc",
      filters: [],
      joinOperator: "and",
      fieldByColumnId: {
        leader: {
          field: "leaderId",
          sortField: "leader.lastName",
          variant: "relation",
        },
      },
    });
    expect(p.get("$orderby")).toBe("leader.lastName asc");
  });
});
```

- [ ] **Step 7: Run all odata tests**

Run: `npx vitest run src/lib/odata/`
Expected: PASS.

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc -b`
Expected: exits 0.

```bash
git add src/lib/odata/
git commit -m "feat(odata): optional sortField translated at \$orderby emission

Sort params are parsed as <columnId>.<dir>, so a dotted field name cannot
live in the URL. Column ids stay dot-free; the builder substitutes the
navigation path only when emitting.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 9: `staticParams` on createCrudApi

**Files:**
- Modify: `src/lib/api/create-crud-api.ts`

**Interfaces:**
- Produces: optional `staticParams?: Record<string, string>` on `CreateCrudApiOptions`, merged into every list request built by `fetchDataTable` and `fetchList`.

- [ ] **Step 1: Add the option**

In `src/lib/api/create-crud-api.ts`, extend the options interface:

```ts
export interface CreateCrudApiOptions {
  basePath: string;
  /** Root queryKey, e.g. `["boxes"]`. Sub-keys are appended per operation. */
  queryKey: readonly unknown[];
  /** Filter descriptors used by dataTableQueryOptions. */
  filterDescriptors: readonly FilterDescriptor[];
  /** Query params appended to every list request, e.g. `{ fields: "leader" }`
   *  to make the backend eager-fetch a relation via its entity graph. */
  staticParams?: Record<string, string>;
}
```

and destructure it:

```ts
}: CreateCrudApiOptions) {
```
becomes
```ts
}: CreateCrudApiOptions) {
```
with the parameter list above it updated to
```ts
export function createCrudApi<
  TDto extends { id: number },
  TFilters extends object,
  TWritePayload,
>({ basePath, queryKey, filterDescriptors, staticParams }: CreateCrudApiOptions) {
```

- [ ] **Step 2: Merge into `fetchList`**

Inside `fetchList`, after the existing loop that populates `params` and before the `return`:

```ts
    for (const [k, v] of Object.entries(staticParams ?? {})) {
      params.set(k, v);
    }
    return apiFetch<ApiResponse<TDto[]>>(`${basePath}?${params}`);
```

- [ ] **Step 3: Merge into `fetchDataTable`**

Inside `fetchDataTable`, after `buildFilterParams` returns and before `apiFetch`:

```ts
    for (const [k, v] of Object.entries(staticParams ?? {})) {
      searchParams.set(k, v);
    }
    return apiFetch<ApiResponse<TDto[]>>(
      `${basePath}?${searchParams.toString()}`,
    );
```

- [ ] **Step 4: Type-check and run the suite**

Run: `npx tsc -b && npx vitest run`
Expected: both exit 0; no behavior change for existing callers, which pass no `staticParams`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/create-crud-api.ts
git commit -m "feat(api): optional staticParams appended to list requests

Needed for Team's ?fields=leader entity-graph hint.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 10: Team backend — entity, DTO, and mappers

**Repo: `F:\programming\cometa`** (not the frontend repo).

**Files:**
- Modify: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/auth/Team.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamDto.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/PersonRefMapper.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/TeamMapper.java`

**Interfaces:**
- Produces: `TeamDto.leaderId` (`Long`, writable, filterable) and `TeamDto.leader` (`PersonDto`, read-only, populated when the request carries `?fields=leader`).

**No DDL or migration** — the new field maps the existing `leader_person_id` column a second time, read-only.

- [ ] **Step 1: Add the scalar to `Team.java`**

Add this field directly below the existing `leader` relation. Keep the relation exactly as it is.

```java
    /**
     * FK-скаляр лидера, только для чтения. Существует, чтобы OData-фильтрация
     * и сортировка разрешались без join: getPathExpression разбивает путь с
     * точкой и вызывает root.fetch(...), а createCountQuery применяет тот же
     * предикат — fetch join внутри SELECT COUNT Hibernate отвергает.
     */
    @Column(name = "leader_person_id", insertable = false, updatable = false)
    private Long leaderId;
```

- [ ] **Step 2: Add both fields to `TeamDto.java`**

```java
    private Long leaderId;      // записывается клиентом, используется для фильтрации
    private PersonDto leader;   // только для чтения, заполняется при ?fields=leader
```

No `@ODataMapping` alias is needed — `leaderId` is a real entity field name, so `ODataChecker.checkFields` passes on the identity mapping.

- [ ] **Step 3: Create `PersonRefMapper.java`**

```java
package ru.sberbank.cib.gmbus.service.mapper;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.sberbank.cib.gmbus.entity.auth.Person;

/**
 * Разрешает leaderId в ссылку на Person для записи.
 * getReference возвращает ленивый прокси без обращения к БД — Hibernate
 * берёт из него только идентификатор для записи FK.
 */
@Component
@RequiredArgsConstructor
public class PersonRefMapper {

    private final EntityManager em;

    public Person toPersonRef(Long id) {
        return id == null ? null : em.getReference(Person.class, id);
    }
}
```

- [ ] **Step 4: Rewrite `TeamMapper.java`**

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.hibernate.Hibernate;
import org.mapstruct.Condition;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.TeamDto;

@Mapper(config = CometaCommonMapperConfig.class,
        uses = {PersonRefMapper.class, PersonMapper.class})
public interface TeamMapper extends BaseCrudMapper<Team, TeamDto> {

    /**
     * Не инициализировать ленивый прокси лидера при маппинге в DTO —
     * без ?fields=leader вложенный leader останется null вместо N+1.
     */
    @Condition
    default boolean isEntityLoaded(Person person) {
        return Hibernate.isInitialized(person);
    }

    @Override
    TeamDto toDto(Team team);

    @Override
    @Mapping(target = "leader", source = "leaderId")
    @Mapping(target = "leaderId", ignore = true)
    Team fromDto(TeamDto dto);

    @Override
    @Mapping(target = "leader", source = "leaderId")
    @Mapping(target = "leaderId", ignore = true)
    void update(TeamDto source, @MappingTarget Team target);
}
```

The `@Mapping(target = "leaderId", ignore = true)` on the write side is load-bearing. Without it MapStruct name-matches `dto.leaderId → entity.leaderId`, which Hibernate discards as `insertable = false`, and the leader silently never saves.

- [ ] **Step 5: Build the backend**

Run from `F:\programming\cometa`: `mvnw.cmd clean install -DskipTests`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Verify the generated mapper is not corrupt**

Open `cometa-service-module/target/generated-sources/annotations/ru/sberbank/cib/gmbus/service/mapper/TeamMapperImpl.java`.
Expected: the class declaration reads `public class TeamMapperImpl implements TeamMapper`. Confirm `fromDto` calls `personRefMapper.toPersonRef(dto.getLeaderId())` and assigns it via `team.setLeader(...)`.
If `implements TeamMapper` is missing, the known fork/APT corruption has recurred — confirm `<fork>true</fork>` is still present in the parent `pom.xml` and rebuild.

- [ ] **Step 7: Commit (backend repo)**

```bash
cd F:/programming/cometa
git add cometa-persistence-module cometa-service-module
git commit -m "feat(team): expose leader as nested DTO + writable leaderId

Team.leader was required but absent from TeamDto, so POST /api/v1/team
could never satisfy the NOT NULL constraint.

- Team gains a read-only leaderId scalar so OData filter/sort resolve
  without a join (a dotted path puts root.fetch inside SELECT COUNT).
- Writes resolve leaderId to a Person reference in the mapper layer via
  EntityManager.getReference.
- @Condition guards the nested leader so it stays null without
  ?fields=leader rather than triggering N+1 proxy loads.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 11: Verify the Team backend against a running server

The module has no integration-test harness (6 test files total) and building one is out of scope, so these four checks are manual. Run them in order — each builds on the last.

**Files:** none (verification only).

- [ ] **Step 1: Start the backend and authenticate**

Start the backend from your IDE or `mvnw.cmd spring-boot:run` in `cometa-web-module`. Log in as the standing test account (sigmaLogin `99000001`, password `Passw0rd!`) to obtain a bearer token, or use the browser session via the frontend dev server.

Note an existing person id (call it `P`) from `GET /api/v1/person?$top=5`.

- [ ] **Step 2: Check 1 — the write path**

```
POST /api/v1/team
{"name":"Plan Check Team","code":9901,"type":"CHANGE","leaderId":P,
 "leaderRole":"lead","structure":"test"}
```
Expected: 200/201. Then confirm in the DB that the new row's `leader_person_id` equals `P`.

This is the check that proves the MapStruct write path works. If `leader_person_id` is null or the insert fails on the NOT NULL constraint, revisit Task 10 Step 4 — the most likely cause is a missing `@Mapping(target = "leaderId", ignore = true)`.

- [ ] **Step 3: Check 2 — the nested read**

```
GET /api/v1/team?$top=5&fields=leader
```
Expected: each row has a populated `leader` object (with `id`, `email`, names) **and** a `leaderId` equal to `leader.id`.

Then `GET /api/v1/team?$top=5` (no `fields`). Expected: `leader` is null, `leaderId` is still populated — this confirms the `@Condition` guard works and that `leaderId` reads off the scalar rather than the proxy.

- [ ] **Step 4: Check 3 — filtering and the count query**

```
GET /api/v1/team?$top=20&$filter=leaderId eq P
```
Expected: 200, only teams led by `P`, and **the `count` field in the envelope matches the number of such teams**. A 500 here means the filter path is still producing a join — re-check that `Team.leaderId` was added as a plain `@Column` and not as a second relation.

- [ ] **Step 5: Check 4 — sorting by leader last name**

```
GET /api/v1/team?$top=20&$orderby=leader.lastName asc&fields=leader
```
Expected: 200, rows ordered by the leader's last name.

This is the check most likely to fail, for two reasons: `getOrderList` runs in the `ODataCriteriaService` constructor and calls `root.fetch("leader")`, while `getQuery()` separately runs `getFetchTablesSet().forEach(root::fetch)` — potentially a duplicate join; and `ODataOrderbyHelper.parseTreeWalk` does a post-order walk that `put`s one order entry per matching node, so a two-segment path may register two entries.

Also try it without `&fields=leader` to isolate which of the two causes any failure.

- [ ] **Step 6: Record the outcome**

If check 4 passed, nothing changes — Task 13 configures `sortField: "leader.lastName"` as written.

**If check 4 failed:** in Task 13, omit `sortField` from the leader descriptor and set `enableSorting: false` on the leader column. Nothing else in the design depends on it — filtering uses the flat scalar and is unaffected. Append a note to the spec's Known Limitations recording which of the two causes it was.

- [ ] **Step 7: Clean up**

Delete the "Plan Check Team" row created in Step 2.

---

## Task 12: Team types, API, descriptors, and PersonCombobox

**Files:**
- Modify: `src/types/api.ts` (`TeamDto`, add `TeamFilters`)
- Create: `src/features/person/components/PersonCombobox.tsx`
- Modify: `src/features/team/api.ts` (extend — do not replace)
- Create: `src/features/team/advanced-api.ts`
- Create: `src/features/team/filter-descriptors.ts`
- Create: `src/features/team/schema.ts`

**Interfaces:**
- Consumes: `personApi.comboboxQueryOptions` / `detailQueryOptions` (Task 1), `staticParams` (Task 9), `sortField` (Task 8).
- Produces: `TeamFilters`; `PersonCombobox` with props `{ value: number | null; onChange: (id: number | null) => void }`; `teamApi` gaining `.dataTableQueryOptions`, `.advancedDataTableQueryOptions`, `.create`, `.patch`; `teamFilterDescriptors`; `deriveColumnFiltersFromSearch`; `teamFormSchema`, `TeamFormValues`, `TeamWritePayload`; `teamFieldByColumnId`.

- [ ] **Step 1: Update `TeamDto` and add `TeamFilters`**

In `src/types/api.ts`, change `TeamDto` to:

```ts
export interface TeamDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string | null;
  code: number | null;
  type: string | null;
  leaderId: number | null;
  leader: PersonDto | null;
  leaderRole: string | null;
  structure: string | null;
}

export interface TeamFilters extends Partial<PaginationParams> {
  name?: string;
  codeMin?: number;
  codeMax?: number;
  type?: string;
  leaderId?: number;
  leaderRole?: string;
  structure?: string;
}
```

`leader` is `PersonDto | null` because it is null unless the request carries `?fields=leader`.

- [ ] **Step 2: Create `src/features/person/components/PersonCombobox.tsx`**

Structurally identical to `src/features/team/components/team-combobox.tsx` — same `PopoverTrigger render={...}` form, same `DebouncedInput` props, same `<ul>/<li>` list.

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personApi } from "@/features/person/api";
import type { PersonDto } from "@/types/api";

interface PersonComboboxProps {
  value: number | null;
  onChange: (personId: number | null) => void;
}

export function personLabel(person: PersonDto): string {
  const full = [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(" ");
  return full || person.email || `Person #${person.id}`;
}

export function PersonCombobox({ value, onChange }: PersonComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/person?$top=20&$filter=contains_ignoring_case(...).
  const listQuery = useQuery(personApi.comboboxQueryOptions(search));
  const persons = listQuery.data?.data ?? [];

  // Selected person may fall outside the top-20 result set — fetch by id.
  const detailQuery = useQuery({
    ...personApi.detailQueryOptions(value as number),
    enabled: value !== null,
  });
  const selected = detailQuery.data?.data;

  const displayText =
    value === null
      ? "Not selected"
      : selected
        ? personLabel(selected)
        : detailQuery.isLoading
          ? "Loading…"
          : "Not selected";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
          />
        }
      >
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <DebouncedInput
              placeholder="Search persons…"
              value={search}
              onChange={setSearch}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          <li
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
              value === null ? "bg-accent/50" : ""
            }`}
          >
            <span className="italic text-muted-foreground">Not selected</span>
          </li>
          {persons.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {persons.map((person) => {
            const isSelected = person.id === value;
            return (
              <li
                key={person.id}
                onClick={() => {
                  onChange(person.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{personLabel(person)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {person.email}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

`DebouncedInput`'s `onChange` hands back a string here, so `onChange={setSearch}` type-checks directly — matching `TeamCombobox`.

- [ ] **Step 3: Create `src/features/team/filter-descriptors.ts`**

```ts
import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface TeamFilterDescriptor extends FilterDescriptor {
  filterKey?: string;
  filterKeys?: [string, string];
}

export const teamFilterDescriptors: readonly TeamFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  { id: "code", variant: "range", filterKeys: ["codeMin", "codeMax"] },
  { id: "type", variant: "select", filterKey: "type" },
  {
    id: "leader",
    variant: "relation",
    field: "leaderId",
    sortField: "leader.lastName",
    filterKey: "leaderId",
  },
  { id: "leaderRole", variant: "text", filterKey: "leaderRole" },
  { id: "structure", variant: "text", filterKey: "structure" },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of teamFilterDescriptors) {
    if (d.filterKeys) {
      const [k1, k2] = d.filterKeys;
      const v1 = search[k1];
      const v2 = search[k2];
      if (v1 !== undefined || v2 !== undefined) {
        filters.push({ id: d.id, value: [v1, v2] });
      }
      continue;
    }
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

**If Task 11 check 4 failed:** omit the `sortField` line from the `leader` entry.

- [ ] **Step 4: Create `src/features/team/schema.ts`**

`leaderId` is required; the rest are nullable, matching the entity.

```ts
import { z } from "zod";

export const teamFormSchema = z.object({
  name: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  code: z
    .number({ invalid_type_error: "Code must be a number" })
    .nullable(),
  type: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  leaderId: z
    .number({ required_error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderRole: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  structure: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

export interface TeamWritePayload {
  name: string | null;
  code: number | null;
  type: string | null;
  leaderId: number;
  leaderRole: string | null;
  structure: string | null;
}
```

- [ ] **Step 5: Create `src/features/team/advanced-api.ts`**

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, TeamDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";

export const teamFieldByColumnId: Record<string, FieldEntry> = {
  name:       { field: "name",       variant: "text" },
  code:       { field: "code",       variant: "range" },
  type:       { field: "type",       variant: "select" },
  leader:     { field: "leaderId",   sortField: "leader.lastName", variant: "relation" },
  leaderRole: { field: "leaderRole", variant: "text" },
  structure:  { field: "structure",  variant: "text" },
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
      "teams",
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
        fieldByColumnId: teamFieldByColumnId,
      });
      searchParams.set("fields", "leader");
      return apiFetch<ApiResponse<TeamDto[]>>(
        `/api/v1/team?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

**If Task 11 check 4 failed:** drop `sortField` from the `leader` entry here too.

- [ ] **Step 6: Extend `src/features/team/api.ts`**

Keep the existing `comboboxQueryOptions` and `detailQueryOptions` exactly as they are — the registration flow depends on them. Add the CRUD base and re-export everything:

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, TeamDto, TeamFilters } from "@/types/api";
import type { TeamWritePayload } from "./schema";
import { teamFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<TeamDto, TeamFilters, TeamWritePayload>({
  basePath: "/api/v1/team",
  queryKey: ["teams"],
  filterDescriptors: teamFilterDescriptors,
  staticParams: { fields: "leader" },
});

// ...existing comboboxQueryOptions and detailQueryOptions, unchanged...

export const teamApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  comboboxQueryOptions,
  detailQueryOptions,
};
```

Note the spread order: the local `detailQueryOptions` must come after `...baseApi` so the existing registration-flow behavior wins over the generated one.

- [ ] **Step 7: Type-check**

Run: `npx tsc -b`
Expected: exits 0. If the register route errors on `teamApi`, confirm the export object still carries `comboboxQueryOptions` and `detailQueryOptions`.

- [ ] **Step 8: Commit**

```bash
git add src/types/api.ts src/features/team/ src/features/person/components/PersonCombobox.tsx
git commit -m "feat(team): api layer, descriptors, schema, and person combobox

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 13: Team mappers, columns, and config (TDD)

**Files:**
- Create: `src/features/team/mappers.ts`
- Test: `src/features/team/mappers.test.ts`
- Create: `src/features/team/row-action.ts`
- Create: `src/features/team/columns.tsx`
- Create: `src/features/team/switchable-config.ts`

**Interfaces:**
- Produces: `teamDtoToForm`, `teamFormToCreate`, `teamFormToPatch`, `TeamDirtyFields`; `TeamRowAction`; `getTeamColumns({setRowAction})`; `teamSwitchableConfig`, `teamSimpleFilterKeys`.

- [ ] **Step 1: Write the failing mapper test**

Create `src/features/team/mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { TeamDto } from "@/types/api";
import { teamDtoToForm, teamFormToCreate, teamFormToPatch } from "./mappers";
import type { TeamFormValues } from "./schema";

const dto: TeamDto = {
  id: 3,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  name: "Платформа",
  code: 1234,
  type: "CHANGE",
  leaderId: 7,
  leader: {
    id: 7,
    insertedAt: null,
    updatedAt: null,
    email: "ivanov@example.com",
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
  },
  leaderRole: "lead",
  structure: "core",
};

const form: TeamFormValues = {
  name: "Платформа",
  code: 1234,
  type: "CHANGE",
  leaderId: 7,
  leaderRole: "lead",
  structure: "core",
};

describe("teamDtoToForm", () => {
  it("takes leaderId from the scalar, not the nested object", () => {
    expect(teamDtoToForm(dto)).toEqual(form);
  });

  it("falls back to the nested leader id when the scalar is null", () => {
    const withoutScalar: TeamDto = { ...dto, leaderId: null };
    expect(teamDtoToForm(withoutScalar).leaderId).toBe(7);
  });

  it("yields leaderId 0 when neither is present, so the form flags it required", () => {
    const bare: TeamDto = { ...dto, leaderId: null, leader: null };
    expect(teamDtoToForm(bare).leaderId).toBe(0);
  });
});

describe("teamFormToCreate", () => {
  it("returns the full write payload", () => {
    expect(teamFormToCreate(form)).toEqual({
      name: "Платформа",
      code: 1234,
      type: "CHANGE",
      leaderId: 7,
      leaderRole: "lead",
      structure: "core",
    });
  });
});

describe("teamFormToPatch", () => {
  it("returns only dirty fields", () => {
    expect(teamFormToPatch(form, { leaderId: true })).toEqual({ leaderId: 7 });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(teamFormToPatch(form, {})).toEqual({});
  });

  it("includes explicit nulls for cleared nullable fields", () => {
    const cleared: TeamFormValues = { ...form, structure: null };
    expect(teamFormToPatch(cleared, { structure: true })).toEqual({
      structure: null,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/team/mappers.test.ts`
Expected: FAIL — cannot resolve `./mappers`.

- [ ] **Step 3: Write `src/features/team/mappers.ts`**

```ts
import type { TeamDto } from "@/types/api";
import type { TeamFormValues, TeamWritePayload } from "./schema";

export function teamDtoToForm(dto: TeamDto): TeamFormValues {
  return {
    name: dto.name,
    code: dto.code,
    type: dto.type,
    // Prefer the scalar; fall back to the nested object for responses that
    // carried ?fields=leader but predate the scalar. 0 is never a valid id,
    // so the required-positive rule in teamFormSchema rejects it.
    leaderId: dto.leaderId ?? dto.leader?.id ?? 0,
    leaderRole: dto.leaderRole,
    structure: dto.structure,
  };
}

export function teamFormToCreate(v: TeamFormValues): TeamWritePayload {
  return {
    name: v.name,
    code: v.code,
    type: v.type,
    leaderId: v.leaderId,
    leaderRole: v.leaderRole,
    structure: v.structure,
  };
}

export type TeamDirtyFields = Partial<Record<keyof TeamFormValues, unknown>>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function teamFormToPatch(
  v: TeamFormValues,
  dirty: TeamDirtyFields,
): Partial<TeamWritePayload> {
  const out: Partial<TeamWritePayload> = {};
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.code)) out.code = v.code;
  if (isDirty(dirty.type)) out.type = v.type;
  if (isDirty(dirty.leaderId)) out.leaderId = v.leaderId;
  if (isDirty(dirty.leaderRole)) out.leaderRole = v.leaderRole;
  if (isDirty(dirty.structure)) out.structure = v.structure;
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/team/mappers.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Create `src/features/team/row-action.ts`**

```ts
import type { TeamDto } from "@/types/api";

export type TeamRowAction =
  | { variant: "create" }
  | { variant: "update"; row: TeamDto };
```

- [ ] **Step 6: Create `src/features/team/columns.tsx`**

Uses the same `select` / `id` / `actions` columns as Task 3 — repeated here in full because tasks may be read out of order.

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
import { personsFilteredQueryOptions } from "@/features/person/api";
import { personLabel } from "@/features/person/components/PersonCombobox";
import type { PersonDto, TeamDto } from "@/types/api";
import type { TeamRowAction } from "./row-action";

interface GetTeamColumnsProps {
  setRowAction: React.Dispatch<React.SetStateAction<TeamRowAction | null>>;
}

const personRelationColumns: ColumnDef<PersonDto, unknown>[] = [
  { id: "lastName", accessorKey: "lastName", header: "Last Name" },
  { id: "firstName", accessorKey: "firstName", header: "First Name" },
  { id: "email", accessorKey: "email", header: "Email" },
];

export function getTeamColumns({
  setRowAction,
}: GetTeamColumnsProps): ColumnDef<TeamDto>[] {
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
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Name" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Name",
        placeholder: "Search names...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 240,
    },
    {
      id: "code",
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Code" />
      ),
      cell: ({ cell }) => cell.getValue<number | null>() ?? "—",
      meta: {
        label: "Code",
        variant: "range",
        range: [0, 10000],
        filterKeys: ["codeMin", "codeMax"],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "type",
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Type" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Type",
        variant: "select",
        options: [
          { label: "CHANGE", value: "CHANGE" },
          { label: "RUN", value: "RUN" },
        ],
        filterKey: "type",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },
    {
      id: "leader",
      accessorKey: "leader",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader" />
      ),
      cell: ({ cell }) => {
        const leader = cell.getValue<PersonDto | null>();
        return leader ? personLabel(leader) : "—";
      },
      meta: {
        label: "Leader",
        variant: "relation",
        filterKey: "leaderId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            personsFilteredQueryOptions(filters),
          columns: personRelationColumns,
          getLabel: (person: PersonDto) => personLabel(person),
          getId: (person: PersonDto) => person.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 220,
    },
    {
      id: "leaderRole",
      accessorKey: "leaderRole",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader Role" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Leader Role",
        placeholder: "Search leader roles...",
        variant: "text",
        filterKey: "leaderRole",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 160,
    },
    {
      id: "structure",
      accessorKey: "structure",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Structure" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Structure",
        placeholder: "Search structures...",
        variant: "text",
        filterKey: "structure",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
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

**If Task 11 check 4 failed:** set `enableSorting: false` on the `leader` column.

- [ ] **Step 7: Create `src/features/team/switchable-config.ts`**

```ts
import { teamApi } from "./api";
import { getTeamColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { TeamDto } from "@/types/api";
import type { TeamRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const teamSimpleFilterKeys = [
  "name",
  "codeMin",
  "codeMax",
  "type",
  "leaderId",
  "leaderRole",
  "structure",
] as const;

export const teamSwitchableConfig: SwitchableTableConfig<TeamDto, TeamRowAction> = {
  queryKey: ["teams"],
  simpleQueryOptions: (p) => teamApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => teamApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: teamSimpleFilterKeys,
  getColumns: getTeamColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
};
```

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc -b && npx vitest run src/features/team/`
Expected: both exit 0.

```bash
git add src/features/team/
git commit -m "feat(team): mappers, columns with leader relation, switchable config

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 14: TeamSheet

**Files:**
- Create: `src/features/team/components/TeamSheet.tsx`

**Interfaces:**
- Consumes: `teamApi`, `teamFormSchema`, `TeamFormValues`, `teamDtoToForm`, `teamFormToCreate`, `teamFormToPatch`, `PersonCombobox`, `ApiError`.
- Produces: `TeamSheet` — props `{ team: TeamDto | null; variant: "update" | "create"; onSuccess: () => void }` plus `Sheet` props.

- [ ] **Step 1: Create the component**

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
import { PersonCombobox } from "@/features/person/components/PersonCombobox";
import type { TeamDto, AppMessage } from "@/types/api";

import { teamApi } from "../api";
import { teamFormSchema, type TeamFormValues } from "../schema";
import { teamDtoToForm, teamFormToCreate, teamFormToPatch } from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const TEAM_FORM_FIELDS: readonly (keyof TeamFormValues)[] = [
  "name",
  "code",
  "type",
  "leaderId",
  "leaderRole",
  "structure",
];

function isTeamField(target: string): target is keyof TeamFormValues {
  return (TEAM_FORM_FIELDS as readonly string[]).includes(target);
}

interface TeamSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  team: TeamDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function TeamSheet({
  team,
  variant,
  onSuccess,
  ...props
}: TeamSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: team
      ? teamDtoToForm(team)
      : {
          name: null,
          code: null,
          type: null,
          // 0 is never a valid id, so the schema's positive() rule reports
          // "Leader is required" if the user submits without picking one.
          leaderId: 0,
          leaderRole: null,
          structure: null,
        },
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      if (m.target && isTeamField(m.target)) {
        form.setError(m.target as Path<TeamFormValues>, { message: m.message });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: TeamFormValues) => {
      if (variant === "update" && team) {
        const patch = teamFormToPatch(data, form.formState.dirtyFields);
        return teamApi.patch(team.id, patch);
      }
      return teamApi.create(teamFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && team) {
        queryClient.setQueryData(["teams", "detail", team.id], res);
        toast.success("Team updated");
      } else {
        toast.success("Team created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save team");
        }
      } else {
        toast.error("Failed to save team");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Team" : "Add Team"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the team details and save changes."
              : "Fill in the details to create a new team."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Controller
              control={form.control}
              name="name"
              render={({ field }) => (
                <Input
                  id="name"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          {/* Code */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code</Label>
            <Controller
              control={form.control}
              name="code"
              render={({ field }) => (
                <Input
                  id="code"
                  type="number"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
            {form.formState.errors.code && (
              <p className="text-sm text-destructive">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          {/* Type */}
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHANGE">CHANGE</SelectItem>
                    <SelectItem value="RUN">RUN</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Leader (required) */}
          <div className="flex flex-col gap-2">
            <Label>Leader</Label>
            <Controller
              control={form.control}
              name="leaderId"
              render={({ field }) => (
                <PersonCombobox
                  value={field.value > 0 ? field.value : null}
                  onChange={(id) => field.onChange(id ?? 0)}
                />
              )}
            />
            {form.formState.errors.leaderId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.leaderId.message}
              </p>
            )}
          </div>

          {/* Leader Role */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="leaderRole">Leader Role</Label>
            <Controller
              control={form.control}
              name="leaderRole"
              render={({ field }) => (
                <Input
                  id="leaderRole"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          {/* Structure */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="structure">Structure</Label>
            <Controller
              control={form.control}
              name="structure"
              render={({ field }) => (
                <Input
                  id="structure"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <SheetFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => closeSheet()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
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

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/team/components/TeamSheet.tsx
git commit -m "feat(team): create/edit sheet with required leader picker

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 15: /team route, sidebar entry, and end-to-end verification

**Files:**
- Create: `src/routes/team/-simple-search.ts`
- Create: `src/routes/team/index.tsx`
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Create `src/routes/team/-simple-search.ts`**

`code` is a numeric range (two keys), `type` is a select (array-valued), `leaderId` is a single number.

```ts
function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
function asStrArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v.length > 0) return v.split(",");
  return undefined;
}

export function validateTeamSimpleFields(search: Record<string, unknown>) {
  return {
    name: asStr(search.name),
    codeMin: asNum(search.codeMin),
    codeMax: asNum(search.codeMax),
    type: asStrArray(search.type),
    leaderId: asNum(search.leaderId),
    leaderRole: asStr(search.leaderRole),
    structure: asStr(search.structure),
  };
}
```

- [ ] **Step 2: Create `src/routes/team/index.tsx`**

```tsx
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { AdvancedFilterToggle } from "@/components/data-table/advanced-filter-toggle";
import { Button } from "@/components/ui/button";

import { makeSwitchableSearch } from "@/lib/data-table/switchable-search";
import type { SwitchableSearchBase } from "@/lib/data-table/switchable-search";
import { makeSwitchableLoader } from "@/lib/data-table/switchable-page";
import { useSwitchableTablePage } from "@/hooks/use-switchable-table-page";
import { teamSwitchableConfig } from "@/features/team/switchable-config";
import { validateTeamSimpleFields } from "./-simple-search";
import { TeamSheet } from "@/features/team/components/TeamSheet";

export const Route = createFileRoute("/team/")({
  validateSearch: makeSwitchableSearch(validateTeamSimpleFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(teamSwitchableConfig),
  component: TeamPage,
});

function TeamPage() {
  // Making `loaderDeps`/`loader` type-check forces TanStack to widen this
  // route's inferred search schema to `{}`; the runtime value is the validated
  // search, so assert it back to the shared switchable-search shape. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/team/" });
  const queryClient = useQueryClient();

  const {
    table,
    advanced,
    count,
    rowAction,
    setRowAction,
    toggleMode,
    handleFilterChange,
  } = useSwitchableTablePage({
    config: teamSwitchableConfig,
    search,
    navigate,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: teamSwitchableConfig.queryKey });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetTeam = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Team
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="mt-2 text-muted-foreground">{count} teams</p>
        </div>
      </div>

      <DataTable table={table}>
        {advanced ? (
          <DataTableAdvancedToolbar
            table={table}
            filters={search.filters}
            joinOperator={search.joinOperator}
            onChange={handleFilterChange}
          >
            {actions}
          </DataTableAdvancedToolbar>
        ) : (
          <DataTableToolbar table={table}>{actions}</DataTableToolbar>
        )}
      </DataTable>

      {sheetOpen && (
        <TeamSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          team={sheetTeam}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar entry**

In `src/components/app-sidebar.tsx`, add `{ to: "/team", label: "Teams" }` directly after the `/person` entry.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: exits 0. If `/team/` is not a known route, run `npm run build` once to regenerate `routeTree.gen.ts`, then re-run.

- [ ] **Step 5: Full suite and lint**

Run: `npx vitest run && npm run lint && npx tsc -b`
Expected: all three exit 0.

- [ ] **Step 6: Verify end to end against the real backend**

With the backend running, start `npm run dev -- --host` and go to `http://localhost:5173/team`. Confirm each of these:

1. The table renders and the **Leader column shows names, not ids** (proves `?fields=leader` is reaching the server).
2. Simple mode: the Leader filter opens a person picker and narrows the table; the pagination count updates correctly.
3. Simple mode: the Code range filter and the Type select filter both work.
4. Advanced mode: add a Leader filter — it produces the same result set.
5. Sort by Leader (skip if Task 11 check 4 failed).
6. "Add Team" without picking a leader shows "Leader is required" and does not submit.
7. "Add Team" with a leader creates the row and it appears with the correct leader name.
8. Editing a team's leader saves and the column updates.
9. `/register` still works — the team combobox loads and registration succeeds.

Step 9 is the regression check that matters most: Task 12 rewrote the module the registration flow imports.

- [ ] **Step 7: Commit**

```bash
git add src/routes/team/ src/components/app-sidebar.tsx src/routeTree.gen.ts
git commit -m "feat(team): switchable /team table page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```

---

## Task 16: Reconcile the spec with what was built

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-team-person-table-pages-design.md`

- [ ] **Step 1: Record the Task 11 outcomes**

Under Known Limitations, replace the "Leader sort depends on Phase 3 check 4" bullet with the actual result: either that the leader column sorts by `leader.lastName`, or that check 4 failed, which of the two causes it was, and that the column ships non-sortable.

- [ ] **Step 2: Record any deviations**

If the implementation diverged from the spec anywhere else — a different field, a renamed export, an extra file — amend the relevant section so the spec describes what exists.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-05-team-person-table-pages-design.md
git commit -m "docs: reconcile team/person spec with implementation

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016jjjZmEiYJezemRwVgpLKN"
```
