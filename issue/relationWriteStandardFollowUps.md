# Relation-write standard — deferred follow-ups

Raised during review of the nested-relation-write standard
(`docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`,
implemented across `feature/gm`). None of these blocked the merge; a final
whole-branch review triaged every one as safe to defer. Recorded here so they
are not rediscovered as defects.

## Backend (`F:\programming\cometa`)

**`BaseRefMapper` uses field injection plus `@NonFinal`.** The repo-root
`lombok.config` sets `fieldDefaults.defaultFinal=true`, with per-package
overrides under `entity`, `dto`, `dto/nodes`, `exception` and `test/service` —
but **not** under `mapper`. So an unannotated field there is blank-final and
`@Autowired` cannot inject it, which is why `em` carries `@NonFinal`.
Constructor injection would need no escape hatch, would match
`CometaCommonMapperConfig`'s `InjectionStrategy.CONSTRUCTOR`, and would be
testable without reflection — at a cost of roughly two lines per subclass.
Worth doing if a `mapper/lombok.config` is ever added, or on the next touch.

**`TeamMapper.toFlat(Person)` is public and proxy-unsafe.** Because
`@Condition isEntityLoaded(Person)` matches on the *source parameter type*,
MapStruct wraps all seven property assignments in that check. Calling
`toFlat` directly with an uninitialised proxy therefore returns a **non-null**
`PersonFlatDto` with every field null — including `id` — rather than null.
Harmless today: the only caller is the generated `TeamMapperImpl`, which
already guards. `PersonMapper.toFlat(Team)` is clean by contrast, because its
condition is `Set<Team>`-typed.

**Condition-method naming is misleading in the opposite direction.**
`PersonMapper.isTeamsLoaded(Set<Team>)` is effectively property-scoped, while
`TeamMapper.isEntityLoaded(Person)` is type-scoped and will silently apply to
any future `Person`-typed source property on that mapper. The behaviour is
correct; the names imply the reverse scopes.

**A malformed ref surfaces as a 500, not a 4xx.** `BaseRefMapper` throws
`IllegalArgumentException` when a ref object carries no id, but there is no
`@ControllerAdvice`/`@ExceptionHandler` anywhere in the backend, so it becomes
a generic 500. This is consistent with section 6 of the spec, which already
accepted a 500 for a *nonexistent* id — but it is a deliberate acceptance, not
an oversight. Fixing it properly means introducing global exception handling,
which no task in this plan touched.

## Frontend

**`teamRelationColumns` is duplicated verbatim** between
`src/features/person/columns.tsx` and
`src/features/person/components/PersonSheet.tsx`. Confirmed byte-identical at
merge time, so no drift yet. Extract to a shared location if a third consumer
appears — the two must stay in step, because they are what makes the picker in
the sheet and the picker in the toolbar filter look identical.

**`formatTeamNames` lives in `src/features/person/mappers.ts`**, a file whose
other contents are all form↔wire mapping. It is display formatting. It was put
there because that file has an established test file and this project has no
component tests, so it was the only way to get real coverage on the null-name
fallback. A `src/features/person/format.ts` would be a better conceptual home.

**`PersonDto.teams` is typed as possibly-absent, but the wire never omits it.**
`src/types/api.ts` declares `teams?: TeamFlatDto[]`. There is no global
`@JsonInclude` and no `default-property-inclusion` in the backend's
`application.yaml`, so Jackson always emits the key — the true wire type is
`TeamFlatDto[] | null`. Every consumer uses `?.` or a truthiness guard, so
nothing breaks; `teams: TeamFlatDto[] | null` would be exact.
Note `TeamDto.leader: PersonFlatDto | null` is already spelled correctly, so
the two relations are inconsistent with each other.

**`sameIdSet` is a length-plus-subset check, not a true set comparison.**
In `src/features/person/mappers.ts`, `[3, 3]` versus `[3, 7]` compares as
unchanged. Unreachable through `RelationPicker`, which has toggle semantics and
cannot produce duplicates, so it is harmless today — but the helper's name
promises more than it delivers.

**The Teams `<Label>` has no control association.**
`PersonSheet.tsx` renders `<Label>Teams</Label>` without `htmlFor`, unlike the
four text fields. `RelationPicker` is not a labelable native input, so this is
not a one-line fix; it needs an `aria-labelledby` on the picker's trigger.
Accessibility follow-up.

## Related, still live

`issue/personTeamsInMemoryPagination.md` — requesting `$fields=teams`
unconditionally makes Hibernate paginate the Person list in memory. That cost
was accepted before this work and is unchanged by it, but this standard makes
`$fields` requests more common, so it is worth re-reading before adding another
unconditional relation fetch.
