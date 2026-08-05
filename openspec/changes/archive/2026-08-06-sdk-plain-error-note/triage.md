# Triage: SDK Plain-Error Note

**Classification**: M
**Decided at**: 2026-08-01T00:00:00Z
**Change name**: `sdk-plain-error-note`

## Problem & Scope

> Descriptive plain-`Error` throws from schematic factories are discarded by the runner's
> terminal catch (`src/transport/runner.ts` ~332-346: non-AuthoringError/TransportFault/
> IntentRejectedError throws become the literal note "run failed"), so operators/agents
> downstream see `engine_native_system_fault` with empty detail. Workbench-01 evidence: a
> 30-second CRLF fix cost 6-8 min of blind diagnosis.

```yaml
scope:
  in_scope:
    - terminal catch includes the plain Error's message in stderr note, through existing
      pbuilder-runner: sentinel and existing note()/boundMessage cap discipline
    - resolve contract OQ-3 (note stays ≤ existing cap, message-only, stack excluded)
    - tests per Strict TDD
  out_of_scope:
    - new exit code or reclassification (deferred: sdk-failure-attribution)
    - filesystem writes / log files (deferred: error-observability-log-sink)
    - stack traces in the note (OQ-3 default: message only)
    - wire frame protocol changes
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | 1 (`runner.ts`) + 1-2 test files | S |
| Lines affected | ~10-30 (one ternary branch + tests) | XS/S |
| Bounded contexts | 1 (`src/transport/`) | S |
| New patterns | none — reuses `note()`/`boundMessage()` verbatim | XS |
| Test types | existing (unit + spawned-runner e2e, per S-002 precedent) | S |
| Precedent | mirrors the existing 3-branch ternary (`AuthoringError\|TransportFault\|IntentRejectedError ? err.message : "run failed"`) — but **modifier NOT applied**, override fired | n/a |

Size alone: S.

### Overrides Triggered

- **Sensitivity (security boundary — disclosure control)**: fires. `boundMessage()` only
  caps length (`error-text.ts:25-27`); it does NOT scrub absolute paths or stack content.
  REQ-WPS-07 ("no absolute paths, no stack frames... never echoes raw host internals")
  is satisfied today only because the three admitted error classes are *author-curated* —
  their `.message` is chosen by the SDK/factory author. A plain `Error` is uncurated: Node
  built-ins (e.g. `fs` `ENOENT: ... open '/abs/path'`) embed absolute host paths directly
  in `.message`. Widening the sentinel to include plain-`Error` messages changes what
  content CLASS crosses a boundary the engine/CLI treat as safe-by-construction (contract
  Seam 1: "runner-authored... well-defined, bounded content class"), and the parent
  contract itself schedules a CLI-side leak-scan extension for this exact field — the
  program's own architects recognize the new disclosure risk. This is the SUBJECT test
  firing (alters what a security boundary exposes), not mere proximity. Floor: M.
  Not escalated to L — this is a narrow extension of an existing, working sentinel/cap
  mechanism (no new mechanism, no rewrite), and size independently stays S.

## Final classification: M — sensitivity override (disclosure-control) forces the floor; size alone would be S.

## Recommended Path

- Phase: light Planner (M)
- Skills: `sdd-explore` → `sdd-propose` (merged: proposal + REQ-IDs, one signature) →
  `sdd-design` → `sdd-slice` (target 2-4 slices) → ready for `/build`
- Slice target: 2-4

## Recommended Personas (M sensitivity override only)

| Role | Reason |
|---|---|
| security-engineer | Sensitivity override fired (disclosure-control change to WPS-07 boundary) |

## Spec Reference

`spec_source: internal` (`openspec/spec-source.yaml`) — no upstream reference captured.

## Collision Report (MANDATORY check, 7 in-flight changes)

- **`runner-tripwire-invariants` (L, sensitive-forced, status: plan-complete, owner-ready
  to `/build`) — REAL collision, both file-level and semantic.**
  - File-level: its `deriveRunnerClosure` walks `dist/transport/runner.js` over `dist/**`
    to build `dist/runner-manifest.json`. `src/transport/runner.ts` compiles into that
    exact root.
  - Semantic: its design.md states `src/**` is "**Deliberately untouched** — byte-neutrality
    (REQ-CAP-06) is the gate that keeps this change out of the code-execution sensitive
    row," and pins `dist/runner-manifest.json` to sha `bf6c983c59281eaf91ceefcb363375b5
    2436808bbe74ee5241818f47eccfa530` at HEAD `e6dcde2`. Its own rollout section: "A
    mismatch means the change reached `src/` and became cross-repo — **halt before
    slicing continues, do not warn**."
  - Any `runner.ts` edit before their mechanism slices land invalidates that pin.
  - **Sequencing is a human/orchestrator call, not resolvable by triage.** Recommend:
    either `runner-tripwire-invariants` lands and merges first (it is further along:
    plan-complete, awaiting only owner `/build`), or its owner explicitly re-baselines
    the manifest hash after `sdk-plain-error-note` merges. Do not interleave.
- **`context-singleton-fix`**: no collision. PR #40 already merged (2026-07-18); its only
  `runner.ts` touch was a **read-only** reference (`runner.ts:337-340`, the same
  `instanceof AuthoringError` check) cited as evidence for a documented, out-of-scope
  follow-up ("Hazard #2"), never modified. Different file (`src/core/context.ts`).
- **`codegen-all-schematics`, `l1-author-surface`, `modify-e2e-extensible`,
  `mutation-schematic-docs`, `ts-dialect-backend-ops`**: no collision. No reference to
  `runner.ts`, `transport/runner`, `note()`, `boundMessage`, or `classifyExitCode` found
  in any of their artefacts.

## Risks Flagged at Triage

- Byte-neutrality collision with `runner-tripwire-invariants` (above) — sequencing must
  be decided before either change's `/build` proceeds against `main`.
- WPS-07 compliance for uncurated plain-`Error` messages (absolute-path leakage) is a
  real open design question, not a formality — design phase must decide: scrub, cap only
  (accept documented residual risk), or reject certain message shapes. OQ-3's "message
  only, stack excluded" default narrows but does not close this.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should: (1) confirm the exact current ternary at `runner.ts:340-343` against
HEAD before design; (2) read the parent contract's Seam 1 SDK obligation and OQ-3
verbatim; (3) surface the `runner-tripwire-invariants` sequencing collision to the
orchestrator/human explicitly — do not silently assume an order; (4) investigate whether
any existing fitness test scans stderr/notes for absolute-path leakage (WPS-07
enforcement) to inform whether this change needs to add one.
