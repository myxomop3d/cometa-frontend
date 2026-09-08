# Patch DTOs: making "clear this field" expressible

**Date:** 2026-09-09
**Status:** design approved, not implemented
**Supersedes the "Options" section of:** `issue/scalarClearIsANoOp.md`
**Builds on:** `docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`

## 1. The problem

`CometaCommonMapperConfig` sets `nullValuePropertyMappingStrategy = IGNORE`.
MapStruct materialises that as a null guard per property in every generated
`update(DTO, @MappingTarget MODEL)` method:

```java
if ( source.getLeaderSapId() != null ) {
    target.setLeaderSapId( source.getLeaderSapId() );
}
```

`IGNORE` is what makes partial PATCH work: a body that omits fifteen fields
must not null them. But Jackson deserialises `{"leaderSapId": null}` and `{}`
into the identical object, so by the time any mapper runs, "absent" and
"explicitly null" are the same value. The wire has no spelling for *clear this
field*. A user empties a text input, gets a 200 and a success toast, and
watches the old value return on refetch.

The missing thing is not a config flag. It is the distinction between absent
and null, and it has to be reconstructed before the mapper sees it.

## 2. Goals

- One rule for how a write request says *leave this alone*, *set this*, and
  *clear this*, holding for every field of every type — text, number, enum,
  relation.
- Partial PATCH survives. A body naming one field must not touch the other
  fifteen.
- The OData read path — projections, `$fields`, `$filter`, the entity-graph
  endpoints — is not touched at all.

## 3. Non-goals

- Concurrency. There is no `@Version` on `BaseEntity`, so two users editing
  the same field silently overwrite each other today and will continue to.
  Optimistic locking is a separate piece of work (§11).
- Changing column nullability. Whether `block` or `tribe` should be
  `NOT NULL DEFAULT ''` is a data-modelling question, independent of this one.
  This design removes the *need* for such a migration; it does not forbid it.
- Global exception handling. Still absent, still deferred
  (`issue/relationWriteStandardFollowUps.md`).

## 4. The standard

Writes use a dedicated **patch document**, distinct from the resource
representation returned by reads. Semantics are JSON Merge Patch (RFC 7386):

| Body | Meaning |
|---|---|
| key absent | leave the field unchanged |
| key present, `null` | set the field to NULL |
| key present, value | set the field to that value |

Applied per field kind:

- **Nullable scalar** — all three cases available. This is the case that is
  broken today and the reason for the work.
- **Non-nullable scalar** — the field is typed plainly, not wrapped. Absent
  and `null` both mean *unchanged*, which is the only coherent reading for a
  column that cannot hold NULL. Sending `null` is a no-op, not an error.
- **To-one relation** — a ref object `{"id": N}` sets it; absent means
  unchanged. Both `leader` FKs in this schema are `NOT NULL`, so no to-one
  relation is clearable and none is wrapped. A ref present but without an `id`
  stays an `IllegalArgumentException`, per the 2026-08-27 standard.
- **To-many relation** — unchanged from the 2026-08-27 standard: absent means
  unchanged, `[]` clears, a non-empty array replaces. Collections are not
  wrapped; `[]` is already an unambiguous clear signal.

**`POST` is unaffected.** Create maps through `BaseCrudMapper.fromDto`, which
has no `@MappingTarget` and therefore no null guards — verified in the
generated `AutomatedSystemMapperImpl.fromDto`, seventeen straight setters.
Create already writes NULL correctly and keeps taking the full read DTO. A
patch document and a resource representation are different media, and RFC 7386
treats them as such.

## 5. Scope: what actually needs wrapping

Confirmed against the live database (2026-09-09) and the entity mappings,
which agree exactly.

**`AutomatedSystem`** — 15 nullable `text` columns wrapped; `name` (NOT NULL)
and `leader` (NOT NULL FK) plain. `client_certificate_id` is nullable but is
commented out of the DTO and unreachable from any UI; left alone.

