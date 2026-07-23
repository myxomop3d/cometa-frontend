export type CertCallbackResult = { token: string } | { error: string };

/**
 * Parse the URL fragment the mtls backend redirected with:
 *   #token=<jwt>   → { token }
 *   #error=<code>  → { error }
 *   anything else  → { error: "missing_token" }
 */
export function parseCertCallbackHash(hash: string): CertCallbackResult {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("token");
  if (token) return { token };
  const error = params.get("error");
  return { error: error ?? "missing_token" };
}

export type CertCallbackOutcome = { ok: true } | { ok: false; error: string };

/**
 * Orchestrates the cert callback: parse the fragment, strip it from the URL,
 * then complete login or report an error. Pure of React/router so it is
 * unit-testable. Always strips the fragment (even on error) before returning.
 */
export async function runCertCallback(args: {
  hash: string;
  stripFragment: () => void;
  completeCertLogin: (token: string) => Promise<void>;
}): Promise<CertCallbackOutcome> {
  const result = parseCertCallbackHash(args.hash);
  args.stripFragment();
  if ("token" in result) {
    try {
      await args.completeCertLogin(result.token);
      return { ok: true };
    } catch {
      return { ok: false, error: "login_failed" };
    }
  }
  return { ok: false, error: result.error };
}
