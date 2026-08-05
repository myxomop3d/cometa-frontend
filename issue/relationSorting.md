# Relation sorting and related OData hazards on `/team` and `/person`

## Status

Leader sorting has been turned off (`enableSorting: false` on the Team `leader`
column; `sortField: "leader.lastName"` removed from both the descriptor and
`teamFieldByColumnId`). This document records why, plus every other
relation/enum-related OData hazard uncovered while investigating it, for a
future session to act on.

Separately, a scoped re-review found and fixed the actual root cause of the
Leader column rendering empty on every row: Team's list queries were hitting
the wrong endpoint (`/api/v1/team` instead of `/api/v1/team/graph`) with the
wrong parameter name (`fields` instead of `$fields`), so the backend's
entity-graph eager-fetch never applied. See finding 7.

**Update, 2026-08-05 — live-backend verification pass.** A verification pass
against a running backend has since settled two of this document's open
items: finding 5 (enum-typed filter) now verified working, and finding 7 (the
`/graph` + `$fields` repoint) now verified working end-to-end, including the
detail that `/graph` without `$fields` still yields `leader: null`. It also
surfaced a real, previously-undocumented gotcha — write responses (`POST`/
`PATCH`) return a stale `leaderId`/`leader` — recorded as finding 8. Finding 3
(nested-sort hazards) remains genuinely unverified; leader sorting is
disabled, so nested sorting was never attempted. Full transcript:
`.superpowers/sdd/2026-08-05-team-person-table-pages/task-11-verification-report.md`.

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

Findings 1, 2, 4, 6, and 7 are fully verified this way, cross-checked against
what actually ships in the frontend and backend repos. Finding 7 has
additionally been verified against a running server (2026-08-05, see its
section). Finding 5 was originally source-read-only and flagged unverified;
it has since been verified against a running server too (2026-08-05, see its
section) — the source reading correctly identified the missing switch
branch, but the live behavior contradicts the prediction built on it: the
filter works. Finding 3 remains **not** verified against a running server —
see its section. (Finding 3a's original text mis-stated the mechanism
populating `fetchTablesSet`; it has since been corrected in place — the
correction itself is source-verified, the underlying live-server caution in
finding 3 still stands.)

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
anyone relies on nested sorting, even via the `@ODataMapping` alias. This is
the one item in this document still open** — a 2026-08-05 live-backend
verification pass resolved findings 5 (enum filter) and 7 (graph endpoint
repoint), both below, but never exercised nested sorting: leader sorting is
disabled (see Status at the top of this document), so there was no live
`$orderby=leader.lastName`-shaped request to observe. A future session
picking this up should treat findings 5 and 7 as closed and start here.

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

**Correction (previously this section claimed `fetchTablesSet` came from
`?fields=` — that was wrong and has been rewritten below):**

`fetchTablesSet` is **not** populated from any query parameter, and
`ODataParams` doesn't even have a `fields` constructor argument to populate
it from. Its `@Builder` constructor
(`ru.sber.cs.core.odata.mini.repo.odata.ODataParams`, odata-mini 2.0.3) takes
`modelClass, dtoClass, skip, top, filter, orderby, parentIdMap` — no
`fields` — and builds the set purely from annotations on `dtoClass`:

```java
var oDataMappings = !ObjectUtils.isEmpty(dtoClass)
        && dtoClass.isAnnotationPresent(ODataMappings.class)
        ? dtoClass.getAnnotation(ODataMappings.class)
        : null;

this.fetchTablesSet = ObjectUtils.isEmpty(oDataMappings)
        ? new HashSet<>()
        : Arrays.stream(oDataMappings.value())
        .map(value -> {
            String[] split = value.entityField().split("\\.");
            return split.length > 0 ? split[0] : "";
        })
        .collect(Collectors.toSet());
```

`oDataMappings.value()` is the array of `@ODataMapping` entries inside the
repeatable container `@ODataMappings` — so `fetchTablesSet` is built solely
by reading `@ODataMapping(entityField = ...)` declarations on the DTO class
and taking the first `.`-segment of each `entityField()`. `TeamDto`
currently carries zero `@ODataMapping` annotations (see finding 2), so
`fetchTablesSet` is the empty set on every request `/team` (or `/team/graph`)
receives today — the `getQuery().oDataParams.getFetchTablesSet().forEach(root::fetch)`
line is presently a no-op for Team, and always has been; no query parameter
of any name feeds it.

