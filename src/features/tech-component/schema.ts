import { z } from "zod";
import type { TechComponentEnvironment } from "@/types/api";

/** An emptied input sends "", never null — null means "leave unchanged" on the
 *  server (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

/** Mirrors ru.sberbank.cib.gmbus.entity.enums.Environment. */
export const TECH_COMPONENT_ENVIRONMENTS = [
  "PROD",
  "UAT",
  "IFT",
  "DEV",
] as const satisfies readonly TechComponentEnvironment[];

/**
 * Mirrors the database: group_name, name, environment and (since DDL 021)
 * automated_system_id are NOT NULL, so only those are required. URLs are not
 * format-validated — free-text columns, and a rule stricter than the data
 * would make legacy rows unsaveable (the AS `ci` lesson).
 */
export const techComponentFormSchema = z.object({
  groupName: z.string().min(1, "Group is required"),
  name: z.string().min(1, "Name is required"),
  technology: emptyText(),
  environment: z.enum(TECH_COMPONENT_ENVIRONMENTS, {
    error: "Environment is required",
  }),
  /** 0 is the "Not set" sentinel row — valid. "Nothing picked" is undefined. */
  automatedSystemId: z
    .number({ error: "Automated system is required" })
    .int()
    .nonnegative("Automated system is required"),
  consoleUrl: emptyText(),
  infoUrl: emptyText(),
});

export type TechComponentFormValues = z.infer<typeof techComponentFormSchema>;

/** What the sheet seeds the form with: environment and automated system may
 *  be not yet picked. */
export type TechComponentFormDefaults = Omit<
  TechComponentFormValues,
  "environment" | "automatedSystemId"
> & {
  environment: TechComponentEnvironment | undefined;
  automatedSystemId: number | undefined;
};

export interface TechComponentWritePayload {
  groupName: string;
  name: string;
  technology: string;
  environment: TechComponentEnvironment;
  consoleUrl: string;
  infoUrl: string;
  /** Relation ref: only `id` is honoured. Required (NOT NULL, DDL 021);
   *  `{ id: 0 }` is "Not set". */
  automatedSystem: { id: number };
}
