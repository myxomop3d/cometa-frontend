import { z } from "zod";

export const flowFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  caption: z.string().min(1, "Caption is required"),
  integrity: z
    .enum(["I_1", "I_2", "I_3", "I_4"])
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  confidentiality: z
    .enum(["K_1", "K_2", "K_3", "K_4"])
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  dataClass: z.string().min(1, "Data class is required"),
  dataType: z.string().min(1, "Data type is required"),
  state: z.string().min(1, "State is required"),
  descriptionMd: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export type FlowFormValues = z.infer<typeof flowFormSchema>;

export interface FlowWritePayload {
  code: string;
  caption: string;
  integrity: "I_1" | "I_2" | "I_3" | "I_4" | null;
  confidentiality: "K_1" | "K_2" | "K_3" | "K_4" | null;
  dataClass: string;
  dataType: string;
  state: string;
  descriptionMd: string | null;
}
