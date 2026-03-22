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
import { automatedSystemsQueryOptions } from "@/api/queries/automated-system";
import type { AutomatedSystemDto, AutomatedSystemFilters } from "@/types/api";
import { SimpleTable } from "@/components/SimpleTable";
import { useFilters } from "@/hooks/useFilters";
import { updateAutomatedSystem } from "@/api/mutations/automated-system";
import type { EditConfig } from "@/types/table";

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

export const Route = createFileRoute("/automated-system/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(automatedSystemsQueryOptions(deps)),
  component: AutomatedSystemPage,
});

const columnHelper = createColumnHelper<AutomatedSystemDto>();

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

const columnResizeMode: ColumnResizeMode = "onChange";

const filterFields = [
  { key: "name",    label: "Name"    },
  { key: "ci",      label: "CI"      },
  { key: "block",   label: "Block"   },
  { key: "tribe",   label: "Tribe"   },
  { key: "cluster", label: "Cluster" },
  { key: "status",  label: "Status"  },
  { key: "leader",  label: "Leader"  },
];

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

function AutomatedSystemPage() {
  const { filters, setFilters, setPage } = useFilters("/automated-system/");
  const { data } = useSuspenseQuery(automatedSystemsQueryOptions(filters));

  const page      = filters.page     ?? 1;
  const pageSize  = filters.pageSize ?? 20;
  const pageCount = Math.ceil(data.count / pageSize);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Systems</h1>
          <p className="mt-2 text-muted-foreground">{data.count} systems</p>
        </div>
      </div>

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
