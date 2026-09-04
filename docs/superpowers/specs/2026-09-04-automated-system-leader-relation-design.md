# AutomatedSystem leader relation, and the Team-style AS page

Date: 2026-09-04
Status: approved design, not yet implemented

## Problem

`gmsb.automated_system` gained a `leader_person_id` column, `NOT NULL`, FK to
`gmsb.person(id)`. The backend does not know it exists: `AutomatedSystem` has no
`@ManyToOne` for it, and `AutomatedSystemDto` has no field for it.

The name is taken. The entity already carries `@Column(name = "leader") private
String leader` — free text like `"Филина Е. М. (806025)"` — alongside
`leader_sap_id`. So adding the relation is also a rename.

Separately, `/automated-system` is the last page still on the pre-unification
stack: `SimpleTable` + `useFilters` + inline `editConfig`, with a hand-written
`validateSearch`. Every comparable page (Team, Person, Box, Flow) has moved to
the switchable DataTable with a side Sheet.

This document covers both, because the first forces the second: the DTO change
is breaking, so the page cannot be left as it is.

## Decisions

| Question | Decision |
|---|---|
| Relation name | `leader` — matches the `leader_person_id` FK |
| Old text field | Renamed to `leaderComment`; DB column stays `leader` |
| `leaderComment` on the page | Shown and editable, alongside the related person |
| `leaderSapId` | Untouched |
| Leader required? | Yes — the FK is `NOT NULL` |
| DTO shape | `AutomatedSystemFlatDto` + `AutomatedSystemDto extends` it |
| `NodeDto.automatedSystem` | Stays `AutomatedSystemDto`; N+1 held off by `@Condition` |
| Page architecture | Full Team parity: sheet only, inline editing dropped |
| Row actions | Edit only — no Delete, matching Team |
| Filterable fields | The 7 filtered today, plus the `leader` relation |
| Form validation | Mirrors the DB: only `name` and `leader` required |
| Timestamps in the TS DTO | Added, for parity with `TeamFlatDto` |
| MSW coverage | AS handler dropped; fixtures kept for `nodes.ts` |
| `IgnoreAutomatedSystemLinkedObjects` | Deleted — dead code |

### Rejected: narrowing `NodeDto.automatedSystem` to the Flat DTO

The relation-write standard types a parent's relation as the *child's Flat* DTO.
Applied literally, `NodeDto.automatedSystem` would become
`AutomatedSystemFlatDto`, making it structurally impossible for the flow-graph
path to reach a lazy `leader` proxy.

Rejected, because the Flat type exists to break **cycles**, and there is no cycle
here. `PersonDto.teams -> TeamFlatDto` terminates a real
`Team.leader -> Person.teams -> Team` loop. `AutomatedSystem -> Person`
terminates on its own: `PersonFlatDto` has no relations, so
`NodeDto.automatedSystem.leader` is already a leaf.

What remains is the N+1 risk, and that is handled the way `TeamMapper` and
`PersonMapper` already handle it in production — a `@Condition` guard on
`Hibernate.isInitialized`. Narrowing the type would buy a guarantee the codebase
does not demand anywhere else, at the cost of changing a DTO that four
flow-graph modules read.

The Flat type is still created, so `AutomatedSystem` matches the standard's shape
and can serve as a write-ref target later.

**Known consequence:** on day one `AutomatedSystemFlatDto` has no field-level
consumer — nothing is *typed* as it. It is not dead code: it is the class holding
the 16 scalars, and `AutomatedSystemDto` extends it. Recorded here so it is not
later mistaken for an unused type and deleted.

## 1. Entity

The DB column keeps its name, so the text field's rename is Java-side only.

```java
/** Лид (текстовый комментарий). Историческое поле; колонка в БД осталась `leader`. */
@Column(name = "leader")
private String leaderComment;

/** Лидер АС (физическое лицо). */
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "leader_person_id", nullable = false)
private Person leader;
```

Needs `import ru.sberbank.cib.gmbus.entity.auth.Person` — `AutomatedSystem` is in
`…gmbus.entity`, `Person` in `…gmbus.entity.auth`.

`optional = false` + `nullable = false` mirrors `Team.leader`, the same mapping
against the same target, proven in this codebase.

