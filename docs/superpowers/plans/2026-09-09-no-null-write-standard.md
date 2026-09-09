# No-Null Write Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every editable optional field clearable by having the frontend send `""` instead of `null`, and make that a schema invariant rather than a convention.

**Architecture:** The backend's `NullValuePropertyMappingStrategy.IGNORE` already means "absent = unchanged, value = set". Rather than teaching the wire to express `null`, the client stops sending it: every type carries its own empty value. The frontend changes first (so it never sends a `null` into a column that is about to become `NOT NULL`), then a migration backfills and locks 33 columns.

**Tech Stack:** React 19 / TypeScript 5.9 / Vite 8 / zod / vitest (frontend, `F:\programming\react\cometa-frontend`); Java 17 / Spring Boot 4 / MapStruct / Hibernate / PostgreSQL (backend, `F:\programming\cometa`). Both repos on branch `feature/gm`.

**Spec:** `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md`

## Global Constraints

- **Type-check with `npx tsc -b`, never `npx tsc --noEmit`.** The root
  `tsconfig.json` is solution-style; the bare form silently checks nothing.
- **Run tests with `npx vitest run <path>`.** `npm test` runs the whole suite.
- **There is no migration tool.** Flyway is commented out in
  `cometa-persistence-module/pom.xml`. Migrations are hand-numbered SQL files
  in `F:\programming\cometa\db-scripts\ddl\`, applied manually. The next free
  number is `014`.
- **`ddl-auto` is off** (commented out in `application.yaml`), so Hibernate
  does not validate the schema at startup. A column/field type mismatch fails
  at query time, not at boot.
- **Task order is load-bearing.** Frontend tasks 1–3 must land before the
  migration in task 4. Sending `null` to a `NOT NULL` column on POST is a
  500; doing the frontend first means that window never exists.
- **`team.type` is deliberately excluded** from this standard. It is
  `@Enumerated(EnumType.STRING) TeamType` over a nullable text column, and
  `""` breaks *reads* — Hibernate cannot convert it back. It becomes
  required-in-the-form instead. Do not give it an `emptyText()`.
- **Do not edit `src/routeTree.gen.ts`** — it is generated.
- Commit messages: no `Co-Authored-By` trailer unless the repo's recent log
  shows one; match the surrounding style (`feat(scope):`, `fix(scope):`).

## File Structure

**Frontend** (`F:\programming\react\cometa-frontend`)

| File | Responsibility | Task |
|---|---|---|
| `src/features/automated-system/schema.ts` | `emptyText()`; payload type loses `\| null` | 1 |
| `src/features/automated-system/mappers.ts` | `dtoToForm` maps `?? ""` | 1 |
| `src/features/automated-system/mappers.test.ts` | cleared-field cases invert | 1 |
| `src/features/team/schema.ts` | `emptyText()`; `type` becomes required | 2 |
| `src/features/team/mappers.ts` | `dtoToForm` maps `?? ""` | 2 |
| `src/features/team/mappers.test.ts` | cleared-field cases invert | 2 |
| `src/lib/format.ts` | new `dash()` display helper | 3 |
| `src/lib/format.test.ts` | **create** — covers `dash()` | 3 |
| `src/features/automated-system/columns.tsx` | 16 cells use `dash()` | 3 |
| `src/features/team/columns.tsx` | cells use `dash()` | 3 |
| `src/types/api.ts` | migrated text fields become `string` | 5 |
| `src/features/team/filter-descriptors.ts` | `code` range → text | 6 |
| `src/features/team/components/TeamSheet.tsx` | `code` input becomes text | 6 |
| `issue/scalarClearIsANoOp.md` | **delete**, replaced by a pointer | 7 |
| `CLAUDE.md` | records the standard | 7 |

**Backend** (`F:\programming\cometa`)

| File | Responsibility | Task |
|---|---|---|
| `db-scripts/ddl/014_no_null_text_columns.sql` | **create** — 32 columns `NOT NULL DEFAULT ''` | 4 |
| `db-scripts/ddl/015_team_code_to_text.sql` | **create** — retype `team.code` | 6 |
| `cometa-persistence-module/.../entity/auth/Team.java` | `code` `Integer` → `String` | 6 |
| `cometa-service-module/.../service/dto/TeamFlatDto.java` | `code` `Integer` → `String` | 6 |

---

### Task 1: AutomatedSystem sends `""`, never `null`

All 15 optional fields on this sheet are plain `text` columns. This is the task that fixes the bug users actually hit.

**Files:**
- Modify: `src/features/automated-system/schema.ts`
- Modify: `src/features/automated-system/mappers.ts`
- Test: `src/features/automated-system/mappers.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `AutomatedSystemFormValues` with all 15 optional fields typed
  `string` (was `string | null`); `AutomatedSystemWritePayload` with those
  fields typed `string`. Task 5 relies on this having landed.

