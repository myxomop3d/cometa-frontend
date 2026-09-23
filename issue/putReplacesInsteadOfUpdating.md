# `PUT /api/v1/<resource>/{id}` may insert a new row instead of updating

Raised by the whole-branch review of the Node→TechComponent link work,
2026-09-23. Pre-existing and, if confirmed, affects **every** CRUD resource
built on the shared base classes, not just the one added by that work.

## Problem

As reported by the review: the library's `BaseCrudService.update` calls
`mapper.fromDto(dto)` and then `repository.update(entity)`, which is an
`EntityManager.merge`. `BaseEntity` carries `@Getter` only, so MapStruct has
no setter for `id` and the generated `fromDto` never assigns it — a `merge`
with a null identifier persists a **new** row rather than updating the
addressed one.

Eight resources sit on this base today: `AutomatedSystem`, `Flow`, `Link`,
`Node`, `NodeAggregator`, `Person`, `Team`, `TechComponent`.

**Not independently confirmed end-to-end.** The reasoning was traced through
the generated mappers and `BaseEntity`, but no live `PUT` was executed against
a row to observe an insert. Worth reproducing before acting — and worth
checking whether `PATCH` (which routes through `update(source, @MappingTarget target)`
on a managed entity) behaves differently, since that is the path the UI
actually uses.

## Where to look

- Backend repo (`cometa`): `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/entity/BaseEntity.java`
  (no `@Setter` on `id`), `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/EntityGraphBaseCrudService.java`,
  and `ru.sber.cs.core.odata.mini.repo.service.BaseCrudService` in the
  `odata-mini-repo` dependency
- Generated `*MapperImpl.fromDto` under
  `cometa-service-module/target/generated-sources/annotations/` — confirm `id`
  is absent from every one
- `cometa/docs/superpowers/specs/2026-09-22-node-tech-component-link-design.md`
  — the design that added the eighth such resource
