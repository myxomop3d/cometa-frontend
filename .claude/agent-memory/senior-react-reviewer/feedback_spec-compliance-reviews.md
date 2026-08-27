---
name: feedback_spec-compliance-reviews
description: How this user structures SDD-plan task reviews — brief-literal compliance matters more than my own taste, and I must trace runtime call graphs, not just the diff
type: feedback
---

For this project's `.superpowers/sdd/*` plan-task reviews, the user gives an
explicit brief (often with exact code snippets the implementer is meant to
copy near-verbatim) plus a fixed scope-file list and named constraints
(files that must stay untouched, tests that must be deleted not adapted,
etc). Deviations from MY preferred design are not findings if the brief
itself dictated that exact shape — attribute those to the spec, not the
implementer, and say so explicitly rather than flagging as a defect.

**Why:** the review prompt for this plan explicitly separates SPEC COMPLIANCE
from TASK QUALITY and warns that a type being "more permissive or more
restrictive than the server's real shape is a defect — cite the specific
field" — i.e. the bar is fidelity to a backend contract, not idiomatic taste.

**How to apply:** for "judgement point" questions (e.g. "does this fallback
create a trap?"), don't stop at the diff — grep forward to every real
call site (route → columns → sheet → api.ts/advanced-api.ts query params)
to determine whether a theoretical gap is actually reachable today. In this
codebase, `ColumnDef` relation configs are typed against `RelationConfig<any>`
(`src/types/data-table.ts`), so the generic is erased — an implementer
keeping a wider DTO type there (e.g. `PersonDto` vs `PersonFlatDto`) isn't
a type-safety issue even if a narrower type would also compile.
