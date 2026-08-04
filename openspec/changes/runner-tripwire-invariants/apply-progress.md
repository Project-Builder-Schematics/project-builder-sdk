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

### Next recommended (superseded by the S-004 section below — S-003 passed verify in-loop)

S-004 (`FIT-FAILCLOSED-BICONDITIONAL`, `generate-runner-manifest.ts`'s single fail-closed
boundary + the DGN-01.3/.4 rule-identity totality check) per the Build Order — S-003 is
complete and lands its own diff on top of S-001's shape in the shared `fit-42-*.test.ts`
file, as batch 2's sequential ordering (2a→2b→2c) requires.

## Slice: S-004 — Fail-Closed Generation & Diagnostic/Locale Honesty

**Status**: complete, 8/8 tasks. Covers REQ-FCG-01 (all 5 scenarios), REQ-DGN-01 (.1, .3, .4),
REQ-RMD-05.1 [MODIFIED], REQ-RMD-01.2 [MODIFIED]. Lands last within batch 2 (order 2c) — the
standing anti-`toContain` scan and S-001/S-003's fixture corpora were already live before
this slice's first commit; every new assertion below is whole-verbatim/structured-`toEqual`
by construction, confirmed by re-running the scan (still green throughout).

### Mechanism summary

`scripts/generate-runner-manifest.ts` rewritten around ONE fail-closed boundary: the entire
generation flow now runs inside a `generate()` function whose every throw — a deliberately-
tagged `GenerationFailure`, an uncaught `JSON.parse` error on malformed `package.json`, or any
unanticipated exception — propagates to a single outer `catch` that unconditionally removes
both the final manifest path and a new `.tmp` write-path before exiting non-zero. This closes
a REAL, confirmed bug (R2-4): the old code's cleanup was only reachable from explicitly
enumerated call sites, so an uncaught `JSON.parse` throw on malformed `package.json` left a
pre-existing stale manifest behind, plausible-looking, never proven false. The manifest write
is now write-temp-then-rename (`writeFileSync` to `<path>.tmp`, then an atomic `renameSync`) —
the real path is never observed partially written. A `package.json#version` failure now
reports its own `manifest-version-invalid` `ViolationRule` (REQ-DGN-01.1) instead of the
previous, false `unreadable-file` — the file WAS read; its content is structurally invalid.
`VIOLATION_RULES` grows to 12 members.

`REQ-RMD-05.1`'s username-path-segment check is extracted from an inline positive-file
assertion into a reusable `findUsernamePathSegmentViolations`, giving it a negative-file
red-proof for the first time. `REQ-RMD-01.2`'s retired `LC_ALL` child-process comparison
(explicitly named as satisfied-in-intent-only in the signed spec — Bun's default collator
resolves `en-US` regardless of locale env, so it could never fail its own mutation) is
replaced with a structural source scan (`findLocaleSensitiveApiUsage`) over the generator's
REAL transitive closure, discovered via `readSpecifiers`' own relative-import following
rather than a hand-maintained file list.

### Per-scenario red → green evidence

| REQ-ID | Scenario | Red evidence (genuineness) | Green evidence |
|---|---|---|---|
| FCG-01.1 [red-proof] | Malformed `package.json` fails closed, removing a pre-existing manifest — R2-4 | Temporarily restored the pre-S-004 `generate-runner-manifest.ts` (from git history) and re-ran this exact test: **the stale pre-seeded manifest survived** (`existsSync` → `true` where the fix asserts `false`) — confirming R2-4 was a real, live bug, not a strawman | Fixed generator: `existsSync(manifestPathIn(root))` → `false`, `result.status !== 0` |
| FCG-01.2 [red-proof] | Mid-derivation unreadable closure file leaves no manifest, atomically — R1-6 | This path was ALREADY correctly handled by `deriveRunnerClosure`'s own internal catch pre-S-004 (not a new fix); the NEW evidence this slice adds is the write-temp-then-rename atomicity guarantee, checked directly (`<manifest>.tmp` also does not survive) | Fails closed; both the final path and the temp path are absent |
| FCG-01.3 [red-proof] | An unrouted throw still fails closed — R1-5 | Fixture: `package.json` set to the JSON value `null` — valid JSON (distinct from FCG-01.1's malformed-JSON fault; `JSON.parse` does not throw), but `.version` access on `null` throws `TypeError`, never explicitly named by any check. Same before/after comparison as FCG-01.1: the pre-S-004 generator left the pre-seeded manifest behind; the fix removes it | Fails closed; stderr's deterministic prefix confirms the unrouted-error branch fired |
| FCG-01.4 [red-proof] | Fail-closed biconditional over ≥3 fault kinds, pre-seeded root, each asserted independently | Same 3 fixtures run in a loop against fresh pre-seeded copies, each assertion carrying its own descriptive failure message naming which fixture/kind failed if any did | All 3 independently confirmed: exit≠0, no manifest, in every case |
| FCG-01.5 | Success yields a manifest — the biconditional's other direction | n/a (positive path) | `preSeededRoot()`'s own seeding step is exactly this scenario — manifest exists after a clean run |
| DGN-01.1 [red-proof] | Version-validation failure gets its own rule — R2-3 | Pre-existing `REQ-RME-07.1` stderr test failed immediately after the rewrite landed (rule name changed, exactly as intended) — updated the whole-verbatim expectation to the new `manifest-version-invalid` rendering | Passes with the corrected rule name and rendered body |
| RMD-05.1.1 | `runner.js` is not a false positive | n/a (positive path); pre-existing inline check extracted to a named function | `findUsernamePathSegmentViolations(["dist/bin/pbuilder-runner.js"], "runner")` → `[]` |
| RMD-05.1.2 [red-proof] | A genuine `dist/runner/notes.js` segment is caught | New test against the extracted function, using the exact mutant path REQ-RMD-05.1.2 names | `findUsernamePathSegmentViolations([...], "runner")` → `["dist/runner/notes.js"]` |
| RMD-01.2.1 | No locale-sensitive API in the generator + transitive helpers | Non-vacuity: asserted the transitive walk reaches exactly the 3 real files (`generate-runner-manifest.ts`, `derive-runner-closure.ts`, `capability-admission.ts`) before asserting zero findings — proving the scan isn't vacuously scanning nothing | `findLocaleSensitiveApiUsage(files)` → `[]` over the real transitive closure |
| RMD-01.2.2 [red-proof] ×2 | A planted `.localeCompare()` / `Intl.Collator`/`toLocale{Upper,Lower}Case` call is caught | Planted each of the four named API spellings in synthetic source text | Each finding correctly named with file/line/api |
| DGN-01.3 | Rule-identity totality over the fixture corpus | Standing check run against the real `deny-scan/` corpus (10 fixtures) + `fail-closed/`'s one violation-producing fault, via the REAL mechanism (not simulated) | Zero mismatches — every fixture's produced rule matches its declared rule |
| DGN-01.4 [red-proof] ×2 | Rule-swap / misattribution mutant is caught | **Genuine defect found and fixed while building this check** — see below | Both mutation shapes (swap, single misattribution) correctly named after the fix |

### Bug found and fixed while building DGN-01.3/.4 (verified, not assumed)

The first implementation of `ruleIdentityTotalityMismatches` compared only the AGGREGATE
rule-VALUE multiset (`declared.map(rule).sort()` vs `produced.map(rule).sort()`), discarding
fixture identity — matching a literal reading of "exact multiset equality." Running the
DGN-01.4(a) red-proof (a `RULE_BODIES`-renderer-swap shape: fixture A's and B's produced
rules swapped with each other) against this version returned **zero mismatches** — a swap
between two fixtures leaves each rule's aggregate COUNT unchanged, so a bare-value multiset
comparison cannot see it at all. This is exactly the failure mode the requirement's own
acceptance criterion ("naming the mismatched fixture and the declared-vs-produced pair") is
designed to catch, so a check that provably cannot catch it does not satisfy the requirement,
regardless of how literally it matches the word "multiset." Fixed by comparing `{fixture,
rule}` PAIRS exhaustively over the whole corpus (never a per-fixture SAMPLE, which is the
reading of "never a per-fixture spot check" that remains consistent with DGN-01.4(a)'s own
acceptance bar) — re-ran both red-proofs after the fix and confirmed both now correctly name
the mismatched fixture(s).

### Fixture corpus (S-004.4)

`test/fixtures/red/runner-tripwires/fail-closed/` — 3 committed fault-injection descriptors
(JSON recipes: `packageJsonContent` override or `chmodClosureFile` name), readdir-enumerated,
reused by both the individual FCG-01.1-.3 red-proofs and the FCG-01.4 biconditional loop.

### Scope note: DGN-01.3/.4 excludes `bundler-scripts/`

`bundler-scripts/`'s violations (`DisjointnessViolation`, `UnclassifiableBundlerConstruct`)
are a structurally separate type from `Violation`/`ViolationRule` — Constraint 1 is a
CI-only structural check (ADR-0081) that never runs inside `generate-runner-manifest.ts`'s
own violation system, so it never carries a `ViolationRule` to begin with. Excluded from the
rule-identity totality corpus by construction, not by oversight — documented inline in the
test file.

### Deleted, not silently: the retired `LC_ALL` test

`test/fitness/fit-42-runner-closure-integrity.test.ts`'s old "runs under `LC_ALL=C` and
`LC_ALL=tr_TR.UTF-8`" test is DELETED, not merely deprecated — its own comment already
admitted it "could never fail its own mutation" (the exact retirement rationale the signed
spec states verbatim, ruling 7). Keeping a test that even its own author's comment concedes
is vacuous would be theatre; the replacement (`RMD-01.2.1`/`.2`) is a structural scan that
demonstrably CAN fail, verified above.

### Byte-neutrality (REQ-CAP-06, carried forward)

`scripts/generate-runner-manifest.ts` is a build-tooling file, not `src/**` — the change is
in-scope for this slice per REQ-FCG-01/DGN-01.1 and does not touch anything the manifest
hashes. Confirmed via the B6 procedure (fresh `rm -rf dist && bun run build`) at slice close:
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — unchanged from S-001/
S-003's close.

### Gate re-confirmation at slice close

`bun run typecheck`: clean. Fresh-build byte-neutrality: confirmed above. `bun test` (full
suite): **2536 pass, 0 fail**, run twice for stability. Net new tests this slice: +33 relative
to S-003's close (`fit-42-*` combined: 199 → 212 includes S-003's own net; full delta from
this slice's start: FCG-01 family ×9, RMD-05.1 ×2, RMD-01.2 ×3 (net, one old test deleted),
DGN-01.3/.4 ×4, plus the DGN-01.1 rule-name update to an existing test).

