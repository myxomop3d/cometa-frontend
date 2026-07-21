# User Self-Registration — Design Spec

**Date:** 2026-07-21
**Branch:** `feature/gm`
**Repos:** frontend `F:\programming\react\cometa-frontend` (remote `origin`), backend `F:\programming\cometa` (remote `github`)

## Goal

Let an unauthenticated user register from the login page: a **Register** button opens a
registration form; on submit the backend atomically creates a user account, creates-or-updates
the associated person, and (optionally) links that person to a team; the user is then redirected
to the login page.

## Scope

Coordinated backend + frontend. The DB schema and JPA entities already exist (`person`, `team`,
`person_team_link`, migrated `user_account` with `sigma_login` + `person_id`). Everything above
the persistence layer is new.

**Approach:** Full Person & Team CRUD controllers on the existing `EntityGraphBaseCrud*` pattern
(as `Flow` uses), plus a bespoke registration orchestrator under `/auth`. The team combobox reuses
the Flow server-side combobox pattern (OData `$top` + `$filter`).

## Agreed decisions

| Decision | Value |
| --- | --- |
| Default role for new accounts | `developer` (lowest real role; `role_id` is NOT NULL) |
| Account activation | `is_active = true` — user can log in immediately |
| Password policy | minimum 8 characters; confirmation must match |
| Accounts per person | **exactly one** — enforced at DB (unique index) + service (409) |
| sigmaLogin format | exactly 8 digits (`/^\d{8}$/`) |
| Team selection | optional; default "Not selected" → no `person_team_link` created |

## Security surface

Registration happens pre-auth, so `SecurityConfig` must `permitAll` on exactly these:

- `POST /api/v1/auth/register`
- `GET  /api/v1/auth/check-sigma-login`
- `GET  /api/v1/auth/person-by-email`
- `GET  /api/v1/team` (read only — combobox list)

Person CRUD stays **authenticated** (the autofill uses the dedicated `/auth/person-by-email`, so
generic person reads need not be public). Person/Team **writes** remain guarded by the base
`@PreAuthorize(CREATE/UPDATE/DELETE)` — anonymous callers can only read the team list.

**Accepted trade-off:** the public team list lets anonymous callers enumerate teams, and
`person-by-email`/`check-sigma-login` are unauthenticated existence probes. Acceptable for an
internal self-service tool behind cluster ingress; can be hardened later (rate-limit / captcha).

---

## Backend

Package root `ru.sberbank.cib.gmbus`. Entities in `cometa-persistence-module`, services/DTOs in
`cometa-service-module`, controllers in `cometa-web-module` (`web/api/v1`). API base path is
`/api/${application.api.version}` → `/api/v1`.

### Person CRUD (mirror Flow)

- `service/dto/PersonDto.java` — `extends BaseEntityDto { String email; String lastName;
  String firstName; String middleName; }` (flat — the `teams` M2M is intentionally omitted).
- `repository/PersonCrudRepository.java` — `@Repository public class PersonCrudRepository
  extends EntityGraphBaseCrudRepository<Person, Long> {}`.
- `service/mapper/PersonMapper.java` — `@Mapper(...) public interface PersonMapper
  extends BaseCrudMapper<Person, PersonDto> {}`.
- `service/PersonService.java` — `@Service public class PersonService
  extends EntityGraphBaseCrudService<Person, PersonDto, Long> {}` (empty, RequiredArgsConstructor
  like `FlowService`).
- `web/api/v1/PersonRestController.java` — `@RestController @RequestMapping(
  "/api/${application.api.version}/person") public class PersonRestController
  extends EntityGraphBaseCrudController<PersonDto, Long> {}` (empty body).

### Team CRUD (mirror Flow)

- `service/dto/TeamDto.java` — `extends BaseEntityDto { String name; Integer code; String type;
  Long leaderPersonId; String leaderRole; String structure; }`. `type` maps the `TeamType` enum
  to its `String` name; `leader` (a `Person`) is exposed as `leaderPersonId`.
- `repository/TeamCrudRepository.java`, `service/mapper/TeamMapper.java`,
  `service/TeamService.java`, `web/api/v1/TeamRestController.java` @ `/api/v1/team` — all mirror
  the Flow shape above.
- Combobox query: `GET /api/v1/team?$skip=0&$top=20&$filter=contains_ignoring_case(name,'<q>')`.

### Thin repositories (for registration; separate from the CRUD stack)

