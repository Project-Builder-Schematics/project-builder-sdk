# Triage: Remove SDK-Side Containment Enforcement (RE-TRIAGE — supersedes dual-marker direction)

**Classification**: L
**Decided at**: 2026-07-28T00:00:00Z
**Change name**: `inline-collection-marker`

## Superseded Direction

A prior triage of this same change (2026-07-28, also L) classified a DIFFERENT direction:
`resolvePackageRoot()`'s ancestor walk accepting EITHER `project-builder.json` OR
`collection.json` as the containment-ceiling marker (still enforcing containment, just
widening the marker). The owner has SUPERSEDED that direction: SDK-side containment
enforcement is itself a misplaced responsibility (the SDK cannot parse the manifest,
charter L2, so it cannot define the boundary it was guarding), and the project's own
signed spec already states the engine's apply-time re-derivation is the real control
(REQ-BRC-02, `package-root-containment/spec.md:47-49`). The new direction REMOVES the
mechanism rather than widening it. This artefact and engram topic
`sdd/inline-collection-marker/triage` are rewritten in place; the dual-marker analysis
above is preserved only as this note.

## Problem & Scope

> SDK factory runs die with `AuthoringError invalid-input: "no collection.json found at or above <dir>"` when the consuming project uses the CLI's inline-collection mode (whole collection inside `project-builder.json` at the project root; no `collection.json` ever exists on disk). Root cause reframed by the owner: SDK-side containment enforcement is a MISPLACED RESPONSIBILITY — the SDK cannot parse the manifest (charter L2), so it guarded a boundary it cannot define, via a presence-marker hack that inline mode breaks. The project's own signed spec already states the real security control is the engine's apply-time re-derivation (`openspec/specs/package-root-containment/spec.md:47-49`, REQ-BRC-02: engine never trusts the SDK's ceiling). Why now: hard blocker for every inline-collection project, discovered in real use.

```yaml
scope:
  in_scope:
    - "delete resolvePackageRoot + marker walk + missing-marker fail-loud (src/core/context.ts:184-229 area)"
    - "collapse packageAnchors {packageDir, packageRoot} to packageDir only"
    - "remove ceiling/realpath containment machinery in src/scaffold/containment.ts and its call sites (src/scaffold/index.ts:64,112-114; src/scaffold/expander.ts:103-117; src/scaffold/classify-transport.ts)"
    - "drop marker fabrication in test support (test/support/scratch-dir.ts:34; test/fixtures/author-emulation/factory.ts:175) and conformance-validator rule REQ-CSC-02.3 (test/support/conformance-validators.ts:269-272)"
    - "retire/re-spec the REQ-PRC family (package-root-containment spec)"
    - "supersede ADR-0046 with a new ADR documenting the responsibility move"
    - "reconcile REQ-RBV-06 (\"no opt-out for containment\") and conformance-corpus REQ-CCR-08 references"
    - "error-message removal where containment-only messaging no longer applies"
  out_of_scope:
    - "any CLI/engine-repo change (engine-side enforcement already exists per REQ-BRC-02 — verify nothing in THIS repo claims otherwise)"
    - "parsing any manifest file"
    - "new public API options"
```

## Description Received

