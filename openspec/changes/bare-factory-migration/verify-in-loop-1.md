# Verify In-Loop Result

**Change**: bare-factory-migration
**Iteration**: 1/3
**Scope**: S-000
**Mode**: in-loop (Strict TDD)

---

### Verdict: HALT

**Halt reason**: ARCHITECTURAL (plan-scope gap — self-discovered by the builder, confirmed by
independent re-run; requires a slices.md update before the Executor may proceed past S-000).

A second, independent CRITICAL finding (REQ-coverage gap, category LOCAL) is also reported below
— it does not by itself require a halt, but should be fixed in the same pass once the plan gap is
resolved, since both block a clean S-001+ start.

---

## Evidence Table

| Check | Command | Result |
|---|---|---|
| Regression sentinels (R-5 manifest) | `git diff --name-only $(git merge-base main HEAD) -- test/golden-ir test/core test/conformance test/dialects` | **Empty** — clean |
| Frozen `defineFactory` body | `git diff --name-only <merge-base> HEAD -- src/core/context.ts` | **Empty** — file untouched entirely (body `:293-346` AND JSDoc `:248-292` both untouched) |
| S-000 scoped tests | `bun test test/fitness/fit-29-sanctioned-definefactory-caller.test.ts test/fitness/fit-04-dts-semver-gate.test.ts test/types/runfactoryfortest-shape.test.ts test/docs/quickstart-docs.test.ts` | **53 pass, 0 fail** — matches apply-progress's claim exactly |
| Full suite | `bun test` | **1162 pass, 99 fail** (100 `(fail)` lines counted; off-by-one vs. summary, not material) — matches apply-progress's claimed baseline exactly |
| Typecheck | `bun run typecheck` | **64 errors**, all in the same 14 files as the `bun test` failures — zero net-new files beyond apply-progress's bucketing |
| Deprecation tags | `rg "@deprecated|TODO.*remove"  src/testing/index.ts src/core/context.ts` | none found — ruling #6 honored |
| Single-wrap-seam | `rg "defineFactory" src/testing/index.ts` | exactly one call site (`defineFactory<O>(fn, ...)` at the wrap boundary) plus the pre-existing public re-export and the new internal import — no parallel wrap logic |
| Banned assertion patterns (delta tests) | manual scan of the 4 new/changed test files | none found |

### Full-suite failure bucketing — RE-VERIFIED, not just trusted

I re-ran `bun test` myself and grouped the 100 `(fail)` lines by file (via the printed file
headers), then cross-checked every failing file against apply-progress.md's three named buckets:

