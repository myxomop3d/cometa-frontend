# NodeAggregator Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `NodeAggregator` entity — a named, many-to-many grouping of `Node`s with its own single-table inheritance hierarchy — together with its `MicroserviceNameAggr` subtype, DDL, mapper, service and REST controller at `/api/v1/node-aggregator`.

**Architecture:** A deliberate copy of the existing `Node` hierarchy. `NodeAggregator` is a `SINGLE_TABLE` entity discriminated on `node_aggr_type`, owning the `@ManyToMany` to `Node`; `MicroserviceNameAggr` adds a jsonb `data` column. The DTO family mirrors `NodeDto` with a Jackson `@JsonTypeInfo` envelope, and the repository/service/controller are three empty subclasses of the `EntityGraph*` base classes. The only genuinely new mechanism is the MapStruct qualifier that keeps nested `nodes` writes routed through `em.getReference` instead of constructing new `Node` rows.

**Tech Stack:** Java 17, Spring Boot 4.0.6, Hibernate 7 / JPA, MapStruct (constructor injection), Lombok, Jackson 3 (`tools.jackson.databind`, but annotations still `com.fasterxml.jackson.annotation`), PostgreSQL 16, JUnit 5 + AssertJ + Mockito, Maven multi-module reactor.

**Spec:** `F:\programming\react\cometa-frontend\docs\superpowers\specs\2026-09-15-node-aggregator-entity-design.md`

## Global Constraints

- **The code lands in the backend repo `F:\programming\cometa`, on branch `feature/gm`.** The spec and this plan live in the frontend repo; nothing in this plan modifies the frontend.
- **`JAVA_HOME` must be set for every Maven and `javap` command:** `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`. The machine's default `java` is version 15 and will fail.
- **Always build from the root reactor.** Building one module alone (`mvnw -f cometa-service-module`) cannot resolve sibling `0.0.1-SNAPSHOT` artifacts. Use `-pl <module> -am`.
- **Running a single test class needs `-Dsurefire.failIfNoSpecifiedTests=false`** — otherwise the sibling modules pulled in by `-am` fail the build for not containing that class.
- **Stop any running `cometa-web-module-0.0.1-SNAPSHOT.jar` before a `clean` build** — it locks its own file and `maven-clean-plugin` fails with "the file is in use".
- **A green build does not mean correct MapStruct output.** This build intermittently emits `*MapperImpl.class` files without their `implements` clause, with `BUILD SUCCESS`. Task 7 Step 3 is the mandatory verification; never skip it.
- **A one-off `testCompile` failure in `cometa-service-module` naming a class that exists on disk is known noise.** Re-run once with no edits before investigating.
- **Physical column names are snake_case.** Spring Boot's `CamelCaseToUnderscoresNamingStrategy` rewrites explicit `@Column`/`@DiscriminatorColumn` names, so `@DiscriminatorColumn(name = "nodeAggrType")` is physically `node_aggr_type`. Entity annotations use the camelCase name; SQL uses snake_case.
- **The frontend never sends `null`** (no-null write standard). Text columns are `NOT NULL DEFAULT ''`.
- **Commit trailer.** Every commit in this plan ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
  ```
- **Existing tables are not re-owned.** The `OWNER TO "GMBUS"` convention applies to the two new tables only.

---

## File Structure

**`cometa-persistence-module`**

| File | Responsibility |
|---|---|
| `entity/enums/NodeAggrType.java` | The two discriminator values |
| `entity/nodeaggr/NodeAggregator.java` | Base entity: name, discriminator attribute, owning `@ManyToMany` to `Node` |
| `entity/nodeaggr/microservicebyname/MicroserviceNameAggr.java` | Subtype: the jsonb `data` column |
| `entity/nodeaggr/microservicebyname/MicroserviceNameAggrData.java` | The jsonb payload POJO — one boolean |
| `repository/NodeAggregatorCrudRepository.java` | Empty subclass of `EntityGraphBaseCrudRepository` |

**`cometa-service-module`**

| File | Responsibility |
|---|---|
| `service/dto/nodeaggr/NodeAggregatorDto.java` | Base DTO + Jackson polymorphism envelope |
| `service/dto/nodeaggr/microservicebyname/MicroserviceNameAggrDto.java` | Subtype DTO |
| `service/mapper/NodeRefMapper.java` | Resolves `{"id": N}` to a managed `Node` reference |
| `service/mapper/NodeAggregatorMapper.java` | Entity ↔ DTO, both subtypes, with the write-path qualifier |
| `service/NodeAggregatorService.java` | Empty subclass of `EntityGraphBaseCrudService` |

**`cometa-web-module`**

| File | Responsibility |
|---|---|
| `web/api/v1/NodeAggregatorRestController.java` | Empty subclass of `EntityGraphBaseCrudController`, route + Swagger tag |

**`db-scripts`**

| File | Responsibility |
|---|---|
| `ddl/016_create_node_aggr.sql` | Both tables, constraint, trigger, owner, grants, comments |

Tests are placed beside the code they cover, following the existing layout: `MicroserviceNameAggrDataJsonTest` in the persistence module next to `JsonMapperTest`; the DTO and mapper tests in the service module next to `PersonMapperWriteTest` and `BaseRefMapperTest`.

---

### Task 1: The jsonb payload and the enum

Smallest self-contained unit, and the one with a genuine correctness trap: Lombok's getter for `private boolean isNeedAT` is `isNeedAT()`, from which Jackson derives the property name **`needAT`**. Since this class is stored as jsonb, that name is the persisted key.

**Files:**
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/enums/NodeAggrType.java`
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/microservicebyname/MicroserviceNameAggrData.java`
- Test: `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/entity/nodeaggr/microservicebyname/MicroserviceNameAggrDataJsonTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces: `NodeAggrType` with constants `NODE_AGGR` and `MICROSERVICE_NAME_AGGR`; `MicroserviceNameAggrData` with `boolean isNeedAT()` / `void setNeedAT(boolean)` and the JSON key `isNeedAT`.

- [ ] **Step 1: Write the failing test**

Create `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/entity/nodeaggr/microservicebyname/MicroserviceNameAggrDataJsonTest.java`:

```java
package ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Имя ключа в jsonb — не деталь API, а часть формата хранения: поменять его
 * позже означает мигрировать строки.
 *
 * Lombok для поля {@code private boolean isNeedAT} генерирует геттер
 * {@code isNeedAT()}, из которого Jackson выводит имя свойства "needAT".
 * Поэтому поле помечено @JsonProperty("isNeedAT"), а этот тест это фиксирует.
 */
class MicroserviceNameAggrDataJsonTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Test
    void serializesWithTheIsNeedAtKey() {
        MicroserviceNameAggrData data = new MicroserviceNameAggrData();
        data.setNeedAT(true);

        String json = jsonMapper.writeValueAsString(data);

        assertThat(json).contains("\"isNeedAT\":true");
        // "isNeedAT" не содержит подстроку "needAT" вместе с открывающей
        // кавычкой, так что это ловит именно регрессию имени ключа.
        assertThat(json).doesNotContain("\"needAT\"");
    }

    @Test
    void deserializesFromTheIsNeedAtKey() {
        MicroserviceNameAggrData data =
                jsonMapper.readValue("{\"isNeedAT\":true}", MicroserviceNameAggrData.class);

        assertThat(data.isNeedAT()).isTrue();
    }

    @Test
    void defaultsToFalse() {
        MicroserviceNameAggrData data =
                jsonMapper.readValue("{}", MicroserviceNameAggrData.class);

        assertThat(data.isNeedAT()).isFalse();
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-persistence-module -am -Dtest=MicroserviceNameAggrDataJsonTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: compilation failure, `cannot find symbol: class MicroserviceNameAggrData`.

- [ ] **Step 3: Write the enum**

Create `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/enums/NodeAggrType.java`:

```java
package ru.sberbank.cib.gmbus.entity.enums;

public enum NodeAggrType {
    NODE_AGGR,
    MICROSERVICE_NAME_AGGR;
}
```

- [ ] **Step 4: Write the jsonb payload class**

Create `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/microservicebyname/MicroserviceNameAggrData.java`:

```java
package ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Данные агрегатора микросервисов по имени.
 *
 * @JsonProperty обязателен: без него Lombok-геттер isNeedAT() дал бы Jackson
 * имя свойства "needAT", и именно оно попало бы в jsonb-колонку.
 */
@Data
public class MicroserviceNameAggrData {

    @JsonProperty("isNeedAT")
    private boolean isNeedAT;
}
```

Note the import package: Jackson 3's databind moved to `tools.jackson.databind`, but the **annotations** stayed in `com.fasterxml.jackson.annotation` — the same import `MicroserviceData` already uses.

- [ ] **Step 5: Run the test and verify it passes**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-persistence-module -am -Dtest=MicroserviceNameAggrDataJsonTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: `Tests run: 3, Failures: 0, Errors: 0`.

If `setNeedAT` does not resolve, check Lombok's actual setter name in `target/classes` — for a field named `isNeedAT` Lombok emits `setNeedAT`. Adjust the test to the real name rather than renaming the field; the field name is fixed by the spec.

- [ ] **Step 6: Commit**

```bash
cd /f/programming/cometa
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/enums/NodeAggrType.java \
        cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/ \
        cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/entity/nodeaggr/
git commit -F - <<'EOF'
feat(nodeaggr): add NodeAggrType and the MicroserviceNameAggr jsonb payload

The isNeedAT key is pinned with @JsonProperty: Lombok's isNeedAT() getter
would otherwise have Jackson store the field as "needAT", and that name is
the persisted jsonb key, not just an API detail.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

### Task 2: The entity hierarchy and repository

**Files:**
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/NodeAggregator.java`
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/microservicebyname/MicroserviceNameAggr.java`
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/NodeAggregatorCrudRepository.java`

**Interfaces:**
- Consumes: `NodeAggrType`, `MicroserviceNameAggrData` (Task 1).
- Produces: `NodeAggregator` with `Long getId()`, `String getName()` / `setName(String)`, `NodeAggrType getNodeAggrType()` (no setter), `Set<Node> getNodes()` / `setNodes(Set<Node>)`; `MicroserviceNameAggr extends NodeAggregator` with `MicroserviceNameAggrData getData()` / `setData(...)`; `NodeAggregatorCrudRepository`.

This task has no unit test of its own — a JPA entity's behaviour is its mapping, which only a running persistence context exercises. It is covered by Task 6's mapper tests (field access, collection replacement) and Task 7's live API pass (the actual SQL). The step-4 compile is the gate.

- [ ] **Step 1: Write the base entity**

Create `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/NodeAggregator.java`:

```java
package ru.sberbank.cib.gmbus.entity.nodeaggr;

import jakarta.persistence.*;
import lombok.*;
import ru.sberbank.cib.gmbus.entity.BaseEntity;
import ru.sberbank.cib.gmbus.entity.enums.NodeAggrType;
import ru.sberbank.cib.gmbus.entity.node.Node;

import java.util.Set;

