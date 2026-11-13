# ADR-0048: A Third Golden Idiom — Run-Level Transcript Capture, Single Path, No Self-Heal

- Status: Accepted (2026-07-14, promoted at author-emulation-e2e-scaffold archive)
- Date: 2026-07-13
- Deciders: Daniel (Hyperxq)
- Origin: change `author-emulation-e2e-scaffold` (design §4.5). Closes the idiom-drift
  concern raised in council review (explore Approach 2).
- Builds on: the two existing golden idioms (`test/golden-ir/` in-source `Directive`
  literals; `test/dialects/typescript/golden/` byte-print files); ADR-0049 (canonical
  serialization, the writer/verifier contract this idiom depends on).

## Context

Two golden idioms exist: `test/golden-ir/` (in-source `Directive` literals, a
single-directive unit) and `test/dialects/typescript/golden/` (byte-exact single-file
print). Neither captures a whole realistic author RUN. A third idiom risked reading
as idiom drift; a self-regenerating corpus would be a tautology (asserting the code
against its own output).

## Decision

Add a physically separate third idiom at `test/e2e/author-emulation/corpus/`,
capturing the run-level `Batch[]` via `runFactoryForTest` (R-A) — a genuinely
different unit (whole-run, lowered-directive sequence, not a single directive or a
single file). Exactly one capture module; the corpus writer, the report renderer,
and the e2e suite all import it (ITC-02/FIT-25). No test-reachable module writes the
corpus directory (FIT-27 write-boundary partition); regeneration lives only in
`scripts/regen-corpus.ts`. Tests READ and compare; drift fails loud; there is no
self-heal (GCC-05).

## Consequences

- (+) Reuses the normative recording harness; matches the `test/support/` convention;
  adds the run-level unit the other two idioms lack; drift is a hard failure.
- (−) Three idioms now coexist (mitigated by physical separation + the corpus-root
  README); corpus updates are a deliberate, out-of-band step — intended friction, not
  an oversight.
- (+) Reusable infrastructure for future per-family e2e changes (the fitness guards,
  support cluster, and regen script are shared, not re-derived per family).

## Alternatives Considered

- **Unify all idioms into one harness** — REJECTED: retrofits archived stages' tests;
  scope creep beyond an L change (explore Approach 2).
- **In-test `--update` flag** — REJECTED: the exact tautology this ADR prevents (the
  corpus would regenerate against its own current output instead of asserting drift).
- **Wrap `makeSpyClient` instead of `runFactoryForTest`** — REJECTED: no `tree`/`error`
  visibility, breaks GCC-09/M-21's rejection-triple requirement; superseded by R-A.