**No migration.** The column and its FK constraint
(`automated_system_leader_person_id_fkey`) already exist, and the DB accepted
`NOT NULL`, so every existing row is already populated. No backfill.

Observed on the live DB (2026-09-04), not merely inferred from the constraint:

```
total rows                200
leader_person_id set      200      -- no backfill needed
leader (text) set         198      -- so leaderComment is genuinely nullable
distinct leaders           33
```

## 2. DTOs

```
BaseEntityDto (id, insertedAt, updatedAt)
├── PersonFlatDto (email, lastName, firstName, middleName)
└── AutomatedSystemFlatDto (16 scalars)
    └── AutomatedSystemDto (+ leader: PersonFlatDto)
```

`AutomatedSystemFlatDto extends BaseEntityDto` carries every scalar and no
relations: `name`, `objectCode`, `fullName`, `ci`, `nameHpsm`, `leaderComment`,
`leaderSapId`, `block`, `tribe`, `cluster`, `clusterHpsmId`, `status`,
`iftMailSupport`, `uatMailSupport`, `prodMailSupport`, `guid`.

`AutomatedSystemDto extends AutomatedSystemFlatDto` adds exactly one field:

```java
private PersonFlatDto leader;
```

The commented-out `clientCertificateId` line is left as it is; the
client-certificate relation is out of scope.

## 3. Mapper

A near-copy of `TeamMapper`:

```java
@Mapper(config = CometaCommonMapperConfig.class, uses = PersonRefMapper.class)
public interface AutomatedSystemMapper extends BaseCrudMapper<AutomatedSystem, AutomatedSystemDto> {

    /**
     * Не инициализировать ленивый прокси лидера при маппинге в DTO —
     * без ?$fields=leader вложенный leader останется null вместо N+1.
     */
    @Condition
    default boolean isEntityLoaded(Person person) {
        return Hibernate.isInitialized(person);
    }

    /** Направление чтения: Person -> PersonFlatDto. Запись идёт через PersonRefMapper. */
    PersonFlatDto toFlat(Person person);
}
```

`leaderComment` maps by name in both directions. `leader` resolves by signature:
`PersonRefMapper.toRef` on write, `toFlat` on read.

The `@Condition` matters most on the flow-graph path. `FlowGraphService` builds
its graph from `CometaEntityGraph.fromAttributePaths("automatedSystem")` — one
hop — so `automatedSystem.leader` is an uninitialized proxy there. Without the
guard, every node in a rendered graph costs one `SELECT person`.

**Bean graph stays acyclic**: `NodeMapperImpl -> AutomatedSystemMapperImpl ->
PersonRefMapper -> EntityManager`. No mapper-to-service edge, so none of the
`BeanCurrentlyInCreationException` risk the standard documents.

`AutomatedSystemService` and `AutomatedSystemRestController` need **no changes**.
Both already extend the `EntityGraph*` bases and so inherit the transactional
`create`/`update`/`patch` that make a relation write safe under
`open-in-view: false`.

### Delete `IgnoreAutomatedSystemLinkedObjects`

`service/mapper/annotation/IgnoreAutomatedSystemLinkedObjects.java` is dead: it
is never applied to anything, and it targets `clientCertificateId`, a DTO field
that is commented out. It would not compile if it were used. Removed as part of
this change.

## 4. Wire contract

Reads populate `leader` only with `?$fields=leader`; otherwise the `@Condition`
leaves it `null` rather than firing a lazy SELECT. `$fields` on a single record
is served by `GET graph/{id}` — **not** by `GET {id}`, which is the library's own
handler and ignores the parameter.

| Request body | Effect on the leader |
|---|---|
| field absent, or `"leader": null` | unchanged (`NullValuePropertyMappingStrategy.IGNORE`) |
| `"leader": {"id": 5}` | set to person 5 |
| `"leader": {"id": 5, "lastName": "X"}` | set to person 5; `lastName` silently dropped |
| `"leader": {}` | `IllegalArgumentException` from `BaseRefMapper` — not read as "clear" |
| clearing the leader | impossible by design; the column is `NOT NULL` |

**Breaking for any consumer outside these two repos**: `leader` changes from a
string to an object, and a new `leaderComment` appears.

### Note on Team's `detailQueryOptions`

