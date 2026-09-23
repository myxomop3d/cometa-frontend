import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiResponse, MicroserviceNameAggrDto } from "@/types/api";
import { MICROSERVICE_AT_QUERY_KEY, microserviceAtApi } from "./api";
import { setNeedAT } from "./mappers";

type Page = ApiResponse<MicroserviceNameAggrDto[]>;

/** The `dataTableQueryOptions` sub-key: `[...queryKey, "table", page, pageSize,
 *  sort, columnFilters]`. Cancel/read/write are scoped to this sub-key (not
 *  the root `MICROSERVICE_AT_QUERY_KEY`) so a route transition's first-time
 *  `["microservice-at", "list", …]` or `"detail"` fetch is never touched by a
 *  toggle on another page. `invalidateQueries` still uses the root key, since
 *  invalidation-without-cancel is safe for a query with no data. */
const TABLE_QUERY_KEY = [...MICROSERVICE_AT_QUERY_KEY, "table"] as const;

/**
 * PATCH one aggregator's `data.isNeedAT`, optimistically. The cached pages
 * are updated before the request and rolled back if it fails. The body
 * carries no `nodes`, so membership is left unchanged. Reconcile never
 * rewrites an existing aggregator's `data`, so the value survives the
 * 3-hourly job.
 *
 * Rollback is scoped to the failed row only: `onMutate` records that row's
 * own previous `isNeedAT` (not a snapshot of the whole cached page), and
 * `onError` reapplies just that value. Two toggles can be in flight on
 * different rows of the same page at once; if one fails, restoring the
 * whole page would silently revert the other row's still-pending or
 * already-settled optimistic write, so only the failed row is touched.
 *
 * `cancelQueries` also carries a `predicate` that skips any query with no
 * data yet. Without it, a toggle fired while the route loader's first
 * `ensureQueryData` for a not-yet-cached page is still in flight cancels
 * that fetch; query-core 5.90's cancel-with-revert on a query with no data
 * rethrows `CancelledError`, which fails `ensureQueryData` and trips the
 * route's error boundary. A query that already has data reverts to that
 * data on cancel instead of rethrowing, so restricting the predicate to
 * "has data" is both necessary and sufficient.
 */
export function useToggleNeedAT() {
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  // Mirrors `pendingIds` so `isPending` can read a stable snapshot without
  // being a dependency of anything that needs a stable identity (e.g. the
  // route's `columns` memo). Written only from the `setPendingIds` updaters
  // below (never assigned during render).
  const pendingIdsRef = React.useRef(pendingIds);

  const addPending = React.useCallback((id: number) => {
    setPendingIds((prev) => {
      const next = new Set(prev).add(id);
      pendingIdsRef.current = next;
      return next;
    });
  }, []);

  const removePending = React.useCallback((id: number) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      pendingIdsRef.current = next;
      return next;
    });
  }, []);

  const isPending = React.useCallback(
    (id: number) => pendingIdsRef.current.has(id),
    [],
  );

  const { mutate } = useMutation({
    mutationFn: ({ id, isNeedAT }: { id: number; isNeedAT: boolean }) =>
      microserviceAtApi.patch(id, {
        nodeAggrType: "MICROSERVICE_NAME_AGGR",
        data: { isNeedAT },
      }),
    onMutate: async ({ id, isNeedAT }) => {
      addPending(id);
      await queryClient.cancelQueries({
        queryKey: TABLE_QUERY_KEY,
        predicate: (query) => query.state.data !== undefined,
      });
      const pages = queryClient.getQueriesData<Page>({
        queryKey: TABLE_QUERY_KEY,
      });
      let previous: boolean | undefined;
      for (const [, page] of pages) {
        const row = page?.data.find((r) => r.id === id);
        if (row) {
          previous = row.data?.isNeedAT;
          break;
        }
      }
      queryClient.setQueriesData<Page>(
        { queryKey: TABLE_QUERY_KEY },
        (old) => (old ? setNeedAT(old, id, isNeedAT) : old),
      );
      return { previous };
    },
    onError: (err, { id }, context) => {
      const previous = context?.previous;
      if (previous !== undefined) {
        queryClient.setQueriesData<Page>(
          { queryKey: TABLE_QUERY_KEY },
          (old) => (old ? setNeedAT(old, id, previous) : old),
        );
      }
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update Need AT",
      );
    },
    onSettled: (_data, _err, { id }) => {
      removePending(id);
      return queryClient.invalidateQueries({ queryKey: MICROSERVICE_AT_QUERY_KEY });
    },
  });

  const toggle = React.useCallback(
    (id: number, isNeedAT: boolean) => mutate({ id, isNeedAT }),
    [mutate],
  );

  return { toggle, isPending };
}