- [ ] **Step 1: Update the test fixtures and cleared-field cases**

In `src/features/automated-system/mappers.test.ts`, change every `null` in the
`form` fixture to `""` (the six fields `leaderSapId`, `clusterHpsmId`,
`iftMailSupport`, `uatMailSupport`, `prodMailSupport`, `guid`). Leave the `dto`
fixture's `null`s alone — the server can still return null until task 4, and
`dtoToForm` must keep coping.

Then replace the cleared-field test:

```ts
  it("emits '' for a cleared field, never null", () => {
    // "" is the only spelling the server acts on: null means "leave unchanged"
    // (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
    // Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
    const cleared: AutomatedSystemFormValues = { ...form, leaderComment: "" };
    expect(automatedSystemFormToPatch(cleared, { leaderComment: true })).toEqual({
      leaderComment: "",
    });
  });

  it("maps a null from the server to '' so the form value is always a string", () => {
    expect(automatedSystemDtoToForm(dto).leaderSapId).toBe("");
  });
```

Add to the `automatedSystemDtoToForm` describe block:

```ts
  it("trims a whitespace-only value to '' so it is not a third empty spelling", () => {
    const parsed = automatedSystemFormSchema.parse({ ...form, block: "   " });
    expect(parsed.block).toBe("");
  });
```

