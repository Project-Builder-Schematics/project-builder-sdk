# Verify In-Loop Result

**Change**: stage-5-first-dialect
**Iteration**: 2/3
**Scope**: S-002 (The Real Dialect — ts-morph, `./typescript`, `addImport`)
**Mode**: in-loop (Strict TDD)
**Delta**: `7f88afa..HEAD` (`3c04bd5`, `bc073d2`, `ed5ab53`, `7444c51`)

---

### Verdict: PASS

All scope checks green. Loop can exit for this batch.

- Tasks in scope complete: 10/10 (S-002)
- Full suite: 729/729 passed (0 fail), 1280 `expect()` calls — `bun test` (up from 689 pre-batch, matches apply-progress's claimed delta)
- `bunx tsc --noEmit`: clean (exit 0)
- `bun run build`: clean (exit 0 — tsc build + bin bundle)
- Spec compliance for scope: all S-002-covered scenarios directly evidenced (see matrix) except one non-blocking documentation-debt finding (spec-text drift, not a code/test gap)
- Assertion audit: clean — no banned patterns in any S-002 delta test file; every coalescing/split/e2e/golden assertion is byte-exact per constraint 7

Orchestrator action: proceed to `/build --scope=slice:S-003` per apply-progress's own recommendation. One non-blocking followup below should be picked up opportunistically (spec micro-unfreeze), consistent with the same class of finding already accepted in iteration 1.

---

## Mandatory Execution Evidence (run by this verify pass)

| Check | Result |
|---|---|
| `bun test` (full suite) | 729 pass / 0 fail / 1280 `expect()` — up from 689 pre-batch |
| `bunx tsc --noEmit` | clean, exit 0 |
| `bun run build` | clean, exit 0 (tsc build + bin bundle) |
| ts-morph three-way pin | `package.json#dependencies.ts-morph = "28.0.0"` (exact, no caret/tilde) — matches `bun.lock` (`"ts-morph": ["ts-morph@28.0.0", ...]`) — matches ADR-0038 Decision section (`ts-morph@28.0.0`, resolved 2026-07-12) — all three atomic and consistent |
| Frozen subpath resolves | Live probe: `import * as ts from "@pbuilder/sdk/typescript"` resolves; `ts.find(path)` returns a handle exposing `addImport` as a function. Import graph of `src/dialects/typescript/**` contains zero occurrences of `Session`/`DirectiveFactory`/`EngineClient` (full-tree `rg`, comments included) |
| MC-03 read-routing scan | `read-routing.test.ts` genuinely scans and asserts `[]` violations; its own red-proof (planted `test/fixtures/red/dialect-typescript/direct-engine-read.ts` importing `EngineClient` directly) fails the same scanner when run against it — spot-checked by reading the fixture and the scanner's comment-stripping logic; the scan is live, not vacuous |
| Goldens (byte-exact) | Inspected all 5 committed goldens (`add-import-{before,after}`, `coalesced-two-edits`, `split-directive-{1,2}`) with `cat -A`; every content assertion in `dialect.test.ts`/`coalescing.test.ts`/`dialect-modify.e2e.test.ts` compares against `golden(...)` via `.toBe(...)`, never count-only |
| FIT-03 `/typescript` budget | `--packages=external` build mode confirmed in `fit-03-commons-bundle-budget.test.ts`; budget constant `TYPESCRIPT_BUDGET_BYTES = 32 * 1024` (matches apply-progress's claimed 6.82 KB actual / 32 KB committed); oversized red-proof present; commons-bundle AST-specifier assertion untouched (still scoped to `src/commons/index.ts` only) — NOT weakened |
| `detectNewLineKind` purity + coverage | Pure exported function in `ast.ts`; `dialect.test.ts` REQ-TSD-02.2 asserts it directly on LF, CRLF-dominant, tie, and empty samples. Re-derived the tie case by hand (`"a\r\nb\nc"`: crlf=1, bareLf=1, `1>1` false → LF) — matches the test's own comment and the design's algorithm |
| BOM workaround (empirical) | Reproduced independently: `parse()` of a BOM-prefixed source + `print()` round-trips the BOM (`WeakMap` mechanism confirmed working, not just asserted) |
| Parse-failure containment (empirical) | Reproduced independently: malformed syntax (`const x = ;`) throws `"syntactically invalid TypeScript source"`; a type-error-only-but-syntactically-valid source (`const x: string = 123;`) does NOT throw; empty source parses cleanly — confirms `getSyntacticDiagnostics` genuinely distinguishes syntax vs. semantic errors as claimed, not merely asserted |
| Frozen error taxonomy | All four tails (`raw() on "{path}" threw`, `could not parse "{path}" as TypeScript`, `could not print "{path}"`, `"{path}" does not exist — create it first in this run`) verified byte-exact in `src/core/dialect-handle.ts` against design §4.4's table; `ERROR_PREFIX` construction site confirmed to exist exactly ONCE in `src/` (`rg "dialect operation failed"` → 1 hit) — constraint 3 held |
| Toy-dialect isolation (constraint 2) | `rg "toy-dialect"` across `src/`, `test/dialects/`, `test/conformance/`, `test/e2e/dialect-modify.e2e.test.ts`: only reference is `test/conformance/toy-dialect-smoke.test.ts` (S-001's own sanctioned smoke test, per design's Q2/rev-4 "toy-smoke boundary" — still legitimately present until S-004 replaces it). No S-002 file imports it. |
| Toy → real: FIT-04 dts baseline | `diff test/fitness/dts-baseline/typescript.index.d.ts dist/dialects/typescript/index.d.ts` → IDENTICAL |
| Halt-check (constraint 1) | Confirmed via apply-progress's own log + re-confirmed live: `fit-01-commons-no-ast.test.ts` passes in the current full suite, `ts-morph` is present in `dependencies` (post-S-000-gate landing, as expected at this point in the batch sequence) |

## Completeness (S-002)

| Slice | Tasks | Status |
|---|---|---|
| S-002 | 10/10 | complete |

## Spec Compliance Matrix (scope: S-002)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-TSD-01.1 | subpath resolves, thin op-pack shape (`.raw`+`addImport` only) | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-TSD-01.2 | addImport before/after byte pair vs. golden | `dialect.test.ts` + golden | ✅ COMPLIANT |
| REQ-TSD-02.1 | fresh-Project-twice byte-identical + golden match | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-TSD-02.2 | explicit newLineKind, content-derived, never host-OS | `dialect.test.ts` (LF/CRLF/tie/empty + static scan) | ✅ COMPLIANT |
| REQ-TSD-02.3 | language-service formatter never invoked | `dialect.test.ts` (spy, zero calls) | ✅ COMPLIANT |
| REQ-TSD-05.1 | subpath smoke-resolves and runs against ContractFake | `dialect-modify.e2e.test.ts` Flow 1 (functionally satisfies the GWT; canonical test lands in S-004 per design's derivation table) | ✅ COMPLIANT |
| REQ-TSD-06.1 | dependency pinned exact, lockfile committed | `fit-14-package-surface.test.ts` + live `package.json`/`bun.lock` inspection | ✅ COMPLIANT |
| REQ-TSD-07.1 | zero real-engine imports in dialect suite | `read-routing.test.ts` + manual `rg` confirmation | ✅ COMPLIANT |
| REQ-DG-04.1 | TS dialect imports only sanctioned kit surface | `fit-08-no-kit-bleed.test.ts` + manual import-graph read | ✅ COMPLIANT |
| REQ-MC-01.1/.2 (e2e restatement) | 2 ops no read → 1 modify; 2 handles/2 paths independent | `coalescing.test.ts`, `dialect-modify.e2e.test.ts` Flow 1/2 | ✅ COMPLIANT |
| REQ-MC-02.1/.2/.3 (e2e restatement) | split-by-read, RYOW, cross-path global flush | `coalescing.test.ts`, `dialect-modify.e2e.test.ts` Flow 3 | ✅ COMPLIANT |
| REQ-MC-03.1/.2 | no direct EngineClient.read + red-proof | `read-routing.test.ts` | ✅ COMPLIANT |
| REQ-MC-05.1 (e2e restatement) | dryRun over coalesced chain, one planned modify | `coalescing.test.ts` | ✅ COMPLIANT |
| REQ-MC-06.1 (e2e restatement) | forgotten-await joins; throwing case contained, no unhandledRejection | `coalescing.test.ts`, `dialect-modify.e2e.test.ts` Flow 4 (both cases) | ✅ COMPLIANT |
| REQ-DG-03.2 (F1 followup, iter-1) | `.raw()` BEFORE named op still coalesces | `coalescing.test.ts`, `dialect-modify.e2e.test.ts` Flow 2 | ✅ COMPLIANT — closes iteration-1 Finding 1 |
| PKG-01 (delta) | `./typescript` wired, resolves | `fit-09-pkg-exports-resolution.test.ts` | ✅ COMPLIANT |
| FPS-02.1 (delta) | exports/dependencies exact authorized set | `fit-14-package-surface.test.ts` | ⚠️ PARTIAL — test correctly reflects actual authorized reality (5 entries incl. pre-existing `./testing`), but literally contradicts the SIGNED spec scenario's "FOUR entries... no more, no less" text — see Finding 1 |
| FPS-02.2 | tarball: bin + `dist/dialects/typescript/**` present, nothing else new | `fit-14-package-surface.test.ts` (path confirmed `dist/dialects/typescript/**` per Amendment (e)) | ✅ COMPLIANT |
| FIT-03 | `./typescript` own byte budget, `--packages=external` | `fit-03-commons-bundle-budget.test.ts` | ✅ COMPLIANT |
| FIT-04 | `typescript.index.d.ts` baseline, first-commit | `fit-04-dts-semver-gate.test.ts` + baseline (byte-identical to live build) | ✅ COMPLIANT |
| FIT-05 (extended) | coalesced dialect directive JSON round-trip | `fit-05-serializable-bytes.test.ts` | ✅ COMPLIANT |
| FIT-06 (extended) | `./typescript`'s `find` carries `@example` | `fit-06-example-jsdoc.test.ts` | ✅ COMPLIANT |

## Assertion Quality / Strict TDD (in-loop, delta scope)

- **Banned patterns**: none found in any S-002 delta test file (`dialect.test.ts`, `coalescing.test.ts`, `read-routing.test.ts`, `dialect-modify.e2e.test.ts`) — scanned for `toBeDefined()`/`toBeTruthy()`/`toBeFalsy()`/`objectContaining(...)`/lone `.not.toThrow()`. One `toBeDefined()` in the extended `fit-05` test is a type-narrowing guard followed by substantive content assertions, not the assertion of record — not a violation.
- **Triangulation**: `detectNewLineKind`'s conditional logic has 4 driving cases (LF/CRLF/tie/empty); `addImport`'s merge-vs-fresh-clause branch has both cases exercised across `dialect.test.ts`/`coalescing.test.ts`; the parse-failure branch has both a throw path (S-003 scope, mechanism verified empirically here) and a non-throw path (implicit in every passing test). No triangulation gaps in scope.
- **TDD cycle evidence**: apply-progress documents genuine RED findings during development (wrong `NewLineKind` enum-ordinal assumption, a real false-positive in the read-routing scanner caught and fixed via comment-stripping) — both independently plausible and, for the enum-ordinal case, corroborated live (`NewLineKind.CarriageReturnLineFeed === 0`, `LineFeed === 1`, consistent with "expected 0, got 1"). Batch-oriented commit-per-mechanism, consistent with this project's already-accepted house convention (stage-2/3/4, and iteration 1 of this same change).
- **Regression**: full suite green, no regressions (689 → 729, delta of +40 fully attributable to new S-002 tests).

## Findings

### Finding 1 — WARNING (routing: SPEC, non-blocking, documentation debt)

**Signed spec scenario REQ-FPS-02.1 is falsified by the actual (correct) shipped state.** `specs/factory-package-shape/spec.md` REQ-FPS-02 states: *"The exports map's expected set is now FOUR entries — `.`, `./commons`, `./conformance`, `./typescript`... and MUST NOT gain a FIFTH"*, and Scenario REQ-FPS-02.1 asserts *"it is EXACTLY `.`, `./commons`, `./conformance`, `./typescript` — no more, no less."* The actual `package.json#exports` (confirmed live) and the shipped tests (`fit-09-pkg-exports-resolution.test.ts`, `fit-14-package-surface.test.ts`, both literally titled/asserting "the five authorized entries") both correctly include a FIFTH entry, `./testing`, which `stage-4b-testing-harness` landed on `main` independently before this branch's own S-002 batch ran (documented candidly in apply-progress Deviation #2). The implementation is objectively CORRECT (there really are 5 legitimate subpaths; nothing leaked, nothing extra) — but the literal SIGNED V4 spec text a future reader would treat as source-of-truth is now wrong. This is the same root cause and same class as iteration-1's Finding 2 (REQ-FIT-01 spec text stale relative to a ratified ruling) and should receive the same treatment: non-blocking for in-loop exit, but the spec should not reach final verify/archive un-reconciled. Recommend an `sdd-spec` micro-unfreeze of `REQ-FPS-02` (and, less urgently, `REQ-PKG-01`, whose text is incomplete but not literally self-contradicting since it never claims exhaustiveness) to state the true authorized set: `.`, `./commons`, `./conformance`, `./testing`, `./typescript`.

**Distinction from the ADR/FIT-number renumbering deviations (already sanctioned)**: those were pure numbering collisions with zero content attached to the specific number. This is different — the drift is in the spec's own enumerated, normative scenario text, not a label. Flagging explicitly rather than silently folding it into the "same precedent" bucket.

## Deviations From Plan (apply-progress.md) — Judged

| # | Deviation | Judgment |
|---|---|---|
| 1 | ADR "0033" → ADR-0038 renumber (stage-4b + S-001's own 0037 collision) | SANCTIONED — same established precedent as iteration 1's ADR-0037 renumber; content verbatim, header documents the collision. |
| 2 | Exports-map count: design's "four entries" → actual five (`./testing` pre-existing) | PARTIALLY SANCTIONED — the code/test correction to reality is right and necessary; the un-reconciled SIGNED SPEC TEXT is the gap. See Finding 1. |
| 3 | BOM re-prepend via private `WeakMap<SourceFile, boolean>` (design's "preserved by ts-morph independently" assumption did not hold for ts-morph@28.0.0) | SANCTIONED — verified empirically (reproduced independently in this verify pass); confined to `ast.ts`, invisible to the frozen `Ast = SourceFile` type, no signature change; correctly scoped as prep for S-003's REQ-TSD-03.6, not yet test-covered by S-002 (S-002 doesn't reach TSD-03) — accurate self-assessment. |
| 4 | `getSyntacticDiagnostics`-based parse-failure detection (ts-morph's parser doesn't natively throw) | SANCTIONED — verified empirically (reproduced independently: throws on real syntax errors, not on type-only errors, not on empty content); explicitly executor latitude per design §4.3 Q4 (the internal failure-detection mechanism is not itself a frozen contract); correctly scoped as mechanism-only this batch, not yet REQ-TSD-04.1-tested (S-003 scope). |
| 5 | `codegen-cli.test.ts`: zero-deps → exactly-`[ts-morph]` assertion | SANCTIONED — required by constraint 8 (suite must stay green); genuinely narrowed, not weakened (any OTHER dependency still fails). |
| 6 | `installed-consumer.e2e.test.ts`: removed non-routable `BUN_CONFIG_REGISTRY` override, kept `--ignore-scripts` | SANCTIONED — required by constraint 8 (ts-morph now needs real registry resolution); `--ignore-scripts` (the actual supply-chain guard against a malicious lifecycle script) is retained; well-documented in the file's own header; touches a sensitive area (supply chain) but the reasoning is sound and the guard that matters stays in place. |

## Files Changed (verified against apply-progress.md's table)

Matches apply-progress.md's Files Changed table for S-002. Spot-checked `src/dialects/typescript/{index,ast,ops}.ts`, `src/core/dialect-handle.ts` (unchanged this batch, confirmed single error-prefix site), `package.json`, `bun.lock`, `openspec/decisions/0038-*.md`, `openspec/decisions/0014-*.md` (amendment), all 4 new `test/dialects/typescript/*.test.ts` files, `test/e2e/dialect-modify.e2e.test.ts`, all 5 golden files, the 2 collateral fixes, and the 6 modified fitness test files + `pkg-surface-baseline.json`. No undisclosed file changes found (`git diff --stat 7f88afa..HEAD` matches the table).

## Risks Carried Forward

- Finding 1 (this iteration) — non-blocking, recommend spec micro-unfreeze before final verify/archive.
- Iteration 1's Finding 2 (REQ-FIT-01 spec text stale) — still open, not yet closed; carry forward.
- Iteration 1's Finding 1 (REQ-DG-03.2 untested) — CLOSED this batch (`coalescing.test.ts` F1 test + `dialect-modify.e2e.test.ts` Flow 2).
- S-003's TSD-03/04 edge scenarios will exercise the BOM and parse-failure mechanisms this batch built but did not yet test — expected, correctly scoped, not a gap.

## Next Recommended

`/build --scope=slice:S-003` (per apply-progress.md's own recommendation) — S-002 complete confirmed. S-004 (conformance core) is parallelizable with S-003 once S-002 is confirmed complete (this verify pass). Recommend picking up Finding 1's spec micro-unfreeze opportunistically alongside S-003/S-004, or at latest before final verify — consistent with how iteration 1's Finding 2 was carried forward.
