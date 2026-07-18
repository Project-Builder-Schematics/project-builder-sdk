# Delta for Content Classification

**Spec version**: V2
**Status**: signed (V2, owner 2026-07-18)
**Change**: `typed-options-feeder`

## MODIFIED Requirements

### REQ-CCL-02: Frame Budget — Symbolic, a Lowering Heuristic Only

Classification's size check MUST be expressed as "fits the serialized frame budget per
ADR-0019 semantics" — never restated as a raw byte constant here. The budget is a
LOWERING HEURISTIC evaluated against realistic SERIALIZED-batch size (envelope + JSON-escaping
overhead included, never raw content bytes alone); the engine/fake emit cap
(`BATCH_CAP_BYTES`, `batch-cap-contract`) remains the SOLE size authority. A file predicted
over-budget classifies by-reference; this REQ never introduces a second, independent size
ceiling. "Fits" is INCLUSIVE: exactly-at-budget fits; one byte over does not (consistent with
`batch-cap-contract` REQ-01's at-cap-passes posture). When the prospective `create` directive
under measurement carries composite (array/object) `options` values, the measured serialized
size MUST reflect the SAME encoding the real emission path applies (`typed-options-encoding`
REQ-TOE-01/REQ-TOE-06) — never the caller's raw, pre-encode option shape. A composite value's
JSON-string form is measured AFTER quote/backslash-escaping inflation, not before, closing the
pre-encode/post-encode misclassification gap.

(Previously: measured the embedded `options` field of the prospective `create` directive in
its raw, caller-supplied shape — silent on whether composite values should be pre-encoded
before the size check.)

#### Scenario REQ-CCL-02.1: Same content, budget-crossing size flips classification [SDK]

- GIVEN two files with IDENTICAL valid-UTF-8, no-null-byte content, one sized to fit
  the serialized frame budget and the other sized to exceed it
- WHEN both are classified
- THEN the under-budget file classifies by-value; the over-budget file classifies
  by-reference — deterministic on size alone, content shape held constant (the
  size-flips-rendering cliff)

#### Scenario REQ-CCL-02.2: Raw size under budget, serialized size over → by-reference [SDK]

- GIVEN a file whose RAW content byte length is under the budget but whose
  JSON-serialized form (heavy escaping: quotes, backslashes, newlines) exceeds it
- WHEN classified
- THEN it classifies by-reference — a raw-content-bytes measurer reaches the wrong
  verdict on this fixture (mirrors `batch-cap-contract` REQ-01.2's mutant-killer)

#### Scenario REQ-CCL-02.3: Exactly-at-budget boundary — inclusive fit (V4, re-anchored) [SDK]

- GIVEN two files: one whose serialized measure lands EXACTLY at
  `EMIT_BATCH_BUDGET_BYTES` (`batch-cap-contract`'s V4-amended emit budget — the exact byte
  value is `batch-cap-contract`'s authority, referenced symbolically, never hardcoded here),
  one exactly one byte over
- WHEN both are classified
- THEN the at-budget file classifies by-value and the one-over file by-reference —
  pinning `>` (not `>=`) as the over-budget comparison

#### Scenario REQ-CCL-02.4: Composite-valued scaffold option measured post-encode at the boundary (NEW) [SDK]

- GIVEN a scaffold entry whose `options` contains a composite (array) value whose
  pre-encode structural size fits the budget but whose post-encode JSON-string size
  (with quote/backslash escaping) exceeds it
- WHEN classified
- THEN it classifies by-reference — the estimate reflects the same encoding real
  emission applies, never the caller's raw pre-encode shape
- AND the resulting by-reference directive emits a `copyIn` carrying NO `options` field at
  all — by-reference scaffold verdicts never carry `create.options`, so the composite value
  that drove the over-budget classification is never itself present in the emitted directive
- AND a real `create()` call with the same options never rejects at emit for exceeding a
  budget the estimate had already, correctly, flagged as over — the graceful
  by-reference fallback is preserved for composite-valued options near the boundary

**Design note (fixture weight)**: REQ-CCL-02.3 and REQ-CCL-02.4 fixtures sit near the
multi-MiB `EMIT_BATCH_BUDGET_BYTES` boundary. Design MAY substitute a test-local budget
override (a smaller injected constant) to keep fixtures lightweight, provided the boundary
semantics (`>` not `>=`, post-encode measurement) are preserved.
