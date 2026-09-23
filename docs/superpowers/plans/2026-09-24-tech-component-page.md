# Tech Components Page + "Not set" Sentinels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tech Components table page with create/edit/delete, backed by a
migration that formalises id-0 "not set" sentinel rows for `person` and
`automated_system` and makes `tech_component.automated_system_id` `NOT NULL`.

**Architecture:** DDL 021 re-keys the existing `nobody@sberbank.ru` person to
id 0, adds automated system 0 (`Not set`), backfills and tightens the FK, and
guards both sentinels against deletion. The backend maps the relation as
required. The frontend stops using `0` as a form's "nothing picked" value
(it is now a real id) and adds a `tech-component` feature cloned from the
`automated-system` pattern, plus two new Automated System pickers.

**Tech Stack:** PostgreSQL (psql, plpgsql) · Java 17 / Spring Boot 4 /
MapStruct / JUnit 5 · React 19, TypeScript 5.9, TanStack Router/Query/Table,
react-hook-form + zod 4, shadcn/ui, vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-tech-component-page-design.md`

## Global Constraints

- Two repos: backend `F:/programming/cometa` (branch `feature/gm`), frontend
  `F:/programming/react/cometa-frontend` (branch `feature/gm`). Commit in the
  repo you changed.
- Order matters: **DDL 021 (Task 1) must be applied before the backend change
  (Task 2) runs anywhere.** `optional = false` makes Hibernate inner-join the
  relation; before the backfill that would silently drop the 3 NULL rows.
- Id `0` is the "not set" row. It is an ordinary row — never filtered out,
  never specially rendered.
- The frontend never sends `null`. Text empties are `""` via a local
  `emptyText = () => z.string().trim()`; relations are `{ id }` refs.
- "Nothing picked" in a form is `undefined`, never `0`.
- DDL is applied as `as_admin`: `psql -h 192.168.0.60 -U as_admin -d cometa -f ddl/021_not_set_sentinels.sql`.
  **Ask the user before applying it** — it rewrites 121 rows on the shared dev DB.
- Frontend checks: `npx tsc -b` (never bare `tsc --noEmit`), `npm run lint`,
  `npx vitest run <path>`, `npm run build`.
- Dev server: `npm run dev -- --host`. Test login: sigmaLogin `16674475` / `qweqweqwe`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih
  ```

## File Map

Backend (`F:/programming/cometa`):
- Create `db-scripts/ddl/021_not_set_sentinels.sql` — sentinels, backfill, NOT NULL, delete guard.
- Modify `cometa-persistence-module/.../entity/TechComponent.java` — `optional = false`.
- Modify `cometa-service-module/.../service/dto/TechComponentDto.java` — javadoc.
- Modify `cometa-service-module/src/test/.../mapper/TechComponentMapperWriteTest.java`, `TechComponentMapperReadTest.java`.

Frontend (`F:/programming/react/cometa-frontend/src`):
- Modify `features/automated-system/{schema,mappers,mappers.test}.ts`, `components/AutomatedSystemSheet.tsx` — leader empty = `undefined`.
- Modify `features/team/{schema,mappers,mappers.test,api}.ts`, `components/TeamSheet.tsx` — same.
- Modify `types/api.ts` — TechComponent types.
- Create `features/tech-component/`: `api.ts`, `advanced-api.ts`, `filter-descriptors.ts` (+test), `schema.ts`, `mappers.ts` (+test), `row-action.ts`, `columns.tsx`, `switchable-config.ts`, `components/TechComponentSheet.tsx`, `components/TechComponentDeleteDialog.tsx`.
- Modify `features/automated-system/api.ts` — `fetchAutomatedSystemsFiltered`, `automatedSystemsFilteredQueryOptions`, `comboboxQueryOptions`.
- Create `features/automated-system/components/AutomatedSystemCombobox.tsx`.
- Create `routes/tech-component/index.tsx`, `routes/tech-component/-simple-search.ts` (+test).
- Modify `components/app-sidebar.tsx`.

---

### Task 1: DDL 021 — sentinel rows, backfill, NOT NULL, delete guard

**Files:**
- Create: `F:/programming/cometa/db-scripts/ddl/021_not_set_sentinels.sql`

**Interfaces:**
- Produces: `person` id 0 (`Doe John`, `nobody@sberbank.ru`), `automated_system` id 0 (`Not set`, leader 0), `tech_component.automated_system_id NOT NULL`, trigger `forbid_sentinel_delete` on `person` and `automated_system`.

- [ ] **Step 1: Capture the pre-state** (read-only, run via the `cometa-postgres` MCP or psql):

```sql
SELECT (SELECT id FROM gmsb.person WHERE email = 'nobody@sberbank.ru') AS nobody_id,
       (SELECT count(*) FROM gmsb.person WHERE id = 0) AS p0,
       (SELECT count(*) FROM gmsb.automated_system WHERE id = 0) AS as0,
       (SELECT count(*) FROM gmsb.automated_system a JOIN gmsb.person p ON p.id = a.leader_person_id WHERE p.email = 'nobody@sberbank.ru') AS as_refs,
       (SELECT count(*) FROM gmsb.team t JOIN gmsb.person p ON p.id = t.leader_person_id WHERE p.email = 'nobody@sberbank.ru') AS team_refs,
       (SELECT count(*) FROM gmsb.tech_component WHERE automated_system_id IS NULL) AS tc_null;
```

Expected (2026-09-24): `nobody_id 284, p0 0, as0 0, as_refs 102, team_refs 19, tc_null 3`. If it differs, stop and report — the script is still correct, but the expected numbers below change.

- [ ] **Step 2: Write the migration**

```sql
-- ============================================================
-- Строки-заглушки "не задано" (id = 0) для person и automated_system;
-- tech_component.automated_system_id становится NOT NULL.
--
-- Правило: id 0 — строка "не задано" любой таблицы, на которую
-- ссылается to-one связь. Заводится миграцией, когда форме впервые
-- нужно выразить "не задано"; FK после этого становится NOT NULL.
-- Это обычная строка: читается, выбирается, отображается как любая
-- другая. Удалить её нельзя (триггер ниже). Запись "не задано" —
-- это {"id": 0}, без нового написания в API.
--
-- 1. Person: де-факто заглушка уже есть — nobody@sberbank.ru (id 284
--    на 2026-09-24, руководитель 102 АС и 19 команд). Она перенумеровывается
--    в 0: FK на person — NO ACTION, id на месте не поменять, поэтому
--    вставляется копия с id 0, ссылки переносятся, старая строка удаляется.
--    Уникальный индекс idx_person_email требует сначала освободить email.
-- 2. automated_system: новая строка 0 "Not set" с руководителем 0 —
--    leader_person_id NOT NULL, поэтому п. 1 обязателен.
-- 3. tech_component.automated_system_id: 3 строки NULL -> 0, затем NOT NULL.
--    Это первая форма, которой нужно "не задано" для этой связи.
--
-- Идемпотентна: повторный прогон ничего не меняет.
-- Применяется подключением под as_admin: db-scripts/README.md.
--
-- Дизайн: cometa-frontend/docs/superpowers/specs/2026-09-24-tech-component-page-design.md
-- Стандарт: cometa-frontend/docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

-- ------------------------------------------------------------
-- 1. Person 0
-- ------------------------------------------------------------
DO $$
DECLARE
	v_old  int8;
	v_refs int8;
BEGIN
	SELECT id INTO v_old FROM gmsb.person WHERE email = 'nobody@sberbank.ru';
	v_old := coalesce(v_old, 0);

	IF v_old = 0 THEN
		-- Либо заглушка уже 0 (повторный прогон), либо строки нет вовсе.
		IF NOT EXISTS (SELECT 1 FROM gmsb.person WHERE id = 0) THEN
			INSERT INTO gmsb.person (id, last_name, first_name, middle_name, email)
				OVERRIDING SYSTEM VALUE
				VALUES (0, 'Doe', 'John', 'Иванович', 'nobody@sberbank.ru');
		END IF;
		RETURN;
	END IF;

	-- Освободить email: idx_person_email уникален.
	UPDATE gmsb.person
		SET email = 'nobody@sberbank.ru#rekey-' || v_old
		WHERE id = v_old;

	-- Значения — те, что хранит строка 284 на 2026-09-24; литералами,
	-- чтобы ветка "строки нет" выше вставляла то же самое.
	-- inserted_at/updated_at ставит триггер set_timestamps.
	INSERT INTO gmsb.person (id, last_name, first_name, middle_name, email)
		OVERRIDING SYSTEM VALUE
		VALUES (0, 'Doe', 'John', 'Иванович', 'nobody@sberbank.ru');

	UPDATE gmsb.automated_system SET leader_person_id = 0 WHERE leader_person_id = v_old;
	UPDATE gmsb.team             SET leader_person_id = 0 WHERE leader_person_id = v_old;
	UPDATE gmsb.user_account     SET person_id        = 0 WHERE person_id        = v_old;
	UPDATE gmsb.person_team_link SET person_id        = 0 WHERE person_id        = v_old;

	SELECT (SELECT count(*) FROM gmsb.automated_system WHERE leader_person_id = v_old)
	     + (SELECT count(*) FROM gmsb.team             WHERE leader_person_id = v_old)
	     + (SELECT count(*) FROM gmsb.user_account     WHERE person_id        = v_old)
	     + (SELECT count(*) FROM gmsb.person_team_link WHERE person_id        = v_old)
	  INTO v_refs;
	IF v_refs <> 0 THEN
		RAISE EXCEPTION 'person %: % references remain after re-key to 0', v_old, v_refs;
	END IF;

	DELETE FROM gmsb.person WHERE id = v_old;
END $$;

-- ------------------------------------------------------------
-- 2. Automated system 0
-- ------------------------------------------------------------
INSERT INTO gmsb.automated_system (id, name, leader_person_id)
	OVERRIDING SYSTEM VALUE
	VALUES (0, 'Not set', 0)
	ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. tech_component.automated_system_id NOT NULL
-- ------------------------------------------------------------
UPDATE gmsb.tech_component SET automated_system_id = 0 WHERE automated_system_id IS NULL;

ALTER TABLE gmsb.tech_component ALTER COLUMN automated_system_id SET NOT NULL;

COMMENT ON COLUMN gmsb.tech_component.automated_system_id IS
	'Ссылка на автоматизированную систему; 0 — заглушка "Not set"';

-- ------------------------------------------------------------
-- 4. Запрет удаления заглушек
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION gmsb.forbid_sentinel_delete()
	RETURNS trigger
	LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD.id = 0 THEN
		RAISE EXCEPTION 'gmsb.%: id 0 is the "not set" sentinel and cannot be deleted', TG_TABLE_NAME;
	END IF;
	RETURN OLD;
END
$$;

COMMENT ON FUNCTION gmsb.forbid_sentinel_delete() IS
	'Запрещает удалять строку-заглушку "не задано" (id = 0)';

DROP TRIGGER IF EXISTS forbid_sentinel_delete ON gmsb.person;
CREATE TRIGGER forbid_sentinel_delete
	BEFORE DELETE ON gmsb.person
	FOR EACH ROW EXECUTE FUNCTION gmsb.forbid_sentinel_delete();

DROP TRIGGER IF EXISTS forbid_sentinel_delete ON gmsb.automated_system;
CREATE TRIGGER forbid_sentinel_delete
	BEFORE DELETE ON gmsb.automated_system
	FOR EACH ROW EXECUTE FUNCTION gmsb.forbid_sentinel_delete();

COMMIT;
```

