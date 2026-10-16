# Microservices page (Микросервисы) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-node **Микросервисы** page at `/microservice`. It filters `MICROSERVICE` nodes by name, environment, deployment artifactId and linked topic name, and shows deployments, topics with a direction icon, and flow links. A new native-SQL read endpoint, `GET /api/v1/microservice-overview`, backs it.

**Architecture:**
- **Backend** (`F:\programming\cometa`): four native statements through `EntityManager`.
  - Statement 1 reads a page of node rows, using a WHERE clause assembled from only the filters present.
  - Statement 2 counts with the same WHERE clause.
  - Statements 3 and 4 fetch deployments, topics and flows for that page's ids.
  - A service groups and orders the detail rows into a flat DTO, and a plain controller validates the params.
- **Frontend** (`F:\programming\react\cometa-frontend`): the URL search is the single source of truth. A route loader prefetches, `useSuspenseQuery` reads, and `useDataTable` with the simple toolbar renders. A small fetcher replaces `createCrudApi`, because the endpoint takes plain params, not OData.

**Tech Stack:**
- Backend: Java 17, Spring Boot 4, Hibernate 7 native queries, JUnit 5, Mockito, AssertJ.
- Frontend: React 19, TanStack Router/Query/Table, shadcn/ui, lucide-react 0.577, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md` (frontend repo). Read it before starting.

## Global Constraints

- Two repos, both on branch `feature/gm`:
  - backend `F:\programming\cometa` (Tasks 1–4);
  - frontend `F:\programming\react\cometa-frontend` (Tasks 5–7).

  Commit in the repo you changed. Never stage the frontend's pre-existing unrelated changes (`package.json`, `scripts/`, `CLAUDE.md`).
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s
  ```
- **Backend Java and Maven:**
  - Use JDK 17: `export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"` in Git Bash.
  - Always build from the root reactor (`./mvnw -pl <module> -am ...`). To run one test class, also pass `-Dsurefire.failIfNoSpecifiedTests=false`.
  - Stop a running `cometa-web-module` jar before any `clean`.
- **Backend Lombok:** the root `lombok.config` sets `accessors.fluent=true` and `fieldDefaults.defaultFinal=true`. All new value types are Java `record`s, so this doesn't touch them. Services use `@RequiredArgsConstructor` with `private final` fields. Repositories inject `EntityManager` via `@NonFinal @PersistenceContext`, as `MicroserviceNameAggrReconcileRepository` does.
- **Backend comments are in Russian**, matching the surrounding code.
- **Native SQL:** use no `::` casts, because Hibernate reads `:x` as a parameter; use `CAST(... AS ...)` if a cast is ever needed. User text is only ever bound as a parameter, never concatenated into SQL.
- **LIKE escaping:** `\`, `%` and `_` in user text are escaped with a backslash. PostgreSQL's default LIKE/ILIKE escape character *is* backslash, so no `ESCAPE` clause is written. This is a deliberate simplification of the spec's `ESCAPE '\'`, with identical behavior.
- **No-null standard:** the DTO never carries `null` strings; a missing value is `""`. Frontend cells render empty values with `dash()` from `@/lib/format`.
- **Environments:**
  - Backend accepts exactly `IFT`, `UAT`, `PROD`, `DEV`.
  - The frontend `ENVIRONMENTS` constant is the same four values. It must stay a subset of the flow-graph route's `env` enum, which is the same set.
- **Topic direction:**
  - Backend: `COUNTERDIRECTIONAL → CONSUME`, `CODIRECTIONAL → PRODUCE`.
  - UI, drawn from the topic's point of view:
    - `CONSUME` gets `SquareArrowRightExit` in `text-green-600`, titled "consumes".
    - `PRODUCE` gets `SquareArrowRightEnter` in `text-red-600`, titled "produces".
- **Names:**
  - Page title and sidebar label: `Микросервисы`. Subtitle: `Всего: {count}`.
  - Route: `/microservice`. Sidebar icon: lucide `Waypoints`.
  - Backend endpoint: `/api/v1/microservice-overview`.
- **Frontend type-check:** `npx tsc -b`. Bare `tsc --noEmit` checks nothing in this repo.
- Never edit `src/routeTree.gen.ts` by hand. The Vite router plugin regenerates it when `npm run dev` or `npm run build` runs.

## Review Focus

1. **Several filters at once.** `env` + `artifactId` + `topic` must return the intersection, not a SQL error. A missing `AND` or a mis-bound parameter only shows when the filters combine. Pinned by `allFiltersCombineWithAnd` (Task 1) and live step 5 (Task 8).
2. **Filter text containing SQL or LIKE metacharacters**, e.g. `kafka_payload`, `100%`, `x' OR 1=1 --`. These must match literally and never reach the SQL string. Pinned by `userTextNeverReachesTheSql` and `likeWildcardsAreEscaped` (Task 1).
3. **A microservice that consumes and produces the same topic.** It must show two lines, one with each icon, not one. Pinned by `topicsAreDistinctByIdAndDirectionConsumeFirst` (Task 3).
4. **A hand-edited or bookmarked URL** such as `?sort=guid.asc`, `?env=QA` or `?env="IFT"` (a single string, not an array). The page must still load on safe defaults and never 400. Pinned by the `validateMicroserviceSearch` tests (Task 5).
5. **The last page shrinking under a filter**, e.g. being on page 5 when a new topic filter leaves 3 rows. The page must show an empty table, not an error. `useDataTable` resets `page` to 1 on every filter change, and the backend returns `data: []` with the real `count` for an out-of-range `$skip`. Pinned by `emptyPageSkipsDetailQueries` (Task 3).

---

## File Structure

**Backend** (`F:\programming\cometa`)

| File | Responsibility |
|---|---|
| Create `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewFilter.java` | Validated filter, sort and page values (record plus `SortField` enum) |
| Create `.../repository/microserviceoverview/MicroserviceOverviewQuery.java` | Pure SQL builder: WHERE from present filters, bound params, whitelisted ORDER BY |
| Create `.../repository/microserviceoverview/MicroserviceOverviewRows.java` | Row records returned by the repository |
| Create `.../repository/microserviceoverview/MicroserviceOverviewRepository.java` | Runs the four native statements |
| Create `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewQueryTest.java` | Builder tests |
| Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/microserviceoverview/MicroserviceOverviewDto.java` | Response DTO |
| Create `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/microserviceoverview/MicroserviceOverviewService.java` | Grouping, distinctness, ordering, `ResultObj` assembly |
| Create `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/microserviceoverview/MicroserviceOverviewServiceTest.java` | Service tests |
| Create `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewParams.java` | Request-param parsing and validation |
| Create `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewController.java` | `GET /api/v1/microservice-overview` |
| Create `cometa-web-module/src/test/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewParamsTest.java` | Parser tests |
| Create `cometa-web-module/src/test/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewControllerTest.java` | 400 vs 200 behavior |

The spec put the filter record in the service module. It lives in persistence here because `MicroserviceOverviewQuery` (persistence) consumes it, and persistence cannot depend on service.

**Frontend** (`F:\programming\react\cometa-frontend`)

| File | Responsibility |
|---|---|
| Create `src/features/microservice/types.ts` | DTO mirrors, `ENVIRONMENTS`, `isEnvironment` |
| Create `src/features/microservice/search.ts` (+ `search.test.ts`) | URL search type and validation |
| Create `src/features/microservice/api.ts` (+ `api.test.ts`) | Param builder and `queryOptions` |
| Create `src/features/microservice/columns.tsx` | Column definitions and cell renderers |
| Create `src/routes/microservice/index.tsx` | Route: search, loader, page |
| Modify `src/components/app-sidebar.tsx` | Sidebar entry |

The spec listed a `deriveColumnFilters` helper. It isn't needed: `useDataTable` already derives column filters from the search through each column's `meta.filterKey`, and the fetcher reads the search directly. Microservices & AT needed it only because `createCrudApi` takes column filters.

---

### Task 1: Backend: filter record and SQL builder

**Repo:** `F:\programming\cometa`

**Files:**
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewFilter.java`
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewQuery.java`
- Test: `cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewQueryTest.java`

**Interfaces:**
- Produces:
  - `record MicroserviceOverviewFilter(String name, List<String> envs, String artifactId, String topic, int top, int skip, SortField sortField, boolean descending)`
  - `enum MicroserviceOverviewFilter.SortField { NAME, ENVIRONMENT; String column() }`
  - `final class MicroserviceOverviewQuery`:
    - `static MicroserviceOverviewQuery of(MicroserviceOverviewFilter)`
    - `String pageSql()`: selects `n.id, n.name, n.environment`, ends `LIMIT :top OFFSET :skip`
    - `String countSql()`
    - `Map<String,Object> params()`: filter params only
    - `Map<String,Object> pageParams()`: filter params plus `top` and `skip`
    - package-private `static String escapeLike(String)` and `static String contains(String)`

- [ ] **Step 1: Write the failing test**

```java
package ru.sberbank.cib.gmbus.repository.microserviceoverview;

import org.junit.jupiter.api.Test;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter.SortField;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;

/**
 * Построитель SQL страницы «Микросервисы». Сам SQL здесь не выполняется —
 * его проверяет живой прогон (см. план, Task 2 и Task 8).
 */
class MicroserviceOverviewQueryTest {

    private static final String COUNT_WITHOUT_FILTERS =
            "SELECT count(*) FROM gmsb.node n WHERE n.node_type = 'MICROSERVICE'";

    private static MicroserviceOverviewFilter filter(String name, List<String> envs,
                                                     String artifactId, String topic) {
        return new MicroserviceOverviewFilter(name, envs, artifactId, topic, 20, 40, SortField.NAME, false);
    }

