import { describe, it, expect } from "vitest";
import { deriveMtlsOrigin } from "./mtls-origin";

describe("deriveMtlsOrigin", () => {
  it("swaps the .tls. label for .mtls.", () => {
    expect(
      deriveMtlsOrigin("https:", "cometa-dev.tls.apps.a3klq48m.k8s.delta.sbrf.ru"),
    ).toBe("https://cometa-dev.mtls.apps.a3klq48m.k8s.delta.sbrf.ru");
  });

  it("swaps a leading tls. label", () => {
    expect(deriveMtlsOrigin("https:", "tls.example.com")).toBe(
      "https://mtls.example.com",
    );
  });

  it("uses the override when provided, trimming a trailing slash", () => {
    expect(
      deriveMtlsOrigin("https:", "x.tls.y", "https://custom.example/"),
    ).toBe("https://custom.example");
  });

  it("leaves a host without a tls. label unchanged", () => {
    expect(deriveMtlsOrigin("http:", "localhost:5173")).toBe(
      "http://localhost:5173",
    );
  });
});
