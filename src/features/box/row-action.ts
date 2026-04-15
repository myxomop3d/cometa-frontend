import type { BoxDto } from "@/types/api";

/**
 * Discriminated union for the edit/create sheet trigger.
 * Fixes the `row: null as any` hole in the previous rowAction state.
 */
export type BoxRowAction =
  | { variant: "create" }
  | { variant: "update"; row: BoxDto };
