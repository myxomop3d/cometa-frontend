# Nested Relation Write Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any entity create, replace and clear links to child entities through its own create/update/patch — never modifying child fields — and make Person team membership editable in the `/person` add/edit panel as the first user-facing instance.

**Architecture:** DTOs split into Flat/Full pairs (a Flat DTO carries every scalar of its entity and no relations; a Full DTO extends its Flat and adds relations typed as the child's Flat). Relation writes resolve `{id}` to a managed entity through `BaseRefMapper` using `EntityManager.getReference`, which depends on `EntityManager` only — never a service — because a mapper-to-service edge closes a constructor bean cycle. `EntityGraphBaseCrudService` gains `@Transactional` create/update/patch so read, map and merge share one persistence context, which collection writes require under `open-in-view: false`.

**Tech Stack:** Backend — Java 17, Spring Boot 4.0.6, MapStruct 1.5.5.Final, Lombok, Hibernate 7.2, odata-mini 2.2.0-SNAPSHOT, JUnit 5 + Mockito + AssertJ. Frontend — React 19, TypeScript 5.9, Vite 8, TanStack Router/Query/Table, react-hook-form + zod, Vitest.

**Design spec:** `docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`

---

## Global Constraints

- **Two repositories.** Backend is `F:\programming\cometa` (branch `feature/gm`). Frontend is `F:\programming\react\cometa-frontend` (branch `feature/gm`). Never mix them in one commit.
- **`JAVA_HOME` must be set for every Maven and `javap` command:** `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`. The machine's default `java` is too old.
- **Always build the backend from the ROOT reactor.** Building one submodule alone fails resolving sibling SNAPSHOTs. Use `-pl <module> -am`, or run `mvnw -DskipTests install` at the root once.
- **Running a single backend test class needs `-Dsurefire.failIfNoSpecifiedTests=false`**, otherwise the sibling modules built by `-am` fail the build before reaching the target module.
- **After ANY backend build that touches a mapper, verify MapStruct output is not corrupt.** This build has a documented failure mode where `*MapperImpl.class` is written *without* its `implements` clause while Maven reports BUILD SUCCESS; it surfaces only at runtime as `required a bean of type '...Mapper' that could not be found`. The `-sourcepath` fix is already in the parent pom — this check confirms it is still working:
  ```
  javap -v -cp cometa-service-module/target/classes ru.sberbank.cib.gmbus.service.mapper.TeamMapperImpl | grep interfaces
  ```
  Must print `interfaces: 1`. `interfaces: 0` means the corruption is back — stop and investigate, do not proceed.
- **Type-check the frontend with `npx tsc -b`, never `npx tsc --noEmit`.** The root tsconfig is solution-style, so the bare form silently checks nothing.
- **Frontend tests:** `npm test` (Vitest, run mode). Single file: `npx vitest run src/path/to/file.test.ts`.
- **Running the backend locally requires the `local` Spring profile**, or Hibernate dies at JPA init against an unreachable Sberbank host. `DB_PASSWORD` lives in `F:\programming\cometa\.vscode\backend.env`.
- **Local test login:** sigmaLogin `16674475`, password `qweqweqwe`.
- **Relation filter/sort spellings are `/`-separated, never `.`** — a dot is an ANTLR parse error. To-many relations use `field/any(x: ...)`, are filterable only, must be the last clause, at most one per `$filter`.
- **Commit after every task.** Frequent commits; each task's deliverable stands alone.

---

## File Structure

**Backend — `F:\programming\cometa`**

| File | Responsibility |
|---|---|
| `cometa-service-module/.../service/dto/PersonFlatDto.java` | *Create.* Person scalars, no relations. The ref type for Person. |
| `cometa-service-module/.../service/dto/TeamFlatDto.java` | *Create.* Team scalars, no relations. The ref type for Team. Replaces `TeamSummaryDto`. |
| `cometa-service-module/.../service/dto/TeamSummaryDto.java` | *Delete.* Superseded by `TeamFlatDto`. |
| `cometa-service-module/.../service/dto/PersonDto.java` | *Modify.* Extends `PersonFlatDto`, adds `teams`. |
| `cometa-service-module/.../service/dto/TeamDto.java` | *Modify.* Extends `TeamFlatDto`, adds `leader`, drops `leaderId`. |
| `cometa-service-module/.../service/mapper/BaseRefMapper.java` | *Create.* Generic id-to-managed-reference resolution. Depends on `EntityManager` only. |
| `cometa-service-module/.../service/mapper/TeamRefMapper.java` | *Create.* `TeamFlatDto` to `Team`. |
| `cometa-service-module/.../service/mapper/PersonRefMapper.java` | *Rewrite.* Folded onto `BaseRefMapper`; `toPersonRef(Long)` becomes `toRef(PersonFlatDto)`. |
| `cometa-service-module/.../service/mapper/PersonMapper.java` | *Modify.* Opens the `teams` write path; `toSummary` becomes `toFlat`. |
| `cometa-service-module/.../service/mapper/TeamMapper.java` | *Modify.* `leader` maps by ref; declares `toFlat(Person)`; drops the `PersonMapper` dependency. |
| `cometa-service-module/.../service/EntityGraphBaseCrudService.java` | *Modify.* `@Transactional` create/update/patch. |
| `cometa-persistence-module/.../entity/auth/Team.java` | *Modify.* Remove the `leaderId` scalar (Task 6, gated). |
| `cometa-service-module/src/test/.../service/mapper/PersonMapperWriteTest.java` | *Create.* Pins the three PATCH body semantics. |
| `cometa-service-module/src/test/.../odata/ODataJpqlGenerationTest.java` | *Modify.* Pins `leader/id` JPQL. |

**Frontend — `F:\programming\react\cometa-frontend`**

| File | Responsibility |
|---|---|
| `src/types/api.ts` | *Modify.* Flat/Full DTO pairs mirroring the backend. |
| `src/features/person/label.ts` | *Modify.* Widen `personLabel` to `PersonFlatDto`. |
| `src/features/team/schema.ts` | *Modify.* `TeamWritePayload.leaderId` becomes `leader: {id}`. |
| `src/features/team/mappers.ts` | *Modify.* Read the nested leader; write a ref. |
| `src/features/team/mappers.test.ts` | *Modify.* Drop the obsolete scalar-precedence test. |
| `src/features/team/columns.tsx` | *Modify.* Leader cell type. |
| `src/features/team/filter-descriptors.ts` | *Modify.* `field` spelling (gated). |
| `src/features/team/advanced-api.ts` | *Modify.* `field` spelling (gated). |
| `src/features/team/api.ts` | *Modify.* `$fields=leader` on the detail path. |
| `src/features/person/schema.ts` | *Modify.* Adds `teamIds` and the `teams` write payload. |
| `src/features/person/mappers.ts` | *Modify.* Team id round-trip; set-compare for patch. |
| `src/features/person/mappers.test.ts` | *Modify.* Team membership cases. |
| `src/features/person/components/PersonSheet.tsx` | *Modify.* The Teams picker. |
| `src/features/person/columns.tsx` | *Modify.* Null-safe team name join. |

---

## A note on backend test infrastructure

The backend has **no Spring context tests and no database test infrastructure**. Every existing test is plain JUnit + Mockito (`RegistrationServiceTest`) or a pure library-behaviour test (`ODataJpqlGenerationTest`); `AuthControllerCertStartTest` states explicitly that no Spring context is loaded. `spring-boot-starter-data-jpa-test` is on the classpath but nothing uses `@DataJpaTest`.

The design spec's section 8 asked for integration tests asserting `person_team_link` rows and an application-context startup test. Building that infrastructure is a separate project. This plan substitutes, at equal or better value per unit of effort:

- **Mapper write semantics** (Task 5) — a Mockito test against the *generated* `PersonMapperImpl`, which is where the three PATCH body shapes actually live.
- **JPQL generation** (Task 2) — the unit half of the `leader/id` gate, in the test class already built for exactly this.
- **Live verification** (Tasks 1 and 10) — the only thing that can confirm envelope `count` correctness and that the Spring context starts. Manual, with recorded results.

---

# PHASE 1 — The standard, plus the Team migration

No user-visible change. This is the larger and riskier half; it lands and is verified on its own.

---

### Task 1: Live verification gate for the `leader/id` filter spelling

Run this **first, against unmodified code.** `leader/id` is a navigation path resolved against the `Team` entity, so it can be probed while the `leaderId` scalar still exists. If it fails, Task 6 and Task 9 are cancelled and everything else proceeds unchanged — so finding out now costs nothing and finding out later costs rework.

**Files:**
- Create: `F:\programming\cometa\issue\leaderIdNavPathFilter.md` (only if the gate fails)

**Interfaces:**
- Produces: a PASS/FAIL verdict consumed by Task 6 and Task 9.

- [ ] **Step 1: Build and start the backend**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -DskipTests clean install
```

Expect `BUILD SUCCESS`. Then start it:

```powershell
$env:DB_PASSWORD = ((Get-Content -Raw "F:\programming\cometa\.vscode\backend.env") -split '=',2)[1].Trim()
$env:SPRING_PROFILES_ACTIVE = "local"
& "$env:JAVA_HOME\bin\java.exe" -jar "F:\programming\cometa\cometa-web-module\target\cometa-web-module-0.0.1-SNAPSHOT.jar"
```

Expected: `Started CometaApplication` within about 15 seconds.

- [ ] **Step 2: Get a JWT**

In a second terminal:

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"sigmaLogin":"16674475","password":"qweqweqwe"}'
$h = @{ Authorization = "Bearer $($login.token)" }
```

Expected: `$login.token` is a non-empty JWT string.

- [ ] **Step 3: Pick a real leader id with more than one team**

```powershell
$teams = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team/graph?`$top=200&`$fields=leader" -Headers $h
$teams.data | Group-Object leaderId | Sort-Object Count -Descending | Select-Object -First 3 Name, Count
```

Expected: a table of leader ids and team counts. Record the top id as `<id1>` and the second as `<id2>`.

- [ ] **Step 4: Capture the baseline with the current `leaderId` spelling**

```powershell
$a = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team?`$filter=leaderId eq <id1>" -Headers $h
$b = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team?`$filter=leaderId in (<id1>,<id2>)" -Headers $h
"eq  -> count=$($a.count) rows=$($a.data.Count)"
"in  -> count=$($b.count) rows=$($b.data.Count)"
```

Record both lines verbatim. These are the numbers Step 5 must reproduce.

- [ ] **Step 5: Probe the `leader/id` spelling**

```powershell
$c = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team?`$filter=leader/id eq <id1>" -Headers $h
$d = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team?`$filter=leader/id in (<id1>,<id2>)" -Headers $h
"eq  -> count=$($c.count) rows=$($c.data.Count)"
"in  -> count=$($d.count) rows=$($d.data.Count)"
```

Expected for a PASS: **both `count` and `rows` identical to Step 4**, and the id sets match (`($c.data.id | Sort-Object) -join ','` equals `($a.data.id | Sort-Object) -join ','`). A mismatched `count` with matching rows is a FAIL — the envelope count is what pagination depends on.

- [ ] **Step 6: Probe the null spelling and confirm sorting is unaffected**

```powershell
try {
  $e = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team?`$filter=leader/id eq null" -Headers $h
  "null -> count=$($e.count)"
} catch { "null -> FAILED: $($_.Exception.Message)" }

