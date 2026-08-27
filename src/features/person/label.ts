import type { PersonFlatDto } from "@/types/api";

export function personLabel(person: PersonFlatDto): string {
  const full = [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(" ");
  return full || person.email || `Person #${person.id}`;
}
