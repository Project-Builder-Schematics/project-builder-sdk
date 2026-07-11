## Verify In-Loop Result

**Change**: stage-4b-testing-harness
**Iteration**: 3/3
**Scope**: S-002 (Harness Isolation, No-Leak & Fake-Parity Invariants), S-003 (Entry-Surface
Containment Guards), S-004 (Installed-Consumer-Vantage e2e — Founding-Bug Proof), S-005
(Positive Testing-Story Documentation)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit — `/build` deliverable (S-000..S-005) is complete.

- Tasks in scope complete: 21/21 across the four cards (all `[x]` in slices.md, all
  corroborated by the diff); S-006 stays entirely `[ ]` — correctly not built
- Full suite: 647/647 pass (no regressions)
- Typecheck: `bunx tsc --noEmit` clean (exit 0)
- Build: `bun run build` clean (exit 0) — tsc + codegen bin bundle
- Spec compliance for scope: ATH-11(.1), ATH-12(.1,.2), FSP-01(.1), FSP-02(.1), FSP-03(.1),
  FSP-04(.1), TES-01(.1), ATH-01(.3), TES-03(.1-.4), TES-04(.1-.4), TES-05(.1,.2), TES-02(.1),
  TES-06(.1,.2,.3), TSD-01(.1-.4), TSD-02(.1-.3), TSD-04(.1) — all real, mutation-resistant
  assertions
- Zero new runtime dependencies: `git diff 873adfd..HEAD -- package.json` is empty across the
  whole delta
- No banned Strict-TDD assertion patterns (`toBeDefined()`, `toBeTruthy()`, bare
  `objectContaining`, `.not.toThrow()`-only) found in any of the 10 delta test files
- No S-006 scope smuggled in (opted-in factories, ATH-11.2/ATH-13, TSD-03 revert — verified
  absent from the diff; `test/fake/harness-opted-in.test.ts` and
  `test/fixtures/harness-opted-in/schema.json` do not exist yet)
- README qualifying-line byte-untouched (S-005's README diff is pure addition — no deletion
  lines in `git show 170c808 -- README.md`)
- ADR-0009's original AUTHOR/CONTRIBUTOR text preserved verbatim under the ADR-0033 amendment
  note (extends, does not redefine)

Orchestrator action: `/build` deliverable complete. Proceed to `/evaluate` (mode=final) —
note per slices.md the change does NOT reach archive until S-006 lands (gated on
`stage-4-typed-options` archiving); a final-mode verify now would cover S-000..S-005 only.

---

### Delta Reviewed

Commit range `873adfd..HEAD` on `feat/stage-4b-testing-harness`, four commits:

| Commit | Slice | Files | +/- |
|---|---|---|---|
| `2fdf9ad` | S-002 | 3 test files created + slices.md | +533/-3 |
| `1832a59` | S-003 | 5 fitness files (2 create, 3 modify) + ADR-0034 + slices.md | +473/-77 |
| `2f23160` | S-004 | 1 e2e file elaborated (spike → full) + slices.md | +188/-37 |
| `170c808` | S-005 | README, wire.ts, ADR-0009/0033, docs test, fit-06 + slices.md | +311/-13 |

17 non-slices.md files touched total (see Task Checklist Verification below); zero overlap
with S-000/S-001 files beyond the shared `test/support/shared-build.ts` consumer relationship
(no re-edit of that file itself).

### Task Checklist Verification

**S-002** (5/5 tasks + 2 deviation notes, all self-documented and verified):
| Task | Status | Evidence |
|---|---|---|
| `harness-in-memory-invariant.test.ts` Create | ✅ | blanket pass-through spies on `node:fs`/`node:net` + named Bun-I/O + `fetch`; Proxy traps on `env`/`argv`; red-proof + REQ-ATH-11.1 zero-events assertion |
| `harness-leak-scan.test.ts` Create | ✅ | local near-duplicate of FIT-11 traversal; ATH-12.1 (3 scenarios) + ATH-12.2 (2 scenarios), dictionary-derivation sanity + scan-mechanism red-proof |
| `fit-18-fake-single-source-parity.test.ts` Create | ✅ | FSP-01 (repo-wide characteristic-method-set scan, self-excluded from own scan), FSP-02 (`===` identity + duplicate-class red-proof), FSP-03 (dictionary value-equality), FSP-04 (red-proof + real-shim clean check) |
| ATH-11.2 investigation note | ✅ verified | `src/core/context.ts` lines ~197-206 checked directly: both stage-4 reads are gated behind `options?.packageDir !== undefined`; S-002's non-opted-in scope needs no allowlist widening — correct, matches spec's ATH-11 text |
| FIT-18 self-exclusion + local-duplicate deviation notes | ✅ verified | `filePath !== import.meta.path` exemption present and narrow (single exact path, mirrors FIT-10 precedent); `harness-leak-scan.test.ts`'s `scanForLeaks` kept local, not extracted, per S-001 precedent |

