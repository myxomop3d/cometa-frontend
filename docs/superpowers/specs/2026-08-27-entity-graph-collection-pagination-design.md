# Entity-graph collection pagination — design

**Status:** approved 2026-08-27. Supersedes the "what to do when picking this
up" section of `issue/personTeamsInMemoryPagination.md` (option 2, "two-query
fetch"), which this design implements and generalizes.

**Repos:** backend `F:\programming\cometa` (all changes). No frontend change.

## Problem

Fetching a to-many collection through `$fields` alongside `$top`/`$skip` makes
Hibernate abandon SQL pagination and paginate in the application layer:

```
WARN org.hibernate.orm.query : HHH90003004: firstResult/maxResults specified
with collection fetch; applying in memory
```

`EntityGraphBaseCrudRepository.readAll(ODataParams, CometaEntityGraph)` builds
one query, applies the entity graph as a `jakarta.persistence.fetchgraph` hint,
and sets `setFirstResult`/`setMaxResults`. When the graph names a to-many
attribute the hint becomes a collection fetch join, and the pair is exactly
what trips the warning: every page materialises the whole matching result set
in the JVM and slices it there.

`/person` requests `$fields=teams` unconditionally
(`src/features/person/api.ts`, `src/features/person/advanced-api.ts`), so this
is the default path for the Person list — 222 rows loaded to return 20. It
scales linearly with the person table.

## Approach

Split the read into two queries when — and only when — the entity graph
actually pulls a collection:

1. **Page the roots.** `BaseCrudRepository.readAll(ODataParams)` with no entity
   graph. No collection fetch, so `LIMIT`/`OFFSET` reach Postgres.
2. **Fetch the graph for that page.** A second query restricted to the ids from
   step 1, carrying the fetch-graph hint and *no* `setMaxResults`.
3. **Restore step 1's order** in Java.

### Why the gate

A to-one graph does not trigger in-memory pagination, so the second query would
be pure overhead. Verified live against `/api/v1/team/graph?$top=5&$skip=10&$fields=leader`:

```sql
select t1_0.id, …, l1_0.email, …
  from gmsb.team t1_0
  join gmsb.person l1_0 on l1_0.id=t1_0.leader_person_id
  order by t1_0.id offset 10 rows fetch first 5 rows only
```

One query, `LIMIT`/`OFFSET` in SQL, zero `HHH90003004`. Generalizing without a
gate would add a round trip to `/team` and buy nothing.

### Detecting a to-many without reflection

The JPA metamodel (`EntityManager.getMetamodel()`) is Hibernate's own mapping
metadata behind a typed API — the same information Hibernate consults when
deciding to emit a collection fetch. `Attribute.isCollection()` is true for
`@OneToMany`, `@ManyToMany` and `@ElementCollection`, false for
`@ManyToOne`/`@OneToOne`/basic, which matches what `HHH90003004` reacts to.

Cosium's `DynamicEntityGraph` accepts nested dotted paths (`"supplier.address"`
per its javadoc), so the check must walk each path segment: `leader.teams`
reaches a collection through a to-one, and a top-level-only test would miss it.

## Components

### 1. `CometaEntityGraph.hasPluralAttribute(Metamodel, Class<?>)`

The predicate lives here because this class owns `attributePaths`, which is
private with no getter. Putting the check anywhere else means opening that up.

```java
public boolean hasPluralAttribute(Metamodel metamodel, Class<?> rootType) {
    return attributePaths.stream().anyMatch(path -> isPlural(metamodel, rootType, path));
}

private boolean isPlural(Metamodel metamodel, Class<?> rootType, String path) {
    ManagedType<?> current = metamodel.entity(rootType);
    for (String segment : path.split("\\.")) {
        Attribute<?, ?> attribute;
        try {
            attribute = current.getAttribute(segment);
        } catch (IllegalArgumentException unknownField) {
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

The `catch` is required, not defensive padding: `$fields` is caller-controlled
(`fetchAutomatedSystemsGraph(filters, fields)` passes an arbitrary string
through), and the backend already runs
`odata.mini.repo.throw-on-field-not-found: false`. An unknown field fetches no
collection, so `false` is the correct answer and the request proceeds down the
single-query path exactly as it does today.

### 2. `EntityGraphBaseCrudRepository` — the gate and the two-query read

Type parameter tightens to `MODEL extends WithId` so the id list can be
collected. `ru.sberbank.cib.gmbus.entity.WithId` declares `Long getId()`; all
seven models satisfy it (`Topic → Node → BaseEntity implements WithId`), so
this is a compile-time-only change. `ODataEntityGraphMiniRepository<MODEL, ID>`
and `BaseCrudRepository<MODEL, ID>` stay unbounded — a class may narrow its own
parameter.

```java
@Override
public List<MODEL> readAll(ODataParams oDataParams, CometaEntityGraph entityGraph) {
    if (isPaged(oDataParams) && fetchesCollection(entityGraph)) {
        return readAllPagedThenFetch(oDataParams, entityGraph);
    }
    return readAllSingleQuery(oDataParams, entityGraph);   // today's body, unchanged
}

