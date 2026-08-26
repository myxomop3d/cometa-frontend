# Nested relation writes: a standard, and Person team membership

Date: 2026-08-27
Status: approved design, not yet implemented

## Problem

The `/person` add/edit panel cannot set team membership. `PersonMapper` carries
`@Mapping(target = "teams", ignore = true)` on both `fromDto` and `update`, so a
request body containing `teams` is silently accepted and silently discarded. The
only code that ever writes `gmsb.person_team_link` is `RegistrationService`.

Fixing this for Person alone would be a one-off. The underlying question is how
*any* entity should write *any* relation, so this document defines that standard
and makes Person and Team its first two instances.

**The rule:** a parent may create, replace and clear links to child entities
through its own create/update/patch. A parent may never modify a child's own
fields; that is only possible through the child's controller.

## Decisions

| Question | Decision |
|---|---|
| Scope | Backend (`F:\programming\cometa`) and frontend both |
| Wire shape | Nested ref object, e.g. `teams: [{id: 3}]`. No `xxxId` DTO fields |
| Relation payload type | Flat DTO — every scalar of the child, none of its relations |
| Id to entity | `EntityManager.getReference`, no existence check |
| Bad child id | FK violation at flush, surfacing as 500. Accepted |
| Picker | `RelationPicker` `multi`, `variant="field"` |
| Teams field | Optional; present on both create and edit |
| `Team.leaderId` entity column | Removed, behind a live-verification gate (section 7) |

### Rejected: `getRef` on `EntityGraphBaseCrudService`

A generic `MODEL getRef(DTO)` on the base service would substitute to a concrete
`getRef(TeamDto): Team` on `TeamService`, and MapStruct 1.5.5 does resolve
methods through parameterized supertypes. **The bean graph would not start.**
`CometaCommonMapperConfig` sets `InjectionStrategy.CONSTRUCTOR`, and the
generated `TeamMapperImpl(PersonRefMapper, PersonMapper)` confirms constructor
injection:

```
PersonMapperImpl  --ctor-->    TeamService
TeamService       --setter-->  TeamMapperImpl     (@Autowired setMapper)
TeamMapperImpl    --ctor-->    PersonMapper   <-- already in creation
```

`setMapper` runs during `TeamService`'s population, which completes before
`TeamService` reaches `PersonMapperImpl`'s constructor, so no early reference
exists. Spring Boot 4.0.6 with `allow-circular-references` unset (default
`false`) fails at startup with `BeanCurrentlyInCreationException`. Any
mapper-to-service `uses` edge closes this loop, because every service pulls its
own mapper and the mappers already reference each other.

Ref resolution therefore stays in the mapper layer, depending on
`EntityManager` only.

## 1. DTO layer: Flat / Full pairs

```
BaseEntityDto (id, insertedAt, updatedAt)
├── PersonFlatDto (email, lastName, firstName, middleName)
│   └── PersonDto (+ teams: List<TeamFlatDto>)
└── TeamFlatDto (name, code, type, leaderRole, structure)
    └── TeamDto (+ leader: PersonFlatDto)
```

A **Flat** DTO carries every scalar of its entity and none of its relations. A
**Full** DTO extends its Flat and adds relations, each typed as the *child's
Flat* DTO. `BaseEntityDto` already declares `id`, so it is the ref contract —
no separate `EntityRefDto` is needed.

This terminates recursion structurally rather than by omission. `TeamSummaryDto`
avoided the `TeamDto.leader -> PersonDto.teams -> TeamDto` cycle by leaving out
`leader`; Flat types make that a property of the type system, so
`TeamDto.leader` and `PersonDto.teams[]` both stop after one hop.

`TeamSummaryDto` is renamed and widened into `TeamFlatDto`. `TeamDto.leaderId`
is deleted.

### Known trade-off

A Flat DTO on the write side accepts fields it will not honour: a client may
send `teams: [{id: 3, name: "Renamed"}]` and the rename is silently dropped. A
strict id-only ref type would make that unrepresentable. Flat was chosen anyway
because it gives read consumers the child's full scalar set from one request,
and because the alternative — a full DTO — reintroduces the recursion. This is
a deliberate trade, recorded so it is not rediscovered later as a defect.

## 2. Mapper layer

```java
public abstract class BaseRefMapper<E, R extends BaseEntityDto> {
    @Autowired protected EntityManager em;
    protected abstract Class<E> entityType();
    public E toRef(R ref) {
        return ref == null || ref.getId() == null
             ? null
             : em.getReference(entityType(), ref.getId());
    }
}

@Component
public class TeamRefMapper extends BaseRefMapper<Team, TeamFlatDto> {
    @Override protected Class<Team> entityType() { return Team.class; }
}

@Component
public class PersonRefMapper extends BaseRefMapper<Person, PersonFlatDto> {
    @Override protected Class<Person> entityType() { return Person.class; }
}
```

