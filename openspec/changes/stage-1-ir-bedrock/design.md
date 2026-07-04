# Design: stage-1-ir-bedrock

**Spec**: V2 (signed, owner, 2026-07-04) · **Triage**: L · **Persona lens**: none
**Architecture impact**: **modifying**

## 4.1 Architecture Overview

Stage 1 hardens the IR seam without adding a layer. Three production edits (all ADR-0017
closure) thread an optional `force?` through the `move` op: `wire.ts` → `directive-factory.ts`
→ author surface (`commons/index.ts` free `move` + both handle `.move` forms via
`base-handle.ts`). One `context.ts` edit preserves the original error on double-fault
discard. Everything else lives in the **normative counterpart** — `test/support/contract-fake.ts`
grows four emit-seam behaviors (fail-closed `move` + identity exclusion, existence-required
`modify`, JSON round-trip compare, 4 MiB cap) — plus golden/fitness/e2e/doc pins. `session.ts`
gets **zero** cap code (D8c): the cap is judged only at the fake's `emit`, honoring ADR-0018.

The single architectural seam is the `EngineClient` port; this change ratifies it structurally
(REQ-FIT-09) rather than moving it. `contract-fake.ts` is the shared bottleneck: its `emit`/
`#apply` are edited in sequence **1.3 → 1.4 → 1.7**, and golden pinning (**1.1**) lands last so
fixtures freeze the finalized wire.

## 4.2 File Changes (contract with sdd-slice; grouped, sequenced)

| # | Path | Action | Purpose |
|---|---|---|---|
| 1.3 | `src/core/wire.ts` | Modify | `move` directive gains `force?: boolean`; (1.4) single named `BATCH_CAP_BYTES` constant — Batch-contract property, sole cap definition (ADR-0019 Provenance); fix phantom ADR-0028 → ADR-0013/0001 |
| 1.3 | `src/core/directive-factory.ts` | Modify | `MoveArgs.force?`; `move` spreads force like rename/copy; ADR-0028 comment fix |
| 1.3 | `src/core/base-handle.ts` | Modify | `WriteOps.move(toDir, opts?: {force?})` |
| 1.3 | `src/commons/index.ts` | Modify | free `move` + both handle `.move` gain trailing `{force?}` |
| 1.3 | `test/support/contract-fake.ts` | Modify | **(a)** `move` fail-closed + identity (`dst===src` not a collision); **then (b)** `emit` cap check (1.4); **then (c)** `emit` JSON round-trip compare + `modify` existence (1.7). All 5 new throws use the `ContractFake: <reason>: "<detail>"` convention + `// RAW-UNTIL-STAGE-2.1` marker (see 4.4) |
| 1.4 | `openspec/decisions/0019-batch-cap-and-text-wire.md` | Create | ADR-0019 (below) |
| 1.4 | `openspec/decisions/0017-normative-fake-semantics-fail-closed.md` | Modify | append self-move identity Amendment (below) |
| 1.5 | `src/core/context.ts` | Modify | double-fault: try/catch around `discard()`, attach E2 as `E1.cause`, re-throw E1 |
| 1.1 | `test/golden-ir/fixtures.ts` | Modify | `GOLDEN_MOVE_FORCE`; chained `RENAME_THEN_MOVE`/`CREATE_THEN_MODIFY` batches; determinism golden byte-string; ADR-0028 fix |
| 1.1 | `test/golden-ir/golden-ir.test.ts` | Modify | `move` force-present/absent rows; ADR-0028 fix |
| 1.1 | `test/golden-ir/chained-batch.test.ts` | Create | REQ-GIR-02 — real run, `emit`-spy vs hand-written batch fixture |
| 1.1 | `test/golden-ir/determinism.test.ts` | Create | REQ-GIR-03 — twice-run byte equality + golden string |
| 1.3 | `test/fake/move-fail-closed.test.ts` | Create | REQ-FAKE-04.m1–m4 |
| 1.3 | `test/fake/modify-existence.test.ts` | Create | REQ-FAKE-07.1–.3 |
| 1.4 | `test/fake/batch-cap.test.ts` | Create | REQ-01.1–.3 |
| 1.4 | `test/fake/batch-cap-fixtures.ts` | Create | deterministic at-cap / over-cap builder (below); parametrized on `BATCH_CAP_BYTES` — no literal 4 MiB in fixtures |
| 1.4 | `test/skeleton/write-only-factory.test.ts` | Modify | REQ-03.1 empty-batch → `commit` spy count 1, `emit` 0 |
| 1.7 | `test/fake/boundary-pass-through.test.ts` | Create | boundary REQ-01/02/03/04 |
| 1.5 | `test/skeleton/double-fault.test.ts` | Create | REQ-10.1 (cause), 10.2 (RED-PHASE GATE vs today), 10.3 (contrast) |
| 1.4 | `test/types/wire-content-string.test.ts` | Create | REQ-02.1 `expectTypeOf` string pin |
| 1.8 | `test/fitness/fit-10-engine-client-port-guard.test.ts` | Create | REQ-FIT-09 (below) |
| 1.9 | `test/e2e/author-to-tree.e2e.test.ts` | Create | REQ-04.1 happy path + move-with-force golden end-state |
| 1.9 | `test/pyramid/pyramid-codification.test.ts` | Create | REQ-01/02/03 doc-table + CI-coverage checks |
| 1.9 | `CONTRIBUTING.md` | Modify | four-layer→directory table + verb/dialect decision table |
| 1.9 | `.github/workflows/ci.yml` | Read-only | REQ-03 asserts `bun test` excludes no mapped dir (already whole-tree) |
| 1.6 | `test/fitness/dts-baseline/{commons.index,core.base-handle,core.handle-state}.d.ts` | Modify | regenerate for `move` `{force?}` surface (else FIT-04 flags the changed line) |
| 1.6 | `test/fitness/fit-04-dts-semver-gate.test.ts` | Modify | W7 unconditional dist rebuild before diff |
| 1.6 | `test/types/permissive-proof.guard.test.ts` | Modify | harden diagnostic-region assertions |
| 1.6 | `test/conformance/meta.test.ts` | Modify | drop tautological red-proof label |
| 1.6 | `openspec/objectives-plan.md` | Modify | 1.4 + O1-row-6 "at flush" → "at fake `emit`"; add D8/ADR-0019 decision row |
| 1.6 | `test/skeleton/directive-factory.test.ts` | Modify | ADR-0028 comment → ADR-0013 |

