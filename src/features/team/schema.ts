import { z } from "zod";

export const teamFormSchema = z.object({
  name: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  code: z
    .number({ error: "Code must be a number" })
    .nullable(),
  type: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderRole: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  structure: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

export interface TeamWritePayload {
  name: string | null;
  code: number | null;
  type: string | null;
  leaderId: number;
  leaderRole: string | null;
  structure: string | null;
}