`getReference` returns a lazy proxy; Hibernate reads only the identifier from it
to write the FK or the join-table row. No `toRef(Long)` overload: `leaderId` was
its only caller and is being removed. `LinkDto`'s `flowId`, `clientNodeId`,
`serverNodeId` and `principalId` are plain scalars with no `@ManyToOne` behind
them, so there is nothing else to serve.

Per new relation, the cost is a four-line `XxxRefMapper` plus one entry in the
consuming mapper's `uses`.

**`PersonMapper`** — add `uses = TeamRefMapper.class`; delete both
`@Mapping(target = "teams", ignore = true)`; rename `toSummary(Team)` to
`TeamFlatDto toFlat(Team)`. MapStruct then maps `List<TeamFlatDto>` to
`Set<Team>` element-wise through `toRef`. `@Condition isTeamsLoaded(Set<Team>)`
is unchanged and applies only to the read direction, because the write source
property is `List<TeamFlatDto>`, which does not match its parameter type.

**`TeamMapper`** — delete `@Mapping(target = "leader", source = "leaderId")`;
`leader` now maps `PersonFlatDto` to `Person` through `PersonRefMapper` by
signature. Declare `PersonFlatDto toFlat(Person)` locally for the read
direction, which allows `uses = PersonMapper` to be dropped — one fewer
mapper-to-mapper edge in the bean graph.

`@Mapping(target = "leaderId", ignore = true)` is retained on `fromDto` and
`update` **only if** `Team.leaderId` survives section 7's gate. If the column is
removed, the annotation goes with it. If the gate fails and the column stays,
the annotation is still required, because the target property would otherwise
have no source and trip the unmapped-target warning.

### Verify at build, do not assume

Two MapStruct behaviours are asserted here from documentation rather than from a
run, and the build is the cheapest place to find out:

1. Whether `toRef(R)` resolves through the generic supertype, or whether each
   subclass needs a one-line concrete override. The override costs nothing; add
   it if the processor does not resolve the inherited method.
2. Whether two ref mappers in one `uses` stay unambiguous. They should —
   MapStruct resolves on target type as well as source, and `Team` is not
   `Person`.

## 3. Service layer

`spring.jpa.open-in-view` is `false`. `BaseCrudService.patch` calls
`repository.readById(id)`, which is **not** `@Transactional` — it is a bare
`entityManager.find`. Outside a transaction Spring creates a temporary
`EntityManager`, runs `find`, and closes it, so the entity comes back
**detached**. MapStruct's generated collection update is:

```java
if ( source.getTeams() != null ) {
    if ( target.getTeams() != null ) {
        target.getTeams().clear();
        target.getTeams().addAll( ... );
    } else {
        target.setTeams( ... );
    }
}
```

`target.getTeams()` on a detached entity returns a non-null uninitialized
`PersistentSet`, and `.clear()` throws `LazyInitializationException`. Scalar
fields never expose this; a collection does immediately.

`EntityGraphBaseCrudService` gains `@Transactional` overrides of `create`,
`update` and `patch` that delegate to `super`, using
`org.springframework.transaction.annotation.Transactional` to match
`RegistrationService` and `FlowGraphService`. Read, map and merge then share one
persistence context, so the collection is live and `getReference` proxies are
bound to an open session.

All seven subclasses inherit it — `AutomatedSystemService`, `FlowService`,
`LinkService`, `NodeService`, `PersonService`, `TeamService`, `TopicService`.
Spring resolves the annotation on the inherited method, so no subclass changes.
`delete` and `deleteAll` are left alone; they are already transactional at the
repository.

This also removes existing luck rather than only enabling new behaviour.
`TeamMapper.fromDto` already calls `getReference` outside any transaction; it
survives only because a `HibernateProxy` retains its identifier after its
session closes.

### Consequence: the response body is not a contract

After `mapper.update` touches the collection, the trailing `mapper.toDto` may
find `teams` initialized and render names, costing one SELECT per referenced
team. Whether it does depends on whether `merge` returns the same instance.
**The frontend must not depend on the response carrying `teams`.** It already
relies on `invalidateQueries` instead, and that stays the contract.

### Consequence: six other entities change transaction scope

Broadening the transaction turns "would throw `LazyInitializationException`"
into "would lazily load" for the other six. Since those write paths work today
they cannot be mapping lazy associations, so no behaviour should change — but
that is an argument, not evidence, and section 8 turns it into a smoke test per
entity.

## 4. Team migration

Behaviour-preserving on the surface; it is the phase that risks a shipped page.

Backend: `TeamDto.leaderId` deleted, `leader` retyped to `PersonFlatDto`,
`TeamMapper` as described in section 2.