## 4.2b Flow Changes (author-visible)

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author-to-tree happy path (create→modify→committed golden tree) | Create | REQ-04, REQ-GIR-02 | `test/e2e/author-to-tree.e2e.test.ts` (new) | the one true e2e |
| Move with `force` overwrites destination | Modify | REQ-KIT-03.*, REQ-GIR-01, REQ-FAKE-04.m1–m3 | `test/e2e/author-to-tree.e2e.test.ts` (force end-state) | new author capability `move(…, {force?})` |

Seam-contract behaviors — batch-cap reject, round-trip reject, `modify`-existence, self-move
preservation, path-verbatim, double-fault, empty-batch commit — are failure/edge responses at
the `emit`/`commit` seam, verified at **integration** (`test/fake`, `test/skeleton`), not as
separate e2e author journeys.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/wire.ts` (Directive contract) | modify | `move` variant gains optional `force?` | aligns |
| `core/directive-factory.ts` | extend | threads `force` (mirrors rename/copy) | aligns |
| `core/base-handle.ts` · author surface `commons/index.ts` | modify | `move` signature gains `{force?}` | aligns |
| `core/context.ts` (run lifecycle) | modify | double-fault error preservation | aligns |
| contract fake (engine stand-in) | modify | new emit-seam semantics (fail-closed move, modify-existence, round-trip, cap) — existing behavior changes | aligns |
| fitness layer | new | FIT-09 port guard joins existing `test/fitness` | aligns |
| e2e / pyramid tests | new | `test/e2e`, `test/pyramid` join the test tree | aligns |

All rows `aligns` — every touch fits the IR-seam-port pattern ratified by ADR-0017/0018.
No `deviates` rows → no deviation ADR required. `contract-fake` is a `modify` of existing
behavior → impact ≥ **modifying** (see 4.10).

## 4.3 Data Model

`wire.ts`: `move: { path: string; toDir: string; force?: boolean }` (was no `force`).
`directive-factory.ts`: `interface MoveArgs { path; toDir; force?: boolean }`.
`base-handle.ts`: `move(toDir: string, opts?: { force?: boolean }): WritableHandleRef`.
No new domain entities; content fields stay exactly `string` (REQ-02, text-only v1).

## 4.4 Interface Contracts

Author surface (additive, semver-safe): `move(path, toDir, opts?: {force?: boolean})`;
`handle.move(toDir, opts?: {force?: boolean})` on `WritableHandle` and `FoundHandle`.
Fake `emit(batch)` rejection taxonomy (raw at the seam — Stage 2.1 owns attribution):
cap-exceeded, round-trip-mismatch (silent-drop family), stringify-throw (BigInt/circular),
move-collision-without-force, modify-of-nonexistent. All five new throw sites reuse the
established message convention `ContractFake: <reason>: "<detail>"` (matching the existing
create/rename/copy collision and source-not-found sites in `contract-fake.ts`), and each
carries a greppable `// RAW-UNTIL-STAGE-2.1` comment so Stage 2.1 can locate and upgrade them
to attributed errors without archaeology. `EngineClient` port surface unchanged.

