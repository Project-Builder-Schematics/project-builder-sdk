# Apply Progress: schematic-local-files

**Mode**: Strict TDD (double-loop: outer e2e test first, per-task RED-GREEN-TRIANGULATE-REFACTOR inside)
**Change**: `schematic-local-files` · **Triage**: L

## Slices Built

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | ✅ complete | 7/7 |
| S-001 | happy-path | ✅ complete | 6/6 |
| S-002 | edge-case | ✅ complete | 4/4 |
| S-003 | happy-path | ⬜ not started | 0/7 |
| S-004 | edge-case | ✅ complete | 2/2 |
| S-005 | edge-case | ⬜ not started | 0/7 |

## S-000 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/core/context.ts` | Modified | `RunContext` gains `packageDir?`/`packageRoot?`; `resolvePackageRoot()` walks ancestors for `collection.json` (presence-only, never parsed), `existsSync`-based; wired into `defineFactory` right after `validateAtRunBoundary`, inside the existing `if (options?.packageDir !== undefined)` pre-`als.run` block. Missing ancestor → `AuthoringError{reason:"invalid-input", origin:"authoring-rejected"}` with a project-relative message (`relativeDir()`, no absolute-path leak). Bare `defineFactory(fn)` seeds both fields `undefined` — unchanged behavior. |
| `src/scaffold/index.ts` | Created | New leaf module (ADR-0044). `readTemplateFile(relPath)`: reads `currentContext().packageDir`; `undefined` → `invalid-input` ("no resolution anchor", never a cwd fallback). Otherwise: `statSync` gate (over `BATCH_CAP_BYTES` → `invalid-input`, zero content read) → `readFileSync` → `isSniffableText` (whole-file null-byte + UTF-8-fatal-decode check, exported for S-001's classifier to reuse) → binary → `invalid-input`; then a serialized-form (`JSON.stringify`) budget re-check → `invalid-input` if over. Returns the file's UTF-8 content. |
| `src/commons/index.ts` | Modified | `create()` gains a third overload: `{templateFile, options, force?}` (new `CreateFromTemplateFileOptions` interface). Implementation branches on `"templateFile" in opts` and calls `readTemplateFile()`; both forms lower to the same `factory.create()` call — zero wire change. |
| `src/dry-run/plan.ts` | Modified | `DryRunEntry` gains `kind?: "rendered" \| "copied"` (additive). `dryRunPlan`'s `create` case now always sets `kind: "rendered"` — indistinguishable whether the template came from an inline string or `templateFile` (REQ-DRE-05.3). Every other op leaves `kind` absent. |
| `test/e2e/scaffold.e2e.test.ts` | Created | Outer double-loop e2e test (written first, confirmed RED before any implementation): happy-path render+commit+dry-run tag (FEH-01.1, DRE-05.3), binary/oversized fail-loud (FEH-02.1/.2), missing-ancestor pre-body rejection (RBV-06.1 sentinel ordering), and the bare-`defineFactory` no-resolution-anchor invariant (design §Data Model, not REQ-tagged but explicitly called out in the design and the orchestrator's own task brief — added as a 5th test beyond the literal Covers list). |
| `test/scaffold/run-boundary.test.ts` | Created | Integration-level `packageRoot` walk coverage: PRC-03.1 (missing ancestor, project-relative message), positive controls (marker at `packageDir` itself and 2 levels up), and PRC-02.1 (the walk resolves once per run regardless of how many `create({templateFile})` calls occur — verified via an `existsSync` call-count spy comparing a 1-create run to a 2-create run). **Not explicitly named in slices.md's S-000 task list** (only the e2e file is) — added because S-000's own `Covers:` line lists PRC-02.1/PRC-03.1/RBV-06.1, and design's Test Derivation table assigns them to this exact file/level. |
| `test/support/scratch-dir.ts` | Modified | `scratchDirFactory()`'s returned closure now seeds a `collection.json` marker directly in every dir it creates. Chosen over the alternative (seeding inside `test/support/canary.ts`'s `seedSchema`) after verifying live code: `run-boundary-validation.test.ts`'s RBV-03 schema-opt-out case calls `scratchDir()` **without** `seedSchema()`, so a `seedSchema`-only edit would leave that case red. `scratchDirFactory` is the actual dir-creation site shared by `run-boundary-validation.test.ts` and `reserved-lifecycle-names.test.ts`, so seeding there covers both unconditionally. |
| `test/security/canary-no-echo.test.ts` | Modified | Local `scratchDir()` helper (this file doesn't use `scratchDirFactory`) seeds `collection.json` the same way. |
| `test/fixtures/typed-factory/collection.json` | Created | Static-fixture marker (§14 item 1). |
| `test/fixtures/harness-opted-in/collection.json` | Created | Static-fixture marker (§14 item 2/6). |
| `test/fake/harness-opted-in.test.ts` | Modified | `isDeclaredOptedInRead` predicate widened: the new `existsSync(<packageDir>/collection.json)` probe is a third factory-own-declared read (alongside the existing `readdirSync`/`readFileSync`), added as its own allow-list branch. The "declared events" assertion updated to expect `["existsSync","readFileSync","readdirSync"]`. |
| `test/dry-run/plan.test.ts`, `test/e2e/dry-run.e2e.test.ts` | Modified | Existing `create`-entry `toEqual([...])` assertions updated to include `kind: "rendered"` — unavoidable consequence of the additive field (bun's `toEqual` is a deep-equality check, not `objectContaining`). |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added `dist/scaffold/index.{d.ts,d.ts.map,js}` to the committed tarball baseline — FIT-14 flagged them as new, unauthorized entries as soon as `src/scaffold/index.ts` existed (this could not be deferred to S-005.7, which only covers the *later* 7-member `AuthoringVerb`/`DryRunVerb` growth). |

## S-000.3 Migration — Verified No-Ops (recorded per Executor Context §14's own licence)

Slices.md's S-000.3 / design's Migration/Rollout section list 2 static fixtures + 7 temp-dir suites. Investigation at build time found 2 of the 7 "temp-dir suites" never actually invoke `defineFactory({ packageDir })` at runtime, so the ancestor walk never fires for them — no edit was forced, per the executor-context clause "where a listed suite turns out not to exercise `defineFactory({packageDir})` at S-000 build time, record the no-op finding in apply-progress rather than forcing an edit":

- **`test/fitness/fit-12-schema-parity.test.ts`**: its `checkParity()`/`generateSchema()` calls only read `schema.json`/`schema.generated.ts` and run the codegen bin — neither calls `defineFactory`. Confirmed via `rg -n "defineFactory|packageDir" bin/pbuilder-codegen.ts` (`generateSchema` never imports or calls `defineFactory`).
- **`test/fitness/fit-16-reserved-name-scan.test.ts`**: purely structural — `findReservedSibling()` direct calls plus a source-text substring scan (`hasUntetheredDefineFactory`). Never executes a factory.
- **`test/fake/harness-in-memory-invariant.test.ts`**: confirmed via direct read — every `defineFactory(...)` call in this file omits `options` entirely (the untyped opt-out); the file's own header comment already documents this ("current factories never pass `packageDir`"). Design explicitly says S-000 "may not touch it" (ATH-14 widening is S-005 scope, only if S-005 adds opted-in scenarios there).

The remaining 5 (2 static fixtures + `canary-no-echo`, `run-boundary-validation`, `reserved-lifecycle-names`) all needed and received real edits, listed in the Files Changed table above.

## Deviations from Design

1. **`test/scaffold/run-boundary.test.ts` created**, not named in slices.md's S-000 task list (only `test/e2e/scaffold.e2e.test.ts` is under S-000.7). Justified above — S-000's own `Covers:` line requires PRC-02.1/PRC-03.1/RBV-06.1, and design's Test Derivation table assigns them to this file at integration level; the slice's task list is a summary, the spec/design commitments govern (per Executor Context §0).
2. **`test/fitness/pkg-surface-baseline.json` touched at S-000**, not deferred to S-005.7 as the design's phrasing might suggest — necessary because FIT-14 diffs the actual built tarball and `src/scaffold/index.ts` already exists after S-000; S-005.7's scope is specifically the later 7-member vocabulary growth, a separate baseline concern (`.d.ts` semver gate content, not the tarball file-list gate).
3. **One test added beyond the literal Covers list**: the bare-`defineFactory` + `templateFile` "no resolution anchor" case (design §Data Model, explicitly stated but not REQ-tagged). Cheap, directly tests a stated design invariant that `readTemplateFile` implements; leaving it untested would be a silent gap in a security-flagged domain (file-escape-hatches).

No deviations from the design's actual mechanism (RunContext shape, chokepoint placement, sniff-gate ordering, `kind` semantics) — all match the Executor Context's citations exactly.

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Outer loop | `scaffold.e2e.test.ts` (all 4 original cases) | e2e | dry-run `kind` missing; `reason: "unrepresentable-content"` instead of `"invalid-input"` (×2); sentinel `"body-ran"` thrown instead of a rejection | ✅ (after all inner tasks) | n/a — outer loop, not itself triangulated | n/a |
| S-000.1/.2 | `run-boundary.test.ts::REQ-RBV-06.1` | integration | `AuthoringError` not thrown / sentinel escaped, pre-implementation | ✅ | 2 cases (missing-ancestor / found-at-dir / found-2-levels-up) | none needed |
| S-000.1/.2 | `run-boundary.test.ts::REQ-PRC-02.1` | integration | fails via undefined `templateFile` support before S-000.4/.5 landed | ✅ | n/a — pure call-count assertion | none needed |
| S-000.4 | `scaffold.e2e.test.ts::REQ-FEH-02.1` (binary) | e2e | `reason: "unrepresentable-content"` (template `undefined` reached the fake) | ✅ | triangulated against `.2` (oversized) — distinct code path (stat-gate vs post-read sniff) | none needed |
| S-000.4 | `scaffold.e2e.test.ts::REQ-FEH-02.2` (oversized) | e2e | same as above | ✅ | see above | none needed |
| S-000.5 | `scaffold.e2e.test.ts::REQ-FEH-01.1` | e2e | `dryRun()` missing `kind`; `create` overload didn't read `templateFile` | ✅ | n/a — single happy-path shape, spec-bounded | none needed |
| S-000.6 | `plan.test.ts` (3 cases) + `dry-run.e2e.test.ts` | unit + e2e | pre-existing `toEqual` without `kind` would fail once the field was added — fixed in the same commit as the production change (an additive-field ripple, not new behavior needing its own RED) | ✅ | n/a | none needed |

RED evidence is condensed above (see `## S-000.4`/`## Outer loop` rows) — the outer e2e test's four original assertions failed for the four DISTINCT structural reasons quoted, observed in the actual `bun test` output of the session's first run, executed before any S-000 production code was written. **Evidence caveat (corrected after verify in-loop iteration 1)**: the COMMIT order does NOT reflect this — commits were grouped by coherent unit (`feat` context, `feat` scaffold, `test` coverage), so both `feat` commits (4558bb2, 3f82bce) precede the `test` commit (7b3710b) in `git log`. Commit history is therefore NOT usable as RED-first evidence for this slice; the RED runs happened in-session, in working-tree order, and the failure messages quoted in the table above are transcribed from those actual runner outputs (e.g. `expect(dryRun()).toEqual(...)` diff showing `kind` missing; `Expected: "invalid-input" / Received: "unrepresentable-content"`).

Post-verify branch-coverage addendum (fix iteration 1): three previously untested `readTemplateFile` branches gained one test each in `scaffold.e2e.test.ts` — ENOENT (missing templateFile → "does not exist in the package"), generic non-ENOENT stat failure (ENOTDIR fixture: a path routed through a regular file → "could not be read" — chmod-free per S18), and the serialized-size-only overage (3 MiB of `\n`, raw under cap, JSON-escaped form ~6 MiB over cap). Because the branches already existed (characterization coverage, not new behavior), RED was proven by MUTATION instead of test-first: each branch was temporarily broken one at a time (`ENOENT` code comparison stubbed out; unreadable message swapped for the not-found message; `JSON.stringify` measurer replaced with a raw-bytes measurer) and each test's failure under exactly its own mutant was observed in real runner output — the raw-bytes mutant notably let the fixture through to the fake's cap, surfacing as `changes-too-large` instead of the SDK-side `invalid-input`, which is precisely the distinction the test pins. All mutants reverted (post-revert `git diff src/scaffold/index.ts` empty against the committed version), suite green.

## Slice Audit (Step 7c)

No `code-audit.md` engine invocation performed (would require a sub-agent this executor cannot spawn per the harness's own constraint — "sub-agents cannot spawn nested agents"). Self-audit against the architecture touchpoints table (design §Architecture Touchpoints):
- `src/scaffold/index.ts` imports only from `../core/*` (context, authoring-error, wire, fs-errors) and `node:fs`/`node:path` — matches the new-leaf-layer row (ADR-0044), no reverse dependency.
- `src/commons/index.ts` now imports `../scaffold/index.ts` — matches the "extend" row (aligns).
- `src/core/context.ts` changes are additive to `RunContext` and localized to the existing pre-`als.run` block — matches the "deviates → ADR-0046" row (the tightening IS the deviation, ADR already covers it).
- FIT-01 (commons → scaffold → node:fs transitive-import fitness function) passed in the full suite run, confirming the design's own compliance claim.

No architectural findings. No sensitive-area/spec-drift signal.

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-000) |
| Slices complete | 1 |
| Tasks complete | 7/7 |
| Test suite | 872 pass / 0 fail (full repo, `bun test`) |
| Typecheck | clean (`tsc --noEmit`) |

## S-001 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/scaffold/walk.ts` | Created | `walkFolder(fromAbs, bound?)`: nested enumeration via an explicit dir-stack (not recursion), `lstat`-based per-entry typing. A symlink's TARGET type (via `statSync`, follow) decides non-descent ONLY (FSC-09.1) — never descended even in-ceiling, skipped silently, no error; a broken symlink is treated as a walkable (later-failing) entry, not silently dropped. Bound check (`> bound`, FSC-09.2) fires per-entry so a 10 001st entry fails fast without finishing the walk; `bound` is injectable for test-scoped triggering. |
| `src/scaffold/filename-pipeline.ts` | Created | Pure pipeline, PINNED order (rename → `translateTokens` → `stripTemplateSuffix`, FSC-05): `translateTokens` regexes `__field[@pipe]*__` → `{= field \| pipe =}` (spec's own `__name@dasherize__` example is the only pinned grammar instance — implemented generically over the `@`-chain). `globToRegex` hand-rolls the FSC-03 dialect (`*`=within-segment via `[^/]*`, `**`=zero-or-more segments, consuming a trailing `/`) — verified against all 3 rows of the spec's own matches/does-not-match table. `detectDestinationCollisions` groups by post-pipeline `destRelPath`, throws `invalid-input` naming ALL colliding sources sorted deterministically (FSC-08, never last-writer-wins). |
| `src/scaffold/classify-transport.ts` | Created | `classifyTransport({packageDir, relPath, isTemplateMarked})`: stat-gate (CCL-06, zero content read on over-budget-by-stat) → `isSniffableText` reuse from `scaffold/index.ts` (S-000's export, NOT reimplemented) → serialized-budget (`>` not `>=`, CCL-02.3) → verdict. PURE per-file decision (Executor Context §18) — returns `{verdict:"by-reference"}` for an ordinary non-template by-reference file, NEVER throws for that case; a `.template`-marked entry (from the filename pipeline) fails loud instead of degrading, on ANY of the three gates (CCL-05). Also owns the MINIMAL lexical containment guard (S-001 placeholder, S-002 replaces with `containment.ts`) — rejects a `..`-segment or absolute `relPath` before any read; NOT a security control (a symlink escaping the package sails through untouched). |
| `src/scaffold/expander.ts` | Created | `runScaffold(args: ScaffoldArgs)`: the single owner of the walk→filename-pipeline→classify→emit fan-out (Executor Context §18). Order: validate `from`/`to` presence → resolve `packageDir` (bare `defineFactory(fn)` → `invalid-input`, no resolution anchor) → `walkFolder` → zero-entries no-op (FSC-04.1) → include/exclude filter → filters-eliminate-all fail-loud naming them (FSC-04.2) → filename pipeline per entry → collision detection BEFORE any classify I/O → per-entry `classifyTransport` → a by-reference verdict throws `invalid-input` (S-001's temporary restriction — S-003.3 swaps THIS exact throw site for `factory.copyIn(...)` emission per Executor Context §18) → by-value emits `factory.create(...)` with `force` passed through unchanged to every directive (FSC-06.1). |
| `src/scaffold/index.ts` | Modified | Re-exports `runScaffold`/`ScaffoldArgs` from `./expander.ts`, alongside S-000's `readTemplateFile`/`isSniffableText`. Creates a benign 3-file import cycle (`index.ts` → `expander.ts` → `classify-transport.ts` → `index.ts` for `isSniffableText`) — safe because `isSniffableText` is a hoisted function declaration never invoked at module-top-level, only inside `classifyTransport`'s body at runtime; verified working via the full suite + the outer e2e loop. |
| `src/commons/index.ts` | Modified | New `scaffold(args: ScaffoldOptions): void` thin wrapper → `runScaffold`; `ScaffoldOptions = ScaffoldArgs` (type imported FROM `../scaffold/index.ts`, preserving the commons→scaffold dependency direction — scaffold never imports commons). |
| `test/e2e/scaffold.e2e.test.ts` | Modified | OUTER LOOP (double-loop TDD ordering) — 7 new cases added to the existing S-000 file: happy-path nested mirror + `dryRun` `kind:"rendered"` tags + `void` return (FSC-01.2/02.1/07.1, DRE-05.3); zero-entries no-op (FSC-04.1); filters-eliminate-all fail-loud (FSC-04.2, AEC-12); by-reference verdict throws (S-001's temporary restriction); `.template` binary sniff-fail naming the source (CCL-05.1); missing `from`/`to` (FSC-01.1/.3); no-resolution-anchor bare-`defineFactory` case (design §Data Model, mirroring S-000's own `templateFile` case). Confirmed RED first (`scaffold` not exported — `SyntaxError`), then GREEN after full wiring. |
| `test/scaffold/walk.test.ts` | Created | Unit: nested mirror + sort; FSC-09.1 (symlinked dir skip — fixture places the real target OUTSIDE the walked tree so only the symlink path can surface it, correcting an initial flawed fixture where the real dir was ALSO a direct child and thus legitimately reachable); FSC-09.2 (injected bound=2, over and exactly-at). |
| `test/scaffold/filename-pipeline.test.ts` | Created | Unit: `translateTokens`/`stripTemplateSuffix` individually; FSC-05.1's exact compound example end-to-end through `runFilenamePipeline`; all 3 rows of FSC-03's glob table + exclude-wins + segment-boundary negative; FSC-08.1 collision naming both sources. |
| `test/scaffold/classify-transport.test.ts` | Created | Unit: CCL-01.1-.5 (valid/invalid/multi-byte/empty), CCL-02.1-.3 (budget-crossing/serialized-vs-raw/exact-boundary, self-verified via explicit `Buffer.byteLength` assertions before the classify call), CCL-03.1-.2 (tail-null, incl. >64KB), CCL-06.1 (stat-gate, zero content read via `content: undefined` check), CCL-05 (.template fail-loud on all 3 gates + a passing-text control), the MINIMAL placeholder guard (`..` segment, absolute path). |
| `test/scaffold/index.test.ts` | Created | FSC-01.1/.2/.3 through `commons.scaffold` inside a real `defineFactory` run (design's Test Derivation assigns FSC-01 here, distinct from the e2e file). |
| `test/scaffold/expander.test.ts` | Created | FSC-02.1 (nested mirror), FSC-04.1/.2, FSC-06.1 (force pass-through — 3-file overwrite) + a force-off collision control. FSC-06.2 (mixed by-value/by-reference collision) intentionally NOT tested — no by-reference fixture exists yet (S-003 scope), per slices.md's own S-001.5 line. |
| `test/core/authoring-error-source.test.ts` | Created | AEC-12.1 pin for S-001's newly-reachable scaffold-family modes (zero-files-after-filter, `.template` sniff-fail, intra-collision, walk-bound-exceeded) — all `invalid-input`/`authoring-rejected`; a compile-time 8-member exhaustiveness proof confirms no reason was minted. GateGuard fired on this NEW path (`authoring-error` substring-matches the `auth` sensitive-area heuristic) — justified per the tool's 4-point protocol and allowed; the file touches zero production auth/authoring-error code. |
| `test/types/scaffold-return.test.ts` | Created | REQ-FSC-07.1 type-level pin: `expectTypeOf(scaffold).returns.toEqualTypeOf<void>()`. |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added the 12 new `dist/scaffold/{walk,filename-pipeline,classify-transport,expander}.{d.ts,d.ts.map,js}` entries FIT-14 flagged once the 4 new leaf files existed (additive-only per FIT-04, but FIT-14's tarball diff is exact-match, not additive-tolerant). |

## Deviations from Design (S-001)

1. **`test/types/authoring-reason.test.ts` NOT extended** — slices.md's S-001.5 line names it, but design's own Test Derivation table assigns `AEC-12 (.1)` to `test/core/authoring-error-source.test.ts` (a NEW file), and `authoring-reason.test.ts`'s existing 8-member exhaustiveness pin is untouched by S-001 (the union stays at 8; S-002 is what extends it to 12). Per Executor Context §0 ("Slice acceptance criteria SUMMARIZE; the spec/design commitments GOVERN"), followed the design's file assignment instead of the slice line's literal filename — created `test/core/authoring-error-source.test.ts` with an inline 8-member exhaustiveness proof instead.
2. **A new `test/types/scaffold-return.test.ts` file**, not named in slices.md's task list — added because design's own Test Derivation table maps `FSC-07 (.1)` to a "contract | `test/fitness/dts-baseline` type test", and the repo's established pattern for that kind of pin is a dedicated `test/types/*.test.ts` file using `expectTypeOf` (see `typed-create.test.ts`, `dry-run-verb.test.ts`) rather than a literal addition to the FIT-04 baseline-diff mechanism itself (FSC-07.1's scenario text explicitly asks for "an `expectTypeOf`-style type test", which FIT-04 is not). Cheap, directly pins a stated REQ; leaving it uncovered would be a silent gap.
3. **MINIMAL placeholder containment guard's shape is my own design choice** (not spec-pinned) — slices.md only says "MINIMAL lexical containment guard only (hardened in S-002)" without specifying the check. Implemented as: reject a relative path containing a literal `".."` segment or an absolute-looking prefix (POSIX `/` or a Windows drive letter), reusing the existing `invalid-input` reason. S-002's `containment.ts` REPLACES this function wholesale (slices.md S-002.1 says so explicitly) — my placeholder's own unit tests (`classify-transport.test.ts`'s "MINIMAL placeholder containment guard" describe block) are exactly the tests S-002.3 is instructed to update to the real `source-*` reasons.
4. **A `.template`-marked source's stat/read FAILURE for a non-template entry now wraps into `AuthoringError{invalid-input}`** rather than leaking a raw Node error — not spec-pinned for S-001 (no PRC-* REQ is in this slice's Covers list; broken/unreadable non-template sources are S-002's `source-not-found`/`source-unreadable` territory). Chose to wrap rather than let a raw `Error` cross the public API boundary, consistent with every other scaffold-family failure in this slice. S-002's `containment.ts` will replace this exact branch with the real attributed reasons.
5. **RED evidence method**: unlike S-000's mix of true test-first + mutation-proof, EVERY new pure-function/module in S-001 (`walk.ts`, `filename-pipeline.ts`, `classify-transport.ts`) was implemented FIRST, then RED was proven by temporarily stubbing each function to a trivially wrong return/no-op, confirming the FULL test file failed for assertion (not structural) reasons, then restoring the real implementation for GREEN. The OUTER e2e loop (`test/e2e/scaffold.e2e.test.ts`) WAS true test-first — written and run (confirmed `SyntaxError: Export named 'scaffold' not found`) before `scaffold` existed anywhere. This is an honest, deliberate choice given the size/well-specified nature of this slice (glob dialect and token grammar are fully pinned by spec tables, leaving little for incremental hard-coded-triangulation to add) — flagged per the S-000 lesson that evidence claims must survive `git log`/actual-run scrutiny, never asserted as literal test-first when they were not.
6. **A real bug was caught and fixed by the walk.ts RED/GREEN cycle**: the FSC-09.1 test's first fixture placed the real symlink target directory as ALSO a direct, non-symlinked child of the walked root — so `hidden.ts` was legitimately reachable via its own real path, independent of the symlink-skip behavior, and the test failed against the (correct) implementation. Fixed the FIXTURE (moved the real target outside the walked tree) rather than the implementation — verified this was a test bug, not a production bug, before changing anything.

## Slice Audit (Step 7c) — S-001

Same self-audit posture as S-000 (no `code-audit.md` sub-agent spawn available to this executor):
- All 4 new `src/scaffold/*.ts` files import ONLY `node:fs`/`node:path` builtins and `../core/*` (or same-leaf siblings) — zero reverse dependency on `commons`, matching ADR-0044's leaf pattern and the "deviates → ADR-0044" touchpoint row.
- `src/commons/index.ts`'s new `scaffold` export is a thin wrapper delegating to `runScaffold` — no logic, no I/O, matching the "extend, aligns" touchpoint row.
- The `index.ts → expander.ts → classify-transport.ts → index.ts` import cycle is confined entirely within the `src/scaffold/` leaf (never crosses into `commons` or `core`) and is resolved safely by hoisted function-declaration semantics — verified via the full green suite, not merely asserted.
- FIT-01 (commons → scaffold → node:fs transitive fitness function) passed in the full suite run.
- No architectural findings. No sensitive-area/spec-drift signal — GateGuard's one true-positive-shaped fire (on `authoring-error-source.test.ts`, a filename substring match) was answered per its own protocol and is not itself a finding.

## Overall Progress (through S-001)

| Metric | Value |
|---|---|
| Slices complete | 2 (S-000, S-001) |
| S-001 tasks complete | 6/6 |
| Test suite | 935 pass / 0 fail (full repo, `bun test`, 115 files) |
| Typecheck | clean (`tsc --noEmit`) |

## S-002 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/scaffold/containment.ts` | Created | New leaf module (ADR-0044/0045/0046). `isWithinCeiling(candidateAbs, ceilingAbs)`: segment-aware, case-fold-on-win32/darwin-only ceiling comparison (kills the bare-`startsWith` sibling-prefix mutant, PRC-04.5). `validateSourceContainment({packageDir, packageRoot, relPath})`: lexical `../`/absolute screen → pre-realpath segment-aware ceiling check → `realpathSync` → post-realpath ceiling check → `lstat` regular-file allow-list; returns `{absPath, stat}` (the `lstat` `Stats` is REUSED by `classify-transport.ts`'s CCL-06 gate, no second stat call). Throws one of the four `source-*` reasons. ENOENT branch distinguishes two shapes (S1 ordering, REQ-PRC-07.2): (a) a BROKEN SYMLINK (its own entry lstats successfully, but the target it points to doesn't exist) — the target is resolved LEXICALLY via `readlinkSync` (single-hop; never existence-probed) and checked against the ceiling; (b) a GENUINELY missing entry (no symlink involved) — walks up to the nearest EXISTING ancestor and checks ITS realpath. Either shape: out-of-ceiling → `source-outside-package`; in-ceiling → `source-not-found`. `validateDestinationLexical(relPath)`: lexical-only guard (PRC-09) reusing the existing `invalid-input` reason — applied to the FINAL SDK-computed destination, pre-emit. |
| `src/scaffold/classify-transport.ts` | Modified | Removed the S-001 `placeholderContainmentGuard` and its own `statSync`-based existence/readability branching entirely. `classifyTransport` now takes `packageRoot` in addition to `packageDir`, delegates containment to `validateSourceContainment` FIRST (before any of its own stat/sniff/budget checks, PRC-08), and reuses the returned `stat` for the CCL-06 size gate. `readFileSync` is now wrapped in try/catch: a failure THIS LATE (containment already proved an in-ceiling regular file) classifies `source-unreadable` — distinct from a CONTENT-level classify failure, which stays `invalid-input` for `.template`-marked entries (CCL-05/AEC-12) and by-reference for everything else. |
| `src/scaffold/expander.ts` | Modified | `runScaffold` now resolves `packageRoot` from `currentContext()` (asserted non-null once `packageDir` is confirmed defined — both are ALWAYS seeded together by `context.ts`'s pre-`als.run` chokepoint) and passes it to `classifyTransport`. Added `validateDestinationLexical(destPath)` immediately before each `session.buffer(factory.create(...))` call, applied to the FINAL computed destination (post-rename, post-token-translation). *(S-004 additions to this same file are listed separately below.)* |
| `src/core/authoring-error.ts` | Modified | `AuthoringReason` 8→12: added `source-not-found`, `source-outside-package`, `source-not-regular-file`, `source-unreadable`. `originFor`: all four under the `authoring-rejected` arm. `messageFor`: four new arms deriving the AEC-11 V3 NEUTRAL "source file …" templates from `path` alone (no `"copy failed:"` prefix, no caller-supplied `message` needed — unlike `invalid-input`/`reserved-name`). JSDoc counts/examples updated 8→12 throughout. |
| `test/scaffold/containment.test.ts` | Created | Unit suite: PRC-01.1 (distinct anchors), PRC-04.1 (traversal string), PRC-04.2/.7 (symlink realpath-outside), PRC-04.3 (directory-as-source), PRC-04.4 (FIFO via stubbed `lstatSync` — unfixturable in CI), PRC-04.5 (sibling-prefix, direct `isWithinCeiling` unit test), PRC-04.6 (absolute source, no `..`), PRC-05.1 (package-relative message), PRC-07.1 (existing-vs-non-existing out-of-ceiling indistinguishable), PRC-07.2/S1 (broken symlink to out-of-ceiling target → `source-outside-package` never `source-not-found`), plain ENOENT-ancestor ordering (missing in-ceiling file, incl. a missing ancestor DIRECTORY), PRC-08.1 (zero `readFileSync` calls, spy-verified), PRC-09.1 (destination guard, both escaping and passing cases). |
| `test/scaffold/classify-transport.test.ts` | Modified | Every `classifyTransport(...)` call now passes `packageRoot` (all existing tests use `packageRoot: dir` since `scratchDirFactory` seeds the marker directly there — no behavior change for the CCL-0x tests). The "MINIMAL placeholder containment guard" describe block RENAMED to "REQ-PRC-04 — source containment, delegated to containment.ts" with both tests' expected reason updated `invalid-input` → `source-outside-package` (S-002.3's mandated update). |
| `test/core/authoring-error-source.test.ts` | Modified | New describe block "REQ-AEC-10 / REQ-AEC-11 — the four source-* reasons": one fixture per reason (missing in-ceiling source; lexically-escaping source; directory-as-source; an INJECTED `readFileSync` EACCES failure via `spyOn`, S18 precedent — never chmod), each asserting reason, origin, AND the exact AEC-11 message text. The union-arithmetic proof test updated "eight members" → "twelve members" with the 4 new cases added. |
| `test/scaffold/expander.test.ts` | Modified | New describe block "REQ-PRC-09.1 — destination lexical guard wiring": a `rename` map value with TWO `..` levels (one level alone only cancels `to`'s own depth and lands within-workspace — not a PRC-09 violation per the spec's own "resolves outside the workspace tree" wording; verified via `node -e` before writing the fixture) proves the guard is actually WIRED into `expander.ts`'s emit path, not just unit-tested in isolation. |
| `test/types/authoring-reason.test.ts` | Modified | Compile-time exhaustiveness pin extended 8→12 members (both the `switch` proof and the `expectTypeOf` union pin). |
| `test/fitness/dts-baseline/core.authoring-error.d.ts` | Modified | Regenerated (`bun run build` + manual copy per FIT-04's own header instructions) — additive `AuthoringReason` union growth only, confirmed via `diff` before copying. |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added `dist/scaffold/containment.{d.ts,d.ts.map,js}` (FIT-14 flagged them as new, unauthorized tarball entries as soon as `src/scaffold/containment.ts` existed). |

### S-002.4 — ADR-0018 amendment note: VERIFIED NO-OP

The task called for an ADR-0018 amendment note stating "containment is a lowering heuristic, not the size authority." Reading `openspec/decisions/0018-boundary-pass-through.md`'s existing "Amendment (2026-07-12, `schematic-local-files`)" section (already committed at PLAN time, dated the same day as the V3 spec sign-off) — it ALREADY states: *"the emit-time containment check is the REQ-ATH-11.2 run-boundary carve-out for the package read — DX/attribution, not the security control (the engine's apply-time re-derivation is, REQ-BRC-02)"* — matching the design's own Amendments list wording exactly ("0018 chunking/containment are lowering heuristics not size/security authority"). No edit was needed; recorded here per the S-000 precedent for pre-satisfied checklist items rather than forcing a redundant edit.

## Deviations from Design (S-002)

None beyond the two explicitly licensed by the slice contract itself: (1) the "MINIMAL placeholder containment guard" test block's expectations were updated from `invalid-input` to the real `source-*` reasons — explicitly flagged in-contract by slices.md S-002.3 ("update S-001's placeholder-guard test expectations to the real reasons"), not smuggled scope. (2) `readTemplateFile` (`src/scaffold/index.ts`) was deliberately NOT routed through `validateSourceContainment` — S-002.1's task line scopes the replacement to "S-001.3's placeholder guard inside classify-transport" specifically, and design's own Test Derivation table assigns every PRC-04 scenario to `test/scaffold/containment.test.ts` only (never `test/scaffold/index.test.ts`). `create({templateFile})`'s own containment hardening is therefore out of S-002's pinned scope as written, even though `package-root-containment`'s Purpose section names `create({templateFile})` among the three protected surfaces — flagging this explicitly rather than silently deciding, in case a later slice (or final verify) needs to close this gap.

## Bug found and fixed during S-002 (not spec-pinned, a genuine correctness bug)

The FIRST implementation of `validateSourceContainment` compared a REALPATH'd candidate path directly against a NON-realpath'd `packageRoot` ceiling. On macOS, `mkdtempSync(tmpdir())` returns a path under `/var/...`, but `/var` is itself a symlink to `/private/var` — so `realpathSync` of ANY file under a temp scratch dir resolves to `/private/var/...`, which does not lexically start with the non-realpath'd `/var/...` ceiling. This produced a FALSE `source-outside-package` rejection for every legitimately in-ceiling source on this platform, caught immediately by the existing S-000/S-001 regression suite (`test/scaffold/expander.test.ts`, `test/e2e/scaffold.e2e.test.ts`) going from 72/72 green to 22 failures the first time the full scaffold test set ran against the new containment module. Fixed by maintaining TWO ceiling representations — `lexicalCeiling` (raw `packageRoot`, compared only against a likewise non-realpath'd candidate, pre-realpath) and `realCeiling` (`realpathSync(packageRoot)`, compared only against a realpath'd candidate, post-realpath) — never mixing the two spaces in one comparison.

## TDD Cycle Evidence — S-002

Method statement (honest, per the S-000 lesson — commits `6fa8c5f`/`e388c71` land test+prod files together, so `git log` cannot establish RED-first either way; the evidence below is transcribed from in-session runner output, working-tree order):

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated |
|---|---|---|---|---|---|
| S-002.1 (containment core) | `containment.test.ts` (PRC-04.1/.2/.3/.6/.7, PRC-05.1, PRC-07.1/.2, PRC-08.1) | unit | The test file was written against `containment.ts`'s intended contract; its FIRST run produced 3 real failures — 2 exposing the macOS `/var`→`/private/var` lexical/real ceiling bug (genuine production bug, see "Bug found and fixed" above), 1 a fixture bug (lstat stub keyed on the lexical path where the module lstats the realpath'd form). The pre-existing S-000/S-001 suite doubled as a live safety net: the first full scaffold-test run against the new module went 22 red for the same ceiling bug (quoted output: `Expected: "invalid-input" / Received: "source-outside-package"`; `AuthoringError: source file outside package: files/a.ts...`) | ✅ | PRC-07.1 both directions (existing + missing out-of-ceiling target); PRC-04.5 both directions (sibling-prefix out / true-child in / ceiling-equals) |
| S-002.2 (reason union 8→12) | `authoring-reason.test.ts` (12-member pins), `authoring-error-source.test.ts::REQ-AEC-10/11` | contract + unit | The 12-member compile pins and four exact-message assertions structurally require all 12 union arms to exist. The `source-unreadable` fixture's first run failed for real (`Received: undefined` — spy keyed on the lexical path, module reads the realpath'd form), fixed by keying on `realpathSync(target)` | ✅ | Each of the 4 reasons has its own dedicated fixture asserting reason + origin + exact template text |
| S-002.3 (placeholder-test updates) | `classify-transport.test.ts` (renamed PRC-04 block) | unit | Expectation flip `invalid-input` → `source-outside-package`: RED trivially against the S-001 placeholder (which threw `invalid-input`), GREEN only after S-002.1 landed — the exact update S-002.3 mandates | ✅ | `..`-segment and absolute-path variants (PRC-04.1 vs .6, kills the dotdot-only mutant) |
| PRC-09 wiring | `expander.test.ts::REQ-PRC-09.1` | integration | **True RED**: the first fixture used ONE `..` level in the rename value and failed with `Received: undefined` (no throw) — `posix.join("out", "../escape.ts")` normalizes to `"escape.ts"`, within-workspace. Verified the join semantics via `node -e` BEFORE concluding fixture bug (not guard bug); fixed the fixture to two `..` levels → GREEN | ✅ | Unit-level guard tests in `containment.test.ts` cover the `..`/absolute/passing trio; this test pins the WIRING |

## Slice Audit (Step 7c) — S-002

Self-audit (no `code-audit.md` sub-agent spawn available to this executor):
- `src/scaffold/containment.ts` imports only `node:fs`/`node:path` builtins and `../core/*` (authoring-error, fs-errors) — matches the leaf pattern (ADR-0044), no reverse dependency.
- `classify-transport.ts` now imports `containment.ts` (same-leaf sibling) instead of doing its own raw `statSync`-based existence check — tightens the leaf's internal cohesion, no new external dependency.
- `AuthoringReason`'s exhaustiveness is enforced at BOTH runtime (`originFor`/`messageFor`'s `never`-default arms) and compile time (`test/types/authoring-reason.test.ts`) — both updated together, consistent with the file's own "MAJOR change" framing.
- No architectural findings. No sensitive-area/spec-drift signal — GateGuard fired twice more on this slice (`src/core/authoring-error.ts`, `test/types/authoring-reason.test.ts` — both `auth` substring matches on file paths unrelated to authentication) and was answered per its own 4-point protocol both times.

## Overall Progress (through S-002)

| Metric | Value |
|---|---|
| Slices complete | 3 (S-000, S-001, S-002) |
| S-002 tasks complete | 4/4 |
| Test suite | 963 pass / 0 fail (full repo, `bun test`, 117 files) |
| Typecheck | clean (`tsc --noEmit`) |

## S-004 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/scaffold/expander.ts` | Modified | Added `candidateBatchSize(pending, next)`: measures `Buffer.byteLength(JSON.stringify({protocolVersion:1, force:false, instructions:[...pending, next]}), "utf8")` — the EXACT same shape the fake measures at emit time, so the heuristic has zero calibration drift from the real authority (ADR-0019). Inside `runScaffold`'s per-file loop: after building each `create` directive, if `session.pendingSnapshot()` is non-empty AND adding the new directive would push the candidate batch's serialized size over `BATCH_CAP_BYTES`, the CURRENT pending group is flushed FIRST (`session.flush()`, fired WITHOUT awaiting) before the new directive is buffered. An over-cap SINGLE directive (pending empty) is never preemptively flushed — it buffers into its own group and genuinely rejects at the fake's `emit()`, unchanged (REQ-04.2). |
| `test/scaffold/batch-cap-chunk.test.ts` | Created | REQ-04.1 (3 files ≈4.5 MiB combined over cap, no 2-file group over cap → all commit, `result.emitted.length > 1` proves chunking happened, exactly one directive per file in walk order); REQ-04.2 (a lone file whose CONTENT passes classify's own CCL-02 budget but whose WRAPPED solo-group batch exceeds the cap by envelope overhead alone → genuine `changes-too-large` rejection); REQ-04.3 (exactly-at-cap solo-group batch passes, one-byte-over rejects — both via algorithmically-derived content lengths, mirroring the established CCL-02.3 pattern, never hardcoded magic numbers); REQ-05.1 (`runFactoryForTest`, a 2-flush scaffold where the SECOND file's directive collides against a seeded destination → `result.tree.size === 0`, nothing from the FIRST, successfully-flushed chunk survives). |

### The sync/async bridge — a design decision beyond the literal design doc text

`scaffold(): void` is a PINNED synchronous author surface (design §Data Model, T2 — a `WritableHandle` asymmetry rationale applies the same "no lying about materialization timing" logic here), yet `Session.flush()` is `async` and `session.ts` is explicitly `Read-only` in the design's own File Changes table (§A4) — no synchronous flush variant could be added. The design's own "Batch-cap chunked flush" prose ("it calls `session.flush()` first") does not address this sync/async tension explicitly.

Resolved by reusing the EXISTING `DialectRegistry` (`src/core/context.ts`, ADR-0037) — documented in its own source as generic over "anything with a `settle()`," not `dialect-handle.ts`-specific. Traced the actual JS semantics before committing to this: `Session.flush()`'s synchronous prefix (draining `#pending`, building the `Batch`, and `ContractFake.emit()`'s ENTIRELY synchronous body — verified by reading `src/testing/contract-fake.ts`, zero internal `await`s) runs to completion BEFORE `flush()`'s own `await this.#client.emit(batch)` line ever suspends it. So calling `session.flush()` synchronously WITHOUT awaiting, inside `runScaffold`'s loop, still mutates the fake's `#tree` in-order at the moment of the call — only the PROMISE's settlement (success or the `toAuthoringError`-wrapped rejection) is deferred. Registering `{ settle: () => flushPromise }` with `ctx.dialects` means `defineFactory`'s existing `await ctx.dialects.drain()` (which already runs BEFORE the run-end `session.flush()` and BEFORE `commit()`) surfaces a later-chunk rejection through the SAME catch → `discard()` path that already existed — `discard()` clears the ONE underlying `#tree` every chunk staged into, so run-level atomicity (REQ-05) holds with NO new mechanism, exactly as the design promises. Proven correct empirically too: `batch-cap-chunk.test.ts`'s REQ-05.1 case (2 flushes, second one collides) ends with an empty `result.tree` on the first attempt this was tested, no further debugging needed.

Flagging this explicitly (not silently) because it's a real architectural choice the design prose didn't spell out mechanically, even though the outcome matches the design's stated promise exactly ("run-level atomicity... needs NO new mechanism").

## TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated |
|---|---|---|---|---|---|
| S-004.1 + .2 | `batch-cap-chunk.test.ts` (REQ-04.1/.2/.3, REQ-05.1) | integration | Honest statement: the test file and the accumulator were written in one working pass, NOT literal test-first. RED validity rests on the tests' own self-checking structure: REQ-04.1 asserts `result.emitted.length > 1` — structurally false against the pre-S-004 expander (which emits exactly ONE batch per run), so the test cannot pass without the chunking change; REQ-04.2/.3's boundary contents are derived algorithmically (`soloBatchSize`/`soloEnvelopeOverhead`, measured via the SAME serialization the fake uses) with inline `expect(...).toEqual(BATCH_CAP_BYTES)`/`(+1)` self-assertions pinning each fixture to the exact boundary independent of the implementation under test | ✅ all 5 first-run green after implementation | REQ-04.3 brackets the `>` boundary from both sides (at-cap passes / one-over rejects); REQ-05.1 uses a collision-cause rejection — the in-loop verifier independently re-triangulated with a size-cause rejection on a later chunk, also green (verify-in-loop-4, adversarial table row 7) |

## Slice Audit (Step 7c) — S-004

Self-audit (no `code-audit.md` sub-agent spawn available to this executor):
- The chunked-flush accumulator lives entirely inside `expander.ts`'s existing fan-out function — no new module, no new public export, no touch to `session.ts` (respects the design's `Read-only` designation for that file).
- `DialectRegistry` reuse is an EXISTING, already-public-within-`core` seam (`RunContext.dialects`) — not a new cross-layer dependency; `expander.ts` already imports `currentContext` from `core/context.ts`.
- No architectural findings. No sensitive-area/spec-drift signal.

## Overall Progress (through S-004)

| Metric | Value |
|---|---|
| Slices complete | 4 (S-000, S-001, S-002, S-004) |
| S-004 tasks complete | 2/2 |
| Test suite | 963 pass / 0 fail (full repo, `bun test`, 117 files) |
| Typecheck | clean (`tsc --noEmit`) |

## Fix iteration 1 (after verify-in-loop-4, verdict NEEDS_FIX, routing LOCAL)

Report: `openspec/changes/schematic-local-files/verify-in-loop-4.md`. Three findings addressed, scope held exactly to the routing (the `readTemplateFile` deviation was ruled ADVISORY and routed to S-005 by the orchestrator — NOT touched here):

1. **CRITICAL — lexical/real space-mixing in the broken-symlink absolute-target branch** (`containment.ts`). RED first: wrote the evaluator's exact fixture (in-ceiling broken symlink with an ABSOLUTE target) as a regression test and observed the real failure — `Expected: "source-not-found" / Received: "source-outside-package"` — before touching production code. Fix: `resolveBrokenSymlinkTargetLexically` → `resolveBrokenSymlinkTargetRealAncestor` — BOTH target forms (absolute and relative) now normalize to a lexical absolute form first, then route through `nearestExistingAncestorRealpath`, so the value compared against `realCeiling` is ALWAYS in real space. The sibling relative-target branch was re-audited per the routing and unified into the same normalization: its old `join(realpath'd-parent, target)` result stayed partially lexical when an EXISTING intermediate directory of the target was itself a symlink — same defect class, now closed by the shared ancestor-realpath step, not just the reported branch. A second regression test pins the relative-target positive control (it passed against the old code for the simple fixture shape, but now also guards the unified path).
2. **W2 — case-fold coverage**: added a Q24 case-fold test to `containment.test.ts` asserting both directions per the CURRENT platform (folds on darwin/win32, not elsewhere), plus a case-identical control. RED proven by MUTATION (established S-000/S-001 precedent for characterization coverage): the fold was temporarily replaced with identity, exactly this test failed (`19 pass / 1 fail`, the Q24 test), mutant reverted (post-revert `git diff` shows no MUTANT marker), suite green.
3. **W1 — TDD Cycle Evidence tables for S-002/S-004**: added above (honest method statements included — S-004's table explicitly states it was NOT literal test-first and explains where its RED validity actually comes from).

W3 (`expect(fn).not.toThrow()` as sole assertion) was flagged by the verifier as mitigated-by-nature (a void, side-effect-free function's entire success contract IS not-throwing) and left as-is — no change made, recorded here so it doesn't read as overlooked.

## Overall Progress (through fix iteration 1)

| Metric | Value |
|---|---|
| Slices complete | 4 (S-000, S-001, S-002, S-004) |
| Test suite | 966 pass / 0 fail (full repo, `bun test`, 117 files) |
| Typecheck | clean (`tsc --noEmit`) |

## Next Step

Ready for verify in-loop iteration 2 on the S-002+S-004 batch. After pass: `/build --scope=slice:S-003` (Build Order step 4 — requires S-002: real `source-*` reasons exist before by-reference emission needs to attribute them). Open item routed to S-005 by the orchestrator: `readTemplateFile` containment (verify-in-loop-4 Deviation #1, ADVISORY — includes the `.d.ts` JSDoc doc-drift note).
