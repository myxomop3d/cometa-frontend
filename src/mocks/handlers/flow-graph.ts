import { http } from "msw";
import { nodes } from "../data/nodes";
import { links } from "../data/links";
import { flows } from "../data/flows";
import { interfaces } from "../data/interfaces";
import { apiResponse } from "../lib/response";
import type { FlowGraphDto } from "@/types/api";

export const flowGraphHandlers = [
  http.get("/api/v1/flow-graph/:flowId", ({ params }) => {
    const flowId = Number(params.flowId);
    const flow = flows.find((f) => f.id === flowId);
    if (!flow) return new Response(null, { status: 404 });

    const flowLinks = links.filter((l) => l.flowId === flowId);

    const nodeIds = new Set<number>();
    for (const link of flowLinks) {
      const clientIface = interfaces.find((i) => i.id === link.clientInterface.id);
      const serverIface = interfaces.find((i) => i.id === link.serverInterface.id);
      if (clientIface) nodeIds.add(clientIface.nodeId!);
      if (serverIface) nodeIds.add(serverIface.nodeId!);
    }

    const flowNodes = nodes
      .filter((n) => nodeIds.has(n.id))
      .map((n) => ({
        ...n,
        interfaces: interfaces.filter((i) => i.nodeId === n.id),
      }));

    const graph: FlowGraphDto = {
      flow,
      nodes: flowNodes,
      links: flowLinks,
    };

    return apiResponse(graph);
  }),
];
