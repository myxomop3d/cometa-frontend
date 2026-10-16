# `GET /flow-graph/{id}` returns 500 when a topic's `configuration.regular` has a `max` key

Found 2026-10-17 during live verification of the microservice page. A backend
defect, not a frontend one.

## Symptom

`GET /api/v1/flow-graph/{id}` returns 500 for flows 741 (IFT/UAT/PROD),
672 (IFT) and 1112 (IFT/PROD). The flow-graph page shows "Request failed: 500",
and every flow link on the new `/microservice` page lands on it.

## Backend log

```
org.springframework.dao.InvalidDataAccessApiUsageException:
  Could not deserialize string to java type: class ...topic.data.TopicData
caused by
com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException:
  Unrecognized field "max" (class ...topic.data.Configuration$Regular),
  not marked as ignorable (one known property: "max.message.bytes")
```

## Cause

`cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/node/topic/data/Configuration.java`,
`public static class Regular` (line 75). It declares only
`@JsonProperty("max.message.bytes")` (line 79) and has no `@JsonAnySetter`.
The topic jsonb rows carry the key nested, not dotted:

```json
"configuration": { "regular": { "max": { "message": { "bytes": 10485760 } } } }
```

so `max` is an unknown property of `Regular`.

## Fix direction (not fixed in this branch)

Add the same `@JsonAnySetter` unknown-fields map its siblings use:
`Configuration` itself (line 32, `private final Map<String, Object> unknownFields = new HashMap<>()`)
and `Configuration.Unsafe` (line 65). `Regular` is the only one of the three
without it. Note that mapping the nested shape to `maxMessageBytes` would be a
separate decision (see Open).

## Finding affected topics

```sql
SELECT id, name FROM gmsb.node
 WHERE node_type = 'TOPIC' AND data->'configuration'->'regular' ? 'max';
```

Live count on 2026-10-17: **2790 of 2824** topic nodes have the key (none have
the dotted `max.message.bytes` form). The failure only surfaces for flows whose
graph reads such a topic node.

## Open

Whether `max` (nested `max.message.bytes`) is legitimate Kafka config data
written by the loader in an expanded form, or a loader artifact. If legitimate,
`Regular.maxMessageBytes` never binds today and the model should follow the
real shape.
