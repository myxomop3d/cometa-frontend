# Relation sorting and related OData hazards on `/team` and `/person`

## Status

Leader sorting has been turned off (`enableSorting: false` on the Team `leader`
column; `sortField: "leader.lastName"` removed from both the descriptor and
`teamFieldByColumnId`). This document records why, plus every other
relation/enum-related OData hazard uncovered while investigating it, for a
future session to act on.

## How these findings were established

All findings below come from reading the actual library source shipped in the
local Maven repository, not from inference or documentation. The library jars
under `~/.m2/repository/ru/sber/cs/core/odata/` embed their `.java` sources
directly inside the class jar (no separate `-sources.jar` needed — e.g.
`odata-mini-filter-sort-2.0.3.jar` contains
`ru/sber/cs/core/odata/mini/repo/odata/filter/ODataFilterHelper.java` etc.
alongside the `.class` files). The version used is pinned by
`F:\programming\cometa\pom.xml` (`<odata-mini-repo.version>2.0.3</odata-mini-repo.version>`),
which pulls the matching `odata-mini-filter-sort:2.0.3`.

Every class and method name cited below was read directly out of that jar.
To re-verify, unzip the jar and read the `.java` file at the path given:

```
unzip odata-mini-filter-sort-2.0.3.jar -d out
# then read out/ru/sber/cs/core/odata/mini/repo/...
```

Findings 1, 2, 4, and 6 are fully verified this way, cross-checked against
what actually ships in the frontend and backend repos. Findings 3 and 5 are
explicitly **not** verified against a running server — see each section.

---

## 1. Nested-path `$filter` cannot work (resolved — this is the precedent)

**Status: fixed, already shipped.** Recorded here because it is the pattern
the other findings should follow.

`ODataFilterHelper.getPathExpression(Root<?> root, Object pathObject)`
(`ru.sber.cs.core.odata.mini.repo.odata.filter.ODataFilterHelper`) does:

```java
private Expression<String> getPathExpression(Root<?> root, Object pathObject) {
    var path = odataChecker.getEntityFieldName((String) pathObject);
    if (path.contains(".")) {
        var parts = path.split("\\.");
        root.fetch(parts[0]);
        return root.get(parts[0]).get(parts[1]);
    } else {
        return root.get(path);
    }
}
```

Any dotted path unconditionally calls `root.fetch(parts[0])` — a fetch join.

`ODataCriteriaService` (`ru.sber.cs.core.odata.mini.repo.odata.ODataCriteriaService`)
builds a **second**, independent root for the count query and re-applies the
same where-predicate to it:

```java
private CriteriaQuery<Long> createCountQuery(Class<T> modelClass) {
    var cr = criteriaBuilder.createQuery(Long.class);
    var from = cr.from(modelClass);
    cr.select(criteriaBuilder.count(from));
    cr.where(oDataParams.getODataFilter().getWherePredicate(criteriaBuilder, from));
    return cr;
}
```

Because the where-predicate was built against the *main* root but contains an
`Expression` obtained via `from.fetch(...)` semantics baked into the dotted
path, a `SELECT COUNT(...)` query ends up with a fetch join in it, which
Hibernate rejects at query-compile time.

**Consequence already shipped:** the `relation` filter variant
(`src/lib/odata/build-filter-params.ts`, `src/lib/odata/build-advanced-filter-params.ts`)
emits a flat `field eq N` instead of a navigation-path `field/id eq N`
(see git commit `4d89367 fix(odata): relation filters emit a flat scalar
instead of a nav path`, and `dc2f6d0 refactor(box): filter relations by flat
itemId/oldItemId scalars`). To make that possible, `Team` gained a
read-only scalar column:

```java
// cometa-persistence-module/.../entity/auth/Team.java
@Column(name = "leader_person_id", insertable = false, updatable = false)
private Long leaderId;
```

filtered via `field: "leaderId"` in `src/features/team/filter-descriptors.ts`
and `src/features/team/advanced-api.ts`. This works and is unaffected by
today's change — **do not touch the leader filter.**

