# NodeAggregator: a second single-table hierarchy over Node

**Date:** 2026-09-15
**Status:** approved design, not yet implemented
**Builds on:** `docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`, `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md`, `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`
**Scope:** backend only (`F:\programming\cometa`). No frontend page; the UI gets its own spec once this API is settled.

## 1. What is being added

A `NodeAggregator` entity: a named group of `Node`s, many-to-many, with its own
single-table inheritance hierarchy mirroring `Node`'s. Its first subtype,
`MicroserviceNameAggr`, carries a one-field jsonb payload.

```
NodeAggregator          @DiscriminatorValue("NODE_AGGR")
├─ nodeAggrType         NodeAggrType, read-only discriminator attribute
├─ name                 String
└─ nodes                Set<Node>, owning @ManyToMany

MicroserviceNameAggr    @DiscriminatorValue("MICROSERVICE_NAME_AGGR")
└─ data                 MicroserviceNameAggrData (jsonb) { isNeedAT: boolean }
```

Delivered with it: a DDL migration, a repository, a DTO pair, a mapper, a
service and a REST controller at `/api/v1/node-aggregator`.

The design is deliberately a copy of the `Node` hierarchy wherever a copy is
possible. Every deviation from that template is called out below with its
reason; everything not called out is the `Node` pattern unchanged.

## 2. Decisions

### 2.1 The relation is owned by the aggregator, and only by it

`NodeAggregator.nodes` carries the `@JoinTable`. `Node` is not touched: no
inverse `Set<NodeAggregator>` field, no change to `NodeDto`, `NodeMapper`, or
any of the four Node subtypes.

This mirrors `Person.teams`, the codebase's only existing many-to-many, where
`Team` likewise has no inverse `persons`. The question an inverse would answer —
"which aggregators contain this node?" — is already answerable from the
aggregator endpoint:

```
GET /api/v1/node-aggregator?$filter=nodes/any(n: n/id in (12))
```

Adding the inverse later is possible but not free: `NodeDto` would need a
`NodeAggregatorFlatDto` ref type to break the cycle, `NodeMapper` would need an
ignore for it on every write path, and all four Node subtype DTOs would inherit
the field. Not now.

### 2.2 `nodes` is typed as `NodeDto`, not a new `NodeFlatDto`

The nested-relation-write standard types a relation as the child's *Flat* DTO,
and `Node` has no flat DTO. The alternative — inventing `NodeFlatDto` with
`name`, `environment`, `nodeType` — was rejected because a node is not
identifiable from those fields: `node` is unique on
`(name, node_type, automated_system_id, environment)`, so a flat read would show
`payments-api / MICROSERVICE / PROD` without saying which automated system owns
it. Nested reads therefore carry the full polymorphic `NodeDto`, including
`automatedSystem` and the subtype `data`.

The cost is that the nested object *looks* writable when it is not. Section 2.3
is the mechanism that keeps it read-only, and `NodeAggregatorDto.nodes` carries
a javadoc saying so.

### 2.3 Write disambiguation: `@Named("nodeRef")` qualifiers

`Person.teams` gets ambiguity for free because its two directions use different
type pairs — `Team → TeamFlatDto` for reads (`TeamMapper.toFlat`),
`TeamFlatDto → Team` for writes (`TeamRefMapper.toRef`). Reusing `NodeDto` on
both sides removes that separation: `NodeDto → Node` has two candidate methods.

| Candidate | What it does | Correct here? |
|---|---|---|
| `NodeMapper.fromDto` | builds a new detached `Node` from every field | No — would insert duplicate nodes on every aggregator write |
| `NodeRefMapper.toRef` | `em.getReference(Node.class, id)` | Yes |

MapStruct fails the build with "Ambiguous mapping methods found" rather than
picking one, so this cannot ship silently broken — but the fix has to be
explicit. Every write-direction method pins the collection:

```java
@Mapping(target = "nodes", qualifiedByName = "nodeRef")
```

and `NodeRefMapper` tags its inherited `toRef` with `@Named("nodeRef")`.

The read direction needs no qualifier: nothing other than `NodeMapper.toDto`
produces a `NodeDto` from a `Node`, so it resolves on its own and brings its
`@SubclassMapping` chain (Microservice / Topic / Egress / Ingress) with it.

Rejected alternative: drop `uses` and hand-write `default` bridge methods
delegating to injected mappers. Fully explicit, but ~30 lines re-implementing
collection iteration, and it makes `NodeMapper` a constructor dependency where
an annotation suffices.

