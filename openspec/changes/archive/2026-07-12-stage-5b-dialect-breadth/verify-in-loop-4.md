# Verify In-Loop Result

**Change**: stage-5b-dialect-breadth
**Iteration**: 1/3 (batch B4 — S-005, first verify pass over this batch; the per-batch GAN
loop's own 3-max applies within B4, independent of the sequential `verify-in-loop-N` artefact
numbering used across batches B1–B4)
**Scope**: S-005 (conformance tail — mandatory adversarial samples, leaf rule, real-base probe)
**Mode**: in-loop (Strict TDD) — **this is the FINAL batch**; findings here carry directly into
`sdd-verify --mode=final`
**Delta**: `git diff e9f7a26..HEAD` — 4 commits (`b011d83`, `4d79c53`, `da0d022`, `9c7ac2f`)

---

### FINAL Verdict: PASS

The initial pass over the S-005 delta returned NEEDS_FIX on one CRITICAL finding (preserved
verbatim below for the audit trail). The Executor's fix commit `dd1d109` was re-verified
independently and closes both findings — batch B4 PASSES; the change is fully built. See
"Fix Re-verification (iteration 2)" at the end of this report, including the ruling on the
probe-ordering deviation (ACCEPTED — the two orderings are verdict-equivalent; only
diagnostics differ).

### Initial Verdict (pre-fix, superseded): NEEDS_FIX

One CRITICAL finding blocks a clean PASS: **REQ-DC-06's normative text is not fully
implemented — `testOpPack` receives ZERO of the six mandatory adversarial samples**, though the
narrower `REQ-DC-06.1` *scenario* (which is `testDialect`-scoped by its own literal text) is
satisfied. See Finding #1 and Deviation Ruling (a) below — this is the key question the
orchestrator asked me to resolve, and I ruled it a genuine unmet spec obligation, not merely an
ambiguity resolved in the narrower reading's favor.

Everything else — REQ-DC-06.2, REQ-DC-07.1, REQ-DC-08.1, the `deepEqual` fold, both other
deviations, and all execution evidence — is clean, verified live, and mutation-resistant.

---

## Execution Evidence (real, reproduced independently)

| Check | Claimed (apply-progress) | Verified |
|---|---|---|
| `bun test` (full suite) | 848 pass / 0 fail, 1534 `expect()` | ✅ **848 pass / 0 fail, 1534 expect() calls** — reproduced exactly |
| `bunx tsc --noEmit` | clean | ✅ clean, exit 0 |
| `bun run build` | clean | ✅ `tsc -p tsconfig.build.json` + codegen bin bundle, clean |
| `git diff e9f7a26..HEAD -- test/fitness/` | FIT-01 unmodified | ✅ **empty diff** — genuinely untouched |
| S-005 scoped tests (`typescript-conformance.test.ts` + `opt-out-attempt.test.ts`) | — | ✅ 13 pass / 0 fail in isolation |

---

## Acceptance Criteria (S-005, individually evidenced)

1. **Minimal fixture supplying none of the six shapes → all six still execute.**
   `REQ-DC-06.1` test spies `realTypescriptDialect.ast.parse`, sets `fixture.samples = []`, and
   asserts `parseCalls === 6`. Live-verified mutation-resistant: deleting one entry from
   `MANDATORY_ADVERSARIAL_SAMPLES` (the duplicate-target sample) makes the count assertion fail
   (`Expected: 6, Received: 5`) — restored cleanly afterward. ✅ PASS.
