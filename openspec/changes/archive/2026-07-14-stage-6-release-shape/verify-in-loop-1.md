# Verify In-Loop Result

**Change**: `stage-6-release-shape`
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton)
**Mode**: in-loop (Strict TDD)

---

## Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 4/4 (S-000.1..S-000.4, confirmed against `slices.md`'s checkbox state)
- Affected tests passed: 6/6 (`installed-consumer.e2e.test.ts`, re-run twice for idempotency) + 4/4 (`build-config.test.ts`) — all independently re-executed by this verify pass, not trusted from apply-progress
- Full suite (real execution, not from apply-progress): **1061 pass / 1 fail / 2054 expect() calls** — matches the exact interim state briefed: the ONLY failure is `test/fitness/fit-14-package-surface.test.ts` > "the publishable tarball contains no file beyond the committed baseline", sequenced to S-002.3 per REQ-PPH-06. No other red.
- Typecheck (`bun run typecheck` = `tsc --noEmit`): clean, 0 errors
- Lint: no linter configured in this project — skipped cleanly, not a failure
- Spec compliance for scope: 6/6 clauses COMPLIANT (table below)
- Strict TDD (in-loop) audit: `ok` (below)

Orchestrator action: exit loop, proceed to `/build --scope=slices:S-001,S-002,S-003` per the slices' Build Order (S-002 should be prioritized to resolve the known fit-14 red).

### Completeness

| Task | Status |
|---|---|
| S-000.1 Extract `test/support/scratch-consumer.ts` | ✅ done — verified: file exists, tarball leg (`ensurePackedConsumer`) and link leg (`ensureLinkedConsumer`) both wired into `installed-consumer.e2e.test.ts`, both pass |
| S-000.2 `package.json` prebuild/link:sdk + `declarationMap:false` | ✅ done — verified via diff and via `build-config.test.ts`'s real `bun run build` invocation (RED→GREEN) |
| S-000.3 `build-config.test.ts` (new) | ✅ done — 4/4 tests pass on independent re-run |
| S-000.4 `installed-consumer.e2e.test.ts` bun-link leg | ✅ done — 3 new scenarios (REQ-LC-01.1/.2, REQ-LC-04.2, REQ-LC-05.1) pass; 3 pre-existing tarball scenarios still pass (no regression) |

### Real Execution Evidence (run by this verify pass)

```
$ bun test                                    # full suite
 1061 pass
 1 fail
 2054 expect() calls
Ran 1062 tests across 124 files. [9.36s]

$ bun test test/fitness/fit-14-package-surface.test.ts
 12 pass
 1 fail   # "the publishable tarball contains no file beyond the committed baseline"
 18 expect() calls

$ bun test test/e2e/installed-consumer.e2e.test.ts   # x2, idempotency check
 6 pass / 0 fail   (first run, 1.85s)
 6 pass / 0 fail   (second run, 0.80s)

$ bun test test/build/build-config.test.ts
 4 pass / 0 fail

$ bun run typecheck   # tsc --noEmit
 (clean, no output, exit 0)
```

Post-suite global bun-link store check (`~/.bun/install/global/node_modules/@pbuilder`): directory exists but is **empty** (0 entries) — no package content resolves through it; `unlinkSdk()`'s `afterAll` cleanup is functionally effective (see Findings #1 for a narrative-accuracy nuance, not a functional issue).

### Spec Compliance Matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| REQ-PPH-04.1 (prebuild removes stale dist/ before tsc) | `build-config.test.ts` | ✅ COMPLIANT |
| REQ-PPH-05.1 (declarationMap is false) | `build-config.test.ts` | ✅ COMPLIANT |
| REQ-LC-01.1 (5 subpaths resolve via bun link) | `installed-consumer.e2e.test.ts` (link leg) | ✅ COMPLIANT |
| REQ-LC-01.2 (`./core` stays unresolvable via bun link) | `installed-consumer.e2e.test.ts` (link leg) | ✅ COMPLIANT |
| REQ-LC-04.2 (bin runs from bun-link `.bin`) | `installed-consumer.e2e.test.ts` (link leg) | ✅ COMPLIANT |
| REQ-LC-05.1 (`dryRun()` non-empty plan via bun-link `./commons`) | `installed-consumer.e2e.test.ts` (link leg) | ✅ COMPLIANT |

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 2 test files (`test/build/build-config.test.ts` new, `test/e2e/installed-consumer.e2e.test.ts` diff), 2 implementation files (`package.json`, `tsconfig.build.json`), 1 new test-support file (`test/support/scratch-consumer.ts`)

#### Findings
None blocking.

#### Tolerated for now (flagged for final)
- None beyond what final-mode will re-check as a matter of course (mutation testing, full REQ-ID coverage audit).

