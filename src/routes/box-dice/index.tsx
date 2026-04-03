import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { boxDiceQueryOptions } from "@/api/box";
import { getBoxColumns } from "./components/-box-table-columns";
import { BoxSheet } from "./components/-box-sheet";
import { Button } from "@/components/ui/button";
import type { BoxDto } from "@/types/api";
import type { DataTableRowAction } from "@/types/data-table";

function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(",").map(Number).filter((n) => !isNaN(n));
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(Number).filter((n) => !isNaN(n));
  }
  return undefined;
}

interface BoxDiceSearchParams {
  page: number;
  pageSize: number;
  sort: string | undefined;
  name: string | undefined;
  objectCode: string | undefined;
  shape: string[] | undefined;
  numMin: number | undefined;
  numMax: number | undefined;
  checkbox: boolean | undefined;
  dateStrFrom: string | undefined;
  dateStrTo: string | undefined;
  tags: string | undefined;
  itemId: number | undefined;
  thingIds: number[] | undefined;
  oldItemId: number | undefined;
  oldThingIds: number[] | undefined;
}

function validateSearch(search: Record<string, unknown>): BoxDiceSearchParams {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : 20,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode: typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape: Array.isArray(search.shape)
      ? (search.shape as string[])
      : typeof search.shape === "string"
        ? search.shape.split(",")
        : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox: typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom: typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo: typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId: typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
  };
}

/**
 * Derive column filters from search params for the loader and query.
 */
function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
  columns: { id?: string; accessorKey?: string; meta?: any }[],
) {
  const filters: { id: string; value: unknown }[] = [];
  for (const col of columns) {
    const meta = col.meta;
    if (!meta?.variant) continue;
    const colId = col.id ?? col.accessorKey;
    if (!colId) continue;

    if (meta.filterKeys) {
      const [key1, key2] = meta.filterKeys;
      const v1 = search[key1];
      const v2 = search[key2];
      if (v1 !== undefined || v2 !== undefined) {
        filters.push({ id: colId, value: [v1, v2] });
      }
    } else if (meta.filterKey) {
      const value = search[meta.filterKey];
      if (value !== undefined && value !== null) {
        if (meta.variant === "multiSelect" || meta.variant === "multiRelation") {
          filters.push({ id: colId, value: Array.isArray(value) ? value : [value] });
        } else if (meta.variant === "boolean") {
          filters.push({ id: colId, value: typeof value === "boolean" ? [String(value)] : [value] });
        } else {
          filters.push({ id: colId, value });
        }
      }
    }
  }
  return filters;
}

export const Route = createFileRoute("/box-dice/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const { page, pageSize, sort, ...filterParams } = deps;
    const columns = getBoxColumns({ setRowAction: () => {} });
    return context.queryClient.ensureQueryData(
      boxDiceQueryOptions({
        page: page ?? 1,
        pageSize: pageSize ?? 20,
        sort,
        columnFilters: deriveColumnFiltersFromSearch(filterParams, columns as any),
        columns: columns.map((c) => ({
          id: (c as { id?: string }).id ?? (c as { accessorKey?: string }).accessorKey ?? "",
          meta: c.meta as any,
        })),
      }),
    );
  },
  component: BoxDicePage,
});

function BoxDicePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/box-dice/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] =
    useState<DataTableRowAction<BoxDto> | null>(null);

  const columns = useMemo(() => getBoxColumns({ setRowAction }), []);

  // Build query options using current search params
  const queryOptions = useMemo(() => {
    const { page, pageSize, sort, ...filterParams } = search;
    return boxDiceQueryOptions({
      page: page ?? 1,
      pageSize: pageSize ?? 20,
      sort,
      columnFilters: deriveColumnFiltersFromSearch(filterParams, columns as any),
      columns: columns.map((c) => ({
        id: (c as any).id ?? (c as any).accessorKey ?? "",
        meta: c.meta as any,
      })),
    });
  }, [search, columns]);

  const { data } = useSuspenseQuery(queryOptions);

  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = useCallback(
    (updates: Partial<BoxDiceSearchParams>) => {
      navigate({
        search: (prev: BoxDiceSearchParams) => {
          const next = { ...prev, ...updates };
          // Clean undefined values
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned as BoxDiceSearchParams;
        },
      });
    },
    [navigate],
  );

  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount,
    search: search as Record<string, unknown>,
    onNavigate: onNavigate as (updates: Partial<Record<string, unknown>>) => void,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["boxes"] });
    setRowAction(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boxes (Dice)</h1>
          <p className="mt-2 text-muted-foreground">{data.count} boxes</p>
        </div>
      </div>

      <DataTable table={table}>
        <DataTableToolbar table={table}>
          <Button
            size="sm"
            onClick={() =>
              setRowAction({ row: null as any, variant: "create" })
            }
          >
            <Plus className="mr-1 size-4" />
            Add Box
          </Button>
        </DataTableToolbar>
      </DataTable>

      {/* Edit/Add Sheet */}
      <BoxSheet
        open={rowAction !== null}
        onOpenChange={(open) => {
          if (!open) setRowAction(null);
        }}
        box={
          rowAction?.variant === "update" ? rowAction.row.original : null
        }
        variant={rowAction?.variant === "create" ? "create" : "update"}
        onSuccess={handleSheetSuccess}
      />
    </div>
  );
}