### 2.4 `isNeedAT` is pinned with `@JsonProperty`

For `private boolean isNeedAT`, Lombok generates `isNeedAT()` / `setNeedAT()`,
from which Jackson derives the property name **`needAT`**. Since this class is
persisted as jsonb, that name is not merely an API detail — it is the stored
key, and changing it later means migrating rows. The field therefore carries
`@JsonProperty("isNeedAT")`, so the stored key and the API key both match the
field name.

### 2.5 Uniqueness: `(name, node_aggr_type)`

The closest analogue to `node`'s `UNIQUE (name, node_type, automated_system_id,
environment)` using the columns that exist. Two subtypes may share a name;
within a subtype the name identifies the row, which is what a picker needs.

### 2.6 New tables are owned by `GMBUS`

`ALTER TABLE gmsb.node_aggr OWNER TO "GMBUS";`

This changes the convention. Migrations `001`–`015` set `OWNER TO as_admin` and
then granted `GMBUS` the DML it needs; the application connects as `GMBUS`, so
ownership sat with a role that never uses the table. New tables are owned by
`GMBUS` from here on, with `as_admin` retained as a grantee. Existing tables are
not re-owned by this spec.

## 3. Persistence layer

New package `ru.sberbank.cib.gmbus.entity.nodeaggr`, with subpackage
`microservicebyname`.

**`entity/enums/NodeAggrType.java`**

```java
public enum NodeAggrType {
    NODE_AGGR,
    MICROSERVICE_NAME_AGGR;
}
```

**`entity/nodeaggr/NodeAggregator.java`**

```java
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "node_aggr", schema = "gmsb",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"name", "node_aggr_type"})
        })
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "nodeAggrType", discriminatorType = DiscriminatorType.STRING)
@DiscriminatorValue("NODE_AGGR")
public class NodeAggregator extends BaseEntity {

    @Setter(AccessLevel.NONE)
    @Enumerated(EnumType.STRING)
    @Column(name = "nodeAggrType", nullable = false, insertable = false, updatable = false)
    private NodeAggrType nodeAggrType;

    @Column(name = "name", nullable = false)
    private String name;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "node_aggr_node_link", schema = "gmsb",
            joinColumns = @JoinColumn(name = "node_aggr_id"),
            inverseJoinColumns = @JoinColumn(name = "node_id"))
    private Set<Node> nodes;
}
```

Two details carried over from `Node` that are load-bearing:

- **The discriminator is also mapped as a read-only attribute.** A discriminator
  is not an entity attribute, so without this mapping HQL/OData cannot resolve
  the path and `$filter=nodeAggrType eq 'MICROSERVICE_NAME_AGGR'` fails with
  `UnknownPathException`. `insertable = false, updatable = false` plus
  `@Setter(AccessLevel.NONE)` keep Hibernate the only writer.
- **The annotation name is camelCase; the physical column is not.** Spring
  Boot's default `CamelCaseToUnderscoresNamingStrategy` is a *physical* naming
  strategy and rewrites explicit `@Column`/`@DiscriminatorColumn` names too.
  Verified on the live schema: `@DiscriminatorColumn(name = "nodeType")` on
  `Node` is physically `node_type`. So `nodeAggrType` lands as
  **`node_aggr_type`**, which is the name the migration and the
  `@UniqueConstraint` must use.

**`entity/nodeaggr/microservicebyname/MicroserviceNameAggr.java`**

```java
@Entity
@Getter
@Setter
@NoArgsConstructor
@DiscriminatorValue("MICROSERVICE_NAME_AGGR")
public class MicroserviceNameAggr extends NodeAggregator {

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data", columnDefinition = "jsonb", nullable = false)
    private MicroserviceNameAggrData data;
}
```

`nullable = false` is a subtype-level assertion only. The physical column must
be nullable, because base `NODE_AGGR` rows have no `data`. This is not a
compromise invented here: `node.data` is nullable in the live database today
despite `Microservice.data` and `Topic.data` both declaring `nullable = false`.

**`entity/nodeaggr/microservicebyname/MicroserviceNameAggrData.java`**

```java
@Data
public class MicroserviceNameAggrData {

