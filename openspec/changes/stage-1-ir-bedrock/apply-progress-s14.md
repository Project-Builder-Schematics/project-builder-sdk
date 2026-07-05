# Apply Progress — S-1.4 (batch-cap contract + content-type pin + empty-batch pin)

**Change**: stage-1-ir-bedrock · **Slice**: S-1.4 · **Mode**: Strict TDD
**Status**: complete

## Executive Summary

Implemented the batch-cap-contract domain end to end: `BATCH_CAP_BYTES = 4 * 1024 * 1024`
in `src/core/wire.ts`, enforced only at `ContractFake#emit` (never SDK-side, ADR-0018-
consistent). Built a deterministic fixture module (`test/fake/batch-cap-fixtures.ts`)
exposing `batchOfSerializedBytes`/`batchOverSerializedBytes`/`rawContentBytes` — no search,
no Date/random, hits target byte counts by direct escaping-ratio arithmetic. Added the
type-level `string` pin for `modify.content`/`create.template` and the empty-batch
commit-spy characterization. Wrote ADR-0019 and appended the ADR-0017 self-move identity
amendment to ADR-0017's own file. All 5 slice tasks complete.

## Files Changed

| File | Action | What was done |
|---|---|---|
| `src/core/wire.ts` | Modified | Added `export const BATCH_CAP_BYTES = 4 * 1024 * 1024` (ADR-0019) |
| `test/support/contract-fake.ts` | Modified | `emit()` now measures `Buffer.byteLength(JSON.stringify(batch), 'utf8')` FIRST, before applying any directive, and throws `ContractFake: batch exceeds size cap — ...` when it exceeds `BATCH_CAP_BYTES` (RAW-UNTIL-STAGE-2.1) |
| `test/fake/batch-cap-fixtures.ts` | Created | `batchOfSerializedBytes(target)` (exact hit via ASCII 1:1 padding), `batchOverSerializedBytes(target)` (over-cap, quote/backslash 2:1 padding so raw < cap < serialized), `rawContentBytes(batch)` helper, exported `FIXTURE_PATH` |
| `test/fake/batch-cap.test.ts` | Created | REQ-01.1/.2/.3 — exactly-at-cap resolves, over-cap rejects with the mutant-killing raw<cap<serialized property asserted directly, and the real `defineFactory`→`Session.flush`→fake path proven to reach `emit` unconditionally (spy count 1) before rejecting |
| `test/types/wire-content-string.test.ts` | Created | REQ-02.1 — `expectTypeOf` pin: `Directive`'s `modify.content` and `create.template` are exactly `string` |
| `test/skeleton/write-only-factory.test.ts` | Modified | Appended REQ-03.1 — empty-batch factory: `emit` spy count 0, `commit` spy count 1 |
| `openspec/decisions/0019-batch-cap-and-text-wire.md` | Created | ADR-0019: cap decision, provenance clause, alternatives considered |
| `openspec/decisions/0017-normative-fake-semantics-fail-closed.md` | Modified | Appended "Amendment (2026-07-04b): self-move identity exclusion" section, documenting the S-1.3-implemented `dst === src` exclusion |

## REQ Coverage

| REQ-ID | Test file | State |
|---|---|---|
| REQ-01.1 (exactly-at-cap passes) | `test/fake/batch-cap.test.ts` | ✅ green |
| REQ-01.2 (one byte over rejects, raw-measurer mutant killed) | `test/fake/batch-cap.test.ts` | ✅ green (RED→GREEN driven) |
| REQ-01.3 (SDK never pre-validates; fake is sole judge) | `test/fake/batch-cap.test.ts` | ✅ green (RED→GREEN driven) |
| REQ-02.1 (`string` type pin) | `test/types/wire-content-string.test.ts` | ✅ green (characterization — pre-existing shape) |
| REQ-03.1 (empty-batch reaches commit) | `test/skeleton/write-only-factory.test.ts` | ✅ green (characterization — zero production change) |

## TDD Cycle Evidence — S-1.4

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| batch-cap fixtures + cap check | `batch-cap.test.ts::REQ-01.1 ... is accepted at emit` | contract | (see note below — fixture-seeding fixup, not the cap logic) | ✅ | n/a — single boundary case per spec | none needed |
| batch-cap check | `batch-cap.test.ts::REQ-01.2 ... rejects a batch whose serialized size exceeds the cap ...` | integration | `Expected promise that rejects, Received promise that resolved` | ✅ | 2 cases (exactly-at-cap vs over-cap) satisfy the boundary; both required by REQ-01 | none needed |
| batch-cap check via real path | `batch-cap.test.ts::REQ-01.3 ... Session.flush calls emit() unconditionally ...` | integration | `Expected promise that rejects, Received promise that resolved` | ✅ | n/a — single scenario per spec (SDK-never-prevalidates is a structural property, not a class of inputs) | none needed |