**`Team`** — all five editable columns are nullable and all five get wrapped:
`name`, `code` (`Integer`), `type` (`TeamType` enum, `String` on the DTO),
`leader_role`, `structure`. `leader` (NOT NULL FK) stays plain. This fixes
`code` and `type`, which no string-based workaround can reach.

**`Person`** — needs no patch DTO. `email`, `last_name`, `first_name`,
`middle_name` are all `NOT NULL`; `teams` is a collection already served by the
`[]` rule.

**`Flow`, `Link`, `Node`, `Topic`** — no edit form today. They inherit the
mechanism with `PATCH = DTO` (§6.4) and behave exactly as they do now.

## 6. Backend design

### 6.1 Patch DTOs

`service/dto/AutomatedSystemPatchDto.java`, `TeamPatchDto.java`. Plain classes
— they deliberately do **not** extend `BaseEntityDto`, because `id`,
`insertedAt` and `updatedAt` are not client-writable and a patch document
should not offer them.

```java
@Getter
@Setter
public class AutomatedSystemPatchDto {
    private String name;                       // NOT NULL - plain
    private PersonFlatDto leader;              // NOT NULL FK - plain ref
    private JsonNullable<String> objectCode;
    private JsonNullable<String> fullName;
    // ... 13 more nullable scalars
}
```

An unset `JsonNullable` field is `null` — Jackson leaves absent fields at their
default. Do **not** initialise them to `JsonNullable.undefined()`; the presence
check in §6.2 treats a null reference as absent, and an initialiser would only
hide a field Jackson failed to bind.

### 6.2 The presence check

This is the whole mechanism, and it is four lines in one file.

odata-mini's `ru.sber.cs.core.odata.mini.repo.mapper.JsonNullableMapper` is
**not** sufficient — inspected in `odata-mini-repo-2.2.0-SNAPSHOT.jar`, it
carries only `wrap` and `unwrap` and no `@Condition`. Without a presence check,
`IGNORE` still discards the null and nothing changes. So we add our own:

```java
@Mapper(componentModel = "spring")
public interface CometaJsonNullableMapper {

    /** Absent (key missing, or Jackson never bound it) vs. explicitly null. */
    @Condition
    default <T> boolean isPresent(JsonNullable<T> value) {
        return value != null && value.isPresent();
    }

    default <T> T unwrap(JsonNullable<T> value) {
        return value == null ? null : value.orElse(null);
    }
}
```

`wrap` is deliberately omitted. Nothing maps *into* a `JsonNullable` — patch
DTOs are write-only — and an unused `wrap` in `uses` is a method MapStruct
might select for an unrelated mapping.

`CometaCommonMapperConfig.uses` **replaces** the library's `JsonNullableMapper`
with `CometaJsonNullableMapper`. It must not list both: each declares an
applicable `unwrap(JsonNullable<T>)`, and MapStruct fails the build with an
ambiguous-mapping-method error rather than picking one. Removing the library's
entry loses nothing — it is inert today, generating no code because no DTO field
is `JsonNullable`-typed.

`@Condition` methods match on **source property type**, not on property name or
mapper. So this one method replaces the `!= null` guard for every
`JsonNullable`-typed property in every mapper in the application. There is no
per-field and no per-mapper annotation. Expected generated output:

```java
if ( cometaJsonNullableMapper.isPresent( source.getObjectCode() ) ) {
    target.setObjectCode( cometaJsonNullableMapper.unwrap( source.getObjectCode() ) );
}
```

### 6.3 Mapper method

Each opted-in mapper gains one method. MapStruct distinguishes it from the
inherited `update` by parameter type; the distinct name also keeps it clear of
the erasure hazards this codebase has hit before.

```java
void patch(AutomatedSystemPatchDto source, @MappingTarget AutomatedSystem target);
```

The existing type-scoped `@Condition isEntityLoaded(Person)` on
`AutomatedSystemMapper` does not interfere: the patch source has no
`Person`-typed property, only `PersonFlatDto`.

### 6.4 Service and controller generics

A shared mapper interface carries the new method so the base service can call
it, with a default that preserves today's behaviour for entities that never
declare a patch DTO:

