import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/create-crud-api";
import type { ApiResponse, FlowGraphDto } from "@/types/api";

export function flowGraphQueryOptions(flowId: number) {
  return queryOptions({
    queryKey: ["flow-graph", flowId] as const,
    queryFn: () =>
      apiFetch<ApiResponse<FlowGraphDto>>(`/api/v1/flow-graph/${flowId}`),
  });
}
