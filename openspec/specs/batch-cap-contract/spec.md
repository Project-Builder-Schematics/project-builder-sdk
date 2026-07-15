# Batch-Cap Contract Specification

**Spec version**: V4
**Status**: signed (2026-07-13 — owner micro-unfreeze, `schematic-local-files` archive sync;
V4 amendment 2026-07-16)
**Change**: `stage-1-ir-bedrock` (amended by `schematic-local-files`, 2026-07-13; amended by
`stdio-engine-client`, 2026-07-16)

**V3 → V4 (amendment via `stdio-engine-client` archive, 2026-07-16)**: REQ-01.1 and REQ-04.3's
at-cap scenarios re-anchor from the raw `BATCH_CAP_BYTES` literal to `EMIT_BATCH_BUDGET_BYTES`
(`BATCH_CAP_BYTES − EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES` = 4194304 − 82 = 4194222,
`src/core/wire.ts`) — the fixed-allowance budget that guarantees an accepted batch's ACTUAL
encoded frame body never exceeds `BATCH_CAP_BYTES` once wire-envelope overhead is added.
`ContractFake.emit` (the engine stand-in this domain specifies) and the real
`StdioEngineClient` now share one measurer (`exceedsEmitBatchBudget`, FEH-01 parity) — "the
cap" this domain enforces is that shared budget, not the bare 4 MiB literal. Zero REQ-IDs
added/removed/renumbered.

**V2 → V3 delta (owner micro-unfreeze, 2026-07-13, via `schematic-local-files`)**: adds
REQ-04 (a `scaffold` call's AGGREGATE size, summed across the whole folder, is never by
itself grounds for rejection — the walk may chunk-flush so each individual batch
satisfies the existing per-batch cap, REQ-01) and REQ-05 (the author-visible
cross-chunk atomicity promise — a later-chunk failure still commits nothing for the
run, ADR-0015 discard semantics survive chunked flushing). This domain uses
UNPREFIXED REQ-IDs (`REQ-01..05`) — ID-stability first, mirroring the
`authoring-error-contract` REQ-AEC-05 naming-note precedent that the domain's own
convention governs, not a global prefix scheme.

## Purpose

Defines the `Batch` size cap as a wire-envelope property the fake (standing in for the
engine) enforces at `emit()` — never at `Session.flush` — preserving ADR-0018's "the SDK
never validates" invariant. Ratified as **D8** (2026-07-04), formalized as **ADR-0019** at
design time: cap = 4 MiB measured as `Buffer.byteLength(JSON.stringify(batch), 'utf8')`;
`modify.content`/`create.template` are UTF-8 text only in v1 (no binary/base64 wire shape —
the binary-posture rationale prose lives in ADR-0019, not here).

## Requirements

### REQ-01: 4 MiB cap enforced at the fake's `emit`, measured in UTF-8 bytes of the SERIALIZED batch

> RED posture: **must-fail-first** — no cap check exists anywhere today; the rejection
> scenarios below fail red against the current fake before the fix lands.

A `Batch` whose `Buffer.byteLength(JSON.stringify(batch), 'utf8')` exceeds `4 * 1024 * 1024`
MUST cause `emit()` to reject. A `Batch` at exactly the cap MUST pass. `Session.flush` (SDK
side) MUST perform no size check of its own — it always calls `emit()` regardless of size;
only the fake (engine stand-in) judges size, matching ADR-0018.

