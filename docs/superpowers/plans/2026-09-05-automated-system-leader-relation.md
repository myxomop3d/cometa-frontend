# AutomatedSystem Leader Relation & Team-Style AS Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `AutomatedSystem` a real `leader` relation to `Person` (renaming the existing free-text `leader` to `leaderComment`), and rebuild `/automated-system` as a Team-style switchable DataTable page with a side Sheet.

**Architecture:** Backend — `AutomatedSystem` gains a `@ManyToOne(optional = false)` `Person leader` on the already-existing `leader_person_id` FK column, and the old `@Column(name = "leader") String leader` becomes `leaderComment` (Java-side rename only; the DB column keeps its name). The DTO splits into `AutomatedSystemFlatDto` (16 scalars) + `AutomatedSystemDto extends` it (adds `leader: PersonFlatDto`), and `AutomatedSystemMapper` gains `uses = PersonRefMapper.class` plus a `@Condition` guard on `Hibernate.isInitialized` so the flow-graph read path does not fire one `SELECT person` per node. Frontend — the pre-unification `SimpleTable` + `useFilters` + `editConfig` page is replaced by a new `src/features/automated-system/` module mirroring `src/features/team/`: `createCrudApi` against `/graph` with `$fields=leader`, filter descriptors carrying the to-one nav path `leader/id`, and a 17-field RHF sheet.

**Tech Stack:** Backend — Java 17, Spring Boot 4.0.6, MapStruct 1.5.5.Final, Lombok, Hibernate 7.2, odata-mini 2.2.0-SNAPSHOT, JUnit 5 + Mockito + AssertJ. Frontend — React 19, TypeScript 5.9, Vite 8, TanStack Router/Query/Table, react-hook-form + zod, Vitest 4, MSW 2.

**Spec:** `docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md` (read it alongside this plan)

---

## Global Constraints

- **Two repositories, never mixed in one commit.** Backend is `F:\programming\cometa` (branch `feature/gm`). Frontend is `F:\programming\react\cometa-frontend` (branch `feature/gm`).
- **`JAVA_HOME` must be set for every Maven and `javap` command:** `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`. The machine's default `java` is too old. PowerShell: `$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"`
- **Always build the backend from the ROOT reactor**, never a single module — a lone submodule build cannot resolve sibling SNAPSHOTs. Use `-pl <module> -am`.
- **Running a single backend test class also needs `-Dsurefire.failIfNoSpecifiedTests=false`**, otherwise the sibling modules built by `-am` fail the build before the target module is reached.
- **After ANY backend build that touches a mapper, verify MapStruct output is not corrupt.** This build has a documented failure mode where `*MapperImpl.class` is written *without* its `implements` clause while Maven reports BUILD SUCCESS; it surfaces only at runtime as `required a bean of type '...Mapper' that could not be found`:
  ```
  javap -v -cp cometa-service-module/target/classes ru.sberbank.cib.gmbus.service.mapper.AutomatedSystemMapperImpl | grep interfaces
  ```
  Must print `interfaces: 1`. `interfaces: 0` means the corruption is back — stop and investigate, do not proceed.
- **A one-off `testCompile` failure naming a class that exists on disk is known noise.** Re-run once with no source edits before investigating.
- **Stop any running `cometa-web-module-0.0.1-SNAPSHOT.jar` before `clean`**, or `maven-clean-plugin` fails on the locked file. Find it with `Get-CimInstance Win32_Process -Filter "Name='java.exe'"`.
- **Type-check the frontend with `npx tsc -b`, never `npx tsc --noEmit`.** The root tsconfig is solution-style, so the bare form silently checks nothing.
- **Frontend tests:** `npx vitest run`. Single file: `npx vitest run src/path/to/file.test.ts`. Lint: `npm run lint`.
- **Relation filter/sort spellings are `/`-separated, never `.`** — a dot is an ANTLR parse error. `leader` here is **to-one**, so it is both filterable (`leader/id eq N`) and sortable (`leader/lastName asc`); the `any()` last-clause/one-per-request restrictions apply only to to-many relations and do not apply here.
- **`$fields` on a single record is served by `GET graph/{id}` only.** `GET {id}` is the library's own handler and ignores the parameter.
- **No DB migration in this change.** `leader_person_id` and its FK `automated_system_leader_person_id_fkey` already exist and all 200 rows are populated.
- **Local run:** backend `SPRING_PROFILES_ACTIVE=local` + `DB_PASSWORD` from `F:\programming\cometa\.vscode\backend.env`; frontend `npm run dev -- --host` (the plain form is unreachable on this machine). Test login: sigmaLogin `16674475`, password `qweqweqwe`.
- **Commit after every task.** Each task's deliverable stands alone.

---

## File Structure

**Backend — `F:\programming\cometa`**

| File | Responsibility |
|---|---|
| `cometa-persistence-module/.../entity/AutomatedSystem.java` | *Modify.* `leader` (String) → `leaderComment`; add `@ManyToOne Person leader`. |
| `cometa-service-module/.../service/dto/AutomatedSystemFlatDto.java` | *Create.* The 16 scalars, no relations. |
| `cometa-service-module/.../service/dto/AutomatedSystemDto.java` | *Rewrite.* Extends the Flat DTO, adds `leader: PersonFlatDto`. |
| `cometa-service-module/.../service/mapper/AutomatedSystemMapper.java` | *Rewrite.* `uses = PersonRefMapper.class`, `@Condition` lazy guard, `toFlat(Person)`. |
| `cometa-service-module/.../service/mapper/annotation/IgnoreAutomatedSystemLinkedObjects.java` | *Delete.* Dead: never applied, targets a commented-out DTO field. |
| `cometa-service-module/src/test/.../service/mapper/AutomatedSystemMapperWriteTest.java` | *Create.* Pins the PATCH-body cases from spec §4. |
| `cometa-service-module/src/test/.../odata/ODataJpqlGenerationTest.java` | *Modify.* Pins the AS spellings `leader/id`, `leader/lastName`, `leaderComment`. |

`AutomatedSystemService` and `AutomatedSystemRestController` need **no changes** — both already extend the `EntityGraph*` bases and inherit the transactional `create`/`update`/`patch` that make a relation write safe under `open-in-view: false`.

**Frontend — `F:\programming\react\cometa-frontend`**

| File | Responsibility |
|---|---|
| `src/types/api.ts` | *Modify.* `AutomatedSystemFlatDto` + `AutomatedSystemDto`; `AutomatedSystemFilters` becomes a hand-written URL-param interface; the then-unused `Filters<T>` alias goes. |
| `src/features/automated-system/api.ts` | *Create.* `createCrudApi` on `/graph` with `$fields=leader`, plus `detailQueryOptions` on `graph/{id}`. |
| `src/features/automated-system/advanced-api.ts` | *Create.* `automatedSystemFieldByColumnId` + advanced-mode query options. |
| `src/features/automated-system/filter-descriptors.ts` | *Create.* 8 descriptors + `deriveColumnFiltersFromSearch`. |
| `src/features/automated-system/filter-descriptors.test.ts` | *Create.* Pins `leader/id eq N` and `$orderby=leader/lastName`. |
| `src/features/automated-system/schema.ts` | *Create.* zod form schema + `AutomatedSystemWritePayload`. |
| `src/features/automated-system/mappers.ts` | *Create.* `dtoToForm` / `formToCreate` / `formToPatch`. |
| `src/features/automated-system/mappers.test.ts` | *Create.* Pins leader-ref lifting and dirty-only patching. |
| `src/features/automated-system/row-action.ts` | *Create.* create/update row-action union. |
| `src/features/automated-system/columns.tsx` | *Create.* select · id · 17 data columns · actions. |
| `src/features/automated-system/switchable-config.ts` | *Create.* `SwitchableTableConfig` wiring, pinning, default visibility. |
| `src/features/automated-system/components/AutomatedSystemSheet.tsx` | *Create.* 17-field RHF form. |
| `src/routes/automated-system/-simple-search.ts` | *Create.* Validates the 8 simple URL params. |
| `src/routes/automated-system/index.tsx` | *Rewrite.* Near-copy of `src/routes/team/index.tsx`. |
| `src/api/automated-system.ts` | *Delete.* Superseded by the feature module. |
| `src/mocks/handlers/automated-system.ts` | *Delete.* The new page reads `/graph`, which no handler matches. |
| `src/mocks/handlers.ts` | *Modify.* Drop the AS handler import and spread. |
| `src/mocks/data/automated-systems.ts` | *Modify.* Migrate 103 fixture rows to the new DTO shape (kept — `mocks/data/nodes.ts` imports them). |
| `src/features/flow-graph/components/details-panel.tsx` | *Modify.* Line 108 renders `leaderComment`, not the object. |
| `CLAUDE.md` | *Modify.* Project-structure lines that name the deleted files. |

The sidebar entry (`src/components/app-sidebar.tsx:42`, `{ to: "/automated-system", label: "Automated Systems" }`) already exists and does **not** change. The route file must keep existing throughout — `to: "/automated-system"` is type-checked against the generated route tree.

---

## Why the frontend is a single task

