# Simplify Report — inline-collection-marker

Applied over the full change diff on `main` (HEAD `da02af7` at start), per the 4-lens
cleanup review. All fixes independently revertible; none required repair or reversion.

## Findings

| ID | Lens | Verdict | Notes |
|----|------|---------|-------|
| F1 | reuse | applied | Hoisted `extractCallArgs`/`WRITE_CALL_RE` (duplicated byte-for-byte between `test/fitness/fit-27-anti-tautology-scan.test.ts` and `test/support/src-invariant-scans.ts`) into `test/support/import-scan.ts` as exports; both call sites now import instead of redefining. |
| F2 | simplification | applied | Added a shared `findMatchingClose(source, openIndex, open, close): number` to `import-scan.ts` and rewired `extractCallArgs`, `extractFunctions`'s body-brace match, and `src-invariant-scans.ts`'s `loopBodies` header/body match onto it — three hand-rolled balanced-delimiter scans collapsed into one, semantics unchanged (verified byte-identical control flow). |
| F3 | simplification | applied | `src/scaffold/walk.ts`: factored the repeated `relPath === undefined ? plain : withLocator(relPath)` ternary out of all five message helpers (`rootUnreadableMessage`, `rootNotFoundMessage`, `rootNotDirectoryMessage`, `entryUnreadableMessage`, `entryDisappearedMessage`) into one private `withOptionalLocator`. Output strings confirmed byte-identical against `walk.test.ts` + `canary-no-echo.test.ts`. |
| F4 | efficiency | applied | Added one lazily-memoized `realSrcFileSnapshot()` to `test/support/src-invariant-scans.ts` (computed once per process, side-effect-free at import time); replaced the 7 call sites of the three local `realSrcFiles()` helpers across `fit-43`/`fit-44`/`fit-45` and deleted those local definitions (plus now-unused `SRC_DIR`/`collectFiles` imports where they fell out of use). |
| F5 | altitude | applied | `test/scaffold/path-guards.test.ts` replaced its hand-rolled `mkdtempSync`/`dirs`/`afterEach` scratch-dir boilerplate with `scratchDirFactory("path-guards-")` from `test/support/scratch-dir.ts`, matching the sibling pattern in `walk.test.ts`. Dropped the now-unused `afterEach` import. |
| F6 | efficiency/altitude | applied | `test/security/canary-no-echo.test.ts`: extracted `expectRejectsCanaryFree(dir, canary, thunk)` collapsing the common `ContractFake` → `rejectedRun` → `toBeInstanceOf(Error)` → `surfaceContains(...) === false` tail. Applied to the 13 call sites matching that exact shape (6 in the S-000 minimum subset, 7 in the S-001 hardened set). Two blocks were deliberately left untouched because they differ subtly from the shared shape: the recursive-walk case (extra `readdirSync` spy setup/teardown) and the `classifyTransport`-boundary NUL case (synchronous, manual try/catch, no `ContractFake`/`rejectedRun`) — forcing them into the helper would have papered over real structural differences. |
| A2 (orchestrator-skipped) | reuse | not attempted | Extending `instrumentHarnessIO` with an order-tracking/failure-injection mode and rewiring harness-opted-in + canary spies was rejected by the orchestrator ahead of this pass as re-mechanizing verified security-critical shared infra. Registered as a followup candidate rather than applied here. |

## Suite

- Baseline (pre-simplify, uncontended): 2398 pass / 0 fail
- Post-simplify run 1 (uncontended): 2398 pass / 0 fail
- Post-simplify run 2 (uncontended): 2398 pass / 0 fail
- `bunx tsc --noEmit`: clean (exit 0)

Test count unchanged (2398) — no fixes merged or removed any test cases, only shared
implementation.
