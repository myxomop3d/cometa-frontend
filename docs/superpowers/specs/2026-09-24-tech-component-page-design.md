# Tech Components page + "not set" sentinel rows — design

Date: 2026-09-24
Repos: `cometa` (DDL 021, `TechComponent` mapping, mapper tests) and `cometa-frontend`
Status: implemented on feature/gm 2026-09-24

## Goal

A table page, **Tech Components**, over `gmsb.tech_component`, with the same
feature set as Automated Systems: switchable simple/advanced filtering, sorting,
pagination, and a Sheet for create / edit, including choosing the
component's Automated System. Deleting a Tech Component is out of scope.

The sheet is the first form to write `tech_component.automated_system_id`, one
of the four nullable FKs the no-null standard left for later
(`2026-09-09-no-null-write-standard-design.md` §4.2, §11). This design resolves
it the way that standard prescribes: a sentinel "not set" row, and the FK
becomes `NOT NULL`. Because a sentinel `automated_system` row needs a leader,
the existing de-facto sentinel person (`nobody@sberbank.ru`, id 284 today) is
formalised as person id `0` in the same migration.

## Scope

In:

- DDL 021: person sentinel re-keyed to id 0, automated-system sentinel id 0,
  `tech_component.automated_system_id` backfilled and made `NOT NULL`,
  delete guard on both sentinels.
- Backend: `TechComponent.automatedSystem` mapped `optional = false`; mapper tests.
- Frontend: forms stop using `0` as their "nothing picked" value (AS, Team);
  new Tech Components page; new Automated System combobox and relation-picker
  source.

Out:

- Hiding sentinels. They are ordinary rows everywhere — tables, pickers,
  relation filters, cells. No exclusion filter, no special rendering.
- The other nullable FKs (`principal`, `profile`, `node` → `automated_system_id`,
  `automated_system.client_certificate_id`). They adopt the sentinel when a form
  first needs them.
- A server-side default to the sentinel when `automatedSystem` is absent on POST.

## Facts established live (2026-09-24)

- `tech_component`: 30 rows; 8 distinct `group_name`, technologies
  `KAFKA | KUBERNETES | OPENSHIFT` plus `''`, environments `IFT | UAT | PROD`
  (enum also has `DEV`). 27 rows have an automated system, 3 are `NULL`.
  `console_url` non-empty on 7 rows, `info_url` on 2. Unique `(name, environment)`.
- `person` id range 30–284, `automated_system` 582–783: id `0` is free in both.
  All three tables use `id int8 GENERATED ALWAYS AS IDENTITY`, so an explicit id
  needs `OVERRIDING SYSTEM VALUE`. Each has the `set_timestamps` trigger, which
  owns `inserted_at`/`updated_at`.
- Person 284: `Doe`, `John`, `Иванович`, `nobody@sberbank.ru`. Referenced by
  `automated_system.leader_person_id` ×102 and `team.leader_person_id` ×19;
  `user_account` ×0, `person_team_link` ×0.
- `person.email` has a **unique index** (`idx_person_email`).
- All four FKs into `person` are `NO ACTION` on update and delete — the id
  cannot be changed in place; referencing rows must be moved.
- `automated_system.leader_person_id` is `NOT NULL`; every other
  `automated_system` column except `name` defaults to `''`.

## The sentinel rule

**Id `0` is the "not set" row of any table that is the target of a to-one
relation.** It is created, by migration, when a form first needs to express
"not set" for that relation; the FK then becomes `NOT NULL`. It is an ordinary
row: readable, pickable, renamable, displayed like any other. It cannot be
deleted (trigger). Writing "not set" means writing `{ "id": 0 }` — no new
spelling on the wire, no special casing in `BaseRefMapper`.

This closes the §11 follow-up "Sentinel 'not set' rows for to-one relations"
of the no-null standard, and the open question in
`2026-08-27-nested-relation-write-standard-design.md` §7 ("Known hole: a nullable to-one cannot be cleared") on clearing a nullable
to-one relation.

## DDL — `cometa/db-scripts/ddl/021_not_set_sentinels.sql`

Applied as `as_admin`, one transaction, `\set ON_ERROR_STOP on`. Idempotent:
a second run is a no-op.

**Person sentinel** (a `DO` block):

1. `v_old := id of person WHERE email = 'nobody@sberbank.ru'`, or `0` when no
   such row exists (the unique index guarantees at most one).
2. If `v_old = 0`:
   - if person 0 exists → nothing to do (re-run);
   - otherwise insert person 0 with the literal values below; skip 3–5.
