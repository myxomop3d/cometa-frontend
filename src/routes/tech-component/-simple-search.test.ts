import { describe, it, expect } from "vitest";
import { validateTechComponentSimpleFields } from "./-simple-search";

describe("validateTechComponentSimpleFields", () => {
  it("keeps valid simple filters", () => {
    expect(
      validateTechComponentSimpleFields({
        name: "k8s",
        groupName: "Kafka",
        technology: "KAFKA",
        environment: "PROD,UAT",
        automatedSystemId: "0",
      }),
    ).toEqual({
      name: "k8s",
      groupName: "Kafka",
      technology: "KAFKA",
      environment: ["PROD", "UAT"],
      automatedSystemId: 0,
    });
  });

  it("drops values of the wrong type", () => {
    expect(
      validateTechComponentSimpleFields({ name: 5, automatedSystemId: "abc" }),
    ).toEqual({
      name: undefined,
      groupName: undefined,
      technology: undefined,
      environment: undefined,
      automatedSystemId: undefined,
    });
  });
});