2. **Identity `parse`/`print` fixture → FAILS before the round-trip assertion vacuously passes.**
   `identity-fixture-violation.ts` + the `[permanent-fixture] REQ-DC-08.1` test. Live-verified:
   narrowing the real-base probe's guard from `ast === null || ast === undefined || ast ===
   sample` down to `ast === null || ast === undefined` (removing the identity half) makes the
   test fail with "Expected promise that rejects, Received promise that resolved" — proving the
   probe, not an accident of test ordering, is what rejects the vacuous fixture. Restored
   cleanly. ✅ PASS.
3. **Shipped dialect + UNMODIFIED FIT-01 → no cross-dialect/AST-library import.**
   `git diff e9f7a26..HEAD -- test/fitness/` is empty (FIT-01 file byte-identical). Live-verified
   the pointer test is load-bearing, not decorative: temporarily renaming
   `test/fitness/fit-01-commons-no-ast.test.ts` makes `REQ-DC-07.1`'s `existsSync` assertion fail
   (`Expected: true, Received: false`). Restored cleanly. ✅ PASS.

---

## DOCUMENTED-LIMIT Audit (owner-affirmed CQ-B, highest priority)

- **No import-graph/scanning logic anywhere in the delta or current `src/conformance/**`.**
  Grepped the full delta diff and both files under `src/conformance/` (`index.ts`,
  `run-vehicle.ts`) for import-graph/scan/ts-morph/readdir/walk patterns — zero hits (the one
  incidental match, `run-vehicle.ts`'s comment about "fit-10's structural guard", is a
  pre-existing unrelated reference to a different fitness function, not new code). Confirmed:
  the kit ships no scanner, exactly as ADR-0012 amendment clause 3 and the north-star CQ-B
  affirmation require.
- **`docs/authoring-a-dialect.md`'s new "leaf rule: dialect isolation" section states BOTH
  halves explicitly**, as CQ-B's affirmation condition demands ("never hidden"):
  - (a) *"the kit DOCUMENTS the leaf contract... Third-party dialect authors are expected to
    self-run their OWN static check... this is a real, documented gap for third-party dialects,
    not a silently-skipped guarantee."* — explicit.
  - (b) *"The SDK's own shipped `@pbuilder/sdk/typescript` dialect IS proven leaf-isolated
    today — by the PRE-EXISTING `FIT-01`... That proof lives in the fitness-function suite, not
    inside `@pbuilder/sdk/conformance` — nothing under `src/conformance/**` re-implements or
    duplicates it."* — explicit.
  Both halves present, unambiguous, matches the owner's CQ-B affirmation condition. ✅ CLEAN.

---

## No Opt-Out (REQ-DC-06.2)

- `DialectFixture` = `{ dialect: Dialect; samples: string[] }` — no disabling field, additive
  injection only (`[...fixture.samples, ...MANDATORY_ADVERSARIAL_SAMPLES]`).
- Compile-pin test (`opt-out-attempt.test.ts`) follows the repo's EXISTING dead-call convention
  exactly (`test/types/define-dialect.test.ts`'s `_negativeProof` / `void _negativeProof`
  pattern, same shape, same `@ts-expect-error` placement).
- **Live-verified**: removing the `@ts-expect-error` comment surfaces
  `TS2353: Object literal may only specify known properties, and 'disableMandatorySamples' does
  not exist in type 'DialectFixture'` under `bunx tsc --noEmit` — restored cleanly, `tsc` clean
  again afterward. ✅ PASS, genuinely load-bearing (not a decorative comment).

---

## `deepEqual` Fold

- `git diff` confirms BOTH local copies (`src/conformance/index.ts`,
  `src/testing/contract-fake.ts`) were deleted, replaced by `import { deepEqual } from
  "../core/deep-equal.ts"`.
- `rg -n "function deepEqual"` across `src/` and `test/` finds exactly ONE definition
  (`src/core/deep-equal.ts:22`) — no leftover local implementations anywhere.
- `src/core/deep-equal.ts` itself predates this delta (created in S-000, commit `e39bd9b`) — S-005
  only re-pointed the two consumers to it, exactly as slices.md's task describes.
- Logic is behavior-identical: the shared module's `isKeyedObject` guard is a structural
  restatement of the two deleted copies' inline `typeof === "object" && !Array.isArray`
  checks — no semantic change. Full suite green (848/848) is the regression evidence; no
  dedicated new test was needed for a pure extraction, and none was claimed.
- FIT-14/pkg-surface baseline rows for `dist/core/deep-equal.*` were already present before this
  delta (added in S-000, `e39bd9b`) — this batch introduced no new baseline drift.
- ✅ CLEAN, no findings.

---

## Real-Base Probe Semantics (REQ-DC-08)

`testDialect`'s guard: `if (ast === null || ast === undefined || (ast as unknown) === sample)`.
Both halves are enforced and independently live-verified:
- **Non-null half**: implicit in the guard (`null`/`undefined` branches) — not independently
  live-mutated in this pass (see Finding #2, triangulation gap), but structurally present and
  exercised by the general contract (every real dialect fixture in the suite passes a
  non-nullish AST through).
- **Distinct-from-input half**: live-verified above (identity-fixture experiment) — this is the
  one REQ-DC-08.1's planted fixture actually exercises.
✅ Mechanism correct; see Finding #2 for the coverage gap on the null/undefined branches
specifically.

---

## Spec Compliance Matrix (S-005 scope)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-DC-06 (chapeau) | "into EVERY `testDialect`/`testOpPack` run" | `typescript-conformance.test.ts` (testDialect only) | ⚠️ **PARTIAL — testOpPack receives no injection at all; see Finding #1** |
| REQ-DC-06.1 | injected samples run even when fixture supplies none | `typescript-conformance.test.ts::REQ-DC-06.1` | ✅ COMPLIANT (scenario is testDialect-scoped by its own literal text; satisfied and mutation-verified) |
| REQ-DC-06.2 | fixture cannot suppress injection (compile) | `planted/opt-out-attempt.test.ts` | ✅ COMPLIANT (live TS2353 verified) |
| REQ-DC-07.1 | shipped TS dialect passes leaf check via FIT-01 | `typescript-conformance.test.ts::REQ-DC-07.1` + FIT-01 (unmodified) | ✅ COMPLIANT (live pointer-break verified) |
| REQ-DC-08.1 | identity fixture rejected before round-trip | `planted/identity-fixture-violation.ts` + test | ✅ COMPLIANT (live mutation verified) |

**Compliance summary**: 4/5 rows compliant; 1 PARTIAL (REQ-DC-06 chapeau, testOpPack half).

---

## Findings

| # | Severity | REQ | Description | Evidence |
|---|---|---|---|---|
| 1 | **CRITICAL** | REQ-DC-06 | `testOpPack` implements ZERO of the six mandatory adversarial samples. Grepped `src/conformance/index.ts`'s `testOpPack` function (lines 237–305) end to end: no reference to `MANDATORY_ADVERSARIAL_SAMPLES` anywhere. A contributor who only writes `OpPackFixture`s (never calls `testDialect`) gets NO adversarial-sample protection today — the exact gap REQ-DC-06's own purpose clause ("regardless of what samples the contributor's own fixture supplies") exists to close. | `rg -n "MANDATORY_ADVERSARIAL" src test` → 2 hits, both inside `testDialect`'s own function body; zero inside `testOpPack` |
| 2 | WARNING | REQ-DC-08 | Triangulation gap on the real-base probe's 3-way OR: only the `ast === sample` (identity) branch has a dedicated planted fixture. No planted fixture exercises the `ast === null` or `ast === undefined` branches independently. Not a functional bug (the branches are trivial equality checks), but Strict TDD final mode does not tolerate untested non-trivial branches in a security-sensitive guard (REQ-DC-06/08 are both flagged `security (code execution)` in Sensitive Areas Coverage). | `fd . test/conformance/planted` — no `parse: () => null` / `parse: () => undefined` fixture exists |

No other findings — banned-assertion-pattern scan on both delta test files returned zero
matches; commit messages are conventional; docs stay in English.

---

## Deviation Rulings (apply-progress.md's 3 claimed deviations, re-verified independently)

### (a) Injection scoped to `testDialect` only, not `testOpPack` — **RULED: genuine gap, not an acceptable narrowing**

Apply-progress frames this as "design §4.1/§4.5 prose vs Test Derivation table/slices task text
conflict" and resolves it toward the narrower (Test Derivation table/slices) reading. I read the
actual sources and reach a different conclusion:

- **The SIGNED SPEC's own REQ-DC-06 chapeau text** (not just design prose) is explicit and
  unhedged: *"The conformance kit MUST inject SIX mandatory adversarial samples... into EVERY
  `testDialect`/`testOpPack` run, regardless of what samples the contributor's own fixture
  supplies."* Compare REQ-DC-07 and REQ-DC-08, both of which carry an explicit **"Design flag"**
  paragraph granting design latitude to choose the verification mechanism — REQ-DC-06 has NO
  such hedge. The absence is meaningful: the spec author gave design room to choose *how* to
  enforce the leaf rule and the real-base rule, but not room to narrow *where* the mandatory
  samples apply.
- **Design's own ADR-0012 amendment prose (§4.5)** repeats the spec's commitment verbatim:
  *"testDialect/testOpPack inject six adversarial samples ADDITIVELY on every run."* Design does
  NOT contradict the spec here — it is design's OWN Test Derivation table (§4.6) and File
  Changes that silently narrowed the operationalization to `testDialect` alone, without a
  documented rationale or an ADR clause explaining the narrowing.
- **This narrowing predates S-005's apply.** It was already baked into `slices.md`'s Task 1 text
  and Acceptance criteria (visible in the pre-apply, `[ ]`-unchecked version of the same lines)
  and survived FOUR plan-verify iterations to `READY`. The Executor for S-005 followed the
  concrete, approved planning artifact (slices.md + Test Derivation table) rather than the more
  authoritative spec chapeau — a reasonable-looking choice in isolation, but one that leaves a
  signed, unhedged, sensitive-area REQ half-unimplemented.
- **This REQ-DC-06.1 scenario itself is not left unsatisfied** — its own Given/When/Then text
  says "WHEN `testDialect` runs," nothing about `testOpPack`. So the scenario, read narrowly,
  passes. But `sdd-verify`'s own hierarchy is "compare against SPECS first (behavioural
  correctness), DESIGN second" — and the REQ-DC-06 requirement (as opposed to its one scenario)
  is what actually carries the MUST. A scenario satisfying its own narrow text does not
  discharge the REQ's broader chapeau when the chapeau names a second, entirely unaddressed
  function.
- **North-star CQ-B's owner affirmation reinforces this**: *"Runtime-observable rules (6
  injected samples + real-base probe) are enforced."* — stated as an unqualified fact
  supporting the leaf-rule documented-limit tradeoff. That statement is currently only true for
  `testDialect`.

**Ruling: this is a genuine, unresolved compliance gap against the signed spec, not a
legitimate design narrowing.** It is feasible to close without a full re-spec/re-design cycle:
`testOpPack` already receives `fixture.baseDialect: Dialect` (the same shape as
`DialectFixture.dialect`), so the fix is to reuse `testDialect`'s existing round-trip +
real-base-probe loop against `fixture.baseDialect` for the six mandatory samples, independent of
the op-exercises' seed/chain/expect shape (no per-op expected-output synthesis needed —
apply-progress's stated justification for why this "has no generic slot" does not hold up under
inspection, since the six samples only need a round-trip check against the base dialect, not an
op-chain exercise). **Routing: LOCAL** (Executor SDD-light, iteration 2) — extract the
round-trip+probe loop into a shared helper, call it from both `testDialect` (against
`fixture.dialect`) and `testOpPack` (against `fixture.baseDialect`). Given this touches a
sensitive, owner-affirmed REQ, I recommend the orchestrator have the owner glance at the fix
before it's folded into a clean PASS — not because the routing is ambiguous, but because the fix
changes `testOpPack`'s runtime behavior (six extra parse/print round-trips per call) beyond what
was explicitly reviewed at CQ-B time.

### (b) Duplicate-target sample shape (two imports sharing one module specifier) — **RULED: acceptable**

REQ-DC-06's chapeau names "a duplicate-target case" without defining it anywhere in spec,
design, or slices (confirmed via `rg -n "duplicate-target"` across all four artefacts — zero
elaboration beyond the term itself). The chosen interpretation
(`import { a } from "m";\nimport { b } from "m";\n`) is a reasonable, `testDialect`-appropriate
reading: round-trip preservation must NOT merge or de-duplicate on print (round-trip is
presentation-preserving, not semantic-normalizing) — exactly the property this sample exercises.
Empirically confirmed to round-trip byte-exact against the real TypeScript dialect (proven by
the REQ-DC-06.1 spy test, which runs all six samples including this one through
`realTypescriptDialect.ast.parse`/`print` and resolves clean). No better precedent exists
elsewhere in the codebase for this term. **Acceptable, no action needed.**

### (c) 4 MiB construction technique divergence from REQ-TSD-03.7 — **RULED: acceptable, correctly scoped**

REQ-TSD-03.7's technique (`'"'.repeat(quoteCount) + "a".repeat(remainder)`, precisely computed
to land exactly 1 byte over `BATCH_CAP_BYTES` in JSON-SERIALIZED form) targets a specific
wire-protocol boundary (`BATCH_CAP_BYTES`) that has no bearing on `testDialect`'s round-trip
check — `testDialect` never serializes a batch or constructs a directive; it only calls
`parse`/`print` directly on a source string. Reusing REQ-TSD-03.7's exact byte arithmetic would
tie `testDialect`'s sample to an unrelated wire-level constant for no functional reason. The
chosen flat `4 * 1024 * 1024` padding satisfies the spec's actual ask ("a 4 MiB
serialized-boundary sample (REQ-TSD-03.7 precedent)" — precedent for the ORDER OF MAGNITUDE, not
literal reuse of the batch-cap arithmetic) and is empirically confirmed to round-trip byte-exact.
**Acceptable, correctly scoped to testDialect's actual concern.**

---

## Strict TDD (in-loop audit)

**Iteration**: 1 (batch B4)
**Verdict**: **concerns** (see Finding #2, triangulation; tolerated at in-loop per module rules,
flagged for final)
**Delta scope**: 3 test files changed/created (`typescript-conformance.test.ts`,
`planted/opt-out-attempt.test.ts`, `planted/identity-fixture-violation.ts`), 2 impl files
(`src/conformance/index.ts`, `src/testing/contract-fake.ts`), 1 doc file
(`docs/authoring-a-dialect.md`)

**TDD adherence (light)**: every new production surface (`MANDATORY_ADVERSARIAL_SAMPLES`
injection, real-base probe, `deepEqual` re-import) has a corresponding test or is covered by
full-suite regression (the `deepEqual` extraction). No new file ships without tests.

**Banned assertion patterns (delta)**: scanned both delta test files for `.toBeDefined()`,
`.toBeTruthy()`/`.toBeFalsy()`, `objectContaining`-as-whole-assertion, `.not.toThrow()`-only,
mock-heavy/CSS-coupled patterns — zero matches. All assertions are content-exact (`toBe`,
`resolves`/`rejects` with regex-matched messages, `existsSync` boolean).

**Triangulation**: `REQ-DC-06.1`'s spy-count assertion is a single deterministic case (injected
set is fixed-size, not a class of varying inputs — correctly assessed as not requiring
triangulation in apply-progress). The real-base probe's 3-way OR has ONE tested branch (identity)
out of three (see Finding #2) — **gap, tolerated at in-loop, must be closed or explicitly
justified as trivially-safe before final**.

**Regression**: full suite 848/848 — zero regressions from S-000 through S-005.

---

## Completeness Check

All 5 S-005 tasks are marked `[x]` in `slices.md`. Task 1's checkbox text describes injecting the
six samples "into `src/conformance/index.ts`" without naming `testOpPack` explicitly in the task
line itself — so the checkbox is not literally false — but the underlying REQ-DC-06 it traces to
IS only half-satisfied (Finding #1). Flagging here per Step 4: the task-complete mark should not
be read as "REQ-DC-06 fully satisfied."

---

## Mutation-Resistance Spot Checks (3 live experiments, all restored cleanly)

1. Dropped the duplicate-target sample from `MANDATORY_ADVERSARIAL_SAMPLES` → REQ-DC-06.1's
   `expect(parseCalls).toBe(6)` failed (`Received: 5`). ✅ load-bearing.
2. Weakened the real-base probe (`ast === null || ast === undefined || ast === sample` →
   `ast === null || ast === undefined`) → REQ-DC-08.1 failed ("Expected promise that rejects,
   Received promise that resolved"). ✅ load-bearing.
3. Renamed `test/fitness/fit-01-commons-no-ast.test.ts` → REQ-DC-07.1's `existsSync` assertion
   failed (`Received: false`). ✅ load-bearing.
4. Removed the `@ts-expect-error` annotation on `opt-out-attempt.test.ts` → `tsc --noEmit`
   surfaced `TS2353` as claimed. ✅ load-bearing (compile-pin, item 4 in mandate).

All four working-tree mutations were restored before moving to the next; `git status --short`
confirmed clean (only the pre-existing, orchestrator-owned `.sdd/state/*.json` delta — not
touched by me — remained modified throughout).

---

### Issues Found

**CRITICAL**: Finding #1 — REQ-DC-06's testOpPack half is unimplemented (see Deviation Ruling
(a) for full analysis and recommended fix path).

**WARNING**: Finding #2 — triangulation gap on the real-base probe's null/undefined branches.

**SUGGESTION**: None.

---

## Carry to Verify-Final (consolidated — this is the LAST in-loop pass)

1. **REQ-DC-06 testOpPack gap (Finding #1, CRITICAL)** — if not fixed before final verify, this
   MUST surface there too; do not let a clean full-suite run paper over it. Final verify's Spec
   Compliance Matrix should keep REQ-DC-06 (chapeau) as a distinct row from REQ-DC-06.1/06.2
   scenarios, exactly as done in this report, so the PARTIAL doesn't get silently absorbed into
   two COMPLIANT scenario rows.
2. **Triangulation gap on the real-base probe's null/undefined branches (Finding #2, WARNING)** —
   Strict TDD final mode does not tolerate this; either add a planted fixture with a
   nullish-returning `parse`, or final verify must explicitly justify the branch as "trivially
   passthrough" per the strict-tdd-verify.md exemption clause.
3. **From verify-in-loop-3 (B3), still open**: SUGGESTION re: `isContained` non-branding
   assertion for S-004 compose-time throws — non-blocking, carried forward again since S-005
   didn't touch that surface.
4. **Cross-batch aggregate for final's Strict TDD audit**: TDD Cycle Adherence method used across
   all 4 batches was file-pairing + manually-captured RED/GREEN evidence in apply-progress.md
   (project does not commit per RED/GREEN cycle) — consistent methodology throughout, final
   verify should aggregate, not re-derive.
5. **Owner consultation recommended (not a hard blocker)**: given CQ-B's affirmation text ("6
   injected samples... are enforced," unqualified) and REQ-DC-06/08's sensitive-area flag, the
   orchestrator may want the owner to glance at whatever fix closes Finding #1, since it changes
   `testOpPack`'s runtime behavior beyond what was reviewed at foresight time.

---

## Fix Recommendation for Iteration 2

Extract `testDialect`'s existing round-trip + real-base-probe loop (lines ~192–212 of
`src/conformance/index.ts`) into a shared helper parameterized by dialect + sample list. Call it
twice: once from `testDialect` (as today, against `fixture.dialect`), once from `testOpPack`
(new, against `fixture.baseDialect`, independent of `fixture.exercises`). This closes REQ-DC-06's
chapeau without touching `OpExercise`'s seed/chain/expect shape and without synthesizing any
per-op expected output — the six samples get the SAME treatment `testDialect` already gives
them, just against a second dialect reference. Add a spy-count test mirroring REQ-DC-06.1's
existing one, scoped to `testOpPack`.

Orchestrator action: re-invoke `/build` (SDD-light) targeting Finding #1 only. Iteration 1 of 3
used for batch B4.

---

# Fix Re-verification (iteration 2) — commit `dd1d109`

**Delta re-verified**: `git show dd1d109` — `runRoundTripProbe()` extraction
(`src/conformance/index.ts`), `testOpPack` tail call against `fixture.baseDialect`, new
`REQ-DC-06.3` spy test, planted fixtures `null-parse-violation.ts` /
`undefined-parse-violation.ts` + `REQ-DC-08.2`/`08.3` tests.

## Verdict: both findings CLOSED — batch B4 PASS

## Execution evidence (reproduced independently)

| Check | Claimed | Verified |
|---|---|---|
| `bun test` (full suite) | 851 pass / 0 fail | ✅ **851 pass / 0 fail, 1538 expect() calls** |
| `bunx tsc --noEmit` | clean | ✅ clean, exit 0 |

## Finding #1 closure (CRITICAL → CLOSED)

- `runRoundTripProbe()` is a faithful extraction of `testDialect`'s previous loop (same 3-way
  guard, same REQ-DC-08/REQ-DC-01 error texts, now `label`-scoped); `testDialect` behavior
  unchanged (its pre-existing tests, including all mutation-verified ones from iteration 1,
  still pass).
- `testOpPack` now runs the six mandatory samples against `fixture.baseDialect`
  unconditionally at the end of every call whose exercises pass.
- **Mutation-kill reproduced live**: commenting out the `testOpPack` probe call →
  `REQ-DC-06.3` fails (`seenSources.slice(-6)` received `[]` — zero mandatory samples seen).
  Restored cleanly (byte-exact vs HEAD, suite back at 851/0). The assertion is order- and
  content-exact (`toEqual` on the full six-string array in declaration order), not a bare count.
- Observation (non-finding): with the probe disabled, `seenSources` was EMPTY — the exercise
  loop never routes through `fixture.baseDialect.ast.parse` via that property path, so the
  test's `slice(-6)` tail-guard is defensive rather than currently load-bearing. Harmless;
  the assertion is strictly stronger than needed.

## Finding #2 closure (WARNING → CLOSED)

Both new planted fixtures genuinely drive their guard branches — verified by live branch
mutations, each restored cleanly:
- Dropped `ast === null` from the guard → `REQ-DC-08.2` fails (rejects with REQ-DC-01 instead
  of REQ-DC-08 — the null-parse fixture reaches `print` and fails round-trip, proving the
  branch, not an accident, is what produces the REQ-DC-08 rejection). ✅ killed.
- Dropped `ast === undefined` → `REQ-DC-08.3` fails the same way. ✅ killed.
All three branches of the 3-way OR now have an independently-triangulated planted fixture
(identity from iteration 1, null + undefined from this fix). Triangulation gap closed; no
production change was needed and none was made to the guard's logic.

## Ordering deviation — RULED: ACCEPTED

The Executor placed the `testOpPack` probe AFTER the exercise loop, not before as my iteration-1
recommendation sketched. Ruling with evidence:

1. **The two orderings are verdict-equivalent for every possible input.** Enumerating the
   cases: exercises pass + probe passes → resolves under both orderings; exercises pass +
   probe fails → rejects under both; exercises fail (probe would pass or fail) → rejects under
   both. There is NO input that passes under probe-last but would fail under probe-first — the
   ordering affects only WHICH error message surfaces first, never the pass/fail outcome. The
   "a sloppy/malicious pack could fail one exercise to dodge the samples" hole is not real:
   dodging the samples by failing an exercise still FAILS the conformance run — there is no
   path from a dodge to a green check, which is the only outcome REQ-DC-06 protects.
2. **The signed spec prescribes injection and non-opt-out, not ordering.** REQ-DC-06's chapeau
   ("into EVERY `testDialect`/`testOpPack` run... ADDITIVE to, never a replacement for") and
   scenario REQ-DC-06.1's Given/When/Then say nothing about sequence. "Additive" is satisfied
   literally — the samples run in addition to the exercises, on every call.
3. **Probe-last is CONSISTENT with `testDialect`'s own approved semantics.** `testDialect`
   appends the mandatory set AFTER `fixture.samples` in one array — a fixture whose own first
   sample fails round-trip never reaches the mandatory set either. "Injected content runs
   only if the fixture's own content survives first" was already the established, REQ-DC-06.1-
   blessed behavior; probe-last in `testOpPack` is the same rule, not a new weakening.
4. **The Executor's breakage claim reproduced exactly.** Moving the probe to the top of
   `testOpPack` live broke precisely the four claimed `[permanent-fixture]` tests (REQ-DC-05.1
   coalescing slot, REQ-DC-04.1, REQ-DC-04.2, REQ-DC-05.2) — confirmed from source that
   `coalescing-violation.ts`/`read-split-violation.ts` use identity `parse` (probe rejects
   REQ-DC-08) and both smuggle fixtures have broken `print` (probe fails REQ-DC-01), masking
   each fixture's targeted violation. Those fixtures are themselves spec-load-bearing
   (REQ-DC-05's text mandates the closure-smuggle instance "MUST NOT be omitted"), so
   probe-first is not just inconvenient — it degrades the planted suite's diagnostic
   specificity that REQ-DC-05 exists to pin. Experiment restored cleanly (byte-exact vs HEAD).

The Executor's comment block at the call site documents the reasoning in place — future readers
won't re-litigate the ordering blind.

## Post-experiment state

`git status --short` → only the pre-existing orchestrator-owned `.sdd/state/*.json` delta and
this report file modified; `git diff -- src/ test/` empty; full suite re-run green (851/0).

## Updated Carry to Verify-Final (supersedes the iteration-1 list)

1. ~~REQ-DC-06 testOpPack gap~~ **CLOSED by `dd1d109`** — final verify's compliance matrix can
   now mark REQ-DC-06 (chapeau) COMPLIANT, evidenced by REQ-DC-06.1 + REQ-DC-06.3 together.
2. ~~Triangulation gap on the real-base probe~~ **CLOSED by `dd1d109`** (REQ-DC-08.2/08.3).
3. **Still open, from verify-in-loop-3 (B3)**: SUGGESTION re: `isContained` non-branding
   assertion for S-004 compose-time throws — non-blocking.
4. **Cross-batch aggregate for final's Strict TDD audit**: method across all 4 batches =
   file-pairing + apply-progress RED/GREEN evidence (no per-cycle commits) — aggregate, don't
   re-derive.
5. **Owner visibility (recommended, not blocking)**: `dd1d109` changes `testOpPack`'s runtime
   behavior (six extra parse/print round-trips per call, probe-last ordering) beyond what CQ-B's
   foresight affirmation reviewed. The ordering ruling above is technically sound; surfacing it
   to the owner at /evaluate time keeps the CQ-B trail honest.
6. **Note for final verify**: REQ-DC-06.3's tail-guard observation (exercise loop doesn't
   route through `baseDialect.ast.parse`) — zero-cost awareness item if anyone later refactors
   the run vehicle to consume the fixture's `ast` property directly.

Orchestrator action: batch B4 loop EXITS on PASS. All 6 slices (S-000..S-005) built and
verified in-loop. Proceed to `/evaluate` (sdd-verify --mode=final) before archive. Iteration 2
of 3 used for batch B4.