#### Checks performed
- **Banned assertion patterns**: scanned all new/changed `expect(...)` calls in the delta — zero matches for `.toBeDefined()`, `.toBeTruthy()`/`.toBeFalsy()`, `objectContaining` as sole assertion, `.not.toThrow()` as sole assertion, or snapshot-without-behaviour. Every assertion in the delta targets a concrete value (`toBe(true/false/0)`, `toBeGreaterThan(0)`, `toContain("<exact string>")`, `toEqual(<exact object>)`).
- **New file without tests**: `test/support/scratch-consumer.ts` is new and has no dedicated test file — verified this matches existing repo convention (`test/support/shared-build.ts`, the file it was extracted alongside, also has no dedicated test file); it is exercised transitively through the e2e suite that imports it. Not a violation.
- **Triangulation**: the delta's one piece of conditional logic (the inline `probe()` try/catch in the resolution-check script) is exercised 6 times per test run (5 resolve-true cases + 1 resolve-false case for `/core`) — both branches genuinely covered, not a single-case gap.
- **Regression**: full-suite pass count before (1058, per apply-progress's own recorded baseline) vs after (1061) — net +3 passing (the 3 new bun-link scenarios), 0 previously-passing tests now failing. Independently re-confirmed by this verify pass's own full-suite run above.
- **RED evidence credibility**: apply-progress's TDD Cycle Evidence table cites actual thrown-error text (`error: not implemented — TDD RED checkpoint (S-000.1)`) and actual assertion-diff text (`Expected: false / Received: true`), not a bare assertion that RED happened — meets Strict TDD Mode's evidentiary bar (cited, not asserted).
- **Process deviation, self-reported**: apply-progress and its engram mirror (#2037) both disclose that `ensureLinkedConsumer`'s real implementation was briefly written before ever observing RED on the 3 new bun-link e2e scenarios, then caught, stubbed to capture genuine RED, and restored for GREEN. This is transparent self-correction, not concealment — treated as acceptable, not a halt condition (no evidence was fabricated; the corrective action produced real evidence before returning).

### Findings (non-blocking, WARNING)

1. **Numeric accuracy in narrative artefacts** — `apply-progress.md`'s Deviations section and its engram mirror (obs #2037) both state the committed baseline "still lists 44 `.d.ts.map` entries." Independently verified via two methods (a JSON-array count over `pkg-surface-baseline.json#tarball` filtered to `.d.ts.map`, and a direct re-run of the failing `fit-14` assertion, whose diff was recounted by hand): the actual count is **42**, not 44. This does not change the verdict — the failure is still exactly the one tolerated red, for exactly the documented reason (baseline regen sequenced to S-002.3 per REQ-PPH-06) — but the "44" figure should be corrected wherever it's cited (apply-progress.md, the engram mirror, and any S-002.3 task description that inherits it) before it propagates into the final verify report or archive lessons-learned.
2. **Hybrid-persistence gap, pre-existing, already self-flagged** — `artifact_store.mode = hybrid` requires both engram AND filesystem to succeed per artefact. `mem_search` confirms `sdd/stage-6-release-shape/slices` (#2036) and `sdd/stage-6-release-shape/apply-progress` (#2037) exist (both written by this apply run), but `sdd/stage-6-release-shape/design`, `/spec`, `/proposal`, `/explore`, `/triage` return no engram results — those planner-phase artefacts appear to be OpenSpec-only despite hybrid mode. The executor already flagged this in `apply-progress.md`'s Learned section and in `state.yaml`'s notes ("Engram-mirror gap... spot-check before archive"). Not a blocker for S-000's in-loop verdict (outside this apply run's persistence obligations), but must be reconciled before `sdd-archive`'s hybrid-mode checks run.

## Artifacts Persisted

| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-1 | hybrid | `openspec/changes/stage-6-release-shape/verify-in-loop-1.md` + engram `sdd/stage-6-release-shape/verify-in-loop-1` |

## Risks

- Findings #1 and #2 above (both non-blocking; see Findings section for detail and required follow-up).
- `fit-14`'s known red must not be "fixed" inside any slice other than S-002 (S-002.3 owns the baseline regen per REQ-PPH-06) — flagging this explicitly since a future in-loop iteration on a different slice could be tempted to silence it.

## Next Recommended

`/build --scope=slices:S-001,S-002,S-003` (parallel group per Build Order) — prioritize S-002 to clear the fit-14 baseline regen.

## Skill Resolution

injected (skill registry present-and-empty — deliberate; followed existing codebase conventions per the registry's own note)

---

## Routing

N/A — verdict PASS, no routing classification needed.
