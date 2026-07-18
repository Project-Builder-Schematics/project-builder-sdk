# Verify In-Loop Result

**Change**: context-singleton-fix
**Iteration**: 1/3
**Scope**: S-000 + S-001 (complete change)
**Mode**: in-loop (Strict TDD)
**Commit range**: `6db2f5e..3892c44` on `fix/context-singleton` (326668b S-000, 3892c44 S-001)

---

### Verdict: NEEDS_FIX

## Completeness

15/15 tasks marked `[x]` across S-000 (7/7) and S-001 (8/8) in `slices.md`. Both slices report `complete` in `apply-progress.md`.

## Correctness — REQ coverage (structural)

All 7 REQ-MIS clauses have implementation/test evidence in the diff, matching design rev 3 §4.6's Test Derivation table exactly (12 rows, all 7 REQ-IDs). No structural gaps found.

## Mandatory checks (real execution evidence)

**1. Dual-realm genuineness (REQ-MIS-05 false-green clause) — CONFIRMED GENUINE.**
Traced the import graph by hand:
- `dist/bin/pbuilder-runner.js` → `dist/transport/runner.js` → `dist/core/context.js` (compiled dist realm).
- `test/fixtures/frame-runner/happy/factory.ts` (spawned via `file://…factory.ts`, loaded through `runner.ts`'s dynamic `import(moduleUrl)`, so Bun transpiles the `.ts` in place — never compiled) imports `../../../../src/index.ts` → `src/commons/index.ts` (`import { currentContext } from "../core/context.ts"`) → `src/core/context.ts` (uncompiled src realm).
These are two distinct module identities in one process — not a same-copy topology. Ran `bun test test/fake/dist-runner-dual-realm.e2e.test.ts` myself: **1 pass, 0 fail** (428ms).

**2. RED-proof plausibility — CONSISTENT with the code.**
Read `src/transport/runner.ts`'s top-level catch (lines 329-343): label resolution is `err instanceof AuthoringError || err instanceof TransportFault || err instanceof IntentRejectedError ? err.message : "run failed"`, and `classifyExitCode` (`src/transport/exit-codes.ts`) falls through every `instanceof` branch to `return 4` when none match. Cross-realm, the thrown `AuthoringError` is an instance of the SRC realm's class while the DIST realm's catch checks against its OWN class — the `instanceof` genuinely misses, producing exactly the generic `"run failed"` label and exit `4` the evidence file claims. Mechanism is internally consistent with the actual source, not just asserted.

**3. Non-vacuousness spot-check (self-executed, 2 mutations) — CONFIRMED non-vacuous.**
- Mutation A: stripped `resolveRunAls`'s occupied-slot throw (trust blindly). Ran `test/skeleton/context-registry.test.ts` → **3 failures** (the 3 collision/triangulation tests, exactly as expected) — RED confirmed. Reverted; re-ran → **13 pass, 0 fail** — GREEN confirmed. `git diff --stat src/core/context.ts` after revert → empty (byte-identical).
- Mutation B: made the absent-slot branch of `resolveRunAls` memoize a single fresh ALS instance (breaking the "never memoizes" guarantee). Ran the same file → **1 failure** (the two-fresh-instances-differ triangulation test) — RED confirmed. Reverted; re-ran → **13 pass, 0 fail** — GREEN confirmed. `git status --porcelain src/core/context.ts` / `git diff --stat` after revert → empty.
Both mutations targeted production branches the tests are supposed to guard; both produced the expected RED, and the tree is provably clean afterward (not "looked clean" — diffed).

**4. Frozen descriptor + no-pollution — CONFIRMED matches design rev 3.**
`getRunAls()` installs via `Object.defineProperty(globalThis, registryKey, { value: resolved, writable: false, enumerable: false, configurable: false })`, install-gated by `if (slot === undefined)` — exact match to design §4.3's spec. `context-registry.test.ts`'s own REQ-MIS-01.2 tests (`Object.keys(globalThis)` unchanged; slot reachable only via `Object.getOwnPropertySymbols`) passed as part of the full-suite run below.

**5. Full suite + typecheck + build at HEAD.**
- `bun test` (full suite): **1983 pass / 0 fail**, 188 files, 42.36s — matches `apply-progress.md`'s claimed post-S-001 numbers exactly.
- `bun test test/fake/fake-engine-harness.e2e.test.ts` (REQ-MIS-03.1 non-regression): **5 pass / 0 fail** — unchanged, still green.
- `bun run build` (`tsc -p tsconfig.build.json && bun run build:codegen`): **succeeded**, `dist/bin/pbuilder-runner.js` and `dist/core/context.js` regenerated fresh (verified `Symbol.for` present 3× in the rebuilt `dist/core/context.js`).
- `bun run typecheck` (`tsc --noEmit`, project-wide, includes `test/`): **FAILED — 2 errors**, both in `test/skeleton/context-registry.test.ts` (new file, S-001):
  ```
  test/skeleton/context-registry.test.ts(136,41): error TS2769: No overload matches this call.
    Argument of type 'AsyncLocalStorage<unknown>' is not assignable to parameter of type 'AsyncLocalStorage<RunContext>'.
  test/skeleton/context-registry.test.ts(141,41): error TS2769: No overload matches this call.
    Type '{ run: () => void; getStore: () => undefined; }' is missing the following properties from type 'AsyncLocalStorage<RunContext>': disable, name, exit, withScope, enterWith
  ```
  Root cause: `resolveRunAls` returns `AsyncLocalStorage<RunContext>`; `expect(resolveRunAls(realAls)).toBe(realAls)` (line 136) and `...toBe(duckAls)` (line 141) infer `toBe`'s expected-argument type from the received value's type, so passing an `AsyncLocalStorage<unknown>` / a bare duck-object where `AsyncLocalStorage<RunContext>` is expected fails structural/generic assignability. `bun test`'s own transpiler does not type-check (which is why the suite ran green despite this), but the project's `typecheck` script does, and would fail CI. This is isolated to the new test file — zero production-code impact — and is a straightforward test-typing fix (type `realAls`/`duckAls` to match, or narrow the assertion).

**6. Strict TDD audit.**
- S-000: genuine double-loop RED→GREEN. `red-evidence.md` command-1 output (`bun test`, exit 1, `Expected: 0, Received: 4`) and command-2 driver output (`exitCode: 4, stderr: "...run failed"`) both read as real, unedited tool output (matches the mechanism verified in check #2). The e2e was written and run pre-fix first (S-000.3), then the fix landed (S-000.4) — task order in `slices.md` and the single atomic commit `326668b` (context.ts + shared-build.ts + the new e2e together) both corroborate this.
- S-001: tests-after against already-fixed code, per the orchestrator's explicit exception for this slice — `apply-progress.md` documents this exception and backs it with mutation-checks for the 2 highest-risk tests (S-001.5, S-001.5b) plus structural reasoning for the rest. My own 2 independent mutation-checks (item 3 above) corroborate the claimed methodology works and left no residue: `git diff --stat`/`git status --porcelain` on `src/core/context.ts` are empty after each revert, and the committed `context-registry.test.ts` (read in full) contains no leftover mutation-check artifacts (no dead code, no stray debug branches).

## Spec Compliance Matrix (scope)

| Requirement | Test | Result |
|---|---|---|
| REQ-MIS-01.1 | `dist-runner-dual-realm.e2e.test.ts` (REQ-MIS-05.1 case) | ✅ COMPLIANT |
| REQ-MIS-01.2 | `context-registry.test.ts` (no-pollution) | ✅ COMPLIANT |
| REQ-MIS-01 (accessor contract) | `context-registry.test.ts` (collision + reuse/absent) | ✅ COMPLIANT |
| REQ-MIS-02.1 | `context-registry.test.ts` (golden key) | ✅ COMPLIANT |
| REQ-MIS-03.1 | `fake-engine-harness.e2e.test.ts` (unchanged, still green) | ✅ COMPLIANT |
| REQ-MIS-03.2 | `context-registry.test.ts` (sequential isolation) | ✅ COMPLIANT |
| REQ-MIS-04.1 | `context-registry.test.ts` (outside-run) | ✅ COMPLIANT |
| REQ-MIS-05.1 | `dist-runner-dual-realm.e2e.test.ts` | ✅ COMPLIANT |
| REQ-MIS-05.2 | `red-evidence.md` (dev-evidence, not standing CI) | ✅ COMPLIANT (plausibility-verified) |
| REQ-MIS-06.1 | `context-registry.test.ts` + e2e's `beforeAll` guard | ✅ COMPLIANT |
| REQ-MIS-07.1 | `red-evidence.md` "## PR description material" Non-Goals block | ✅ COMPLIANT (present, verbatim, traceable) |

## Issues Found

| Issue | Slice | Severity | File:Line | Detail |
|---|---|---|---|---|
| `tsc --noEmit` fails (2 errors) | S-001 | CRITICAL | `test/skeleton/context-registry.test.ts:136,141` | New test file fails the project's `typecheck` script — `AsyncLocalStorage<unknown>`/duck-object not assignable where `toBe()` infers `AsyncLocalStorage<RunContext>` from `resolveRunAls`'s return type. Zero production-code impact (`bun run build` succeeds — build only compiles `src/**`, not `test/`); `bun test` itself doesn't type-check so the suite is runtime-green. But this would fail CI's typecheck gate and must be fixed before archive. |

**Routing: LOCAL (Executor SDD-light)** — isolated to one test file's type annotations, mechanical fix (type `realAls: AsyncLocalStorage<RunContext>` and cast/type `duckAls` to match, or narrow the assertions), no design or spec implication.

Orchestrator action: re-invoke `/build` (SDD-light) targeting `test/skeleton/context-registry.test.ts:136,141` to fix the two type errors, then re-run `bun run typecheck` to confirm clean, then re-verify. Iteration 1 of 3 used.

## Working tree

Left byte-identical to the state at task start (only pre-existing orchestrator staging files remain: `.sdd/state/context-singleton-fix.json`, `.sdd/state/conformance-corpus.json` modified, `openspec/changes/context-singleton-fix/**`, `openspec/changes/conformance-corpus/**` — none touched by this verify pass; `git diff --stat` on all source/test files under review is empty).
