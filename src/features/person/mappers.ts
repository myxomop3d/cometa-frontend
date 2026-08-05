import type { PersonDto } from "@/types/api";
import type { PersonFormValues, PersonWritePayload } from "./schema";

export function personDtoToForm(dto: PersonDto): PersonFormValues {
  return {
    email: dto.email,
    lastName: dto.lastName,
    firstName: dto.firstName,
    middleName: dto.middleName,
  };
}

export function personFormToCreate(v: PersonFormValues): PersonWritePayload {
  return {
    email: v.email,
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
  };
}

export type PersonDirtyFields = Partial<
  Record<keyof PersonFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function personFormToPatch(
  v: PersonFormValues,
  dirty: PersonDirtyFields,
): Partial<PersonWritePayload> {
  const out: Partial<PersonWritePayload> = {};
  if (isDirty(dirty.email)) out.email = v.email;
  if (isDirty(dirty.lastName)) out.lastName = v.lastName;
  if (isDirty(dirty.firstName)) out.firstName = v.firstName;
  if (isDirty(dirty.middleName)) out.middleName = v.middleName;
  return out;
}
