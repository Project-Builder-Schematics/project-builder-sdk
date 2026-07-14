# Verify In-Loop Result

**Change**: bare-factory-migration
**Iteration**: 3 (batch 2, fresh loop — iteration 1 of this batch)
**Scope**: S-001 + S-002
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All batch-2 acceptance criteria verified with real execution. Both self-reported defect
fixes adjudicated LEGITIMATE. Batch 3 (S-003 + S-004) unblocks.

- Tasks in scope complete: S-001 (2 files) + S-002 (9-file conversion + 3 error strings +
  commons JSDoc + FIT-06 R-6 + 3 new TES-09 tests + TES-10.1 token-scan test)
- Affected tests passed: 117/117 (15-file batch-2 set)
- Spec compliance for scope: all covered scenarios discharged (see matrix)
- Assertion audit: clean

---

## Spec Compliance Matrix (scope REQs)

| Requirement | Test | Result |
|---|---|---|
| REQ-ATH-19.1 (happy parity + drain→flush) | `harness-wrap-parity.test.ts:19` — dialect-USING factory (`ts.find().addImport`), asserts identical committed tree (`before`→`after`), full tree entries, and emitted batches across both drivers | ✅ pass (run) |
| REQ-ATH-19.2 (E1/E2 double-fault parity) | `harness-wrap-parity.test.ts:41` — identity assertions `error === e1`, `error.cause === e2` on BOTH paths (harness via one-shot prototype spy, restored in `finally`; manual via `FaultyDiscardFake`) | ✅ pass (run) |
| REQ-ATH-01.2 (exactly 3 keys) | `harness-result.test.ts:42` | ✅ pass (run) |
| REQ-ATH-06.1/.2 (throw/reject → discard + exact error) | `harness-result.test.ts:134,147` | ✅ pass (run) |
| REQ-ATH-11.1/.2 (in-memory invariant + carve-out) | `harness-in-memory-invariant.test.ts:67` + `harness-opted-in.test.ts` | ✅ pass (run) |
| REQ-ATH-14.1/.2 (in/out-of-ceiling reads) | `harness-in-memory-invariant.test.ts:119,151` | ✅ pass (run) |
| REQ-ATH-17.3 (positive fs-read oracle) | `harness-opted-in.test.ts:55` — asserts `existsSync`+`readFileSync`+`readdirSync` ALL fired against the package dir; a dropped-`packageDir` mutant leaves the list empty | ✅ pass (run), genuinely mutation-resistant |
| REQ-ATH-18.1/.2 (non-function TypeError / zero-arg) | `harness-result.test.ts:306,315` — `toBeInstanceOf(TypeError)` AND `not.toBeInstanceOf(AuthoringError)` | ✅ pass (run) |
| REQ-TES-09.1/.2/.3 (3 error strings) | new per-message tests in `test/scaffold/index.test.ts` (templateFile, copyIn) + `test/scaffold/expander.test.ts` (scaffold) — each asserts zero `defineFactory` token AND verb name AND `packageDir` remedy AND `invalid input: ` prefix AND `reason: "invalid-input"` via `expectAuthoringReason` | ✅ pass (run) |
| REQ-TES-10.1 (commons JSDoc zero tokens) | new `test/commons/jsdoc-bare-contract.test.ts`; independently: `rg -c defineFactory src/commons/index.ts` → 0 | ✅ pass (run) |
| REQ-ATH-01.3 / ATH-17.1/.2 (S-000 carry-over, regression) | FIT-08 unchanged + `harness-options-bag.test.ts` + `harness-opted-in.test.ts` regression blocks | ✅ pass (run) |

## §7 Requirements on `wrap-parity-support.ts` — all three honored

- **(a)** imports `defineFactory` DIRECTLY from `../../src/core/context.ts` (`:8`); the file
  never imports `runFactoryForTest` — no re-wrap possible (verified by reading the full file).
- **(b)** hand-built structural client (`:52-66`, four members mirroring
  `RecordingClient`'s shape); the private interface is NOT imported — only `ContractFake` +
  its options type, which ARE exported from `contract-fake.ts`.
- **(c)** `FaultyDiscardFake` present (`:25-36`), `discard()` always rejects with the
  injected error.
- The dialect-using factory requirement (§7: "a factory with no dialect calls cannot
  distinguish 'drain ran' from 'drain was a no-op'") is honored — the parity factory calls
  `ts.find("a.ts").addImport(...)` and the committed tree is asserted to contain the
  post-drain content on BOTH paths.

## Adjudication 1 — `test/skeleton/dry-run-public-contract.test.ts` edit → LEGITIMATE

**Builder's claim**: the file is not sentinel-class because it never imports `defineFactory`
from core (text-scan only).
**Verified TRUE**:
- Its complete import list is `bun:test`, `node:fs`, `node:path` (`:15-17`) — it imports
  NOTHING from `src/`; it reads `src/commons/index.ts` as text and scans JSDoc. Not a
  deep-import file under §16's definition (files importing `defineFactory` from
  `core/context.ts`).
- `test/skeleton/` is not in R-5's four-glob manifest, and the file is not among §16's
  named skeleton sentinels (`write-only-factory`, `reserved-lifecycle-names`,
  `dry-run-accessor`, `read-trichotomy` — all verified untouched; the ONLY test/skeleton
  diff vs merge-base is this one file).
- The edit itself is REQ-TES-10.1-consistent: the old pin (`toContain("defineFactory")`)
  asserted the EXACT token REQ-TES-10.1 now mandates be zero in `src/commons/index.ts` —
  keeping it would have made TES-10.1 and this pin mutually unsatisfiable. The replacement
  (`toContain("const run =")`) preserves the pin's intent (dryRun's `@example` shows in-run
  usage anchored to a factory declaration) and passed at runtime.

