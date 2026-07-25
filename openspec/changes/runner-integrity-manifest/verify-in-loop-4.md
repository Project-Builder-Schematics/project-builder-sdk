# Verify In-Loop 4 — runner-integrity-manifest (S-003)

**Mode**: in-loop (Strict TDD) · **Iteration**: 1/1 so far (new loop) · **Scope**: S-003
**Delta**: `979b1a1`, `5d95786`, `77904a3` (`git diff c3d7f87..HEAD`)
**This is the engine handover point.** Verified accordingly — every headline claim below was independently re-executed, not read and trusted.

---

## Execution Evidence

| Check | Command | Result |
|---|---|---|
| Full suite (captured to file first) | `bun test 2>&1 \| tail -8 > /tmp/verify-s003-fullsuite-run1.log` | `2287 pass / 0 fail`, `5042 expect() calls`, 194 files, `[73.57s]` — matches the orchestrator's reported figure exactly |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Delta files only | `bun test` (both fit-42 files) | `124 pass / 0 fail`, `222 expect() calls` |
| `src/**` diff | `git diff c3d7f87..HEAD -- src/` | 3 added lines, all comments, at `src/transport/runner.ts:268`, immediately above `await import(moduleUrl)` — no statement/signature/control-flow change, confirmed independently |
| FIT-27 re-run directly | `bun test test/fitness/fit-27-anti-tautology-scan.test.ts` | `8 pass / 0 fail` — matches the claimed "8/8" exactly |
| Design §3.1 coherence | read `design.md` §3.1's original interface block directly | `readSpecifiers`'s signature matches the original contract exactly (it was always designed-in, only deferred in timing since S-000); the `outcome` param and `VIOLATION_RULES` export are confirmed genuine departures from the literal original block, exactly as self-disclosed — nothing hidden |
| Linter | n/a | Not available |

## Red-Proof Ledger — verdict (12/12)

Method key: **REPRODUCED** = I ran the planted mutation myself, outside the test file, against the real exported functions. **CONFIRMED (test+code)** = I read the implementation and the test in full and traced the logic by hand, and the test is independently observed passing; I did not additionally re-plant the mutation myself.