> See Problem & Scope above. Owner-decided direction: remove SDK-side containment validation entirely — the SDK resolves sources relative to `packageDir` (sole remaining anchor), reads what it needs, emits IR; any escape is the engine's apply-time responsibility.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | Core: `src/core/context.ts` (resolvePackageRoot deletion, packageAnchors collapse), `src/scaffold/containment.ts` (291-line module deleted wholesale), `src/scaffold/index.ts`, `src/scaffold/expander.ts`, `src/scaffold/classify-transport.ts` (packageRoot/realCeiling threaded through its param types at lines 66/86/101/119 — confirmed by read, ripples beyond the owner's cited call sites) = 5 src. Test support: `scratch-dir.ts`, `factory.ts` (author-emulation), `conformance-validators.ts` = 3. Specs/ADR: `package-root-containment/spec.md` (REQ-PRC-01..10 retirement/re-spec), `run-boundary-input-validation/spec.md` (REQ-RBV-06 reconciliation — itself a separately sensitive-flagged REQ family), `conformance-corpus/spec.md` (REQ-CCR-08 references), ADR-0046 superseded + new ADR = ~5. Total required ≈13. A further 7-9 temp-dir test suites fabricate now-irrelevant `collection.json` markers (`canary-no-echo.test.ts`, `run-boundary-validation.test.ts`, etc., per ADR-0046's own amendment note) — optional cleanup, not required for correctness (unused fabrication is harmless once the check is gone), flagged as a risk below rather than counted into scope. | L |
| Lines affected (estimated) | Net code is deletion-heavy (containment.ts's 291 lines gone, call-site simplification, context.ts trimmed) but spec/ADR prose is addition-heavy: retiring 10 REQs with their GWT scenarios, a new ADR, and reconciliation text in two OTHER signed spec families (REQ-RBV-06, REQ-CCR-08). Combined code+doc churn estimated ~700-1100 lines. | L |
| Bounded contexts | 2 — SDK core/scaffold runtime (`src/core/context.ts`, `src/scaffold/**`) and test/conformance harness (`test/support/**`, `test/fixtures/**`) — below the 3+ XL threshold; spec/ADR docs are not a separate runtime context | L (not XL) |
| New patterns | None — this is deletion of an existing mechanism, not new design | M (deletion lowers novelty, but doesn't override the size/sensitivity floor) |
| Test types | Existing types (bun test unit + conformance-validator pattern); one behavioral test (`test/scaffold/run-boundary.test.ts`, the missing-ancestor fail-loud assertion) must be REMOVED/rewritten since the behavior it tests no longer exists | M |
| Precedent | Not applicable — Precedent Modifier is disabled whenever a sensitivity override fires (it fires here, see below) | N/A |

### Overrides Triggered

- **Sensitivity override — security boundary behaviour ("alters a security boundary's behaviour")**: this is a STRONGER case than the superseded direction. That version widened which marker establishes the ceiling; THIS version deletes the ceiling-derivation and enforcement mechanism outright (`resolvePackageRoot`, `src/scaffold/containment.ts` in full, and every call site that threads `packageRoot`/`realCeiling`). `openspec/specs/package-root-containment/spec.md` self-flags REQ-PRC-01 through REQ-PRC-10 as `security (input validation / containment) — Flagged: Yes` (confirmed by read, line 311). The reconciliation also touches `run-boundary-input-validation/spec.md`'s REQ-RBV-06, which that spec independently self-flags `security (input validation at the run boundary) — Flagged: Yes`. Removing enforcement is unambiguously a behavior change to a self-declared security boundary — this is the change's CORE SUBJECT (the entire diff exists to remove containment), which escalates the floor from M to **L** per the "sensitive mechanism IS the core subject" clause.
- **Public-contract override (reinforcing, not independently escalating past L)**: `@pbuilder/sdk` is a public npm package (per session bundle). Removing a documented failure mode (`AuthoringError invalid-input` for missing/out-of-ceiling sources) changes runtime behavior for existing callers — calls that used to fail loud may now silently succeed. This independently forces a minimum of M as a "breaking API/behavior change," but the sensitivity override above already forces L.
- **Two independently sensitive-flagged spec families touched, not one**: `package-root-containment` (primary) AND `run-boundary-input-validation` (REQ-RBV-06) both self-flag `Yes` in their Sensitive Areas Coverage tables. Touching two signed, independently-flagged security domains in one change is evidence AGAINST any argument for a lower floor.
- **Registry gap (risk, not blocker, same as prior triage)**: `openspec/sensitive-areas.md` still carries no row for this containment/input-validation domain (confirmed — re-checked; only an unrelated `.raw()`/dialect-execution row exists). The override fires on the SUBJECT test regardless of registry completeness; recommend `sdd-archive` add a row once this change lands.

**Final classification**: **L** — forced by the sensitivity override (core-subject clause: the change's entire purpose is to remove a self-flagged security-boundary mechanism), reinforced independently by the public-breaking-change override. Size criteria (files, lines) independently corroborate L on their own terms this time (unlike the superseded direction, where size alone only bordered L).

Not XL: 2 bounded contexts (SDK core/scaffold runtime; test/conformance harness) — below the 3+ threshold. The 7-9 optional temp-dir-marker cleanup files do not change this — they are candidates for a follow-up simplification pass, not required scope.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 5-7 slices) → ready for `/build`
- Slice target: 5-7 — plausible split: (1) delete `src/scaffold/containment.ts` + collapse call sites in `index.ts`/`expander.ts`/`classify-transport.ts`; (2) collapse `packageAnchors` to `packageDir`-only in `context.ts`, delete `resolvePackageRoot`; (3) resolve the open error-contract question (REQ-PRC-10.3 no-echo guarantee) and adjust/remove `test/scaffold/run-boundary.test.ts`; (4) test-support simplification (`scratch-dir.ts`, `factory.ts`, `conformance-validators.ts` REQ-CSC-02.3 removal); (5) spec retirement — REQ-PRC family re-spec/retirement + REQ-RBV-06 + REQ-CCR-08 reconciliation; (6) new ADR superseding ADR-0046

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| QA Engineer | Always for L — must own the error-contract/no-echo reconciliation (REQ-PRC-10.3 vs. wholesale removal) and confirm the 7-9 marker-fabricating temp-dir suites don't silently mask regressions |
| Architect | Always for L — this is a responsibility-boundary reversal (SDK guard → engine-only guard); the new ADR is a structural decision superseding ADR-0046 |
| Security Engineer | CONDITIONAL — triggered: removal of a self-flagged security-boundary enforcement mechanism across TWO sensitive-flagged spec families (REQ-PRC, REQ-RBV-06) |
| Tech Writer | CONDITIONAL — triggered: public npm package, removing a documented failure mode is a public-contract change; error-message removal and the no-echo guarantee are public-facing surfaces |

No UX Designer (no UI surface). No DBA (no schema/data layer).

## Spec Reference

`spec_source: internal` — no reference captured.

## Risks Flagged at Triage

- **Open question carried forward, NOT resolved here**: where is the line between retiring containment REJECTIONS and preserving the SDK's own read-error contract? REQ-PRC-10.3 exists so a missing/non-dir scaffold `from` rejects `AuthoringError` naming only the package-relative path instead of a raw Node ENOENT echoing an absolute path (no-echo guarantee, `test/security/canary-no-echo.test.ts`, REQ-AEC domain). Removing ALL validation must NOT silently break the error-contract/no-echo domain. Explore/spec must pin this before design.
- **`classify-transport.ts` ripple confirmed wider than the owner's cited scope**: `packageRoot`/`realCeiling` are threaded through this file's param types (lines 66, 86) and destructured/used at 101/119, not just at the single call site implied by the request — explore should map the full call graph before slicing.
- **7-9 temp-dir test suites fabricate now-dead `collection.json` markers** (`test/security/canary-no-echo.test.ts`, `test/skeleton/run-boundary-validation.test.ts`, `test/skeleton/reserved-lifecycle-names.test.ts`, `test/fake/harness-opted-in.test.ts`, `test/fake/harness-in-memory-invariant.test.ts`, `test/fitness/fit-12-schema-parity.test.ts`, `test/fitness/fit-16-reserved-name-scan.test.ts`, per ADR-0046's own amendment note). Not required to change (fabricating an unused marker is harmless), but leaving them is dead test setup — flag for the simplify gate rather than expanding this change's scope.
- **Two spec families needing reconciliation, not one**: REQ-RBV-06 ("no opt-out for containment") and conformance-corpus REQ-CCR-08 both reference the mechanism being removed and are NOT owned by `package-root-containment/spec.md` — spec phase must touch three spec files, not one.
- **Registry sync gap** (unchanged from prior triage): `openspec/sensitive-areas.md` doesn't list this domain — recommend promoting a row at archive time.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should read: `src/core/context.ts:184-229` (`resolvePackageRoot`, `requirePackageAnchors`) in full; `src/scaffold/containment.ts` in full (candidate for wholesale deletion — confirm no logic inside it is reused elsewhere, e.g. `resolveContainedRealpath`); `src/scaffold/classify-transport.ts` end-to-end (confirmed wider ripple than cited, see Risks); `openspec/decisions/0046-runcontext-package-root-ceiling.md` (the as-built `packageAnchors` fused-object amendment — the new ADR must address why fusion is now being un-fused back to `packageDir`-only); `openspec/specs/package-root-containment/spec.md` REQ-PRC-01 through REQ-PRC-10 plus its "Sensitive Areas Coverage" table; `openspec/specs/run-boundary-input-validation/spec.md` REQ-RBV-06 and ITS Sensitive Areas Coverage table; `openspec/specs/conformance-corpus/spec.md` for REQ-CCR-08's `collection.json` marker references; `test/security/canary-no-echo.test.ts` and REQ-AEC error-contract material to resolve the open question above BEFORE design; `test/scaffold/run-boundary.test.ts` (currently asserts the exact behavior being deleted — must be removed or repurposed).
