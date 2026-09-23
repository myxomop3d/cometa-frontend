import type { TechComponentEnvironment } from "@/types/api";

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
