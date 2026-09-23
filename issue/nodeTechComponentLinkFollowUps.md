# Node→TechComponent link — deferred follow-ups

Raised during the TechComponent resource and Node→TechComponent link work
(backend repo `cometa`, spec
`docs/superpowers/specs/2026-09-22-node-tech-component-link-design.md`, plan
`docs/superpowers/plans/2026-09-23-node-tech-component-link.md`, implemented on
`feature/gm` as `934f26d..1cf22a3`). None blocked the work; all were triaged as
safe to defer. Recorded so they are not rediscovered as defects.

**Split out into their own documents, because each is a problem in its own
right rather than a note on this change:**

- `issue/microserviceDataUnknownKeys500.md` — `GET /node/{id}` returns 500 for
  14 of 1209 microservices.
- `issue/nodeDtoFieldsLeakIntoTopicMapper.md` — a new `NodeDto` field is
  silently regenerated into `TopicMapper`; also the missing `TopicMapper`
  write-path test.
- `issue/incrementalMavenBuildCorruption.md` — `./mvnw test` without `clean`
  fails test compilation.
- `issue/putReplacesInsteadOfUpdating.md` — `PUT /{id}` may insert rather than
  update, across all eight CRUD resources.
- `issue/automatedSystemNotNullInsertHazard.md` — `POST /automated-system`
  writes SQL NULL into 15 NOT NULL columns; the same defect just fixed on
  `TechComponent`, with a worked fix to copy.

## Deferred items

**`TopicData` corrupts unknown keys on read-modify-write.** It places
`@JsonAnySetter` on a Lombok-`@Data` field with no matching `@JsonAnyGetter`,
so the generated `getUnknownFields()` makes Jackson re-serialize unknown keys
as a nested `"unknownFields": { ... }` object instead of at top level. Harmless
today because nothing writes `topic.data` through the mapper. The spec's *The
unknown-fields divergence* section documents the failure and why
`NodeTechComponentLinkData` deliberately does it differently.

**`tmp/Scripts20260703/schema-DDL.sql` is stale and actively misleading.** It
predates migration `014` and still shows `tech_component.technology`,
`console_url` and `info_url` as nullable, and it is the first thing a reader
finds when grepping for a table definition. It sent the first pass of this
design down the wrong path. Either refresh it, mark it as a dated snapshot, or
remove it — the live database is the source of truth.

**`?$fields=...,techComponentLinks.techComponent.automatedSystem` no longer
resolves.** The nested `techComponent` is `TechComponentFlatDto`, which has no
`automatedSystem` field at all. This was the fix for a payload defect — the
flow graph was serialising 60 copies of the same automated system, 24.1% of a
230 KB response — and it is recorded in the spec's *Known gaps*. If a consumer
needs a tech component's automated system, it comes from
`/api/v1/tech-component/graph/{id}?$fields=automatedSystem`; there are 30 tech
components. Flagged here only so the removed path is not mistaken for a
regression.

## Frontend

Nothing in this work touched the frontend. Two payload shapes changed and are
worth knowing before wiring UI to them:

- every `NodeDto` now carries `techComponentLinks`, `null` unless requested via
  `$fields` on a `/graph` route;
- `/api/v1/flow-graph/{id}` now returns `techComponentLinks` on every node
  **unconditionally** — a deliberate, recorded decision, not an accident. The
  response for one measured flow grew from roughly 185 KB to 230 KB before the
  flattening fix brought it back to 185 KB.
