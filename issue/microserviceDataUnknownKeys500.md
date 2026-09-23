# `GET /node/{id}` returns 500 for microservices whose `data` has an unmodelled key

Found 2026-09-23 while verifying the Node→TechComponent link work against the
running backend. Pre-existing; unrelated to that change.

## Problem

`gmsb.node.data` is deserialized into `MicroserviceData` for `MICROSERVICE`
nodes. The class tree does not tolerate keys it does not model, so any node
carrying an unknown key fails the whole request:

```
org.springframework.dao.InvalidDataAccessApiUsageException:
  Could not deserialize string to java type: class ...node.microservice.MicroserviceData
caused by
com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException:
  Unrecognized field "not_necessary"
  (class ...microservice.component.ApplicationConfig$Spring$Profiles),
  not marked as ignorable (2 known properties: "include", "group")
```

Measured on the dev database: **14 of 1209 microservice nodes** carry
`spring.profiles.not_necessary`. For those ids both `GET /api/v1/node/{id}`
and `GET /api/v1/node/graph/{id}` return 500. The failure is in the read path,
so it is reachable by anything that reads one of those nodes.

`TopicData` and `NodeTechComponentLinkData` both tolerate unknown keys and are
unaffected — this is exactly the failure mode that tolerance avoids.

## Where to look

- Backend repo (`cometa`): `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/node/microservice/MicroserviceData.java`
  and `.../microservice/component/ApplicationConfig.java`
- Contrast: `.../node/topic/data/TopicData.java` (has `@JsonAnySetter`), and
  `.../entity/NodeTechComponentLinkData.java` (has the `@JsonAnySetter` /
  `@JsonAnyGetter` pair)
- Design discussing the tolerance decision for the new jsonb POJO:
  `cometa/docs/superpowers/specs/2026-09-22-node-tech-component-link-design.md`,
  section *The unknown-fields divergence*

Finding a current offender:

```sql
SELECT id, name FROM gmsb.node
 WHERE node_type = 'MICROSERVICE' AND data::text LIKE '%not_necessary%';
```