```java
public interface CometaCrudMapper<MODEL, DTO, PATCH> extends BaseCrudMapper<MODEL, DTO> {
    void patch(PATCH source, @MappingTarget MODEL target);
}
```

Entities with no patch DTO bind `PATCH = DTO`; their `patch` is generated from
the same source type as `update` and keeps the current semantics exactly.

**The type-parameter positions are load-bearing.** `BaseCrudService`'s
constructor reads `getGenericSuperclass().getActualTypeArguments()[0]` and `[1]`
for `modelClass` and `dtoClass`; `BaseCrudController`'s reads `[0]` for
`dtoClass`. The new parameter must therefore be appended after them:

```java
EntityGraphBaseCrudService<MODEL, DTO, PATCH, ID>     // MODEL=[0], DTO=[1] preserved
EntityGraphBaseCrudController<DTO, PATCH, ID>         // DTO=[0] preserved
```

Getting this order wrong does not fail to compile. It fails at runtime, in
`metadata()` and in the service's reflective class lookups. Each of the seven
service classes and seven controller classes takes a one-line signature edit.

`ODataEntityGraphMiniService` gains `patchGraph(ID, PATCH)` — **not**
`patch(ID, PATCH)`, which would erase to the same signature as the library's
`patch(ID, DTO)` and silently override it. That exact trap has already cost this
project once, in `getAll`; see the comment in `ODataEntityGraphReadApi`.

`EntityGraphBaseCrudService.patchGraph` mirrors `BaseCrudService.patch` and
carries `@Transactional` for the same reason the existing overrides do —
`spring.jpa.open-in-view=false` means a detached entity would blow up on
collection mapping:

```java
@Override
@Transactional
public ResultObj<DTO> patchGraph(ID id, PATCH dto) {
    MODEL entity = repository.readById(id)
            .orElseThrow(() -> new NotFoundException(...));
    cometaMapper.patch(dto, entity);
    ...
}
```

### 6.5 The endpoint

```
PATCH /api/v1/<resource>/graph/{id}
```

We own `EntityGraphBaseCrudController` — it already extends the library's
`BaseCrudController` and already overrides `create`/`update`/`patch`/`delete` to
add `@PreAuthorize`. So overriding library behaviour is the established move
here, and this design uses it (below). What an override *cannot* do is change a
parameter type: `patch(ID, DTO)` is fixed by the inherited signature, and a
second `@PatchMapping("/{id}")` in the same controller would be an ambiguous
mapping at startup. Hence a distinct path.

`graph/...` is already this project's namespace for endpoints it owns rather
than inherits — `ODataEntityGraphReadApi` declares `@GetMapping("graph")` and
`@GetMapping("graph/{id}")` for exactly this reason. A patch endpoint on the
same prefix needs no un-inheriting of the controller hierarchy and raises no
conflict.

The two inherited write endpoints are then **disabled** in
`EntityGraphBaseCrudController`, overridden to return `405` with an `AppMessage`
naming the replacement:

- `PATCH /{id}` — silently discards every clear. Actively harmful.
- `PUT /{id}` — never copies the path id onto the entity; it maps
  `fromDto(body)` and merges, so `id` must come from the body. A body without
  `id` is an insert, not an update. Unused by the only client.

`POST` and `DELETE` stay as inherited.

### 6.6 Jackson

`JsonNullable` deserialisation requires `JsonNullableModule`. Spring Boot's
`Jackson2ObjectMapperBuilder` auto-registers jdk8, jsr310, parameter-names and
kotlin — it does not know about `jackson-databind-nullable`. Register it
explicitly:

```java
@Bean
JsonNullableModule jsonNullableModule() { return new JsonNullableModule(); }
```

`jackson-databind-nullable` 0.2.6 is present in the local repository. That it
resolves onto the web module's runtime classpath is a §7 gate, not an
assumption; if it arrives only as a compile-scope transitive of odata-mini-repo,
declare it directly.

## 7. Verification gates

Each must produce evidence before the task depending on it is called done.

