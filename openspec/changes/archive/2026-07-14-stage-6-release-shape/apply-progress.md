# Apply Progress: Stage 6 — Release shape & DX closure

**Change**: `stage-6-release-shape` · **Scope this run**: `slice:S-000` (walking skeleton) · **Mode**: Strict TDD

## Slices Built This Run

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 4/4 |

## Files Changed

| File | Action | Slice | What Was Done |
|---|---|---|---|
| `package.json` | Modified | S-000.2 | Added `prebuild: "rm -rf dist"` (REQ-PPH-04) and `link:sdk: "bun run build && bun link"` (ADR-0041) scripts |
| `tsconfig.build.json` | Modified | S-000.2 | `declarationMap: true` → `false` (REQ-PPH-05, ADR-0034 amendment) |
| `test/build/build-config.test.ts` | Created | S-000.3 | New file: PPH-04.1 (real `bun run build` invocation with a seeded stale `dist/` marker — proves the `prebuild` lifecycle hook actually fires) + PPH-05.1 (static `tsconfig.build.json` read) |
| `test/support/scratch-consumer.ts` | Created | S-000.1 | Extracted from `installed-consumer.e2e.test.ts`: `runScratchScript`, `parseLastJsonLine`, `hashFile`, `cleanScratchDir`, `PROJECT_ROOT` (verbatim behavior); `ensurePackedConsumer`/`repoLockfileHashAtPackTime` (tarball leg, extracted); NEW `ensureLinkedConsumer`/`unlinkSdk` (bun-link leg, exercises the `link:sdk` script per ADR-0041) |
| `test/e2e/installed-consumer.e2e.test.ts` | Modified | S-000.1/.4 | Refactored the 3 pre-existing tarball-leg scenarios to consume `scratch-consumer.ts` (behavior-preserving — safety-netted, all 3 stayed green); added a new bun-link-leg `describe` block with 3 new scenarios: REQ-LC-01.1/.2 (5-subpath resolution + `/core` unreachable), REQ-LC-04.2 (bin exec from linked `node_modules/.bin` against a `schema.json` fixture), REQ-LC-05.1 (`dryRun()` invocation, non-empty plan) |

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.3 | `build-config.test.ts::REQ-PPH-04.1 > removes the pre-existing stale dist/ file before the tsc step begins` | integration | `expect(received).toBe(expected) / Expected: false / Received: true` | ✅ | n/a — single-case config check, spec-bounded (REQ-PPH-04.1) | none needed |
| S-000.3 | `build-config.test.ts::REQ-PPH-05.1 > reads compilerOptions.declarationMap as false` | unit | `expect(received).toBe(expected) / Expected: false / Received: true` | ✅ | n/a — static boolean config value, spec-bounded (REQ-PPH-05.1) | none needed |
| S-000.4 | `installed-consumer.e2e.test.ts::REQ-LC-01.1/REQ-LC-01.2 > all five subpaths resolve via bun link; ./core stays unresolvable` | e2e | `error: not implemented — TDD RED checkpoint (S-000.1)` (thrown from `ensureLinkedConsumer`, awaited by the test) | ✅ | n/a — fixed 5-subpath + `/core` set, spec-bounded (REQ-LC-01) | none needed |
| S-000.4 | `installed-consumer.e2e.test.ts::REQ-LC-04.2 > pbuilder-codegen runs from the bun-link-installed consumer's node_modules/.bin against a schema.json fixture` | e2e | `error: not implemented — TDD RED checkpoint (S-000.1)` (same shared precondition) | ✅ | n/a — single fixture, spec-bounded (REQ-LC-04.2; the negative/red-proof case is REQ-LC-04.3, out of S-000 scope) | none needed |
| S-000.4 | `installed-consumer.e2e.test.ts::REQ-LC-05.1 > bun-link leg invokes dryRun() via ./commons and returns a non-empty plan` | e2e | `error: not implemented — TDD RED checkpoint (S-000.1)` (same shared precondition) | ✅ | n/a — single-case non-empty-plan check, spec-bounded (REQ-LC-05.1; the key-presence red-proof is REQ-LC-05.3, out of S-000 scope) | none needed |

**Process note**: the 3 bun-link scenarios share one memoized precondition (`ensureLinkedConsumer`). RED evidence was captured by temporarily replacing its body with `throw new Error("not implemented — TDD RED checkpoint (S-000.1)")`, running the suite (3 fail, real thrown-error evidence above), then restoring the real implementation and re-running for GREEN (3 pass). The real implementation had briefly been written before this checkpoint was run — caught and corrected before returning; see Deviations.

## Safety Net (Phase 0 / refactor verification)

- Full baseline suite (`bun test`, pre-slice): 1058 pass / 0 fail (1 pre-existing skip N/A).
- Full suite after S-000 (`bun test`, post-slice): 1061 pass / **1 fail** — `test/fitness/fit-14-package-surface.test.ts`, "the publishable tarball contains no file beyond the committed baseline" — see Deviations below. This is the ONLY delta from baseline.
- `tsc --noEmit` (repo root tsconfig): clean, zero errors.
- `installed-consumer.e2e.test.ts` re-run twice in a row: idempotent (6 pass both times); global bun-link store confirmed clean after `afterAll`'s `unlinkSdk()` (`~/.bun/install/global/node_modules` shows no `@pbuilder` scope post-run).

## Deviations from Design

- **None in scope/architecture.** One process deviation, self-corrected: `ensureLinkedConsumer`'s real body was written before ever observing RED on the 3 new bun-link e2e scenarios (I had validated the underlying primitives — `bun link` populating `node_modules/.bin`, Bun honoring npm-style `pre<script>` hooks — via throwaway probes outside the test suite first, which led me to write the real implementation directly). Caught before returning; corrected by stubbing the function to throw, re-running to capture genuine RED evidence (quoted above), then restoring the real implementation for GREEN. Documented rather than silently smoothed over.
- **Known, spec-mandated interim gap (not a defect):** `fit-14-package-surface.test.ts`'s tarball-baseline diff now fails — the committed `pkg-surface-baseline.json` still lists 42 `.d.ts.map` entries (corrected count — an independent recount at `verify-in-loop-1` found this section originally mis-stated 44; 42 is the number actually present in the committed baseline and the number cleared by S-002.3's regeneration) that `declarationMap: false` (this slice) no longer produces. This is the EXACT sequencing the design's §4.8 Migration/Rollout and slices.md's Executor Context item 16 describe: baseline regeneration is explicitly **S-002.3**'s task, sequenced strictly AFTER the prebuild-clean + `declarationMap:false` land (REQ-PPH-06). S-000 is scoped to land the config change only; regenerating the baseline now (against a build S-000 didn't yet declare final) would be scope creep into S-002. Left red on purpose, tracked here for the next `/build` scope — cleared below (S-002.3).

## Halt / Issues Found

None.

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 4/4 |

## Next Step

Ready for `/build --scope=slices:S-001,S-002,S-003` (parallel group per Build Order) — S-002 should be prioritized soon since it owns the `fit-14` baseline regen that resolves the one known-red test left by this slice.

---

# Apply Progress — Run 2: S-002, S-001, S-003 (Build Order group 2)

**Scope this run**: `slices:S-001,S-002,S-003` · **Mode**: Strict TDD · **Build order followed**: S-002 first (clears the fit-14 interim red), then S-001, then S-003

## Slices Built This Run

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-002 | happy-path | complete | 3/3 |
| S-001 | happy-path | complete | 3/3 |
| S-003 | happy-path | complete | 3/3 |

## Files Changed

