# Entity-Graph Collection Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore SQL-level `LIMIT`/`OFFSET` on paginated entity-graph reads that fetch a to-many collection, by splitting the read into two queries — and only when the graph actually pulls a collection.

**Architecture:** `EntityGraphBaseCrudRepository.readAll(ODataParams, CometaEntityGraph)` gains a gate. When the request is paged *and* the entity graph names a to-many attribute (decided by the JPA metamodel), it pages the roots with a plain query, then fetches the graph for exactly those ids, then restores the first query's order in Java. Everything else keeps today's single-query path byte-for-byte. The Person-specific prototype in `PersonCrudRepository` is deleted in favour of the base-class implementation.

**Tech Stack:** Java 17, Spring Boot 4.0.6, Hibernate 7.2, odata-mini 2.2.0-SNAPSHOT, Cosium spring-data-jpa-entity-graph 4.0.4, JUnit 5 + Mockito + AssertJ, Maven multi-module.

**Spec:** `cometa-frontend/docs/superpowers/specs/2026-08-27-entity-graph-collection-pagination-design.md`

**Repo:** Tasks 1–4 are in `F:\programming\cometa`. Task 5 is in `F:\programming\react\cometa-frontend`.

**Starting state:** `PersonCrudRepository.java` has **uncommitted** working-tree changes — a Person-only prototype of this feature. Task 2 deletes it. That is intended, not a loss; the generalized version replaces it in Task 3. Everything else in both repos is clean.

## Global Constraints

- **JDK 17 is required.** Set `JAVA_HOME` to `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot` for every Maven and `java` command. The machine's default JDK is not 17.
- **Build from the root reactor.** Building a single module fails to resolve sibling SNAPSHOTs. Use `-pl <module> -am`.
- **PowerShell splits `-D` arguments on the dot.** Always quote them: `"-Dtest=Foo"`, `"-Dsurefire.failIfNoSpecifiedTests=false"`. Unquoted, Maven reports `Unknown lifecycle phase ".failIfNoSpecifiedTests=false"`.
- **Always pass `clean` when running tests.** The IDE's Eclipse JDT language server writes its own class files into `target/`, and surefire will run them, reporting `Unresolved compilation problems` for source that compiles fine under javac.
- **Stop any running backend before `clean`.** A running `cometa-web-module-0.0.1-SNAPSHOT.jar` locks its own file and `maven-clean-plugin` fails with "the file is in use". Find it with `Get-CimInstance Win32_Process -Filter "Name='java.exe'"` filtered on `*cometa-web-module*`.
- **`lombok.config` at the repo root sets `fieldDefaults.defaultFinal=true`** with `config.stopBubbling=true`. Any package without an override gets blank-final fields, which breaks `@Mock` and `@Autowired` field injection. Overrides exist under `entity`, `service/dto`, `service/dto/nodes`, `service/exception` and `cometa-service-module/src/test/.../service` — **not** under the persistence module's test tree. Task 1 adds that override.
- **A transient `testCompile` flake exists in `cometa-service-module`:** a compilation error naming a class that demonstrably exists, in code the change never touched. An identical re-run with no edits passes. Treat one such failure as noise; investigate only if it survives a retry.
- **Comments in new backend code are written in Russian**, matching every neighbouring class. Test method names stay English.
- **Do not reformat or re-order code you are not changing.** Reviews diff against a narrow expected change set.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/lombok.config` | Create. Disables blank-final defaults for the persistence module's test tree so `@Mock` fields can be injected. | 1 |
| `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraph.java` | Modify. Gains `hasPluralAttribute(Metamodel, Class<?>)` — the to-many predicate. Owns `attributePaths`, so the predicate belongs here. | 1 |
| `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraphMetamodelTest.java` | Create. Unit-tests the predicate against a mocked metamodel. | 1 |
| `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/PersonCrudRepository.java` | Modify. Delete the uncommitted prototype; back to an empty class body. | 2 |
| `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/EntityGraphBaseCrudRepository.java` | Modify. `MODEL extends WithId` bound; the gate; the two-query read; `sortAsIn`. | 3 |
| `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/SortAsInTest.java` | Create. Unit-tests order restoration. | 3 |
| `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/EntityGraphBaseCrudService.java` | Modify. `@Transactional(readOnly = true)` on `getAll`. | 4 |
| `cometa-frontend/issue/personTeamsInMemoryPagination.md` | Modify. Close the issue out. | 5 |

**Task 2 must run before Task 3.** The prototype declares a `private sortAsIn`; Task 3 adds a package-private `sortAsIn` to the base class. Java rejects that combination outright — `sortAsIn(List<Person>,List<Long>) in PersonCrudRepository cannot override sortAsIn(List<MODEL>,List<Long>) ... attempting to assign weaker access privileges`. Deleting the prototype first also keeps every intermediate commit in a valid state: after Task 2 the code is exactly the committed baseline, whose in-memory pagination is a documented, accepted cost.

Task 5 is documentation only and carries no test cycle; it is gated on Task 4's live verification having passed.

---

### Task 1: The to-many predicate

**Files:**
- Create: `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/lombok.config`
- Modify: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraph.java`
- Test: `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraphMetamodelTest.java`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `public boolean CometaEntityGraph.hasPluralAttribute(jakarta.persistence.metamodel.Metamodel metamodel, Class<?> rootType)` — returns `true` if any attribute path in this graph reaches a collection (`@OneToMany`, `@ManyToMany`, `@ElementCollection`) from `rootType`. Task 3 calls this.

