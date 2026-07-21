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

import { boxApi } from "@/features/box/api";
import { getBoxColumns } from "@/features/box/columns";
import { BoxSheet } from "@/features/box/components/BoxSheet";
import { deriveColumnFiltersFromSearch } from "@/features/box/filter-descriptors";
import type { BoxRowAction } from "@/features/box/row-action";
import type { ExtendedColumnFilter } from "@/types/data-table";

import {
  validateSearch,
  buildModeToggleUpdates,
  type BoxDiceSwitchableSearch,
} from "./-search";

// Resolve once at module load so loader and component agree on the same
// default page size (calculatePageSize reads window dimensions).
const DEFAULT_PAGE_SIZE = calculatePageSize();

export const Route = createFileRoute("/box-dice/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    if (deps.advanced) {
      return context.queryClient.ensureQueryData(
        boxApi.advancedDataTableQueryOptions({
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
      boxApi.dataTableQueryOptions({
        page: page ?? 1,
        pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
        sort,
        columnFilters: deriveColumnFiltersFromSearch(filterParams),
      }),
    );
  },
  component: BoxDiceSwitchablePage,
});

function BoxDiceSwitchablePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/box-dice/" });
  const queryClient = useQueryClient();
  const advanced = search.advanced;

  const [rowAction, setRowAction] = useState<BoxRowAction | null>(null);
  const columns = useMemo(() => getBoxColumns({ setRowAction }), [setRowAction]);

  const queryOpts = useMemo(() => {
    if (advanced) {
      return boxApi.advancedDataTableQueryOptions({
        page: search.page ?? 1,
        pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: search.sort,
        filters: search.filters,
        joinOperator: search.joinOperator,
      });
    }
    const { page, pageSize, sort, ...filterParams } = search;
    return boxApi.dataTableQueryOptions({
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
        search: (prev: BoxDiceSwitchableSearch) => {
          const next: Record<string, unknown> = { ...prev, ...updates };
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) cleaned[key] = value;
          }
          return cleaned as unknown as BoxDiceSwitchableSearch;
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
    initialColumnVisibility: { "item.name": false },
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
        search: (prev: BoxDiceSwitchableSearch) => {
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
          return next as unknown as BoxDiceSwitchableSearch;
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
    queryClient.invalidateQueries({ queryKey: ["boxes"] });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetBox = rowAction?.variant === "update" ? rowAction.row : null;
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
        Add Box
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boxes (Dice) — Switchable</h1>
          <p className="mt-2 text-muted-foreground">{data.count} boxes</p>
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
        <BoxSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          box={sheetBox}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
