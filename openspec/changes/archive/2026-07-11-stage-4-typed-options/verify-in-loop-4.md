## Verify In-Loop Result

**Change**: stage-4-typed-options
**Iteration**: 4/3 (note: 4th chronological verify-in-loop artefact for this change; treated as loop iteration 1 for this batch's own 3-iteration budget — S-003/S-004 delta has had zero prior in-loop passes)
**Scope**: S-003 (Run-Boundary Validation Matrix), S-004 (Reserved Lifecycle Names — Module-Structure Enforcement)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 11/11 (S-003 6/6, S-004 5/5 — all `[x]` in `slices.md`)
- Full suite (ran in full, not just affected — fast enough at 1.7s): 543/543 passed, 0 failed, 893 expect() calls (up from the 482/71-files baseline; 74 files now)
- `tsc --noEmit`: clean, zero errors
- Spec compliance for scope: 22/22 scenarios compliant (matrix below)
- Assertion audit (delta test files): clean — real behavioural assertions throughout, exact-message equality, no banned patterns found
- Cross-change constraint: Stage-2-owned files untouched (`src/core/authoring-error.ts` not in the diff; nothing under `openspec/changes/stage-2-error-attribution/` touched). Interim rejections remain plain `Error` everywhere — verified by direct code read and by tests asserting `.not.toBeInstanceOf(AuthoringError)` on every rejection path.

Orchestrator action: exit loop, proceed toward S-005 (remaining `/build` deliverable slice), then `/evaluate` (mode=final) once S-005 lands — the change does not verify-final/archive until S-006 lands per the slices' own build-order note.

---

### Execution Evidence

**Full suite** (`bun test`):
```
bun test v1.3.11 (af24e281)
...
 543 pass
 0 fail
 893 expect() calls
Ran 543 tests across 74 files. [1.74s]
```

**New/modified test files run in isolation** (`bun test test/skeleton/run-boundary-validation.test.ts test/skeleton/reserved-lifecycle-names.test.ts test/fitness/fit-16-reserved-name-scan.test.ts`):
```
 30 pass
 0 fail
 50 expect() calls
Ran 30 tests across 3 files. [7.95s]
```

**Typecheck** (`bunx tsc --noEmit`): exit 0, no output.

**Adversarial FIT-16 probe** (planted violations directly in `test/fixtures/typed-factory/` — the always-on scan root — then reverted; `git status --porcelain` confirmed clean afterward):
1. Planted `test/fixtures/typed-factory/pre-execute.ts` → `FIT-16 ... has no reserved-lifecycle-name sibling (green)` went RED: `expect(received).toBeUndefined() / Received: "pre-execute"`.
2. Stripped `{ packageDir: import.meta.dir }` from the reference schematic's `factory.ts` → `FIT-16 ... defineFactory( threads packageDir (3rd-signal green)` went RED: `Expected: false / Received: true`.
Both signals demonstrably go red on a real violation — FIT-16 is not theatre. Reverted; full suite reconfirmed at 543/543 green.

**ADR-0032 locator probe** (ad hoc script driving `defineFactory` against a scratch package dir with a hand-crafted malformed `schema.json`, run via `bun run`, deleted after):
- Structurally-malformed JSON with a locatable syntax error → `[pbuilder] factory at ../../../../../tmp/locator-probe-iYw0ak: schema.json could not be read: invalid JSON (line 3, column 15)` — concrete position, matches the pinned literal family exactly.
- Bad `\u` escape (the scanner's documented bounded-fidelity gap) → `... invalid JSON (position unknown)` — fallback branch confirmed live.

---

### Spec Compliance Matrix (scope: S-003 + S-004)

| Requirement | Test | Result |
|---|---|---|
| RBV-01.2 (wrong-type) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` | ✅ COMPLIANT |
| RBV-01.3 (excess key) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` | ✅ COMPLIANT |
| RBV-01.4 (non-JSON value, no-echo of received kind) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` | ✅ COMPLIANT |
| RBV-01.5 (reserved-name-as-input-key) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` | ✅ COMPLIANT |
| RBV-01.6 (`__proto__`/`constructor`/`prototype`, SEC-B2, no-pollution) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` (unit + integration canary proofs, both green) | ✅ COMPLIANT |
| RBV-01.7 (null/undefined/empty-string trichotomy) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` | ✅ COMPLIANT |
| RBV-01.8 (template-syntax opaque) | `run-boundary-validation.test.ts` + `schema-validate.test.ts` | ✅ COMPLIANT |
| RBV-02.1 (no-raw-value-echo) | `run-boundary-validation.test.ts` | ✅ COMPLIANT |
| RBV-03.1 (stateless per-run/per-factory opt-out warning) | `run-boundary-validation.test.ts` (2nd-run + 2nd-factory proof) | ✅ COMPLIANT |
| RBV-05.1 (non-ENOENT fail-closed + malformed/invalid-shape, position locator) | `run-boundary-validation.test.ts` (empirically re-probed, see Execution Evidence) | ✅ COMPLIANT |
| RBV-05.2 (empty-schema distinct warning) | `run-boundary-validation.test.ts` | ✅ COMPLIANT |
| RLN-01.1 (`pre-execute.ts` rejected) | `reserved-lifecycle-names.test.ts` + `schema-discovery.test.ts` + `fit-16-reserved-name-scan.test.ts` (empirically re-probed) | ✅ COMPLIANT |
| RLN-01.2 (clean package accepted) | `reserved-lifecycle-names.test.ts` | ✅ COMPLIANT |
| RLN-01.3 (`post-execute.ts` rejected independently) | `reserved-lifecycle-names.test.ts` + `schema-discovery.test.ts` | ✅ COMPLIANT |
| RLN-01.4 (schema.json field named `pre-execute` NOT rejected — boundary pin) | `reserved-lifecycle-names.test.ts` + `schema-discovery.test.ts` | ✅ COMPLIANT |
| RLN-02.1 (plain `Error`, distinguishable-by-literal from RBV) | `reserved-lifecycle-names.test.ts` + `input-rejection.test.ts` | ✅ COMPLIANT |
| RLN-03.1 (`add` schema field NOT rejected — L2 deferred) | `reserved-lifecycle-names.test.ts` | ✅ COMPLIANT |
| RLN-03.2 (exported `remove` NOT rejected) | `reserved-lifecycle-names.test.ts` | ✅ COMPLIANT |
| RLN structural scan (FIT-16, always-on, `packageDir`-independent) | `fit-16-reserved-name-scan.test.ts` (empirically re-probed — see Execution Evidence) | ✅ COMPLIANT |
| dir-form matching (ADR-0028) | `reserved-lifecycle-names.test.ts` + `schema-discovery.test.ts` + `fit-16-reserved-name-scan.test.ts` | ✅ COMPLIANT |
| case-insensitivity (TW-M2) | `schema-discovery.test.ts` + `fit-16-reserved-name-scan.test.ts` | ✅ COMPLIANT |
| non-ENOENT fail-closed, RLN scan (constraint 4) | `reserved-lifecycle-names.test.ts` + `schema-discovery.test.ts` (root-guarded) | ✅ COMPLIANT |

---

### Strict TDD (in-loop audit)

**Iteration**: 4 (this batch)
**Verdict**: concerns
**Delta scope**: 6 test files touched (2 new: `run-boundary-validation.test.ts`, `reserved-lifecycle-names.test.ts`, `fit-16-reserved-name-scan.test.ts` is also new = 3 new; 3 modified: `input-rejection.test.ts`, `schema-discovery.test.ts`, `schema-validate.test.ts`), 5 impl files touched (`context.ts`, `schema/index.ts`, `schema/input-rejection.ts`, `schema/schema-discovery.ts`, `schema/schema-validate.ts`)

#### Findings

1. **Scrutiny point 1 — `rejectionForReservedName` implemented before its own test (self-reported, apply-progress.md Deviation #6).** Verified by reading `src/core/schema/input-rejection.ts` and `test/skeleton/input-rejection.test.ts`: the function is genuinely a one-line pure mapping (`return new Error(pinned-literal)`, zero branching) and it IS covered by 3 real tests post-hoc (`input-rejection.test.ts` lines 58-77) that assert the exact literal, the RLN-vs-RBV distinguishability, and the plain-`Error`-not-`AuthoringError` invariant. Checked against `strict-tdd-verify.md`'s explicit in-loop halt table (Banned assertion pattern / new-file-no-tests / regression / triangulation-gap-on-conditional-logic): none of the four conditions match — there is no conditional logic to triangulate, tests exist and assert real behaviour, nothing regressed. This is a genuine minor TDD-cycle sequencing slip (test-after-impl), honestly disclosed rather than hidden — not a fabricated RED. **Judgment: does not meet the bar for a `tdd-violation` halt at in-loop.** Flagged as a WARNING for the `final`-mode comprehensive TDD Cycle Adherence Audit (Method 1, git-history) to re-examine with full change context, since final mode has zero tolerance for test-after-impl where in-loop's explicit table does not cover this exact shape (single trivial pure-literal helper, immediately-passing).
2. **Scrutiny point 2 — reserved-name check runs BEFORE schema validation in `defineFactory` (self-reported, apply-progress.md Deviation #7).** Confirmed by reading `slices.md` (no ordering language in S-003/S-004 acceptance criteria or Binding Constraints) and `design.md` §4.4/§4.8 (describes both checks' individual contracts, never a relative order). The two checks are functionally disjoint — `checkReservedNames` inspects the package's own directory entries (never resolved input), `validateAtRunBoundary` inspects the resolved input (never directory entries) — confirmed via `RLN-01.4`'s boundary-pin test (a `schema.json` field named `pre-execute` is NOT rejected by RLN) and `RBV-01.5`'s test (an INPUT key named `pre-execute` IS rejected by RBV, via the `disallowed-key` finding, not RLN). No planted scenario in either test file requires the opposite order, and no REQ-ID scenario in `spec.md` implies structural-vs-input precedence. **Judgment: legitimate, unconstrained judgment call — no finding.**

#### Tolerated for now (flagged for final)
- Finding 1 above (test-after-impl on the one-line `rejectionForReservedName`).
- `RESERVED_EXTENSIONS = [".ts", ".js"]` in `schema-discovery.ts`: `.ts` is exercised by both unit (`schema-discovery.test.ts`) and integration (`reserved-lifecycle-names.test.ts`) tests; `.js` has no dedicated test case. The branch is a trivial 2-item loop with identical logic per extension (`endsWith` + `slice`), so this is a coverage gap, not a triangulation gap on conditional business logic — sub-critical, worth a one-line test addition in a later pass but not blocking.
- `isErrnoException` triplication across `bin/pbuilder-codegen.ts`, `src/core/context.ts`, `src/core/schema/schema-discovery.ts` (self-reported apply-progress.md Deviation #8) — a genuine, reasoned Boy Scout-rule judgment call (consolidating would require a new cross-cutting utility module or a backwards `bin/`→`src/` dependency per FIT-15); not architecturally significant enough to halt in-loop, correctly flagged for a future dedicated cleanup if it grows a fourth copy.

#### Halts
None.

---

### Risks
- None new from this delta. Carrying forward the already-known program-level risk: the change cannot reach `sdd-verify --mode=final`/archive until S-006 lands (gated on `stage-2-error-attribution` archiving + its coordinated spec amendment) — unchanged by this batch, tracked in `slices.md`'s Build Order table.

### Next Recommended
`sdd-apply` — S-005 (Cross-Domain No-Echo Verification + Discoverability), the final slice of this `/build` deliverable (S-000..S-005). S-006 stays deferred-blocked.

### Skill Resolution
none (skill registry present but empty — greenfield project, no project-specific compact rules to inject)
