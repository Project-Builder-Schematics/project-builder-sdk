# Verification Report

**Change**: stage-2-error-attribution
**Mode**: final (Strict TDD)
**Spec version**: V2 (signed, owner, 2026-07-05)
**Triage**: L · **Diff**: `git diff c7c46dd..HEAD` (8 commits, S-000..S-004 + fix + bookkeeping)

---

### Verdict: pass-with-followups

All 49 scenarios across 18 REQs are compliant with passing runtime/compile tests; build,
typecheck, full suite, and fitness suite are green; mutation-resistance is strong across
every attribution arm probed. No gating (Bug/Architecture/MAJOR) code-audit finding. Two
non-blocking items carried from the in-loop trail are dispositioned as followups below.

### Completeness

| Metric | Value |
|---|---|
| Slices total | 5 (S-000..S-004) |
| Slices complete | 5 (all tasks `[x]`; S-004 built, not dropped) |
| Tasks complete | all |

### Build & Tests Execution (real)

| Command | Result |
|---|---|
| `bun test` (full suite) | ✅ 334 pass / 0 fail / 601 expect() across 50 files |
| `bunx tsc --noEmit` | ✅ exit 0, clean |
| `bun run build` (tsc -p tsconfig.build.json) | ✅ exit 0 |
| `bun test test/fitness/` | ✅ 73 pass / 0 fail across 11 files (FIT-04/06/08/10/11 incl.) |

### Mutation-Resistance Probes (NEW — not covered by in-loop reports)

The in-loop reports already probed: instructions[0] offender, primaryPath destination-revert,
cumulative appliedCount, originFor collapse. This pass probed arms they did not, each mutated
in `src/core/authoring-error.ts`, run against the change's tests, then reverted (tree clean):

| Mutation | Result | Guarded REQ |
|---|---|---|
| `CODE_TO_REASON.collision` → `path-not-found` | 10 fail | REQ-AEC-01.1, REQ-14.2 |
| `verbFor` delete→remove disabled (identity) | 1 fail | REQ-10.2 |
| `messageFor` unknown-suffix dropped | 1 fail | REQ-AEC-06.3 |
| degradation `reason:"unknown"` → `path-collision` | 5 fail | REQ-ERM-03.* |
| degradation `appliedCount:0` → `99` | 4 fail | REQ-ERM-03.* |

Every code→reason arm, the verb map, message-template selection, and both degradation
fields are mutation-guarded, killed for the right reason.

### Adversarial Quality Gate (Step 11b — code audit, pre-pr mode)

**Result: Clean — no gating findings.**

- Group 1 (spec alignment): 18/18 REQs traceable to the signed spec; 49/49 scenarios have
  passing implementing tests. No drift (spec_source internal).
- Group 2 (architecture): `EmitRejection` port-internal, FIT-10 guard green; `AuthoringError`
  core→commons crossing is the ADR-0023 author-data-type decision, mirrors FoundHandle/
  WritableHandle, FIT-08 not-kit pin present. `EmitRejection` deliberately excluded from the
  `src/core/index.ts` kit barrel — recorded deviation, ADR-0022. No layer violation, no ADR
  contradiction. Sensitive area (public-api) covered by REQ-AEC-04/06.
- Group 3 (code quality): no `as any` / `as unknown as` / `@ts-*` / `eslint-disable` / TODO /
  FIXME in the production `src/` diff. `engine-client.ts` change is docs-only (signature
  unchanged). No magic-number/threshold issues.
- Group 4 (scope): every changed file is in design §4.2 File Changes; the only extras are SDD
  bookkeeping (`.sdd/state`, `slices.md` checkboxes, verify-in-loop reports). No scope creep.

**Live-app pass**: N/A — no UI surface (CLI/library only).
**Adversarial review (judgment-day)**: **required** — triage L AND the change freezes a new
semver-locked public contract in the `public-api` sensitive area (`AuthoringError` + three type
aliases + `classifyContent`/`ContentState` promoted to `@pbuilder/sdk/commons`).

### Spec Compliance Matrix (18 REQs / 49 scenarios — all COMPLIANT)

