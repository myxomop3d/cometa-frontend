import { z } from "zod";
import type { RegisterRequest } from "@/types/api";

/** Basic email shape — also reused by the on-blur gate (deterministic, no zod version quirks). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerFormSchema = z
  .object({
    sigmaLogin: z.string().regex(/^\d{8}$/, "SIGMA login must be exactly 8 digits"),
    email: z.string().regex(EMAIL_RE, "Enter a valid email"),
    lastName: z.string().min(1, "Last name is required"),
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().min(1, "Middle name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirm: z.string(),
    teamId: z.number().nullable(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Passwords must match",
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function registerFormToRequest(v: RegisterFormValues): RegisterRequest {
  return {
    sigmaLogin: v.sigmaLogin,
    email: v.email,
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
    password: v.password,
    teamId: v.teamId,
  };
}
