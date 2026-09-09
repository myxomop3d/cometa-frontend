# The no-null write standard

**Date:** 2026-09-09
**Status:** design approved, not implemented
**Replaces:** the patch-DTO design committed at `7d1b0d0` and deleted in the same
commit as this file — rejected because it put per-entity ceremony (a patch DTO,
a mapper method, a generic type parameter) in the way of every new entity.
**Supersedes the "Options" section of:** `issue/scalarClearIsANoOp.md`
**Builds on:** `docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`

## 1. The problem

`CometaCommonMapperConfig` sets `nullValuePropertyMappingStrategy = IGNORE`, so
every generated `update(DTO, @MappingTarget MODEL)` guards each property:

```java
if ( source.getLeaderSapId() != null ) {
    target.setLeaderSapId( source.getLeaderSapId() );
}
```

`IGNORE` is what makes partial PATCH work — a body that omits fifteen fields
must not null them. But Jackson deserialises `{"leaderSapId": null}` and `{}`
into the identical object, so "absent" and "explicitly null" are the same value
before any mapper runs. There is no spelling for *clear this field*: a user
empties an input, gets a 200 and a success toast, and watches the old value
return on refetch.

Two ways out. Teach the wire to distinguish absent from null — expensive, and
the cost lands on every future entity. Or stop needing the distinction.

## 2. The standard

**The frontend never sends `null`. Empty is a value, not the absence of one.**

| Body | Meaning |
|---|---|
| key absent | leave the field unchanged |
| key present, any value including `""` | set the field to that value |
| `null` | never sent; ignored if it ever were |

This is what `IGNORE` already implements. The protocol needs no new capability;
it needs the client to stop asking for one.

The rule that makes it total: **every type carries its own empty value, an
ordinary member of its own domain.**

| Kind | Empty value |
|---|---|
| text | `""` |
| number a form must be able to clear | retyped to text; `""` |
| enum | an explicit member (`UNSPECIFIED`), added when first needed |
| to-one relation | a sentinel "not set" row, created when first needed |
| to-many relation | `[]` — unchanged from the 2026-08-27 standard |

Nothing is ever nullable *because* it is optional. Optional means it has an
empty value and that value is storable. A column stays nullable only where no
form touches it.

## 3. Scope: the schema as it stands

The whole `gmsb` schema has 41 nullable columns (live, 2026-09-09):

- **33 `text`** — every one takes `""` naturally.
- **8 non-text** — `team.code` (`integer`, the only nullable number in the
  schema); four nullable FKs (`automated_system.client_certificate_id`,
  `principal.automated_system_id`, `scenario.automated_system_id`,
  `tech_component.automated_system_id`); three `jsonb` blobs (`node.data`,
  `node_tech_component_link.data`, `profile.data`).

Of the 8, exactly one — `team.code` — is reachable from an edit form. The FKs
and the jsonb columns appear in no sheet.

After this work every field a user can edit is clearable, with two exceptions:
`team.type` (§4.2), a storage constraint, and `automated_system.status`, a UI
affordance — `AutomatedSystemSheet.tsx` renders it as a two-item `Select` with
no clear affordance, even though the migrated column itself would accept `""`.

## 4. Database migration

### 4.1 What changes

**33 columns become `NOT NULL DEFAULT ''`**, with existing NULLs backfilled:

- the 33 nullable `text` columns, minus `team.type` (§4.2) — 32 columns across
  `automated_system` (15), `flow` (8), `team` (3: `name`, `leader_role`,
  `structure`), `tech_component` (3), `scenario` (1), `user_right` (1),
  `user_role` (1);
- plus `team.code`, retyped first:

```sql
ALTER TABLE gmsb.team ALTER COLUMN code TYPE text USING code::text;
```

110 of 112 rows have `code IS NULL` and become `''`; the two with values become
their digits as text.

### 4.2 What stays nullable, and why

**`team.type`** — nullable `text` in the database, but
`@Enumerated(EnumType.STRING) TeamType` on the entity. A `''` there breaks
*reads*: Hibernate cannot convert it back to a `TeamType`. It is the only
enum-backed nullable text column in the schema — every other `@Enumerated`
column (`Link` ×2, `Node`, `Principal`, `Profile` ×2,
`TechComponent.environment`) is already `NOT NULL`. All 112 rows carry a value,
so the field is effectively required already. It stays settable and
not-clearable. When "no type" needs to be expressible, the fix is an
`UNSPECIFIED` member on `TeamType` — no backfill, because no row is null.

**The four nullable FKs and three jsonb columns** — no form touches them. When
one first needs clearing, it gets a sentinel "not set" row and becomes
`NOT NULL` like everything else.

### 4.3 Preconditions, verified

- **No unique index collides.** Across the schema, the only unique index
  covering a nullable text column is `team_unique (name, code)`. `team.name`
  has zero NULLs, so its backfill is a no-op, and no two teams share a name —
  so the 110 rows converging on `code = ''` stay distinct.
- **Hibernate will not fight the change.** `ddl-auto` is commented out in
  `application.yaml`; there is no schema validation at startup.
- **Nothing rejects `''`.** No CHECK constraints on the affected tables, and no
  bean validation on any write DTO — the only two `@Valid` occurrences are a
  commented-out line and the read API.
- **The mixed representation already exists**, so this ends it rather than
  starting it: `ci` has 3 rows at `''` and 2 at NULL, `block` 3 and 3,
  `leader_sap_id` 1 and 83.

## 5. Backend

**No change to the write machinery.** `IGNORE` stays, partial PATCH stays,
`BaseCrudController` and `BaseCrudService` are untouched, no patch DTOs, no new
endpoints, no generic type parameters. Adding a new entity costs exactly what it
costs today. This is the point of the design.

