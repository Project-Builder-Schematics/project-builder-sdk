# S-005 batch, iteration 1

## Verify In-Loop Result

**Change**: schematic-local-files
**Iteration**: 1/3
**Scope**: S-005 (final slice, coverage tail + one ROUTED security fix)
**Batch**: `git diff 0f5a04f..HEAD` — `3ceafee` (fix, ROUTED), `e5e857d` (test), `cf204b2` (docs), `be74fe3` (chore baselines), `0a6b5fa` (chore progress) — `5721fc8` (orchestrator state) ignored per brief
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green, including an adversarial re-verification of the routed security fix using independently constructed fixtures (not the executor's own test file). Loop can exit.

- Tasks in scope: S-005.1–S-005.7, all 7/7 marked `[x]` in `slices.md:190-203`, all verified present in the diff.
- `bun test`: **1006 pass / 0 fail**, 121 files (reproduced independently).
- `tsc --noEmit`: **clean** (reproduced independently via `bun run typecheck`).
- `bun test test/fitness/`: **238/238 pass** (reproduced).
- Spec compliance for scope: ATH-14.1/.2, ATH-15.1/.2 (verified no-op, already closed at S-003), ATH-16.1, BRC-04.1 all have passing tests that assert the exact scenario text from `specs/author-test-harness/spec.md` and `specs/by-reference-copy-wire/spec.md`.
- Assertion audit: clean on the delta test files — no tautologies, no vacuous mocks, self-checking fixtures (e.g. evidence-boundary's own red-proof/negative-control trio, ATH-16's verdict-only parity reasoning documented and confirmed correct against FIT-10).

---

## PRIORITY audit — the ROUTED security fix (`3ceafee`)

**Claim under review**: `readTemplateFile` (`src/scaffold/index.ts`) now routes through `validateSourceContainment` (`src/scaffold/containment.ts`), closing the live arbitrary-file-read reported in `verify-in-loop-4.md` Deviation #1.

### (a) Original exploit fixture, re-verified independently

Built a fresh fixture (own temp dirs, own marker string `"MY OWN INDEPENDENT SECRET MARKER 12345"`, not reused from the executor's suite) exercising the **real** `create({templateFile})` public API end-to-end through `defineFactory`/`ContractFake`:

```
reason: source-outside-package
origin: authoring-rejected
message: source file outside package: ../adversarial-outside-.../secret.txt resolves outside the package boundary
message contains secret marker? false
committedTree size: 0
```

Neutral `source-outside-package` reason, no path/content leak in the message, nothing committed. Matches `verify-in-loop-4`'s original finding (`caught` was `undefined`, content returned) now closed. **Confirmed fixed.**

### (b) Same containment module, no forked check

```
rg -n "validateSourceContainment" src/ --type ts
```
returns exactly 3 call sites — `classify-transport.ts` (scaffold's classifier, since S-002), `index.ts`'s `runCopyIn` (since S-003), and `index.ts`'s `readTemplateFile` (new in `3ceafee`) — all importing from the single `./containment.ts` module. A broader `rg` for ceiling/containment-shaped logic (`isWithinCeiling`, `realpathSync.*ceiling`, `startsWith.*packageRoot`) outside `containment.ts` returns zero hits — no parallel/forked check exists anywhere in `src/`. **Confirmed: single machinery, not duplicated.**

### (c) Broken-symlink behavior vs PRC-07 oracle semantics

Built 3 independent fixtures (different names/depths/target forms than the executor's own — including a **relative**-target symlink, which the executor's own e2e file only covers for the absolute-target form):

| Fixture | Expected (PRC-07.2 S1 ordering) | Observed |
|---|---|---|
| Broken symlink, absolute target, genuinely outside ceiling | `source-outside-package` | `source-outside-package` ✅ |
| Broken symlink, absolute target, lexically inside ceiling (nested 2 levels) | `source-not-found` | `source-not-found` ✅ |
| Broken symlink, **relative** target, lexically inside ceiling | `source-not-found` | `source-not-found` ✅ |

All three match the oracle exactly — the S1 fix (`resolveBrokenSymlinkTargetRealAncestor`, `containment.ts:104-110`) generalizes correctly beyond the two shapes the executor's own e2e tests cover.

### (d) In-ceiling happy path unchanged

Own fixture (independent temp dir, distinct template content): `create({templateFile: "tpl.ts.template", options: {y: 42}})` still renders and commits correctly (`committedTree` = `{"dest.ts": "export const y = {= y =};"}`). Full-suite `bun test` (1006/0) includes the S-000-era e2e cases (`scaffold.e2e.test.ts`'s original 4 cases plus S-001's additions) — all still green, no regression. **Confirmed unaffected.**

### (e) `.d.ts` JSDoc accuracy

`test/fitness/dts-baseline/core.authoring-error.d.ts`'s existing comment (lines 25-28, unchanged since S-002 — `git diff 0f5a04f..HEAD` shows this file untouched in this batch) claims the four `source-*` reasons cover *"the SDK's own pre-emit read/stat of a package-local source for `scaffold`/`copyIn`/`create({templateFile})`"*. This was flagged as **doc-drift** in `verify-in-loop-4.md` (asserting protection that didn't exist for `templateFile`). Re-ran `bun run build` and diffed `dist/core/authoring-error.d.ts` against the committed baseline — **byte-identical**. The claim is now true (confirmed via (a)-(d) above), and the baseline needed no edit because the JSDoc text was already accurate prose, only the *code* was behind it — closed correctly, no remaining doc/code mismatch.

**PRIORITY audit verdict: all 5 points CONFIRMED. The routed fix is real, uses the single shared containment machinery, generalizes correctly to symlink edge cases beyond the executor's own fixtures, and does not regress the happy path.**

---

## Standard audit points

### 1. S-005.1/.2/.3 vs spec scenarios

- **ATH-14** (`test/fake/harness-in-memory-invariant.test.ts`): `.1`/`.2` match `specs/author-test-harness/spec.md:33-49` almost verbatim — within-collection-root reads observed-not-flagged (dual lexical/real root representation, mirroring `containment.ts`'s own dual-ceiling precedent), harness-machinery read outside the root still trips the invariant. Widening is by resolved-path prefix, not enumerated call sites, matching the REQ's own "never a blanket exemption" language.
- **ATH-16** (`test/conformance/copyin-parity.test.ts`): 4 fixtures (valid / missing-source / collision-no-force / collision-with-force) driven through both `ContractFake` and `run-vehicle.ts`, asserting **verdict** parity only — correctly reasoned and confirmed against FIT-10's port guard (`fit-10-engine-client-port-guard.test.ts`, 10/10 pass) that `run-vehicle.ts` cannot import `EmitRejection`, so its collision degrades to `reason:"unknown"` by construction, not a parity bug. Matches REQ-ATH-16.1's "same accept/reject verdict" wording exactly (never reason equality).
- **BRC-04** (`test/scaffold/evidence-boundary.test.ts`): deliberately simple regex/substring scan (FIT-10/16 precedent, explicitly disclosed as non-AST), block-scoped by `it()` to avoid false-positiving on legitimate same-literal by-value/by-reference pairs, self-excludes its own fixture strings. Production scan returns zero violations across the whole `test/` tree. Matches `specs/by-reference-copy-wire/spec.md:96-101` and design's own Fitness Functions section (`design.md:295-298`).

### 2. Docs

- README: "What it is" verb list now lists the previously-undocumented `copy` plus `scaffold`/`copyIn`/`create({templateFile})`; new "Scaffolding a folder" section covers both escape hatches and both caveats (npm empty-dir packaging, symlink-dir non-descent + 10k bound).
- `src/commons/index.ts` JSDoc: `create`'s `templateFile` bullet, `scaffold`'s `rename`-disambiguation/packaging/symlink-bound notes — all present, English, match the code's actual behavior (cross-checked against `containment.ts`, `walk.ts`).
- `dryRun()` JSDoc: pinned substring `"no content or byte preview"` intact (`src/commons/index.ts:375`), verified against `test/skeleton/dry-run-public-contract.test.ts:75`'s literal `.toContain` assertion — no drift.
- All docs in English, per project convention.

### 3. `openspec/pending-changes.md` engine-obligation rows

3 rows added (`BRC-02`, `BRC-08`, `PRC-06`), siblings to row 208, `owner = engine repo`, `**cross-repo flag (with PC-PROTO-01)**`. Content cross-checked against `design.md`'s `## Seam Contract` section (lines 194-204) — wording matches almost verbatim (engine re-derives its own ceiling, TOCTOU-closed; anchor pin S2 `copyIn.from` relative to `packageDir` not `packageRoot`; non-canonical path-form rejection + single-pass render; post-render destination containment). All three explicitly marked archive-gated, matching product ruling Q23 and slices.md's own Tripwires section.

### 4. Baseline regens (FIT-04 `.d.ts` trio + pkg-surface)

- `commons.index.d.ts`: purely additive — `CreateFromTemplateFileOptions`, the third `create` overload, `ScaffoldOptions`/`scaffold`, `copyIn`, and the `dryRun` `kind` JSDoc note. No smuggled export; matches exactly the S-000/S-001/S-003 surface growth this change already shipped.
- `pkg-surface-baseline.json`: confirmed untouched in this batch (`git diff 0f5a04f..HEAD --stat` returns nothing for this file) — correct, since S-005 adds zero new `src/` files.
- **ADVISORY, non-blocking**: `conformance.index.d.ts` and `testing.index.d.ts` also changed in this batch, but their diffs are pure JSDoc prose unrelated to `schematic-local-files` (REQ-DC-06/DC-08 adversarial-sample language, a `testing.index.d.ts` example rewrite) — apparently drift from other, already-landed work (`stage-5b-dialect-breadth`, visible in `git log`) that had never been resynced. `apply-progress.md` discloses this honestly ("resynced for hygiene," filtered by `normalizeDeclarations`, non-blocking). `bun test test/fitness/` (238/238) confirms no gate broke. Not a finding against this slice's own scope, but the regen touched 2 files outside what S-005.7's task line names — flagging for visibility, not blocking.

### 5. Optional REQ-05.1 mixed create+copyIn atomicity test

`test/scaffold/batch-cap-chunk.test.ts:163-201`: two ~1.5 MiB text files force a genuine flush boundary; a third, small binary file walks last (alphabetical), classifies by-reference, and lands in the **second** (later) flush group alongside the colliding text file. Result: `result.tree.size === 0` (full rollback) and `copyInDirectives` has length 1 with the exact expected `{from, to}` shape — confirms the `copyIn` directive really was built, really was in the failing chunk, and really didn't survive. This closes the ADVISORY gap `verify-in-loop-6.md` explicitly carried forward ("this specific atomicity guarantee" lacked a by-reference regression pin). **Confirmed genuinely cross-chunk, not same-flush.**

### 6. Real execution evidence

- `bun test`: **1006 pass / 0 fail**, 1943 `expect()` calls, 121 files (reproduced).
- `bun run typecheck` (`tsc --noEmit`): **clean** (reproduced).
- `bun test test/fitness/`: **238/238 pass** (reproduced).

### 7. TDD Cycle Evidence table (S-005) vs `git log`

Cross-checked `apply-progress.md`'s S-005 table against the actual commit boundaries:
- `3ceafee` (fix) contains **both** the `readTemplateFile` production change **and** its own new/updated e2e tests (exploit fixture, both broken-symlink oracle directions, in-ceiling happy-path control, plus the two flipped `invalid-input`→`source-*` characterization tests) — `git show 3ceafee --stat` confirms exactly `src/scaffold/index.ts` + `test/e2e/scaffold.e2e.test.ts`, matching the table's disclosed "test+prod together, RED validity from in-session runs not commit order" method statement (same honest pattern as every prior slice, not overclaimed test-first).
- `e5e857d` (test) contains exactly the S-005.1/.2/.3/optional-nicety test files (`copyin-parity.test.ts`, `harness-in-memory-invariant.test.ts` widening, `evidence-boundary.test.ts`, `batch-cap-chunk.test.ts` extension) — matches the table's task-to-file mapping precisely.

No claim in the table contradicts `git log`. Honest.

---

## Findings

**CRITICAL**: None.
**WARNING**: None.
**ADVISORY** (non-blocking):

| # | Finding | File:Line | Detail |
|---|---|---|---|
| A1 | `.d.ts` baseline regen swept in 2 files' worth of unrelated JSDoc hygiene drift | `test/fitness/dts-baseline/conformance.index.d.ts`, `test/fitness/dts-baseline/testing.index.d.ts` | Content is unrelated to `schematic-local-files` (dialect-conformance REQ-DC-06/08 prose, a testing-example rewrite) — disclosed honestly in `apply-progress.md`, filtered by `normalizeDeclarations`, FIT-04 gate still green (238/238). Not a defect; flagging only because it expands the diff beyond S-005.7's literal task line ("7-member `AuthoringVerb`/`DryRunVerb`"). No action required before archive. |

---

## Independent adversarial verification performed (fresh fixtures, not reused from the executor's suite)

| Scenario | Result |
|---|---|
| `create({templateFile})` exploit, independent temp dirs + own secret marker | ✅ `source-outside-package`, no leak, nothing committed |
| `rg` sweep for any parallel/forked containment logic outside `containment.ts` | ✅ zero hits — single machinery |
| Broken symlink, absolute target, out-of-ceiling (own fixture, different depth) | ✅ `source-outside-package` |
| Broken symlink, absolute target, in-ceiling, nested 2 levels (own fixture) | ✅ `source-not-found` |
| Broken symlink, **relative** target, in-ceiling (form NOT covered by executor's own e2e tests) | ✅ `source-not-found` |
| In-ceiling happy-path render (own fixture) | ✅ unaffected |
| `bun test` full suite | ✅ 1006/0 (reproduced) |
| `tsc --noEmit` | ✅ clean (reproduced) |
| `bun test test/fitness/` | ✅ 238/238 (reproduced) |
| FIT-10 port guard (validates ATH-16's divergence reasoning) | ✅ 10/10 |
| `.d.ts` fresh build vs committed baseline (`core.authoring-error.d.ts`) | ✅ byte-identical |
| REQ-05.1 mixed-batch test: confirmed genuine 2-flush split with `copyIn` in the failing chunk | ✅ `tree.size === 0`, `copyInDirectives.length === 1` |

---

### Orchestrator action

Exit the in-loop verify GAN loop for S-005 — all 6 slices (S-000..S-005) now have a passing in-loop verify. Proceed to `/evaluate` (`sdd-verify --mode=final`) before archive. Carry the one ADVISORY (A1) forward as an informational note, not a blocker — no fix iteration required. The 3 `openspec/pending-changes.md` engine-obligation rows remain archive-gated per Q23 (owner sign-off happens at the archive gate, not here). Iteration 1 of 3 used (loop exits — no further iterations needed).