### Commits (chronological, S-004)

15. `feat(generate-runner-manifest): single fail-closed boundary, write-temp-then-rename`
16. `test(fitness): RMD-05.1 path-segment scan extraction + RMD-01.2 structural locale scan`
17. `test(fitness): add FIT-FAILCLOSED-BICONDITIONAL and the fail-closed/ fixture corpus`
18. `test(fitness): add the DGN-01.3/.4 standing rule-identity totality check`
19. `docs(sdd): mark S-004 complete, record the S-004 apply-progress section`

### S-004 verify-in-loop-5 carryover (non-blocking WARNING, folded in before S-002)

verify-in-loop-5 (PASS, one non-blocking WARNING): the FCG-01.3 red-proof's unrouted-error
stderr assertion pinned only the deterministic PREFIX (`startsWith`) around the inherently
non-deterministic `error.stack` fragment; a deterministic SUFFIX (`"\n\nNo manifest was
written; dist/runner-manifest.json does not exist.\n"`) was also assertable and had been left
unpinned. Cheap to fold in immediately: added the matching `endsWith` check alongside the
existing `startsWith` one. Commit `44c537f`.

### Next recommended (superseded by the S-002 section below)

Batch 2 (S-001→S-003→S-004) is now complete. Per the Build Order, S-002 (`REQ-XPO-01`,
requires S-001's origin admission + register) is next — batch 3, the only remaining
mechanism slice besides S-005 (docs, last per SC-4).

## Slice: S-002 — Exemption Proof Obligation (createRequire anchor)

**Status**: complete, 6/7 tasks (S-002.3 deliberately deferred to archive time — see below).
Covers REQ-XPO-01 (.1 through .5). Lands last within the mechanism batches, requiring S-001's
`closure-import` origin leg and the capability-admission register. The standing anti-
`toContain` scan and all prior fixture corpora were already live; every new assertion in this
slice is whole-verbatim/structured-`toEqual`/exact-equality by construction (re-run of the
6-test standing scan, still green throughout).

### Mechanism summary

REQ-XPO-01 formalises "a proof ON THE FILE, forfeit on any other arrangement" — S-001 had
ported only the minimal happy-path (single unaliased `createRequire` binding at the anchor,
resolve-only use exempt). This slice closes the three arrangements S-001 left open, each a
REAL, verified gap rather than a documentation-only addition:

1. **Aliasing must forfeit the exemption entirely (XPO-01.3)** — S-001's `buildFileContext`
   granted the exemption keyed on whatever LOCAL name the single `createRequire` binding used,
   aliased or not, so a resolve-only-SHAPED use through an alias was silently admitted exactly
   like the canonical name — contradicting this slice's own acceptance criterion. Fixed by
   granting `exemption` only when the named-import form's local binding name is the literal
   `createRequire`; an aliased name gets no `ExemptionProof` at all, so every use of it —
   resolve-shaped or not — falls through to ordinary origin classification, which denies
   `createRequire` unconditionally off `node:module` (its admitted-name set there is empty by
   design). The namespace form has no canonical name to alias against and is unaffected.
2. **Re-export laundering must not bypass the register (XPO-01.4/M1.12)** — `classifyOrigin`'s
   closure-import branch admitted ANY non-`node:` relative specifier unconditionally (S-001's
   own "closure-imports are inherently admitted" shortcut). `export { createRequire } from
   "node:module"` re-exported through an intermediate closure file, then imported by a second
   file and called, bypassed the entire register: the second file's origin was a RELATIVE
   specifier, never itself `node:`-prefixed, so it was admitted before the register ever saw
   `createRequire`. Fixed by denying a closure-import whose `importedName` is itself a
   `DENIED_CAPABILITY_PRIMITIVES` member, regardless of the specifier's own `node:`-ness — the
   exemption is a proof on the ANCHOR FILE specifically, never a predicate that follows a name
   through however many re-exports launder it.
3. **Anchor drift must be independently checked (XPO-01.5/M1.13)** — `isAnchorFile` can only
   ever be `true` for a node the real walk actually reached, so an exemption whose anchor has
   silently dropped OUT of the closure (e.g. a future refactor removing the import edge that
   reaches it) can never be caught from WITHIN a single real walk — nothing would verify the
   exemption's own precondition. Added `findAnchorDriftViolations` (new export,
   `derive-runner-closure.ts`) as an independent, POST-WALK-only check, wired ONLY into
   `generate-runner-manifest.ts`'s real `generate()` — never into `deriveRunnerClosure` itself,
   which every synthetic fixture in both fit-42 test files calls with an unrelated entry file
   and would otherwise spuriously fail this check on every single one of them.

### Per-scenario red → green evidence

