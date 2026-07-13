# Coverage Manifest — Author-Emulation Corpus

Completeness is the literal checklist in `golden-corpus-contract` REQ-GCC-08 — this
manifest's four points (EXERCISED, NOT-EXERCISED, engine-gated entries, FRICTION), all
present. The EXERCISED ledger below is PRE-MAPPED from the signed 21-row
`specs/scenario-matrix/spec.md` table (design.md §4.4) — it documents which REQ-ID each
row is answerable for, independent of build state. `s-00` (this change's own walking
skeleton, S-000) is not a scenario-matrix row and cites no `schematic-local-files` REQ-ID
(REQ-GCC-12).

**Build status (2026-07-14, S-004 landed)**: corpus FILES now exist for ALL 21 matrix rows
plus `s-00` — `m-01, m-02, m-03, m-04, m-05, m-06, m-07, m-09, m-14, m-19, m-20` (S-003 —
Generation & Classification Happy Paths) and `m-08, m-10, m-11, m-12, m-13, m-15, m-16,
m-17, m-18, m-21` (S-004 — Batch-Cap, Containment & Rejection Boundaries). The scaffold
matrix is COMPLETE at this spec version (REQ-SCM-01, 21 rows).

## EXERCISED

Maps every `schematic-local-files` REQ-ID cited anywhere in the
`specs/scenario-matrix/spec.md` table to its row id(s). "Cited" = present in a matrix
row's `Citation(s)` column.

| REQ-ID | Row(s) |
|---|---|
| D2 (owner boundary) | M-01 |
| REQ-FSC-01.1 | M-02 |
| REQ-FSC-01.2 | M-01, M-02 |
| REQ-FSC-01.3 | M-02 |
| REQ-FEH-01.1 | M-01 |
| REQ-FEH-03.1 | M-01 |
| REQ-FSC-03.1 | M-03 |
| REQ-FSC-05.1 | M-04 |
| REQ-CCL-01.1 | M-05 |
| REQ-CCL-01.2 | M-05, M-06 |
| REQ-BRC-01.1 | M-05 |
| REQ-BRC-01.2 | M-06 |
| REQ-CCL-06.1 | M-07 |
| REQ-ATH-14.1 | M-07 |
| REQ-CCL-05.1 | M-08 |
| batch-cap REQ-04.1 | M-09 |
| batch-cap REQ-04.2 | M-10 |
| batch-cap REQ-04.3 | M-11 |
| REQ-FEH-02.1 | M-12 |
| REQ-FEH-02.2 | M-12 |
| REQ-FSC-04.2 | M-13 |
| REQ-FSC-04.1 | M-14 |
| REQ-FSC-08.1 | M-15 |
| REQ-PRC-04.1 | M-16 |
| REQ-PRC-04.6 | M-16 |
| REQ-PRC-07.1 | M-17 |
| REQ-BRC-06.1 | M-18 |
| REQ-FSC-09.1 | M-19 |
| REQ-ATH-16.1 | M-20 |
| batch-cap REQ-05.1 | M-21 |
| _(none — infra-spine skeleton, REQ-GCC-12)_ | s-00 |

All 21 matrix rows (REQ-SCM-01) are represented above, and every row now has a committed
corpus file — the last 10 (`m-08, m-10, m-11, m-12, m-13, m-15, m-16, m-17, m-18, m-21`)
landed in S-004.

## NOT-EXERCISED

- `module-wiring`
- `tsconfig-AST`
- `template rendering`
- `REQ-BRC-08`
- `REQ-PRC-06`