and add `automatedSystemFormSchema` to the import from `./schema`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/automated-system/mappers.test.ts`
Expected: FAIL — the cleared-field case gets `{leaderComment: null}`, and
`automatedSystemFormSchema` is not exported / does not trim.

- [ ] **Step 3: Replace `nullableText()` with `emptyText()`**

In `src/features/automated-system/schema.ts`, replace the helper and its
comment:

```ts
/** Every optional text field behaves the same: an emptied input sends "",
 *  never null. The server treats null as "leave this field unchanged"
 *  (MapStruct's NullValuePropertyMappingStrategy.IGNORE), so "" is the only
 *  spelling that actually clears a column. `.trim()` keeps "   " from becoming
 *  a third spelling of empty.
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();
```

Change all 15 `nullableText()` call sites in `automatedSystemFormSchema` to
`emptyText()`. Leave `name` (`z.string().min(1, ...)`) and `leaderId` alone.

Then in `AutomatedSystemWritePayload`, change the 15 optional fields from
`string | null` to `string`. `name: string` and `leader: { id: number }` are
unchanged.

- [ ] **Step 4: Map server nulls to `""` in `dtoToForm`**

In `src/features/automated-system/mappers.ts`, `automatedSystemDtoToForm`
appends `?? ""` to each of the 15 optional fields:

```ts
    objectCode: dto.objectCode ?? "",
    fullName: dto.fullName ?? "",
    ci: dto.ci ?? "",
    nameHpsm: dto.nameHpsm ?? "",
    leaderComment: dto.leaderComment ?? "",
    leaderSapId: dto.leaderSapId ?? "",
    block: dto.block ?? "",
    tribe: dto.tribe ?? "",
    cluster: dto.cluster ?? "",
    clusterHpsmId: dto.clusterHpsmId ?? "",
    status: dto.status ?? "",
    iftMailSupport: dto.iftMailSupport ?? "",
    uatMailSupport: dto.uatMailSupport ?? "",
    prodMailSupport: dto.prodMailSupport ?? "",
    guid: dto.guid ?? "",
```

`automatedSystemFormToCreate` and `automatedSystemFormToPatch` need no edits —
they pass values through, and the values are now strings.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/automated-system/mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no output (success). If `AutomatedSystemSheet.tsx` errors on
`value={field.value ?? ""}`, leave the `?? ""` in place — it is now redundant
but harmless, and removing it is not this task's job.

- [ ] **Step 7: Commit**

```bash
git add src/features/automated-system/schema.ts src/features/automated-system/mappers.ts src/features/automated-system/mappers.test.ts
git commit -m "feat(automated-system): clear a field by sending \"\", not null"
```

---

### Task 2: Team sends `""`, and `type` becomes required

Three of Team's five optional fields are plain text. `code` is deferred to task 6 (it needs a column retype). `type` is excluded permanently.

**Files:**
- Modify: `src/features/team/schema.ts`
- Modify: `src/features/team/mappers.ts`
- Test: `src/features/team/mappers.test.ts`

**Interfaces:**
- Consumes: the `emptyText()` pattern established in task 1 (copied, not
  imported — the two feature schemas are independent by convention).
- Produces: `TeamFormValues` with `name`, `leaderRole`, `structure` typed
  `string` and `type` typed `string`; `code` still `number | null` until
  task 6.

- [ ] **Step 1: Update the tests**

In `src/features/team/mappers.test.ts`, replace the cleared-field test:

```ts
  it("emits '' for a cleared field, never null", () => {
    // Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
    const cleared: TeamFormValues = { ...form, structure: "" };
    expect(teamFormToPatch(cleared, { structure: true })).toEqual({
      structure: "",
    });
  });

  it("maps a null from the server to '' so the form value is always a string", () => {
    const bare: TeamDto = { ...dto, structure: null, leaderRole: null };
    expect(teamDtoToForm(bare).structure).toBe("");
    expect(teamDtoToForm(bare).leaderRole).toBe("");
  });
```

Add a case pinning the `type` exclusion, and import the schema:

```ts
import { teamFormSchema } from "./schema";

describe("teamFormSchema", () => {
  it("refuses an empty type, which the backend cannot store", () => {
    // team.type is @Enumerated(STRING) TeamType over a nullable text column;
    // "" breaks reads, so the form must never produce one. See §4.2 of the spec.
    const result = teamFormSchema.safeParse({ ...form, type: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/team/mappers.test.ts`
Expected: FAIL — cleared field yields `null`, and an empty `type` parses fine.

- [ ] **Step 3: Rewrite the schema**

In `src/features/team/schema.ts`, replace the four inlined
`.nullable().transform(...)` blocks. `code` keeps its current shape in this
task.

```ts
/** An emptied input sends "", never null — null means "leave unchanged" on the
 *  server (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

export const teamFormSchema = z.object({
  name: emptyText(),
  code: z
    .number({ error: "Code must be a number" })
    .nullable(),
  /** NOT emptyText: team.type is @Enumerated(STRING) TeamType over a nullable
   *  text column, and "" breaks reads. Settable, never clearable — §4.2 of the
   *  spec. All 112 live rows carry a value, so requiring one blocks no row. */
  type: z.string().min(1, "Type is required"),
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderRole: emptyText(),
  structure: emptyText(),
});
```

And in `TeamWritePayload`, change `name`, `type`, `leaderRole`, `structure`
from `string | null` to `string`. `code: number | null` stays.

- [ ] **Step 4: Map server nulls to `""` in `dtoToForm`**

In `src/features/team/mappers.ts`:

```ts
export function teamDtoToForm(dto: TeamDto): TeamFormValues {
  return {
    name: dto.name ?? "",
    code: dto.code,
    type: dto.type ?? "",
    // The leader id now arrives only inside the nested ref, which is present
    // only on reads that requested $fields=leader. 0 is never a valid id, so
    // the required-positive rule in teamFormSchema rejects it.
    leaderId: dto.leader?.id ?? 0,
    leaderRole: dto.leaderRole ?? "",
    structure: dto.structure ?? "",
  };
}
```

`type: dto.type ?? ""` is deliberate: a legacy null must load into the form as
an empty Select, and the `min(1)` rule then makes the user pick before saving.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/team/mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Type-check and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/team/schema.ts src/features/team/mappers.ts src/features/team/mappers.test.ts
git commit -m "feat(team): clear a field by sending \"\"; require type"
```

