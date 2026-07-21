import type { AppMessage, PersonDto } from "@/types/api";
import type { RegisterFormValues } from "./schema";

type NameField = "lastName" | "firstName" | "middleName";

/**
 * Given current name values and a person found by email, return only the name
 * fields to fill — those currently empty. Never overwrites user input.
 */
export function namesToFill(
  current: Pick<RegisterFormValues, NameField>,
  person: Pick<PersonDto, NameField>,
): Partial<Record<NameField, string>> {
  const out: Partial<Record<NameField, string>> = {};
  if (current.lastName === "") out.lastName = person.lastName;
  if (current.firstName === "") out.firstName = person.firstName;
  if (current.middleName === "") out.middleName = person.middleName;
  return out;
}

/** Form fields a server error may target; anything else maps to "root". */
const FIELD_TARGETS = new Set<string>(["sigmaLogin", "email", "teamId", "password"]);

export interface FieldError {
  field: keyof RegisterFormValues | "root";
  message: string;
}

/** Map server AppMessage[] to (field, message) pairs for RHF setError. */
export function registerErrorFields(messages: AppMessage[]): FieldError[] {
  return messages
    .filter((m) => m.semantic === "E")
    .map((m) => ({
      field:
        m.target && FIELD_TARGETS.has(m.target)
          ? (m.target as keyof RegisterFormValues)
          : "root",
      message: m.message,
    }));
}
