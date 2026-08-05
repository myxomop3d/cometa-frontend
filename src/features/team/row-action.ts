import type { TeamDto } from "@/types/api";

export type TeamRowAction =
  | { variant: "create" }
  | { variant: "update"; row: TeamDto };
