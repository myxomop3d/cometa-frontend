import * as React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { buildModeToggleUpdates } from "@/lib/data-table/switchable-search";
import type { SwitchableSearchBase } from "@/lib/data-table/switchable-search";
import { DEFAULT_PAGE_SIZE } from "@/lib/data-table/switchable-page";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

export function useSwitchableTablePage<TDto, TRowAction>({
  config,
  search,
  navigate,
}: {
  config: SwitchableTableConfig<TDto, TRowAction>;
  search: SwitchableSearchBase & Record<string, unknown>;
  // Loosely typed to accept TanStack Router's heavily-overloaded
  // `UseNavigateResult`. The hook only ever calls it with a `search` updater;
  // the `prev`/return `any` on that updater is what lets the real navigate be
  // assignable here without pulling in the full overloaded signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate: (opts: { search: (prev: any) => any }) => unknown;
}) {
  const advanced = search.advanced;
  const [rowAction, setRowAction] = React.useState<TRowAction | null>(null);
  const columns = React.useMemo(
    () => config.getColumns({ setRowAction }),
    [config],
  );

  const queryOpts = React.useMemo(() => {
    const page = search.page ?? 1;
    const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
    if (advanced) {
      return config.advancedQueryOptions({
        page,
        pageSize,
        sort: search.sort,
        filters: search.filters,
        joinOperator: search.joinOperator,
      });
    }
    return config.simpleQueryOptions({
      page,
      pageSize,
      sort: search.sort,
      columnFilters: config.deriveColumnFilters(search),
    });
  }, [config, search, advanced]);

  const { data } = useSuspenseQuery(queryOpts);

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.ceil(data.count / pageSize);

  const onNavigate = React.useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      navigate({
        search: (prev) => {
          const next = { ...prev, ...updates };
          const cleaned: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(next)) {
            if (v !== undefined && v !== null) cleaned[k] = v;
          }
          return cleaned;
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
    onNavigate,
    initialColumnPinning: config.initialColumnPinning,
    initialColumnVisibility: config.initialColumnVisibility,
  });

  const handleFilterChange = React.useCallback(
    ({
      filters,
      joinOperator,
    }: {
      filters: ExtendedColumnFilter[];
      joinOperator: "and" | "or";
    }) => {
      navigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev };
          next.page = 1;
          if (filters.length > 0) next.filters = JSON.stringify(filters);
          else delete next.filters;
          if (joinOperator === "or") next.joinOperator = "or";
          else delete next.joinOperator;
          return next;
        },
      });
    },
    [navigate],
  );

  const toggleMode = React.useCallback(
    () => onNavigate(buildModeToggleUpdates(config.simpleFilterKeys, !advanced)),
    [onNavigate, config.simpleFilterKeys, advanced],
  );

  return {
    table,
    advanced,
    data,
    count: data.count,
    pageCount,
    rowAction,
    setRowAction,
    toggleMode,
    handleFilterChange,
  };
}
