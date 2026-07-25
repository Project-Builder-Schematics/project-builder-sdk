# Verify In-Loop 3 — runner-integrity-manifest (S-002)

**Mode**: in-loop (Strict TDD) · **Iteration**: 1/1 so far (new loop) · **Scope**: S-002
**Delta**: `3c4edf8`, `ec4b2c9`, `998d47c` (`git diff bf2f1ad..HEAD`); `a8e0f34` (state-only, ignored per instruction)

---

## Execution Evidence

| Check | Command | Result |
|---|---|---|
| Full suite (captured to file first) | `bun test 2>&1 \| tail -8 > /tmp/verify-s002-fullsuite-run1.log` | `2237 pass / 0 fail`, `4936 expect() calls`, 194 files, `[68.71s]` — matches the orchestrator's reported figure exactly. No failure observed; nothing to re-run. |
| Delta files only | `bun test` (fit-42 + fit-42.negative + build-config + fit-23) | `105 pass / 0 fail`, `160 expect() calls` |
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| `skipIf(uid 0)` — RCD-03.5 | `bun test test/fitness/fit-42-runner-closure-integrity.negative.test.ts -t "RCD-03.5"` (real uid: `id -u` → `1000`) | `2 pass, 38 filtered out, 0 fail, 3 expect() calls` — genuinely executing, not skipped |
| `skipIf(uid 0)` — BPI-02.2 | `bun test test/fitness/fit-42-runner-closure-integrity.test.ts -t "BPI-02.2"` | `1 pass, 33 filtered out, 0 fail, 2 expect() calls` — matches apply-progress's own claim exactly |
| Known-answer digests | `printf '' \| sha256sum` / `printf '\n' \| sha256sum` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` / `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` — both match the test's pinned constants exactly, independently of the test file |
| `src/**` + `scripts/**` diff | `git diff bf2f1ad..HEAD -- src/ scripts/` | 0 lines |
| Real `publish.yml` vs. `checkPublishOrdering` | read `.github/workflows/publish.yml` and `package.json#scripts.prepublishOnly` directly | Build (line 48) precedes version stamp (line 53); the actual publish command is `npm publish --tag dev --provenance --access public --dry-run` (no `--ignore-scripts`); `prepublishOnly` = `"bun run build"` — independently confirms the test's claim that the property holds **via prepublishOnly**, not step order |
| Real `.gitattributes` vs. `outOfScopeTextOptOuts` | read `.gitattributes` directly | `* eol=lf` present; the one `-text` line is `test/dialects/typescript/golden/*crlf*.txt -text` — correctly excluded by the `test/dialects/` prefix filter |
| Linter | n/a | Not available |

## Spec Compliance — S-002 scope only

| Capability closed | Evidence |
|---|---|
| RCD-01, 02, 03, 04, 05 | fit-42 + fit-42N S-002 blocks; RCD-05 already proven S-000 |
| RME-01..05 | fit-42 S-002 "shape, exclusions, hygiene, ordering" block; RME-02.2 independently verified |
| RMD-01, 02, 03, 04, 05 | fit-42 S-002 determinism/byte-hygiene/tamper blocks; RMD-01.2 owner-ruled satisfied-in-intent (not re-litigated, see below) |
| BPI-02, 03 | fit-42 S-002 atomicity block (direct generator invocation confirmed); fit-23 S-002 block (verified against real `publish.yml`) |
| RMD-03.3 (`.gitattributes` scope) | build-config S-002 block, verified against real `.gitattributes` |

## S-002 Acceptance Criteria (all 18)

| # | Criterion | Independently verified? | Result |
|---|---|---|---|
| 1 | RCD-01.1 closure == baseline node set | Yes — read test + code; baseline byte-identity to a fresh derivation was independently confirmed in my S-001 pass, so this comparison's premise holds | PASS |
| 2 | RCD-01.3/01.4 cycle/zero-import | Yes — read the two new negative tests, ran them | PASS |
| 3 | RCD-02.3 `.mjs` followed | Yes — read test, ran it | PASS |
| 4 | RCD-03.1/02/04/05 name the right facts | Yes — read all four negative tests; independently confirmed `skipIf(uid 0)` genuinely executes | PASS |
| 5 | RCD-04.1 builtins == baseline row | Yes — read code, confirmed comparison is against `baseline.builtins`, never a literal array | PASS |
| 6 | RCD-05.1 symlink escape | Already proven by S-000 (confirmed in my S-000 pass); not duplicated here, correctly | PASS (S-000) |
| 7 | RME-01.3 exact key sets | Yes — read test, ran it | PASS |
| 8 | RME-02.2 known-answer vectors | Yes — **independently recomputed both vectors with `sha256sum`**, exact match | PASS |
| 9 | RME-03.1/04.1/05.1 | Yes — read tests, ran them (see Assertion Quality Audit for a vacuity nuance found) | PASS |
| 10 | RMD-01.1 / RMD-01.2 | RMD-01.1: read + ran, PASS. RMD-01.2: **owner-ruled satisfied-in-intent — not re-litigated.** Confirmed the retained test's residual claim is accurate (see below) | PASS (per ruling) |
| 11 | RMD-02.1 spaced + non-ASCII root | Yes — read test, confirmed explicit precondition assertions (`toMatch(/ /)`, `toMatch(/[^\x20-\x7e]/)`), ran it | PASS |
| 12 | RMD-03.2/03.4 | Yes — read the checker functions byte-by-byte (`CR=0x0d`/`LF=0x0a` pair scan, `BOM=[0xef,0xbb,0xbf]` prefix), read the Tier-B non-vacuity guards, ran everything | PASS |
| 13 | RMD-04.1 tamper localisation | Yes — read test, confirmed it operates on `copiedPackageRoot()` (sourced from the `beforeAll` snapshot), never the real `dist/`; ran it | PASS |
| 14 | RMD-05.1 no cwd/username | Yes — read test, ran it | PASS |
| 15 | BPI-02.1 fail-closed, prior manifest | Yes — confirmed `runGenerator()` spawns `scripts/generate-runner-manifest.ts` **directly**, never `bun run build`; ran it | PASS |
| 16 | BPI-02.2 unreadable file, no file at all | Yes — same direct-invocation pattern confirmed; `skipIf(uid 0)` independently re-run (`1 pass / 2 expect()`, matches claim) | PASS |
| 17 | BPI-03.1 publish ordering | Yes — **independently verified against the real committed `publish.yml` and `package.json`**, not just the test's own fixtures | PASS |
| 18 | RMD-03.3 `.gitattributes` scope | Yes — **independently verified against the real committed `.gitattributes`** | PASS |

### On the "already settled" item (RMD-01.2)

Confirmed the retained test still has genuine, accurately-scoped residual value. It runs the generator in **two separate child processes** (not two in-process calls) with `LC_ALL` varied between them and asserts byte-for-byte agreement — this is strictly broader than RMD-01.1 (same env, two child processes) in one specific dimension: it proves the generator's output is stable across **any** value of `LC_ALL`/`LANG`/`LC_COLLATE`, not merely across repeated runs. That is a real property (it would catch a future regression where the generator read any of those env vars for *any* purpose, not just locale-aware sorting — e.g. a hypothetical `toLocaleDateString()` call, which Bun's `Intl.DateTimeFormat` *does* respect even though `Intl.Collator` does not). The inline comment explicitly disclaims the one thing it does **not** prove ("NOT that a `localeCompare` implementation would be caught... The assertion that actually kills `localeCompare` is REQ-RME-05.2's pinned pairs") — this is accurate, not overstated. `apply-progress.md`'s Halt section makes the identical claim in the same words. No overstatement found anywhere in the artefact.

## TDD Cycle Audit (delta)

S-002 adds no production code (`src/**` and `scripts/**` confirmed zero-diff), so most rows are disclosed as green-on-arrival because they exercise already-correct S-000 logic with new scenario classes — this is legitimate by construction (you cannot RED-drive an assertion against code that's already complete, and the signed slice plan explicitly designed S-002 as "complete the scenario matrix against S-000's already-correct implementation"). Three checkers (`findPathHygieneViolations`, `findCrlfOffenders`, `findBomOffenders`) did go through genuine RED-GREEN, confirmed by the quoted RED evidence being a real `not implemented` throw (and, for the path-hygiene checker, a documented wrong-reason-then-right-reason correction — itself a sign of real, not fabricated, RED discipline).

**Targeted check 8 finding — two rows are NOT the same category as the rest.** `checkPublishOrdering` (plus its helpers `classifyPublishStep`, `publishRunSteps`, `prepublishRebuilds`) and `parseGitAttributes`/`outOfScopeTextOptOuts` are **brand-new test-side logic** — not assertions against already-existing S-000 production code, and not thin wrappers. Both are disclosed as having **no RED at all** ("written after `checkPublishOrdering`"; "the committed file already complies"). Unlike the three shared checkers in `closure-integrity-checks.ts` (same slice, same kind of new logic, genuine RED-GREEN), a driving RED was clearly possible here too — `checkPublishOrdering` has real conditional/branching logic (four step kinds, an ordering check, a `prepublishOnly` exception) that is exactly the shape Strict TDD's Triangulation Audit calls out as needing to be **driven**, not validated after the fact. The mitigation offered — four (respectively one) red-proof mutation tests written afterward — does provide genuine, verified discrimination (I confirmed each red-proof actually flips the result by reading the logic), which is real value and better than nothing, but it is post-hoc mutation coverage, not TDD. **This is a real, disclosed process deviation, not a violation dressed as honesty** — the report doesn't claim RED where none occurred — but it is inconsistent with the discipline shown three rows above it in the same table for functions of the same shape. Rated WARNING, not CRITICAL: none of `strict-tdd-verify.md`'s in-loop halt conditions technically fire (there is no triangulation gap — coverage is thorough now — and no banned pattern), so this does not block the slice, but it is worth naming precisely rather than folding into the "S-002 adds no production code" umbrella that covers the *other* twelve rows legitimately.

**Regression check**: all previously-passing tests still pass (2237/0, +41 vs S-001, matches `git diff --numstat` implied test-count growth).

## Assertion Quality Audit (delta)

No banned patterns (`toBeDefined`, `toBeTruthy`/`toBeFalsy` without context, `objectContaining` as the whole assertion, `not.toThrow()` alone, snapshot-only, structure-mirroring mocks, private-state tests) found across the five changed files. The "multiple assertions" cases found (e.g. RMD-02.1's precondition + behaviour pair, BPI-02.1's before/after pair) are coherent single-scenario assertions, not unrelated batches — legitimate.

**Targeted check 7 — vacuity sweep, confirmed AND extended.** All four self-declared hardening guards are present and correct, verified by reading the code directly:
- CRLF check: `expect(emitted.length).toBe(23)` before `findCrlfOffenders(...)`.
- BOM check: `expect(files.filter(({path}) => path.startsWith("src/")).length).toBeGreaterThan(0)`.
- Spaced-root test: `expect(root).toMatch(/ /); expect(root).toMatch(/[^\x20-\x7e]/);` before running the generator.
- Both `skipIf(uid 0)` tests: independently re-confirmed executing (not skipped) via direct `-t` filter runs above.

**Found, as asked: the ones it missed.** The new **"the manifest's shape, exclusions, hygiene and ordering"** `describe` block (RCD-01.1, RCD-04.1, RME-01.3's per-record half, RME-03.1, RME-04.1, RME-05.1 — six tests) all follow an "offenders array must be `[]`" or "sets must be equal" shape that is the **same theoretical vacuity risk** the executor hardened elsewhere: if `manifest.files` or the derived closure were somehow empty, most of these would pass trivially (`[].filter(...) === []`, `[].sort() === [].sort()`). None of these six carries its own explicit non-emptiness guard the way the CRLF/BOM checks do. In practice this is low-severity, not a live gap: `manifest.files.length === 24` and `deriveRunnerClosure(...).nodes.length === 23` are both independently pinned by **sibling S-000 tests in the same file**, which run in the same `beforeAll`-scoped suite — so a regression that hollowed out `manifest.files` would already be caught elsewhere in the same run before these six tests could false-pass unnoticed. Still, the self-audit's "vacuity sweep" claim ("four passes... hardened... then look for the ones it missed" is literally the orchestrator's framing back to me) is **not as complete as its framing implies** — it swept the newly-introduced Tier-B byte/path checks but not the newly-introduced Tier-B shape/exclusion checks, which share the identical risk shape. Rated SUGGESTION (sibling-test safety net makes this genuinely low-risk, not WARNING).

## Targeted Checks (the nine requested)

| # | Check | Finding |
|---|---|---|
| 1 | Five copied-root cases + `beforeAll` pristine snapshot | **Confirmed real.** Read the diff directly: `beforeAll` now does `pristineRoot = mkdtempSync(...)`, `cpSync(distDir, join(pristineRoot,"dist"))`, `cpSync(package.json → pristineRoot)`, immediately after `ensureTscBuild()`+`manifestRaw` read — same moment already trusted for `manifestRaw`, no new risk window introduced. All copied-root tests (`copyPackageRootTo`/`copiedPackageRoot`, used by RMD-01.1, RMD-01.2, RMD-02.1, RMD-04.1, BPI-02.1, BPI-02.2 — six call sites, not five, but same claim) now read exclusively from `pristineRoot`, never `distDir` directly, confirmed by tracing every call site. **One nuance the self-audit did not disclose**: two of the new S-002 `describe` blocks — "the manifest agrees with the committed baseline" (RCD-01.1, RCD-04.1) and "the closure's own bytes are line-ending and BOM clean" (RMD-03.2, RMD-03.4) — call `deriveRunnerClosure(distDir, ...)` or read `distDir` files **directly at body time**, not through `pristineRoot`. These are read-only (no mutation), same risk class as the pre-existing S-000/S-001 pattern the audit explicitly calls "residual... predates this slice" — but these four tests are **new in S-002**, not predating it, so characterizing the residual exposure as entirely inherited is imprecise. Not a functional defect (read-only access to a resource `ensureTscBuild()` already resolved is the established, accepted pattern throughout this change), but worth naming precisely. |
| 2 | RMD-04.1 (RP-1) runs on a copy | **Confirmed.** `copiedPackageRoot()` → `pristineRoot` copy → `appendFileSync(join(root, "dist/core/session.js"), "\n")` — `root` is a fresh `scratchDirFactory()` temp dir, never the real `dist/`. Assertion checks length unchanged, path order unchanged, exactly one digest changed (`dist/core/session.js`). Read and confirmed correct. |
| 3 | BPI-02.1/02.2 invoke the generator directly | **Confirmed both.** `runGenerator()` is `spawnSync("bun", ["scripts/generate-runner-manifest.ts", root], ...)` — never `bun run build`. BPI-02.1's "manifest asserted present" and BPI-02.2's "manifest removed first" are both real `existsSync`/`rmSync` calls in the test body, not inferred — read directly. |
| 4 | Both `skipIf(uid 0)` tests actually execute | **Independently re-confirmed**, not taken on the apply-progress's word: `id -u` → `1000`; `-t "RCD-03.5"` → 2 pass, 3 expect(); `-t "BPI-02.2"` → 1 pass, 2 expect() (exact match to the claimed count). Neither silently skipped. |
| 5 | RCD-04.1 compares against the baseline's `builtins` row | **Confirmed**, not a literal. `deriveRunnerClosure(...).builtins` vs `JSON.parse(readFileSync(BASELINE_PATH,...)).builtins` — read directly, no hard-coded array anywhere in this test. |
| 6 | `test/support/closure-integrity-checks.ts` outside design §2, FIT-27 reasoning | **Both confirmed independently.** Read design.md §2's full 18-row table directly — no entry for this file, and no mention of it anywhere in design.md. Read `fit-42-anti-tautology-scan.test.ts` — wait, `fit-27-anti-tautology-scan.test.ts` — directly: its entries are "every `.ts` file under `test/e2e/` and `test/support/`," so the new module genuinely is a new entry point for that walk, and it is confirmed dependency-free (zero `import` statements) and writes nothing (no `fs` write calls) — it cannot trigger FIT-27's corpus-write rule or extend reachability to `regen-corpus.ts`. The FIT-40 precedent is also confirmed real: `fit-40-conformance-corpus-integrity.test.ts`/`.negative.test.ts` share `test/support/conformance-fixture-loader.ts` in the identical positive/negative-share-one-module shape. Both claims check out; the deviation is sound. |
| 7 | Self-declared vacuity sweep | **Confirmed present and correct for the four claimed guards; six additional same-shaped assertions were not swept** — see Assertion Quality Audit above. |
| 8 | TDD evidence table mostly green-on-arrival — honest or not | **Mostly honest; two rows are a genuine, disclosed process gap** — see TDD Cycle Audit above (`checkPublishOrdering` and the `.gitattributes` parse helpers had no driving RED where one was clearly possible, unlike the three shared checkers in the same slice). |
| 9 | `src/**` and `scripts/**` zero diff | **Confirmed independently.** `git diff bf2f1ad..HEAD -- src/ scripts/` → 0 lines. |

## Flake

**My own run was clean** (`2237 pass / 0 fail`, captured to `/tmp/verify-s002-fullsuite-run1.log` *before* checking the result, per the standing instruction — nothing to report from this run, no failure to investigate).

On the two specific questions asked:

**(a) Does anything in this delta plausibly contribute?** Yes, in the form the executor itself already identified, and I independently traced the mechanism rather than accepting the claim: before the snapshot fix, this slice's five/six copied-root tests each did their own `cpSync` from the live `distDir` at test-**body** time, scattered across the file rather than concentrated at one point — mechanically, that is five or six additional opportunities, spread across however long this file's test bodies take to run, for a body-time read to land while `REQ-PPH-04.1`'s registered, unmemoized `bun run build` (a different file, `rm -rf dist` + full rebuild) is transiently deleting or repopulating the real `dist/`. This delta did not introduce that hazard — it's the same one flagged at S-000 — but it did, in its original form, multiply the number of read-points exposed to it. The self-fix genuinely addresses this for the mutating cases. I would add one honest caveat the self-audit didn't: the four newly-added **read-only** body-time reads (targeted check 1's nuance, above) still exist post-fix and were not moved to the snapshot, so this delta's contribution to the exposure surface is *reduced*, not *eliminated*.

**(b) Does the `beforeAll` snapshot narrow the race, or just move the read earlier in the same process?** **Genuinely narrows it, not merely relabels it.** The distinction that matters: it collapses what were five-to-six independent read-opportunities (each test body's own `cpSync`, at whatever point in wall-clock time that specific test happened to run) into exactly **one** read-opportunity per file (`beforeAll`, which is also the same moment `ensureTscBuild()` and `manifestRaw`'s read already relied on being safe). Fewer independent read-points against a resource under suspected concurrent mutation is a real reduction in the probability of hitting whatever window (if any) causes the flake — this is not just moving the goalposts, it is shrinking the target. It is **not** a complete fix (it doesn't touch `REQ-PPH-04.1` itself, the registered root-cause suspect, and — per (a) above — four read-only body-time reads remain outside the snapshot), so "narrows, does not close" is the accurate characterization.

**I could not identify the failing test's identity in either of the two now-unexplained one-offs** (S-000's and this one) from anything available to me — no artifact, log, or reproducible state exists for either. I did not attempt to force a reproduction by looping runs, per the standing instruction to avoid burning the budget chasing a ghost; one full clean run (captured safely) is the correct amount of verification effort here given two prior investigators already logged 4+4 additional clean runs between them.

## Issues Found

None at CRITICAL or blocking severity.

| Issue | Severity | Routing class | File:Line | Detail |
|---|---|---|---|---|
| `checkPublishOrdering` and `.gitattributes` parse helpers were written without a driving RED, unlike the three shared checkers in the same slice | WARNING | LOCAL (process note, not a functional defect) | `test/fitness/fit-23-publish-workflow-guard.test.ts:134-190`; `test/build/build-config.test.ts:83-99` | Real, disclosed gap in TDD discipline for two brand-new pieces of test-side logic where triangulation was clearly possible. Mitigated by genuine post-hoc red-proofs (verified to actually discriminate). Not blocking; worth naming for the pattern, not the instance. |
| Six "offenders must be `[]`" assertions in the new shape/exclusion `describe` block share the same theoretical empty-input vacuity the executor hardened against elsewheere but did not sweep here | SUGGESTION | LOCAL | `test/fitness/fit-42-runner-closure-integrity.test.ts` (the "shape, exclusions, hygiene and ordering" `describe`, RCD-01.1/RCD-04.1/RME-01.3/03.1/04.1/05.1) | Low practical risk — `manifest.files.length === 24` and closure `nodes.length === 23` are independently pinned by sibling S-000 tests in the same file/run. Cosmetic completeness gap in the self-audit's claimed sweep, not a live coverage hole. |
| Self-audit's "residual... predates this slice" framing for body-time live-`dist/` reads omits that S-002 itself adds four new (read-only) body-time reads of the same kind | SUGGESTION | LOCAL (documentation precision) | `test/fitness/fit-42-runner-closure-integrity.test.ts` — the two new S-002 `describe` blocks not routed through `pristineRoot` | Not a new risk category (read-only access to an already-`ensureTscBuild()`-resolved path was already an accepted pattern), but the audit's own precision claim overstates completeness. See Flake section (a). |

## Routing

**None required.** All findings are WARNING/SUGGESTION, non-blocking, and none contradicts the owner's RMD-01.2 ruling or reopens it. No LOCAL-blocking, ARCHITECTURAL, SPEC-blocking, or SENSITIVE finding.

## executive_summary

S-002 — the largest slice and the bulk of the change's correctness surface — holds up under an independent pass, not a corroborating one: I recomputed both known-answer SHA-256 vectors myself outside the test suite, re-ran both `skipIf(uid 0)` tests directly to confirm they execute rather than silently skip, and checked the BPI-03.1 and RMD-03.3 assertions against the **real** committed `publish.yml` and `.gitattributes` rather than trusting the test's own fixtures. All 18 acceptance criteria pass on independent verification; RMD-01.2's owner-ruled resolution was not re-litigated, and its retained test's residual-value framing checks out as accurate and non-overstated. Two things beyond what was asked surfaced under scrutiny, both minor: `checkPublishOrdering` and the `.gitattributes` parse helpers are genuinely new test-side logic written without a driving RED where one was clearly possible (a real, if well-mitigated, discipline gap distinct from the slice's other green-on-arrival rows, which are legitimate because S-002 adds no production code); and six "offenders must be empty" assertions in the new shape/exclusion block share the same theoretical vacuity the executor explicitly hardened against elsewhere but didn't sweep here — low practical risk given sibling S-000 tests already pin non-emptiness in the same file. On the flake: my own run was clean; the two specific questions asked are answered directly rather than deflected — this delta's original form plausibly widened exposure to the registered `PPH-04.1` suspect (now reduced but not eliminated, since four read-only body-time reads remain outside the `beforeAll` snapshot), and the snapshot fix is a genuine, measurable narrowing of the exposure surface, not cosmetic. The failing test's identity remains, honestly, unknown.

## risks

- The two now-unidentified one-off failures (S-000, S-002) remain unexplained; if `REQ-PPH-04.1` is the true cause, the risk compounds as later slices (S-003+) add more tests reading the shared `dist/`.
- `checkPublishOrdering`'s untested-by-RED origin means a future maintainer extending it (e.g. adding a fifth `PublishStepKind`) has no established RED-first precedent in this file to follow, only the three shared-checker rows to emulate instead.

## next_recommended

Proceed to S-003. Recommend the two SUGGESTION-level findings (vacuity-sweep completeness, residual-reads precision) travel with the existing S-003-bound followup list (`renderViolations` trailing-line fix, reachability-guard promotion) rather than opening new tracking, since S-003 is already the landing zone for this file's next extension. The WARNING (RED-discipline gap on two new checkers) needs no code change — it is a pattern note for whoever writes S-003's own new test-side logic (the CST/BDI deny-scan scenarios), where the same temptation (write the checker, then backfill red-proofs) will recur and should be resisted given the precedent already exists in the same file for doing it correctly.
