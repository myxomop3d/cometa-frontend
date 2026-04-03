import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  calculatePageSize,
  parseSorting,
  serializeSorting,
} from "@/lib/data-table";

interface UseDataTableOptions<TData, TSearch extends Record<string, unknown>> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  pageCount: number;
  search: TSearch;
  onNavigate: (updates: Partial<TSearch>) => void;
  sortKey?: string;
  pageKey?: string;
  pageSizeKey?: string;
  defaultPageSize?: number;
}

export function useDataTable<TData, TSearch extends Record<string, unknown>>({
  columns,
  data,
  pageCount,
  search,
  onNavigate,
  sortKey = "sort",
  pageKey = "page",
  pageSizeKey = "pageSize",
  defaultPageSize,
}: UseDataTableOptions<TData, TSearch>) {
  const computedDefaultPageSize = React.useMemo(
    () => defaultPageSize ?? calculatePageSize(),
    [defaultPageSize],
  );

  const page = ((search[pageKey] as number) ?? 1);
  const pageSizeFromUrl = search[pageSizeKey] as number | undefined;
  const pageSize = pageSizeFromUrl ?? computedDefaultPageSize;

  const sorting = React.useMemo(
    () => parseSorting(search[sortKey] as string | undefined),
    [search, sortKey],
  );

  // Derive column filters from URL search params using column meta
  const columnFilters = React.useMemo(() => {
    const filters: ColumnFiltersState = [];
    for (const col of columns) {
      const meta = col.meta;
      if (!meta?.variant) continue;
      const colId = (col as { id?: string; accessorKey?: string }).id ??
        (col as { accessorKey?: string }).accessorKey;
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
            const arrValue = Array.isArray(value) ? value : [value];
            filters.push({ id: colId, value: arrValue });
          } else if (meta.variant === "boolean") {
            const boolStr = typeof value === "boolean" ? [String(value)] : [value];
            filters.push({ id: colId, value: boolStr });
          } else {
            filters.push({ id: colId, value });
          }
        }
      }
    }
    return filters;
  }, [search, columns]);

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const pagination: PaginationState = React.useMemo(
    () => ({ pageIndex: page - 1, pageSize }),
    [page, pageSize],
  );

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onColumnFiltersChange = React.useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const nextFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;

      const updates: Record<string, unknown> = { [pageKey]: 1 };

      // Clear all filter params first
      for (const col of columns) {
        const meta = col.meta;
        if (!meta?.variant) continue;
        if (meta.filterKeys) {
          updates[meta.filterKeys[0]] = undefined;
          updates[meta.filterKeys[1]] = undefined;
        } else if (meta.filterKey) {
          updates[meta.filterKey] = undefined;
        }
      }

      // Set filter params from new filter state
      for (const filter of nextFilters) {
        const col = columns.find((c) => {
          const id = (c as { id?: string; accessorKey?: string }).id ??
            (c as { accessorKey?: string }).accessorKey;
          return id === filter.id;
        });
        const meta = col?.meta;
        if (!meta) continue;

        if (meta.filterKeys && Array.isArray(filter.value)) {
          const [v1, v2] = filter.value as [unknown, unknown];
          updates[meta.filterKeys[0]] = v1 ?? undefined;
          updates[meta.filterKeys[1]] = v2 ?? undefined;
        } else if (meta.filterKey) {
          if (meta.variant === "boolean" && Array.isArray(filter.value)) {
            const boolStr = (filter.value as string[])[0];
            updates[meta.filterKey] = boolStr === "true" ? true : boolStr === "false" ? false : undefined;
          } else {
            updates[meta.filterKey] = filter.value;
          }
        }
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onNavigate(updates as Partial<TSearch>);
      }, 300);
    },
    [columnFilters, columns, onNavigate, pageKey],
  );

  const onSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      onNavigate({
        [sortKey]: serializeSorting(nextSorting),
        [pageKey]: 1,
      } as Partial<TSearch>);
    },
    [sorting, onNavigate, sortKey, pageKey],
  );

  const onPaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      const nextPagination =
        typeof updater === "function" ? updater(pagination) : updater;
      onNavigate({
        [pageKey]: nextPagination.pageIndex + 1,
        [pageSizeKey]: nextPagination.pageSize,
      } as Partial<TSearch>);
    },
    [pagination, onNavigate, pageKey, pageSizeKey],
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    defaultColumn: {
      enableColumnFilter: false,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return React.useMemo(() => ({ table }), [table]);
}
