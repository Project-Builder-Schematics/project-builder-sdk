# Outcome Verdict — bare-factory-migration (reckoning, pre-archive)

**Checkpoint**: reckoning · **Verdict**: `delivered` · **Steward**: sdd-steward · **Date**: 2026-07-15
**HEAD**: `1da2063` (incl. /simplify `9ee5dd8`) · **Merge-base**: `ebad6a4`

## 1. Our objective was THIS

Problem statement (triage): *"Every schematic author must wrap their factory in `defineFactory` —
ceremony encoding no decision, a forgettable failure point (missing/double-wrap → cryptic TypeError
under the future runner), scaling with schematic count."* Owner direction obs #2070: authors export
the bare typed `(input: Input) => void | Promise<void>` function; `defineFactory` becomes
runner/test-harness-internal, never author vocabulary.

North-star promise: delete the wrap from the author's vocabulary entirely; `runFactoryForTest`
(tests) + the future runner (production) become the ONLY things that wrap, through a single shared
seam; internal-only status made STRUCTURAL (FIT-08 narrowed + FIT-29 reachability guard), not
conventional.

## 2. Did we deliver it? Show me WHERE

Result→problem map — every stated pain resolved, with a pointable location:

| Stated pain / reason | Delivered? | WHERE (pointable evidence) |
|---|---|---|
| Wrap ceremony "encoding no decision" | ✅ removed from every author surface | `docs/quickstart.md:139` step 5 ships `export const run = (input: Input) => {…}` — no `defineFactory` import; README + `docs/dry-run.md` examples all bare; `src/testing/index.ts` imports `defineFactory` (line 11) but **never re-exports** it (independently grepped — the only barrel hits are JSDoc prose) |
| Forgettable failure point (missing / double-wrap → cryptic TypeError) | ✅ structurally eliminated | The author never wraps → cannot forget or double-wrap. `installed-consumer.e2e` proves `hasDefineFactory === false` on every resolved `./testing` export (REQ-TES-08); FIT-29 (`test/fitness/fit-29-sanctioned-definefactory-caller.test.ts`, present) + narrowed FIT-08 make internal-only status enforced, not conventional |
| Cost scales with schematic count | ✅ | Per-schematic ceremony is gone: N schematics × 0 wrap = 0 |
| "Migrate NOW, first — engine↔SDK wire assumes bare shape" | ✅ | Bare shape landed; single-wrap-seam parity proven NOW — `runFactoryForTest` delegates to the same `defineFactory` the runner will call (`src/testing/index.ts:124`), and `harness-wrap-parity.test.ts` (REQ-ATH-19: happy + double-fault, dialect-drain ordering) asserts the relocated wrap does not drift from the direct-`defineFactory` seam |

Execution backing (verify-report, final, Strict TDD): 1285 pass / 0 fail; 56/56 scenarios COMPLIANT
across all 5 domains; pre-pr code audit clean (0 gating findings); frozen `defineFactory` impl body
byte-identical to merge-base.

## 3. User journey — a NEW author, end-to-end

Following `docs/quickstart.md` from a cold start: install (§1) → `schema.json` (§3) →
`pbuilder-codegen .` generates `type Input` (§4) → **write the factory (§5): a bare
`export const run = (input: Input) => { create(...) }` — no `./testing` import, nothing to wrap** →
**test it (§6): `runFactoryForTest(run, {…})`, assert on `result.error` / `result.tree`** →
`bun test` green.

The author never encounters `defineFactory` at any step. This journey is not merely asserted — the
copy-runnable README/quickstart harness (REQ-TSD-01 / REQ-AOD-01) executes the documented code
**verbatim** and it passes, so the promised outcome is machine-proven end-to-end, not aspirational.
The outcome the person-who-was-hurting experiences: bare function in, passing typed test out, zero
ceremony.

## 4. Did we drift? (promise ↔ delivery)

- Delete `defineFactory` from author vocabulary → **delivered** (exports, docs, JSDoc, scaffold
  error strings all runtime-neutral / bare).
- Single wrap seam via `runFactoryForTest` delegating to `defineFactory` → **delivered**
  (`src/testing/index.ts:124`; untyped tier preserved by the `packageDir !== undefined` conditional).
- Structural enforcement (FIT-08 narrowed + FIT-29 reachability) → **delivered**.
- Honestly-named residual: `packageDir` relocates from the author's `defineFactory(fn,{packageDir})`
  to the `runFactoryForTest` options bag / runner invocation → **delivered exactly as the north-star
  named it** — the wrap is gone, `packageDir` moved and is optional, the shipped artefact is clean.

No promise↔delivery drift. Two registered followups reviewed and judged NON-gating for outcome:
- **#3 cosmetic comment-level tokens** — 4 `defineFactory` mentions remain in test-file *prose*
  (`harness-opted-in.test.ts`, `classify-transport.test.ts`) describing the migration itself. These
  are internal test comments, **not author-facing surfaces**; the promise ("author vocabulary /
  surfaces") is intact. Not drift.
- **#1 R-11 scratch-replica drift risk** — the fixture-path scratch replica skips
  `validateAtRunBoundary` / hardcodes the ceiling. Behaviour preservation is proven TODAY
  (git-clean regen); this is a future-divergence maintainability risk, not an unmet outcome.

## 5. Conscience questions — human-only judgments (usable? significant?)

Both reckoning-level human questions map onto the two conscience questions raised at foresight, which
the **owner already settled at foresight** (per north-star + orchestrator record). Per the steward
contract, these are CITED as resolved, not re-asked:

1. **Significance / timing** ("migrate NOW, first, before the runner"). Rests on the live
   `pbuilder-runner` + engine↔SDK-wire direction (obs #2070). → **Settled at foresight: owner
   confirmed the runner plan is live and "first" is still the plan.** Reckoning found nothing that
   reopens it — the DX win (ceremony removed) also stands on its own.
2. **Usability of the `packageDir` relocation** (does moving it from the definition to the
   `runFactoryForTest` call read as *ceremony removed* or *ceremony moved*?). → **Settled at
   foresight: owner accepted `packageDir`-at-harness as ceremony eliminated.** Delivery matches the
   accepted design; nothing new to escalate.

No NEW human judgment is required at reckoning: delivery matches the promise the owner already
validated forward-looking, and no drift surfaced that would reopen either question.

## Verdict

**delivered.** The shipped change solves the stated problem — authors write bare factories, the wrap
ceremony is gone from every author surface, `defineFactory` is unreachable as an author path
(structurally enforced), and the single-wrap-seam parity that makes the future runner safe is proven
now. The user journey materializes the outcome end-to-end (machine-proven via copy-runnable docs).
Both human-only meaning questions were pre-settled by the owner at foresight and remain valid. This
is not code that merely passes tests — it removes real per-schematic ceremony and a real
forgettable-failure mode. **Archive may proceed.**