Frontend:

- `types/api.ts` — add `PersonFlatDto`; `PersonDto extends PersonFlatDto`;
  `TeamSummaryDto` becomes `TeamFlatDto`; `TeamDto extends TeamFlatDto` with
  `leader: PersonFlatDto | null` and no `leaderId`. `TeamFilters.leaderId`
  **stays** — it is a filter parameter, not a DTO field.
- `team/filter-descriptors.ts` and `team/advanced-api.ts` — `field: "leaderId"`
  becomes `field: "leader/id"`, **only if section 7's gate passes**. Do not
  confuse the two `leaderId` spellings in these files: `field` is the OData
  path and changes with the gate; `filterKey` is the URL search-param name and
  **never** changes, because renaming it would break bookmarked URLs.
- `team/schema.ts` — `TeamFormValues.leaderId` stays `number`; the form speaks
  ids, the wire speaks refs. `TeamWritePayload.leaderId` becomes
  `leader: { id: number }`.
- `team/mappers.ts` — read `dto.leader?.id ?? 0`; write `leader: { id: v.leaderId }`.
- `team/columns.tsx:131` — `cell.getValue<PersonDto | null>()` becomes
  `PersonFlatDto | null`.
- `TeamSheet.tsx` — untouched; the form field keeps its name.

### Regression: the leader id becomes conditional

`leaderId` arrives on every Team read today. Afterwards the leader's id arrives
only with `$fields=leader`. The list sets that through `staticParams`, so
TeamSheet-opened-from-a-row is unaffected. `/api/v1/team/{id}` does not, so
`teamDtoToForm` on a detail-fetched Team would yield `leaderId: 0` and render as
"Leader is required". Nothing calls that path today — `TeamCombobox` reads only
`name` — but this becomes a standing invariant. Add `$fields=leader` to the
detail path defensively.

### Regression: a widened null

`TeamFlatDto.name` is `string | null` because the column is nullable, where
`TeamSummaryDto.name` was `string`. The Person Teams column's
`teams.map(t => t.name).join(", ")` needs null handling.

### Obsolete test

`team/mappers.test.ts`'s *"takes leaderId from the scalar, not the nested
object"* loses its subject. Delete it; do not adapt it.

## 5. Person team membership

Backend behaviour, from `NullValuePropertyMappingStrategy.IGNORE` in
`CometaCommonMapperConfig` — no new code needed for the semantics:

| body | effect |
|---|---|
| `teams` absent or null | membership unchanged |
| `teams: []` | all memberships cleared |
| `teams: [{id: 3}, {id: 7}]` | membership replaced with exactly {3, 7} |

Frontend:

- `personFormSchema` gains `teamIds: z.array(z.number().int().positive())`.
  `PersonWritePayload` gains `teams?: { id: number }[]`.
- `personDtoToForm` — `teamIds: dto.teams?.map(t => t.id) ?? []`.
- `personFormToCreate` — `teams: v.teamIds.map(id => ({ id }))`.
- `PersonSheet` — a `Controller` for `teamIds` rendering `RelationPicker` with
  `multi`, `variant="field"`, `teamsFilteredQueryOptions`, and the `{id, name}`
  column shape already defined in `person/columns.tsx`.
- `applyServerErrors` — alias a server `target: "teams"` onto the `teamIds`
  field. Inert given `getReference`, but one line.

No extra fetch is needed: both `person/api.ts` `staticParams` and
`advanced-api.ts:46` request `$fields=teams` unconditionally, so the row already
carries `teams`.

### The two sharp edges

These are the whole risk of this section.

1. **`RelationPicker.onChange` emits `undefined` when cleared**, not `[]` — see
   `handleConfirm`. The `Controller` must normalize to `[]`, or the schema
   breaks and "remove from all teams" is silently lost.
2. **`personFormToPatch` must not use `dirtyFields` for teams.** Its `isDirty`
   helper returns `false` for an empty array, so clearing every team would
   no-op. Pass the original id list in and compare order-independently:

```ts
export function personFormToPatch(
  v: PersonFormValues,
  dirty: PersonDirtyFields,
  originalTeamIds: number[],
): Partial<PersonWritePayload> {
  // ... scalar fields unchanged ...
  if (!sameIdSet(v.teamIds, originalTeamIds)) {
    out.teams = v.teamIds.map((id) => ({ id }));
  }
  return out;
}
```

## 6. Error handling

`getReference` does not check existence, so a nonexistent child id fails at
flush as an FK violation and surfaces as a 500 with a generic "Failed to save"
toast, not a field-targeted message. Accepted: `RelationPicker` can only emit
ids it has just read from the server, so the UI cannot realistically produce
one. The escape hatch, if it is ever needed, is to swap `getReference` for
`em.find` inside `BaseRefMapper` and throw a targeted exception — one method, no
mapper changes.