Task 3 is large and deliberately not split. `AutomatedSystemDto.leader` changing from `string` to an object breaks `src/api/automated-system.ts`, the old route page, the MSW fixtures and the flow-graph details panel at the same moment. Any smaller slice leaves `npx tsc -b` red at a commit boundary. The task's internal red/green cycles are the two Vitest suites, which run per-file and do not need a whole-project type-check.

---

### Task 1: The `leader` relation on the entity, DTOs and mapper

**Files:**
- Modify: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/AutomatedSystem.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/AutomatedSystemFlatDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/AutomatedSystemDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapper.java`
- Delete: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/annotation/IgnoreAutomatedSystemLinkedObjects.java`
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapperWriteTest.java`

**Interfaces:**
- Consumes: `BaseRefMapper<E, R>.toRef(R)` (existing), `PersonRefMapper` (existing `@Component`), `PersonFlatDto` (existing, `extends BaseEntityDto` so it has `getId()`/`setId(Long)`), `CometaCommonMapperConfig` (existing — sets `NullValuePropertyMappingStrategy.IGNORE`, `componentModel = "spring"`, `InjectionStrategy.CONSTRUCTOR`).
- Produces:
  - `AutomatedSystem.getLeaderComment()` / `setLeaderComment(String)`; `AutomatedSystem.getLeader()` / `setLeader(Person)`.
  - `AutomatedSystemFlatDto extends BaseEntityDto` with the 16 scalar getter/setter pairs listed in Step 4.
  - `AutomatedSystemDto extends AutomatedSystemFlatDto` with `getLeader()` / `setLeader(PersonFlatDto)`.
  - `AutomatedSystemMapper.toFlat(Person) : PersonFlatDto`, and a generated `AutomatedSystemMapperImpl(PersonRefMapper)` constructor.

- [ ] **Step 1: Write the failing test**

Create `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapperWriteTest.java`:

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import ru.sberbank.cib.gmbus.entity.AutomatedSystem;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.service.dto.AutomatedSystemDto;
import ru.sberbank.cib.gmbus.service.dto.PersonFlatDto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Фиксирует семантику записи лидера АС — таблицу из раздела 4
 * cometa-frontend/docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md:
 *   leader отсутствует / null — не менять;
 *   leader = {"id": 5}        — назначить person 5;
 *   лишние поля ссылки        — молча игнорируются;
 *   leader = {}               — IllegalArgumentException, а НЕ "снять связь".
 *
 * Проверяется СГЕНЕРИРОВАННЫЙ AutomatedSystemMapperImpl, потому что именно в
 * нём MapStruct материализует эту семантику из
 * NullValuePropertyMappingStrategy.IGNORE.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AutomatedSystemMapperWriteTest {

    @Mock PersonRefMapper personRefMapper;

    AutomatedSystemMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new AutomatedSystemMapperImpl(personRefMapper);
        // Стаб повторяет контракт BaseRefMapper.toRef: null -> null,
        // объект без id -> IllegalArgumentException, иначе ссылка по id.
        when(personRefMapper.toRef(any())).thenAnswer(inv -> {
            PersonFlatDto ref = inv.getArgument(0);
            if (ref == null) return null;
            if (ref.getId() == null) throw new IllegalArgumentException("Person reference has no id");
            Person p = new Person();
            ReflectionTestUtils.setField(p, "id", ref.getId());
            return p;
        });
    }

    private static PersonFlatDto ref(long id) {
        PersonFlatDto dto = new PersonFlatDto();
        dto.setId(id);
        return dto;
    }

    private static AutomatedSystem systemWithLeader(long personId) {
        AutomatedSystem as = new AutomatedSystem();
        Person p = new Person();
        ReflectionTestUtils.setField(p, "id", personId);
        as.setLeader(p);
        return as;
    }

    @Test
    void createResolvesTheLeaderRefToAnEntity() {
        AutomatedSystemDto dto = new AutomatedSystemDto();
        dto.setName("Aspect");
        dto.setLeader(ref(5L));

        AutomatedSystem entity = mapper.fromDto(dto);

        assertThat(entity.getLeader()).isNotNull();
        assertThat(entity.getLeader().getId()).isEqualTo(5L);
    }

    @Test
    void leaderCommentMapsByNameOntoTheRenamedField() {
        AutomatedSystemDto dto = new AutomatedSystemDto();
        dto.setLeaderComment("Филина Е. М. (806025)");

        AutomatedSystem entity = mapper.fromDto(dto);

        assertThat(entity.getLeaderComment()).isEqualTo("Филина Е. М. (806025)");
    }

    @Test
    void absentLeaderLeavesItUntouched() {
        AutomatedSystem target = systemWithLeader(5L);
        AutomatedSystemDto patch = new AutomatedSystemDto();
        patch.setName("Переименована");

        mapper.update(patch, target);

        assertThat(target.getLeader().getId()).isEqualTo(5L);
        assertThat(target.getName()).isEqualTo("Переименована");
    }

    @Test
    void explicitNullLeaderLeavesItUntouched() {
        // NullValuePropertyMappingStrategy.IGNORE: снять NOT NULL связь нельзя
        // по определению, и null не должен обнулять её молча.
        AutomatedSystem target = systemWithLeader(5L);
        AutomatedSystemDto patch = new AutomatedSystemDto();
        patch.setLeader(null);

        mapper.update(patch, target);

        assertThat(target.getLeader().getId()).isEqualTo(5L);
    }

    @Test
    void patchReplacesTheLeader() {
        AutomatedSystem target = systemWithLeader(5L);
        AutomatedSystemDto patch = new AutomatedSystemDto();
        patch.setLeader(ref(9L));

        mapper.update(patch, target);

        assertThat(target.getLeader().getId()).isEqualTo(9L);
    }

    @Test
    void onlyTheIdOfARefIsHonoured() {
        // personRefMapper здесь замокан, и стаб никогда не читает lastName —
        // поэтому тест доказывает узкую, но реальную вещь: что
        // AutomatedSystemMapperImpl делегирует весь PersonFlatDto в
        // personRefMapper.toRef(...), а не копирует поля ссылки сам (типичная
        // MapStruct-регрессия). Правило id-only целиком доказывает
        // BaseRefMapperTest.
        PersonFlatDto refWithName = ref(5L);
        refWithName.setLastName("Переименован");
        AutomatedSystemDto dto = new AutomatedSystemDto();
        dto.setLeader(refWithName);

        AutomatedSystem entity = mapper.fromDto(dto);

        assertThat(entity.getLeader().getLastName()).isNull();
    }

    @Test
    void refWithoutIdIsRejectedRatherThanReadAsClear() {
        AutomatedSystemDto dto = new AutomatedSystemDto();
        dto.setLeader(new PersonFlatDto());

        assertThatThrownBy(() -> mapper.fromDto(dto))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
.\mvnw -pl cometa-service-module -am test -Dtest=AutomatedSystemMapperWriteTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: COMPILATION ERROR — `constructor AutomatedSystemMapperImpl in class AutomatedSystemMapperImpl cannot be applied to given types` (today's generated impl takes no arguments), plus `cannot find symbol: method setLeaderComment(java.lang.String)` and `setLeader(PersonFlatDto)`.

- [ ] **Step 3: Rename the text field and add the relation on the entity**

In `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/AutomatedSystem.java`, add one import below the existing `import jakarta.persistence.*;` (the entity is in `…gmbus.entity`, `Person` in `…gmbus.entity.auth`):

```java
import ru.sberbank.cib.gmbus.entity.auth.Person;
```

Replace this block:

```java
    /**
     * Лид.
     */
    @Column(name = "leader")
    private String leader;
```

with:

```java
    /**
     * Лид (текстовый комментарий). Историческое поле; колонка в БД осталась `leader`.
     */
    @Column(name = "leader")
    private String leaderComment;

    /**
     * Лидер АС (физическое лицо).
     *
     * optional = false + nullable = false повторяют маппинг Team.leader на ту же
     * целевую сущность. Миграция не нужна: колонка leader_person_id и её FK уже
     * существуют, и все 200 строк заполнены (живая БД, 2026-09-04).
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "leader_person_id", nullable = false)
    private Person leader;
```

- [ ] **Step 4: Create the Flat DTO**

Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/AutomatedSystemFlatDto.java`:

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

/**
 * Плоское представление АС: все скаляры AutomatedSystem и ни одной связи.
 * При использовании как ссылки читался бы ТОЛЬКО id.
 *
 * На день один ни одно поле не типизировано этим классом — это не мёртвый код,
 * а класс, который держит 16 скаляров и от которого наследуется
 * AutomatedSystemDto. Осознанное решение, см. раздел "Rejected" в
 * cometa-frontend/docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md
 *
 * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
 */