$f = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team/graph?`$top=5&`$fields=leader&`$orderby=leader/lastName desc" -Headers $h
$f.data | Select-Object id, name, @{n='leader';e={$_.leader.lastName}}
```

`leader_person_id` is `nullable = false`, so the null probe returning `count=0` is a PASS and an exception is a *soft* FAIL — it does not block Task 6, but it means `isEmpty`/`isNotEmpty` must be withheld from nav-path `relation` filters, which is a separate note to record. The sort probe must return 5 rows ordered by surname descending.

- [ ] **Step 7: Record the verdict**

If every probe passed, write the four recorded lines into the Task 6 and Task 9 checkboxes as evidence and continue.

If any probe failed, create `F:\programming\cometa\issue\leaderIdNavPathFilter.md` containing: the exact URLs, the baseline numbers, the observed numbers, and the backend log lines. Then **mark Tasks 6 and 9 as cancelled** in this plan and continue from Task 2. Do not force the change — the design spec states this explicitly, and every other task is independent of it.

- [ ] **Step 8: Commit (only if the gate failed)**

```bash
cd /f/programming/cometa
git add issue/leaderIdNavPathFilter.md
git commit -m "docs(odata): record that the leader/id filter spelling fails the gate"
```

---

### Task 2: Pin `leader/id` JPQL generation

The unit half of the gate. It cannot verify `count` — only Task 1 can — but it locks the generated JPQL so a library upgrade that changes it fails the build instead of silently changing filter behaviour. Worth doing whether or not Task 1 passed: if it failed, this test documents *why*.

**Files:**
- Modify: `F:\programming\cometa\cometa-service-module\src\test\java\ru\sberbank\cib\gmbus\odata\ODataJpqlGenerationTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append these two methods inside `ODataJpqlGenerationTest`, immediately before the closing brace:

```java
    @Test
    void toOneIdFilterOmitsRootAlias() {
        // Спеллинг, на который переходит фильтр по лидеру после удаления
        // скаляра Team.leaderId. Как и leader/lastName, корневой алиас не
        // подставляется — Hibernate разрешает путь по единственному root'у.
        // Живая проверка count'а — в
        // cometa-frontend/docs/superpowers/plans/2026-08-27-nested-relation-write-standard.md,
        // задача 1: этот тест фиксирует только генерацию JPQL.
        assertEquals("leader.id = 30",
                team().parseFilterConditions("leader/id eq 30", "Team", null));
    }

    @Test
    void toOneIdInListOmitsRootAlias() {
        // Форму "in (...)" эмиттит build-advanced-filter-params.ts для
        // варианта relation (см. ветку inArray).
        assertEquals("leader.id in (30,31)",
                team().parseFilterConditions("leader/id in (30,31)", "Team", null));
    }
```

- [ ] **Step 2: Run the tests to see what the library actually generates**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=ODataJpqlGenerationTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: the two new tests FAIL with an AssertionFailedError showing the actual string. The existing tests must all still pass.

This is a **characterisation test** — the asserted strings above are the predicted output, not a requirement. Read the actual values from the failure output and correct the assertions to match. What matters is that the JPQL is a plain unaliased `leader.id` comparison with no join and no subquery. If instead it contains `JOIN`, `EXISTS`, or a corrupted alias, that is a genuine failure: record it in `issue/leaderIdNavPathFilter.md` and treat Task 1 as failed.

Note: this class disables `throw-on-field-not-found` process-wide in `@BeforeAll`, which is why WARN lines like `field 'leader.id' doesn't exist` appear in passing output. That is expected noise, not a failure.

- [ ] **Step 3: Correct the assertions to the observed output and re-run**

```powershell
.\mvnw.cmd -pl cometa-service-module -am -Dtest=ODataJpqlGenerationTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: `Tests run: 9, Failures: 0, Errors: 0`.

- [ ] **Step 4: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/ODataJpqlGenerationTest.java
git commit -m "test(odata): pin the JPQL generated for the leader/id filter spelling"
```

---

### Task 3: Flat/Full DTOs, BaseRefMapper, and mapper rewiring

The Java changes must land together — the DTO shape change is what forces the mapper change, and neither compiles without the other. This is the smallest compiling unit.

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/PersonFlatDto.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamFlatDto.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/BaseRefMapper.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/TeamRefMapper.java`
- Delete: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamSummaryDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/PersonDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamDto.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/PersonRefMapper.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/PersonMapper.java`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/TeamMapper.java`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PersonFlatDto` — `Long getId()`, `String getEmail()`, `getLastName()`, `getFirstName()`, `getMiddleName()`.
  - `TeamFlatDto` — `Long getId()`, `String getName()`, `Integer getCode()`, `String getType()`, `getLeaderRole()`, `getStructure()`.
  - `PersonDto extends PersonFlatDto` — adds `List<TeamFlatDto> getTeams()` / `setTeams(...)`.
  - `TeamDto extends TeamFlatDto` — adds `PersonFlatDto getLeader()` / `setLeader(...)`; no `leaderId`.
  - `BaseRefMapper<E, R extends BaseEntityDto>` — `public E toRef(R ref)`, `protected abstract Class<E> entityType()`.
  - `TeamRefMapper extends BaseRefMapper<Team, TeamFlatDto>`, `PersonRefMapper extends BaseRefMapper<Person, PersonFlatDto>`.
  - `PersonMapper.toFlat(Team): TeamFlatDto`, `TeamMapper.toFlat(Person): PersonFlatDto`.

- [ ] **Step 1: Create `PersonFlatDto.java`**

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

/**
 * Плоское представление человека: все скаляры Person и ни одной связи.
 * Служит типом ССЫЛКИ на Person в родительских DTO (например TeamDto.leader).
 * При записи читается ТОЛЬКО id; остальные поля игнорируются — менять поля
 * ребёнка можно лишь через его собственный контроллер.
 *
 * Отсутствие связей здесь — не экономия, а способ структурно оборвать цикл
 * TeamDto.leader -> PersonDto.teams -> TeamDto.
 *
 * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
 */
@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class PersonFlatDto extends BaseEntityDto {

    private String email;
    private String lastName;
    private String firstName;
    private String middleName;

}
```

- [ ] **Step 2: Create `TeamFlatDto.java`**

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

/**
 * Плоское представление команды: все скаляры Team и ни одной связи.
 * Служит типом ССЫЛКИ на Team в родительских DTO (например PersonDto.teams).
 * При записи читается ТОЛЬКО id.
 *
 * Заменил TeamSummaryDto, который обрывал цикл, просто не включая leader;
 * теперь это свойство типа, а не соглашение.
 *
 * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
 */
@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class TeamFlatDto extends BaseEntityDto {

    private String name;
    private Integer code;
    private String type; // TeamType enum name (CHANGE / RUN) — MapStruct maps enum<->String by name.
    private String leaderRole;
    private String structure;

}
```

