import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { calculatePageSize } from "@/lib/data-table";
import { Button } from "@/components/ui/button";

// Resolve once at module load so the loader and component agree on the same
// default page size — `calculatePageSize()` reads window dimensions and could
// otherwise drift between calls, causing query-key mismatches on first render.
const DEFAULT_PAGE_SIZE = calculatePageSize();

import { boxApi } from "@/features/box/api";
import { getBoxColumns } from "@/features/box/columns";
import { BoxSheet } from "@/features/box/components/BoxSheet";
import { deriveColumnFiltersFromSearch } from "@/features/box/filter-descriptors";
import type { BoxRowAction } from "@/features/box/row-action";

function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(Number).filter((n) => !isNaN(n));
  }
  return undefined;
}

interface BoxDiceSearchParams {
  page: number;
  pageSize: number | undefined;
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
    pageSize: typeof search.pageSize === "number" ? search.pageSize : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode:
      typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape: Array.isArray(search.shape)
      ? (search.shape as string[])
      : typeof search.shape === "string"
        ? search.shape.split(",")
        : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox:
      typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom:
      typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo:
      typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId:
      typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
  };
}

export const Route = createFileRoute("/box-dice/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
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
  component: BoxDicePage,
});

function BoxDicePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/box-dice/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] = useState<BoxRowAction | null>(null);

  const columns = useMemo(() => getBoxColumns({ setRowAction }), [setRowAction]);

  const queryOpts = useMemo(() => {
    const { page, pageSize, sort, ...filterParams } = search;
    return boxApi.dataTableQueryOptions({
      page: page ?? 1,
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      sort,
      columnFilters: deriveColumnFiltersFromSearch(filterParams),
    });
  }, [search]);

  const { data } = useSuspenseQuery(queryOpts);

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = useCallback(
    (updates: Partial<BoxDiceSearchParams>) => {
      navigate({
        search: (prev: BoxDiceSearchParams) => {
          const next = { ...prev, ...updates };
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(next)) {
            if (value !== undefined && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned as unknown as BoxDiceSearchParams;
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
    onNavigate: onNavigate as (
      updates: Partial<Record<string, unknown>>,
    ) => void,
    initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
  });

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
            onClick={() => setRowAction({ variant: "create" })}
          >
            <Plus className="mr-1 size-4" />
            Add Box
          </Button>
        </DataTableToolbar>
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