@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class AutomatedSystemFlatDto extends BaseEntityDto {

    private String name; // Название автоматизированной системы.
    private String objectCode; // Код объекта.
    private String fullName; // Полное название.
    private String ci; // CI (Configuration Item).
    private String nameHpsm; // Название в HPSM.
    private String leaderComment; // Лид (текстовый комментарий); колонка в БД — `leader`.
    private String leaderSapId; // SAP ID лидера.
    private String block; // Блок.
    private String tribe; // Триба.
    private String cluster; // Кластер.
    private String clusterHpsmId; // ID кластера в HPSM.
    private String status; // Статус.
    private String iftMailSupport; // Email поддержки для окружения IFT.
    private String uatMailSupport; // Email поддержки для окружения UAT.
    private String prodMailSupport; // Email поддержки для окружения PROD.
    private String guid; // GUID.

}
```

- [ ] **Step 5: Reduce `AutomatedSystemDto` to the Flat DTO plus the relation**

Replace the whole of `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/AutomatedSystemDto.java`:

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class AutomatedSystemDto extends AutomatedSystemFlatDto {

    /**
     * Лидер АС.
     *
     * ЧТЕНИЕ: заполняется только при ?$fields=leader — иначе @Condition в
     * маппере оставляет null, чтобы не будить ленивый прокси (иначе N+1 на
     * пути flow-graph).
     *
     * ЗАПИСЬ: учитывается ТОЛЬКО id.
     */
    private PersonFlatDto leader;

//    private Long clientCertificateId; // Ссылка на клиентский сертификат (опционально).

}
```

- [ ] **Step 6: Rewrite the mapper**

Replace `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapper.java`:

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.hibernate.Hibernate;
import org.mapstruct.Condition;
import org.mapstruct.Mapper;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.AutomatedSystem;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.service.dto.AutomatedSystemDto;
import ru.sberbank.cib.gmbus.service.dto.PersonFlatDto;

@Mapper(config = CometaCommonMapperConfig.class, uses = PersonRefMapper.class)
public interface AutomatedSystemMapper extends BaseCrudMapper<AutomatedSystem, AutomatedSystemDto> {

    /**
     * Не инициализировать ленивый прокси лидера при маппинге в DTO —
     * без ?$fields=leader вложенный leader останется null вместо N+1.
     * Важнее всего на пути FlowGraphService: его граф тянет только
     * "automatedSystem", поэтому automatedSystem.leader там всегда прокси, и
     * без этого условия каждый узел графа стоил бы одного SELECT person.
     */
    @Condition
    default boolean isEntityLoaded(Person person) {
        return Hibernate.isInitialized(person);
    }

    /** Направление чтения: Person -> PersonFlatDto. Запись идёт через PersonRefMapper. */
    PersonFlatDto toFlat(Person person);
}
```

- [ ] **Step 7: Delete the dead annotation**

```
git rm cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/annotation/IgnoreAutomatedSystemLinkedObjects.java
```

Confirm nothing referenced it — expect no output:

```
grep -rn "IgnoreAutomatedSystemLinkedObjects" --include=*.java . | grep -v "/target/"
```

- [ ] **Step 8: Run the test to verify it passes**

```
.\mvnw -pl cometa-service-module -am test -Dtest=AutomatedSystemMapperWriteTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `Tests run: 7, Failures: 0, Errors: 0`.

If it fails with `constructor AutomatedSystemMapperImpl cannot be applied`, read the generated constructor and match the test's `new AutomatedSystemMapperImpl(...)` call to it:

```
type cometa-service-module\target\generated-sources\annotations\ru\sberbank\cib\gmbus\service\mapper\AutomatedSystemMapperImpl.java
```

- [ ] **Step 9: Verify the generated mapper is not corrupt**

```
javap -v -cp cometa-service-module/target/classes ru.sberbank.cib.gmbus.service.mapper.AutomatedSystemMapperImpl | grep interfaces
```

Expected: `interfaces: 1`. `interfaces: 0` — stop; the MapStruct fork corruption is back and the app will fail at runtime with "required a bean of type AutomatedSystemMapper".

- [ ] **Step 10: Run the whole module suite**

```
.\mvnw -pl cometa-service-module -am test
```

Expected: BUILD SUCCESS, with no regression in `PersonMapperWriteTest`, `BaseRefMapperTest` or `ODataJpqlGenerationTest`.

- [ ] **Step 11: Commit**

```bash
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/AutomatedSystem.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/AutomatedSystemFlatDto.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/AutomatedSystemDto.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapper.java \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/annotation/IgnoreAutomatedSystemLinkedObjects.java \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapperWriteTest.java
git commit -m "feat(automated-system): add the leader relation, rename the text field to leaderComment"
```

---

### Task 2: Pin the AS OData spellings

**Files:**
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/ODataJpqlGenerationTest.java`

**Interfaces:**
- Consumes: `AutomatedSystem` + `AutomatedSystemDto` from Task 1; `OData2Jpql(Class<?> entity, Class<?> dto)` with `parseFilterConditions(String, String rootAlias, Object)` and `parseOrderByConditions(String, String rootAlias, Object)` (both already used by this test class).
- Produces: nothing consumed by later tasks — this pins the wire spellings Task 3's `filter-descriptors.ts` emits.

Why it is separate from Task 1: this is the contract between the two repos, and a reviewer can accept the mapper while rejecting (or asking for more of) the query-spelling coverage.

- [ ] **Step 1: Write the failing tests**

In `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/ODataJpqlGenerationTest.java`, add these imports next to the existing ones:

```java
import ru.sberbank.cib.gmbus.entity.AutomatedSystem;
import ru.sberbank.cib.gmbus.service.dto.AutomatedSystemDto;
```

Add this factory beside the existing `team()` / `person()` helpers:

```java
    private OData2Jpql automatedSystem() {
        return new OData2Jpql(AutomatedSystem.class, AutomatedSystemDto.class);
    }
```

And append these three tests at the end of the class:

```java
    @Test
    void automatedSystemLeaderIdFilterOmitsRootAlias() {
        // Спеллинг, который эмиттит filter-descriptors.ts фронтенда для
        // фильтра по лидеру АС. Как и у Team, корневой алиас не
        // подставляется — Hibernate разрешает путь по единственному root'у.
        assertEquals("leader.id = 30",
                automatedSystem().parseFilterConditions("leader/id eq 30", "AutomatedSystem", null));
    }

    @Test
    void automatedSystemLeaderOrderByOmitsRootAlias() {
        assertEquals("leader.lastName desc",
                automatedSystem().parseOrderByConditions("leader/lastName desc", "AutomatedSystem", null));
    }

    @Test
    void automatedSystemLeaderCommentFilterUsesTheRenamedField() {
        // Переименование Java-поля leader -> leaderComment должно доехать до
        // JPQL: колонка в БД осталась `leader`, но фильтр строится по имени
        // поля сущности.
        assertEquals("LOWER(AutomatedSystem.leaderComment) LIKE LOWER('%фил%')",
                automatedSystem().parseFilterConditions(
                        "contains_ignoring_case(leaderComment, 'фил')", "AutomatedSystem", null));
    }
```

- [ ] **Step 2: Run the test class to verify the new tests fail**

```
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
.\mvnw -pl cometa-service-module -am test -Dtest=ODataJpqlGenerationTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected before Task 1 is present: compilation error. With Task 1 already committed, run this step anyway and record what it prints — the three assertions are pinning observed library behaviour, so if one already passes, that is the expected value confirmed, and if one fails, the **actual** string it reports is the truth.

- [ ] **Step 3: Reconcile the expected strings with what odata-mini actually emits**

If any assertion fails, replace the expected string with the actual one from the failure output and add a one-line comment saying it was read off the library rather than assumed. Do **not** change the *input* spellings (`leader/id`, `leader/lastName`, `leaderComment`) — those are the contract the frontend emits, and if the library rejects them that is a design failure to write up, not a test to loosen.

- [ ] **Step 4: Run the test class to verify it passes**

```
.\mvnw -pl cometa-service-module -am test -Dtest=ODataJpqlGenerationTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `Tests run: 12, Failures: 0, Errors: 0` (9 existing + 3 new). Library `WARN … field 'x.id' doesn't exist` lines in the output are known, expected noise from the deliberately disabled `throw-on-field-not-found` flag.

- [ ] **Step 5: Commit**

```bash
git add cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/ODataJpqlGenerationTest.java
git commit -m "test(odata): pin the AutomatedSystem leader nav-path and leaderComment spellings"
```

---

### Task 3: The frontend swap — types, feature module, page

**Files:**
- Modify: `src/types/api.ts:48-80` (the `AutomatedSystemDto` block and the `Filters<T>` / `AutomatedSystemFilters` lines)
- Modify: `src/mocks/data/automated-systems.ts` (103 rows, scripted)
- Modify: `src/mocks/handlers.ts`
- Delete: `src/mocks/handlers/automated-system.ts`
- Modify: `src/features/flow-graph/components/details-panel.tsx:108`
- Create: `src/features/automated-system/filter-descriptors.ts`
- Create: `src/features/automated-system/schema.ts`
- Create: `src/features/automated-system/mappers.ts`
- Create: `src/features/automated-system/advanced-api.ts`
- Create: `src/features/automated-system/api.ts`
- Create: `src/features/automated-system/row-action.ts`
- Create: `src/features/automated-system/columns.tsx`
- Create: `src/features/automated-system/switchable-config.ts`
- Create: `src/features/automated-system/components/AutomatedSystemSheet.tsx`
- Create: `src/routes/automated-system/-simple-search.ts`
- Rewrite: `src/routes/automated-system/index.tsx`
- Delete: `src/api/automated-system.ts`
- Modify: `CLAUDE.md`
- Test: `src/features/automated-system/filter-descriptors.test.ts`
- Test: `src/features/automated-system/mappers.test.ts`

