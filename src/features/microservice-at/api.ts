import { createCrudApi } from "@/lib/api/create-crud-api";
import type {
  MicroserviceNameAggrDto,
  MicroserviceNameAggrPatch,
} from "@/types/api";
import { microserviceAtFilterDescriptors } from "./search";

export const MICROSERVICE_AT_QUERY_KEY = ["microservice-at"] as const;

/**
 * MICROSERVICE_NAME_AGGR aggregators, one per microservice name, maintained
 * by the backend reconcile job. Reads go through `/graph` so `$fields` can
 * pull each aggregator's nodes, their tech-component links and each link's
 * tech component in one call; the PATCH stays on the plain resource path.
 * Spec: docs/superpowers/specs/2026-09-23-microservices-at-page-design.md
 */
export const microserviceAtApi = createCrudApi<
  MicroserviceNameAggrDto,
  object,
  MicroserviceNameAggrPatch
>({
  basePath: "/api/v1/node-aggregator",
  listPath: "/api/v1/node-aggregator/graph",
  queryKey: MICROSERVICE_AT_QUERY_KEY,
  filterDescriptors: microserviceAtFilterDescriptors,
  baseFilter: "nodeAggrType eq 'MICROSERVICE_NAME_AGGR'",
  staticParams: {
    $fields: "nodes,nodes.techComponentLinks,nodes.techComponentLinks.techComponent",
  },
});