**Note on REQ-01.1's RED evidence**: the FIRST run of the full test file failed on REQ-01.1
itself, but for the WRONG reason — the fixture's `modify` directive targeted a path absent
from the fake's seed, so `emit` rejected on the pre-existing `modify target not found`
existence check (ADR-0017 rule 2, unrelated to the cap). Per strict-tdd.md's "test fails for
the wrong reason" rule, I fixed the structural problem (seeded the fake with `FIXTURE_PATH`
via a `seededFake()` helper) WITHOUT touching the cap-check logic, then re-ran: REQ-01.1
passed immediately (correct — it's the already-permissive path with no cap in place yet);
REQ-01.2/REQ-01.3 then failed for the RIGHT reason (assertion failure: expected a rejection,
got a resolution) — genuine RED against a fake that has no cap check. GREEN (the emit() size
guard) then turned both green with zero further test changes.

## Deviations From Design

None. `batchOverSerializedBytes` is a helper name not explicitly given in the design's §4.5
prose (which only names `batchOfSerializedBytes` and describes "the over-cap fixture"
informally) — the padding-ratio algorithm (quote/backslash chars, 2 serialized bytes per 1
raw byte) matches the design's description exactly; I named the second builder for symmetry
and export clarity. Noting as a naming choice, not a semantic deviation.

## Post-Slice Audit (code-audit.md, mode: slice)

Ran Group 1 (subset: REQ-01.1–.3, REQ-02.1, REQ-03.1), Group 2, Group 3 against this slice's
diff. No `Bug`, `Architecture`, or `MAJOR` findings:
- Group 1: all 5 REQ-IDs trace to `specs/batch-cap-contract/spec.md`; each has both
  implementing code and an asserting test.
- Group 2: no new cross-layer imports (`contract-fake.ts` already imports from
  `src/core/wire.ts`; adding a value import of `BATCH_CAP_BYTES` alongside the existing type
  imports crosses no new boundary). No ADR contradiction — the cap check lives in the fake,
  never in `session.ts`/SDK code, matching ADR-0018. No sensitive area touched (per spec.md's
  own "Sensitive Areas Coverage: None").
- Group 3: no untyped casts, no new TODO/deferred markers, no dead duplicates.
  `BATCH_CAP_BYTES = 4 * 1024 * 1024` is a hardcoded numeric constant but is the ADR-0019-
  mandated SINGLE named constant (the intentional one-line-change point) — not a magic-number
  finding.

## Verification

- `bun test test/fake/batch-cap.test.ts` → 3 pass, 0 fail
- `bun test test/skeleton/write-only-factory.test.ts` → 5 pass, 0 fail
- `bun test test/types/wire-content-string.test.ts` → 2 pass, 0 fail
- `bun test test/fake test/skeleton test/types` (scoped regression) → 135 pass, 0 fail
- `bunx tsc --noEmit` → clean, no output
- `bun test` (full project, final step) → 223 pass, 0 fail — no foreign failures observed
  (an earlier full-suite typecheck pass showed 2 unused-variable errors in
  `test/fitness/fit-10-engine-client-port-guard.test.ts` — S-1.8 sibling territory, explicitly
  out of my scope; a later re-run found it already clean, resolved by that sibling agent
  mid-flight)

## Risks

None identified for this slice's own scope. The 4 MiB cap value carries the provenance
caveat already documented in ADR-0019 (SDK-chosen, not engine-confirmed) — a pre-existing,
explicitly-accepted risk of the ratified D8 decision, not new here.

## Scope Note (parallel execution)

Per the orchestrator's explicit parallel-execution constraint, `slices.md` was NOT edited —
sibling agents are concurrently building S-1.5/1.6, S-1.8, S-1.9 in the same working tree.
S-1.4's five tasks are complete in fact; the orchestrator should mark them `[x]` when
reconciling the parallel batch.

## Skill Resolution

`fallback-registry` — no `## Project Standards (auto-resolved)` compact-rule block was
present beyond the brief inline TypeScript/Bun/Strict-TDD note in the launch prompt;
proceeded using the codebase's own established conventions (`test/fake/*.test.ts` literal
Batch/Directive builders, `test/types/*.test.ts` `expectTypeOf` prove+freeze pattern) as the
pattern source, read directly from sibling files per instructions.
