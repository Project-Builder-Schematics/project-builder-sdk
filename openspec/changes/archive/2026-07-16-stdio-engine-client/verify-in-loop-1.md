# Verify In-Loop Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

## Real execution evidence

- `bun test` (full suite, working dir = worktree root): **1390 pass / 0 fail**, 2900 `expect()` calls, 156 files, 19.61s. (`apply-progress.md`'s recorded "1388 pass / 155 files" predates the S-000.8 audit-remediation commit `4f1053d`, which added `test/types/stdio-engine-client-port.test.ts` — 2 more tests, 1 more file. Current HEAD is 1390/156, exactly `apply-progress.md`'s count + the 2 remediation-commit tests. Not a regression — stale doc line, noted as followup.)
- `bunx tsc --noEmit`: clean, exit 0, no output.
- `bun test test/fake/fake-engine-harness.e2e.test.ts` in isolation: **2 pass / 0 fail** — both the happy-path skeleton leg and the WPS-02.2 version-mismatch leg.
- `bun test test/fitness/fit-10-engine-client-port-guard.test.ts test/fitness/fit-29-sanctioned-definefactory-caller.test.ts test/fitness/fit-30-stdout-sacred.test.ts` in isolation: **53 pass / 0 fail**.

## Acceptance criteria (S-000, slices.md)

GIVEN the scripted fake host over REAL stdio / WHEN it spawns the runner with `--factory` / THEN versioned `ready` accepted, one `tree.read` round-trips BY VALUE, `ir.emit` applies, advisory `ir.commit` acks, exit 0 — **confirmed real.**

