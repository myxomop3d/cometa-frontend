import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnResizeMode,
  type VisibilityState,
} from "@tanstack/react-table";
import { automatedSystemsQueryOptions } from "@/api/queries/automated-system";
import type { AutomatedSystemDto, AutomatedSystemFilters } from "@/types/api";
import { SimpleTable } from "@/components/SimpleTable";
import { useFilters } from "@/hooks/useFilters";

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
  columnHelper.accessor("name",    { header: "Name",    size: 200 }),
  columnHelper.accessor("ci",      { header: "CI",      size: 120 }),
  columnHelper.accessor("block",   { header: "Block",   size: 150 }),
  columnHelper.accessor("tribe",   { header: "Tribe",   size: 150 }),
  columnHelper.accessor("cluster", { header: "Cluster", size: 150 }),
  columnHelper.accessor("status",  { header: "Status",  size: 100 }),
  columnHelper.accessor("leader",  { header: "Leader",  size: 180 }),
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
      />
    </div>
  );
}