- [ ] **Step 3: Ask the user for permission to apply**, then apply twice:

```bash
cd F:/programming/cometa/db-scripts
psql -h 192.168.0.60 -U as_admin -d cometa -f ddl/021_not_set_sentinels.sql
psql -h 192.168.0.60 -U as_admin -d cometa -f ddl/021_not_set_sentinels.sql
```

Expected: both end with `COMMIT`, no `ERROR`. The second run is the idempotency check.

- [ ] **Step 4: Verify the post-state**

```sql
SELECT (SELECT row_to_json(p) FROM (SELECT id, last_name, first_name, middle_name, email FROM gmsb.person WHERE id = 0) p) AS p0,
       (SELECT count(*) FROM gmsb.person WHERE id = 284 OR email LIKE 'nobody@sberbank.ru#rekey-%') AS old_rows,
       (SELECT count(*) FROM gmsb.automated_system WHERE leader_person_id = 0) AS as_refs,
       (SELECT count(*) FROM gmsb.team WHERE leader_person_id = 0) AS team_refs,
       (SELECT name FROM gmsb.automated_system WHERE id = 0) AS as0,
       (SELECT count(*) FROM gmsb.tech_component WHERE automated_system_id = 0) AS tc_on_0,
       (SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'gmsb' AND table_name = 'tech_component' AND column_name = 'automated_system_id') AS nullable;
```

Expected: `p0 {"id":0,"last_name":"Doe","first_name":"John","middle_name":"Иванович","email":"nobody@sberbank.ru"}`, `old_rows 0`, `as_refs 103` (102 + the sentinel AS itself), `team_refs 19`, `as0 Not set`, `tc_on_0 3`, `nullable NO`.

Then check the guard (each must fail with the sentinel message, and changes nothing because it errors):

```sql
DELETE FROM gmsb.automated_system WHERE id = 0;
DELETE FROM gmsb.person WHERE id = 0;
```

Expected: `ERROR:  gmsb.automated_system: id 0 is the "not set" sentinel and cannot be deleted` (and the `gmsb.person` equivalent; for person the FK from AS 0 may fire first — either error is a pass, as long as the row survives).

- [ ] **Step 5: Commit** (backend repo)

```bash
cd F:/programming/cometa
git add db-scripts/ddl/021_not_set_sentinels.sql
git commit -m "feat(db): id-0 not-set sentinels for person and automated_system

tech_component.automated_system_id becomes NOT NULL; the nobody@sberbank.ru
person is re-keyed to 0; both sentinels are delete-guarded.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

---

### Task 2: Backend — `TechComponent.automatedSystem` required

**Files:**
- Modify: `F:/programming/cometa/cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/TechComponent.java` (the `automatedSystem` field)
- Modify: `F:/programming/cometa/cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TechComponentDto.java` (javadoc)
- Test: `F:/programming/cometa/cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/TechComponentMapperWriteTest.java`, `TechComponentMapperReadTest.java`

**Interfaces:**
- Consumes: Task 1 applied (FK is NOT NULL, AS 0 exists).
- Produces: `TechComponentDto.automatedSystem` documented as required; `{ "id": 0 }` = "Not set".

- [ ] **Step 1: Add the write test** to `TechComponentMapperWriteTest` (after `patchReplacesTheAutomatedSystem`):

```java
    /**
     * "Не задано" — это обычная ссылка на строку-заглушку id 0 (DDL 021),
     * а не новое написание: маппер обращается с ней как с любой ссылкой.
     */
    @Test
    void notSetSentinelIsAnOrdinaryRef() {
        TechComponent target = componentWithSystem(5L);
        TechComponentDto patch = new TechComponentDto();
        patch.setAutomatedSystem(ref(0L));

        mapper.update(patch, target);

        assertThat(target.getAutomatedSystem().getId()).isEqualTo(0L);
    }
```

- [ ] **Step 2: Add the read test** to `TechComponentMapperReadTest` (after the existing test):

```java
    @Test
    void loadedNotSetSentinelMapsLikeAnyAutomatedSystem() {
        AutomatedSystem notSet = new AutomatedSystem();
        ReflectionTestUtils.setField(notSet, "id", 0L);
        notSet.setName("Not set");
        TechComponent tc = new TechComponent();
        ReflectionTestUtils.setField(tc, "id", 3L);
        tc.setAutomatedSystem(notSet);

        TechComponentDto dto = mapper.toDto(tc);

        assertThat(dto.getAutomatedSystem()).isNotNull();
        assertThat(dto.getAutomatedSystem().getId()).isEqualTo(0L);
        assertThat(dto.getAutomatedSystem().getName()).isEqualTo("Not set");
    }
