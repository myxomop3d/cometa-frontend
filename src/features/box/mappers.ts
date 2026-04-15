import type { BoxDto } from "@/types/api";
import type { BoxFormValues, BoxWritePayload } from "./schema";

export function boxDtoToForm(dto: BoxDto): BoxFormValues {
  return {
    name: dto.name,
    objectCode: dto.objectCode,
    shape: dto.shape,
    num: dto.num,
    dateStr: dto.dateStr,
    checkbox: dto.checkbox,
    itemId: dto.item?.id ?? null,
    thingIds: dto.things?.map((t) => t.id) ?? [],
    oldItemId: dto.oldItem?.id ?? null,
    oldThingIds: dto.oldThings?.map((t) => t.id) ?? [],
  };
}

export function boxFormToCreate(v: BoxFormValues): BoxWritePayload {
  return {
    name: v.name,
    objectCode: v.objectCode,
    shape: v.shape,
    num: v.num,
    dateStr: v.dateStr,
    checkbox: v.checkbox,
    tags: [],
    item: v.itemId != null ? { id: v.itemId } : null,
    things: v.thingIds.map((id) => ({ id })),
    oldItem: v.oldItemId != null ? { id: v.oldItemId } : null,
    oldThings: v.oldThingIds.map((id) => ({ id })),
  };
}

/**
 * Dirty-fields shape from react-hook-form. For primitives it's `true`;
 * for arrays it's an array of booleans (or `true`). We only care about truthiness.
 */
export type BoxDirtyFields = Partial<Record<keyof BoxFormValues, unknown>>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function boxFormToPatch(
  v: BoxFormValues,
  dirty: BoxDirtyFields,
): Partial<BoxWritePayload> {
  const out: Partial<BoxWritePayload> = {};
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.objectCode)) out.objectCode = v.objectCode;
  if (isDirty(dirty.shape)) out.shape = v.shape;
  if (isDirty(dirty.num)) out.num = v.num;
  if (isDirty(dirty.dateStr)) out.dateStr = v.dateStr;
  if (isDirty(dirty.checkbox)) out.checkbox = v.checkbox;
  if (isDirty(dirty.itemId))
    out.item = v.itemId != null ? { id: v.itemId } : null;
  if (isDirty(dirty.thingIds))
    out.things = v.thingIds.map((id) => ({ id }));
  if (isDirty(dirty.oldItemId))
    out.oldItem = v.oldItemId != null ? { id: v.oldItemId } : null;
  if (isDirty(dirty.oldThingIds))
    out.oldThings = v.oldThingIds.map((id) => ({ id }));
  return out;
}
