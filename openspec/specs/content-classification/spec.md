# Content Classification Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized; V4
amendment 2026-07-16)
**Change**: `schematic-local-files` (amended by `stdio-engine-client`, 2026-07-16)

**V3 → V4 (amendment via `stdio-engine-client` archive, 2026-07-16)**: REQ-CCL-02.3's
at-boundary scenario re-anchors from the bare "frame budget" (implicitly `BATCH_CAP_BYTES`)
to the emit budget `EMIT_BATCH_BUDGET_BYTES` (`batch-cap-contract`'s own V4 amendment,
`BATCH_CAP_BYTES − EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES` = 4194222) — the sole size authority
this domain predicts against (REQ-CCL-02) moved, so the exactly-at-boundary fixture moves
with it. Zero REQ-IDs added/removed.

V2 → V3: no V3 deltas targeted this domain — content unchanged; version/status bump
only. (The by-value/by-reference vocabulary HERE is spec/transport prose, deliberately
retained — the [OWNER] `"rendered" | "copied"` ruling governs only the author-facing
`DryRunEntry.kind` strings, `dry-run-plan-exposure` REQ-DRE-05.)

V1 → V2 (blind council fixes applied): REQ-CCL-05 (`.template` sniff-fail inside a
scaffold walk fails loud — carved out of REQ-CCL-01's else-branch, B1); REQ-CCL-06
(stat-size gate before content read, S12); scenarios CCL-01.3 (invalid-UTF-8-without-
null-byte fixtures, B2), CCL-01.4 (valid multi-byte UTF-8, B3), CCL-01.5 (empty file),
CCL-02.2 (serialized-vs-raw, S9), CCL-02.3 (exactly-at-boundary, S10), CCL-03.2
(>64KB tail-null, S11). All V1 REQ-IDs preserved.

## Purpose

Defines the deterministic rule that decides, per file, whether `scaffold` emits a
by-value (rendered, `create`) or by-reference (verbatim, unrendered) directive. The
author NEVER declares text-vs-binary — classification is entirely sniffed (obs #915
ruling 9). This is a lowering heuristic only; the engine/fake emit cap remains the sole
size authority (ADR-0018/0019) — this domain never re-litigates that cap, it merely
predicts which side of it a file's serialized form will land on.

## Requirements

### REQ-CCL-01: Deterministic By-Value/By-Reference Sniff

A file is by-value iff its WHOLE-FILE content is valid UTF-8 with no null byte AND
(REQ-CCL-02) fits the frame budget; otherwise it is by-reference — EXCEPT a source
whose filename carries the `.template` marker, which NEVER silently degrades to
by-reference: a `.template` source failing the sniff fails loud instead (REQ-CCL-05,
obs #915 ruling 9's fail-loud arm). The sniff reads the ENTIRE file — never a prefix,
never an extension list. Never author-declared.

#### Scenario REQ-CCL-01.1: Valid UTF-8 text, no null byte, in budget → by-value [SDK]

- GIVEN a small valid-UTF-8 file with no null bytes
- WHEN classified
- THEN it is by-value

#### Scenario REQ-CCL-01.2: Invalid UTF-8 → by-reference [SDK]

- GIVEN a file whose bytes are not valid UTF-8
- WHEN classified
- THEN it is by-reference, regardless of file extension

#### Scenario REQ-CCL-01.3: Invalid UTF-8 WITHOUT any null byte → by-reference (kills the null-scan-only mutant) [SDK]

- GIVEN three Buffer-literal fixtures, none containing a `0x00` byte: (i) an
  overlong-encoded null `0xC0 0x80`, (ii) a lone surrogate `0xED 0xA0 0x80`,
  (iii) a lone continuation byte `0x80`
- WHEN each is classified
- THEN each classifies by-reference — a mutant that only scans for null bytes
  (skipping UTF-8 validation) wrongly classifies all three by-value

#### Scenario REQ-CCL-01.4: Valid multi-byte UTF-8 → by-value (kills the ASCII-only mutant) [SDK]

- GIVEN a file whose content is `"café 日本語 😀"` (valid multi-byte UTF-8: 2-, 3-,
  and 4-byte sequences), no null byte, under budget
- WHEN classified
- THEN it is by-value — a mutant that only accepts ASCII bytes wrongly classifies it
  by-reference

#### Scenario REQ-CCL-01.5: Empty (0-byte) file → by-value [SDK]

- GIVEN a 0-byte file
- WHEN classified
- THEN it is by-value (vacuously valid UTF-8, no null byte, trivially in budget)

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

### REQ-CCL-03: Whole-File Null-Byte Scan — Tail Detection

The null-byte/UTF-8 scan MUST cover the WHOLE file, not a prefix sniff: a file whose
opening bytes are valid text but whose TAIL contains a null byte or invalid UTF-8 MUST
classify by-reference — a prefix-only scan would misclassify it by-value.

#### Scenario REQ-CCL-03.1: Text-valid head, binary tail → by-reference [SDK]

- GIVEN a file whose first 4KB are valid UTF-8 text and whose final bytes contain a
  null byte
- WHEN classified
- THEN it classifies by-reference — a scan limited to the opening bytes would
  wrongly classify it by-value; this REQ pins the whole-file scan against exactly
  that mutant

#### Scenario REQ-CCL-03.2: Tail-null beyond common sampling windows (>64KB) [SDK]

- GIVEN a file LARGER than 64KB whose only null byte sits in its final bytes
- WHEN classified
- THEN it classifies by-reference — kills the prefix-sampler mutant class that scans
  a fixed window (4KB/8KB/64KB) instead of the whole file

### REQ-CCL-04: P1 — Template-Like Sequences in a Text Asset (mandatory)

A text asset that is valid UTF-8, has no null byte, fits the frame budget, AND happens
to contain `{= =}`-like sequences classifies by-value like any other qualifying text
file — `scaffold` renders it through the existing template engine, which WILL attempt
to interpret those sequences (obs #915 ruling 18). This is expected, deterministic
behaviour, not a defect: an author who needs the literal sequences preserved verbatim
uses `copyIn` (`file-escape-hatches` REQ-FEH-03) — or `exclude`s the file from
`scaffold` and `copyIn`s it separately — as the documented escape.

#### Scenario REQ-CCL-04.1: Text asset with template-like sequences renders via scaffold; copyIn is the documented escape [SDK]

- GIVEN a text asset under the frame budget whose content includes a `{= literal =}`
  -looking sequence NOT intended as a template token, scaffolded by-value
- WHEN the scaffold runs
- THEN the file is classified by-value and its emitted `create` directive's
  `template` is the file's literal content (the SDK never distinguishes "intended"
  from "coincidental" `{= =}` — rendering is the engine's concern downstream)
- AND a parallel fixture using `copyIn` for the SAME file emits a by-reference
  directive instead — proving the escape exists and is reachable

### REQ-CCL-05: `.template` Sniff-Fail Inside a Scaffold Walk → Fail-Loud

A source whose filename carries the `.template` marker (at its REQ-FSC-05 pipeline
position, post-rename) that fails the by-value sniff — invalid UTF-8, null byte, or
over budget — inside a `scaffold` walk MUST reject fail-loud with reason
`invalid-input` (owner mapping family, REQ-AEC-12), never silently degrade to
by-reference: `.template` is an explicit render request, exactly like `templateFile`
(`file-escape-hatches` REQ-FEH-02; obs #915 ruling 9's fail-loud arm).

#### Scenario REQ-CCL-05.1: Binary `.template` source in a scaffold walk fails loud [SDK]

- GIVEN a `scaffold` walk enumerating `logo.svg.template` whose bytes contain a null
  byte
- WHEN the scaffold runs
- THEN it rejects fail-loud with reason `invalid-input`, naming the offending source
- AND no by-reference directive is emitted for that source

### REQ-CCL-06: Stat-Size Gate Before Any Content Read

Classification MUST consult the source's stat size BEFORE reading any content: a file
whose stat size alone already exceeds the frame budget classifies by-reference
(or fails loud when it is a `.template`/`templateFile` render request — REQ-CCL-05 /
REQ-FEH-02) WITHOUT any full content read. This bounds classification cost and closes
the oversized-file resource-exhaustion vector (a multi-GB asset never gets slurped
into memory just to be told it's over budget).

#### Scenario REQ-CCL-06.1: Over-budget-by-stat file classifies with zero content reads [SDK]

- GIVEN a non-`.template` file whose stat size alone exceeds the frame budget, with
  fs read instrumentation active
- WHEN classified
- THEN it classifies by-reference AND zero content-read calls are recorded for it —
  only the stat

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation / resource bounds) | REQ-CCL-01, REQ-CCL-03, REQ-CCL-05, REQ-CCL-06 | Yes |
