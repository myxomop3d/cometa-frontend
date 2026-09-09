import { z } from "zod";

/** An emptied input sends "", never null — null means "leave unchanged" on the
 *  server (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

export const teamFormSchema = z.object({
  name: emptyText(),
  code: z
    .number({ error: "Code must be a number" })
    .nullable(),
  /** NOT emptyText: team.type is @Enumerated(STRING) TeamType over a nullable
   *  text column, and "" breaks reads. Settable, never clearable — §4.2 of the
   *  spec. */
  type: z.string().min(1, "Type is required"),
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderRole: emptyText(),
  structure: emptyText(),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

export interface TeamWritePayload {
  name: string;
  code: number | null;
  type: string;
  /** Relation ref: only `id` is honoured by the server. */
  leader: { id: number };
  leaderRole: string;
  structure: string;
}
