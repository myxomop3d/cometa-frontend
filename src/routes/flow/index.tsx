import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, SlidersHorizontal } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { calculatePageSize } from "@/lib/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { flowApi } from "@/features/flow/api";
import { getFlowColumns } from "@/features/flow/columns";
import { FlowSheet } from "@/features/flow/components/FlowSheet";
import { deriveColumnFiltersFromSearch } from "@/features/flow/filter-descriptors";
import type { FlowRowAction } from "@/features/flow/row-action";
import type { ExtendedColumnFilter } from "@/types/data-table";

import {
  validateSearch,
  buildModeToggleUpdates,
  type FlowSwitchableSearch,
} from "./-search";

// Resolve once at module load so loader and component agree on the same
// default page size (calculatePageSize reads window dimensions).
const DEFAULT_PAGE_SIZE = calculatePageSize();

export const Route = createFileRoute("/flow/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    if (deps.advanced) {
      return context.queryClient.ensureQueryData(
        flowApi.advancedDataTableQueryOptions({
          page: deps.page ?? 1,
          pageSize: deps.pageSize ?? DEFAULT_PAGE_SIZE,
          sort: deps.sort,
          filters: deps.filters,
          joinOperator: deps.joinOperator,
        }),
      );
    }
    const { page, pageSize, sort, ...filterParams } = deps;
    return context.queryClient.ensureQueryData(
      flowApi.dataTableQueryOptions({
        page: page ?? 1,
        pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
        sort,
        columnFilters: deriveColumnFiltersFromSearch(filterParams),
      }),
    );
  },
  component: FlowSwitchablePage,
});

function FlowSwitchablePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/flow/" });
  const queryClient = useQueryClient();
  const advanced = search.advanced;

  const [rowAction, setRowAction] = useState<FlowRowAction | null>(null);
  const columns = useMemo(() => getFlowColumns({ setRowAction }), [setRowAction]);

  const queryOpts = useMemo(() => {
    if (advanced) {
      return flowApi.advancedDataTableQueryOptions({
        page: search.page ?? 1,
        pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: search.sort,
        filters: search.filters,
        joinOperator: search.joinOperator,
      });
    }
    const { page, pageSize, sort, ...filterParams } = search;
    return flowApi.dataTableQueryOptions({
      page: page ?? 1,
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      sort,
      columnFilters: deriveColumnFiltersFromSearch(filterParams),
    });
  }, [search, advanced]);

  const { data } = useSuspenseQuery(queryOpts);

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      navigate({
        search: (prev: FlowSwitchableSearch) => {
          const next: Record<string, unknown> = { ...prev, ...updates };
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) cleaned[key] = value;
          }
          return cleaned as unknown as FlowSwitchableSearch;
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

  // Advanced-mode filter-list changes → write filters/joinOperator to the URL.
  const handleFilterChange = useCallback(
    ({
      filters,
      joinOperator,
    }: {
      filters: ExtendedColumnFilter[];
      joinOperator: "and" | "or";
    }) => {
      navigate({
        search: (prev: FlowSwitchableSearch) => {
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
          return next as unknown as FlowSwitchableSearch;
        },
      });
    },
    [navigate],
  );

  const toggleMode = useCallback(
    () => onNavigate(buildModeToggleUpdates(!advanced)),
    [onNavigate, advanced],
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

  const actions = (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={advanced}
        className={cn(advanced && "border-primary text-primary")}
        onClick={toggleMode}
      >
        <SlidersHorizontal className="mr-1 size-4" />
        Advanced filters
      </Button>
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Flow
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flows</h1>
          <p className="mt-2 text-muted-foreground">{data.count} flows</p>
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