`src/features/team/api.ts` fetches `/api/v1/team/${id}?$fields=leader` — the
plain path, which per the mapping above ignores `$fields`. The Team sheet does
not notice, because it seeds its form from the *row* (fetched from the list
`/graph` read), not from that detail query. AS therefore uses `graph/{id}`.
Team is left alone: this is an observation, not a verified defect, and fixing it
is not in this change's scope.

## 5. Frontend types

```ts
export interface AutomatedSystemFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string;
  objectCode: string | null;
  fullName: string;
  ci: string;
  nameHpsm: string | null;
  leaderComment: string | null;   // was `leader`
  leaderSapId: string | null;
  block: string;
  tribe: string;
  cluster: string;
  clusterHpsmId: string | null;
  status: string | null;
  iftMailSupport: string | null;
  uatMailSupport: string | null;
  prodMailSupport: string | null;
  guid: string | null;
}

export interface AutomatedSystemDto extends AutomatedSystemFlatDto {
  /** Read: populated only with ?$fields=leader. Write: only `id`.
   *  NOT NULL in the DB, yet null on any read that omits $fields. */
  leader: PersonFlatDto | null;
}
```

`AutomatedSystemFilters` is rewritten from `Filters<AutomatedSystemDto>` into a
hand-written interface of **URL param names**, as `TeamFilters` is: `name`, `ci`,
`block`, `tribe`, `cluster`, `status`, `leaderComment`, `leaderId`. The generic
form cannot survive `leader` becoming an object, and filter keys are URL contract
rather than DTO fields.

## 6. Frontend feature module

New `src/features/automated-system/`, mirroring `src/features/team/`:

| File | Content |
|---|---|
| `api.ts` | `createCrudApi` — `basePath` `/api/v1/automated-system`, `listPath` `…/graph`, `queryKey` `["automated-systems"]`, `staticParams { "$fields": "leader" }`; plus `detailQueryOptions` on `graph/{id}?$fields=leader` |
| `advanced-api.ts` | `automatedSystemFieldByColumnId` + `advancedDataTableQueryOptions` against `/graph`, appending `$fields=leader` |
| `filter-descriptors.ts` | 8 descriptors + `deriveColumnFiltersFromSearch` |
| `columns.tsx` | `select` · `id` · 17 data columns · `actions` |
| `schema.ts` | zod form schema + `AutomatedSystemWritePayload` |
| `mappers.ts` | `dtoToForm` / `formToCreate` / `formToPatch` |
| `row-action.ts` | `{variant:"create"}` \| `{variant:"update", row}` |
| `switchable-config.ts` | `SwitchableTableConfig` wiring the above |
| `components/AutomatedSystemSheet.tsx` | 17-field RHF form |

Routes: `src/routes/automated-system/-simple-search.ts` (validates the 8 params —
`status` via `asStrArray`, `leaderId` via `asNum`) and a rewritten `index.tsx`
that is a near-copy of Team's — `makeSwitchableSearch`, `makeSwitchableLoader`,
`useSwitchableTablePage`, simple/advanced toolbar toggle, and an
"Add Automated System" button.

Column pinning `{ left: ["select", "id", "name"], right: ["actions"] }` preserves
today's sticky `name`; `guid` stays hidden by default.

**Deleted**: `src/api/automated-system.ts`, and with it this page's use of
`SimpleTable`, `useFilters` and `editConfig`.

### Filters

| Column | Variant | URL key | OData |
|---|---|---|---|
| `name` | text | `name` | `contains_ignoring_case(name, …)` |
| `ci` | text | `ci` | `contains_ignoring_case(ci, …)` |
| `block` | text | `block` | `contains_ignoring_case(block, …)` |
| `tribe` | text | `tribe` | `contains_ignoring_case(tribe, …)` |
| `cluster` | text | `cluster` | `contains_ignoring_case(cluster, …)` |
| `status` | select | `status` | `eq` |
| `leaderComment` | text | `leaderComment` | `contains_ignoring_case(leaderComment, …)` |
| `leader` | relation | `leaderId` | `leader/id eq N`, sort `leader/lastName` |