## 4.5 Architecture Decisions

### ADR-0019: Batch size cap, UTF-8 measurement, text-only wire content

**Status**: Proposed. **Closes**: D8 (2026-07-04), objectives-plan 1.4.

**Context**: The `Batch` needs a size cap, but no unit/encoding/enforcement-site existed. Two
axes were open: measurement unit and where the check runs. ADR-0018 forbids SDK-side validation.

**Decision**: Cap = `4 * 1024 * 1024`, measured as
`Buffer.byteLength(JSON.stringify(batch), 'utf8')` — **UTF-8 bytes of the serialized envelope**,
not raw content, not UTF-16 units. **Exactly-at-cap passes; one byte over rejects** (`>` cap).
Enforced **only** at the fake's `emit` (the engine stand-in) — the engine, not the SDK, owns
validation (ADR-0018) — `Session.flush` calls `emit` unconditionally, no SDK size branch (D8c). Wire content (`modify.content`, `create.template`)
is exactly `string` in v1 — **text-only**; a future binary/base64 shape is an *additive* wire
change, not part of this contract.

**Consequences**: (+) one authority for size, matching ADR-0018; the cap travels with the wire,
survives the fake→real swap. (+) empty-batch path is untouched — a zero-directive factory still
`flush`-no-ops and reaches `commit()` (REQ-03). (−) the fake carries measurement logic tests
must pin against escaping/multi-byte adversarial fixtures. (−) binary payloads are unsupported
until a later additive change.

**Provenance**: the 4 MiB value is **SDK-chosen** — a reasonable JSON-RPC-over-stdio frame
limit — NOT engine-confirmed; confirmation against the real engine's frame limit is pending
(engine §6 dependency). Until the Stage 6 semver freeze this value is explicitly cheap to
change. To keep it cheap: the cap lives as a **single named constant** (`BATCH_CAP_BYTES` in
`wire.ts`, a Batch-contract property alongside the envelope shape); the fake's `emit` check,
`batchOfSerializedBytes(target)`, and all boundary fixtures parametrize on that constant —
changing the value touches exactly one production line plus regenerated fixtures, nothing else.

**Alternatives**: *Enforce at `Session.flush`* — rejected: puts engine judgment in the SDK,
violating ADR-0018. *Measure raw content bytes* — rejected: ignores envelope+escaping overhead,
under-counts the real wire size (the REQ-01.2 fixture proves the flip). *Measure `.length`
(UTF-16 units)* — rejected: wrong for multi-byte, not what a byte-oriented transport sees.

### ADR-0017 Amendment (2026-07-04b): self-move identity exclusion

