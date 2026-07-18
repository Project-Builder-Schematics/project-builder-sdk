# Spec Summary: context-singleton-fix

**Version**: V1
**Status**: signed (V1 signed by owner 2026-07-19)
**Triage**: M
**Persona lens**: none

## Domains Affected

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `module-identity-safe-run-context` | New | 7 | 0 | 0 |

## REQ-ID Stability

First version — 7 requirements assigned REQ-MIS-01..REQ-MIS-07.

| REQ-ID | Name | Spec-surface item covered |
|---|---|---|
| REQ-MIS-01 | Cross-Realm Run-Context Sharing | 1 — module-identity mechanism + pollution posture |
| REQ-MIS-02 | Registry Key Stability | 1 — frozen key-name contract |
| REQ-MIS-03 | Single-Instance Topology Non-Regression | 2 — byte-identical existing-consumer behaviour |
| REQ-MIS-04 | Genuine Outside-Run Rejection Still Throws | 2 — the run-boundary error still fires when it should |
| REQ-MIS-05 | Dist-Runner Two-Instance E2E Regression Proof | 3 — real dist/src dual-realm e2e, false-green guard |
| REQ-MIS-06 | Fail-Loud Fresh-Dist Guard | 3 — stale/absent dist fails loud, not silent |
| REQ-MIS-07 | Documented Non-Goals | 4 — Hazard #2 residual, probe false-negative, sibling-sweep verdict |

## Feedback Applied

First version — no feedback to apply.

## Sensitive Areas Coverage

No sensitive areas covered. Crosschecked against `openspec/sensitive-areas.md`: `context.ts`
is not in the `security (code execution)` row (that's `.raw()`/`dialect-handle.ts`) nor
`public-api (contract)` (`./core` stays absent from `package.json#exports`, ADR-0034,
REQ-MIS-07's Non-Requirements clause reaffirms this). No auth/payments/deployment/migration
surface touched. Matches explore's own crosscheck verdict (no override triggered).

## Deviations

- **Word budget**: the `module-identity-safe-run-context` domain spec is ~965 words,
  above the ≤800-word-per-domain guideline. Rationale: the task brief named four distinct
  spec-surface items (module-identity mechanism, non-regression, dist-runner e2e contract,
  honesty boundary) each requiring its own testable REQ + scenario set; none of the 7 REQs
  is decomposable further without losing an independently-verifiable contract point (e.g.
  REQ-MIS-07's non-goals enumeration is itself the anti-overclaim guardrail the task
  explicitly asked for). No REQ is padding — every scenario is one design/apply will need
  in its Test Derivation table.
- **REQ-MIS-05.2** ("pre-fix proof") is scoped as one-time development/PR-review evidence,
  not a standing CI assertion — codifying it as an always-running test would require
  keeping a deliberately-broken code path alive in the tree, which is worse than the
  problem it solves. Flagged explicitly so design doesn't over-literalize it into
  permanent CI machinery.
- **REQ-MIS-06** pins observable fail-loud behaviour only (per the proposal's own framing:
  "exact mechanism is design's call") — it does not prescribe pretest-build-step vs.
  explicit-guard; that choice is deferred to `sdd-design`'s Test Derivation table.

## Upstream Ingest / Sync

`spec_source: internal` (per `sdd-init/project-builder-sdk/spec-source`) — Step 5b (ingest)
and Step 10b (sync) both skipped; V1 written directly from the proposal + explore, as
per the internal-mode default.

## Artefacts Persisted

| Artefact | Location |
|---|---|
| Spec | `openspec/changes/context-singleton-fix/specs/module-identity-safe-run-context/spec.md` (V1) |
| Summary | `openspec/changes/context-singleton-fix/spec-summary.md` |
| Engram | `sdd/context-singleton-fix/spec` (V1, concatenated single-domain content) |

## Next Step

Surface to human (owner) for review. If approved, orchestrator marks status=signed and
proceeds to `sdd-design`. If feedback given, orchestrator re-invokes `sdd-spec` with
feedback to produce V2.
