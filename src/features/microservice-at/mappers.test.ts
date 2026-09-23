import { describe, expect, it } from "vitest";
import type { AggrNodeDto, ApiResponse, MicroserviceNameAggrDto } from "@/types/api";
import { setNeedAT, toDeployments, toMicroserviceAtRow } from "./mappers";

function node(
  environment: string,
  links: { tc?: string; tcEnv?: string; artifactId?: string; version?: string }[],
): AggrNodeDto {
  return {
    id: Math.floor(Math.random() * 1e6),
    name: "svc",
    environment,
    techComponentLinks: links.map((l, i) => ({
      id: i,
      techComponent:
        l.tc === undefined
          ? null
          : { id: i, name: l.tc, environment: l.tcEnv ?? environment },
      data: { artifactId: l.artifactId, version: l.version },
    })),
  };
}

function aggr(nodes: AggrNodeDto[] | null, isNeedAT = true, id = 1): MicroserviceNameAggrDto {
  return { id, name: "svc", nodeAggrType: "MICROSERVICE_NAME_AGGR", data: { isNeedAT }, nodes };
}

describe("toDeployments", () => {
  it("groups by node.environment", () => {
    const result = toDeployments(
      aggr([
        node("IFT", [{ tc: "ift-k8s-bk1", artifactId: "a", version: "1" }]),
        node("UAT", [
          { tc: "psi-k8s-bk2", artifactId: "a", version: "1" },
          { tc: "psi-k8s-bk1", artifactId: "a", version: "1" },
        ]),
      ]),
    );
    expect(result.IFT).toEqual([{ tc: "ift-k8s-bk1", artifact: "a", version: "1" }]);
    expect(result.UAT.map((d) => d.tc)).toEqual(["psi-k8s-bk1", "psi-k8s-bk2"]);
    expect(result.PROD).toEqual([]);
  });

  it("uses node.environment when the tech component disagrees", () => {
    const result = toDeployments(
      aggr([node("UAT", [{ tc: "x", tcEnv: "PROD", artifactId: "a", version: "1" }])]),
    );
    expect(result.UAT).toHaveLength(1);
    expect(result.PROD).toEqual([]);
  });

  it("drops environments other than IFT/UAT/PROD", () => {
    const result = toDeployments(aggr([node("DEV", [{ tc: "x", artifactId: "a", version: "1" }])]));
    expect(result).toEqual({ IFT: [], UAT: [], PROD: [] });
  });

  it("maps missing techComponent, artifactId and version to empty strings", () => {
    const result = toDeployments(aggr([node("IFT", [{}])]));
    expect(result.IFT).toEqual([{ tc: "", artifact: "", version: "" }]);
  });

  it("maps a null link data to empty strings", () => {
    const n = node("IFT", [{ tc: "x" }]);
    n.techComponentLinks![0]!.data = null;
    expect(toDeployments(aggr([n])).IFT).toEqual([{ tc: "x", artifact: "", version: "" }]);
  });

  it("sorts by tc, then artifact", () => {
    const result = toDeployments(
      aggr([
        node("IFT", [
          { tc: "b", artifactId: "z", version: "1" },
          { tc: "a", artifactId: "y", version: "1" },
          { tc: "b", artifactId: "x", version: "1" },
        ]),
      ]),
    );
    expect(result.IFT.map((d) => `${d.tc}/${d.artifact}`)).toEqual(["a/y", "b/x", "b/z"]);
  });

  it("returns all three environments empty for an aggregator without nodes", () => {
    expect(toDeployments(aggr(null))).toEqual({ IFT: [], UAT: [], PROD: [] });
    expect(toDeployments(aggr([]))).toEqual({ IFT: [], UAT: [], PROD: [] });
  });
});

describe("toMicroserviceAtRow", () => {
  it("keeps the DTO fields and adds deployments", () => {
    const dto = aggr([node("IFT", [{ tc: "t", artifactId: "a", version: "1" }])]);
    const row = toMicroserviceAtRow(dto);
    expect(row.id).toBe(dto.id);
    expect(row.data).toEqual({ isNeedAT: true });
    expect(row.deployments.IFT).toHaveLength(1);
  });
});

describe("setNeedAT", () => {
  const page: ApiResponse<MicroserviceNameAggrDto[]> = {
    count: 2,
    messages: [],
    data: [aggr([], true, 1), aggr([], true, 2)],
  };

  it("changes only the matching row, immutably", () => {
    const next = setNeedAT(page, 2, false);
    expect(next.data[0]).toBe(page.data[0]);
    expect(next.data[1]!.data).toEqual({ isNeedAT: false });
    expect(page.data[1]!.data).toEqual({ isNeedAT: true });
    expect(next.count).toBe(2);
  });

  it("creates data when the row had none", () => {
    const nullData: ApiResponse<MicroserviceNameAggrDto[]> = {
      ...page,
      data: [{ ...aggr([], true, 7), data: null }],
    };
    expect(setNeedAT(nullData, 7, true).data[0]!.data).toEqual({ isNeedAT: true });
  });
});