| REQ | Scenarios | Test evidence | Result |
|---|---|---|---|
| REQ-AEC-01 (closed reason enum) | .1–.5 | `test/skeleton/authoring-error.test.ts` (8-family + stringify/round-trip/cap) | ✅ |
| REQ-AEC-02 (origin discriminant) | .1–.3 | `context.test.ts` (.1), `authoring-error.test.ts` (.2), `error-attribution.test.ts:97` (.3 contrast) | ✅ |
| REQ-AEC-03 (applied-boundary field + JSDoc) | .1–.2 | `authoring-error.test.ts` (.1), `doc-discoverability.test.ts` (.2) | ✅ |
| REQ-AEC-04 (public promotion + docs) | .1–.4 | `error-attribution.test.ts` (.1 instanceof), FIT-04 (.2 additive), `doc-discoverability.test.ts` (.3/.4) | ✅ |
| REQ-AEC-05 (whole-object leak scan FIT-11) | .1–.4 | `test/fitness/fit-11-*.test.ts` (runtime graph scan + 3 planted red-proofs) | ✅ |
| REQ-AEC-06 (frozen message contract) | .1–.3 | `authoring-error.test.ts` (directive/batch/unknown templates) | ✅ |
| REQ-ERM-01 (EmitRejection shape) | .1–.3 | `test/fake/emit-rejection.test.ts` (code+failedIndex; batch no-index; code-not-text decoy) | ✅ |
| REQ-ERM-02 (port-internal) | .1 | `fit-10-engine-client-port-guard.test.ts` (EmitRejection identifier) | ✅ |
| REQ-ERM-03 (degradation) | .1–.4 | `authoring-error.test.ts` (string/metadata-less Error/undefined/42 → unknown, no crash) | ✅ |
| REQ-RT-01 (classifyContent + ContentState) | .1–.4 | `classify-content.test.ts`, `content-state.test.ts` (toEqualTypeOf + never-arm) | ✅ |
| REQ-RT-02 (falsy-trio killers) | .1–.3 | `classify-content.test.ts` ("0"/"false"/whitespace → present) | ✅ |
| REQ-RT-03 (doc discoverability) | .1–.2 | `classify-content.test.ts` (@example + find() pointer) | ✅ |
| REQ-10 (AuthoringError type, verb/path) | .1–.2 | `authoring-error.test.ts` (.1 verb+path; .2 delete→remove verb-map) | ✅ |
| REQ-12 (attribution wrap at emit site) | .1–.2 | `error-attribution.test.ts` (.1 idx-2 offender; .2 discard fires) | ✅ |
| REQ-14 (every-verb + family coverage) | .1–.3 | `error-attribution.test.ts` (8 verb/form cases, mid-batch offender), `batch-cap.test.ts` (.3) | ✅ |
| REQ-15 (mid-chain/multi-flush boundary) | .1–.2 | `error-attribution.test.ts` (multi-flush appliedCount:1 + staging-discard) | ✅ |
| REQ-16 (non-sites declared) | .1 | `doc-discoverability.test.ts` (5 named + exactly-5 count) | ✅ |
| REQ-17 (full e2e + switch-branch) | .1 | `test/e2e/error-attribution.e2e.test.ts` (no mocks, switch reaches path-collision arm) | ✅ |

**Compliance summary: 49/49 scenarios compliant.** (REQ-11/REQ-13 UNCHANGED — retained rows
in `error-attribution.test.ts`, per spec note 2, not part of the 18-REQ delta.)

Notable strengths: `expectTypeOf().toEqualTypeOf()` pins on `AuthoringReason`/`AuthoringOrigin`/
`ContentState` freeze exact membership at compile time (guarding both growth AND shrinkage);
FIT-11 uses `Object.getOwnPropertyNames` with a negative-control `Object.keys` assertion, a
depth-20 `.cause` walk + identity cycle guard + time bound; the leak dictionary and the fake's
throw-site messages share one module so a reworded fake can never false-green the scan.

### Coherence (Design rev 3)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-0020 closed reason enum, code→reason only | ✅ | `CODE_TO_REASON` map; no message-text parse |
| ADR-0021 origin DERIVED via exhaustive `originFor` + never-arm | ✅ | `authoring-error.ts:73`; type pin `authoring-reason.test.ts` |
| ADR-0022 EmitRejection port contract, out of kit barrel | ✅ | `emit-rejection.ts`; FIT-10 extended; index.ts unchanged |
| ADR-0023 public promotion via two-step re-export | ✅ | `commons/index.ts:17`; FIT-08 not-kit pin |
| §4.3 primaryPath source-side, both failure forms | ✅ | `primaryPath()`; 8 REQ-14.2 cases assert source path |
| §4.4 message by reason (three-way), outside-run 3rd template | ✅ | `messageFor()`; context:12 substring preserved |
| §4.2 File Changes table | ✅ | all files present; engine-client docs-only; no extras |

### Fitness Functions (live + meaningful)