The remaining nine columns are visible and not filterable. Eight of them are
also sortable; `guid` is the exception — it is visible, not filterable and
**not sortable**. Live verification on 2026-09-05 found `$orderby=guid asc`
answers 500: `guid` is a reserved literal token in odata-mini's `$orderby`
ANTLR grammar (case-insensitively), so the request fails in the parser before
any field lookup and `throw-on-field-not-found: false` cannot rescue it. The
column carries `enableSorting: false`, and the route's `validateSearch` drops a
`sort` param naming it so a bookmarked URL cannot reach `$orderby` either.

`leader` follows the to-one rules from the relation-filter standard: a navigation
path with `/`, never a dot. It is filterable *and* sortable — the `any()`
restrictions apply only to to-many relations, and this is to-one. Requires
`odata.mini.repo.throw-on-field-not-found: false`, already set.

`status` keeps its two known values. Verified against the live DB — these are
the only values that occur across all 200 rows:

| status | rows |
|---|---|
| `Находится в эксплуатации` | 181 |
| `Выведен из эксплуатации` | 17 |
| *null* | 2 |

### Why `block`, `tribe` and `cluster` stay text filters

Their distinct-value counts are 16, 32 and 45 respectively, so `block` in
particular could plausibly be a faceted select like `status`. Deliberately left
as free text: the counts are unbounded in principle (nothing constrains the
column), and a select would silently hide any value added later. Recorded so the
option is not rediscovered as an oversight.

### Form validation mirrors the DB

Today's inline-edit schema requires `fullName`, `ci` (min length 5), `block`,
`tribe` and `cluster`. All five are **nullable** in the database. The new sheet
requires only:

- `name` — `NOT NULL`
- `leader` — `NOT NULL`, enforced with the `leaderId: 0` sentinel plus a
  `positive()` rule, exactly as `TeamSheet` does

Everything else is optional.

The old rules are not merely stricter than the schema — they are stricter than
the **data**. Counted on the live DB across 200 rows:

```
full_name IS NULL          2
ci IS NULL                 2
block IS NULL              2
tribe IS NULL              3
cluster IS NULL            2
length(ci) < 5             5     <-- violates the old `ci: min(5)` rule
```

So five existing systems cannot be opened and saved in today's inline editor at
all: the form rejects a value the database already holds. That settles it as an
inline-editing-demo artefact rather than a business rule.

## 7. Flow-graph and mocks fallout

**One production line breaks.** `features/flow-graph/components/details-panel.tsx:108`
renders `{node.automatedSystem.leader}` as a React child. It becomes:

```tsx
<FieldRow label="Leader">{node.automatedSystem.leaderComment ?? "—"}</FieldRow>
```

No row is added for the related person. On the flow-graph path `leader` is always
`null` (section 3), so such a row would be permanently empty. Showing it would
require teaching `FlowGraphService` to fetch `automatedSystem.leader`, which is
out of scope.

`custom-node.tsx` reads only `.name` and is untouched. All flow-graph tests
construct `automatedSystem: null` and are unaffected.

**Fixtures.** `src/mocks/data/automated-systems.ts` holds 103 rows and is
imported by `mocks/data/nodes.ts`, so it is migrated, not deleted: `leader:` →
`leaderComment:`, plus `leader` and the two timestamps on every row. A scripted
edit; `tsc -b` proves it complete, since every field is required.

**Handler dropped.** `src/mocks/handlers/automated-system.ts` is deleted and
removed from `handlers.ts`. The new page lists from
`/api/v1/automated-system/graph`, which no handler matches, and there is no
`/graph` handler anywhere in `src/mocks/`. There are also no `team` or `person`
handlers — MSW mode already does not cover pages on this architecture. Adding
`/graph` support would mean inventing a `persons` fixture set purely to serve one
mocked page.

**Consequence:** with `VITE_MOCK_API=true` the AS page no longer works. Node and
flow-graph mocks are unaffected, because they consume the fixtures directly.

## 8. Testing

**Backend.** `AutomatedSystemMapperWriteTest`, modelled on
`PersonMapperWriteTest`, pins the section 4 table: absent leaves the leader
unchanged, `{"id": 5}` sets it, extra ref fields are dropped, `{}` throws.
`BaseRefMapperTest` already covers `toRef` generically. One case added to
`ODataJpqlGenerationTest` for the AS spelling of `leader/id` and
`leader/lastName`.