**Interfaces:**
- Consumes (all existing, unchanged):
  - `createCrudApi<TDto, TFilters, TWritePayload>({ basePath, listPath?, queryKey, filterDescriptors, staticParams? })` and `apiFetch<T>(input, init?)`, `ApiError` — from `@/lib/api/create-crud-api`. The returned object has `fetchList`, `fetchOne`, `create`, `patch`, `remove`, `listQueryOptions`, `detailQueryOptions`, `dataTableQueryOptions`.
  - `FilterDescriptor { id: string; field?: string; sortField?: string; variant: FilterVariant }` and `buildFilterParams({ page, pageSize, sort, columnFilters, descriptors, onLambdaCapped })` — from `@/lib/odata/build-filter-params`.
  - `FieldEntry { field: string; sortField?: string; variant: FilterVariant }` and `buildAdvancedFilterParams(...)` — from `@/lib/odata/build-advanced-filter-params`.
  - `notifyLambdaCapped` — from `@/lib/odata/notify-lambda-capped`.
  - `SwitchableTableConfig<TDto, TRowAction>` and `makeSwitchableLoader` — from `@/lib/data-table/switchable-page`.
  - `makeSwitchableSearch`, `SwitchableSearchBase` — from `@/lib/data-table/switchable-search`.
  - `useSwitchableTablePage({ config, search, navigate })` — from `@/hooks/use-switchable-table-page`; returns `{ table, advanced, count, rowAction, setRowAction, toggleMode, handleFilterChange }`.
  - `personsFilteredQueryOptions(filters: Record<string, unknown>)` — from `@/features/person/api`.
  - `personLabel(person: PersonFlatDto): string` — from `@/features/person/label`.
  - `PersonCombobox({ value: number | null, onChange: (id: number | null) => void })` — from `@/features/person/components/PersonCombobox`.
- Produces (names later steps and Task 4 rely on):
  - `AutomatedSystemFlatDto`, `AutomatedSystemDto`, `AutomatedSystemFilters` in `@/types/api`.
  - `automatedSystemFilterDescriptors`, `deriveColumnFiltersFromSearch(search)` in `filter-descriptors.ts`.
  - `automatedSystemFormSchema`, `AutomatedSystemFormValues`, `AutomatedSystemWritePayload` in `schema.ts`.
  - `automatedSystemDtoToForm(dto)`, `automatedSystemFormToCreate(v)`, `automatedSystemFormToPatch(v, dirty)` in `mappers.ts`.
  - `automatedSystemFieldByColumnId`, `advancedDataTableQueryOptions(params)` in `advanced-api.ts`.
  - `automatedSystemApi` in `api.ts`.
  - `AutomatedSystemRowAction` in `row-action.ts`.
  - `getAutomatedSystemColumns({ setRowAction })` in `columns.tsx`.
  - `automatedSystemSimpleFilterKeys`, `automatedSystemSwitchableConfig` in `switchable-config.ts`.
  - `AutomatedSystemSheet` in `components/AutomatedSystemSheet.tsx`.
  - `validateAutomatedSystemSimpleFields(search)` in `src/routes/automated-system/-simple-search.ts`.

- [ ] **Step 1: Change the DTO types**

In `src/types/api.ts`, replace the whole `// AutomatedSystem` block (lines 48–66 today) with:

```ts
// AutomatedSystem
/** Flat = every scalar of the entity, none of its relations. On day one no
 *  field is typed as this: it is the interface holding the 16 scalars, which
 *  AutomatedSystemDto extends. Not dead code — see the "Rejected" section of
 *  docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md */
export interface AutomatedSystemFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string;
  objectCode: string | null;
  fullName: string;
  ci: string;
  nameHpsm: string | null;
  /** Historical free-text lead. The DB column is still named `leader`;
   *  only the Java field and this DTO field were renamed. */
  leaderComment: string | null;
  leaderSapId: string | null;
  block: string;
  tribe: string;
  cluster: string;
  clusterHpsmId: string | null;
  status: string | null;
  iftMailSupport: string | null;
  uatMailSupport: string | null;
  prodMailSupport: string | null;
  guid: string | null;
}

export interface AutomatedSystemDto extends AutomatedSystemFlatDto {
  /** Read: populated only with ?$fields=leader. Write: only `id`.
   *  NOT NULL in the DB, yet null on any read that omits $fields. */
  leader: PersonFlatDto | null;
}
```

Then replace these two lines (79–80 today):

```ts
export type Filters<T> = Partial<T & PaginationParams>;
export type AutomatedSystemFilters = Filters<AutomatedSystemDto>;
```

with:

```ts
/** URL search-param names, not DTO fields — the generic `Filters<AutomatedSystemDto>`
 *  form could not survive `leader` becoming an object, and filter keys are URL
 *  contract. Same shape as `TeamFilters` below. */
export interface AutomatedSystemFilters extends Partial<PaginationParams> {
  name?: string;
  ci?: string;
  block?: string;
  tribe?: string;
  cluster?: string;
  status?: string;
  leaderComment?: string;
  /** URL search-param name, not a DTO field. */
  leaderId?: number;
}
```

`Filters<T>` had exactly one consumer and is now unused. Confirm before deleting it — expect the only hits to be `useFilters.ts:9` (`export function useFilters<`, a different symbol) and the line being deleted:

```
grep -rn "Filters<" src --include=*.ts --include=*.tsx
```

Also fix the stale comment two lines below, which reads "…unlike `AutomatedSystemFilters`": change it to "…unlike a DTO-derived filter type."

- [ ] **Step 2: Migrate the MSW fixtures**

`src/mocks/data/automated-systems.ts` holds 103 rows and is imported by `src/mocks/data/nodes.ts`, so it is migrated, not deleted. Run these two `sed` commands **in this order** — the rename must happen before the insertion, or the newly inserted `leader: null` lines would be renamed too:

```bash
sed -i 's/^    leader: /    leaderComment: /' src/mocks/data/automated-systems.ts
sed -i 's/^    id: \([0-9]*\),$/    id: \1,\n    insertedAt: null,\n    updatedAt: null,\n    leader: null,/' src/mocks/data/automated-systems.ts
```

Verify the counts — all three must print `103`:

```bash
grep -c "^    leaderComment: " src/mocks/data/automated-systems.ts
grep -c "^    leader: null,"  src/mocks/data/automated-systems.ts
grep -c "^    insertedAt: null," src/mocks/data/automated-systems.ts
```

Every added field is required in `AutomatedSystemDto`, so the `npx tsc -b` gate in Step 21 proves the migration is complete.

- [ ] **Step 3: Fix the flow-graph details panel**

`src/features/flow-graph/components/details-panel.tsx:108` renders the old string as a React child and is the one production line the DTO change breaks. Replace:

```tsx
          <FieldRow label="Leader">{node.automatedSystem.leader}</FieldRow>
```

with:

```tsx
          <FieldRow label="Leader">{node.automatedSystem.leaderComment ?? "—"}</FieldRow>
```