**Context you need:** `CometaEntityGraph` wraps a `private final Collection<String> attributePaths` with no getter — that is why the predicate lives here rather than in the repository. Cosium's `DynamicEntityGraph` accepts nested dotted paths (`"supplier.address"` per its javadoc), so a top-level-only check would miss `leader.teams`.

- [ ] **Step 1: Create the lombok config so `@Mock` fields can be injected**

Without this, Step 2's test fails to compile with `variable metamodel not initialized in the default constructor`. This mirrors `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/lombok.config` exactly.

Create `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/lombok.config`:

```
lombok.fieldDefaults.defaultFinal=false
lombok.accessors.fluent=false
```

- [ ] **Step 2: Write the failing test**

Create `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraphMetamodelTest.java`.

The raw-type casts (`(EntityType)`, `(Type)`, `(Attribute)`) are required: Mockito's `thenReturn` cannot match JPA's wildcard-heavy generics without them. `@MockitoSettings(strictness = Strictness.LENIENT)` is required because each test stubs only the attributes its own path walks. This exact file has been compiled and run green — transcribe it as-is.

```java
package ru.sberbank.cib.gmbus.repository;

import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.Metamodel;
import jakarta.persistence.metamodel.SingularAttribute;
import jakarta.persistence.metamodel.Type;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import ru.sberbank.cib.gmbus.entity.auth.Person;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Контракт {@link CometaEntityGraph#hasPluralAttribute}: ответ «тянет ли граф
 * коллекцию» берётся из метамодели JPA. Метамодель здесь замокана — поднимать
 * ради этого Spring-контекст незачем, а в проекте его и нет.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CometaEntityGraphMetamodelTest {

    @Mock
    Metamodel metamodel;

    @Mock
    EntityType<Person> personType;

    @BeforeEach
    void bindRoot() {
        when(metamodel.entity(Person.class)).thenReturn((EntityType) personType);
    }

    /** Плюральный атрибут: isCollection() == true. */
    private void givenCollection(ManagedTypeStub owner, String name) {
        Attribute<?, ?> attribute = mock(Attribute.class);
        when(attribute.isCollection()).thenReturn(true);
        owner.expose(name, attribute);
    }

    /** Скалярная колонка: сингулярный атрибут базового типа. */
    private void givenBasic(ManagedTypeStub owner, String name) {
        SingularAttribute<?, ?> attribute = mock(SingularAttribute.class);
        when(attribute.isCollection()).thenReturn(false);
        when(attribute.getType()).thenReturn((Type) mock(Type.class));
        owner.expose(name, attribute);
    }

    /** -toOne связь: сингулярный атрибут, тип которого — ManagedType. */
    private EntityType<?> givenToOne(ManagedTypeStub owner, String name) {
        EntityType<?> target = mock(EntityType.class);
        SingularAttribute<?, ?> attribute = mock(SingularAttribute.class);
        when(attribute.isCollection()).thenReturn(false);
        when(attribute.getType()).thenReturn((Type) target);
        owner.expose(name, attribute);
        return target;
    }

    /** Оборачивает мок ManagedType, чтобы getAttribute отвечал по имени. */
    private record ManagedTypeStub(jakarta.persistence.metamodel.ManagedType<?> type) {
        void expose(String name, Attribute<?, ?> attribute) {
            when(type.getAttribute(name)).thenReturn((Attribute) attribute);
        }

        void hide(String name) {
            doThrow(new IllegalArgumentException("Unable to locate attribute " + name))
                    .when(type).getAttribute(name);
        }
    }

    @Test
    void toManyAttributeIsDetected() {
        givenCollection(new ManagedTypeStub(personType), "teams");

        assertThat(CometaEntityGraph.fromAttributePaths("teams")
                .hasPluralAttribute(metamodel, Person.class)).isTrue();
    }

    @Test
    void toOneAttributeIsNotPlural() {
        givenToOne(new ManagedTypeStub(personType), "leader");

        assertThat(CometaEntityGraph.fromAttributePaths("leader")
                .hasPluralAttribute(metamodel, Person.class)).isFalse();
    }

    @Test
    void nestedCollectionBehindToOneIsDetected() {
        EntityType<?> leaderType = givenToOne(new ManagedTypeStub(personType), "leader");
        givenCollection(new ManagedTypeStub(leaderType), "teams");

        assertThat(CometaEntityGraph.fromAttributePaths("leader.teams")
                .hasPluralAttribute(metamodel, Person.class)).isTrue();
    }

    @Test
    void unknownAttributeIsNotPluralAndDoesNotThrow() {
        new ManagedTypeStub(personType).hide("nonsense");

        assertThat(CometaEntityGraph.fromAttributePaths("nonsense")
                .hasPluralAttribute(metamodel, Person.class)).isFalse();
    }

    @Test
    void basicColumnStopsTheWalk() {
        givenBasic(new ManagedTypeStub(personType), "email");

        assertThat(CometaEntityGraph.fromAttributePaths("email.whatever")
                .hasPluralAttribute(metamodel, Person.class)).isFalse();
    }

    @Test
    void emptyGraphIsNotPlural() {
        assertThat(CometaEntityGraph.empty()
                .hasPluralAttribute(metamodel, Person.class)).isFalse();
    }

    @Test
    void anyPluralPathAmongSeveralWins() {
        ManagedTypeStub person = new ManagedTypeStub(personType);
        givenToOne(person, "leader");
        givenCollection(person, "teams");

        assertThat(CometaEntityGraph.fromAttributePaths("leader", "teams")
                .hasPluralAttribute(metamodel, Person.class)).isTrue();
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
.\mvnw.cmd -pl cometa-persistence-module -am clean test "-Dtest=CometaEntityGraphMetamodelTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: FAIL at compile with `cannot find symbol: method hasPluralAttribute`.

- [ ] **Step 4: Add the imports**

In `CometaEntityGraph.java`, add to the existing import block:

```java
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.ManagedType;
import jakarta.persistence.metamodel.Metamodel;
import jakarta.persistence.metamodel.SingularAttribute;
```

- [ ] **Step 5: Implement the predicate**

Append to `CometaEntityGraph`, after the existing `isEmpty()` method:

```java
    /**
     * Тянет ли граф хотя бы одну коллекцию (-toMany) от корня rootType.
     *
     * Именно коллекция в fetch-графе заставляет Hibernate уйти в постраничность
     * в памяти (HHH90003004); для -toOne связей LIMIT/OFFSET доходят до СУБД,
     * и разбивать чтение на два запроса незачем.
     *
     * Источник истины — метамодель JPA, то есть собственные метаданные
     * маппинга Hibernate, а не рефлексия.
     */
    public boolean hasPluralAttribute(Metamodel metamodel, Class<?> rootType) {
        return this.attributePaths.stream()
                .anyMatch(path -> isPlural(metamodel, rootType, path));
    }

    private boolean isPlural(Metamodel metamodel, Class<?> rootType, String path) {
        ManagedType<?> current = metamodel.entity(rootType);

        // Cosium DynamicEntityGraph принимает вложенные пути через точку
        // ("supplier.address"), поэтому проверять только первый сегмент нельзя:
        // "leader.teams" доходит до коллекции через -toOne.
        for (String segment : path.split("\\.")) {
            Attribute<?, ?> attribute;
            try {
                attribute = current.getAttribute(segment);
            } catch (IllegalArgumentException unknownField) {
                // $fields приходит от клиента, а на бэкенде включён
                // odata.mini.repo.throw-on-field-not-found: false — неизвестное
                // поле не тянет коллекцию, значит ответ false, а не исключение.
                return false;
            }

            if (attribute.isCollection()) {
                return true;
            }

            if (!(attribute instanceof SingularAttribute<?, ?> singular)
                    || !(singular.getType() instanceof ManagedType<?> nested)) {
                return false;
            }

            current = nested;
        }

        return false;
    }
