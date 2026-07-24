# Authentication

How authentication works in the Cometa frontend.

## Model at a glance

- **Stateless JWT bearer tokens.** After a successful login the backend issues a
  JWT. The frontend stores it in `localStorage` under the key
  **`cometa-auth-token`** and attaches it as `Authorization: Bearer <jwt>` to
  every same-origin `/api` request.
- **Two ways to authenticate:**
  1. **Password** — `sigmaLogin` + `password`, a normal `POST /api/v1/auth/login`.
  2. **Client certificate (mTLS)** — a redirect handoff through a separate mTLS
     gateway that returns the JWT in a URL fragment. See
     [Certificate login](#certificate-login-two-gateway-handoff).
- **No refresh tokens.** A token lives until it expires (backend `jwt.expiration-ms`,
  default 24h) or the user signs out. An expired/invalid token is detected on the
  next `/api` call and the user is bounced to `/login`.
- **Client-side only.** This is a static SPA (TanStack Router, no SSR). All auth
  logic runs in the browser; the backend enforces authorization.

## File map

| File | Responsibility |
| --- | --- |
| `src/main.tsx` | Global `fetch` interceptor: attaches the bearer token, handles 401/403. |
| `src/lib/auth/auth-context.tsx` | `AuthProvider` / `useAuth` — token + user state, `login`/`logout`/`handleCertLogin`/`completeCertLogin`, mount-time validation. |
| `src/api/auth.ts` | Auth API calls: `login`, `getMe`, `startCertLogin`, `register`, `checkSigmaLogin`, `personByEmail`. |
| `src/lib/auth/mtls-origin.ts` | `deriveMtlsOrigin` — derive the mTLS gateway origin from the current host. |
| `src/lib/auth/cert-callback.ts` | `parseCertCallbackHash`, `runCertCallback` — pure callback-fragment logic. |
| `src/routes/__root.tsx` | Route guard (`beforeLoad`) + auth-page chrome suppression. |
| `src/routes/login.tsx` | Login page (password form + certificate button + register link). |
| `src/routes/register.tsx` | Registration page. |
| `src/routes/auth.cert.callback.tsx` | Landing route for the certificate redirect (`/auth/cert/callback`). |
| `src/routes/forbidden.tsx` | 403 page. |
| `src/lib/api/create-crud-api.ts` | `apiFetch` + `ApiError` (shared HTTP layer used by the auth calls). |
| `src/features/register/*` | Registration schema + form→request mapping + error-field mapping. |
| `src/mocks/handlers/auth.ts` | MSW mock handlers for `/auth/login` and `/auth/me`. |

## Token storage and the fetch interceptor

`src/main.tsx` monkey-patches `window.fetch` **once at bootstrap**, before React
renders. Every request flows through this wrapper:

1. **Attach the token.** If the request is a **same-origin** URL whose path starts
   with `/api` (`isApiRequest`), and a token exists in `localStorage`, the wrapper
   adds `Authorization: Bearer <token>` — unless the caller already set an
   `Authorization` header. The same-origin check ensures the token is **never
   leaked to third-party / absolute URLs**.
2. **Handle auth failures on the response:**
   - **401** on an `/api` request → clear the stored token and redirect to
     `/login`. This is skipped for the auth endpoints (`isAuthLoginRequest`
     matches `…/auth/login` and any `…/api/v1/auth/cert*` path) and when already on
     `/login` or `/auth/cert/callback`, so credential failures surface inline on
     the form/callback instead of triggering a global redirect loop.
   - **403** → redirect to `/forbidden`, except for the auth endpoints (so an
     invalid-credentials 403 shows on the login form) and when already on
     `/forbidden`.

Because this is a `fetch` wrapper, it applies uniformly to TanStack Query, the
`apiFetch` helper, and any direct `fetch` call.

## Auth state: `AuthProvider` / `useAuth`

`src/lib/auth/auth-context.tsx` holds the reactive auth state and is mounted in
`src/routes/__root.tsx` (wrapping the whole app).

State:

- `token: string | null` — mirror of `localStorage["cometa-auth-token"]`.
- `user: UserProfile | null` — `{ sigmaLogin, authorities }` from `GET /me`.
- `isLoading: boolean` — true until the mount-time validation resolves.
- `isAuthenticated: boolean` — `!!token && !!user`.

Methods:

- `login(data)` — password login (see below).
- `handleCertLogin()` — **synchronous**; triggers the certificate redirect (the
  page navigates away, so it returns `void`, not a promise).
- `completeCertLogin(token)` — finishes the certificate flow after the redirect
  returns (see below).
- `logout()` — clears the token + user and navigates to `/login`.

**Mount-time validation.** On first mount, if a token exists in `localStorage`,
the provider calls `getMe()`. On success it sets `user`; on failure it clears the
token/user (the stored token was stale). This is what makes a page refresh
"self-heal" a bad token.

## Route protection

Guarding happens in `src/routes/__root.tsx`:

- **`beforeLoad`** runs for every navigation. If there is **no token** in
  `localStorage` and the target path is not one of the public routes
  (`/login`, `/register`, `/forbidden`, `/auth/cert/callback`), it throws a
  redirect to `/login`. Note this checks only for the *presence* of a token, not
  its validity — validity is enforced by the backend on the next `/api` call and
  by the mount-time `getMe`.
- **`isAuthPage`** — the same public paths render without the sidebar/app chrome
  (bare centered layout for login/register/forbidden/callback).
- `/auth/cert/callback` **must** be in both lists: it is reached with **no token
  yet** (the token arrives in the URL fragment), so without the `beforeLoad`
  allow-list entry the callback would be bounced to `/login` before it could run.

## Password login

1. `src/routes/login.tsx` renders a `react-hook-form` + `zod` form
   (`sigmaLogin` min 8, `password` required).
2. On submit → `useAuth().login(data)` → `src/api/auth.ts#login` →
   `POST /api/v1/auth/login` with `{ sigmaLogin, password }`.
3. The response is `{ token }` (`LoginResponse`). `AuthProvider.login` stores the
   token, then calls `getMe()` to load the profile, then navigates to
   `/automated-system`.
4. On error, `login.tsx` maps a `401`/`403` `ApiError` to "Invalid login or
   password." and shows it inline (the interceptor deliberately does not redirect
   for the login endpoint).