- [ ] **Step 3: Rewrite `PersonDto.java`**

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class PersonDto extends PersonFlatDto {

    /**
     * Членство в командах.
     *
     * ЧТЕНИЕ: заполняется только при ?$fields=teams на маршруте /graph.
     *
     * ЗАПИСЬ: учитывается ТОЛЬКО id каждого элемента; остальные поля
     * TeamFlatDto игнорируются — переименовать команду отсюда нельзя.
     * Семантика (следует из NullValuePropertyMappingStrategy.IGNORE):
     *   отсутствует или null — членство не меняется;
     *   []                   — все членства сняты;
     *   непустой список      — членство заменяется целиком на указанное.
     */
    private List<TeamFlatDto> teams;

}
```

- [ ] **Step 4: Rewrite `TeamDto.java`**

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class TeamDto extends TeamFlatDto {

    /**
     * Лидер команды.
     *
     * ЧТЕНИЕ: заполняется только при ?$fields=leader.
     *
     * ЗАПИСЬ: учитывается ТОЛЬКО id. Скаляр leaderId удалён — связи
     * выражаются ссылкой, а не FK-полем в DTO. Следствие: идентификатор
     * лидера доступен клиенту лишь вместе с $fields=leader.
     */
    private PersonFlatDto leader;

}
```

- [ ] **Step 5: Delete `TeamSummaryDto.java`**

```bash
cd /f/programming/cometa
git rm cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/TeamSummaryDto.java
```

- [ ] **Step 6: Create `BaseRefMapper.java`**

```java
package ru.sberbank.cib.gmbus.service.mapper;

import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import ru.sberbank.cib.gmbus.service.dto.BaseEntityDto;

/**
 * Разрешает ссылку вида {"id": N} в управляемую ссылку на сущность для записи.
 *
 * getReference возвращает ленивый прокси без обращения к БД — Hibernate берёт
 * из него только идентификатор, чтобы записать FK или строку join-таблицы.
 * Существование id НЕ проверяется: несуществующий id падает при flush
 * нарушением FK (осознанный компромисс, см. раздел 6 стандарта).
 *
 * ВАЖНО: зависит только от EntityManager. Заводить здесь зависимость от
 * сервиса нельзя — ребро mapper -> service замыкает КОНСТРУКТОРНЫЙ цикл бинов
 * (PersonMapperImpl -> TeamService -> TeamMapperImpl -> PersonMapper), а
 * Spring Boot 4 по умолчанию запрещает циклы: BeanCurrentlyInCreationException
 * на старте.
 *
 * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
 */
public abstract class BaseRefMapper<E, R extends BaseEntityDto> {

    @Autowired
    protected EntityManager em;

    protected abstract Class<E> entityType();

    public E toRef(R ref) {
        return ref == null || ref.getId() == null
                ? null
                : em.getReference(entityType(), ref.getId());
    }
}
```

- [ ] **Step 7: Create `TeamRefMapper.java`**

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.springframework.stereotype.Component;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.TeamFlatDto;

/** Разрешает ссылку на Team для записи. Подключается через uses = TeamRefMapper.class. */
@Component
public class TeamRefMapper extends BaseRefMapper<Team, TeamFlatDto> {

    @Override
    protected Class<Team> entityType() {
        return Team.class;
    }
}
```

- [ ] **Step 8: Rewrite `PersonRefMapper.java`**

The old `toPersonRef(Long)` had exactly one caller — `TeamMapper`'s `@Mapping(source = "leaderId")`, which Step 10 removes. MapStruct selects by signature, not by name, so the rename is transparent.

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.springframework.stereotype.Component;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.service.dto.PersonFlatDto;

/** Разрешает ссылку на Person для записи. Подключается через uses = PersonRefMapper.class. */
@Component
public class PersonRefMapper extends BaseRefMapper<Person, PersonFlatDto> {

    @Override
    protected Class<Person> entityType() {
        return Person.class;
    }
}
```

- [ ] **Step 9: Rewrite `PersonMapper.java`**

The `fromDto` and `update` overrides disappear entirely — with no `@Mapping` left to declare, MapStruct generates them from `BaseCrudMapper`.

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.hibernate.Hibernate;
import org.mapstruct.Condition;
import org.mapstruct.Mapper;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;
import ru.sberbank.cib.gmbus.service.dto.TeamFlatDto;

import java.util.Set;

@Mapper(config = CometaCommonMapperConfig.class, uses = TeamRefMapper.class)
public interface PersonMapper extends BaseCrudMapper<Person, PersonDto> {

    /**
     * Не инициализировать ленивую коллекцию команд при маппинге в DTO —
     * без ?$fields=teams вложенный teams останется null вместо N+1.
     *
     * Условие применяется только к ЧТЕНИЮ: в направлении записи исходное
     * свойство имеет тип List<TeamFlatDto>, который не подходит под
     * параметр Set<Team>.
     */
    @Condition
    default boolean isTeamsLoaded(Set<Team> teams) {
        return Hibernate.isInitialized(teams);
    }

    /** Направление чтения: Team -> TeamFlatDto. Запись идёт через TeamRefMapper. */
    TeamFlatDto toFlat(Team team);
}
```

- [ ] **Step 10: Rewrite `TeamMapper.java`**

`uses = PersonMapper.class` is dropped — declaring `toFlat(Person)` locally removes the need, and with it one mapper-to-mapper edge in the bean graph.

`@Mapping(target = "leaderId", ignore = true)` is **retained**: `Team.leaderId` still exists as a target property and now has no DTO source, so without this it trips the unmapped-target warning. Task 6 removes both together.

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.hibernate.Hibernate;
import org.mapstruct.Condition;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.PersonFlatDto;
import ru.sberbank.cib.gmbus.service.dto.TeamDto;

@Mapper(config = CometaCommonMapperConfig.class, uses = PersonRefMapper.class)
public interface TeamMapper extends BaseCrudMapper<Team, TeamDto> {

    /**
     * Не инициализировать ленивый прокси лидера при маппинге в DTO —
     * без ?$fields=leader вложенный leader останется null вместо N+1.
     */
    @Condition
    default boolean isEntityLoaded(Person person) {
        return Hibernate.isInitialized(person);
    }

    /** Направление чтения: Person -> PersonFlatDto. Запись идёт через PersonRefMapper. */
    PersonFlatDto toFlat(Person person);

    // Team.leaderId — read-only FK-скаляр сущности; в TeamDto его больше нет,
    // поэтому цель осталась без источника и её нужно явно игнорировать.
    @Override
    @Mapping(target = "leaderId", ignore = true)
    Team fromDto(TeamDto dto);

    @Override
    @Mapping(target = "leaderId", ignore = true)
    void update(TeamDto source, @MappingTarget Team target);
}
```

- [ ] **Step 11: Compile**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -DskipTests clean install
```

Expected: `BUILD SUCCESS`.

If MapStruct reports it cannot find a mapping method for `TeamFlatDto` to `Team` or `PersonFlatDto` to `Person`, it did not resolve `toRef` through the generic supertype. The fix costs nothing — add a concrete override to the subclass, for example in `TeamRefMapper`:

```java
    @Override
    public Team toRef(TeamFlatDto ref) {
        return super.toRef(ref);
    }
```

and the same shape in `PersonRefMapper`. Re-run the build.

- [ ] **Step 12: Verify MapStruct output is not corrupt**

```powershell
javap -v -cp cometa-service-module\target\classes ru.sberbank.cib.gmbus.service.mapper.TeamMapperImpl | Select-String interfaces
javap -v -cp cometa-service-module\target\classes ru.sberbank.cib.gmbus.service.mapper.PersonMapperImpl | Select-String interfaces
```

Expected: `interfaces: 1` for both. `interfaces: 0` means the `-sourcepath` protection has regressed — stop and investigate before going further.

- [ ] **Step 13: Confirm the generated write path actually sets the relations**

```powershell
Select-String -Path cometa-service-module\target\generated-sources\annotations\ru\sberbank\cib\gmbus\service\mapper\PersonMapperImpl.java -Pattern "setTeams|getTeams|teamRefMapper"
Select-String -Path cometa-service-module\target\generated-sources\annotations\ru\sberbank\cib\gmbus\service\mapper\TeamMapperImpl.java -Pattern "setLeader|personRefMapper"
```

Expected: `PersonMapperImpl` references `teamRefMapper.toRef(...)` and assigns `teams` in both `fromDto` and `update`; `TeamMapperImpl` references `personRefMapper.toRef(...)`. If `teams` is absent from the write methods, the mapping was not wired — do not proceed.

- [ ] **Step 14: Commit**

```bash
cd /f/programming/cometa
git add -A
git commit -m "feat(dto): split DTOs into Flat/Full pairs and open relation writes

Relations are now expressed as the child's Flat DTO and resolved to managed
entity references by BaseRefMapper, which reads only the id. TeamSummaryDto
becomes TeamFlatDto; TeamDto.leaderId is replaced by a nested leader ref.

BaseRefMapper depends on EntityManager only. A mapper-to-service edge would
close a constructor bean cycle that Boot 4 rejects at startup."
```

---

### Task 4: `@Transactional` create/update/patch on the base service

Under `open-in-view: false`, `BaseCrudService.patch` calls a non-transactional `readById`, so the entity comes back **detached** and MapStruct's generated `target.getTeams().clear()` throws `LazyInitializationException`. Scalars never expose this; a collection does immediately.

**Files:**
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/EntityGraphBaseCrudService.java`