```

- [ ] **Step 6: Run the test to verify it passes**

```powershell
.\mvnw.cmd -pl cometa-persistence-module -am clean test "-Dtest=CometaEntityGraphMetamodelTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: `Tests run: 7, Failures: 0, Errors: 0`.

- [ ] **Step 7: Commit**

```bash
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraph.java \
        cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/CometaEntityGraphMetamodelTest.java \
        cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/lombok.config
git commit -m "feat(odata): detect to-many attributes in an entity graph via the JPA metamodel"
```

---

### Task 2: Delete the Person-specific prototype

**Files:**
- Modify: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/PersonCrudRepository.java`

**Interfaces:**
- Consumes: nothing.
- Produces: a `PersonCrudRepository` with an empty body, so Task 3 can add a package-private `sortAsIn` to the base class without a visibility clash.

**Context you need:** this file holds **uncommitted** working-tree changes: a Person-only prototype of the two-query read. It works, but it hardcodes the alias `"Person"` in three places — it only functioned because `ODataOrderby` aliases on `modelClass.getSimpleName()`. Task 3 generalizes it into the base class. Deleting it here is the point of the task, and the resulting state is exactly the committed baseline.

Do **not** try to preserve any of it. Do **not** `git checkout` the file — that also works, but writing the file explicitly is unambiguous.

- [ ] **Step 1: Reduce the class to an empty body**

Replace the entire file with:

```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.stereotype.Repository;
import ru.sberbank.cib.gmbus.entity.auth.Person;

