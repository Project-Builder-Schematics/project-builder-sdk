# Apply Progress: stage-1-ir-bedrock — S-1.5/1.6

**Status**: COMPLETE. `bunx tsc --noEmit` exit 0 (no output). Scoped suite (7 files, 34 tests):
0 fail. Final full `bun test`: 223 pass / 0 fail across 39 files (no foreign failures observed
at time of this run).

## Scope

Double-fault preservation (REQ-10) + the S-1.6 housekeeping batch (no REQ-ID; verified by
suite-green + inspection).

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `test/skeleton/double-fault.test.ts` | Created | REQ-10.1 (E1 rejected, `E1.cause` is E2), REQ-10.3 (contrast: normal discard, E1 unchanged, cause undefined). `DiscardRejectingClient` local test double delegates emit/read/commit to a real `ContractFake`, overrides only `discard()` — no production-fake reimplementation. |
| `src/core/context.ts` | Modified | `defineFactory`'s catch block wraps `discard()` in its own try/catch; on discard rejection (E2), attaches `E2` as `err.cause` (guarded by `err instanceof Error` — required by `catch (err): unknown` in strict TS, not scope creep) before re-throwing the original `err` (E1). |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modified | W7: removed the `isDistFresh()` mtime gate (`mtime`, `statSync`, `existsSync` helpers deleted); `beforeAll` now unconditionally runs `bun run build` every run. Header comment documents the manual baseline-regen invocation (`bun run build`, then copy each `dist/**/*.d.ts` over its `test/fitness/dts-baseline/*` counterpart — no regen script exists). |
| `test/skeleton/directive-factory.test.ts` | Modified | Phantom `ADR-0028` cite in the file header comment → `ADR-0013` (lowering/wire-shape site per the mapping rule). |
| `test/types/permissive-proof.guard.test.ts` | Modified | (a) `parseDiagnostics` regex tightened from `(.+?)\(...` to `(.+\.ts)\(...` — anchors the file group to end in `.ts(`, so a path containing a `(digit,digit):`-shaped substring can't shift the location group. (b) `fileMatch` tightened from bare `endsWith(PROOF_FILE_REL)` to an exact match OR `endsWith("/" + PROOF_FILE_REL)` — closes the theoretical path-collision where a different file's name merely shares the trailing substring (e.g. `vendor/xtest/types/permissive-proof.ts`). (c) The two hardcoded simulated line numbers (35, 57) in the RED-proof tests (REQ-03.1, REQ-03.2, positive control) now derive from `idiom1Lines[0]`/`idiom2Lines[0]` instead of literals — a fixture edit that shifts directive lines can no longer silently stale these proofs. |
| `test/conformance/meta.test.ts` | Modified | Dropped the tautological `[red-proof]` label from both `it()` titles (testDialect / testOpPack removal checks) — no assertion removed or replaced, pure label cleanup. |
| `openspec/objectives-plan.md` | Modified | Item 1.4 reworded from "Frame-cap enforcement at flush" to "at emit" + marked ✅ RATIFIED D8/ADR-0019; body now states the cap is enforced ONLY at the fake's `emit`, never `Session.flush` (which calls `emit` unconditionally, no SDK-side size branch per ADR-0018). Coverage O1 row 6 updated "enforced at flush" → "enforced at emit (fake/engine boundary, never `Session.flush`)". Added new decision-table row **D8** (batch cap unit/enforcement-site/boundary/text-only — ✅ RATIFIED, ADR-0019). |

## TDD Cycle Evidence — S-1.5/1.6

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| REQ-10.1 | `double-fault.test.ts::REQ-10.1 — factory throws E1, discard() rejects with E2...` | integration | `rejects.toBe(e1)` — Expected: "factory error E1", Received: "discard rejection E2" (E2 replaced E1 against today's pre-fix `context.ts` — this run IS the REQ-10.2 RED-PHASE GATE evidence) | ✅ | 2 cases (REQ-10.1 discard-rejects branch + REQ-10.3 discard-resolves branch; the try/catch's two paths) | none needed — minimal try/catch, `err instanceof Error` guard is a TS-strictness necessity, not added behavior |
| REQ-10.3 | `double-fault.test.ts::REQ-10.3 (contrast) — factory throws E1, discard() resolves normally...` | integration | n/a — characterization/RED-waived per spec cross-cutting note 7(b); passed on first run (pre-fix code already propagates E1 unchanged when discard resolves normally) | ✅ | n/a — pure characterization, pins pre-existing correct behavior | none needed |