/**
 * Агрегатор нод (NodeAggregator).
 * Именованная группа узлов. Подтипы: MICROSERVICE_NAME_AGGR.
 *
 * Связь с Node — many-to-many, владеющая сторона здесь. Обратного поля
 * Node.aggregators нет намеренно: вопрос "в какие агрегаторы входит узел"
 * решается запросом $filter=nodes/any(n: n/id in (...)) к этому ресурсу.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "node_aggr", schema = "gmsb",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"name", "node_aggr_type"})
        })
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "nodeAggrType", discriminatorType = DiscriminatorType.STRING)
@DiscriminatorValue("NODE_AGGR")
public class NodeAggregator extends BaseEntity {

    /**
     * Тип агрегатора — read-only отображение колонки-дискриминатора
     * {@code node_aggr_type}.
     * <p>
     * Дискриминатор сам по себе не атрибут сущности, поэтому без этого
     * отображения HQL/OData не разрешает путь {@code NodeAggregator.nodeAggrType}
     * и {@code $filter=nodeAggrType eq 'MICROSERVICE_NAME_AGGR'} падает с
     * {@code UnknownPathException}. Значение по-прежнему проставляет Hibernate
     * из {@link DiscriminatorValue} подтипа.
     */
    @Setter(AccessLevel.NONE)
    @Enumerated(EnumType.STRING)
    @Column(name = "nodeAggrType", nullable = false, insertable = false, updatable = false)
    private NodeAggrType nodeAggrType;

    /**
     * Название агрегатора.
     */
    @Column(name = "name", nullable = false)
    private String name;

    /**
     * Узлы, входящие в агрегатор.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "node_aggr_node_link", schema = "gmsb",
            joinColumns = @JoinColumn(name = "node_aggr_id"),
            inverseJoinColumns = @JoinColumn(name = "node_id"))
    private Set<Node> nodes;


    // Конструкторы
    public NodeAggregator(String name) {
        this.name = name;
    }
}
```

- [ ] **Step 2: Write the subtype entity**

Create `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/microservicebyname/MicroserviceNameAggr.java`:

```java
package ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import ru.sberbank.cib.gmbus.entity.nodeaggr.NodeAggregator;

/**
 * Агрегатор микросервисов по имени.
 * Наследуется от NodeAggregator.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@DiscriminatorValue("MICROSERVICE_NAME_AGGR")
public class MicroserviceNameAggr extends NodeAggregator {

    /**
     * Дополнительные данные в формате JSONB.
     *
     * nullable = false — утверждение уровня подтипа. Физически колонка
     * ДОЛЖНА быть nullable: при SINGLE_TABLE строки базового типа NODE_AGGR
     * её не заполняют. Ровно так же устроен node.data.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data", columnDefinition = "jsonb", nullable = false)
    private MicroserviceNameAggrData data;


    // Конструкторы
    public MicroserviceNameAggr(String name) {
        super(name);
    }
}
```

- [ ] **Step 3: Write the repository**

Create `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/NodeAggregatorCrudRepository.java`:

```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.stereotype.Repository;
import ru.sberbank.cib.gmbus.entity.nodeaggr.NodeAggregator;

@Repository
public class NodeAggregatorCrudRepository extends EntityGraphBaseCrudRepository<NodeAggregator, Long> {
}
```

- [ ] **Step 4: Compile and re-run the existing persistence tests**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-persistence-module -am test
```

Expected: `BUILD SUCCESS`, with `MicroserviceNameAggrDataJsonTest`, `CometaEntityGraphMetamodelTest`, `SortAsInTest` and the two `JsonMapperTest`s all green. A failure in `CometaEntityGraphMetamodelTest` would mean the new entity broke metamodel assumptions — read its assertions before changing anything.

- [ ] **Step 5: Commit**

```bash
cd /f/programming/cometa
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/nodeaggr/ \
        cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/NodeAggregatorCrudRepository.java
git commit -F - <<'EOF'
feat(nodeaggr): add the NodeAggregator single-table hierarchy

Mirrors Node: SINGLE_TABLE, string discriminator, and the discriminator
mapped a second time as a read-only attribute so OData can filter on it.
The many-to-many to Node is owned here and Node is left untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

### Task 3: DDL migration 016

**Files:**
- Create: `db-scripts/ddl/016_create_node_aggr.sql`

**Interfaces:**
- Consumes: the entity mapping from Task 2 — table `gmsb.node_aggr`, columns `id, name, node_aggr_type, data, inserted_at, updated_at`; join table `gmsb.node_aggr_node_link` with `node_aggr_id, node_id`.
- Produces: the two tables in the local database, so Task 7's live pass has something to write to.

- [ ] **Step 1: Write the migration**

Create `db-scripts/ddl/016_create_node_aggr.sql`:

```sql
-- ============================================================
-- node_aggr: агрегатор нод. SINGLE_TABLE-иерархия, дискриминатор
-- node_aggr_type (NODE_AGGR, MICROSERVICE_NAME_AGGR).
--
-- data jsonb NULL — при single-table наследовании строки базового типа
-- её не заполняют, ровно как node.data. Аннотация nullable = false в
-- MicroserviceNameAggr остаётся утверждением уровня подтипа.
--
-- name text NOT NULL DEFAULT '' — стандарт "без null":
-- cometa-frontend/docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md
--
-- Владелец — GMBUS (роль, под которой подключается приложение).
-- Начиная с этой миграции так для всех новых таблиц; 001-015 не трогаем.
--
-- Дизайн: cometa-frontend/docs/superpowers/specs/2026-09-15-node-aggregator-entity-design.md
-- ============================================================

CREATE TABLE gmsb.node_aggr (
	id int8 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL, -- Счетчик
	name text NOT NULL DEFAULT '', -- Название агрегатора
	node_aggr_type text NOT NULL, -- Тип агрегатора (дискриминатор)
	data jsonb NULL, -- Данные подтипа
	inserted_at timestamp NOT NULL DEFAULT clock_timestamp(),
	updated_at timestamp NOT NULL DEFAULT clock_timestamp(),
	CONSTRAINT node_aggr_pk PRIMARY KEY (id),
	CONSTRAINT node_aggr_unique UNIQUE (name, node_aggr_type)
);
COMMENT ON TABLE gmsb.node_aggr IS 'Агрегатор нод (single-table иерархия)';

COMMENT ON COLUMN gmsb.node_aggr.id IS 'Счетчик';
COMMENT ON COLUMN gmsb.node_aggr.name IS 'Название агрегатора';
COMMENT ON COLUMN gmsb.node_aggr.node_aggr_type IS 'Тип агрегатора: NODE_AGGR, MICROSERVICE_NAME_AGGR';
COMMENT ON COLUMN gmsb.node_aggr.data IS 'Данные подтипа в формате JSONB';

CREATE TRIGGER set_timestamps BEFORE INSERT OR UPDATE ON gmsb.node_aggr
	FOR EACH ROW EXECUTE FUNCTION gmsb.populate_timestamp_columns();

ALTER TABLE gmsb.node_aggr OWNER TO "GMBUS";
GRANT ALL ON TABLE gmsb.node_aggr TO "GMBUS";
GRANT ALL ON TABLE gmsb.node_aggr TO as_admin;


CREATE TABLE gmsb.node_aggr_node_link (
	id int8 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL, -- Счетчик
	node_aggr_id int8 NOT NULL, -- Ссылка на агрегатор
	node_id int8 NOT NULL, -- Ссылка на ноду
	inserted_at timestamp NOT NULL DEFAULT clock_timestamp(),
	CONSTRAINT node_aggr_node_link_pk PRIMARY KEY (id),
	CONSTRAINT node_aggr_node_link_unique UNIQUE (node_aggr_id, node_id),
	CONSTRAINT node_aggr_node_link_aggr_fk FOREIGN KEY (node_aggr_id) REFERENCES gmsb.node_aggr(id),
	CONSTRAINT node_aggr_node_link_node_fk FOREIGN KEY (node_id) REFERENCES gmsb.node(id)
);
COMMENT ON TABLE gmsb.node_aggr_node_link IS 'Связь агрегатора с нодами (many-to-many)';

COMMENT ON COLUMN gmsb.node_aggr_node_link.id IS 'Счетчик';
COMMENT ON COLUMN gmsb.node_aggr_node_link.node_aggr_id IS 'Ссылка на агрегатор';
COMMENT ON COLUMN gmsb.node_aggr_node_link.node_id IS 'Ссылка на ноду';

ALTER TABLE gmsb.node_aggr_node_link OWNER TO "GMBUS";
GRANT ALL ON TABLE gmsb.node_aggr_node_link TO "GMBUS";
GRANT ALL ON TABLE gmsb.node_aggr_node_link TO as_admin;
```

No trigger on the link table — `person_team_link` has none either; link tables carry `inserted_at DEFAULT clock_timestamp()` and no `updated_at`.

- [ ] **Step 2: Apply it to the local database**

Use the `mcp__cometa-postgres__pg_execute_sql` tool with the file's contents (the MCP connects as `GMBUS`, which is also the intended owner, so `ALTER TABLE ... OWNER TO "GMBUS"` is a no-op rather than a privilege error).

If `GRANT ... TO as_admin` fails because the role is absent locally, drop those two lines from the *execution* but keep them in the committed file — the target environments have the role.

- [ ] **Step 3: Verify the schema landed as intended**

Run with `mcp__cometa-postgres__pg_execute_query`:

```sql
SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'gmsb'
  AND c.relname IN ('node_aggr', 'node_aggr_node_link')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;
```

Expected, and each one is load-bearing:
- `node_aggr.name` is `text`, `attnotnull = true` (no-null standard)
- `node_aggr.node_aggr_type` is `text`, `attnotnull = true` — **snake_case**, matching the naming strategy
- `node_aggr.data` is `jsonb`, `attnotnull = false` — single-table inheritance
- `node_aggr.inserted_at` / `updated_at` `attnotnull = true`
- `node_aggr_node_link` has `node_aggr_id`, `node_id`, both `int8 NOT NULL`

Then confirm the trigger and the owner:

```sql
SELECT c.relname, t.tgname, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_trigger t ON t.tgrelid = c.oid AND NOT t.tgisinternal
WHERE n.nspname = 'gmsb' AND c.relname IN ('node_aggr', 'node_aggr_node_link');
```

Expected: `node_aggr` has trigger `set_timestamps` and owner `GMBUS`; `node_aggr_node_link` has owner `GMBUS` and no trigger.

- [ ] **Step 4: Commit**

```bash
cd /f/programming/cometa
git add db-scripts/ddl/016_create_node_aggr.sql
git commit -F - <<'EOF'
feat(db): create node_aggr and node_aggr_node_link

New tables are owned by GMBUS, the role the application connects as,
rather than as_admin; 001-015 keep their existing ownership.

data is nullable in the database even though MicroserviceNameAggr declares
nullable = false, because base NODE_AGGR rows do not fill it. node.data is
nullable today for the same reason.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

### Task 4: The DTO family

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/NodeAggregatorDto.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/microservicebyname/MicroserviceNameAggrDto.java`
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/NodeAggregatorDtoJsonTest.java`

**Interfaces:**
- Consumes: `NodeAggrType`, `MicroserviceNameAggrData` (Task 1); the existing `ru.sberbank.cib.gmbus.service.dto.nodes.NodeDto`.
- Produces: `NodeAggregatorDto` with `String getName()` / `setName(String)`, `List<NodeDto> getNodes()` / `setNodes(List<NodeDto>)`, `NodeAggrType getNodeAggrType()` (no setter); `MicroserviceNameAggrDto extends NodeAggregatorDto` adding `MicroserviceNameAggrData getData()` / `setData(...)`. Both are used by every method in Tasks 5–7.

- [ ] **Step 1: Write the failing test**

Create `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/NodeAggregatorDtoJsonTest.java`:

```java
package ru.sberbank.cib.gmbus.service.dto.nodeaggr;

import org.junit.jupiter.api.Test;
import ru.sberbank.cib.gmbus.entity.enums.NodeAggrType;
import ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname.MicroserviceNameAggrData;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.microservicebyname.MicroserviceNameAggrDto;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Фиксирует конверт полиморфизма: подтип выбирается по полю nodeAggrType,
 * ровно как у NodeDto по nodeType. На это опирается контроллер — тело
 * запроса приходит как NodeAggregatorDto и должно десериализоваться в
 * нужный подтип.
 */
class NodeAggregatorDtoJsonTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Test
    void baseTypeSerializesItsDiscriminator() {
        NodeAggregatorDto dto = new NodeAggregatorDto();
        dto.setName("платежи");

        String json = jsonMapper.writeValueAsString(dto);

        assertThat(json).contains("\"nodeAggrType\":\"NODE_AGGR\"");
    }

    @Test
    void subtypeIsChosenByTheDiscriminator() {
        String json = """
                {"nodeAggrType":"MICROSERVICE_NAME_AGGR","name":"платежи","data":{"isNeedAT":true}}
                """;

        NodeAggregatorDto dto = jsonMapper.readValue(json, NodeAggregatorDto.class);

        assertThat(dto).isInstanceOf(MicroserviceNameAggrDto.class);
        assertThat(dto.getName()).isEqualTo("платежи");
        assertThat(dto.getNodeAggrType()).isEqualTo(NodeAggrType.MICROSERVICE_NAME_AGGR);
        assertThat(((MicroserviceNameAggrDto) dto).getData().isNeedAT()).isTrue();
    }

    @Test
    void baseTypeIsChosenWhenDiscriminatorIsNodeAggr() {
        String json = """
                {"nodeAggrType":"NODE_AGGR","name":"платежи"}
                """;

        NodeAggregatorDto dto = jsonMapper.readValue(json, NodeAggregatorDto.class);

        assertThat(dto).isExactlyInstanceOf(NodeAggregatorDto.class);
        assertThat(dto.getNodeAggrType()).isEqualTo(NodeAggrType.NODE_AGGR);
    }

    @Test
    void subtypeRoundTrips() {
        MicroserviceNameAggrDto dto = new MicroserviceNameAggrDto();
        dto.setName("платежи");
        MicroserviceNameAggrData data = new MicroserviceNameAggrData();
        data.setNeedAT(true);
        dto.setData(data);

        String json = jsonMapper.writeValueAsString(dto);
        NodeAggregatorDto back = jsonMapper.readValue(json, NodeAggregatorDto.class);

        assertThat(back).isInstanceOf(MicroserviceNameAggrDto.class);
        assertThat(((MicroserviceNameAggrDto) back).getData().isNeedAT()).isTrue();
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=NodeAggregatorDtoJsonTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: compilation failure, `cannot find symbol: class NodeAggregatorDto`.

- [ ] **Step 3: Write the base DTO**

Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/NodeAggregatorDto.java`:

```java
package ru.sberbank.cib.gmbus.service.dto.nodeaggr;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import ru.sberbank.cib.gmbus.entity.enums.NodeAggrType;
import ru.sberbank.cib.gmbus.service.dto.BaseEntityDto;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.microservicebyname.MicroserviceNameAggrDto;
import ru.sberbank.cib.gmbus.service.dto.nodes.NodeDto;

import java.util.List;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.PROPERTY,
        property = "nodeAggrType",
        visible = true
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = NodeAggregatorDto.class, name = "NODE_AGGR"),
        @JsonSubTypes.Type(value = MicroserviceNameAggrDto.class, name = "MICROSERVICE_NAME_AGGR")
})
public class NodeAggregatorDto extends BaseEntityDto {

    protected final NodeAggrType nodeAggrType = NodeAggrType.NODE_AGGR; // Тип агрегатора

    private String name; // Название агрегатора

    /**
     * Узлы, входящие в агрегатор.
     *
     * ЧТЕНИЕ: заполняется только при ?$fields=nodes на маршруте /graph.
     * Элемент приходит полным полиморфным NodeDto — вместе с automatedSystem
     * и data подтипа.
     *
     * ЗАПИСЬ: учитывается ТОЛЬКО id каждого элемента. Вложенные name,
     * automatedSystem и data игнорируются — поля самой ноды меняются лишь
     * через её собственный контроллер /node.
     * Семантика (следует из NullValuePropertyMappingStrategy.IGNORE):
     *   отсутствует или null — состав не меняется;
     *   []                   — состав очищается;
     *   непустой список      — состав заменяется целиком.
     *
     * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
     */
    private List<NodeDto> nodes;
}
```

- [ ] **Step 4: Write the subtype DTO**

Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/microservicebyname/MicroserviceNameAggrDto.java`:

```java
package ru.sberbank.cib.gmbus.service.dto.nodeaggr.microservicebyname;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import ru.sberbank.cib.gmbus.entity.enums.NodeAggrType;
import ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname.MicroserviceNameAggrData;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.NodeAggregatorDto;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class MicroserviceNameAggrDto extends NodeAggregatorDto {

    protected final NodeAggrType nodeAggrType = NodeAggrType.MICROSERVICE_NAME_AGGR;

    private MicroserviceNameAggrData data; // Данные агрегатора в формате JSONB.
}
```

The shadowed `final` field is exactly what `MicroserviceDto` and `TopicDto` do. Lombok emits no setter for a `final` field, so neither MapStruct nor Jackson writes it — Hibernate sets the entity side from `@DiscriminatorValue`, Jackson reads the DTO side from the getter.

- [ ] **Step 5: Run the test and verify it passes**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=NodeAggregatorDtoJsonTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: `Tests run: 4, Failures: 0, Errors: 0`.

If deserialization fails with an unrecognised-property error on `nodeAggrType`, the cause is `visible = true` combined with a read-only property. `NodeDto` has the identical shape and works in production, so match its behaviour rather than removing `visible = true` — check that `@Getter` is on the class and the field really is `final`.

- [ ] **Step 6: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/ \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/dto/nodeaggr/
git commit -F - <<'EOF'
feat(nodeaggr): add the NodeAggregator DTO family

Same Jackson polymorphism envelope as NodeDto, discriminated on
nodeAggrType. nodes is typed as the full polymorphic NodeDto so a nested
node stays identifiable; the javadoc records that writes still honour
only id.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

### Task 5: NodeRefMapper

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/NodeRefMapper.java`
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/NodeRefMapperTest.java`

**Interfaces:**
- Consumes: the existing `BaseRefMapper<E, R>` (its `protected EntityManager em` is package-visible to tests in the same package, which is how `BaseRefMapperTest` sets it) and `NodeDto`.
- Produces: `NodeRefMapper` — a Spring `@Component` with `Node toRef(NodeDto ref)`, tagged `@Named("nodeRef")` for MapStruct. Task 6 injects it.

- [ ] **Step 1: Write the failing test**

Create `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/NodeRefMapperTest.java`:

```java
package ru.sberbank.cib.gmbus.service.mapper;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.sberbank.cib.gmbus.entity.node.Node;
import ru.sberbank.cib.gmbus.service.dto.nodes.NodeDto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Контракт ссылки на Node: null не трогаем, ref без id — ошибка клиента,
 * ref с id — управляемая ссылка через EntityManager.getReference, и до
 * getReference доходит ТОЛЬКО id (остальные поля NodeDto игнорируются).
 */
@ExtendWith(MockitoExtension.class)
class NodeRefMapperTest {

    @Mock
    EntityManager em;

    private final NodeRefMapper mapper = new NodeRefMapper();

    @Test
    void toRefReturnsNullWhenRefIsNull() {
        assertThat(mapper.toRef(null)).isNull();
    }

    @Test
    void toRefThrowsWhenRefHasNoId() {
        NodeDto ref = new NodeDto();

        assertThatThrownBy(() -> mapper.toRef(ref))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Node")
                .hasMessageContaining("id");
    }

    @Test
    void toRefResolvesManagedReferenceWhenIdPresent() {
        mapper.em = em;
        NodeDto ref = new NodeDto();
        ref.setId(42L);
        ref.setName("это имя должно быть проигнорировано");
        Node managedRef = new Node();
        when(em.getReference(Node.class, 42L)).thenReturn(managedRef);

        assertThat(mapper.toRef(ref)).isSameAs(managedRef);
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=NodeRefMapperTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: compilation failure, `cannot find symbol: class NodeRefMapper`.

- [ ] **Step 3: Write the mapper**

Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/NodeRefMapper.java`:

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.mapstruct.Named;
import org.springframework.stereotype.Component;
import ru.sberbank.cib.gmbus.entity.node.Node;
import ru.sberbank.cib.gmbus.service.dto.nodes.NodeDto;

/**
 * Разрешает ссылку на Node для записи. Подключается через uses = NodeRefMapper.class.
 *
 * В отличие от Team и Person, тип ссылки здесь — тот же NodeDto, что и на
 * чтении. Поэтому направление NodeDto -> Node становится неоднозначным:
 * кандидатов два, NodeMapper.fromDto (строит НОВУЮ ноду) и этот toRef.
 * @Named("nodeRef") даёт NodeAggregatorMapper возможность выбрать нужный.
 */
@Component
public class NodeRefMapper extends BaseRefMapper<Node, NodeDto> {

    @Override
    protected Class<Node> entityType() {
        return Node.class;
    }

    @Override
    @Named("nodeRef")
    public Node toRef(NodeDto ref) {
        return super.toRef(ref);
    }
}
```

- [ ] **Step 4: Run the test and verify it passes**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=NodeRefMapperTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: `Tests run: 3, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/NodeRefMapper.java \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/NodeRefMapperTest.java
git commit -F - <<'EOF'
feat(nodeaggr): add NodeRefMapper

Resolves {"id": N} to a managed Node reference. toRef is overridden solely
to carry @Named("nodeRef"): because the ref type is NodeDto rather than a
flat DTO, NodeDto -> Node has two candidate methods and the qualifier is
what keeps NodeMapper.fromDto out of the write path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

### Task 6: NodeAggregatorMapper

The heart of the change. The test is the thing that proves an aggregator write links existing nodes instead of inserting new ones.

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/NodeAggregatorMapper.java`
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/NodeAggregatorMapperWriteTest.java`

**Interfaces:**
- Consumes: `NodeAggregator`, `MicroserviceNameAggr` (Task 2); `NodeAggregatorDto`, `MicroserviceNameAggrDto` (Task 4); `NodeRefMapper` (Task 5); the existing `NodeMapper`, `CometaCommonMapperConfig`, `@IgnoreIdField`.
- Produces: `NodeAggregatorMapper` with `NodeAggregatorDto toDto(NodeAggregator)`, `NodeAggregator fromDto(NodeAggregatorDto)`, `void update(NodeAggregatorDto, NodeAggregator)`, `Set<Node> toNodeRefs(List<NodeDto>)`. Task 7's service binds to it by type.

- [ ] **Step 1: Write the failing test**

