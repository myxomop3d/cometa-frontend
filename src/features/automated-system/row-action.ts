import type { AutomatedSystemDto } from "@/types/api";

export type AutomatedSystemRowAction =
  | { variant: "create" }
  | { variant: "update"; row: AutomatedSystemDto };
