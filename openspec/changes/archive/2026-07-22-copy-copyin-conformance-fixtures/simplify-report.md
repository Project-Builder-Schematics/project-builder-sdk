# Simplify Report — copy-copyin-conformance-fixtures

**Gate run**: 2026-07-22, at /evaluate start (after verify-in-loop-3 PASS, before verify final)
**Scope**: full change diff `7ea80d1^..m2-copyin-banked-arm` (35 files, +457/−17)
**Protocol**: 4 parallel blind `cleanup-reviewer` lenses (reuse / simplification / efficiency / altitude), orchestrator dedup+filter, delegated fix builder
**Status**: ok

## Findings

| # | Lens | Finding | Disposition |
|---|---|---|---|
| 1 | efficiency | REQ-CFX-16.1 read `expected/dst.txt` twice via `readFileSync` — inline assertion + byte-equality operand | **applied** — first read bound to `dstBytes` const, reused; commit `11dfffc` on `m2-copyin-banked-arm`; gates green (fit-40 59 pass, suite 2146 pass, typecheck clean); PR #45 still draft |
| 2 | altitude | 11 copies of the 5-line fixture/case lookup-and-cast scaffolding across the S-001 (REQ-CFX-15) and S-003 (REQ-CFX-16) fit-40 blocks — suggested extracting a local `getCase(id, name)` helper (assertion bodies stay hand-authored per REQ-CFX-08 posture) | **skipped** — 6 of the 11 sites are already merged to `main` (PR #44); applying inside this change would require either a new `main` PR mid-/evaluate (extra serialization point) or refactoring main-landed code on the held branch (pollutes the ADR-0074 banked-arm diff scope). Registered as a followup for the next fit-40 touch — the corpus grows by design, the next fixture change should extract the helper for ALL per-fixture blocks in one consistent pass |
| — | reuse | No findings ("recomputedTotalCases bypassing loadCorpus" scrutinized and correctly recognized as a deliberate independent cross-check, not missed reuse) | clean |
| — | simplification | No findings (same candidate independently examined and discarded; per-fixture block boilerplate recognized as spec-mandated pattern) | clean |

**Counts**: applied 1, skipped 1, reverted 0.

## Followup registered (for sdd-archive → project/pending-changes)

- **fit-40 `getCase` helper extraction** (quality, XS): collapse the repeated fixture/case lookup-and-cast scaffolding (16 sites total: 5 pre-existing REQ-CFX-05..09 + 11 from this change) into one local helper, preserving every hand-authored assertion body byte-identical (REQ-CFX-08 posture untouched). Do it in the NEXT change that touches fit-40, across all blocks in one pass — never partially.

## Notes

- Two independent lenses converged on judging the `recomputedTotalCases` second code path as deliberate — corroborates the design's cross-check intent.
- Non-blocking gate: verify final validates the simplified code (held branch now at `11dfffc`).
