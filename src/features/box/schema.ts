import { z } from "zod";

export const boxFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  shape: z.enum(["O", "X"]),
  num: z.number(),
  dateStr: z.string().min(1, "Date is required"),
  checkbox: z.boolean(),
  itemId: z.number().nullable(),
  thingIds: z.array(z.number()),
  oldItemId: z.number().nullable(),
  oldThingIds: z.array(z.number()),
});

export type BoxFormValues = z.infer<typeof boxFormSchema>;

/**
 * Shape sent to backend for create/patch. Relations are nested `{id}` refs
 * (not full DTOs), matching what the backend expects on write.
 */
export interface BoxWritePayload {
  name: string;
  objectCode: string | null;
  shape: "O" | "X";
  num: number;
  dateStr: string;
  checkbox: boolean;
  tags: string[];
  item: { id: number } | null;
  things: { id: number }[];
  oldItem: { id: number } | null;
  oldThings: { id: number }[];
}