**S-003** (6/6 tasks):
| Task | Status | Evidence |
|---|---|---|
| `fit-08-no-kit-bleed.test.ts` Modify | ✅ | `SCANNED` per-path allowlist array (4 paths); `./testing` = `{valueAllow: [defineFactory, runFactoryForTest], typeAllow: [Batch, Directive]}`; wildcard-ban-by-form with exactly ONE `UMBRELLA_EXEMPT_SPECIFIER = "./commons/index.ts"` scoped to `UMBRELLA_PATH = src/index.ts` only; ATH-01.3 red-proofs (value + type-only `ContractFake`) |
| `fit-09-pkg-exports-resolution.test.ts` Modify | verify-and-skip, confirmed | `git diff 873adfd..HEAD --stat` for this file is empty — correctly untouched, already regenerated in S-000 per §4.8's same-slice instruction |
| `fit-17-testing-dev-only-bundle.test.ts` Create | ✅ | 4-entry scan via `ensureMinifiedEntry`; absence (3 production entries) + positive-control presence (`./testing`, `[permanent-fixture]`) + conditional-exports red-proof + structural-import red-proof (no hardcoded literal) + `sideEffects`-absent assert |
| `fit-04-dts-semver-gate.test.ts` Modify | ✅ | `testing.index` DTS_PAIRS row added; `dts-baseline/testing.index.d.ts` committed snapshot created; negative declaration-scan (`EngineClient`/`EmitRejection`) + red-proof; consumes shared `ensureTscBuild()`; W7 header comment updated to describe the memoized mechanic |
| `fit-07-no-tree-in-core.test.ts` Modify | ✅ | glob stays pinned `src/core/**` (asserted directly: `CORE_DIR.endsWith("/src/core")` + `files.some(f => f.includes("testing")) === false`); stale comment replaced; `[characterization]` test proves the fake's own tree field WOULD trip the detector if in scope (proving the pin matters) |
| `openspec/decisions/0034-shipped-fake-containment.md` Create | ✅ | six guards enumerated, matches design §4.5 verbatim in substance |