    @Test
    void withoutFiltersOnlyTheTypeClauseRemains() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter(null, null, null, null));

        assertThat(q.countSql()).isEqualTo(COUNT_WITHOUT_FILTERS);
        assertThat(q.params()).isEmpty();
        assertThat(q.pageParams()).containsExactly(entry("top", 20), entry("skip", 40));
    }

    @Test
    void blankFiltersCountAsAbsent() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter("  ", List.of(), "", " "));

        assertThat(q.countSql()).isEqualTo(COUNT_WITHOUT_FILTERS);
        assertThat(q.params()).isEmpty();
    }

    @Test
    void nameFilterIsATrimmedSubstring() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter(" calypso ", null, null, null));

        assertThat(q.countSql()).contains("n.name ILIKE :name");
        assertThat(q.params()).containsExactly(entry("name", "%calypso%"));
    }

    @Test
    void envFilterBindsEveryValue() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter(null, List.of("IFT", "PROD"), null, null));

        assertThat(q.countSql()).contains("n.environment IN (:envs)");
        assertThat(q.params()).containsExactly(entry("envs", List.of("IFT", "PROD")));
    }

    @Test
    void artifactFilterSearchesTheLinkData() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter(null, null, "kafka-payload", null));

        assertThat(q.countSql())
                .contains("gmsb.node_tech_component_link ntl")
                .contains("ntl.node_id = n.id")
                .contains("ntl.data->>'artifactId' ILIKE :artifactId");
        assertThat(q.params()).containsExactly(entry("artifactId", "%kafka-payload%"));
    }

    @Test
    void topicFilterFollowsTheCrossGuidPair() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter(null, null, null, "CALYPSO.PAYMENTS"));

        assertThat(q.countSql())
                .contains("l.client_node_id = n.id")
                .contains("l2.cross_guid = l.cross_guid AND l2.id <> l.id")
                .contains("t.node_type = 'TOPIC'")
                .contains("t.name ILIKE :topic");
        assertThat(q.params()).containsExactly(entry("topic", "%CALYPSO.PAYMENTS%"));
    }

    @Test
    void allFiltersCombineWithAnd() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(
                filter("zeus", List.of("IFT"), "kafka", "CALYPSO"));

        String where = q.countSql().substring(q.countSql().indexOf("WHERE "));
        // Фильтры идут после типа узла в фиксированном порядке, через AND.
        assertThat(where).startsWith("WHERE n.node_type = 'MICROSERVICE' AND n.name ILIKE :name AND n.environment IN (:envs) AND EXISTS");
        assertThat(where).contains("AND EXISTS (SELECT 1 FROM gmsb.link l");
        assertThat(q.params()).containsOnlyKeys("name", "envs", "artifactId", "topic");
        assertThat(q.pageParams()).containsOnlyKeys("name", "envs", "artifactId", "topic", "top", "skip");
    }

    @Test
    void userTextNeverReachesTheSql() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(
                filter("x' OR 1=1 --", List.of("IFT"), "zz_marker", "yy%marker"));

        assertThat(q.pageSql()).doesNotContain("OR 1=1").doesNotContain("marker");
        assertThat(q.countSql()).doesNotContain("OR 1=1").doesNotContain("marker");
    }

    @Test
    void likeWildcardsAreEscaped() {
        assertThat(MicroserviceOverviewQuery.contains("a_b%c\\")).isEqualTo("%a\\_b\\%c\\\\%");
        assertThat(MicroserviceOverviewQuery.escapeLike("plain-text.1")).isEqualTo("plain-text.1");
    }

    @Test
    void sortsByNameAscendingWithAnIdTieBreaker() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(filter(null, null, null, null));

        assertThat(q.pageSql()).isEqualTo(
                "SELECT n.id, n.name, n.environment FROM gmsb.node n"
                        + " WHERE n.node_type = 'MICROSERVICE'"
                        + " ORDER BY n.name ASC, n.id LIMIT :top OFFSET :skip");
    }

    @Test
    void sortsByEnvironmentDescending() {
        MicroserviceOverviewQuery q = MicroserviceOverviewQuery.of(new MicroserviceOverviewFilter(
                null, null, null, null, 20, 0, SortField.ENVIRONMENT, true));

        assertThat(q.pageSql()).contains("ORDER BY n.environment DESC, n.id LIMIT :top OFFSET :skip");
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /f/programming/cometa
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
./mvnw -q -pl cometa-persistence-module -am -Dtest=MicroserviceOverviewQueryTest -Dsurefire.failIfNoSpecifiedTests=false test
```
Expected: compilation FAILURE, `cannot find symbol: class MicroserviceOverviewFilter`.

- [ ] **Step 3: Write `MicroserviceOverviewFilter.java`**

```java
package ru.sberbank.cib.gmbus.repository.microserviceoverview;

import java.util.List;

/**
 * Фильтр, сортировка и страница списка микросервисов (страница «Микросервисы»,
 * GET /api/v1/microservice-overview).
 *
 * null или пустая/пробельная строка означает «фильтра нет»; null или пустой
 * envs — тоже. Допустимость значений (env, $orderby, $top/$skip) проверяет
 * контроллер; здесь значения считаются уже проверенными.
 */
public record MicroserviceOverviewFilter(
        String name,
        List<String> envs,
        String artifactId,
        String topic,
        int top,
        int skip,
        SortField sortField,
        boolean descending) {

    /** Белый список полей сортировки и соответствующих им колонок SQL. */
    public enum SortField {
        NAME("n.name"),
        ENVIRONMENT("n.environment");

        private final String column;

        SortField(String column) {
            this.column = column;
        }

        public String column() {
            return this.column;
        }
    }
}
```

- [ ] **Step 4: Write `MicroserviceOverviewQuery.java`**

```java
package ru.sberbank.cib.gmbus.repository.microserviceoverview;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Нативный SQL страницы «Микросервисы»: WHERE собирается только из заданных
 * фильтров, ORDER BY — только из белого списка {@link MicroserviceOverviewFilter.SortField}.
 *
 * Пользовательский текст попадает исключительно в параметры, никогда в строку
 * SQL. В ILIKE-шаблонах экранируются \, % и _ обратным слэшем — это символ
 * экранирования LIKE в PostgreSQL по умолчанию, поэтому ESCAPE не пишется.
 *
 * Топик ищется по канонической паре связей с общим cross_guid:
 * MICROSERVICE → EGRESS и EGRESS → TOPIC. Связи без пары не учитываются —
 * см. cometa-frontend/issue/wrongLinksInDb.md.
 */
public final class MicroserviceOverviewQuery {

    private static final String FROM = " FROM gmsb.node n WHERE ";

    private static final String TYPE_CLAUSE = "n.node_type = 'MICROSERVICE'";

    private static final String NAME_CLAUSE = "n.name ILIKE :name";

    private static final String ENV_CLAUSE = "n.environment IN (:envs)";

    private static final String ARTIFACT_CLAUSE = "EXISTS (SELECT 1 FROM gmsb.node_tech_component_link ntl"
            + " WHERE ntl.node_id = n.id"
            + " AND ntl.data->>'artifactId' ILIKE :artifactId)";

    private static final String TOPIC_CLAUSE = "EXISTS (SELECT 1 FROM gmsb.link l"
            + " JOIN gmsb.link l2 ON l2.cross_guid = l.cross_guid AND l2.id <> l.id"
            + " JOIN gmsb.node t ON t.id = l2.server_node_id AND t.node_type = 'TOPIC'"
            + " WHERE l.client_node_id = n.id"
            + " AND t.name ILIKE :topic)";

    private final String where;
    private final String orderBy;
    private final Map<String, Object> params;
    private final int top;
    private final int skip;

    private MicroserviceOverviewQuery(String where, String orderBy, Map<String, Object> params, int top, int skip) {
        this.where = where;
        this.orderBy = orderBy;
        this.params = params;
        this.top = top;
        this.skip = skip;
    }

    public static MicroserviceOverviewQuery of(MicroserviceOverviewFilter filter) {
        List<String> clauses = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();
        clauses.add(TYPE_CLAUSE);

        if (isPresent(filter.name())) {
            clauses.add(NAME_CLAUSE);
            params.put("name", contains(filter.name()));
        }
        if (filter.envs() != null && !filter.envs().isEmpty()) {
            clauses.add(ENV_CLAUSE);
            params.put("envs", List.copyOf(filter.envs()));
        }
        if (isPresent(filter.artifactId())) {
            clauses.add(ARTIFACT_CLAUSE);
            params.put("artifactId", contains(filter.artifactId()));
        }
        if (isPresent(filter.topic())) {
            clauses.add(TOPIC_CLAUSE);
            params.put("topic", contains(filter.topic()));
        }

        String orderBy = filter.sortField().column() + (filter.descending() ? " DESC" : " ASC") + ", n.id";
        return new MicroserviceOverviewQuery(String.join(" AND ", clauses), orderBy, params,
                filter.top(), filter.skip());
    }

    /** Страница строк узлов: id, name, environment. */
    public String pageSql() {
        return "SELECT n.id, n.name, n.environment" + FROM + this.where
                + " ORDER BY " + this.orderBy + " LIMIT :top OFFSET :skip";
    }

    /** Общее число подходящих узлов — тот же WHERE, что у {@link #pageSql()}. */
    public String countSql() {
        return "SELECT count(*)" + FROM + this.where;
    }

    /** Параметры фильтров — для {@link #countSql()}. */
    public Map<String, Object> params() {
        return Collections.unmodifiableMap(this.params);
    }

    /** Параметры фильтров плюс top/skip — для {@link #pageSql()}. */
    public Map<String, Object> pageParams() {
        Map<String, Object> all = new LinkedHashMap<>(this.params);
        all.put("top", this.top);
        all.put("skip", this.skip);
        return Collections.unmodifiableMap(all);
    }

    static String contains(String text) {
        return "%" + escapeLike(text.trim()) + "%";
    }

    static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static boolean isPresent(String text) {
        return text != null && !text.isBlank();
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run the same command as Step 2.
Expected: `Tests run: 11, Failures: 0, Errors: 0` and BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
cd /f/programming/cometa
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/ \
        cometa-persistence-module/src/test/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/
git commit -m "feat(microservice-overview): filter record and native SQL builder

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 2: Backend: repository (four native statements)

**Repo:** `F:\programming\cometa`

**Files:**
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewRows.java`
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/MicroserviceOverviewRepository.java`

**Interfaces:**
- Consumes: `MicroserviceOverviewQuery.pageSql()`, `countSql()`, `params()`, `pageParams()` (Task 1).
- Produces:
  - `MicroserviceOverviewRows.NodeRow(long id, String name, String environment)`
  - `MicroserviceOverviewRows.DeploymentRow(long nodeId, long techComponentId, String techComponentName, String artifactId, String version)`
  - `MicroserviceOverviewRows.TopicFlowRow(long nodeId, long topicId, String topicName, String direction, long flowId, String flowCaption)`
  - `@Repository MicroserviceOverviewRepository`:
    - `List<NodeRow> findPage(MicroserviceOverviewQuery)`
    - `long count(MicroserviceOverviewQuery)`
    - `List<DeploymentRow> findDeployments(Collection<Long> nodeIds)`
    - `List<TopicFlowRow> findTopicsAndFlows(Collection<Long> nodeIds)`

  `artifactId`, `version` and `flowCaption` may be `null` in rows. The service maps `null` to `""`.

There is no unit test for this class. Like the reconcile repository, it is a thin `EntityManager` wrapper, and its SQL is verified against the live database in Step 3 and again end to end in Task 8.

- [ ] **Step 1: Write `MicroserviceOverviewRows.java`**

```java
package ru.sberbank.cib.gmbus.repository.microserviceoverview;

/**
 * Строки, которые {@link MicroserviceOverviewRepository} читает нативным SQL.
 * Строковые поля деталей могут быть null (ключа нет в jsonb) — в "" их
 * превращает сервис.
 */
public final class MicroserviceOverviewRows {

    private MicroserviceOverviewRows() {
    }

    public record NodeRow(long id, String name, String environment) {
    }

    public record DeploymentRow(long nodeId, long techComponentId, String techComponentName,
                                String artifactId, String version) {
    }

    /** direction — сырое link.data_flow_direction (CODIRECTIONAL / COUNTERDIRECTIONAL). */
    public record TopicFlowRow(long nodeId, long topicId, String topicName, String direction,
                               long flowId, String flowCaption) {
    }
}
```

- [ ] **Step 2: Write `MicroserviceOverviewRepository.java`**

```java
package ru.sberbank.cib.gmbus.repository.microserviceoverview;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import lombok.experimental.NonFinal;
import org.springframework.stereotype.Repository;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.DeploymentRow;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.NodeRow;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.TopicFlowRow;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Четыре нативных statement'а страницы «Микросервисы»: страница узлов,
 * их число, затем детали только для id этой страницы. Итого четыре
 * запроса на страницу при любом её размере, без N+1 и без чтения node.data.
 *
 * Спека: cometa-frontend/docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md
 */
@Repository
public class MicroserviceOverviewRepository {

    private static final String DEPLOYMENTS = """
            SELECT ntl.node_id, tc.id, tc.name, ntl.data->>'artifactId', ntl.data->>'version'
              FROM gmsb.node_tech_component_link ntl
              JOIN gmsb.tech_component tc ON tc.id = ntl.tech_component_id
             WHERE ntl.node_id IN (:ids)
            """;

    // Каноническая пара связей с общим cross_guid; обе связи пары несут один
    // flow_id и одно data_flow_direction (проверено на всех 1596 парах 2026-10-16).
    private static final String TOPICS_AND_FLOWS = """
            SELECT l.client_node_id, t.id, t.name, l.data_flow_direction, f.id, f.caption
              FROM gmsb.link l
              JOIN gmsb.link l2 ON l2.cross_guid = l.cross_guid AND l2.id <> l.id
              JOIN gmsb.node t  ON t.id = l2.server_node_id AND t.node_type = 'TOPIC'
              JOIN gmsb.flow f  ON f.id = l.flow_id
             WHERE l.client_node_id IN (:ids)
            """;

    // @NonFinal — корневой lombok.config делает поля final, а в final-поле
    // @PersistenceContext внедрить нечего.
    @NonFinal
    @PersistenceContext
    private EntityManager entityManager;

    public List<NodeRow> findPage(MicroserviceOverviewQuery query) {
        return rows(query.pageSql(), query.pageParams()).stream()
                .map(r -> new NodeRow(asLong(r[0]), (String) r[1], (String) r[2]))
                .toList();
    }

    public long count(MicroserviceOverviewQuery query) {
        Query q = this.entityManager.createNativeQuery(query.countSql());
        query.params().forEach(q::setParameter);
        return asLong(q.getSingleResult());
    }

    public List<DeploymentRow> findDeployments(Collection<Long> nodeIds) {
        return rows(DEPLOYMENTS, Map.<String, Object>of("ids", nodeIds)).stream()
                .map(r -> new DeploymentRow(asLong(r[0]), asLong(r[1]), (String) r[2], (String) r[3], (String) r[4]))
                .toList();
    }

    public List<TopicFlowRow> findTopicsAndFlows(Collection<Long> nodeIds) {
        return rows(TOPICS_AND_FLOWS, Map.<String, Object>of("ids", nodeIds)).stream()
                .map(r -> new TopicFlowRow(asLong(r[0]), asLong(r[1]), (String) r[2], (String) r[3],
                        asLong(r[4]), (String) r[5]))
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> rows(String sql, Map<String, Object> params) {
        Query q = this.entityManager.createNativeQuery(sql);
        params.forEach(q::setParameter);
        return q.getResultList();
    }

    private static long asLong(Object value) {
        return ((Number) value).longValue();
    }
}
```

- [ ] **Step 3: Verify the SQL against the live database**

Run each statement through the `mcp__cometa-postgres__pg_execute_query` tool (`operation: "select"`), with parameters substituted by hand exactly as the builder would bind them. The page statement with all four filters (the shape Task 1's `allFiltersCombineWithAnd` produces):

```sql
SELECT n.id, n.name, n.environment FROM gmsb.node n
 WHERE n.node_type = 'MICROSERVICE'
   AND n.name ILIKE '%zeus%'
   AND n.environment IN ('IFT','UAT','PROD')
   AND EXISTS (SELECT 1 FROM gmsb.node_tech_component_link ntl WHERE ntl.node_id = n.id AND ntl.data->>'artifactId' ILIKE '%kafka-payload%')
   AND EXISTS (SELECT 1 FROM gmsb.link l JOIN gmsb.link l2 ON l2.cross_guid = l.cross_guid AND l2.id <> l.id JOIN gmsb.node t ON t.id = l2.server_node_id AND t.node_type = 'TOPIC' WHERE l.client_node_id = n.id AND t.name ILIKE '%CALYPSO.PAYMENTS%')
 ORDER BY n.name ASC, n.id LIMIT 20 OFFSET 0
```
Expected: no error. The rows include `calypso-payments-zeus-out` (ids 376571, 376952, 377510, depending on which environments carry the topic link).

Then run the detail statements for those ids:
```sql
SELECT ntl.node_id, tc.id, tc.name, ntl.data->>'artifactId', ntl.data->>'version'
  FROM gmsb.node_tech_component_link ntl JOIN gmsb.tech_component tc ON tc.id = ntl.tech_component_id
 WHERE ntl.node_id IN (376571, 376952, 377510)
```
```sql
SELECT l.client_node_id, t.id, t.name, l.data_flow_direction, f.id, f.caption
  FROM gmsb.link l
  JOIN gmsb.link l2 ON l2.cross_guid = l.cross_guid AND l2.id <> l.id
  JOIN gmsb.node t  ON t.id = l2.server_node_id AND t.node_type = 'TOPIC'
  JOIN gmsb.flow f  ON f.id = l.flow_id
 WHERE l.client_node_id IN (376571, 376952, 377510)
```
Expected: deployment rows carry `kafka-payload-kafka` / `6.0.2_m121j25r`. Topic rows include `CALYPSO.PAYMENTS…` with `CODIRECTIONAL` or `COUNTERDIRECTIONAL`, plus a flow caption. If any statement errors, fix the constant in the repository and Task 1's builder before continuing.

- [ ] **Step 4: Compile**

```bash
cd /f/programming/cometa
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
./mvnw -q -pl cometa-persistence-module -am -DskipTests compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/microserviceoverview/
git commit -m "feat(microservice-overview): native-SQL repository for page, count and details

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 3: Backend: DTO and service

**Repo:** `F:\programming\cometa`

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/microserviceoverview/MicroserviceOverviewDto.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/microserviceoverview/MicroserviceOverviewService.java`
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/microserviceoverview/MicroserviceOverviewServiceTest.java`

**Interfaces:**
- Consumes: Task 1's filter and query, and Task 2's repository and row records.
- Produces:
  - `record MicroserviceOverviewDto(long id, String name, String environment, List<Deployment> deployments, List<TopicRef> topics, List<FlowRef> flows)`, with nested types:
    - `Deployment(long techComponentId, String techComponentName, String artifactId, String version)`
    - `enum TopicDirection { CONSUME, PRODUCE }`
    - `TopicRef(long id, String name, TopicDirection direction)`
    - `FlowRef(long id, String caption)`
  - `@Service MicroserviceOverviewService` with `ResultObj<List<MicroserviceOverviewDto>> find(MicroserviceOverviewFilter)`, which sets both `data` and `count`.
  - JSON field names are the record component names: `id`, `name`, `environment`, `deployments[].techComponentId|techComponentName|artifactId|version`, `topics[].id|name|direction`, `flows[].id|caption`.

- [ ] **Step 1: Write the DTO** (the test needs it to compile)

```java
package ru.sberbank.cib.gmbus.service.dto.microserviceoverview;

import java.util.List;

/**
 * Строка страницы «Микросервисы»: один узел MICROSERVICE (name + environment).
 *
 * Правило no-null: строковые поля никогда не null, отсутствие — "".
 * Порядок списков задаёт сервис: deployments — по techComponentName, затем
 * artifactId; topics — сначала CONSUME, потом PRODUCE, внутри по name;
 * flows — по caption.
 */
public record MicroserviceOverviewDto(
        long id,
        String name,
        String environment,
        List<Deployment> deployments,
        List<TopicRef> topics,
        List<FlowRef> flows) {

    public record Deployment(long techComponentId, String techComponentName, String artifactId, String version) {
    }

    /**
     * Направление с точки зрения микросервиса. COUNTERDIRECTIONAL связи —
     * CONSUME (читает из топика), CODIRECTIONAL — PRODUCE (пишет в топик).
     * Порядок констант задаёт порядок в списке topics.
     */
    public enum TopicDirection {
        CONSUME,
        PRODUCE
    }

    public record TopicRef(long id, String name, TopicDirection direction) {
    }

    public record FlowRef(long id, String caption) {
    }
}
```

- [ ] **Step 2: Write the failing test**

```java
package ru.sberbank.cib.gmbus.service.microserviceoverview;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.sber.cs.core.rest.response.ResultObj;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter.SortField;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRepository;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.DeploymentRow;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.NodeRow;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.TopicFlowRow;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.Deployment;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.FlowRef;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.TopicRef;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.TopicDirection.CONSUME;
import static ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.TopicDirection.PRODUCE;

/**
 * Сборка строк страницы «Микросервисы» из строк репозитория. SQL здесь не
 * выполняется — репозиторий замокан.
 */
@ExtendWith(MockitoExtension.class)
class MicroserviceOverviewServiceTest {

    private static final MicroserviceOverviewFilter ANY_FILTER =
            new MicroserviceOverviewFilter(null, null, null, null, 20, 0, SortField.NAME, false);

    @Mock
    MicroserviceOverviewRepository repository;

    @InjectMocks
    MicroserviceOverviewService service;

    private void givenPage(long count, NodeRow... nodes) {
        when(repository.findPage(any())).thenReturn(List.of(nodes));
        when(repository.count(any())).thenReturn(count);
    }

    private MicroserviceOverviewDto only(ResultObj<List<MicroserviceOverviewDto>> result) {
        assertThat(result.getData()).hasSize(1);
        return result.getData().get(0);
    }

    @Test
    void keepsPageOrderAndCount() {
        givenPage(7, new NodeRow(2, "b-ms", "UAT"), new NodeRow(1, "a-ms", "IFT"));
        when(repository.findDeployments(any())).thenReturn(List.of());
        when(repository.findTopicsAndFlows(any())).thenReturn(List.of());

        ResultObj<List<MicroserviceOverviewDto>> result = service.find(ANY_FILTER);

        assertThat(result.getCount()).isEqualTo(7L);
        assertThat(result.getData()).extracting(MicroserviceOverviewDto::id).containsExactly(2L, 1L);
        assertThat(result.getData().get(0).name()).isEqualTo("b-ms");
        assertThat(result.getData().get(0).environment()).isEqualTo("UAT");
    }

    @Test
    void groupsDeploymentsOntoTheirNodeSortedByTcThenArtifact() {
        givenPage(2, new NodeRow(1, "a", "IFT"), new NodeRow(2, "b", "IFT"));
        when(repository.findDeployments(any())).thenReturn(List.of(
                new DeploymentRow(1, 31, "ift-k8s-bk2", "zz-art", "2"),
                new DeploymentRow(2, 30, "ift-k8s-bk1", "other", "9"),
                new DeploymentRow(1, 30, "ift-k8s-bk1", "yy-art", "1"),
                new DeploymentRow(1, 30, "ift-k8s-bk1", "aa-art", "1")));
        when(repository.findTopicsAndFlows(any())).thenReturn(List.of());

        List<MicroserviceOverviewDto> data = service.find(ANY_FILTER).getData();

        assertThat(data.get(0).deployments()).containsExactly(
                new Deployment(30, "ift-k8s-bk1", "aa-art", "1"),
                new Deployment(30, "ift-k8s-bk1", "yy-art", "1"),
                new Deployment(31, "ift-k8s-bk2", "zz-art", "2"));
        assertThat(data.get(1).deployments()).containsExactly(new Deployment(30, "ift-k8s-bk1", "other", "9"));
    }

    @Test
    void missingArtifactVersionAndCaptionBecomeEmptyStrings() {
        givenPage(1, new NodeRow(1, "a", "IFT"));
        when(repository.findDeployments(any())).thenReturn(List.of(new DeploymentRow(1, 30, "ift-k8s-bk1", null, null)));
        when(repository.findTopicsAndFlows(any())).thenReturn(List.of(
                new TopicFlowRow(1, 10, "T", "CODIRECTIONAL", 100, null)));

        MicroserviceOverviewDto row = only(service.find(ANY_FILTER));

        assertThat(row.deployments()).containsExactly(new Deployment(30, "ift-k8s-bk1", "", ""));
        assertThat(row.flows()).containsExactly(new FlowRef(100, ""));
    }

    @Test
    void topicsAreDistinctByIdAndDirectionConsumeFirst() {
        givenPage(1, new NodeRow(1, "a", "IFT"));
        when(repository.findDeployments(any())).thenReturn(List.of());
        when(repository.findTopicsAndFlows(any())).thenReturn(List.of(
                new TopicFlowRow(1, 10, "Z.TOPIC", "COUNTERDIRECTIONAL", 100, "Flow B"),
                new TopicFlowRow(1, 11, "A.TOPIC", "CODIRECTIONAL", 100, "Flow B"),
                new TopicFlowRow(1, 10, "Z.TOPIC", "COUNTERDIRECTIONAL", 101, "Flow A"),
                new TopicFlowRow(1, 12, "B.TOPIC", "COUNTERDIRECTIONAL", 100, "Flow B"),
                new TopicFlowRow(1, 11, "A.TOPIC", "COUNTERDIRECTIONAL", 100, "Flow B")));

        MicroserviceOverviewDto row = only(service.find(ANY_FILTER));

        assertThat(row.topics()).containsExactly(
                new TopicRef(11, "A.TOPIC", CONSUME),
                new TopicRef(12, "B.TOPIC", CONSUME),
                new TopicRef(10, "Z.TOPIC", CONSUME),
                new TopicRef(11, "A.TOPIC", PRODUCE));
        assertThat(row.flows()).containsExactly(new FlowRef(101, "Flow A"), new FlowRef(100, "Flow B"));
    }

    @Test
    void unknownDirectionDropsTheTopicButKeepsTheFlow() {
        givenPage(1, new NodeRow(1, "a", "IFT"));
        when(repository.findDeployments(any())).thenReturn(List.of());
        when(repository.findTopicsAndFlows(any())).thenReturn(List.of(
                new TopicFlowRow(1, 10, "T", "SIDEWAYS", 100, "Flow")));

        MicroserviceOverviewDto row = only(service.find(ANY_FILTER));

        assertThat(row.topics()).isEmpty();
        assertThat(row.flows()).containsExactly(new FlowRef(100, "Flow"));
    }

    @Test
    void nodeWithoutLinksGetsEmptyLists() {
        givenPage(1, new NodeRow(1, "a", "IFT"));
        when(repository.findDeployments(any())).thenReturn(List.of());
        when(repository.findTopicsAndFlows(any())).thenReturn(List.of());

        MicroserviceOverviewDto row = only(service.find(ANY_FILTER));

        assertThat(row.deployments()).isEmpty();
        assertThat(row.topics()).isEmpty();
        assertThat(row.flows()).isEmpty();
    }

    @Test
    void emptyPageSkipsDetailQueries() {
        givenPage(42);

        ResultObj<List<MicroserviceOverviewDto>> result = service.find(ANY_FILTER);

        assertThat(result.getData()).isEmpty();
        assertThat(result.getCount()).isEqualTo(42L);
        verify(repository, never()).findDeployments(any());
        verify(repository, never()).findTopicsAndFlows(any());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /f/programming/cometa
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
./mvnw -q -pl cometa-service-module -am -Dtest=MicroserviceOverviewServiceTest -Dsurefire.failIfNoSpecifiedTests=false test
```
Expected: compilation FAILURE, `cannot find symbol: class MicroserviceOverviewService`. A one-off `testCompile` failure naming an unrelated class that does exist is a known flake: re-run once.

- [ ] **Step 4: Write `MicroserviceOverviewService.java`**

```java
package ru.sberbank.cib.gmbus.service.microserviceoverview;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sber.cs.core.rest.response.ResultObj;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewQuery;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRepository;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.DeploymentRow;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.NodeRow;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewRows.TopicFlowRow;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.Deployment;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.FlowRef;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.TopicDirection;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto.TopicRef;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Страница «Микросервисы»: строки узлов MICROSERVICE с развёртываниями,
 * топиками (с направлением) и потоками.
 *
 * Детали читаются одним запросом на вид деталей для всех id страницы и
 * раскладываются по узлам здесь; порядок узлов — порядок первого запроса.
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class MicroserviceOverviewService {

    private static final Comparator<Deployment> DEPLOYMENT_ORDER = Comparator
            .comparing(Deployment::techComponentName)
            .thenComparing(Deployment::artifactId)
            .thenComparing(Deployment::version);

    // Порядок констант TopicDirection: сначала CONSUME, затем PRODUCE.
    private static final Comparator<TopicRef> TOPIC_ORDER = Comparator
            .comparing(TopicRef::direction)
            .thenComparing(TopicRef::name)
            .thenComparingLong(TopicRef::id);

    private static final Comparator<FlowRef> FLOW_ORDER = Comparator
            .comparing(FlowRef::caption)
            .thenComparingLong(FlowRef::id);

    private final MicroserviceOverviewRepository repository;

    @Transactional(readOnly = true)
    public ResultObj<List<MicroserviceOverviewDto>> find(MicroserviceOverviewFilter filter) {
        MicroserviceOverviewQuery query = MicroserviceOverviewQuery.of(filter);
        List<NodeRow> page = this.repository.findPage(query);
        long count = this.repository.count(query);

        ResultObj<List<MicroserviceOverviewDto>> result = new ResultObj<>();
        result.setData(page.isEmpty() ? List.of() : assemble(page));
        result.setCount(count);
        return result;
    }

    private List<MicroserviceOverviewDto> assemble(List<NodeRow> page) {
        List<Long> ids = page.stream().map(NodeRow::id).toList();

        Map<Long, List<Deployment>> deployments = new HashMap<>();
        for (DeploymentRow r : this.repository.findDeployments(ids)) {
            deployments.computeIfAbsent(r.nodeId(), id -> new ArrayList<>()).add(new Deployment(
                    r.techComponentId(), orEmpty(r.techComponentName()), orEmpty(r.artifactId()), orEmpty(r.version())));
        }

        // Set по записи: TopicRef равны при равных (id, name, direction), а name
        // однозначно определяется id — то есть различие ровно по (id, direction).
        Map<Long, Set<TopicRef>> topics = new HashMap<>();
        Map<Long, Set<FlowRef>> flows = new HashMap<>();
        for (TopicFlowRow r : this.repository.findTopicsAndFlows(ids)) {
            flows.computeIfAbsent(r.nodeId(), id -> new LinkedHashSet<>())
                    .add(new FlowRef(r.flowId(), orEmpty(r.flowCaption())));

            TopicDirection direction = toDirection(r.direction());
            if (direction == null) {
                log.warn("Неизвестное направление связи '{}': микросервис {}, топик {} — топик пропущен",
                        r.direction(), r.nodeId(), r.topicId());
                continue;
            }
            topics.computeIfAbsent(r.nodeId(), id -> new LinkedHashSet<>())
                    .add(new TopicRef(r.topicId(), orEmpty(r.topicName()), direction));
        }

        return page.stream()
                .map(n -> new MicroserviceOverviewDto(
                        n.id(),
                        orEmpty(n.name()),
                        orEmpty(n.environment()),
                        sorted(deployments.get(n.id()), DEPLOYMENT_ORDER),
                        sorted(topics.get(n.id()), TOPIC_ORDER),
                        sorted(flows.get(n.id()), FLOW_ORDER)))
                .toList();
    }

    static TopicDirection toDirection(String linkDirection) {
        if ("COUNTERDIRECTIONAL".equals(linkDirection)) {
            return TopicDirection.CONSUME;
        }
        if ("CODIRECTIONAL".equals(linkDirection)) {
            return TopicDirection.PRODUCE;
        }
        return null;
    }

    private static <T> List<T> sorted(Collection<T> items, Comparator<T> order) {
        return items == null ? List.of() : items.stream().sorted(order).toList();
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run the same command as Step 3.
Expected: `Tests run: 7, Failures: 0, Errors: 0` and BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/microserviceoverview/ \
        cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/microserviceoverview/ \
        cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/microserviceoverview/
git commit -m "feat(microservice-overview): DTO and service assembling rows, topics and flows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 4: Backend: param parsing, controller, full build

**Repo:** `F:\programming\cometa`

**Files:**
- Create: `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewParams.java`
- Create: `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewController.java`
- Test: `cometa-web-module/src/test/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewParamsTest.java`
- Test: `cometa-web-module/src/test/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewControllerTest.java`

**Interfaces:**
- Consumes: `MicroserviceOverviewFilter` (Task 1) and `MicroserviceOverviewService.find` (Task 3).
- Produces:
  - `GET /api/v1/microservice-overview` with params `name`, repeatable `env`, `artifactId`, `topic`, `$top` (default 20, range 1..1000), `$skip` (default 0, ≥ 0) and `$orderby` (`name|environment [asc|desc]`, default `name asc`).
  - It answers 200 with `ResultObj<List<MicroserviceOverviewDto>>`, or 400 with a `ResultObj` carrying one `E` message.
  - The 400 is returned as a response entity, not thrown. A thrown exception would be forwarded to `/error`, which this app masks as an empty 403.

- [ ] **Step 1: Write the failing tests**

`MicroserviceOverviewParamsTest.java`:
```java
package ru.sberbank.cib.gmbus.web.api.v1;

import org.junit.jupiter.api.Test;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter.SortField;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MicroserviceOverviewParamsTest {

    private static MicroserviceOverviewFilter parseOrderby(String orderby) {
        return MicroserviceOverviewParams.parse(null, null, null, null, 20, 0, orderby);
    }

    @Test
    void defaultsWhenNothingIsGiven() {
        MicroserviceOverviewFilter f = MicroserviceOverviewParams.parse(null, null, null, null, 20, 0, null);

        assertThat(f).isEqualTo(new MicroserviceOverviewFilter(
                null, List.of(), null, null, 20, 0, SortField.NAME, false));
    }

    @Test
    void blankTextFiltersBecomeNull() {
        MicroserviceOverviewFilter f = MicroserviceOverviewParams.parse(" ", null, "", "  ", 20, 0, " ");

        assertThat(f.name()).isNull();
        assertThat(f.artifactId()).isNull();
        assertThat(f.topic()).isNull();
        assertThat(f.sortField()).isEqualTo(SortField.NAME);
    }

    @Test
    void keepsTextFiltersAsGiven() {
        MicroserviceOverviewFilter f = MicroserviceOverviewParams.parse("zeus", null, "kafka", "CALYPSO", 50, 100, null);

        assertThat(f.name()).isEqualTo("zeus");
        assertThat(f.artifactId()).isEqualTo("kafka");
        assertThat(f.topic()).isEqualTo("CALYPSO");
        assertThat(f.top()).isEqualTo(50);
        assertThat(f.skip()).isEqualTo(100);
    }

    @Test
    void parsesOrderby() {
        assertThat(parseOrderby("environment desc").sortField()).isEqualTo(SortField.ENVIRONMENT);
        assertThat(parseOrderby("environment desc").descending()).isTrue();
        assertThat(parseOrderby("name").descending()).isFalse();
        assertThat(parseOrderby("name ASC").descending()).isFalse();
    }

    @Test
    void rejectsAnUnknownSortFieldOrDirection() {
        assertThatThrownBy(() -> parseOrderby("guid asc")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> parseOrderby("name sideways")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> parseOrderby("name asc, id desc")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void keepsKnownEnvsDropsBlanksAndDuplicates() {
        MicroserviceOverviewFilter f = MicroserviceOverviewParams.parse(
                null, Arrays.asList("IFT", " ", null, "PROD", "IFT"), null, null, 20, 0, null);

        assertThat(f.envs()).containsExactly("IFT", "PROD");
    }

    @Test
    void rejectsAnUnknownEnv() {
        assertThatThrownBy(() -> MicroserviceOverviewParams.parse(null, List.of("QA"), null, null, 20, 0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("QA");
    }

    @Test
    void rejectsTopAndSkipOutOfRange() {
        assertThatThrownBy(() -> MicroserviceOverviewParams.parse(null, null, null, null, 0, 0, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MicroserviceOverviewParams.parse(null, null, null, null, 1001, 0, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MicroserviceOverviewParams.parse(null, null, null, null, 20, -1, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

`MicroserviceOverviewControllerTest.java`:
```java
package ru.sberbank.cib.gmbus.web.api.v1;

import lombok.experimental.NonFinal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import ru.sber.cs.core.rest.response.ResultObj;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter.SortField;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto;
import ru.sberbank.cib.gmbus.service.microserviceoverview.MicroserviceOverviewService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plain-JUnit unit test: Spring-контекст не поднимается, контроллер создаётся
 * напрямую (как MicroserviceNameAggrReconcileControllerTest).
 *
 * @NonFinal снимает final с полей — корневой lombok.config делает их final.
 */
class MicroserviceOverviewControllerTest {

    @NonFinal
    private MicroserviceOverviewService service;
    @NonFinal
    private MicroserviceOverviewController controller;

    @BeforeEach
    void setUp() {
        service = mock(MicroserviceOverviewService.class);
        controller = new MicroserviceOverviewController(service);
    }

    @Test
    void passesTheParsedFilterAndReturnsTheServiceResult() {
        ResultObj<List<MicroserviceOverviewDto>> serviceResult = new ResultObj<>();
        serviceResult.setData(List.of());
        serviceResult.setCount(5L);
        when(service.find(any())).thenReturn(serviceResult);

        ResponseEntity<ResultObj<List<MicroserviceOverviewDto>>> response = controller.getAll(
                "zeus", List.of("IFT"), "kafka", "CALYPSO", 20, 40, "environment desc");

        ArgumentCaptor<MicroserviceOverviewFilter> filter = ArgumentCaptor.forClass(MicroserviceOverviewFilter.class);
        verify(service).find(filter.capture());
        assertThat(filter.getValue()).isEqualTo(new MicroserviceOverviewFilter(
                "zeus", List.of("IFT"), "kafka", "CALYPSO", 20, 40, SortField.ENVIRONMENT, true));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(serviceResult);
    }

    @Test
    void answersBadRequestWithAMessageAndNeverQueries() {
        ResponseEntity<ResultObj<List<MicroserviceOverviewDto>>> response = controller.getAll(
                null, null, null, null, 20, 0, "guid asc");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessages()).hasSize(1);
        assertThat(response.getBody().getMessages().get(0).getMessage()).contains("guid");
        verify(service, never()).find(any());
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /f/programming/cometa
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
./mvnw -q -pl cometa-web-module -am "-Dtest=MicroserviceOverview*Test" -Dsurefire.failIfNoSpecifiedTests=false test
```
Expected: compilation FAILURE, `cannot find symbol: class MicroserviceOverviewParams`.

- [ ] **Step 3: Write `MicroserviceOverviewParams.java`**

```java
package ru.sberbank.cib.gmbus.web.api.v1;

import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter.SortField;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Разбор и проверка параметров GET /api/v1/microservice-overview.
 * Любая ошибка — IllegalArgumentException с текстом для пользователя;
 * контроллер превращает её в 400.
 */
final class MicroserviceOverviewParams {

    static final Set<String> ENVIRONMENTS = Set.of("IFT", "UAT", "PROD", "DEV");

    static final int MAX_TOP = 1000;

    private MicroserviceOverviewParams() {
    }

    static MicroserviceOverviewFilter parse(String name, List<String> env, String artifactId, String topic,
                                            int top, int skip, String orderby) {
        if (top < 1 || top > MAX_TOP) {
            throw new IllegalArgumentException("$top должен быть от 1 до " + MAX_TOP + ", получено " + top);
        }
        if (skip < 0) {
            throw new IllegalArgumentException("$skip не может быть отрицательным, получено " + skip);
        }

        List<String> envs = env == null ? List.of() : env.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(e -> !e.isEmpty())
                .distinct()
                .toList();
        for (String e : envs) {
            if (!ENVIRONMENTS.contains(e)) {
                throw new IllegalArgumentException("Неизвестное окружение: " + e);
            }
        }

        SortField sortField = SortField.NAME;
        boolean descending = false;
        if (orderby != null && !orderby.isBlank()) {
            String[] parts = orderby.trim().split("\\s+");
            if (parts.length > 2) {
                throw new IllegalArgumentException("Поддерживается сортировка только по одному полю: " + orderby);
            }
            sortField = switch (parts[0]) {
                case "name" -> SortField.NAME;
                case "environment" -> SortField.ENVIRONMENT;
                default -> throw new IllegalArgumentException("Сортировка по полю '" + parts[0] + "' не поддерживается");
            };
            if (parts.length == 2) {
                descending = switch (parts[1].toLowerCase(Locale.ROOT)) {
                    case "asc" -> false;
                    case "desc" -> true;
                    default -> throw new IllegalArgumentException("Неизвестное направление сортировки: " + parts[1]);
                };
            }
        }

        return new MicroserviceOverviewFilter(blankToNull(name), envs, blankToNull(artifactId), blankToNull(topic),
                top, skip, sortField, descending);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text;
    }
}
```

- [ ] **Step 4: Write `MicroserviceOverviewController.java`**

```java
package ru.sberbank.cib.gmbus.web.api.v1;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.sber.cs.core.rest.response.ResponseFactory;
import ru.sber.cs.core.rest.response.ResultObj;
import ru.sber.cs.core.rest.response.messages.AppMessage;
import ru.sberbank.cib.gmbus.repository.microserviceoverview.MicroserviceOverviewFilter;
import ru.sberbank.cib.gmbus.service.dto.microserviceoverview.MicroserviceOverviewDto;
import ru.sberbank.cib.gmbus.service.microserviceoverview.MicroserviceOverviewService;

import java.util.List;

/**
 * Страница «Микросервисы»: узлы MICROSERVICE с фильтрами по имени, окружению,
 * artifactId развёртывания и имени связанного топика. Только чтение; не OData —
 * фильтры обычные параметры, $top/$skip/$orderby названы как в CRUD-маршрутах.
 *
 * Ошибка параметров возвращается как 400 напрямую, а не исключением: исключение
 * ушло бы в /error, который для клиента выглядит пустым 403.
 */
@RequiredArgsConstructor
@Tag(name = "MicroserviceOverview", description = "Микросервисы: развёртывания, топики, потоки")
@RestController
@RequestMapping("/api/${application.api.version}/microservice-overview")
public class MicroserviceOverviewController {

    private final MicroserviceOverviewService service;

    @GetMapping
    public ResponseEntity<ResultObj<List<MicroserviceOverviewDto>>> getAll(
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "env", required = false) List<String> env,
            @RequestParam(value = "artifactId", required = false) String artifactId,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "$top", defaultValue = "20") Integer top,
            @RequestParam(value = "$skip", defaultValue = "0") Integer skip,
            @RequestParam(value = "$orderby", required = false) String orderby) {
        MicroserviceOverviewFilter filter;
        try {
            filter = MicroserviceOverviewParams.parse(name, env, artifactId, topic, top, skip, orderby);
        } catch (IllegalArgumentException e) {
            ResultObj<List<MicroserviceOverviewDto>> badRequest = new ResultObj<>();
            badRequest.addMessages(AppMessage.error(e.getMessage()));
            return ResponseFactory.create(HttpStatus.BAD_REQUEST, badRequest);
        }
        return ResponseFactory.create(HttpStatus.OK, this.service.find(filter));
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run the same command as Step 2.
Expected: `MicroserviceOverviewParamsTest` reports 8 tests and `MicroserviceOverviewControllerTest` 2, all passing, with BUILD SUCCESS.

- [ ] **Step 6: Full build and mapper-corruption check**

Stop any running `cometa-web-module` jar first. In PowerShell: `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object CommandLine -like '*cometa-web-module*' | ForEach-Object { Stop-Process -Id $_.ProcessId }`.

```bash
cd /f/programming/cometa
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
./mvnw -q clean install
for f in $(find . -path '*/target/generated-sources/*' -name '*MapperImpl.java'); do
  grep -q "implements" "$f" || echo "CORRUPT: $f"
done
```
Expected: BUILD SUCCESS with all tests green, and no `CORRUPT:` lines. If any mapper impl is corrupt, re-run `./mvnw -q clean install` and check again. Don't proceed with a corrupt impl, because the app fails at startup with "required a bean of type …Mapper".

- [ ] **Step 7: Commit**

```bash
git add cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewParams.java \
        cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewController.java \
        cometa-web-module/src/test/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewParamsTest.java \
        cometa-web-module/src/test/java/ru/sberbank/cib/gmbus/web/api/v1/MicroserviceOverviewControllerTest.java
git commit -m "feat(microservice-overview): GET /api/v1/microservice-overview with param validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 5: Frontend: types and URL search validation

**Repo:** `F:\programming\react\cometa-frontend`

**Files:**
- Create: `src/features/microservice/types.ts`
- Create: `src/features/microservice/search.ts`
- Test: `src/features/microservice/search.test.ts`

**Interfaces:**
- Produces, from `types.ts`:
  - `ENVIRONMENTS = ["IFT","UAT","PROD","DEV"] as const`, `type Environment` and `isEnvironment(v: unknown): v is Environment`
  - `type TopicDirection = "CONSUME" | "PRODUCE"`
  - `interface MicroserviceDeployment`, `MicroserviceTopic`, `MicroserviceFlow` and `MicroserviceOverviewDto`, mirroring Task 3's JSON
- Produces, from `search.ts`:
  - `type MicroserviceSearch = { page: number; pageSize: number | undefined; sort: string; name: string | undefined; env: Environment[] | undefined; artifactId: string | undefined; topic: string | undefined }`
  - `DEFAULT_SORT = "name.asc"`
  - `validateMicroserviceSearch(search: Record<string, unknown>): MicroserviceSearch`

- [ ] **Step 1: Write `types.ts`** (the test imports it)

```ts
/** Mirrors of `MicroserviceOverviewDto` from GET /api/v1/microservice-overview.
 *  No-null standard: every string is non-null; empty is "".
 *  Spec: docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md */

/** Every environment the backend accepts in `env`. Must stay within the
 *  flow-graph route's `env` enum, because each flow link passes the row's env. */
export const ENVIRONMENTS = ["IFT", "UAT", "PROD", "DEV"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export function isEnvironment(value: unknown): value is Environment {
  return (ENVIRONMENTS as readonly unknown[]).includes(value);
}

/** From the microservice's point of view: CONSUME reads from the topic
 *  (COUNTERDIRECTIONAL link), PRODUCE writes to it (CODIRECTIONAL). */
export type TopicDirection = "CONSUME" | "PRODUCE";

export interface MicroserviceDeployment {
  techComponentId: number;
  techComponentName: string;
  artifactId: string;
  version: string;
}

export interface MicroserviceTopic {
  id: number;
  name: string;
  direction: TopicDirection;
}

export interface MicroserviceFlow {
  id: number;
  caption: string;
}

export interface MicroserviceOverviewDto {
  id: number;
  name: string;
  /** A node environment. Typed as string, not `Environment`: the column is
   *  free text in the DB, so narrow with `isEnvironment` before relying on it. */
  environment: string;
  deployments: MicroserviceDeployment[];
  topics: MicroserviceTopic[];
  flows: MicroserviceFlow[];
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { validateMicroserviceSearch } from "./search";

describe("validateMicroserviceSearch", () => {
  it("fills defaults for an empty URL", () => {
    expect(validateMicroserviceSearch({})).toEqual({
      page: 1,
      pageSize: undefined,
      sort: "name.asc",
      name: undefined,
      env: undefined,
      artifactId: undefined,
      topic: undefined,
    });
  });

  it("keeps valid values", () => {
    expect(
      validateMicroserviceSearch({
        page: 3,
        pageSize: 25,
        sort: "environment.desc",
        name: "zeus",
        env: ["IFT", "PROD"],
        artifactId: "kafka-payload",
        topic: "CALYPSO.PAYMENTS",
      }),
    ).toEqual({
      page: 3,
      pageSize: 25,
      sort: "environment.desc",
      name: "zeus",
      env: ["IFT", "PROD"],
      artifactId: "kafka-payload",
      topic: "CALYPSO.PAYMENTS",
    });
  });

  it("only lets whitelisted sorts through to $orderby", () => {
    expect(validateMicroserviceSearch({ sort: "name.desc" }).sort).toBe("name.desc");
    expect(validateMicroserviceSearch({ sort: "environment.asc" }).sort).toBe("environment.asc");
    expect(validateMicroserviceSearch({ sort: "guid.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceSearch({ sort: "topics.asc" }).sort).toBe("name.asc");
    expect(validateMicroserviceSearch({ sort: "name.asc,environment.desc" }).sort).toBe("name.asc");
  });

  it("keeps only known environments, deduplicated", () => {
    expect(validateMicroserviceSearch({ env: ["IFT", "QA", "IFT", 5] }).env).toEqual(["IFT"]);
    expect(validateMicroserviceSearch({ env: ["QA"] }).env).toBeUndefined();
    expect(validateMicroserviceSearch({ env: [] }).env).toBeUndefined();
  });

  it("accepts a single env string from a hand-edited URL", () => {
    expect(validateMicroserviceSearch({ env: "UAT" }).env).toEqual(["UAT"]);
    expect(validateMicroserviceSearch({ env: "QA" }).env).toBeUndefined();
  });

  it("drops empty or non-string text filters", () => {
    const s = validateMicroserviceSearch({ name: "", artifactId: 42, topic: "" });
    expect(s.name).toBeUndefined();
    expect(s.artifactId).toBeUndefined();
    expect(s.topic).toBeUndefined();
  });

  it("falls back on junk page and pageSize", () => {
    expect(validateMicroserviceSearch({ page: 0 }).page).toBe(1);
    expect(validateMicroserviceSearch({ page: 1.5 }).page).toBe(1);
    expect(validateMicroserviceSearch({ page: -2 }).page).toBe(1);
    expect(validateMicroserviceSearch({ pageSize: 7 }).pageSize).toBeUndefined();
    expect(validateMicroserviceSearch({ pageSize: "20" }).pageSize).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/features/microservice/search.test.ts`
Expected: FAIL, `Failed to resolve import "./search"`.

- [ ] **Step 4: Write `search.ts`**

```ts
import { PAGE_SIZE_STEPS } from "@/lib/data-table";
import { ENVIRONMENTS, type Environment } from "./types";

/** A type alias, not an interface: it must stay assignable to
 *  `Record<string, unknown>`, which `useDataTable` requires of its search. */
export type MicroserviceSearch = {
  page: number;
  pageSize: number | undefined;
  sort: string;
  name: string | undefined;
  env: Environment[] | undefined;
  artifactId: string | undefined;
  topic: string | undefined;
};

export const DEFAULT_SORT = "name.asc";

/** The backend answers 400 to any other `$orderby`; strip it here so a
 *  hand-edited or bookmarked URL falls back instead of breaking the page. */
const ALLOWED_SORTS = new Set([
  "name.asc",
  "name.desc",
  "environment.asc",
  "environment.desc",
]);

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function environments(value: unknown): Environment[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const known = ENVIRONMENTS.filter((env) => raw.some((v) => v === env));
  return known.length > 0 ? known : undefined;
}

export function validateMicroserviceSearch(
  search: Record<string, unknown>,
): MicroserviceSearch {
  return {
    page:
      typeof search.page === "number" &&
      Number.isInteger(search.page) &&
      search.page >= 1
        ? search.page
        : 1,
    pageSize:
      typeof search.pageSize === "number" &&
      (PAGE_SIZE_STEPS as readonly number[]).includes(search.pageSize)
        ? search.pageSize
        : undefined,
    sort:
      typeof search.sort === "string" && ALLOWED_SORTS.has(search.sort)
        ? search.sort
        : DEFAULT_SORT,
    name: text(search.name),
    env: environments(search.env),
    artifactId: text(search.artifactId),
    topic: text(search.topic),
  };
}
```

`environments` returns the known values in `ENVIRONMENTS` order, so the result is deduplicated and stable however the URL lists them. `["PROD","IFT"]` becomes `["IFT","PROD"]`. That's harmless: it's a set filter, and a stable order gives stable query keys. The "keeps valid values" test passes `["IFT","PROD"]`, which is already in canonical order.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/microservice/search.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/microservice/types.ts src/features/microservice/search.ts src/features/microservice/search.test.ts
git commit -m "feat(microservice): DTO types and URL search validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 6: Frontend: API param builder and query options

**Repo:** `F:\programming\react\cometa-frontend`

**Files:**
- Create: `src/features/microservice/api.ts`
- Test: `src/features/microservice/api.test.ts`

**Interfaces:**
- Consumes: `MicroserviceSearch` (Task 5) and `MicroserviceOverviewDto` (Task 5).
- Produces:
  - `MICROSERVICE_QUERY_KEY = ["microservice"] as const`
  - `buildMicroserviceParams(search: MicroserviceSearch, pageSize: number): URLSearchParams`
  - `microserviceQueryOptions(search: MicroserviceSearch, pageSize: number)`, which returns `queryOptions` resolving to `ApiResponse<MicroserviceOverviewDto[]>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildMicroserviceParams } from "./api";
import type { MicroserviceSearch } from "./search";

const base: MicroserviceSearch = {
  page: 1,
  pageSize: undefined,
  sort: "name.asc",
  name: undefined,
  env: undefined,
  artifactId: undefined,
  topic: undefined,
};

describe("buildMicroserviceParams", () => {
  it("sends only paging and sort when no filter is set", () => {
    expect(buildMicroserviceParams(base, 20).toString()).toBe(
      "%24top=20&%24skip=0&%24orderby=name+asc",
    );
  });

  it("turns page and pageSize into $top/$skip", () => {
    const params = buildMicroserviceParams({ ...base, page: 3 }, 25);
    expect(params.get("$top")).toBe("25");
    expect(params.get("$skip")).toBe("50");
  });

  it("maps field.dir sort to an OData-style $orderby", () => {
    expect(
      buildMicroserviceParams({ ...base, sort: "environment.desc" }, 20).get("$orderby"),
    ).toBe("environment desc");
  });

  it("repeats env once per value", () => {
    const params = buildMicroserviceParams({ ...base, env: ["IFT", "PROD"] }, 20);
    expect(params.getAll("env")).toEqual(["IFT", "PROD"]);
  });

  it("sends text filters verbatim and omits absent ones", () => {
    const params = buildMicroserviceParams(
      { ...base, name: "zeus", topic: "CALYPSO.PAYMENTS" },
      20,
    );
    expect(params.get("name")).toBe("zeus");
    expect(params.get("topic")).toBe("CALYPSO.PAYMENTS");
    expect(params.has("artifactId")).toBe(false);
    expect(params.has("env")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/microservice/api.test.ts`
Expected: FAIL, `Failed to resolve import "./api"`.

- [ ] **Step 3: Write `api.ts`**

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/create-crud-api";
import type { ApiResponse } from "@/types/api";
import type { MicroserviceSearch } from "./search";
import type { MicroserviceOverviewDto } from "./types";

export const MICROSERVICE_QUERY_KEY = ["microservice"] as const;

const ENDPOINT = "/api/v1/microservice-overview";

/** Plain params, not OData: the endpoint is a native-SQL read model that
 *  OData cannot express (a jsonb field inside a to-many relation, and a
 *  `cross_guid` self-join). Only `$top`/`$skip`/`$orderby` keep the CRUD
 *  names. Spec: docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md */
export function buildMicroserviceParams(
  search: MicroserviceSearch,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("$top", String(pageSize));
  params.set("$skip", String((search.page - 1) * pageSize));
  // `sort` is whitelisted to a single `field.dir` in validateMicroserviceSearch.
  const [field, dir] = search.sort.split(".");
  params.set("$orderby", `${field} ${dir}`);
  if (search.name) params.set("name", search.name);
  for (const env of search.env ?? []) params.append("env", env);
  if (search.artifactId) params.set("artifactId", search.artifactId);
  if (search.topic) params.set("topic", search.topic);
  return params;
}

export function microserviceQueryOptions(
  search: MicroserviceSearch,
  pageSize: number,
) {
  return queryOptions({
    queryKey: [...MICROSERVICE_QUERY_KEY, "table", search, pageSize] as const,
    queryFn: () =>
      apiFetch<ApiResponse<MicroserviceOverviewDto[]>>(
        `${ENDPOINT}?${buildMicroserviceParams(search, pageSize)}`,
      ),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/microservice/api.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/microservice/api.ts src/features/microservice/api.test.ts
git commit -m "feat(microservice): API param builder and query options

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 7: Frontend: columns, route and sidebar

**Repo:** `F:\programming\react\cometa-frontend`

**Files:**
- Create: `src/features/microservice/columns.tsx`
- Create: `src/routes/microservice/index.tsx`
- Modify: `src/components/app-sidebar.tsx`. Add `Waypoints` to the lucide import (alphabetical, after `Users`) and add a `mainNavItems` entry after the `/microservice-at` line (line 60).

**Interfaces:**
- Consumes:
  - from Task 5: `MicroserviceOverviewDto`, `ENVIRONMENTS`, `isEnvironment`, `MicroserviceSearch`, `validateMicroserviceSearch`;
  - from Task 6: `microserviceQueryOptions`;
  - from the repo: `useDataTable` (`@/hooks/use-data-table`), `DataTable`, `DataTableToolbar`, `DataTableColumnHeader`, `Badge` (`@/components/ui/badge`), `dash` (`@/lib/format`), `DEFAULT_PAGE_SIZE` (`@/lib/data-table/switchable-page`).
- Produces: `getMicroserviceColumns(): ColumnDef<MicroserviceOverviewDto>[]`, and the route `/microservice/`.

Filter wiring rule: `useDataTable` maps a column filter to a URL search key through `meta.filterKey`. The toolbar only renders filters for columns where `column.getCanFilter()` is true, and that requires an `accessorKey`/`accessorFn`. So every filterable column below has an accessor, even when its cell ignores the accessed value.

This task has no unit test. Columns and route are JSX wiring, and the repo has no DOM test environment (Vitest runs under `node`). They are checked by `tsc`, `lint` and the live pass in Task 8.

- [ ] **Step 1: Write `columns.tsx`**

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { SquareArrowRightEnter, SquareArrowRightExit } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { dash } from "@/lib/format";
import {
  ENVIRONMENTS,
  isEnvironment,
  type MicroserviceDeployment,
  type MicroserviceFlow,
  type MicroserviceOverviewDto,
  type MicroserviceTopic,
} from "./types";

// Lowercase helpers called as plain functions (not JSX tags), so this file
// exports only the column factory — see react-refresh/only-export-components.

function renderEmpty() {
  return <span className="text-muted-foreground">{dash("")}</span>;
}

function renderDeployments(items: MicroserviceDeployment[]) {
  if (items.length === 0) return renderEmpty();
  return (
    <ul className="space-y-0.5">
      {items.map((d, i) => (
        <li
          key={`${d.techComponentId}|${d.artifactId}|${d.version}|${i}`}
          className="whitespace-nowrap text-xs leading-5"
        >
          <span className="text-muted-foreground">{dash(d.techComponentName)}:</span>{" "}
          <span className="font-mono">
            {dash(d.artifactId)} - {dash(d.version)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Icons are drawn from the TOPIC's point of view: a message produced by the
 *  microservice enters the topic; a consumed one exits it. */
function renderTopicIcon(direction: MicroserviceTopic["direction"]) {
  if (direction === "PRODUCE") {
    return (
      <SquareArrowRightEnter
        className="size-3.5 shrink-0 text-red-600"
        aria-label="produces"
      >
        <title>produces</title>
      </SquareArrowRightEnter>
    );
  }
  return (
    <SquareArrowRightExit
      className="size-3.5 shrink-0 text-green-600"
      aria-label="consumes"
    >
      <title>consumes</title>
    </SquareArrowRightExit>
  );
}

function renderTopics(items: MicroserviceTopic[]) {
  if (items.length === 0) return renderEmpty();
  return (
    <ul className="space-y-0.5">
      {items.map((t) => (
        <li
          key={`${t.id}|${t.direction}`}
          className="flex items-center gap-1.5 whitespace-nowrap text-xs leading-5"
        >
          {renderTopicIcon(t.direction)}
          <span className="font-mono">{dash(t.name)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderFlows(items: MicroserviceFlow[], environment: string) {
  if (items.length === 0) return renderEmpty();
  // flow-graph's `env` defaults to PROD; pass the row's env only when it is
  // one the route accepts, so an unexpected DB value can't break the link.
  const env = isEnvironment(environment) ? environment : undefined;
  return (
    <ul className="space-y-0.5">
      {items.map((f) => (
        <li key={f.id} className="text-xs leading-5">
          <Link
            to="/flow-graph"
            search={{ flowId: f.id, env }}
            className="underline-offset-2 hover:underline"
          >
            {dash(f.caption)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function getMicroserviceColumns(): ColumnDef<MicroserviceOverviewDto>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Microservice" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{dash(row.original.name)}</span>
      ),
      meta: {
        label: "Microservice",
        placeholder: "Search microservices...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: false,
      size: 300,
    },
    {
      id: "environment",
      accessorKey: "environment",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Env" />,
      cell: ({ row }) => (
        <Badge variant="outline">{dash(row.original.environment)}</Badge>
      ),
      meta: {
        label: "Env",
        variant: "multiSelect",
        options: ENVIRONMENTS.map((env) => ({ label: env, value: env })),
        filterKey: "env",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 90,
    },
    {
      id: "deployments",
      accessorFn: (row) => row.deployments,
      header: "Deployments",
      cell: ({ row }) => renderDeployments(row.original.deployments),
      meta: {
        label: "artifactId",
        placeholder: "artifactId...",
        variant: "text",
        filterKey: "artifactId",
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 380,
    },
    {
      id: "topics",
      accessorFn: (row) => row.topics,
      header: "Topics",
      cell: ({ row }) => renderTopics(row.original.topics),
      meta: {
        label: "Topic",
        placeholder: "Topic...",
        variant: "text",
        filterKey: "topic",
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 340,
    },
    {
      id: "flows",
      header: "Flows",
      cell: ({ row }) => renderFlows(row.original.flows, row.original.environment),
      meta: { label: "Flows" },
      enableSorting: false,
      size: 300,
    },
  ];
}
```

If `tsc` rejects `<title>` as a child of the lucide icon, drop both `<title>` children and wrap each icon in `<span title="produces">` / `<span title="consumes">`, keeping `aria-label` on the icon. The tooltip is what matters, not the element that carries it.

- [ ] **Step 2: Write `src/routes/microservice/index.tsx`**

```tsx
import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/data-table/switchable-page";
import { microserviceQueryOptions } from "@/features/microservice/api";
import { getMicroserviceColumns } from "@/features/microservice/columns";
import {
  validateMicroserviceSearch,
  type MicroserviceSearch,
} from "@/features/microservice/search";

function tableQueryOptions(search: MicroserviceSearch) {
  return microserviceQueryOptions(search, search.pageSize ?? DEFAULT_PAGE_SIZE);
}

export const Route = createFileRoute("/microservice/")({
  validateSearch: validateMicroserviceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(tableQueryOptions(deps)),
  component: MicroservicePage,
});

function MicroservicePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/microservice/" });
  const { data } = useSuspenseQuery(tableQueryOptions(search));

  // Built once: a new `columns` array would reset useDataTable's local column
  // filters and wipe a not-yet-debounced search.
  const columns = React.useMemo(() => getMicroserviceColumns(), []);

  const onNavigate = React.useCallback(
    (updates: Partial<MicroserviceSearch>) => {
      navigate({
        search: (prev) => validateMicroserviceSearch({ ...prev, ...updates }),
      });
    },
    [navigate],
  );

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount: Math.ceil(data.count / pageSize),
    search,
    onNavigate,
    initialColumnPinning: { left: ["name"] },
  });

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Микросервисы</h1>
        <p className="mt-2 text-muted-foreground">Всего: {data.count}</p>
      </div>

      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar entry** in `src/components/app-sidebar.tsx`

Add `Waypoints,` to the `lucide-react` import list, after `Users,`. Then add a line after `{ to: "/microservice-at", label: "Microservices & AT", icon: Boxes },`:
```ts
  { to: "/microservice", label: "Микросервисы", icon: Waypoints },
```

- [ ] **Step 4: Regenerate the route tree, then type-check, lint and test**

The `/microservice` route must exist in `src/routeTree.gen.ts` before `tsc` accepts `useNavigate({ from: "/microservice/" })` and the sidebar `to`.

```bash
cd /f/programming/react/cometa-frontend
npm run build
npm run lint
npm test
```
Expected:
- `npm run build` regenerates `src/routeTree.gen.ts`, runs `tsc -b` cleanly and finishes the Vite build.
- `npm run lint` reports no errors.
- `npm test` passes everything, including the 12 new tests.

If `tsc` reports the `<title>` child, apply the Step 1 fallback.

- [ ] **Step 5: Commit**

```bash
git add src/features/microservice/columns.tsx src/routes/microservice/index.tsx src/components/app-sidebar.tsx src/routeTree.gen.ts
git commit -m "feat(microservice): Микросервисы page, columns and sidebar entry

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```

---

### Task 8: Live verification across both repos, then close out the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md` (status line and a short *Implementation notes* section)

- [ ] **Step 1: Start both servers**

- Backend: read `DB_PASSWORD` from `F:\programming\cometa\.vscode\backend.env` with the Read tool. Don't echo it.
- Launch it with `SPRING_PROFILES_ACTIVE=local`, `JAVA_HOME` set to JDK 17, and `java -jar cometa-web-module/target/cometa-web-module-0.0.1-SNAPSHOT.jar`. Run it in the background and wait for "Started CometaApplication".
- Frontend: point the `vite.config` `/api` proxy target at `http://localhost:8080` for this session, and don't commit that change. Make sure `.env.development.local` has `VITE_MOCK_API=false`, then run `npm run dev -- --host` in the background.

- [ ] **Step 2: Log in and open the page**

Use Playwright: open `http://localhost:5173/login`, log in as `16674475` / `qweqweqwe`, then navigate to `/microservice`.

- [ ] **Step 3: Run the spec's live pass**

| # | Action | Expected |
|---|---|---|
| 1 | No filters | Subtitle `Всего: 1812` |
| 2 | Env filter = PROD | `Всего: 587` |
| 3 | artifactId filter `kafka-payload-kafka` | Rows include `calypso-payments-zeus-out` on IFT, UAT and PROD |
| 4 | Clear it; topic filter `CALYPSO.PAYMENTS` | Fewer rows; each row lists a `CALYPSO.PAYMENTS…` topic |
| 4b | Pick one row from 4 and run the Task 2 topics SQL for its id | Each `COUNTERDIRECTIONAL` topic has the green exit icon, and each `CODIRECTIONAL` topic the red enter icon |
| 5 | Env = IFT, topic `CALYPSO`, artifactId `kafka` | The count equals that of the same WHERE run as `SELECT count(*)` via MCP (Task 2's statement with these values) |
| 6 | Sort Microservice desc, then Env asc; go to page 2 | Order flips; `$orderby` and `$skip` in the network request match |
| 7 | Click a flow caption | `/flow-graph?flowId=<id>&env=<row env>` opens with that flow selected |
| 8 | Read the backend console (p6spy) during one page load | Exactly four statements: page, count, deployments, topics |
| 9 | Request `/api/v1/microservice-overview?$orderby=guid%20asc` via `browser_evaluate` + `fetch` | HTTP 400 with an `E` message mentioning `guid` |
| 10 | Hand-edit the URL to `?env=%22QA%22&sort=guid.asc` | Page loads with no env filter, sorted by name |

Record any deviation. If one is a defect, fix it in the owning task's files, re-run that task's tests and commit before continuing.

- [ ] **Step 4: Stop both servers and revert the uncommitted `vite.config` proxy change**

Run `git -C /f/programming/react/cometa-frontend diff --stat vite.config.ts` and confirm it shows no remaining change.

- [ ] **Step 5: Close out the spec**

In `docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md`, change the status line's start from `Status: approved design, not yet implemented.` to `Status: implemented on feature/gm 2026-10-16; live-verified.` Keep the rest of that line. Then append:

```markdown
## Implementation notes (2026-10-16)

- `MicroserviceOverviewFilter` lives in the persistence module, not the service module:
  `MicroserviceOverviewQuery` (persistence) consumes it, and persistence cannot depend on
  service.
- No `ESCAPE '\'` clause: PostgreSQL's default LIKE escape character is already
  backslash, so the escaped parameter behaves identically.
- No `deriveColumnFilters` on the frontend: `useDataTable` derives column filters from
  the search through `meta.filterKey`, and the fetcher reads the search directly.
- `$top` is limited to 1..1000; `$top=0` is a 400, not "all rows".
- <live-pass deviations from Task 8 Step 3, if any; otherwise delete this line>
```

- [ ] **Step 6: Commit**

```bash
cd /f/programming/react/cometa-frontend
git add docs/superpowers/specs/2026-10-16-microservice-overview-page-design.md
git commit -m "docs(microservice-overview): mark implemented; record implementation notes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WaX8FRujKkhHfgVbESca8s"
```