Housekeeping items (i)-(v) below carry no REQ-ID; no TDD cycle applies (per slices.md: "verified by suite-green + inspection"). Each row is the done-bar evidence, not a test-case cycle.

## Housekeeping Done-Bars

| # | Item | Done-bar | Evidence |
|---|---|---|---|
| i | W7 unconditional `.d.ts` rebuild | mtime gate removed, `beforeAll` always runs `bun run build`, baseline-regen invocation documented in header comment | `fit-04-dts-semver-gate.test.ts` 9/9 pass |
| i | Phantom ADR-0028 → ADR-0013 in `directive-factory.test.ts` | header comment cites ADR-0013 | `rg -n "ADR-0028" test/skeleton/directive-factory.test.ts` → no hits |
| iii | `permissive-proof.guard.test.ts` hardening | (a) simulated line derived from `idiom1Lines[0]`/`idiom2Lines[0]`, no literal 35/57 remain; (b) `parseDiagnostics` regex + `fileMatch` tightened (path-boundary, not bare endsWith) | both changes present; guard suite 5/5 pass |
| iv | `conformance/meta.test.ts` tautological label | `[red-proof]` prefix removed from both `it()` titles, zero assertions changed | `rg -n "red-proof" test/conformance/meta.test.ts` → no hits; suite 4/4 pass |
| v | `objectives-plan.md` reconciliation | item 1.4 wording ("at flush" → "at emit" + RATIFIED), Coverage O1 row 6 updated, D8 decision-table row added | see Files Changed row above; `rg -n "at flush" openspec/objectives-plan.md` → no hits in the cap context |

## REQ Coverage

| REQ-ID | Test | State |
|---|---|---|
| REQ-10.1 | `test/skeleton/double-fault.test.ts::REQ-10.1` | ✅ GREEN |
| REQ-10.2 (RED-PHASE GATE, transient) | same test, pre-fix run | ✅ evidence captured (historical now that GREEN landed) |
| REQ-10.3 (contrast, characterization) | `test/skeleton/double-fault.test.ts::REQ-10.3` | ✅ GREEN (was already passing pre-fix) |

## Deviations From Design

None — implementation matches design row 33 (`src/core/context.ts`) and row 44
(`test/skeleton/double-fault.test.ts`) exactly, plus rows 51-56 (housekeeping) except row 51
(`.d.ts` baseline regen) which per slices.md's own "Deviations" section was already completed in
S-1.3, not this slice.

## Foreign Failures Observed

None. Final full `bun test`: 223 pass / 0 fail across 39 files. `bunx tsc --noEmit`: clean, no
output (the earlier transient `fit-10-engine-client-port-guard.test.ts` unused-var errors from
S-1.8's mid-edit state, observed before this slice's GREEN phase, are no longer present at time
of final check — sibling's file, never touched here).

## Risks

- `err instanceof Error` guard in `context.ts`'s double-fault fix is untested by REQ-10 (spec's
  fixtures always throw `new Error(...)`) — a factory that throws a non-Error primitive (e.g.
  `throw "string"`) would skip the cause-attachment silently rather than crash. This is a TS
  strictness necessity (`catch (err): unknown`), not a REQ-10 gap, but worth flagging for anyone
  extending double-fault coverage later.
- `permissive-proof.guard.test.ts` hardening is "theoretical" robustness per its own
  pending-changes framing — no live bug was demonstrated, only closed a class of future fragility.

## Constraints Honored

Did not touch S-1.4 (`src/core/wire.ts`, `test/support/contract-fake.ts`, `test/fake/batch-cap*`,
`test/types/wire-content-string.test.ts`, `test/skeleton/write-only-factory.test.ts`,
`openspec/decisions/0019-*`), S-1.8 (`test/fitness/fit-10-*`), or S-1.9 (`test/e2e/*`,
`test/pyramid/*`, `CONTRIBUTING.md`) files. Did not edit `slices.md` (progress recorded here
instead, per the parallel-execution constraint). Did not commit or push.