---

### Task 3: A `dash()` helper so `""` renders as `—`

Sixteen cells use `?? "—"`, which renders `""` as blank. Seven live rows already hold `''` (`ci` 3, `block` 3, `leader_sap_id` 1) and render wrong today, so this fixes an existing bug as well as the ones tasks 1–2 would create.

**Files:**
- Modify: `src/lib/format.ts`
- Create: `src/lib/format.test.ts`
- Modify: `src/features/automated-system/columns.tsx`
- Modify: `src/features/team/columns.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `dash(value: string | number | null | undefined): string` exported
  from `@/lib/format`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dash } from "./format";

describe("dash", () => {
  it("renders an em dash for null and undefined", () => {
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
  });

  it("renders an em dash for the empty string, which is now how a cleared field is stored", () => {
    expect(dash("")).toBe("—");
  });

  it("passes a real value through unchanged", () => {
    expect(dash("Финансы")).toBe("Финансы");
  });

  it("does not swallow 0, which is a value and not an empty state", () => {
    expect(dash(0)).toBe("0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `dash` is not exported from `./format`.

- [ ] **Step 3: Implement `dash()`**

Append to `src/lib/format.ts`:

```ts
/** Display fallback for an empty cell. Both spellings of empty reach the UI:
 *  legacy NULLs and the "" that a cleared field now writes.
 *  Note the explicit checks — `value || "—"` would turn a real 0 into a dash. */
export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS

- [ ] **Step 5: Apply it to the AutomatedSystem columns**

In `src/features/automated-system/columns.tsx`, add `dash` to the imports from
`@/lib/format` (create the import if the file has none), then replace all 16
occurrences of

```tsx
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
```

with

```tsx
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
```

Leave the `leader` cell (`leader ? personLabel(leader) : "—"`) alone — it
handles an object, not a scalar.

- [ ] **Step 6: Apply it to the Team columns**

In `src/features/team/columns.tsx`, same import, and replace each
`cell.getValue<...>() ?? "—"` with `dash(cell.getValue<...>())`. This includes
the `code` cell (`cell.getValue<number | null>()`), which `dash` handles.

- [ ] **Step 7: Verify**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/features/automated-system/columns.tsx src/features/team/columns.tsx
git commit -m "fix(table): render \"\" as an em dash, not a blank cell"
```

---

### Task 4: Migration — 32 text columns become `NOT NULL DEFAULT ''`

Backend repo, SQL only. Do not start this until tasks 1–3 are merged and deployed: until then the frontend can still POST a `null` into a column this task makes `NOT NULL`, which is a 500.

**Files:**
- Modify: `F:\programming\cometa\cometa-service-module\src\test\java\ru\sberbank\cib\gmbus\service\mapper\AutomatedSystemMapperWriteTest.java`
- Create: `F:\programming\cometa\db-scripts\ddl\014_no_null_text_columns.sql`

**Interfaces:**
- Consumes: tasks 1–3 (the frontend no longer emits `null` for these columns).
- Produces: the schema invariant that task 5's TypeScript types assert.

- [ ] **Step 1: Pin the mapper semantics the whole standard rests on**

The premise is that `""` is written through while `null` is ignored. Prove it
against the *generated* mapper before migrating anything. Append to
`AutomatedSystemMapperWriteTest` (it already builds `AutomatedSystemMapperImpl`
directly — no Spring context, no database):

```java
    /**
     * Стандарт no-null: cometa-frontend/docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
     *   поле отсутствует / null — не менять;
     *   ""                      — очистить.
     * IGNORE делает null не-командой, поэтому "" — единственное написание,
     * которым клиент может очистить колонку.
     */
    @Test
    void emptyStringClearsAScalarWhileNullLeavesItAlone() {
        AutomatedSystem target = new AutomatedSystem();
        target.setBlock("Финансы");
        target.setTribe("Digital Accounting");

        AutomatedSystemDto patch = new AutomatedSystemDto();
        patch.setBlock("");        // очистка
        patch.setTribe(null);      // не трогать

        mapper.update(patch, target);

        assertThat(target.getBlock()).isEmpty();
        assertThat(target.getTribe()).isEqualTo("Digital Accounting");
    }