3. Free the email: `UPDATE person SET email = 'nobody@sberbank.ru#rekey-' || v_old
   WHERE id = v_old`. Insert
   `person (id, last_name, first_name, middle_name, email) OVERRIDING SYSTEM VALUE
   VALUES (0, 'Doe', 'John', 'Иванович', 'nobody@sberbank.ru')` — the values
   row 284 holds today, as literals so the no-row branch of step 2 uses the
   same ones. Timestamps come from `set_timestamps`.
4. Repoint every FK from `v_old` to `0`: `automated_system.leader_person_id`,
   `team.leader_person_id`, `user_account.person_id`,
   `person_team_link.person_id`.
5. `DELETE FROM person WHERE id = v_old` (`v_old` ≠ 0 here). Before it, assert
   no row still references `v_old`; `RAISE EXCEPTION` otherwise, aborting the
   transaction.

**Automated-system sentinel:**

6. `INSERT INTO automated_system (id, name, leader_person_id) OVERRIDING SYSTEM VALUE
   VALUES (0, 'Not set', 0) ON CONFLICT (id) DO NOTHING`. All other columns
   take their `''` defaults.
7. `UPDATE tech_component SET automated_system_id = 0 WHERE automated_system_id IS NULL`
   (3 rows), then `ALTER TABLE tech_component ALTER COLUMN automated_system_id SET NOT NULL`.
   Update the column `COMMENT` to state the sentinel.

**Guard:**

8. `gmsb.forbid_sentinel_delete()` — `BEFORE DELETE ... FOR EACH ROW`, raises
   when `OLD.id = 0`. Attached to `person` and `automated_system` with
   `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`; function via
   `CREATE OR REPLACE`. Ownership/grants per the template's closing block.

## Backend — `cometa`

- `TechComponent.automatedSystem`:
  `@ManyToOne(fetch = LAZY, optional = false)` +
  `@JoinColumn(name = "automated_system_id", nullable = false)`, with the same
  comment `AutomatedSystem.leader` carries. The "(опционально)" javadoc goes.
- `TechComponentDto.automatedSystem` javadoc: required; `{ "id": 0 }` means
  "not set"; a POST without it fails on the `NOT NULL` FK, exactly like
  `AutomatedSystem` without `leader`.
- No change to the controller, service, `@Condition isEntityLoaded`, or
  `BaseRefMapper`. The sentinel is read and written as any row.
- Tests:
  - `TechComponentMapperWriteTest`: `{id: 0}` → reference with id 0; absent →
    unchanged on PATCH; `{}` → `IllegalArgumentException`.
  - `TechComponentMapperReadTest`: an initialised AS 0 maps to a FlatDto with
    id 0 and name `Not set`.
- After the build, verify every `*MapperImpl` (known MapStruct corruption).

## Frontend — form "nothing picked" value leaves `0`

Today the AS and Team sheets seed `leaderId: 0` and reject it with
`positive("Leader is required")`. After DDL 021, `0` is a real person that
121 rows reference, so those rows would become unsaveable.

- AS and Team schemas: `leaderId: z.number({ error: "Leader is required" }).int().nonnegative()`.
- "Nothing picked" is `undefined`: `dtoToForm` uses `dto.leader?.id` (no
  `?? 0`), `defaultValues` drops `leaderId: 0`. The form-values type keeps
  `leaderId: number`; defaults are a `Partial`/`DefaultValues`.
- Update the comments in `src/features/team/api.ts` and the AS/Team mapper
  tests that describe "yields `leaderId: 0` → missing leader".
- Leaders stay **required**; picking `Doe John` (person 0) is how a user says
  "no leader".

## Frontend — Tech Components page

### `src/types/api.ts`

`TechComponentFlatDto` (`id`, `groupName`, `name`, `technology`,
`environment: "PROD" | "UAT" | "IFT" | "DEV"`, `consoleUrl`, `infoUrl`),
`TechComponentDto extends TechComponentFlatDto` with
`automatedSystem?: AutomatedSystemFlatDto | null`, and `TechComponentFilters`.
The trimmed `techComponent` shape inside `NodeTechComponentLinkDto` is untouched.

### `src/features/tech-component/`

- `api.ts` — `createCrudApi` with `basePath: "/api/v1/tech-component"`,
  `listPath: "/api/v1/tech-component/graph"`,
  `staticParams: { "$fields": "automatedSystem" }`, `queryKey: ["tech-components"]`;
  `detailQueryOptions` overridden onto `graph/{id}?$fields=automatedSystem`
  (same reason as AS: `/{id}` ignores `$fields`).