Create `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/NodeAggregatorMapperWriteTest.java`:

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
import ru.sberbank.cib.gmbus.entity.node.Node;
import ru.sberbank.cib.gmbus.entity.nodeaggr.NodeAggregator;
import ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname.MicroserviceNameAggr;
import ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname.MicroserviceNameAggrData;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.NodeAggregatorDto;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.microservicebyname.MicroserviceNameAggrDto;
import ru.sberbank.cib.gmbus.service.dto.nodes.NodeDto;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Фиксирует семантику записи состава агрегатора:
 *   nodes отсутствует/null — не менять;
 *   nodes = []             — очистить;
 *   nodes = [ref, ref]     — заменить целиком;
 * и — главное — что каждый элемент проходит через NodeRefMapper.toRef,
 * а НЕ через NodeMapper.fromDto. Второй построил бы новые отсоединённые
 * ноды, и запись агрегатора вставляла бы дубликаты в gmsb.node.
 *
 * Проверяется СГЕНЕРИРОВАННЫЙ NodeAggregatorMapperImpl: именно в нём
 * MapStruct материализует и NullValuePropertyMappingStrategy.IGNORE,
 * и выбор метода по qualifiedByName.
 *
 * Стандарт: cometa-frontend/docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NodeAggregatorMapperWriteTest {

    @Mock NodeMapper nodeMapper;
    @Mock NodeRefMapper nodeRefMapper;

    NodeAggregatorMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new NodeAggregatorMapperImpl(nodeMapper, nodeRefMapper);
        when(nodeRefMapper.toRef(any())).thenAnswer(inv -> {
            NodeDto ref = inv.getArgument(0);
            if (ref == null) return null;
            if (ref.getId() == null) throw new IllegalArgumentException("Node reference has no id");
            Node n = new Node();
            ReflectionTestUtils.setField(n, "id", ref.getId());
            return n;
        });
    }

    private static NodeDto ref(long id) {
        NodeDto dto = new NodeDto();
        dto.setId(id);
        return dto;
    }

    private static NodeDto refWithName(long id, String name) {
        NodeDto dto = ref(id);
        dto.setName(name);
        return dto;
    }

    private static Set<Long> nodeIdsOf(NodeAggregator a) {
        Set<Long> ids = new HashSet<>();
        if (a.getNodes() != null) {
            for (Node n : a.getNodes()) ids.add(n.getId());
        }
        return ids;
    }

    private static NodeAggregator aggregatorWithNodes(Long... nodeIds) {
        NodeAggregator a = new NodeAggregator();
        Set<Node> nodes = new HashSet<>();
        for (Long id : nodeIds) {
            Node n = new Node();
            ReflectionTestUtils.setField(n, "id", id);
            nodes.add(n);
        }
        a.setNodes(nodes);
        return a;
    }

    @Test
    void createResolvesEachRefToAnEntity() {
        NodeAggregatorDto dto = new NodeAggregatorDto();
        dto.setName("платежи");
        dto.setNodes(List.of(ref(3L), ref(7L)));

        NodeAggregator entity = mapper.fromDto(dto);

        assertThat(nodeIdsOf(entity)).containsExactlyInAnyOrder(3L, 7L);
        assertThat(entity.getName()).isEqualTo("платежи");
    }

    @Test
    void createNeverBuildsNodesThroughNodeMapper() {
        NodeAggregatorDto dto = new NodeAggregatorDto();
        dto.setNodes(List.of(ref(3L)));

        mapper.fromDto(dto);

        verify(nodeMapper, never()).fromDto(any());
    }

    @Test
    void absentNodesLeavesCompositionUntouched() {
        NodeAggregator target = aggregatorWithNodes(3L, 7L);
        NodeAggregatorDto patch = new NodeAggregatorDto();
        patch.setName("переименован");

        mapper.update(patch, target);

        assertThat(nodeIdsOf(target)).containsExactlyInAnyOrder(3L, 7L);
        assertThat(target.getName()).isEqualTo("переименован");
    }

    @Test
    void emptyNodesClearsComposition() {
        NodeAggregator target = aggregatorWithNodes(3L, 7L);
        NodeAggregatorDto patch = new NodeAggregatorDto();
        patch.setNodes(List.of());

        mapper.update(patch, target);

        assertThat(nodeIdsOf(target)).isEmpty();
    }

    @Test
    void nonEmptyNodesReplacesCompositionWholesale() {
        NodeAggregator target = aggregatorWithNodes(3L, 7L);
        NodeAggregatorDto patch = new NodeAggregatorDto();
        patch.setNodes(List.of(ref(7L), ref(9L)));

        mapper.update(patch, target);

        assertThat(nodeIdsOf(target)).containsExactlyInAnyOrder(7L, 9L);
    }

    @Test
    void onlyTheIdOfARefIsHonoured() {
        // nodeRefMapper здесь замокан и стаб не читает ref.getName(), поэтому
        // сам по себе тест не доказывает правило id-only целиком — он проверяет,
        // что NodeAggregatorMapperImpl делегирует весь NodeDto в toRef, а не
        // копирует поля ноды сам (типичная MapStruct-регрессия). Правило
        // целиком доказывает NodeRefMapperTest.
        NodeAggregatorDto dto = new NodeAggregatorDto();
        dto.setNodes(List.of(refWithName(3L, "переименована")));

        NodeAggregator entity = mapper.fromDto(dto);

        assertThat(entity.getNodes()).hasSize(1);
        assertThat(entity.getNodes().iterator().next().getName()).isNull();
    }

    @Test
    void subtypeIsBuiltWithItsDataAndItsNodes() {
        MicroserviceNameAggrDto dto = new MicroserviceNameAggrDto();
        dto.setName("платежи");
        MicroserviceNameAggrData data = new MicroserviceNameAggrData();
        data.setNeedAT(true);
        dto.setData(data);
        dto.setNodes(List.of(ref(3L)));

        NodeAggregator entity = mapper.fromDto(dto);

        assertThat(entity).isInstanceOf(MicroserviceNameAggr.class);
        assertThat(((MicroserviceNameAggr) entity).getData().isNeedAT()).isTrue();
        assertThat(nodeIdsOf(entity)).containsExactly(3L);
    }

    @Test
    void updateDispatchesToTheSubtypeAndSetsItsData() {
        MicroserviceNameAggr target = new MicroserviceNameAggr();
        MicroserviceNameAggrDto patch = new MicroserviceNameAggrDto();
        MicroserviceNameAggrData data = new MicroserviceNameAggrData();
        data.setNeedAT(true);
        patch.setData(data);

        mapper.update(patch, target);

        assertThat(target.getData()).isNotNull();
        assertThat(target.getData().isNeedAT()).isTrue();
    }
}
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=NodeAggregatorMapperWriteTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: compilation failure, `cannot find symbol: class NodeAggregatorMapper`.

