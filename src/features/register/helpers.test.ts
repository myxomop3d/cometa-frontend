import { describe, it, expect } from "vitest";
import { namesToFill, registerErrorFields } from "./helpers";
import type { AppMessage, PersonDto } from "@/types/api";

const person: PersonDto = {
  id: 1, insertedAt: null, updatedAt: null,
  email: "a@b.ru", lastName: "Ivanov", firstName: "Ivan", middleName: "Ivanovich",
};

describe("namesToFill", () => {
  it("fills all name fields when all are empty", () => {
    expect(namesToFill({ lastName: "", firstName: "", middleName: "" }, person)).toEqual({
      lastName: "Ivanov", firstName: "Ivan", middleName: "Ivanovich",
    });
  });

  it("does not overwrite fields the user already typed", () => {
    expect(namesToFill({ lastName: "Petrov", firstName: "", middleName: "  " }, person)).toEqual({
      firstName: "Ivan",
    });
  });
});

describe("registerErrorFields", () => {
  it("maps known targets to fields and unknown/null to root", () => {
    const messages: AppMessage[] = [
      { semantic: "E", message: "taken", target: "sigmaLogin", description: null },
      { semantic: "E", message: "dup", target: null, description: null },
      { semantic: "W", message: "ignored", target: "email", description: null },
    ];
    expect(registerErrorFields(messages)).toEqual([
      { field: "sigmaLogin", message: "taken" },
      { field: "root", message: "dup" },
    ]);
  });
});
