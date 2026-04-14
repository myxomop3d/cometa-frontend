import type { FlowDto } from "@/types/api";

export type FlowRowAction =
  | { variant: "create" }
  | { variant: "update"; row: FlowDto };
