import { http } from "msw";
import type { LinkDto } from "@/types/api";
import { links } from "../data/links";
import { apiError, apiResponse } from "../lib/response";
import { applyOData, parseOData } from "../lib/odata";

let db = [...links];

export const linkHandlers = [
  // LIST
  http.get("/api/v1/link", ({ request }) => {
    const url = new URL(request.url);
    const params = parseOData(url);
    const { items, total } = applyOData(db, params);
    return apiResponse(items, total);
  }),

  // GET by ID
  http.get("/api/v1/link/:id", ({ params }) => {
    const item = db.find((l) => l.id === Number(params.id));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // GET by natural ID
  http.get("/api/v1/link/num/:naturalId", ({ params }) => {
    const item = db.find((l) => String(l.id) === String(params.naturalId));
    if (!item) return apiError("Запись не найдена", 404);
    return apiResponse(item);
  }),

  // CREATE
  http.post("/api/v1/link", async ({ request }) => {
    const body = (await request.json()) as LinkDto;
    const newItem = {
      ...body,
      id: Math.max(...db.map((i) => i.id)) + 1,
    };
    db.push(newItem);
    return apiResponse(newItem);
  }),

  // FULL UPDATE
  http.put("/api/v1/link/:id", async ({ request, params }) => {
    const idx = db.findIndex((l) => l.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as LinkDto;
    db[idx] = { ...body, id: db[idx].id };
    return apiResponse(db[idx]);
  }),

  // PARTIAL UPDATE
  http.patch("/api/v1/link/:id", async ({ request, params }) => {
    const idx = db.findIndex((l) => l.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    const body = (await request.json()) as Partial<LinkDto>;
    db[idx] = { ...db[idx], ...body };
    return apiResponse(db[idx]);
  }),

  // DELETE
  http.delete("/api/v1/link/:id", ({ params }) => {
    const idx = db.findIndex((l) => l.id === Number(params.id));
    if (idx === -1) return apiError("Запись не найдена", 404);
    db.splice(idx, 1);
    return apiResponse("Deleted");
  }),
];
