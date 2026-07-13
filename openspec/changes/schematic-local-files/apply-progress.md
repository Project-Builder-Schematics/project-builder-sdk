# Apply Progress: schematic-local-files

**Mode**: Strict TDD (double-loop: outer e2e test first, per-task RED-GREEN-TRIANGULATE-REFACTOR inside)
**Change**: `schematic-local-files` · **Triage**: L

## Slices Built

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | ✅ complete | 7/7 |
| S-001 | happy-path | ⬜ not started | 0/6 |
| S-002 | edge-case | ⬜ not started | 0/4 |
| S-003 | happy-path | ⬜ not started | 0/7 |
| S-004 | edge-case | ⬜ not started | 0/2 |
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

## Next Step

Ready for `/build --scope=slice:S-001` (folder scaffold by-value + classifier — by-reference arm throws). `S-001` `Requires: S-000` — now satisfied.
