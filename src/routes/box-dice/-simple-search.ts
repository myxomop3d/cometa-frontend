import { parseIdList } from "@/lib/data-table/switchable-search";

export function validateBoxSimpleFields(search: Record<string, unknown>) {
  return {
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode:
      typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape: Array.isArray(search.shape)
      ? (search.shape as string[])
      : typeof search.shape === "string"
        ? search.shape.split(",")
        : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox:
      typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom:
      typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo:
      typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId:
      typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
  };
}
