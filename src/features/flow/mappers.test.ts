import { describe, it, expect } from "vitest";
import type { FlowDto } from "@/types/api";
import { flowDtoToForm, flowFormToCreate, flowFormToPatch } from "./mappers";
import type { FlowFormValues } from "./schema";

const baseDto: FlowDto = {
  id: 2,
  code: "quikpao.non trade orders",
  caption: "Поток Non Trade Orders из Quik PAO",
  integrity: "I_2",
  confidentiality: "K_3",
  dataClass: "Client Data",
  dataType: "Non Trade Orders",
  state: "ACTUAL",
  descriptionMd: null,
};

const baseForm: FlowFormValues = {
  code: "quikpao.non trade orders",
  caption: "Поток Non Trade Orders из Quik PAO",
  integrity: "I_2",
  confidentiality: "K_3",
  dataClass: "Client Data",
  dataType: "Non Trade Orders",
  state: "ACTUAL",
  descriptionMd: null,
};

describe("flowDtoToForm", () => {
  it("maps a populated DTO to form values", () => {
    expect(flowDtoToForm(baseDto)).toEqual(baseForm);
  });

  it("preserves null integrity and confidentiality", () => {
    const dto: FlowDto = { ...baseDto, integrity: null, confidentiality: null };
    const form = flowDtoToForm(dto);
    expect(form.integrity).toBeNull();
    expect(form.confidentiality).toBeNull();
  });
});

describe("flowFormToCreate", () => {
  it("produces a write payload matching all form fields", () => {
    const payload = flowFormToCreate(baseForm);
    expect(payload).toEqual({
      code: "quikpao.non trade orders",
      caption: "Поток Non Trade Orders из Quik PAO",
      integrity: "I_2",
      confidentiality: "K_3",
      dataClass: "Client Data",
      dataType: "Non Trade Orders",
      state: "ACTUAL",
      descriptionMd: null,
    });
  });
});

describe("flowFormToPatch", () => {
  it("returns {} when nothing is dirty", () => {
    expect(flowFormToPatch(baseForm, {})).toEqual({});
  });

  it("emits only the dirty scalar field", () => {
    const patch = flowFormToPatch(baseForm, { code: true });
    expect(patch).toEqual({ code: "quikpao.non trade orders" });
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
