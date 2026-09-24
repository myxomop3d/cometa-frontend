# Server errors surface as a bare "Request failed: 500" toast

Found 2026-09-24 during the end-to-end check of the Tech Components page
(`docs/superpowers/specs/2026-09-24-tech-component-page-design.md`, frontend
`5728d0d..6cde942`, backend `f39c315..2f5ad07` on `feature/gm`). Not caused by
that change — it only made the path easy to hit. To be taken up in its own
session.

## Problem

Creating a Tech Component whose `(name, environment)` pair already exists
fails correctly — the sheet stays open, no row is written — but the user sees
only:

> Request failed: 500

Nothing says *what* failed or which field to change. The same toast appears
for every server-side failure on every sheet (Automated System, Team, Person,
Flow, Tech Component), so a duplicate key, an FK violation, a malformed ref and
a genuine crash are indistinguishable to the user.

## Reproduce

1. Tech Components → Add Tech Component.
2. Enter the `name` and `environment` of an existing row (the DB enforces
   `tech_component_uq UNIQUE (name, environment)`), fill the rest, Create.
3. Toast: `Request failed: 500`.

## Why

**Backend.** There is no `@ControllerAdvice` / `@ExceptionHandler` anywhere in
`cometa` (the only `@ExceptionHandler` is local to `AuthController`). A
`DataIntegrityViolationException` from the unique constraint therefore escapes
as Spring's default 500 with no `ApiResponse` envelope and no `messages`. The
same gap is already recorded, for malformed relation refs, in
`issue/relationWriteStandardFollowUps.md` ("A malformed ref surfaces as a 500,
not a 4xx … fixing it properly means introducing global exception handling").

**Frontend.** `apiFetch` (`src/lib/api/create-crud-api.ts:39-41`) builds the
error from the first `semantic: "E"` message in the envelope and falls back to
`` `Request failed: ${res.status}` `` when there is none. The sheets' `onError`
then shows `err.message`, and their `applyServerErrors` can only map a message
to a field when the message carries a `target` — which the backend never sets
today. So the frontend is already wired to show a readable, field-targeted
message; the backend just never sends one.

## Options (decision open)

- **A. Backend-wide exception handling (generalized standard).** One
  `@RestControllerAdvice` that returns the normal `ApiResponse` envelope with
  an `E` message for known failure classes:
  - unique violation → 409, message naming the conflicting fields, `target`
    set to the first column of the constraint so the sheet highlights it;
  - FK violation / nonexistent ref id → 409 or 422;
  - `IllegalArgumentException` from `BaseRefMapper` (ref without id) → 400;
  - anything else → 500 with a generic but enveloped message (log the cause
    server-side, never leak it).
  Needs a way to map a constraint name (e.g. `tech_component_uq`) to fields and
  a human message — a small registry, or parse the PostgreSQL detail.
  Fixes every sheet at once and closes the item in
  `issue/relationWriteStandardFollowUps.md`.
- **B. Frontend-only fallback text.** Map status codes to friendlier generic
  text in `apiFetch` ("Conflict with an existing record", "Server error — try
  again"). Cheap, but cannot say *which* field, and a 500 stays ambiguous.
- **C. Both.** A as the real fix, B as the fallback for errors the handler does
  not classify.

Leaning A (+ the B fallback), in line with preferring codebase-wide mechanisms
over per-page fixes — but that is for the session that takes this up to decide.

## Acceptance

- Duplicate `(name, environment)` on Tech Components shows a message that names
  the conflict, with the Name (or Environment) field highlighted.
- A duplicate/FK failure on the other sheets is equally readable.
- An unclassified server error still shows a generic toast, never a raw stack
  trace or SQL detail.
- Existing `applyServerErrors` field mapping is exercised by at least one test.

## Related

- `issue/relationWriteStandardFollowUps.md` — "A malformed ref surfaces as a
  500" (same missing global handler).
- `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md` §11 —
  "Global exception handling, still deferred".
- `issue/microserviceDataUnknownKeys500.md` — another un-enveloped 500, on a
  read path.
