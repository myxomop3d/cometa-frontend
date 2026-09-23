# RESOLVED — `POST /api/v1/automated-system` wrote SQL NULL into 15 NOT NULL columns

Raised 2026-09-23 while fixing the identical problem on `TechComponent`. Fixed
the same day in the backend repo `cometa` on `feature/gm`, together with the
two other tables carrying exactly the same defect (`Flow`, `Team`).

## What was wrong

Migration `014_no_null_text_columns.sql` made 15 of `gmsb.automated_system`'s
text columns `NOT NULL DEFAULT ''`. Hibernate lists every mapped column in its
`INSERT`, so a null Java field writes SQL `NULL` and the column's `DEFAULT ''`
never fires. Neither entity field initialisers nor mapper defaults were
present.

**Now reproduced live** — the piece the original report was missing. App on the
`local` profile against the dev database, logged in with
`x-forwarded-client-cert: CN=<admin>`, then:

```
POST /api/v1/automated-system  {"name":"...","leader":{"id":30}}
```

→ `HTTP 500`. The p6spy log shows the INSERT and Postgres rejecting it:

```
insert into gmsb.automated_system (block,ci,...,guid,...) values (NULL,NULL,...,NULL,...)
ERROR: null value in column "cluster_hpsm_id" of relation "automated_system"
       violates not-null constraint
```

Note the constraint names `cluster_hpsm_id` — the first NULL column Postgres
happens to reach, not the only one. All 15 went in as NULL.

## The fix

Not per-column `defaultValue` as on `TechComponent`, but one line in the shared
mapper config:

```java
// cometa-service-module/.../mapper/CometaCommonMapperConfig.java
nullValueCheckStrategy = NullValueCheckStrategy.ALWAYS,
```

It turns the unconditional assignment in the generated `fromDto` into
`if (dto.getX() != null) entity.setX(...)`, so an entity's `= ""` initialiser
survives to the INSERT. The initialisers themselves (plus `nullable = false` on
`@Column`, so the annotation stops lying about the schema) were added to
`AutomatedSystem` (15 columns), `Flow` (7) and `Team` (4). The three
`@Mapping(defaultValue = "")` in `TechComponentMapper` became redundant and
were removed — the project now has one mechanism, not two.

The global strategy was chosen over a per-mapper `@BeanMapping` deliberately: a
per-mapper annotation has to be remembered for every new entity, which is
exactly how this defect arose. The blast radius was measured before enabling
it — all 12 generated mappers diffed before/after, every change being an
existing assignment wrapped in a null check; every `update(@MappingTarget)` body
byte-identical; converter methods still invoked, so their validation is intact.
The reasoning is written up in the `CometaCommonMapperConfig` javadoc.

`PATCH` is untouched, and was re-checked live: `""` clears, an absent field and
an explicit `null` both leave the value alone.

## Verification

- `./mvnw clean test` — 116 tests (was 106), BUILD SUCCESS.
- New tests: `createDefaultsTheNotNullTextColumnsToEmptyString` in
  `AutomatedSystemMapperWriteTest`, plus brand-new `FlowMapperWriteTest` and
  `TeamMapperWriteTest` (neither mapper had a write test at all). The boundary
  is pinned separately: `automated_system.name`, `flow.key` and `team.type` are
  NOT NULL without a DEFAULT, or excluded from migration 014 — they stay
  required, and ALWAYS supplies them nothing.
- Live after the fix: `POST` omitting those fields → `HTTP 200`, and the stored
  row has `''` in all 15 columns and no NULLs. Same for `POST /flow` (only
  `key`) and `POST /team` (only `leader`). All probe rows deleted afterwards.

## Left out of scope

`issue/putReplacesInsteadOfUpdating.md` touches the same `fromDto` methods, but
it is a different defect (`id` never assigned) with a far larger blast radius —
worth reproducing before acting.

## Side finding

`PersonMapperWriteTest.onlyTheIdOfARefIsHonoured` asserted
`assertThat(team.getName()).isNull()`. That was an incidental encoding of what
`new Team()` used to look like, not the rule the test exists to check — its own
comment says the rule is "the mapper delegates the ref to `toRef` instead of
copying fields itself". The `name = ""` initialiser turned it red; the assertion
now compares against `new Team().getName()`, so it no longer depends on what the
default happens to be.