## Certificate login (two-gateway handoff)

The deployment terminates TLS at **two Istio gateways** distinguished by hostname:

- `cometa-dev.tls.…` — **tls** gateway, server-TLS only. Serves the SPA and the
  API. Never asks the browser for a client certificate (so password users are
  never prompted).
- `cometa-dev.mtls.…` — **mtls** gateway, mutual TLS. Requires a client cert and
  forwards it to the backend as the `X-Forwarded-Client-Cert` (XFCC) header.
  Exposes only the cert-start endpoint.

**Why a handoff is needed:** a browser only presents a client certificate during
the TLS handshake **to the host that requested it**. The SPA lives on the tls
host, so the cert-authenticated request must physically go to the mtls host, and
the resulting JWT must be handed back to the tls host.

```
① SPA (tls host) — user clicks "Sign in by certificate"  →  startCertLogin()
        │  full-page navigation
        ▼
② GET https://<mtls-host>/api/v1/auth/cert/start
        │  browser presents client cert → mtls gateway verifies vs CA,
        │  injects X-Forwarded-Client-Cert
        ▼
③ Backend (mtls): reads XFCC → CN → sigmaLogin → mints JWT
        │  302 redirect
        ▼
④ https://<tls-host>/auth/cert/callback#token=<JWT>
        │  SPA reads location.hash, strips it (history.replaceState), stores token
        ▼
⑤ GET /api/v1/auth/me (tls host, Bearer JWT) → profile → /automated-system
```

After ④ a certificate user is **indistinguishable from a password user**: a JWT
in `localStorage`, all `/api` traffic over the tls gateway. The mtls host is
touched exactly once.

### Step-by-step in the frontend

- **`startCertLogin()`** (`src/api/auth.ts`) — triggered by the "Sign in by
  certificate" button. It computes the mtls origin and does a full-page
  navigation to `<mtls-origin>/api/v1/auth/cert/start`.
  - **mtls origin derivation** (`src/lib/auth/mtls-origin.ts#deriveMtlsOrigin`):
    the mtls host is derived from the current host by convention, replacing the
    `tls.` label with `mtls.` (`…tls.…` → `…mtls.…`). An explicit override
    `window.__ENV__?.MTLS_ORIGIN` takes precedence if present. This keeps the
    build free of any hard-coded backend URL.
  - **Mock mode:** when `import.meta.env.VITE_MOCK_API === "true"`, MSW cannot
    intercept a cross-origin full-page navigation, so `startCertLogin`
    short-circuits and navigates directly to
    `/auth/cert/callback#token=mock-jwt-token`.
- **`/auth/cert/callback`** (`src/routes/auth.cert.callback.tsx`) — the landing
  route. On mount (guarded by a `useRef` against React StrictMode double-invoke)
  it calls `runCertCallback`.
- **`runCertCallback`** (`src/lib/auth/cert-callback.ts`) — the pure orchestration
  (React/router-free, unit-tested):
  1. `parseCertCallbackHash(hash)` → `{ token }` on `#token=…`, `{ error }` on
     `#error=…`, `{ error: "missing_token" }` otherwise.
  2. **Strips the fragment unconditionally** via `history.replaceState(null, "",
     pathname)` — so the JWT does not linger in the URL/history, on every path
     including errors.
  3. On `token`, `await completeCertLogin(token)` → `{ ok: true }`; on rejection
     `{ ok: false, error: "login_failed" }`. On a parse error, returns that error.