private boolean isPaged(ODataParams oDataParams) {
    return oDataParams.getTop() > 0 || oDataParams.getSkip() > 0;
}

private boolean fetchesCollection(CometaEntityGraph entityGraph) {
    return entityGraph != null
            && !entityGraph.isEmpty()
            && entityGraph.hasPluralAttribute(entityManager.getMetamodel(), modelClass);
}
```

`isPaged` carries no null guard deliberately. `ODataParams` coerces null
`$top`/`$skip` to `0` in its builder constructor, the controller declares
`defaultValue = "0"`, and both call sites (`EntityGraphBaseCrudService.getAll`,
`FlowGraphService`) use the builder. A guard here would also be false comfort:
the single-query body it falls through to already calls
`oDataParams.getSkip().equals(0)`, as does `BaseCrudRepository` upstream, so the
library assumes non-null throughout and a null would fail one line later
regardless.

```java
private List<MODEL> readAllPagedThenFetch(ODataParams oDataParams, CometaEntityGraph entityGraph) {
    List<Long> ids = super.readAll(oDataParams).stream().map(WithId::getId).toList();
    if (ids.isEmpty()) {
        return List.of();
    }

    String jpql = "SELECT " + modelSimpleName
            + " FROM " + modelClass.getName() + ' ' + modelSimpleName
            + " WHERE " + modelSimpleName + ".id IN :ids";

    TypedQuery<MODEL> query = entityManager.createQuery(jpql, modelClass);
    entityGraph.buildEntityGraph()
            .buildQueryHint(entityManager, modelClass)
            .ifPresent(hint -> query.setHint("jakarta.persistence.fetchgraph", hint.entityGraph()));
    query.setParameter("ids", ids);

    return sortAsIn(query.getResultList(), ids);
}
```

Three constraints on this method, each load-bearing:

**No `setMaxResults`.** It is what causes `HHH90003004`, and it is also
unnecessary — `IN :ids` cannot return more rows than the ids handed to it, and
those already came from a `$top`-capped query. Worse, `$top` defaults to `0`
and JPA reads `setMaxResults(0)` as *limit zero*, so `?$skip=20` with no `$top`
would return an empty page under a `count` of 222.

**No `ORDER BY`.** `WHERE id IN (…)` gets its own plan, so without `$orderby`
the second query returns the page in a different order than the first chose —
observed `[120,119,123,122,117,114,116,115,121,118]` where the single-query
path gives `114…123`. `/person` has no default sort (`sort` is `undefined` in
`switchable-search.ts`), so this hits the table's first render. Reordering in
Java is authoritative in every case and makes an `ORDER BY` clause redundant.

**`ids.isEmpty()` early return**, skipping a pointless query when `$skip` runs
past the end of the result set.

```java
private List<MODEL> sortAsIn(List<MODEL> models, List<Long> ids) {
    Map<Long, Integer> position = new HashMap<>();
    for (int i = 0; i < ids.size(); i++) {
        position.put(ids.get(i), i);
    }
    return models.stream()
            .sorted(Comparator.comparingInt(m -> position.getOrDefault(m.getId(), Integer.MAX_VALUE)))
            .toList();
}
```

### 3. `PersonCrudRepository` stays empty

A prototype override — including a hardcoded `"Person"` alias, which worked
only because `ODataOrderby` aliases on `modelClass.getSimpleName()` — existed
briefly as uncommitted working-tree scratch work while exploring this problem.
It was never committed, so there is nothing to revert: `PersonCrudRepository`
has been an empty subclass of `EntityGraphBaseCrudRepository` since it was
introduced in `dc18cfd`, and this design leaves it that way, relying entirely
on the base-class implementation.

### 4. `EntityGraphBaseCrudService.getAll` becomes `@Transactional(readOnly = true)`

`getAll` issues `count` and the page read as separate autocommit transactions
today; the two-query path adds a third. Nothing in the repo sets a transaction
isolation level, so this runs at PostgreSQL's default READ COMMITTED, where
every statement takes its own fresh snapshot — `readOnly = true` does **not**
close the window between `count` and the page read (or, on the two-query path,
the second query): a commit landing in that window is still visible to the
later query, and `count` can still disagree with what comes back. Closing that
window would require REPEATABLE READ, which this change does not adopt.

The actual reason for the annotation is cheaper but real: it puts `count` and
the page read (and, on the two-query path, the second query) in one
persistence context, one connection, and one commit instead of two or three
autocommit round trips. Live evidence shows exactly one `|commit|` per
request.

Use `org.springframework.transaction.annotation.Transactional`, matching the
`create`/`update`/`patch` overrides already on this class. `getById` is left
alone — it is a single query.

## Scope of behaviour change

| Path | `$fields` | Before | After |
|---|---|---|---|
| `/person/graph` list, paged | `teams` (to-many) | 1 query, in-memory pagination | 3 queries, SQL pagination |
| `/team/graph` list, paged | `leader` (to-one) | 1 query, SQL pagination | unchanged |
| any list, no `$fields` | — | `super.getAll(params)`, never reaches this code | unchanged |
| `FlowGraphService` node fetch | `automatedSystem` | unpaged (`isPaged` false) | unchanged |
| `getById` / `/graph/{id}` | any | single query | unchanged |

## Known limitation

No DTO in this codebase carries `@ODataMappings`, so `ODataParams.fetchTablesSet`
is always empty and query 1 emits no `JOIN FETCH` of its own. If a to-many
mapping is ever added there, query 1 would produce `HHH90003004` again and this
gate would not catch it — the fetch-tables set is not part of `CometaEntityGraph`.

The same gap exists on the second query. `readAllPagedThenFetch`'s
`SELECT … WHERE id IN :ids` carries only the `CometaEntityGraph` fetch-graph
hint; it never consults `oDataParams.getFetchTablesSet()`, unlike
`readAllSingleQuery`, which does emit `JOIN FETCH` for it. This is dormant
today for the same reason — no DTO carries `@ODataMappings` — but it means the
first `@ODataMappings` entry would silently lose its `JOIN FETCH` on the
two-query path even after the query-1 limitation above is addressed, and
would need its own fix here.

## Testing

Unit tests (no Spring context; the project has no `@SpringBootTest`):

- `CometaEntityGraphMetamodelTest` against a mocked `Metamodel`/`ManagedType`:
  to-many path → true; to-one path → false; nested `leader.teams` → true;
  unknown segment → false, no throw; basic-column segment → false; empty graph
  → false.
- `sortAsIn` order restoration, including an id present in `ids` but absent from
  the result list.

Live verification against the running backend, which is how every defect in the
prototype was found — `tsc`-style static checks cannot see any of them:

| Check | Expected |
|---|---|
| `/person/graph?$top=20&$skip=20&$fields=teams&$orderby=id asc` | count 222, 20 rows, ids 83–102 |
| p6spy log for that request | `offset 20 rows fetch first 20 rows only` present |
| `HHH90003004` occurrences | 0 |
| `/person/graph?$skip=20&$fields=teams` (no `$top`) | 202 rows, matching `/person?$skip=20` |
| `/person/graph?$top=10&$skip=50&$fields=teams` (no `$orderby`) | same id order as `/person?$top=10&$skip=50` |
| `/person/graph?$top=20&$skip=1000&$fields=teams` | 0 rows, second query not issued |
| `/person/graph` with `$filter=teams/any(x: x/id in (1425,1432))` | count 2, ids 30 & 31, teams populated |
| `/team/graph?$top=5&$skip=10&$fields=leader` | 1 query, unchanged from today |
| teams payload vs `/person/graph/{id}` (untouched `readById`) | identical membership |

Full suite: `mvnw test` — persistence 14, service 22, web 5.

## Risks

**Generic-bound change ripples.** `MODEL extends WithId` touches the base class
all seven repositories extend. Mitigated by it being compile-time only: `mvnw
test` either builds or it does not.

**MapStruct corruption trap.** Per `maven-fork-mapper-corruption`, a build can
emit `*MapperImpl` without `implements` while reporting BUILD SUCCESS. This
change touches no mapper, but the verification step is cheap: `javap -v
…PersonMapperImpl | grep interfaces` must report `interfaces: 1`.

**Metamodel access outside a transaction.** `entityManager.getMetamodel()` is
static mapping metadata, not session state, so it is safe on the shared
`@PersistenceContext` proxy without an active transaction. The gate runs before
any query is built.