- `repository/PersonRepository.java` — `interface PersonRepository extends JpaRepository<Person,
  Long> { Optional<Person> findByEmail(String email); }`
- `repository/UserRoleRepository.java` — `interface UserRoleRepository extends
  JpaRepository<UserRole, Long> { Optional<UserRole> findByCode(String code); }`
- `repository/UserAccountRepository.java` (existing) — add
  `boolean existsByPerson_Id(Long personId);` (keeps `findBySigmaLogin`).

### Registration endpoints (bespoke, under `/auth`)

Added to `AuthController` (`@RequestMapping("/api/${application.api.version}/auth")`):

**`POST /api/v1/auth/register`** — body:
```json
{ "sigmaLogin": "12345678", "email": "a@b.ru", "lastName": "...", "firstName": "...",
  "middleName": "...", "password": "...", "teamId": 42 }
```
`teamId` is optional/nullable. Returns `201 Created` on success (no token — user is redirected to
login). Validation failures return the standard `AppMessage` envelope with `semantic:"E"` and a
`target` of `"sigmaLogin"` or `"email"` so the frontend can map to the right field.

**`GET /api/v1/auth/check-sigma-login?sigmaLogin=12345678`** →
`{ "exists": true|false }` (via `UserAccountRepository.findBySigmaLogin`). `user_account` is never
exposed via CRUD — accounts stay private.

**`GET /api/v1/auth/person-by-email?email=a@b.ru`** →
```json
{ "person": { "id": 1, "email": "a@b.ru", "lastName": "...", "firstName": "...",
              "middleName": "...", "insertedAt": "...", "updatedAt": "..." } | null,
  "hasAccount": true|false }
```
`person` is `null` when no person matches. `hasAccount` = `existsByPerson_Id(person.id)`.

### `RegistrationService` (`@Transactional`)

Injects `UserAccountRepository`, `PersonRepository`, `UserRoleRepository`, `PasswordEncoder`
(existing Argon2 bean), and `TeamCrudRepository`/`JpaRepository<Team,Long>` for the link.

1. If `userAccountRepository.findBySigmaLogin(sigmaLogin).isPresent()` →
   **409** message `{target:"sigmaLogin", message:"Already exists, please login"}`.
2. `person = personRepository.findByEmail(email)`:
   - present **and** `existsByPerson_Id(person.id)` →
     **409** `{target:"email", message:"This person already has an account, please login"}`.
   - present → overwrite `lastName/firstName/middleName` from the request, `save`.
   - absent → create new `Person(email, lastName, firstName, middleName)`, `save`.
3. Create `UserAccount`: `sigmaLogin`, `passwordHash = passwordEncoder.encode(password)`,
   `isActive = true`, `role = userRoleRepository.findByCode("developer").orElseThrow()`,
   `person`. `save`. (The `idx_user_account_person_id` unique index is the race backstop —
   a `DataIntegrityViolationException` here maps to the same email-target 409.)
4. If `teamId != null`: load the `Team`; if the person is not already linked, add the
   `person_team_link` (unique `(person_id, team_id)` makes a repeat a no-op).
5. Return `201`.

### DB script

`db-scripts/ddl/013_user_account_person_unique.sql`:
```sql
-- Enforce one user_account per person.
CREATE UNIQUE INDEX idx_user_account_person_id ON gmsb.user_account (person_id);
```
Executed via the project rule: create the script in `db-scripts/ddl`, then run it against the DB.

### SecurityConfig

Extend the existing `permitAll` matcher list with the four public endpoints named in
**Security surface** above. All other `/api/**` routes keep their current auth requirement.

---

## Frontend

Path alias `@/` → `src/`. Reuses the Flow combobox and the `create-crud-api`/`ApiError` stack.

### Types — `src/types/api.ts`

```ts
export interface PersonDto {
  id: number; insertedAt: string | null; updatedAt: string | null;
  email: string; lastName: string; firstName: string; middleName: string;
}
export interface TeamDto {
  id: number; insertedAt: string | null; updatedAt: string | null;
  name: string | null; code: number | null; type: string | null;
  leaderPersonId: number | null; leaderRole: string | null; structure: string | null;
}
export interface RegisterRequest {
  sigmaLogin: string; email: string; lastName: string; firstName: string;
  middleName: string; password: string; teamId: number | null;
}
export interface CheckSigmaLoginResponse { exists: boolean; }
export interface PersonByEmailResponse { person: PersonDto | null; hasAccount: boolean; }
```