**Status**: Proposed (amends Accepted ADR-0017). The fail-closed destination check excludes
identity: when a `move`'s resolved destination equals its source (`dst === src`), it is **not**
a collision — a self-move is a file-preserving success, no `force` required. **Rationale**:
colliding with yourself is not data loss; matches fs `rename` semantics. **Alternative rejected**:
*treat self-move as a normal collision (require force)* — rejected: forces authors to pass
`force` for a no-op, and a bare identity self-move would destroy the file it names. Recorded as
an ADR-0017 amendment (fail-closed is ADR-0017's domain), referenced from ADR-0019.

## 4.6 Test Derivation

| REQ-ID | Scenario | Level | Test | Flow ref |
|---|---|---|---|---|
| REQ-GIR-01 | move ± force fixture | unit | `test/golden-ir/golden-ir.test.ts` | Move w/force |
| REQ-GIR-02 | chained batch vs fixture (emit spy) | integration | `test/golden-ir/chained-batch.test.ts` | Happy path |
| REQ-GIR-03 | twice-run byte-identical + golden string | integration | `test/golden-ir/determinism.test.ts` | — |
| REQ-FAKE-07.1/.2/.3 | modify-existence (staging counts) | integration | `test/fake/modify-existence.test.ts` | — |
| REQ-FIT-09 | port-bleed scan + planted-bypass red-proof | architectural | `test/fitness/fit-10-engine-client-port-guard.test.ts` | — |
| REQ-FAKE-04.m1–m4 | fail-closed move + identity | integration | `test/fake/move-fail-closed.test.ts` | Move w/force |
| REQ-KIT-03.1/.2/.3 | force threading (free fn + both handles + omit) | integration | `test/golden-ir/chained-batch.test.ts` | Move w/force |
| REQ-10.1/.2/.3 | double-fault preservation | integration | `test/skeleton/double-fault.test.ts` | — |
| REQ-01.1/.2/.3 | 4 MiB cap boundary + SDK-no-prevalidate | integration | `test/fake/batch-cap.test.ts` | — |
| REQ-02.1 | `string` content type pin | contract | `test/types/wire-content-string.test.ts` (+FIT-04 baseline) | — |
| REQ-03.1 | empty-batch reaches commit (spy) | integration | `test/skeleton/write-only-factory.test.ts` | — |
| boundary REQ-01.1 | clean round-trip applies | integration | `test/fake/boundary-pass-through.test.ts` | — |
| boundary REQ-02.1/.2/.3 | silent-drop + throw families reject | integration | `test/fake/boundary-pass-through.test.ts` | — |
| boundary REQ-03.1 | odd path verbatim on emitted directive | integration | `test/fake/boundary-pass-through.test.ts` | — |
| boundary REQ-04.1/.2 | intra-batch author order | integration | `test/fake/boundary-pass-through.test.ts` | — |
| pyramid REQ-01/02/03 | doc table + CI coverage | architectural | `test/pyramid/pyramid-codification.test.ts` | — |
| pyramid REQ-04.1 | e2e factory→fake→golden tree | e2e | `test/e2e/author-to-tree.e2e.test.ts` | Happy path |

All 19 REQs (every scenario sub-ID) covered. Both Create/Modify flows have an e2e row.

**FIT-09 mechanism (design decision — item 2)**: **path allow-list**, not structural exception.
The predicate `scanPortBleed(source, relPath): string[]` flags a file that references the
`\bEngineClient\b` symbol; the `.emit(`/`.commit(`/`.discard(` call-site scan runs **only inside
files that reference `EngineClient`** ("reachable from it"), so a bare EventEmitter `.emit(` in a
port-free file is never scanned — killing the QA false-positive. `Directive`/`JsonValue` are
never matched (data shapes). Allow-list = the single path `test/support/contract-fake.ts` (the
legitimate port implementer, exempt by exact relPath). Production loop scans `src/**` minus
`src/core` (today: commons/conformance/dry-run/index — all clean); the red-proof and the
contract-fake scenario feed source strings to the predicate directly, FIT-01/FIT-08 style.
*Rejected — structural `implements EngineClient` exception*: a planted bypass could write
`implements EngineClient` to spoof the exemption, defeating the guard; a path allow-list cannot
be spoofed (a bypass file cannot claim contract-fake's path).

**At-cap fixture builder (design decision — item 3)**: `test/fake/batch-cap-fixtures.ts`
exposes `batchOfSerializedBytes(target: number): Batch`. It seeds one `modify` directive with a
**fixed multi-byte + escaping prefix** (`"€\"\\\n"` — 3-byte euro, escaped quote/backslash/
newline), serializes, computes `deficit = target - Buffer.byteLength(JSON.stringify(batch),'utf8')`,
and appends exactly `deficit` ASCII `a` bytes (each 1 serialized byte, no escaping) — hitting the
target **exactly, deterministically, no search, no Date/random**; it asserts the final length as
an invariant. The over-cap fixture instead fills content with quote/backslash chars (raw 1 byte,
serialized 2 bytes each) so `rawContentBytes < cap < serializedBytes` — the property REQ-01.2
asserts to kill the raw-measurer mutant; multi-byte stays present to distinguish the UTF-16
mutant.

## 4.7 Fitness Functions

- **No `EngineClient` port bleed outside `src/core`** (REQ-FIT-09) — static scan in
  `fit-10-engine-client-port-guard.test.ts`, permanent string-fixture red-proof.
- **Public `.d.ts` semver gate** (existing FIT-04) — baselines regenerated for the `move`
  `{force?}` surface.

## 4.8 Migration / Rollout

No migration. All surface changes are additive optional params (semver-safe). No feature flags,
no data. Sequencing within the change: 1.3 → 1.4 → 1.7 on `contract-fake.ts`, then 1.1 golden
pinning; 1.5/1.6/1.8/1.9 independent.

## 4.9 Performance

No significant impact. The cap check is one `JSON.stringify` per `emit`; the round-trip is one
`parse(stringify(...))` per `emit` — both fake-only (test/engine stand-in), off the author's
production path.

## 4.10 Architecture Impact

**Architecture impact**: **modifying**
**Rationale**: the contract-fake `modify` touchpoint changes existing established behavior
(`move` silent-overwrite → fail-closed; `modify` materialize → error; new round-trip + cap at
`emit`), and the `core/wire.ts` Directive contract changes shape (`move` gains `force?`) — the
baseline's Testing/Notes descriptions of the old fake and the force-less `move` become outdated.
Additive-only surface, no boundary removed → not `breaking`. Post-verify: refresh the baseline
Testing section (add `test/e2e`, `test/pyramid`, FIT-10) and the `move` wire note.

## 4.11 Open Questions

None.