```

- [ ] **Step 2: Run it**

Run: `cd /f/programming/cometa && ./mvnw -q -pl cometa-service-module -am test -Dtest=AutomatedSystemMapperWriteTest`
Expected: PASS. This test should pass on the *current* code — it documents
behaviour rather than changing it. If it fails, the plan's premise is wrong;
stop and revisit spec §5 before touching the database.

- [ ] **Step 3: Commit the test**

```bash
git add cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapperWriteTest.java
git commit -m "test(mapper): pin that \"\" clears a scalar and null leaves it alone"
```

- [ ] **Step 4: Record the pre-migration counts**

Run against the `gmsb` database and keep the output — step 4 compares against
it:

```sql
SELECT 'automated_system' AS tbl, count(*) FILTER (WHERE object_code IS NULL) AS nulls,
       count(*) FILTER (WHERE object_code = '') AS empties FROM gmsb.automated_system
UNION ALL SELECT 'team.name', count(*) FILTER (WHERE name IS NULL),
       count(*) FILTER (WHERE name = '') FROM gmsb.team;
```

Expected at time of writing: `automated_system.object_code` 0 nulls / 0
empties; `team.name` 0 / 0.

- [ ] **Step 5: Write the migration**

Create `db-scripts/ddl/014_no_null_text_columns.sql`:

```sql
-- No-null write standard: every optional text column carries "" as its empty
-- value, so a cleared field is storable and PATCH's IGNORE semantics stop
-- swallowing the write.
--
-- Excluded deliberately:
--   team.type  -- @Enumerated(STRING) TeamType; '' breaks reads
--   team.code  -- integer; retyped separately in 015
--   the 4 nullable FKs and 3 jsonb columns -- no form touches them
--
-- Spec: cometa-frontend/docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('automated_system','object_code'),
      ('automated_system','full_name'),
      ('automated_system','ci'),
      ('automated_system','name_hpsm'),
      ('automated_system','leader'),
      ('automated_system','leader_sap_id'),
      ('automated_system','block'),
      ('automated_system','tribe'),
      ('automated_system','cluster'),
      ('automated_system','cluster_hpsm_id'),
      ('automated_system','status'),
      ('automated_system','ift_mail_support'),
      ('automated_system','uat_mail_support'),
      ('automated_system','prod_mail_support'),
      ('automated_system','guid'),
      ('flow','caption'),
      ('flow','code'),
      ('flow','confidentiality'),
      ('flow','data_class'),
      ('flow','data_type'),
      ('flow','description'),
      ('flow','integrity'),
      ('flow','secret_class'),
      ('team','name'),
      ('team','leader_role'),
      ('team','structure'),
      ('tech_component','console_url'),
      ('tech_component','info_url'),
      ('tech_component','technology'),
      ('scenario','object_code'),
      ('user_right','description'),
      ('user_role','description')
    ) AS v(tbl, col)
  LOOP
    EXECUTE format('UPDATE gmsb.%I SET %I = '''' WHERE %I IS NULL', r.tbl, r.col, r.col);
    EXECUTE format(
      'ALTER TABLE gmsb.%I ALTER COLUMN %I SET DEFAULT '''', ALTER COLUMN %I SET NOT NULL',
      r.tbl, r.col, r.col);
  END LOOP;