    @JsonProperty("isNeedAT")
    private boolean isNeedAT;
}
```

Used directly in the DTO, with no mapper — the same arrangement as
`MicroserviceData` in `MicroserviceDto`. MapStruct assigns identical types by
reference.

**`repository/NodeAggregatorCrudRepository.java`**

```java
@Repository
public class NodeAggregatorCrudRepository extends EntityGraphBaseCrudRepository<NodeAggregator, Long> {
}
```

## 4. Migration: `db-scripts/ddl/016_create_node_aggr.sql`

`spring.jpa.generate-ddl` is `false` and there is no Flyway/Liquibase, so the
migration is hand-written and applied by hand, following
`011_create_person_team_link.sql`'s shape: identity PK, column comments, owner,
grants.

```sql
CREATE TABLE gmsb.node_aggr (
    id int8 GENERATED ALWAYS AS IDENTITY (INCREMENT BY 1 MINVALUE 1
        MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL,
    name text NOT NULL DEFAULT '',
    node_aggr_type text NOT NULL,
    data jsonb NULL,
    inserted_at timestamp NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamp NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT node_aggr_pk PRIMARY KEY (id),
    CONSTRAINT node_aggr_unique UNIQUE (name, node_aggr_type)
);

CREATE TRIGGER set_timestamps BEFORE INSERT OR UPDATE ON gmsb.node_aggr
    FOR EACH ROW EXECUTE FUNCTION gmsb.populate_timestamp_columns();

CREATE TABLE gmsb.node_aggr_node_link (
    id int8 GENERATED ALWAYS AS IDENTITY (INCREMENT BY 1 MINVALUE 1
        MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL,
    node_aggr_id int8 NOT NULL,
    node_id int8 NOT NULL,
    inserted_at timestamp NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT node_aggr_node_link_pk PRIMARY KEY (id),
    CONSTRAINT node_aggr_node_link_unique UNIQUE (node_aggr_id, node_id),
    CONSTRAINT node_aggr_node_link_aggr_fk FOREIGN KEY (node_aggr_id) REFERENCES gmsb.node_aggr(id),
    CONSTRAINT node_aggr_node_link_node_fk FOREIGN KEY (node_id) REFERENCES gmsb.node(id)
);

ALTER TABLE gmsb.node_aggr OWNER TO "GMBUS";
ALTER TABLE gmsb.node_aggr_node_link OWNER TO "GMBUS";

GRANT ALL ON TABLE gmsb.node_aggr, gmsb.node_aggr_node_link TO "GMBUS";
GRANT ALL ON TABLE gmsb.node_aggr, gmsb.node_aggr_node_link TO as_admin;
```

Plus `COMMENT ON` for every table and column, matching the sibling migrations.

The grant to `GMBUS` is redundant with ownership — an owner already holds every
privilege — but it is written out anyway so the table's full privilege set is
readable from the migration alone, and so the file survives a future change of
owner without silently dropping the application's access.

The `DEFAULT clock_timestamp()` on `node_aggr`'s two timestamp columns is
belt-and-braces only — the trigger sets them on every insert and update. It
makes the table insertable by hand, which is how the sibling link tables behave.

Four points the shape encodes:

- `name text NOT NULL DEFAULT ''` — the no-null write standard. Clearing a name
  sends `""`, never `null`.
- `data jsonb NULL` — section 3, single-table inheritance.
- `set_timestamps` on `node_aggr` — `BaseEntity.insertedAt`/`updatedAt` are
  `NOT NULL` with no column default and no JPA auditing; the trigger is the only
  thing that populates them. Every entity table in `gmsb` has one.
- No trigger on the link table — `person_team_link` has none either; link tables
  carry `inserted_at DEFAULT clock_timestamp()` and no `updated_at`.

## 5. DTOs

New package `ru.sberbank.cib.gmbus.service.dto.nodeaggr`, with subpackage
`microservicebyname`.

**`NodeAggregatorDto`** extends `BaseEntityDto`, with the same Jackson
polymorphism envelope `NodeDto` uses:

```java
@JsonTypeInfo(use = Id.NAME, include = As.PROPERTY, property = "nodeAggrType", visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = NodeAggregatorDto.class, name = "NODE_AGGR"),
        @JsonSubTypes.Type(value = MicroserviceNameAggrDto.class, name = "MICROSERVICE_NAME_AGGR")
})
public class NodeAggregatorDto extends BaseEntityDto {

    protected final NodeAggrType nodeAggrType = NodeAggrType.NODE_AGGR;