@Repository
public class PersonCrudRepository extends EntityGraphBaseCrudRepository<Person, Long> {
}
```

- [ ] **Step 2: Run the full suite**

```powershell
.\mvnw.cmd clean test
```

Expected: `BUILD SUCCESS`; persistence 11, service 22, web 5.

- [ ] **Step 3: Commit**

```bash
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/PersonCrudRepository.java
git commit -m "refactor(odata): drop the Person-specific pagination prototype"
```

---

### Task 3: The gate and the two-query read

**Files:**
- Modify: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/EntityGraphBaseCrudRepository.java`
- Test: `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/SortAsInTest.java`

**Interfaces:**
- Consumes: `CometaEntityGraph.hasPluralAttribute(Metamodel, Class<?>)` from Task 1; an empty `PersonCrudRepository` from Task 2.
- Produces: `EntityGraphBaseCrudRepository<MODEL extends WithId, ID>` — the type parameter is now bounded, and `List<MODEL> sortAsIn(List<MODEL>, List<Long>)` is package-private.

**Context you need:**

`ru.sberbank.cib.gmbus.entity.WithId` declares a single method `Long getId()`. `BaseEntity implements WithId`, and all seven models extend it (`AutomatedSystem`, `Flow`, `Link`, `Node`, `Person`, `Team`, `Topic` — the last via `Node`). The bound is compile-time only; it has been verified to build the full reactor. Do **not** add the bound to `ODataEntityGraphMiniRepository` or `BaseCrudRepository` — a class may narrow its own type parameter, and widening those interfaces is out of scope.

`BaseEntity` carries `@Getter` but **no** `@Setter`, so entity ids cannot be assigned from a test. That is why `SortAsInTest` below defines its own `Row`/`RowRepository` rather than building `Person` instances.

`ODataParams.getTop()` and `getSkip()` are never null on the paths that reach this method: the builder constructor coerces null to `0` and the controller declares `defaultValue = "0"`. Do **not** add null guards — the existing single-query body already calls `oDataParams.getSkip().equals(0)`, as does `BaseCrudRepository` upstream, so a null would fail one line later anyway and a guard here is false comfort.

