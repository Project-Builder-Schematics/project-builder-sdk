# Apply Progress — S-1.8 (REQ-FIT-09 structural EngineClient port guard)

**Change**: stage-1-ir-bedrock · **Slice**: S-1.8 · **Mode**: Strict TDD
**Status**: complete

## Executive Summary

Created `test/fitness/fit-10-engine-client-port-guard.test.ts` with a self-contained
`scanPortBleed(source, relPath)` predicate (FIT-01/FIT-08 idiom — static regex scan over
`readFileSync`'d source, no AST). All 6 tests green, full project suite green, `tsc --noEmit`
clean. Both slice tasks complete.

## Files Changed

| File | Action | What was done |
|---|---|---|
| `test/fitness/fit-10-engine-client-port-guard.test.ts` | Created | `scanPortBleed` predicate + 6 tests (4 REQ-FIT-09 scenarios + 2 mechanism-confirmation extras) |

## REQ Coverage — REQ-FIT-09 (4 scenarios)

| Scenario (spec GWT) | Test | State |
|---|---|---|
| Planted-bypass fixture (imports `EngineClient`, calls `.emit(...)`) is flagged | `[permanent-fixture] planted-bypass fixture importing EngineClient and calling .emit(...) is flagged` | ✅ green (RED→GREEN driven) |
| `test/support/contract-fake.ts` real source is allow-listed clean | `test/support/contract-fake.ts (real source) is allow-listed clean` | ✅ green (RED→GREEN driven) |
| Fixture importing only `Directive`/`JsonValue` is not flagged | `a fixture importing only Directive/JsonValue types is not flagged` | ✅ green (characterization — see note) |
| Today's `src/commons/index.ts`/`src/conformance/index.ts` pass clean | `src/commons/index.ts and src/conformance/index.ts are included in the scan and pass clean` (+ full-sweep `every file is free of EngineClient port bleed`) | ✅ green (characterization — see note) |

Plus one extra (not a spec scenario, demonstrates the mechanism's core design rationale):
`a bare .emit( call with no EngineClient reference is not scanned (kills the EventEmitter
false positive)` — RED→GREEN driven, this is what actually forced the reachability gate
into existence (see TDD evidence below).

## TDD Cycle Evidence — S-1.8

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| T-01 | `fit-10-....test.ts::[permanent-fixture] planted-bypass ... is flagged` | architectural | "Expected: > 0, Received: 0" | ✅ | n/a — single-case red-proof, mirrors FIT-01/FIT-08's own red-proof style | none needed |
| T-01 | `fit-10-....test.ts::test/support/contract-fake.ts (real source) is allow-listed clean` | architectural | "Expected [], Received: [\"names EngineClient port symbol outside src/core: test/support/contract-fake.ts\"]" | ✅ | n/a — single allow-listed path, no class of inputs | none needed |
| T-01 | `fit-10-....test.ts::a bare .emit( call with no EngineClient reference is not scanned...` | architectural | "Expected [], Received: [\"port call site: .emit( (src/telemetry/ping.ts)\"]" | ✅ | forced the reachability gate (call-site scan now runs only inside EngineClient-referencing files) | none needed |
| T-01 | `fit-10-....test.ts::a fixture importing only Directive/JsonValue types is not flagged` | architectural | n/a — see note below | ✅ (immediate) | n/a | none needed |
| T-02/permanent-fixture | `fit-10-....test.ts::every file is free of EngineClient port bleed` + `...commons/conformance...pass clean` | architectural | n/a — see note below | ✅ (immediate) | n/a | none needed |

**Note on the two immediate-pass rows (Directive/JsonValue exemption; production scan)**:
per strict-tdd.md, a test passing on first run is normally a HALT ("behavior already exists
or test asserts nothing real"). Judgment call, documented rather than silently passed: both
are legitimate **characterizations**, not redundant tests — they lock in an emergent, correct
property of the already-triangulated mechanism (the scan is scoped to the literal
`EngineClient` symbol only, and today's production sources hold no such reference outside
`src/core`). This matches the spec's own RED-posture taxonomy category "(b) characterization
/ RED-waived — behavior pre-exists; prove+freeze" (cross-cutting note 7), even though that
note doesn't explicitly enumerate these two REQ-FIT-09 scenarios by name. No halt raised —
the alternative (fabricating a temporarily-broader regex just to manufacture false RED) would
have been worse theatre. Both rows are still real assertions with real fixtures/real file
reads, not tautologies.

The three RED→GREEN rows above are genuine: I deliberately did NOT front-load the allow-list
or the reachability gate into the stub — each was proven necessary by a failing test first
(caught myself doing exactly this once: the allow-list guard was accidentally in the initial
skeleton before its driving test was written; stripped it, re-proved RED, then restored it as
the deliberate fix — see Learned below).

## Deviations From Design

None — implementation matches the design's FIT-09 mechanism section (path allow-list,
reachability gate, string-fixture red-proofs) exactly.

## Scope Note (parallel execution)

Per the orchestrator's explicit parallel-execution constraint, `slices.md` was NOT edited
(three sibling agents are concurrently building S-1.4, S-1.5/1.6, S-1.9 in the same tree).
S-1.8's two tasks are complete in fact; the orchestrator should mark them `[x]` when
reconciling the parallel batch.

## Verification

- `bun test test/fitness/fit-10-engine-client-port-guard.test.ts` → 6 pass, 0 fail
- `bun test test/fitness` (regression) → 59 pass, 0 fail (baseline was 53 pass before this slice)
- `bunx tsc --noEmit` → clean, no output
- `bun test` (full project, final step) → 223 pass, 0 fail — no foreign failures observed

## Risks

None identified. The predicate is a static regex scan (no AST), consistent with FIT-01/FIT-08;
it will not catch obfuscated bypasses (e.g. dynamic property access `client["emit"]`), but
that limitation is inherent to the design's chosen mechanism (string-fixture scan), not a gap
introduced here — the design explicitly rejected the structural `implements EngineClient`
alternative as spoofable, and a full AST-based guard was out of scope for this slice.

## Skill Resolution

`fallback-registry` — no `## Project Standards (auto-resolved)` compact-rule block beyond the
brief inline "Project Standards" note in the launch prompt; proceeded using the codebase's own
established FIT-01/FIT-08 conventions (read directly) as the pattern source, per instructions.
