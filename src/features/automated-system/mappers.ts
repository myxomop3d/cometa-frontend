import type { AutomatedSystemDto } from "@/types/api";
import type {
  AutomatedSystemFormValues,
  AutomatedSystemWritePayload,
} from "./schema";

export function automatedSystemDtoToForm(
  dto: AutomatedSystemDto,
): AutomatedSystemFormValues {
  return {
    name: dto.name,
    objectCode: dto.objectCode ?? "",
    fullName: dto.fullName ?? "",
    ci: dto.ci ?? "",
    nameHpsm: dto.nameHpsm ?? "",
    // The leader's id arrives only inside the nested ref, present only on
    // reads that requested $fields=leader. 0 is never a valid id, so the
    // required-positive rule in the schema rejects it.
    leaderId: dto.leader?.id ?? 0,
    leaderComment: dto.leaderComment ?? "",
    leaderSapId: dto.leaderSapId ?? "",
    block: dto.block ?? "",
    tribe: dto.tribe ?? "",
    cluster: dto.cluster ?? "",
    clusterHpsmId: dto.clusterHpsmId ?? "",
    status: dto.status ?? "",
    iftMailSupport: dto.iftMailSupport ?? "",
    uatMailSupport: dto.uatMailSupport ?? "",
    prodMailSupport: dto.prodMailSupport ?? "",
    guid: dto.guid ?? "",
  };
}

export function automatedSystemFormToCreate(
  v: AutomatedSystemFormValues,
): AutomatedSystemWritePayload {
  return {
    name: v.name,
    objectCode: v.objectCode,
    fullName: v.fullName,
    ci: v.ci,
    nameHpsm: v.nameHpsm,
    leader: { id: v.leaderId },
    leaderComment: v.leaderComment,
    leaderSapId: v.leaderSapId,
    block: v.block,
    tribe: v.tribe,
    cluster: v.cluster,
    clusterHpsmId: v.clusterHpsmId,
    status: v.status,
    iftMailSupport: v.iftMailSupport,
    uatMailSupport: v.uatMailSupport,
    prodMailSupport: v.prodMailSupport,
    guid: v.guid,
  };
}

export type AutomatedSystemDirtyFields = Partial<
  Record<keyof AutomatedSystemFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function automatedSystemFormToPatch(
  v: AutomatedSystemFormValues,
  dirty: AutomatedSystemDirtyFields,
): Partial<AutomatedSystemWritePayload> {
  const out: Partial<AutomatedSystemWritePayload> = {};
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.objectCode)) out.objectCode = v.objectCode;
  if (isDirty(dirty.fullName)) out.fullName = v.fullName;
  if (isDirty(dirty.ci)) out.ci = v.ci;
  if (isDirty(dirty.nameHpsm)) out.nameHpsm = v.nameHpsm;
  if (isDirty(dirty.leaderId)) out.leader = { id: v.leaderId };
  if (isDirty(dirty.leaderComment)) out.leaderComment = v.leaderComment;
  if (isDirty(dirty.leaderSapId)) out.leaderSapId = v.leaderSapId;
  if (isDirty(dirty.block)) out.block = v.block;
  if (isDirty(dirty.tribe)) out.tribe = v.tribe;
  if (isDirty(dirty.cluster)) out.cluster = v.cluster;
  if (isDirty(dirty.clusterHpsmId)) out.clusterHpsmId = v.clusterHpsmId;
  if (isDirty(dirty.status)) out.status = v.status;
  if (isDirty(dirty.iftMailSupport)) out.iftMailSupport = v.iftMailSupport;
  if (isDirty(dirty.uatMailSupport)) out.uatMailSupport = v.uatMailSupport;
  if (isDirty(dirty.prodMailSupport)) out.prodMailSupport = v.prodMailSupport;
  if (isDirty(dirty.guid)) out.guid = v.guid;
  return out;
}
