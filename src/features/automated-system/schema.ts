import { z } from "zod";

/** Every optional text field behaves the same: an emptied input sends "",
 *  never null. The server treats null as "leave this field unchanged"
 *  (MapStruct's NullValuePropertyMappingStrategy.IGNORE), so "" is the only
 *  spelling that actually clears a column. `.trim()` keeps "   " from becoming
 *  a third spelling of empty.
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

/**
 * Mirrors the database, not the old inline editor. Only `name` and `leader`
 * are NOT NULL, so only those two are required. The previous inline-edit
 * schema also demanded fullName/ci(min 5)/block/tribe/cluster — rules stricter
 * than the data itself: five live rows have `length(ci) < 5` and so could not
 * be saved at all. See §6 of the design doc.
 */
export const automatedSystemFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: emptyText(),
  fullName: emptyText(),
  ci: emptyText(),
  nameHpsm: emptyText(),
  /** 0 is never a valid id, so positive() reports "Leader is required". */
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderComment: emptyText(),
  leaderSapId: emptyText(),
  block: emptyText(),
  tribe: emptyText(),
  cluster: emptyText(),
  clusterHpsmId: emptyText(),
  status: emptyText(),
  iftMailSupport: emptyText(),
  uatMailSupport: emptyText(),
  prodMailSupport: emptyText(),
  guid: emptyText(),
});

export type AutomatedSystemFormValues = z.infer<typeof automatedSystemFormSchema>;

export interface AutomatedSystemWritePayload {
  name: string;
  objectCode: string;
  fullName: string;
  ci: string;
  nameHpsm: string;
  /** Relation ref: only `id` is honoured by the server. `{}` is rejected with
   *  IllegalArgumentException, and clearing is impossible — the FK is NOT NULL. */
  leader: { id: number };
  leaderComment: string;
  leaderSapId: string;
  block: string;
  tribe: string;
  cluster: string;
  clusterHpsmId: string;
  status: string;
  iftMailSupport: string;
  uatMailSupport: string;
  prodMailSupport: string;
  guid: string;
}
