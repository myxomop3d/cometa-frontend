import type { FlowDto } from "@/types/api";
import type { FlowFormValues, FlowWritePayload } from "./schema";

export function flowDtoToForm(dto: FlowDto): FlowFormValues {
  return {
    code: dto.code,
    caption: dto.caption,
    integrity: dto.integrity,
    confidentiality: dto.confidentiality,
    dataClass: dto.dataClass,
    dataType: dto.dataType,
    state: dto.state,
    descriptionMd: dto.descriptionMd,
  };
}

export function flowFormToCreate(v: FlowFormValues): FlowWritePayload {
  return {
    code: v.code,
    caption: v.caption,
    integrity: v.integrity,
    confidentiality: v.confidentiality,
    dataClass: v.dataClass,
    dataType: v.dataType,
    state: v.state,
    descriptionMd: v.descriptionMd,
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
  if (isDirty(dirty.code)) out.code = v.code;
  if (isDirty(dirty.caption)) out.caption = v.caption;
  if (isDirty(dirty.integrity)) out.integrity = v.integrity;
  if (isDirty(dirty.confidentiality)) out.confidentiality = v.confidentiality;
  if (isDirty(dirty.dataClass)) out.dataClass = v.dataClass;
  if (isDirty(dirty.dataType)) out.dataType = v.dataType;
  if (isDirty(dirty.state)) out.state = v.state;
  if (isDirty(dirty.descriptionMd)) out.descriptionMd = v.descriptionMd;
  return out;
}
