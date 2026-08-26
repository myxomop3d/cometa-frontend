# Relation filtering and sorting on `/team` and `/person`

**Full design record (read this first):**
`docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`.
This document is the narrower issue-log companion: it retains the three
findings from an earlier investigation that were verified live and remain
true, folds in everything the design's live-verification pass settled, and
points at the design doc for anything not repeated here.

**Related:** `issue/personTeamsInMemoryPagination.md` — the to-many
*display*-column limitation (Person's Teams column). The **filter**
(`teams/any(x: x/id in (…))`) is unaffected by that issue and works today.

## Status (rewritten 2026-08-26)

Cometa uses `BaseCrudRepository`'s JPQL-string path
(`TeamCrudRepository` → `EntityGraphBaseCrudRepository` →
`BaseCrudRepository`, assembling a JPQL string from `ODataFilter.getWhereJpql()`
and `ODataOrderby.getOrderbyJpql()`). `ODataCriteriaService` — the JPA
Criteria API builder that a much earlier version of this document reasoned
about — **is never instantiated anywhere in the backend.** Three of the
original findings (numbered 1, 3 and 6: nested `$filter` can't work, two
further Criteria-API hazards, and `any()`/`all()` being unconditionally
rejected) are entirely about that class, do not apply to this backend, and
have been **replaced below**, not appended to.

The original finding 2 ("nested `$orderby` fails at field validation") is
different and needs a more careful correction, not a blanket dismissal: its
*mechanism* — `ODataOrderby`'s constructor calling `OData2Jpql.parseOrderByConditions`,
which calls `ODataChecker.checkFields` before any path parsing — is real and
runs on the JPQL-string path this backend does use (the same
`ODataOrderby.getOrderbyJpql()` named above). What was wrong was its
*conclusion* that nested sorting is therefore impossible. `checkFields` only
throws when strict validation is on, and §1.2 below turns strict validation
off (`odata.mini.repo.throw-on-field-not-found: false`) — which is exactly
what makes Rule A's nav-path sorting work in practice. So finding 2's
mechanism is accurate and still runs today; only its blanket "this can't
work" conclusion is superseded.

Current state, all shipped and live-verified:

- **Leader sorting is ON**, not off — `sortField: "leader/lastName"`
  (`src/features/team/filter-descriptors.ts`,
  `src/features/team/advanced-api.ts`), `enableSorting: true`
  (`src/features/team/columns.tsx`). This also closes the old "stale
  bookmarked URL" hole: a `?sort=leader.asc` link now resolves through
  `sortField` to the nav path instead of falling back to the bare `leader`
  column id.
- The Team **leader filter** still compares the flat, read-only `leaderId`
  scalar column (`field: "leaderId"`) — an equality/`in`-list filter on a FK
  id is simplest as a flat scalar, and it is unrelated to the nav-path
  standard below, which exists for **sorting** (and for filtering on
  attributes of the related row itself, e.g. the leader's surname).
- Person **filters** by team membership via an `any()` lambda
  (`teams/any(x: x/id in (…))`, `src/features/person/filter-descriptors.ts`).
  Person does **not** sort by teams (ill-defined over a to-many) and does not
  yet **display** a Teams column — see the cross-linked pagination issue.

## 1. The standard (spec §2)

Verified behaviour for every spelling exercised, copied from the design
spec's "Verified behaviour" table (spec, "Verified behaviour" section):

| spelling | strict `checkFields` | generated JPQL | live result |
|---|---|---|---|
| `name desc` | pass | `Team.name desc` | 200 |
| `leader/lastName desc` | **`FieldNotFoundException`** | `leader.lastName desc` (no root alias) | **200 when strict is off** |
| `leader.lastName desc` | — | ANTLR parse error | 500 |
| `leaderLastName desc` (`@ODataMapping`) | pass | `Team.leader.lastName desc` | not exercised |
| `contains_ignoring_case(leader/lastName,'мох')` | `FieldNotFoundException` | `LOWER(leader.lastName) LIKE …` | 200, count=1 when strict is off |
| `teams/any(x: x/id eq N)` | `FieldNotFoundException` | `EXISTS (SELECT x FROM Person.teams x WHERE x.id = N)` | 200, correct rows when strict is off |
| `teams/any(Teams: Teams/id eq N)` | pass | `EXISTS (SELECT Teams FROM Person.teams Teams …)` | 200, correct rows |
| clause *following* an `any()` | pass | root alias corrupted | **500** — see §2 below |
| `type eq 'CHANGE'` (enum) | pass | `Team.type = 'CHANGE'` | 200, count=85 |

### Rule A — to-one relation → navigation path

```
$orderby=leader/lastName desc
$filter=contains_ignoring_case(leader/lastName, 'мох')
```

- Separator is `/`, **not** `.` — a dot is an ANTLR parse error.
- No backend change per field; any relation attribute is immediately
  sortable and filterable this way.
- Frontend spelling: `sortField: "leader/lastName"`.
- Requires lenient validation — see §1.2.

### Rule B — to-many relation → `any()` lambda

```
$filter=teams/any(x: x/id in (1425,1432))
```

- **Filterable only, never sortable.**
- Never annotate a collection with `@ODataMapping`: the resulting inner
  `JOIN FETCH` drops parents with no children and duplicates those with
  several.
- **At most one `any()` per `$filter`, emitted last** — see §2 below.
- The lambda variable stays `x`. The grammar reserves `t, a, e, d, m, n, s`
  as literal prefixes — those single letters fail to parse. `x` is safe but
  the choice is load-bearing; don't change it casually.

### 1.2 Required backend configuration

```yaml
# cometa-web-module/src/main/resources/application.yaml
odata.mini.repo:
  throw-on-field-not-found: false
```

Both rules depend on this. `ODataChecker` (2.2.0) registers three forms of
field name: flat entity fields (`leader`, `name`); `<Entity>.<flat>` forms
(`Team.leader`); and — **only for `Collection`-typed fields** —
`Capitalize(field).<child>` (e.g. `Teams.id`). A to-one association gets no
nested registration at all, so strict validation rejects `leader/lastName`
**unconditionally** — no lambda-variable-style spelling would satisfy it,
because there is no lambda involved. A to-many `any()` lambda is different:
`teams/any(Teams: Teams/id eq N)` **passes** strict validation, because
`Teams.id` is exactly the registered `Capitalize(collectionField).<child>`
form (see the matrix above). It is specifically our `x` spelling
(`teams/any(x: x/id eq N)`) that strict rejects, since `x` isn't the
field's capitalized name. With strict validation off, an unknown field
instead becomes a Hibernate `SemanticException` at execution — still a 500,
so the practical trade is error-message quality, not safety.

## 2. Library bug: `any()` corrupts the root alias for every later clause

`OData2JpqlExpressionVisitor` declares its bind-variable tracker as a
`Queue<String>` (`ArrayDeque`) and uses it like a stack: `add()` appends at
the tail, but `visitAnyClause` pops with `remove()`, which operates on the
**head** — evicting the root variable, not the lambda variable it just
pushed. Every clause parsed after the first `any()` then resolves against
the lambda variable instead of the root. A `Deque` used with `push`/`pop`
would be correct; this one mixes queue and stack semantics.

Verified live (odata-mini 2.2.0-SNAPSHOT, odata-parser 1.2.2, Hibernate
7.2.12.Final):

```
any THEN flat →  SemanticException: Could not interpret path expression 'Teams.lastName'
flat THEN any →  200, count=1, correct
two any()     →  EXISTS (SELECT Teams FROM Person.teams  Teams …)
                 AND
                 EXISTS (SELECT Teams FROM Teams.teams   Teams …)   -- want Person.teams
```

It fails loudly (a 500) rather than silently returning wrong rows, so the
ordering rule is a correctness guard, not a data-integrity emergency. The
frontend's two OData param builders enforce it: both
`src/lib/odata/build-filter-params.ts` and
`src/lib/odata/build-advanced-filter-params.ts` collect `multiRelation`
clauses separately from scalar clauses and pass both, plus the join
separator, to a single shared helper —
`joinWithCappedLambdas` (`src/lib/odata/build-filter-params.ts`) — that caps
lambda clauses at one, appends the surviving one last, and `console.warn`s if
a second was requested and dropped. Report upstream and delete the workaround
(the helper and the split-collection logic in both builders) once a fixed
library version ships.

## Note on the findings retained below

The three sections that follow (§3–§5) are the original findings 5, 7 and 8,
kept **verbatim** — they were verified against a running backend on
2026-08-05 and remain true; the prose is unedited even where its literal
wording is now dated. Three things to know when reading them:

- Where they say **"finding 1"**, that refers to the flat, read-only
  `leaderId` scalar column described in the Status section above — still
  real and unrelated to this rewrite.
- Where they say **"finding 2/4"** or describe leader sorting as
  **disabled**, that was true when the finding was written (2026-08-05) and
  is no longer true: leader sorting has since shipped via `leader/lastName`
  (see the Status section above). The finding's own subject matter — the
  `/graph` + `$fields` endpoint fix, and the stale write-response fields —
  is unaffected by that and still stands as written.
- Where the last one says **"finding 7"**, that's the `/graph` + `$fields`
  endpoint fix immediately below it (§4 in this document's numbering).

## 3. Enum-typed columns — verified working against a live backend, 2026-08-05

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

## 4. The Leader column was empty because Team's list queries hit the wrong endpoint and parameter (resolved — this was the actual root cause)

*(Retained verbatim — see "Note on the findings retained below" above §3 for
what its internal "finding 1" / "finding 2/4" references mean today.)*

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

## 5. Write responses (`POST`/`PATCH`) return a stale `leaderId`/`leader` — verified, not a bug

*(Retained verbatim — see "Note on the findings retained below" above §3 for
what its internal "finding 1" / "finding 7" references mean today.)*

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

## 6. Nested sorting and collection filtering, verified 2026-08-26

Two items the original document left open (nested `$orderby` hazards;
`multiRelation`/`any()` support) have since been verified live and are
**no longer open**:

**Nested sort works.** The original concern was a possible duplicate fetch
join or duplicate order-map entry from the ANTLR parse tree. Verified
instead:

```
GET /api/v1/team/graph?$top=5&$fields=leader&$orderby=leader/lastName desc
HTTP 200  count=111
  1450 SberCIB Terminal Processing    Яковлева
  1451 eFX FIX Channels               Южаков
  1518 SberCIB Terminal FX Products   Южаков
  1437 [Service] Index Platform       Юдаков
  1436 [Service] Emission Platform    Юдаков
```

Identical to `SELECT … ORDER BY p.last_name DESC` in SQL. The library emits
`ORDER BY leader.lastName` **without** a root-alias prefix (unlike a flat
field, which gets `ORDER BY Team.name`); Hibernate 7.2 resolves the
unqualified path against the single root `readAll` always produces, so
there's no ambiguity. This is a real dependency on Hibernate's
implicit-root resolution, not a documented contract — see the design spec's
§6 "Remaining risks" for the fallback if a library/Hibernate bump ever
breaks it.

**`multiRelation` is supported, contrary to the original finding.** The
original finding read `ODataFilterHelper.visitFilterInstance`
unconditionally throwing `ConflictException` on `any()`/`all()` — but that
class belongs to `ODataCriteriaService` (see Status above), which this
backend never runs. On the actual `BaseCrudRepository`/JPQL path,
`teams/any(x: x/id in (1425))` returns HTTP 200 with exactly the two
expected people (Нилов and Мохов) on both `/api/v1/person` and
`/api/v1/person/graph`. Order matters (§2 above): `contains_ignoring_case`
before the `any()` clause returns 200; the reverse order returns 500.

## 7. Test coverage pinning this behaviour

Backend: `ODataJpqlGenerationTest`
(`cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/odata/`) asserts
the generated JPQL for six spellings from the design spec's
verified-behaviour matrix — 6/6 passing as of this writing, and every
assertion matches the matrix exactly. This exists so a library or Hibernate
version bump that changes any of the above fails a test instead of silently
producing wrong SQL. Two of its tests are explicitly commented as canaries
for an upstream behaviour change: `navigationPathOrderByOmitsRootAlias`
(flags it if the library ever starts qualifying `leader.lastName` with a
root alias) and `clauseAfterAnyLambdaLosesTheRootAlias` (flags it if the
root-alias corruption after `any()` ever stops reproducing). **For the
latter, failing is good news**: it means the upstream library fixed the §2
bug, and the frontend workaround (the "cap at one, emit last" ordering in
`joinWithCappedLambdas`) can be simplified or removed.

Frontend: `src/lib/odata/build-filter-params.test.ts` and
`src/lib/odata/build-advanced-filter-params.test.ts` pin the `$filter`/
`$orderby` strings each builder emits, including the `any()`-last ordering
and the relation-vs-multiRelation split.

## 8. Gotcha for any ad-hoc use of `OData2Jpql` outside the Spring request path

`throw-on-field-not-found` (§1.2) is read **once**, at Spring
autoconfiguration time, into a JVM-static field on
`ThrowOnFieldNotFoundPropertyProvider`; later writes are ignored, and there
is **no reset path**. That autoconfiguration is what disables strict
validation for real requests. A script, REPL session, or a new test that
constructs `OData2Jpql` directly — outside the Spring request path — never
runs that autoconfiguration, so the flag stays at its default (`true`,
strict) and any nav path or `any()` lambda throws `FieldNotFoundException`
immediately. If you hit this, call
`ThrowOnFieldNotFoundPropertyProvider.setThrowOnFieldNotFound(false)`
yourself before constructing `OData2Jpql` — and do it early, since once the
static is read/cached elsewhere in the same JVM, subsequent writes to it are
silently ignored.