---

## 2. Nested-path `$orderby` fails earlier still — at field validation

**Status: this is why leader sorting is now off.**

`ODataOrderby`'s constructor (`ru.sber.cs.core.odata.mini.repo.odata.orderby.ODataOrderby`)
calls `prepareOrderby()`:

```java
@Builder
public ODataOrderby(Class<?> modelClass, Class<?> dtoClass, String orderby) {
    ...
    this.odataJpql = new OData2Jpql(modelClass, dtoClass);
    this.orderbyRequest = orderby;
    this.orderbyJpql = prepareOrderby();
}

private String prepareOrderby() {
    if (orderbyRequest == null || orderbyRequest.isBlank()) {
        return "";
    }
    return odataJpql.parseOrderByConditions(orderbyRequest, modelClass.getSimpleName(), null);
}
```

`OData2Jpql.parseOrderByConditions` (`ru.sber.cs.core.odata.mini.repo.odata.OData2Jpql`)
validates fields **before** any parsing of the navigation path:

```java
public String parseOrderByConditions(String orderby, String bindVariable, Map<String, String> aliases) {
    if (orderby == null) {
        return null;
    }
    checkFields(getFieldsByOrderby(orderby));
    ...
}
```

`checkFields` delegates to `ODataChecker.checkFields(Set<String>)`
(`ru.sber.cs.core.odata.mini.repo.odata.ODataChecker`):

```java
public void checkFields(Set<String> fields) {
    if (fields == null || fields.isEmpty()) {
        return;
    }
    for (String field : fields) {
        if (!modelFieldNames.contains(field) && !dtoFieldNames.containsKey(field)) {
            throw new FieldNotFoundException("field '" + field + "' doesn't exist");
        }
    }
}
```

`modelFieldNames` comes from `getAllFields(Class<?> clazz)`, which walks the
class hierarchy via `getDeclaredFields()` / `getSuperclass()` and collects
**flat field names only** — it never expands or accepts dotted paths.
`dtoFieldNames` is populated only from `@ODataMapping(dtoField=…,
entityField=…)` annotations on the DTO class:

```java
public ODataChecker(Class<?> modelClass, Class<?> dtoClass) {
    this.oDataMappings = (dtoClass == null) ? null : dtoClass.getAnnotationsByType(ODataMapping.class);
    this.modelFieldNames = getAllFields(modelClass).stream()
            .map(Member::getName)
            .collect(Collectors.toSet());
    this.dtoFieldNames = getDtoFieldNames();
}
```

`"leader.lastName"` is neither a flat field name on `Team` nor a registered
DTO alias, so `checkFields` throws `FieldNotFoundException` before the parse
tree is even walked. This is a harder failure than finding 1: filtering at
least reaches Hibernate before dying; sorting never gets that far.

Confirmed there are currently **zero** `@ODataMapping` usages anywhere in the
backend repo (`F:\programming\cometa`) — grepping the whole tree for
`ODataMapping` returns no matches outside the library itself.

The dot-splitting logic in `ODataOrderbyHelper.getPathExpression` (see
finding 3) exists to expand a *registered alias* (an `@ODataMapping`-declared
`dtoField`) whose `entityField` value happens to contain a dot — into a nav
path at the JPA Criteria level, once `checkFields` has already let it
through. It is not a general "any dotted path works" facility; the alias has
to be declared first.

**The sanctioned spelling**, when someone wants this to work, is:

```java
@ODataMapping(dtoField = "leaderLastName", entityField = "leader.lastName")
// on TeamDto
```

filtered/sorted via `$orderby=leaderLastName asc`. This still leaves finding
3's hazards unaddressed.

---

## 3. Two further hazards the alias approach does NOT remove — unverified

**Status: not verified against a running server. Needs a live backend before
anyone relies on nested sorting, even via the `@ODataMapping` alias.**

**a) Possible duplicate fetch join.** `ODataOrderby.getOrderList` runs
inside the `ODataCriteriaService` constructor:

```java
public ODataCriteriaService(EntityManager entityManager, Class<T> modelClass, ODataParams oDataParams) {
    ...
    this.wherePredicate = oDataParams.getODataFilter().getWherePredicate(criteriaBuilder, root);
    this.orderbyList = oDataParams.getODataOrderby().getOrderList(criteriaBuilder, root);
    this.criteriaCountQuery = createCountQuery(modelClass);
}
```

and `getOrderList` → `OData2Jpql.mapParseTreeToOrder` →
`ODataOrderbyHelper.parseTreeToOrderList` → `getPathExpression`, which for a
dotted alias calls `root.fetch(parts[0])` on the **main** root — the same
root used elsewhere. Separately, `getQuery()` does:

```java
public TypedQuery<T> getQuery() {
    oDataParams.getFetchTablesSet().forEach(root::fetch);
    ...
}
```

`fetchTablesSet` is populated from the `?fields=` query parameter (the Team
API already sends `fields=leader` to eagerly load the leader relation for
display — see `searchParams.set("fields", "leader")` in
`src/features/team/advanced-api.ts`). A request carrying both `?fields=leader`
and an `$orderby` over an aliased `leader.lastName` path would therefore call
`root.fetch("leader")` twice on the same root — once from the orderby helper,
once from `getFetchTablesSet().forEach`. Whether JPA/Hibernate tolerates a
duplicate `fetch()` call on the same association (dedup, silently ignore, or
error/duplicate join in generated SQL) has not been tested.

**b) Possible duplicate order entries.** `ODataOrderbyHelper.parseTreeWalk`
(`ru.sber.cs.core.odata.mini.repo.odata.orderby.ODataOrderbyHelper`) is a
post-order recursive walk:

```java
private void parseTreeWalk(ParseTree tree, CriteriaBuilder cb, Root<?> root) {
    for (int i = 0; i < tree.getChildCount(); ++i) {
        parseTreeWalk(tree.getChild(i), cb, root);
    }
    if (tree.getClass().equals(ODataParserParser.EntityColNavigationPropertyContext.class)) {
        orderMap.put(getPathExpression(root, tree.getText()), Trend.ASC);
    }
    if (tree.getClass().equals(ODataParserParser.OrderbyTrendContext.class)) {
        orderMap.put(
                orderMap.entrySet().stream().skip(orderMap.size() - 1L).findFirst().get().getKey(),
                "asc".equals(tree.getText()) ? Trend.ASC : Trend.DESC
        );
    }
}
```

It `put`s one entry into `orderMap` for every matching grammar node
encountered during the walk. Whether the ANTLR grammar produces exactly one
`EntityColNavigationPropertyContext` node for a two-segment alias path like
`leader.lastName`, or more than one (which would register two order entries
instead of one, and could throw on the `OrderbyTrendContext` branch's
`.findFirst().get()` if the map is empty at the wrong point), has not been
traced through the generated parser. Needs a running server test.

---

## 4. Turning leader sorting off leaves a stale-URL hole (accepted, recorded)

`enableSorting: false` on the `leader` column
(`src/features/team/columns.tsx`) stops the table UI from ever generating a
`sort=leader.asc` URL param going forward. It does **not** protect against a
URL a user already bookmarked or shared before this change.

Both param builders fall back to the raw column id when no `sortField` is
configured for that column:

```ts
// src/lib/odata/build-filter-params.ts
const orderby = sort.split(",").map((part) => {
  const [f, dir] = part.split(".");
  const desc = byId.get(f);
  return `${desc?.sortField ?? f} ${dir}`;
}).join(",");
```

```ts
// src/lib/odata/build-advanced-filter-params.ts
const orderby = sort.split(",").map((part) => {
  const [f, dir] = part.split(".");
  const entry = fieldByColumnId[f];
  return `${entry?.sortField ?? f} ${dir}`;
}).join(",");
```

A stale `?sort=leader.asc` URL still reaches the API as `$orderby=leader asc`.
Because `Team.leader` (`cometa-persistence-module/.../entity/auth/Team.java`)
is a real `@ManyToOne` field on the entity:

```java
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "leader_person_id", nullable = false)
private Person leader;
```

`modelFieldNames.contains("leader")` is true, so `ODataChecker.checkFields`
**passes** — the request is not rejected at validation. It proceeds to
`root.get("leader")`, ordering by the association itself. At best this
orders by the underlying FK id (harmless but meaningless as "leader
sorting"); at worst, depending on how Hibernate resolves `ORDER BY` over an
entity-typed path, it errors. This has not been tested either way.

**Future option, not applied here:** set `sortField: "leaderId"` instead of
leaving `sortField` unset. `leaderId` is the existing read-only flat scalar
column from finding 1 — join-free, count-query-safe, and immune to this
stale-URL hole because it resolves to a real scalar field regardless of
whether the UI still offers leader sorting. This was considered but not
applied in this change; the human partner's decision was to disable sorting
outright and leave this as a documented option for later.

---

## 5. Enum-typed columns may not be filterable at all — unverified, affects a shipped page

**Status: unverified, and unlike findings 2–4 this affects functionality
already merged and live on `/team`.**

`ODataFilterHelper`'s literal-coercion logic
(`addInValue` and `convertArgument`, and the dispatch in `getTypedPredicate`)
switches on `Expression.getJavaType().getSimpleName()`:

```java
private Predicate getTypedPredicate(CriteriaBuilder cb, Map<ExpressionPart, Object> expressionMap) {
    ...
    return switch (path.getJavaType().getSimpleName()) {
        case "Byte", "Short", "Long", "Integer", "Double", "Float", "BigDecimal", "BigInteger" ->
                getNumberPredicate(cb, expressionMap);
        case "String" -> getStringPredicate(cb, expressionMap);
        case "UUID" -> getUuidPredicate(cb, expressionMap);
        case "LocalDateTime" -> getLocalDateTimePredicate(cb, expressionMap);
        case "OffsetDateTime" -> getOffsetDateTimePredicate(cb, expressionMap);
        case "ZonedDateTime" -> getZonedDateTimePredicate(cb, expressionMap);
        case "LocalDate" -> getLocalDatePredicate(cb, expressionMap);
        case "LocalTime", "Time" -> getLocalTimePredicate(cb, expressionMap);
        case "Date" -> getLocalDatePredicate(cb, expressionMap);
        case "Boolean" -> getBooleanPredicate(cb, expressionMap);
        default ->
                throw new ConflictException("Обработка типа не реализована: " + path.getJavaType().getSimpleName());
    };
}
```

There is no `enum` (or specific `TeamType`) branch. Any Java `enum`-typed
JPA attribute hits the `default` branch and throws `ConflictException`.

`Team.type` is:

```java
@Enumerated(EnumType.STRING)
@Column(name = "type")
private TeamType type;
```

and `/team` ships a `select`-variant filter directly on it
(`{ id: "type", variant: "select", filterKey: "type" }` in
`src/features/team/filter-descriptors.ts`; `type: { field: "type", variant:
"select" }` in `src/features/team/advanced-api.ts`; the `type` column in
`src/features/team/columns.tsx` renders `select` with `CHANGE`/`RUN`
options).

Every other `select`-variant filter currently in the codebase targets a
plain `String` column — `flow.integrity`, `flow.confidentiality`,
`flow.dataClass` (`src/features/flow/filter-descriptors.ts` /
`src/features/flow/advanced-api.ts`) are all `String` fields, not JPA
enums. There is no existing precedent in this codebase for filtering a
`@Enumerated(EnumType.STRING)` attribute through this library, so it is not
known whether `Expression.getJavaType()` for such an attribute resolves to
the enum class (hitting the unhandled `default` branch and throwing) or to
`String` (works fine) — that depends on how Hibernate's Criteria API reports
the Java type for `@Enumerated(EnumType.STRING)` fields, which was not
traced through Hibernate's own source as part of this investigation.

**If it fails**, the mirror of finding 1's fix applies: add a read-only
scalar column,

```java
@Column(name = "type", insertable = false, updatable = false)
private String typeName;
```

on `Team`, and repoint the descriptor at `field: "typeName"`.

**This is the one finding in this document that affects functionality
already merged and shipped** — `$filter=type eq 'CHANGE'` on `/team` may
currently be broken in production-equivalent conditions. It needs to be
exercised against a running backend to know either way.

---

## 6. Collection navigation (`multiRelation`) is unsupported server-side

**Status: verified in source; currently unreachable in practice, but will
become reachable the moment `/person` gets a `teams` filter.**

The shared `multiRelation` filter variant (`src/lib/odata/build-filter-params.ts`,
`src/lib/odata/build-advanced-filter-params.ts`) emits an OData `any()`
lambda:

```ts
case "multiRelation": {
  const relIds = value as number[] | undefined;
  if (relIds && relIds.length > 0) {
    const idList = relIds.map(Number).join(",");
    clauses.push(`${field}/any(x: x/id in (${idList}))`);
  }
  break;
}
```

`ODataFilterHelper.visitFilterInstance`
(`ru.sber.cs.core.odata.mini.repo.odata.filter.ODataFilterHelper`) explicitly
rejects this:

```java
if (ctx.anyClause() != null || ctx.allClause() != null) {
    throw new ConflictException("Операторы any/all пока не поддерживаются");
}
```

("any/all operators are not yet supported"). It is a hard, unconditional
throw — there is no partial support.

Today this is unreachable in practice: the only current consumer of the
`multiRelation` variant is the Box feature (`src/features/box/*`), which is
MSW-mock-only and never hits the real backend, per `grep` across
`src/features` — `multiRelation` appears only in
`build-advanced-filter-params.ts`, `build-filter-params.ts`, and the `box`
feature's own files.

The first *real* collection relation is the obvious next candidate:
`Person.teams`, defined as

```java
// cometa-persistence-module/.../entity/auth/Person.java
@ManyToMany(fetch = FetchType.LAZY)
private Set<Team> teams;
```

But `PersonDto` (`cometa-service-module/.../service/dto/PersonDto.java`)
currently does not expose `teams` at all — it has only `email`, `lastName`,
`firstName`, `middleName`. So there is no live bug today; this is a landmine
for whoever adds a "filter people by team" feature and assumes
`multiRelation` will just work because it does in the Box mock.

---

## What a future session needs to decide

In priority order, distinguishing what's verified (safe to act on directly)
from what needs a running backend first:

1. **[Unverified, affects shipped code — verify first]** Does
   `$filter=type eq 'CHANGE'` actually work against `Team.type`
   (`@Enumerated(EnumType.STRING)`) today? Hit the running `/team` API with a
   type filter and check for a `ConflictException` / 500. If it fails, ship
   the `typeName` read-only-column mirror of finding 1.

2. **[Verified mechanism, product decision]** Decide whether leader sorting
   should ever come back, and if so how:
   - Cheapest, immediately available: `sortField: "leaderId"` (FK id order,
     not alphabetical by name, but join-free and closes the stale-URL hole
     in finding 4).
   - Correct-but-unverified: `@ODataMapping(dtoField="leaderLastName",
     entityField="leader.lastName")` on `TeamDto` + `sortField:
     "leaderLastName"` — but only after finding 3's two hazards (duplicate
     fetch, duplicate/erroring order-map entries) are exercised against a
     running server with `?fields=leader&$orderby=leaderLastName asc`
     together.

3. **[Unverified, no live consumer yet — verify before building on it]**
   Before adding any `multiRelation` filter against a real backend
   (e.g. "people by team"), confirm finding 6 by hitting any real
   `any()`-based filter against the running API and confirming the
   `ConflictException`. Then decide: expose `Person.teams` on `PersonDto`
   only once there's a supported server-side path, e.g. a dedicated junction
   filter/endpoint, since `any()` itself is a dead end.

4. **[Already resolved, no action]** Finding 1 (nested `$filter`) — done,
   flat `leaderId` scalar shipped and working. Listed here only as the
   precedent the above should follow.