**Interfaces:**
- Consumes: nothing.
- Produces: transactional `create(DTO)`, `update(ID, DTO)`, `patch(ID, DTO)` inherited by all seven services.

- [ ] **Step 1: Add the imports**

At the top of `EntityGraphBaseCrudService.java`, alongside the existing imports:

```java
import org.springframework.transaction.annotation.Transactional;
```

Use the Spring annotation, not `jakarta.transaction.Transactional` — `RegistrationService` and `FlowGraphService` already use the Spring one.

- [ ] **Step 2: Add the three overrides**

Insert immediately after the `setRepository` method, before the existing `getAll` override:

```java
    /**
     * Записи выполняются в ОДНОЙ транзакции: read -> map -> merge.
     *
     * Без этого при spring.jpa.open-in-view=false BaseCrudService.patch
     * получает из нетранзакционного readById ОТСОЕДИНЁННУЮ сущность, и
     * сгенерированный MapStruct'ом код обновления коллекции
     * (target.getTeams().clear()) падает с LazyInitializationException.
     * Скалярные поля этого не вскрывают, коллекция — сразу.
     *
     * Заодно снимается везение на пути записи Team: mapper.fromDto уже
     * вызывал getReference вне транзакции и работал лишь потому, что
     * HibernateProxy сохраняет идентификатор после закрытия сессии.
     *
     * Наследуется всеми семью сервисами: AutomatedSystem, Flow, Link, Node,
     * Person, Team, Topic. delete/deleteAll не трогаем — они уже
     * транзакционны на уровне репозитория.
     */
    @Override
    @Transactional
    public ResultObj<DTO> create(DTO dto) {
        return super.create(dto);
    }

    @Override
    @Transactional
    public ResultObj<DTO> update(ID id, DTO dto) {
        return super.update(id, dto);
    }

    @Override
    @Transactional
    public ResultObj<DTO> patch(ID id, DTO dto) {
        return super.patch(id, dto);
    }
```

- [ ] **Step 3: Compile**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -DskipTests clean install
```

Expected: `BUILD SUCCESS`. If `ResultObj` is unresolved, it is already imported in this file — confirm rather than re-adding.

- [ ] **Step 4: Verify MapStruct output is still intact**

```powershell
javap -v -cp cometa-service-module\target\classes ru.sberbank.cib.gmbus.service.mapper.TeamMapperImpl | Select-String interfaces
```

Expected: `interfaces: 1`.

- [ ] **Step 5: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/EntityGraphBaseCrudService.java
git commit -m "fix(service): run create/update/patch in one transaction

open-in-view is false, so readById returns a detached entity and any
collection write in a mapper throws LazyInitializationException. Read, map
and merge now share one persistence context for all seven services."
```

---

### Task 5: Pin the three PATCH body semantics on the generated mapper

The three body shapes are the actual contract of this feature, and they live in generated code. This tests `PersonMapperImpl` directly with a mocked `TeamRefMapper` — plain JUnit + Mockito, matching how `RegistrationServiceTest` is written.

**Files:**
- Create: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/PersonMapperWriteTest.java`

**Interfaces:**
- Consumes: `PersonMapperImpl(TeamRefMapper)` from Task 3, `TeamFlatDto`, `PersonDto`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;
import ru.sberbank.cib.gmbus.service.dto.TeamFlatDto;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Фиксирует семантику записи членства в командах — ровно то, на что
 * опирается панель добавления/редактирования на /person:
 *   teams отсутствует/null — не менять;
 *   teams = []             — очистить все;
 *   teams = [ref, ref]     — заменить целиком.
 *
 * Проверяется СГЕНЕРИРОВАННЫЙ PersonMapperImpl, потому что именно в нём
 * MapStruct материализует эту семантику из
 * NullValuePropertyMappingStrategy.IGNORE.
 *
 * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PersonMapperWriteTest {

    @Mock TeamRefMapper teamRefMapper;

    PersonMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new PersonMapperImpl(teamRefMapper);
        when(teamRefMapper.toRef(any(TeamFlatDto.class))).thenAnswer(inv -> {
            TeamFlatDto ref = inv.getArgument(0);
            if (ref == null || ref.getId() == null) return null;
            Team t = new Team();
            t.setId(ref.getId());
            return t;
        });
    }

    private static TeamFlatDto ref(long id) {
        TeamFlatDto dto = new TeamFlatDto();
        dto.setId(id);
        return dto;
    }

    private static TeamFlatDto refWithName(long id, String name) {
        TeamFlatDto dto = ref(id);
        dto.setName(name);
        return dto;
    }

    private static Person personWithTeams(Long... teamIds) {
        Person p = new Person();
        Set<Team> teams = new HashSet<>();
        for (Long id : teamIds) {
            Team t = new Team();
            t.setId(id);
            teams.add(t);
        }
        p.setTeams(teams);
        return p;
    }

    private static Set<Long> teamIdsOf(Person p) {
        Set<Long> ids = new HashSet<>();
        if (p.getTeams() != null) {
            for (Team t : p.getTeams()) ids.add(t.getId());
        }
        return ids;
    }

    @Test
    void createResolvesEachRefToAnEntity() {
        PersonDto dto = new PersonDto();
        dto.setEmail("a@b.ru");
        dto.setLastName("Иванов");
        dto.setFirstName("Иван");
        dto.setMiddleName("Иванович");
        dto.setTeams(List.of(ref(3L), ref(7L)));

        Person entity = mapper.fromDto(dto);

        assertThat(teamIdsOf(entity)).containsExactlyInAnyOrder(3L, 7L);
    }

    @Test
    void absentTeamsLeavesMembershipUntouched() {
        Person target = personWithTeams(3L, 7L);
        PersonDto patch = new PersonDto();
        patch.setLastName("Петров");

        mapper.update(patch, target);

        assertThat(teamIdsOf(target)).containsExactlyInAnyOrder(3L, 7L);
        assertThat(target.getLastName()).isEqualTo("Петров");
    }

    @Test
    void emptyTeamsClearsAllMemberships() {
        Person target = personWithTeams(3L, 7L);
        PersonDto patch = new PersonDto();
        patch.setTeams(List.of());

        mapper.update(patch, target);

        assertThat(teamIdsOf(target)).isEmpty();
    }

    @Test
    void nonEmptyTeamsReplacesMembershipWholesale() {
        Person target = personWithTeams(3L, 7L);
        PersonDto patch = new PersonDto();
        patch.setTeams(List.of(ref(7L), ref(9L)));

        mapper.update(patch, target);

        assertThat(teamIdsOf(target)).containsExactlyInAnyOrder(7L, 9L);
    }

    @Test
    void onlyTheIdOfARefIsHonoured() {
        // Клиент прислал имя команды — оно должно быть проигнорировано.
        // Именно это делает правило "родитель не меняет поля ребёнка"
        // наблюдаемым, а не только декларируемым.
        PersonDto dto = new PersonDto();
        dto.setTeams(List.of(refWithName(3L, "Переименована")));

        Person entity = mapper.fromDto(dto);

        assertThat(entity.getTeams()).hasSize(1);
        assertThat(entity.getTeams().iterator().next().getName()).isNull();
    }
}
```

- [ ] **Step 2: Run the test**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=PersonMapperWriteTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: all five PASS, because Task 3 already implemented the behaviour — this test pins it rather than driving it.

Two things that can go wrong and are not defects in the behaviour:

- **Constructor mismatch.** If `new PersonMapperImpl(teamRefMapper)` does not compile, read the real signature from `cometa-service-module/target/generated-sources/annotations/.../PersonMapperImpl.java` and adjust the call.
- **`Team.setId` unavailable.** `id` lives on `BaseEntity`. If it has no setter, build the `Team` with whatever the entity exposes, or use `org.springframework.test.util.ReflectionTestUtils.setField(t, "id", id)`.

If `emptyTeamsClearsAllMemberships` fails with the membership unchanged, that is a **real** failure: `NullValuePropertyMappingStrategy.IGNORE` is being applied to empty collections as well as nulls, and clearing all teams would silently no-op in production. Fix it in `PersonMapper` with an explicit empty-aware mapping rather than weakening the test.

- [ ] **Step 3: Run the whole backend test suite**

```powershell
.\mvnw.cmd -DskipTests=false test
```

Expected: `BUILD SUCCESS`. `RegistrationServiceTest` exercises `person.getTeams().add(team)` and must still pass.