- `advanced-api.ts` — field map: `name`, `groupName`, `technology` (text),
  `environment` (select), `consoleUrl`, `infoUrl` (text),
  `automatedSystem` (relation, `automatedSystem/id`).
- `filter-descriptors.ts`:

  | id | variant | field / sortField | URL key |
  |---|---|---|---|
  | `name` | text | | `name` |
  | `groupName` | text | | `groupName` |
  | `technology` | text | | `technology` |
  | `environment` | select | | `environment` |
  | `automatedSystem` | relation | `automatedSystem/id` / `automatedSystem/name` | `automatedSystemId` |

  `groupName` and `technology` stay free text: small distinct-value counts,
  but unbounded in principle (the block/tribe/cluster precedent). URL keys are
  permanent — never rename.
- `columns.tsx` — select, id, Name, Group, Technology, Environment,
  Automated System (label = AS `name`), Console URL, Info URL, actions.
  URL cells render an external link (`target="_blank" rel="noreferrer"`), or
  `dash()` when empty. Console/Info URL hidden by default. Pinning
  `left: ["select", "id"]`, `right: ["actions"]`. Environment filter options
  are the four enum members.
- `schema.ts` — `name`, `groupName`: `z.string().min(1)`; `environment`:
  `z.enum([...4])`; `automatedSystemId`: required `nonnegative()` int,
  `undefined` when unpicked; `technology`, `consoleUrl`, `infoUrl`:
  `emptyText()`. URLs are not format-validated — free-text column, and a
  stricter rule than the data would repeat the AS `ci`-length mistake.
  `TechComponentWritePayload` sends `automatedSystem: { id }`.
- `mappers.ts` — `dtoToForm`, full create payload, dirty-only PATCH payload.
  Never `null`.
- `row-action.ts`, `switchable-config.ts` (`queryKey: ["tech-components"]`,
  simple keys `name, groupName, technology, environment, automatedSystemId`).
- `components/TechComponentSheet.tsx` — modeled on `AutomatedSystemSheet`:
  create / update (no delete — out of scope), server errors via the existing toast and
  field-mapping path. The unique `(name, environment)` violation is not
  pre-checked on the client.

### Automated System pickers — `src/features/automated-system/`

Neither exists yet.

- `fetchAutomatedSystemsFiltered` + `automatedSystemsFilteredQueryOptions` —
  the `RelationPicker` source (`{ name?, ids?, page?, pageSize? }` contract,
  modeled on `fetchPersonsFiltered`), with picker columns Name and CI.
- `components/AutomatedSystemCombobox.tsx` — modeled on `PersonCombobox`:
  server-side `$top=20`, `contains_ignoring_case(name, …)`.

### Route and sidebar

- `src/routes/tech-component/index.tsx` + `-simple-search.ts`, the AS route's
  structure (`makeSwitchableSearch` inline, `makeSwitchableLoader`,
  `useSwitchableTablePage`, "Add Tech Component" button, sheet).
  No unsortable-column guard needed (no `guid`-like column).
- Sidebar: `{ to: "/tech-component", label: "Tech Components", icon: Server }`
  after Teams.

## Error handling

- Sentinel delete → trigger error. No page offers delete today; the guard is
  the database's, for API or SQL callers.
- Duplicate `(name, environment)` → DB unique violation → error toast.
- POST without `automatedSystem` cannot come from the sheet (field required).

## Testing

- `tech-component`: `filter-descriptors.test.ts`, `mappers.test.ts`
  (dirty-only PATCH, no `null`, `{ id: 0 }` round-trips),
  `-simple-search.test.ts`.
- AS and Team: schema accepts `leaderId: 0` and rejects `undefined`;
  `dtoToForm` of a leader-0 row yields `0`.
- Backend mapper tests above.
- DDL: run twice on the dev DB; after the first run assert person 0 exists,
  no row references the old id, 121 leaders point at 0, `tech_component` has no
  `NULL` FK, and `DELETE ... WHERE id = 0` fails on both tables.
- Manual (`npm run dev -- --host`, test account): filter by each column, sort
  by Automated System, create / edit, pick `Not set`; save an AS and a
  Team whose leader is `Doe John`.
- `tsc -b`, `npm run lint`, `npm run build`.

## Known gaps / future work

- Other nullable FKs adopt id-0 sentinels when a form first needs them.
- No "not set" shortcut in pickers — the sentinel is found by its name.

## Related

- `2026-09-09-no-null-write-standard-design.md` (§4.2, §11)
- `2026-08-27-nested-relation-write-standard-design.md` (§7, "Known hole")
- `2026-09-04-automated-system-leader-relation-design.md`
- `2026-08-26-odata-relation-filter-sort-design.md`
