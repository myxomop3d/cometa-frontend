import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { FlowGraphPage } from "@/features/flow-graph/components/flow-graph-page";
import { flowGraphQueryOptions } from "@/features/flow-graph/api";
import { flowApi } from "@/features/flow/api";

const searchSchema = z.object({
  flowId: z.coerce.number().int().positive().optional(),
  env: z.enum(["DEV", "IFT", "UAT", "PROD"]).default("PROD"),
});

export const Route = createFileRoute("/flow-graph/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ flowId: search.flowId, env: search.env }),
  loader: ({ context, deps }) =>
    Promise.all([
      // Prefetch the selected flow's metadata for the header; the combobox
      // fetches its own ($top=20 + $filter) options when opened.
      deps.flowId === undefined
        ? undefined
        : context.queryClient.ensureQueryData(
            flowApi.detailQueryOptions(deps.flowId),
          ),
      deps.flowId === undefined
        ? undefined
        : context.queryClient.ensureQueryData(
            flowGraphQueryOptions(deps.flowId, deps.env),
          ),
    ]),
  component: RouteComponent,
});

function RouteComponent() {
  const { flowId, env } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <FlowGraphPage
      flowId={flowId}
      env={env}
      onFlowChange={(id) => navigate({ search: (prev) => ({ ...prev, flowId: id }) })}
      onEnvChange={(nextEnv) => navigate({ search: (prev) => ({ ...prev, env: nextEnv }) })}
    />
  );
}
