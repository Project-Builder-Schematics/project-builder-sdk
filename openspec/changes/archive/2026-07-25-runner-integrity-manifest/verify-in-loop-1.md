# Verify In-Loop 1 — runner-integrity-manifest (S-000)

**Mode**: in-loop (Strict TDD) · **Iteration**: 1/3 · **Scope**: S-000
**Delta**: `984e933`, `e72d43e`, `44d856a` (`git diff 66bc7cf..HEAD`)

---

## Execution Evidence

| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` (run twice, independently) | `2191 pass / 0 fail`, `4856 expect() calls`, `Ran 2191 tests across 194 files` — both runs, ~64.8s / ~64.9s |
| Delta files only | `bun test test/fitness/fit-42-runner-closure-integrity.test.ts test/fitness/fit-42-runner-closure-integrity.negative.test.ts test/build/build-config.test.ts test/fitness/fit-14-package-surface.test.ts` | `67 pass / 0 fail`, `82 expect() calls` |
| FIT-14 alone | `bun test test/fitness/fit-14-package-surface.test.ts` | `19 pass / 0 fail`, `23 expect() calls` — matches apply-progress's "19/19 green" claim |
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Real build | `bun run build` | stdout tail: `runner-manifest: 24 files -> dist/runner-manifest.json` / `runner-manifest-sha256: 1d5cc95ef130b01e5a2a4e53e877bce0d15f1eeb7ca1612b5a204badc4ab6a22` — matches apply-progress's claimed identity lines verbatim |
| `src/**` diff | `git diff 66bc7cf..HEAD -- src/` | empty (0 lines) — zero-diff confirmed independently |
| Linter | n/a | Not available — none configured, per project standards |

## Spec Compliance — S-000 scope only

| Requirement | Test | Result |
|---|---|---|
| RME-06, RME-07, BPI-01, BPI-04, PMF-03 (closes) | fit-42 shape/serialisation/identity-line tests; build-config wiring tests; fit-14 PMF-03 test | PASS |
| RCD-00..03 (partial), RME-01/02/05 (partial), RMD-03.1 (partial) | fit-42 + fit-42N real-tree and synthetic-tree tests | PASS (partial scope honoured, matches slices.md coverage table) |
| RP-10 (comparePaths discriminating pairs) | `fit-42N::REQ-RME-05.2` ×2 + astral-path case | PASS — verified `Buffer.compare`, not `localeCompare`, is used |
| RP-12 (JSDoc false-alarm inverse) | `fit-42::REQ-RCD-03.3` ×3 | PASS — verified non-vacuous (see Targeted Checks #3) |

## S-000 Acceptance Criteria (all 10)

| # | Criterion | Independently verified? | Result |
|---|---|---|---|
| 1 | Two pinned stdout identity lines | Yes — ran `bun run build` myself, output matched claim byte-for-byte | PASS |
| 2 | Manifest exists, shape, 24 records, entry, packageVersion | Yes — read `dist/runner-manifest.json` directly | PASS |
| 3 | JSDoc-quoting files: ordinary records, no violations | Yes — see Targeted Check #3 | PASS |
| 4 | `engine-client.js` absent from closure/`files` | Yes — see Targeted Check #3 | PASS |
| 5 | Anti-tautology synthetic tree | Yes — read `fit-42N` test + `deriveRunnerClosure` BFS logic | PASS |
| 6 | Independent SHA-256 recompute | Yes — confirmed test uses `scratch-consumer.ts#hashFile`, a separate `createHash` call, not the generator's `sha256File` import | PASS |
| 7 | Serialisation round-trip identity | Yes — confirmed manifest file's trailing bytes (`}\n`) and `serialiseManifest` impl | PASS |
| 8 | `comparePaths` on both pairs | Yes — read test + `Buffer.compare` impl | PASS |
| 9 | Baseline carries the manifest; FIT-14 green | Yes — ran FIT-14 alone: 19/19 | PASS |
| 10 | `build:manifest` last `&&`-segment | Yes — read `package.json` diff directly | PASS |

## TDD Cycle Audit (delta)

Reviewed the 30-row evidence table against the actual diff. RED evidence quoted in the table is consistent with the real assertion failures the described code changes would produce (spot-checked ~10 rows against the actual `deriveRunnerClosure`/`renderViolations` implementation).

**Ruling on the four "green-on-arrival" rows** — independently traced each to the code, not deferring to the apply agent's framing:

1. **"Builtins not followed" (RCD-04.1)** — the driving RED test ("records `node:`-prefixed specifiers as builtins") forces the single line `if (specifier.startsWith("node:")) return { kind: "builtin" };`. Because `deriveRunnerClosure` only calls `queue.push` on the `"edge"` branch, a specifier classified `"builtin"` mechanically cannot be enqueued — the "excludes builtins from the closure" assertion is a **necessary corollary of the same one-line change**, not independent logic. Legitimate.
2. **"Deny-scan: sanctioned site" (CST-03.3)** — traced to `CST-03.2`'s RED test ("second dynamic import() inside the sanctioned file"), which asserts `toEqual([{one violation}])` against a **two-import** fixture. That assertion is only satisfiable if the first import is already exempted, which forces `if (atSanctionedSite && index === 0) return;` into existence. A single import at the sanctioned site trivially hits that same early return. Legitimate.
3. **"Deny-scan: anchor exemption" (CST-04.3)** — traced to `CST-04.1`'s "second createRequire use inside the anchored file" RED test, which asserts exactly one violation against an **import + two calls** fixture. Satisfying `toEqual([{one violation}])` requires both the import-declaration skip and the first-use skip to already exist. The single-call real-anchor case is a corollary. Legitimate.
4. **"Build wiring" (BPI-01.1/01.2)** — the outer-loop RED test (`bun run build` must leave the manifest on disk) can only be satisfied by editing `package.json#scripts.build` to append `bun run build:manifest`. That edit mechanically makes it the last `&&`-segment and the sole invoker — there is no code path that satisfies the outer RED without also satisfying these structural assertions. QA's review (`review-qa.md`, "Unobservable as written in V1") independently documents *why* BPI-01.1/01.2 had to become structural parses rather than behavioural probes. Legitimate, and consistent with signed-off design.

**Verdict on framing**: "guards, not drivers" is an accurate description, not TDD-violation-dressed-as-honesty, for all four rows. Each was checked at the code level, not taken on the apply agent's word. This is a **disclosed, narrow, and traceable** departure from Phase 1's literal letter ("test passes immediately → HALT"), not a pattern of skipped RED cycles. No halt warranted. Noted as a WARNING-level observation for the record, since strict adherence would have required inserting each as its own driven cycle even when mechanically redundant.

**Secondary observation (not one of the four disclosed rows)**: `RULE_BODIES` (`scripts/derive-runner-closure.ts`) is a 9-entry polymorphic dispatch table (one function per `ViolationRule`); only 1 of 9 entries (`constraint-3-bare-specifier`, via `CST-06.1`) is exercised by any test landing in this slice. The other 8 message bodies are real, shipped, untested-in-S-000 code. This is **not a fresh apply-time shortcut** — it is the explicit, signed slice-plan tradeoff stated in `slices.md` ("what's deliberately thin is the test surface... exhaustive scenario coverage landing in S-002/S-003") and matches design's own row-11/row-12 sequencing rationale. Flagged for completeness; not a finding requiring action before S-002/S-003 land as planned.

## Assertion Quality Audit (delta)

No banned patterns found (`toBeDefined`, `toBeTruthy`/`toBeFalsy` without context, `objectContaining` as the whole assertion, `not.toThrow()` alone, snapshot-only, structure-mirroring mocks, multi-behaviour tests, private-state tests) across the two fit-42 files, `build-config.test.ts`'s new `describe`, and `fit-14-package-surface.test.ts`'s new test. All assertions pin concrete values (`toEqual`, `toBe`, `toContain`, `toMatch` with regex literals).

Triangulation: `classifySpecifier`'s branches (builtin / edge / query-suffix / unresolvable / symlink-escape / URL-scheme / bare / unprefixed-builtin) each have a dedicated test-case; `comparePaths` has 3 discriminating cases (byte-vs-locale ×2, byte-vs-UTF-16-code-unit ×1); the Constraint-4 primitive scan has 5 distinct forms in one triangulated test. Clean.

No vacuous absence assertions or paraphrased frozen strings found in the delta (see Targeted Check #3 for the two headline non-vacuity proofs).

## Targeted Checks (the five in §5)

| # | Check | Finding |
|---|---|---|
| 1 | Intermittent failure investigation | **Could not reproduce.** Ran the full suite twice more (independently of the orchestrator's 5 runs): both clean, `2191 pass / 0 fail`. Combined record: 6 clean runs, 1 unexplained fail, across two independent verifiers. Structural investigation: this delta does **not** introduce new unmemoized `dist/`-mutating calls — `deriveRunnerClosure`/`generateRunnerManifest` never touch the real `dist/` (only read it), and the two new fit-42 files read through `ensureTscBuild()`'s existing singleton correctly (`test/support/shared-build.ts`, confirmed by reading it). FIT-14 was migrated in this slice **away from** an independent unmemoized `bun run build` spawn and **onto** the shared singleton — this is a net reduction in exposure, not an increase, contrary to what a rushed read of "adds more `dist/`-reading tests" might suggest. However, this delta **does add** two more consumers (`fit-42`'s two `describe` blocks) that read `dist/runner-manifest.json` through the same singleton, and it lands inside `build-config.test.ts`, a file that **already contained** (pre-existing, not part of this diff) a `describe("REQ-PPH-04.1...")` block that runs a **raw, unmemoized** `spawnSync("bun", ["run", "build"])` — which does its own `rm -rf dist` + rebuild, completely bypassing `ensureTscBuild()`. Three other pre-existing files (`test/security/canary-no-echo.test.ts`, `test/bin/codegen-cli.test.ts`, `test/bin/codegen-static-scan.test.ts`) do the same. Confirmed no `bunfig.toml` and no `--parallel` flag in `package.json#scripts.test` (`"bun test"` plain), so Bun 1.3.14 should not be running test *files* in separate worker processes by default. I cannot rule out interleaving from Bun's default test scheduling (`--max-concurrency` defaults to 20) at a level below what static reading can settle. **Honest conclusion: no cause identified. The most plausible (unconfirmed) contributing factor is the pre-existing PPH-04.1 raw-build pattern racing the growing set of singleton-`dist/` readers this slice adds to — a real, QA-flagged-by-name risk (`review-qa.md` Isolation §3.3) that this slice partially mitigated (FIT-14) but did not fully close (PPH-04.1 still raw).** Recommend a followup: route `build-config.test.ts`'s PPH-04.1 block through an isolation-safe mechanism (its own scratch root, since it deliberately needs to observe `prebuild` firing — cannot simply use `ensureTscBuild()`) rather than mutating the shared `dist/`. Not blocking S-000. |
| 2 | Four green-on-arrival rows | See "TDD Cycle Audit" above — all four independently traced to code and judged legitimate, not violations dressed in honest language. |
| 3 | Non-vacuity of criteria 3 & 4 | **Confirmed non-vacuous, both.** Criterion 3: read the real built files — `dist/core/authoring-error.js:137` contains `import { AuthoringError } from "@pbuilder/sdk/commons";` inside its JSDoc, `dist/core/context.js:283` contains `import type { Input } from "./schema.generated.ts";` inside its JSDoc — both confirmed present on disk. `staticSpecifierSites()` in `scripts/derive-runner-closure.ts` reads only `sourceFile.getImportDeclarations()`/`getExportDeclarations()` (real AST nodes) — comment text is structurally invisible to it. Under a regression to regex/text scanning (the exact escape `review-qa.md` #4 describes), both quoted specifiers would be picked up and the "zero violations" + "no phantom node" assertions would fail — so the test genuinely discriminates the fix from the bug. Criterion 4: `dist/core/engine-client.js` confirmed on disk (348 bytes, real content: comments + `export {}`, not a zero-byte stub) via direct read; the test asserts `existsSync(...) === true` **before** asserting absence from the closure/manifest, which rules out the vacuous "absent because it doesn't exist" case QA and the orchestrator both flagged as the failure mode to check for. |
| 4 | Five declared deviations | See "Routing" and detail below — classified individually. |
| 5 | `src/**` zero diff | **Confirmed independently.** `git diff 66bc7cf..HEAD -- src/` returns 0 lines. |

### Deviation-by-deviation classification (targeted check #4)

1. `DIST_DIR_NAME` constant instead of `relative()` — **acceptable-as-recorded**. No observable behaviour change; `distRoot` is provably always `join(packageRoot, "dist")`. LOCAL.
2. `readSpecifiers` not implemented — **acceptable-as-recorded**. Its only consumer (BDI-02.1) is explicitly S-003 scope per slices.md's own coverage table; writing it now would be implementation ahead of its driving test, which Strict TDD forbids. LOCAL, tracked forward.
3. **Constraint-4 anchor rule ("import binding + FIRST use")** — judged in depth. This is **not an arbitrary interpretation**: it is the *only* implementation that simultaneously satisfies `CST-04.1`'s pinned real-tree scenario (a second `createRequire` use inside the anchored file still fails) and `CST-04.3`'s pinned real-tree scenario (the actual `single-instance-probe.ts`, which contains an import binding **and** one `.resolve()` call, reports zero violations). Any rule that counted the import binding itself against the "single use" budget would fail `CST-04.3` on the real file; any rule that didn't count a second call as a violation would fail `CST-04.1`. So the executor did not invent policy — it reverse-derived the unique rule both signed scenarios jointly require, and recorded it for S-003's benefit exactly as slices.md's own "documented handoff" convention asks. **Routing: SPEC, advisory only, non-blocking for S-000.** Recommend the rule be promoted from an apply-progress footnote into ADR-04 or the docs page's Constraint-4 text *before* S-003 builds its full CST-04 scenario matrix on top of it — not because it's wrong, but because "reverse-derived from two scenarios" is a fragile place for a counting rule to live once a third scenario (S-003 adds several) starts depending on it.
4. `SANCTIONED-FACTORY-IMPORT` marker deferred to S-003 — **acceptable-as-recorded**. Matches design's own file-ownership table (the only two permitted `src/` touches in this program are S-003's `runner.ts` marker and S-005's `single-instance-probe.ts` header). LOCAL, tracked forward, and slices.md's zero-diff constraint on S-000's `src/**` makes doing it now impossible without violating a harder constraint.
5. `sanctioned site:` line folded into `why:` — **acceptable-as-recorded**. Cosmetic; frozen `CST03_PER_SITE_CLAUSE` text is reproduced verbatim in `rule:` per apply-progress's own note; forward note for S-003 already captured if a dedicated field is wanted later. LOCAL.

## Issues Found

None at CRITICAL or blocking severity.

| Issue | Severity | Routing class | File:Line | Detail |
|---|---|---|---|---|
| Constraint-4 anchor counting rule stated only in apply-progress, not in ADR-04/docs | SUGGESTION | SPEC (advisory) | `openspec/changes/runner-integrity-manifest/apply-progress.md` deviation 3; `openspec/decisions/` ADR-04 | Promote the reverse-derived rule into the ADR/docs before S-003 extends the CST-04 matrix on top of it. Not blocking. |
| `build-config.test.ts`'s pre-existing PPH-04.1 block still performs a raw, unmemoized `bun run build` (`rm -rf dist` + rebuild) in a file this slice also extends, growing in exposure as more tests read the shared memoized `dist/` | SUGGESTION | LOCAL (test-isolation followup) | `test/build/build-config.test.ts:21-42` | Pre-existing hazard (not introduced by this delta), explicitly named in `review-qa.md` Isolation §3.3 as a "watch-out." This slice mitigated it for FIT-14 but not for PPH-04.1. Candidate root cause (unconfirmed) for the one unreproduced flake; recommend as a followup, not a blocker. |
| 8 of 9 `RULE_BODIES` dispatch entries in `scripts/derive-runner-closure.ts` are unexercised by any test in this slice | SUGGESTION | none (pre-approved slice-plan tradeoff) | `scripts/derive-runner-closure.ts:294-349` | Explicitly disclosed and pre-signed in `slices.md` ("test surface deliberately thin... exhaustive coverage lands in S-002/S-003"). No action needed before those slices land. |

## Routing

**None required.** No finding rises to LOCAL-blocking, ARCHITECTURAL, SPEC-blocking, or SENSITIVE. The one SPEC-advisory item (Constraint-4 counting rule) and the one LOCAL-advisory item (PPH-04.1 isolation) are forward-looking recommendations for S-003, not gates on S-000's pass verdict.

## executive_summary

S-000's implementation is genuinely correct against the real 23-file closure, not a stub: independently re-ran `bun run build` and got byte-identical stdout to the apply agent's claim, confirmed the manifest's shape/serialisation/ordering on disk, and confirmed `src/**` has a true zero diff. All 10 acceptance criteria verified independently, not taken on the apply-progress summary's word. The two headline non-vacuity concerns (JSDoc false-alarm inverse, engine-client.js absence) both check out as genuinely discriminating tests, traced to the real files on disk and the actual AST-only specifier extraction. The four "green-on-arrival" TDD rows were independently traced to code, not deferred to the self-report: all four are legitimate, disclosed corollaries of adjacent RED tests in the same cycle, not TDD violations in honest clothing. The Constraint-4 anchor counting rule is a reasonable (in fact uniquely forced) resolution of an underspecified spec/ADR clause — worth promoting into the ADR before S-003 depends on it further, but not a plan-blocking ambiguity. The one open item is the intermittent test failure: unreproduced across 2 additional full-suite runs (6 clean total across two verifiers, 1 unexplained fail), with a plausible but unconfirmed pre-existing contributing factor identified (an unmemoized raw `bun run build` in `build-config.test.ts` racing the growing set of tests reading the shared `dist/`) — reported honestly as unresolved rather than diagnosed with false confidence.

## risks

- The unreproduced flake remains genuinely unexplained; if it recurs with higher frequency once S-002/S-003 add more `dist/`-reading tests, the PPH-04.1 isolation gap becomes more likely to matter.
- The Constraint-4 anchor counting rule, while uniquely forced by today's two scenarios, has no textual home outside an apply-progress footnote — a future contributor reading only ADR-04 would not find it.

## next_recommended

Proceed to S-001. Optionally fold the two SUGGESTION-level followups (ADR-04 promotion of the anchor rule; PPH-04.1 isolation) into S-003's scope or the project's pending-changes ledger, since both are prerequisites-in-spirit for S-003's CST-04 matrix and the isolation discipline S-002/S-003 will lean on further.
