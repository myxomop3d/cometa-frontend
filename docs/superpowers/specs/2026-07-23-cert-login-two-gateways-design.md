# Certificate login over two Istio gateways — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)
**Repos:** `cometa-frontend` (React SPA), `cometa` (Spring Boot backend)

## Problem

Users authenticate two ways:

- **Password** — normal TLS.
- **Client certificate (mTLS)** — the browser must present a client cert, which
  Envoy verifies against the CA and forwards to the backend as the
  `X-Forwarded-Client-Cert` (XFCC) header.

The deployment uses **two separate Istio gateways on the same ingressgateway**,
distinguished by SNI/hostname:

- `cometa-dev.tls.apps.a3klq48m.k8s.delta.sbrf.ru` — `tls` gateway, `mode: SIMPLE`.
  Serves the SPA and the full API. Never asks for a client cert (so password
  users are never prompted for one).
- `cometa-dev.mtls.apps.a3klq48m.k8s.delta.sbrf.ru` — `mtls` gateway,
  `mode: MUTUAL`. Requires a client cert. Exposes only the cert-start endpoint.

**Core constraint:** a browser only presents a client cert during the TLS
handshake to the host that requested it. The SPA lives on the `tls` host, so the
cert-authenticated request must physically go to the `mtls` host, and the
resulting session must be handed back to the `tls` host.

The existing implementation assumed a single host where an "nginx proxy" injected
XFCC. That assumption is invalid under two gateways and the current cert path is
half-wired (the filter returns the token in an `X-Auth-Token` header while the
frontend reads it from the response body, and `AuthController.login()` still runs
password auth on an empty body). This design replaces it.

## Decisions (locked)

1. **Session host after cert login: `tls` gateway (handoff).** The cert is used
   once at the `mtls` host to prove identity; the session then runs on the `tls`
   host with a normal JWT. Cert users are indistinguishable from password users
   afterward. The `mtls` host is touched exactly once per login.
2. **Token return: JWT in URL fragment.** The `mtls` backend `302`-redirects to
   the `tls` callback with `#token=<JWT>`. No server-side code store. Mitigations:
   modest JWT TTL, `history.replaceState` strips the fragment immediately on
   arrival. (Accepted trade-off: the JWT briefly appears in browser history.)
3. **Cert → user mapping: unchanged.** The mTLS gateway performs cryptographic
   verification against the CA. The backend trusts the **CN** and maps it to
   `sigma_login` via `loadUserByCertificateCn` → `findBySigmaLogin`. No
   cert-registry binding. (`ClientCertificate` entity is unrelated — it belongs to
   `AutomatedSystem`.)
4. **Callback URL is fixed in backend config**, not taken from a `redirect_uri`
   query param. Eliminates open-redirect risk for the single-tls-host deployment.
   (Future multi-tls-host would switch to an allowlist.)
5. **Cert-start endpoint path: `GET /api/v1/auth/cert/start`.**

## Flow

```
① SPA (tls host) — user clicks "Sign in by certificate"
        │  full-page redirect
        ▼
② GET https://<mtls-host>/api/v1/auth/cert/start
        │  browser presents client cert → mTLS gateway verifies vs CA,
        │  injects X-Forwarded-Client-Cert
        ▼
③ Backend (mtls): MtlsAuthenticationFilter reads XFCC → CN → sigmaLogin →
        UserAccount + roles → JwtService.generateToken()
        │  302 redirect to configured callback URL
        ▼
④ https://<tls-host>/auth/cert/callback#token=<JWT>
        │  SPA reads location.hash, stores token, history.replaceState to strip
        ▼
⑤ GET /api/v1/auth/me (tls host, Bearer JWT) → profile → into the app
```

On failure (no cert / unknown CN) step ③ redirects to
`…/auth/cert/callback#error=<reason>` instead.

## Work breakdown

### Backend (`cometa`)

- **B1. New endpoint `GET /api/v1/auth/cert/start`** in `AuthController`. No body.
  Relies on `MtlsAuthenticationFilter` having authenticated the request. Reads the
  resulting `Authentication`, generates the JWT via `JwtService`, returns
  `302 Location: <configured-callback-url>#token=<JWT>`. If the request is not
  authenticated (no/invalid cert, unknown CN), returns
  `302 Location: <configured-callback-url>#error=cert_invalid`.
- **B2. `MtlsAuthenticationFilter`** — change `shouldNotFilter` from
  `endsWith("/auth/login")` to match the new `/api/v1/auth/cert/start` path.
  Remove the `response.setHeader("X-Auth-Token", token)` behavior (the controller
  now owns token issuance and the redirect). The filter's job narrows to:
  read XFCC → CN → load user → set `Authentication` in the `SecurityContext`.
- **B3. `AuthController.login()`** — remains password-only. No behavioral change
  needed beyond confirming it no longer doubles as the cert path.
- **B4. Config** — add `application.auth.cert.callback-url` property (per
  environment; the `tls` host callback: `https://<tls-host>/auth/cert/callback`).
  Inject into `AuthController`.
