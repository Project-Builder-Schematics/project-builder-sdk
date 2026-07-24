# Simplify Report — ts-addimport-collision

**Gate**: sdd-simplify (orchestrator-executed, /evaluate start)
**Date**: 2026-07-21
**Scope**: full change diff `c48036e..d450d39` (11 files, +1351/−33) — all 6 slices sealed, verify-in-loop 1–7 complete
**Lenses**: 4 parallel `cleanup-reviewer` agents (reuse / simplification / efficiency / altitude), anti-anchoring enforced (diff + REQ titles + single angle only)

## Verdict

**status: ok** — findings: **applied 3, skipped 1, reverted 0**. Suite after fixes: 2134 pass / 0 fail across 192 files (byte-count-identical to pre-gate baseline), typecheck clean, verified independently by the orchestrator. Net effect: −56 lines, zero behaviour change, zero test-count change.

## Lens findings inventory

| # | Lens | File | Finding | Disposition |
|---|---|---|---|---|
| E1 | efficiency | `src/dialects/typescript/ops.ts:208` | `addImport` called `getImportDeclarations()` twice and recomputed `boundNamesIn` for the same-module subset in both Step 1 (idempotency) and Step 2 (claimed scan) | **applied** |
| A1 | altitude | `test/dialects/typescript/ops-addImport.test.ts` | 16 hand-copied merge/create skeletons across S-000/S-003/S-004 (the file generalized the reject path via `expectCollisionReject` but never the success path) | **applied** |
| A2 | altitude | `test/dialects/typescript/ops-addImport.test.ts` | 5 hand-copied no-op skeletons, same cross-slice origin | **applied** |
| R1 | reuse | `test/fitness/fit-41-addimport-parity.test.ts:40` | `countDeclarationsFor` hand-rolled escaping + per-call `RegExp`, duplicating `IMPORT_SPECIFIER_RE`/`stripComments` from `test/support/import-scan.ts` (already used by FIT-15/21/25/27) | **applied** |
| S1 | simplification | `test/dialects/typescript/dialect.test.ts:282` | Proposed seeding REQ-TSD-03.11 from the committed golden instead of deriving `priorOutput` via a live prior run | **skipped** |
| S2 | simplification | `test/dialects/typescript/ops-addImport.test.ts:274` | .18 type-alias/interface cases copy-pasted | **merged into A1** (both sites are among A1's 16; collapsed by `expectSingleModify`) |

## Applied fixes

1. **E1 — single-pass import scan** (production): `getImportDeclarations()` called once into `allDeclarations`; `boundNamesIn` precomputed once per declaration (`declarationBoundNames` pair array); Steps 1 and 2 both read from it. Pure data-flow refactor — same predicates, same branches, same spec-pinned evaluation order (REQ-TSD-01.24 / REQ-TSD-13.6 mutant-kill tests stayed green).
2. **A1+A2 — scaffolding collapse** (tests): added `expectSingleModify(seed, run, expectedContent)` and `expectNoOp(seed, run)` beside `expectCollisionReject`; 21 call sites collapsed. Tests with extra assertions beyond the skeleton (goldens, triangulation, hostile-`from` regex checks, shebang fallback, loop-based batteries) deliberately left hand-rolled. Test names, REQ mappings, and per-case failure clarity preserved; file shrank ~56 lines net.
3. **R1 — shared regex reuse** (fitness): `countDeclarationsFor` now counts `IMPORT_SPECIFIER_RE` matches (capture group = module specifier) over `stripComments(content)` — one specifier-matching implementation to maintain instead of two divergent ones. 31/31 fitness verdicts unchanged.

## Skipped (with reason — protocol: skip, don't debate)

- **S1**: REQ-TSD-03.11's Given is literally "a fresh run seeded with `addImport`'s **own prior output**" — the live derivation IS the scenario's evidence, not redundant state. Seeding from the golden would couple .11's fidelity to REQ-TSD-02.1's pin remaining in force and weaken the test's self-containment. Behaviour-fidelity guardrail wins over brevity.

## Out-of-lane notes from lenses (recorded, no action)

- reuse + simplification lenses independently identified the `boundNamesIn`/algorithm block as a structural near-copy of `react/ops.ts` and correctly self-suppressed: mirror-in-leaf is the ADR-01-ratified strategy (react byte-sealed, FIT-41 is the drift guard). Not a finding.

## Builder verification evidence

- Per-fix targeted runs green (Fix 2 additionally compared against pre-change behaviour via `git stash` diff of test outcomes — identical).
- Full suite post-all-fixes: 2134 / 0 / 4725 expect() / 192 files; `bun run typecheck` clean.
- Orchestrator independently re-ran both before sealing this report.

**Next**: `sdd-verify --mode=final` validates the simplified code (this gate is non-blocking; final verify is the safety net). Carried-forward audit items for final mode: W1 (FIT-41 cross-module bucket omits .14 — covered by S-001.3), W2 (apply-progress S-005 format drift), iter-4 note (`selfAliased` single-pin, deliberate).
