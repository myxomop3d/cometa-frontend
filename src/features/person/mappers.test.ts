import { describe, it, expect } from "vitest";
import type { PersonDto, TeamFlatDto } from "@/types/api";
import {
  formatTeamNames,
  personDtoToForm,
  personFormToCreate,
  personFormToPatch,
} from "./mappers";
import {
  personFormSchema,
  EMPTY_PERSON_FORM,
  type PersonFormValues,
} from "./schema";

const dto: PersonDto = {
  id: 7,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
  teams: [
    {
      id: 3,
      insertedAt: null,
      updatedAt: null,
      name: "Платформа",
      code: 1234,
      type: "CHANGE",
      leaderRole: "",
      structure: "",
    },
  ],
};

const form: PersonFormValues = {
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
  teamIds: [3],
};

describe("personDtoToForm", () => {
  it("drops server-managed fields and keeps the four editable ones", () => {
    expect(personDtoToForm(dto)).toEqual(form);
  });

  it("yields an empty team list when teams is absent", () => {
    // Any read that omitted $fields=teams.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { teams: _teams, ...withoutTeams } = dto;
    expect(personDtoToForm(withoutTeams as PersonDto).teamIds).toEqual([]);
  });

  it("yields an empty team list when the person is in no teams", () => {
    expect(personDtoToForm({ ...dto, teams: [] }).teamIds).toEqual([]);
  });
});

describe("personFormToCreate", () => {
  it("writes teams as refs", () => {
    expect(personFormToCreate(form)).toEqual({
      email: "ivanov@example.com",
      lastName: "Иванов",
      firstName: "Иван",
      middleName: "Иванович",
      teams: [{ id: 3 }],
    });
  });
});

describe("personFormToPatch", () => {
  it("returns only dirty fields", () => {
    expect(personFormToPatch(form, { email: true }, form.teamIds)).toEqual({
      email: "ivanov@example.com",
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(personFormToPatch(form, {}, form.teamIds)).toEqual({});
  });

  it("treats a non-empty array flag as dirty", () => {
    expect(
      personFormToPatch(form, { lastName: [true] }, form.teamIds),
    ).toEqual({
      lastName: "Иванов",
    });
  });

  it("treats an empty array flag as clean", () => {
    expect(personFormToPatch(form, { lastName: [] }, form.teamIds)).toEqual(
      {},
    );
  });
});

describe("personFormToPatch team membership", () => {
  it("omits teams entirely when membership is unchanged", () => {
    expect(personFormToPatch(form, {}, [3])).toEqual({});
  });

  it("ignores ordering when deciding whether membership changed", () => {
    const reordered: PersonFormValues = { ...form, teamIds: [7, 3] };
    expect(personFormToPatch(reordered, {}, [3, 7])).toEqual({});
  });

  it("sends the full replacement set when a team is added", () => {
    const added: PersonFormValues = { ...form, teamIds: [3, 7] };
    expect(personFormToPatch(added, {}, [3])).toEqual({
      teams: [{ id: 3 }, { id: 7 }],
    });
  });

  it("sends an empty array when every team is removed", () => {
    // The critical case: dirtyFields would report an empty array as CLEAN,
    // so relying on it here would silently drop the change.
    const cleared: PersonFormValues = { ...form, teamIds: [] };
    expect(personFormToPatch(cleared, {}, [3])).toEqual({ teams: [] });
  });

  it("sends teams alongside dirty scalars", () => {
    const changed: PersonFormValues = { ...form, teamIds: [9] };
    expect(personFormToPatch(changed, { email: true }, [3])).toEqual({
      email: "ivanov@example.com",
      teams: [{ id: 9 }],
    });
  });
});

describe("formatTeamNames", () => {
  const team = (overrides: Partial<TeamFlatDto>): TeamFlatDto => ({
    id: 1,
    insertedAt: null,
    updatedAt: null,
    name: "Платформа",
    code: null,
    type: null,
    leaderRole: "",
    structure: "",
    ...overrides,
  });

  it("returns an em dash when teams is absent", () => {
    expect(formatTeamNames(undefined)).toBe("—");
  });

  it("returns an em dash when teams is empty", () => {
    expect(formatTeamNames([])).toBe("—");
  });

  it("joins team names with a comma", () => {
    expect(
      formatTeamNames([team({ id: 1, name: "A" }), team({ id: 2, name: "B" })]),
    ).toBe("A, B");
  });

  it("falls back to the id when a team has no name", () => {
    // name is a non-null string, but the migration backfilled every NULL to
    // "" rather than requiring a name; a naive join would render an empty
    // segment between commas instead of a visible placeholder.
    expect(
      formatTeamNames([team({ id: 5, name: "" }), team({ id: 6, name: "B" })]),
    ).toBe("5, B");
  });
});

describe("EMPTY_PERSON_FORM", () => {
  // Regression guard: PersonSheet's "create" variant seeds useForm with
  // EMPTY_PERSON_FORM. email/lastName/firstName/middleName are required
  // *text inputs* the user is expected to fill in before submitting — those
  // fields legitimately fail schema validation while blank, and the sheet
  // renders a visible error under each one, so that's normal, expected UX.
  //
  // teamIds is different: PersonSheet renders no input for it (yet), so it
  // can never become "dirty" and there is nowhere to show a validation
  // error for it. If a required field like this is ever added to the
  // schema without a valid default in EMPTY_PERSON_FORM, submitting a
  // freshly-opened "Add Person" form fails validation silently — the exact
  // bug this guards against (teamIds was previously absent from the
  // create-variant defaults, so zodResolver rejected with an invisible
  // invalid_type error and the Create button appeared dead).
  //
  // So: assert the *only* fields allowed to fail against EMPTY_PERSON_FORM
  // are the ones with visible inputs and visible errors. Any other field
  // failing here — teamIds today, or a new field added later — must go red.
  const FIELDS_WITH_VISIBLE_REQUIRED_VALIDATION = [
    "email",
    "lastName",
    "firstName",
    "middleName",
  ];

  it("fails validation only on the fields PersonSheet shows inputs and errors for", () => {
    const result = personFormSchema.safeParse(EMPTY_PERSON_FORM);
    const failingPaths = result.success
      ? []
      : [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    expect(failingPaths.sort()).toEqual(
      [...FIELDS_WITH_VISIBLE_REQUIRED_VALIDATION].sort(),
    );
  });
});
