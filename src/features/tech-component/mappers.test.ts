import { describe, it, expect } from "vitest";
import type { TechComponentDto } from "@/types/api";
import {
  techComponentDtoToForm,
  techComponentFormToCreate,
  techComponentFormToPatch,
} from "./mappers";
import { techComponentFormSchema, type TechComponentFormValues } from "./schema";

const dto: TechComponentDto = {
  id: 3,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  groupName: "k8s Sigma GMSB",
  name: "k8s-sigma-gmsb",
  technology: "KUBERNETES",
  environment: "PROD",
  consoleUrl: "https://console.example",
  infoUrl: "",
  automatedSystem: {
    id: 582,
    insertedAt: null,
    updatedAt: null,
    name: "GMSB",
    objectCode: "",
    fullName: "",
    ci: "",
    nameHpsm: "",
    leaderComment: "",
    leaderSapId: "",
    block: "",
    tribe: "",
    cluster: "",
    clusterHpsmId: "",
    status: "",
    iftMailSupport: "",
    uatMailSupport: "",
    prodMailSupport: "",
    guid: "",
  },
};

const form: TechComponentFormValues = {
  groupName: "k8s Sigma GMSB",
  name: "k8s-sigma-gmsb",
  technology: "KUBERNETES",
  environment: "PROD",
  automatedSystemId: 582,
  consoleUrl: "https://console.example",
  infoUrl: "",
};

describe("techComponentDtoToForm", () => {
  it("lifts automatedSystemId out of the nested ref", () => {
    expect(techComponentDtoToForm(dto)).toEqual(form);
  });

  it("keeps the not-set sentinel (id 0)", () => {
    const notSet = { ...dto, automatedSystem: { ...dto.automatedSystem!, id: 0 } };
    expect(techComponentDtoToForm(notSet).automatedSystemId).toBe(0);
  });

  it("yields undefined when automatedSystem was not read", () => {
    expect(techComponentDtoToForm({ ...dto, automatedSystem: null }).automatedSystemId)
      .toBeUndefined();
  });
});

describe("techComponentFormSchema", () => {
  it("requires name, group, environment and an automated system", () => {
    const r = techComponentFormSchema.safeParse({
      ...form,
      name: "",
      groupName: "",
      environment: undefined,
      automatedSystemId: undefined,
    });
    expect(r.success).toBe(false);
    const byPath = Object.fromEntries(
      (r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]),
    );
    expect(byPath).toEqual({
      name: "Name is required",
      groupName: "Group is required",
      environment: "Environment is required",
      automatedSystemId: "Automated system is required",
    });
  });

  it("accepts automated system 0, the not-set sentinel", () => {
    expect(techComponentFormSchema.safeParse({ ...form, automatedSystemId: 0 }).success)
      .toBe(true);
  });

  it("trims whitespace-only optional text to ''", () => {
    expect(techComponentFormSchema.parse({ ...form, technology: "   " }).technology).toBe("");
  });

  it("does not validate URL format (free-text column)", () => {
    expect(techComponentFormSchema.safeParse({ ...form, infoUrl: "not a url" }).success)
      .toBe(true);
  });
});

describe("techComponentFormToCreate", () => {
  it("sends every field, the automated system as a ref", () => {
    expect(techComponentFormToCreate(form)).toEqual({
      groupName: "k8s Sigma GMSB",
      name: "k8s-sigma-gmsb",
      technology: "KUBERNETES",
      environment: "PROD",
      consoleUrl: "https://console.example",
      infoUrl: "",
      automatedSystem: { id: 582 },
    });
  });
});

describe("techComponentFormToPatch", () => {
  it("returns only dirty fields, with the automated system as a ref", () => {
    expect(techComponentFormToPatch(form, { automatedSystemId: true })).toEqual({
      automatedSystem: { id: 582 },
    });
  });

  it("writes the not-set sentinel as { id: 0 }", () => {
    expect(
      techComponentFormToPatch({ ...form, automatedSystemId: 0 }, { automatedSystemId: true }),
    ).toEqual({ automatedSystem: { id: 0 } });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(techComponentFormToPatch(form, {})).toEqual({});
  });

  it("emits '' for a cleared field, never null", () => {
    expect(
      techComponentFormToPatch({ ...form, consoleUrl: "" }, { consoleUrl: true }),
    ).toEqual({ consoleUrl: "" });
  });
});
