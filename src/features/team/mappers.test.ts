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
  leaderId: 7,
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
  leaderId: 7,
  leaderRole: "lead",
  structure: "core",
};

describe("teamDtoToForm", () => {
  it("takes leaderId from the scalar, not the nested object", () => {
    expect(teamDtoToForm(dto)).toEqual(form);
  });

  it("falls back to the nested leader id when the scalar is null", () => {
    const withoutScalar: TeamDto = { ...dto, leaderId: null };
    expect(teamDtoToForm(withoutScalar).leaderId).toBe(99);
  });

  it("yields leaderId 0 when neither is present, so the form flags it required", () => {
    const bare: TeamDto = { ...dto, leaderId: null, leader: null };
    expect(teamDtoToForm(bare).leaderId).toBe(0);
  });
});

describe("teamFormToCreate", () => {
  it("returns the full write payload", () => {
    expect(teamFormToCreate(form)).toEqual({
      name: "Платформа",
      code: 1234,
      type: "CHANGE",
      leaderId: 7,
      leaderRole: "lead",
      structure: "core",
    });
  });
});

describe("teamFormToPatch", () => {
  it("returns only dirty fields", () => {
    expect(teamFormToPatch(form, { leaderId: true })).toEqual({ leaderId: 7 });
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