| REQ-ID | Scenario | Red evidence (genuineness) | Green evidence |
|---|---|---|---|
| XPO-01.1 | Named-import anchor, resolve-only, exempt | n/a (positive path; S-001's existing mechanism, explicit REQ-XPO-01.1 citation added) | `classifiedAs(root, anchor)` → `[]` |
| XPO-01.2 | Namespace-form anchor, resolve-only, now green — closes R2-5 | n/a (positive path; S-001's existing `isResolveOnlyUse` namespace branch + `createRequireBindingsIn`'s namespace collection, explicit REQ-XPO-01.2 citation added). Landed in the same commit as red-proof #12 (`"REQ-CST-04.4: the namespace form is caught"`, untouched, at its original location) staying green — the DR-6 hazard this slice's own S-002.4 task names | `classifiedAs(root, anchor)` → `[]`; #12 unchanged, still denies the non-anchor namespace-call shape |
| XPO-01.3 [red-proof] | An aliased `createRequire` binding forfeits the exemption entirely — both a resolve-shaped and an execute-shaped use through the alias are denied | Ran red against S-001's code: 1 violation (only the execute-shaped use), not the expected 2 — the resolve-shaped use through the alias was silently admitted, confirming the gap named above | Fixed `buildFileContext`: exactly 2 violations, both `constraint-4-inadmissible-origin` |
| XPO-01.4 [red-proof] | A `createRequire` re-exported through a closure file, then imported and called by a second file, is still denied (M1.12) | `git stash`-restored the pre-fix `capability-admission.ts` and re-ran this exact test: **0 violations where 1 was expected** — proving the laundering hole was real, not a strawman; restored the fix, re-ran, green | Fixed `classifyOrigin`: `[{ rule: "constraint-4-inadmissible-origin", file: "entry.js" }]` |
| XPO-01.4 (sibling) | The re-exporting file itself, with an unused import binding, reports zero violations | n/a (sibling positive — a bare unused import is a value-reference, never a callee, D-1/D-3) | `classifiedAs(root)` → `[]` |
| XPO-01.5 [red-proof] | A derived closure omitting the anchor file is flagged by name | New function (`findAnchorDriftViolations`) tested directly against a constructed node list; there is no "before" state to compare against since the function is new this slice | `findAnchorDriftViolations(nodesWithoutAnchor, anchor)` → one violation naming the anchor path |
| XPO-01.5 (sibling) | A derived closure that DOES include the anchor reports zero drift | n/a (sibling positive) | `findAnchorDriftViolations(nodesWithAnchor, anchor)` → `[]` |
| XPO-01.5 (non-vacuity) | The REAL runner closure includes the anchor file — the check has something genuine to verify, not just synthetic fixtures | Fresh `rm -rf dist && bun run build` after wiring `findAnchorDriftViolations` into `generate()`: build succeeded, proving the real anchor file is genuinely a member of the real derived closure | `deriveRunnerClosure`'s real-build nodes `toContain` the anchor; `findAnchorDriftViolations` on them → `[]` |

### S-002.5: threshold-to-exact tightening

Two pre-existing `toBeGreaterThanOrEqual` assertions (the S-001 aliasing/decoy forfeiture
red-proofs, `"an ALIASED createRequire import... forfeits the exemption entirely"` and
`"an unaliased decoy alongside an aliased import does not buy the alias an exemption"`) were
threshold assertions on a fully deterministic count — tightened to `.toBe(2)` and `.toBe(1)`
respectively, matching design.md's own exact-counts-never-thresholds rule (line 376).

### S-002.6: behavioural-survival of the remaining 10 S-000-tier red-proofs

Per the 2026-07-29 plan-verify final batch amendment's corrected count (7 specifier-
classification-block items, untouched since S-000, + 3 deny-scan-remainder items — `REQ-CST-
03.1`/`.2`, `REQ-CST-06.1` — not already claimed by S-001.8): all 10 verified still passing,
unmodified, as part of the full 220-test fit-42 combined run at this slice's close. None of
S-001/S-003/S-004/S-002's code changes touch the specifier-classification leg these red-proofs
exercise.

### S-002.3: anchor-site code comment — deferred to archive time, not skipped

The task text ("an explicit code comment at the anchor site cross-referencing REQ-CST-04.4 and
REQ-XPO-01.2") implies editing `src/transport/single-instance-probe.ts`. Verified via
`tsconfig.build.json`/`tsconfig.json`: neither sets `removeComments` (TypeScript's own default
is `false`, comments preserved in emit) — so any such edit changes
`dist/transport/single-instance-probe.js`'s bytes, breaking this slice's own non-negotiable
REQ-CAP-06 byte-neutrality gate. `design.md` line 427 independently and explicitly classifies
this exact item as an "archive-time obligation, not a design blocker" (grouped alongside two
other archive-deferred items: a tech-writer pass on REQ-CST-04.1's rationale and REQ-CAP-02.2's
scenario title). Deferring here matches the design's own authoritative classification rather
than silently skipping the task or breaking byte-neutrality to force it in. No code or test
work is outstanding from this deferral.

### Byte-neutrality (REQ-CAP-06, carried forward)

`scripts/capability-admission.ts` and `scripts/derive-runner-closure.ts` are build-tooling
files, not `src/**` — in-scope per REQ-XPO-01 and untouched by the manifest's own hashed
contents. Confirmed via the established procedure (fresh `rm -rf dist && bun run build`) at
slice close: `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — unchanged
from S-001/S-003/S-004's close. The build succeeding is itself evidence for XPO-01.5's
non-vacuity claim (above): the real anchor file survived `findAnchorDriftViolations`'s new
check without the build needing to fail.

### Gate re-confirmation at slice close

`bun run typecheck`: clean. Fresh-build byte-neutrality: confirmed above. Standing anti-
`toContain` scan: 6/6 pass. `bun test` (full suite): **2545 pass, 0 fail**, run twice for
stability. `fit-42-*` combined: 212 (S-004 close) → 220 at this slice's close (net +8: XPO-01.1,
.2, .3, .4×2, .5×3).

### Commits (chronological, S-002)

20. `test(fitness): strengthen the unrouted-error stderr assertion with a suffix pin` (S-004
    verify-in-loop-5 carryover, `44c537f`, folded in before S-002 proper)
21. `fix(capability-admission): close two REQ-XPO-01 exemption gaps` (aliasing forfeiture
    XPO-01.3 + re-export laundering XPO-01.4)
22. `feat(derive-runner-closure): add findAnchorDriftViolations for anchor-drift detection`
    (XPO-01.5, wired into the real build)
23. `test(fitness): add the REQ-XPO-01 exemption-proof-obligation scenarios` (XPO-01.1-.5
    coverage + the S-002.5 exact-equality tightening)
24. `docs(sdd): mark S-002 complete, record the S-002 apply-progress section`

### Next recommended (superseded by the S-005 section below)

Batch 3 (S-002) is now complete. Per the Build Order, S-005 (docs, SC-4) is the only remaining
slice.

## Slice: S-005 — Documentation Counts Derived From Live Derivation

**Status**: complete, 3/3 tasks. Covers REQ-DLV-01 (.1, .2 [red-proof]) plus the non-REQ-tied
S-005.3 doc-fidelity task. Last slice per the Build Order (SC-4: docs land after every
enforcement slice). `test/docs/runner-integrity-docs.test.ts` is a pre-existing permanent
fixture belonging to an already-archived change (`archive/2026-07-25-runner-integrity-manifest`,
REQ-IID-01..08 + REQ-BDI-01.2) — this slice EXTENDS it with a new REQ-DLV-01 describe block and
does not touch any of its 23 pre-existing tests, all of which re-ran green throughout.

### Mechanism summary

R1-11's defect: `docs/runner-integrity-invariants.md` states the manifest's closure/file counts
(23 closure files, 24 total manifest entries including `package.json`) as PROSE, and nothing in
the test suite bound those numbers to the real, live closure size — a doc that drifted (e.g. the
closure growing to 24 files) would go stale silently, with every pre-existing frozen-string test
still passing (they check that specific WORDS exist verbatim, never that the embedded NUMBER is
still correct).

Added `findStaleCountClaims(markdown, closureFileCount)` to the doc test: a set of frozen PROSE
templates (mirroring this file's own established frozen-string convention, e.g. `SCOPE_PULL_QUOTE`)
with the NUMBER supplied by `deriveRunnerClosure`'s live `nodes.length` at test-run time, never as
a literal in the test. Two independent families — TOTAL_ENTRY_CLAIMS (closureFileCount + 1) and
CLOSURE_FILE_CLAIMS (closureFileCount) — cover every count-bearing sentence in the doc (7 template
renders total). A mismatch reports the claim's label and the live value it should have matched,
per REQ-DLV-01.2's own acceptance wording ("naming the mismatched count and the live value").

S-005.3 separately fixes a real fidelity gap in Constraint 4's own prose (not a count, but an
enumeration promise): the old text ("The same scan covers `eval`, `new Function`, `node:vm`,
`Bun.plugin` and `process.binding`") named only 5 of the register's 11 actual members and used
deny-scan-list framing ("the same scan covers") left over from before S-001 replaced `denyScan`
with capability admission. Replaced with a default-DENY capability-admission framing naming the
full, current 11-member register and the S-002 exemption-forfeiture rules (aliasing, re-export
laundering, anchor drift) — the doc's enforcement promise now matches what `capability-admission.ts`
actually enforces, exactly.

### Per-scenario red → green evidence

| REQ-ID | Scenario | Red evidence (genuineness) | Green evidence |
|---|---|---|---|
| DLV-01.1 (non-vacuity) | The live derivation yields a non-zero closure file count | n/a (precondition guard — the checks below are meaningless against a zero-sized closure) | `closureFileCount` (23) `> 0` |
| DLV-01.1 | Every count claim in the doc matches the live derivation | n/a (positive path) | `findStaleCountClaims(doc(), 23)` → `[]` |
| DLV-01.2 [red-proof] | A mutant total-entry count (`entry #24 because` → `entry #25 because`) is caught | The SAME function (`findStaleCountClaims`) that returns `[]` on the real doc returns exactly ONE mismatch on this mutant — not zero (proving the function discriminates, not vacuous) and not more than one (proving the mutation didn't collaterally break an unrelated claim) | `[{ label: "\`entry #N because\` heading justification", liveValue: 24 }]` |
| DLV-01.2 [red-proof] | A mutant closure-file count (`23 closure files plus` → `22 closure files plus`) is caught | Same discrimination proof, independently, for the CLOSURE_FILE_CLAIMS family — shows both template arrays are live, not just one | `[{ label: "\`N closure files plus package.json\` pull-quote", liveValue: 23 }]` |
| S-005.3 (non-REQ) | Constraint 4's enumeration promise matches enforcement exactly | n/a (doc-fidelity fix, not a Given/When/Then scenario — spec's own Open Item 3 classifies register-disposition-completeness as a PM/archive-gate document property, and this task's own wording mirrors that framing) | Full 11-member register named; re-ran REQ-IID-01's structural heading/`enforced-by` parsing tests, all still pass |

### Byte-neutrality (REQ-CAP-06, carried forward)

This slice touches only `docs/**` and `test/docs/**` — neither is part of the closure
`deriveRunnerClosure` walks nor build tooling that feeds `dist/runner-manifest.json`. Confirmed
via the established procedure (fresh `rm -rf dist && bun run build`) at slice close:
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — unchanged from every prior
slice's close, as expected for a docs-only change.

### Gate re-confirmation at slice close

`bun run typecheck`: clean. Fresh-build byte-neutrality: confirmed above. `bun test` (full
suite): **2548 pass, 0 fail**, run twice for stability. `test/docs/runner-integrity-docs.test.ts`:
23 (pre-existing) → 27 at this slice's close (net +4: non-vacuity, DLV-01.1 real match, DLV-01.2
×2 red-proofs).

