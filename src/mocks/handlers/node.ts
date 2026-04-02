import { http, HttpResponse } from "msw";
import type { MicroserviceNodeDto, NodeDto, TopicNodeDto } from "@/types/api";
import { nodes } from "../data/nodes";
import { interfaces } from "../data/interfaces";
import { apiError, apiResponse } from "../lib/response";
import { applyOData, parseOData } from "../lib/odata";

let db = [...nodes];

function enrichWithInterfaces(node: NodeDto): NodeDto {
  return {
    ...node,
    interfaces: interfaces.filter((i) => i.nodeId === node.id),
  };
}

export const nodeHandlers = [
  // LIST
  http.get("/api/v1/node", ({ request }) => {
    const url = new URL(request.url);
    const params = parseOData(url);
    const { items, total } = applyOData(db, params);
    return apiResponse(items, total);
  }),

  // GET by ID
  http.get("/api/v1/node/:id", ({ params }) => {
    const item = db.find((n) => n.id === Number(params.id));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // GRAPH LIST (with $fields for nested entities)
  http.get("/api/v1/node/graph", ({ request }) => {
    const url = new URL(request.url);
    const params = parseOData(url);
    const { items, total } = applyOData(db, params);
    const enriched = items.map(enrichWithInterfaces);
    return apiResponse(enriched, total);
  }),

  // GRAPH by ID
  http.get("/api/v1/node/graph/:id", ({ params: routeParams }) => {
    const item = db.find((n) => n.id === Number(routeParams.id));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(enrichWithInterfaces(item));
  }),

  // COUNT
  http.get("/api/v1/node/count", ({ request }) => {
    const url = new URL(request.url);
    const filter = url.searchParams.get("$filter");
    if (filter) {
      const { total } = applyOData(db, {
        skip: 0,
        top: 0,
        filter,
        orderby: null,
      });
      return apiResponse(total);
    }
    return apiResponse(db.length);
  }),

  // METADATA
  http.get("/api/v1/node/\\$metadata", () => {
    return HttpResponse.text("<metadata/>");
  }),

  // GET by natural ID
  http.get("/api/v1/node/num/:naturalId", ({ params }) => {
    const item = db.find((n) => n.name === String(params.naturalId));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // CREATE
  http.post("/api/v1/node", async ({ request }) => {
    const body = (await request.json()) as MicroserviceNodeDto | TopicNodeDto;
    const newItem = {
      ...body,
      id: Math.max(...db.map((i) => i.id)) + 1,
    } as MicroserviceNodeDto | TopicNodeDto;
    db.push(newItem);
    return apiResponse(newItem);
  }),

  // FULL UPDATE
  http.put("/api/v1/node/:id", async ({ request, params }) => {
    const idx = db.findIndex((n) => n.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as MicroserviceNodeDto | TopicNodeDto;
    db[idx] = { ...body, id: db[idx].id } as MicroserviceNodeDto | TopicNodeDto;
    return apiResponse(db[idx]);
  }),

  // PARTIAL UPDATE
  http.patch("/api/v1/node/:id", async ({ request, params }) => {
    const idx = db.findIndex((n) => n.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as Partial<MicroserviceNodeDto | TopicNodeDto>;
    db[idx] = { ...db[idx], ...body } as MicroserviceNodeDto | TopicNodeDto;
    return apiResponse(db[idx]);
  }),

  // DELETE
  http.delete("/api/v1/node/:id", ({ params }) => {
    const idx = db.findIndex((n) => n.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    db.splice(idx, 1);
    return apiResponse("Deleted");
  }),
];
