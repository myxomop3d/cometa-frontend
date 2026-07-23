import { describe, it, expect } from "vitest";
import { parseCertCallbackHash } from "./cert-callback";

describe("parseCertCallbackHash", () => {
  it("extracts a token", () => {
    expect(parseCertCallbackHash("#token=aaa.bbb.ccc")).toEqual({
      token: "aaa.bbb.ccc",
    });
  });

  it("extracts an error code", () => {
    expect(parseCertCallbackHash("#error=cert_invalid")).toEqual({
      error: "cert_invalid",
    });
  });

  it("reports missing_token for an empty hash", () => {
    expect(parseCertCallbackHash("")).toEqual({ error: "missing_token" });
  });

  it("reports missing_token when token is present but empty", () => {
    expect(parseCertCallbackHash("#token=")).toEqual({ error: "missing_token" });
  });
});