### Commits (chronological, S-005)

25. `docs(runner-integrity): describe capability admission, name the full register in Constraint 4`
26. `test(docs): bind runner-integrity-invariants.md's counts to the live derivation (REQ-DLV-01)`
27. `docs(sdd): mark S-005 complete, record the S-005 apply-progress section`

### Next recommended

All five mechanism slices (S-000 through S-005) are now complete per the Build Order. Per the
Build Order's delivery-shape ruling (`main` requires PR + green required status check): S-000
already shipped as its own PR; S-001..S-005 ship together on this branch (`feat/tripwire-mechanism`)
as ONE PR at cycle close — the orchestrator's responsibility, not this slice's. Nothing left open
in this slice; S-002.3 (the anchor-site code comment) remains its own, separately-tracked,
deliberate archive-time obligation (see the S-002 section above) — not part of S-005's own scope,
and not resolved by this slice's docs work.

---

## Verify-final remediation

ONE batched fix pass closing the five gating findings of `sdd-verify --mode=final`
(`verify-report.md`, commit `6260a17`) plus the three amendments the orchestrator judged in.
User-authorized. Strict TDD throughout: for every finding the red-proof or the mutant-survival
evidence was observed FIRST, against the current code, and is quoted below.

Scope discipline: nothing from the report's OUT list was touched. Two items were expanded on
evidence rather than by choice, both recorded below — a second instance of C-2's defect that the
report did not name (found by doing exactly what C-2's fix demands: verifying REQ-PPI-03.3 in the
real workflow), and two enumeration corrections without which C-1's central rule could not be
enforced at all.

### C-1 — the classifier admitted 26 executable arbitrary-code-execution constructs

**Red-proof evidence (before the fix).** A 26-row laundering corpus was written first and run
against the shipped classifier through `deriveRunnerClosure` — the real build gate. Every row
failed with `expect(matching.length).toBe(N)` → `Expected: 1, Received: 0`: zero violations, the
construct admitted. The 12 structurally-identical green siblings (aliases, destructuring,
call-result bases, `??` fallbacks, literal receivers, computed reads through admitted origins)
passed from the start, so no row could be satisfied by "everything violates".

Reproduced verbatim from the report, plus the extra shapes named in the fix brief:

```
DENIED   | BASELINE signed red-proof CAP-05.2:  const F = Function; F("return 1")
ADMITTED | const F = Function; const G = F; G("return 1")
ADMITTED | const e = eval; const e2 = e; e2("1+1")
ADMITTED | const o = {}; o.F = Function; o.F("return 1")
ADMITTED | function h(){ return Function; } h()("return 1")
ADMITTED | const k="eval"; const g = globalThis[k]; const f = g; f("1+1")
ADMITTED | const C = Function.prototype.constructor;      C("return 1")()
ADMITTED | const { constructor: C } = Function.prototype;  C("return 1")()
ADMITTED | const w = WebAssembly.instantiate;              w(b)
ADMITTED | lib.js exports Function.prototype.constructor; entry.js calls it
ADMITTED | const { binding } = process; binding("fs")
ADMITTED | const p = process; p.binding("fs")
ADMITTED | "".constructor.constructor("return 1")()      (also [] , ({}) , /x/)
ADMITTED | Reflect.get(globalThis,"eval")("1+1")
ADMITTED | Reflect.get(globalThis,"process")
ADMITTED | Object.getPrototypeOf(f).constructor("return 1")()   (also (() => {}))
ADMITTED | (globalThis ?? {}).eval("2+2")
ADMITTED | const g = globalThis; g.eval("1+1")
ADMITTED | setTimeout(eval, 0, "3+3")
ADMITTED | Promise.resolve("5+5").then(eval)
ADMITTED | ["return 1"].map(Function)
ADMITTED | function x(){ return () => 1 } x()()
ADMITTED | const k="eval"; globalThis[k][k]                 (REQ-CAP-01.3's own shape)
ADMITTED | export { createRequire as mkReq } from "node:module"  -> mkReq("a")("./evil.cjs")  (F3)
```