| Bucket (apply-progress's own label) | Files | Fails | In slices.md? |
|---|---|---|---|
| "Scope Gap" (5 unclaimed files) | `test/fake/copyin-fidelity.test.ts`, `test/scaffold/batch-cap-chunk.test.ts`, `test/scaffold/classify-transport.test.ts`, `test/scaffold/scaffold-fake.test.ts`, `test/e2e/author-emulation/ir-transcript.test.ts` | 16 | **NO** — see Finding 1 |
| "Self-healing once S-004 lands" | `test/e2e/author-emulation-scaffold.e2e.test.ts`, `test/e2e/author-emulation/corpus-format.test.ts`, `test/fitness/fit-24-corpus-purity.test.ts`, `test/fitness/fit-28-corpus-determinism.test.ts` | 49 | Yes — these consume `scenarios.ts`'s `FactoryRunner`/`SCENARIOS`, S-004's explicit scope |
| "Explicitly planned, red until own slice" | `test/fake/harness-{result,leak-scan,opted-in,in-memory-invariant}.test.ts` (S-002), `test/e2e/installed-consumer.e2e.test.ts` (S-006), `.tmp-readme-copy-runnable/example-0.test.ts` (S-003) | 35 | Yes — named verbatim in S-002/S-003/S-006's own Failing-first lists |

Reproduced the exact double-wrap crash apply-progress describes (`TypeError: Cannot destructure
property 'client' from null or undefined value`, at `context.ts:323` via `src/testing/index.ts:126`)
for both the "Scope Gap" bucket and the "explicitly planned" harness bucket — same root cause
(old convention: `defineFactory(fn, {packageDir}).` built directly, then passed to
`runFactoryForTest(wrappedRunner, input)`, which now wraps it a SECOND time).

**Conclusion on Step 3 (Full-suite state)**: two of the three buckets are legitimately covered by
a later slice's explicit scope. The "Scope Gap" bucket (16 of the 99/100 failures, 5 files) is
NOT — see Finding 1.

---

## Findings

### Finding 1 — CRITICAL — Halt reason: ARCHITECTURAL
**What**: 5 test files fail via the double-wrap `TypeError` and are not named by any slice's
`Covers`/`Failing-first` list in the currently-signed `slices.md`.
**Files**: `test/fake/copyin-fidelity.test.ts`, `test/scaffold/batch-cap-chunk.test.ts`,
`test/scaffold/classify-transport.test.ts`, `test/scaffold/scaffold-fake.test.ts`,
`test/e2e/author-emulation/ir-transcript.test.ts`.
**Evidence**: S-002's Failing-first line reads "`harness-result.test.ts` ..., `harness-in-memory-
invariant.test.ts` ..., `harness-opted-in.test.ts` ..., 3 `test/scaffold/*` per-message tests,
`commons/index.ts` JSDoc token-scan test" — "3 `test/scaffold/*` per-message tests" reads as the
error-MESSAGE-wording tests for `readTemplateFile`/`copyIn`/`scaffold` (§14 of the Executor
Context), not the calling-convention fix for `batch-cap-chunk.test.ts`/`classify-transport.test.ts`/
`scaffold-fake.test.ts`. `copyin-fidelity.test.ts` and `ir-transcript.test.ts` (the test FILE, not
`test/support/ir-transcript.ts`) appear in NO slice's file list at all.
**Self-reported**: apply-progress.md's own "HALT-WORTHY DISCOVERY" section already flags this and
recommends "this should be resolved by the Planner (re-run `sdd-slice` with this finding) BEFORE
`/build` continues past S-000." I independently re-derived the same 5 files and confirmed the
crash mode; the builder's self-report is accurate and the recommendation is correct.
**Why this halts rather than becomes a NEEDS_FIX for the next Executor iteration**: fixing these 5
files is mechanically identical to S-002's own fix shape, but silently rolling it into whichever
slice happens to touch them next means the signed `slices.md` artifact under-describes what
`/build` actually does — the eventual `verify --mode=final` spec-compliance pass has no REQ/slice
anchor to check these 5 files against, and S-006's hard gate ("ALL of S-001..S-005 complete")
would have no way to know these files count.
**Recommended action**: route to Planner — re-run `sdd-slice` folding these 5 files explicitly
into S-002 (or a small supplemental slice before it), per apply-progress's own recommendation.

### Finding 2 — CRITICAL — routing LOCAL
**What**: S-000's own `Covers` line claims REQ-ATH-01.4, REQ-ATH-17.1, and REQ-ATH-17.2 — all
three have an explicit runtime GIVEN/WHEN/THEN behavioral acceptance criterion in slices.md's
S-000 section — but there is **zero test in the entire suite** that calls `runFactoryForTest`
with `{seed: ...}` or `{packageDir: ...}` in the new options-bag position.
**Evidence**:
- `rg -n "runFactoryForTest\(" test/ -A2 | rg -B2 "packageDir"` → no matches anywhere.
- `rg -n "runFactoryForTest\(" test/ -A2 | rg -B2 "seed:"` → no matches anywhere.
- The only place the bag shape with both fields appears is `test/types/runfactoryfortest-
  shape.test.ts`'s `_bareProof` closure — that closure is wrapped in `void _bareProof` and, per
  the file's own header comment, "tsc evaluates it... runtime never runs it." It proves the
  TYPE accepts `{seed, packageDir}`; it proves nothing about whether `defineFactory` actually
  receives them, whether `options?.packageDir !== undefined` is evaluated correctly, or whether
  the schema-validation fork (ATH-17.1 vs ATH-17.2) actually fires/doesn't-fire at runtime.
- Every EXISTING test that passes a 3rd positional argument to `runFactoryForTest` still uses the
  OLD bare-seed-object convention (e.g. `runFactoryForTest(run, undefined, { "a.ts": "old" })` in
  `harness-leak-scan.test.ts:93`, `harness-result.test.ts:62`, etc.) — these are all in the
  known-red buckets (S-002/Finding 1), not new coverage of the bag form, and under the new
  signature this raw object is silently swallowed as `options` with `options.seed === undefined`
  (exactly the REQ-ATH-17.3-flagged mutant class: "a mutant that silently drops the forwarded
  `packageDir`... would not be caught").
**Failure scenario**: a typo (`options?.seed` read as `options?.Seed`, or the `packageDir !==
undefined` guard inverted) would ship green — nothing in the suite exercises the bag's `seed` or
`packageDir` fields at runtime.
**Recommended action**: before S-000 can be considered acceptance-complete, add runtime tests for:
(a) `runFactoryForTest(bareFn, input, { seed: {...} })` producing the collision behavior
REQ-ATH-01.4 describes, (b) `runFactoryForTest(bareFn, input, { packageDir })` with schema-invalid
input rejecting (REQ-ATH-17.1), and (c) the SAME input with no `packageDir` running unchanged
(REQ-ATH-17.2). This is a LOCAL fix — no design change needed, the delegation code itself
(`src/testing/index.ts:119-122`) reads correctly on inspection; it is simply unverified.

### No other findings
- Deviation #1 (kept the direct re-export form alongside a fresh internal `import`) is legitimate
  ES-module semantics, well-documented, and covered by FIT-29's own positive-control test
  expecting two occurrences. Not a finding.
- The stale JSDoc example above `runFactoryForTest` (still shows the OLD `defineFactory`-wrapped
  shape and param name `factory`) is explicitly out of S-000's scope per the Executor Context
  §8b/§15 (JSDoc rewrite is S-002/S-003's job) — not flagged here.
- TDD pairing (Method 2): every implementation file touched in this slice has a corresponding new
  or updated test file in the same commit; no anti-TDD pattern observed. Single commit for the
  whole slice, so Method 1 (per-cycle git history) does not apply — consistent with the project's
  per-slice commit granularity noted elsewhere in this change.
- No banned assertion patterns in the 4 new/changed test files.

---

## Recommended Action

Orchestrator: do not re-invoke the Executor for S-001+ yet.
1. Route Finding 1 to the Planner — re-run `sdd-slice` to explicitly fold the 5 unclaimed files
   into S-002 (or a supplemental slice), per apply-progress's own recommendation.
2. Fold Finding 2 into the same replanned scope (or explicitly re-open S-000 for one more
   iteration) — add the 3 missing runtime behavioral tests before S-000 is called complete.
3. Re-run `sdd-verify --mode=in-loop` (iteration 2) against the updated plan/tests before
   resuming `/build` on S-001+.
