import type { TechComponentDto } from "@/types/api";
import type {
  TechComponentFormDefaults,
  TechComponentFormValues,
  TechComponentWritePayload,
} from "./schema";

export function techComponentDtoToForm(
  dto: TechComponentDto,
): TechComponentFormDefaults {
  return {
    groupName: dto.groupName ?? "",
    name: dto.name ?? "",
    technology: dto.technology ?? "",
    environment: dto.environment,
    // Present only on reads that requested $fields=automatedSystem.
    // Absent -> undefined ("nothing picked"); 0 is the not-set sentinel.
    automatedSystemId: dto.automatedSystem?.id,
    consoleUrl: dto.consoleUrl ?? "",
    infoUrl: dto.infoUrl ?? "",
  };
}

export function techComponentFormToCreate(
  v: TechComponentFormValues,
): TechComponentWritePayload {
  return {
    groupName: v.groupName,
    name: v.name,
    technology: v.technology,
    environment: v.environment,
    consoleUrl: v.consoleUrl,
    infoUrl: v.infoUrl,
    automatedSystem: { id: v.automatedSystemId },
  };
}

export type TechComponentDirtyFields = Partial<
  Record<keyof TechComponentFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function techComponentFormToPatch(
  v: TechComponentFormValues,
  dirty: TechComponentDirtyFields,
): Partial<TechComponentWritePayload> {
  const out: Partial<TechComponentWritePayload> = {};
  if (isDirty(dirty.groupName)) out.groupName = v.groupName;
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.technology)) out.technology = v.technology;
  if (isDirty(dirty.environment)) out.environment = v.environment;
  if (isDirty(dirty.automatedSystemId)) out.automatedSystem = { id: v.automatedSystemId };
  if (isDirty(dirty.consoleUrl)) out.consoleUrl = v.consoleUrl;
  if (isDirty(dirty.infoUrl)) out.infoUrl = v.infoUrl;
  return out;
}
