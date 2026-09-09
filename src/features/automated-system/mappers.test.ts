import { describe, it, expect } from "vitest";
import type { AutomatedSystemDto } from "@/types/api";
import {
  automatedSystemDtoToForm,
  automatedSystemFormToCreate,
  automatedSystemFormToPatch,
} from "./mappers";
import { automatedSystemFormSchema, type AutomatedSystemFormValues } from "./schema";

const dto: AutomatedSystemDto = {
  id: 1451,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  name: "Aspect",
  objectCode: "aspect",
  fullName: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  ci: "CI01776490",
  nameHpsm: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  leaderComment: "Берестов Р. В. (801690)",
  leaderSapId: "",
  block: "Финансы",
  tribe: "Digital Accounting",
  cluster: "Департамент финансов (115147)",
  clusterHpsmId: "",
  status: "Находится в эксплуатации",
  iftMailSupport: "",
  uatMailSupport: "",
  prodMailSupport: "",
  guid: "",
  leader: {
    id: 99,
    insertedAt: null,
    updatedAt: null,
    email: "berestov@example.com",
    lastName: "Берестов",
    firstName: "Роман",
    middleName: "Владимирович",
  },
};

const form: AutomatedSystemFormValues = {
  name: "Aspect",
  objectCode: "aspect",
  fullName: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  ci: "CI01776490",
  nameHpsm: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  leaderId: 99,
  leaderComment: "Берестов Р. В. (801690)",
  leaderSapId: "",
  block: "Финансы",
  tribe: "Digital Accounting",
  cluster: "Департамент финансов (115147)",
  clusterHpsmId: "",
  status: "Находится в эксплуатации",
  iftMailSupport: "",
  uatMailSupport: "",
  prodMailSupport: "",
  guid: "",
};

describe("automatedSystemDtoToForm", () => {
  it("lifts leaderId out of the nested leader ref", () => {
    expect(automatedSystemDtoToForm(dto)).toEqual(form);
  });

  it("yields leaderId 0 when leader is absent, so the form flags it required", () => {
    // Happens on any read that omitted $fields=leader.
    const bare: AutomatedSystemDto = { ...dto, leader: null };
    expect(automatedSystemDtoToForm(bare).leaderId).toBe(0);
  });

  it("still copes with a null from a server that predates the migration", () => {
    const legacy = { ...dto, leaderSapId: null } as unknown as AutomatedSystemDto;
    expect(automatedSystemDtoToForm(legacy).leaderSapId).toBe("");
  });
});

describe("automatedSystemFormSchema", () => {
  it("trims a whitespace-only value to '' so it is not a third empty spelling", () => {
    const parsed = automatedSystemFormSchema.parse({ ...form, block: "   " });
    expect(parsed.block).toBe("");
  });
});

describe("automatedSystemFormToCreate", () => {
  it("writes the leader as a ref, not a scalar, and keeps leaderComment separate", () => {
    const payload = automatedSystemFormToCreate(form);
    expect(payload.leader).toEqual({ id: 99 });
    expect(payload.leaderComment).toBe("Берестов Р. В. (801690)");
    expect(payload.name).toBe("Aspect");
  });
});

describe("automatedSystemFormToPatch", () => {
  it("returns only dirty fields, with the leader as a ref", () => {
    expect(automatedSystemFormToPatch(form, { leaderId: true })).toEqual({
      leader: { id: 99 },
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(automatedSystemFormToPatch(form, {})).toEqual({});
  });

  it("emits '' for a cleared field, never null", () => {
    // "" is the only spelling the server acts on: null means "leave unchanged"
    // (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
    // Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
    const cleared: AutomatedSystemFormValues = { ...form, leaderComment: "" };
    expect(automatedSystemFormToPatch(cleared, { leaderComment: true })).toEqual({
      leaderComment: "",
    });
  });

  it("never emits leaderComment when only the relation changed", () => {
    const patch = automatedSystemFormToPatch(form, { leaderId: true });
    expect(patch).not.toHaveProperty("leaderComment");
  });
});
