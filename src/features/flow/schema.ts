import { z } from "zod";

/** An emptied input sends "", never null — null means "leave unchanged" on the
 *  server (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

export const flowFormSchema = z.object({
  key: z.string().min(1, "Key is required"),
  caption: z.string().min(1, "Caption is required"),
  integrity: emptyText(),
  confidentiality: emptyText(),
  secretClass: emptyText(),
  dataClass: z.string().min(1, "Data class is required"),
  dataType: z.string().min(1, "Data type is required"),
  description: emptyText(),
});

export type FlowFormValues = z.infer<typeof flowFormSchema>;

export interface FlowWritePayload {
  key: string;
  caption: string;
  integrity: string;
  confidentiality: string;
  secretClass: string;
  dataClass: string;
  dataType: string;
  description: string;
}