**(V4)** The fake's own at-cap boundary is anchored to `EMIT_BATCH_BUDGET_BYTES` (`BATCH_CAP_BYTES
− EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES`, `src/core/wire.ts`) — shared with the real
`StdioEngineClient`'s outbound leg for FEH-01 parity. "The cap" this REQ enforces is that
shared, slightly-smaller budget (4194222 bytes), not the raw `BATCH_CAP_BYTES` literal
(4194304 bytes) — see REQ-01.1's amended boundary.

**Fixture-construction constraint (mutant-killer)**: boundary fixtures MUST be sized against
the SERIALIZED batch, and MUST be built so a mutant that measures raw content bytes (summing
`modify.content`/`create.template` lengths instead of serializing the envelope) reaches the
WRONG verdict on at least one fixture. Concretely: the over-cap fixture's raw content byte
total stays BELOW the cap while JSON-escaping overhead (quotes, `\n`, `\\`, envelope keys)
pushes its serialized byte length OVER — a raw-content measurer passes it; the correct
measurer rejects it. Multi-byte (non-ASCII) content remains mandatory in both boundary
fixtures so a UTF-16 code-unit measurer is also distinguishable from the UTF-8 byte
measurer.

#### Scenario REQ-01.1: Exactly-at-cap passes (V4, re-anchored to the emit budget)

- GIVEN a `Batch` whose SERIALIZED UTF-8 byte length
  (`Buffer.byteLength(JSON.stringify(batch), 'utf8')`) equals `EMIT_BATCH_BUDGET_BYTES`
  (`BATCH_CAP_BYTES − EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES` = 4194304 − 82 = 4194222) exactly,
  built from multi-byte (non-ASCII) content that also contains JSON-escaping characters
- WHEN `emit(batch)` is called
- THEN it resolves (does not reject)
- (Previously V1–V3: the boundary was pinned at the raw `BATCH_CAP_BYTES` literal
  (4194304); `stdio-engine-client` re-anchors it to the shared emit budget so the fake and
  the real `StdioEngineClient` can never diverge on an accept/reject verdict for the same
  batch)

#### Scenario REQ-01.2: One byte over rejects — and a raw-content measurer would wrongly pass it

- GIVEN a `Batch` whose serialized UTF-8 byte length is `4 * 1024 * 1024 + 1` or more, but
  whose raw content bytes (sum of `Buffer.byteLength` over the content/template fields
  alone) total BELOW the cap — escaping + envelope overhead supplies the excess
- WHEN `emit(batch)` is called
- THEN it rejects
- AND the test also asserts the fixture property itself (raw-content total < cap <
  serialized total), so the raw-content-measurement mutant demonstrably flips this verdict

#### Scenario REQ-01.3: SDK never pre-validates — the fake is the sole judge

- GIVEN an oversized batch per REQ-01.2
- WHEN a `defineFactory` run flushes it through `Session.flush`
- THEN `Session.flush` calls `emit()` unconditionally (no SDK-side size branch) and the
  rejection originates from the fake, not from `session.ts`

### REQ-02: Wire content fields are type-constrained to `string` (UTF-8 text posture, v1)

> RED posture: **characterization / RED-waived** — the wire types already declare `string`
> today; this pins the existing shape per the `typed-options-and-read` prove+freeze
> precedent (#2).

The `Directive` wire type MUST declare `modify.content` and `create.template` as exactly
`string` — no union with a binary/base64 wrapper shape exists in the v1 contract. The pin is
type-level and observable: an `expectTypeOf`-style type test AND the FIT-04 committed
`.d.ts` baseline both freeze it. The binary-posture rationale (why text-only; why a future
binary shape is an additive wire change) is ADR-0019 prose, not a scenario here.

(Previously in V1: the scenario asserted the ABSENCE of a binary/base64 code path — not
observable. Rephrased to a positive type-level pin.)

#### Scenario REQ-02.1: The `string` constraint is pinned at type level

- GIVEN the `Directive` type declarations in `wire.ts`
- WHEN checked by a type-level test (`expectTypeOf` asserting `modify.content` and
  `create.template` are exactly `string`) and diffed against the FIT-04 `.d.ts` baseline
- THEN both fields are exactly `string`; widening either to a union (e.g.
  `string | { base64: string }`) fails the type test and the baseline diff

### REQ-03: Empty-batch run-end still reaches `commit()`

> RED posture: **characterization / RED-waived** — `Session.flush` already no-ops on empty
> pending and `defineFactory` already calls `commit()` unconditionally; zero production
> change (`session.ts`/`context.ts` untouched by this requirement). Prove+freeze precedent
> from `typed-options-and-read` (#2).

A `defineFactory` body that buffers zero directives MUST still resolve cleanly:
`Session.flush` no-ops (no `emit` call, since pending is empty) and the runner still calls
`session.commit()` on success.

#### Scenario REQ-03.1: Zero-directive factory still commits — commit invocation observed

- GIVEN a `defineFactory` body that calls no verbs at all, run against a fake whose
  `commit()` is spied (invocation counter)
- WHEN the runner executes it to completion
- THEN `emit` is never called (spy count 0)
- AND the `commit()` spy was invoked exactly once — the assertion observes the INVOCATION,
  not merely that the run resolves
- AND the run resolves without error

### REQ-04: Aggregate Scaffold Size Is Never, By Itself, Grounds for Rejection

A `scaffold` call whose files, summed across the WHOLE folder, would exceed
`BATCH_CAP_BYTES` if emitted as one batch MUST NOT be rejected outright on that
aggregate basis alone. The `folder-scaffold` walk MAY call `session.flush()` between
file groups so that each individually flushed batch independently satisfies the
existing per-batch cap (REQ-01). This REQ pins ONLY the outcome — that a scaffold's
aggregate byte size alone never blocks it before any batch is attempted; the exact
chunking policy (group boundaries) is a DESIGN-OWNED decision, out of this spec's
pinning scope. The author-visible atomicity promise across chunks is REQ-05.

#### Scenario REQ-04.1: Scaffold whose aggregate exceeds the cap, but no single chunk does, succeeds — completely [SDK]

- GIVEN a `scaffold` call over files whose combined serialized size exceeds
  `BATCH_CAP_BYTES`, but no individual flushed group's serialized batch does
- WHEN scaffolded
- THEN it completes without a `changes-too-large` rejection
- AND the flushed batches together contain exactly one directive per enumerated
  source file — none dropped, none duplicated, none reordered relative to the walk
  order

#### Scenario REQ-04.2: A single group within scaffold whose own batch exceeds the cap still rejects [SDK]

- GIVEN a `scaffold` call where one file group's own serialized batch (independent of
  the aggregate) exceeds `BATCH_CAP_BYTES`
- WHEN scaffolded
- THEN that group's flush rejects `changes-too-large`, unchanged from REQ-01's
  existing per-batch behaviour

#### Scenario REQ-04.3: Exactly-at-cap chunk passes; one byte over rejects (V4, re-anchored) [SDK]

- GIVEN two scaffold fixtures: one whose flushed group's serialized batch lands
  EXACTLY at `EMIT_BATCH_BUDGET_BYTES` (4194222, per REQ-01.1's V4 anchor), one exactly
  one byte over
- WHEN each is flushed
- THEN the at-cap batch passes and the one-over batch rejects — pinning `>` (not
  `>=`) as the over-cap comparison, consistent with REQ-01.1

### REQ-05: Cross-Chunk Atomicity — the Author-Visible Promise

A `scaffold` whose chunked emission fails at a LATER flush MUST still commit NOTHING
for the run: run-level all-or-nothing (ADR-0015 discard semantics — a rejected run
discards everything, including chunks already emitted in earlier flushes) SURVIVES
chunked flushing. This REQ pins the author-visible PROMISE only; the mechanism is the
existing session/engine discard contract, and the chunk-boundary policy stays
design-owned (REQ-04).

#### Scenario REQ-05.1: Later-chunk failure commits nothing from earlier chunks [SDK]

- GIVEN a `scaffold` whose emission spans at least two flushes, where a directive in
  the SECOND flush rejects (e.g. a collision), run via `runFactoryForTest`
- WHEN the run completes
- THEN `result.tree` is empty — no path from the FIRST (successfully emitted) flush
  is committed
- AND `result.error` carries the attributed rejection
