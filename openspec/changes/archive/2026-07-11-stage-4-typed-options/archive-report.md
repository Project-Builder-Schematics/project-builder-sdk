# Archive Report: stage-4-typed-options

**Archived at**: 2026-07-11T00:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V5 (signed, owner, 2026-07-07; AEC amendment applied 2026-07-10)

## Summary

Stage 4 gave `schema.json` teeth on three planes: compile-time (a zero-dep codegen bin,
`pbuilder-codegen`, derives a typed `Input` for `defineFactory<O>`), build-time (FIT-12/13 make
schema↔type drift and schema insufficiency BUILD FAILURES), and run-time (fail-closed
run-boundary validation + reserved-lifecycle-name rejection pre-`als.run`). Five new domains
synced (all NEW, no MODIFIED/REMOVED); the sixth domain (`authoring-error-contract`) was a
sibling Stage-2 spec amended in-place (V2→V3) via a coordinated owner-authorized unfreeze and is
NOT re-synced here. 7 slices (S-000..S-006), 23 distinct REQ-IDs / 59 scenarios, suite 359→572
green, tsc clean. Blind verify-final council found and closed a HIGH codegen-injection and a
MAJOR deep-nesting RangeError that verify-final's own pass had missed. Judgment-day APPROVED (2
judges, 0 crit/0 major). Steward reckoning DELIVERED, owner-affirmed. Architecture audit clean.
Six ADRs (0027-0032) promoted. Nine followups registered as non-blocking pending changes.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed | Action |
|---|---|---|---|---|---|
| `typed-factory-options` | New | 5 (TFO-01..05) | 0 | 0 | Created; Status: signed (2026-07-07) |
| `schema-contract-parity` | New | 2 (SCP-01..02) | 0 | 0 | Created; Status: signed (2026-07-07) |
| `run-boundary-input-validation` | New | 5 (RBV-01..05) | 0 | 0 | Created; Status: signed (2026-07-07) |
| `reserved-lifecycle-names` | New | 3 (RLN-01..03) | 0 | 0 | Created; Status: signed (2026-07-07) |
| `factory-package-shape` | New | 5 (FPS-01..05) | 0 | 0 | Created; Status: signed (2026-07-07) |
| `authoring-error-contract` | Sibling amendment | 3 (AEC-07..09) | 0 | 0 | NOT re-synced — already V3 in main (applied 2026-07-10 by a coordinated `stage-2-error-attribution` amendment) |

## Archive Location

`openspec/changes/archive/2026-07-11-stage-4-typed-options/`
- 26 files moved via `git mv` (verified: source gone, dest present, file count matches)
- Per-change artefacts accessible via topic keys: `sdd/stage-4-typed-options/*`

## Lessons Learned Persisted

| Lesson | Type | Topic Key |
|---|---|---|
| Blind verify-final council catches what its own checklist pass misses | pattern | `project/lessons-learned` |
| Two-layer defence converges a council fix-review GAN loop in one iteration | pattern | `project/lessons-learned` |
| A review agent's own git checkout can wipe an uncommitted fix mid-review | discovery | `project/lessons-learned` |
| Owner-authorized same-day cross-change spec unfreeze executes cleanly when declared explicitly upfront | pattern | `project/lessons-learned` |

Total: 4 lessons added (4/5 budget used). Also prepended to `openspec/lessons-learned.md`.

## ADRs

### Promoted to Project-Level
- **ADR-0027**: Codegen bin — hand-rolled zero-dep subset parser + CLI contract — `openspec/decisions/0027-codegen-bin-mechanism.md`
- **ADR-0028**: Reserved lifecycle names — kebab filename convention, runtime scan — `openspec/decisions/0028-reserved-name-filename-convention.md`
- **ADR-0029**: Run-boundary validation placement + error-taxonomy wiring — `openspec/decisions/0029-run-boundary-validation-placement.md`
- **ADR-0030**: Scoping ADR-0018 — author-input-contract conformance SDK-owned upstream of the wire — `openspec/decisions/0030-adr-0018-scoping-input-contract.md`
- **ADR-0031**: Factory package-shape discovery — `openspec/decisions/0031-factory-package-shape-discovery.md`
- **ADR-0032**: Hand-rolled JSON position locator (supersedes ADR-0027 Gap-8) — `openspec/decisions/0032-hand-rolled-json-position-locator.md`

All six shipped as designed and audit-verified (obs #768, clean); Status: Accepted (2026-07-11).
Mirrored to engram `project/architectural-decisions`.

## Followups Registered

| Description | Type | Size | Origin |
|---|---|---|---|
| `AuthoringError` ctor `message?` ungated across 8 reasons | refactor | S | verify-final F-01 |
| Bin `-h` short-flag alias untested | test-coverage | XS | verify-final F-02 |
| Sufficiency gate lacks independent mutation-guard test | test-coverage | XS | QA iter3 F-07 |
| Numeric enum `choices` produce an unusable factory type | edge-case | S | judgment-day Judge B L-1 |
| Bin `<dir>` relativization leaks depth for out-of-tree packages | refactor | XS | judgment-day Judge B L-2 |
| Non-object property value can silently vanish from in-memory Schema | edge-case | S | architect MINOR |
| Glossary drift: `@example` names input `options` not `input` | docs | XS | tech-writer |
| Bin `--help` output thin | docs | XS | tech-writer |
| Reserved-name scan misses `.mjs`/`.cjs`/`.tsx` (spec-scoped, known limitation) | docs | XS | QA nit |
| "25 REQ-IDs" doc label vs. true 23 distinct REQ-IDs | docs | XS | verify-final F-06 |

Closed in-change (not pending): coordinated Stage-2 AEC amendment (verify-final F-03).
Reaffirmed, no new row: `stage-4b-testing-harness` stays COMMITTED-NEXT (steward CQ-3).

## Test Coverage

| Metric | Value |
|---|---|
| Full suite | 572 pass / 0 fail at final verify; typecheck clean |
| REQ coverage | 59/59 scenarios compliant (23 distinct REQ-IDs) |
| Architecture impact | `modifying`, validated; baseline refreshed (obs #652), audit clean (obs #768) |

## Final Checklist

- [x] Specs synced to main (5 NEW domains; `authoring-error-contract` left untouched, already V3)
- [x] Change folder moved to archive (`git mv` verified, 26/26 files)
- [x] ADRs 0027-0032 flipped to Accepted in `openspec/decisions/`
- [x] Lessons learned extracted (4 curated entries)
- [x] Followups registered in `openspec/pending-changes.md` (9 new rows; 1 closed-in-change; 1 reaffirmed)
- [x] Engram mirrors upserted (lessons #648, ADRs #647, pending #649, archive-report)
- [x] Archive report written

**Status**: COMPLETE. Change sealed; ready for PR.