```

- [ ] **Step 3: Run the tests** — they pass already (the mapper does not special-case 0; these tests pin that it never will):

```bash
cd F:/programming/cometa
./mvnw -q -pl cometa-service-module -am test -Dtest='TechComponentMapper*Test' -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`, 10 tests in `TechComponentMapperWriteTest`, 2 in `TechComponentMapperReadTest`.

- [ ] **Step 4: Make the relation required** in `TechComponent.java`. Replace:

```java
    /**
     * Ссылка на автоматизированную систему (опционально).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "automated_system_id")
    private AutomatedSystem automatedSystem;
```

with:

```java
    /**
     * Ссылка на автоматизированную систему.
     *
     * optional = false + nullable = false повторяют колонку: с DDL 021 она
     * NOT NULL, а "не задано" — это строка-заглушка АС с id 0 ("Not set").
     * optional = false позволяет Hibernate строить inner join, поэтому
     * применять это можно только ПОСЛЕ DDL 021 — иначе строки с NULL
     * молча пропали бы из выборок.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "automated_system_id", nullable = false)
    private AutomatedSystem automatedSystem;
```

- [ ] **Step 5: Update the DTO javadoc** in `TechComponentDto.java`. Replace:

```java
    /**
     * Автоматизированная система тех. компонента (опционально).
```

with:

```java
    /**
     * Автоматизированная система тех. компонента. Обязательна: колонка
     * NOT NULL (DDL 021), "не задано" — это {"id": 0}, строка-заглушка
     * "Not set". POST без этого поля падает на NOT NULL, как AutomatedSystem
     * без leader.
```

(leave the rest of that javadoc — the ЧТЕНИЕ / ЗАПИСЬ paragraphs — unchanged).

- [ ] **Step 6: Build and verify the mappers**

```bash
cd F:/programming/cometa
./mvnw -q -pl cometa-service-module -am test -Dtest='TechComponentMapper*Test' -Dsurefire.failIfNoSpecifiedTests=false
grep -L "implements" cometa-service-module/target/generated-sources/annotations/ru/sberbank/cib/gmbus/service/mapper/*MapperImpl.java
```

Expected: `BUILD SUCCESS`; the `grep -L` prints **nothing** (every `*MapperImpl` still `implements` its interface — the known MapStruct corruption check). If it prints a file, rebuild clean (`./mvnw clean install -DskipTests`) and re-check.

- [ ] **Step 7: Commit** (backend repo)

```bash
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/TechComponent.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TechComponentDto.java \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/TechComponentMapperWriteTest.java \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/TechComponentMapperReadTest.java
git commit -m "feat(tech-component): automatedSystem is required; id 0 means not set

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

---

### Task 3: Frontend — form "nothing picked" leaves `0` (AS and Team leaders)

**Files:**
- Modify: `src/features/automated-system/schema.ts`, `mappers.ts`, `mappers.test.ts`, `components/AutomatedSystemSheet.tsx`
- Modify: `src/features/team/schema.ts`, `mappers.ts`, `mappers.test.ts`, `api.ts` (comments), `components/TeamSheet.tsx`

**Interfaces:**
- Produces: `AutomatedSystemFormDefaults`, `TeamFormDefaults` (form values with `leaderId: number | undefined`); `automatedSystemDtoToForm` / `teamDtoToForm` return those. Task 5 uses the same pattern.

- [ ] **Step 1: Write the failing tests.** In `src/features/automated-system/mappers.test.ts` replace the test `"yields leaderId 0 when leader is absent, so the form flags it required"` with:

```ts
  it("yields leaderId undefined when leader is absent, so the form flags it required", () => {
    // Happens on any read that omitted $fields=leader. 0 is a real person —
    // the "not set" sentinel (DDL 021) — so it cannot mean "nothing picked".
    const bare: AutomatedSystemDto = { ...dto, leader: null };
    expect(automatedSystemDtoToForm(bare).leaderId).toBeUndefined();
  });

  it("keeps a leader that is the not-set sentinel (id 0)", () => {
    const notSet: AutomatedSystemDto = {
      ...dto,
      leader: { ...dto.leader!, id: 0 },
    };
    expect(automatedSystemDtoToForm(notSet).leaderId).toBe(0);
  });
```

and add to the `describe("automatedSystemFormSchema", …)` block:

```ts
  it("accepts leader 0, the not-set sentinel", () => {
    expect(automatedSystemFormSchema.safeParse({ ...form, leaderId: 0 }).success).toBe(true);
  });

  it("reports 'Leader is required' when no leader is picked", () => {
    const r = automatedSystemFormSchema.safeParse({ ...form, leaderId: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Leader is required");
  });
```

In `src/features/team/mappers.test.ts` replace the test `"yields leaderId 0 when leader is absent, so the form flags it required"` (lines 40–44) with:

```ts
  it("yields leaderId undefined when leader is absent, so the form flags it required", () => {
    const bare: TeamDto = { ...dto, leader: null };
    expect(teamDtoToForm(bare).leaderId).toBeUndefined();
  });

  it("accepts leader 0 (the not-set sentinel) and rejects no leader", () => {
    expect(teamFormSchema.safeParse({ ...form, leaderId: 0 }).success).toBe(true);
    const r = teamFormSchema.safeParse({ ...form, leaderId: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Leader is required");
  });
```

(`teamFormSchema`, `dto` and `form` are already imported/defined at the top of that file.)

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/features/automated-system/mappers.test.ts src/features/team/mappers.test.ts
```

Expected: FAIL — `expected 0 to be undefined`, and `accepts leader 0` fails (`positive()` rejects 0).

- [ ] **Step 3: Implement — schemas.** In `src/features/automated-system/schema.ts` replace the `leaderId` entry:

```ts
  /** Required. 0 is a real person — the "not set" sentinel (DDL 021) — so
   *  nonnegative(), not positive(). "Nothing picked" is `undefined`, which
   *  z.number rejects with the same message. */
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .nonnegative("Leader is required"),
```

and after `export type AutomatedSystemFormValues = …` add:

```ts
/** What the sheet seeds the form with: the leader may be not yet picked. */
export type AutomatedSystemFormDefaults = Omit<AutomatedSystemFormValues, "leaderId"> & {
  leaderId: number | undefined;
};
```

In `src/features/team/schema.ts` replace the `leaderId` entry with the identical block above, and after `export type TeamFormValues = …` add:

```ts
/** What the sheet seeds the form with: the leader may be not yet picked. */
export type TeamFormDefaults = Omit<TeamFormValues, "leaderId"> & {
  leaderId: number | undefined;
};
```

- [ ] **Step 4: Implement — mappers.** In `src/features/automated-system/mappers.ts`:
  - import `AutomatedSystemFormDefaults` from `./schema`;
  - change `automatedSystemDtoToForm`'s return type to `AutomatedSystemFormDefaults`;
  - replace the leader lines with:

```ts
    // The leader's id arrives only inside the nested ref, present only on
    // reads that requested $fields=leader. Absent -> undefined ("nothing
    // picked"); 0 is a real id (the not-set sentinel, DDL 021).
    leaderId: dto.leader?.id,
```

In `src/features/team/mappers.ts`: import `TeamFormDefaults`, change `teamDtoToForm`'s return type to `TeamFormDefaults`, and replace its leader lines with the same three-line comment + `leaderId: dto.leader?.id,`.

- [ ] **Step 5: Implement — sheets.** In `AutomatedSystemSheet.tsx`:
  - import `type AutomatedSystemFormDefaults` from `../schema`;
  - type `EMPTY_FORM` as `AutomatedSystemFormDefaults` and replace its leader lines with:

```ts
  // Nothing picked yet; the schema reports "Leader is required". Not 0 —
  // 0 is the not-set sentinel person (DDL 021).
  leaderId: undefined,
```

  - replace the `PersonCombobox` props:

```tsx
                <PersonCombobox
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id ?? undefined)}
                />
```

In `TeamSheet.tsx`: replace the `defaultValues` leader lines (lines 73–75) with the same `leaderId: undefined` + comment, and the `PersonCombobox` props (lines 226–227) with the same two props as above.

- [ ] **Step 6: Update the team api comments.** In `src/features/team/api.ts` replace `without it \`teamDtoToForm\` yields \`leaderId: 0\` and the sheet reports` with `without it \`teamDtoToForm\` yields \`leaderId: undefined\` and the sheet reports`, and in the inline comment replace `teamDtoToForm yields leaderId 0 and the sheet reports a missing leader.` with `teamDtoToForm yields leaderId undefined and the sheet reports a missing leader.`

- [ ] **Step 7: Run tests and type-check**

```bash
npx vitest run src/features/automated-system src/features/team
npx tsc -b
npm run lint
```

Expected: all PASS; `tsc -b` and lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/features/automated-system src/features/team
git commit -m "fix(forms): leader 'nothing picked' is undefined, not 0

0 is now the not-set sentinel person (DDL 021) that 121 rows reference;
positive() would have made them unsaveable.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

---

### Task 4: Tech Component types, API, filter descriptors

**Files:**
- Modify: `src/types/api.ts` (append after the `AutomatedSystemFilters` block)
- Create: `src/features/tech-component/filter-descriptors.ts`, `filter-descriptors.test.ts`, `advanced-api.ts`, `api.ts`, `schema.ts` (payload type only in this task — completed in Task 5)

**Interfaces:**
- Produces: `TechComponentEnvironment`, `TechComponentFlatDto`, `TechComponentDto`, `TechComponentFilters` (types/api); `techComponentFilterDescriptors`, `deriveColumnFiltersFromSearch`; `techComponentFieldByColumnId`, `advancedDataTableQueryOptions`; `techComponentApi` (`dataTableQueryOptions`, `advancedDataTableQueryOptions`, `detailQueryOptions`, `create`, `patch`, `remove`). Query key root `["tech-components"]`.

- [ ] **Step 1: Add the types** to `src/types/api.ts`, right after `AutomatedSystemFilters`:

```ts
// TechComponent
export type TechComponentEnvironment = "PROD" | "UAT" | "IFT" | "DEV";

/** Flat = every scalar of the entity, none of its relations. */
export interface TechComponentFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  groupName: string;
  name: string;
  technology: string;
  environment: TechComponentEnvironment;
  consoleUrl: string;
  infoUrl: string;
}

export interface TechComponentDto extends TechComponentFlatDto {
  /** Read: populated only with ?$fields=automatedSystem. Write: only `id`.
   *  NOT NULL (DDL 021) — id 0 is the "Not set" sentinel row — yet null on
   *  any read that omits $fields. */
  automatedSystem: AutomatedSystemFlatDto | null;
}

export interface TechComponentFilters extends Partial<PaginationParams> {
  name?: string;
  groupName?: string;
  technology?: string;
  environment?: string;
  /** URL search-param name, not a DTO field. */
  automatedSystemId?: number;
}
```

- [ ] **Step 2: Write the failing test** `src/features/tech-component/filter-descriptors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import {
  techComponentFilterDescriptors,
  deriveColumnFiltersFromSearch,
} from "./filter-descriptors";

function build(sort?: string, columnFilters: { id: string; value: unknown }[] = []) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors: techComponentFilterDescriptors,
  });
}

describe("tech component automatedSystem relation filter", () => {
  it("filters through the to-one navigation path", () => {
    expect(build(undefined, [{ id: "automatedSystem", value: 582 }]).get("$filter"))
      .toBe("automatedSystem/id eq 582");
  });

  it("matches the not-set sentinel like any id", () => {
    expect(build(undefined, [{ id: "automatedSystem", value: 0 }]).get("$filter"))
      .toBe("automatedSystem/id eq 0");
  });

  it("sorts by the automated system's name through the navigation path", () => {
    expect(build("automatedSystem.asc").get("$orderby")).toBe("automatedSystem/name asc");
    expect(build("automatedSystem.desc").get("$orderby")).toBe("automatedSystem/name desc");
  });
});

describe("tech component scalar filters", () => {
  it("uses contains_ignoring_case for groupName", () => {
    expect(build(undefined, [{ id: "groupName", value: "Kafka" }]).get("$filter"))
      .toBe("contains_ignoring_case(groupName, 'Kafka')");
  });

  it("uses eq for environment", () => {
    expect(build(undefined, [{ id: "environment", value: ["PROD"] }]).get("$filter"))
      .toBe("environment eq 'PROD'");
  });
});

describe("deriveColumnFiltersFromSearch", () => {
  it("maps URL param names onto column ids, wrapping select values in an array", () => {
    expect(
      deriveColumnFiltersFromSearch({
        name: "k8s",
        environment: "PROD",
        automatedSystemId: 0,
      }),
    ).toEqual([
      { id: "name", value: "k8s" },
      { id: "environment", value: ["PROD"] },
      { id: "automatedSystem", value: 0 },
    ]);
  });

  it("ignores params that are absent", () => {
    expect(deriveColumnFiltersFromSearch({})).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run src/features/tech-component/filter-descriptors.test.ts
```

Expected: FAIL — `Failed to resolve import "./filter-descriptors"`.

- [ ] **Step 4: Implement** `src/features/tech-component/filter-descriptors.ts`:

```ts
import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface TechComponentFilterDescriptor extends FilterDescriptor {
  /** URL search-param name. NEVER rename one of these — bookmarked URLs break. */
  filterKey?: string;
}

export const techComponentFilterDescriptors: readonly TechComponentFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  // groupName/technology stay free text on purpose: their distinct-value
  // counts (8 / 3) are unbounded in principle, and a faceted select would
  // silently hide any value added later (the block/tribe/cluster precedent).
  { id: "groupName", variant: "text", filterKey: "groupName" },
  { id: "technology", variant: "text", filterKey: "technology" },
  { id: "environment", variant: "select", filterKey: "environment" },
  {
    id: "automatedSystem",
    variant: "relation",
    // To-one relation: a navigation path with `/`, never a dot. Filterable
    // AND sortable. Id 0 is the "Not set" sentinel — an ordinary row.
    field: "automatedSystem/id",
    sortField: "automatedSystem/name",
    filterKey: "automatedSystemId",
  },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of techComponentFilterDescriptors) {
    if (!d.filterKey) continue;
    const value = search[d.filterKey];
    if (value === undefined || value === null) continue;

    if (d.variant === "select") {
      filters.push({ id: d.id, value: Array.isArray(value) ? value : [value] });
    } else {
      filters.push({ id: d.id, value });
    }
  }
  return filters;
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
npx vitest run src/features/tech-component/filter-descriptors.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 6: Create** `src/features/tech-component/advanced-api.ts`:

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, TechComponentDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";
import { notifyLambdaCapped } from "@/lib/odata/notify-lambda-capped";

export const techComponentFieldByColumnId: Record<string, FieldEntry> = {
  name:            { field: "name",               variant: "text" },
  groupName:       { field: "groupName",          variant: "text" },
  technology:      { field: "technology",         variant: "text" },
  environment:     { field: "environment",        variant: "select" },
  consoleUrl:      { field: "consoleUrl",         variant: "text" },
  infoUrl:         { field: "infoUrl",            variant: "text" },
  automatedSystem: { field: "automatedSystem/id", variant: "relation", sortField: "automatedSystem/name" },
};

export interface AdvancedDataTableQueryParams {
  page: number;
  pageSize: number;
  sort?: string;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
}

export function advancedDataTableQueryOptions(
  params: AdvancedDataTableQueryParams,
) {
  return queryOptions({
    queryKey: [
      "tech-components",
      "advanced",
      params.page,
      params.pageSize,
      params.sort,
      params.filters,
      params.joinOperator,
    ] as const,
    queryFn: () => {
      const searchParams = buildAdvancedFilterParams({
        ...params,
        fieldByColumnId: techComponentFieldByColumnId,
        onLambdaCapped: notifyLambdaCapped,
      });
      searchParams.set("$fields", "automatedSystem");
      return apiFetch<ApiResponse<TechComponentDto[]>>(
        `/api/v1/tech-component/graph?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 7: Create** `src/features/tech-component/schema.ts` with only the payload type for now (Task 5 adds the form schema above it):

```ts
import type { TechComponentEnvironment } from "@/types/api";

export interface TechComponentWritePayload {
  groupName: string;
  name: string;
  technology: string;
  environment: TechComponentEnvironment;
  consoleUrl: string;
  infoUrl: string;
  /** Relation ref: only `id` is honoured. Required (NOT NULL, DDL 021);
   *  `{ id: 0 }` is "Not set". */
  automatedSystem: { id: number };
}
```

- [ ] **Step 8: Create** `src/features/tech-component/api.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import type {
  ApiResponse,
  TechComponentDto,
  TechComponentFilters,
} from "@/types/api";
import type { TechComponentWritePayload } from "./schema";
import { techComponentFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<
  TechComponentDto,
  TechComponentFilters,
  TechComponentWritePayload
>({
  basePath: "/api/v1/tech-component",
  // Reads go through the entity-graph endpoint so the backend populates the
  // nested `automatedSystem`; create/patch/remove stay on the plain resource
  // path (`/graph` is read-only).
  listPath: "/api/v1/tech-component/graph",
  queryKey: ["tech-components"],
  filterDescriptors: techComponentFilterDescriptors,
  staticParams: { "$fields": "automatedSystem" },
});

/** Overrides the base `detailQueryOptions`, which would hit `/{id}` — that
 *  handler ignores `$fields` and would return `automatedSystem: null`.
 *  Same reason as `src/features/automated-system/api.ts`. */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["tech-components", "detail", id] as const,
    queryFn: () =>
      apiFetch<ApiResponse<TechComponentDto>>(
        `/api/v1/tech-component/graph/${id}?$fields=automatedSystem`,
      ),
  });
}

// detailQueryOptions is spread AFTER ...baseApi so this one wins.
export const techComponentApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  detailQueryOptions,
};
```

- [ ] **Step 9: Type-check and commit**

```bash
npx tsc -b
git add src/types/api.ts src/features/tech-component
git commit -m "feat(tech-component): types, API and filter descriptors

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

Expected: `tsc -b` clean.

---

### Task 5: Tech Component form schema and mappers

**Files:**
- Modify: `src/features/tech-component/schema.ts`
- Create: `src/features/tech-component/mappers.ts`, `mappers.test.ts`

**Interfaces:**
- Consumes: `TechComponentWritePayload` (Task 4), `TechComponentDto`.
- Produces: `TECH_COMPONENT_ENVIRONMENTS`, `techComponentFormSchema`, `TechComponentFormValues`, `TechComponentFormDefaults`; `techComponentDtoToForm(dto): TechComponentFormDefaults`, `techComponentFormToCreate(v): TechComponentWritePayload`, `techComponentFormToPatch(v, dirty): Partial<TechComponentWritePayload>`, `TechComponentDirtyFields`.

- [ ] **Step 1: Write the failing test** `src/features/tech-component/mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { TechComponentDto } from "@/types/api";
import {
  techComponentDtoToForm,
  techComponentFormToCreate,
  techComponentFormToPatch,
} from "./mappers";
import { techComponentFormSchema, type TechComponentFormValues } from "./schema";

