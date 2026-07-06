import { z } from "zod";

export const flowFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  caption: z.string().min(1, "Caption is required"),
  integrity: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  confidentiality: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  secretClass: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  dataClass: z.string().min(1, "Data class is required"),
  dataType: z.string().min(1, "Data type is required"),
  description: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export type FlowFormValues = z.infer<typeof flowFormSchema>;

export interface FlowWritePayload {
  code: string;
  caption: string;
  integrity: string | null;
  confidentiality: string | null;
  secretClass: string | null;
  dataClass: string;
  dataType: string;
  description: string | null;
}
