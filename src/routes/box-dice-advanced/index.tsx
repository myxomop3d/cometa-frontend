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

import { boxApi } from "@/features/box/api";
import { getBoxColumns } from "@/features/box/columns";
import { BoxSheet } from "@/features/box/components/BoxSheet";
import type { BoxRowAction } from "@/features/box/row-action";
import type { ExtendedColumnFilter } from "@/types/data-table";

const DEFAULT_PAGE_SIZE = calculatePageSize();

const filterSchema = z.array(
  z.object({
    id: z.string(),
    operator: z.string(),
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
  return result.success ? (result.data as ExtendedColumnFilter[]) : [];
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

export const Route = createFileRoute("/box-dice-advanced/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    return context.queryClient.ensureQueryData(
      boxApi.advancedDataTableQueryOptions({
        page: deps.page ?? 1,
        pageSize: deps.pageSize ?? DEFAULT_PAGE_SIZE,
        sort: deps.sort,
        filters: deps.filters,
        joinOperator: deps.joinOperator,
      }),
    );
  },
  component: BoxDiceAdvancedPage,
});

function BoxDiceAdvancedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/box-dice-advanced/" });
  const queryClient = useQueryClient();

  const [rowAction, setRowAction] = useState<BoxRowAction | null>(null);

  const columns = useMemo(() => getBoxColumns({ setRowAction }), [setRowAction]);

  const queryOpts = useMemo(
    () =>
      boxApi.advancedDataTableQueryOptions({
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
          <h1 className="text-3xl font-bold">Boxes (Dice) — Advanced</h1>
          <p className="mt-2 text-muted-foreground">{data.count} boxes</p>
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
            Add Box
          </Button>
        </DataTableAdvancedToolbar>
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
