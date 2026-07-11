# ADR-0033: Third audience `author-testing` (ADR-0009 amendment)

- Status: Proposed
- Date: 2026-07-11
- Change: `stage-4b-testing-harness` (S-005)
- Amends: ADR-0009 (two audiences — author/contributor)

## Context

`defineFactory` and the normative fake are unreachable from an installed `@pbuilder/sdk`
package. ADR-0009 defines exactly two audiences (author/contributor); authors need a
supported way to test their own factory without repealing the kit boundary that ADR-0009
protects.

## Decision

Amend ADR-0009 with a literal THIRD audience, `author-testing`, surfaced through its OWN
subpath `./testing` (never folded into `./commons`), shipping **0.x, semver-exempt**
(mirroring the kit) until real use validates the result shape. `./core` stays unmapped;
production graduation is deferred to Stage 6. The two-audience author/contributor split
(ADR-0009) is EXTENDED by this amendment — never rewritten or repealed.

## Consequences

- (+) Authors get a reachable, supported harness for their own factory code; result-shape
  iteration stays cheap under 0.x.
- (−) A third published entry (`./testing`) enlarges the package's supply-chain surface
  (mitigated by FIT-17's dev-only bundle containment, ADR-0034).
- (→) Enables the installed-consumer e2e (ADR-0036) as the outcome-proof that the harness is
  reachable from a real installed package, not just the repo's own `src/`.

## Alternatives Considered

- **`runFactoryForTest` in `./commons`** — rejected: mixes a test harness into the
  author-RUNTIME surface and drags the normative fake into the commons bundle (blows FIT-03's
  bundle budget and the containment guarantees ADR-0034 exists to provide).
- **Wiring `./core` into `package.json#exports`** — rejected: repeals ADR-0009's boundary and
  semver-locks the whole kit prematurely, before the first real dialect has validated it.
