import { z } from "zod";

/** Every optional text field behaves the same: "" from an emptied input
 *  becomes null in the payload. The server currently ignores that null on
 *  PATCH (MapStruct's `NullValuePropertyMappingStrategy.IGNORE`), so clearing
 *  a field is a no-op server-side — the old value reappears on refetch. */
const nullableText = () =>
  z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v));

/**
 * Mirrors the database, not the old inline editor. Only `name` and `leader`
 * are NOT NULL, so only those two are required. The previous inline-edit
 * schema also demanded fullName/ci(min 5)/block/tribe/cluster — rules stricter
 * than the data itself: five live rows have `length(ci) < 5` and so could not
 * be saved at all. See §6 of the design doc.
 */
export const automatedSystemFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: nullableText(),
  fullName: nullableText(),
  ci: nullableText(),
  nameHpsm: nullableText(),
  /** 0 is never a valid id, so positive() reports "Leader is required". */
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderComment: nullableText(),
  leaderSapId: nullableText(),
  block: nullableText(),
  tribe: nullableText(),
  cluster: nullableText(),
  clusterHpsmId: nullableText(),
  status: nullableText(),
  iftMailSupport: nullableText(),
  uatMailSupport: nullableText(),
  prodMailSupport: nullableText(),
  guid: nullableText(),
});

export type AutomatedSystemFormValues = z.infer<typeof automatedSystemFormSchema>;

export interface AutomatedSystemWritePayload {
  name: string;
  objectCode: string | null;
  fullName: string | null;
  ci: string | null;
  nameHpsm: string | null;
  /** Relation ref: only `id` is honoured by the server. `{}` is rejected with
   *  IllegalArgumentException, and clearing is impossible — the FK is NOT NULL. */
  leader: { id: number };
  leaderComment: string | null;
  leaderSapId: string | null;
  block: string | null;
  tribe: string | null;
  cluster: string | null;
  clusterHpsmId: string | null;
  status: string | null;
  iftMailSupport: string | null;
  uatMailSupport: string | null;
  prodMailSupport: string | null;
  guid: string | null;
}