**Fix.** Rules, not spellings — `scripts/capability-admission.ts`:

| Root cause (verify) | Rule now enforced |
|---|---|
| taint not transitive; REQ-CAP-05 enforced at the alias, not the occurrence | a register primitive named as a chain's ROOT or FULL PATH is a violation in every position bar `instanceof`-RHS / `typeof`-operand |
| an unresolvable free root admitted as `local` in value position | `origin === undefined` is a violation in EVERY position — it is not one of REQ-CAP-04's four kinds |
| `safe-terminal` an unlisted fifth admitted origin | a safe terminal is no longer an admission: a prototype-escape segment (`constructor`/`__proto__`/`prototype`) off a non-identifier base is inadmissible, and a call RESULT invoked with no property name (`f()()`) names no origin |
| destructuring/aliasing laundered a member path | a binding that IS a chain (`const p = process`, `const { binding } = process`) is classified as that chain, one hop — which also carries copied taint to its source |
| `x[k]` invisible, so `unclassifiable` unreachable in value position | computed chains are enumerated; off a global root they are `unclassifiable-construct` unless the key resolves to a Symbol |
| `Reflect.get` admitted as an opaque call | classified as the computed access it performs |
| re-export laundering compared a NAME to the register | the `export … from "node:…"` leg checks each named export's ORIGINAL name (`getNamedExports()[i].getName()`) against the module's admitted-name set, as the import leg checks each binding — an alias cannot launder past it (F3) |
| `??` could hide a global root behind a fallback | `a ?? b` resolves THROUGH `a`, and is undecidable unless `b` is a literal |

**Two enumeration corrections, required not optional.** "An unresolvable free root is a violation"
could not be enforced until two phantom free-root families were removed from the surface, both
genuine gaps in existing exclusions rather than new exclusions (REQ-CAP-01.5's pinned four-member
set is unchanged):

- a class `PropertyDeclaration`'s own name is a member declaration exactly like the
  `MethodDeclaration`/`GetAccessor` names already excluded — 13 such nodes in the real closure
  (`origin`, `appliedCount`, `failedIndex`, `problem`, …), each surfacing as a free identifier
  bound to nothing;
- `export { x } from "mod"` names a member of ANOTHER module, not a reference in this file's scope;
  it is admitted per-name by the module-specifier leg. A LOCAL `export { x }` stays enumerated.

Both are mirrored in `independentSurfaceCount`, the independent totality oracle, as is the computed-chain
enumeration — the oracle implements the same specified surface, independently.

**Real-closure zero-violation confirmation (the hard constraint).** `deriveRunnerClosure` over the
real built tree: **23 nodes, 0 violations**, measured after every rule landed. The measurement
that made this safe was taken BEFORE writing any code:

| Measured on the real 23-file closure | Value | Consequence for the fix |
|---|---|---|
| locals aliasing an admitted global | **0** | alias substitution has zero blast radius |
| safe-terminal chains carrying a prototype-escape segment | **0** | the escape rule cannot false-positive |
| call-result terminals with an EMPTY property path | **0** (all 4 real ones add exactly 1 segment) | `f()()` cannot false-positive |
| computed accesses rooted at an admitted global | **1** — `globalThis[Symbol.for(…)]`, `core/context.js:71` | forced the Symbol-key carve-out; a symbol slot cannot name a string-keyed language capability |
| local-root member paths | **239** | `ADMITTED_MEMBER_PATHS` must NOT apply to local roots |
| tainted roots used in VALUE position | **23** | D-3's "tainted is admitted as a value" is load-bearing and survives |
| `eval` / `Function` / `WebAssembly` occurrences | **0 / 0 / 0** | the occurrence rule is false-positive-free |