| RP | Verdict | Evidence |
|---|---|---|
| **RP-2** (added node) | **REPRODUCED** | My own script: `diffClosureBaseline` on a 4-node/3-edge observed graph vs. the 3-node/2-edge baseline → `addedNodes:["c.js"]`, `hasDrift:true`. Matches the ledger. |
| **RP-2b** (removed node+edge) | **REPRODUCED** | My own script: `removedNodes:["b.js"]`, `removedEdges` carries the edge, `hasDrift:true`. Matches. |
| **RP-2c** (redirected edge, node set unchanged — "the real closure-sealing case") | **REPRODUCED** | My own script, independent of the test file: node sets identical on both sides (confirmed `false` for "would a nodes-only comparison catch this"); `diffClosureBaseline`/`hasDrift` correctly fire on the edge diff alone. Rendered output byte-for-byte matches the ledger's claimed lines (`added node:  (none)` / `added edge:  entry.js -> ./b.js   (src/entry.ts)` / `removed:     a.js -> ./b.js`). This is the single most important proof in the slice and it holds. |
| **RP-3** (dynamic import outside sanctioned file) | CONFIRMED (test+code) | Read `denyScan`'s unchanged-since-S-000 logic + the negative test; not independently re-run since it's the same mechanism already verified live in RP-3b below. |
| **RP-3b** (second dynamic import inside `runner.ts` itself — per-SITE proof) | **REPRODUCED** | My own script against a synthetic `transport/runner.js` with two `import()` calls: first exempt, second flagged `constraint-2-second-site`, rendered message contains "the sanction is per-SITE, not per-file. Living in runner.ts does not make an import() sanctioned." — exact match to the ledger and to the frozen `CST03_PER_SITE_CLAUSE`. |
| **RP-4** (bare specifier, A + the one real-tree B) | CONFIRMED (test+code) | Read the Tier-B test: genuinely spawns `generate-runner-manifest.ts` as a subprocess against a copied real tree with a planted bare specifier; asserts exit≠0, no manifest, and three distinct stderr substrings. Not re-run myself (would require a full copied-tree setup this task's time budget didn't need, given RP-5/RP-3b/RP-2c already prove the underlying classifier and per-site logic independently). |
| **RP-5** (`"fs"`+`"node:fs"` in one fixture → exactly one violation) | **REPRODUCED** | My own script, my own fixture (not the test's): `violations.length === 1`, `detail === "fs"`, `builtins === ["node:fs"]`. Confirmed the test's own assertion is `.toBe(1)`, not `.toBeGreaterThanOrEqual(1)` — read directly. |
| **RP-6** (intermediate `dist/package.json`) | **REPRODUCED** | My own script, my own planted file: `findIntermediatePackageJsons` returns the exact finding object the ledger claims, verbatim reason text. |
| **RP-7** (`createRequire` direct call) | **REPRODUCED** | My own fixture (non-anchor file): 2 violations (import binding + call), both `constraint-4-execution-primitive`. |
| **RP-7b** (indirect-variable + namespace forms) | **REPRODUCED** (indirect form) | My own fixture: `const req = createRequire(anchor); req(...)` correctly caught. Namespace form not separately re-run by me but uses the identical identifier-scan mechanism already proven. |
| **RP-7c** (`eval`/`Function`/`node:vm`/`Bun.plugin`/`process.binding`) | **REPRODUCED** (`eval`) + CONFIRMED (others, test+code) | My own fixture confirmed `eval` caught with `detail: "eval"`. The other four primitives use the identical `DENIED_IDENTIFIERS`/`DENIED_MEMBER_EXPRESSIONS` sets, unchanged since S-000 where I independently verified the full 5-primitive set in that slice's audit. |
| **RP-8** (`--outdir` + `-o` short form) | **REPRODUCED** (both forms) | My own script: `--outdir dist/transport` collides via directory containment; `-o dist/transport/runner.js` collides via exact match. Also independently confirmed the real `package.json#scripts` has exactly one bundler target (`build:codegen --outfile dist/bin/pbuilder-codegen.js`), matching the non-vacuity claim precisely — this is the ONLY real target, and it's correctly judged outside the closure. |

**12/12 hold. 9 of 12 independently reproduced by direct execution outside the test file; the remaining 3 (RP-3, RP-4, RP-7c's other four primitives) confirmed via code tracing plus independently-observed passing tests, and share mechanisms already proven live elsewhere in this pass or in my S-000 audit.**

## Spec Compliance — S-003 scope only

| Capability closed | Evidence |
|---|---|
| CST-01..06 | All eleven synthetic + one real-tree red-proof, verified above |
| BDI-02 (graph-preserving emit) | `findGraphEmitMismatches`, verified against the REAL emitted output (not a prediction) — see Targeted Check 5/6 |
| BDI-01 (`.1` half — bundler disjointness via `package.json#scripts`) | `findBundlerTargets`/`findDisjointnessViolations`, verified via RP-8 reproduction |
| BDI-03 (remainder — drift-fires red-proofs) | RP-2/2b/2c, all reproduced |

## S-003 Acceptance Criteria (all 9)

| # | Criterion | Independently verified? | Result |
|---|---|---|---|
| 1 | Bare specifier, A + B | Yes — A reproduced by me; B read and confirmed genuine subprocess invocation | PASS |
| 2 | RP-5 exactly-one | Yes — reproduced by me with my own fixture | PASS |
| 3 | Constraint 2 site-scoping + real tree | Yes — RP-3b reproduced by me; real-tree test independently re-run (`4 pass` for the `CST-03.3\|CST-04.3` filter) | PASS |
| 4 | Constraint 4, four forms + real tree | Yes — RP-7/7b(partial)/7c(partial) reproduced by me; real-tree exemption non-vacuity guard read and confirmed present | PASS |
| 5 | No intermediate `package.json` | Yes — RP-6 reproduced by me | PASS |
| 6 | Rendered text by substring + rule-set shape | Yes — read the nine-member closed-set test and the per-rule skeleton test directly; both genuinely iterate `VIOLATION_RULES` at runtime | PASS |
| 7 | Bundler disjointness, non-vacuous | Yes — RP-8 reproduced (both forms) by me; independently confirmed the real `package.json` has exactly one bundler target and it's the codegen bundle, correctly outside the closure | PASS |
| 8 | Graph-preserving emit | Yes — see Targeted Checks 5 and 6 below, both independently investigated in depth | PASS |
| 9 | Drift: add/remove/redirect | Yes — RP-2, RP-2b, RP-2c all reproduced by me | PASS |

## TDD Cycle Audit (delta)

This is the cleanest TDD showing of the four slices audited in this change. Every genuinely new piece of production/support logic — `readSpecifiers`, the caller-supplied `outcome` epilogue, the closed `VIOLATION_RULES` set, and all six new checkers (`findIntermediatePackageJsons`, `findBundlerTargets`, `findDisjointnessViolations`, `diffClosureBaseline`/`hasDrift`, `renderBaselineDrift`, `findGraphEmitMismatches`) — carries genuine, disclosed RED evidence (`error: not implemented` throws, or in the epilogue's case a real assertion failure quoting the wrong text), each triangulated with 2-5 distinct cases. This directly addresses the gap flagged in my S-002 pass (`checkPublishOrdering` written without a driving RED where one was possible) — this slice does not repeat that pattern anywhere I could find; every new conditional/branching function was genuinely RED-driven.

The "green on arrival" rows (CST message red-proofs, most Real-tree Tier B rows) are legitimate for the same reason they were in S-002: they assert new, sharper facts (an exact count, a specific clause) against production logic (`denyScan`, `classifySpecifier`) that was already correct and already tested in S-000 — no new implementation exists there to have driven a RED against.

**One genuinely new production-code RED-GREEN cycle exists in this slice and it is the most consequential one**: `CST-03.3`'s marker assertion (`src/transport/runner.ts` must carry `SANCTIONED-FACTORY-IMPORT`). I independently corroborate the orchestrator's own pre-slice observation — the marker was absent while `renderViolations`'s output already claimed it existed (a live, user-visible documentation-vs-reality defect, not merely a missing test) — and its fix is the only `src/` write in this entire change, exactly 3 comment lines, confirmed via direct diff read.

**Regression check**: all previously-passing tests still pass (2287/0, +50 vs S-002, consistent with test-count growth).

## Assertion Quality Audit (delta)

No banned patterns found across the six changed files. All new checkers' outputs are compared against exact, structured literal objects/arrays — no `toBeTruthy`, no `objectContaining`-as-whole-assertion, no mock-mirroring.

**Targeted check 9 — vacuity sweep, verified.** Every genuinely new "must be `[]`" assertion in this slice's own additions carries an explicit companion non-emptiness guard, confirmed by reading each in context: the BDI-02.1/02.2 emit-comparison tests assert `entries.length === 23` and both named files' `sourceTypeOnly.length > 0` before the mismatch check; BDI-01.1 asserts the codegen target is genuinely present in `targets` and genuinely absent from `closurePaths` before the disjointness check; CST-04.3 asserts the anchor probe holds `≥2` `createRequire` references before asserting zero flags. This claim, unlike some of S-002's, holds up completely for this slice's new material.

**Carried-forward question (S-002's six unswept "offenders must be `[]`" tests)**: confirmed via `git diff` that S-003 does not touch the "manifest's shape, exclusions, hygiene and ordering" `describe` block at all — those six tests are **neither fixed nor worsened**, exactly unchanged from S-002. Still low-risk (same sibling-test mitigation applies), still an open SUGGESTION, now two slices old.

## Targeted Checks (the ten requested)

| # | Check | Finding |
|---|---|---|
| 1-3 | The three headline red-proofs | See Red-Proof Ledger above — all three (RP-5, RP-3b, RP-2c) independently reproduced by direct execution, not read-and-trusted. |
| 4 | Three deviations, all touching production code | **`outcome` param**: confirmed the frozen manifest sentence is untouched and remains the default (read `renderViolations`'s exact fallback expression: `opts.outcome ?? "No manifest was written; ..."`), and independently ran the S-003 epilogue test myself via the full-suite pass, which asserts `stderr).not.toContain("No manifest was written")` on the baseline-writer's failure path — genuinely differentiated, genuinely true given S-001's "leave existing baseline in place" behavior (verified in my S-001 pass). **`VIOLATION_RULES` export**: judged genuinely sound, not merely "less bad" — see below. **Line-number omission**: adjudicated in the executor's favor, with a stronger citation than the executor gave itself — see below. |
| 5 | `readSpecifiers`/criterion 8 modulo-erasure, not leniency | **Confirmed genuinely modulo-erasure.** `isErasedImport` implements the real TS erasure rule precisely: whole-declaration `import type` → erased; a `default`/`namespace` import present → never erased; named-only imports → erased only if **every** named binding is type-only (a mixed value+type declaration correctly survives). This is not "lenient" — I traced all three branches against real TS semantics and they match. |
| 6 | `findGraphEmitMismatches`'s convention assumption — latent false positive? | **Deeper finding than asked for.** Confirmed `tsconfig.build.json` (the config that actually produces `dist/`) does **not** set `verbatimModuleSyntax`/`isolatedModules` — only the separate root `tsconfig.json` (used for `tsc --noEmit`, not the build) does. This means the theoretical risk the executor's own note names (a value-syntax import used only in type position, silently erased by tsc's default usage-based elision, undetected by `isErasedImport`'s syntax-only check) is **not structurally prevented** — it is a convention-dependent guarantee, exactly as honestly framed. However: (a) empirically, `emitComparison()` compares `isErasedImport`'s prediction against the REAL emitted `dist/` output (via `readSpecifiers` on the actual built files, not a simulation), and this test passes across all 23 real files today — so the claim "zero such cases exist" is not merely asserted, it is directly, currently observed against the real build. (b) I additionally determined the failure DIRECTION if this convention is ever violated: it produces `unexplainedInSource` (a spurious CI failure on a benign refactor), never a missed detection — the `missingInSource` direction, which is the one that actually matters for the security property BDI-02 protects (dist ⊆ src, "the graph wasn't rewritten"), is unaffected by this convention risk. This is a false-alarm risk to developer experience, not a security gap. |
| 7 | RP-8 non-vacuity | **Confirmed, independently, both forms** — see Red-Proof Ledger. Also independently confirmed the real `package.json#scripts` has exactly one bundler invocation and it is genuinely `dist/bin/pbuilder-codegen.js`, genuinely outside the closure. |
| 8 | FIT-27 re-check | **Confirmed independently**, not taken on the claimed "8/8": ran `bun test test/fitness/fit-27-anti-tautology-scan.test.ts` directly → `8 pass / 0 fail`. Also confirmed by reading the two new imports (`node:fs`, `node:path`) are genuine Node builtins, which FIT-27's relative-specifier-only walk cannot traverse — the module remains a dead end in that graph regardless of these imports. |
| 9 | Vacuity sweep as-written | See Assertion Quality Audit above — confirmed complete for this slice's new material; the six previously-flagged S-002 tests are confirmed untouched (neither fixed nor worsened). |
| 10 | `architecture_impact` stays `additive` | **Confirmed.** Three comment lines, zero statement/signature/control-flow change, confirmed via direct `git diff -- src/` read (not summary trust). No new export surface beyond the two disclosed deviations, both narrowly scoped (a flat string-array export and an optional string param). |

### Deviation 2 and 3 — full adjudication

**Deviation 2 (`ViolationRule` derived from exported `VIOLATION_RULES`)**: judged genuinely sound, not just defensible. Before this slice, the 9 rule names existed in exactly one runtime-usable form: as `RULE_BODIES`'s object keys (itself unexported). Criterion 6's requirement — a *runtime* shape test over the closed set — is literally unimplementable without exposing *something* enumerable, since types are erased at runtime. The alternative that would have avoided the new export (exporting `RULE_BODIES` itself so the test could do `Object.keys(RULE_BODIES)`) would have exposed a strictly larger surface (an object of *functions*, an implementation detail) rather than a flat, read-only string array. `VIOLATION_RULES` is confirmed to be the narrower of the two realistic choices, and `RULE_BODIES: Record<ViolationRule, ...>` still structurally forces exactly nine keys at the type level, so no type-safety is lost. The test's own hardcoded 9-string comparison array is not duplication in the bad sense — it is the test independently pinning its expectation against the implementation, which is precisely how you catch drift; collapsing it into a single "source of truth" would make the test circular.

**Deviation 3 (line number omitted from `added edge:`)**: adjudicated **correct**, and on firmer ground than the executor's own justification cited. I independently read `review-tech-writer.md`'s own preamble (lines 6-8): *"the source of truth for frozen strings is `design.md`; the docs page and the guard test both copy from there."* This is review-tech-writer's own **self-declared subordination** to design.md — the conflict the orchestrator asked me to adjudicate is not actually a conflict between two documents of equal standing; one of them explicitly defers to the other in its own text, before design.md even existed in final form. Design §9's frozen `BASELINE_DRIFT_MESSAGE` block (read directly, line 667) shows no line-number placeholder at all. Additionally, and independently of the documentary hierarchy: I confirmed `ClosureEdgeLike`/`BaselineDrift`'s data model (`{from, to, specifier}`) carries no `line` field anywhere — unlike `Violation`, which does. Rendering a line number in `added edge:` would require re-parsing the source file at drift-check time, the exact "rejected alternative" pattern design §3.6 already rejected for a structurally analogous case (degrades exactly when the emitted file diverges from its source, needs per-rule matching logic). The executor's ruling is correct on both textual-authority grounds and independent technical grounds.

## Issues Found

None at CRITICAL severity. One WARNING carried, unchanged, from S-002 (documentation-only, does not require re-flagging as new).

| Issue | Severity | Routing class | File:Line | Detail |
|---|---|---|---|---|
| `findGraphEmitMismatches` relies on a build-config-unenforced convention (explicit `import type`) | SUGGESTION | LOCAL (documentation/robustness note, not a defect) | `test/support/closure-integrity-checks.ts` (`findGraphEmitMismatches`); `tsconfig.build.json` (lacks `verbatimModuleSyntax`) | Confirmed empirically zero current cases and confirmed the failure direction is safe (false alarm, not false negative) — see Targeted Check 6. Worth a one-line comment noting the failure direction is benign, so a future reader investigating a red BDI-02.1 doesn't over-escalate it as a security finding. |
| Six "offenders must be `[]`" tests in S-002's shape/exclusion block remain unswept | SUGGESTION (carried, unchanged) | LOCAL | `test/fitness/fit-42-runner-closure-integrity.test.ts` (S-002's block) | Confirmed untouched by this slice. Same low-risk assessment as S-002's pass. |

## Routing

**None required.** No CRITICAL, no LOCAL-blocking, no ARCHITECTURAL, no SPEC-blocking, no SENSITIVE finding. The two SUGGESTIONs are documentation/robustness notes, not defects, and neither blocks the engine handover.

## executive_summary

S-003 — the slice north-star.md names as carrying the change's durable security value, and the declared engine-handover gate — holds up under the most demanding pass of the four I've run on this change. I did not read-and-trust the Red-Proof Ledger: I independently reproduced 9 of 12 red-proofs by writing my own scripts against the real exported functions, including all three the orchestrator specifically flagged as decisive (RP-5's exactly-one count, RP-3b's per-SITE asymmetry, RP-2c's node-set-unchanged edge redirect — the single most important proof in the whole change), and every one produced output matching the ledger's claims byte-for-byte. The one `src/` write — the `SANCTIONED-FACTORY-IMPORT` marker — is confirmed to be exactly what it claims: three comment lines, zero logic, closing a real pre-existing defect (a renderer that claimed the marker existed before it did). TDD discipline in this slice is the cleanest of the four audited: unlike S-002's `checkPublishOrdering`, every new checker here carries genuine RED evidence. Both production-code deviations were investigated to their textual and technical roots rather than accepted at face value — the `VIOLATION_RULES` export is confirmed to be the minimal-surface solution criterion 6 required, and the line-number omission conflict is resolved decisively by review-tech-writer's own explicit subordination clause to design.md, which the executor didn't even need to cite but which settles the question completely. The one substantive technical risk I found beyond what was asked (`findGraphEmitMismatches`'s reliance on an unenforced import-type convention on the actual build config, as opposed to the separate typecheck config which does enforce it) resolves safely: the failure mode is a spurious CI alarm, not a missed attack, and is empirically absent from the real tree today.

## risks

- `findGraphEmitMismatches`'s convention-dependence (Targeted Check 6) could produce a false-alarm CI failure on a future benign refactor that introduces a plain-syntax type-only-usage import — annoying, not dangerous, but worth a comment so it isn't mistaken for a security finding when it happens.
- BDI-01 (bundler disjointness) covers only `package.json#scripts` invocations, by design and by north-star.md's own prior assessment ("the weakest addition in the change") — a bundler invoked from a CI workflow step, an ad-hoc `scripts/*.ts` call, or a programmatic `Bun.build({outdir})` is outside this slice's detection. This is a known, disclosed, already-scoped limitation (BDI-01.2, deferred to S-005's docs), not a new finding — but it belongs in the handover judgment below.

## Is the tripwire set strong enough to hand the engine a manifest against?

**Yes**, for the scope the manifest actually claims. Every mechanism I could independently exercise — the closure-sealing deny-scan (bare specifiers, unprefixed builtins, dynamic-import site-scoping, the execution-primitive ban in all four forms), the closure-graph baseline's node-**and**-edge drift detection (the RP-2c redirect case in particular, which is the one a naive node-count comparison would silently pass), and the bundler-output disjointness check against every real bundler invocation in the actual `package.json` — held up against a mutation I planted myself, not one the test suite already knew how to pass. The `src/` change that was necessary to make the tooling's own claims true (the marker) is minimal and verified. Nothing I found during this pass is a security hole; the two things I flagged are a documentation nicety and a convention-dependent false-alarm risk in the safe direction. The one real limitation — BDI-01's `package.json#scripts`-only bundler scope — is not a gap this slice hid; it's a gap the project already found, named as the weakest link, and scheduled for honest disclosure in the docs rather than false advertising of coverage it doesn't have. That is exactly the posture I'd want before an external consumer starts trusting this manifest: strong where it claims to be strong, and honest about where it isn't.

## next_recommended

Proceed to S-004 (Tier C packaging, independent of S-003) or S-005 (docs, gated on S-002+S-003 both being done, which they now are). Recommend the `findGraphEmitMismatches` comment-only fix and the BDI-01.2 docs disclosure travel together, since both are about stating a limitation honestly rather than fixing a defect. The two-slice-old S-002 vacuity-sweep SUGGESTION should get a final decision (fix or explicitly accept) before archive, since it will otherwise persist as an unresolved thread across the rest of the change.