## 7. Verification gate: removing `Team.leaderId`

`Team.leaderId` is an entity column, read-only via
`@Column(insertable = false, updatable = false)` over `leader_person_id`. Its
javadoc justifies it by `getPathExpression` calling `root.fetch(...)` for dotted
paths while `createCountQuery` applies the same predicate. **That rationale is
void.** It describes `ODataCriteriaService`, and
`2026-08-26-odata-relation-filter-sort-design.md` establishes that Cometa uses
only `BaseCrudRepository.readAll(ODataParams)`; `ODataCriteriaService` is never
instantiated anywhere in the backend. Nav-path filtering is live-verified
count-safe: `contains_ignoring_case(leader/lastName, '...')` emits
`LOWER(leader.lastName) LIKE ...` and returns 200 with `count=1`.

Sort never used the scalar — `sortField` is already `leader/lastName`. Only
filtering does, via `field: "leaderId"` in `team/filter-descriptors.ts` and
`team/advanced-api.ts`.

`leader/id` is **not** in that verification matrix. Hibernate normally resolves
`manyToOne.id` to the FK column without a join, but reasoning from the code
instead of from a run is exactly how `issue/relationSorting.md` reached a
conclusion that turned out to be wrong. So this is a gate, not an assumption.

**Capture the baseline before removing the column**, against the running backend
with a real leader id:

```
GET /api/v1/team?$filter=leaderId eq <id>
GET /api/v1/team?$filter=leaderId in (<id1>,<id2>)
```

Then, after removal, assert identical row sets **and identical envelope
`count`**:

```
GET /api/v1/team?$filter=leader/id eq <id>
GET /api/v1/team?$filter=leader/id in (<id1>,<id2>)
GET /api/v1/team?$filter=leader/id eq null
GET /api/v1/team/graph?$fields=leader&$orderby=leader/lastName desc
```

The `eq null` probe exists because `config/data-table.ts` grants the `relation`
variant `isEmpty`/`isNotEmpty`, which emit that spelling. It is moot for Team —
`leader_person_id` is `nullable = false` — but it decides whether those
operators remain safe for nav-path relations generally.

**If any probe fails**, do not force the change: keep the `Team.leaderId`
*entity* column, keep `field: "leaderId"` as the filter spelling, correct the
javadoc to record that its stated rationale is void while the column is retained
for the verified filter path, and write the failure to
`issue/leaderIdNavPathFilter.md`.

Note what the fallback does *not* undo: `TeamDto.leaderId` stays deleted either
way. The DTO field and the entity column are separate decisions — the DTO field
is removed because relations are expressed as refs (section 1), which holds
regardless of how filters are spelled. Only the entity column and the `field`
spelling ride on this gate, and both are separable from everything else in this
document.

## 8. Testing

Frontend:

- `person/mappers.test.ts` — dto-to-form with teams, without teams, and with
  `[]`; form-to-create; form-to-patch across add, remove, clear-all and
  unchanged.
- `team/mappers.test.ts` — rewrite the `leaderId` cases against the nested
  `leader`; delete the obsolete scalar-precedence test.
- `team/filter-descriptors.test.ts` — update the expected `$filter` only if
  section 7's gate passes.

Backend:

- Person create and patch integration tests asserting `person_team_link` rows
  for each of the three body shapes in section 5.
- A create/patch smoke test per entity for the transaction-scope change
  (section 3) — seven entities, cheap, and the only real evidence that
  broadening the transaction changed nothing.
- Application-context startup test, which is what catches a bean cycle if the
  mapper wiring is got wrong.

## 9. Phasing

Two phases, in order. Phase 1 is the larger and riskier half of what began as
"add teams to a panel", and it lands and is verified on its own.

**Phase 1 — the standard, plus the Team migration.** Sections 1 to 4 and 7. No
user-visible change. Verified by: the app starts, `/team` create and edit still
work end to end, and section 7's gate either passes or the column is retained.

**Phase 2 — Person team membership.** Section 5. Small once Phase 1 is in.

## Risks

| Risk | Mitigation |
|---|---|
| Mapper wiring creates a bean cycle | Context startup test; ref mappers depend on `EntityManager` only |
| MapStruct will not resolve `toRef(R)` through the generic supertype | Found at build; fix is a one-line override per subclass |
| Broadened transaction changes another entity's write | Per-entity smoke tests (section 8) |
| `leader/id` filter is not equivalent | Section 7 gate with a pre-captured baseline; fall back to keeping the column |
| Leader id missing without `$fields=leader` | Add `$fields=leader` to the Team detail path |
| Cleared teams silently no-op | Do not use `dirtyFields`; compare id sets (section 5) |