Fresh `rm -rf dist && bun run build`: `dist/runner-manifest.json` =
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde`, 118 files. No `src/**` change.

**Tests added.** `fit-42n`: the 26-row laundering corpus (rule identity + exact count of the
(rule, detail) pair per row), 12 green siblings, REQ-CAP-01.3 proven at classification AND at the
build boundary (exit ≠ 0, no manifest, stderr naming the construct), the F3 aliased-re-export
red-proof plus an admitted-name sibling positive.

**Expectations that legitimately changed** (each strictly stronger, never relaxed):

- `REQ-CAP-05.2` 1 → 2 violations: the denied root's own occurrence is now a violation as well as
  the aliased call. Enforcing only the latter is exactly what let `const G = F` launder one hop on.
- `REQ-CAP-03.2` 1 → 2 `constraint-4-undecidable-callee`: the inner `.constructor` off an arrow
  function AND the outer invocation of that call's result. The old argument for admitting the outer
  ("the inner is independently caught") fails as soon as the inner callee IS admitted, which is
  precisely `Reflect.get(globalThis,"eval")("1+1")`.
- Four `createRequire(x)(y)` fixtures gain a `constraint-4-undecidable-callee` — the EXECUTION half
  of "the closure may resolve, never execute".
- `deny-scan/web-assembly.js` detail `WebAssembly.instantiate` → `WebAssembly`: the register member
  named verbatim, which is what REQ-CST-04.2's scenario asks for.
- `REQ-XPO-01.4`'s "the re-exporting file reports zero violations" is replaced. Its premise — "the
  danger is in the SECOND file's use" — holds only while the imported NAME matches the register,
  which is the exact hole F3 exploits.
- Placeholder ARGUMENTS in planted fixtures (`anchor`, `payload`, `body`, `bytes`, `u`, `s`, …) are
  now bound via a `bind()` helper, appended so no message assertion's line number moves. A free
  identifier is itself an inadmissible origin, so an unbound placeholder contributed a finding
  unrelated to the property under test. Three committed `deny-scan/` fixtures were bound the same
  way, keeping their REQ-CST-04.2 fixture form.

Zero whole-verbatim reason strings changed. No `ViolationRule` was renamed.

### C-2 — the publish gate was permanently red

**Red-proof evidence.** Reproduced `publish.yml`'s own sequence against the real tree (stamp
`0.0.0-dev.abc1234` → `bun run build` → suite):

```
Expected: "31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde"
Received: "dec7aaf1d29fc1c281a34d24902bcc5f688952e324de059f46e022aea975aa06"
(fail) FIT-42 S-001 — FIT-MANIFEST-BYTE-NEUTRAL > REQ-CAP-06.1: the fresh-built manifest is
       byte-identical to the pinned digest
```

**Fix.** The standing gate is now the RELATION `design.md` §7 specifies: regenerate the manifest
into a scratch root from the built snapshot and compare bytes — reproducibility of the DERIVATION,
version-invariant by construction. Version-invariance is asserted, together with the fact that the
relation is not BLIND to the version (a stamped tree reproduces its own, different bytes). The
pinned literal is gone, and with it W-7's three-place manual re-pin ritual. The red-proof was
`sha256(x + "\n") ≠ sha256(x)` — true of sha256, silent about the generator; it now perturbs a real
closure file and asserts both the manifest and that file's own record digest diverge.

**Slice-gate fact, recorded here rather than asserted as a standing constant** (design §7's
"one-shot cross-tree sha comparison"): at this remediation's close, a fresh
`rm -rf dist && bun run build` at version `0.2.3` yields
`31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` over 118 files, byte-identical
to every prior slice's close.

**A second instance of the same defect, not in the report.** Verifying REQ-PPI-03.3 in the real
workflow — which C-2's fix brief explicitly demands — surfaced `REQ-MFB-02.1`
(`test/docs/changelog-release-vehicle-guard.test.ts`) asserting
`package.json#version === CHANGELOG`'s topmost heading UNCONDITIONALLY. A dev stamp falsifies that
by design, so the publish job would still never have published. Scoped to release versions, with
the dev-stamp shape asserted rather than skipped, plus a red-proof that a forgotten CHANGELOG bump
still fails and that the exemption is no wider than the stamp. Expanded on evidence, and it was the
difference between REQ-PPI-03.3 being true and being nearly true.

**REQ-PPI-03.3 verified in the real workflow**: with `version = 0.0.0-dev.abc1234` and a stamped
rebuild, the full suite is **2598 pass, 0 fail**. The publish job can now reach its publish step.

### C-3 — REQ-CST-04.3's non-vacuity guard counted substrings

**Red-proof evidence.** Measured against the real anchor, then against the mutant the scenario
names (every code reference removed, every comment untouched):

```
real anchor : substring hits 10 | AST identifier occurrences 2   (8 hits are in comments)
mutant      : substring hits  8 | AST identifier occurrences 0
              -> shipped `>= 2` substring guard PASSES on a file with no real reference left
```

**Fix.** `astIdentifierOccurrences` (in `test/support/closure-integrity-checks.ts`, the established
home for checkers shared by the fit-42 pair) counts CODE identifiers, asserted `toBe(2)` — exact,
not a threshold. A `{@link name}` JSDoc tag DOES yield a real Identifier (R1-16's probe), so
JSDoc-rooted nodes are excluded under the same exclusion E1 the classifier applies; without that,
prose could still satisfy the guard, which is the whole vacuity being closed. This was found by the
new test failing (`Expected: 0, Received: 1`), not by inspection. `REQ-CST-04.3.2` now builds the
mutant and asserts the differential the mechanism turns on, so it invokes the guard rather than
performing Set arithmetic beside it. The W-10b test title naming the retired deny-scan is fixed in
the same edit.

The module header's stale "No repo imports by design (node builtins only)" sentence (W-10a), sitting
directly above a repo re-export and now above a ts-morph import, was corrected in passing.

### C-4 — REQ-PTH-01 passed command substitution and dropped a valueless flag

**Red-proof evidence.** Two new `bundler-scripts/` fixtures, failing before the fix:

```
backtick substitution: findBundlerTargets -> [{flag:"--outdir", target:"`pwd`/dist/transport"}]
                       findUnclassifiableBundlerConstructs -> []          <-- PASSES
valueless flag       : findUnclassifiableBundlerConstructs -> []          <-- PASSES (dropped)
```

**Fix.** The predicate is inverted: a recognised flag's value is a target only if it matches the
committed safe-path grammar `[A-Za-z0-9._/-]+`. Decidability is a whitelist, never a search for
known-bad markers — a marker test closes the spellings enumerated at the time and leaves the class
open. Backticks, `$(…)`, `$VAR`, `${…}`, globs, `~`, shell operators, quoting, embedded whitespace
and an absent value are all undecidable now. Quote-stripping on target values became dead code and
was removed.

**Tests added**: the two fixtures with rule-identity assertions, an 11-kind rejection table, and a
5-spelling ACCEPTANCE table proving the inverted predicate did not start rejecting the decidable
paths REQ-PTH-01.1-.4 depend on.

### C-5 — FIT-CAP-TOTALITY's non-vacuity was unproven

**Red-proof evidence.** The shipped `REQ-CAP-01.2` was
`expect(() => expect(classifiedCount).toBe(presentCount)).toThrow()` over two local integers — it
referenced no production symbol. The report demonstrated it passing in a file with zero project
imports. The other half, `expect(classified.length).toBe(surface.length)` over
`surface.map(classify)`, is structurally incapable of failing.

**Fix.** REQ-CAP-01.2 mutates the ENUMERATOR (a shim dropping one `SurfaceNodeKind`) against a
fixture that genuinely exercises the dropped kind, asserting the count fell and that the failure
message names the kind. All five kinds are mutated in turn, each with a presence precondition. The
map-length tautology is replaced by a DISPOSITION assertion: every node classifies into exactly one
of `{admitted, violation, unclassifiable}`, well-formed (`via` in the admitted set, `rule` in
`VIOLATION_RULES`, non-empty detail). The totality pass also runs over the committed `deny-scan/`
and `green/` corpora (11 files), so it sees violating and unclassifiable nodes and not only the 23
clean ones. `fail-closed/` is deliberately excluded with the reason stated in the test: its fixtures
are JSON fault-injection recipes, not JS source with a capability surface.

**Mutation-kill evidence.** An enumerator that silently drops `meta-property`:

```
REQ-CAP-01.1 real closure    : Expected 20, Received 19   (fail)
REQ-CAP-01.1 corpora         : Expected  3, Received  2   (fail)
REQ-CAP-01.2 [red-proof]     : Expected  5, Received  4   (fail)
```

The retired red-proof stayed green under the identical mutant.

### Amendment A — the unkilled anchor-exemption mutant

**Red-proof evidence.** Deleting `if (anchorExemptionConsumed) return false;` — the only thing
preventing unlimited anchor exemptions — left the **entire suite green: 2598 pass, 0 fail**. No
fixture had two resolve-only uses at the anchor, so the single-use latch was untested code.

**Fix (tests only).** One resolve-only use stays exempt (sibling positive); a second is denied
naming `constraint-4-inadmissible-origin` exactly once; N uses yield exactly N-1 denials,
triangulated at 3 and 5 so the count cannot be satisfied by a latch that merely caps the second use.
With the guard line deleted, two of the three new tests fail.

### Amendment B — gates evaporated under root CI

**Red-proof evidence.** Two of the six `it.skipIf(process.getuid?.() === 0)` sites wrapped whole
LOOPS: `FIT-FAILCLOSED-BICONDITIONAL` dropped all 3 fault kinds though 2 are
permission-independent, and REQ-DGN-01.3 rule-identity totality dropped all 11 fixtures though 10
are. On a root runner those two standing checks did not run at all, and the pass count said nothing
about it.

**Fix.** Both loops filter only the chmod-dependent member (1 of 3 faults, 1 of 11 fixtures) and
assert the active set as a recorded fact of the environment, so a root run exercises 2/3 and 10/11
instead of 0/3 and 0/11. The four checks whose SUBJECT is an unreadable file keep their skip — there
is no permission-independent leg — but are enumerated by an always-running inventory assertion
instead of vanishing. A root run warns on stderr per site. New file:
`test/support/permission-dependent.ts` (12 lines; not in design §2's File Changes table — recorded
here alongside W-8's two).

Verified by forcing `RUNNING_AS_ROOT`: 4 warnings emitted, 4 whole-subject checks skipped, both
previously-dropped loops executing their permission-independent legs.

### Amendment C — ADR-0081 was never written

Transcribed `design.md` §5's block into
`openspec/decisions/0081-resolution-based-path-verdicts-predicate-placement.md`, following
ADR-0080's Context/Decision/Consequences/Alternatives structure. It is the only record that the
`test/support/` → `scripts/` relocation is *placement, not timing* and therefore not a reversal of
accepted ADR-0075 — a sentence design §2c leans on for seven `aligns` rows, and which would
otherwise have moved into `openspec/changes/archive/` leaving the pre-archive architecture audit
gate nothing to audit against. The Decision is stated as the code now implements it (a committed
safe-path grammar, not a marker search), with the accepted quoted-target consequence recorded
rather than left implicit.

### Gates at remediation close

| Gate | Result |
|---|---|
| `bun test` (full suite) | **2605 pass, 0 fail**, 7239 expect() calls, 202 files |
| `bun test` under `publish.yml`'s version stamp | **2598 pass, 0 fail** — REQ-PPI-03.3 now true in the real workflow |
| `tsc --noEmit` | clean |
| fresh `rm -rf dist && bun run build` | `dist/runner-manifest.json` = `31cd5382…f333fde`, 118 files |
| real-closure classification | 23 nodes, **0 violations** |
| standing anti-`toContain` scan (REQ-CST-06.1) | green |
| whole-verbatim reason strings | byte-identical; no rule renamed |

One unrelated environment flake was observed intermittently across runs:
`test/e2e/installed-consumer.e2e.test.ts`'s tarball leg times out at 5000ms when its scratch
`bun install` runs under load (6 failures, all in that one file, which this remediation does not
touch; it passes standalone in 3.7s). Not introduced here and not in scope — noted so a future
reader does not mistake it for a regression.

## Judgment-day remediation and scope correction

Blind judgment-day round 1: two independent judges demonstrated, with executed proof (real
`execSync("id")`, real `eval`, a `Function` construction printing `v26.5.0`), that the
capability-admission mechanism is bypassable. That is the **third** round on the same root cause —
the original build, the verify-final remediation batch above, and now judgment day — each closing
the spellings it was given while the next round found new ones.

The owner ruling was: stop claiming soundness, deliver honest scope. So this pass does three
things — closes the demonstrated repros (they genuinely raise the drift bar), fixes four unrelated
real findings, and **retracts** the adversarial claims the code and docs were making. The promise
that survives is the one `north-star.md` always stated: a drift control against honest mistakes and
agent edits, not an adversary control.

Every repro below was reproduced first (`0 violations` before the fix, in a planted mini-closure at
a temp root) and is now pinned by a red-proof row. The 17 new capability rows were all observed
failing with `Expected: 1 / Received: 0` — nothing was denied before the fix — and the three bundler
rows failing on their token readings.

### Part 1 — property-level fixes (demonstrated repro each)

| # | Finding | Repro evidence (before) | Action | Residual |
|---|---|---|---|---|
| 1 | `classifyOrigin` returned `{admitted, via:"local"}` on a local/parameter/class/import root **without inspecting the path**, while global roots got `ADMITTED_MEMBER_PATHS` and safe terminals got the prototype-escape check | 7 executable shapes, 0 violations each: `h.constructor("return 1")`, `const C = fn.constructor`, `{ p: process }`→`w.p.binding`, `{ process }`→`w.process.binding`, `class Holder{static g=globalThis}`→`Holder.g.eval`, `f(g = globalThis)`→`g.eval` (parameter defaults got no initializer analysis), `go(x)`→`x.constructor` | FIXED. One predicate, `capabilityBearingSegment(path, fullPath?)`, applied to the PATH independently of the root's admission: a segment naming any dot-segment of a non-`node:` register member, or a prototype-graph escape, is a violation unless the full path is an exact `ADMITTED_MEMBER_PATHS` entry (`Object.prototype` stays admitted). Rows `d1`-`d7` + 5 green siblings | The predicate is a DENY list over an unbounded name space — a carrier property named anything else still launders its base (`w.go.Reflect.get(w.go,"eval")`, executed, still 0 findings). Registered: pending-changes JD-1/JD-2 + the `capability-admission-oracle` head row |
| 2 | `classifySafeTerminal` rejected only `constructor`/`__proto__`/`prototype` plus bare `f()()`, and **admitted every other path** — a default-PASS on exactly the shape with no root to look up | 6 shapes, 0 violations each: `g().eval`, `g().Bun.plugin`, `g().WebAssembly.instantiate`, `g().binding`, `this.g.eval` (via `this.g = globalThis` in a constructor), `use(process)`→`p.binding` | FIXED. Same predicate, applied to the safe-terminal path (`PROTOTYPE_ESCAPE_SEGMENTS` ⊂ `CAPABILITY_BEARING_SEGMENTS`, so every pre-existing `c`-row detail is byte-unchanged). Rows `e1`-`e6` | Same as #1 — still a deny predicate. `classifySafeTerminal`'s own doc comment now says so |
| 3 | `TaggedTemplateExpression` was **never enumerated as a call site** and `taintReasonOf` did not recognise it, so no leg ever ran on the tag | ``const C = "".constructor.constructor`return process.version`; C()`` → **0 violations**, prints `v26.5.0` when run. Also ``h.constructor`return 1` `` and ``x()`hi` `` | FIXED. `invocationCallees()` now yields call/`new` expressions **and** tagged-template tags; `resolveChain` treats a tagged template as a call-result terminal (it IS an invocation); `taintReasonOf` recognises the kind. FIT-CAP-TOTALITY's independent oracle mirrors the change. Rows `f1`-`f3` + a green sibling | Enumeration totality is relative to the enumerator — nothing structurally finds the NEXT unenumerated form. Registered: JD-3 |
| 4 | The `origin === undefined` **default-deny had no fixture at all**: the judge replaced it with `{admitted, via:"local"}` against a mutated copy and the whole suite stayed green (2605/0) | Mutant verified reproducible here: 2605 pass / 0 fail with the branch flipped | FIXED. Three red-proofs (`Math.random()`, `new WeakMap()`, `new TypeError("x")`) + the green sibling (`Array.isArray([])`). **Mutant re-verified KILLED**: with the branch flipped, exactly those 3 fail and the sibling passes | None. This is the half of the property that survives, and it is now proven |
| 5 | Cross-file laundering: a literal-rooted chain in **value** position was not enumerated at all (`maximalAccessRoot` returned a non-Identifier → `continue`), so the escape had no finding at its producing occurrence | `[lib.js] export const C = "".constructor.constructor;` + `[entry.js] import { C } from "./lib.js"; C("return process.version")()` → **0 violations** (the single-file equivalent WAS caught by taint) | FIXED structurally, as the judge recommended — decided at the PRODUCING occurrence, no cross-module dataflow: maximal member chains are enumerated whatever their root kind. `resolveChain` gained `MetaProperty` as a safe terminal (`import.meta.url` is such a chain in the real closure). Row `g1` + `import.meta`/literal green siblings | None for this shape. A chain whose root `resolveChain` cannot classify is now `unclassifiable-construct` — fail-closed, and zero such nodes exist in the real closure |
| 6 | `-o`-prefixed single-dash flags mis-read; a flag accepted as a path; token shape matched case-sensitively | `-outdir dist/transport` → read as `-o` + `utdir`, target `"utdir"`, collides with nothing, **real path silently dropped**. `--outdir --minify dist/x` → target `"--minify"` (the safe-path grammar admits `-`). `--OUTDIR dist/transport` → matched nothing, silently ignored | FIXED. `classifyToken` folds the token for SHAPE decisions only (never the value); any single-dash `-out…` routes to `unclassifiable-shape` **before** the concatenated-short-form branch that mis-claimed it; `readValue` treats a leading `-` value as `undecidable`. 3 red-proof rows, one asserting the `--OUTDIR` collision is now REPORTED | None known for the token grammar |

### Part 2 — four independent WARNING findings

| # | Finding | Repro evidence | Action | Residual |
|---|---|---|---|---|
| 7 | `topologicalJobOrder` **invented a sequence** for jobs with no `needs:` relation — which GitHub Actions runs CONCURRENTLY — so REQ-PPI-02 and REQ-BPI-03.1 passed a workflow whose rebuild is not ordered against publish at all | A two-job fixture (`stamp-job` stamps + builds, `publish-job` publishes, no `needs:`) returned `{ok: true}` from both `checkExplicitRebuildStep` and `checkPublishOrdering` | FIXED. Every verdict now goes through `stepPrecedes(jobs, a, b)`: same job → step index; different jobs → a `needs:` ancestry check; otherwise **`undefined`, reported as a FAILURE** naming the unordered pair. The topological list survives only as an enumeration, and no verdict reads a position in it. 3 red-proofs + a `needs:`-linked sibling positive | `checkPublishOrdering`/`checkExplicitRebuildStep` still reason about the FIRST stamp and FIRST publish step, so two stamps or two publishes are decided by one pair. Registered: JD-8 |
| 8 | `checkSuiteGate` and `findNpmPublishCommandLine` inspected only the **FIRST** publish-carrying job (`return` on first match), while their sibling `checkRepoOwnerGuard`'s own comment says "a partial guard is exactly as dangerous as no guard at all" | A second, ungated `sneaky` publish job passed `checkSuiteGate`; a second `npm publish` line without `--dry-run` was invisible to `findNpmPublishCommandLine` | FIXED. `checkSuiteGate` loops every publish step in every job, requiring a suite step that provably precedes it and carries no `continue-on-error`; `findNpmPublishCommandLines` returns them ALL and REQ-PPH-03.1 asserts `--dry-run` on every one. 2 red-proofs | **Reason strings changed**: the three `checkSuiteGate` failure reasons gained a `job "<name>": ` prefix, because a reason with no job name is ambiguous once several jobs carry publish steps. Pinned expectations updated in the same commit; registered as JD-7 so the change is discoverable |
| 9 | The CHANGELOG↔version guard was **inert in exactly the publish run**: it early-returned on the `0.0.0-dev.<sha>` stamp shape that `publish.yml` applies before `bun test`, then asserted the shape of the value that had selected the branch. Its `[red-proof]` was a `toBe` tautology plus a hardcoded current release | Simulated the stamp in `package.json`: the guard passed while checking nothing about the CHANGELOG | FIXED. Under a dev stamp the invariant is asserted against the version the COMMIT declares, read via `git show HEAD:package.json` (a read failure throws loudly — never a silent pass). The invariant is extracted as `checkVersionHasChangelogHeading(version, topHeading)` and red-proofed on fixtures (mismatch, missing heading, match) with no live version hardcoded. **Non-vacuity verified**: with the stamp applied AND the CHANGELOG's top heading altered to `0.9.9`, the live test fails naming `version 0.2.3 does not match … 0.9.9`; with only the stamp applied, all 10 pass | None. The `git` dependency is real but `actions/checkout` already provides it, and its absence fails loudly |
| 10 | The suite **destroys and rebuilds the real `dist/` mid-run** (`ensureTscBuild` shells `bun run build`, whose `prebuild` removes the tree), and this change added three new consumers of it. Two concurrent `bun test` runs fail non-deterministically | Judge measured 2599/6 concurrent vs 2605/0 serial, different failures each time | **LOUD GUARD, not isolation — and the reason is a property, not effort.** A per-process scratch dist would remove the collision *and* the value: FIT-42, the docs-count check and the installed-consumer e2e exist to verify the tree that actually SHIPS, and a scratch copy verifies a copy. So the tree stays shared and a pid-keyed owner lock (`.tmp-shared-build.lock`, gitignored) is acquired on the first `ensureTscBuild()` and held for the whole process — the destructive window is every later read of `dist/`, not only the delete. A second run gets one named error naming the holder pid instead of six mysterious failures. `EPERM` from `kill(pid, 0)` counts as ALIVE (a foreign-owned process exists); only `ESRCH` is stale. Verified: live holder refused, stale lock taken over, lock released on exit | Proper isolation (scratch `outDir` + scratch codegen outfile + scratch manifest path, and re-deciding what `fit-42` verifies) registered as JD-4 |

### Part 3 — retractions (the load-bearing part)

- **`docs/runner-integrity-invariants.md`** — Constraint 4 no longer claims "the default for
  anything unrecognised is a violation, never a silent pass"; that sentence is explicitly retracted
  in place, and the section now separates what IS default-deny (origin admission, red-proofed
  against its mutant) from what is not (path admission where no table applies — a deny predicate;
  enumeration totality — relative to the enumerator's own five kinds). It states the structural
  reason it cannot be patched into soundness (dataflow), and states the real purpose in
  `north-star.md`'s own words: a drift control, not an adversary control. *Why this exists* item 2
  was softened in the same way ("no *named* unhashed-code-execution primitive"; drift value is real
  and is not the same as preventing execution). A new **Known gaps** subsection records the three
  demonstrated post-fix bypasses verbatim, alongside the list of what IS closed with a red-proof
  each, and points at `FIT-CAP-ORACLE`/`capability-admission-oracle`.
- **ADR-0079** — status becomes `Accepted (amended in implementation)`, a dated amendment banner is
  added at the top, and an `## Amendment` section after Consequences splits the Decision's property
  into retained (origin default-deny, now red-proofed and mutant-killed) and retracted ("the
  admitted set is closed", "ambiguity is violation" as whole-mechanism properties), with the
  dataflow reason and the drift-control purpose. Superseded text is preserved unedited.
- **ADR-0080** — a dated scope-correction note: "would have prevented every Constraint-4 finding in
  both judging rounds" is retracted (a third round found more), and the enumerator/classifier
  split's real, narrower property is stated — it detects a classifier mutation on an
  ALREADY-ENUMERATED node, and cannot see a construct the enumerator never reaches.
- **Guard doc comments** — `capability-admission.ts`'s header no longer claims never-a-silent-pass
  and now names both permissive halves; `resolveChain`'s "structurally incapable of naming an
  externally-sourced capability" is corrected (a function returning `globalThis` refutes it);
  `classifySafeTerminal` says its path check is a deny predicate; `CAPABILITY_BEARING_SEGMENTS`
  says so at its own declaration. `derive-runner-closure.ts`'s two operator-facing `why:` texts no
  longer tell the reader "the SHAPE is denied, never a specific spelling" without qualification —
  both now name the deny-predicate boundary and point at Known gaps. The four pinned expectations
  of the `constraint-4-inadmissible-origin` message were updated in the same commit.
  - **On the judge's cited line range**: `capability-admission.ts` ~583-585 carries no comment
    asserting `x()()` is undecidable, and `function x(){return ()=>1} x()()` IS caught — corpus row
    `c14` pins it as one `constraint-4-undecidable-callee` and passes. Rather than invent a
    retraction for a claim that is not there, the genuine adjacent over-claim (`resolveChain`'s) was
    corrected and the discrepancy is recorded as JD-6 so the citation is not re-raised.
- **Signed-spec count divergence LANDED** — `specs/runner-integrity-manifest/spec.md` REQ-CAP-04.4
  now reads 21 (was 22) and REQ-CAP-04.6 reads 30 (was 28), the shipped machine-checked counts,
  under a dated **Count reconciliation** note recording the provenance `design.md` §1 authorized for
  archive-time sync. `slices.md`'s S-001 acceptance text is reconciled to match. Only the two
  numbers changed; the pinning doctrine (exact membership, never a threshold) is untouched. No
  signed scenario text is false at archive.
- **Deferred soundness work registered** — `openspec/pending-changes.md` gains a
  `capability-admission-oracle` head row (deliverable `FIT-CAP-ORACLE`, the three executed bypass
  classes as motivating evidence, and the explicit note that a member-path allowlist cannot be made
  sound without dataflow analysis), plus JD-1..JD-8 covering every non-fixed finding from this pass.

### Gates

- `bun test`: **2645 pass / 0 fail / 7371 expect() calls**, 202 files (baseline 2605; +40 new tests).
- `tsc --noEmit`: clean.
- Fresh full rebuild: `dist/runner-manifest.json` =
  `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde`, 118 dist files, every one
  byte-identical to the pre-change tree (per-file sha256 diff, empty).
- **Real 23-file closure: 0 violations**, 23 nodes — verified after every Part 1 fix. `Reflect.get`,
  `Object.getPrototypeOf`, `Object.prototype` and `Object.defineProperty` all still classify as
  admitted; `Object.defineProperty(globalThis, …)` and `Object.defineProperty(process, "stdout", …)`
  (globals passed as call ARGUMENTS, 3 sites) are why a positional "a global may not escape into a
  value" rule was rejected in favour of the path predicate.
- Standing anti-`toContain` scan: green. Whole-verbatim reason strings byte-identical except the two
  deliberate, recorded changes (the `constraint-4-*` `why:` texts, and `checkSuiteGate`'s job-name
  prefix) — both with their pinned expectations updated in the same commit.