## Adjudication 2 — `test/scaffold/batch-cap-chunk.test.ts` leftover conversion → LEGITIMATE

The REQ-04.3 exactly-at-cap block previously drove the runner directly against a raw
`ContractFake` client; converted to route through `runFactoryForTest(run, undefined,
{packageDir: dir})`. Assertion strength preserved and slightly strengthened:
- The at-cap oracle is untouched: `soloBatchSize(pathTemplate, content)` still asserted
  `=== BATCH_CAP_BYTES` before the run.
- The outcome oracle is equivalent (`fake.committedTree().get("out/at.ts")` →
  `result.tree.get("out/at.ts")`, same `content` equality) PLUS a new
  `result.error toBeUndefined()` check the old block lacked.
- Routing through the harness is precisely the sanctioned migration path (the harness
  internally builds the same fake); the one-byte-over sibling test's rejection oracle is
  unchanged.

## Evidence Table

| Check | Command | Result |
|---|---|---|
| Regression sentinels (R-5 manifest) | `git diff --name-only $(git merge-base main HEAD) -- test/golden-ir test/core test/conformance test/dialects` | **Empty** |
| Frozen `defineFactory` body | `git diff --name-only <merge-base> HEAD -- src/core/context.ts` | **Empty** — file untouched entirely (stronger than the `:293-346` hunk requirement) |
| §16 deep-import sentinels | per-file diff over every `test/**` file importing from `core/context.ts` | Touched files are only: the two `test/scaffold` files (ADDITIVE-only TES-09 blocks — sole deletion is the extended commons import line; every pre-existing `defineFactory` test untouched), `ir-transcript.test.ts` (imports `currentContext`, not `defineFactory`; R-9-planned conversion), and the NEW `wrap-parity-support.ts` (S-001 by design). Zero §16-named sentinel files touched. |
| 9-file conversion (R-9) | `rg "^import.*defineFactory"` over all 9 | **Zero `defineFactory` imports**; the token survives only in 2 files' comments (prose describing the migration) — no spec scenario scans test-file comments |
| Batch-2 test set (15 files) | `bun test <15 files>` | **117 pass, 0 fail** |
| Full suite | `bun test` | **1217 pass / 56 fail** — matches builder claim exactly |
| Failure bucket attribution | per-file grouping | `author-emulation-scaffold.e2e` 45 + `corpus-format` 1 + `fit-24` 1 + `fit-28` 2 → S-004/S-005 (SCENARIOS/FactoryRunner/corpus); `installed-consumer.e2e` 6 → S-006; `.tmp-readme-copy-runnable/example-0` 2 → S-003. **Every failure slice-owned; zero unexplained** |
| Typecheck | `bun run typecheck` | **12 errors, 5 files** (`author-emulation-scaffold.e2e` 7, `fit-28` 2, `fit-24` 1, `corpus-format` 1, `scripts/regen-corpus.ts` 1) — all S-004/S-005-owned; matches builder claim |
| FIT-06 R-6 pairing | `rg` fit-06 + `src/testing/index.ts` | regex now `/@param\s+options\.seed\b/` (`fit-06:331`) AND the JSDoc line `@param options.seed` landed in the SAME commit `591aba4` — never green-on-stale |
| FIT-16 / FIT-08 untouched | name-only diff | Empty — correctly deferred to S-004 / S-006 |
| Error strings via `invalidInput()` | `git show 591aba4 -- src/scaffold/*` | Message-string-only edits, ADR-B wording (verb + "no package directory to resolve … against" + "pass `packageDir` to the call that runs this factory"), `invalid input: ` prefix kept, `templateFile "${relPath}"` detail clause kept |
| Resumed-diff skepticism | `git status --porcelain` + all above re-executed against committed state | Working tree clean except orchestrator-owned state files; no stray code diffs; every claim independently reproduced |

## Strict TDD (in-loop audit)

**Iteration**: batch-2 / 1
**Verdict**: ok
**Delta scope**: 15 test files (2 new S-001, 2 new TES-09 hosts extended, 1 new TES-10, 9 converted, 1 stale-pin fix), 4 impl files (message strings + JSDoc only)

- Failing-first evidence: the 9 converted files were RED in the batch-1 suite state
  (verified in verify-in-loop-1/2's failure buckets) and are green now — genuine red→green.
  `harness-wrap-parity.test.ts` red without `wrap-parity-support.ts` (same commit, per the
  slice's Failing-first declaration). TES-09/TES-10 tests red against the pre-rewrite
  strings/JSDoc, landed with the rewrite in one commit — same-commit red-green, consistent
  with the project's per-slice granularity.
- Banned patterns: none. `jsdoc-bare-contract.test.ts`'s single `not.toContain` is the
  spec's literal oracle (zero-token scan), not a weak assertion.
- Triangulation: parity proven on 2 distinct paths (happy + double-fault); error strings on
  3 distinct verbs; opted-in fork covered from both directions (17.1/17.2 S-000 pins +
  17.3 positive oracle + regression blocks).

## Findings

None blocking.

- **NOTE (not a finding)**: 2 of the 9 converted files retain the token `defineFactory` in
  explanatory comments (`harness-opted-in.test.ts:5,17`, `classify-transport.test.ts:5,18`).
  The builder's claim was zero IMPORTS (true); no signed scenario scans test-file comments
  (TES-10.1 scans `src/commons/index.ts`; ATH-20.1 scans the two fixture files, S-004).
  If S-006's final sweep wants comment hygiene, it is cosmetic.

---

## Orchestrator action

Exit the batch-2 loop. Batch 3 (S-003 + S-004) may start. Iteration 1 of 3 used for this batch.
