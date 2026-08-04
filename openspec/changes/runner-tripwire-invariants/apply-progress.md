# Apply Progress: Runner Tripwire Invariants

## Slice: S-000 — Walking Skeleton, Publish path proves what it ships

**Status**: complete. Covers REQ-PPI-01, REQ-PPI-02, REQ-PPI-03 (S-000 leg), REQ-PPI-04,
REQ-PPI-05 — 22 signed scenarios' worth of behaviour realised as 11 new tests (11/11 of
S-000's own Test Derivation row count: PPI-01 x2, PPI-02 x2, PPI-03 x1 structural + x2
behavioural, PPI-04 x2, PPI-05 x2).

### Scenarios covered, red → green evidence

| REQ-ID | Scenario | Test | Red evidence | Green evidence |
|---|---|---|---|---|
| REQ-PPI-05.1 | execution order read, not textual position | `fit-23-*.test.ts` "an order-irrelevant step... does not disturb their relative order" | n/a (positive path, already true of the array-order filter) | pass |
| REQ-PPI-05.2 [red-proof] | textual/execution divergence caught | `fit-23-*.test.ts` "a step reordered only in execution (via `needs:`), not text, is caught" | Failed against the old declaration-order `publishRunSteps`: expected `["stamp","publish","build"]`, received `["build","stamp","publish"]` | Passes after `publishRunSteps` was rewritten to topologically order jobs by `needs:` (new `topologicalJobOrder`), preserving within-job step position |
| REQ-PPI-02.1 | rebuild step present + positioned | `fit-23-*.test.ts` "publish.yml declares an explicit rebuild step..." | `ReferenceError: checkExplicitRebuildStep is not defined` (function didn't exist), then `{ok:false}` against the un-hardened `publish.yml` | Passes once `checkExplicitRebuildStep` was added and `publish.yml` gained the explicit "Rebuild after version stamp" step |
| REQ-PPI-02.2 [red-proof] | absence caught | `fit-23-*.test.ts` "a simulated workflow with the stamp immediately followed by publish... is caught" | Same `ReferenceError` as above during the RED phase | Passes: `{ok:false, reason:"no explicit rebuild step declared between the version stamp and the publish step"}` |
| REQ-PPI-03.1 | suite gates publish (structural) | `fit-23-*.test.ts` "publish.yml declares a `bun test` step strictly before the publish step..." | `ReferenceError: checkSuiteGate is not defined`, then `{ok:false}` (no suite step in publish.yml) | Passes once `checkSuiteGate` was added and `publish.yml` gained the "Run test suite" step (`bun test`, no `continue-on-error`) before publish |
| REQ-PPI-03.2 [red-proof] | violating closure never reaches publish (S9, S-000 leg: any suite-check failure) | `fit-46-*.test.ts` "a failing suite check blocks the publish step — no publish-step log line ever appears" | Manually inverted the assertion (`expect(publishReached).toBe(true)`) to confirm the mechanism genuinely blocks: failed with `Expected: true, Received: false` | Passes with the correct assertion (`publishReached === false`, `log === []`) restored |
| REQ-PPI-03.3 | clean closure reaches publish — sibling positive | `fit-46-*.test.ts` "a clean closure reaches the publish step — sibling positive" | n/a (positive path; validated by construction against the same harness that failed correctly above) | pass |
| REQ-PPI-04.1 | per-file timeout declared | `fit-23-*.test.ts` "react-conformance.test.ts calls setDefaultTimeout with a value distinct from Bun's 5000ms default" (structural) | `expect(match).not.toBeNull()` failed — `react-conformance.test.ts` declared no timeout | Passes once `setDefaultTimeout(20000)` was added to `react-conformance.test.ts` |
| REQ-PPI-04.2 [red-proof] | non-resolving fixture fails at the boundary | `react-conformance.test.ts` "a fixture that never resolves fails at its declared per-file timeout, naming the file" | Manually verified the underlying mechanism first (a scratch fixture with `setDefaultTimeout(300)` and a never-resolving promise): child `bun test` exits 1, output contains `hanging-fixture.test.ts` and "this test timed out after 300ms" | Test passes, asserting exactly that child-process behaviour |
| REQ-PPI-01.1 | packed digests match packed bytes | `fit-46-*.test.ts` "packed digests match packed bytes after the real stamp -> rebuild -> pack sequence" | Manually inverted (`expect(...length).toBeGreaterThan(0)`) — failed with `Received: 0`, proving the normal path is genuinely clean before restoring the correct `toEqual([])` | Passes: 0 mismatched digests across all 24 manifest-recorded files |
| REQ-PPI-01.2 [red-proof] | `--ignore-scripts` (modelled as skip-rebuild) breaks the implicit dependency | `fit-46-*.test.ts` "skipping the rebuild after the stamp leaves the package.json digest stale, naming the field" | Manually inverted (`expect(...).toEqual([])`) — failed with `Received: ["package.json"]`, proving the skip-rebuild path genuinely goes stale before restoring the correct assertion | Passes: exactly `["package.json"]` mismatches, nothing else |

### Key engineering decision: fit-46's "rebuild" step

`slices.md`'s own Build-mechanics note pins the scratch target to `dist/` + `package.json`
only (same shape as `fit-42`'s `pristineRoot`), which makes a literal `tsc` rebuild
impossible inside the scratch tree (no `src/`, no `tsconfig.build.json`, no `node_modules`).
The part of `bun run build` that actually determines REQ-PPI-01's outcome is its LAST step —
`bun scripts/generate-runner-manifest.ts`, which regenerates the manifest against
`dist/` + `package.json` only (no `src/` dependency) — so `fit-46` invokes that script
directly as the "rebuild" leg, exactly reusing `fit-42-runner-closure-integrity.test.ts`'s
own established safe pattern at lines 375-381 (`runGenerator`): `cwd: PROJECT_ROOT` so
`scripts/`/`node_modules` resolve, with the scratch root passed as an explicit CLI argument
so the script only ever WRITES inside that argument path. This is deliberately NOT the R1-12
anti-pattern the same slices.md note warns against (`REQ-BPI-04.1`'s existing test at
`fit-42-runner-closure-integrity.test.ts:151-161`, which passes NO root argument and
therefore mutates the real `dist/` in place). `npm version`/`npm pack` genuinely need
`cwd: <scratchRoot>` (no CLI argument redirects them elsewhere), so those two run there
directly. Verified manually end-to-end (stamp → regenerate → pack → extract → compare) in an
ephemeral `/tmp` scratch dir before writing the test, confirming: `npm pack` writes exactly
the tarball filename to stdout (nothing else); the tarball's `package.json`/manifest
`packageVersion` both reflect the stamp; skipping the regenerate step leaves exactly
`package.json`'s digest stale, nothing else — matching REQ-PPI-01.2's scenario text exactly.

### REQ-PPI-03.2/.3 S-000 leg: gate-mechanism proof

Per `specs/publish-pipeline-hardening/spec.md`'s dated note under REQ-PPI-03.2 and
`slices.md`'s own S-000.4 task text: CAP-01..06 (S-001..S-004) do not exist at S-000 build
time, so this leg proves the MECHANISM only — a failing suite check blocks publish,
structurally, independent of which check fails — using a planted `expect(1).toBe(2)`
failure, never a Constraint-4 fixture. Implemented as a child `bun test <scratchRoot>`
invocation (`cwd: PROJECT_ROOT`, scratch directory as the positional filter argument),
mirroring `test/docs/testing-story-docs.test.ts:69`'s child-process shape (adapted from a
single scratch file to a whole scratch directory — verified empirically that `bun test
<absoluteDirPath>` correctly scopes discovery to that directory). The S-001 leg (re-running
this scenario against a real Constraint-4-violating fixture) is scheduled as S-001.10 per
`slices.md`, not built here.

### Red-proof tag convention

All 5 new `[red-proof]`-tagged tests use the NEW convention ratified in `slices.md`'s
plan-verify final batch (B3): `"REQ-<ID> [red-proof]: <description>"` — REQ-ID first. The 18
S-000-tier survival red-proofs in `fit-42-*.negative.test.ts` are untouched by this slice
(they belong to S-001/S-002) and were not retitled.

### Gate results (full worktree)

- `bun test` (full suite): **2462 pass, 0 fail**, 5503 `expect()` calls, across 202 files,
  73.58s (post verify-in-loop-1 fix round; was 2459/2459 pass, 5497 `expect()` calls, 76.21s
  before the 3 `checkSuiteGate` triangulation tests were added — see below).
- `tsc --noEmit`: clean, no errors.
- Lint: no lint tool/config present in this repo (`package.json` has no `lint` script,
  no `.eslintrc*`/`eslint.config*`/`biome.json*` found) — skipped per the task's
  "if configured" instruction.
- `fit-23-publish-workflow-guard.test.ts`: **27/27 pass** — the pre-existing 18/18 baseline
  (`REQ-PPH-*`, `REQ-BPI-03.1`) is unaffected; 6 new S-000 tests added
  (REQ-PPI-05.1/.2, REQ-PPI-02.1/.2, REQ-PPI-03.1, REQ-PPI-04.1) plus 3 more added in the
  verify-in-loop-1 fix round (`checkSuiteGate` triangulation, see below) — 18 + 6 + 3 = 27.
- `fit-46-publish-sequence-integrity.test.ts` (new): **4/4 pass** (REQ-PPI-01.1/.2,
  REQ-PPI-03.2/.3).
- `test/conformance/react-conformance.test.ts`: **4/4 pass** — 3 pre-existing +
  1 new (REQ-PPI-04.2).

### Files changed

- `.github/workflows/publish.yml` — explicit "Rebuild after version stamp" step (`bun run
  build`) between the version stamp and publish; explicit "Run test suite" step (`bun test`,
  no `continue-on-error`) strictly before publish.
- `test/fitness/fit-23-publish-workflow-guard.test.ts` — `JobDef` gained `needs`/
  `continue-on-error`; `publishRunSteps` rewritten via new `topologicalJobOrder` to read
  execution order (REQ-PPI-05, R1-13); new `checkExplicitRebuildStep` (REQ-PPI-02) and
  `checkSuiteGate` (REQ-PPI-03.1) predicates; 6 new tests.
- `test/conformance/react-conformance.test.ts` — `setDefaultTimeout(20000)` at module scope
  (REQ-PPI-04.1); 1 new red-proof test (REQ-PPI-04.2).
- `test/fitness/fit-46-publish-sequence-integrity.test.ts` (new) — REQ-PPI-01 behavioural
  proof + REQ-PPI-03.2/.3 S-000 leg, 4 tests.
- `openspec/changes/runner-tripwire-invariants/slices.md` — S-000 task checkboxes marked done.

### Commits (branch `feat/tripwire-s000`, based on `main` @ `f7428e8`)

1. `c6012ad` — `feat(publish): harden publish sequencing with explicit rebuild and suite gate`
   (publishRunSteps rewrite, publish.yml hardening, react-conformance timeout declaration —
   REQ-PPI-02, PPI-03.1, PPI-05)
2. `edd66bd` — `test(conformance): red-proof the react-conformance per-file timeout boundary`
   (REQ-PPI-04.2)
3. `3046cd9` — `test(fitness): add FIT-46, behavioural publish-sequence integrity`
   (REQ-PPI-01, REQ-PPI-03.2/.3 S-000 leg)

### Deviations / halts

One deviation, disclosed above under "Key engineering decision: fit-46's 'rebuild' step":
`regenerateManifest()` spawns with `cwd: PROJECT_ROOT` + an explicit scratch-root argument,
where `slices.md`'s Build-mechanics note literally reads `cwd: <scratchRoot>` for that leg. A
literal `cwd: <scratchRoot>` is technically infeasible for a `dist/`+`package.json`-only
scratch target (no `src/`/`node_modules` to run `tsc` against). `verify-in-loop-1.md`
(`sdd-verify --mode=in-loop`, iteration 1) independently audited this deviation against the
script source, the established `fit-42` `runGenerator` precedent, and an empirical
double-inversion of REQ-PPI-01.1/.2, and ruled it **ACCEPTABLE — faithful to REQ-PPI-01's
intent, not the R1-12 anti-pattern**. No other deviation, no table growth, no exclusion
widening, no scope beyond S-000's REQ-PPI-01..05 set. `REQ-BPI-03.1`'s existing tests in
`fit-23-*.test.ts` were left untouched — they still pass correctly, and REQ-BPI-03.1 is a
`runner-integrity-manifest`-owned REQ, out of S-000's scope.

### Verify in-loop iteration 1

`verify-in-loop-1.md` (commit `727cae7`) returned `NEEDS_FIX`: one Strict TDD triangulation
gap — `checkSuiteGate` (`test/fitness/fit-23-publish-workflow-guard.test.ts`) had 4
conditional branches (1 success + 3 distinct failure-reason returns) but only the success
path was exercised, breaking the positive+negative pairing pattern every sibling checker in
the file follows. Closed by adding 3 negative-case tests — see "Fix: checkSuiteGate
triangulation gap" below. The report also raised two non-blocking SUGGESTIONs: the
"Deviations / halts: None" vs. the disclosed `cwd` deviation inconsistency (reconciled
above) and a residual narrow-proof risk on the manifest-only rebuild shortcut (recorded
below).

### Fix: checkSuiteGate triangulation gap (verify-in-loop-1)

Added 3 negative-case tests to the existing `"FIT-23 S-000 — REQ-PPI-03.1..."` describe
block in `test/fitness/fit-23-publish-workflow-guard.test.ts`, one per untested
failure-reason branch, each red-proofed by temporarily inverting its expected `reason`
string and confirming the fixture genuinely reaches that branch (not a neighbouring one)
before restoring the correct assertion:

| Test | Fixture | Branch proven |
|---|---|---|
| "checkSuiteGate fails when no `bun test` step exists before the publish step" | publish job with only an `npm publish` step | `no full-suite (bun test) step found before the publish step` |
| "checkSuiteGate fails when the suite step runs after the publish step" | publish job with `npm publish` then `bun test` | `the suite step runs after the publish step, not before` |
| "checkSuiteGate fails when the suite step declares continue-on-error: true" | publish job with a `bun test` step carrying `continue-on-error: true`, positioned correctly before `npm publish` | `the suite step declares continue-on-error: true` |

Red evidence: with each expected `reason` string temporarily replaced by a wrong literal
(e.g. `"WRONG-no full-suite step"`), all 3 failed with `Received:` showing the correct,
DISTINCT reason string for each fixture — proving each fixture drives its own intended
branch, not a shared/vacuous one. Restored to the correct assertions, all pass.

`fit-23-publish-workflow-guard.test.ts`: **27/27 pass** (24 prior + 3 new), 44 `expect()`
calls.

### Residual note: manifest-only rebuild shortcut's narrow-proof risk

`verify-in-loop-1.md`'s Deviation audit flagged, as a SUGGESTION (not a live gap): fit-46's
"rebuild" leg regenerates the manifest directly rather than re-running `tsc`, which is sound
today because `dist/*.js` bytes never depend on the stamped version. If a future build step
ever made `dist/*.js` bytes version-coupled, this narrower proof would not catch a resulting
staleness (the manifest would regenerate from stale-but-internally-consistent bytes with no
mismatch surfacing) — a latent property of the chosen shortcut, worth a second look if that
coupling is ever introduced, not a defect today.

### Next recommended

Per `slices.md`'s Delivery mechanics: orchestrator opens the S-000 PR (house pattern); the
mechanism branch (S-001..S-005) may base off this branch immediately, without waiting for
merge.

## Slice: S-001 — Capability-Admission Property, total classification on the real closure

**Status**: substantially complete — 9 of 10 tasks done (S-001.1-.6, .8, .9, .10); S-001.7
PARTIAL, see "Deferred work" below. Covers REQ-CAP-01..06, REQ-PRM-01, REQ-CST-04.2
[MODIFIED], REQ-CST-04.3 [MODIFIED], REQ-CST-06.1 [MODIFIED, partial], REQ-DGN-01.2.

### Mechanism summary

`scripts/capability-admission.ts` (new): `enumerateCapabilitySurface` (what is present) +
`classifySurfaceNode` (what is admitted) as two independently implemented functions over
the closed 5-member `SurfaceNodeKind` union (`callee`, `value-reference`, `member-path`,
`meta-property`, `module-specifier`). Three admission legs: callee decidability
(`resolveChain` — a chain is decidable iff no `[...]` computed access appears anywhere in
it; a `this`/`super`/call-result/literal-rooted chain is a "safe terminal", admitted
unconditionally one level in), origin admission (`classifyOrigin` — local/tainted/
admitted-global/closure-import dispatch, D-3's per-position tainted rule), positional
decidability (`instanceof`/`typeof` operand exemption). `derive-runner-closure.ts`'s
`denyScan` is deleted; `classifySpecifier` gains R1-15 `builtinModules` validation and the
R1-8 directory-specifier check; `node:vm` is folded out of its own special case (B4).

### Digest-provenance reconciliation (owner-facing, not silently resolved)

`ADMITTED_GLOBALS` verified at **21** members (design.md's own probe: 22) and
`ADMITTED_MEMBER_PATHS` at **30** (design.md: 28). Traced: `git diff e6dcde2 HEAD --
src/core/context.ts src/core/wire.ts` shows exactly two JSDoc-comment-only edits (unrelated
template-placeholder-syntax doc fixes) landed on `main` between design.md's probe (HEAD
`e6dcde2`) and this branch's base — confirmed zero AST/identifier-surface change. The count
discrepancy does not come from that drift; it comes from design.md's own hand-probe being
imprecise on these two specific numbers (all other probe numbers — 423 call sites, 37
computed accesses, 6 `node:` modules with exact matching names, the 3 named D-2
reassignments — were independently re-verified and match exactly). Cross-checked the two
divergent counts against direct `rg` scans of the real closure files (no `Math`, `TypeError`,
`RangeError`, `WeakMap`, `BigInt` etc. appear in real, non-comment code for the globals
count; exactly 8 distinct `process.*` paths are referenced for the member-paths count,
matching this table's own `process.*` subset one for one). Pinned the VERIFIED counts
(21/30), not the design-recorded ones — REQ-CAP-01.1's totality property must hold against
the REAL tree, which is what the exact-membership assertions now do. **Flagged for the
owner**: reconcile design.md §1/§3's "22"/"28" prose (a documentation-drift fix, not a
re-plan) — `slices.md`'s Risks section DR-5/DR-2 ruling on widening a pinned table does not
apply here (nothing was widened; the pinned tables were built from a fresh, correct probe on
day one, not grown mid-build to make a red test pass).

### Byte-neutrality (REQ-CAP-06)

Confirmed via the B6 procedure (fresh `rm -rf dist && bun run build` → live closure walk →
regenerate → sha256 compare) at every commit of this slice:
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — byte-identical before
and after S-001's entire diff (verified via the same fresh-build procedure against the
S-000-complete HEAD before this slice's first commit, and again after the final commit).
This does NOT match design.md §8's originally-recorded `bf6c983c…a530` (HEAD `e6dcde2`) —
same root cause as the digest-provenance note above: the two JSDoc-comment-only edits move a
per-file sha256 (REQ-RME-02 hashes raw bytes, not semantics) even though they carry zero
capability-surface change, and therefore move the whole manifest's bytes. This is
`slices.md`'s Risks section case (a) — the owner re-pins the digest; S-001's own diff is
proven byte-neutral against this branch's real pre-slice state, which is the property this
gate actually protects.

### S-001.8 survival — the 8 CST-04.x-family red-proofs (B2's corrected enumeration: #10, #11, #12, #13, #14, #15, #16, #18)

All 8 pass under the new mechanism. Rule identity changed uniformly (`constraint-4-execution-primitive` → `constraint-4-inadmissible-origin`, consistent with ADR-0079's retirement of the old rule) — read as "same rule identity" in the internally-consistent sense S-001.8 asks for (a single coherent new identity per defect class), not as "the literal old string survives," which the signed design explicitly forbids (ADR-0079/design.md §4 retire that rule name outright).

| # | Test | Old count/rule | New count/rule | Note |
|---|---|---|---|---|
| #10 | "a createRequire call outside the anchored site is a Constraint-4 violation" | 2× `constraint-4-execution-primitive` | 1× `constraint-4-inadmissible-origin` | **Deliberate count change, not a regression.** The old count included denyScan's own text-match artefact: the import declaration's OWN "createRequire" binding-site token was flagged alongside the call site (denyScan's non-anchor branch never excluded declaration names). The new mechanism's E2 exclusion (design.md §1: "a binding site is not a reference") correctly excludes it — the call site alone is caught, exactly once. Same defect, same file fails, one spurious duplicate removed. |
| #11 | "the indirect-variable form is caught" | 1× execution-primitive | 1× inadmissible-origin | rename only |
| #12 | "the namespace form is caught" | 1× execution-primitive | 1× inadmissible-origin | rename only (this is where a real double-count BUG was caught and fixed mid-slice — see "Bugs found" below) |
| #13 | "a second createRequire use inside the anchored file still fails" | 1× execution-primitive | 1× inadmissible-origin | rename only |
| #14 | "an EXECUTING createRequire at the anchor is not exempt" | 1× execution-primitive | 1× inadmissible-origin | rename only |
| #15 | "an ALIASED createRequire import forfeits the exemption" | ≥2× execution-primitive | ≥2× inadmissible-origin | rename only |
| #16 | "an unaliased decoy does not buy the alias an exemption" | ≥1× execution-primitive | ≥1× inadmissible-origin | rename only |
| #18 | "the closed primitive set... is denied" (5-fixture set) | 5× execution-primitive | 5× inadmissible-origin | rename only |

Red evidence for all 8: ran unmodified against the NEW mechanism first — all 8 failed on the
old rule-name literal (7 of 8 with an otherwise-identical array; #10 additionally failed on
count). Green evidence: updated to the new rule name (and, for #10 only, the corrected
count with an inline justifying comment) — all 8 pass.

### Bugs found and fixed during this slice (each verified via a real build + real test run before/after)

1. **Relative closure-imports were denied by default.** `classifyOrigin`'s closure-import
   branch initially ran the `node:`-only `ADMITTED_NODE_SURFACES` per-name check for EVERY
   import, including relative ones — `formatLocator`/`locateFirstJsonSyntaxError` (imported
   from `./error-text.js`, a file already inside the walked closure) were flagged as
   "unadmitted origin." Fixed: a non-`node:` closure-import is unconditionally admitted (the
   imported file is already hashed and walked by this very function).
2. **A safe-terminal-rooted initializer was mistaken for undecidable, tainting its
   binding.** `taintReasonOf`'s PropertyAccessExpression handling required the chain root to
   resolve to a plain `Identifier`; `const handles = this.#handles;` roots at `this`, which
   isn't an Identifier, so the initializer was marked `undecidable-initializer` — flagging
   `handles.map(...)` downstream. Fixed: `taintReasonOf` now reuses the SAME `resolveChain`
   safe-terminal logic as callee/member-path admission.
3. **A callee chain's root identifier could be double-enumerated.** `m.createRequire(...)`
   used as a callee added the whole `m.createRequire` expression to `calleeExpressions`, but
   never marked `m` itself consumed — the general identifier pass then ALSO enumerated `m`
   as its own standalone value-reference, producing 2 violations for red-proof #12's fixture
   instead of 1. Fixed: every link of a callee's own chain (root identifier included) is now
   marked consumed at enumeration time.
4. **`enumerateCapabilitySurface` double-reported a fake `node:` specifier.** A
   node:-prefixed import naming a non-existent module (`node:nonexistent-module`) was
   flagged BOTH by `classifySpecifier`'s R1-15 `builtinModules` validation (existing walk)
   AND by capability-admission's own module-specifier classification (new walk) — same
   defect, same rule, twice. Fixed: module-specifier surface nodes are enumerated only for
   specifiers that ARE real builtins; a fake one is `classifySpecifier`'s concern alone.
5. **The independent totality counter (test-only) over-consumed argument subtrees.**
   `FIT-CAP-TOTALITY`'s independent count initially walked UP a node's full ancestor chain
   to check "is this inside a callee," which incorrectly swallowed `anchorUrl` (an argument
   to `createRequire(anchorUrl)`, itself nested inside the OUTER callee
   `createRequire(anchorUrl).resolve`) as "already counted." Fixed: the independent counter
   now tracks only the callee's own chain links, mirroring the production fix in (3) — this
   is a test-only bug, never shipped in the production classifier.

Each of the 5 was caught by running the REAL 23-file closure through the mechanism after
every change and confirming zero violations (the closure has none), not by reasoning alone.

### New scenario coverage landed this slice

`FIT-CAP-TOTALITY` (independent-count comparison across all 23 real closure files + a
mutation red-proof for the totality assertion itself), `FIT-MANIFEST-BYTE-NEUTRAL` (standing
sha check + perturbation red-proof), exact-membership pins for `SurfaceNodeKind`, E1-E4,
`DENIED_CAPABILITY_PRIMITIVES`, `ADMITTED_GLOBALS`, `ADMITTED_NODE_SURFACES`,
`ADMITTED_MEMBER_PATHS` (each with a widening/narrowing red-proof), REQ-CAP-01.7 (RCD-03.3's
day-one JSDoc fixtures, including the R1-16 `{@link X}` shape), REQ-CAP-02.1/.2
(reassignment precondition + the real closure's 3 D-2 reassignments as a sibling positive),
REQ-CAP-03.1/.2/.3 (the two confirmed live escapes + a local-function sibling positive),
REQ-CAP-04.1/.2/.3/.5/.7/.8 (node:child_process, the admitted-builtin-baseline sibling
positive, the R1-15 unrecognised-specifier red-proof, and both table-widening red-proofs),
REQ-CAP-05.1/.2/.3 (instanceof/typeof exemptions + the R1-17/SC-2 sequencing-hazard
red-proof), REQ-DGN-01.2 (directory-specifier), REQ-CST-04.3.2 (AST-vs-substring
non-vacuity), REQ-PRM-01.1/.2 (register exact-membership + the real committed
`deny-scan/`/`green/` fixture corpus with a readdir-based completeness check, replacing an
earlier in-memory simulation once the corpus existed), and S-001.10 (fit-46's publish-gate
red-proof re-run against a genuine `eval` denial via a real `deriveRunnerClosure` call, not
an arbitrary planted assertion failure).

### Deferred work (honest gaps, not silently dropped)

- **S-001.7, partial.** Every NEW message assertion this slice added is whole-verbatim
  (`toBe`, not `toContain`) by construction — no new `toContain` landed on a tripwire
  message. The 3 pre-existing S-003-tier assertions this slice's OWN rule-rename directly
  broke (`fit-42-*.negative.test.ts`'s "a direct createRequire call names Constraint 4...",
  "the indirect-variable form is named...", "the namespace form is named...") were converted
  to whole-verbatim rather than patched to a new substring. The BULK pre-existing
  `toContain` inventory design.md §6(b) counts at 47 sites (most untouched by this slice's
  own diff — they assert messages this slice did not change) remains unconverted, and the
  standing anti-`toContain` scan over the fit-42/fit-23/fit-46 family is NOT yet added.
  Recommend a dedicated follow-up pass (mechanical, low-risk, high line count) before S-003
  starts touching the same shared files, per the Build Order note that this scan should be
  live before S-003/S-004 land.
- **`mutants/` fixture directory not created.** The widening/narrowing/mutation red-proofs
  (CAP-01.2, CAP-01.6, CAP-04.5, CAP-04.8) landed as in-test simulated mutants (constructing
  a widened/narrowed `Set` inline and asserting the exact-membership check rejects it) rather
  than as committed mutant FILES under `test/fixtures/red/runner-tripwires/mutants/`. This
  satisfies each scenario's own Given/When/Then text (which describes a mutant TABLE, not a
  mutant FILE), but does not realise the ≤20-committed-mutants budget line item literally.
  Flagged for the owner: accept the simulated form, or request the file-based realisation as
  a follow-up.
- **REQ-CAP-01.3** (unclassifiable-construct for "a computed member expression on a computed
  base") has no dedicated test. The mechanism's 5-kind closed union has no slot for a
  doubly-computed access used purely as a value (never a callee) — reaching `unclassifiable`
  for that specific shape would need a 6th enumeration path the signed design's SurfaceNode
  definition does not describe. Not fabricated to avoid an honest gap; flagged for design
  clarification rather than force-fit.

### Verification run at slice close

`bun run typecheck`: clean. `bun test` (full suite): 2506 pass, 0 fail (run twice for
stability after one flaky run showed 6 unrelated failures that did not reproduce — this
suite spawns many real subprocesses/scratch dirs and has occasional resource-contention
flakes in this sandbox, distinct from anything this slice touched). Fresh-build
byte-neutrality: confirmed at slice close, matching the value recorded above.

### Commits (chronological, first pass)

1. `feat(capability-admission): replace deny-scan with default-deny admission property`
2. `test(fitness): add FIT-CAP-TOTALITY, FIT-MANIFEST-BYTE-NEUTRAL, exact-membership pins`
3. `test(fitness): add REQ-CAP-02/03/04/05, PRM-01.2, DGN-01.2, CST-04.3.2 red-proofs`
4. `test(fit-46): re-run the publish-gate proof against a real Constraint-4 fixture`
5. `test(fixtures): commit the deny-scan/green fixture corpus (S-001.6)`
6. `docs(adr): add ADR-0079/0080; test(fitness): CAP-01.6/.7 red-proofs`

## Completion pass (2026-08-04) — S-001.7 + doc-drift reconciliation + CAP-01.3 note

Closes the three items the orchestrator routed back before S-003: S-001.7 (blocking),
the doc-drift re-pin, and the REQ-CAP-01.3 clarification.

### S-001.7 — whole-verbatim conversion + standing scan, now COMPLETE

**Conversion count**: 50 pre-existing `toContain` call-sites (on a `rendered`/`stderr`/
`.reason` message receiver) across the family, consolidated into ~19 whole-verbatim `toBe`
assertions (several tests previously asserted 2-4 `toContain` fragments of ONE message; each
collapsed to one exact-string comparison, which is strictly stronger — nothing between the
asserted fragments can silently be wrong). Breakdown: 3 in
`fit-42-runner-closure-integrity.test.ts` (the version-missing stderr, the real-tree bare-
specifier stderr, the baseline-writer-failure stderr — all captured from REAL `runGenerator`/
`regen-closure-baseline.ts` runs, not hand-guessed), ~15 tests / 38 call-sites in
`fit-42-runner-closure-integrity.negative.test.ts` (synthetic-fixture `rendered` values,
captured via a throwaway probe script reproducing each test's exact fixture, then deleted),
3 in `fit-23-publish-workflow-guard.test.ts` (`.reason` fields from `checkRepoOwnerGuard`/
`checkPublishOrdering`, two of which reference the file's own `OWNER_REPO` constant via
template literal rather than a hardcoded string — matching the file's existing convention of
deriving expected values from the same source the code under test reads, never weakened to
partial matching). `fit-46-publish-sequence-integrity.test.ts` had zero pre-existing
`toContain` sites — nothing to convert there.

**No dynamic-segment exceptions needed.** Every converted message was either a fully
deterministic string (fixture content is test-authored, not runtime-random) or, for the two
fit-23 `.reason` assertions whose expected text embeds `OWNER_REPO`, resolved by referencing
the SAME constant the assertion's own file already imports — the file's own established
convention for composed/parameterised expected values (see e.g. the primitives-loop pattern
already in `fit-42-*.negative.test.ts`), not a new pattern and not a weakening.

**Remaining `toContain` sites (14, left alone, not tripwire messages)**: array-membership
checks (`paths.toContain(...)`, `.nodes.not.toContain(...)`, `targets.map(...).toContain(...)`),
raw source/manifest-content checks (`authoringError.toContain(...)`, `source.toContain(...)`,
`manifestRaw.not.toContain(...)`), and one workflow-YAML command-line content check
(`line.toContain("npm publish")`). None of these assert a rendered violation or guard-
failure message — REQ-CST-06.1 governs message assertions, not membership/content checks —
and the standing scan (below) is specifically built to leave them alone.

**Standing scan**: `FIT-42N S-001 — REQ-CST-06.1: standing scan — no toContain on a tripwire
message` (new describe block, end of `fit-42-runner-closure-integrity.negative.test.ts`).
Regex-based over each scanned file's raw source text (`expect(RECEIVER).toContain(` /
`.not.toContain(`), classifying RECEIVER as a "tripwire message" iff it matches
`\b(rendered|stderr)\b|\.reason\b|\.message\b` — the family's own established naming
convention for rendered/guard-failure text. One test per scanned file
(`test/fitness/fit-42-runner-closure-integrity.{test,negative.test}.ts`,
`fit-23-publish-workflow-guard.test.ts`, `fit-46-publish-sequence-integrity.test.ts`) — 4
tests, all currently green (zero message-receiver `toContain` remains anywhere in the
family). Plus a red-proof (`REQ-CST-06.1 [red-proof]: the scan itself catches a planted
toContain on a message receiver`) proving the scan actually fires, and a false-positive
guard (`the scan does NOT flag legitimate non-message toContain`) proving it leaves the 14
array/content checks alone. **Self-scan gotcha found and fixed**: the scan's own red-proof
and false-positive-guard tests originally spelled the literal banned syntax
(`expect(rendered).toContain(...)`) as PLAIN STRING DATA inside their own fixture arrays —
since the scan reads `fit-42-runner-closure-integrity.negative.test.ts`'s raw source text
and that file is itself in `SCANNED_FILES`, it flagged its own test data as offending code.
Fixed by building the banned token via string concatenation (`const CALL =
["toCon","tain"].join("")`) in the fixture data, and by changing the offender-report string
format to never spell `expect(` immediately followed by `.toContain(` as one literal
substring — both are test-authoring devices to avoid self-matching, not a weakening of what
the scan actually detects at runtime.

### Doc-drift reconciliation — design.md re-pinned (owner-authorized, per slices.md Risks case (a))

Added a dated reconciliation note in `design.md` §1 (right after the probe table) recording:
`ADMITTED_GLOBALS` 22→21, `ADMITTED_MEMBER_PATHS` 28→30, both re-verified and root-caused to
`git diff e6dcde2 HEAD -- src/core/context.ts src/core/wire.ts` showing exclusively
JSDoc-comment-only edits (zero AST/surface change) — probe imprecision on these two specific
numbers, not source drift (every other probe figure re-verified exact). Updated §3's Data
Model code-comment counts (`22 today` → `21 today`, `28 today` → `30 today`) and §8's
byte-neutrality gate value (`bf6c983c…a530` → `31cd5382…33fde`, with the supersession
recorded, not the old value deleted) plus the Test Derivation table's citation (§6, REQ-CAP-06
row). The re-pinned digest is the SAME value this slice's own `FIT-MANIFEST-BYTE-NEUTRAL` test
already asserts (`scripts/capability-admission.ts`'s own commit); this pass makes design.md's
prose agree with what already shipped, not the other way around. `specs/runner-integrity-
manifest/spec.md`'s matching REQ-CAP-04.4/.6 scenario text still carries the stale 22/28 —
flagged in the design.md note itself for the archive-time delta sync to correct.

### REQ-CAP-01.3 clarification — recorded in design.md, judged at verify-final

Added a dated note in `design.md` §1 (after the E1-E4 exclusion table) tracing why REQ-CAP-01.3
("a computed member expression on a computed base... renders as unclassifiable-construct")
has no dedicated test: the signed `SurfaceNodeKind` union (§3, pinned exact by REQ-CAP-01.4)
has no slot for a bare computed-access node in VALUE position (never a callee) — `member-path`
is explicitly non-computed by its own definition, `value-reference` requires a plain
`Identifier`, and the other three kinds don't apply. The CALLEE-position variant of this shape
(`a[b][c]()`) IS caught, but under REQ-CAP-03 (`constraint-4-undecidable-callee`), which is a
different, already red-proven scenario (M2.1) — not REQ-CAP-01.3's own text, which is scoped
to a construct no OTHER leg resolves. **Disposition given, not decided unilaterally**: NOT
vacuously covered by totality (nothing is ever enumerated for this shape, so there is no
present-but-unclassified case for `FIT-CAP-TOTALITY` to catch) — the scenario is
unimplementable AS WRITTEN under the union this same design signed off on. Two ways to close
it are named (a 6th `SurfaceNodeKind`, needing its own REQ-CAP-01.4 unfreeze; or retiring the
scenario since D-1's own value-position-is-safe argument already covers the shape) — left for
`sdd-verify --mode=final` to judge, not resolved silently here.

### Gate re-confirmation at completion-pass close

`bun run typecheck`: clean. Fresh `rm -rf dist && bun run build`:
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` (matches the re-pinned
digest exactly). `bun test` (full suite): **2512 pass, 0 fail**, run twice for stability
(the S-000-era note about occasional subprocess-contention flakiness in this sandbox still
applies generically to the suite; both completion-pass runs were clean). Net new tests this
pass: +6 (the standing-scan describe block: 4 per-file scans + 1 red-proof + 1
false-positive-guard).

### Commits (chronological, completion pass)

7. `test(fitness): convert fit-42/fit-23 toContain message assertions to whole-verbatim`
8. `test(fitness): add the standing scan forbidding toContain on tripwire messages`
9. `docs(design): re-pin admitted-table counts and byte digest; add CAP-01.3 note`
10. `docs(sdd): mark S-001.7 complete, record the completion pass`

### Next recommended (superseded by the S-003 section below — S-001 passed verify in-loop)

S-003 (`FIT-PATH-SPELLING-INVARIANCE`, `scripts/bundler-disjointness.ts`) per the Build Order
— S-001 is now fully complete (10/10 tasks) and the standing anti-`toContain` scan is live on
the shared `fit-42-*` files before S-003/S-004 touch them, as the Build Order requires.

## Slice: S-003 — Resolution-Based Path Verdicts, bundler disjointness by resolved path

**Status**: complete, 5/5 tasks. Covers REQ-PTH-01 (all 7 scenarios: .1-.5 red-proof, .6
sibling positive, .7 red-proof). Lands on top of S-001's shape per the Build Order (batch 2,
order 2b) — the standing anti-`toContain` scan (S-001.7) was already live on
`fit-42-runner-closure-integrity.{test,negative.test}.ts` before this slice touched them;
every new assertion below is whole-verbatim/structured-`toEqual` by construction, confirmed
by re-running the scan (still 6/6 green, no new offenders).

### Mechanism summary

`scripts/bundler-disjointness.ts` (new): resolution-based disjointness, replacing
`normaliseForComparison`'s string manipulation. Both the candidate bundler target and each
closure path are resolved via `node:path`'s `posix.resolve` against a FIXED virtual anchor
(`"/"`) — pure path algebra, no real filesystem access, anchor-invariant since both sides
resolve against the same anchor. `--outdir` collides by directory-prefix containment;
`-o`/`--outfile` collide by exact-path equality only. The flag/path grammar is a token-level
classifier (`classifyToken`) trying every candidate reading of an ambiguous token: `--outdir`/
`--outfile` with `=` or space separation, `-o` with space separation OR (new) zero-separator
concatenation (`-oVALUE`) — the shape that let `-o` targets past the retired regex entirely.
A recognised flag whose value contains `$` (shell-variable/undecidable), or an output-flag-
shaped token (`-o`/`--out`-prefixed) that names no recognised spelling, is reported via the
new `findUnclassifiableBundlerConstructs` — never silently treated as an ordinary string
target, never silently ignored.

`test/support/closure-integrity-checks.ts` re-exports from `scripts/bundler-disjointness.ts`
(ADR-0081: placement, not timing — Constraint 1 still ships as a structural CI check,
`fit-42`, never a loader-observed build tripwire; ADR-0075 untouched). `findBundlerTargets`/
`findDisjointnessViolations`'s external signatures and return shapes are UNCHANGED from the
retired implementation — every one of the 6 pre-existing tests exercising them
(`REQ-BDI-01.1`'s extraction + 5 disjointness scenarios) passes unmodified against the new
resolution-based internals, confirming the relocation preserved every already-correct verdict
while additionally closing the 5 escapes.

### Per-scenario red → green evidence

| REQ-ID | Scenario | Fixture | Red evidence (genuineness) | Green evidence |
|---|---|---|---|---|
| PTH-01.1 [red-proof] | `--outdir .//dist/transport` still collides | `bundler-scripts/double-slash-dot.json` | Reproduced the RETIRED `normaliseForComparison`+`oldCollides` logic in a throwaway probe (deleted after use): for target `".//dist/transport"`, `oldCollides("--outdir", target, "dist/transport/runner.js")` → **false** — the retired mechanism's leading-`./`-strip does not touch a DOUBLE slash, so it never normalises this to the same string as a clean `dist/transport` target. Confirmed genuinely escaping. | `findDisjointnessViolations` reports exactly one violation, `colliding: "dist/transport/runner.js"` |
| PTH-01.2 [red-proof] | `--outdir .` targets the total root | `bundler-scripts/total-root.json` | Same probe: `oldCollides("--outdir", ".", closurePath)` → **false** for both closure paths — the retired mechanism's length-1 trailing-slash-strip guard (`normalised.length > 1 &&...`) skips normalising `"."` itself, so it never resolves to the shared root prefix every closure path shares. | Resolves to `posix.resolve("/", ".")` = `"/"`; every closure path starts with `"/"` → 2 violations, one per closure path (both reported) |
| PTH-01.3 [red-proof] | `-odist/transport/runner.js`, concatenated short form | `bundler-scripts/concatenated-short-form.json` | Ran the RETIRED extraction regex (`/(?:^|\s)(--outfile\|--outdir\|-o)[=\s]+(\S+)/g`, which requires a separator) against the fixture command directly: **0 targets extracted** — the flag was never even parsed, let alone compared. | New `classifyToken`'s `token.startsWith("-o") && token.length > 2` branch extracts `flag: "-o", target: "dist/transport/runner.js"`; `findDisjointnessViolations` reports the exact-match collision |
| PTH-01.4 [red-proof] | `--outdir ../dist/transport`, relative-parent escape | `bundler-scripts/relative-parent.json` | Same probe: `oldCollides("--outdir", "../dist/transport", "dist/transport/runner.js")` → **false** — the retired mechanism never resolves `..` at all, so the literal string `"../dist/transport"` shares no prefix with `"dist/transport/runner.js"`. | `posix.resolve("/", "../dist/transport")` collapses the parent traversal (clamped at the virtual root) to `"/dist/transport"`, identical to a clean target — collision correctly reported |
| PTH-01.5 [red-proof] | `--outdir=$VAR`, undecidable at build time | `bundler-scripts/undecidable-var.json` | The retired mechanism had no "unclassifiable" concept at all — the old regex would have extracted `target: "$VAR"` and silently compared it as an ordinary (always-non-colliding) string, never surfacing the undecidability. Confirmed via the same probe. | `findBundlerTargets` returns `[]` (never silently treated as a target); `findUnclassifiableBundlerConstructs` returns `[{script: "leak", token: "--outdir=$VAR"}]` |
| PTH-01.6 | Real `package.json#scripts` + real closure — non-vacuity sibling | Real tree (`fit-42-runner-closure-integrity.test.ts`) | n/a (positive path) — pre-existing `REQ-BDI-01.1` test already covered this fixture; re-labelled `REQ-BDI-01.1 / REQ-PTH-01.6` and extended with an explicit `findUnclassifiableBundlerConstructs(scripts)` → `[]` assertion | Passes unmodified against the new mechanism; `dist/bin/pbuilder-codegen.js` still correctly judged outside the closure |
| PTH-01.7 [red-proof] | `--out-dir ./dist/transport`, unrecognised output-flag-shaped token | `bundler-scripts/unrecognized-flag-shape.json` | No retired-mechanism equivalent exists (the concept is new). Genuineness argument instead: `findBundlerTargets` returns `[]` (never silently misread as `--outdir`), a companion test proves an ordinary non-output flag (`--minify`) is correctly left OUT of `findUnclassifiableBundlerConstructs` — proving the classifier discriminates shape, not merely flags every unrecognised token | `findUnclassifiableBundlerConstructs` returns `[{script: "leak", token: "--out-dir"}]` |
| PTH-01 (FIT-PATH-SPELLING-INVARIANCE) | Cross-product enumerator agrees with an independent ground-truth oracle | Generated: 3 flags × 9 path spellings × 2 closure paths | Own-mutation red-proof: temporarily replaced `resolveAgainstAnchor`'s body with an identity function (`return path;`, bypassing `posix.resolve` entirely) — the fitness function immediately reported **8 concrete disagreements** naming the exact flag/target/closurePath triples where production and the independent `posix.relative`-based oracle diverged. Confirmed non-vacuous, then reverted (verified byte-identical to the pre-mutation file). | All 54 generated combinations agree; a companion test proves the oracle itself is discriminating (a non-colliding pair is correctly judged `false`, not vacuously `true`) |

### Fixture corpus (S-003.4)

`test/fixtures/red/runner-tripwires/bundler-scripts/` — 6 red fixtures (5 original + 1 for
the PTH-01.7 iteration-1 amendment, which landed after S-003.4's task text was originally
written — same pattern as S-001's own amendment-coverage additions) + 1 green sibling
(`green-outside-closure.json`), each a committed `{scriptName: command}` JSON file.
Readdir-enumerated completeness check asserts the on-disk set matches the declared 7-file
class-ID list in both directions. `mutants/`-style budget line item not separately realised
here either (same disposition as S-001.6's own note: the widening/mutation red-proof above
used an in-code mutation, not a committed mutant file).

### Byte-neutrality (REQ-CAP-06, carried forward)

`scripts/bundler-disjointness.ts` and its test-file consumers touch no `src/**` file.
Confirmed via the B6 procedure (fresh `rm -rf dist && bun run build`) at slice close:
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — unchanged from S-001's
close, exactly as expected for a slice with zero `src/` diff.

### Gate re-confirmation at slice close

`bun run typecheck`: clean. Fresh-build byte-neutrality: confirmed above. `bun test` (full
suite): **2523 pass, 0 fail**, run twice for stability. Net new tests this slice: +11
(5 escaping-spelling red-proofs, 1 unrecognised-flag-shape red-proof + 1 scope-limit sibling,
1 corpus-completeness check, 1 PTH-01.6 non-vacuity assertion folded into the existing
`REQ-BDI-01.1` test, 2 `FIT-PATH-SPELLING-INVARIANCE` tests). `fit-42-*` combined:
188 → 199 tests.

### Commits (chronological, S-003)

11. `feat(bundler-disjointness): resolution-based verdicts replace string normalisation`
12. `test(fitness): add REQ-PTH-01 red-proofs and the bundler-scripts fixture corpus`
13. `test(fitness): add FIT-PATH-SPELLING-INVARIANCE fitness function`
14. `docs(sdd): mark S-003 complete, record the S-003 apply-progress section`

### Next recommended

S-004 (`FIT-FAILCLOSED-BICONDITIONAL`, `generate-runner-manifest.ts`'s single fail-closed
boundary + the DGN-01.3/.4 rule-identity totality check) per the Build Order — S-003 is
complete and lands its own diff on top of S-001's shape in the shared `fit-42-*.test.ts`
file, as batch 2's sequential ordering (2a→2b→2c) requires.