END $$;
```

Note `automated_system.leader` is the historical free-text column behind the
`leaderComment` field — not the `leader_person_id` FK. Do not touch the FK.

- [ ] **Step 6: Apply it**

Run the file against the `gmsb` database.
Expected: `DO` succeeds with no error. A failure here means a unique index
collided — the spec's §4.3 says none can, so investigate rather than retry.

- [ ] **Step 7: Verify no NULLs remain and nothing else moved**

```sql
SELECT c.table_name, c.column_name
FROM information_schema.columns c
WHERE c.table_schema='gmsb' AND c.is_nullable='YES' AND c.data_type='text'
ORDER BY 1,2;
```

Expected: exactly one row — `team | type`. Any other row is a column the
migration missed.

```sql
SELECT count(*) FROM gmsb.team;                        -- expect 112
SELECT count(DISTINCT (name, code)) FROM gmsb.team;    -- expect 112
```

Expected: both 112 — `team_unique` still holds.

- [ ] **Step 8: Smoke-test a clear end to end**

With the backend running, PATCH a real row and confirm the value actually
changes — this is the bug the whole plan exists to fix:

```bash
curl -X PATCH http://localhost:8080/api/v1/automated-system/782 \
  -H 'Content-Type: application/json' -d '{"block":""}'
curl -s http://localhost:8080/api/v1/automated-system/graph/782 | grep -o '"block":"[^"]*"'
```

Expected: `"block":""`. If the old value comes back, stop — the premise of the
plan is wrong and the spec's §5 needs revisiting.

- [ ] **Step 9: Commit (backend repo)**

```bash
git add db-scripts/ddl/014_no_null_text_columns.sql
git commit -m "feat(db): give every optional text column \"\" as its empty value"
```

---

### Task 5: TypeScript types stop claiming these fields can be null

After task 4 the server cannot return `null` for these columns. The types should say so, because that is what stops the next feature reintroducing the bug.

**Files:**
- Modify: `src/types/api.ts:53-81` (`AutomatedSystemFlatDto`), `:253-262`
  (`TeamFlatDto`)

**Interfaces:**
- Consumes: task 4 (the migration must be applied first, or reads will
  contradict the types).
- Produces: `AutomatedSystemFlatDto` and `TeamFlatDto` with text fields typed
  `string`.

- [ ] **Step 1: Narrow `AutomatedSystemFlatDto`**

Ten fields change from `string | null` to `string`: `objectCode`, `nameHpsm`,
`leaderComment`, `leaderSapId`, `clusterHpsmId`, `status`, `iftMailSupport`,
`uatMailSupport`, `prodMailSupport`, `guid`. (`fullName`, `ci`, `block`,
`tribe`, `cluster` and `name` are already `string`.)

Add above the interface:

```ts
/** Every text field is non-null: `014_no_null_text_columns.sql` made these
 *  columns NOT NULL DEFAULT ''. Empty is "", never null.
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
```

Leave `insertedAt`/`updatedAt` and `leader: PersonFlatDto | null` as they are —
neither is covered by the migration.

- [ ] **Step 2: Narrow `TeamFlatDto`**

`name`, `leaderRole`, `structure` become `string`. `type` stays
`string | null` — it is the documented exception. `code` stays
`number | null` until task 6.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no output. The `?? ""` guards added in tasks 1–2 stay legal on a
non-nullable string; they are now belt-and-braces for a server that predates
the migration, and are deliberately kept.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass, once the fixtures are updated as follows.

The `dto` fixtures still carry `null`s that the narrowed types now reject. In
`src/features/automated-system/mappers.test.ts`, change the `dto` fixture's
`leaderSapId`, `clusterHpsmId`, `iftMailSupport`, `uatMailSupport`,
`prodMailSupport` and `guid` from `null` to `""`. In
`src/features/team/mappers.test.ts` the `dto` fixture has no nulls among the
narrowed fields, so it needs no change.

Then add one explicitly-cast case to the automated-system file, so the
null-tolerance in `dtoToForm` stays covered:

```ts
  it("still copes with a null from a server that predates the migration", () => {
    const legacy = { ...dto, leaderSapId: null } as unknown as AutomatedSystemDto;
    expect(automatedSystemDtoToForm(legacy).leaderSapId).toBe("");
  });
```

- [ ] **Step 5: Commit**

```bash
git add src/types/api.ts src/features/automated-system/mappers.test.ts src/features/team/mappers.test.ts
git commit -m "refactor(types): text fields are non-null after the no-null migration"
```

---

### Task 6: `team.code` becomes text

The schema's only nullable number, and the only non-text field in any form. It has to change in one shot: a `String` field over an `integer` column, or the reverse, breaks at query time.

**Files:**
- Create: `F:\programming\cometa\db-scripts\ddl\015_team_code_to_text.sql`
- Modify: `F:\programming\cometa\cometa-persistence-module\src\main\java\ru\sberbank\cib\gmbus\entity\auth\Team.java:42-43`
- Modify: `F:\programming\cometa\cometa-service-module\src\main\java\ru\sberbank\cib\gmbus\service\dto\TeamFlatDto.java`
- Modify: `src/types/api.ts` (`TeamFlatDto.code`, `TeamFilters`)
- Modify: `src/features/team/schema.ts`
- Modify: `src/features/team/mappers.ts`
- Modify: `src/features/team/mappers.test.ts`
- Modify: `src/features/team/columns.tsx`
- Modify: `src/features/team/filter-descriptors.ts`
- Modify: `src/features/team/components/TeamSheet.tsx:167-190`

**Interfaces:**
- Consumes: tasks 2 and 5.
- Produces: `TeamFormValues.code: string`, `TeamWritePayload.code: string`,
  `TeamFlatDto.code: string`, and a `code` text filter on search-param key
  `code`.

- [ ] **Step 1: Write the migration**

Create `db-scripts/ddl/015_team_code_to_text.sql`:

```sql
-- team.code is the schema's only nullable number and the only non-text field
-- in an edit form. Retyped to text so it carries "" as its empty value like
-- everything else. 110 of 112 rows are NULL and become ''.
--
-- Accepted: the codeMin/codeMax range filter becomes a text filter, and
-- $orderby=code becomes lexicographic ("10" before "9").
--
-- Spec §7: cometa-frontend/docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md

ALTER TABLE gmsb.team ALTER COLUMN code TYPE text USING code::text;
UPDATE gmsb.team SET code = '' WHERE code IS NULL;
ALTER TABLE gmsb.team
    ALTER COLUMN code SET DEFAULT '',
    ALTER COLUMN code SET NOT NULL;
```

- [ ] **Step 2: Change the Java field types**

`Team.java` — the field only; the `@Column(name = "code")` annotation is
unchanged:

```java
    /**
     * Код команды. Текст, а не число: пустая строка — это "не задано".
     * Стандарт: cometa-frontend/docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
     */
    @Column(name = "code")
    private String code;