- [ ] **Step 4: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/PersonMapperWriteTest.java
git commit -m "test(person): pin the three team-membership PATCH semantics"
```

---

### Task 6: Remove the `Team.leaderId` entity column

**GATED on Task 1.** If the gate failed, skip this task entirely and skip Task 9's descriptor changes — everything else in the plan is independent of it.

The column's javadoc justifies it by `getPathExpression` calling `root.fetch(...)` while `createCountQuery` applies the same predicate. That describes `ODataCriteriaService`, which Cometa never instantiates — so the rationale is void. Task 1 replaces it with evidence.

Note what this does **not** undo: `TeamDto.leaderId` stays deleted either way. Only the entity column and the filter `field` spelling ride on the gate.

**Files:**
- Modify: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/auth/Team.java:60-68`
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/TeamMapper.java`

**Interfaces:**
- Consumes: Task 1's verdict; `TeamMapper` from Task 3.
- Produces: `Team` with no `leaderId` property; `TeamMapper` with no `leaderId` ignores.

- [ ] **Step 1: Confirm the gate passed**

Paste Task 1 Step 4 and Step 5's recorded output here as evidence. If they do not match, stop.

- [ ] **Step 2: Delete the scalar from `Team.java`**

Remove this entire block, javadoc included:

```java
    /**
     * FK-скаляр лидера, только для чтения. Существует, чтобы OData-фильтрация
     * и сортировка разрешались без join: getPathExpression разбивает путь с
     * точкой и вызывает root.fetch(...), а createCountQuery применяет тот же
     * предикат — fetch join внутри SELECT COUNT Hibernate отвергает.
     */
    @Column(name = "leader_person_id", insertable = false, updatable = false)
    private Long leaderId;
```

Leave the `@ManyToOne` `leader` field above it untouched — it owns `leader_person_id`. Remove the now-unused `jakarta.persistence.Column` import **only if** no other field in the file uses `@Column`; `Team` has `name`, `code`, `leaderRole` and `structure` columns, so it almost certainly stays.

- [ ] **Step 3: Drop the now-pointless ignores from `TeamMapper.java`**

`fromDto` and `update` lose their `@Mapping` annotations entirely, which means they lose their explicit declarations too — MapStruct generates both from `BaseCrudMapper`. Replace the two override blocks with nothing, leaving:

```java
@Mapper(config = CometaCommonMapperConfig.class, uses = PersonRefMapper.class)
public interface TeamMapper extends BaseCrudMapper<Team, TeamDto> {

    /**
     * Не инициализировать ленивый прокси лидера при маппинге в DTO —
     * без ?$fields=leader вложенный leader останется null вместо N+1.
     */
    @Condition
    default boolean isEntityLoaded(Person person) {
        return Hibernate.isInitialized(person);
    }

    /** Направление чтения: Person -> PersonFlatDto. Запись идёт через PersonRefMapper. */
    PersonFlatDto toFlat(Person person);
}
```

Remove the now-unused `org.mapstruct.Mapping` and `org.mapstruct.MappingTarget` imports.

- [ ] **Step 4: Build and verify**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -DskipTests clean install
javap -v -cp cometa-service-module\target\classes ru.sberbank.cib.gmbus.service.mapper.TeamMapperImpl | Select-String interfaces
```

Expected: `BUILD SUCCESS` and `interfaces: 1`.

- [ ] **Step 5: Re-run the JPQL test**

```powershell
.\mvnw.cmd -pl cometa-service-module -am -Dtest=ODataJpqlGenerationTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: all PASS. `ODataJpqlGenerationTest` constructs `OData2Jpql(Team.class, TeamDto.class)`, so removing an entity field could change field-set resolution. If `toOneIdFilterOmitsRootAlias` now generates different JPQL than it did in Task 2, that is a genuine finding — record it before adjusting anything.

- [ ] **Step 6: Commit**

```bash
cd /f/programming/cometa
git add -A
git commit -m "refactor(team): drop the leaderId FK scalar from the entity

Its javadoc justified it by an ODataCriteriaService hazard, but Cometa only
ever uses the JPQL-string builder, so the rationale was void. Filtering moves
to the leader/id navigation path, live-verified for both row set and envelope
count before this commit."
```

---

### Task 7: Frontend DTO types

**Files:**
- Modify: `F:\programming\react\cometa-frontend\src\types\api.ts:199-243`
- Modify: `src/features/person/label.ts`

**Interfaces:**
- Consumes: the backend shapes from Task 3.
- Produces:
  - `PersonFlatDto` — `{ id, insertedAt, updatedAt, email, lastName, firstName, middleName }`
  - `PersonDto extends PersonFlatDto` — `{ teams?: TeamFlatDto[] }`
  - `TeamFlatDto` — `{ id, insertedAt, updatedAt, name: string | null, code: number | null, type: string | null, leaderRole: string | null, structure: string | null }`
  - `TeamDto extends TeamFlatDto` — `{ leader: PersonFlatDto | null }`
  - `personLabel(person: PersonFlatDto): string`

- [ ] **Step 1: Replace the DTO block in `src/types/api.ts`**

Replace the existing `TeamSummaryDto`, `PersonDto`, `PersonFilters`, `TeamDto` and `TeamFilters` declarations with:

```ts
/** Flat = every scalar of the entity, none of its relations. This is the shape
 *  a parent uses to reference a child. On write only `id` is read; every other
 *  field is ignored, because a parent may never modify a child's fields.
 *  See docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md */
export interface PersonFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
}

export interface PersonDto extends PersonFlatDto {
  /** Read: populated only on /api/v1/person/graph?$fields=teams.
   *  Write: only each element's `id` is honoured. Absent = unchanged,
   *  [] = clear all, non-empty = full replace. */
  teams?: TeamFlatDto[];
}

export interface PersonFilters extends Partial<PaginationParams> {
  email?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

export interface TeamFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string | null;
  code: number | null;
  type: string | null;
  leaderRole: string | null;
  structure: string | null;
}

export interface TeamDto extends TeamFlatDto {
  /** Read: populated only with ?$fields=leader — which is why the leader's id
   *  is no longer available on requests that omit it. Write: only `id`. */
  leader: PersonFlatDto | null;
}

export interface TeamFilters extends Partial<PaginationParams> {
  name?: string;
  codeMin?: number;
  codeMax?: number;
  type?: string;
  /** URL search-param name, not a DTO field. Unaffected by the leaderId removal. */
  leaderId?: number;
  leaderRole?: string;
  structure?: string;
}
```

- [ ] **Step 2: Widen `personLabel`**

In `src/features/person/label.ts`, change the import and the parameter type. It reads only `lastName`, `firstName`, `middleName`, `email` and `id` — all present on `PersonFlatDto` — and its caller in `team/columns.tsx` now passes the narrower type.

```ts
import type { PersonFlatDto } from "@/types/api";

