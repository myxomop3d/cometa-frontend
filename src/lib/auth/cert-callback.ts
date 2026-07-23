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