```

`TeamFlatDto.java`:

```java
    private String code;
```

- [ ] **Step 3: Apply the migration, rebuild, and verify the mappers**

```bash
cd /f/programming/cometa && ./mvnw -q -DskipTests install
grep -L "implements" cometa-service-module/target/generated-sources/annotations/ru/sberbank/cib/gmbus/service/mapper/*MapperImpl.java
```

Expected: the `grep -L` prints nothing. This repo has a reproducible
fork-related corruption that emits `*MapperImpl` classes without `implements`,
surfacing at startup as "required a bean of type ...Mapper". If any file is
listed, rebuild before going further.

Then confirm the column and the unique constraint:

```sql
SELECT data_type, is_nullable FROM information_schema.columns
WHERE table_schema='gmsb' AND table_name='team' AND column_name='code';
SELECT count(*), count(DISTINCT (name, code)) FROM gmsb.team;
```

Expected: `text | NO`; both counts 112.

- [ ] **Step 4: Update the frontend tests**

In `src/features/team/mappers.test.ts`, change `code: 1234` to `code: "1234"`
in both the `dto` and `form` fixtures and in the `teamFormToCreate`
expectation, then add:

```ts
  it("clears the code with \"\", the same spelling as every other field", () => {
    const cleared: TeamFormValues = { ...form, code: "" };
    expect(teamFormToPatch(cleared, { code: true })).toEqual({ code: "" });
  });
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/features/team/mappers.test.ts`
Expected: FAIL — type errors on the string fixtures, and the clear case is
absent.

- [ ] **Step 6: Change the frontend types and schema**

`src/types/api.ts` — `TeamFlatDto.code: string`; and in `TeamFilters` replace
`codeMin?: number; codeMax?: number;` with `code?: string;`.

`src/features/team/schema.ts` — `code: emptyText(),` in `teamFormSchema`, and
`code: string;` in `TeamWritePayload`.

`src/features/team/mappers.ts` — `code: dto.code ?? "",` in `teamDtoToForm`.

- [ ] **Step 7: Change the column, the filter, and the input**

`src/features/team/columns.tsx`, the `code` column:

```tsx
      cell: ({ cell }) => dash(cell.getValue<string>()),
      meta: {
        label: "Code",
        variant: "text",
        filterKey: "code",
      },
```

Delete the `range: [0, 10000]` and `filterKeys` entries.

`src/features/team/filter-descriptors.ts`:

```ts
  // Was a codeMin/codeMax range while `code` was an integer. Bookmarked URLs
  // carrying the old keys are ignored rather than erroring — see spec §7.
  { id: "code", variant: "text", filterKey: "code" },
```

`src/features/team/components/TeamSheet.tsx`, the `code` Controller — a plain
text input, no null round-trip:

```tsx
                <Input
                  id="code"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                />
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.
`src/features/team/filter-descriptors.test.ts` asserts nothing about `code`, so
it needs no edit — if it fails, something else regressed.

- [ ] **Step 9: Verify the filter and a clear against the running app**

With both servers up (`npm run dev -- --host`), open `/team`, filter on Code
with a partial value, and confirm rows return. Then edit a team, clear Code,
save, and confirm it stays cleared after the list refetches.

- [ ] **Step 10: Commit (both repos)**

```bash
cd /f/programming/cometa
git add db-scripts/ddl/015_team_code_to_text.sql cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/auth/Team.java cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamFlatDto.java
git commit -m "feat(team): retype code to text so it carries \"\" as its empty value"

cd /f/programming/react/cometa-frontend
git add src/types/api.ts src/features/team/
git commit -m "feat(team): code is text; range filter becomes a text filter"
```

---

### Task 7: Record the standard, retire the issue

**Files:**
- Delete: `issue/scalarClearIsANoOp.md`
- Modify: `CLAUDE.md` (the **Conventions** list)

**Interfaces:**
- Consumes: tasks 1–6 all landed.
- Produces: nothing code-facing.

- [ ] **Step 1: Add the convention to `CLAUDE.md`**

Insert after the **Relation writes** bullet:

```markdown
- **Scalar writes (no-null standard)**: the frontend never sends `null`. A key
  absent means "leave unchanged"; a value — including `""` — sets the field.
  Every type carries its own empty value: `""` for text, an explicit enum
  member, a sentinel row for a to-one, `[]` for a to-many. 33 columns are
  `NOT NULL DEFAULT ''` (`db-scripts/ddl/014`, `015`), so this is a schema
  invariant, not a convention. Use `emptyText()` in a form schema, never a
  `"" → null` transform, and `dash()` from `@/lib/format` to render a cell.
  Known exception: `team.type` is `@Enumerated` over a nullable column and is
  settable but not clearable. Full record:
  `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md`.
```

- [ ] **Step 2: Delete the issue file**

`issue/scalarClearIsANoOp.md` documented an open hole that is now closed. The
spec's §10 carries the rejected alternatives it recorded, so nothing is lost.

```bash
git rm issue/scalarClearIsANoOp.md
```

- [ ] **Step 3: Cross out the resolved item in the sibling issue**

In `issue/relationWriteStandardFollowUps.md`, the "Related, raised later"
section references the scalar-clear hole. Replace that reference with a
pointer to the spec.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npx vitest run && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md issue/
git commit -m "docs: record the no-null write standard, retire the scalar-clear issue"
```