**S-004** (3/3 tasks):
| Task | Status | Evidence |
|---|---|---|
| `installed-consumer.e2e.test.ts` Modify (elaborate spike) | ✅ | pack→install→spawn-script-INSIDE-scratch-dir pattern (`runScratchScript` runs `bun run <file>` with `cwd: SCRATCH_DIR`) — genuinely installed-vantage, not repo-vantage; memoized `ensureInstalledConsumer()` shared across 3 scenarios; repo-lockfile hash asserted unchanged |
| golden tree + colliding-batch fixtures | ✅ | `GOLDEN_PATH`/`GOLDEN_CONTENT` write-only proof; `COLLIDING_PATH`/`COLLIDING_SEED`/`COLLIDING_TEMPLATE` all-or-nothing proof |
| consumer-side `AuthoringError` narrowing via installed export | ✅ | `check-collision.mjs` imports `AuthoringError` from `@pbuilder/sdk/commons` (the installed package's OWN export) and asserts `instanceof` + `verb`/`path`/`reason` from inside the spawned script |

**S-005** (5/5 tasks):
| Task | Status | Evidence |
|---|---|---|
| `README.md` Modify | ✅ | new `## Testing your factory` section; copy-runnable example + seeded-read worked example; `0.x`/`semver-exempt` stated; `./conformance` boundary line present; qualifying line (elsewhere in the file) untouched — diff is pure addition |
| `src/core/wire.ts` Modify | ✅ | `@example` added to `Directive` and `Batch` origin type declarations |
| `fit-06-example-jsdoc.test.ts` Modify | ✅ | `PUBLIC_PATHS` includes `src/testing/index.ts`; `RunResult` carries its own `@example`+field docs in `src/testing/index.ts` (in FIT-06's cascade scope per ARCH-M1); TSD-02.2 token assert (`0.x`+`semver-exempt` on `runFactoryForTest`'s JSDoc); TSD-02.3 red-proof (VALUE re-export cascade to origin) |
| `test/docs/testing-story-docs.test.ts` Create | ✅ | TSD-01.1 (spawns `bun test` against extracted+import-swapped code blocks, genuinely executes them), TSD-01.2/.3/.4 token asserts, TSD-04.1 token asserts on ADR-0033 + ADR-0009-preservation check |
| `openspec/decisions/0009-*.md` Modify + `0033-*.md` Create | ✅ | 0009 gains an "Amended by ADR-0033" note only — original AUTHOR/CONTRIBUTOR decision text (`AUTHOR = ...`, `CONTRIBUTOR = the **kit**`) is byte-present, unedited; 0033 is its own full draft file, cross-referencing back |

### Design/Spec Compliance Spot-Checks (in-loop focus items)

- **ADR-0033 amendment vs. ADR-0009**: confirmed EXTENDS, not redefines — `git show 170c808 -- openspec/decisions/0009-*.md` shows a 6-line insertion (the amendment note) with zero deletions; original Decision/Consequences sections byte-identical.
- **ADR-0034 containment**: six guards enumerated in the ADR file match design §4.5 in substance (FIT-17, FIT-08, FIT-10-carryover, FIT-07, FIT-04 entry-only, dts negative scan).
- **ONE shared build fixture across FIT-04/FIT-17/e2e**: `test/support/shared-build.ts` (created in S-000, untouched in this delta — confirmed via `git diff 873adfd..HEAD -- test/support/shared-build.ts` empty) exports `ensureTscBuild()` (module-singleton, consumed by FIT-04 + the e2e) and `ensureMinifiedEntry()` (per-entry cache, consumed 4× by FIT-17). No second `bun run build` or ad hoc `bun build` invocation was added anywhere in the delta — verified via `rg -n "spawnSync\(.bun.,\s*\[.run.,\s*.build" test/` returning only `shared-build.ts`'s own definition.
- **ATH-11 event-allowlist scoping**: S-002 correctly stays at the strict zero-events floor (non-opted-in only) and documents, with a direct source-line citation, why no allowlist predicate was needed yet — ATH-11.2's predicate logic is absent from this delta (S-006 scope), confirmed.
- **FIT-08 wildcard-ban-by-form, single exemption**: only one `UMBRELLA_EXEMPT_SPECIFIER` constant exists in the file, gated to `filePath === UMBRELLA_PATH` (i.e. `src/index.ts` only) — no broader per-path or per-directory exemption was introduced. Both required red-proofs present (non-exempt specifier on the umbrella path; wildcard on the facade path).
- **FIT-06 PUBLIC_PATHS widened + token-level asserts**: `src/testing/index.ts` added to `PUBLIC_PATHS`; TSD-02.2's assertion checks literal substring presence of `"0.x"` and `"semver-exempt"` in the JSDoc — token-level, not full-sentence, matching design's GAP-5 pin.
- **TES-06 founding-bug scenarios run from INSIDE the scratch-installed consumer**: verified structurally — every assertion-bearing script (`check-resolution.mjs`, `check-write-only.mjs`, `check-collision.mjs`) is written to and spawned from `SCRATCH_DIR` via `spawnSync("bun", ["run", fileName], { cwd: SCRATCH_DIR, ... })`; imports inside those scripts use bare specifiers (`@pbuilder/sdk/testing`, `@pbuilder/sdk/commons`) that resolve through the scratch consumer's own `node_modules`, never a relative path into the repo's `src`/`dist`. This is genuinely installed-vantage, not repo-vantage.

### Findings

No blocking or major findings.

| # | Severity | File:Line | What | Evidence |
|---|---|---|---|---|
| 1 | minor | n/a (process note) | TDD cycle adherence (RED→GREEN) cannot be verified via git history for any of the four slices — each is a single commit, same per-slice commit convention already tolerated in iterations 1-2. | `strict-tdd-verify.md` tolerates this explicitly when a project doesn't commit per cycle. Method 2 (test-implementation pairing) is satisfied for all four slices: every new/modified implementation surface (`fit-08`, `fit-17`, `fit-04`, `fit-07`, `wire.ts`, README, ADRs) has a corresponding, non-vacuous test exercising it (`fit-08`/`fit-17`/`fit-04`/`fit-06`/`testing-story-docs`/e2e). Not a halt — consistent with iterations 1-2. |
| 2 | minor | `src/testing/index.ts:68-86` | `runFactoryForTest`'s `@example` shows the `instanceof AuthoringError` narrowing branch but the factory in the example always succeeds — the branch is illustrative, never actually exercised by a real rejection in the doc comment itself. | Design §4.2's file-changes row describes the intended content as "a COMPLETE author test INCLUDING a rejection assertion with the `instanceof AuthoringError` narrowing branch." The literal REQ-TSD-02.1 scenario only requires "a factory definition, a `runFactoryForTest` call, and an assertion on its result" — satisfied. The narrowing branch IS present syntactically (design's stated goal for discoverability), just not driven by an actual rejection in the example. No test regresses on this; purely a doc-fidelity nit, not spec-blocking. |

### Tests (real execution evidence)

```
$ bun test
647 pass
0 fail
1119 expect() calls
Ran 647 tests across 83 files. [2.39s]

$ bunx tsc --noEmit
(exit 0, no output)

$ bun run build
tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node --banner "#!/usr/bin/env node"
Bundled 9 modules in 5ms
(exit 0)

$ bun test test/fake/harness-in-memory-invariant.test.ts test/fake/harness-leak-scan.test.ts test/fitness/fit-18-fake-single-source-parity.test.ts
17 pass / 0 fail / 38 expect() calls — Ran 17 tests across 3 files [104ms]   (S-002 delta)

$ bun test test/fitness/fit-08-no-kit-bleed.test.ts test/fitness/fit-09-pkg-exports-resolution.test.ts test/fitness/fit-17-testing-dev-only-bundle.test.ts test/fitness/fit-04-dts-semver-gate.test.ts test/fitness/fit-07-no-tree-in-core.test.ts
71 pass / 0 fail / 88 expect() calls — Ran 71 tests across 5 files [323ms]   (S-003 delta)

$ bun test test/e2e/installed-consumer.e2e.test.ts
3 pass / 0 fail / 17 expect() calls — Ran 3 tests across 1 file [406ms]     (S-004 delta)

$ bun test test/docs/testing-story-docs.test.ts test/fitness/fit-06-example-jsdoc.test.ts
15 pass / 0 fail / 22 expect() calls — Ran 15 tests across 2 files [148ms]  (S-005 delta)

$ git diff 873adfd..HEAD -- package.json
(empty — no dependency changes across the whole delta)

$ rg -n "EngineClient|EmitRejection" src/testing/index.ts
(no matches, exit 1)

$ rg -n "toBeDefined\(\)|toBeTruthy\(\)|toBeFalsy\(\)|\.not\.toThrow\(\)\s*;?\s*$|objectContaining" <10 delta test files>
(no matches)

$ git diff 873adfd..HEAD --stat -- package.json test/fitness/fit-09-pkg-exports-resolution.test.ts test/fitness/fit-14-package-surface.test.ts test/fitness/pkg-surface-baseline.json
(empty — S-000-owned files correctly untouched, confirming the verify-and-skip note)
```

Suite grew 596 (iter-2 baseline) → 647 (+51) across this delta's four slices, consistent with
S-002 (+17 per its own commit message: 596→613), S-003 (fit-08 gains several new `it()`s +
fit-17 new file + fit-04 gains 2 new rows/assertions), S-004 (e2e spike 1 test → 3 scenario
tests, net +2), S-005 (docs test file new + fit-06 gains 2 new assertions) — no unexplained
growth or shrinkage.

### Artifacts Persisted

| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-3 | hybrid | engram `sdd/stage-4b-testing-harness/verify-in-loop-3` + `openspec/changes/stage-4b-testing-harness/verify-in-loop-3.md` |

### Risks

- None blocking. Minor: `src/testing/index.ts`'s `@example` doesn't literally drive a
  rejection through the harness (see Finding #2) — worth tightening at a future doc pass but
  does not weaken any test's failure-detection power and isn't required by the literal REQ
  scenario text.
- Reminder (not a risk of this delta): S-006 remains GATED on `stage-4-typed-options`
  archiving — `sdd-verify --mode=final`/archive must not run against this change until S-006
  lands, per slices.md's explicit statement.

### Next Recommended

`/build` deliverable (S-000..S-005) is complete and green. Do not proceed to
`sdd-verify --mode=final`/archive yet — S-006 is deferred-blocked on
`stage-4-typed-options` archiving, per slices.md's Build Order table ("The change does NOT
reach `sdd-verify --mode=final`/archive until S-006 lands"). Hold this change until that
precondition is met, then `/build --scope=slice:S-006`.

### Skill Resolution

injected
