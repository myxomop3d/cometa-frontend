/**
 * Derive the mTLS gateway origin from the current tls-host origin by convention
 * (…tls.… → …mtls.…). An explicit override (window.__ENV__.MTLS_ORIGIN) wins.
 */
export function deriveMtlsOrigin(
  protocol: string,
  host: string,
  override?: string,
): string {
  if (override) return override.replace(/\/$/, "");
  return `${protocol}//${host.replace(/(^|\.)tls\./, "$1mtls.")}`;
}
