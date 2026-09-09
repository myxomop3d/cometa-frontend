import type { FlowDto } from "@/types/api";
import type { FlowFormValues, FlowWritePayload } from "./schema";

export function flowDtoToForm(dto: FlowDto): FlowFormValues {
  return {
    key: dto.key,
    caption: dto.caption,
    integrity: dto.integrity ?? "",
    confidentiality: dto.confidentiality ?? "",
    secretClass: dto.secretClass ?? "",
    dataClass: dto.dataClass,
    dataType: dto.dataType,
    description: dto.description ?? "",
  };
}

export function flowFormToCreate(v: FlowFormValues): FlowWritePayload {
  return {
    key: v.key,
    caption: v.caption,
    integrity: v.integrity,
    confidentiality: v.confidentiality,
    secretClass: v.secretClass,
    dataClass: v.dataClass,
    dataType: v.dataType,
    description: v.description,
  };
}

export type FlowDirtyFields = Partial<Record<keyof FlowFormValues, unknown>>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function flowFormToPatch(
  v: FlowFormValues,
  dirty: FlowDirtyFields,
): Partial<FlowWritePayload> {
  const out: Partial<FlowWritePayload> = {};
  if (isDirty(dirty.key)) out.key = v.key;
  if (isDirty(dirty.caption)) out.caption = v.caption;
  if (isDirty(dirty.integrity)) out.integrity = v.integrity;
  if (isDirty(dirty.confidentiality)) out.confidentiality = v.confidentiality;
  if (isDirty(dirty.secretClass)) out.secretClass = v.secretClass;
  if (isDirty(dirty.dataClass)) out.dataClass = v.dataClass;
  if (isDirty(dirty.dataType)) out.dataType = v.dataType;
  if (isDirty(dirty.description)) out.description = v.description;
  return out;
}
