import { describe, it, expect, vi } from "vitest";
import { parseCertCallbackHash, runCertCallback } from "./cert-callback";

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

describe("runCertCallback", () => {
  it("completes login and reports ok when token is present and completeCertLogin resolves", async () => {
    const stripFragment = vi.fn();
    const completeCertLogin = vi.fn().mockResolvedValue(undefined);

    const outcome = await runCertCallback({
      hash: "#token=aaa.bbb.ccc",
      stripFragment,
      completeCertLogin,
    });

    expect(outcome).toEqual({ ok: true });
    expect(stripFragment).toHaveBeenCalledTimes(1);
    expect(completeCertLogin).toHaveBeenCalledTimes(1);
    expect(completeCertLogin).toHaveBeenCalledWith("aaa.bbb.ccc");
  });

  it("reports login_failed when token is present but completeCertLogin rejects", async () => {
    const stripFragment = vi.fn();
    const completeCertLogin = vi.fn().mockRejectedValue(new Error("boom"));

    const outcome = await runCertCallback({
      hash: "#token=aaa.bbb.ccc",
      stripFragment,
      completeCertLogin,
    });

    expect(outcome).toEqual({ ok: false, error: "login_failed" });
    expect(stripFragment).toHaveBeenCalledTimes(1);
  });

  it("reports the error code from the hash without calling completeCertLogin", async () => {
    const stripFragment = vi.fn();
    const completeCertLogin = vi.fn();

    const outcome = await runCertCallback({
      hash: "#error=cert_invalid",
      stripFragment,
      completeCertLogin,
    });

    expect(outcome).toEqual({ ok: false, error: "cert_invalid" });
    expect(completeCertLogin).not.toHaveBeenCalled();
    expect(stripFragment).toHaveBeenCalledTimes(1);
  });

  it("reports missing_token for an empty hash without calling completeCertLogin", async () => {
    const stripFragment = vi.fn();
    const completeCertLogin = vi.fn();

    const outcome = await runCertCallback({
      hash: "",
      stripFragment,
      completeCertLogin,
    });

    expect(outcome).toEqual({ ok: false, error: "missing_token" });
    expect(completeCertLogin).not.toHaveBeenCalled();
  });
});