FIT-04 (semver gate, additive confirmed), FIT-06 (@example gate, auto-covers new exports),
FIT-08 (kit-boundary + AuthoringError not-kit pin), FIT-10 (port guard extended to
EmitRejection), FIT-11 (whole-object leak scan, 3 permanent red-proofs) — all green and
exercised for real.

### In-Loop History

| Iteration | Verdict | Issues fixed |
|---|---|---|
| 1 (S-000) | NEEDS_FIX | REQ-12.1 unevidenced/unguarded (instructions[0] mutant survived) |
| 2 (S-000) | PASS | REQ-12.1 mid-batch mixed-verb test added; mutant now killed |
| 3 (batch 2: S-001..S-004) | PASS | 25/25 batch scenarios; probes confirm guards bite |

### Deferred-Findings Disposition (the two items handed to final verify)

**(1) FIT-04 `DTS_PAIRS` lacks a `core.authoring-error.d.ts` baseline pair — WARNING → registered followup (NON-gating).**
Confirmed real: `DTS_PAIRS` monitors `commons.index`, `index`, `conformance.index`,
`core.handle-state`, `core.base-handle`. The `commons.index.d.ts` baseline captures only the
bare `export { AuthoringError }` re-export line; the field shape (`verb`/`path`/`reason`/
`origin`/`appliedCount`, the six/two union literals) lives in `dist/core/authoring-error.d.ts`,
which no pair diffs. This is the exact "name re-exported, shape lives elsewhere" gap stage-1
solved for FoundHandle/WritableHandle via dedicated core pairs.
*Why non-gating*: (a) REQ-AEC-04.2 as written passes today — the commons-boundary diff IS
additive, and the `| undefined` arms ARE emitted; (b) union membership on reason/origin/
ContentState is independently frozen by compile-time `toEqualTypeOf` pins (catch growth AND
shrinkage) and by `originFor`'s exhaustive switch — so the most likely breaking edits break
the build before any gate; (c) design §4.4 consciously chose "additivity argued out-of-band"
for this change. The residual gap is defense-in-depth for FUTURE breaking edits to the emitted
class shape (e.g. dropping `| undefined`, renaming a field) on an unmonitored `.d.ts`.
*Followup* (high priority, low effort): add `dist/core/authoring-error.d.ts` →
`core.authoring-error.d.ts` (and, for parity, `dist/commons/classify-content.d.ts`) baseline
pairs to `DTS_PAIRS`, mirroring the stage-1 handle-state/base-handle pattern.

**(2) S-002 Test Derivation rows tagged must-fail-first but executed as characterization — lessons-learned, not a violation.**
Design §4.6 tags REQ-14/15/17 rows `must-fail-first`; apply-progress declared the deviation
(all cases green on first run because the S-000 walking skeleton had already generalized the
metadata-driven mechanism — S-002 only adds verb/flush-count DATA variants over it). In-loop #3
independently verified the tests are mutation-meaningful (probes (a)/(b) produced the targeted
failures), so this is a legitimate characterization posture, not test theatre. Disposition:
record as a lessons-learned entry (design should tag data-variant slices over an
already-built mechanism as `characterization`, not `must-fail-first`) and, optionally, a
one-line design-doc correction. No behavioral or coverage impact.

### Issues Found

**CRITICAL** (must fix before archive): None.
**WARNING** (should fix): FIT-04 `DTS_PAIRS` gap (deferred finding 1) — registered as a followup.
**SUGGESTION**: REQ-AEC-04.2 clause 2 (literal `verb: AuthoringVerb | undefined` arm on the
emitted `.d.ts`) is proven by construction (source declaration + tsc + runtime REQ-14.3
undefined-arm assertions) rather than by a direct string-scan of the emitted type — reinforces
followup 1, no separate action.

### Followups (for the archive ledger)

1. **[quality/tooling, high priority]** Add `core.authoring-error.d.ts` (+ `commons.classify-content.d.ts`) baseline pairs to FIT-04 `DTS_PAIRS`, mirroring stage-1's handle-state/base-handle precedent, to bring the newly-frozen public class shape under the emitted-`.d.ts` semver gate.
2. **[lessons-learned]** Design tag correction: data-variant slices layered over an already-built mechanism (S-002 REQ-14/15/17) are `characterization`, not `must-fail-first`; the walking-skeleton (S-000) is where the mechanism's must-fail-first RED lives.

### Next Recommended

Run **judgment-day** (blind dual review) per `adversarial_review: required`, then proceed to
`sdd-archive` (verify verdict `pass-with-followups` is archive-eligible; register the two
followups in `project/pending-changes`; ADRs 0020-0023 promotion-eligible; arch refresh per
design §4.10 `modifying` impact).
