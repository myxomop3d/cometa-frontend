# AutomatedSystem leader relation — deferred follow-ups

Raised during review of the AutomatedSystem leader relation and the Team-style
page rebuild (`docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md`,
`docs/superpowers/plans/2026-09-05-automated-system-leader-relation.md`,
implemented on `feature/gm` as frontend `76cfa36..d5cb4c4` and backend
`7482f9e..c4b6bdb`). None blocked the merge; a final whole-branch review
triaged every one as safe to defer. Recorded here so they are not
rediscovered as defects.

**Split out into their own documents, because both need a decision rather
than a note:**

- `issue/scalarClearIsANoOp.md` — clearing a nullable scalar is silently
  discarded on PATCH. App-wide, not specific to this change.
- `issue/deadPreUnificationTableStack.md` — eleven files orphaned by this
  change; delete or keep.

**Related:** `issue/relationWriteStandardFollowUps.md` (the previous plan's
deferred items, several of which are the same shape),
`issue/relationSorting.md` (the OData relation filter/sort rules this change
had to obey).

## Frontend

**A shared-lib test teaches the forbidden dot spelling.**
`src/lib/odata/build-advanced-filter-params.test.ts:212-223` builds a
`fieldByColumnId` entry with `sortField: "leader.lastName"` and asserts
`$orderby` is `"leader.lastName asc"` — a dot, three lines below the doc
comment on `build-advanced-filter-params.ts:17` stating that a dot is an
ANTLR parse error and the spelling must be `leader/lastName`. The same entry
also uses the stale `field: "leaderId"`, a scalar that no longer exists on
`TeamDto`. The test passes and is functionally harmless — it only exercises
substitution, never the parser — but it is the worked example the next
person will copy, and it now sits directly upstream of two live relation
sorts. Its sibling `build-filter-params.test.ts:109-113` gets it right.
Deliberately not touched during this change: pre-existing, outside the diff,
and editing a shared-lib test's expected string at merge time is risk
without need. **Worth fixing early in whatever touches that file next.**

**`guid` cannot be sorted, and the guard is entity-local.**
`$orderby=guid` returns 500 because `guid` is a reserved literal token in
odata-mini's `$orderby` ANTLR grammar — the parse fails before field lookup,
so the backend's `odata.mini.repo.throw-on-field-not-found: false` never gets
a chance to apply. Discriminated live against `guidX` and `myguid`, which get
past the parser and fail differently, and corroborated from the compiled
`ODataLexer` in `odata-parser-1.2.2.jar`, where the `GUID` literal token is
embedded. Guarded in two places, both AutomatedSystem-only:
`enableSorting: false` on the column (`src/features/automated-system/columns.tsx`)
removes the menu affordance, and `dropUnsortableSort` in
`src/routes/automated-system/-simple-search.ts` strips it from the URL, which
is the one that actually prevents the 500 on a bookmarked
`?sort=guid.asc`. Any other entity that grows a `guid` column will hit this
with no guard at all. A generic solution belongs in
`src/lib/odata/build-filter-params.ts` (refuse to emit an `$orderby` for a
reserved token) or upstream in the library; it was kept entity-local here
because that file serves five pages and widening it for one entity's grammar
collision was disproportionate.

**The URL filter contract broke for this page.** `?leader=<text>` no longer
exists; it is now `?leaderComment=<text>` for the free-text field and
`?leaderId=<n>` for the relation. A pre-existing bookmark silently loses its
filter rather than erroring. Correct — `leader` changed meaning from a string
to an object — but worth a line in release notes if this page has external
users.

**Team and AutomatedSystem now duplicate two blocks.**
`personRelationColumns` and the whole `relationConfig` literal in
`src/features/automated-system/columns.tsx` are byte-identical to
`src/features/team/columns.tsx`; `deriveColumnFiltersFromSearch` in
`src/features/automated-system/filter-descriptors.ts` is Team's loop minus
its `filterKeys` range branch, and is fully parameterized by `descriptors`,
so it would move to `@/lib/odata` as `deriveColumnFilters(descriptors, search)`
with no loss. Two copies is the standard cost of a template; extract on the
third caller, when the right generic signature is actually evidenced.
(`issue/relationWriteStandardFollowUps.md` records the same pattern for
`teamRelationColumns`, which is also at two copies.)

**`automatedSystemApi.detailQueryOptions` has no consumer.**
`src/features/automated-system/api.ts` — the sheet seeds its form from
`rowAction.row`, which already carries `leader` from the `/graph?$fields=leader`
list read. Kept deliberately: it is mandated by §6 of the design, and it is
the *correct* override if a single-row consumer ever appears, because the
base `createCrudApi` one hits the plain `{id}` path, which is the library's
own handler and silently ignores `$fields` — it would return `leader: null`.
The doc comment on it says so; do not delete it as dead code, and do not
"fix" it back onto the base path. Team's equivalent does have a consumer
(`src/features/team/components/team-combobox.tsx`).

