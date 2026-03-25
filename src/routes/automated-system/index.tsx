import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnResizeMode,
  type VisibilityState,
} from "@tanstack/react-table";
import { z } from "zod";
import { automatedSystemsQueryOptions, patchAutomatedSystem } from "@/api/automated-system";
import type { AutomatedSystemDto, AutomatedSystemFilters } from "@/types/api";
import { SimpleTable } from "@/components/SimpleTable";
import { useFilters } from "@/hooks/useFilters";
import type { EditConfig } from "@/types/table";

/**
 * Validates and normalizes raw URL search parameters into a typed `AutomatedSystemFilters` object.
 * Each parameter is checked for its expected type; invalid or missing values fall back to defaults
 * (page=1, pageSize=20, undefined for optional string filters).
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/search-params#validating-search-params
 */
function validateSearch(search: Record<string, unknown>): AutomatedSystemFilters {
  return {
    page:     typeof search.page     === "number" ? search.page     : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : 20,
    name:     typeof search.name     === "string" ? search.name     : undefined,
    ci:       typeof search.ci       === "string" ? search.ci       : undefined,
    block:    typeof search.block    === "string" ? search.block    : undefined,
    tribe:    typeof search.tribe    === "string" ? search.tribe    : undefined,
    cluster:  typeof search.cluster  === "string" ? search.cluster  : undefined,
    status:   typeof search.status   === "string" ? search.status   : undefined,
    leader:   typeof search.leader   === "string" ? search.leader   : undefined,
  };
}

/**
 * TanStack Router route definition for the "/automated-system/" path.
 * - `validateSearch` — parses and validates URL search params on every navigation.
 * - `loaderDeps` — declares which search params the loader depends on so it re-runs when they change.
 * - `loader` — prefetches automated systems data via the query client before the component renders,
 *   enabling instant page loads with `useSuspenseQuery`.
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/suspense
 */
export const Route = createFileRoute("/automated-system/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(automatedSystemsQueryOptions(deps)),
  component: AutomatedSystemPage,
});

/**
 * Typed column helper scoped to `AutomatedSystemDto`.
 * Provides type-safe `accessor()` calls that autocomplete field names and infer cell value types.
 *
 * @see https://tanstack.com/table/latest/docs/guide/column-defs#creating-accessor-columns
 */
const columnHelper = createColumnHelper<AutomatedSystemDto>();

/**
 * Column definitions for the automated systems table.
 * Each entry maps a DTO field to a display header and an initial column width (in pixels).
 * The order here determines the default column order in the rendered table.
 *
 * @see https://tanstack.com/table/latest/docs/guide/column-defs
 */
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

/**
 * Column resize strategy. "onChange" updates column widths continuously as the user drags,
 * providing real-time visual feedback (as opposed to "onEnd" which only updates on mouse release).
 *
 * @see https://tanstack.com/table/latest/docs/guide/column-sizing#column-resize-mode
 */
const columnResizeMode: ColumnResizeMode = "onChange";

/**
 * Defines which fields are shown in the table's filter panel.
 * `key` must match an `AutomatedSystemFilters` property; `label` is the user-facing text.
 * These filters are synced to URL search params via the `useFilters` hook.
 */
const filterFields = [
  { key: "name",    label: "Name"    },
  { key: "ci",      label: "CI"      },
  { key: "block",   label: "Block"   },
  { key: "tribe",   label: "Tribe"   },
  { key: "cluster", label: "Cluster" },
  { key: "status",  label: "Status"  },
  { key: "leader",  label: "Leader"  },
];

/**
 * Zod validation schema for inline-editing an automated system row.
 * Required fields use `.min()` to enforce non-empty values; optional fields use `.nullable()`.
 * This schema is passed to `editConfig` and validated before the save mutation fires.
 *
 * @see https://zod.dev/?id=strings
 * @see docs/superpowers/specs/2026-03-22-inline-table-editing-design.md
 */
const automatedSystemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z.string().nullable(),
  fullName: z.string().min(1, "Full name is required"),
  ci: z.string("required").min(5, "CI is required"),
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

/**
 * Main page component for the Automated Systems list view.
 * Renders a filterable, paginated, inline-editable data table with server-side operations.
 *
 * @see docs/superpowers/specs/2026-03-22-inline-table-editing-design.md
 * @see docs/superpowers/specs/2026-03-22-sticky-pinned-columns-design.md
 */
function AutomatedSystemPage() {
  // URL-synced filter state: reads current filters from search params, provides setters
  // that navigate (updating the URL) so filters are shareable and bookmarkable.
  const { filters, setFilters, setPage } = useFilters("/automated-system/");

  // Suspense-enabled query — data is guaranteed to be available on first render
  // because the route loader already prefetched it via `ensureQueryData`.
  // @see https://tanstack.com/query/latest/docs/framework/react/guides/suspense
  const { data } = useSuspenseQuery(automatedSystemsQueryOptions(filters));

  // Derive pagination values from current filters and the total row count returned by the API.
  const page      = filters.page     ?? 1;
  const pageSize  = filters.pageSize ?? 20;
  const pageCount = Math.ceil(data.count / pageSize);

  // Column visibility state — GUID column is hidden by default since it's rarely needed.
  // Users can toggle it via the column visibility dropdown.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({guid: false});

  /**
   * TanStack Table instance configured for server-side operations.
   * All filtering, pagination, and sorting are handled by the backend API,
   * so `manual*` flags are set to `true` to prevent client-side processing.
   *
   * @see https://tanstack.com/table/latest/docs/guide/tables
   */
  const table = useReactTable({
    data: data.data,
    columns,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering:  true,
    manualPagination: true,
    manualSorting:    true,
    rowCount: data.count,
    state: {
      columnVisibility,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  // Query client instance for cache invalidation after mutations.
  const queryClient = useQueryClient();

  /**
   * Mutation for saving inline edits. Sends a PATCH request with only the changed fields
   * (partial update), then invalidates the automated-systems query cache to refetch fresh data.
   *
   * @see docs/superpowers/specs/2026-03-22-patch-partial-update-design.md
   * @see https://tanstack.com/query/latest/docs/framework/react/guides/mutations
   */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AutomatedSystemDto> }) =>
      patchAutomatedSystem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automated-systems"] });
    },
  });

  /**
   * Inline edit configuration for the SimpleTable component.
   * - `fields` — maps each editable column to an input type ("text" or "select").
   * - `disabledFields` — prevents editing of read-only fields like "id".
   * - `schema` — Zod schema for form validation before save.
   * - `onSave` — callback that fires the PATCH mutation with changed fields.
   * - `rowId` — extracts the unique identifier used to target the correct row for updates.
   *
   * @see docs/superpowers/specs/2026-03-22-inline-table-editing-design.md
   */
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

  return (
    <div>
      {/* Page header with title and total system count */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Systems</h1>
          <p className="mt-2 text-muted-foreground">{data.count} systems</p>
        </div>
      </div>

      {/* Data table with server-side filtering, pagination, inline editing, and sticky pinned "name" column.
          @see docs/superpowers/specs/2026-03-22-sticky-pinned-columns-design.md */}
      <SimpleTable
        table={table}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        filterFields={filterFields}
        filters={filters}
        onFilterChange={setFilters}
        editConfig={editConfig}
        pinnedLeftColumnId="name"
      />
    </div>
  );
}
