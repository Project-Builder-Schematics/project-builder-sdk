# Coverage Manifest — Author-Emulation Corpus

Completeness is the literal checklist in `golden-corpus-contract` REQ-GCC-08 — this
manifest's four points (EXERCISED, NOT-EXERCISED, engine-gated entries, FRICTION), all
present. This is the **walking-skeleton state** (S-000): `s-00` is not a scenario-matrix
row and cites no `schematic-local-files` REQ-ID (REQ-GCC-12), so EXERCISED is empty here
— it fills in as matrix rows land (S-003/S-004).

## EXERCISED

Maps every `schematic-local-files` REQ-ID cited anywhere in the
`specs/scenario-matrix/spec.md` table to its row id(s). "Cited" = present in a matrix
row's `Citation(s)` column.

| REQ-ID | Row(s) |
|---|---|
| _none yet — populated as M-01..M-21 land (S-003/S-004)_ | — |

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

none observed
