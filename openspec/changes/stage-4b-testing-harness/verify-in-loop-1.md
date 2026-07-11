## Verify In-Loop Result

**Change**: stage-4b-testing-harness
**Iteration**: 1/3
**Scope**: S-000 (Walking Skeleton — Fake Relocation + Installed-Consumer Spike)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 8/8 (all checked in slices.md, all corroborated by the diff)
- Affected tests: 580/580 pass (full suite run; pre-slice baseline was 572, confirmed via
  `sdd/stage-4b-testing-harness/apply-progress` obs #856)
- Spec compliance for scope: TES-07(.1-.3) fully closed via `fit-10-engine-client-port-guard.test.ts`;
  the two acceptance-criteria scenarios (shim-suite-stays-green, installed-consumer-resolves-defineFactory)
  both observed passing at runtime
- Typecheck: `bunx tsc --noEmit` clean (exit 0)
- Build: `bun run build` clean (exit 0)
- Zero new runtime dependencies: `package.json` has no `dependencies` field; `devDependencies` untouched
- Assertion audit (delta test files): no banned patterns found
- Strict TDD: no halting violations found (see Findings for one tolerated minor note)

Orchestrator action: exit loop, proceed to next slice (S-001) or to `/evaluate` (mode=final) once
S-000..S-005 are all built.

---

### Delta Reviewed

Commit range `3c46098..HEAD` on `feat/stage-4b-testing-harness`, single commit `8ab00ff`
(`feat(testing): S-000 walking skeleton — fake relocation + installed-consumer spike`).

17 files changed, 724 insertions(+), 349 deletions(-):
- `src/testing/{contract-fake.ts, rejection-messages.ts, index.ts}` — new (git-moved fake +
  dictionary, minimal facade re-exporting `defineFactory` only)
- `test/support/{contract-fake.ts, rejection-messages.ts}` — collapsed to pure re-export shims
- `package.json` — added `./testing` exports entry
- `test/support/shared-build.ts` — new (`ensureTscBuild`, `ensureMinifiedEntry`)
- `test/e2e/installed-consumer.e2e.test.ts` — new spike (pack→scratch-install→import-by-name)
- `test/fitness/fit-10-engine-client-port-guard.test.ts` — allow-list transitioned + REQ-TES-07.1/.2/.3
- `test/fitness/fit-09-pkg-exports-resolution.test.ts` — widened 3→4 keys (deviation, see below)
- `test/fitness/pkg-surface-baseline.json` — regenerated (deviation, see below — explicitly licensed)
- `openspec/decisions/{0035,0036}-*.md` — new ADR drafts
- `openspec/changes/stage-4b-testing-harness/{design.md,slices.md,spec.md}` +
  `specs/testing-story-docs/spec.md` — plan-artefact ADR renumbering 0032→0033 (pre-build
  housekeeping to avoid colliding with stage-4's merged ADR-0032; confirmed no actual collision:
  `openspec/decisions/` today runs 0027-0032 then 0035-0036)

### Task Checklist Verification (S-000 card)

| Task | Status | Evidence |
|---|---|---|
| git-move fake+dictionary into `src/testing/`; shim old paths | ✅ | `contract-fake.ts`/`rejection-messages.ts` byte-identical modulo relative-import-depth fix (`../../src/core/*` → `../core/*`); shims are pure re-exports |
| fit-10 allow-list transition to `src/testing/contract-fake.ts` | ✅ | exact-string allow-list (not glob), verified in diff |
| `src/testing/index.ts` minimal facade | ✅ | 5 lines, re-exports `defineFactory` value only, no `RunResult`/`runFactoryForTest` |
| `package.json#exports` add `./testing` | ✅ | verified |
| ADR-0035/0036 drafts | ✅ | both read, content matches design §4.5 closely |
| `test/support/shared-build.ts` create | ✅ | `ensureTscBuild()` memoized; consumed by the e2e test |
| `test/e2e/installed-consumer.e2e.test.ts` spike | ✅ | build→pack→scratch-install(`--ignore-scripts`, non-routable registry)→import `defineFactory` by name; repo lockfile hash asserted unchanged; passes |
| Full suite green + `tsc --noEmit` clean | ✅ | 580 pass / 0 fail; tsc clean; `bun run build` clean |

### Deviations (design/binding-constraint licensed, not smuggled scope)

Both are self-documented in slices.md's "Executor deviation note" under S-000 and are
consequences of binding constraint #7 ("every slice leaves the suite GREEN").

1. **`fit-09-pkg-exports-resolution.test.ts`** widened 3→4 keys. Nominally S-003's TES-01 row,
   but the `package.json#exports` edit that trips this assertion happens in S-000. The slice
   card explicitly cites the FIT-14 same-slice precedent design §4.8 already sets ("regenerated
   in the SAME slice as the package.json exports edit"). S-003's own fit-09 task is downgraded
   to verify-and-skip — confirmed the duplicate isn't silently redone.
2. **`fit-14-package-surface.test.ts` baseline (`pkg-surface-baseline.json`)** regenerated.
   This one IS explicitly licensed by design §4.8 verbatim: "`fit-14-package-surface.test.ts` +
   `pkg-surface-baseline.json` ... regenerated in the SAME slice as the `package.json` exports
   edit". Confirmed only the baseline JSON changed, not the test file's logic — `fit-14` passes
   in isolation (10/10).

Both deviations stay within the same guard-file class the S-000 diff already touches (fitness
tests over the exports/package surface), are minimal, and are documented inline — not scope
creep into S-001+ territory (result-contract, isolation invariants, docs).

### Binding Constraints Spot-Check

- #1 (`src/testing/index.ts` never names `EngineClient`/`EmitRejection`) — holds; file only
  exports `defineFactory`.
- #4 (FIT-07 glob stays `src/core/**`) — untouched this slice, no regression.
- #5 (`shared-build.ts` created once in S-000) — holds.
- #7 (every slice leaves the suite GREEN) — holds; full suite green at this boundary.
- FIT-08 does **not** yet scan `src/testing/index.ts` (`AUTHOR_SUBPATHS` still lists only
  `commons/index.ts`, `index.ts`, `conformance/index.ts`) — confirmed by reading the file.
  This is correctly S-003's job per the Covers line ("TES-01/02/06 formally closed in
  S-002/S-003/S-004"), not a gap in this slice.

### Findings

| # | Severity | File:Line | What | Evidence |
|---|---|---|---|---|
| 1 | minor | `test/support/shared-build.ts:32-63` | `ensureMinifiedEntry()` is created in this slice per design §4.2's Create row, but no test in this slice's diff calls it — only `ensureTscBuild()` is exercised (via the e2e spike). The function is therefore unexercised until S-003 (FIT-17) consumes it. | Grepped the diff and the new e2e test; only `ensureTscBuild` is imported/called. This is explicitly forward-declared shared infra per binding constraint #5 ("created ONCE in S-000, reused by every consumer") — not a defect, but flagged per Strict TDD's "implementation without a driving test" concern for the specific function, tolerated (not halted) for in-loop per the module's own tolerance list ("coverage gaps in adjacent code not touched in this iteration"). Will need to be exercised correctly when S-003 lands FIT-17; no action needed now. |
| 2 | minor | n/a (process note) | TDD cycle adherence (RED→GREEN) cannot be verified via git history — S-000 is a single commit (`8ab00ff`), consistent with this project's per-slice (not per-cycle) commit convention. Method 2 (test-implementation pairing) is satisfied for all touched production surfaces. | `strict-tdd-verify.md` explicitly tolerates this: "If the project does not commit per cycle (just per slice), the audit relies on Methods 1 and 2 only. The verdict is weaker but still informative." Not a halt condition. |

No blocking or major findings.

### Tests (real execution evidence)

```
$ bun test
580 pass
0 fail
987 expect() calls
Ran 580 tests across 77 files. [2.38s]

$ bunx tsc --noEmit
(exit 0, no output)

$ bun run build
$ tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node --banner "#!/usr/bin/env node"
Bundled 9 modules in 6ms
  pbuilder-codegen.js  14.29 KB  (entry point)
(exit 0)

$ bun test test/fitness/fit-11* test/e2e/installed-consumer.e2e.test.ts test/fitness/fit-10-engine-client-port-guard.test.ts test/fitness/fit-09-pkg-exports-resolution.test.ts
31 pass
0 fail
52 expect() calls

$ bun test test/fitness/fit-14-package-surface.test.ts
10 pass
0 fail
13 expect() calls
```

### Artifacts Persisted

| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-1 | hybrid | engram `sdd/stage-4b-testing-harness/verify-in-loop-1` + `openspec/changes/stage-4b-testing-harness/verify-in-loop-1.md` |

### Risks

- None blocking. Minor: `ensureMinifiedEntry()` remains unexercised until S-003 — track that
  S-003's FIT-17 work actually calls it with realistic entries before trusting its cache
  behavior.

### Next Recommended

Proceed to S-001 (Harness Result Contract) via `/build --scope=slice:S-001`.

### Skill Resolution

injected
