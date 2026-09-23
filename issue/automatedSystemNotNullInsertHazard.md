# `POST /api/v1/automated-system` writes SQL NULL into 15 NOT NULL columns

Raised 2026-09-23 while fixing the identical problem on `TechComponent`
(backend repo `cometa`, spec
`docs/superpowers/specs/2026-09-22-node-tech-component-link-design.md`,
section *The no-null insert hazard*). Explicitly out of scope there.
Pre-existing, and the conditions are verified — the failing request is not.

## Problem

Migration `014_no_null_text_columns.sql` made 15 of `gmsb.automated_system`'s
text columns `NOT NULL DEFAULT ''`. Verified against the dev database — all 15
are `is_nullable = NO`, `column_default = ''::text`:

```
object_code  full_name   ci          name_hpsm        leader
leader_sap_id  block     tribe       cluster          cluster_hpsm_id
status       ift_mail_support  uat_mail_support  prod_mail_support  guid
```

Hibernate lists every mapped column in its `INSERT`, so a null Java field
writes SQL `NULL` and the column's `DEFAULT ''` never fires. Two things would
have to prevent that, and neither is present:

- **entity field initialisers** — `AutomatedSystem.java` has **0** fields
  initialised to `""`;
- **mapper defaults** — `AutomatedSystemMapper` contains **0** occurrences of
  `defaultValue`, and the generated `fromDto` assigns every scalar
  unconditionally:

  ```java
  automatedSystem.setObjectCode( source.getObjectCode() );   // no null guard
  automatedSystem.setFullName( source.getFullName() );
  automatedSystem.setCi( source.getCi() );
  ```

So a `POST` omitting any of those 15 fields should fail the NOT NULL
constraint. **Not reproduced live** — the conditions were verified statically
and against the schema; nobody issued the request.

`PATCH`/`PUT` are a different path (`update(source, @MappingTarget target)`,
where `NullValuePropertyMappingStrategy.IGNORE` null-guards every scalar) and
are not implicated.

## Why this one is not just a note

`TechComponent` had exactly this defect and it took a fix in **two** places —
entity field initialisers **and** `@Mapping(..., defaultValue = "")` on a
`fromDto` override. The entity-side fix alone does nothing, because the
generated create method overwrites the initialiser; the spec section above
records why. `AutomatedSystem` has 15 columns to the `TechComponent` fix's
three, and an active frontend create form.

## Where to look

- Backend repo (`cometa`):
  `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/AutomatedSystem.java`
  `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/AutomatedSystemMapper.java`
  `db-scripts/ddl/014_no_null_text_columns.sql` (the column list)
- The worked fix to copy: `.../entity/TechComponent.java` and
  `.../mapper/TechComponentMapper.java`, with
  `cometa-service-module/src/test/java/.../TechComponentMapperWriteTest.java`
  (`createDefaultsTheNotNullTextColumnsToEmptyString`) pinning it
- `issue/nodeTechComponentLinkFollowUps.md` — the work that surfaced this
- Related no-null write semantics on the frontend side are described under
  "scalar clear is a no-op" in `issue/automatedSystemLeaderFollowUps.md`,
  which links to an `issue/scalarClearIsANoOp.md` that was never written

Checking the schema:

```sql
SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='gmsb' AND table_name='automated_system' AND data_type='text';
```
