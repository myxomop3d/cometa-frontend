import type { Dispatch, SetStateAction } from "react";
import type { QueryClient, UseSuspenseQueryOptions } from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnPinningState,
  VisibilityState,
} from "@tanstack/react-table";
import type { ApiResponse } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { calculatePageSize } from "@/lib/data-table";
import type { SwitchableSearchBase } from "./switchable-search";

export const DEFAULT_PAGE_SIZE = calculatePageSize();

export type TableQueryOptions<TDto> = UseSuspenseQueryOptions<
  ApiResponse<TDto[]>,
  Error,
  ApiResponse<TDto[]>,
  // TQueryKey is left as `any` so concrete tuple query keys (e.g. the
  // ["boxes", "advanced", ...] shapes returned by the resource query-option
  // factories) remain assignable despite QueryFunction being contravariant in
  // its queryKey parameter. The config never inspects the key's shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

export interface SimpleQueryParams {
  page: number;
  pageSize: number;
  sort: string | undefined;
  columnFilters: { id: string; value: unknown }[];
}

export interface AdvancedQueryParams {
  page: number;
  pageSize: number;
  sort: string | undefined;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export interface SwitchableTableConfig<TDto, TRowAction> {
  queryKey: readonly unknown[];
  simpleQueryOptions: (p: SimpleQueryParams) => TableQueryOptions<TDto>;
  advancedQueryOptions: (p: AdvancedQueryParams) => TableQueryOptions<TDto>;
  deriveColumnFilters: (
    search: Record<string, unknown>,
  ) => { id: string; value: unknown }[];
  simpleFilterKeys: readonly string[];
  getColumns: (opts: {
    setRowAction: Dispatch<SetStateAction<TRowAction | null>>;
  }) => ColumnDef<TDto, any>[];
  initialColumnPinning?: ColumnPinningState;
  initialColumnVisibility?: VisibilityState;
}

/** Route loader that ensures the active mode's query data before render. */
export function makeSwitchableLoader<TDto, TRowAction>(
  config: SwitchableTableConfig<TDto, TRowAction>,
) {
  // `TDeps` is an *unconstrained* generic so this externally-typed loader
  // behaves like an inline one: TanStack infers the route's loaderDeps return
  // (which type-checks as the root `{}` placeholder during option validation)
  // without back-propagating a constraint onto the route's search schema — that
  // is what keeps `Route.useSearch()` correctly typed at the call sites. At
  // runtime `deps` is the fully-validated search (guaranteed by the route's
  // `validateSearch`), so we assert it to the concrete shape the reads need.
  return <TDeps,>({
    context,
    deps,
  }: {
    context: { queryClient: QueryClient };
    deps: TDeps;
  }) => {
    const search = deps as SwitchableSearchBase & Record<string, unknown>;
    const page = search.page ?? 1;
    const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
    if (search.advanced) {
      return context.queryClient.ensureQueryData(
        config.advancedQueryOptions({
          page,
          pageSize,
          sort: search.sort,
          filters: search.filters,
          joinOperator: search.joinOperator,
        }),
      );
    }
    return context.queryClient.ensureQueryData(
      config.simpleQueryOptions({
        page,
        pageSize,
        sort: search.sort,
        columnFilters: config.deriveColumnFilters(search),
      }),
    );
  };
}
