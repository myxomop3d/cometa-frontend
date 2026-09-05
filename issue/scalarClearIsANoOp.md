# Clearing a nullable scalar is a silent no-op on PATCH

**Status:** open, unfixed. Raised by the final whole-branch review of the
AutomatedSystem leader relation
(`docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md`),
verified against the generated mappers on `feature/gm` at backend `c4b6bdb`.
Not a regression — it predates that work and affects every edit form in the
app. Recorded because the AutomatedSystem sheet raised the count of
user-clearable fields from 4 to 18, which turns a latent hole into one a user
will hit.

**Related:** `issue/relationWriteStandardFollowUps.md` (other deferred items
from the standard this hole lives in),
`docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`
(the standard itself, which names the to-one case of this hole but not the
scalar case).

## The finding

A user clears a text field in an edit sheet, saves, gets a `200` and a
success toast — and then watches the old value reappear when the list
refetches. No error is shown, because nothing failed. The write was simply
discarded.

The frontend does its half correctly. `nullableText()` in
`src/features/automated-system/schema.ts` normalises `""` to `null`, and
`automatedSystemFormToPatch` in `src/features/automated-system/mappers.ts`
emits the field only when dirty, so the request body genuinely is:

```json
PATCH /api/v1/automated-system/782
{"leaderSapId": null}
```

The backend then throws it away. `CometaCommonMapperConfig` sets
`nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE`,
and MapStruct materialises that in every generated `update` method as a
null guard per property. From
`cometa-service-module/target/generated-sources/annotations/…/AutomatedSystemMapperImpl.java`:

```java
if ( source.getLeaderComment() != null ) {
    target.setLeaderComment( source.getLeaderComment() );
}
if ( source.getLeaderSapId() != null ) {
    target.setLeaderSapId( source.getLeaderSapId() );
}
```

So on the PATCH path, `null` means "leave alone" and there is no spelling
that means "set to NULL". The column stays as it was.

## Scope: this is app-wide, not an AutomatedSystem defect

`TeamMapperImpl.update` carries the same six null guards, including
`leaderRole` and `structure` — both nullable columns exposed as clearable
text inputs in `TeamSheet`. Every mapper built on `CometaCommonMapperConfig`
behaves this way.

Field counts a user can clear, and which silently will not clear:

| Sheet | Clearable nullable scalars |
|---|---|
| `AutomatedSystemSheet` | 14 text fields + `status` |
| `TeamSheet` | `name`, `code`, `type`, `leaderRole`, `structure` |
| `PersonSheet` | (its four scalars are non-null in practice) |

The to-many case is **not** affected: `teams: []` genuinely clears
membership, because an empty list is not null. Only scalars and to-one
relations are hit.

## Why it was not fixed with the AutomatedSystem work

Three reasons, all recorded at the time:

1. It is backend behaviour, and the AutomatedSystem change was scoped to add
   a relation, not to alter the write standard every entity shares.
2. The standard already accepts the to-one half of this hole explicitly
   ("a nullable to-one cannot be cleared"). Fixing the scalar half without
   deciding the to-one half would leave the contract half-changed.
3. `IGNORE` is what makes partial PATCH work at all. It cannot simply be
   switched off: with `SET_TO_NULL`, every field absent from a PATCH body
   would be nulled, which would turn every partial update into a
   destructive one. This needs a way to distinguish *absent* from
   *explicitly null* — it is not a config-flag change.

What **was** done: the false claims about it were removed. The comment in
`src/features/automated-system/schema.ts` now says the server ignores the
null, and the test formerly named "includes explicit nulls for cleared
nullable fields" is now "emits null rather than `''` for a cleared field",
which is what it actually asserts. The payload shape is pinned; the
end-to-end clear is not, because it does not work.

## Options

**1. `JsonNullable` on nullable scalars.** The dependency is already present
— `CometaCommonMapperConfig` lists `JsonNullableMapper` in its `uses`, so
the machinery is wired and unused. Typing a DTO field as
`JsonNullable<String>` distinguishes absent (`JsonNullable.undefined()`)
from explicitly null (`JsonNullable.of(null)`), which is exactly the
missing distinction. Cost: every nullable scalar on every DTO changes type,
and the frontend must stop conflating `undefined` with `null`. Large, but
it is the correct fix and the codebase already leans this way.

**2. A per-entity `@Mapping(target = …, nullValuePropertyMappingStrategy = SET_TO_NULL)`**
on the specific fields a form is allowed to clear. Cheap and surgical, but
it makes a PATCH that omits the field destructive for that field, so it is
only safe if the frontend always sends every clearable field. That is a
fragile coupling to bury in an annotation.

**3. Accept and surface it.** Disable or hide the clear affordance in the
sheets — a nullable field that cannot be cleared should not present an
empty input as if it could. Cheapest, honest, and loses real capability.

**Recommendation:** option 1, as its own piece of work, because it also
closes the to-one half the standard already documents as open. Until then,
option 3 is worth considering for the fields users actually try to clear.

## Consequences of leaving it

- A user's edit silently reverts, which reads as a bug in the app rather
  than a limitation. There is no message anywhere telling them why.
- `status` on the AutomatedSystem sheet was deliberately left without a
  "clear" affordance for exactly this reason
  (`issue/automatedSystemLeaderFollowUps.md`). Adding one before this is
  fixed would create a *new* silent no-op rather than a feature.
- Any new form built on the switchable-DataTable pattern inherits it.
