# Archive Report: foundations-skeleton

**Archived at**: 2026-06-21
**Verify verdict**: pass-with-followups
**Spec version archived**: V4 (signed) + run-end-flush clause

## Summary

The publishable walking skeleton of `@pbuilder/sdk` is complete and archived: the
`emit → read-your-own-write` conversation runs end-to-end against the contract fake, with the
core kit, golden-IR, fitness functions, publish pipeline, and conformance scaffold in place.
Verify-final passed (iteration 2) after a quality-fix round; blind judgment-day ran 3 rounds,
surfacing and closing two CRITICALs the rest of the pipeline missed (no run-end flush;
rename/move handles addressing the wrong path). The user accepted the remaining non-critical
hardening warnings as followups. 148 tests green, typecheck clean, tarball clean.

## Specs Synced

| Domain | Type | REQs |
|---|---|---|
| foundations-skeleton (PKG/KIT/FAKE/SKEL/GIR/FIT/STD/CONF) | New (greenfield) | promoted to `openspec/specs/foundations-skeleton/spec.md` |

No MODIFIED/REMOVED — first change, pure addition; Step 4 destructive-sync check skipped.

## Archive Location

`openspec/changes/archive/2026-06-21-foundations-skeleton/`

## Lessons Learned Persisted

5 entries appended to `openspec/lessons-learned.md` (blind-review-escapes-anchoring;
fitness-tests-reading-build-output-must-build-first; chaining-tests-must-read-the-returned-handle;
test-doubles-live-outside-published-source; lifecycle-guarantees-need-a-REQ-not-a-JSDoc).

## ADRs

All 14 ADRs (`openspec/decisions/0001-0014`) are project-level by location — they encode the
cross-cutting SDK architecture. No separate promotion needed; ADR-0013 (verb→IR lowering) and
ADR-0014 (single-package subpath shape) were authored by this change.

## Followups Registered

Recorded in `openspec/pending-changes.md` (from the change's `followups.md`): W1 PKG-01 live
resolution test, W2 FIT-01 import-graph depth, **W3 publish repo-owner guard (gating for live
publish)**, W5 STD-01 guarding test, W6 finally-flush error masking, W7 FIT-04 freshness; plus
SHA-pin actions, dist/core tarball boundary, prebuild clean, CONF-01 red-proof label, and two
engine-fidelity questions (move overwrite, modify-of-missing) for engine §6.

## Pre-PR Audit

Covered by sdd-verify --mode=final (iter 2, Step 11b code-audit clean on fixes) + 3 rounds of blind
judgment-day over the full diff. No unaddressed Bug/MAJOR remain; the documented residue is the
accepted followups above.

## Final State

- Spec status: signed (archived) + promoted to `openspec/specs/`
- Lessons in project memory: 5
- ADRs: 14 (project-level by location; 2 authored here)
- Pending changes: 11 followups registered
- Branch: `feat/foundations-skeleton` (148 tests green) — ready for PR