- **B5. JWT TTL** — confirm `JwtService` token lifetime is modest (≤ a few hours),
  consistent with the fragment-return choice. Adjust if currently long-lived.
- **B6. SecurityConfig** — `/api/v1/auth/**` is already `permitAll`, which covers
  `/auth/cert/start`. Verify filter ordering still has mTLS before JWT. No CORS
  change required (the flow uses top-level redirects, not cross-origin XHR).

### Frontend (`cometa-frontend`)

- **F1. `src/api/auth.ts`** — replace `certLogin()` with `startCertLogin()`:
  computes the `mtls` origin by convention (`.tls.` → `.mtls.` in
  `window.location.host`, override via `window.__ENV__?.MTLS_ORIGIN`) and does
  `window.location.href = "<mtls-origin>/api/v1/auth/cert/start"`. Delete the old
  same-origin POST version.
- **F2. `src/lib/auth/auth-context.tsx`** — `handleCertLogin()` just calls
  `startCertLogin()` (navigates away, no token yet). Add `completeCertLogin(token)`
  that stores the token, calls `getMe()`, sets user, navigates to the app. Add
  `completeCertLogin` to `AuthContextValue`.
- **F3. New route `src/routes/auth.cert.callback.tsx`** — on mount, parse
  `location.hash` for `token` or `error`. On `token`: call `completeCertLogin`,
  then `history.replaceState` to strip the fragment. On `error` or missing token:
  show an inline error with a back-to-login button. Guard against StrictMode
  double-invoke.
- **F4. `src/main.tsx`** — add `/auth/cert/callback` to the paths the fetch
  interceptor treats like `/login` (so a `/me` 401 during callback surfaces on the
  page instead of triggering a redirect loop). No exchange endpoint exists, so no
  other interceptor change.
- **F5. `src/routes/login.tsx`** — `onCertLogin` drops the try/catch (it navigates
  away). Optionally disable the button while redirecting.
- **F6. `src/mocks/handlers/auth.ts`** — mock `GET /api/v1/auth/cert/start` to
  redirect (or, since MSW can't cross origins, resolve the flow in-app) to the
  callback with a fake token, so cert login is exercisable under
  `VITE_MOCK_API=true`.

### Infra (`cometa-frontend/deploy/k8s`)

- **I1. `Dockerfile`, `nginx.conf`, `.dockerignore`** — done (multi-stage node
  build → non-root nginx-unprivileged on :8080; SPA fallback; immutable asset
  caching; no TLS in nginx since Istio terminates it).
- **I2. `deployment.yaml`, `service.yaml`** — done (2 replicas, non-root,
  read-only rootfs + tmpfs mounts, probes, named `http` port for the sidecar).
- **I3. `gateway-tls.yaml`** — `mode: SIMPLE`, `tls` host. Done.
- **I4. `gateway-mtls.yaml`** — `mode: MUTUAL`, `mtls` host, + EnvoyFilter that
  sets `forward_client_cert_details: SANITIZE_SET` with the full cert in XFCC.
  Done (skip the EnvoyFilter if the gateway already forwards XFCC).
- **I5. `virtualservice-tls.yaml`** — `/api` → backend, `/` → frontend SPA. Remove
  any `/auth/cert/exchange` reference (no exchange in the fragment approach).
- **I6. `virtualservice-mtls.yaml`** — expose **only** prefix
  `/api/v1/auth/cert/start` → backend; bounce everything else (`302`) to the `tls`
  host. Update the prefix from `/api/v1/auth/cert` to `/api/v1/auth/cert/start`.

## Error handling

- No cert / unknown CN at `mtls` → `302 …/callback#error=cert_invalid` → SPA shows
  "Certificate sign-in failed. Make sure your client certificate is installed" with
  a back-to-login button.
- Stray traffic on the `mtls` host → bounced to the `tls` host by
  `virtualservice-mtls.yaml`.
- Expired/invalid JWT later → existing interceptor behavior (clear token, redirect
  to `/login`) — unchanged.

## Testing

- **Backend unit/MockMvc:** `/auth/cert/start` with a stubbed XFCC header →
  `302` with `#token=`; no header → `302` with `#error=`; unknown CN → `#error=`.
  Verify the redirect host equals the configured callback URL. Verify the JWT
  carries the user's roles.
- **Frontend unit:** mtls-origin derivation (`.tls.`→`.mtls.`, override);
  callback hash parsing (token / error / missing).
- **Frontend manual (MSW):** click "Sign in by certificate" under
  `VITE_MOCK_API=true` → lands authenticated.
- **Cluster smoke test:** cert picker appears only on the `mtls` host; password
  users never prompted; a cert user ends authenticated on the `tls` host with a
  working `/me`; the fragment is stripped from the URL after landing.

## Out of scope

- Cert-registry / fingerprint binding (CN-trust model retained).
- Multi-tls-host allowlist for the callback URL (single host assumed).
- Any change to password login, registration, or the JWT/`/me` contract beyond
  TTL confirmation.
- Runtime `env.js` config injection (mtls origin is derived by convention; the
  `window.__ENV__` override hook is provided but the injection machinery is not
  built here).