The actual mechanism that eager-loads `leader` for display is a completely
separate code path: the graph-aware `GET /api/v1/team/graph` endpoint
(`ODataEntityGraphReadApi`/`EntityGraphBaseCrudController`, see the new
finding below) applies a JPA `EntityGraph` keyed off its own `$fields`
request parameter, independent of `ODataParams`/`fetchTablesSet` entirely.
So on today's actual list route (`/team/graph`), there is no fetch-join
contention between `$orderby` and `$fields` — `fetchTablesSet` never
contributes a fetch for Team regardless. If a future `@ODataMapping` alias is
added to `TeamDto` for nested sorting (finding 2's sanctioned spelling), and
its `entityField()` happens to name the same association the entity-graph
`$fields` also loads, *that* combination — `@ODataMapping`-driven
`fetchTablesSet` fetch vs. entity-graph fetch, both against the same root —
is the one that would need checking for a duplicate/conflicting fetch. It
remains untested either way.

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

## 5. Enum-typed columns — verified working against a live backend, 2026-08-05

**Status: verified. `$filter=type eq 'CHANGE'` and `$filter=type eq 'RUN'`
both work correctly against a running backend, with counts matching the
database exactly. No workaround is needed — the `typeName` scalar proposed
below was not built.**

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

There is no `enum` (or specific `TeamType`) branch, so the code reads as
though any Java `enum`-typed JPA attribute must hit the `default` branch and
throw `ConflictException`. **It does not, in practice — see the live result
below.** The observation about the missing branch is still accurate and kept
here because it may matter for a differently-configured enum (e.g. plain
`@Enumerated` without `EnumType.STRING`, or `EnumType.ORDINAL`) or a different
operator than `eq` — if a future enum filter *does* fail, this switch is
where to look first.

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
enums. There was no existing precedent in this codebase for filtering a
`@Enumerated(EnumType.STRING)` attribute through this library, so before
live verification it was not known whether `Expression.getJavaType()` for
such an attribute resolves to the enum class (hitting the unhandled
`default` branch and throwing) or to `String` (works fine).

**Live verification (2026-08-05,
`.superpowers/sdd/2026-08-05-team-person-table-pages/task-11-verification-report.md`,
Check 4):**

```
GET /api/v1/team?$top=20&$filter=type eq 'CHANGE'  →  count: 85
GET /api/v1/team?$top=20&$filter=type eq 'RUN'     →  count: 26
```

Both matched `SELECT type, count(*) FROM gmsb.team GROUP BY type` exactly
(`CHANGE: 85`, `RUN: 26`), and `85 + 26 = 111` accounts for every row in the
table — no rows silently dropped or miscounted. No 500s, no
`ConflictException`, for either of `TeamType`'s two values.

**The prediction was wrong, and the mechanism was not determined.** Whether
`Expression.getJavaType()` reports `String` for a
`@Enumerated(EnumType.STRING)` attribute at the JPA Criteria level, or some
other path bypasses `getTypedPredicate` entirely, was not traced through
Hibernate's own source as part of this investigation. Do not invent an
explanation beyond what was observed — record it as verified-working with
the mechanism undetermined.

**No workaround needed.** The `typeName` read-only-scalar mirror of finding
1 that was proposed here as a fallback was not built and is not needed — the
existing enum column filters correctly as-is. `$filter=type eq 'CHANGE'` on
`/team` works today, verified against a live backend, not merely against the
codebase's own mock.

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

## 7. The Leader column was empty because Team's list queries hit the wrong endpoint and parameter (resolved — this was the actual root cause)

**Status: verified in source, and this was the actual, confirmed root cause
of the Leader column rendering "—" for every row. Fixed by repointing
Team's list queries — see below. Additionally verified against a running
backend on 2026-08-05 — see "Live verification" at the end of this
section.**

The design assumed sending `?fields=leader` to the plain `GET /api/v1/team`
route would make the backend eager-load the `leader` relation. It does not,
for two independent reasons, both readable directly in
`ru.sberbank.cib.gmbus.web.api.v1` in the backend repo:

- **Wrong route.** `ODataEntityGraphReadApi` declares its graph-aware
  `getAll`/`get` under `@GetMapping({"graph"})` / `@GetMapping({"graph/{id}"})`
  — i.e. `GET /api/v1/<resource>/graph` and `GET /api/v1/<resource>/graph/{id}`,
  not the base resource path. `GET /api/v1/team` never runs this code at
  all.
- **Wrong parameter name.** Even on the correct route, the parameter is
  declared `@RequestParam(value = "$fields", required = false) String fields`
  — the wire name is `$fields`, not `fields`.

```java
// ODataEntityGraphReadApi.java
@GetMapping({"graph"})
...
default ResponseEntity<ResultObj<List<DTO>>> getAll(
        @RequestParam(value = "$skip", defaultValue = "0", required = false) Integer skip,
        @RequestParam(value = "$top", defaultValue = "0", required = false) Integer top,
        @RequestParam(value = "$filter", required = false) String filter,
        @RequestParam(value = "$orderby", required = false) String orderby,
        @RequestParam(value = "$fields", required = false) String fields) {
    ResultObj<List<DTO>> resultObj = new ResultObj();
    resultObj.addMessages(new AppMessage[]{AppMessage.error("Операция не поддерживается")});
    return ResponseFactory.create(HttpStatus.OK, resultObj);
}
```

That default body — "Операция не поддерживается" ("operation not
supported") — is exactly what runs for any controller that implements
`ODataEntityGraphReadApi` without overriding it. `EntityGraphBaseCrudController`
is the one class that does override both methods for real, delegating to
`service.getAll(skip, top, filter, orderby, fields)`:

```java
// EntityGraphBaseCrudController.java
public ResponseEntity<ResultObj<List<DTO>>> getAll(Integer skip, Integer top, String filter, String orderby, String fields) {
    return ResponseFactory.create(HttpStatus.OK, this.service.getAll(skip, top, filter, orderby, fields));
}
```

So whether `/<resource>/graph` actually *works* (functional entity graph) or
silently returns the "not supported" message depends entirely on whether
that resource's controller extends `EntityGraphBaseCrudController`. As of
this writing, the controllers that do are: `TeamRestController`,
`PersonRestController`, `NodeRestController`, `FlowRestController`,
`LinkRestController`, and `AutomatedSystemRestController` (all in
`cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/`). No
other controller in that package implements `ODataEntityGraphReadApi` at
all — e.g. `TopicRestController` declares its own plain `$fields`-taking
`getAll`/`get` outside this interface entirely, so it isn't affected by
either branch of this finding, and `Box`/`Item`/`Thing`-style resources have
no `/graph` route to call in the first place.

**The failure was silent, not an error.** `TeamMapper` guards the nested
`leader` mapping with `@Condition isEntityLoaded(Person)`. When the graph
never applies — whether because the request hit `/team` instead of
`/team/graph`, or sent `fields` instead of `$fields` — `team.getLeader()`
stays an uninitialized Hibernate proxy, the condition excludes it, and the
mapper emits `leader: null`. No exception, no 4xx, no N+1 query storm to
notice in logs — the response looks completely well-formed, just with an
empty relation. The Leader column rendered "—" for every row precisely
because of this: it looked exactly like "the backend just doesn't have this
data," not "the frontend called the wrong endpoint." Any future DTO that
adds a nested relation gated the same way will hit this identically, and
will be just as easy to misdiagnose.

**Fix applied:** `src/features/team/api.ts` now gives the list operations
(`fetchList`/`fetchDataTable`, via a new `listPath` option on
`createCrudApi`) `/api/v1/team/graph` while `create`/`patch`/`fetchOne`/
`remove` keep using `basePath: "/api/v1/team"` (the `/graph` route is
read-only). `staticParams` changed from `{ fields: "leader" }` to
`{ "$fields": "leader" }`. `src/features/team/advanced-api.ts` changed its
URL from `/api/v1/team?...` to `/api/v1/team/graph?...` and
`searchParams.set("fields", "leader")` to `searchParams.set("$fields",
"leader")`. `comboboxQueryOptions` and `detailQueryOptions` in
`src/features/team/api.ts` are intentionally untouched — they serve the
user-registration flow, never needed the leader relation, and keep hitting
the plain `/api/v1/team` / `/api/v1/team/{id}` routes. The leader filter
(`field: "leaderId"`, flat scalar, finding 1) and leader sorting
(disabled, finding 2/4) are unrelated to this fix and were left alone.

**Live verification (2026-08-05,
`.superpowers/sdd/2026-08-05-team-person-table-pages/task-11-verification-report.md`,
Check 2):**

```
GET /api/v1/team/graph?$top=5&$fields=leader   →  leader populated on all 5 rows
GET /api/v1/team?$top=5                        →  leader: null on every row, leaderId populated
GET /api/v1/team/graph?$top=5   (no $fields)   →  leader: null on every row
```

All five sampled rows on `/team/graph?$fields=leader` returned a fully
populated nested `leader` object (`id`, `email`, `firstName`, `lastName`,
`middleName`), matching the corresponding `leaderId`. The plain `/team`
route confirmed the flat-scalar half still works independently (`leaderId`
populated, `leader: null`, exactly as designed). The additional check —
`/team/graph` **without** `$fields=leader` — also returned `leader: null` on
every row. **Both halves of the fix are required together**: the `/graph`
sub-path alone does not trigger the entity-graph fetch, and (per the fix
above) neither does `$fields` against the plain `/team` route — only
`/team/graph` *combined with* `$fields=leader` populates the relation.

---

## 8. Write responses (`POST`/`PATCH`) return a stale `leaderId`/`leader` — verified, not a bug

**Status: verified against a running backend, 2026-08-05. Recorded here
because, without this note, it reads exactly like a bug to the next person
who calls these endpoints directly.**

`Team.leaderId` is `insertable = false, updatable = false` (finding 1).
Hibernate does not re-read a column mapped that way within the same
persistence context after a write — so the DTO serialized into the same HTTP
response as a `POST` or `PATCH` reflects the *pre-write* state of that field,
not the value that was just written, even though the database itself was
updated correctly.

Observed
(`.superpowers/sdd/2026-08-05-team-person-table-pages/task-11-verification-report.md`,
Check 1):

- `POST /api/v1/team` with `leaderId: 30` in the request body returned
  `"leaderId":null,"leader":null` in the response — while a direct SQL check
  immediately after confirmed `leader_person_id = 30` was persisted
  correctly.
- `PATCH /api/v1/team/{id}` with `{"leaderId":31}` (moving the leader from
  30 to 31) returned `"leaderId":30` (the pre-PATCH value) in the response —
  while a direct SQL check immediately after confirmed `leader_person_id`
  had moved to `31`.

Both are read-your-writes gaps in the response body only, not in what got
persisted. This is exactly what the mapping (`insertable = false, updatable
= false`) predicts, and it is not a defect — it is documented here so it
does not need rediscovering.

**Consequence for callers.** Never treat `leaderId`/`leader` in a `POST`/
`PATCH` response body as confirmation of what was written. Re-fetch instead:
a plain `GET` for the flat `leaderId`, or `GET .../graph?$fields=leader` for
the nested object (finding 7). The frontend's own mutation flow already does
this — it invalidates and refetches the list/detail query on a successful
save — so this does not affect `/team` as shipped. It matters for anyone
calling the API directly (scripts, manual testing, a future integration)
who might otherwise read a stale response field as "the write didn't take."

---

## What a future session needs to decide

Updated 2026-08-05 after a live-backend verification pass resolved findings
5 and 7. In priority order, distinguishing what's still open (needs a
running backend) from what's already settled:

1. **[Unverified, needs a running server before relying on it — the one
   open item]** Finding 3's two nested-sort hazards (possible duplicate
   fetch join; possible duplicate/erroring order-map entries) were never
   exercised — leader sorting is disabled by decision, so no live
   `$orderby=leader.lastName`/`leaderLastName`-shaped request was ever sent.
   Needed only if/when item 2 below is acted on.

