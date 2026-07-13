# ADR-0045: Package-read source validation & the SDK/fake division of labor

- Status: Accepted (2026-07-13, promoted at schematic-local-files archive)
- Date: 2026-07-12
- Deciders: Daniel (Hyperxq)
- Origin: change `schematic-local-files` (design rev 1).
- Builds on: ADR-0018 (SDK never validates ENGINE-owned concerns), ADR-0021 (origin
  derived from reason), ADR-0043 (`copyIn` op).

## Context

By-reference copy introduces a source that lives on the package's disk, not in the
workspace tree. Four new failure modes (`source-not-found`, `source-outside-package`,
`source-not-regular-file`, `source-unreadable`) must be attributed, and REQ-BRC-06 /
REQ-ATH-15 ask the fake to reject a missing source. But `source-*` are, by REQ-AEC-10,
`authoring-rejected` — an SDK-side pre-emit read/stat detection, NEVER an engine
round-trip refusal. The fake's emit-rejection path only produces `write-rejected` reasons
(via `CODE_TO_REASON`), so it CANNOT be the origin of a `source-*` reason.

## Decision

**Division of labor, pinned:**

- **SDK-side (`src/scaffold/containment.ts`, at emit time, against real disk):** the
  entire `source-*` family. Ordering (REQ-PRC-07/08, no existence oracle; rev 2 = S1):
  lexical screen (`../`/absolute) → `path.resolve` + **segment-aware, case-folding on
  case-insensitive platforms** ceiling check → if OUTSIDE, throw `source-outside-package`
  WITH NO stat/existence probe → if inside, `realpath`; symlink-escape →
  `source-outside-package`; **on ENOENT, `source-not-found` may be concluded ONLY AFTER
  the NEAREST EXISTING ANCESTOR's realpath is proven in-ceiling** — an out-of-ceiling
  ancestor (e.g. an in-ceiling symlinked dir pointing outside) yields
  `source-outside-package`, closing the ancestor-symlink+ENOENT existence oracle → `lstat`
  allow-list (`isFile()` only → else `source-not-regular-file`) → only THEN read content.
- **Fake / conformance vehicle:** destination-collision (`path-collision`, REQ-BRC-05) +
  **emit-only** recording — records the `copyIn` directive in `result.emitted`, NEVER
  writes bytes into `result.tree`/disk (REQ-ATH-15/16, evidence boundary REQ-BRC-04). No
  source check.

REQ-BRC-06.1 / REQ-ATH-15.2 ("the fake rejects a missing source with `source-not-found`")
are satisfied through the harness END-TO-END: `runFactoryForTest` runs the real scaffold
module, whose SDK-side stat throws `source-not-found` before commit — surfacing as
`result.error`. "Emitted against the fake" means "run through the harness whose engine is
the fake," not "hand-fed to `fake.emit()`."

## Consequences

- (+) The fake stays in-memory-pure (no disk read), consistent with REQ-ATH-11/14.
- (+) Clean reason origins: `source-*` = SDK-side/`authoring-rejected`; `copyIn`
  destination-collision = engine-seam/`write-rejected`.
- (−) By-reference tests REQUIRE real on-disk fixtures (the SDK stats real files) — a
  fixture-tree cost, not an in-memory seed.
- (−) Classify-time vs apply-time content drift is INHERENT to by-reference (rev 2, S5):
  the SDK's classification/validation is a point-in-time prediction; the engine re-reads
  the real bytes at apply and is the only party that sees them — never treat SDK-side
  green as a content pin.
- Rev 2 note: rev 1's council-attention clause (end-to-end reading of REQ-BRC-06's
  "fake") is CLOSED — the spec V3 micro-unfreeze rewords BRC-06/ATH-15.2 end-to-end,
  without `#requireExists`.

## Alternatives Considered

- **Fake owns an in-memory source-existence check** — REJECTED: it would need disk access
  (breaks REQ-ATH-11) or a parallel seed that diverges from the SDK's real-disk read, and
  it structurally cannot emit an `authoring-rejected` reason.
