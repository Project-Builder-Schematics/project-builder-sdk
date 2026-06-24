# Integration Gate #2 — l1-author-surface (after sub-change #2 `typed-options-and-read`)

**Verdict**: **PASS** · **Date**: 2026-06-24 · **build_mode**: next-only (STOP after gate)

## Summary
Sub-change #2 grows the program's VALUE half (typed options + read trichotomy) without regressing #1's spine. SEAM-01 (`create<S>`) keeps its exact signature shape; the read track widened the shared `EngineClient.read` PORT to `Promise<string | undefined>` (not-found→`undefined`, ADR-01) in-lane; #1's failure-half seams are untouched.

## Execution evidence (re-run firsthand by the gate verifier)
- `bunx tsc --noEmit` → exit **0**
- `bun test` (full program suite) → **188 pass / 0 fail**, 277 expect() calls, 31 files
- Union regression fence `bun test test/skeleton test/fake` → **92 pass / 0 fail**, 176 expect(), 14 files
- `bun test fit-01-commons-no-ast` → **4 pass / 0 fail**

## Seam table
| Seam | #2 role | Honored? | Evidence | Real / Regressed |
|---|---|---|---|---|
| SEAM-01 typed-options | produces (full derivation) | Yes — signature shape unchanged; generic narrows `options` type-level only; untyped overload preserved | `src/commons/index.ts`; `test/types/typed-create.test.ts`; `test/types/permissive-proof.ts` + `permissive-proof.guard.test.ts`; FIT-01 green | real |
| SEAM-02 directive buffer / dry-run | not touched | Yes — byte-identical to #1 | `test/dry-run/*` unchanged, pass | real, no regression |
| SEAM-03 commit/discard | not touched | Yes — byte-identical to #1 | `test/skeleton/commit-discard` + `test/fake/commit-discard` unchanged, pass | real, no regression |
| SEAM-04 error-attribution | not touched | Yes — byte-identical to #1 | `test/skeleton/error-attribution.test.ts` unchanged, pass | real, no regression |
| read-trichotomy (#2 new) | produces | Yes — content / `undefined` / `""`, strict branching, falsy-string mutant-killers | `test/fake/read-trichotomy`, `test/skeleton/read-trichotomy`, `read-your-own-write` | real |

## Regression fence
GREEN. #1's union suite stays at 92/0; SEAM-02/03/04 fence files + write-only happy path are byte-identical to committed #1 state (`git diff --quiet` confirmed) and pass unedited — the fence is genuine, not adjusted to absorb #2.

## Risks / forward notes for #3 (`error-and-commit-contract`)
- **`EngineClient.read` no longer throws on not-found** — it returns `undefined` (ADR-01). #3's error-attribution design must treat not-found as a return value, NOT an attributable error. Inject this into #3's explore/design.
- #2 is uncommitted (working tree only) — ensure the branch/commit captures exactly this verified state before/at archive.

## Next
archive `typed-options-and-read` (#2). next-only → STOP; ask the user before starting #3.
