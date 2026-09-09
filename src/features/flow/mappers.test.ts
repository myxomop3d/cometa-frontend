import { describe, it, expect } from "vitest";
import type { FlowDto } from "@/types/api";
import { flowDtoToForm, flowFormToCreate, flowFormToPatch } from "./mappers";
import type { FlowFormValues } from "./schema";

const baseDto: FlowDto = {
  id: 2,
  insertedAt: null,
  updatedAt: null,
  key: "quikpao.non trade orders",
  caption: "Поток Non Trade Orders из Quik PAO",
  integrity: "I_2",
  confidentiality: "K_3",
  secretClass: "",
  dataClass: "Client Data",
  dataType: "Non Trade Orders",
  description: "",
};

const baseForm: FlowFormValues = {
  key: "quikpao.non trade orders",
  caption: "Поток Non Trade Orders из Quik PAO",
  integrity: "I_2",
  confidentiality: "K_3",
  secretClass: "",
  dataClass: "Client Data",
  dataType: "Non Trade Orders",
  description: "",
};

describe("flowDtoToForm", () => {
  it("maps a populated DTO to form values", () => {
    expect(flowDtoToForm(baseDto)).toEqual(baseForm);
  });

  it("preserves empty-string integrity and confidentiality, never emitting null", () => {
    const dto: FlowDto = { ...baseDto, integrity: "", confidentiality: "" };
    const form = flowDtoToForm(dto);
    expect(form.integrity).toBe("");
    expect(form.confidentiality).toBe("");
  });
});

describe("flowFormToCreate", () => {
  it("produces a write payload matching all form fields", () => {
    const payload = flowFormToCreate(baseForm);
    expect(payload).toEqual({
      key: "quikpao.non trade orders",
      caption: "Поток Non Trade Orders из Quik PAO",
      integrity: "I_2",
      confidentiality: "K_3",
      secretClass: "",
      dataClass: "Client Data",
      dataType: "Non Trade Orders",
      description: "",
    });
  });
});

describe("flowFormToPatch", () => {
  it("returns {} when nothing is dirty", () => {
    expect(flowFormToPatch(baseForm, {})).toEqual({});
  });

  it("emits only the dirty scalar field", () => {
    const patch = flowFormToPatch(baseForm, { key: true });
    expect(patch).toEqual({ key: "quikpao.non trade orders" });
  });

  it("combines multiple dirty fields", () => {
    const patch = flowFormToPatch(baseForm, {
      caption: true,
      integrity: true,
    });
    expect(patch).toEqual({
      caption: "Поток Non Trade Orders из Quik PAO",
      integrity: "I_2",
    });
  });
});
