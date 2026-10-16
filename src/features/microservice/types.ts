/** Mirrors of `MicroserviceOverviewDto` from GET /api/v1/microservice-overview.
 *  No-null standard: every string is non-null; empty is "".
 *  Spec: docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md */

/** Every environment the backend accepts in `env`. Must stay within the
 *  flow-graph route's `env` enum, because each flow link passes the row's env. */
export const ENVIRONMENTS = ["IFT", "UAT", "PROD", "DEV"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export function isEnvironment(value: unknown): value is Environment {
  return (ENVIRONMENTS as readonly unknown[]).includes(value);
}

/** From the microservice's point of view: CONSUME reads from the topic
 *  (COUNTERDIRECTIONAL link), PRODUCE writes to it (CODIRECTIONAL). */
export type TopicDirection = "CONSUME" | "PRODUCE";

export interface MicroserviceDeployment {
  techComponentId: number;
  techComponentName: string;
  artifactId: string;
  version: string;
}

export interface MicroserviceTopic {
  id: number;
  name: string;
  direction: TopicDirection;
}

export interface MicroserviceFlow {
  id: number;
  caption: string;
}

export interface MicroserviceOverviewDto {
  id: number;
  name: string;
  /** A node environment. Typed as string, not `Environment`: the column is
   *  free text in the DB, so narrow with `isEnvironment` before relying on it. */
  environment: string;
  deployments: MicroserviceDeployment[];
  topics: MicroserviceTopic[];
  flows: MicroserviceFlow[];
}