const dto: TechComponentDto = {
  id: 3,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  groupName: "k8s Sigma GMSB",
  name: "k8s-sigma-gmsb",
  technology: "KUBERNETES",
  environment: "PROD",
  consoleUrl: "https://console.example",
  infoUrl: "",
  automatedSystem: {
    id: 582,
    insertedAt: null,
    updatedAt: null,
    name: "GMSB",
    objectCode: "",
    fullName: "",
    ci: "",
    nameHpsm: "",
    leaderComment: "",
    leaderSapId: "",
    block: "",
    tribe: "",
    cluster: "",
    clusterHpsmId: "",
    status: "",
    iftMailSupport: "",
    uatMailSupport: "",
    prodMailSupport: "",
    guid: "",
  },
};

const form: TechComponentFormValues = {
  groupName: "k8s Sigma GMSB",
  name: "k8s-sigma-gmsb",
  technology: "KUBERNETES",
  environment: "PROD",
  automatedSystemId: 582,
  consoleUrl: "https://console.example",
  infoUrl: "",
};

describe("techComponentDtoToForm", () => {
  it("lifts automatedSystemId out of the nested ref", () => {
    expect(techComponentDtoToForm(dto)).toEqual(form);
  });

  it("keeps the not-set sentinel (id 0)", () => {
    const notSet = { ...dto, automatedSystem: { ...dto.automatedSystem!, id: 0 } };
    expect(techComponentDtoToForm(notSet).automatedSystemId).toBe(0);
  });

  it("yields undefined when automatedSystem was not read", () => {
    expect(techComponentDtoToForm({ ...dto, automatedSystem: null }).automatedSystemId)
      .toBeUndefined();
  });
});

describe("techComponentFormSchema", () => {
  it("requires name, group, environment and an automated system", () => {
    const r = techComponentFormSchema.safeParse({
      ...form,
      name: "",
      groupName: "",
      environment: undefined,
      automatedSystemId: undefined,
    });
    expect(r.success).toBe(false);
    const byPath = Object.fromEntries(
      (r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]),
    );
    expect(byPath).toEqual({
      name: "Name is required",
      groupName: "Group is required",
      environment: "Environment is required",
      automatedSystemId: "Automated system is required",
    });
  });

  it("accepts automated system 0, the not-set sentinel", () => {
    expect(techComponentFormSchema.safeParse({ ...form, automatedSystemId: 0 }).success)
      .toBe(true);
  });

  it("trims whitespace-only optional text to ''", () => {
    expect(techComponentFormSchema.parse({ ...form, technology: "   " }).technology).toBe("");
  });

  it("does not validate URL format (free-text column)", () => {
    expect(techComponentFormSchema.safeParse({ ...form, infoUrl: "not a url" }).success)
      .toBe(true);
  });
});

describe("techComponentFormToCreate", () => {
  it("sends every field, the automated system as a ref", () => {
    expect(techComponentFormToCreate(form)).toEqual({
      groupName: "k8s Sigma GMSB",
      name: "k8s-sigma-gmsb",
      technology: "KUBERNETES",
      environment: "PROD",
      consoleUrl: "https://console.example",
      infoUrl: "",
      automatedSystem: { id: 582 },
    });
  });
});