### API — `src/api/auth.ts` (extend)

- `register(req: RegisterRequest): Promise<void>` → `POST /api/v1/auth/register`.
- `checkSigmaLogin(sigmaLogin: string): Promise<CheckSigmaLoginResponse>` →
  `GET /api/v1/auth/check-sigma-login?sigmaLogin=`.
- `personByEmail(email: string): Promise<PersonByEmailResponse>` →
  `GET /api/v1/auth/person-by-email?email=`.

### Team API — `src/features/team/api.ts`

Mirror `flowApi`: `teamApi.comboboxQueryOptions(search)` building
`$skip=0&$top=20&$filter=contains_ignoring_case(name,'<esc>')` against `/api/v1/team`, with
`placeholderData: keepPreviousData`. Also `teamApi.detailQueryOptions(id)` for resolving the
selected team's label when it falls outside the top-20 set.

### Team combobox — `src/features/team/components/team-combobox.tsx`

Adapted from `flow-combobox.tsx`. Adds a **"Not selected"** first option that sets `teamId = null`
and closes the popover. Renders `team.name ?? \`Team #${team.id}\`` as the primary line and
`code`/`type` as the secondary line. Props: `value: number | null`, `onChange: (id: number | null)
=> void`.

### Route — `src/routes/register.tsx`

Public route (add `/register` to the same unauthenticated allowlist as `/login`; verify the router
guard in `__root.tsx` / route `beforeLoad`). Renders `<RegisterForm />` inside the same `Card`
layout the login page uses.

### Form — `RegisterForm` (react-hook-form + zod)

**zod schema:**
```ts
const schema = z.object({
  sigmaLogin: z.string().regex(/^\d{8}$/, "SIGMA login must be exactly 8 digits"),
  email: z.string().email("Enter a valid email"),
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().min(1, "Middle name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  passwordConfirm: z.string(),
  teamId: z.number().nullable(),
}).refine((v) => v.password === v.passwordConfirm, {
  path: ["passwordConfirm"], message: "Passwords must match",
});
```

**Fields (all required except Team):** Sigma login, Email, Last name, First name, Middle name,
Password, Password confirmation, Team (combobox, default "Not selected").

**On-blur async checks:**
- **sigmaLogin blur:** if the value matches `/^\d{8}$/`, call `checkSigmaLogin`. If `exists` →
  `setError("sigmaLogin", { message: "Already exists, please login" })`.
- **email blur:** if the value is a valid email, call `personByEmail`.
  - `hasAccount` → `setError("email", { message: "This person already has an account, please
    login" })`.
  - else if `person` → fill `lastName/firstName/middleName` **only where the field is currently
    empty** (never overwrite user input).

**Submit:** `register(payload)` with `teamId` sent as `null` when "Not selected". On success:
`toast.success("Account created")` + `navigate({ to: "/login" })` (prefill the login `sigmaLogin`
— minor UX touch). On `ApiError`: map each `AppMessage` by `target` to `sigmaLogin`/`email`;
anything else → a root-level form error.

**Return button:** `navigate({ to: "/login" })`.

### Login page — `src/routes/login.tsx`

Add an outline **Register** button below the existing buttons → `navigate({ to: "/register" })`.

---

## Error handling & edge cases

- **sigmaLogin race** (check passes, insert collides on the unique index) → 409 → mapped to the
  sigmaLogin field.
- **Existing person already has an account** → hard reject: 409 + `idx_user_account_person_id`
  backstop; surfaced inline on email blur and again at submit.
- **Team already linked to person** → no-op (unique `(person_id, team_id)`).
- **Team `name` is null** → combobox shows `Team #{id}`.

## Testing

**Backend (`RegistrationService` unit tests):**
- new person created + account created (no team);
- existing person → names updated from form + account created;
- with `teamId` → `person_team_link` created;
- sigmaLogin already taken → 409 (`target: sigmaLogin`);
- email's person already has an account → 409 (`target: email`);
- `check-sigma-login` returns correct `exists`.

**Frontend:**
- zod schema tests: 8-digit sigmaLogin rule, email validity, password min-8, password-match refine;
- `auth` API mapping tests (`personByEmail` 404 → `person: null`);
- testing-library: email blur autofills only empty name fields; email blur with `hasAccount` shows
  the inline error; sigmaLogin blur with `exists` shows the inline error.
