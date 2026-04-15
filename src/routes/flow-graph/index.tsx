import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { FlowGraphPage } from "@/features/flow-graph/components/flow-graph-page";
import { flowGraphQueryOptions } from "@/features/flow-graph/api";

const searchSchema = z.object({
  flowId: z.coerce.number().int().positive().default(99),
});

export const Route = createFileRoute("/flow-graph/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ flowId: search.flowId }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(flowGraphQueryOptions(deps.flowId)),
  component: RouteComponent,
});

function RouteComponent() {
  const { flowId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <FlowGraphPage
      flowId={flowId}
      onFlowChange={(id) => navigate({ search: { flowId: id } })}
    />
  );
}