- [ ] **Step 3: Write the mapper**

Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/NodeAggregatorMapper.java`:

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.hibernate.Hibernate;
import org.mapstruct.*;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.node.Node;
import ru.sberbank.cib.gmbus.entity.nodeaggr.NodeAggregator;
import ru.sberbank.cib.gmbus.entity.nodeaggr.microservicebyname.MicroserviceNameAggr;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.NodeAggregatorDto;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.microservicebyname.MicroserviceNameAggrDto;
import ru.sberbank.cib.gmbus.service.dto.nodes.NodeDto;
import ru.sberbank.cib.gmbus.service.mapper.annotation.IgnoreIdField;

import java.util.List;
import java.util.Set;

@Mapper(
        config = CometaCommonMapperConfig.class,
        uses = {
                NodeMapper.class,
                NodeRefMapper.class
        }
)
public interface NodeAggregatorMapper extends BaseCrudMapper<NodeAggregator, NodeAggregatorDto> {

    /**
     * Не инициализировать ленивую коллекцию нод при маппинге в DTO —
     * без ?$fields=nodes вложенный nodes останется null вместо N+1 (а при
     * open-in-view=false — вместо LazyInitializationException).
     *
     * Условие применяется только к ЧТЕНИЮ: в направлении записи исходное
     * свойство имеет тип List<NodeDto>, который не подходит под параметр
     * Set<Node>.
     */
    @Condition
    default boolean isNodesLoaded(Set<Node> nodes) {
        return Hibernate.isInitialized(nodes);
    }

    /**
     * Путь ЗАПИСИ состава: каждый элемент — ссылка, а не новая нода.
     *
     * Отдельный метод, а не qualifiedByName прямо на элементах @Mapping:
     * квалификация элементов коллекции из bean-level @Mapping зависит от
     * версии MapStruct, а @IterableMapping — нет. @Named к тому же убирает
     * метод из автоматического подбора, так что случайно он не применится.
     */
    @Named("nodeRefList")
    @IterableMapping(qualifiedByName = "nodeRef")
    Set<Node> toNodeRefs(List<NodeDto> nodes);

    @Override
    @SubclassMapping(source = MicroserviceNameAggr.class, target = MicroserviceNameAggrDto.class)
    NodeAggregatorDto toDto(NodeAggregator source);

    @Override
    @SubclassMapping(source = MicroserviceNameAggrDto.class, target = MicroserviceNameAggr.class)
    @Mapping(target = "nodes", qualifiedByName = "nodeRefList")
    NodeAggregator fromDto(NodeAggregatorDto dto);

    @Override
    @IgnoreIdField
    @Mapping(target = "nodes", qualifiedByName = "nodeRefList")
    @BeanMapping(qualifiedByName = "update")
    void update(NodeAggregatorDto source, @MappingTarget NodeAggregator target);

    @Mapping(target = "nodes", qualifiedByName = "nodeRefList")
    void updateMicroserviceNameAggr(MicroserviceNameAggrDto source, @MappingTarget MicroserviceNameAggr target);

    @AfterMapping
    @Named("update")
    default void afterUpdate(NodeAggregatorDto source, @MappingTarget NodeAggregator target) {
        if (source instanceof MicroserviceNameAggrDto dto && target instanceof MicroserviceNameAggr entity) {
            updateMicroserviceNameAggr(dto, entity);
        }
    }
}
```

- [ ] **Step 4: Check the generated constructor signature and fix the test if needed**

MapStruct orders constructor parameters by its own resolution, not necessarily by the `uses` declaration. Open the generated impl:

```powershell
cd F:\programming\cometa
type cometa-service-module\target\generated-sources\annotations\ru\sberbank\cib\gmbus\service\mapper\NodeAggregatorMapperImpl.java
```

Find the `public NodeAggregatorMapperImpl(...)` line. If the parameters are `(NodeRefMapper, NodeMapper)` rather than `(NodeMapper, NodeRefMapper)`, swap the arguments in the test's `setUp()` to match. Do not change the mapper to suit the test.

While the file is open, confirm two things:
- `fromDto` and `update` call `toNodeRefs(...)` for the `nodes` property — **not** `nodeMapper.fromDto(...)` and not an inline `new Node()` loop.
- The generated `microserviceNameAggrDtoToMicroserviceNameAggr` method also routes `nodes` through `toNodeRefs`, i.e. the `@Mapping` propagated into the subclass mapping.

If MapStruct instead reports `Qualifier error. No method found annotated with @Named#value: [ nodeRef ]`, the cause is `NodeRefMapper.toRef` missing its `@Named` — recheck Task 5 Step 3.

- [ ] **Step 5: Run the test and verify it passes**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am -Dtest=NodeAggregatorMapperWriteTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Expected: `Tests run: 8, Failures: 0, Errors: 0`.

If `Tests run: 0` with a compile error naming a class that plainly exists on disk, that is the known `testCompile` flake — re-run once with no edits before investigating.

- [ ] **Step 6: Run the whole service module's tests**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -pl cometa-service-module -am test
```

Expected: `BUILD SUCCESS`. `PersonMapperWriteTest`, `AutomatedSystemMapperWriteTest`, `BaseRefMapperTest` and `ODataJpqlGenerationTest` must all still pass — a new `uses` edge can perturb MapStruct's method resolution elsewhere.

- [ ] **Step 7: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/NodeAggregatorMapper.java \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/mapper/NodeAggregatorMapperWriteTest.java
git commit -F - <<'EOF'
feat(nodeaggr): add NodeAggregatorMapper

Reads go through NodeMapper and its @SubclassMapping chain; writes go
through a qualified toNodeRefs, so each element of nodes becomes an
em.getReference proxy rather than a new detached Node. The test pins both
that and the absent/empty/non-empty collection semantics.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

### Task 7: Service, controller, and the live verification pass

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/NodeAggregatorService.java`
- Create: `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/NodeAggregatorRestController.java`

**Interfaces:**
- Consumes: `NodeAggregator` (Task 2), `NodeAggregatorDto` (Task 4), `NodeAggregatorMapper` (Task 6), `NodeAggregatorCrudRepository` (Task 2), and the existing `EntityGraphBaseCrudService` / `EntityGraphBaseCrudController`.
- Produces: the REST resource `/api/v1/node-aggregator`.

- [ ] **Step 1: Write the service**

Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/NodeAggregatorService.java`:

```java
package ru.sberbank.cib.gmbus.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.sberbank.cib.gmbus.entity.nodeaggr.NodeAggregator;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.NodeAggregatorDto;

@RequiredArgsConstructor
@Service
public class NodeAggregatorService extends EntityGraphBaseCrudService<NodeAggregator, NodeAggregatorDto, Long> {
}
```

- [ ] **Step 2: Write the controller**

Create `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/NodeAggregatorRestController.java`:

```java
package ru.sberbank.cib.gmbus.web.api.v1;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.sberbank.cib.gmbus.service.dto.nodeaggr.NodeAggregatorDto;

@AllArgsConstructor
@Tag(name = "NodeAggregator", description = "Агрегаторы нод")
@RestController
@RequestMapping("/api/${application.api.version}/node-aggregator")
public class NodeAggregatorRestController extends EntityGraphBaseCrudController<NodeAggregatorDto, Long> {
}
```

No class-level `@Transactional`, mirroring `PersonRestController` — which has the analogous lazy many-to-many and works. `NodeRestController` carries one, but a transactional controller is an anti-pattern not worth propagating. Step 6 exercises the read that would expose this; if it throws `LazyInitializationException`, add `@Transactional` and note it in the spec.

- [ ] **Step 3: Full build, then verify every generated mapper**

Stop any running backend jar first — it locks its own file and `clean` will fail.

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd -DskipTests clean install
```

