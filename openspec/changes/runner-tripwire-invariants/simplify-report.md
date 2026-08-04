# Simplify gate — runner-tripwire-invariants

Quality-only pass over the change's full diff, run between the last in-loop verify pass
(`verify-in-loop-7`) and `sdd-verify --mode=final`. REQ behaviour is pinned by the signed
spec — no finding below changes any Given/When/Then outcome; each is a reuse, dedup, or
memoization cleanup with reason strings and public signatures kept byte-identical.

## Findings applied

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Scratch-factory unification — `preSeededRoot` (fit-42n:1659) + fit-46's five `mkdtempSync` sites now route through `scratchDirFactory` (`test/support/scratch-dir.ts`) | applied | `preSeededRoot` used raw `mkdtempSync` with no `afterEach` cleanup — a real leak, now closed. fit-46 declares `const scratchRoot = scratchDirFactory("fit-46-")` at module scope; all 5 sites + their manual `try/finally { rmSync(...) }` boilerplate replaced with `scratchRoot()` (cleanup now automatic). `fit-42-runner-closure-integrity.negative.test.ts` + `fit-46-publish-sequence-integrity.test.ts`: 161 pass, 0 fail. `tsc --noEmit`: clean. |
| 2 | fit-23 shared index logic — `checkExplicitRebuildStep` and `checkPublishOrdering` both re-derived `stampIndex`/`publishIndex`/the rebuild-between slice-some | applied | Extracted private `computePublishStepIndices(doc)` returning `{steps, stampIndex, publishIndex, hasRebuildBetween}`; both checkers consume it. All reason strings kept byte-identical (whole-verbatim tests pin them). `fit-23-publish-workflow-guard.test.ts`: 27 pass, 0 fail. |
| 3 | `sha256Bytes` reimplementation in fit-46 | applied | Deleted the local `createHash`-based `sha256Bytes`; imported the existing `sha256Bytes` export from `scripts/derive-runner-closure.ts` (same precedent as sibling fit-42n importing `sha256File` from there). `fit-46-publish-sequence-integrity.test.ts`: 5 pass, 0 fail. |
| 4 | Inline pass-through wrapper — `resetExemptionConsumptionForTest` (capability-admission.ts:619) had one caller and added no behaviour | applied | Inlined `anchorExemptionConsumed = false` directly into `resetAnchorExemptionLatch`; removed the wrapper. fit-42/fit-42n suites (which exercise `resetAnchorExemptionLatch`): pass. |
| 5 | Single tokenize/classify walk — `findBundlerTargets`/`findUnclassifiableBundlerConstructs` (bundler-disjointness.ts) duplicated the same loop | applied | Extracted internal `classifyBundlerConstructs(scripts)` producing both `targets` and `unclassifiable` in one walk; both exports became thin filters over it. Public signatures unchanged. fit-42n's S-003 bundler-disjointness describe blocks: pass. |
| 6 | `plantTree` reuse — 3 hand-inlined `mkdirSync`+`writeFileSync` sequences in fit-42n (~1426, ~1437, ~1795) | applied | Replaced each with `plantTree({ "entry.js": content })` (the file's own helper, line 68). `fit-42-runner-closure-integrity.negative.test.ts`: 156 pass, 0 fail. |
| 7 | Memoize `closureFileBytes` (fit-42:349) — read the full closure's bytes from disk twice (CRLF check, then BOM check) | applied | Module-level `closureFileBytesCache`, same idiom as the file's own `derivedFromDistDir`/`distDirDerivation` memoization. `fit-42-runner-closure-integrity.test.ts`: 64 pass, 0 fail. |
| 8 | Shared closure derivation — fit-42's `derivedFromDistDir` and `test/docs/runner-integrity-docs.test.ts`'s `beforeAll` both independently called `deriveRunnerClosure(ensureTscBuild(), ENTRY_RELATIVE_PATH)` | applied | Hoisted a memoized `ensureRealClosureDerivation()` into `test/support/shared-build.ts` (same module-singleton pattern as `ensureTscBuild`); both call sites now consume it (fit-42 still wraps its own result in `freezeDerivation`, unchanged). `fit-42-runner-closure-integrity.test.ts` + `test/docs/runner-integrity-docs.test.ts`: 91 pass, 0 fail. `tsc --noEmit`: clean. |
| 9 | Corpus-completeness helper — 3 near-identical `readdir(dir).sort() === declared.sort()` assertions in fit-42n (~1416, ~1613, ~1682) | applied | Extracted `expectCorpusMatchesDeclared(dir, declared)` into new `test/support/corpus-completeness.ts`; all three sites call it, each keeping its own `it(...)` wording and its own `DECLARED`/fixture-key list. `fit-42-runner-closure-integrity.negative.test.ts`: 156 pass, 0 fail. |

## Skipped (orchestrator decision, recorded verbatim)

- **closure-integrity-checks.ts split-idiom dedup (marginal).**
- **Cross-describe violation cache in fit-42n (would couple tests; `-t` filtered runs would break).**

Neither was attempted by the builder — the orchestrator's simplify-gate triage excluded them
before this apply pass began.

## Gate outputs

- Per-finding affected-test runs: all green (see Evidence column above).
- Full suite after all 9 findings applied: `bun test` → **2548 pass, 0 fail**, 5650
  `expect()` calls, 202 files, 81.76s.
- `tsc --noEmit`: clean (run after each finding touching type surfaces, and once at the end).
- Standing anti-`toContain` scan (`REQ-CST-06.1`, 4 files × repeated assertions, part of the
  156-test fit-42n run above): green — no reason-string wording changed.
- Whole-verbatim assertions across fit-23/fit-42/fit-42n/fit-46: green — every reason string
  touched by findings #1–#9 was preserved byte-for-byte.

## Byte-neutrality confirmation

`scripts/capability-admission.ts` and `scripts/bundler-disjointness.ts` are build-time-only
(never in the runner closure), so findings #4 and #5 should be structurally incapable of
moving the manifest digest. Confirmed empirically:

```
$ rm -rf dist && bun run build
runner-manifest: 24 files -> dist/runner-manifest.json
runner-manifest-sha256: 31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde
```

Matches the required digest `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde`
exactly (also reconfirmed identical against a pre-change baseline build taken before any
finding was applied). No revert was needed.

## Reverted

None. All 9 findings applied cleanly on the first attempt; no fix regressed a test.

## Commits

1. `19b77d3` refactor(capability-admission): inline resetExemptionConsumptionForTest
2. `3b6132d` refactor(bundler-disjointness): share one tokenize/classify walk
3. `ca53dbe` refactor(fit-23): extract shared stamp/publish/rebuild index computation
4. `33fbd97` refactor(fit-46): reuse sha256Bytes from derive-runner-closure
5. `889dd9a` refactor(fitness): unify scratch-root creation through scratchDirFactory
6. `1757b2c` refactor(fit-42n): reuse plantTree for hand-inlined mini-closures
7. `ecd6283` perf(fit-42): memoize closureFileBytes to avoid a second disk read
8. `200ebeb` refactor(shared-build): hoist ensureRealClosureDerivation, one singleton for both call sites
9. `19574eb` refactor(fit-42n): extract expectCorpusMatchesDeclared corpus-completeness helper