    private String name;
    private List<NodeDto> nodes;
}
```

`List<NodeDto>` against a `Set<Node>` entity field, as `PersonDto.teams` does.
The discriminator field is `final`, so Lombok emits no setter and MapStruct
leaves it alone — Hibernate and Jackson each set it their own way.

**`MicroserviceNameAggrDto`** extends it, re-declaring the `final`
discriminator as `MICROSERVICE_NAME_AGGR` and adding
`private MicroserviceNameAggrData data;`.

`nodes` carries a javadoc stating the contract, because reads show more than
writes accept:

- **Read:** populated only under `?$fields=nodes` on the `/graph` route.
- **Write:** only `id` is honoured per element. The nested `name`,
  `automatedSystem` and `data` are ignored — a node's own fields change only
  through `/node`.
- **Semantics** (from `NullValuePropertyMappingStrategy.IGNORE`): absent or
  `null` leaves membership unchanged; `[]` clears it; a non-empty list replaces
  it wholesale.

## 6. Mappers

**`NodeRefMapper`** — `@Component`, `extends BaseRefMapper<Node, NodeDto>`,
overriding `toRef` for the sole purpose of tagging it `@Named("nodeRef")`.
Depends on `EntityManager` and nothing else: a `mapper → service` edge closes a
constructor bean cycle that Spring Boot 4 rejects at startup.

**`NodeAggregatorMapper`** — structurally a copy of `NodeMapper`:

```java
@Mapper(config = CometaCommonMapperConfig.class,
        uses = { NodeMapper.class, NodeRefMapper.class })
public interface NodeAggregatorMapper extends BaseCrudMapper<NodeAggregator, NodeAggregatorDto> {

    @Condition
    default boolean isNodesLoaded(Set<Node> nodes) {
        return Hibernate.isInitialized(nodes);
    }

    @Override
    @SubclassMapping(source = MicroserviceNameAggr.class, target = MicroserviceNameAggrDto.class)
    NodeAggregatorDto toDto(NodeAggregator source);

    @Override
    @SubclassMapping(source = MicroserviceNameAggrDto.class, target = MicroserviceNameAggr.class)
    @Mapping(target = "nodes", qualifiedByName = "nodeRef")
    NodeAggregator fromDto(NodeAggregatorDto dto);

    @Override
    @IgnoreIdField
    @Mapping(target = "nodes", qualifiedByName = "nodeRef")
    @BeanMapping(qualifiedByName = "update")
    void update(NodeAggregatorDto source, @MappingTarget NodeAggregator target);

    @Mapping(target = "nodes", qualifiedByName = "nodeRef")
    void updateMicroserviceNameAggr(MicroserviceNameAggrDto source, @MappingTarget MicroserviceNameAggr target);

