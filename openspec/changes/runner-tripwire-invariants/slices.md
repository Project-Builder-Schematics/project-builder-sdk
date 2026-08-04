# Slices: Runner Tripwire Invariants

**Triage**: L
**Spec version**: runner-integrity-manifest V3 (SIGNED) + publish-pipeline-hardening V4 (SIGNED)
**Total slices**: 6 (1 walking skeleton + 5 SPIDR) — 22/22 REQ-IDs, 77/77 scenarios, 49/49 red-proofs (plan-verify iteration-2 amendment, 2026-07-29: +5 scenarios / +3 red-proofs, `REQ-CAP-04.6-.8` + `REQ-DGN-01.3-.4`, see `specs/runner-integrity-manifest/spec.md`'s own tally note — REQ-ID count unchanged; iteration-1 amendment, 2026-07-29: +5 scenarios / +2 red-proofs, `REQ-CAP-01.4-.7` + `REQ-PTH-01.7`)

**SC-1 override note**: per proposal/design binding sequencing, S-000 is NOT the mechanism skeleton — it is the publish-path slice (zero dependency on the mechanism, independently mergeable). S-001 carries the mechanism's own walking-skeleton role (enumerate/classify live on the real 23-file closure) under its SPIDR tag, because SC-3 binds it and `FIT-CAP-TOTALITY` into one inseparable slice.

---

## S-000: Walking Skeleton — Publish path proves what it ships

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-PPI-01, REQ-PPI-02, REQ-PPI-03, REQ-PPI-04, REQ-PPI-05
**Requires**: nothing
**Test layers**: integration (`fit-46-publish-sequence-integrity.test.ts`, new) + unit (`fit-23-publish-workflow-guard.test.ts`) + conformance timeout

**Acceptance** (**plan-verify iteration-2 amendment, finding B1, 2026-07-29** — directions
stated explicitly; closes `verify-plan-2.md`'s self-contradiction: the prior wording said
digests "match unconditionally and mismatch under `--ignore-scripts`" in one breath,
which is contradictory as written. Reading (a) below is the correct one):
- GIVEN the real stamp → rebuild → pack sequence on a scratch target
- WHEN packed digests are recomputed against packed bytes
- THEN on the **normal path**, digests match UNCONDITIONALLY (PPI-01.1); the
  **`--ignore-scripts` run is the RED-PROOF that MUST MISMATCH** (PPI-01.2 — the
  behavioural proof of PPI-01's lifecycle-sensitivity claim: skipping `prepublishOnly`
  means the manifest is never regenerated after the version stamp, so the packed
  `package.json` digest diverges from the packed bytes); `publish.yml`'s explicit
  rebuild step (PPI-02) is a SECOND, INDEPENDENT guarantee against the same failure
  mode — declared structurally, not inferred behaviourally, so the two checks fail
  for different reasons if either regresses; `publish.yml` declares a suite gate with
  no `continue-on-error` strictly before publish (PPI-03); `react-conformance.test.ts`
  has a per-file timeout (PPI-04); `publishRunSteps` reads execution order via `needs:`,
  not YAML declaration order (PPI-05, R1-13 fix)

### Tasks
- [x] S-000.1 `publishRunSteps` rewrite: topologically order jobs by `needs:`, preserve within-job step position (REQ-PPI-05, R1-13)
- [x] S-000.2 `publish.yml`: explicit rebuild step between stamp and publish; suite step before publish, no `continue-on-error` (REQ-PPI-02, PPI-03)
- [x] S-000.3 `react-conformance.test.ts`: explicit per-file timeout, distinct from runner default (REQ-PPI-04)
- [x] S-000.4 `fit-46-publish-sequence-integrity.test.ts`: real scratch stamp→rebuild→pack, digest-vs-bytes (unconditional match, PPI-01.1), `--ignore-scripts` mismatch red-proof (PPI-01.2), gate-mechanism proof using ANY existing suite-check failure — never specifically a Constraint-4 fixture, which does not exist yet at S-000 time (REQ-PPI-03.2's S-000 leg, plan-verify iteration-2 amendment finding G — see `specs/publish-pipeline-hardening/spec.md`'s own dated note on REQ-PPI-03.2)
- [x] S-000.5 `fit-23-*.test.ts`: rebuild-step presence/absence, execution-order red-proof (REQ-PPI-02.2, PPI-05.2)
- [x] S-000.6 Red-proof each [red] scenario first (Strict TDD); confirm existing `fit-23` 18/18 baseline unaffected

**`fit-46` suite placement (plan-verify iteration-1 amendment, gap 8, 2026-07-29)**: `bun test`
(`package.json`'s `"test"` script, no `bunfig.toml` test-path filtering found) discovers every
`*.test.ts` file by default — `fit-46-publish-sequence-integrity.test.ts` therefore lands in the
**default suite**, not a publish-only lane, exactly like every other `fit-*` file; this is the
mechanism that makes it also gate the publish job (REQ-PPI-03's `bun test` step). Decision: leave
it in the default suite. Latency note: the real stamp→rebuild→pack sequence against a scratch
target is bounded (one `npm pack`, one rebuild) and expected in the tens-of-seconds range —
comparable to `FIT-FAILCLOSED-BICONDITIONAL`'s own scratch-root integration tests already in the
suite. This is judged acceptable (publish-shaped correctness proofs are inherently slower than
unit tests; the suite already tolerates this class of cost) rather than clearly hostile (>60s for
a single test was the bar for splitting it out, and there is no evidence it crosses that bar).
Task S-000.4 gains an explicit per-file timeout declaration on `fit-46` itself (same device as
REQ-PPI-04's react-conformance fix, applied defensively — a real pack sequence exceeding Bun's
5000 ms default would otherwise fail the test for the wrong reason).

**Build-mechanics: fit-46 scratch-target isolation + failing-fixture invocation boundary
(plan-verify final batch, owner-authorized, 2026-07-29, findings B1/B5)**: verified against the
pattern already live in this suite — `test/support/scratch-dir.ts`'s `scratchDirFactory`
(`mkdtempSync(join(tmpdir(), prefix))` under the OS temp dir, with an `afterEach` cleanup hook),
consumed today by `fit-42-runner-closure-integrity.test.ts:66` as `scratchDirFactory("fit-42-")`,
plus a second, ad-hoc `mkdtempSync(join(tmpdir(), "fit-42-pristine-"))` + `cpSync` COPY of the
real `dist/` and `package.json` at that same file's lines 82-84. `fit-46-publish-sequence-
integrity.test.ts` (S-000.4) reuses this exact device — `scratchDirFactory("fit-46-")` — never
the anti-pattern verified live at `fit-42-runner-closure-integrity.test.ts:151-161`
(`REQ-BPI-04.1`'s existing test spawns `bun scripts/generate-runner-manifest.ts` with
`cwd: PROJECT_ROOT`, i.e. the REAL repo root — this is R1-12's recorded anti-example, confirmed
present in the current suite today, not merely a hypothetical). **Decision**: `fit-46`'s
stamp→rebuild→pack sequence runs entirely against a `cpSync`-copied scratch tree (the real
`dist/` + `package.json` copied into a fresh `mkdtempSync(tmpdir())` directory, same shape as
`fit-42`'s existing `pristineRoot`); every `spawnSync` in the test (version stamp, `bun run
build`, `npm pack`) passes `cwd: <scratchRoot>`, never `cwd: PROJECT_ROOT` — the real tree is
read exactly once, to seed the copy, and never written. **Failing-fixture invocation boundary**
(`REQ-PPI-03.2`'s S-000 leg / the green-suite-blocks-publish proof): this proof runs as a CHILD
`bun test` invocation inside the same scratch tree — the existing repo precedent for this shape
is `test/docs/testing-story-docs.test.ts:69`'s `spawnSync("bun", ["test", scratchFile], { cwd:
PROJECT_ROOT, encoding: "utf-8" })` (a nested `bun test` process asserted on its exit code/
output, never on process-wide side effects) — adapted here to target the scratch copy's own
suite entry point rather than a single scratch file, so the OUTER suite run (this very test)
stays green while the INNER child process demonstrates the block by exiting non-zero before any
publish-step log line appears.

---

## S-001: Capability-Admission Property — total classification, live on the real closure

**Scope**: happy-path
**Dimension**: R (Rule — every capability use classifies via a closed admission rule set)
**Covers**: REQ-CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, REQ-PRM-01, REQ-CST-04.2 [MODIFIED], REQ-CST-04.3 [MODIFIED], REQ-CST-06.1 [MODIFIED], REQ-DGN-01 (.2 only — R1-8; .1/.3/.4 are S-004)
**Requires**: S-000's CONTENT on-branch, not its merge (**plan-verify iteration-2 amendment,
finding G, 2026-07-29** — corrects the stale "nothing (S-000 implicit)" line: per the
Delivery mechanics note in "Build Order" below, the mechanism branch bases off S-000's
branch IMMEDIATELY at S-000 PR-open time — S-001 needs S-000's files to exist on the
branch it builds from, it does NOT wait for S-000's PR to merge. This is a branch-basing
relation, not a REQ-level blocking dependency: S-001 introduces zero REQ-CAP-*/PRM-01
coupling to REQ-PPI-*)
**Test layers**: architectural (`FIT-CAP-TOTALITY`, `FIT-MANIFEST-BYTE-NEUTRAL`) + unit + `.negative.test.ts` red-proofs

**Acceptance**:
- GIVEN the current runner closure (23 files, 423 sites) and the synthetic fixtures
- WHEN `enumerateCapabilitySurface` + `classifySurfaceNode` run
- THEN classified-count == present-count exactly (CAP-01.1); the `SurfaceNodeKind` union and the E1-E4 exclusions are each pinned by exact membership (CAP-01.4/.5, plan-verify iteration-1); both live escapes (`globalThis["ev"+"al"]`, IIFE-constructor) and `node:child_process` fail naming the callee/origin rule (CAP-03.1/.2, CAP-04.1); `x instanceof Function` is admitted while `const F = Function; F(...)` stays denied (CAP-05); admitted tables pin exactly 22/6 members (CAP-04.4/.5); member paths off an admitted root pin exactly 28 members and `process.dlopen` fails naming the member path (CAP-04.6/.7/.8, plan-verify iteration-2); `dist/runner-manifest.json` is byte-identical to `bf6c983c…a530` (CAP-06.1)

**Checker-files/closure statement (plan-verify iteration-1 amendment, gap 8, 2026-07-29)**: the
new `scripts/capability-admission.ts` and `scripts/bundler-disjointness.ts` files (and every other
`scripts/*.ts` maintainer/build/CI-tooling file) are build-time-only — they are never part of the
derived runner closure, because `deriveRunnerClosure` walks roots at `dist/transport/runner.js`
over `dist/**` (the emitted output), never over `scripts/**` or `src/**` directly. They therefore
cannot perturb the manifest, and adding them creates no tension with the byte-neutrality gate
(REQ-CAP-06, this slice's own gate below) — the gate protects `dist/runner-manifest.json`'s bytes,
which are a function of the *closure walk's output*, not of which tooling files exist on disk.

### Tasks
- [x] S-001.1 `scripts/capability-admission.ts`: `enumerateCapabilitySurface`, closed `SurfaceNodeKind` union pinned by exact membership (CAP-01.4), `DENIED_CAPABILITY_PRIMITIVES` (11 members), `ADMITTED_GLOBALS`/`ADMITTED_NODE_SURFACES` (21/6 — verified count, see apply-progress note on the 22→21 digest-provenance reconciliation — pinned exact, CAP-04.4/.5), the E1-E4 exclusion table pinned by exact membership (CAP-01.5) with the narrowing/widening red-proof (CAP-01.6)
- [x] S-001.2 Callee decidability + origin admission + positional decidability (D-1/D-2/D-3, R1-17 relaxation with SC-2 hazard test) (CAP-03, CAP-04, CAP-05)
- [x] S-001.3 No-reassignment precondition, scope/origin resolution (`FileContext`, `BindingOrigin`) (CAP-02)
- [x] S-001.4 `derive-runner-closure.ts`: delete `denyScan`, wire to capability-admission; `node:` vs `builtinModules` (R1-15/CAP-04.3); directory-specifier rule (R1-8/DGN-01.2); **node:vm fold, per design.md §1 D-3 + the Data Model** — `node:vm` ceases to be `classifySpecifier`'s special case; it is NOT added to `ADMITTED_NODE_SURFACES` (the 6-module admitted table), so it is governed by the same generic origin-admission rule (REQ-CAP-04) as every other non-admitted `node:` import, denied as an inadmissible origin — while separately remaining a member of `DENIED_CAPABILITY_PRIMITIVES` (REQ-PRM-01.1's exact 11-member set) so the ONE-register/ONE-site property holds and it carries its own producing fixture (PRM-01.2); correct the false R1-16 JSDoc comment; JSDoc-surface exclusion E1 with the RCD-03.3 non-flagged scenario (CAP-01.7, plan-verify iteration-1 — NOT CAP-01.2, which asserts the mutation-catching property, not day-one non-flagging) plus its own widening red-proof (CAP-01.2)
- [x] S-001.5 `FIT-CAP-TOTALITY` (exact structural equality, own mutation red-proof, plus the CAP-01.4/.5/.6 surface-input pins) + `FIT-MANIFEST-BYTE-NEUTRAL` (standing + one-shot sha gate)
- [x] S-001.6 `test/fixtures/red/runner-tripwires/{deny-scan,green,mutants}/`: producing fixtures for all **11** REQ-PRM-01.1 register members (**plan-verify iteration-2 amendment, finding B3, 2026-07-29** — the prior "9 CST-04.2 primitive fixtures" count was stale against PRM-01.2's 11-member bijection; 9 + 1 ≠ 11). Enumerated: `eval`, `Function`, `node:vm`, `node:child_process`, `node:worker_threads`, `WebAssembly` (6 single-fixture CST-04.2 rows, .1/.2/.3/.6/.7/.8) + `Bun.plugin`, `process.binding` (2 more single-fixture CST-04.2 rows, .4/.5 — these 2 plus the prior 6 are the 8 non-member-path-table primitives) + `module.register`, `module.registerHooks` (CST-04.2.9's combined table row splits into 2 DISTINCT fixtures — one per primitive — because PRM-01.2 demands a per-member bijection, not a per-row one) = **10 CST-04.2-style deny fixtures**, one per denied register member, + `createRequire` (**11th member** — NOT a CST-04.2 deny fixture; its producing fixture is the anchor file itself, `single-instance-probe.ts`, proven via REQ-XPO-01 in S-002 — PRM-01.2's fixture-completeness check counts the anchor as createRequire's producing fixture, never a new `deny-scan/` entry). 10 + 1 = 11, matching REQ-PRM-01.1's exact set. Plus mandatory green siblings, `readdir`-enumerated. (`mutants/` directory and its ≤20-mutant budget deferred — see apply-progress; the widening/narrowing/mutation red-proofs landed as in-test simulated mutants instead, per REQ-CAP-01.2/.6/.4.5/.4.8's own scenario wording, which does not itself mandate a committed-mutant-file realisation.)
- [x] S-001.9 `ADMITTED_MEMBER_PATHS` table (30 members — verified count, see apply-progress note on the 28→30 digest-provenance reconciliation) + exact-membership assertion (REQ-CAP-04.6) + red-proof fixtures for `process.dlopen` (REQ-CAP-04.7) and a widening mutant (REQ-CAP-04.8) — **plan-verify iteration-2 amendment, finding A, 2026-07-29**
- [x] S-001.10 Re-run `fit-46`'s publish-gate scenario (REQ-PPI-03.2) against a fixture that fails a REAL Constraint-4 admission check (now that CAP-01..06 exist), re-verifying the S-000 leg's gate-mechanism proof against the admission-specific case the scenario names verbatim — **plan-verify iteration-2 amendment, finding G's S-001 leg, 2026-07-29** — see `specs/publish-pipeline-hardening/spec.md`'s dated note on REQ-PPI-03.2 and S-000.4's citation
- [x] S-001.7 Convert this slice's message assertions to whole-verbatim (REQ-CST-06.1) + add the standing scan forbidding `toContain` on tripwire messages (later slices must not violate it). **COMPLETE (2026-08-04 completion pass, see apply-progress)**: all ~50 pre-existing message-receiver `toContain` sites (`rendered`/`stderr`/`.reason`) across `fit-42-*`/`fit-23-*`/`fit-46-*` converted to whole-verbatim `toBe`; the standing scan (regex-based, receiver-classified so array-membership/raw-content `toContain` stays legitimate) is live across all 4 files with its own red-proof and a false-positive-guard test. **Scope (plan-verify iteration-1 amendment, gap 8)**: the scan is scoped to TRIPWIRE-MESSAGE assertion sites — `test/fitness/fit-42-runner-closure-integrity.test.ts`, `test/fitness/fit-42-runner-closure-integrity.negative.test.ts`, `test/fitness/fit-23-publish-workflow-guard.test.ts`, `test/fitness/fit-46-publish-sequence-integrity.test.ts` (the fit-42/fit-23/fit-46 family this change touches) — NOT repo-wide (a repo-wide scan would flag unrelated `toContain` usage this change has no acceptance criterion over). See "Build Order" below — batch 2 builds SEQUENTIALLY (S-001 → S-003 → S-004, plan-verify
iteration-2 amendment, finding B2), so this scan is already live on the shared `fit-42-*` files
by the time S-003/S-004 touch them.
- [x] S-001.8 Behavioural-survival check: the 6 CST-04.x-family red-proofs of the 18 S-000-tier set (specifier-classification untouched; deny-scan family re-verified through the new path) — same rule identity + exact count, stricter-only. **Red-proof registry source (plan-verify iteration-1 amendment, gap 8)**: the 18 S-000-tier red-proofs are the `it()` blocks nested under the two `describe("FIT-42N S-000 — ...")` blocks in `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` — 7 under `"every static specifier classifies, none is silently skipped"` (the specifier-classification tier) + 11 under `"the deny-scan seals the closure's executed surface"` (the deny-scan tier, the 6 of 18 this task's own acceptance line names). Enumerate with `rg -n 'describe\("FIT-42N S-000' test/fitness/fit-42-runner-closure-integrity.negative.test.ts` to find the two block headers, then read the `it()` titles nested under each span (there is no literal `[red-proof]` bracket tag in the file today — this is the actual, verified enumeration device; design.md §6(a) states the 7+11=18 split this citation matches).

**Plan-verify final batch — reconciliation and clarifications (owner-authorized, 2026-07-29,
closes `verify-plan-3.md` findings B2/B3/B4/B6)**. Additive only; no task text above is
rewritten.

**(B2) S-001.8's "6 CST-04.x-family red-proofs" corrected.** Verified directly against
`test/fitness/fit-42-runner-closure-integrity.negative.test.ts` (`rg -n
'describe\("FIT-42N S-000'` to find the two block headers, then reading every `it()` title
nested under each): the quoted range "#10-#16" spans SEVEN items (10, 11, 12, 13, 14, 15, 16),
not six — Judge B's finding is confirmed. Verification also surfaced a second item the quoted
range itself misses: red-proof #18 (the LAST `it()` in the "the deny-scan seals the closure's
executed surface" block, titled `"REQ-CST-04.2: the closed primitive set — eval, Function,
node:vm, Bun.plugin, process.binding — is denied"`, line 373) is ALSO CST-04.x-family (it
exercises `REQ-CST-04.2` directly) but falls outside #10-#16 — #17 (`REQ-CST-06.1`, line 361)
is the gap between them. The verified CST-04.x-family total among the 18 S-000-tier red-proofs
is therefore **8** (#10-#16 plus #18), not 6 and not 7. Full numbered enumeration, in file order
within the "deny-scan" block (#8-#18, following #1-#7 of the specifier-classification block):

| # | REQ-ID | `it()` title (line) | CST-04.x? |
|---|---|---|---|
| 8 | CST-03.1 | "a dynamic import() outside the sanctioned file is a Constraint-2 violation" (253) | no |
| 9 | CST-03.2 | "a second dynamic import() inside the sanctioned file is a per-site violation" (265) | no |
| 10 | CST-04.1 | "a createRequire call outside the anchored site is a Constraint-4 violation" (274) | yes |
| 11 | CST-04.4 | "the indirect-variable form is caught, not just the direct call" (284) | yes |
| 12 | CST-04.4 | "the namespace form is caught" (291) — design.md's own "red-proof #12" | yes |
| 13 | CST-04.1 | "a second createRequire use inside the anchored file still fails" (308) | yes |
| 14 | CST-04.3 | "an EXECUTING createRequire at the anchor is not exempt" (320) | yes |
| 15 | CST-04.3 | "an ALIASED createRequire import at the anchor forfeits the exemption entirely" (333) | yes |
| 16 | CST-04.3 | "an unaliased decoy alongside an aliased import does not buy the alias an exemption" (347) | yes |
| 17 | CST-06.1 | "a rendered violation names the src file to edit, the rule, and the no-manifest outcome" (361) | no |
| 18 | CST-04.2 | "the closed primitive set — eval, Function, node:vm, Bun.plugin, process.binding — is denied" (373) | yes |

This task's own acceptance line ("same rule identity + exact count, stricter-only") applies to
**8** items: #10, #11, #12, #13, #14, #15, #16, #18. Consequence for S-002.6's own checksum is
corrected in step at S-002.6's task text below — this note is the source correction, S-002.6's
is the propagated one. (Not fixed in this batch, flagged for a future touch: `design.md`'s own
§6(c) — "Six of the 18 (#10–#16, the CST-04.x deny-scan family)" — carries the same
undercount; out of this batch's file scope, which is `slices.md`/`triage.md`/the signed specs
only.)

**(B4) `node:vm` rule identity — single-emit, decided.** `node:vm`'s only surface presence in a
closure file is as an import specifier (`import { Script } from "node:vm"`, per this same
fixture's `p3.js` row and REQ-CST-04.2.3's fixture form) — a `module-specifier` `SurfaceNodeKind`
(design.md §3 Data Model), never a `callee` (no fixture calls anything imported from it). Per
S-001.4's own fold (above), `node:vm` is removed from `classifySpecifier`'s special case and is
NOT added to `ADMITTED_NODE_SURFACES`; a `module-specifier` node whose module is absent from
`ADMITTED_NODE_SURFACES` is classified by the origin-admission leg (REQ-CAP-04) — callee-
decidability (REQ-CAP-03) never applies, because no callee node exists on an import specifier.
**Decision**: `node:vm` therefore produces exactly ONE violation, with rule identity
`constraint-4-inadmissible-origin` (design.md §4 Interface Contracts: "fires on resolved
binding's origin outside the admitted four") — the SAME rule `node:child_process`/
`node:worker_threads`/`WebAssembly`/`module.register`+`registerHooks` fire under. This is a
DELIBERATE rule-identity change, not a survival regression: the pre-redesign fixture at line 373
(item #18 above) currently asserts `{ rule: "constraint-4-execution-primitive", file: "p3.js" }`
for `node:vm`; under the new mechanism that ONE row's expected rule becomes
`constraint-4-inadmissible-origin` (the mechanism producing it changed from a specifier
special-case to generic origin-admission) — the other four rows of the same fixture (`eval`,
`Function`, `Bun.plugin`, `process.binding`) are unaffected by this note; their own rule-identity
survival is governed by S-001.8's general "same rule identity" obligation, not by this node:vm-
specific carve-out. **Consequence for DGN-01.3/PRM-01.2**: the fixture-corpus rule-identity
totality check (REQ-DGN-01.3) declares exactly one `constraint-4-inadmissible-origin` record for
the `node:vm` fixture, never two and never `constraint-4-execution-primitive`; PRM-01.2's
fixture-completeness bijection counts `node:vm`'s producing fixture as satisfying its register-
membership row (REQ-PRM-01.1) while the violation itself is produced and counted by the origin-
admission leg, not by a separate "register lookup" enforcement path — the register (REQ-PRM-01)
is the completeness ledger, origin-admission (REQ-CAP-04) is the sole enforcing mechanism for
this primitive, and the two are non-duplicative by construction.

**(B3) Red-proof tagging convention, decided (must predate the first RED commit).** Verified
against the existing repo convention (`rg -n '\[red-proof\]' test/`): dozens of test files
already use a `[red-proof]` bracket tag in `it()` titles, in two co-existing spellings —
`it("[red-proof] <description>")` (the common form) and `it("REQ-<ID> [red-proof]:
<description>")` (the rarer form, precedented at `test/docs/testing-story-docs.test.ts:122`).
The fit-42 files (`fit-42-runner-closure-integrity.test.ts` / `.negative.test.ts`) carry NEITHER
spelling today — every `it()` title there already begins `REQ-<ID>: <description>` with no
bracket tag at all (verified: zero matches for `[red-proof]` in either file). **Decision**: every
NEW red-proof test landed by this change's slices (S-000 through S-004) titles its `it()` block
exactly `"REQ-<ID> [red-proof]: <description>"` — REQ-ID first (matching the fit-42 files' own
existing prefix convention), `[red-proof]` bracket immediately after (matching the signed spec's
own scenario-heading convention, e.g. "Scenario REQ-CAP-01.2 [red-proof]:", and the rarer of the
two repo-wide spellings already precedented above). This is a NEW-test convention only — it does
not retitle any of the 18 S-000-tier survival red-proofs (S-001.8/S-002.6 above), which carry no
bracket today and gain none; retitling them is not an acceptance criterion of any signed REQ.
**49/49 verification**: the count of `it()` titles matching `REQ-[\w.-]+\.\d+ \[red-proof\]:`
across every test vehicle this change's Test Derivation table (design.md §6) names for a
`[red-proof]`-tagged scenario (the `fit-42-*.test.ts` pair, `fit-23-publish-workflow-guard.
test.ts`, `fit-46-publish-sequence-integrity.test.ts`, `test/docs/runner-integrity-docs.test.ts`,
and `test/conformance/react-conformance.test.ts` where REQ-PPI-04.2 lands) MUST equal 49 — the
signed specs' own red-proof tally (`specs/runner-integrity-manifest/spec.md` +
`specs/publish-pipeline-hardening/spec.md`) — before any slice is considered complete; a
mismatch means a red-proof was landed untagged or a non-red-proof scenario was mistagged. The
tag must be live starting at this change's first red-proof commits (S-000.4/S-000.5).

**(B6) Byte-gate procedure — fresh build required, not a hash of the committed file** (see also
`specs/runner-integrity-manifest/spec.md`'s own dated clarification under REQ-CAP-06.1). The
`FIT-MANIFEST-BYTE-NEUTRAL` gate this task's sibling S-001.5 introduces, and every per-slice
byte-neutrality check thereafter (S-002.7, S-003.5, S-004.7), MUST run as: fresh build of
`dist/` → live closure walk over that fresh `dist/` → regenerate the manifest output from the
walk → compare the regenerated output's sha256 against the pinned digest
`bf6c983c59281eaf91ceefcb363375b52436808bbe74ee5241818f47eccfa530`. Hashing the already-committed
`dist/runner-manifest.json` in place, without a preceding fresh build, proves nothing about
whether the slice's own change perturbed the derivation — it is not a substitute for the
regenerate-and-compare procedure.

---

## S-002: Exemption Proof Obligation — createRequire anchor, forfeit-on-any-other-arrangement

**Scope**: happy-path
**Dimension**: P (Path — exempted-anchor flow vs standard-denial flow)
**Covers**: REQ-XPO-01
**Requires**: S-001 (needs origin admission's `closure-import` leg + the register)
**Test layers**: unit + `.negative.test.ts` red-proofs

**Acceptance**:
- GIVEN the anchor file with exactly one unaliased `createRequire` binding, named-import OR namespace form
- WHEN the file-level exemption proof runs
- THEN it is exempt (XPO-01.1/.2); any other arrangement (aliased, re-export-laundered, anchor drifted out of the closure) forfeits and denies every bound name (XPO-01.3/.4/.5)

### Tasks
- [x] S-002.1 `ExemptionProof` (named-import + namespace form), forfeit rule for aliasing (XPO-01.1/.2/.3). **Genuine gap found during implementation**: S-001's port granted the exemption keyed on whatever LOCAL name the binding used (canonical or aliased alike), so an aliased resolve-only-shaped use was silently admitted through the alias — contradicting this slice's own acceptance criterion ("any other arrangement... forfeits and denies every bound name"). Fixed in `buildFileContext`: the named-import branch now grants `exemption` only when the local binding name is the literal `createRequire`; an aliased name never gets an `ExemptionProof` at all, so every use of it (including resolve-shaped ones) falls through to ordinary origin classification, which denies `createRequire` unconditionally off `node:module` (its admitted-name set there is empty). Red-proof-first: XPO-01.3 written expecting BOTH a resolve-shaped and an execute-shaped aliased use to be denied; ran red (1 violation, not 2) against the S-001 code, confirming the gap; green after the fix.
- [x] S-002.2 Re-export-laundering closure (M1.12) + anchor-drift detection against the derived closure set (M1.13) (XPO-01.4/.5). Both are genuine fixes: (a) `classifyOrigin`'s closure-import branch admitted ANY non-`node:` relative specifier unconditionally, so `export { createRequire } from "node:module"` re-exported through a closure file and imported by a second file bypassed the register entirely — closed by denying a closure-import whose `importedName` is itself a `DENIED_CAPABILITY_PRIMITIVES` member, non-`node:` specifier or not. Genuineness confirmed by temporarily restoring the pre-fix `capability-admission.ts` via `git stash` and re-running the XPO-01.4 red-proof: it failed (0 violations where 1 was expected), proving the hole was real; restored the fix, re-ran, green. (b) `findAnchorDriftViolations` (new export, `derive-runner-closure.ts`) is a POST-WALK-only invariant — `isAnchorFile` can only be true for a node the walk actually reached, so this can never fire from inside a real walk; it exists for `generate-runner-manifest.ts`'s own real-build derivation, never wired into `deriveRunnerClosure` itself (which every synthetic fixture in this suite calls with an unrelated entry file and would otherwise spuriously fail). Wired into `generate()` right after the derivation-violations check; the fresh build after wiring succeeded, proving the real anchor file is genuinely a member of the real closure.
- [ ] S-002.3 Anchor-site code comment cross-referencing REQ-CST-04.4 (synthetic-file scoping) and REQ-XPO-01.2 (real anchor, namespace form green) — spec Open Item 2. **Deferred to archive time, not skipped.** This task's literal text implies editing `src/transport/single-instance-probe.ts`; verified via `tsconfig.build.json`/`tsconfig.json` that neither sets `removeComments` (TS default `false`), so any such edit changes `dist/transport/single-instance-probe.js`'s bytes and breaks this slice's own non-negotiable REQ-CAP-06 byte-neutrality gate (S-002.7, below). `design.md` line 427 independently classifies this exact item ("an explicit code comment at the anchor site cross-referencing REQ-CST-04.4 and REQ-XPO-01.2... spec Open Item 2") as an "archive-time obligation, not a design blocker" — deferring here matches the design's own authoritative classification rather than overriding it. No code or test work is pending from this deferral; it is a documentation-only item explicitly out of scope for a byte-neutral mechanism slice.
- [x] S-002.4 Land XPO-01.2 with existing red-proof #12 green in the SAME commit (DR-6 hazard — different fixtures: non-anchor file stays denied, anchor file's resolve-only namespace form goes green). **Identified (plan-verify iteration-1 amendment, gap 8)**: red-proof #12 is the `it()` block titled `"REQ-CST-04.4: the namespace form is caught"` in `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` (inside the `"the deny-scan seals the closure's executed surface"` describe block) — it plants `import * as m from "node:module"; m.createRequire(anchor)("./x.js");` in a **non-anchor** file and asserts a `constraint-4-execution-primitive` violation. `REQ-XPO-01.2` plants the resolve-only namespace form (`module.createRequire(u).resolve(s)`) at the **anchor path** instead — different fixture, same commit, both green. Both landed in the same commit: #12 (untouched, at its original location) and the new XPO-01.2 test (at the anchor path, a different fixture) both pass.
- [x] S-002.5 Tighten the 2 threshold assertions (`toBeGreaterThanOrEqual`) in the aliasing/decoy forfeiture cases to exact equalities; convert this slice's messages to whole-verbatim (CST-06.1, no new `toContain`). Both tightened to `.toBe(2)` and `.toBe(1)` respectively; no new message assertion in this slice uses `toContain` on a `rendered`/`stderr`/`.reason`/`.message` receiver (standing scan re-run, 6/6 pass).
- [x] S-002.6 Behavioural-survival check: the remaining 10 of 18 S-000-tier red-proofs (specifier-classification block + deny-scan remainder). **Corrected count per the 2026-07-29 plan-verify final batch amendment below (7 specifier-classification + 3 deny-scan remainder = 10, not 12)**: verified all 10 still pass unmodified — they were untouched by S-001/S-003/S-004/S-002's code changes, confirmed by the full fit-42 suite run (221/221 pass) at this slice's close.
- [x] S-002.7 Byte-neutrality gate: `dist/runner-manifest.json` unchanged after this slice (REQ-CAP-06 per-slice gate). Fresh `rm -rf dist && bun run build`: `runner-manifest-sha256: 31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` — unchanged from the pinned digest.

**Plan-verify final batch amendment (owner-authorized, 2026-07-29, finding B2 propagation)** —
S-001.8's own dated correction (above, in S-001's task list) found the verified CST-04.x-family
total to be **8** (#10-#16 plus #18), not 6, which moves this task's (S-002.6's) own checksum.
The deny-scan-tier items NOT claimed by S-001.8 are #8, #9, #17 (3 items, not 5) — `REQ-CST-
03.1`/`.2` (the dynamic-import family) and `REQ-CST-06.1` (the rendered-message assertion).
Corrected total for S-002.6: 7 (specifier-classification block, untouched) + 3 (deny-scan
remainder) = **10**, not 12; 8 (S-001.8) + 10 (S-002.6) = 18 (unchanged). Additive; S-002.6's
own line above is not rewritten.

---

## S-003: Resolution-Based Path Verdicts — bundler disjointness by resolved path, not spelling

**Scope**: happy-path
**Dimension**: D (Data — 5 spelling variants of one flag token)
**Covers**: REQ-PTH-01
**Requires**: nothing (independent file: `scripts/bundler-disjointness.ts`)
**Test layers**: architectural (`FIT-PATH-SPELLING-INVARIANCE`) + unit

**Acceptance**:
- GIVEN each of the 5 confirmed escaping spellings (`.//dist/transport`, `.`, `-odist/…`, `../<pkg>/dist/…`, `--outdir=$VAR`)
- WHEN resolution-based disjointness runs (resolve both paths, test prefix containment, try every candidate flag reading incl. `-o` short form)
- THEN each violates, `=$VAR` as an explicit `unclassifiable-construct`; `dist/bin/pbuilder-codegen.js` still reports zero violations (non-vacuity, PTH-01.6)

### Tasks
- [x] S-003.1 `scripts/bundler-disjointness.ts`: `resolve()`-based verdicts, deterministic cross-product enumerator over the flag/path grammar (ADR-0081)
- [x] S-003.2 `test/support/closure-integrity-checks.ts` becomes a consumer (predicate relocated, placement-not-timing)
- [x] S-003.3 `FIT-PATH-SPELLING-INVARIANCE`, ground-truth oracle = Node's own `resolve`/`relative` semantics (QA TD-9)
- [x] S-003.4 `test/fixtures/red/runner-tripwires/bundler-scripts/`: 5 red fixtures + non-vacuity sibling, `readdir`-enumerated (6th red fixture added for the PTH-01.7 iteration-1 amendment, landed after this task's original text)
- [x] S-003.5 Whole-verbatim messages (CST-06.1, no new `toContain`); byte-neutrality gate holds

---

## S-004: Fail-Closed Generation & Diagnostic/Locale Honesty

**Scope**: happy-path
**Dimension**: R (Rule — exit≠0 ⟺ no manifest, per fault)
**Covers**: REQ-FCG-01, REQ-DGN-01 (.1, .3, .4 — .2 is S-001; .3/.4 added plan-verify iteration-2, finding B), REQ-RMD-05.1 [MODIFIED], REQ-RMD-01.2 [MODIFIED]
**Requires**: nothing (independent file: `generate-runner-manifest.ts`)
**Test layers**: integration (`FIT-FAILCLOSED-BICONDITIONAL`) + unit

**Acceptance**:
- GIVEN a pre-seeded scratch root and ≥3 injected fault kinds (malformed JSON, mid-derivation unreadable, generic throw)
- WHEN the generator runs
- THEN exit≠0 and no manifest exists in every case, and exit=0 with a manifest on the clean path (FCG-01); the version-validation failure gets its own rule, never `unreadable-file` (DGN-01.1); the corpus-wide declared-vs-produced `ViolationRule` multiset is exactly equal, and a rule-swap/misattribution mutant fails naming the mismatch (DGN-01.3/.4, plan-verify iteration-2); the manifest scan matches `runner` only as a path segment (RMD-05.1); no locale-sensitive API exists in the generator's source (RMD-01.2)

### Tasks
- [x] S-004.1 Single fail-closed boundary routing every throw; write-temp-then-rename as the only write path (REQ-FCG-01)
- [x] S-004.2 Version-validation gets `manifest-version-invalid`, its own `ViolationRule` (REQ-DGN-01.1, R2-3)
- [x] S-004.3 `FIT-FAILCLOSED-BICONDITIONAL`: pre-seeded scratch root, ≥3 fault kinds each asserted independently, plus the success case
- [x] S-004.4 `test/fixtures/red/runner-tripwires/fail-closed/` + `test/support/scratch-dir.ts` reuse
- [x] S-004.5 Path-segment-bounded username scan (`runner.js` not a false positive; `dist/runner/notes.js` caught) (REQ-RMD-05.1)
- [x] S-004.6 Source scan for `.localeCompare(`/`Intl.Collator`/`.toLocale{Upper,Lower}Case(` across the generator + transitive helpers (REQ-RMD-01.2)
- [x] S-004.7 Whole-verbatim messages (CST-06.1, no new `toContain`); byte-neutrality gate holds
- [x] S-004.8 Rule-identity totality check: corpus-wide declared-vs-produced `ViolationRule` multiset equality (REQ-DGN-01.3) + rule-renderer-swap/misattribution mutant red-proof (REQ-DGN-01.4) — **plan-verify iteration-2 amendment, finding B, 2026-07-29**. STANDING check (same class as `FIT-CAP-TOTALITY`), not a one-time end-of-slice assertion: it holds over whatever fixture corpus exists on the branch at each commit. S-004 runs last within batch 2 (see "Build Order" below), so S-001/S-003's corpora already exist when this lands; S-002's corpus (batch 3, after S-004) satisfies the check by construction — Strict TDD means every S-002 fixture is built RED-first with its declared rule already correct, so the standing check has nothing to retroactively catch there

---

## S-005: Documentation Counts Derived From Live Derivation

**Scope**: edge-case
**Dimension**: R (Rule — doc promises never exceed what the guard enforces)
**Covers**: REQ-DLV-01
**Requires**: S-001, S-004 (build order: last — lands after ALL enforcement per SC-4; S-002/S-003 land before it too)
**Test layers**: unit (`test/docs/runner-integrity-docs.test.ts`)

**Acceptance**:
- GIVEN `docs/runner-integrity-invariants.md`'s stated closure/file/table counts
- WHEN the doc test runs
- THEN each count is compared against `deriveRunnerClosure`'s LIVE output, never a hardcoded literal; a stale count fails naming the mismatch

### Tasks
- [ ] S-005.1 `test/docs/runner-integrity-docs.test.ts`: counts read from live derivation, frozen literals removed (REQ-DLV-01.1)
- [ ] S-005.2 Stale-count red-proof (REQ-DLV-01.2)
- [ ] S-005.3 `docs/runner-integrity-invariants.md`: Constraint-4 section describes admission, not deny-scan; enumeration promise matches enforcement exactly

---

## Build Order

**Plan-verify iteration-2 amendment (finding B2, 2026-07-29)** — batch 2 is SEQUENTIAL, not
parallel. The iteration-1 "parallelizable" framing was wrong: `design.md` §2 (File Changes) +
§7 (Fitness Functions) show S-001 (`FIT-CAP-TOTALITY`, `FIT-MANIFEST-BYTE-NEUTRAL`), S-003
(`FIT-PATH-SPELLING-INVARIANCE`), and S-004 (`FIT-FAILCLOSED-BICONDITIONAL`) ALL land inside the
SAME two shared files — `test/fitness/fit-42-runner-closure-integrity.test.ts` (S-001's
totality + byte-neutrality tests, S-003's spelling-invariance test) and
`test/fitness/fit-42-runner-closure-integrity.negative.test.ts` (S-001's red-proofs, S-004's
fail-closed-biconditional red-proofs) — this is a real file-level conflict, not merely
S-003/S-004 doing incidental message-conversion work in files S-001 owns. Rejected fix:
"serialize all fit-42-file edits into S-001" — S-003 and S-004 own `FIT-PATH-SPELLING-INVARIANCE`
and `FIT-FAILCLOSED-BICONDITIONAL` per the design's own REQ/fitness-function/slice mapping
(§7, this file's REQ-ID Coverage table); folding their fitness functions into S-001 would
misattribute ownership and blow up S-001's already-largest scope. Chosen fix: **declare batch 2
sequential** — no REQ-level "Requires" edge exists between S-001/S-003/S-004 (each is
independently correct in isolation), so this is an OPERATIONAL git-sequencing constraint to
avoid merge conflicts on shared files, not a logical block.

| Order | Slice(s) | Note |
|---|---|---|
| 1 | S-000 | Ships first, independently mergeable (SC-1) |
| 2a | S-001 | First of batch 2 (sequential) — owns `FIT-CAP-TOTALITY`, `FIT-MANIFEST-BYTE-NEUTRAL`, the admitted/denied tables; establishes the shared `fit-42-*` files' baseline shape |
| 2b | S-003 | Second of batch 2 (sequential) — adds `FIT-PATH-SPELLING-INVARIANCE` to `fit-42-*.test.ts` on top of S-001's landed shape |
| 2c | S-004 | Third of batch 2 (sequential) — adds `FIT-FAILCLOSED-BICONDITIONAL` + the DGN-01.3/.4 rule-identity totality check (S-004.8) to `fit-42-*.negative.test.ts` on top of S-001+S-003's landed shape |
| 3 | S-002 | Requires S-001 (origin admission + register) |
| 4 | S-005 | Last — after every enforcement slice lands (SC-4) |

No REQ-level dependency is introduced by 2a→2b→2c — each slice's own "Requires" line is
unchanged (S-003 and S-004 still say "nothing (independent file)"); this table's ordering is
build-sequencing only, so a future re-plan that resolves the file-sharing (e.g. splitting
`fit-42-*` per-fitness-function) may re-parallelize without a spec or design change.

**Delivery shape (owner ruling, plan-verify iteration-1, 2026-07-29)**: `main` now carries branch
protection (north-star CQ-4, verified live via `gh api`) requiring PR + green required status
check — this is now a repo MECHANISM, not just a plan convention. **S-000 ships as its own PR,
merged FIRST**; the mechanism slices (S-001..S-005) ship on a separate branch with their own PR
at cycle close, not folded into S-000's PR and not merged slice-by-slice. This is DR-1's
mitigation, made concrete: "all mechanism slices landed" (north-star reckoning criterion 10) is
enforced by the archive gate checking that the mechanism-slices PR exists, is merged, and its
outcome-check row is populated — never by inference from S-000 alone having merged.

**Delivery mechanics, orchestrator-ruled (plan-verify iteration-2 amendment, finding B4,
2026-07-29)** — makes the above delivery shape's operational sequence explicit and binding: (1)
the **orchestrator** opens the S-000 PR (house pattern); (2) the mechanism branch (carrying
S-001..S-005) bases off S-000's branch **IMMEDIATELY** at that point — no stall, no wait for
S-000's merge, because S-001 depends on S-000's CONTENT existing on-branch (see S-001's own
"Requires" line above), never on S-000's merge status; (3) once S-000 merges to `main`, exactly
**ONE** rebase/merge of `main` into the mechanism branch follows — not a running rebase habit
throughout batch 2/3/4's build; (4) the **owner** merges both PRs (S-000's and the mechanism
branch's) — the orchestrator never merges either.

**Owner ruling B7 (stacked-PR fallback, 2026-07-29, plan-verify final batch)** — extends the
delivery mechanics above; does not alter the (1)-(4) sequence. If S-000's PR is still unmerged
at cycle close (the mechanism slices finish building before S-000 lands), the mechanism-slices
PR is opened STACKED against S-000's own branch — not against `main` — so the mechanism
branch's diff never spuriously includes files `main` doesn't have yet. Once S-000 merges to
`main`, the mechanism PR's base RETARGETS to `main` (a GitHub base-branch retarget, not a
rebase — distinct from mechanic (3) above, which is the ONE content rebase/merge of `main` into
the mechanism branch after S-000 lands). This is the fallback the delivery-shape ruling's
"S-000 merges easily" assumption did not itself spell out; DR-1's mitigation holds either way,
because the archive gate still checks the mechanism-slices PR merged as its own artefact, never
inferring it from S-000 alone.

**`toContain`-scan ordering vs. batch-2 sequencing (plan-verify iteration-1 amendment, gap 8;
reworded plan-verify iteration-2, finding B2 — batch 2 is now sequential, not parallel, see
above)**: S-001.7's standing scan (forbidding new `toContain` on tripwire-message assertion
sites) is scoped to the fit-42/fit-23/fit-46 family (see S-001.7's own task text above), not
repo-wide. Because S-001 lands FIRST in batch 2 (order 2a) and S-003/S-004 build on top of its
landed shape (orders 2b/2c), the scan is live on the shared files before S-003/S-004 touch them
— S-003 and S-004 each still carry their own "no new `toContain`" acceptance line (S-003.5,
S-004.7) as a redundant, independent guarantee (Strict TDD: whole-verbatim from the first RED
commit), so there is nothing for the now-live scan to retroactively catch.

## REQ-ID Coverage

| Slice | REQ-IDs |
|---|---|
| S-000 | PPI-01, PPI-02, PPI-03, PPI-04, PPI-05 |
| S-001 | CAP-01..06 (incl. .6-.8, plan-verify iteration-2), PRM-01, CST-04.2, CST-04.3, CST-06.1, DGN-01(.2) |
| S-002 | XPO-01 |
| S-003 | PTH-01 |
| S-004 | FCG-01, DGN-01(.1, .3, .4 — .3/.4 plan-verify iteration-2), RMD-05.1, RMD-01.2 |
| S-005 | DLV-01 |

**Coverage: 22/22 REQ-IDs · 77/77 scenarios · 49/49 red-proofs** (plan-verify iteration-2
amendment, 2026-07-29: `REQ-CAP-04.6-.8` + `REQ-DGN-01.3-.4`, +5 scenarios/+3 red-proofs over
the 72/46 iteration-1 baseline — see `specs/runner-integrity-manifest/spec.md`'s own tally
note; iteration-1 amendment, 2026-07-29: `REQ-CAP-01.4-.7` + `REQ-PTH-01.7`, +5 scenarios/+2
red-proofs over the 67/44 post-CQ-1 baseline). Budget: 4/4 fitness functions (`FIT-CAP-TOTALITY`,
`FIT-MANIFEST-BYTE-NEUTRAL` in S-001; `FIT-PATH-SPELLING-INVARIANCE` in S-003;
`FIT-FAILCLOSED-BICONDITIONAL` in S-004), 3/3 ADRs (0079+0080 in S-001, 0081 in S-003), ≤20
committed mutants (S-001).

## Excluded / Archive-Sync Ledger

**Full 23-row disposition mapping (plan-verify iteration-2 amendment, finding C, 2026-07-29)** —
closes `verify-plan-2.md` finding C: the mapping now lives IN the plan set (this table), not
only referenced from `propose-council.md`. Source: `openspec/pending-changes.md` §"From
`runner-integrity-manifest` archive (2026-07-25)" (the 23-row register this change re-audits,
per `triage.md` in_scope item 3) plus the disposition reasoning drafted in `propose-council.md`
§"BA lens" ("Disposition divergences vs explore.md"). Dispositions below are the plan's own
determination, built by tracing each register row against this change's signed REQ-IDs and
slices — **archive RE-VERIFIES this table against the built code, it does not draft it fresh**.
22 of 23 rows are decidable now from the signed spec/design/slices; 1 row (`Architecture
baseline refresh`) is process-dependent on a post-verify hook outcome and is marked
`archive-verifies` rather than pre-assigned.

| Row | Disposition | Evidence |
|---|---|---|
| **Meta-finding** (Constraint 4 wants a structural invariant, not a shape scanner) | `CLOSED-BY-MECHANISM` | This change's entire raison d'être: ADR-0079 (design.md §5) replaces the deny-scan with the capability-admission property; slices S-001..S-004 realise it |
| **R2-3** (version-failure reuses `unreadable-file` rule) | `CLOSED-BY-FIX` | `REQ-DGN-01.1`, slice `S-004` (S-004.2) |
| **R2-4** (malformed `package.json` fails OPEN, stale manifest) | `CLOSED-BY-FIX` | `REQ-FCG-01.1`, slice `S-004` (S-004.1) |
| **R2-5** (false positive on `module.createRequire(u).resolve(s)`) | `CLOSED-BY-FIX` | `REQ-XPO-01.2`, slice `S-002` (S-002.1) |
| **R2-6** (path-spelling disjointness escapes) | `CLOSED-BY-FIX` — the five confirmed spellings (M3.1-M3.5) only; M3.6 is a distinct surface, see below | `REQ-PTH-01.1-.7`, slice `S-003`; scope clarified by this change's own `REQ-PTH-01` dated note (finding H, `specs/runner-integrity-manifest/spec.md`) |
| **R1-5** (post-derivation throw leaves stale manifest) | `CLOSED-BY-FIX` | `REQ-FCG-01.3`, slice `S-004` (S-004.1) |
| **R1-6** (`writeFileSync` not atomic) | `CLOSED-BY-FIX` | `REQ-FCG-01.2`, slice `S-004` (S-004.1, write-temp-then-rename) |
| **R1-7** (computed member access, `globalThis["eval"]`) | `CLOSED-BY-MECHANISM` — subsumed by REQ-CAP-03 | `REQ-CAP-03.1`'s exact fixture (`globalThis["ev"+"al"]("1+1")`) is D-1's worked example (design.md §1): the callee-decidability leg denies it as a callee, the SAME shape R1-7 names, regardless of whether the base is computed. Slice `S-001` |
| **R1-8** (directory specifier misdiagnosed as `unreadable-file`) | `CLOSED-BY-FIX` | `REQ-DGN-01.2`, slice `S-001` (S-001.4) |
| **R1-9** (BOM non-vacuity guard `> 0` vs `=== N`) | `OUT-WITH-REASON` — stays registered | Independent test-quality row on the BOM-specific non-vacuity guard (`fit-42-*` positive file); not touched by the Constraint-4 redesign (`REQ-CST-04.3.2` fixes a DIFFERENT non-vacuity guard's AST-vs-substring defect) and not in this change's REQ set. No REQ covers it; next `fit-42` touch per its own registered row |
| **R1-10** (CST-04.3 non-vacuity counts substrings, incl. comments) | `CLOSED-BY-FIX` | `REQ-CST-04.3.2` [MODIFIED], slice `S-001` (AST-counted, not substring-counted) |
| **R1-11** (docs hardcode 23/24 counts as prose) | `CLOSED-BY-FIX` | `REQ-DLV-01`, slice `S-005` |
| **R1-12** (`BPI-04.1` mutates real `dist/` mid-suite) | `OUT-WITH-REASON` — stays registered | Test-isolation defect in an existing test's fixture strategy, orthogonal to the capability-admission/exemption/path/fail-closed/diagnostic REQ families this change ships. No REQ covers it; next `fit-42` touch per its own registered row |
| **R1-13** (`publishRunSteps` treats declaration order as execution order) | `CLOSED-BY-FIX` | `REQ-PPI-05`, slice `S-000` (S-000.1) |
| **R1-14** (symlink-escape check not applied to the entry file) | `OUT-WITH-REASON` — re-registered fresh at archive | Explicitly `out_of_scope` (`triage.md` bullet "Loader observation for Constraint 1" boundary; this change's Scope Amendment finding E draws the static-denial-vs-loader-observation line). No REQ in either signed spec touches entry-file symlink containment |
| **R1-15** (`node:`-prefixed specifiers not validated against `builtinModules`) | `CLOSED-BY-FIX` | `REQ-CAP-04.3`, slice `S-001` (S-001.4) |
| **R1-16** (JSDoc identifiers included in the descendant walk) | `CLOSED-BY-MECHANISM` | `REQ-CAP-01.7` (exclusion E1, RCD-03.3 non-flagged scenario), slice `S-001` (S-001.4); design.md §1 "R1-16 probe result" |
| **R1-17** (bare `Function` ban rejects ordinary JS) | `CLOSED-BY-MECHANISM` | `REQ-CAP-05.1/.2/.3`, slice `S-001` (S-001.2) |
| **R1-18** (`srcPathFor`/`srcOf` extension rewrite lowercase-only) | `OUT-WITH-REASON` — stays registered | Case-sensitivity bugfix unrelated to any Constraint-4 guard-class mechanism; no REQ in either signed spec touches `srcPathFor`/`srcOf`. Next touch of either function per its own registered row |
| **Architecture baseline refresh** (`ts-morph` third importer) | `archive-verifies` — not pre-assigned | design.md §10: `architecture_impact: additive` prompts (does not mandate) a refresh via the `arch_refresh_post_verify` hook; disposition depends on that hook's outcome at archive time, not decidable from the signed plan alone |
| **`node:vm` altitude fold** (two mechanisms enforce one invariant) | `CLOSED-BY-MECHANISM` | `S-001.4`'s explicit fold: `node:vm` ceases to be `classifySpecifier`'s special case, governed by the generic `REQ-CAP-04` origin-admission rule while remaining a `REQ-PRM-01.1` register member with its own fixture |
| **`react-conformance.test.ts` declares no timeout** | `CLOSED-BY-FIX` | `REQ-PPI-04.1/.2`, slice `S-000` (S-000.3/S-000.4); pulled in-scope by ruling 6 (`triage.md` Scope Amendment finding F) |
| **Two spec-wording deviations** (`REQ-RMD-05.1` username-substring, `REQ-RMD-01.2` locale scenario) | `CLOSED-BY-FIX` | `REQ-RMD-05.1` [MODIFIED] + `REQ-RMD-01.2` [MODIFIED], slice `S-004` (S-004.5/S-004.6) |

Row-count check: 23 register rows in → 23 dispositions out — 5 `CLOSED-BY-MECHANISM` (meta-
finding, R1-7, R1-16, R1-17, `node:vm` fold) + 13 `CLOSED-BY-FIX` (R2-3, R2-4, R2-5, R2-6, R1-5,
R1-6, R1-8, R1-10, R1-11, R1-13, R1-15, react-conformance timeout, two spec-wording deviations)
+ 4 `OUT-WITH-REASON` (R1-9, R1-12, R1-14, R1-18) + 1 `archive-verifies` (architecture baseline
refresh) = 23, zero silently dropped, zero `RE-REGISTERED` this cycle — satisfies `triage.md`
Scope Amendment (c)'s acceptance criterion ("row-count delta fully explained"). `sdd-archive`
re-verifies each row against the actually-built/actually-merged code before writing this table
into `openspec/pending-changes.md`'s next revision; it does not originate dispositions the plan
has not already reasoned through.

Deferred to `sdd-archive`, never a slice task (per spec Open Items + proposal):
- **Writing the 23-row disposition table into `openspec/pending-changes.md` itself** + 3 owed registrations (0.1.0-must-ship-manifest, integrity-mismatch diagnostic, M3.6) — spec Open Item 3: "PM/archive-gate mechanical check, not a spec REQ." The table above is the plan-time mapping this write re-verifies and transcribes, not a fresh draft.
- **`openspec/specs/{runner-integrity-manifest,publish-pipeline-hardening}/spec.md` delta sync** — archive-time sync of the signed delta into main specs.
- **Tech-writer pass**: REQ-CST-04.1's rationale sentence, REQ-CAP-02.2's scenario title — spec Open Item 1 (rationale prose, not normative).
- **R1-14** (entry-file symlink containment) and **M3.6** (script-chaining) — explicitly OUT of scope; re-registered as fresh dated debt rows at archive, not built here.
- **Branch protection on `main`** — already CLOSED by owner action (north-star CQ-4, verified live via `gh api` 2026-07-29); no slice needed, REQ-PPI-03 is load-bearing in full from S-000.
- **Deferred fitness functions** (`FIT-CAP-ORACLE`, `FIT-NO-CHECKER-IN-BUILD`, `FIT-SINGLE-PREDICATE`, `FIT-RULE-REACHABILITY`, `FIT-BASELINE-NOT-SELF-HEALING`) — registered followups with re-open triggers, not built (budget gate).

## Identifier Glossary

**Added plan-verify iteration-1, gap 8, 2026-07-29** — closes `verify-plan-1.md` finding #8
("identifier namespaces resolvability from the executor surface unclear"). Every identifier
namespace used across this change's slices resolves to an in-folder artefact, readable at
build time without leaving `openspec/changes/runner-tripwire-invariants/`:

| Namespace | Meaning | Source |
|---|---|---|
| `R1-x`, `R2-x` | Round-1 / Round-2 judgment-day findings from the parent `runner-integrity-manifest` cycle | `openspec/pending-changes.md` §"From `runner-integrity-manifest` archive (2026-07-25)" (the live register rows this change re-audits) + `openspec/changes/archive/2026-07-25-runner-integrity-manifest/judgment-day.md` (the full Round 1/2 judge tables, verified present) |
| `M1.x`, `M2.x`, `M3.x` | Mutant classes / confirmed-live-escape probes from the QA lens | `explore-council.md` §"QA lens — position" (mutant classes, confirmed live escapes) |
| `TD-x` | Test-derivation device IDs (e.g. TD-9's cross-product spelling enumerator) | `explore-council.md` §"QA lens — position" ("Test-derivation rows demanded in design") |
| `D-1`, `D-2`, `D-3` | The three design findings resolving computed-access, reassignment-precondition, and origin-taint questions | `design.md` §1, "Three design findings that the spec's own text resolves" |
| `E1`–`E4` | The four surface exclusions (JSDoc-rooted, declaration-name, property-name, type-position) | `design.md` §1, "Surface exclusions are claims, not pass paths" table |
| Admitted tables (`ADMITTED_GLOBALS`, `ADMITTED_NODE_SURFACES`, `DENIED_CAPABILITY_PRIMITIVES`) | The three closed tables the mechanism pins by exact membership | `design.md` §3, "Data Model" (`scripts/capability-admission.ts` block) |
| `DR-x` | Drift risks — build-time watch items | `north-star.md` §7, "Drift risks — build-time watch items" |
| `SC-x` | Success criteria / slicing constraints (e.g. SC-1 override note, SC-2 hazard, SC-3 binding, SC-4 ordering) | `proposal.md` (success criteria numbering) — cross-referenced inline in this file's own slice headers and the SC-1 override note above |
| `CQ-x` | Conscience questions the steward foresight gate raised and the owner ratified | `north-star.md` §5, "Conscience questions" + §"Foresight ratification (2026-07-29)" |
| `W1`/`W1′`, `W2`, `W3`, `W4` | Trust-chain findings from the security lens (publish-sequencing, publish-test-gate, TCB, inclusion-list limits) | `explore-council.md` §"Security lens — threat model + trust chain" ("Trust-chain findings") |
| `P1`–`P5` | Load-bearing invariants the security lens named | `explore-council.md` §"Security lens — threat model + trust chain" ("Load-bearing invariants") |
| Ruling 1–8 (explore→propose gate), rulings issued at propose gate (second batch) | Owner rulings, binding on all downstream phases | `explore-council.md` §"Owner rulings at the explore→propose gate" + §"Owner rulings at the propose gate" |

## Skeleton Rationale

Walking-skeleton semantics are split across two slices by binding design constraint: **S-000** is the conventional "thinnest E2E path" skeleton, but scoped to the publish-path family (SC-1) specifically because it has zero dependency on the mechanism redesign and must be independently mergeable first. **S-001** carries the mechanism's own skeleton property — enumerate/classify live and green on the real 23-file closure, `FIT-CAP-TOTALITY` asserting structural totality from day one — because SC-3 forbids separating the admission property from its totality proof (a property without totality is a label, not a guarantee).

## Risks

- **DR-1 (sharpest, north-star)**: S-000 merges easily; mechanism slices (S-001..S-005) must NOT stall as debt the way the parent cycle's PR #51 did. "All mechanism slices landed" is a delivery criterion, not an aspiration. **Owner ruling baked in (2026-07-29)**: mitigated concretely by the delivery-shape ruling above (S-000's own PR merged first; mechanism slices ship as a SEPARATE PR at cycle close) plus an archive outcome-check row confirming the mechanism-slices PR merged, not just S-000's.
- **DR-5/DR-2 — SUPERSEDED by owner ruling (2026-07-29): growth protocol is FORBIDDEN-IN-BUILD, not "named-commit-justification."** `ADMITTED_GLOBALS`/`ADMITTED_NODE_SURFACES` or the E1-E4 exclusions growing during build to make a red test green is the rubber-stamp regression path. DR-5's original wording ("any growth needs a named commit justification") is DEAD — a commit message alone cannot authorize widening a pinned admitted table or exclusion mid-build. The owner ruling: **a red test fixable only by widening an admitted table or an E1-E4 exclusion is a HALT, not a build decision** — surface it to the owner, who decides the micro-unfreeze of the pinned counts (the same pattern as this change's own CQ-1 amendment: a scenario addition against a signed spec, owner-authorized, dated, additive). CAP-01.4/.5/.6 and CAP-04.4/.5 make any silent growth fail loudly; this ruling governs what happens AFTER it fails loudly.
- **DR-6**: XPO-01.2 must land with red-proof #12 still green in the same commit (S-002.4) — the highest-probability regression named by design. See S-002.4's own task text (plan-verify iteration-1 amendment) for the exact describe-block/fixture identification.
- **Byte-neutrality (REQ-CAP-06) — CHANGE-CONTROL, not correctness-only (owner ruling baked in, 2026-07-29).** A blocking per-mechanism-slice gate (S-001..S-004): a mismatch is a HALT, surfaced to the owner with the byte diff and its cause. The owner then either (a) ratifies a new pinned digest — at which point this change becomes cross-repo and requires an engine handoff (per the parent cycle's 4MiB-seam precedent) — or (b) rejects the diff as an implementation defect, sending the offending slice back to green-without-touching-`dist/`. Nobody re-pins the hash unilaterally; the gate is a decision point, never a rubber-stamp-and-continue.
- S-005's `Requires` lists S-001/S-004 only (≤2, avoiding high-coupling); build order still places it after S-002/S-003 per SC-4 — this is a sequencing note, not a formal blocking edge, and must not be silently reordered.

## Next Recommended

`sdd-verify --mode=plan` (L, two blind judges in parallel).