`super.readAll(oDataParams)` resolves to `BaseCrudRepository.readAll(ODataParams)`, which applies the filter, the orderby and `setFirstResult`/`setMaxResults`, and applies **no** entity graph. That is exactly what makes `LIMIT`/`OFFSET` reach Postgres.

- [ ] **Step 1: Write the failing test**

Create `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/SortAsInTest.java`. This exact file has been compiled and run green — transcribe it as-is.

```java
package ru.sberbank.cib.gmbus.repository;

import org.junit.jupiter.api.Test;
import ru.sberbank.cib.gmbus.entity.WithId;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Контракт sortAsIn: порядок страницы задаёт ПЕРВЫЙ запрос. У второго запроса
 * («id in (:ids)») свой план выполнения, и без восстановления порядка страница
 * при отсутствии $orderby приходит перемешанной.
 *
 * Своя мини-сущность вместо Person: у BaseEntity есть @Getter, но нет @Setter,
 * поэтому id реальной сущности в тесте не выставить.
 */
class SortAsInTest {

    private record Row(Long id) implements WithId {
        @Override
        public Long getId() {
            return id;
        }
    }

    private static final class RowRepository extends EntityGraphBaseCrudRepository<Row, Long> {
    }

    private final RowRepository repository = new RowRepository();

    @Test
    void restoresTheOrderOfTheIdList() {
        List<Row> shuffled = List.of(new Row(3L), new Row(1L), new Row(2L));

        assertThat(repository.sortAsIn(shuffled, List.of(1L, 2L, 3L)))
                .extracting(Row::getId)
                .containsExactly(1L, 2L, 3L);
    }

    @Test
    void keepsAnEmptyListEmpty() {
        assertThat(repository.sortAsIn(List.of(), List.of(1L, 2L))).isEmpty();
    }

    @Test
    void putsRowsMissingFromTheIdListLast() {
        List<Row> rows = List.of(new Row(9L), new Row(2L), new Row(1L));

        assertThat(repository.sortAsIn(rows, List.of(1L, 2L)))
                .extracting(Row::getId)
                .containsExactly(1L, 2L, 9L);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
.\mvnw.cmd -pl cometa-persistence-module -am clean test "-Dtest=SortAsInTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: FAIL at compile — `cannot find symbol: method sortAsIn`, and `type argument Row is not within bounds` is also acceptable at this point.

- [ ] **Step 3: Tighten the type parameter**

In `EntityGraphBaseCrudRepository.java`, add the import and change the class declaration:

```java
import ru.sberbank.cib.gmbus.entity.WithId;
```

```java
public abstract class EntityGraphBaseCrudRepository<MODEL extends WithId, ID>
        extends BaseCrudRepository<MODEL, ID>
        implements ODataEntityGraphMiniRepository<MODEL, ID> {
```

- [ ] **Step 4: Rename the existing read body**

Rename the current `readAll(ODataParams, CometaEntityGraph)` to `readAllSingleQuery`, make it `private`, and drop its `@Override`. **Change nothing inside it** — the body stays byte-for-byte as it is today, including the `log.info` and the hint handling.

```java
    private List<MODEL> readAllSingleQuery(ODataParams oDataParams, CometaEntityGraph entityGraph) {
        // ...existing body, unchanged...
    }
```

- [ ] **Step 5: Add the gate**

Add the new `readAll` in the position the old one occupied, so the diff reads top-to-bottom:

```java
    /**
     * Коллекция в fetch-графе вместе с $top/$skip заставляет Hibernate
     * разбивать страницы в памяти (HHH90003004): в JVM материализуется весь
     * результат, а не страница. Тогда читаем в два запроса — сначала страница
     * корней с настоящими LIMIT/OFFSET, потом граф ровно по её id.
     *
     * Для -toOne связей этой проблемы нет, LIMIT/OFFSET доходят до СУБД, и
     * второй запрос был бы лишним round-trip'ом — поэтому и нужен gate.
     */
    @Override
    public List<MODEL> readAll(ODataParams oDataParams, CometaEntityGraph entityGraph) {
        if (isPaged(oDataParams) && fetchesCollection(entityGraph)) {
            return readAllPagedThenFetch(oDataParams, entityGraph);
        }
        return readAllSingleQuery(oDataParams, entityGraph);
    }

    private boolean isPaged(ODataParams oDataParams) {
        return oDataParams.getTop() > 0 || oDataParams.getSkip() > 0;
    }

    private boolean fetchesCollection(CometaEntityGraph entityGraph) {
        return entityGraph != null
                && !entityGraph.isEmpty()
                && entityGraph.hasPluralAttribute(entityManager.getMetamodel(), this.modelClass);
    }
```

- [ ] **Step 6: Implement the two-query read**

Add below the gate. Three things are load-bearing and each caused a live bug in the prototype — do not "tidy" them away:

1. **No `setMaxResults` on the second query.** It is what triggers `HHH90003004`, and `$top` defaults to `0`, which JPA reads as *limit zero* — `?$skip=20` with no `$top` returned an empty page under a count of 222.
2. **No `ORDER BY` on the second query.** `sortAsIn` is authoritative in every case, so the clause is redundant.
3. **The `ids.isEmpty()` early return**, which skips a pointless query when `$skip` runs past the end.

```java
    private List<MODEL> readAllPagedThenFetch(ODataParams oDataParams, CometaEntityGraph entityGraph) {
        List<Long> ids = super.readAll(oDataParams).stream()
                .map(WithId::getId)
                .toList();

        if (ids.isEmpty()) {
            return List.of();
        }

        String jpql = new StringBuilder(128)
                .append("SELECT ").append(this.modelSimpleName)
                .append(" FROM ").append(this.modelClass.getName())
                .append(' ').append(this.modelSimpleName)
                .append(" WHERE ").append(this.modelSimpleName).append(".id IN :ids")
                .toString();

        log.info(jpql);

        TypedQuery<MODEL> query = this.entityManager.createQuery(jpql, this.modelClass);

        // Без setMaxResults: "id IN :ids" не может вернуть больше строк, чем в
        // списке, а сам вызов вернул бы HHH90003004 — и при $top=0 обнулил бы
        // выдачу, потому что для JPA setMaxResults(0) это «ноль строк».
        entityGraph.buildEntityGraph()
                .buildQueryHint(super.entityManager, this.modelClass)
                .ifPresent(hint -> query.setHint("jakarta.persistence.fetchgraph", hint.entityGraph()));

        query.setParameter("ids", ids);

        return sortAsIn(query.getResultList(), ids);
    }

    /**
     * Восстанавливает порядок страницы, полученный первым запросом.
     *
     * ORDER BY во втором запросе не помогает: при отсутствии $orderby порядок
     * задаёт план СУБД, и он отличается от порядка первого запроса.
     *
     * Package-private, а не private: покрыт SortAsInTest.
     */
    List<MODEL> sortAsIn(List<MODEL> models, List<Long> ids) {
        Map<Long, Integer> position = new HashMap<>();
        for (int i = 0; i < ids.size(); i++) {
            position.put(ids.get(i), i);
        }
        return models.stream()
                .sorted(Comparator.comparingInt(model -> position.getOrDefault(model.getId(), Integer.MAX_VALUE)))
                .toList();
    }
```

Add the imports this needs:

```java
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
```

If `Comparator.comparingInt` fails to infer `MODEL`, write it explicitly as `Comparator.<MODEL>comparingInt(...)`.

- [ ] **Step 7: Run the test to verify it passes**

```powershell
.\mvnw.cmd -pl cometa-persistence-module -am clean test "-Dtest=SortAsInTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: `Tests run: 3, Failures: 0, Errors: 0`.

- [ ] **Step 8: Verify the whole reactor still compiles**

The bound change touches the base class of all seven repositories, so this step is the real test of it.

```powershell
.\mvnw.cmd clean test
```

Expected: `BUILD SUCCESS`; persistence 14, service 22, web 5.

- [ ] **Step 9: Commit**

```bash
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/EntityGraphBaseCrudRepository.java \
        cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/SortAsInTest.java
git commit -m "feat(odata): page roots then fetch the graph when it pulls a collection"
```

---

### Task 4: One read transaction, and live verification

**Files:**
- Modify: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/EntityGraphBaseCrudService.java`

**Interfaces:**
- Consumes: the two-query read from Task 3.
- Produces: nothing.

**Context you need:** `getAll` issues `count` and the page read as separate autocommit transactions today; the two-query path adds a third. A concurrent write between them can return fewer rows than `count` reports. This class already imports `org.springframework.transaction.annotation.Transactional` for its `create`/`update`/`patch` overrides — use that import, **not** `jakarta.transaction.Transactional`, which has no `readOnly`. Leave `getById` alone: it is a single query.

- [ ] **Step 1: Annotate `getAll`**

In `EntityGraphBaseCrudService.java`, add the javadoc and annotation above the existing `getAll`:

```java
    /**
     * Один read-транзакционный контекст на count и на чтение страницы.
     *
     * Без него count и выдача идут разными автокоммит-транзакциями, а при
     * коллекции в графе запросов становится три — параллельная запись между
     * ними вернёт строк меньше, чем обещает count.
     */
    @Override
    @Transactional(readOnly = true)
    public ResultObj<List<DTO>> getAll(Integer skip, Integer top, String filter, String orderby,
                                       String fields, String searchString) {
```

- [ ] **Step 2: Run the full suite**

```powershell
.\mvnw.cmd clean test
```

Expected: `BUILD SUCCESS`; persistence 14, service 22, web 5.

- [ ] **Step 3: Confirm MapStruct did not silently corrupt**

A documented trap in this repo: `*MapperImpl.class` can be written without `implements` while Maven reports BUILD SUCCESS.

```powershell
& "$env:JAVA_HOME\bin\javap.exe" -v -cp cometa-service-module/target/classes ru.sberbank.cib.gmbus.service.mapper.PersonMapperImpl | Select-String "interfaces:"
```

Expected: `interfaces: 1`. If it reports `interfaces: 0`, stop and report BLOCKED.

- [ ] **Step 4: Package and start the backend**

```powershell
.\mvnw.cmd -DskipTests clean package
$env:DB_PASSWORD=((Get-Content "F:\programming\cometa\.vscode\backend.env" | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=','').Trim()
$env:SPRING_PROFILES_ACTIVE="local"
Start-Process -FilePath "$env:JAVA_HOME\bin\java.exe" `
  -ArgumentList '-jar','F:\programming\cometa\cometa-web-module\target\cometa-web-module-0.0.1-SNAPSHOT.jar' `
  -RedirectStandardOutput backend.log -RedirectStandardError backend.err.log -WindowStyle Hidden
```

Wait for `Started CometaApplication` in `backend.log` (about 12 seconds). Then authenticate:

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"sigmaLogin":"16674475","password":"qweqweqwe"}'
```

Save the `token` value; every request below needs `-H "Authorization: Bearer <token>"`.

- [ ] **Step 5: Run the live verification matrix**

Each row is a `GET` against `http://localhost:8080` with the bearer token. Use `curl -G` with `--data-urlencode` for each query parameter — `$` and the space in `$orderby=id asc` otherwise break the request. Record the actual result for every row in your report; a row you did not run is a failed row.

| # | Request | Expected |
|---|---|---|
| 1 | `/api/v1/person/graph?$top=20&$skip=20&$fields=teams&$orderby=id asc` | `count` 222, 20 rows, ids 83–102 |
| 2 | p6spy line for request 1 in `backend.log` | contains `offset 20 rows fetch first 20 rows only` |
| 3 | `grep -c HHH90003004 backend.log` after the whole matrix | **0** |
| 4 | `/api/v1/person/graph?$skip=20&$fields=teams` (no `$top`) | 202 rows — must equal `/api/v1/person?$skip=20` |
| 5 | `/api/v1/person/graph?$top=10&$skip=50&$fields=teams` (no `$orderby`) | same id order as `/api/v1/person?$top=10&$skip=50` |
| 6 | `/api/v1/person/graph?$top=20&$skip=1000&$fields=teams&$orderby=id asc` | 0 rows, and **only two** SQL statements logged (count + page); no `IN :ids` query |
| 7 | `/api/v1/person/graph?$top=20&$skip=0&$fields=teams&$orderby=id asc&$filter=teams/any(x: x/id in (1425,1432))` | `count` 2, ids 30 and 31, `teams` populated on both |
| 8 | `/api/v1/team/graph?$top=5&$skip=10&$fields=leader&$orderby=id asc` | `count` 112, 5 rows, and **one** page query — unchanged from today |
| 9 | `/api/v1/person/graph/31?$fields=teams` vs person 31 from a list read | identical team membership |

- [ ] **Step 6: Stop the backend**

```powershell
Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
  Where-Object { $_.CommandLine -like '*cometa-web-module*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Leaving it running locks the jar and breaks the next `clean`.

- [ ] **Step 7: Commit**

```bash
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/EntityGraphBaseCrudService.java
git commit -m "fix(odata): read the list count and page in one transaction"
```

---

### Task 5: Close the issue log

**Files:**
- Modify: `F:\programming\react\cometa-frontend\issue\personTeamsInMemoryPagination.md`
- Modify: `F:\programming\react\cometa-frontend\issue\relationWriteStandardFollowUps.md`

**Interfaces:**
- Consumes: Task 4's verification results.
- Produces: nothing.

**Context you need:** these files are in the **frontend** repo, not the backend one — `cd F:\programming\react\cometa-frontend` first. `personTeamsInMemoryPagination.md` currently opens with `**Status:** open, deliberately deferred (updated 2026-08-26)` and describes the in-memory pagination as "active in production". Its "What to do when picking this up" section lists three options; this work implemented option 2. Option 1 was explicitly declined by the owner and **that record must survive** — do not delete it.

- [ ] **Step 1: Rewrite the status block**

Replace the `**Status:**` paragraph at the top with a resolved status naming the fixing commits from Tasks 1–4 and the spec at `docs/superpowers/specs/2026-08-27-entity-graph-collection-pagination-design.md`. State that `$fields=teams` remains unconditional — that decision is unchanged — and that the underlying collection fetch is now cheap, which is what option 2 promised.

- [ ] **Step 2: Mark option 2 as implemented**

In the options list, mark option 2 as done and note that option 3 (ORM-layer `@BatchSize`/subselect) was not needed. Leave option 1's declined-with-reasons text intact.

- [ ] **Step 3: Record the measured outcome**

Replace the four-row results table (which currently ends in a `FAIL` row for the warning) with Task 4's measured results, including the zero `HHH90003004` count and the SQL showing `offset … fetch first … rows only`.

- [ ] **Step 4: Update the cross-reference**

`issue/relationWriteStandardFollowUps.md` ends with a "Related, still live" section pointing at this issue as unresolved. Update that pointer to say it is now fixed, and name the spec.

- [ ] **Step 5: Commit (frontend repo)**

```bash
cd F:/programming/react/cometa-frontend
git add issue/personTeamsInMemoryPagination.md issue/relationWriteStandardFollowUps.md
git commit -m "docs(odata): close out the in-memory pagination issue"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: the metamodel predicate and its `catch` → Task 1; the `PersonCrudRepository` revert → Task 2; the gate, `MODEL extends WithId`, no-`setMaxResults`, no-`ORDER BY`, `ids.isEmpty()`, `sortAsIn` → Task 3; `@Transactional(readOnly = true)` → Task 4; the spec's testing matrix → Task 4 Step 5. The spec's "known limitation" about `@ODataMappings` needs no task — it documents something no code in this repo does.

**Type consistency.** `hasPluralAttribute(Metamodel, Class<?>)` is declared in Task 1 and called with that signature in Task 3. `sortAsIn(List<MODEL>, List<Long>)` is declared package-private in Task 3 Step 6 and called that way from Task 3 Step 1's test. `WithId.getId()` returns `Long`, matching `List<Long> ids` and `Map<Long, Integer>`.

**Verified before writing.** Task 1's test file, Task 3's test file, the `MODEL extends WithId` bound against the full reactor, and the Task 2-before-Task 3 ordering were each compiled and run during planning. Two plan defects were found and fixed that way: `BaseEntity` has no id setter (so the test uses its own `Row` type), and a private `sortAsIn` on `PersonCrudRepository` blocks a package-private one on the base class (so the prototype deletion moved ahead of the generalization).

**Test counts.** Persistence goes 4 → 11 after Task 1, stays 11 through Task 2, and reaches 14 after Task 3. Service stays 22 and web stays 5 throughout.
