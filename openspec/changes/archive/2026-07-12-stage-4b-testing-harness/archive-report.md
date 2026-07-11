# Archive Report: stage-4b-testing-harness

**Archived at**: 2026-07-12
**Verify verdict**: pass-with-followups
**Spec version archived**: V3 (signed, owner, 2026-07-10)
**Triage**: L

## Summary

`stage-4b-testing-harness` gives schematic authors a supported, in-memory way to test the
factories they write: a new `./testing` public entry exports `defineFactory` and
`runFactoryForTest`, backed by the ONE normative `ContractFake` (relocated from `test/support/`
into shipped `src/testing/`, guarded by six structural containment mechanisms). Four NEW
capabilities are now in the main specs — `author-test-harness`, `testing-entry-surface`,
`fake-single-source-parity`, `testing-story-docs` (28 REQs / 54 scenarios). Three spec-prose
groomings were applied during sync. Followups: W1 retired (subsumed), 7 new rows registered, 2
sensitive-areas rows updated, ADRs 0033-0036 promoted to Accepted.

## Cycle Stats

Suite 572→658 green · commits `8ab00ff`..`5ad8a73` (S-000..S-006 + verify-final report +
council quality batch `fbb3053` + judgment-day fix `5ad8a73`) · verify in-loop 4/4 PASS, zero
fix iterations (obs 857-860) · council 4× approve-with-notes (architect/qa/security/tech-writer)
+ 1 quality batch (`fbb3053`: README `./conformance` wording, verbatim-template doc,
prototype-safe seed) · judgment-day APPROVED (R1: 1 confirmed WARNING fixed in `5ad8a73`; R2:
both judges PASS, guards mutation-proven) · steward foresight ALIGNED-CONDITIONAL (C1
discharged via owner CQ2=YES) → reckoning DELIVERED (author journey run from a packed-tarball
vantage) · architecture audit clean (baseline obs 652 rev 8, refreshed: public API 3→4
subpaths).

## Specs Synced

| Domain | Type | REQs |
|---|---|---|
| `author-test-harness` | New | 13 |
| `testing-entry-surface` | New | 7 |
| `fake-single-source-parity` | New | 4 |
| `testing-story-docs` | New | 4 |

All 4 domains were NEW capabilities — full delta copied to `openspec/specs/{domain}/spec.md`,
change-local revision annotations (`[new V2]`, `NEW V3`, `STAGE-4-MERGED-DEPENDENT` gate
call-outs) stripped since that gate has closed — matching the `typed-factory-options` precedent.

**Three groomings applied** (ratified by the council + both judgment-day judges): (1)
**REQ-TSD-01.3** — `./conformance` boundary wording corrected from "conformance-tests an engine
implementation" to "conformance-tests a dialect or op-pack implementation (parse/print
fidelity), not a factory" (matches README fix `fbb3053`). (2) **REQ-ATH-11.2** — "the ONE
`node:fs` read of schema.json" corrected to the shipped two-read reality:
`readdirSync(<packageDir>)` (reserved-name scan) + `readFileSync(<packageDir>/schema.json)`
(run-boundary validation), both under `src/core/context.ts:202-206`. (3) **REQ-ATH-13** — the
interim plain-`Error`/post-S-006 fork collapsed to the realized shape (window closed on merge
base `6bbd9f2`): `result.error` is an `AuthoringError` with `origin: "authoring-rejected"`,
`reason: "invalid-input"`, matching `src/core/schema/input-rejection.ts` and
`harness-opted-in.test.ts:191-195`.

## Archive Location

`openspec/changes/archive/2026-07-12-stage-4b-testing-harness/` (verified via `git mv`: source
gone, destination present, 21 files).

## Lessons Learned Persisted (3, topic `project/lessons-learned`, obs #648 upsert)

- Evaluator diversity catches what 4/4 green in-loop verifies miss (pattern)
- Spec-prescribed doc wording can itself be wrong — verify it like code (discovery)
- A sequence-gated slice's gate can open earlier than the plan assumed (discovery)

Also appended to canonical `openspec/lessons-learned.md` (newest-first).

## ADRs Promoted (Proposed → Accepted)

ADR-0033 (third audience `author-testing`), ADR-0034 (`./testing` containment, six guards),
ADR-0035 (fake relocation + parity-by-identity), ADR-0036 (installed-consumer e2e lifecycle) —
`openspec/decisions/0033-0036-*.md`.

## Followups Registered

W1 (`foundations-skeleton` origin) RETIRED in place — marked SUBSUMED by REQ-TES-06, history
preserved. 7 new rows in `openspec/pending-changes.md` §`stage-4b-testing-harness` (mirrored to
engram `project/pending-changes`, obs #649 upsert):

| Description | Type | Size |
|---|---|---|
| Stage-6 `./core` production graduation | other | M |
| Throw-value-shape triangulation (`undefined`/`null`) | edge-case | S |
| Exotic-path pass-through pin (traversal/NUL/unicode) | test-coverage | XS |
| `deepEqual` `key in` prototype-chain pattern (batch payloads) | edge-case | XS |
| FIT-17 should scan shipped `dist`, not `src/`-derived builds | refactor | S |
| Widen instrumentation to `node:child_process` + dynamic `import()` | refactor | S |
| Long-term form of ship-the-fake (separate package?) | other | L |
| `RunResult.error` type modeling (`AuthoringError \| unknown`) | refactor | XS |

`openspec/sensitive-areas.md` rows 1 (supply-chain) and 6 (public-api) updated, confidence
low→medium, both now naming `./testing`.

## Steward Conscience Log (owner-nod, non-blocking)

- **CQ1** (usability): production `factory.ts` imports `defineFactory` from a path named
  `./testing` until Stage 6. Documented openly (README/JSDoc/ADR-0033, 0.x-exempt); naming-worth
  call, not a usability failure. Tracked as the Stage-6 graduation followup.
- **CQ3** (significance): the fake ships in the production tarball behind six structural guards
  (ADR-0034). Is permanent containment the right long-term form, or a separate
  `@pbuilder/testing` package? Accepted 0.x expedient; tracked as the ship-the-fake followup.

## Final State

Spec status: signed V3 (archived) · main specs updated: 4 domains · lessons: 3 (obs #648) ·
ADRs promoted: 4 (`openspec/decisions/`, no separate engram ADR topic in this project) ·
pending changes: 7 new + 1 retired (obs #649).
