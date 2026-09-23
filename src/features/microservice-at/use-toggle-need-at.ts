import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiResponse, MicroserviceNameAggrDto } from "@/types/api";
import { MICROSERVICE_AT_QUERY_KEY, microserviceAtApi } from "./api";
import { setNeedAT } from "./mappers";

type Page = ApiResponse<MicroserviceNameAggrDto[]>;

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
 */
export function useToggleNeedAT() {
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const { mutate } = useMutation({
    mutationFn: ({ id, isNeedAT }: { id: number; isNeedAT: boolean }) =>
      microserviceAtApi.patch(id, {
        nodeAggrType: "MICROSERVICE_NAME_AGGR",
        data: { isNeedAT },
      }),
    onMutate: async ({ id, isNeedAT }) => {
      setPendingIds((prev) => new Set(prev).add(id));
      await queryClient.cancelQueries({ queryKey: MICROSERVICE_AT_QUERY_KEY });
      const pages = queryClient.getQueriesData<Page>({
        queryKey: MICROSERVICE_AT_QUERY_KEY,
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
        { queryKey: MICROSERVICE_AT_QUERY_KEY },
        (old) => (old ? setNeedAT(old, id, isNeedAT) : old),
      );
      return { previous };
    },
    onError: (err, { id }, context) => {
      const previous = context?.previous;
      if (previous !== undefined) {
        queryClient.setQueriesData<Page>(
          { queryKey: MICROSERVICE_AT_QUERY_KEY },
          (old) => (old ? setNeedAT(old, id, previous) : old),
        );
      }
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update Need AT",
      );
    },
    onSettled: (_data, _err, { id }) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return queryClient.invalidateQueries({ queryKey: MICROSERVICE_AT_QUERY_KEY });
    },
  });

  const toggle = React.useCallback(
    (id: number, isNeedAT: boolean) => mutate({ id, isNeedAT }),
    [mutate],
  );

  return { toggle, pendingIds };
}