**`AutomatedSystemFlatDto` has no field-level consumer on day one.** Nothing
is *typed* as it, in either repo. It is not dead code: it is the type holding
the 16 scalars that `AutomatedSystemDto` extends, and it exists so
`AutomatedSystem` matches the relation-write standard's Flat/Full shape and
can serve as a write-ref target later. Recorded in the design's "Rejected"
section too, so it is not mistaken for an unused type and deleted.

**`status` has no clear affordance.** The Select offers only the two values
that occur in the data and no way back to `null`, while the column is
nullable (2 of 200 live rows are null). Team behaves identically. Left alone
on purpose — see `issue/scalarClearIsANoOp.md`: adding the affordance before
the wire semantics are fixed would produce a *new* silent no-op, not a
feature.

**No test for the `nullableText()` `""` → `null` transform.**
`src/features/automated-system/schema.ts`. Belt-and-braces today, because
`NullableTextRow`'s `onChange` already converts `""` to `null` before the
resolver sees it — and per `issue/scalarClearIsANoOp.md` neither value
reaches the column anyway. Worth adding whenever that issue is resolved, as
part of pinning what clearing then actually does.

**`CLAUDE.md`'s `filters/` file list names seven of eight files.**
`src/components/filters/FilterBar.tsx` is missing from it. Moot if the
directory is deleted — see `issue/deadPreUnificationTableStack.md`.

**MSW mode no longer covers `/automated-system`.**
`src/mocks/handlers/automated-system.ts` was deleted because the page now
lists from `/api/v1/automated-system/graph`, which no handler matches, and
there is no `/graph` handler anywhere in `src/mocks/`. Deliberate and
consistent: `/team` and `/person` already do not work under
`VITE_MOCK_API=true`. The 103-row fixture file was kept and migrated,
because `src/mocks/data/nodes.ts` imports it, so node and flow-graph mocks
are unaffected. Restoring mock coverage for any of these pages means adding
`/graph` support plus a `persons` fixture set.

## Backend

**`PersonRefMapper`'s real `toRef` has no dedicated test.**
`BaseRefMapperTest` exercises `BaseRefMapper.toRef` through `TeamRefMapper`
only, "as a representative of the hierarchy" (its own Javadoc). All the logic
lives in the base and `PersonRefMapper` overrides nothing but `entityType()`,
and `AutomatedSystemMapperWriteTest` re-states the contract in its stub, so
drift would surface — but the convention is worth an explicit decision if a
subclass ever gains behaviour.

**`automatedSystemLeaderOrderByOmitsRootAlias` carries no explanatory
comment** while its filter sibling four lines above does, and the class
Javadoc states the purpose. Cosmetic.

**Team's `detailQueryOptions` requests `$fields` on a path that ignores it.**
`src/features/team/api.ts` fetches `/api/v1/team/${id}?$fields=leader` — the
plain path, which is the library's own handler and drops the parameter. The
Team sheet does not notice, because it seeds its form from the row (fetched
via the list `/graph` read) rather than from that detail query. Carried over
unchanged from the design's §4 note: an observation, not a verified defect,
and out of scope for this change. AutomatedSystem uses `graph/{id}` and is
unaffected.

## Verified during this work, recorded so it is not re-derived

- The `@Condition` guard on `AutomatedSystemMapper` binds the **read**
  direction only (its parameter is `Person`, so it cannot match the
  `PersonFlatDto` source of a write), and `NodeMapperImpl` delegates all five
  node-subclass read paths to `automatedSystemMapper.toDto` rather than
  inlining its own mapping — which is what actually makes the guard hold on
  the flow-graph path. Measured live: a 68-node graph issued 8 SQL statements
  with zero `gmsb.person` references.
- `leader: null` really is serialised, not omitted: there is no
  `@JsonInclude(NON_NULL)` and no `default-property-inclusion` anywhere in
  the backend, so the TS `leader: PersonFlatDto | null` is exact.
  (Contrast `PersonDto.teams?`, which `issue/relationWriteStandardFollowUps.md`
  notes is spelled as optional but never actually omitted.)
- The rename's blast radius is closed. One production read of the old string
  field existed (`src/features/flow-graph/components/details-panel.tsx`) and
  now reads `leaderComment`. The only surviving trace of the old meaning is
  the DB column comment `gmsb.automated_system.leader IS 'Лидер АС (ФИО)'` in
  `tmp/Scripts20260703/schema-DDL.sql` — an untracked export snapshot, not
  applied schema.
- `npm run lint` is red on this branch with 44 problems (36 errors, 8
  warnings) and was already red before this work (45 at the branch point;
  `master` carries 12). Every one is in a file this change never touched, or
  is the single `react-refresh/only-export-components` error that all eleven
  TanStack route files carry structurally. Not this change's debt, and not
  addressed by it.