    @AfterMapping
    @Named("update")
    default void afterUpdate(NodeAggregatorDto source, @MappingTarget NodeAggregator target) {
        if (source instanceof MicroserviceNameAggrDto dto && target instanceof MicroserviceNameAggr entity) {
            updateMicroserviceNameAggr(dto, entity);
        }
    }
}
```

`@Condition isNodesLoaded` is the guard `PersonMapper` uses for `teams`: without
`?$fields=nodes` the lazy `PersistentSet` is never touched, so `nodes` maps to
`null` instead of triggering N+1 or, under `open-in-view=false`, a
`LazyInitializationException`. As `PersonMapper`'s own comment records, the
condition binds to the read direction only — the write source is
`List<NodeDto>`, which does not fit a `Set<Node>` parameter.

No cycle is introduced: `NodeMapper` knows nothing about aggregators, which is a
direct consequence of decision 2.1.

## 7. Service and controller

```java
@RequiredArgsConstructor
@Service
public class NodeAggregatorService extends EntityGraphBaseCrudService<NodeAggregator, NodeAggregatorDto, Long> {
}
```

```java
@AllArgsConstructor
@Tag(name = "NodeAggregator", description = "Агрегаторы нод")
@RestController
@RequestMapping("/api/${application.api.version}/node-aggregator")
public class NodeAggregatorRestController extends EntityGraphBaseCrudController<NodeAggregatorDto, Long> {
}
```

Both are empty subclasses. The service inherits `@Transactional` `create` /
`update` / `patch` — the single read-map-merge transaction without which a
generated `target.getNodes().clear()` throws `LazyInitializationException` under
`open-in-view=false` — and the `$fields` entity-graph handling of `getAll` /
`getById`.

No class-level `@Transactional` on the controller, mirroring
`PersonRestController`, which has the analogous lazy many-to-many and works.
`NodeRestController` carries one, but a transactional controller is an
anti-pattern not worth propagating. Section 9 exercises the read path that would
expose this if the reasoning is wrong; if it throws, the fix is to add it.

`MicroserviceNameAggr` gets **no** service or controller of its own. It is
reachable polymorphically through `/node-aggregator`, discriminated by
`nodeAggrType` in the request and response body. (`Topic` has its own pair, but
only because `TopicService.findByName` needed a home; `Microservice`, `Egress`
and `Ingress` have none.)

No `SecurityConfig` change: `anyRequest().authenticated()` already covers the
route, and writes are gated by the `CREATE` / `UPDATE` / `DELETE` authorities on
`EntityGraphBaseCrudController`.

## 8. OData behaviour inherited from the platform

| Query | Supported |
|---|---|
| `$filter=nodeAggrType eq 'MICROSERVICE_NAME_AGGR'` | Yes, via the read-only discriminator attribute |
| `$filter=nodes/any(n: n/id in (12,13))` | Yes, with constraints below |
| `$orderby=nodes/...` | No — to-many relations are never sortable |
| `$fields=nodes` | Yes, routes through the two-query paged-then-fetch path |

The `any()` constraints are odata-mini 2.2.0's, not this design's: the clause
must be **last** in the `$filter` and there may be **at most one** per request,
because the library corrupts the root alias for every clause following an
`any()`. Both forms also require `odata.mini.repo.throw-on-field-not-found:
false`, which `application.yaml` already sets.

`$fields=nodes` together with `$top`/`$skip` triggers
`EntityGraphBaseCrudRepository.readAllPagedThenFetch`: a collection in the fetch
graph would otherwise make Hibernate paginate in memory (HHH90003004), so the
page of root ids is read first with real `LIMIT`/`OFFSET` and the graph fetched
by those ids.

## 9. Verification

1. `mvn install`, then **confirm the generated `NodeAggregatorMapperImpl`
   actually declares `implements NodeAggregatorMapper`.** Forked compilation in
   this build intermittently strips it; the symptom surfaces far downstream as
   "required a bean of type ...NodeAggregatorMapper". Check the generated file,
   not just the build's exit code.
2. Apply `016` to the local database.
3. **`NodeAggregatorMapperWriteTest`**, modelled on `PersonMapperWriteTest`:
   instantiate the generated impl with a mocked `NodeRefMapper`, then assert
   - `nodes` absent → membership unchanged; `[]` → cleared; non-empty →
     replaced wholesale;
   - `fromDto` routes every element through `NodeRefMapper.toRef` and never
     through `NodeMapper.fromDto` — the test that catches a missing or misspelled
     `qualifiedByName`;
   - a `MicroserviceNameAggrDto` source produces a `MicroserviceNameAggr` with
     its `data` set, through the `@AfterMapping` dispatcher.
4. **`MicroserviceNameAggrDataJsonTest`**, in the style of the existing
   `JsonMapperTest`s: round-trip the class and assert the serialized key is
   `isNeedAT`, not `needAT`.
5. Live API pass against the running backend:
   - `POST /api/v1/node-aggregator` with `nodeAggrType: "NODE_AGGR"`;
   - `POST` with `nodeAggrType: "MICROSERVICE_NAME_AGGR"` and
     `data: { "isNeedAT": true }`; confirm the stored jsonb key in the database;
   - `GET /api/v1/node-aggregator/graph/{id}?$fields=nodes` — the read that
     would expose a missing controller `@Transactional`;
   - `GET /api/v1/node-aggregator/graph?$fields=nodes&$top=5` — the
     paged-then-fetch path;
   - `PATCH` with `nodes: []` and with `nodes: [{id}, {id}]`; confirm
     `node_aggr_node_link` rows and that no new `node` rows appear;
   - both `$filter` forms from section 8;
   - `POST` a duplicate `(name, nodeAggrType)` and confirm the constraint fires.

## 10. Out of scope

- Any frontend work. No route, no `features/node-aggregator/`, no sidebar entry.
- An inverse `Node.aggregators` relation (2.1).
- A dedicated service or controller for `MicroserviceNameAggr` (section 7).
- Re-owning existing tables to `GMBUS` (2.6) — the new convention applies to new
  tables only.
