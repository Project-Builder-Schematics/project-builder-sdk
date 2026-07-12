# Delta for Batch-Cap Contract

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3: no V3 deltas targeted this domain — content unchanged; version/status bump
only.

V1 → V2 (blind council fixes applied): REQ-04.1 THEN strengthened (completeness — one
directive per enumerated file, none dropped/duplicated/reordered, B4); scenario
REQ-04.3 (exactly-at-threshold chunk boundary, S10); REQ-05 added (author-facing
cross-chunk atomicity promise, S20). All V1 REQ-IDs preserved.

**ID-naming note**: this domain's main spec uses UNPREFIXED REQ-IDs (`REQ-01..03`);
`REQ-04`/`REQ-05` continue that convention (ID-stability first — mirroring the
REQ-AEC-05 naming-note precedent that the file/domain convention governs, not a
global prefix scheme).

## ADDED Requirements

### REQ-04: Aggregate Scaffold Size Is Never, By Itself, Grounds for Rejection

A `scaffold` call whose files, summed across the WHOLE folder, would exceed
`BATCH_CAP_BYTES` if emitted as one batch MUST NOT be rejected outright on that
aggregate basis alone. The `folder-scaffold` walk MAY call `session.flush()` between
file groups so that each individually flushed batch independently satisfies the
existing per-batch cap (REQ-01). This REQ pins ONLY the outcome — that a scaffold's
aggregate byte size alone never blocks it before any batch is attempted; the exact
chunking policy (group boundaries) is a DESIGN-OWNED decision, out of this spec's
pinning scope (obs #915 open items). The author-visible atomicity promise across
chunks is REQ-05.

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

#### Scenario REQ-04.3: Exactly-at-cap chunk passes; one byte over rejects [SDK]

- GIVEN two scaffold fixtures: one whose flushed group's serialized batch lands
  EXACTLY at `BATCH_CAP_BYTES`, one exactly one byte over
- WHEN each is flushed
- THEN the at-cap batch passes and the one-over batch rejects — pinning `>` (not
  `>=`) as the over-cap comparison, consistent with the main spec's REQ-01.1

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

## Next Step

Surface to human for review alongside the other nine domains.
