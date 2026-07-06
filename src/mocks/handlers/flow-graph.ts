import { http } from "msw";
import { nodes } from "../data/nodes";
import { links } from "../data/links";
import { flows } from "../data/flows";
import { apiResponse } from "../lib/response";
import type { EnvironmentCode, FlowGraphDto } from "@/types/api";

const ENVIRONMENTS: EnvironmentCode[] = ["DEV", "IFT", "UAT", "PROD"];

function parseEnv(raw: string | null): EnvironmentCode {
  const upper = raw?.toUpperCase();
  // Mirrors the backend: unknown/missing values fall back to PROD
  return ENVIRONMENTS.find((e) => e === upper) ?? "PROD";
}

export const flowGraphHandlers = [
  http.get("/api/v1/flow-graph/:flowId", ({ params, request }) => {
    const flowId = Number(params.flowId);
    const flow = flows.find((f) => f.id === flowId);
    if (!flow) return new Response(null, { status: 404 });

    const env = parseEnv(new URL(request.url).searchParams.get("env"));

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const flowLinks = links.filter((l) => {
      if (l.flowId !== flowId) return false;
      const client = nodeById.get(l.clientNodeId);
      const server = nodeById.get(l.serverNodeId);
      return client?.environment === env && server?.environment === env;
    });

    const nodeIds = new Set<number>();
    for (const link of flowLinks) {
      nodeIds.add(link.clientNodeId);
      nodeIds.add(link.serverNodeId);
    }

    const graph: FlowGraphDto = {
      flowId,
      env,
      nodes: nodes.filter((n) => nodeIds.has(n.id)),
      links: flowLinks,
    };

    return apiResponse(graph);
  }),
];
