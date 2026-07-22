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

const DEFAULT_PAGE_SIZE = calculatePageSize();

export type TableQueryOptions<TDto> = UseSuspenseQueryOptions<
  ApiResponse<TDto[]>,
  Error,
  ApiResponse<TDto[]>,
  readonly unknown[]
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
    setRowAction: (a: TRowAction | null) => void;
  }) => ColumnDef<TDto, any>[];
  initialColumnPinning?: ColumnPinningState;
  initialColumnVisibility?: VisibilityState;
}

/** Route loader that ensures the active mode's query data before render. */
export function makeSwitchableLoader<TDto, TRowAction>(
  config: SwitchableTableConfig<TDto, TRowAction>,
) {
  return ({
    context,
    deps,
  }: {
    context: { queryClient: QueryClient };
    deps: SwitchableSearchBase & Record<string, unknown>;
  }) => {
    const page = deps.page ?? 1;
    const pageSize = deps.pageSize ?? DEFAULT_PAGE_SIZE;
    if (deps.advanced) {
      return context.queryClient.ensureQueryData(
        config.advancedQueryOptions({
          page,
          pageSize,
          sort: deps.sort,
          filters: deps.filters,
          joinOperator: deps.joinOperator,
        }),
      );
    }
    return context.queryClient.ensureQueryData(
      config.simpleQueryOptions({
        page,
        pageSize,
        sort: deps.sort,
        columnFilters: config.deriveColumnFilters(deps),
      }),
    );
  };
}
