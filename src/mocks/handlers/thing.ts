import { http } from "msw";
import type { ThingDto } from "@/types/api";
import { things } from "../data/things";
import { apiError, apiResponse } from "../lib/response";
import { applyOData, parseOData } from "../lib/odata";

let db = [...things];

export const thingHandlers = [
  // LIST
  http.get("/api/v1/thing", ({ request }) => {
    const url = new URL(request.url);
    const params = parseOData(url);
    const { items, total } = applyOData(db, params);
    return apiResponse(items, total);
  }),

  // GET by ID
  http.get("/api/v1/thing/:id", ({ params }) => {
    const item = db.find((s) => s.id === Number(params.id));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // CREATE
  http.post("/api/v1/thing", async ({ request }) => {
    const body = (await request.json()) as Partial<ThingDto>;
    const newItem = {
      ...body,
      id: Math.max(...db.map((i) => i.id)) + 1,
    } as ThingDto;
    db.push(newItem);
    return apiResponse(newItem);
  }),

  // FULL UPDATE
  http.put("/api/v1/thing/:id", async ({ request, params }) => {
    const idx = db.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as ThingDto;
    db[idx] = { ...body, id: db[idx].id };
    return apiResponse(db[idx]);
  }),

  // PARTIAL UPDATE
  http.patch("/api/v1/thing/:id", async ({ request, params }) => {
    const idx = db.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as Partial<ThingDto>;
    db[idx] = { ...db[idx], ...body };
    return apiResponse(db[idx]);
  }),

  // DELETE
  http.delete("/api/v1/thing/:id", ({ params }) => {
    const idx = db.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    db.splice(idx, 1);
    return apiResponse("Deleted");
  }),
];
