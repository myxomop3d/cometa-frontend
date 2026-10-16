# Microservice links that bypass the EGRESS/INGRESS pairing

Found 2026-10-16 while designing the microservice overview page (topics per
microservice, filter by topic name). A data problem in `gmsb.link`, not a code
defect. Decision: **treat these as DB issues; the overview page does not model
them** and reads topics only through the canonical pair below.

## The canonical shape

A microservice reaches a topic through **two links sharing one `cross_guid`**:

```
MICROSERVICE --link l (client=MS, server=EGRESS)--> EGRESS
EGRESS       --link l2 (client=EGRESS, server=TOPIC)--> TOPIC
```

Verified live: 1596 such pairs over 982 microservices; every `cross_guid` group
has exactly 2 links (none larger), and `l.flow_id = l2.flow_id` in all 1596.

```sql
SELECT m.name, t.name
FROM gmsb.node m
JOIN gmsb.link l  ON m.id = l.client_node_id
JOIN gmsb.link l2 ON l.cross_guid = l2.cross_guid AND l2.id <> l.id
JOIN gmsb.node t  ON l2.server_node_id = t.id
WHERE m.node_type = 'MICROSERVICE' AND t.node_type = 'TOPIC';
```

## Problem 1: direct MICROSERVICE → TOPIC links

| | |
|---|---|
| Links | 183 (`protocol = KAFKA`) |
| Microservices | 46, all on `IFT` |
| `cross_guid` partner | **none**: each link is alone in its `cross_guid` group |
| Sample link id | `117521` |

The MS's `client_node_id` points straight at a `TOPIC` node. There's no EGRESS hop
and no paired link. The canonical query above does not see these topics.

```sql
SELECT l.id, m.name ms, t.name topic, m.environment, l.flow_id, l.cross_guid
FROM gmsb.link l
JOIN gmsb.node m ON m.id = l.client_node_id AND m.node_type = 'MICROSERVICE'
JOIN gmsb.node t ON t.id = l.server_node_id AND t.node_type = 'TOPIC';
```

## Problem 2: INGRESS → MICROSERVICE links (TOPIC→INGRESS→MS)

| | |
|---|---|
| Links | 227 (`protocol` in `REST`, `SOAP`) |
| Microservices | 224, on `IFT`, `UAT`, `PROD` |
| `cross_guid` partner | **none**: each link is alone in its `cross_guid` group |
| Sample link id | `118225` |

The microservice is the **server** side and an `INGRESS` node is the client. No
paired link exists, so nothing connects the ingress to the topic (or other node)
it should come from.

```sql
SELECT l.id, i.name ingress, m.name ms, m.environment, l.protocol, l.flow_id, l.cross_guid
FROM gmsb.link l
JOIN gmsb.node m ON m.id = l.server_node_id AND m.node_type = 'MICROSERVICE'
JOIN gmsb.node i ON i.id = l.client_node_id AND i.node_type = 'INGRESS';
```

## Impact

- The microservice overview page's topic list and topic-name filter omit these
  links (by decision, see top).
- The flow graph renders them as dangling edges with no cross-system partner,
  because cross-guid highlighting has nothing to pair with
  (`docs/superpowers/specs/2026-07-27-flow-graph-cross-guid-highlight-design.md`).

## Open

Fix at the source (the loader that produced `gmsb.link`): either emit the
missing EGRESS/INGRESS leg, or confirm these are legitimate shapes. If they are
legitimate, the overview read model gets a second topic path.
