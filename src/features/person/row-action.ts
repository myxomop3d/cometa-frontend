import type { PersonDto } from "@/types/api";

export type PersonRowAction =
  | { variant: "create" }
  | { variant: "update"; row: PersonDto };