**Frontend.** `features/automated-system/mappers.test.ts` — `leaderId` lifted
from the nested ref, `0` when `leader` is null so the form flags it required,
patch emitting `leader: {id}` only when dirty. And
`features/automated-system/filter-descriptors.test.ts` — `leader/id eq N` and
`$orderby=leader/lastName asc`.

### Verification gates

```
# backend — from the ROOT reactor, never a single module
mvnw -pl cometa-service-module -am test

# a single test class also needs the -am siblings excused from matching it
mvnw -pl cometa-service-module -am test \
  -Dtest=AutomatedSystemMapperWriteTest -Dsurefire.failIfNoSpecifiedTests=false

# frontend
npx tsc -b        # NOT `tsc --noEmit` — the solution-style root config checks nothing
npm run lint
npx vitest run
```

Two environment traps, both previously bitten, treated as required steps:

1. **Verify the generated mapper after every build.** The Maven fork can emit an
   `AutomatedSystemMapperImpl` missing its `implements` clause, reporting
   `BUILD SUCCESS` and then failing at runtime with "required a bean of type
   AutomatedSystemMapper". Check for `implements` in
   `cometa-service-module/target/generated-sources/annotations/…/AutomatedSystemMapperImpl.java`
   before trusting a green build. A one-off `testCompile` failure naming a class
   that exists on disk is known noise — retry once before investigating.
2. **Stop the running jar before `clean`**, or `maven-clean-plugin` fails on the
   locked file.

### Live check

`tsc` cannot prove the OData navigation path or the FK write. Backend on
`SPRING_PROFILES_ACTIVE=local` with `DB_PASSWORD`; frontend
`npm run dev -- --host`; log in as `16674475 / qweqweqwe`. Confirm:

- the leader renders in the list
- filtering by leader returns the right rows *and* a matching envelope count
- sorting by leader works ascending and descending
- creating a system with a leader succeeds
- PATCHing a leader onto an existing system succeeds
- the flow-graph details panel still shows the leader text

If the nav-path sort or filter fails against the live backend, that is a gate
failure: write it up as an issue doc rather than guessing at a fix.

## 9. Environment note: reading the live schema

The `mcp__cometa-postgres__*` tools connect to `192.168.0.60:5432/cometa`. They
originally did so as role `as_admin`, which owns only the seven auth tables; the
other twelve — `automated_system` among them — are owned by `GMBUS`, and
`as_admin` has no `SELECT`.

Because `information_schema` filters by privilege, those tables looked
**nonexistent rather than forbidden**: `information_schema.columns` returned zero
rows for `automated_system`. This cost real time while writing sections 1–6 and
is the reason every schema fact here was established through `pg_catalog`.

**Resolved 2026-09-04**: the MCP was repointed at the `GMBUS` role, so all 19
`gmsb` tables including row data are now readable. Two operational notes:

- Change it with `claude mcp remove cometa-postgres -s user` then
  `claude mcp add cometa-postgres -s user -- npx -y @henkey/postgres-mcp-server
  --connection-string "..."`. Use the CLI rather than hand-editing
  `~/.claude.json`, which Claude Code writes to during sessions.
- **The change only lands in a new session.** Each session spawns its MCP child
  process at startup and that process keeps its connection string for its
  lifetime. Forking a session does respawn it (verified). `SELECT current_user`
  is the one-line check.

Read DDL through `pg_catalog` instead, which is not privilege-filtered:
`pg_class` + `pg_namespace` to list tables, `pg_attribute` with
`format_type(atttypid, atttypmod)` and `attnotnull` for columns, `pg_constraint`
with `pg_get_constraintdef` for FKs. Every schema fact in this document was
established that way, and it remains the more reliable habit regardless of which
role is connected. The row counts quoted in sections 1 and 6 were read
afterwards, as `GMBUS`.

## Out of scope

- The `client_certificate` relation on `AutomatedSystem`
- Migrating existing `leader` free text into `leader_person_id`
- Renaming or removing `leaderSapId`
- Teaching `FlowGraphService` to fetch `automatedSystem.leader`
- Fixing Team's `detailQueryOptions` path (section 4)
- A Delete row action — Team does not have one either