`test/fake/fake-engine-harness.e2e.test.ts` spawns via Node's `child_process.spawn("bun", ["run", ".../bin/pbuilder-runner.ts", ...], {stdio:["pipe","pipe","pipe"]})` (`test/support/frame-host.ts:111`) — a genuine OS subprocess talking length-prefixed frames over real stdin/stdout pipes, not an in-memory double. The test asserts:
- `run.exitCode === 0`, `run.signal === null`
- `run.requests.map(r => r.method)` equals exactly `["tree.read", "ir.emit", "ir.commit"]` (WPS-05 closed set, in the skeleton's order)
- `run.requests[0].params` equals `{path: "seed.txt"}` (tree.read round-trip is asserted BY VALUE, not just "was called")
- `fake.committedTree().get("out.txt") === "read:hello from seed"` — the emitted content embeds what the fake host actually served over the wire, proving the round-trip crossed real stdio, not a stub
- The version-mismatch leg (`REQ-WPS-02.2`) is a SEPARATE spawned run: `readyVersion: 999` → `exitCode === 1`, `requests === []` (zero callbacks dispatched), `stderr` contains both `"999"` and `"1"` (both versions named).

Both legs pass in isolation, confirmed above.

## Fitness functions

- **FIT-10 allow-list +1** (`fit-10-engine-client-port-guard.test.ts`): allow-list is exactly `["src/testing/contract-fake.ts", "src/transport/stdio-engine-client.ts"]` (pinned assertion, line 205-207). Red-proof present: an unrelated file inside `src/transport/` naming `EngineClient` is still caught (line 137-149) — proves the widened list is a path allow-list, not a directory exemption.
- **fit-29 ADR-07 conformance** (`fit-29-sanctioned-definefactory-caller.test.ts`): `ALLOWLISTED_ROOTS` includes `join(SRC_DIR, "transport/runner.ts")` — the FILE, matched via `absPath === root` (line 38-43), never a directory prefix for that entry. Red-proof present (line 118-125): a planted `defineFactory` import from `src/transport/framing.ts` (an unrelated transport file) is still flagged. Positive control present (line 130-134): the scanner detects `runner.ts`'s own real `defineFactory` import and confirms `isAllowlisted(runner.ts) === true` — proves allowlisting, not scanner blindness, keeps it green. All 3 assertions verified passing at runtime, not just present in source.
- **fit-30 stdout-sacred** (`fit-30-stdout-sacred.test.ts`): `EXEMPT_FILES` is exactly `{framing.ts}` (line 21). Write-site count pinned to exactly 1 (`process.stdout.write` occurrences in `framing.ts`, line 46-50). Three red-proofs present: planted `console.log` in a transport file flagged, planted direct `process.stdout.write` flagged, `process.stderr.write` NOT flagged (no false negative). All passing.

## Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 14 test files, 9 impl files (per `apply-progress.md` Files column + git diff stat)

### TDD cycle adherence
Method 2 (test-implementation pairing) + spot-checked Method 1 (git history, slice-grained commits — this repo commits per-slice, not per-cycle, so Method 1 is weaker but corroborating). All 9 new/modified `src/transport/**` + `bin/pbuilder-runner.ts` files have a corresponding test file landed in the SAME commit (`git show --stat` on all 5 feature commits confirms test+impl paired per commit, never a separate later "add tests" commit). Spot-checked 3 tasks' RED evidence from `apply-progress.md`'s TDD Cycle Evidence table against the actual code for plausibility:
- **S-000.1** (`framing.ts`): RED = `error: not implemented` (stub-throw). Plausible — a fresh module with a throwing stub is genuine RED, not vacuous (the GREEN triangulation lists 4 distinct byte-length classes: ASCII/newline/3-byte €/4-byte 😀 surrogate pair — confirmed present in `framing.unit.test.ts`, each asserting the exact UTF-8 byte count, not just "some number").
- **S-000.5** (fit-10 red-proof): RED = organic `expected [], got [names port symbol...: src/transport/stdio-engine-client.ts]` — this is a real fitness-scan failure message, not a scripted/vacuous RED; the fixture/allow-list interaction produced it naturally as the file was added before the allow-list was widened. Plausible.
- **S-000.7b** (fit-29 ADR-07): RED = organic `expected [], received ["../core/context.ts"]` on `src/transport/runner.ts`. Plausible for the same reason — this is exactly what fit-29 would emit for a real unsanctioned `defineFactory` import before ADR-07's allow-list entry landed, and the halt/resume history in `apply-progress.md` (line 5-9) independently corroborates: the FIRST apply run genuinely hit this fitness failure as an `architectural-conflict` and halted for design amendment (ADR-07), only resuming after the ADR was written. That is strong, independently-verifiable evidence the RED was real, not staged.

No task in scope has implementation without a driving test. No halt condition triggered.

### Assertion quality
Test files scanned: `framing.unit.test.ts`, `wire-protocol.unit.test.ts`, `frame-reader.unit.test.ts`, `stdio-engine-client.unit.test.ts`, `runner.integration.test.ts`, `frame-host.test.ts`, `fake-engine-harness.e2e.test.ts`, `stdio-engine-client-port.test.ts`, `fit-10/29/30`. Banned-pattern grep (`toBeDefined()`, `toBeTruthy()`, `toBeFalsy()`, `objectContaining(`) across the delta test files: **one hit**, `runner.integration.test.ts:168` (`expect(viaHarness.error).toBeDefined()`), inside a scenario that ALSO asserts `viaHarness.emitted` equals `[]`, the parity-run `exitCode` equals `1`, and `ir.emit` never crossed the wire — the `toBeDefined()` is a secondary presence-check alongside real value/behavior assertions in the same test, not the test's sole assertion. Tolerated per module rule ("assertion quality concerns that are sub-critical... test name vague but assertion is real" — the surrounding assertions carry the real behavioral proof). All other assertions across the delta files specify exact expected values (`.toEqual(...)` against literal shapes/strings/counts), not shape-only or tautological checks.

### Triangulation
Spot-checked functions with conditional/iterative logic in the delta:
- `isStructurallyValidGreeting` / `versionMatches` (`wire-protocol.ts`): 6 structural cases in `wire-protocol.unit.test.ts` (match / mismatch / missing-method / missing-version / non-integer / non-object). Triangulated.
- `FrameReader#drainCompleteFrames` (`frame-reader.ts`, a `for(;;)` loop with length-prefix arithmetic): 3 reassembly shapes in `frame-reader.unit.test.ts` (single-chunk / split-chunks / coalesced). Triangulated.
- `runRunner`'s gate sequence (`runner.ts` — 5 sequential conditional exits): happy / version-mismatch / malformed-greeting / RUN-05-valid-input / RUN-05-schema-rejected, 5 distinct paths across `runner.integration.test.ts`. Triangulated.
- `encodeFrame` UTF-8-vs-UTF-16 byte counting: ASCII, newline-embedded, 3-byte multi-byte (€), 4-byte surrogate pair (😀) — 4 classes in `framing.unit.test.ts`. Triangulated, explicitly designed to kill the `.length`-instead-of-byte-count mutant.

No triangulation gap found in the S-000 delta.

### Regression check
All 1390 tests pass; zero previously-passing test now fails (full-suite run above).

## REQ coverage (8 covered REQs — one test named per REQ, all passing)

| REQ | Test | Result |
|---|---|---|
| WPS-01 | `test/transport/framing.unit.test.ts` (`REQ-WPS-01` describe block, 3 scenarios) | PASS |
| WPS-02 | `test/transport/wire-protocol.unit.test.ts` (`REQ-WPS-02`) + `test/transport/runner.integration.test.ts` (mismatch/invalid legs) + e2e mismatch test | PASS |
| WPS-05 | `test/transport/wire-protocol.unit.test.ts` (`REQ-WPS-05`) + `test/transport/stdio-engine-client.unit.test.ts` (`REQ-WPS-05` describe) | PASS |
| WPS-10 | `test/transport/stdio-engine-client.unit.test.ts` (`REQ-WPS-10` describe, 3 scenarios) | PASS |
| RUN-05 | `test/transport/runner.integration.test.ts` (`REQ-RUN-05` describe, valid + schema-rejected legs) | PASS |
| SEC-01 | `test/transport/stdio-engine-client.unit.test.ts` (`REQ-SEC-01` describe) + `test/types/stdio-engine-client-port.test.ts` (type-level pin) | PASS |
| SEC-03 | `test/transport/stdio-engine-client.unit.test.ts` (`REQ-SEC-03` describe) | PASS |
| SEC-06 | `test/transport/stdio-engine-client.unit.test.ts` (`REQ-SEC-06` describe) | PASS |

## Spec compliance matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| WPS-01 (.1/.2/.3) | `framing.unit.test.ts` | ✅ COMPLIANT |
| WPS-02 (.1/.2/.3) | `wire-protocol.unit.test.ts` + `runner.integration.test.ts` + e2e | ✅ COMPLIANT |
| WPS-05 (.1) | `wire-protocol.unit.test.ts` + `stdio-engine-client.unit.test.ts` + e2e (method sequence) | ✅ COMPLIANT |
| WPS-10 (.1/.2/.3) | `stdio-engine-client.unit.test.ts` | ✅ COMPLIANT |
| RUN-05 (.1) | `runner.integration.test.ts` | ✅ COMPLIANT (observable-behavior comparison, no white-box spy — matches spec's explicit prohibition) |
| SEC-01 (.1) | `stdio-engine-client.unit.test.ts` + `stdio-engine-client-port.test.ts` | ✅ COMPLIANT |
| SEC-03 (.1/.2) | `stdio-engine-client.unit.test.ts` | ✅ COMPLIANT |
| SEC-06 (.1/.2) | `stdio-engine-client.unit.test.ts` | ✅ COMPLIANT |

## Scope-law check

- `package.json#bin` has exactly `{"pbuilder-codegen": "dist/bin/pbuilder-codegen.js"}` — **no `pbuilder-runner` entry** (ADR-06 honored).
- `pkg-surface-baseline.json` diff adds only `dist/transport/*.{js,d.ts}` build-output entries — no `exports`/`bin` field changes.
- `test/fake/fake-engine-harness.ts` and `test/support/frame-host.ts` are `test/**`-only, not re-exported from `src/index.ts` or `package.json#exports` — internal-only confirmed.
- No engine-repo (Go) code or files present in the diff — the engine repo (`project-builder-engine`) is cited only as prose ground-truth in `slices.md`/`design.md`, never vendored.

## Design coherence spot-check (informational — final scope, not gating in-loop)

ADR-01 (transport home + FIT-10 +1), ADR-02 (SDK owns read loop — `frame-reader.ts`/`framing.ts` sole readers/writers), ADR-03 (sequential single-in-flight, single pending slot — no pending-map anywhere in `stdio-engine-client.ts`), ADR-07 (fit-29 FILE allow-list) all verified honored by direct code read, consistent with `apply-progress.md`'s own Slice Audit Notes claim.

## Followups (non-blocking, for final verify)

1. `apply-progress.md`'s "Final: bun test → 1388 pass / 0 fail (155 files)" line is stale — it predates the audit-remediation commit `4f1053d` (SEC-01 type pin). Current true count is 1390/156. Recommend updating the line before final verify to avoid future confusion (cosmetic only — no functional gap).

---

Orchestrator action: exit loop, proceed toward S-001 (or `/evaluate` mode=final if S-000 is the terminal scope for this iteration).
