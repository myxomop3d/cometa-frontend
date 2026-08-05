import { describe, it, expect } from "vitest";
import type { PersonDto } from "@/types/api";
import {
  personDtoToForm,
  personFormToCreate,
  personFormToPatch,
} from "./mappers";
import type { PersonFormValues } from "./schema";

const dto: PersonDto = {
  id: 7,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
};

const form: PersonFormValues = {
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
};

describe("personDtoToForm", () => {
  it("drops server-managed fields and keeps the four editable ones", () => {
    expect(personDtoToForm(dto)).toEqual(form);
  });
});

describe("personFormToCreate", () => {
  it("returns the full write payload", () => {
    expect(personFormToCreate(form)).toEqual({
      email: "ivanov@example.com",
      lastName: "Иванов",
      firstName: "Иван",
      middleName: "Иванович",
    });
  });
});

describe("personFormToPatch", () => {
  it("returns only dirty fields", () => {
    expect(personFormToPatch(form, { email: true })).toEqual({
      email: "ivanov@example.com",
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(personFormToPatch(form, {})).toEqual({});
  });

  it("treats a non-empty array flag as dirty", () => {
    expect(personFormToPatch(form, { lastName: [true] })).toEqual({
      lastName: "Иванов",
    });
  });

  it("treats an empty array flag as clean", () => {
    expect(personFormToPatch(form, { lastName: [] })).toEqual({});
  });
});
