# Apply Progress: context-singleton-fix

**Scope so far**: `slice:S-000` (run 1), `slice:S-001` (run 2)
**Mode**: Strict TDD (S-000: double-loop, outer e2e RED/GREEN drives the fix; S-001: tests
written against already-fixed code per orchestrator's explicit exception — non-vacuousness
verified by mutation-check or reasoning per test, documented below)

## Slices Built

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 7/7 |
| S-001 | edge-case | complete | 8/8 |

## Files Changed

| File | Action | Slice | What Was Done |
|---|---|---|---|
| `src/core/context.ts` | Modified | S-000 | Replaced module-scope `const als` with pure `resolveRunAls(slotValue)` (3-state decision) + impure `getRunAls()` shell parking the ALS at `globalThis[Symbol.for(RUN_ALS_REGISTRY_KEY)]`; exported `RUN_ALS_REGISTRY_KEY`; routed `currentContext()` and `defineFactory`'s run entry through `getRunAls()`. |
| `test/support/shared-build.ts` | Modified | S-000 | Added `requireDistArtifacts(distDir)` — fail-loud guard naming the missing artifact when `dist/bin/pbuilder-runner.js` or `dist/core/context.js` is absent. |
| `test/fake/dist-runner-dual-realm.e2e.test.ts` | Created | S-000 | New regression e2e: spawns the BUILT `dist/bin/pbuilder-runner.js` against the src-relative `happy` fixture factory — the dual-realm topology; asserts exit 0, request sequence, committed output. |
| `openspec/changes/context-singleton-fix/red-evidence.md` | Created | S-000 | Staged RED-capture evidence (S-000.3) — verbatim command output + mechanism trace, for the eventual PR description. |
| `test/skeleton/context-registry.test.ts` | Created | S-001 | 13 unit tests: no globalThis pollution (01.2), key golden (02.1), sequential isolation (03.2), outside-run rejection (04.1), `requireDistArtifacts` fail-loud (06.1), and the pure `resolveRunAls` 3-state decision — occupied-slot fail-loud + triangulations (5b), valid-reuse/absent/fresh + triangulations (5c). |
| `openspec/changes/context-singleton-fix/red-evidence.md` | Appended | S-001 | S-001.7: design's Non-Goals section (REQ-MIS-07) staged verbatim under "## PR description material", plus a traceability note reconciling it with the RED-evidence mechanism trace. |

## TDD Cycle Evidence — S-000

Double-loop ordering: the outer e2e (`dist-runner-dual-realm.e2e.test.ts`) was written and run
against the pre-fix `context.ts` FIRST (RED), then S-000.4's fix was implemented to turn it
GREEN — the single inner unit of work this slice required.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.2/.4 | `dist-runner-dual-realm.e2e.test.ts::REQ-MIS-05.1: two-instance happy path exits clean` | e2e | `expect(received).toEqual(expected) — Expected: 0, Received: 4` (bun test); spawned-runner driver: `exitCode: 4, requests: ["ir.discard"], stderr: "...pbuilder-runner: run failed"` | yes | n/a — single dual-realm topology is the entire class of input this REQ covers (REQ-MIS-05.1 names one specific topology, not a parameterized family) | none needed |

Full verbatim evidence: `openspec/changes/context-singleton-fix/red-evidence.md`.

## TDD Cycle Evidence — S-001

Tests-after against already-correct code (S-000's fix), per orchestrator's explicit exception
for this slice. All 13 passed on first run (expected — the implementation predates the tests).
Non-vacuousness verified per test: two via an actual local mutation-check (implementation
temporarily broken, test observed to fail, then reverted and re-confirmed green), the rest by
structural reasoning (the assertion's shape makes a false-pass definitionally impossible for
any plausible wrong implementation).

| Task | Test (file::name) | Layer | Non-vacuousness method | Evidence | Triangulated |
|---|---|---|---|---|---|
| S-001.1 | `context-registry.test.ts::REQ-MIS-01.2 — no NEW enumerable string-keyed globalThis property` | unit | reasoning | A string-keyed install (naive draft) would add a key `Object.keys` sees; a symbol-keyed one (actual) never does — the assertion structurally can't false-pass a string-keyed regression | n/a — single mechanism |
| S-001.2 | `context-registry.test.ts::REQ-MIS-02.1 — key literal pinned` | unit (golden) | reasoning | Direct equality against the frozen literal; any edit fails it by construction | n/a |
| S-001.3 | `context-registry.test.ts::REQ-MIS-03.2 — sequential isolation` | unit | reasoning | Reference-identity assertions (`.not.toBe`) fail if the registry ever returns/caches a stale context across sequential runs | n/a — one topology per REQ-MIS-03.2's own scenario text |
| S-001.4 | `context-registry.test.ts::REQ-MIS-04.1 — outside-run still throws` | unit | reasoning | Asserts the exact `AuthoringError{origin,reason,message}` shape; a masked/removed throw fails all four checks | n/a |
| S-001.5 | `context-registry.test.ts::REQ-MIS-06.1 — requireDistArtifacts fails loud` | unit | **mutation-check** | Temporarily replaced the guard body with a silent no-op → test failed (`Received function did not throw`) → reverted, re-confirmed green | n/a — single bogus-dir case is the entire REQ-MIS-06.1 scenario |
| S-001.5b | `context-registry.test.ts::resolveRunAls occupied-slot fail-loud` (3 cases: object/string/number) | unit | **mutation-check** | Temporarily made `resolveRunAls` trust blindly (return `slotValue` unchecked, skip the throw) → all 3 collision tests failed (`Received value: undefined` / "did not throw") → reverted, re-confirmed green | 3 cases across `typeof` (object/string/number) |
| S-001.5c | `context-registry.test.ts::resolveRunAls reuse/absent/fresh` (4 cases incl. duck-valid non-real-ALS, two-fresh-differ) | unit | reasoning | Reference-identity (`.toBe`/`.not.toBe`) and `instanceof AsyncLocalStorage` checks fail under any memoizing, cloning, or brand-checking wrong implementation | 4 cases: real-ALS reuse, duck-valid reuse, fresh-instanceof, two-fresh-differ |

## Deviations from Design

None — implementation matches design rev 3 §4.3 exactly (pure `resolveRunAls` + impure
`getRunAls` shell, frozen non-enumerable install-once descriptor, plain `Error` on occupied-slot
mismatch, `RUN_ALS_REGISTRY_KEY` literal pinned verbatim).

One factual correction vs. the task brief's anticipated RED symptom: the brief expected
"exit 4 / `outside-run` on stderr". The ACTUAL captured stderr text is
`"pbuilder-runner: run failed"` (generic), not the literal `outside-run` message — because the
cross-realm `err instanceof AuthoringError` check in `runner.ts`'s catch also misses (the thrown
`AuthoringError` instance belongs to the SRC realm's class, not the DIST realm's), so the label
falls to the generic default before `classifyExitCode` falls through to `4`. The exit code (4)
and pre-fix failure (RED) themselves match; only the exact stderr string differs from the
anticipation. Documented with full mechanism trace in `red-evidence.md` — not a deviation from
the design contract, just corrected evidence over a guess.

