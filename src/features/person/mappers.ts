import type { PersonDto, TeamFlatDto } from "@/types/api";
import type { PersonFormValues, PersonWritePayload } from "./schema";

export function personDtoToForm(dto: PersonDto): PersonFormValues {
  return {
    email: dto.email,
    lastName: dto.lastName,
    firstName: dto.firstName,
    middleName: dto.middleName,
    // `teams` is absent on any read that omitted $fields=teams; an absent
    // relation and an empty relation both mean "nothing to preselect".
    teamIds: dto.teams?.map((t) => t.id) ?? [],
  };
}

/** `name` is a non-null `string` post-migration, but can still be `""` (the
 *  migration backfilled every NULL to `""`, it didn't require a name). Fall
 *  back to the id so a nameless team still renders as a visible segment
 *  instead of an empty one between commas. `||`, not `??`, because `""` must
 *  hit the fallback too — unlike `person/columns.tsx`'s and `PersonSheet`'s
 *  own `team.name ?? String(team.id)` `getLabel`s, which still miss `""`. */
export function formatTeamNames(teams: TeamFlatDto[] | undefined): string {
  if (!teams || teams.length === 0) return "—";
  return teams.map((t) => t.name || String(t.id)).join(", ");
}

export function personFormToCreate(v: PersonFormValues): PersonWritePayload {
  return {
    email: v.email,
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
    teams: v.teamIds.map((id) => ({ id })),
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

/** Order-independent set comparison. Team membership has no meaningful order,
 *  so a reorder must not be reported as a change. */
function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((id) => seen.has(id));
}

export function personFormToPatch(
  v: PersonFormValues,
  dirty: PersonDirtyFields,
  originalTeamIds: number[],
): Partial<PersonWritePayload> {
  const out: Partial<PersonWritePayload> = {};
  if (isDirty(dirty.email)) out.email = v.email;
  if (isDirty(dirty.lastName)) out.lastName = v.lastName;
  if (isDirty(dirty.firstName)) out.firstName = v.firstName;
  if (isDirty(dirty.middleName)) out.middleName = v.middleName;

  // Deliberately NOT driven by `dirty.teamIds`. react-hook-form reports an
  // emptied array as clean under `isDirty` above, so "remove from every team"
  // would silently no-op. Compare against the original set instead.
  if (!sameIdSet(v.teamIds, originalTeamIds)) {
    out.teams = v.teamIds.map((id) => ({ id }));
  }
  return out;
}