Then, **mandatory** — a green build does not mean correct MapStruct output:

```bash
cd /f/programming/cometa
for f in cometa-service-module/target/classes/ru/sberbank/cib/gmbus/service/mapper/*MapperImpl.class; do
  n=$(basename "$f" .class)
  printf "%-36s %s\n" "$n" "$("$JAVA_HOME/bin/javap" -v \
    -cp cometa-service-module/target/classes \
    "ru.sberbank.cib.gmbus.service.mapper.$n" | grep -m1 'interfaces:')"
done
```

Expected: every row prints `interfaces: 1`, **except `TopicDataMapperImpl`, which is legitimately `interfaces: 0`** (its source is a class, not an interface, so the impl `extends`). `NodeAggregatorMapperImpl` must be `interfaces: 1`.

Any other `interfaces: 0` means the intermittent corruption is back: re-run the build with no edits and re-check. Check every row — spot-checking one mapper is what let a previous recurrence through.

- [ ] **Step 4: Start the backend**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:DB_PASSWORD = (Select-String -Path "F:\programming\cometa\.vscode\backend.env" -Pattern '^DB_PASSWORD=(.*)$').Matches.Groups[1].Value
$env:SPRING_PROFILES_ACTIVE = "local"
& "$env:JAVA_HOME\bin\java.exe" -jar "F:\programming\cometa\cometa-web-module\target\cometa-web-module-0.0.1-SNAPSHOT.jar"
```

Expected: `Started CometaApplication` in roughly 14 seconds, on port 8080. The `local` profile is required — the default datasource points at an unreachable Sberbank cluster and Hibernate dies with "Unable to determine Dialect without JDBC metadata".

A startup failure reading `required a bean of type '...NodeAggregatorMapper'` means Step 3's verification was skipped or passed wrongly.

- [ ] **Step 5: Authenticate and record the token**

Log in as the standing local test account (`sigmaLogin` `16674475`, password `qweqweqwe`) against `POST /api/v1/auth/login`, and keep the JWT for the calls below. Endpoints other than `/api/v1/auth/**` are secured; an unauthenticated call returns 403, which is the security filter, not a failure of this feature.

- [ ] **Step 6: Run the live API pass**

Each call, with the expected result:

1. `POST /api/v1/node-aggregator` with `{"nodeAggrType":"NODE_AGGR","name":"тест-агрегатор"}` → 200, response carries a generated `id`, `insertedAt`, `updatedAt` (the trigger) and `nodeAggrType: "NODE_AGGR"`.
2. `POST /api/v1/node-aggregator` with `{"nodeAggrType":"MICROSERVICE_NAME_AGGR","name":"тест-мс","data":{"isNeedAT":true}}` → 200. Then confirm the stored key with `mcp__cometa-postgres__pg_execute_query`:
   ```sql
   SELECT id, name, node_aggr_type, data FROM gmsb.node_aggr ORDER BY id DESC LIMIT 2;
   ```
   The `data` column must read `{"isNeedAT": true}` — **not** `{"needAT": true}`.
3. Pick two real node ids (`SELECT id, name FROM gmsb.node LIMIT 2;`), then `PATCH /api/v1/node-aggregator/{id}` with `{"nodeAggrType":"NODE_AGGR","nodes":[{"id":<a>},{"id":<b>}]}` → 200. Verify:
   ```sql
   SELECT node_aggr_id, node_id FROM gmsb.node_aggr_node_link ORDER BY id;
   SELECT count(*) FROM gmsb.node;
   ```
   Two link rows must appear, and the `node` count must be **unchanged** — this is the assertion that the qualifier works end to end.
4. `GET /api/v1/node-aggregator/graph/{id}?$fields=nodes` → 200, `nodes` populated with full `NodeDto` objects including `automatedSystem`. **This is the call that would expose a missing controller `@Transactional`**; a `LazyInitializationException` here means adding it.
5. `GET /api/v1/node-aggregator/graph/{id}` with no `$fields` → 200, `nodes` is `null` (the `@Condition` guard), and the server log shows no per-node `SELECT`.
6. `GET /api/v1/node-aggregator/graph?$fields=nodes&$top=5` → 200, and the log shows the two-query paged-then-fetch path (`... WHERE NodeAggregator.id IN :ids`).
7. `PATCH /api/v1/node-aggregator/{id}` with `{"nodeAggrType":"NODE_AGGR","nodes":[]}` → 200, and `node_aggr_node_link` is empty for that aggregator.
8. `PATCH /api/v1/node-aggregator/{id}` with `{"nodeAggrType":"NODE_AGGR","name":"новое имя"}` → 200; membership from a prior step is unchanged (re-link first if step 7 cleared it).
9. `GET /api/v1/node-aggregator?$filter=nodeAggrType eq 'MICROSERVICE_NAME_AGGR'` → 200, returns only the subtype row. A `UnknownPathException` here means the read-only discriminator attribute in Task 2 is wrong.
10. `GET /api/v1/node-aggregator?$filter=nodes/any(n: n/id in (<a>))` → 200, returns the aggregator holding that node. Keep it as the **only** clause: odata-mini 2.2.0 corrupts the root alias for anything following an `any()`.
11. `POST /api/v1/node-aggregator` repeating step 1's exact body → a constraint violation, proving `node_aggr_unique`.
12. Clean up the test rows:
    ```sql
    DELETE FROM gmsb.node_aggr_node_link WHERE node_aggr_id IN (SELECT id FROM gmsb.node_aggr);
    DELETE FROM gmsb.node_aggr;
    ```

- [ ] **Step 7: Run the full reactor test suite**

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd F:\programming\cometa
.\mvnw.cmd test
```

Expected: `BUILD SUCCESS` across all three modules.

- [ ] **Step 8: Commit**

```bash
cd /f/programming/cometa
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/NodeAggregatorService.java \
        cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/NodeAggregatorRestController.java
git commit -F - <<'EOF'
feat(nodeaggr): expose /api/v1/node-aggregator

Two empty subclasses: the service inherits the single read-map-merge
transaction that collection writes need under open-in-view=false, and the
controller inherits the CREATE/UPDATE/DELETE authority checks. No
SecurityConfig change — anyRequest().authenticated() already covers it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AdZu47cXqhsiNtbnWLSJNr
EOF
```

---

## Deferred to a follow-up

Named in the spec's section 10, and deliberately not in any task above:

- Any frontend work — no route, no `features/node-aggregator/`, no sidebar entry.
- An inverse `Node.aggregators` relation.
- A dedicated service or controller for `MicroserviceNameAggr`.
- Re-owning tables `001`–`015` to `GMBUS`.
