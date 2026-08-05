import { describe, it, expect } from "vitest";
import type { BoxDto } from "@/types/api";
import { boxDtoToForm, boxFormToCreate, boxFormToPatch } from "./mappers";
import type { BoxFormValues } from "./schema";

const baseDto: BoxDto = {
  id: 42,
  name: "Alpha",
  objectCode: "OC-1",
  shape: "O",
  num: 7,
  item: { id: 1, name: "i1", status: "ON", date: "2026-01-01", count: 0 },
  itemId: 1,
  things: [
    { id: 10, name: "t1", status: "ON", date: "2026-01-01", count: 0 },
    { id: 11, name: "t2", status: "OFF", date: "2026-01-01", count: 0 },
  ],
  oldItem: { id: 2, name: "i2", status: "OFF", date: "2026-01-01", count: 0 },
  oldItemId: 2,
  oldThings: [
    { id: 20, name: "ot1", status: "ON", date: "2026-01-01", count: 0 },
  ],
  dateStr: "2026-04-08",
  checkbox: true,
  tags: ["a", "b"],
};

const baseForm: BoxFormValues = {
  name: "Alpha",
  objectCode: "OC-1",
  shape: "O",
  num: 7,
  dateStr: "2026-04-08",
  checkbox: true,
  itemId: 1,
  thingIds: [10, 11],
  oldItemId: 2,
  oldThingIds: [20],
};

describe("boxDtoToForm", () => {
  it("extracts flat ID form values from a populated DTO", () => {
    expect(boxDtoToForm(baseDto)).toEqual(baseForm);
  });

  it("maps null relations to null/empty form values", () => {
    const dto: BoxDto = {
      ...baseDto,
      item: null,
      itemId: null,
      things: null,
      oldItem: null,
      oldItemId: null,
      oldThings: null,
    };
    const form = boxDtoToForm(dto);
    expect(form.itemId).toBeNull();
    expect(form.thingIds).toEqual([]);
    expect(form.oldItemId).toBeNull();
    expect(form.oldThingIds).toEqual([]);
  });
});

describe("boxFormToCreate", () => {
  it("produces nested {id} refs for relations and tags: []", () => {
    const payload = boxFormToCreate(baseForm);
    expect(payload).toEqual({
      name: "Alpha",
      objectCode: "OC-1",
      shape: "O",
      num: 7,
      dateStr: "2026-04-08",
      checkbox: true,
      tags: [],
      item: { id: 1 },
      things: [{ id: 10 }, { id: 11 }],
      oldItem: { id: 2 },
      oldThings: [{ id: 20 }],
    });
  });

  it("emits null for cleared single relations", () => {
    const payload = boxFormToCreate({
      ...baseForm,
      itemId: null,
      oldItemId: null,
      thingIds: [],
      oldThingIds: [],
    });
    expect(payload.item).toBeNull();
    expect(payload.oldItem).toBeNull();
    expect(payload.things).toEqual([]);
    expect(payload.oldThings).toEqual([]);
  });
});

describe("boxFormToPatch", () => {
  it("returns {} when nothing is dirty", () => {
    expect(boxFormToPatch(baseForm, {})).toEqual({});
  });

  it("emits only the dirty scalar field", () => {
    const patch = boxFormToPatch(baseForm, { name: true });
    expect(patch).toEqual({ name: "Alpha" });
  });

  it("maps a dirty itemId to nested {item: {id}}", () => {
    const patch = boxFormToPatch(baseForm, { itemId: true });
    expect(patch).toEqual({ item: { id: 1 } });
  });

  it("maps a dirty itemId cleared to null to {item: null}", () => {
    const patch = boxFormToPatch(
      { ...baseForm, itemId: null },
      { itemId: true },
    );
    expect(patch).toEqual({ item: null });
  });

  it("maps dirty thingIds to nested things array", () => {
    const patch = boxFormToPatch(baseForm, { thingIds: [true, true] });
    expect(patch).toEqual({ things: [{ id: 10 }, { id: 11 }] });
  });

  it("treats empty-array dirtyFields entry as not-dirty", () => {
    // RHF represents an untouched array as `[]`; should be skipped.
    const patch = boxFormToPatch(baseForm, { thingIds: [] });
    expect(patch).toEqual({});
  });

  it("combines multiple dirty fields, including oldThings", () => {
    const patch = boxFormToPatch(baseForm, {
      num: true,
      oldThingIds: [true],
    });
    expect(patch).toEqual({
      num: 7,
      oldThings: [{ id: 20 }],
    });
  });
});