1. **The presence check actually overrides `IGNORE`.** First task, before any
   DTO is written: wrap one field, build, and read
   `target/generated-sources/annotations/.../AutomatedSystemMapperImpl.java`.
   The guard must read `isPresent(...)`, not `!= null`. If MapStruct 1.5.5 does
   not honour it, this design does not work and we stop — the fallback is the
   `""` convention in `issue/scalarClearIsANoOp.md`.
2. **`JsonNullableModule` binds.** `{"objectCode": null}` must arrive as
   `JsonNullable.of(null)` and `{}` as a null reference. Assert both in a
   controller-level test, not by inspection.
3. **Mapper generation is not corrupted.** After every build, confirm each
   `*MapperImpl` still declares `implements`. This repository has a reproducible
   fork-related corruption that produces impl classes without it, surfacing as
   "required a bean of type ...Mapper" at startup.

## 8. Frontend design

Small, because the frontend is already correct. `JSON.stringify` drops
`undefined` keys, so "absent" is free, and `automatedSystemFormToPatch` already
emits only dirty fields.

1. **`nullableText()` stops being a lie.** It already normalises `""` to `null`;
   that null now means *clear*. The comment in
   `src/features/automated-system/schema.ts` claiming the server ignores it is
   deleted.
2. **A `patchPath` option on `createCrudApi`**, mirroring the existing
   `listPath`, routing `patch` to `${basePath}/graph/${id}`. One option, one
   line per resource.
3. **`AutomatedSystemPatchPayload` / `TeamPatchPayload`** types, with every
   field optional — the type then says what the wire says.
4. **Team gains real clear affordances** for `code` and `type`, which have never
   been clearable. Note `code` must stay optional in zod: 110 of 112 live rows
   have `code IS NULL`, so a required rule would lock them out of editing
   entirely — the mistake §6 of the AutomatedSystem design already records
   against `ci`.
5. **The display helper.** `dash(v)` for `null | ""`, replacing bare `?? "—"` in
   `automated-system/columns.tsx` and `team/columns.tsx`. Not caused by this
   change, but the live data already holds `ci=''` (3 rows), `block=''` (3) and
   `leader_sap_id=''` (1) that render blank today.

## 9. Testing

**Backend, per opted-in entity** — three integration tests, one per row of the
§4 table: absent leaves the value, `null` clears it, a value sets it. Plus one
asserting a `null` on a NOT NULL scalar is an unchanged no-op rather than a 500.

**Frontend** — `mappers.test.ts` for automated-system and team. The case
currently named "emits null rather than `''` for a cleared field" becomes an
end-to-end-meaningful assertion rather than a shape pin, and gains a sibling
asserting non-dirty fields stay absent from the body.

## 10. Rejected alternatives

**`JsonNullable` on the shared read/write DTOs.** Fewer classes, but it puts a
wrapper type in front of odata-mini's projection and `$fields` reflection. That
machinery is the most fragile part of this stack and the least documented.
Separate patch DTOs cost two classes and touch none of it.

**PUT with a full document.** Free — `BaseCrudService.update` maps through
`fromDto`, which has no null guards, so it already clears correctly for every
type. Rejected for the lost-update exposure of full-record writes, and for the
id-in-body behaviour in §6.5.

**`""` as the empty value, with `NOT NULL DEFAULT ''` columns.** No Java change
at all, and genuinely clean for text. Rejected as *the standard* because no
sentinel exists for `Integer`, dates, or a nullable FK, so it carves a permanent
exception that grows with every nullable non-string column. Still available as a
data-modelling choice on top of this design.

**Inverting the meaning of absent** (absent = clear, null = ignore). Impossible
without the presence tracking it was meant to avoid, and destructive if built: a
body naming one dirty field would null the other fifteen.

## 11. Follow-ups

- `@Version` on `BaseEntity` and a 409 path, the actual answer to concurrent
  edits (§3).
- Global exception handling, so a bad enum value reads as a message rather than
  a bare 500.
- Narrow `issue/scalarClearIsANoOp.md` to a pointer at this document once
  implemented.
