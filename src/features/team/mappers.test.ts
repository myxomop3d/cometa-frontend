import { describe, it, expect } from "vitest";
import type { TeamDto } from "@/types/api";
import { teamDtoToForm, teamFormToCreate, teamFormToPatch } from "./mappers";
import type { TeamFormValues } from "./schema";

const dto: TeamDto = {
  id: 3,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  name: "Платформа",
  code: 1234,
  type: "CHANGE",
  leader: {
    id: 99,
    insertedAt: null,
    updatedAt: null,
    email: "ivanov@example.com",
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
  },
  leaderRole: "lead",
  structure: "core",
};

const form: TeamFormValues = {
  name: "Платформа",
  code: 1234,
  type: "CHANGE",
  leaderId: 99,
  leaderRole: "lead",
  structure: "core",
};

describe("teamDtoToForm", () => {
  it("takes leaderId from the nested leader ref", () => {
    expect(teamDtoToForm(dto)).toEqual(form);
  });

  it("yields leaderId 0 when leader is absent, so the form flags it required", () => {
    // Happens on any read that omitted $fields=leader.
    const bare: TeamDto = { ...dto, leader: null };
    expect(teamDtoToForm(bare).leaderId).toBe(0);
  });
});

describe("teamFormToCreate", () => {
  it("writes the leader as a ref, not a scalar", () => {
    expect(teamFormToCreate(form)).toEqual({
      name: "Платформа",
      code: 1234,
      type: "CHANGE",
      leader: { id: 99 },
      leaderRole: "lead",
      structure: "core",
    });
  });
});

describe("teamFormToPatch", () => {
  it("returns only dirty fields, with the leader as a ref", () => {
    expect(teamFormToPatch(form, { leaderId: true })).toEqual({
      leader: { id: 99 },
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(teamFormToPatch(form, {})).toEqual({});
  });

  it("includes explicit nulls for cleared nullable fields", () => {
    const cleared: TeamFormValues = { ...form, structure: null };
    expect(teamFormToPatch(cleared, { structure: true })).toEqual({
      structure: null,
    });
  });
});