describe("techComponentFormToPatch", () => {
  it("returns only dirty fields, with the automated system as a ref", () => {
    expect(techComponentFormToPatch(form, { automatedSystemId: true })).toEqual({
      automatedSystem: { id: 582 },
    });
  });

  it("writes the not-set sentinel as { id: 0 }", () => {
    expect(
      techComponentFormToPatch({ ...form, automatedSystemId: 0 }, { automatedSystemId: true }),
    ).toEqual({ automatedSystem: { id: 0 } });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(techComponentFormToPatch(form, {})).toEqual({});
  });

  it("emits '' for a cleared field, never null", () => {
    expect(
      techComponentFormToPatch({ ...form, consoleUrl: "" }, { consoleUrl: true }),
    ).toEqual({ consoleUrl: "" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/features/tech-component/mappers.test.ts
```

Expected: FAIL — `Failed to resolve import "./mappers"`.

- [ ] **Step 3: Implement the schema.** Replace `src/features/tech-component/schema.ts` entirely with:

```ts
import { z } from "zod";
import type { TechComponentEnvironment } from "@/types/api";

/** An emptied input sends "", never null — null means "leave unchanged" on the
 *  server (MapStruct's NullValuePropertyMappingStrategy.IGNORE).
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
const emptyText = () => z.string().trim();

/** Mirrors ru.sberbank.cib.gmbus.entity.enums.Environment. */
export const TECH_COMPONENT_ENVIRONMENTS = [
  "PROD",
  "UAT",
  "IFT",
  "DEV",
] as const satisfies readonly TechComponentEnvironment[];

/**
 * Mirrors the database: group_name, name, environment and (since DDL 021)
 * automated_system_id are NOT NULL, so only those are required. URLs are not
 * format-validated — free-text columns, and a rule stricter than the data
 * would make legacy rows unsaveable (the AS `ci` lesson).
 */
export const techComponentFormSchema = z.object({
  groupName: z.string().min(1, "Group is required"),
  name: z.string().min(1, "Name is required"),
  technology: emptyText(),
  environment: z.enum(TECH_COMPONENT_ENVIRONMENTS, {
    error: "Environment is required",
  }),
  /** 0 is the "Not set" sentinel row — valid. "Nothing picked" is undefined. */
  automatedSystemId: z
    .number({ error: "Automated system is required" })
    .int()
    .nonnegative("Automated system is required"),
  consoleUrl: emptyText(),
  infoUrl: emptyText(),
});

export type TechComponentFormValues = z.infer<typeof techComponentFormSchema>;

/** What the sheet seeds the form with: environment and automated system may
 *  be not yet picked. */
export type TechComponentFormDefaults = Omit<
  TechComponentFormValues,
  "environment" | "automatedSystemId"
> & {
  environment: TechComponentEnvironment | undefined;
  automatedSystemId: number | undefined;
};

export interface TechComponentWritePayload {
  groupName: string;
  name: string;
  technology: string;
  environment: TechComponentEnvironment;
  consoleUrl: string;
  infoUrl: string;
  /** Relation ref: only `id` is honoured. Required (NOT NULL, DDL 021);
   *  `{ id: 0 }` is "Not set". */
  automatedSystem: { id: number };
}
```

- [ ] **Step 4: Implement** `src/features/tech-component/mappers.ts`:

```ts
import type { TechComponentDto } from "@/types/api";
import type {
  TechComponentFormDefaults,
  TechComponentFormValues,
  TechComponentWritePayload,
} from "./schema";

export function techComponentDtoToForm(
  dto: TechComponentDto,
): TechComponentFormDefaults {
  return {
    groupName: dto.groupName ?? "",
    name: dto.name ?? "",
    technology: dto.technology ?? "",
    environment: dto.environment,
    // Present only on reads that requested $fields=automatedSystem.
    // Absent -> undefined ("nothing picked"); 0 is the not-set sentinel.
    automatedSystemId: dto.automatedSystem?.id,
    consoleUrl: dto.consoleUrl ?? "",
    infoUrl: dto.infoUrl ?? "",
  };
}

export function techComponentFormToCreate(
  v: TechComponentFormValues,
): TechComponentWritePayload {
  return {
    groupName: v.groupName,
    name: v.name,
    technology: v.technology,
    environment: v.environment,
    consoleUrl: v.consoleUrl,
    infoUrl: v.infoUrl,
    automatedSystem: { id: v.automatedSystemId },
  };
}

export type TechComponentDirtyFields = Partial<
  Record<keyof TechComponentFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function techComponentFormToPatch(
  v: TechComponentFormValues,
  dirty: TechComponentDirtyFields,
): Partial<TechComponentWritePayload> {
  const out: Partial<TechComponentWritePayload> = {};
  if (isDirty(dirty.groupName)) out.groupName = v.groupName;
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.technology)) out.technology = v.technology;
  if (isDirty(dirty.environment)) out.environment = v.environment;
  if (isDirty(dirty.automatedSystemId)) out.automatedSystem = { id: v.automatedSystemId };
  if (isDirty(dirty.consoleUrl)) out.consoleUrl = v.consoleUrl;
  if (isDirty(dirty.infoUrl)) out.infoUrl = v.infoUrl;
  return out;
}
```

- [ ] **Step 5: Run to verify it passes, type-check**

```bash
npx vitest run src/features/tech-component
npx tsc -b
```

Expected: PASS (all tests in both test files); `tsc -b` clean. If the "requires …" test shows zod's default message for `environment` (e.g. `Invalid option…`) instead of `Environment is required`, the `{ error }` param is not being applied to the `undefined` case — change it to `{ error: () => "Environment is required" }` and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/features/tech-component
git commit -m "feat(tech-component): form schema and mappers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

---

### Task 6: Automated System pickers (relation-filter source + combobox)

**Files:**
- Modify: `src/features/automated-system/api.ts`
- Create: `src/features/automated-system/api.test.ts`, `src/features/automated-system/components/AutomatedSystemCombobox.tsx`

**Interfaces:**
- Produces:
  - `fetchAutomatedSystemsFiltered(filters: Record<string, unknown>): Promise<ApiResponse<AutomatedSystemDto[]>>`
  - `automatedSystemsFilteredQueryOptions(filters)` — `RelationPicker` source (`{ name?, ids?, page?, pageSize? }`).
  - `automatedSystemApi.comboboxQueryOptions(search: string)`.
  - `<AutomatedSystemCombobox value={number | null} onChange={(id: number | null) => void} />`.

- [ ] **Step 1: Write the failing test** `src/features/automated-system/api.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAutomatedSystemsFiltered } from "./api";

function lastUrl(spy: ReturnType<typeof vi.fn>): URL {
  return new URL(String(spy.mock.calls.at(-1)![0]), "http://x");
}

describe("fetchAutomatedSystemsFiltered", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub() {
    const spy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], messages: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  it("pages with $skip/$top and searches by name", async () => {
    const spy = stub();
    await fetchAutomatedSystemsFiltered({ name: "gm'sb", page: 2, pageSize: 20 });
    const url = lastUrl(spy);
    expect(url.pathname).toBe("/api/v1/automated-system");
    expect(url.searchParams.get("$skip")).toBe("20");
    expect(url.searchParams.get("$top")).toBe("20");
    expect(url.searchParams.get("$filter")).toBe("contains_ignoring_case(name, 'gm''sb')");
  });

  it("resolves selected ids, including the not-set sentinel 0", async () => {
    const spy = stub();
    await fetchAutomatedSystemsFiltered({ ids: [0, 582] });
    expect(lastUrl(spy).searchParams.get("$filter")).toBe("id in (0,582)");
  });

  it("sends no $filter when nothing is filtered", async () => {
    const spy = stub();
    await fetchAutomatedSystemsFiltered({});
    expect(lastUrl(spy).searchParams.has("$filter")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/features/automated-system/api.test.ts
```

Expected: FAIL — `fetchAutomatedSystemsFiltered` is not exported. (`odataString(v: unknown)` doubles single quotes, hence `gm''sb`.)

- [ ] **Step 3: Implement** — in `src/features/automated-system/api.ts`:
  - change the first import to `import { queryOptions, keepPreviousData } from "@tanstack/react-query";`
  - add `import { odataString } from "@/lib/odata/build-filter-params";`
  - add before `export const automatedSystemApi`:

```ts
/** Combobox options: server-side search — $top=20 + $filter over name. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["automated-systems", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        params.set("$filter", `contains_ignoring_case(name, '${odataString(q)}')`);
      }
      return apiFetch<ApiResponse<AutomatedSystemDto[]>>(
        `/api/v1/automated-system?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * `RelationPicker` source (Tech Components' Automated System filter). Same
 * `{ name?, ids?, page?, pageSize? }` contract as `fetchPersonsFiltered`.
 * Id 0 (the "Not set" sentinel) is an ordinary row here.
 */
export async function fetchAutomatedSystemsFiltered(
  filters: Record<string, unknown> = {},
): Promise<ApiResponse<AutomatedSystemDto[]>> {
  const params = new URLSearchParams();
  const { page = 1, pageSize = 20, ...fieldFilters } = filters;
  params.set("$skip", String((Number(page) - 1) * Number(pageSize)));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];
  if (fieldFilters.name) {
    clauses.push(`contains_ignoring_case(name, '${odataString(fieldFilters.name)}')`);
  }
  if (Array.isArray(fieldFilters.ids) && fieldFilters.ids.length > 0) {
    const ids = (fieldFilters.ids as unknown[]).map(Number).filter(Number.isFinite);
    if (ids.length > 0) {
      clauses.push(`id in (${ids.join(",")})`);
    }
  }
  if (clauses.length > 0) {
    params.set("$filter", clauses.join(" and "));
  }

  return apiFetch<ApiResponse<AutomatedSystemDto[]>>(
    `/api/v1/automated-system?${params.toString()}`,
  );
}

export function automatedSystemsFilteredQueryOptions(
  filters: Record<string, unknown> = {},
) {
  return queryOptions({
    queryKey: ["automated-systems", "relation-list", filters] as const,
    queryFn: () => fetchAutomatedSystemsFiltered(filters),
    placeholderData: keepPreviousData,
  });
}
```

  - add `comboboxQueryOptions,` to the exported `automatedSystemApi` object (after `advancedDataTableQueryOptions,`).

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/features/automated-system/api.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Create** `src/features/automated-system/components/AutomatedSystemCombobox.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { automatedSystemApi } from "@/features/automated-system/api";

interface AutomatedSystemComboboxProps {
  value: number | null;
  onChange: (automatedSystemId: number | null) => void;
}

/** Modeled on PersonCombobox. Id 0 ("Not set") is an ordinary option. */
export function AutomatedSystemCombobox({ value, onChange }: AutomatedSystemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/automated-system?$top=20&$filter=contains_ignoring_case(name, …).
  const listQuery = useQuery(automatedSystemApi.comboboxQueryOptions(search));
  const systems = listQuery.data?.data ?? [];

  // The selected system may fall outside the top-20 result set — fetch by id.
  const detailQuery = useQuery({
    ...automatedSystemApi.detailQueryOptions(value ?? 0),
    enabled: value !== null,
  });
  const selected = detailQuery.data?.data;

  const displayText =
    value === null
      ? "Not selected"
      : selected
        ? selected.name
        : detailQuery.isLoading
          ? "Loading…"
          : "Not selected";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
          />
        }
      >
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <DebouncedInput
              placeholder="Search automated systems…"
              value={search}
              onChange={setSearch}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {systems.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {systems.map((system) => {
            const isSelected = system.id === value;
            return (
              <li
                key={system.id}
                onClick={() => {
                  onChange(system.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{system.name}</div>
                {system.ci && (
                  <div className="truncate text-xs text-muted-foreground">{system.ci}</div>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

(No "Not selected" item, unlike `PersonCombobox`: the field is required and "Not set" is picked as the sentinel row, so an unselect entry would only produce a validation error.)

- [ ] **Step 6: Type-check, lint, commit**

```bash
npx tsc -b
npm run lint
git add src/features/automated-system
git commit -m "feat(automated-system): relation-filter source and combobox

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

---

### Task 7: Tech Component columns, row actions, switchable config, search validation

**Files:**
- Create: `src/features/tech-component/row-action.ts`, `columns.tsx`, `switchable-config.ts`
- Create: `src/routes/tech-component/-simple-search.ts`, `-simple-search.test.ts`

**Interfaces:**
- Consumes: `techComponentApi` (Task 4), `deriveColumnFiltersFromSearch` (Task 4), `automatedSystemsFilteredQueryOptions` (Task 6), `TECH_COMPONENT_ENVIRONMENTS` (Task 5).
- Produces: `TechComponentRowAction` (`create` | `update` | `delete`), `getTechComponentColumns`, `techComponentSwitchableConfig`, `techComponentSimpleFilterKeys`, `validateTechComponentSimpleFields`.

- [ ] **Step 1: Write the failing test** `src/routes/tech-component/-simple-search.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateTechComponentSimpleFields } from "./-simple-search";

describe("validateTechComponentSimpleFields", () => {
  it("keeps valid simple filters", () => {
    expect(
      validateTechComponentSimpleFields({
        name: "k8s",
        groupName: "Kafka",
        technology: "KAFKA",
        environment: "PROD,UAT",
        automatedSystemId: "0",
      }),
    ).toEqual({
      name: "k8s",
      groupName: "Kafka",
      technology: "KAFKA",
      environment: ["PROD", "UAT"],
      automatedSystemId: 0,
    });
  });

  it("drops values of the wrong type", () => {
    expect(
      validateTechComponentSimpleFields({ name: 5, automatedSystemId: "abc" }),
    ).toEqual({
      name: undefined,
      groupName: undefined,
      technology: undefined,
      environment: undefined,
      automatedSystemId: undefined,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/routes/tech-component/-simple-search.test.ts
```

Expected: FAIL — `Failed to resolve import "./-simple-search"`.

- [ ] **Step 3: Implement** `src/routes/tech-component/-simple-search.ts`:

```ts
function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
function asStrArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v.length > 0) return v.split(",");
  return undefined;
}

/** Simple-mode URL params. No unsortable-column guard: no Tech Component
 *  column collides with odata-mini's $orderby grammar (cf. AS `guid`). */
export function validateTechComponentSimpleFields(
  search: Record<string, unknown>,
) {
  return {
    name: asStr(search.name),
    groupName: asStr(search.groupName),
    technology: asStr(search.technology),
    environment: asStrArray(search.environment),
    automatedSystemId: asNum(search.automatedSystemId),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/routes/tech-component/-simple-search.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Create** `src/features/tech-component/row-action.ts`:

```ts
import type { TechComponentDto } from "@/types/api";

export type TechComponentRowAction =
  | { variant: "create" }
  | { variant: "update"; row: TechComponentDto }
  | { variant: "delete"; row: TechComponentDto };
```

- [ ] **Step 6: Create** `src/features/tech-component/columns.tsx`:

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis } from "lucide-react";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { automatedSystemsFilteredQueryOptions } from "@/features/automated-system/api";
import type {
  AutomatedSystemDto,
  AutomatedSystemFlatDto,
  TechComponentDto,
} from "@/types/api";
import type { TechComponentRowAction } from "./row-action";
import { TECH_COMPONENT_ENVIRONMENTS } from "./schema";

interface GetTechComponentColumnsProps {
  setRowAction: React.Dispatch<
    React.SetStateAction<TechComponentRowAction | null>
  >;
}

const automatedSystemRelationColumns: ColumnDef<AutomatedSystemDto, unknown>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "ci", accessorKey: "ci", header: "CI" },
];

function UrlCell({ value }: { value: string | null | undefined }) {
  if (!value) return <>{dash(value)}</>;
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {value}
    </a>
  );
}

function textColumn(
  id: "name" | "groupName" | "technology",
  label: string,
  placeholder: string,
  size: number,
): ColumnDef<TechComponentDto> {
  return {
    id,
    accessorKey: id,
    header: ({ column }) => <DataTableColumnHeader column={column} label={label} />,
    cell: ({ cell }) => dash(cell.getValue<string | null>()),
    meta: { label, placeholder, variant: "text", filterKey: id },
    enableColumnFilter: true,
    enableSorting: true,
    size,
  };
}

function urlColumn(
  id: "consoleUrl" | "infoUrl",
  label: string,
): ColumnDef<TechComponentDto> {
  return {
    id,
    accessorKey: id,
    header: ({ column }) => <DataTableColumnHeader column={column} label={label} />,
    cell: ({ cell }) => <UrlCell value={cell.getValue<string | null>()} />,
    // Hidden by default via switchable-config's initialColumnVisibility.
    meta: { label },
    enableColumnFilter: false,
    enableSorting: true,
    size: 260,
  };
}

export function getTechComponentColumns({
  setRowAction,
}: GetTechComponentColumnsProps): ColumnDef<TechComponentDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          className="translate-y-0.5"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          className="translate-y-0.5"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 40,
    },
    {
      id: "id",
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} label="ID" />,
      enableSorting: true,
      enableHiding: false,
      size: 60,
    },
    textColumn("name", "Name", "Search names...", 220),
    textColumn("groupName", "Group", "Search groups...", 180),
    textColumn("technology", "Technology", "Search technologies...", 140),
    {
      id: "environment",
      accessorKey: "environment",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Environment" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Environment",
        variant: "select",
        options: TECH_COMPONENT_ENVIRONMENTS.map((e) => ({ label: e, value: e })),
        filterKey: "environment",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 130,
    },
    {
      id: "automatedSystem",
      accessorKey: "automatedSystem",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Automated System" />
      ),
      cell: ({ cell }) => {
        // Id 0 renders as its name, "Not set" — an ordinary row.
        const system = cell.getValue<AutomatedSystemFlatDto | null>();
        return system ? dash(system.name) : "—";
      },
      meta: {
        label: "Automated System",
        variant: "relation",
        filterKey: "automatedSystemId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            automatedSystemsFilteredQueryOptions(filters),
          columns: automatedSystemRelationColumns,
          getLabel: (system: AutomatedSystemDto) => system.name,
          getId: (system: AutomatedSystemDto) => system.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 220,
    },
    urlColumn("consoleUrl", "Console URL"),
    urlColumn("infoUrl", "Info URL"),
    {
      id: "actions",
      cell: function Cell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "flex size-8 p-0",
              )}
            >
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => setRowAction({ variant: "update", row: row.original })}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setRowAction({ variant: "delete", row: row.original })}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 40,
    },
  ];
}
```

- [ ] **Step 7: Create** `src/features/tech-component/switchable-config.ts`:

```ts
import { techComponentApi } from "./api";
import { getTechComponentColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { TechComponentDto } from "@/types/api";
import type { TechComponentRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const techComponentSimpleFilterKeys = [
  "name",
  "groupName",
  "technology",
  "environment",
  "automatedSystemId",
] as const;

export const techComponentSwitchableConfig: SwitchableTableConfig<
  TechComponentDto,
  TechComponentRowAction
> = {
  queryKey: ["tech-components"],
  simpleQueryOptions: (p) => techComponentApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => techComponentApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: techComponentSimpleFilterKeys,
  getColumns: getTechComponentColumns,
  initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
  // 7 / 2 of 30 rows have a value (2026-09-24).
  initialColumnVisibility: { consoleUrl: false, infoUrl: false },
};
```

- [ ] **Step 8: Type-check, lint, test, commit**

```bash
npx tsc -b
npm run lint
npx vitest run src/features/tech-component src/routes/tech-component
git add src/features/tech-component src/routes/tech-component
git commit -m "feat(tech-component): columns, row actions and search validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

---

### Task 8: Tech Component sheet and delete dialog

**Files:**
- Create: `src/features/tech-component/components/TechComponentSheet.tsx`, `TechComponentDeleteDialog.tsx`

**Interfaces:**
- Consumes: `techComponentApi` (Task 4); schema/mappers (Task 5); `AutomatedSystemCombobox` (Task 6).
- Produces: `<TechComponentSheet techComponent variant onSuccess {...SheetProps} />`, `<TechComponentDeleteDialog techComponent open onOpenChange onSuccess />`.

This is the first delete in the app (no other page has one). It is a row action with a confirm dialog.

- [ ] **Step 1: Create** `src/features/tech-component/components/TechComponentSheet.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Control, type Path } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AutomatedSystemCombobox } from "@/features/automated-system/components/AutomatedSystemCombobox";
import { ApiError } from "@/lib/api/create-crud-api";
import type { AppMessage, TechComponentDto } from "@/types/api";

import { techComponentApi } from "../api";
import {
  TECH_COMPONENT_ENVIRONMENTS,
  techComponentFormSchema,
  type TechComponentFormDefaults,
  type TechComponentFormValues,
} from "../schema";
import {
  techComponentDtoToForm,
  techComponentFormToCreate,
  techComponentFormToPatch,
} from "../mappers";

type TextField = "name" | "groupName" | "technology" | "consoleUrl" | "infoUrl";

const TC_FORM_FIELDS: readonly (keyof TechComponentFormValues)[] = [
  "groupName",
  "name",
  "technology",
  "environment",
  "automatedSystemId",
  "consoleUrl",
  "infoUrl",
];

function isTechComponentField(
  target: string,
): target is keyof TechComponentFormValues {
  return (TC_FORM_FIELDS as readonly string[]).includes(target);
}

const EMPTY_FORM: TechComponentFormDefaults = {
  groupName: "",
  name: "",
  technology: "",
  // Nothing picked yet; the schema reports "… is required".
  environment: undefined,
  // Not 0 — 0 is the "Not set" sentinel row (DDL 021), a valid pick.
  automatedSystemId: undefined,
  consoleUrl: "",
  infoUrl: "",
};

function TextRow({
  control,
  name,
  label,
}: {
  control: Control<TechComponentFormValues>;
  name: TextField;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <>
            <Input
              id={name}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
            />
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </>
        )}
      />
    </div>
  );
}

interface TechComponentSheetProps
  extends React.ComponentPropsWithRef<typeof Sheet> {
  techComponent: TechComponentDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function TechComponentSheet({
  techComponent,
  variant,
  onSuccess,
  ...props
}: TechComponentSheetProps) {
  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<TechComponentFormValues>({
    resolver: zodResolver(techComponentFormSchema),
    defaultValues: techComponent ? techComponentDtoToForm(techComponent) : EMPTY_FORM,
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      // The DTO field is `automatedSystem`; the form field is `automatedSystemId`.
      const target = m.target === "automatedSystem" ? "automatedSystemId" : m.target;
      if (target && isTechComponentField(target)) {
        form.setError(target as Path<TechComponentFormValues>, { message: m.message });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: TechComponentFormValues) => {
      if (variant === "update" && techComponent) {
        const patch = techComponentFormToPatch(data, form.formState.dirtyFields);
        return techComponentApi.patch(techComponent.id, patch);
      }
      return techComponentApi.create(techComponentFormToCreate(data));
    },
    onSuccess: () => {
      // The PATCH/POST response comes from the plain path, which does not
      // honour `$fields` (automatedSystem: null); the page invalidates the
      // whole ["tech-components"] key instead of caching it.
      toast.success(
        variant === "update" ? "Tech component updated" : "Tech component created",
      );
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        // A duplicate (name, environment) lands here as a DB unique violation.
        if (!applyServerErrors(err.messages)) {
          toast.error(err.message || "Failed to save tech component");
        }
      } else {
        toast.error("Failed to save tech component");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Tech Component" : "Add Tech Component"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the tech component details and save changes."
              : "Fill in the details to create a new tech component."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          <TextRow control={form.control} name="name" label="Name" />
          <TextRow control={form.control} name="groupName" label="Group" />

          {/* Environment (required, enum) */}
          <div className="flex flex-col gap-2">
            <Label>Environment</Label>
            <Controller
              control={form.control}
              name="environment"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TECH_COMPONENT_ENVIRONMENTS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.environment && (
              <p className="text-sm text-destructive">
                {form.formState.errors.environment.message}
              </p>
            )}
          </div>

          {/* Automated System (required; "Not set" is the id-0 row) */}
          <div className="flex flex-col gap-2">
            <Label>Automated System</Label>
            <Controller
              control={form.control}
              name="automatedSystemId"
              render={({ field }) => (
                <AutomatedSystemCombobox
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id ?? undefined)}
                />
              )}
            />
            {form.formState.errors.automatedSystemId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.automatedSystemId.message}
              </p>
            )}
          </div>

          <TextRow control={form.control} name="technology" label="Technology" />
          <TextRow control={form.control} name="consoleUrl" label="Console URL" />
          <TextRow control={form.control} name="infoUrl" label="Info URL" />

          <SheetFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => closeSheet()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              )}
              {variant === "update" ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

(The Select mirrors `AutomatedSystemSheet`'s `status` select, which also passes `""` for an empty value.)

- [ ] **Step 2: Create** `src/features/tech-component/components/TechComponentDeleteDialog.tsx`:

```tsx
import { Loader } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/create-crud-api";
import type { TechComponentDto } from "@/types/api";

import { techComponentApi } from "../api";

interface TechComponentDeleteDialogProps {
  techComponent: TechComponentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TechComponentDeleteDialog({
  techComponent,
  open,
  onOpenChange,
  onSuccess,
}: TechComponentDeleteDialogProps) {
  const mutation = useMutation({
    mutationFn: () => techComponentApi.remove(techComponent.id),
    onSuccess: () => {
      toast.success("Tech component deleted");
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Failed to delete tech component",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete tech component?</DialogTitle>
          <DialogDescription>
            {`"${techComponent.name}" (${techComponent.environment}) will be deleted, along with its links to nodes. This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && (
              <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

The wording is accurate: `node_tech_component_link_tech_component_fk` is `ON DELETE CASCADE` (verified 2026-09-24).

- [ ] **Step 3: Type-check, lint, commit**

```bash
npx tsc -b
npm run lint
git add src/features/tech-component/components
git commit -m "feat(tech-component): create/edit sheet and delete dialog

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```

Expected: clean.

---

### Task 9: Route, sidebar, end-to-end check

**Files:**
- Create: `src/routes/tech-component/index.tsx`
- Modify: `src/components/app-sidebar.tsx` (lucide import block, nav list lines 55–60)
- Modify: `docs/superpowers/specs/2026-09-24-tech-component-page-design.md` (status + delete note)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Create** `src/routes/tech-component/index.tsx`:

```tsx
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { AdvancedFilterToggle } from "@/components/data-table/advanced-filter-toggle";
import { Button } from "@/components/ui/button";

import { makeSwitchableSearch } from "@/lib/data-table/switchable-search";
import type { SwitchableSearchBase } from "@/lib/data-table/switchable-search";
import { makeSwitchableLoader } from "@/lib/data-table/switchable-page";
import { useSwitchableTablePage } from "@/hooks/use-switchable-table-page";
import { techComponentSwitchableConfig } from "@/features/tech-component/switchable-config";
import { TechComponentSheet } from "@/features/tech-component/components/TechComponentSheet";
import { TechComponentDeleteDialog } from "@/features/tech-component/components/TechComponentDeleteDialog";
import { validateTechComponentSimpleFields } from "./-simple-search";

export const Route = createFileRoute("/tech-component/")({
  // The generic call must stay inline: binding or wrapping it changes what
  // TanStack infers as this route's required search params.
  validateSearch: makeSwitchableSearch(validateTechComponentSimpleFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(techComponentSwitchableConfig),
  component: TechComponentPage,
});

function TechComponentPage() {
  // See the same assertion in routes/automated-system/index.tsx. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/tech-component/" });
  const queryClient = useQueryClient();

  const {
    table,
    advanced,
    count,
    rowAction,
    setRowAction,
    toggleMode,
    handleFilterChange,
  } = useSwitchableTablePage({
    config: techComponentSwitchableConfig,
    search,
    navigate,
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: techComponentSwitchableConfig.queryKey,
    });
    setRowAction(null);
  };

  const sheetOpen = rowAction?.variant === "create" || rowAction?.variant === "update";
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetComponent = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Tech Component
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tech Components</h1>
          <p className="mt-2 text-muted-foreground">{count} components</p>
        </div>
      </div>

      <DataTable table={table}>
        {advanced ? (
          <DataTableAdvancedToolbar
            table={table}
            filters={search.filters}
            joinOperator={search.joinOperator}
            onChange={handleFilterChange}
          >
            {actions}
          </DataTableAdvancedToolbar>
        ) : (
          <DataTableToolbar table={table}>{actions}</DataTableToolbar>
        )}
      </DataTable>

      {sheetOpen && (
        <TechComponentSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          techComponent={sheetComponent}
          variant={sheetVariant}
          onSuccess={handleSuccess}
        />
      )}

      {rowAction?.variant === "delete" && (
        <TechComponentDeleteDialog
          key={`delete-${rowAction.row.id}`}
          techComponent={rowAction.row}
          open
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the sidebar entry.** In `src/components/app-sidebar.tsx` add `Server,` to the `lucide-react` import list (lines 3–15, keep alphabetical order if the list is), and after `{ to: "/team", label: "Teams", icon: Users },` add:

```ts
  { to: "/tech-component", label: "Tech Components", icon: Server },
```

- [ ] **Step 3: Regenerate the route tree and verify**

```bash
npm run build
npm run lint
npx vitest run
```

Expected: `vite build` regenerates `src/routeTree.gen.ts` (do not hand-edit it) and succeeds; lint clean; all tests pass. If `tsc -b` inside `build` fails on the sidebar `to` type, it is because the route tree was stale — run `npm run dev -- --host` once to regenerate, then re-run `npm run build`.

- [ ] **Step 4: Manual check in the browser.** Start the backend with Task 2 built (see memory `backend-run-setup.md`; switch the vite proxy to `localhost:8080` if running both locally), then `npm run dev -- --host`, log in as `16674475` / `qweqweqwe`, open **Tech Components**:
  1. 30 rows; the 3 formerly-NULL rows show Automated System `Not set`.
  2. Simple filters: name, group, technology, environment (select `PROD` → only PROD), Automated System relation picker (pick `Not set` → 3 rows).
  3. Sort by Automated System asc/desc — no error.
  4. Advanced mode: an Automated System + Environment filter combination.
  5. Show the hidden Console URL column; a URL opens in a new tab.
  6. Create a component (`Not set` AS, environment `DEV`), edit it (change AS to a real one, clear Technology → saved as `""`), delete it via the row menu + confirm.
  7. Create a duplicate `(name, environment)` → error toast, sheet stays open.
  8. **Regression (Task 3):** open an Automated System whose leader is `Doe John` and save a text change — succeeds; open **Add Automated System**, submit without a leader → "Leader is required". Same two checks on **Teams**.

Report any failure with the step number rather than working around it.

- [ ] **Step 5: Update the spec.** In `docs/superpowers/specs/2026-09-24-tech-component-page-design.md`:
  - change `Status: approved design, not yet implemented` to `Status: implemented on feature/gm 2026-09-24`;
  - in the `components/TechComponentSheet.tsx` bullet, replace `create / update / delete (confirm)` with `create / update; delete is a row action with a confirm dialog (TechComponentDeleteDialog) — the first delete in the app`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/tech-component/index.tsx src/routeTree.gen.ts src/components/app-sidebar.tsx docs/superpowers/specs/2026-09-24-tech-component-page-design.md
git commit -m "feat(tech-component): Tech Components page and sidebar entry

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0125UDcCBxZjUT2eZwv4yjih"
```