Two field-type edits follow the `team.code` retype:

- `Team.code`: `Integer` → `String`
- `TeamFlatDto.code`: `Integer` → `String`

Optionally, and for accuracy rather than function, the 33 entity fields gain
`@Column(nullable = false)` to match the schema. Nothing enforces it either way
with `ddl-auto` off, and it can follow later without changing behaviour.

**The `IGNORE` hole is not fixed — it is made unreachable.** A `null` on the
wire still means "leave alone", and a non-frontend client would still be
surprised by it. That is accepted: this frontend is the only client (§8).

## 6. Frontend

The write path barely moves, because it was already correct apart from one
transform.

1. **`nullableText()` becomes `emptyText()`** — `z.string().trim()`, never
   producing null. `.trim()` matters: without it `"   "` is a third spelling of
   empty that looks empty in the input and in the table but is neither `""` nor
   NULL. Applies to the 15 uses in `src/features/automated-system/schema.ts`
   and the four inlined copies in `src/features/team/schema.ts`.
2. **Write payload types lose `| null`.** `AutomatedSystemWritePayload` and
   `TeamWritePayload` fields become `string`. The type then says what the wire
   says.
3. **`dtoToForm` maps `?? ""`**, so a form value is always a string.
4. **Create and patch both send `""`.** No asymmetry: `automatedSystemFormToCreate`
   and `automatedSystemFormToPatch` agree on what empty means. Patch keeps
   emitting only dirty fields — absent still means unchanged, and that is still
   the partial-patch mechanism.
5. **`src/types/api.ts`** — the 33 migrated fields become `string`, not
   `string | null`. After the migration the server cannot return null for them,
   and the type system now carries the rule.
6. **A `dash(v)` display helper** for `null | ""`, replacing bare `?? "—"` in
   `automated-system/columns.tsx` (16 cells) and `team/columns.tsx`. Needed
   regardless: 7 live rows already hold `''` and render blank today.
7. **`team.code` becomes a text field** — `z.string()` in the schema, a string
   cell in `columns.tsx`, and its filter descriptor changes from
   `{ variant: "range", filterKeys: ["codeMin", "codeMax"] }` to
   `{ variant: "text", filterKey: "code" }`.

`createCrudApi` needs no new option and no new path. The endpoints do not move.

## 7. Consequences of the `team.code` retype

Accepted deliberately:

- **The range filter is gone.** `codeMin`/`codeMax` are replaced by a
  `contains_ignoring_case` text filter. Bookmarked URLs carrying the old keys
  will be ignored rather than error — the descriptor comment's rule that a
  `filterKey` must never change is about renaming a surviving filter, not about
  removing one.
- **Sorting becomes lexicographic.** `$orderby=code` will place `"10"` before
  `"9"`. With 2 of 112 rows carrying a code this is currently invisible, and it
  is the ordinary cost of a code being a code rather than a quantity.

## 8. Consequences accepted overall

- **The wire loses any way to express NULL, permanently.** A future nullable
  date, number, or clearable relation must model its own empty value per the §2
  table. That discipline is now part of the standard rather than something the
  protocol solves for you.
- **"Never filled in" and "explicitly emptied" become the same state** for
  every migrated column. No information is lost that anything reads today.
- **A non-frontend client would still hit the `IGNORE` hole** with no warning.
  Acceptable while this frontend is the only client; if that ever stops being
  true, the patch-DTO design in `7d1b0d0` is the fallback and is still correct.

## 9. Testing

**Migration** — assert row counts before and after per column: no NULLs remain,
and the count of rows whose value is `''` equals the prior NULL count plus the
prior `''` count. Confirm `gmsb.team` still satisfies `team_unique` after the
`code` retype.

**Backend** — one integration test per entity with an edit form: a PATCH sending
`""` writes `""`, and a PATCH omitting the field leaves it untouched. Plus one
pinning that `team.type` is unchanged by a `""` — the documented exception
should fail loudly in a test rather than quietly in production.

**Frontend** — `mappers.test.ts` for automated-system and team. The case
currently named *"emits null rather than `''` for a cleared field"* inverts to
assert `""`, and gains a sibling asserting non-dirty fields stay absent from the
body. Add a `.trim()` case: `"   "` must serialise as `""`.

## 10. Rejected alternatives

**Patch DTOs with `JsonNullable`** (`7d1b0d0`, in git history). Correct, fully
general, RFC 7386 semantics. Rejected for its cost per entity: a patch DTO, a
mapper method, and a fourth generic type parameter threaded through seven
services and seven controllers, plus two library landmines to route around
(type arguments read by position; a `patch(ID, PATCH)` service method erasing
onto the library's `patch(ID, DTO)`). It made adding an entity harder forever to
solve a problem this design dissolves.

**PUT with a full document.** Free — `BaseCrudService.update` maps through
`fromDto`, which has no null guards and already clears correctly for every type.
Rejected for the lost-update exposure of full-record writes, and because
`update` never copies the path id onto the entity, so a body without `id` is an
insert rather than an update.

**Inverting the meaning of absent** (absent = clear, null = ignore). Impossible
without the presence tracking it was meant to avoid, and destructive if built: a
body naming one dirty field would null the other fifteen.

## 11. Follow-ups

- `UNSPECIFIED` on `TeamType`, when "no type" needs to be expressible (§4.2).
- Sentinel "not set" rows for to-one relations, when one first needs clearing.
- `@Version` on `BaseEntity` and a 409 path — the actual answer to concurrent
  edits, which neither PATCH nor PUT provides today.
- Global exception handling, still deferred in
  `issue/relationWriteStandardFollowUps.md`.
- Replace `issue/scalarClearIsANoOp.md` with a pointer to this document once
  implemented.