`module-wiring` and `tsconfig-AST` trace to `author-emulation-generator` REQ-AEG-02 (the
fixture's `.template` text is illustrative "wiring" prose, never AST-verified).
`template rendering` traces to `ir-transcript-capture` REQ-ITC-03's evidence boundary —
this suite never asserts rendered `{{}}`/`{= =}` output. `REQ-BRC-08`/`REQ-PRC-06` are
engine-gated entries from `scenario-matrix` REQ-SCM-02.

## FRICTION

- **Missing `collection.json` marker (S-002 authoring gap)**: `test/fixtures/author-emulation/`
  shipped without its own `collection.json` containment-ceiling marker (unlike
  `test/fixtures/typed-factory/`), so every S-003 `defineFactory({packageDir})` call
  against this fixture would have failed loud ("no collection.json found at or above
  ...") before running at all. Disposition: `accepted-as-is` — fixed directly in S-003
  (a one-line, zero-risk addition; the marker is presence-only, never parsed).
- **FIT-24's absolute-path scan false-positived on legitimate template prose**: the
  scanner's naive `[^"]*` match doesn't recognize JSON-escaped quotes, so a `create.template`
  string starting with a `"// comment"` opener and containing an embedded quote (this
  fixture's own `__name@dasherize__.controller.ts.template` content, shipped in S-002)
  was misread as an absolute-path leak once its content first landed in a committed
  corpus record (S-003, `m-01`/`m-04`). Disposition: `accepted-as-is` — fixed directly
  (space/escaped-newline guard added, with a pinning regression test).
- **FIT-27's corpus-write co-occurrence scan false-positived once real report-writing
  landed**: the scanner flagged the e2e test file as a corpus-dir writer because it both
  reads `CORPUS_DIR` (for the byte-compare) and calls `writeFileSync` (for report output,
  REPORTS_DIR-targeted) in the same module — whole-file co-occurrence, not per-call-site
  precision. Disposition: `accepted-as-is` — fixed directly (scoped the check to each
  write call's own argument list, with a pinning regression test).
- **GCC-09.1's `path` illustration diverges from the landed API for `invalidInput()`-sourced
  rejections (S-004)**: the signed spec's worked example shows M-13 with a concrete `path`,
  but `invalidInput(message)` (`src/core/authoring-error.ts:276`) mints `verb: undefined,
  path: undefined` unconditionally — every producer site that calls it (missing
  `from`/`to`, filters-eliminated-everything M-13, intra-scaffold collision M-15, binary
  `.template` in a walk M-08, `templateFile` binary/oversized M-12) commits `verb: null,
  path: null`. Disposition: `accepted-as-is` — this is the R-F carried-note reconciliation
  design.md anticipated, generalized from M-13 alone to all four `invalidInput()`-sourced
  rows; the attribution triple is still asserted EXPLICITLY (SCM-05) at each row, `null`
  values included, never skipped.
- **Batch-cap ("cap") rejections never attribute a `verb`/`path`, even to a batch's SOLE
  directive (S-004, M-10/M-11)**: `EmitRejection("cap", ...)` (`test/support/
  contract-fake.ts`) is thrown WITHOUT a `pos` argument — `emit-rejection.ts`'s own
  contract documents `"cap"`/`"unrepresentable"`/`"unknown"` as BATCH-level (no single
  offending directive to blame), unlike `"collision"`/`"not-found"` which always pass
  `pos`. M-10's giant `create()` and M-11's one-byte-over variant are each the ONLY
  directive in their failing batch, yet still commit `verb: null, path: null`. Disposition:
  `accepted-as-is` — matches the `AuthoringVerb` type's own JSDoc; not a capture bug.
- **`scaffold`'s own by-value classifier structurally cannot produce an at/over-cap
  `create` directive (S-004, M-10/M-11 fixture design)**: `classify-transport.ts`'s CCL-02
  budget gate silently downgrades any non-`.template` file whose serialized directive
  would exceed `BATCH_CAP_BYTES` to a by-reference `copyIn` (~150 bytes) rather than ever
  emitting an over-cap `create` — so the batch-cap REQ-04.2/04.3 boundary rows could not be
  built from scaffold's own walked files. Disposition: `accepted-as-is` — both fixtures use
  a direct `create()` call (bypassing that classifier entirely, matching REQ-04.2's own
  framing as "unchanged from REQ-01's existing per-batch behaviour"); M-10 chains a
  trailing `scaffold()` call so the row still exercises the expander's chunking
  accumulator noticing the pre-existing oversized pending directive.
