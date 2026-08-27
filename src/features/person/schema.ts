import { z } from "zod";

export const personFormSchema = z.object({
  email: z.string().min(1, "Email is required").email("Must be a valid email"),
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().min(1, "Middle name is required"),
  /** Team membership is optional: an empty list is valid and means "no teams". */
  teamIds: z.array(z.number().int().positive()),
});

export type PersonFormValues = z.infer<typeof personFormSchema>;

export interface PersonWritePayload {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  /** Relation refs: only `id` is honoured. Omitted = unchanged,
   *  [] = clear all, non-empty = full replace. */
  teams?: { id: number }[];
}
