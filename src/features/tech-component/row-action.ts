import type { TechComponentDto } from "@/types/api";

export type TechComponentRowAction =
  | { variant: "create" }
  | { variant: "update"; row: TechComponentDto };