| File | Action | Slice | What Was Done |
|---|---|---|---|
| `test/fitness/fit-23-publish-workflow-guard.test.ts` | Created | S-002.1 | New (renamed from the design's `fit-21` — see naming deviation below): job-resolution-by-predicate + repo-owner guard, trigger-fence, SHA-pin, `--dry-run` checks with red-proofs, Bun native `YAML.parse` (REQ-PPH-01/02/03) |
| `test/fitness/fit-14-package-surface.test.ts` | Modified | S-002.1 | Added: zero-`.d.ts.map` checks (fresh build + committed baseline, REQ-PPH-05.2/06.1), `dist/core/**` presence (REQ-FPS-06.1), positive no-secrets scan + red-proof (REQ-FPS-07); refactored the pre-existing tarball-diff test to reuse a new shared `freshTarball` `beforeAll` instead of its own redundant `bun pm pack --dry-run` call (behavior-preserving) |
| `.github/workflows/publish.yml` | Modified | S-002.2 | `id-token: write` moved from workflow-level to the `publish` job's own `permissions` block (least privilege); added `if: github.repository == 'Project-Builder-Schematics/project-builder-sdk'` (W3 guard, REQ-PPH-01); SHA-pinned `actions/checkout` (`34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1`) and `actions/setup-node` (`49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`) — both re-resolved live via `gh api` at apply time, unchanged from design's live-resolved values (REQ-PPH-02) |
| `.github/workflows/ci.yml` | Modified | S-002.2 | SHA-pinned `actions/checkout` (same SHA as above) |
| `test/fitness/pkg-surface-baseline.json` | Modified | S-002.3 | Regenerated against a clean `bun run build` + `bun pm pack --dry-run` — `exports`/`dependencies`/`files`/`bin`/`shebang` unchanged (verbatim copy per procedure); `tarball` regenerated: 88 entries, zero `.d.ts.map` (was 130 entries/42 `.d.ts.map` before) |
| `test/e2e/installed-consumer.e2e.test.ts` | Modified | S-001 | Tarball leg: extended subpath-resolution test with `./typescript` probe (REQ-LC-03.1); added tarball-leg bin-exec (REQ-LC-04.1) and dry-run (REQ-LC-05.2) tests. Bun-link leg: added write-only-commit (REQ-LC-02.1) and all-or-nothing-rejection (REQ-LC-02.2) tests. New `checkBinExecutable()` helper (shared by both legs' bin-exec tests). New `describe` block for cross-leg red-proofs: REQ-LC-02.3 (scenario-count parity), REQ-LC-04.3 (missing bin / malformed shebang), REQ-LC-05.3 (key-presence-only insufficiency) |
| `test/support/scratch-consumer.ts` | Modified | S-001/S-003 (bugfix, in-slice) | Fixed a real cross-file bug: `ensurePackedConsumer`/`ensureLinkedConsumer` memoized a SINGLE module-level promise that silently ignored the `scratchDir` argument on a cache hit — a second caller with a DIFFERENT scratch dir reused the first caller's dir instead of getting its own. Latent since S-000 (only one caller existed); exposed when S-003's `quickstart-docs.test.ts` became a second `ensureLinkedConsumer` caller. Fixed by keying both memoizations with a `Map<string, Promise<void>>`; also split `ensureLinkedConsumer` into `ensureProducerLinked()` (the shared global `bun run link:sdk`, its memo RESET by `unlinkSdk()`) + per-`scratchDir` consumer setup, so one test file's `afterAll` teardown never strands another file's still-running tests. See Deviations. |
| `docs/quickstart.md` | Created | S-003.2 | Schema → codegen → typed `factory.ts` → passing test walkthrough; `bun run link:sdk` documented first, tarball alternative second, no `npm install @pbuilder/sdk`; fenced blocks tagged `filename=` for the machine leg; links `authoring-verbs.md`/`authoring-errors.md`/`dry-run.md` (S-004, not yet created) and `authoring-a-dialect.md` (exists) in a Next Steps section |
| `test/docs/quickstart-docs.test.ts` | Created | S-003.1 | Machine leg (extracts `docs/quickstart.md`'s tagged fences, runs the real codegen bin + real test inside a bun-link-installed scratch consumer — REQ-AOD-01/07), install-ritual order checks (REQ-AOD-02), consumer-side `tsc --noEmit` leg with its own scratch `package.json`/`tsconfig.json`/`typescript` devDependency (REQ-AOD-11) |
| `openspec/changes/stage-6-release-shape/walkthrough-record.md` | Created | S-003.3 | Template ONLY (date/reader/verdict/steps/constraint-attestation sections, all placeholders) — owner fills in at steward reckoning per the G-2 ruling; REQ-AOD-08 is NOT discharged by this file's creation |
| `openspec/changes/stage-6-release-shape/apply-progress.md` | Modified | housekeeping | Corrected the S-000 run's Deviations note: 44 → 42 `.d.ts.map` entries (independent recount at `verify-in-loop-1` found 44 was wrong; 42 is what the committed baseline actually held and what S-002.3 cleared) |

## TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-002.1 | `fit-23-publish-workflow-guard.test.ts` (all 8 tests) | architectural | Stubbed every check function to `throw new Error("not implemented — TDD RED checkpoint (S-002.1)")`; module-level `OWNER_REPO = ownerRepoFromPackageJson()` threw at import time, failing the whole file: `error: not implemented — TDD RED checkpoint (S-002.1)` (`0 pass, 1 fail, 1 error`) | ✅ (after implementing real logic; see below) | n/a — shared stub RED (S-000 precedent) | none needed |
| S-002.1 | `fit-23...::REQ-PPH-01.1` + `::REQ-PPH-02.1` | architectural | After restoring real logic, these TWO specifically stayed genuinely red against the UNHARDENED `publish.yml`: `"ok": false, "reason": "no job declares id-token: write in its own permissions block"` and `"unpinned": ["actions/checkout@v4", "actions/setup-node@v4"]` — real pre-hardening evidence, not stub-derived | ✅ (after S-002.2 hardened the workflow files) | n/a — real-file assertion | none needed |
| S-002.1 | `fit-23...::[red-proof] REQ-PPH-01.2/02.2/03.2` + `::collectUsesValues multi-job` | architectural | Passed on first real run (fixture-driven detector tests, correctness proven directly by their own simulated-bad-input assertions) — characterization pattern (repo precedent: fit-15/fit-21/fit-22's "not a behaviour-driving RED/GREEN cycle") | ✅ | multi-job red-proof forces 2-job iteration (`collectUsesValues`) | none needed |
| S-002.1 | `fit-14-package-surface.test.ts::REQ-PPH-06.1` (baseline zero `.d.ts.map`) | architectural | Genuine, unstubbed RED against the committed (stale) baseline: `Expected: [] / Received: [44 → actually 42 items]` (see file diff quoted in the run transcript) | ✅ (after S-002.3 regenerated the baseline) | n/a — baseline-diff assertion | none needed |
| S-002.1 | `fit-14...::REQ-PPH-05.2` (fresh-build zero `.d.ts.map`) | architectural | Passed on first run — `declarationMap:false` already landed at S-000; characterization/regression-lock, not new behavior | ✅ | n/a | none needed |
| S-002.1 | `fit-14...::REQ-FPS-06.1` (dist/core present) | architectural | Passed on first run — unchanged invariant; characterization | ✅ | n/a | none needed |
| S-002.1 | `fit-14...::REQ-FPS-07.1` + `::[red-proof] REQ-FPS-07.2` | architectural | Passed on first run; `scanForSecrets`'s correctness proven directly by the red-proof case (`[...freshTarball, ".env"]` → `[".env"]`) in the same pass | ✅ | red-proof case triangulates against the empty-result case | none needed |

## TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-001.3 | `installed-consumer.e2e.test.ts::checkBinExecutable` (backing REQ-LC-04.1 + both `[red-proof] REQ-LC-04.3` cases) | e2e | Stubbed to `throw new Error("not implemented — TDD RED checkpoint (S-001.3)")`: 3 real failures quoted (`REQ-LC-04.1`, both `REQ-LC-04.3` red-proofs) | ✅ | n/a — shared helper, exercised by 3 call sites | none needed |
| S-001.2 | `installed-consumer.e2e.test.ts::...REQ-LC-03.1` (`./typescript` probe) | e2e | Deliberately flipped the new assertion to `toBe(false)`: `Expected: false / Received: true` | ✅ (reverted to `toBe(true)`) | n/a — single new subpath assertion added to an existing fixed-set check | none needed |
| S-001.3 | `installed-consumer.e2e.test.ts::REQ-LC-05.2` (tarball dry-run) | e2e | Deliberately inflated the threshold to `toBeGreaterThan(999999)`: `Expected: > 999999 / Received: 1` | ✅ (reverted to `toBeGreaterThan(0)`) | n/a — mirrors the already-triangulated S-000 bun-link dry-run case | none needed |
| S-001.1 | `installed-consumer.e2e.test.ts::REQ-LC-02.1` (bun-link write-only commit) | e2e | Deliberately corrupted the expected tree to `{ wrong: "value" }`: real diff quoted (`- {"wrong":"value"} / + {"golden/greeting.ts":"export const greeting = 'hello';"}`) | ✅ (reverted) | n/a — mirrors the tarball leg's already-triangulated case | none needed |
| S-001.1 | `installed-consumer.e2e.test.ts::REQ-LC-02.2` (bun-link all-or-nothing rejection) | e2e | Deliberately corrupted the expected reason to `"wrong-reason"`: `Expected: "wrong-reason" / Received: "path-collision"` | ✅ (reverted) | n/a — mirrors the tarball leg's already-triangulated case | none needed |
| S-001.3 | `installed-consumer.e2e.test.ts::[red-proof] REQ-LC-02.3/05.3` | e2e | Passed on first run — pure logical/documentation-style demonstrations exercising no shared implementation (no stub target); correctness is self-evident from the fixture values asserted directly (same pattern as fit-14's pre-existing `[red-proof]` tests) | ✅ | n/a | none needed |

## TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-003.1 | `quickstart-docs.test.ts::REQ-AOD-01.*/07.1` (machine leg, full pipeline) | e2e | Deliberately corrupted `docs/quickstart.md`'s `factory.test.ts` fence expected value (`3000` → `9999`): real failure — `testResult.status` `Expected: 0 / Received: 1` (real `bun test` exit code inside the scratch consumer) | ✅ (doc reverted) | n/a — end-to-end pipeline test | none needed |
| S-003.1 | `quickstart-docs.test.ts::[red-proof] REQ-AOD-07.2` (writer never src-swaps) | unit | Passed on first run — direct `Function.prototype.toString()` scan of the real writer used by the primary test, no stub needed (the assertion IS the red-proof: it would fail if a future edit introduced a `src/`-relative substitution) | ✅ | n/a | none needed |
| S-003.1 | `quickstart-docs.test.ts::REQ-AOD-11.1` (consumer tsc leg) | e2e/typecheck | Deliberately flipped the expected exit status to `1`: `Expected: 1 / Received: 0` (real `tsc --noEmit` exit code from the scratch consumer's own installed `typescript`) | ✅ (reverted to `0`) | n/a | none needed |
| S-003.1 | `quickstart-docs.test.ts::[red-proof] REQ-AOD-11.2` (broken field reference) | e2e/typecheck | Passed on first run — the assertion IS the red-proof: real `tsc` invoked against a deliberately-broken `factory.ts` (`input.serviceName` → `input.doesNotExist`), asserting non-zero exit + `"doesNotExist"` in output; genuinely exercises the real compiler each run | ✅ | n/a | none needed |
| S-003.1 | `quickstart-docs.test.ts::REQ-AOD-02.1/.2` (install-ritual order) | unit | Passed on first run — static text-order/absence checks against `docs/quickstart.md` as authored; characterization of the doc's own structure, no implementation to drive | ✅ | n/a | none needed |

## Safety Net (Phase 0 / refactor verification)

- Full baseline suite at the START of this run (`bun test`, before any change): 1061 pass / 1 fail (the known `fit-14` interim red) — matches the inherited state exactly.
- After S-002 alone: 1075 pass / 0 fail. `tsc --noEmit`: clean.
- After S-001 added on top: 1083 pass / 0 fail. `tsc --noEmit`: clean.
- After S-003 added on top: initially **1084 pass / 5 fail** — a REAL cross-file bug (see Deviations: `scratch-consumer.ts`'s scratchDir-ignoring memoization), reproduced deterministically with `bun test test/e2e/installed-consumer.e2e.test.ts test/docs/quickstart-docs.test.ts` alone. Fixed in `test/support/scratch-consumer.ts`.
- Final full suite (`bun test`), run 3 times consecutively for stability: **1089 pass / 0 fail** every time. `tsc --noEmit`: clean every time.
- Global bun-link store verified clean after the final run: no `@pbuilder/sdk` symlink under `~/.bun/install/global/node_modules/@pbuilder/` (an empty `@pbuilder/` scope directory persists — `bun unlink` does not remove the empty parent scope dir; this is pre-existing `bun unlink` behavior, not a leak, and matches what S-000 already observed).
- No leftover `.tmp-*` scratch directories in the repo root after the final run.

## Deviations from Design

- **Fitness-test renumbering (S-002.1)**: the design/ADR-0042/slices.md all name the new test `fit-21-publish-workflow-guard.test.ts`, based on plan-verify iteration 1's confirmation that `fit-20` was the highest existing FIT number. Between plan-verify and this apply run, `main` gained `fit-21-context-no-dialect-handle-import.test.ts` (from `stage-5b-dialect-breadth`) and `fit-22-scaffold-leaf-rule.test.ts` (from `schematic-local-files`) — both unrelated to publish-pipeline hardening. Per slices.md's own Executor Context ruling ("trust the repo, not this doc, if they ever diverge again"), the new test was created as `fit-23-publish-workflow-guard.test.ts` instead — same content, coverage, and REQ-IDs, just the next ACTUALLY-free FIT number. `design.md` and ADR-0042 still say `fit-21` in prose; this apply-progress entry and the `slices.md` task note are the authoritative correction. No REQ coverage or test content changed — filename only.
- **Cross-file bug found and fixed in `test/support/scratch-consumer.ts` (in-slice, not scope creep)**: `ensurePackedConsumer`/`ensureLinkedConsumer` memoized a single module-level promise, silently ignoring the `scratchDir` parameter on a cache hit. This was invisible through S-000/S-001 (only one caller, `installed-consumer.e2e.test.ts`, ever invoked `ensureLinkedConsumer`). S-003's `quickstart-docs.test.ts` became a SECOND caller with a different scratch dir (`.tmp-quickstart-machine-leg` vs `.tmp-link-e2e`) — because ES module state is shared process-wide across ALL test files in one `bun test` run, whichever file's call landed first silently "won" the scratch dir, and the other file's scripts then wrote into a directory that was never created (`ENOENT`). Reproduced deterministically (not a timing race — pure call-order determinism) with just the two affected files. Fixed by keying both memoizations with a `Map<string, Promise<void>>` and splitting the bun-link path into a separately-memoized `ensureProducerLinked()` (reset by `unlinkSdk()`) plus per-`scratchDir` consumer setup, so any file's teardown never strands another file's still-running tests regardless of file execution order. Verified: the two previously-colliding files pass together, the full suite passes 3x consecutively, and the global link store is clean afterward. This is a bug fix to shared plumbing my own new test exposed — within the craftsman preamble's Boy Scout rule (a genuine correctness bug, not a style cleanup), not scope creep.
- **TDD-cycle technique for parity/characterization tests (S-001, S-003)**: several new tests in S-001/S-003 prove PARITY (bun-link leg reproducing tarball-leg behavior that already exists) or CHARACTERIZE already-correct state (e.g., `declarationMap:false`'s effect, already landed at S-000) rather than driving new `src/` behavior — there is no new implementation for these to drive RED against. Where a real detector/helper function was new (`checkBinExecutable`, the `fit-23` check functions), it was stubbed-and-restored for genuine RED evidence. Where the test asserts against ALREADY-correct real-world/doc state with no new detector to stub, RED evidence was captured by deliberately inverting the test's own expected literal, running to observe a REAL failure (never fabricated), then reverting to the correct value — consistent with the technique S-000 already established in this same change (`apply-progress.md`'s S-000 "Process note") for its own parity scenarios. A small number of genuinely self-contained logical/documentation-style red-proofs (REQ-LC-02.3, REQ-LC-05.3, REQ-AOD-02.1/.2) needed neither stub nor inversion — their correctness is directly evident from the fixture values they assert, the same characterization pattern this repo already established for fitness functions (cited per-row above, precedent: `fit-15`/`fit-21`/`fit-22`, `fit-14`'s own pre-existing `[red-proof]` tests).
- **No src/ changes.** S-001 and S-003 are entirely test/doc additions; S-002 touches only `.github/workflows/*.yml` and `test/fitness/*` — no `src/` file was modified across this run, matching the design's "Stage 6 adds NO runtime behaviour to `src/`" framing (§4.1).

## Halt / Issues Found

None — the cross-file bug above was found and fixed in-loop, not escalated (contained, single shared test-support file, verified by full-suite + repeat-run stability).

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 3 |
| Slices complete | 3 |
| Slices in progress | 0 |
| Tasks complete | 9/9 |
| Full suite (final) | 1089 pass / 0 fail, 3x stable |
| Typecheck (final) | clean |

## Next Step

S-000, S-001, S-002, S-003 all complete. Ready for `/build --scope=slice:S-004` (requires S-003, now satisfied) — S-005 remains blocked on both S-002 and S-004 per Build Order. Per the launch instructions, S-004/S-005 are explicitly OUT of this run's scope and were not started.

---

# Apply Progress — Run 3: S-004 (Build Order group 3)

**Scope this run**: `slice:S-004` · **Mode**: Strict TDD

## Slices Built This Run

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-004 | happy-path | complete | 3/3 |

## Files Changed

| File | Action | Slice | What Was Done |
|---|---|---|---|
| `test/docs/doc-set-content.test.ts` | Created | S-004.1 | New: static token-presence scans over the four new reference docs + README (REQ-AOD-03/04/05/06, REQ-FPS-06.2) — no execution, no scratch consumer (design's Test Derivation table marks this REQ cluster `unit`) |
| `docs/authoring-verbs.md` | Created | S-004.2 | Documents all seven current author verbs (`create`/`modify`/`remove`/`rename`/`move`/`copy`/`copyIn`) + the `find().read()` read-trichotomy (`absent`/`empty`/`present`) + `classifyContent()`; links `authoring-errors.md`/`dry-run.md`/`authoring-a-dialect.md` |
| `docs/authoring-errors.md` | Created | S-004.2 | Documents `AuthoringError`'s `verb`/`path`/`reason`/`origin`/`appliedCount` fields and all twelve current `reason` values, in author vocabulary only — no wire-level/`EmitRejection`/`Directive`/`Batch`/bare-`delete` terminology |
| `docs/dry-run.md` | Created | S-004.2 | Documents `dryRun()` imported from `@pbuilder/sdk/commons` (not a subpath), buffer-drain-on-read semantics, iterating `DryRunEntry[]` |
| `docs/README.md` | Created | S-004.2 | Doc index — reading path (quickstart → verbs → errors → dry-run → dialect); links `authoring-a-dialect.md` rather than duplicating it (council decision DR-3 filenames) |
| `README.md` | Modified | S-004.3 | Added quickstart link + doc-index link near the top; added `dist/core/**` document-not-strip rationale bullet to "Design at a glance" (REQ-FPS-06.2) |

## TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-004.1 | `doc-set-content.test.ts::REQ-AOD-03.1` + `::REQ-AOD-04.1` + `::REQ-AOD-05.1` (both) + `::REQ-AOD-06.1/.2` | unit | Genuine ENOENT before the docs existed: `error: ENOENT: no such file or directory, open '.../docs/authoring-verbs.md'` (and identically for `authoring-errors.md`, `dry-run.md`, `docs/README.md`) — same "the throw IS the RED evidence" precedent `testing-story-docs.test.ts`'s `extractTestingSection()` established for missing markdown content | ✅ | n/a — fixed six/twelve-token sets, spec-bounded (REQ-AOD-03/05) | none needed |
| S-004.1 | `doc-set-content.test.ts::REQ-FPS-06.2` + `::README front-door` (both) | unit | Genuine assertion failure against the UNMODIFIED `README.md`: `expect(received).toContain(expected) / Expected to contain: "dist/core"` (and identically for `"docs/quickstart.md"`, `"docs/authoring-a-dialect.md"`) | ✅ (after README.md edits) | n/a — fixed-string presence checks, spec-bounded | none needed |
| S-004.1 | `doc-set-content.test.ts::assertNoWireInternalTerms` (backing `REQ-AOD-05.1`'s wire-term-absence check) | unit | Deliberately appended `"Internal note: never mention EmitRejection here."` to `authoring-errors.md`: real failure — `expect(received).not.toContain(expected) / Expected to not contain: "EmitRejection"` (genuine string match against the corrupted file, then reverted) | ✅ (after revert) | 1 case — proves the ban helper actually fires rather than passing vacuously (the helper has real branching logic: string vs. regex terms) | none needed |

## Post-Slice Audit

Diff scoped to `git status --short` for this run: only `docs/authoring-verbs.md`, `docs/authoring-errors.md`,
`docs/dry-run.md`, `docs/README.md` (new), `README.md` (modified), `test/docs/doc-set-content.test.ts` (new) —
exactly the design §4.2 File Changes rows for S-004, no `src/` file touched. Matches design §4.2c's
pre-declared `docs/` touchpoint (`aligns`). No findings.

## Safety Net (Phase 0 / refactor verification)

- Full baseline suite at the START of this run (`bun test`): 1089 pass / 0 fail (matches the inherited state exactly — Run 2's final count).
- `tsc --noEmit` (repo root tsconfig) at the START of this run: clean.
- Full suite after S-004 (`bun test`), run 3 times consecutively for stability: **1099 pass / 0 fail** every time (1089 + 10 new). `tsc --noEmit`: clean every time.

## Deviations from Design

- **Vocabulary-count drift (verb/reason enumeration), same category as S-002's fit-23 rename**: the plan's Executor Context item 6 (dated 2026-07-12, plan-verify iteration 1) recorded `AuthoringVerb` at six values and `AuthoringReason` at eight. `schematic-local-files` merged into `main` afterward (visible in this branch's own git log — `5b05221` and prior merges) and extended them: `AuthoringVerb` gained `copyIn` (seven total, ADR-0043) and `AuthoringReason` gained four `source-*` values (twelve total, REQ-AEC-10). Per slices.md's own Executor Context preamble ("trust the repo, not this doc, if they ever diverge again" — already invoked once for S-002), `authoring-verbs.md` documents all seven current verbs and `authoring-errors.md` documents all twelve current reasons — REQ-AOD-03's six named verbs are a floor the doc's seven satisfy as a superset; REQ-AOD-05.1 does not fix a reason count at all (only requires the `verb`/`path`/`reason` field names), so documenting the true current vocabulary is a judgment call, not a spec violation. `doc-set-content.test.ts` and `slices.md`'s S-004 task note record this correction; `design.md`/`slices.md` Executor Context still say six/eight in prose.
- **Wire-term ban list scoped to avoid a false-positive on legitimate author vocabulary**: the Executor Context's suggested ban list ("`delete`/`collision`/`EmitRejection`") is imprecise — the author-facing reason `path-collision` legitimately CONTAINS the substring `"collision"` (the wire-level `EmitRejectionCode` is the bare word `"collision"`), so a literal ban on that substring would also reject the correct, REQUIRED author term. This was already latent in the plan's own guidance once reasons are enumerated at all (even at the plan's original eight-value count, `"path-collision"` was already one of them). The actual ban list implemented is `["EmitRejection", "Directive", "Batch", /\bdelete\b/]` — the wire-internal class/type names plus the word-boundary-scoped wire op word — which satisfies REQ-AOD-05.1's literal text ("no wire-level/IR-batch terminology appears") without rejecting the required author vocabulary. Triangulated with a genuine inject-and-revert RED (see TDD Cycle Evidence table).
- **No `src/` changes.** S-004 is entirely doc + one new unit test — matches the design's "Stage 6 adds NO runtime behaviour to `src/`" framing (§4.1) and this slice's own binding constraint.

## Halt / Issues Found

None.

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 3/3 |
| Full suite (final) | 1099 pass / 0 fail, 3x stable |
| Typecheck (final) | clean |

## Next Step

S-000 through S-004 all complete. Ready for `/build --scope=slice:S-005` (requires S-002 + S-004, both now satisfied) — the only remaining slice per Build Order. Per the launch instructions, S-005 was explicitly OUT of this run's scope and was not started.

---

# Apply Progress — Run 4: S-005 (final slice, Build Order group 4)

**Scope this run**: `slice:S-005` · **Mode**: Strict TDD

## Slices Built This Run

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-005 | edge-case | complete | 2/2 |

## Files Changed

| File | Action | Slice | What Was Done |
|---|---|---|---|
| `test/docs/doc-set-content.test.ts` | Modified | S-005.1 | Added 10 new tests (5 new `describe` blocks) for REQ-AOD-09.1/.2/.4/.5/.6, REQ-AOD-09.3, REQ-AOD-10.1, REQ-AOD-12.1/.2/.3 — static content scans over the five planning docs, same unit-layer/no-execution style as S-004's tests. New `findRowLine`/`lastTableCell` helpers locate pending-changes.md rows BY CONTENT (never by line number, per slices.md's Executor Context item 9) |
| `ROADMAP.md` | Modified | S-005.2 | Added a "Stage 6 — release shape (2026-07-14)" note stating Stage 6 delivers RELEASE-READINESS, not a release, with the first LIVE publish deferred to a separate future gate (REQ-AOD-09.3) |
| `openspec/pending-changes.md` | Modified | S-005.2 | RETIRED rows 27/33/34/35/86/143 (struck through + `RETIRED — \`stage-6-release-shape\`` marker, Gating/Stage columns closed) — REQ-AOD-09.1; RE-TAGGED row 74 away from Stage 6 to the cross-repo engine-gated bucket (PC-PROTO-01) — REQ-AOD-09.2; RE-TAGGED rows 56/142 to the PC-PROTO-01/public-package bucket — REQ-AOD-09.4; RE-POINTED row 175's trigger at the sdk-kit extraction/public-package plan, superseding its V1 wording — REQ-AOD-09.5; added a new entry recording the GitHub Environment required-reviewers gate as a MANDATORY precondition of removing `--dry-run` (go-live), deferred to the public-package plan — REQ-AOD-09.6 |
| `openspec/problem-statement.md` | Modified | S-005.2 | Added a "Release posture (Stage 6 note, 2026-07-14)" section cross-referencing ROADMAP's Stage 6 note and pending-changes.md's required-reviewers precondition — ties the three planning docs into the "mutually consistent" framing REQ-AOD-09's Purpose text names (no scenario tests this file directly; L2+ out-of-scope was already correct pre-change, confirmed by direct read) |
| `openspec/objectives-plan.md` | Modified | S-005.2 | Reordered the demo-moment paragraph: `dryRun()` now shown BEFORE the dialect handle is opened (was: dialect add-import shown before the dry-run plan, which under eager-flush would show a partial plan) — REQ-AOD-10.1 |
| `openspec/sensitive-areas.md` | Modified | S-005.2 | Deployment row: confidence low→medium, `.github/workflows/publish.yml` added to paths, hardened posture noted (SHA-pins, repo-owner guard, trigger-surface restriction) — REQ-AOD-12.1. Supply-chain row: added `dist/core/**` ship-not-strip note (REQ-FPS-06) + SHA-pin convention note (REQ-PPH-02) — REQ-AOD-12.2. "Review Required" paragraph: "Most rows" → "All rows", removed `deployment` from the lower-confidence list (now stale after the promotion above), `security (IPC)` is now the sole remaining lower-confidence row — REQ-AOD-12.3 |

## TDD Cycle Evidence — S-005

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-09.1` (rows 27/33/34/35/86/143 retired) | unit | `expect(received).toContain(expected) / Expected to contain: "~~" / Received: "\| W3 · \`publish.yml\` repo-owner guard ... \| **6.2** \|"` (real unmodified row) | ✅ | 6 fragments in one loop + an exact-count(6) marker assertion — n/a further, fixed 6-row set per REQ-AOD-09.1 | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-09.2` (row 74 re-tagged) | unit | `expect(received).not.toMatch(expected) / Received: "\| EmitRejection port conformance ... \| **Stage-6 gating** \| **6** \|"` (real unmodified row, Stage cell literally `**6**`) | ✅ | n/a — single-row structural check | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-09.4` (rows 56/142 re-tagged) | unit | `expect(received).toBe(expected) / Expected: "PC-PROTO-01 / public-package plan" / Received: "6"` (row 56's real Stage cell) then, after fixing the fragment-casing/Stage-cell-extraction bug in the test itself (see Deviations), a second genuine RED against the real unmodified rows | ✅ | 2 rows in one loop, both real Stage-cell assertions | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-09.5` (row 175 re-pointed) | unit | `expect(received).toBe(expected) / Expected: "sdk-kit extraction / public-package plan" / Received: "next 0.x result-shape iteration"` (row 175's real Stage cell) | ✅ | n/a — single-row Stage-cell check | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-09.6` (new required-reviewers entry) | unit | `expect(received).toContain(expected) / Expected to contain: "GitHub Environment required-reviewers gate" / Received: <full unmodified pending-changes.md, no match>` | ✅ | n/a — presence check for a wholly new row | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-09.3` (ROADMAP Stage 6 note) | unit | `expect(received).toContain(expected) / Expected to contain: "delivers RELEASE-READINESS, not a release" / Received: <full unmodified ROADMAP.md, no match>` | ✅ | n/a — new-paragraph presence check | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-10.1` (dryRun before dialect handle) | unit | `expect(received).toBeGreaterThan(-1) / Expected: > -1 / Received: -1` (the string `"dialect handle"` was absent from the unmodified demo-moment paragraph — the paragraph interleaved the dialect add-import before the dry-run plan) | ✅ | n/a — ordering check within one fixed paragraph | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-12.1` (deployment row low→medium) | unit | `expect(received).toContain(expected) / Expected to contain: ".github/workflows/publish.yml" / Received: "\| deployment \| \`.github/workflows/\`, npm publish \| low \| ... \|"` (real unmodified row) | ✅ | n/a — single-row multi-field check | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-12.2` (supply-chain row notes) | unit | `expect(received).toContain(expected) / Expected to contain: "dist/core/**" / Received: "\| security (supply-chain) \| ... \|"` (real unmodified row, no dist/core/REQ-FPS-06/REQ-PPH-02 mention) | ✅ | n/a — single-row multi-field check | none needed |
| S-005.1 | `doc-set-content.test.ts::REQ-AOD-12.3` (Review Required correction) | unit | `expect(received).not.toMatch(expected) / Received: "## Review Required\n\nMost rows above ... \`security (IPC)\` and \`deployment\` remain lower-confidence; ..."` (real unmodified section, matches the banned pattern) | ✅ | n/a — section-scoped negative-pattern check | none needed |

## Post-Slice Audit

Diff scoped to `git status --short` rows touched by THIS run: `ROADMAP.md`, `openspec/objectives-plan.md`,
`openspec/pending-changes.md`, `openspec/problem-statement.md`, `openspec/sensitive-areas.md`,
`test/docs/doc-set-content.test.ts` (test-only addition to an S-004-created file) — no `src/` file
touched, matching design §4.1's "Stage 6 adds NO runtime behaviour to `src/`" framing and design §4.2's
File Changes row for this slice (`doc-set-content.test.ts` create/extend + the five planning-doc Modify
rows). Matches design §4.2c's pre-declared touchpoints (`aligns`). No findings.

## Safety Net (Phase 0 / refactor verification)

- Full baseline suite at the START of this run (`bun test`): 1099 pass / 0 fail (matches the inherited state exactly — Run 3's final count). `tsc --noEmit`: clean.
- New tests run in isolation before implementation (RED): `bun test test/docs/doc-set-content.test.ts` → 10 pass (pre-existing S-004 tests) / 10 fail (all 10 new S-005 tests, each failing on a genuine assertion mismatch against the real unmodified planning docs — no import/syntax errors, no test passing on first run).
- New tests run in isolation after implementation (GREEN): `bun test test/docs/doc-set-content.test.ts` → 20 pass / 0 fail.
- Full suite after S-005 (`bun test`), run twice consecutively for stability: **1109 pass / 0 fail** both times (1099 + 10 new). `tsc --noEmit`: clean both times.

## Deviations from Design

- **Test self-correction, not a design deviation**: two of the ten new tests (REQ-AOD-09.4, REQ-AOD-09.5) initially used whole-line substring checks (`toContain`) for the re-tag assertions. The first GREEN attempt surfaced two bugs in the TEST CODE itself, caught before returning: (a) row 56's search fragment `"confirm \`BATCH_CAP_BYTES\`"` no longer matched after the doc edit capitalized the sentence-initial word (`"Confirm"`) once the stale "Stage 6 —" prefix was dropped; (b) row 175's `not.toContain("next 0.x result-shape iteration")` check was too strict against the whole line — the doc edit legitimately preserves that V1 wording in a parenthetical ("superseding the V1 ... trigger") for reader context, per REQ-AOD-09.5's own text ("superseding the V1 wording"), not just deleting it. Fixed by adding a `lastTableCell()` helper that extracts and un-bolds the Stage-tag cell specifically (the column REQ-AOD-09.4/.5 actually govern), and switching those two assertions to exact `toBe()` checks against the Stage tag alone — description prose is free to reference superseded wording for context, only the Stage TAG itself must change. Re-ran RED (genuine failures against the real unmodified rows, quoted in the evidence table above) before GREEN. No production/planning-doc content was altered by this fix — test-code-only.
- **`openspec/problem-statement.md` edited without a driving test-case**: design's §4.2 File Changes table lists this file as `Modify | consistency with release-readiness posture (REQ-AOD-09)`, but none of REQ-AOD-09's six numbered scenarios name this file (only `ROADMAP.md` and `openspec/pending-changes.md` do) — REQ-AOD-09's own Purpose sentence does name "the Stage 6 problem statement" as one of three docs that "MUST be mutually consistent," but the concrete assertable claims in that sentence (retire/re-tag rows, ROADMAP milestone wording) all resolve to the other two files. Direct read confirmed the file was ALREADY consistent (no release claim anywhere in it; "L2+ explicitly out of scope" was already true verbatim in its existing "Out of scope" section — no edit needed for that clause). Added a small, honest cross-reference section anyway ("Release posture (Stage 6 note, 2026-07-14)") to complete the tri-doc consistency the design's file-changes row calls for, rather than leaving a `Modify`-declared file untouched. Not TDD-driven (no scenario to fail first) because there was no incorrect content to make a test fail against — documented here per the "if you discover the design asks for something the spec doesn't scenario-cover, halt and report" principle; judged non-blocking since the content added is factually true and additive, not a behavior claim needing a red-green cycle.
- **No `src/` changes.** S-005 is entirely planning-doc edits + one test-file extension, matching design's "Stage 6 adds NO runtime behaviour to `src/`" framing (§4.1) and this slice's own binding constraint (edge-case/Data dimension, planning-doc reconciliation only).
- **AOD-08 still not discharged by this run** (expected, per the G-2 ruling in slices.md): the human walkthrough record stays a template; REQ-AOD-08 is a steward-reckoning deliverable, not a `/build` deliverable. Unrelated to S-005's scope but noted here since S-005 is the last `/build` slice and a future reader might otherwise assume "all slices complete" implies AOD-08 is discharged.

## Halt / Issues Found

None.

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 2/2 |
| Full suite (final) | 1109 pass / 0 fail, 2x stable |
| Typecheck (final) | clean |

## Next Step

S-000 through S-005 — ALL SIX slices — now complete. This change's `/build` work is finished. Ready for `/evaluate` (verify --mode=final). Reminder for the Planner: REQ-AOD-08 (human walkthrough) is a steward-reckoning deliverable per the G-2 ruling — `walkthrough-record.md` stays a template until the owner (or a designated fresh reader) actually completes it; do not read "verify-final pass" as "AOD-08 discharged."

# Apply Progress — Run 5: post-final-verify council fixes (non-blocking WARNINGs)

**Scope this run**: fix executor pass after `sdd-verify --mode=final` returned pass-with-followups — the council raised non-blocking WARNINGs the orchestrator ruled worth fixing before adversarial review. No new slices; all six slices from Runs 1-4 stayed complete and untouched in scope.

## Findings → Fixes

| # | Finding (council persona) | Fix | Evidence |
|---|---|---|---|
| F1 | `fit-23-publish-workflow-guard.test.ts`'s repo-owner guard only checked the FIRST job with `id-token: write`; no assertion locked the "no fork-reachable trigger ever gets id-token: write" posture (architect + qa) | (a) Renamed `findJobWithIdTokenWrite` → `findJobsWithIdTokenWrite`, returning ALL matching jobs; `checkRepoOwnerGuard` now loops and fails on the first unguarded one. (b) Added `hasForkReachableTrigger`/`declaresIdTokenWriteAnywhere` + a test scanning every file in `.github/workflows/*.yml`, asserting no `pull_request`/`pull_request_target`/`workflow_dispatch`-triggered workflow carries `id-token: write` at workflow OR job level. Added 2 red-proofs (multi-job flank, workflow_dispatch+workflow-level token). | `test/fitness/fit-23-publish-workflow-guard.test.ts`: 8 → 11 tests, all green. `bun test test/fitness/fit-23-publish-workflow-guard.test.ts` → 11 pass / 0 fail |
| F2 | `assertNoWireInternalTerms` only scanned `docs/authoring-errors.md`; the wire-term ban should hold across the whole author-facing doc set (qa) | Added a new `describe` looping `assertNoWireInternalTerms` over `docs/quickstart.md`, `docs/authoring-verbs.md`, `docs/authoring-errors.md`, `docs/dry-run.md`, `docs/README.md`. Pre-scanned with `rg` for `Directive`, `Batch`, `EmitRejection`, `\bdelete\b` across the four new docs BEFORE adding assertions — zero hits, so no legitimate-usage exception/allowlist was needed; the ban stays global. | `rg` scan: 0 hits in all 4 docs for all 4 banned terms. `test/docs/doc-set-content.test.ts`: 20 → 25 tests, all green |
| F3 | E2E scratch dirs (`.tmp-testing-e2e`, `.tmp-link-e2e`, `.tmp-quickstart-*`) and packed tarballs (`*.tgz`) were not gitignored (security) | Added `.tmp-*/` and `*.tgz` to `.gitignore` | `git check-ignore .tmp-testing-e2e/ .tmp-link-e2e/ .tmp-quickstart-machine-leg` (as real dirs) → all 3 print/ignored, exit 0; `git check-ignore foo.tgz` → `foo.tgz`, exit 0 |
| F4 | Three cross-links said "the six directives" while `authoring-verbs.md`'s own heading says "The seven verbs" (tech-writer W1) | `docs/quickstart.md:116`, `docs/authoring-errors.md:86`, `docs/dry-run.md:46`: "the six directives" → "the seven authoring verbs" (quickstart.md's parenthetical verb list also extended to include `copyIn`, closing a would-be new six-vs-seven mismatch). `docs/authoring-verbs.md:9-10`: body rewritten from "six directive-shaped verbs ... plus `copyIn`" to "seven author verbs ... the last a by-reference sibling of `copy`" — count now reads seven everywhere, `docs/README.md:8` (already seven) untouched | `rg -n 'the six directives\|The seven verbs\|six directive'` → only the (now-updated) heading and body remain, no stale "six" phrasing left. `doc-set-content.test.ts` REQ-AOD-03 (verb presence, not wording) still green |
| F5 | `docs/authoring-errors.md`'s leading example called `run(options, { client })` directly — `client` is not publicly obtainable (verified: `src/testing/index.ts`'s `RecordingClient` is an unexported local structural port) (tech-writer W2) | Replaced the leading example with the harness-first pattern: `runFactoryForTest(run, input)` → `result.error instanceof AuthoringError` → `switch (result.error.reason)`. Added a one-line note: "Calling the runner directly throws; `runFactoryForTest` captures the same `AuthoringError` on `result.error`." Verified `runFactoryForTest`'s signature and `RunResult.error: AuthoringError \| unknown` typing against `src/testing/index.ts` before writing | `bun test test/docs/doc-set-content.test.ts` → 25 pass / 0 fail (REQ-AOD-05.1's `AuthoringError`/`verb`/`path`/`reason` token assertions and the wire-term ban all still pass against the rewritten example) |
| F6 | README front-door and `package.json` description both listed the wire-level op `delete` instead of the author verb `remove` (tech-writer N1) | `README.md:17`: "(create, delete, move, rename, copy, modify)" → "(create, remove, move, rename, copy, modify)". `package.json`'s `description`: "(create, delete, move, rename, modify)" → "(create, remove, move, rename, modify)" | `rg -n '\bdelete\b' README.md package.json` → no hits in either after the edit (only file-mutation-verb context checked, not incidental prose) |
| F7 | (a) quickstart.md's generated-output snippet didn't show the real `@schema-digest` line the emitter writes (b) no note on why `defineFactory` ships from `./testing` rather than a core entry (tech-writer N2+N3) | (a) Checked `bin/emit-type.ts::emitInputType` — confirmed it emits `// @schema-digest sha256:${digest}` as line 2 followed by a blank line before `export type Input`; added that line (elided digest `sha256:…`) to the snippet, matching the real emission shape. (b) Added one sentence after the `factory.ts` step: "`defineFactory` currently ships from `./testing`; it will graduate to a core entry once an engine-backed surface lands." | `bun test test/docs/quickstart-docs.test.ts` → 6 pass / 0 fail (the digest line lives in a non-`filename=`-annotated fence, so it is never extracted/executed by the machine leg — confirmed by re-reading `extractFencedFiles`'s regex before editing) |

## Verification

- `bun test test/fitness/fit-23-publish-workflow-guard.test.ts` → 11 pass / 0 fail (was 8)
- `bun test test/docs/doc-set-content.test.ts` → 25 pass / 0 fail (was 20)
- `bun test test/docs/quickstart-docs.test.ts` → 6 pass / 0 fail (unchanged count, still green after F5/F7 edits)
- Full suite (`bun test`), run twice consecutively for stability: **1117 pass / 0 fail** both times (1109 inherited + 8 new: 3 in fit-23, 5 in doc-set-content)
- `bun run typecheck` → clean, exit 0
- `git check-ignore` proof for F3 (see table above)

## Not in Scope (untouched, per instruction)

ROADMAP §3 "Five authoring verbs" table (unreconciled-direction file, tracked debt); tarball-baseline backstop; `bun-version` pin; content-aware secret scan; `design.md`/ADR-0042 fit-21 prose (archive drift-sync).

## Halt / Issues Found

None.

## Overall Progress (Run 5)

| Metric | Value |
|---|---|
| Fixes applied | 7/7 (F1-F7) |
| Full suite (final) | 1117 pass / 0 fail, 2x stable |
| Typecheck (final) | clean |

## Next Step

Ready for adversarial review (judgment-day) / `/evaluate` archive gate — all council WARNINGs from the final-verify pass are now resolved.

# Apply Progress — Run 6: walkthrough outcome-gap fix

**Scope this run**: fix executor pass responding to an `outcome-gap (not-usable)` finding from the OWNER's human walkthrough (REQ-AOD-08 / G-2, `walkthrough-record.md`, verdict FAIL), plus four follow-on findings (#2/workspace, #4/bun:test types, #5/filename discoverability) surfaced from the SAME walkthrough while this run was in progress. The owner followed `docs/quickstart.md` exactly and got stuck at step 4 (writing the factory) with `ts(2307) Cannot find module '@pbuilder/sdk/commons'`, couldn't tell where to create `schema.json` ("Is it a new folder? ... do I need to init with a package.json and a tsconfig?"), and — once past those — would have hit a SECOND `ts(2307)` on `bun:test` and never known what to name any of the four files the guide has them create (fence `filename=` info-strings are invisible in standard markdown renderers). No new slices; TDD strict mode throughout: guard tests extended FIRST (RED) for every finding, doc fixed second (GREEN).

## Root Causes (all verified empirically, not asserted)

1. **Missing consumer `tsconfig.json`.** The quickstart never instructed creating one. Without it, TypeScript uses legacy (node10) module resolution, which cannot read `@pbuilder/sdk`'s `exports` map — the ONLY route to its five subpaths (`./testing`, `./commons`, etc.). Step 5's `factory.ts` also imports `./schema.generated.ts` WITH the `.ts` extension, requiring `allowImportingTsExtensions`. The machine leg (`test/docs/quickstart-docs.test.ts` REQ-AOD-11) never caught this because it wrote a hardcoded tsconfig into the scratch consumer itself — the harness silently provisioned what the doc never taught.
2. **Undefined consumer workspace.** Step 1 said "inside your own package" without ever saying to create a folder, whether `bun init` was needed, or where `schema.json`/`factory.ts`/`factory.test.ts` live relative to each other.
3. **Missing `@types/bun` + `types: ["bun"]`.** Step 6's `factory.test.ts` imports from `"bun:test"`. Empirically verified: with `types: []` (my own first-pass fix, copied from the pre-existing harness config) OR with `types` omitted entirely, `tsc` reports `Cannot find module 'bun:test'` even with `@types/bun` installed — only an explicit `types: ["bun"]` resolves it under `NodeNext`/`bundler` resolution. This means my OWN first tsconfig draft, copied verbatim from the harness, would have broken the reader at exactly the step it was meant to unblock. The pre-existing REQ-AOD-11 tsc leg never caught this because it only ever typechecked `factory.ts`, never `factory.test.ts`.
4. **Filenames invisible to human readers.** `schema.json`/`factory.ts`/`factory.test.ts`/`tsconfig.json` existed ONLY as fenced-block `filename=` info-string metadata — standard markdown renderers (GitHub, editor previews) never display that string, so a reader following the rendered page never learns what to name the files, while later steps assume `./factory.ts` and `bun test factory.test.ts`. The machine leg is immune (`extractFencedFiles` keys on `filename=` directly), which is why this stayed machine-invisible too — same family as root causes 1 and 3: metadata the MACHINE consumes but the HUMAN never sees.

**Secondary claim investigated and found FALSE**: the brief hypothesized bare `pbuilder-codegen .` (as literally shown in the codegen step) would not resolve on PATH from a plain consumer shell. Empirically verified otherwise: `bun link` (producer side, step 1's `bun run link:sdk`) registers the package's bin globally at `~/.bun/bin/pbuilder-codegen`, which is on PATH by default for any standard bun install (same directory the `bun` executable itself lives in — this suite's own tests already rely on bare `bun` resolving via PATH). Confirmed via `which pbuilder-codegen` (resolved) and a real invocation in an empty scratch folder (exit 0). **No change made to the codegen invocation** — it already matches reality. A regression-guard test pins this (asserts bare-PATH resolution, no explicit `.bin` path), documented as already-passing, not a RED→GREEN transition.

## Fix Protocol (TDD, all 4 root causes)

Extended `test/docs/quickstart-docs.test.ts` with a new describe block, `walkthrough outcome-gap fix (G-2, REQ-AOD-01/07/11)`, containing 6 assertions — every doc change was RED before it was made (each temporarily reverted and re-run to confirm):

1. tsconfig.json fenced block present, `moduleResolution` ∈ {bundler, NodeNext}, `allowImportingTsExtensions: true`, `types` containing `"bun"`, positioned BEFORE the factory fence. RED evidence: `expect(files.has("tsconfig.json")).toBe(true)` → `Expected: true, Received: false`; later `expect(parsed.compilerOptions?.types).toContain("bun")` → `Expected to contain: "bun", Received: []` (against my own first-pass `types: []` draft).
2. the consumer workspace (new folder via `mkdir`, no separate `bun init`, all four files named) established in step 1, before the schema step. RED evidence: `expect(step1).toContain("mkdir")` → `Received: "## 1. Install\n\n### \`bun link\` (recommended)..."` (no `mkdir` anywhere in the original step 1).
3. `@types/bun` install instruction present in step 2, before the schema step. RED evidence: `expect(step2).toMatch(/bun add -d[^\n]*@types\/bun/)` → failed against the tsconfig-only step 2 (no types-install line yet).
4. prose (not just the fence `filename=` info-string) names each of the four files immediately before its own code block. RED evidence: `expect(precedingProse).toContain("\`factory.ts\`")` → `Received: "...## 5. Write your factory\n\n\`\`\`ts "` (fence launched straight into code, no lead-in sentence).
5. the shown codegen command resolves via bare PATH lookup in a fresh consumer shell (already green — see secondary-claim note above).

**Doc fix** (`docs/quickstart.md`):
- Step 1 ("Install") opens with `mkdir my-factories && cd my-factories`, states this folder is "your own package" for the rest of the guide (naming all four files that end up in it), and states `bun link` creates a minimal `package.json`/`node_modules` itself — no separate `bun init` needed.
- Step 2 ("Configure your consumer"): `bun add -d typescript @types/bun`, then a copy-pasteable `tsconfig.json` fenced block (`filename=tsconfig.json`) with `types: ["bun"]`, and prose explaining all THREE load-bearing settings (`moduleResolution`, `allowImportingTsExtensions`, `types`) — including why `types: ["bun"]` specifically, not `[]` or omitted.
- Step 5 ("Write your factory") and step 6 ("Test it") each gained a lead-in sentence ("Create `factory.ts` next to `schema.json`:" / "Create `factory.test.ts` next to `factory.ts`:") naming the file in PROSE, not just the fence info-string — the `filename=` annotations themselves are kept (the machine leg depends on them).
- Steps renumbered 3-6 (schema, codegen, factory, test). No other doc in the repo references the old numbering (verified via `rg` before renumbering).

**Extraction-strategy choice (strongest fix, per instructions)**: gave the new tsconfig fence `filename=tsconfig.json` so `extractFencedFiles` (already used by the REQ-AOD-01/07 machine leg) picks it up automatically. Rewired the REQ-AOD-11 tsc leg (`ensureTscScratchReady` in `quickstart-docs.test.ts`) to **write the DOC's own extracted tsconfig.json content** into the scratch consumer (replacing a hardcoded `JSON.stringify(...)` duplicate), install `@types/bun` alongside `typescript` (both version-pinned from the repo's own `package.json`), and typecheck `factory.test.ts` in addition to `factory.ts`. The tsc leg now proves the DOC's own copy-pasteable config makes `tsc --noEmit` pass over the FULL step 1-6 journey — not a config the harness silently provisions on the reader's behalf. This closes the exact gap that let the bug ship in the first place (harness self-provisioning masking a doc omission), and would have caught my own first-pass `types: []` mistake if I hadn't verified it by hand first.

## Verification

- `bun test test/docs/quickstart-docs.test.ts` → 11 pass / 0 fail (was 6 pass before this run; 5 new `it` blocks: tsconfig content+placement, workspace setup, @types/bun instruction, Finding #5 filename-in-prose, PATH-resolved codegen).
- `bun test test/docs/` (all 4 files) → 56 pass / 0 fail.
- Full suite (`bun test`), run twice consecutively for stability: **1122 pass / 0 fail** both times (1117 inherited + 5 new).
- `bun run typecheck` → clean, exit 0.
- **End-to-end reproduction** (real, not simulated, re-run after EVERY new finding): fresh empty scratch folder, followed the FIXED doc literally —
  - `mkdir my-factories && cd my-factories` → `bun link @pbuilder/sdk` (no prior `package.json`) → confirmed auto-created `{"dependencies": {}}` package.json + `node_modules/.bin/pbuilder-codegen`, exit 0.
  - `bun add -d typescript @types/bun` → tsconfig.json created verbatim from the doc → `schema.json` created → `pbuilder-codegen .` (bare, PATH-resolved) → `pbuilder-codegen: wrote schema.generated.ts`, exit 0.
  - `factory.ts` + `factory.test.ts` created verbatim (both named per the doc's own prose, not the fence metadata).
  - `tsc --noEmit` over ALL THREE consumer `.ts` files (`factory.ts`, `factory.test.ts`, `schema.generated.ts`) → exit 0, no `ts(2307)` or any other error — INCLUDING the `bun:test` import, closing the gap in my first end-to-end pass (which had excluded `factory.test.ts` from the tsc check, matching the pre-fix REQ-AOD-11 scope, and so missed root cause 3 until the coordinator's Finding #4).
  - `bun test factory.test.ts` → 1 pass / 0 fail.
  - Scratch consumer directories cleaned up afterward; the GLOBAL `@pbuilder/sdk` link registration was left intact (confirmed via `readlink ~/.bun/bin/pbuilder-codegen` still resolving) — not torn down, per instruction.

## Deviations from Design

None. This is a docs-only + test-only fix (no `src/` changes), matching Stage 6's "no runtime behaviour changes" framing. REQ-AOD-01/07/11 already covered the underlying machine/typecheck legs; this run strengthens their COMPLETENESS (doc teaches what the harness was silently provisioning, and the harness now covers the full doc journey including the test file) rather than introducing new REQ-IDs — no spec revision needed, this is an apply-phase fix to a build-time outcome-gap.

## Halt / Issues Found

None. Worth flagging for the record: my own first-pass tsconfig (copied `types: []` from the pre-existing harness config without independently verifying it against `factory.test.ts`) would itself have shipped a NEW `bun:test` resolution failure had the coordinator's Finding #4 not caught it before this run closed — the exact same "copy the harness's assumption without re-verifying against the full doc journey" failure mode as the original bug. Caught here because the end-to-end repro was re-run after every finding, not just once at the end.

## Overall Progress (Run 6)

| Metric | Value |
|---|---|
| Root causes fixed | 4/4 (missing tsconfig, undefined workspace, missing bun:test types, invisible filenames) |
| Secondary claim investigated | 1/1 (found false; no change needed, regression guard added) |
| Full suite (final) | 1122 pass / 0 fail, 2x stable |
| Typecheck (final) | clean |
| End-to-end repro | PASS (real fresh-folder walkthrough of the fixed doc, tsc over ALL consumer .ts files incl. factory.test.ts) |

## Next Step

`walkthrough-record.md` still needs a genuine re-walkthrough by the owner against the FIXED doc to actually discharge REQ-AOD-08 (this run fixes the doc; it does not itself re-run the human walkthrough — that remains a steward-reckoning deliverable per the G-2 ruling). Recommend the owner re-attempt the walkthrough before the next reckoning pass.