- **`completeCertLogin(token)`** (`src/lib/auth/auth-context.tsx`) — stores the
  token, calls `getMe()`, sets the user, and navigates to `/automated-system`.
  **If `getMe()` fails, it clears the token/user and rethrows** (so a bad token
  isn't left in `localStorage`); the callback then shows an error.
- **Error UI:** the callback maps `cert_invalid` to "…Make sure your client
  certificate is installed…" and anything else to a generic message, with a
  "Back to login" button.

### Deployment note (forged-XFCC protection)

The backend trusts the XFCC header on `/api/v1/auth/cert/start` (the gateway is
responsible for verifying the certificate). Because the tls gateway does **not**
sanitize inbound XFCC and routes `/api/*` to the backend, the tls VirtualService
(`deploy/k8s/virtualservice-tls.yaml`) has a **`block-cert-start`** rule — ordered
**before** the `/api` rule — that redirects `/api/v1/auth/cert/start` to the mtls
host so a forged `X-Forwarded-Client-Cert` on the tls host can never reach the
backend and mint a token. Legitimate cert login is unaffected because
`startCertLogin` navigates straight to the mtls host.

## Registration

`src/routes/register.tsx` + `src/features/register/*`:

- Form (`registerFormSchema`): 8-digit `sigmaLogin`, email, last/first/middle
  name, password (min 8) + confirmation, optional `teamId` (via `TeamCombobox`).
- **On-blur helpers** (non-blocking, best-effort):
  - `checkSigmaLogin(sigmaLogin)` → `GET /api/v1/auth/check-sigma-login` — flags an
    already-taken login.
  - `personByEmail(email)` → `GET /api/v1/auth/person-by-email` — if the person
    already has an account, flags it; otherwise auto-fills their name fields.
- On submit → `register(registerFormToRequest(data))` →
  `POST /api/v1/auth/register`. Server-side conflicts come back as an
  `ApiError` whose `messages[]` are mapped to specific fields by
  `registerErrorFields` (`target` → form field, `null` → root). On success it
  toasts and navigates to `/login`. Registration does **not** log the user in.

## API layer and error envelope

- **`apiFetch<T>`** (`src/lib/api/create-crud-api.ts`) is the shared HTTP helper.
  It parses JSON (skipping empty/`204` bodies) and, on a non-OK response, throws
  an **`ApiError`** carrying `status` and the backend `messages: AppMessage[]`
  (first `semantic: "E"` message becomes the error text).
- Auth responses come in two shapes:
  - **Raw** for `login` (`{ token }`) and `me` (`{ sigmaLogin, authorities }`).
  - **Envelope** (`{ messages: AppMessage[] }`) for error/validation responses,
    which `ApiError` unpacks and the forms map to fields.

## Backend contract

| Endpoint | Method | Host | Purpose |
| --- | --- | --- | --- |
| `/api/v1/auth/login` | POST | tls | Password login → `{ token }`. |
| `/api/v1/auth/me` | GET | tls | Current profile → `{ sigmaLogin, authorities }` (Bearer required). |
| `/api/v1/auth/cert/start` | GET | **mtls** | Reads XFCC, mints JWT, `302 …/auth/cert/callback#token=<jwt>` (or `#error=cert_invalid`). |
| `/api/v1/auth/register` | POST | tls | Create account+person. |
| `/api/v1/auth/check-sigma-login` | GET | tls | `{ exists }`. |
| `/api/v1/auth/person-by-email` | GET | tls | `{ person, hasAccount }`. |

In dev, `/api` is proxied to `http://localhost:8080` (`vite.config.ts`). In
production, Istio routes `/api` to the backend.

## Mock mode

`VITE_MOCK_API=true npm run dev -- --host` starts MSW (`src/mocks/`).
`src/mocks/handlers/auth.ts` accepts any credentials for `/auth/login` (returns
`mock-jwt-token`) and returns a fixed profile (`sigmaLogin 99000001`,
`ROLE_DEVELOPER`) for `/auth/me`. Certificate login is exercised via the
`startCertLogin` short-circuit described above — no MSW handler is needed for
`/auth/cert/start`.

## Testing

- **Unit (Vitest):** `deriveMtlsOrigin` (`src/lib/auth/mtls-origin.test.ts`) and
  `parseCertCallbackHash` + `runCertCallback` (`src/lib/auth/cert-callback.test.ts`)
  are pure and fully covered (parse branches, fragment-strip on every path, login
  success/failure).
- **E2E (Playwright):** `e2e/cert-login.spec.ts` drives the mock cert-login flow
  end-to-end (`login → cert button → authenticated /automated-system`, fragment
  stripped) and the `#error=cert_invalid` callback error path. Run with
  `npm run test:e2e`.

## Security notes

- The JWT briefly appears in the URL fragment on the certificate callback; it is
  stripped immediately with `history.replaceState`. Fragments are never sent in
  the `Referer` header or to the server, so gateway/nginx access logs never see
  the token.
- The token is stored in `localStorage` (readable by JS) — the same exposure as
  the password path. Keep the backend JWT TTL modest.
- The bearer token is attached only to **same-origin `/api`** requests; it is
  never sent to absolute/third-party URLs.
- The backend does not verify the certificate itself — the mtls gateway does. The
  `block-cert-start` VirtualService rule is what prevents forged-XFCC
  impersonation on the tls host.