No row is added for the related person: on the flow-graph path `leader` is always `null` (the mapper's `@Condition` guard), so such a row would be permanently empty. `custom-node.tsx` reads only `.name` and is untouched.

`NodeDto.automatedSystem` stays typed as `AutomatedSystemDto` — do **not** narrow it to `AutomatedSystemFlatDto`. The Flat type exists to break cycles and there is no cycle here (`PersonFlatDto` has no relations, so `automatedSystem.leader` is already a leaf); the N+1 risk is handled by the mapper's `@Condition`, exactly as `TeamMapper` and `PersonMapper` already do. Narrowing would change a DTO that four flow-graph modules read. See the "Rejected" section of the design doc.

- [ ] **Step 4: Drop the MSW handler**

```bash
git rm src/mocks/handlers/automated-system.ts
```

In `src/mocks/handlers.ts`, delete the import line `import { automatedSystemHandlers } from "./handlers/automated-system";` and the `...automatedSystemHandlers,` entry from the `handlers` array.

The new page lists from `/api/v1/automated-system/graph`, which no handler matches, and there is no `/graph` handler anywhere in `src/mocks/`. Consequence, and it is intended: with `VITE_MOCK_API=true` the AS page no longer works, exactly as `/team` and `/person` already do not. Node and flow-graph mocks are unaffected because they consume the fixtures directly.

- [ ] **Step 5: Write the failing filter-descriptor test**

Create `src/features/automated-system/filter-descriptors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFilterParams } from "@/lib/odata/build-filter-params";
import {
  automatedSystemFilterDescriptors,
  deriveColumnFiltersFromSearch,
} from "./filter-descriptors";

function build(sort?: string, columnFilters: { id: string; value: unknown }[] = []) {
  return buildFilterParams({
    page: 1,
    pageSize: 10,
    sort,
    columnFilters,
    descriptors: automatedSystemFilterDescriptors,
  });
}

describe("automated system leader relation filter", () => {
  it("filters the leader through the to-one navigation path", () => {
    const p = build(undefined, [{ id: "leader", value: 30 }]);
    expect(p.get("$filter")).toBe("leader/id eq 30");
  });

  it("sorts by the leader's surname through the navigation path", () => {
    expect(build("leader.asc").get("$orderby")).toBe("leader/lastName asc");
    expect(build("leader.desc").get("$orderby")).toBe("leader/lastName desc");
  });
});

describe("automated system scalar filters", () => {
  it("uses contains_ignoring_case for the renamed leaderComment field", () => {
    const p = build(undefined, [{ id: "leaderComment", value: "фил" }]);
    expect(p.get("$filter")).toBe("contains_ignoring_case(leaderComment, 'фил')");
  });

  it("uses eq for status", () => {
    const p = build(undefined, [{ id: "status", value: ["Выведен из эксплуатации"] }]);
    expect(p.get("$filter")).toBe("status eq 'Выведен из эксплуатации'");
  });
});

describe("deriveColumnFiltersFromSearch", () => {
  it("maps URL param names onto column ids, wrapping select values in an array", () => {
    expect(
      deriveColumnFiltersFromSearch({
        name: "Aspect",
        leaderId: 30,
        status: ["Находится в эксплуатации"],
      }),
    ).toEqual([
      { id: "name", value: "Aspect" },
      { id: "status", value: ["Находится в эксплуатации"] },
      { id: "leader", value: 30 },
    ]);
  });

  it("ignores params that are absent", () => {
    expect(deriveColumnFiltersFromSearch({})).toEqual([]);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```
npx vitest run src/features/automated-system/filter-descriptors.test.ts
```

Expected: FAIL — `Failed to resolve import "./filter-descriptors"`.

- [ ] **Step 7: Write the filter descriptors**

Create `src/features/automated-system/filter-descriptors.ts`:

```ts
import type { FilterDescriptor } from "@/lib/odata/build-filter-params";

export interface AutomatedSystemFilterDescriptor extends FilterDescriptor {
  /** URL search-param name. NEVER rename one of these — bookmarked URLs break. */
  filterKey?: string;
}

export const automatedSystemFilterDescriptors: readonly AutomatedSystemFilterDescriptor[] = [
  { id: "name", variant: "text", filterKey: "name" },
  { id: "ci", variant: "text", filterKey: "ci" },
  // block/tribe/cluster stay free text on purpose: their distinct-value counts
  // (16 / 32 / 45) are unbounded in principle, and a faceted select would
  // silently hide any value added later.
  { id: "block", variant: "text", filterKey: "block" },
  { id: "tribe", variant: "text", filterKey: "tribe" },
  { id: "cluster", variant: "text", filterKey: "cluster" },
  { id: "status", variant: "select", filterKey: "status" },
  { id: "leaderComment", variant: "text", filterKey: "leaderComment" },
  {
    id: "leader",
    variant: "relation",
    // To-one relation: a navigation path with `/`, never a dot (a dot is an
    // ANTLR parse error). Filterable AND sortable — the any() restrictions
    // apply only to to-many relations. Requires
    // odata.mini.repo.throw-on-field-not-found: false on the backend.
    field: "leader/id",
    sortField: "leader/lastName",
    filterKey: "leaderId",
  },
] as const;

export function deriveColumnFiltersFromSearch(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  const filters: { id: string; value: unknown }[] = [];
  for (const d of automatedSystemFilterDescriptors) {
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

- [ ] **Step 8: Run it to verify it passes**

```
npx vitest run src/features/automated-system/filter-descriptors.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 9: Write the failing mapper test**

Create `src/features/automated-system/mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { AutomatedSystemDto } from "@/types/api";
import {
  automatedSystemDtoToForm,
  automatedSystemFormToCreate,
  automatedSystemFormToPatch,
} from "./mappers";
import type { AutomatedSystemFormValues } from "./schema";

const dto: AutomatedSystemDto = {
  id: 1451,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  name: "Aspect",
  objectCode: "aspect",
  fullName: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  ci: "CI01776490",
  nameHpsm: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  leaderComment: "Берестов Р. В. (801690)",
  leaderSapId: null,
  block: "Финансы",
  tribe: "Digital Accounting",
  cluster: "Департамент финансов (115147)",
  clusterHpsmId: null,
  status: "Находится в эксплуатации",
  iftMailSupport: null,
  uatMailSupport: null,
  prodMailSupport: null,
  guid: null,
  leader: {
    id: 99,
    insertedAt: null,
    updatedAt: null,
    email: "berestov@example.com",
    lastName: "Берестов",
    firstName: "Роман",
    middleName: "Владимирович",
  },
};

const form: AutomatedSystemFormValues = {
  name: "Aspect",
  objectCode: "aspect",
  fullName: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  ci: "CI01776490",
  nameHpsm: "Учёт сделок с физическими товарами Commodity Trading (Aspect)",
  leaderId: 99,
  leaderComment: "Берестов Р. В. (801690)",
  leaderSapId: null,
  block: "Финансы",
  tribe: "Digital Accounting",
  cluster: "Департамент финансов (115147)",
  clusterHpsmId: null,
  status: "Находится в эксплуатации",
  iftMailSupport: null,
  uatMailSupport: null,
  prodMailSupport: null,
  guid: null,
};

describe("automatedSystemDtoToForm", () => {
  it("lifts leaderId out of the nested leader ref", () => {
    expect(automatedSystemDtoToForm(dto)).toEqual(form);
  });

  it("yields leaderId 0 when leader is absent, so the form flags it required", () => {
    // Happens on any read that omitted $fields=leader.
    const bare: AutomatedSystemDto = { ...dto, leader: null };
    expect(automatedSystemDtoToForm(bare).leaderId).toBe(0);
  });
});

describe("automatedSystemFormToCreate", () => {
  it("writes the leader as a ref, not a scalar, and keeps leaderComment separate", () => {
    const payload = automatedSystemFormToCreate(form);
    expect(payload.leader).toEqual({ id: 99 });
    expect(payload.leaderComment).toBe("Берестов Р. В. (801690)");
    expect(payload.name).toBe("Aspect");
  });
});

describe("automatedSystemFormToPatch", () => {
  it("returns only dirty fields, with the leader as a ref", () => {
    expect(automatedSystemFormToPatch(form, { leaderId: true })).toEqual({
      leader: { id: 99 },
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(automatedSystemFormToPatch(form, {})).toEqual({});
  });

  it("includes explicit nulls for cleared nullable fields", () => {
    const cleared: AutomatedSystemFormValues = { ...form, leaderComment: null };
    expect(automatedSystemFormToPatch(cleared, { leaderComment: true })).toEqual({
      leaderComment: null,
    });
  });

  it("never emits leaderComment when only the relation changed", () => {
    const patch = automatedSystemFormToPatch(form, { leaderId: true });
    expect(patch).not.toHaveProperty("leaderComment");
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

```
npx vitest run src/features/automated-system/mappers.test.ts
```

Expected: FAIL — `Failed to resolve import "./mappers"`.

- [ ] **Step 11: Write the schema and the mappers**

Create `src/features/automated-system/schema.ts`:

```ts
import { z } from "zod";

/** Every optional text field behaves the same: "" from an emptied input
 *  becomes null, so a cleared field patches as an explicit null. */
const nullableText = () =>
  z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v));

/**
 * Mirrors the database, not the old inline editor. Only `name` and `leader`
 * are NOT NULL, so only those two are required. The previous inline-edit
 * schema also demanded fullName/ci(min 5)/block/tribe/cluster — rules stricter
 * than the data itself: five live rows have `length(ci) < 5` and so could not
 * be saved at all. See §6 of the design doc.
 */
export const automatedSystemFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: nullableText(),
  fullName: nullableText(),
  ci: nullableText(),
  nameHpsm: nullableText(),
  /** 0 is never a valid id, so positive() reports "Leader is required". */
  leaderId: z
    .number({ error: "Leader is required" })
    .int()
    .positive("Leader is required"),
  leaderComment: nullableText(),
  leaderSapId: nullableText(),
  block: nullableText(),
  tribe: nullableText(),
  cluster: nullableText(),
  clusterHpsmId: nullableText(),
  status: nullableText(),
  iftMailSupport: nullableText(),
  uatMailSupport: nullableText(),
  prodMailSupport: nullableText(),
  guid: nullableText(),
});

export type AutomatedSystemFormValues = z.infer<typeof automatedSystemFormSchema>;

export interface AutomatedSystemWritePayload {
  name: string;
  objectCode: string | null;
  fullName: string | null;
  ci: string | null;
  nameHpsm: string | null;
  /** Relation ref: only `id` is honoured by the server. `{}` is rejected with
   *  IllegalArgumentException, and clearing is impossible — the FK is NOT NULL. */
  leader: { id: number };
  leaderComment: string | null;
  leaderSapId: string | null;
  block: string | null;
  tribe: string | null;
  cluster: string | null;
  clusterHpsmId: string | null;
  status: string | null;
  iftMailSupport: string | null;
  uatMailSupport: string | null;
  prodMailSupport: string | null;
  guid: string | null;
}
```

Create `src/features/automated-system/mappers.ts`:

```ts
import type { AutomatedSystemDto } from "@/types/api";
import type {
  AutomatedSystemFormValues,
  AutomatedSystemWritePayload,
} from "./schema";

export function automatedSystemDtoToForm(
  dto: AutomatedSystemDto,
): AutomatedSystemFormValues {
  return {
    name: dto.name,
    objectCode: dto.objectCode,
    fullName: dto.fullName,
    ci: dto.ci,
    nameHpsm: dto.nameHpsm,
    // The leader's id arrives only inside the nested ref, present only on
    // reads that requested $fields=leader. 0 is never a valid id, so the
    // required-positive rule in the schema rejects it.
    leaderId: dto.leader?.id ?? 0,
    leaderComment: dto.leaderComment,
    leaderSapId: dto.leaderSapId,
    block: dto.block,
    tribe: dto.tribe,
    cluster: dto.cluster,
    clusterHpsmId: dto.clusterHpsmId,
    status: dto.status,
    iftMailSupport: dto.iftMailSupport,
    uatMailSupport: dto.uatMailSupport,
    prodMailSupport: dto.prodMailSupport,
    guid: dto.guid,
  };
}

export function automatedSystemFormToCreate(
  v: AutomatedSystemFormValues,
): AutomatedSystemWritePayload {
  return {
    name: v.name,
    objectCode: v.objectCode,
    fullName: v.fullName,
    ci: v.ci,
    nameHpsm: v.nameHpsm,
    leader: { id: v.leaderId },
    leaderComment: v.leaderComment,
    leaderSapId: v.leaderSapId,
    block: v.block,
    tribe: v.tribe,
    cluster: v.cluster,
    clusterHpsmId: v.clusterHpsmId,
    status: v.status,
    iftMailSupport: v.iftMailSupport,
    uatMailSupport: v.uatMailSupport,
    prodMailSupport: v.prodMailSupport,
    guid: v.guid,
  };
}

export type AutomatedSystemDirtyFields = Partial<
  Record<keyof AutomatedSystemFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function automatedSystemFormToPatch(
  v: AutomatedSystemFormValues,
  dirty: AutomatedSystemDirtyFields,
): Partial<AutomatedSystemWritePayload> {
  const out: Partial<AutomatedSystemWritePayload> = {};
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.objectCode)) out.objectCode = v.objectCode;
  if (isDirty(dirty.fullName)) out.fullName = v.fullName;
  if (isDirty(dirty.ci)) out.ci = v.ci;
  if (isDirty(dirty.nameHpsm)) out.nameHpsm = v.nameHpsm;
  if (isDirty(dirty.leaderId)) out.leader = { id: v.leaderId };
  if (isDirty(dirty.leaderComment)) out.leaderComment = v.leaderComment;
  if (isDirty(dirty.leaderSapId)) out.leaderSapId = v.leaderSapId;
  if (isDirty(dirty.block)) out.block = v.block;
  if (isDirty(dirty.tribe)) out.tribe = v.tribe;
  if (isDirty(dirty.cluster)) out.cluster = v.cluster;
  if (isDirty(dirty.clusterHpsmId)) out.clusterHpsmId = v.clusterHpsmId;
  if (isDirty(dirty.status)) out.status = v.status;
  if (isDirty(dirty.iftMailSupport)) out.iftMailSupport = v.iftMailSupport;
  if (isDirty(dirty.uatMailSupport)) out.uatMailSupport = v.uatMailSupport;
  if (isDirty(dirty.prodMailSupport)) out.prodMailSupport = v.prodMailSupport;
  if (isDirty(dirty.guid)) out.guid = v.guid;
  return out;
}
```

- [ ] **Step 12: Run it to verify it passes**

```
npx vitest run src/features/automated-system/mappers.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 13: Write the API layer**

Create `src/features/automated-system/advanced-api.ts`:

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ApiResponse, AutomatedSystemDto } from "@/types/api";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { apiFetch } from "@/lib/api/create-crud-api";
import {
  buildAdvancedFilterParams,
  type FieldEntry,
} from "@/lib/odata/build-advanced-filter-params";
import { notifyLambdaCapped } from "@/lib/odata/notify-lambda-capped";

export const automatedSystemFieldByColumnId: Record<string, FieldEntry> = {
  name:          { field: "name",          variant: "text" },
  ci:            { field: "ci",            variant: "text" },
  block:         { field: "block",         variant: "text" },
  tribe:         { field: "tribe",         variant: "text" },
  cluster:       { field: "cluster",       variant: "text" },
  status:        { field: "status",        variant: "select" },
  leaderComment: { field: "leaderComment", variant: "text" },
  leader:        { field: "leader/id",     variant: "relation", sortField: "leader/lastName" },
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
      "automated-systems",
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
        fieldByColumnId: automatedSystemFieldByColumnId,
        onLambdaCapped: notifyLambdaCapped,
      });
      searchParams.set("$fields", "leader");
      return apiFetch<ApiResponse<AutomatedSystemDto[]>>(
        `/api/v1/automated-system/graph?${searchParams.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}
```

Create `src/features/automated-system/api.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiFetch, createCrudApi } from "@/lib/api/create-crud-api";
import type {
  ApiResponse,
  AutomatedSystemDto,
  AutomatedSystemFilters,
} from "@/types/api";
import type { AutomatedSystemWritePayload } from "./schema";
import { automatedSystemFilterDescriptors } from "./filter-descriptors";
import { advancedDataTableQueryOptions } from "./advanced-api";

const baseApi = createCrudApi<
  AutomatedSystemDto,
  AutomatedSystemFilters,
  AutomatedSystemWritePayload
>({
  basePath: "/api/v1/automated-system",
  // Reads go through the entity-graph endpoint so the backend populates the
  // nested `leader`; create/patch/remove stay on the plain resource path
  // (`/graph` is read-only).
  listPath: "/api/v1/automated-system/graph",
  queryKey: ["automated-systems"],
  filterDescriptors: automatedSystemFilterDescriptors,
  staticParams: { "$fields": "leader" },
});

/**
 * Overrides the base `detailQueryOptions`, which would hit `/{id}` — the
 * library's own handler, which ignores `$fields` and so would return
 * `leader: null`. `graph/{id}` is the path that honours it.
 */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["automated-systems", "detail", id] as const,
    queryFn: () =>
      apiFetch<ApiResponse<AutomatedSystemDto>>(
        `/api/v1/automated-system/graph/${id}?$fields=leader`,
      ),
  });
}

// detailQueryOptions is spread AFTER ...baseApi so this one wins.
export const automatedSystemApi = {
  ...baseApi,
  advancedDataTableQueryOptions,
  detailQueryOptions,
};
```

- [ ] **Step 14: Write the row action and the columns**

Create `src/features/automated-system/row-action.ts`:

```ts
import type { AutomatedSystemDto } from "@/types/api";

export type AutomatedSystemRowAction =
  | { variant: "create" }
  | { variant: "update"; row: AutomatedSystemDto };
```

Create `src/features/automated-system/columns.tsx`:

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { personsFilteredQueryOptions } from "@/features/person/api";
import { personLabel } from "@/features/person/label";
import type { AutomatedSystemDto, PersonDto, PersonFlatDto } from "@/types/api";
import type { AutomatedSystemRowAction } from "./row-action";

interface GetAutomatedSystemColumnsProps {
  setRowAction: React.Dispatch<
    React.SetStateAction<AutomatedSystemRowAction | null>
  >;
}

const personRelationColumns: ColumnDef<PersonDto, unknown>[] = [
  { id: "lastName", accessorKey: "lastName", header: "Last Name" },
  { id: "firstName", accessorKey: "firstName", header: "First Name" },
  { id: "email", accessorKey: "email", header: "Email" },
];

export function getAutomatedSystemColumns({
  setRowAction,
}: GetAutomatedSystemColumnsProps): ColumnDef<AutomatedSystemDto>[] {
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
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Name",
        placeholder: "Search names...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "objectCode",
      accessorKey: "objectCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Object Code" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "Object Code" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 130,
    },
    {
      id: "fullName",
      accessorKey: "fullName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Full Name" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "Full Name" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 250,
    },
    {
      id: "ci",
      accessorKey: "ci",
      header: ({ column }) => <DataTableColumnHeader column={column} label="CI" />,
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "CI",
        placeholder: "Search CIs...",
        variant: "text",
        filterKey: "ci",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },
    {
      id: "nameHpsm",
      accessorKey: "nameHpsm",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="HPSM Name" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "HPSM Name" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 150,
    },
    {
      id: "leader",
      accessorKey: "leader",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader" />
      ),
      cell: ({ cell }) => {
        const leader = cell.getValue<PersonFlatDto | null>();
        return leader ? personLabel(leader) : "—";
      },
      meta: {
        label: "Leader",
        variant: "relation",
        filterKey: "leaderId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            personsFilteredQueryOptions(filters),
          columns: personRelationColumns,
          getLabel: (person: PersonDto) => personLabel(person),
          getId: (person: PersonDto) => person.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 220,
    },
    {
      id: "leaderComment",
      accessorKey: "leaderComment",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader (text)" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Leader (text)",
        placeholder: "Search leader text...",
        variant: "text",
        filterKey: "leaderComment",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      id: "leaderSapId",
      accessorKey: "leaderSapId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader SAP ID" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "Leader SAP ID" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 140,
    },
    {
      id: "block",
      accessorKey: "block",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Block" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Block",
        placeholder: "Search blocks...",
        variant: "text",
        filterKey: "block",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      id: "tribe",
      accessorKey: "tribe",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Tribe" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Tribe",
        placeholder: "Search tribes...",
        variant: "text",
        filterKey: "tribe",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      id: "cluster",
      accessorKey: "cluster",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Cluster" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Cluster",
        placeholder: "Search clusters...",
        variant: "text",
        filterKey: "cluster",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      id: "clusterHpsmId",
      accessorKey: "clusterHpsmId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Cluster HPSM ID" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "Cluster HPSM ID" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 150,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Status" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Status",
        variant: "select",
        // The only two values that occur across all 200 live rows
        // (181 / 17, plus 2 nulls). Verified 2026-09-04.
        options: [
          { label: "Находится в эксплуатации", value: "Находится в эксплуатации" },
          { label: "Выведен из эксплуатации", value: "Выведен из эксплуатации" },
        ],
        filterKey: "status",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "iftMailSupport",
      accessorKey: "iftMailSupport",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="IFT Mail" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "IFT Mail" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      id: "uatMailSupport",
      accessorKey: "uatMailSupport",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="UAT Mail" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "UAT Mail" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      id: "prodMailSupport",
      accessorKey: "prodMailSupport",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Prod Mail" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: { label: "Prod Mail" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      id: "guid",
      accessorKey: "guid",
      header: ({ column }) => <DataTableColumnHeader column={column} label="GUID" />,
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      // Hidden by default via switchable-config's initialColumnVisibility.
      meta: { label: "GUID" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 280,
    },
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
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 40,
    },
  ];
}
```

There is no Delete item in the row menu — Team does not have one either.

- [ ] **Step 15: Write the switchable config**

Create `src/features/automated-system/switchable-config.ts`:

```ts
import { automatedSystemApi } from "./api";
import { getAutomatedSystemColumns } from "./columns";
import { deriveColumnFiltersFromSearch } from "./filter-descriptors";
import type { AutomatedSystemDto } from "@/types/api";
import type { AutomatedSystemRowAction } from "./row-action";
import type { SwitchableTableConfig } from "@/lib/data-table/switchable-page";

/** Simple-mode URL param keys cleared on mode toggle. */
export const automatedSystemSimpleFilterKeys = [
  "name",
  "ci",
  "block",
  "tribe",
  "cluster",
  "status",
  "leaderComment",
  "leaderId",
] as const;

export const automatedSystemSwitchableConfig: SwitchableTableConfig<
  AutomatedSystemDto,
  AutomatedSystemRowAction
> = {
  queryKey: ["automated-systems"],
  simpleQueryOptions: (p) => automatedSystemApi.dataTableQueryOptions(p),
  advancedQueryOptions: (p) => automatedSystemApi.advancedDataTableQueryOptions(p),
  deriveColumnFilters: deriveColumnFiltersFromSearch,
  simpleFilterKeys: automatedSystemSimpleFilterKeys,
  getColumns: getAutomatedSystemColumns,
  // `name` is pinned left to preserve the sticky first column the old page had.
  initialColumnPinning: { left: ["select", "id", "name"], right: ["actions"] },
  initialColumnVisibility: { guid: false },
};
```

- [ ] **Step 16: Write the sheet**

Create `src/features/automated-system/components/AutomatedSystemSheet.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Control, type Path } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { PersonCombobox } from "@/features/person/components/PersonCombobox";
import type { AutomatedSystemDto, AppMessage } from "@/types/api";

import { automatedSystemApi } from "../api";
import {
  automatedSystemFormSchema,
  type AutomatedSystemFormValues,
} from "../schema";
import {
  automatedSystemDtoToForm,
  automatedSystemFormToCreate,
  automatedSystemFormToPatch,
} from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

/** Every nullable free-text field, i.e. all form fields except `name`
 *  (required), `leaderId` (combobox) and `status` (select). */
type NullableTextField = Exclude<
  keyof AutomatedSystemFormValues,
  "name" | "leaderId" | "status"
>;

const PRIMARY_TEXT_FIELDS: { name: NullableTextField; label: string }[] = [
  { name: "fullName", label: "Full Name" },
  { name: "objectCode", label: "Object Code" },
  { name: "ci", label: "CI" },
  { name: "nameHpsm", label: "HPSM Name" },
  { name: "leaderComment", label: "Leader (text)" },
  { name: "leaderSapId", label: "Leader SAP ID" },
  { name: "block", label: "Block" },
  { name: "tribe", label: "Tribe" },
  { name: "cluster", label: "Cluster" },
  { name: "clusterHpsmId", label: "Cluster HPSM ID" },
];

const SUPPORT_TEXT_FIELDS: { name: NullableTextField; label: string }[] = [
  { name: "iftMailSupport", label: "IFT Mail Support" },
  { name: "uatMailSupport", label: "UAT Mail Support" },
  { name: "prodMailSupport", label: "Prod Mail Support" },
  { name: "guid", label: "GUID" },
];

const AS_FORM_FIELDS: readonly (keyof AutomatedSystemFormValues)[] = [
  "name",
  "objectCode",
  "fullName",
  "ci",
  "nameHpsm",
  "leaderId",
  "leaderComment",
  "leaderSapId",
  "block",
  "tribe",
  "cluster",
  "clusterHpsmId",
  "status",
  "iftMailSupport",
  "uatMailSupport",
  "prodMailSupport",
  "guid",
];

function isAutomatedSystemField(
  target: string,
): target is keyof AutomatedSystemFormValues {
  return (AS_FORM_FIELDS as readonly string[]).includes(target);
}

const EMPTY_FORM: AutomatedSystemFormValues = {
  name: "",
  objectCode: null,
  fullName: null,
  ci: null,
  nameHpsm: null,
  // 0 is never a valid id, so the schema's positive() rule reports
  // "Leader is required" if the user submits without picking one.
  leaderId: 0,
  leaderComment: null,
  leaderSapId: null,
  block: null,
  tribe: null,
  cluster: null,
  clusterHpsmId: null,
  status: null,
  iftMailSupport: null,
  uatMailSupport: null,
  prodMailSupport: null,
  guid: null,
};

function NullableTextRow({
  control,
  name,
  label,
}: {
  control: Control<AutomatedSystemFormValues>;
  name: NullableTextField;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={name}
            value={field.value ?? ""}
            onChange={(e) =>
              field.onChange(e.target.value === "" ? null : e.target.value)
            }
            onBlur={field.onBlur}
          />
        )}
      />
    </div>
  );
}

interface AutomatedSystemSheetProps
  extends React.ComponentPropsWithRef<typeof Sheet> {
  automatedSystem: AutomatedSystemDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function AutomatedSystemSheet({
  automatedSystem,
  variant,
  onSuccess,
  ...props
}: AutomatedSystemSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<AutomatedSystemFormValues>({
    resolver: zodResolver(automatedSystemFormSchema),
    defaultValues: automatedSystem
      ? automatedSystemDtoToForm(automatedSystem)
      : EMPTY_FORM,
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      // The DTO field is `leader`; the form field is `leaderId`.
      const target = m.target === "leader" ? "leaderId" : m.target;
      if (target && isAutomatedSystemField(target)) {
        form.setError(target as Path<AutomatedSystemFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: AutomatedSystemFormValues) => {
      if (variant === "update" && automatedSystem) {
        const patch = automatedSystemFormToPatch(data, form.formState.dirtyFields);
        return automatedSystemApi.patch(automatedSystem.id, patch);
      }
      return automatedSystemApi.create(automatedSystemFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && automatedSystem) {
        queryClient.setQueryData(
          ["automated-systems", "detail", automatedSystem.id],
          res,
        );
        toast.success("Automated system updated");
      } else {
        toast.success("Automated system created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save automated system");
        }
      } else {
        toast.error("Failed to save automated system");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update"
              ? "Edit Automated System"
              : "Add Automated System"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the automated system details and save changes."
              : "Fill in the details to create a new automated system."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Name (required) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Controller
              control={form.control}
              name="name"
              render={({ field }) => (
                <Input
                  id="name"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                />
              )}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Leader (required — the FK is NOT NULL) */}
          <div className="flex flex-col gap-2">
            <Label>Leader</Label>
            <Controller
              control={form.control}
              name="leaderId"
              render={({ field }) => (
                <PersonCombobox
                  value={field.value > 0 ? field.value : null}
                  onChange={(id) => field.onChange(id ?? 0)}
                />
              )}
            />
            {form.formState.errors.leaderId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.leaderId.message}
              </p>
            )}
          </div>

          {PRIMARY_TEXT_FIELDS.map((f) => (
            <NullableTextRow
              key={f.name}
              control={form.control}
              name={f.name}
              label={f.label}
            />
          ))}

          {/* Status */}
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Находится в эксплуатации">
                      Находится в эксплуатации
                    </SelectItem>
                    <SelectItem value="Выведен из эксплуатации">
                      Выведен из эксплуатации
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {SUPPORT_TEXT_FIELDS.map((f) => (
            <NullableTextRow
              key={f.name}
              control={form.control}
              name={f.name}
              label={f.label}
            />
          ))}

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

- [ ] **Step 17: Write the route search validator**

Create `src/routes/automated-system/-simple-search.ts`:

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

export function validateAutomatedSystemSimpleFields(
  search: Record<string, unknown>,
) {
  return {
    name: asStr(search.name),
    ci: asStr(search.ci),
    block: asStr(search.block),
    tribe: asStr(search.tribe),
    cluster: asStr(search.cluster),
    status: asStrArray(search.status),
    leaderComment: asStr(search.leaderComment),
    leaderId: asNum(search.leaderId),
  };
}
```

- [ ] **Step 18: Rewrite the route page**

Replace the whole of `src/routes/automated-system/index.tsx`:

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
import { automatedSystemSwitchableConfig } from "@/features/automated-system/switchable-config";
import { validateAutomatedSystemSimpleFields } from "./-simple-search";
import { AutomatedSystemSheet } from "@/features/automated-system/components/AutomatedSystemSheet";

export const Route = createFileRoute("/automated-system/")({
  validateSearch: makeSwitchableSearch(validateAutomatedSystemSimpleFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(automatedSystemSwitchableConfig),
  component: AutomatedSystemPage,
});

function AutomatedSystemPage() {
  // Making `loaderDeps`/`loader` type-check forces TanStack to widen this
  // route's inferred search schema to `{}`; the runtime value is the validated
  // search, so assert it back to the shared switchable-search shape. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/automated-system/" });
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
    config: automatedSystemSwitchableConfig,
    search,
    navigate,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: automatedSystemSwitchableConfig.queryKey,
    });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetSystem = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Automated System
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Systems</h1>
          <p className="mt-2 text-muted-foreground">{count} systems</p>
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
        <AutomatedSystemSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          automatedSystem={sheetSystem}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
```

The sheet is seeded from the **row** (fetched by the list `/graph` read with `$fields=leader`), so `leaderId` is populated without a second request — the same arrangement Team uses.

- [ ] **Step 19: Delete the old API module**

```bash
git rm src/api/automated-system.ts
```

Confirm nothing still imports it — expect no output:

```
grep -rn "api/automated-system" src --include=*.ts --include=*.tsx
```

- [ ] **Step 20: Update `CLAUDE.md`**

Two lines in the Project Structure block now name files that no longer exist. In the `src/api/` entry, drop `automated-system.ts` from the list so it reads `# box.ts, item.ts, thing.ts`. Change the `automated-system/` route line from `# RHF + zod form example` to `# switchable DataTable + sheet (see features/automated-system)`. Leave the rest of the file alone.

- [ ] **Step 21: Run the full gate**

```
npx tsc -b
npm run lint
npx vitest run
```

Expected: no output from `tsc -b`, no lint errors, all Vitest suites pass (the two new ones plus everything pre-existing — flow-graph tests construct `automatedSystem: null` and are unaffected).

If `tsc -b` reports missing fields in `src/mocks/data/automated-systems.ts`, the Step 2 `sed` missed rows — re-run the three `grep -c` checks and fix the stragglers by hand rather than re-running `sed` (it is not idempotent).

- [ ] **Step 22: Commit**

```bash
git add -A src/ CLAUDE.md
git commit -m "feat(automated-system): rebuild the page on the switchable DataTable with a leader relation"
```

---

### Task 4: Live end-to-end verification

**Files:**
- Create (only on failure): `issue/<short-name>.md`

**Interfaces:**
- Consumes: everything from Tasks 1–3, running against the live database.
- Produces: either a green gate, or an issue doc recording exactly which check failed.

`tsc` and the JPQL unit tests cannot prove the OData navigation path against a real Hibernate session, nor the FK write. This task is the gate the design doc requires.

- [ ] **Step 1: Build and start the backend**

Stop any running jar first (`Get-CimInstance Win32_Process -Filter "Name='java.exe'"`), then:

```
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
.\mvnw -DskipTests clean package
$env:DB_PASSWORD=(Get-Content -Raw "F:\programming\cometa\.vscode\backend.env").Split("=")[1].Trim()
$env:SPRING_PROFILES_ACTIVE="local"
& "$env:JAVA_HOME\bin\java.exe" -jar "F:\programming\cometa\cometa-web-module\target\cometa-web-module-0.0.1-SNAPSHOT.jar"
```

Expected: "Started CometaApplication" in ~14s on port 8080. If it dies with `required a bean of type '...AutomatedSystemMapper'`, that is the MapStruct corruption — go back to Task 1 Step 9.

- [ ] **Step 2: Point the frontend at the real API and start it**

Ensure `F:\programming\react\cometa-frontend\.env.development.local` contains `VITE_MOCK_API=false`, and that `vite.config` proxies `/api` to `http://localhost:8080`. Then:

```
npm run dev -- --host
```

The plain `npm run dev` is unreachable on this machine — `--host` is required.

- [ ] **Step 3: Log in and check the list read**

Log in as sigmaLogin `16674475`, password `qweqweqwe`, and open `/automated-system`.

Expected: rows render, the header count matches the envelope `count`, and the **Leader** column shows person names (not "—"). All "—" in that column means `$fields=leader` is not reaching the server or the `@Condition` is suppressing an initialised value — check the request URL in devtools before changing any code.

- [ ] **Step 4: Check the leader filter**

Filter by a leader through the relation picker.

Expected: the URL gains `?leaderId=N`, the request carries `$filter=leader/id eq N`, the returned rows all show that leader, **and** the envelope `count` matches the number of rows the filter should yield (a filter that narrows the page but not the count means the count query dropped the clause).

- [ ] **Step 5: Check the leader sort, both directions**

Click the Leader column header twice.

Expected: `$orderby=leader/lastName asc` then `leader/lastName desc`, and the rows reorder by surname accordingly.

- [ ] **Step 6: Check the scalar filters still work after the rename**

Filter on **Leader (text)**.

Expected: `$filter=contains_ignoring_case(leaderComment, '…')` and matching rows — this proves the Java-side rename reaches JPQL while the DB column is still `leader`.

- [ ] **Step 7: Check create**

Click "Add Automated System", fill Name, pick a Leader, save.

Expected: a success toast and the new row in the list. Then submit with the Leader left empty: expected "Leader is required" under the combobox and **no** request sent.

- [ ] **Step 8: Check PATCH of the leader**

Edit an existing system, change only the Leader, save.

Expected: the PATCH body is exactly `{"leader":{"id":N}}` (check devtools — dirty-field patching means nothing else should be in it), a success toast, and the list showing the new leader.

- [ ] **Step 9: Check the flow-graph regression**

Open `/flow-graph`, select a node that has an automated system, and read the details panel.

Expected: the "Leader" row shows the free text (e.g. `Филина Е. М. (806025)`) or "—", and never `[object Object]`. Also confirm the backend log does not show one `select … from person` per graph node — that would mean the `@Condition` guard is not firing.

- [ ] **Step 10: On failure, write it up instead of guessing**

If the nav-path filter or sort fails against the live backend, do **not** improvise a workaround. Write `issue/<short-name>.md` in the frontend repo recording: the exact request URL sent, the response, the backend log line, and which of the two candidate causes it points at (`odata.mini.repo.throw-on-field-not-found` not actually `false` in the running profile, vs. a genuine library limitation on this entity). Commit that and stop.

- [ ] **Step 11: Commit the verification note**

Only if something was changed to make the checks pass:

```bash
git add -A
git commit -m "fix(automated-system): <what the live check turned up>"
```

If everything passed with no edits, there is nothing to commit — record the result in the task hand-off instead.

---

## Completion

Done when:

- `mvnw -pl cometa-service-module -am test` is green from the root reactor, and `javap … AutomatedSystemMapperImpl | grep interfaces` prints `interfaces: 1`.
- `npx tsc -b`, `npm run lint` and `npx vitest run` are all green in the frontend.
- The live checks in Task 4 pass: the leader renders, filters (with a matching envelope count) and sorts both ways; create and PATCH of a leader succeed; the flow-graph details panel still shows the leader text with no per-node `SELECT person`.
- `src/api/automated-system.ts`, `src/mocks/handlers/automated-system.ts` and `IgnoreAutomatedSystemLinkedObjects.java` are gone, and nothing references them.

Known, accepted consequences, all recorded in the design doc:

- `AutomatedSystemFlatDto` (both repos) has no field-level consumer on day one. It is the class holding the scalars, not dead code.
- With `VITE_MOCK_API=true` the AS page no longer works, matching `/team` and `/person`. Node and flow-graph mocks are unaffected.
- `leader` changing from a string to an object, plus the new `leaderComment`, is **breaking for any consumer outside these two repos**.
