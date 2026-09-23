import type { ApiResponse, MicroserviceNameAggrDto } from "@/types/api";

export const ENVIRONMENTS = ["IFT", "UAT", "PROD"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** One `tc: artifact - version` line. `""` means unset; render with dash(). */
export interface Deployment {
  tc: string;
  artifact: string;
  version: string;
}

export type DeploymentsByEnv = Record<Environment, Deployment[]>;

export interface MicroserviceAtRow extends MicroserviceNameAggrDto {
  deployments: DeploymentsByEnv;
}

function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Deployments of one microservice, per environment. Grouped by
 * `node.environment` — the node is the source of truth, even though
 * `techComponent.environment` agrees on every link today. Environments other
 * than IFT/UAT/PROD (e.g. DEV) are dropped.
 */
export function toDeployments(
  row: Pick<MicroserviceNameAggrDto, "nodes">,
): DeploymentsByEnv {
  const result: DeploymentsByEnv = { IFT: [], UAT: [], PROD: [] };
  for (const node of row.nodes ?? []) {
    if (!isEnvironment(node.environment)) continue;
    for (const link of node.techComponentLinks ?? []) {
      result[node.environment].push({
        tc: link.techComponent?.name ?? "",
        artifact: link.data?.artifactId ?? "",
        version: link.data?.version ?? "",
      });
    }
  }
  for (const env of ENVIRONMENTS) {
    result[env].sort(
      (a, b) => a.tc.localeCompare(b.tc) || a.artifact.localeCompare(b.artifact),
    );
  }
  return result;
}

export function toMicroserviceAtRow(dto: MicroserviceNameAggrDto): MicroserviceAtRow {
  return { ...dto, deployments: toDeployments(dto) };
}

/** Cached page with one row's `isNeedAT` replaced — for the optimistic toggle. */
export function setNeedAT(
  page: ApiResponse<MicroserviceNameAggrDto[]>,
  id: number,
  isNeedAT: boolean,
): ApiResponse<MicroserviceNameAggrDto[]> {
  return {
    ...page,
    data: page.data.map((row) =>
      row.id === id ? { ...row, data: { ...row.data, isNeedAT } } : row,
    ),
  };
}
