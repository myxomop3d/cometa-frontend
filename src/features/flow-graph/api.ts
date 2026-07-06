import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/create-crud-api";
import type { ApiResponse, EnvironmentCode, FlowGraphDto } from "@/types/api";

// `env` is required: the backend NPEs when the param is omitted.
export function flowGraphQueryOptions(flowId: number, env: EnvironmentCode) {
  return queryOptions({
    queryKey: ["flow-graph", flowId, env] as const,
    queryFn: () =>
      apiFetch<ApiResponse<FlowGraphDto>>(`/api/v1/flow-graph/${flowId}?env=${env}`),
  });
}
