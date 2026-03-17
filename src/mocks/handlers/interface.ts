import { http } from "msw";
import type { NodeInterfaceFlatDto } from "@/types/api";
import { interfaces } from "../data/interfaces";
import { apiError, apiResponse } from "../lib/response";
import { applyOData, parseOData } from "../lib/odata";

let db = [...interfaces];

export const interfaceHandlers = [
  // LIST
  http.get("/api/v1/interface", ({ request }) => {
    const url = new URL(request.url);
    const params = parseOData(url);
    const { items, total } = applyOData(db, params);
    return apiResponse(items, total);
  }),

  // GET by ID
  http.get("/api/v1/interface/:id", ({ params }) => {
    const item = db.find((i) => i.id === Number(params.id));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // CREATE
  http.post("/api/v1/interface", async ({ request }) => {
    const body = (await request.json()) as NodeInterfaceFlatDto;
    const newItem = {
      ...body,
      id: Math.max(...db.map((i) => i.id)) + 1,
    };
    db.push(newItem);
    return apiResponse(newItem);
  }),

  // FULL UPDATE
  http.put("/api/v1/interface/:id", async ({ request, params }) => {
    const idx = db.findIndex((i) => i.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as NodeInterfaceFlatDto;
    db[idx] = { ...body, id: db[idx].id };
    return apiResponse(db[idx]);
  }),

  // PARTIAL UPDATE
  http.patch("/api/v1/interface/:id", async ({ request, params }) => {
    const idx = db.findIndex((i) => i.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as Partial<NodeInterfaceFlatDto>;
    db[idx] = { ...db[idx], ...body };
    return apiResponse(db[idx]);
  }),

  // DELETE
  http.delete("/api/v1/interface/:id", ({ params }) => {
    const idx = db.findIndex((i) => i.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    db.splice(idx, 1);
    return apiResponse("Deleted");
  }),
];
