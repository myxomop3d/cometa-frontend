import { z } from "zod";

/** An emptied input sends "", never null — null means "leave unchanged" on the
 *  server (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

export const teamFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: emptyText(),
  /** NOT emptyText: team.type is @Enumerated(STRING) TeamType over a nullable
   *  text column, and "" breaks reads. Settable, never clearable — §4.2 of the
   *  spec. */
  type: z.string().min(1, "Type is required"),
  /** Required. 0 is a real person — the "not set" sentinel (DDL 021) — so
   *  nonnegative(), not positive(). "Nothing picked" is `undefined`, which
   *  z.number rejects with the same message. */
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .nonnegative("Leader is required"),
  leaderRole: emptyText(),
  structure: emptyText(),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

/** What the sheet seeds the form with: the leader may be not yet picked. */
export type TeamFormDefaults = Omit<TeamFormValues, "leaderId"> & {
  leaderId: number | undefined;
};

export interface TeamWritePayload {
  name: string;
  code: string;
  type: string;
  /** Relation ref: only `id` is honoured by the server. */
  leader: { id: number };
  leaderRole: string;
  structure: string;
}