2. **[Verified mechanism, product decision]** Decide whether leader sorting
   should ever come back, and if so how:
   - Cheapest, immediately available: `sortField: "leaderId"` (FK id order,
     not alphabetical by name, but join-free and closes the stale-URL hole
     in finding 4).
   - Correct-but-unverified: `@ODataMapping(dtoField="leaderLastName",
     entityField="leader.lastName")` on `TeamDto` + `sortField:
     "leaderLastName"` — but only after finding 3's two hazards (item 1
     above) are exercised against a running server against `/team/graph`
     with `$fields=leader&$orderby=leaderLastName asc` together (both the
     entity-graph fetch and the `@ODataMapping`-driven order-by fetch would
     be live at once on that route).

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

5. **[Already resolved, no action]** Finding 5 (enum-typed `type` filter) —
   verified working against a live backend 2026-08-05 (counts 85/26 matched
   the DB exactly for `CHANGE`/`RUN`). No `typeName` workaround needed; the
   missing switch branch remains a place to look if a *different* enum
   filter ever fails, but `Team.type` itself is fine as shipped.

6. **[Already resolved, no action]** Finding 7 (wrong list endpoint/param) —
   done, Team's list queries repointed at `/api/v1/team/graph` with
   `$fields=leader`, and verified against a live backend 2026-08-05
   (including the detail that `/graph` without `$fields` still returns
   `leader: null`). This was the actual cause of the empty Leader column;
   findings 2–4 (sorting) remain separately disabled per this document's
   `Status` section.

7. **[Documented behavior, no action needed]** Finding 8 (stale
   `leaderId`/`leader` in `POST`/`PATCH` response bodies) — verified
   2026-08-05, expected given the `insertable=false, updatable=false`
   mapping, not a bug. Recorded so it doesn't get mistaken for one by a
   future direct API caller.
