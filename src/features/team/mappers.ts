import type { TeamDto } from "@/types/api";
import type { TeamFormValues, TeamWritePayload } from "./schema";

export function teamDtoToForm(dto: TeamDto): TeamFormValues {
  return {
    name: dto.name,
    code: dto.code,
    type: dto.type,
    // The leader id now arrives only inside the nested ref, which is present
    // only on reads that requested $fields=leader. 0 is never a valid id, so
    // the required-positive rule in teamFormSchema rejects it.
    leaderId: dto.leader?.id ?? 0,
    leaderRole: dto.leaderRole,
    structure: dto.structure,
  };
}

export function teamFormToCreate(v: TeamFormValues): TeamWritePayload {
  return {
    name: v.name,
    code: v.code,
    type: v.type,
    leader: { id: v.leaderId },
    leaderRole: v.leaderRole,
    structure: v.structure,
  };
}

export type TeamDirtyFields = Partial<Record<keyof TeamFormValues, unknown>>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function teamFormToPatch(
  v: TeamFormValues,
  dirty: TeamDirtyFields,
): Partial<TeamWritePayload> {
  const out: Partial<TeamWritePayload> = {};
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.code)) out.code = v.code;
  if (isDirty(dirty.type)) out.type = v.type;
  if (isDirty(dirty.leaderId)) out.leader = { id: v.leaderId };
  if (isDirty(dirty.leaderRole)) out.leaderRole = v.leaderRole;
  if (isDirty(dirty.structure)) out.structure = v.structure;
  return out;
}
