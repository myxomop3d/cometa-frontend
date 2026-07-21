import { describe, it, expect } from "vitest";
import { registerFormSchema, registerFormToRequest, EMAIL_RE } from "./schema";

const valid = {
  sigmaLogin: "12345678",
  email: "ivan@sber.ru",
  lastName: "Ivanov",
  firstName: "Ivan",
  middleName: "Ivanovich",
  password: "secret12",
  passwordConfirm: "secret12",
  teamId: null,
};

describe("registerFormSchema", () => {
  it("accepts a valid form", () => {
    expect(registerFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects sigmaLogin that is not exactly 8 digits", () => {
    expect(registerFormSchema.safeParse({ ...valid, sigmaLogin: "1234567" }).success).toBe(false);
    expect(registerFormSchema.safeParse({ ...valid, sigmaLogin: "123456789" }).success).toBe(false);
    expect(registerFormSchema.safeParse({ ...valid, sigmaLogin: "1234567a" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(registerFormSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("rejects a password shorter than 8", () => {
    const r = registerFormSchema.safeParse({ ...valid, password: "short", passwordConfirm: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const r = registerFormSchema.safeParse({ ...valid, passwordConfirm: "secret13" });
    expect(r.success).toBe(false);
  });

  it("maps form values to a request payload", () => {
    expect(registerFormToRequest(valid)).toEqual({
      sigmaLogin: "12345678",
      email: "ivan@sber.ru",
      lastName: "Ivanov",
      firstName: "Ivan",
      middleName: "Ivanovich",
      password: "secret12",
      teamId: null,
    });
  });

  it("EMAIL_RE matches valid and rejects invalid", () => {
    expect(EMAIL_RE.test("a@b.ru")).toBe(true);
    expect(EMAIL_RE.test("a@b")).toBe(false);
  });
});