export function personLabel(person: PersonFlatDto): string {
  const full = [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(" ");
  return full || person.email || `Person #${person.id}`;
}
```

- [ ] **Step 3: Type-check to enumerate every break**

```powershell
cd F:\programming\react\cometa-frontend
npx tsc -b
```

Expected: FAIL. The errors are the complete work list for Tasks 8 and 9 — record them. Anticipated: `team/mappers.ts` reading `dto.leaderId`, `team/mappers.test.ts` fixtures, `team/columns.tsx` leader cell, and `team/schema.ts`'s `TeamWritePayload`.

Do **not** fix them here. Task 7 commits a red type-check; Task 8 turns it green. If you prefer a green tree at every commit, do Tasks 7 and 8 as one commit.

- [ ] **Step 4: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add src/types/api.ts src/features/person/label.ts
git commit -m "refactor(types): mirror the backend Flat/Full DTO split"
```

---

### Task 8: Team form mappers and schema

**Files:**
- Modify: `src/features/team/schema.ts:30-37`
- Modify: `src/features/team/mappers.ts`
- Modify: `src/features/team/mappers.test.ts`
- Modify: `src/features/team/columns.tsx:131`

**Interfaces:**
- Consumes: `TeamDto`, `PersonFlatDto` from Task 7.
- Produces: `TeamWritePayload` with `leader: { id: number }`; `teamDtoToForm`, `teamFormToCreate`, `teamFormToPatch` unchanged in name and arity.

The form keeps speaking ids (`TeamFormValues.leaderId` stays `number`) and the wire speaks refs. `TeamSheet.tsx` is untouched.

- [ ] **Step 1: Update the failing tests first**

In `src/features/team/mappers.test.ts`, replace the `dto` fixture and the `teamDtoToForm` / `teamFormToCreate` / `teamFormToPatch` blocks. The test *"takes leaderId from the scalar, not the nested object"* is deleted, not adapted — its subject no longer exists.

```ts
const dto: TeamDto = {
  id: 3,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  name: "Платформа",
  code: 1234,
  type: "CHANGE",
  leader: {
    id: 99,
    insertedAt: null,
    updatedAt: null,
    email: "ivanov@example.com",
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
  },
  leaderRole: "lead",
  structure: "core",
};

const form: TeamFormValues = {
  name: "Платформа",
  code: 1234,
  type: "CHANGE",
  leaderId: 99,
  leaderRole: "lead",
  structure: "core",
};

describe("teamDtoToForm", () => {
  it("takes leaderId from the nested leader ref", () => {
    expect(teamDtoToForm(dto)).toEqual(form);
  });

  it("yields leaderId 0 when leader is absent, so the form flags it required", () => {
    // Happens on any read that omitted $fields=leader.
    const bare: TeamDto = { ...dto, leader: null };
    expect(teamDtoToForm(bare).leaderId).toBe(0);
  });
});

describe("teamFormToCreate", () => {
  it("writes the leader as a ref, not a scalar", () => {
    expect(teamFormToCreate(form)).toEqual({
      name: "Платформа",
      code: 1234,
      type: "CHANGE",
      leader: { id: 99 },
      leaderRole: "lead",
      structure: "core",
    });
  });
});

describe("teamFormToPatch", () => {
  it("returns only dirty fields, with the leader as a ref", () => {
    expect(teamFormToPatch(form, { leaderId: true })).toEqual({
      leader: { id: 99 },
    });
  });

  it("returns an empty object when nothing is dirty", () => {
    expect(teamFormToPatch(form, {})).toEqual({});
  });

  it("includes explicit nulls for cleared nullable fields", () => {
    const cleared: TeamFormValues = { ...form, structure: null };
    expect(teamFormToPatch(cleared, { structure: true })).toEqual({
      structure: null,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```powershell
cd F:\programming\react\cometa-frontend
npx vitest run src/features/team/mappers.test.ts
```

Expected: FAIL — `teamFormToCreate` still emits `leaderId`, and `teamDtoToForm` reads a property that no longer exists.

- [ ] **Step 3: Update `TeamWritePayload` in `src/features/team/schema.ts`**

`TeamFormValues` and `teamFormSchema` are unchanged. Only the write payload moves:

```ts
export interface TeamWritePayload {
  name: string | null;
  code: number | null;
  type: string | null;
  /** Relation ref: only `id` is honoured by the server. */
  leader: { id: number };
  leaderRole: string | null;
  structure: string | null;
}
```

- [ ] **Step 4: Update `src/features/team/mappers.ts`**

```ts
import type { TeamDto } from "@/types/api";
import type { TeamFormValues, TeamWritePayload } from "./schema";

export function teamDtoToForm(dto: TeamDto): TeamFormValues {
  return {
    name: dto.name,
    code: dto.code,
    type: dto.type,
    // The leader id now arrives only inside the nested ref, which is present
    // only on reads that requested $fields=leader. 0 is never a valid id, so
    // the required-positive rule in teamFormSchema rejects it.
    leaderId: dto.leader?.id ?? 0,
    leaderRole: dto.leaderRole,
    structure: dto.structure,
  };
}

export function teamFormToCreate(v: TeamFormValues): TeamWritePayload {
  return {
    name: v.name,
    code: v.code,
    type: v.type,
    leader: { id: v.leaderId },
    leaderRole: v.leaderRole,
    structure: v.structure,
  };
}

export type TeamDirtyFields = Partial<Record<keyof TeamFormValues, unknown>>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

export function teamFormToPatch(
  v: TeamFormValues,
  dirty: TeamDirtyFields,
): Partial<TeamWritePayload> {
  const out: Partial<TeamWritePayload> = {};
  if (isDirty(dirty.name)) out.name = v.name;
  if (isDirty(dirty.code)) out.code = v.code;
  if (isDirty(dirty.type)) out.type = v.type;
  if (isDirty(dirty.leaderId)) out.leader = { id: v.leaderId };
  if (isDirty(dirty.leaderRole)) out.leaderRole = v.leaderRole;
  if (isDirty(dirty.structure)) out.structure = v.structure;
  return out;
}
```

- [ ] **Step 5: Update the leader cell type in `src/features/team/columns.tsx:131`**

```ts
        const leader = cell.getValue<PersonFlatDto | null>();
```

Update the import on line 16 or nearby: `import type { PersonDto, TeamDto } from "@/types/api";` becomes whichever of `PersonFlatDto` / `TeamDto` the file still uses. If `PersonDto` has no other use in the file, replace it rather than adding alongside.

- [ ] **Step 6: Run the tests and the type-check**

```powershell
npx vitest run src/features/team/mappers.test.ts
npx tsc -b
npm test
```

Expected: the team mapper tests PASS, `tsc -b` exits clean, and the full suite passes.

- [ ] **Step 7: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add src/features/team/
git commit -m "refactor(team): write the leader as a relation ref

The form still speaks ids; only the wire payload changes. The scalar
precedence test is deleted rather than adapted — TeamDto.leaderId is gone."
```

---

### Task 9: Team filter spelling and the detail-path guard

The `$fields=leader` guard applies unconditionally. The descriptor changes are **GATED on Task 1** — skip Steps 3 and 4 if it failed.

**Files:**
- Modify: `src/features/team/api.ts:48-53`
- Modify: `src/features/team/filter-descriptors.ts:13-19` *(gated)*
- Modify: `src/features/team/advanced-api.ts:15` *(gated)*
- Modify: `src/features/team/filter-descriptors.test.ts:23` *(gated)*

**Interfaces:**
- Consumes: Task 1's verdict.
- Produces: no new symbols.

- [ ] **Step 1: Add `$fields=leader` to the Team detail path**

`createCrudApi`'s `fetchOne` hits `${basePath}/${id}` with no params, so a detail-fetched Team would carry `leader: null` and `teamDtoToForm` would yield `leaderId: 0` — rendering as "Leader is required" on a team that has one. Nothing calls that path today (`TeamCombobox` reads only `name`), so this is a guard against a future caller, not a live bug.

In `src/features/team/api.ts`, in the **local** `detailQueryOptions` — the one the file's comment marks as deliberately not-dead duplication, because the registration flow pins its resolution here:

```ts
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["teams", "detail", id] as const,
    // $fields=leader is required: since TeamDto.leaderId was removed, the
    // leader's id arrives only inside the nested ref. Without it,
    // teamDtoToForm yields leaderId 0 and the sheet reports a missing leader.
    queryFn: () =>
      apiFetch<ApiResponse<TeamDto>>(`/api/v1/team/${id}?$fields=leader`),
  });
}
```

- [ ] **Step 2: Verify the detail path still works**

```powershell
cd F:\programming\react\cometa-frontend
npx tsc -b
npm test
```

Expected: clean. Live confirmation happens in Task 10.

- [ ] **Step 3: Switch the filter field spelling — GATED**

Only if Task 1 passed. In `src/features/team/filter-descriptors.ts`:

```ts
  {
    id: "leader",
    variant: "relation",
    // OData path against the Team entity. `field` is the query spelling and
    // moved to the nav path when Team.leaderId was removed; `filterKey` is the
    // URL search-param name and must NEVER change — renaming it breaks
    // bookmarked URLs. Live-verified for row set and envelope count.
    field: "leader/id",
    sortField: "leader/lastName",
    filterKey: "leaderId",
  },
```

And in `src/features/team/advanced-api.ts:15`:

```ts
  leader:     { field: "leader/id",  variant: "relation", sortField: "leader/lastName" },
```

- [ ] **Step 4: Update the descriptor test — GATED**

In `src/features/team/filter-descriptors.test.ts:23`:

```ts
    expect(p.get("$filter")).toBe("leader/id eq 30");
```

Also check `src/lib/odata/build-filter-params.test.ts:10` and `src/lib/odata/build-advanced-filter-params.test.ts:217`, which use `field: "leaderId"` in **synthetic** descriptors. Those are testing the builder, not Team, so leave them unless the assertion names Team specifically.

- [ ] **Step 5: Run everything**

```powershell
npm test
npx tsc -b
npm run lint
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add src/features/team/ src/lib/odata/
git commit -m "fix(team): request \$fields=leader on the detail path, filter via leader/id

Removing TeamDto.leaderId makes the leader's id conditional on \$fields=leader,
so the detail path must ask for it. The filter field moves to the nav path,
verified live for both row set and envelope count."
```

---

### Task 10: Phase 1 end-to-end verification

Nothing user-visible changed, which is exactly what makes this worth checking by hand. This is also the only test that the Spring context starts — there is no `@SpringBootTest` in the codebase to catch a bean cycle.

**Files:** none.

**Interfaces:**
- Consumes: Tasks 3, 4, 6, 7, 8, 9.
- Produces: a go/no-go for Phase 2.

- [ ] **Step 1: Rebuild and start the backend**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -DskipTests clean install
$env:DB_PASSWORD = ((Get-Content -Raw "F:\programming\cometa\.vscode\backend.env") -split '=',2)[1].Trim()
$env:SPRING_PROFILES_ACTIVE = "local"
& "$env:JAVA_HOME\bin\java.exe" -jar "F:\programming\cometa\cometa-web-module\target\cometa-web-module-0.0.1-SNAPSHOT.jar"
```

Expected: `Started CometaApplication`. A failure reading `required a bean of type '...Mapper' that could not be found` means the MapStruct corruption is back — re-run the `javap` check from the Global Constraints. A `BeanCurrentlyInCreationException` means a mapper acquired a service dependency; remove it.

- [ ] **Step 2: Confirm the read shapes**

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/auth/login" -ContentType "application/json" -Body '{"sigmaLogin":"16674475","password":"qweqweqwe"}'
$h = @{ Authorization = "Bearer $($login.token)" }

$t = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team/graph?`$top=1&`$fields=leader" -Headers $h
$t.data[0] | ConvertTo-Json -Depth 4

$p = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/person/graph?`$top=1&`$fields=teams" -Headers $h
$p.data[0] | ConvertTo-Json -Depth 4
```

Expected: the Team carries a nested `leader` object with `email`/`lastName` and **no** `leaderId`; the leader object has **no** `teams` key. The Person carries `teams` as an array of objects with `name`, `code`, `type`, `leaderRole`, `structure` and **no** `leader` key. One hop, then it stops — that is the Flat/Full split doing its job.

- [ ] **Step 3: Confirm the Team write path**

```powershell
$body = '{"name":"ZZ plan smoke","code":999999,"type":"RUN","leader":{"id":<id1>},"leaderRole":"tmp","structure":"tmp"}'
$created = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/team" -Headers $h -ContentType "application/json" -Body $body
$created.data.id

$patched = Invoke-RestMethod -Method Patch -Uri "http://localhost:8080/api/v1/team/$($created.data.id)" -Headers $h -ContentType "application/json" -Body '{"leaderRole":"changed"}'
$patched.data.leaderRole
```

Expected: creation returns an id, and the patch returns `changed`. Then confirm the leader FK actually landed:

```powershell
$check = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/team/graph?`$fields=leader&`$filter=id eq $($created.data.id)" -Headers $h
$check.data[0].leader.id
```

Expected: `<id1>`. If it is null, the ref mapping did not write the FK — stop and inspect `TeamMapperImpl`.

- [ ] **Step 4: Clean up the smoke row**

```powershell
Invoke-RestMethod -Method Delete -Uri "http://localhost:8080/api/v1/team/$($created.data.id)" -Headers $h
```

- [ ] **Step 5: Smoke the other five entities**

Task 4 broadened the transaction for every service, not just Person and Team. The argument that nothing changes is sound — those write paths work today, so they cannot be mapping lazy associations — but it is an argument, not evidence. Each write below is cheap and is the only thing standing between that reasoning and a silent regression.

For each of `automated-system`, `flow`, `link`, `node`, `topic`, read one row, PATCH one scalar field on it, and confirm the response echoes the change:

```powershell
foreach ($r in @("automated-system","flow","link","node","topic")) {
  try {
    $row = (Invoke-RestMethod -Uri "http://localhost:8080/api/v1/$r`?`$top=1" -Headers $h).data[0]
    if ($null -eq $row) { "$r -> no rows, skipped"; continue }
    "$r -> id=$($row.id) OK"
  } catch { "$r -> READ FAILED: $($_.Exception.Message)" }
}
```

Expected: every entity reads without error. Then PATCH one of them — pick a nullable text column visible in the read output, set it to its current value, and confirm HTTP 200 with the value unchanged:

```powershell
$before = (Invoke-RestMethod -Uri "http://localhost:8080/api/v1/topic?`$top=1" -Headers $h).data[0]
$res = Invoke-RestMethod -Method Patch -Uri "http://localhost:8080/api/v1/topic/$($before.id)" `
  -Headers $h -ContentType "application/json" -Body '{"name":"<its current name>"}'
$res.data.name
```

Expected: 200, unchanged value. A `LazyInitializationException` or `TransactionRequiredException` here means that entity's mapper touches a lazy association and the broadened transaction changed its behaviour — record which entity and fix it before continuing. Repeat for at least one more entity of a different shape (`link` or `node`, which carry FK scalars).

- [ ] **Step 6: Exercise the `/team` page**

```powershell
cd F:\programming\react\cometa-frontend
npm run dev -- --host
```

The plain dev server is unreachable on this machine — `--host` is required. Then in the browser:

- Open `/team`. The Leader column renders surnames.
- Sort by Leader. Rows reorder by surname.
- Filter by Leader through the relation picker. Row count and the displayed total agree.
- Edit a team, change its leader, save. The new leader appears in the row.
- Create a team with a leader. It appears with that leader.

Every one of these must work exactly as before. Any difference is a regression from Phase 1, not a new feature.

- [ ] **Step 7: Record the result**

No commit. If everything passed, Phase 1 is done and Phase 2 may begin. If anything failed, fix it in the task that owns it before proceeding.

---

# PHASE 2 — Person team membership

Small, now that Phase 1 is in.

---

### Task 11: Person form schema and mappers

**Files:**
- Modify: `src/features/person/schema.ts`
- Modify: `src/features/person/mappers.ts`
- Modify: `src/features/person/mappers.test.ts`

**Interfaces:**
- Consumes: `PersonDto`, `TeamFlatDto` from Task 7.
- Produces:
  - `PersonFormValues` gains `teamIds: number[]`.
  - `PersonWritePayload` gains `teams?: { id: number }[]`.
  - `personFormToPatch(v, dirty, originalTeamIds: number[])` — **arity changed from 2 to 3.** Task 12 must pass the third argument.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/person/mappers.test.ts`. Keep every existing test — the four scalar fields are unchanged — and extend the two fixtures:

```ts
const dto: PersonDto = {
  id: 7,
  insertedAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
  teams: [
    {
      id: 3,
      insertedAt: null,
      updatedAt: null,
      name: "Платформа",
      code: 1234,
      type: "CHANGE",
      leaderRole: null,
      structure: null,
    },
  ],
};

const form: PersonFormValues = {
  email: "ivanov@example.com",
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
  teamIds: [3],
};
```

Every existing `personFormToPatch(form, {...})` call now needs a third argument. For the scalar tests pass `form.teamIds` so team membership reads as unchanged:

```ts
describe("personDtoToForm", () => {
  it("drops server-managed fields and keeps the four editable ones", () => {
    expect(personDtoToForm(dto)).toEqual(form);
  });

  it("yields an empty team list when teams is absent", () => {
    // Any read that omitted $fields=teams.
    const { teams: _teams, ...withoutTeams } = dto;
    expect(personDtoToForm(withoutTeams as PersonDto).teamIds).toEqual([]);
  });

  it("yields an empty team list when the person is in no teams", () => {
    expect(personDtoToForm({ ...dto, teams: [] }).teamIds).toEqual([]);
  });
});

describe("personFormToCreate", () => {
  it("writes teams as refs", () => {
    expect(personFormToCreate(form)).toEqual({
      email: "ivanov@example.com",
      lastName: "Иванов",
      firstName: "Иван",
      middleName: "Иванович",
      teams: [{ id: 3 }],
    });
  });
});

describe("personFormToPatch team membership", () => {
  it("omits teams entirely when membership is unchanged", () => {
    expect(personFormToPatch(form, {}, [3])).toEqual({});
  });

  it("ignores ordering when deciding whether membership changed", () => {
    const reordered: PersonFormValues = { ...form, teamIds: [7, 3] };
    expect(personFormToPatch(reordered, {}, [3, 7])).toEqual({});
  });

  it("sends the full replacement set when a team is added", () => {
    const added: PersonFormValues = { ...form, teamIds: [3, 7] };
    expect(personFormToPatch(added, {}, [3])).toEqual({
      teams: [{ id: 3 }, { id: 7 }],
    });
  });

  it("sends an empty array when every team is removed", () => {
    // The critical case: dirtyFields would report an empty array as CLEAN,
    // so relying on it here would silently drop the change.
    const cleared: PersonFormValues = { ...form, teamIds: [] };
    expect(personFormToPatch(cleared, {}, [3])).toEqual({ teams: [] });
  });

  it("sends teams alongside dirty scalars", () => {
    const changed: PersonFormValues = { ...form, teamIds: [9] };
    expect(personFormToPatch(changed, { email: true }, [3])).toEqual({
      email: "ivanov@example.com",
      teams: [{ id: 9 }],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```powershell
cd F:\programming\react\cometa-frontend
npx vitest run src/features/person/mappers.test.ts
```

Expected: FAIL — `teamIds` is not in the schema and `personFormToPatch` takes two arguments.

- [ ] **Step 3: Update `src/features/person/schema.ts`**

```ts
import { z } from "zod";

export const personFormSchema = z.object({
  email: z.string().min(1, "Email is required").email("Must be a valid email"),
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().min(1, "Middle name is required"),
  /** Team membership is optional: an empty list is valid and means "no teams". */
  teamIds: z.array(z.number().int().positive()),
});

export type PersonFormValues = z.infer<typeof personFormSchema>;

export interface PersonWritePayload {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  /** Relation refs: only `id` is honoured. Omitted = unchanged,
   *  [] = clear all, non-empty = full replace. */
  teams?: { id: number }[];
}
```

- [ ] **Step 4: Update `src/features/person/mappers.ts`**

```ts
import type { PersonDto } from "@/types/api";
import type { PersonFormValues, PersonWritePayload } from "./schema";

export function personDtoToForm(dto: PersonDto): PersonFormValues {
  return {
    email: dto.email,
    lastName: dto.lastName,
    firstName: dto.firstName,
    middleName: dto.middleName,
    // `teams` is absent on any read that omitted $fields=teams; an absent
    // relation and an empty relation both mean "nothing to preselect".
    teamIds: dto.teams?.map((t) => t.id) ?? [],
  };
}

export function personFormToCreate(v: PersonFormValues): PersonWritePayload {
  return {
    email: v.email,
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
    teams: v.teamIds.map((id) => ({ id })),
  };
}

export type PersonDirtyFields = Partial<
  Record<keyof PersonFormValues, unknown>
>;

function isDirty(flag: unknown): boolean {
  if (flag === true) return true;
  if (Array.isArray(flag)) return flag.length > 0;
  return Boolean(flag);
}

/** Order-independent set comparison. Team membership has no meaningful order,
 *  so a reorder must not be reported as a change. */
function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((id) => seen.has(id));
}

export function personFormToPatch(
  v: PersonFormValues,
  dirty: PersonDirtyFields,
  originalTeamIds: number[],
): Partial<PersonWritePayload> {
  const out: Partial<PersonWritePayload> = {};
  if (isDirty(dirty.email)) out.email = v.email;
  if (isDirty(dirty.lastName)) out.lastName = v.lastName;
  if (isDirty(dirty.firstName)) out.firstName = v.firstName;
  if (isDirty(dirty.middleName)) out.middleName = v.middleName;

  // Deliberately NOT driven by `dirty.teamIds`. react-hook-form reports an
  // emptied array as clean under `isDirty` above, so "remove from every team"
  // would silently no-op. Compare against the original set instead.
  if (!sameIdSet(v.teamIds, originalTeamIds)) {
    out.teams = v.teamIds.map((id) => ({ id }));
  }
  return out;
}
```

- [ ] **Step 5: Run the tests**

```powershell
npx vitest run src/features/person/mappers.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add src/features/person/schema.ts src/features/person/mappers.ts src/features/person/mappers.test.ts
git commit -m "feat(person): map team membership between form ids and relation refs

Patch compares team id sets rather than consulting dirtyFields, which reports
an emptied array as clean and would drop 'remove from every team'."
```

---

### Task 12: The Teams picker in PersonSheet

**Files:**
- Modify: `src/features/person/components/PersonSheet.tsx`

**Interfaces:**
- Consumes: `personFormToPatch(v, dirty, originalTeamIds)` from Task 11; `RelationPicker` from `@/components/relation-picker`; `teamsFilteredQueryOptions` from `@/features/team/api`.
- Produces: no new exports.

- [ ] **Step 1: Add the imports**

```tsx
import { Controller } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";

import { RelationPicker } from "@/components/relation-picker";
import { teamsFilteredQueryOptions } from "@/features/team/api";
import type { PersonDto, AppMessage, TeamDto } from "@/types/api";
```

`useForm` is already imported from `react-hook-form`; add `Controller` to that existing import rather than duplicating it.

- [ ] **Step 2: Add the relation column definition**

At module scope, below `PERSON_FORM_FIELDS`. This mirrors `teamRelationColumns` in `src/features/person/columns.tsx` so the picker in the sheet and the picker in the toolbar filter look identical.

```tsx
const teamRelationColumns: ColumnDef<TeamDto, unknown>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "name", header: "Name" },
];
```

- [ ] **Step 3: Register `teamIds` as a form field and alias the server target**

```tsx
const PERSON_FORM_FIELDS: readonly (keyof PersonFormValues)[] = [
  "email",
  "lastName",
  "firstName",
  "middleName",
  "teamIds",
];
```

The server names this relation `teams` while the form calls it `teamIds`. Inert today — `getReference` never produces a field-targeted error for it — but one line keeps them connected if that ever changes. Inside `applyServerErrors`, before the `isPersonField` check:

```tsx
      const target = m.target === "teams" ? "teamIds" : m.target;
      if (target && isPersonField(target)) {
        form.setError(target as Path<PersonFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
```

Replace the existing `if (m.target && isPersonField(m.target))` block with the above.

- [ ] **Step 4: Seed the default value**

```tsx
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: person
      ? personDtoToForm(person)
      : {
          email: "",
          lastName: "",
          firstName: "",
          middleName: "",
          teamIds: [],
        },
  });
```

No extra fetch is needed: `person` comes from the table row, and both `person/api.ts` `staticParams` and `advanced-api.ts` request `$fields=teams` unconditionally, so `teams` is already there.

- [ ] **Step 5: Pass the original team ids to the patch mapper**

```tsx
  const originalTeamIds = React.useMemo(
    () => person?.teams?.map((t) => t.id) ?? [],
    [person],
  );

  const mutation = useMutation({
    mutationFn: async (data: PersonFormValues) => {
      if (variant === "update" && person) {
        const patch = personFormToPatch(
          data,
          form.formState.dirtyFields,
          originalTeamIds,
        );
        return personApi.patch(person.id, patch);
      }
      return personApi.create(personFormToCreate(data));
    },
    // onSuccess / onError unchanged
```

- [ ] **Step 6: Render the picker**

Insert between the Middle Name block and `<SheetFooter>`:

```tsx
          {/* Teams (optional) */}
          <div className="flex flex-col gap-2">
            <Label>Teams</Label>
            <Controller
              control={form.control}
              name="teamIds"
              render={({ field }) => (
                <RelationPicker
                  multi
                  variant="field"
                  value={field.value}
                  // RelationPicker emits `undefined` when the selection is
                  // cleared, not []. Without this normalisation the zod array
                  // schema breaks and "remove from every team" is lost.
                  onChange={(v) =>
                    field.onChange(Array.isArray(v) ? v : v === undefined ? [] : [v])
                  }
                  queryOptionsFn={(filters: Record<string, unknown>) =>
                    teamsFilteredQueryOptions(filters)
                  }
                  columns={teamRelationColumns}
                  getLabel={(team: TeamDto) => team.name ?? String(team.id)}
                  getId={(team: TeamDto) => team.id}
                  placeholder="Select teams"
                />
              )}
            />
            {form.formState.errors.teamIds && (
              <p className="text-sm text-destructive">
                {form.formState.errors.teamIds.message}
              </p>
            )}
          </div>
```

- [ ] **Step 7: Type-check, lint and test**

```powershell
cd F:\programming\react\cometa-frontend
npx tsc -b
npm run lint
npm test
```

Expected: all clean.

- [ ] **Step 8: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add src/features/person/components/PersonSheet.tsx
git commit -m "feat(person): edit team membership from the add/edit panel

RelationPicker emits undefined on clear, so the Controller normalises to []
to keep 'remove from every team' expressible."
```

---

### Task 13: Null-safe team names, and Phase 2 verification

**Files:**
- Modify: `src/features/person/columns.tsx:143-148`

**Interfaces:**
- Consumes: `TeamFlatDto` from Task 7.
- Produces: nothing.

- [ ] **Step 1: Make the Teams cell null-safe**

`TeamFlatDto.name` is `string | null` because the column is nullable, where `TeamSummaryDto.name` was `string`. A team with no name would render as an empty segment between commas.

```tsx
      cell: ({ row }) => {
        const teams = row.original.teams;
        if (!teams || teams.length === 0) return "—";
        // name is nullable on the entity; fall back to the id so a nameless
        // team is still visible rather than an empty comma segment. Matches
        // getLabel in the relation pickers.
        return teams.map((t) => t.name ?? `#${t.id}`).join(", ");
      },
```

- [ ] **Step 2: Type-check and test**

```powershell
cd F:\programming\react\cometa-frontend
npx tsc -b
npm test
npm run lint
```

Expected: all clean.

- [ ] **Step 3: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add src/features/person/columns.tsx
git commit -m "fix(person): fall back to the id when a team has no name"
```

- [ ] **Step 4: Verify the feature end to end**

Backend running as in Task 10 Step 1, then:

```powershell
cd F:\programming\react\cometa-frontend
npm run dev -- --host
```

On `/person`:

- **Read** — the Teams column shows memberships. Open Edit on a person who has teams: the picker is pre-filled with exactly those teams, by name.
- **Add** — edit a person, add one team, save. The row's Teams column gains it. Reload the page; it is still there.
- **Remove one** — remove a single team from a person with two, save. Only that one disappears.
- **Clear all** — remove every team, save. The Teams column shows `—`. **Reload and confirm it is still empty** — this is the case `dirtyFields` would have silently dropped, and the only way to tell a real clear from a no-op is that it survives a reload.
- **Unchanged** — edit a person, change only the surname, save. Team membership is untouched.
- **Reorder** — open the picker, deselect and reselect the same teams in a different order, save. The network tab shows no `teams` key in the PATCH body.
- **Create** — create a new person with two teams. Both appear on the new row.
- **Filter interaction** — filter the table by a team, then edit a person from the filtered results. The picker still pre-fills correctly.

- [ ] **Step 5: Confirm the join table directly**

For the clear-all case especially, confirm the rows are actually gone rather than merely hidden. Using the `mcp__cometa-postgres__pg_execute_query` tool with an explicit connection string — the tool defaults to a **different** database:

```
postgresql://GMBUS:<DB_PASSWORD>@192.168.0.60:5432/cometa
```

```sql
SELECT team_id FROM gmsb.person_team_link WHERE person_id = <the person you cleared>;
```

Expected: zero rows.

- [ ] **Step 6: Record the result**

No commit. If every case passed, the feature is complete.

---

## Completion

When all thirteen tasks are done:

- **Backend** (`F:\programming\cometa`) — Flat/Full DTO pairs, `BaseRefMapper`, transactional writes across all seven services, and `Team.leaderId` removed if the gate passed.
- **Frontend** (`F:\programming\react\cometa-frontend`) — mirrored types, Team migrated to relation refs, and Person team membership editable.
- **Follow-ups this makes cheap, none of them in scope now** — migrating `LinkDto`'s `flowId` / `clientNodeId` / `serverNodeId` / `principalId` to refs once those get `@ManyToOne` associations; and swapping `getReference` for a validating `em.find` inside `BaseRefMapper` if field-targeted errors on bad ids are ever wanted, which is a one-method change touching no mapper.

Consider updating `CLAUDE.md`'s conventions section to record the relation-write standard alongside the existing relation filter/sort rules, so the next contributor finds it without reading the spec.