**S-001**: None — all 8 tasks match the design's Test Derivation table (§4.6) exactly, same
file (`test/skeleton/context-registry.test.ts`) for every REQ-MIS-01.2/02.1/03.2/04.1/06.1 row
plus both accessor-contract rows.

## Post-Slice Audit (Step 7c)

Reviewed the S-000 diff (`git show 326668b`) against code-audit.md Groups 1 (REQ-MIS-01.1,
03.1, 05.1, 05.2, 06.1 subset), 2, 3:

- Group 1: all target REQ-IDs traceable to the signed spec; new e2e's describe/it titles name
  REQ-MIS-01/REQ-MIS-05 explicitly.
- Group 2: no layer violations (change stays within `src/core/context.ts`, `@internal`, off
  `package.json#exports`). Checked ADR-0011 (ambient run-context via AsyncLocalStorage,
  Accepted) for contradiction: its invariant is per-run RunContext scoping via ALS
  ("NOT a module global" — meaning RunContext itself is never a mutable module-level variable),
  which this change does not touch — only the ALS CONTAINER's storage location moved from a
  module-scope const to a `globalThis` singleton; `.run()`/`.getStore()` semantics (the actual
  per-run isolation mechanism ADR-0011 cares about) are unchanged and re-verified GREEN by the
  unchanged `fake-engine-harness.e2e.test.ts` (S-000.6). No contradiction — this is the exact,
  pre-reasoned deviation the design's own ADR-01/ADR-02 already document
  (`architecture_impact: modifying`, `arch_refresh_post_verify` queued for after final-verify).
- Group 3: no untyped `as any`/`as never` casts (one typed `as Record<symbol, unknown>` cast on
  `globalThis`, structurally necessary — TypeScript has no narrower built-in type for a
  symbol-keyed property bag); no magic numbers, no new TODOs, no duplicates.

No `Bug`/`Architecture`/`MAJOR` findings (S-000). Slice audit passes silently.

**S-001**: test-only diff (one new file, zero production code touched). Group 1: all target
REQ-IDs traceable, describe/it titles name them explicitly. Group 2: no layer violations, no
ADR contradictions (no new architectural surface — this slice only exercises the S-000
surface). Group 3: typed casts only (`caught as Error`/`as AuthoringError`, matching the
existing pattern in `test/skeleton/context.test.ts`); no magic numbers; the two temporary
mutation-check edits were reverted before commit and confirmed via `git diff --stat` (empty)
before proceeding — no mutation-check residue shipped. No findings.

## Halt / Issues Found

None (either run).

## Overall Progress

| Metric | Value |
|---|---|
| Slices total | 2 |
| Slices complete | 2 |
| Slices in progress | 0 |
| Tasks complete | 15/15 (S-000: 7/7, S-001: 8/8) |

## Full Suite

| Checkpoint | Result | Files |
|---|---|---|
| Baseline (pre-S-000, safety net) | 1968 pass / 0 fail | 186 |
| Post-S-000 (commit `326668b`) | 1970 pass / 0 fail | 187 |
| Post-S-001 (commit `3892c44`) | 1983 pass / 0 fail | 188 |

Post-S-001's +13 delta over post-S-000 matches `context-registry.test.ts`'s own 13 `it()`
blocks exactly — no unexplained delta this run (unlike S-000's +2/+1-file discrepancy, noted
there and not chased further since it was 0-fail both times).

## Next Step

Both slices in `context-singleton-fix` are complete (S-000 + S-001 = 15/15 tasks). Ready for
`sdd-verify --mode=plan` or `--mode=final` per the orchestrator's pipeline position, then the
PR (title/description assembled from `red-evidence.md`, which now carries both the RED proof
and the Non-Goals block).
