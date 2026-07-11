# Outcome Verdict — stage-4b-testing-harness (Steward Reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `DELIVERED`
(on every analyzable axis; two worth-confirmations escalated, both with a POSITIVE
suspicion) · **Triage**: L · **Date**: 2026-07-12

> Held against the ORIGINAL `problem_statement` (`openspec/problem-statement.md` +
> `triage.md`), not the spec. The North Star memo (`north-star.md`) is the promise; this is
> the reckoning against what shipped (`main..HEAD`, verified by running it).

## Our objective was THIS

From `triage.md`: *"Schematic authors cannot test their factories."* Two walls: (1)
`defineFactory` unreachable from any installed package; (2) no supported harness — the one
normative `ContractFake` is repo-internal. Without 4b, stage-4's typed options crystallize
as **outputs-without-outcome**.

## Did we deliver it? Show me WHERE — I pointed, and I ran it

I did not take the green suite on trust. I built, packed, and installed the package into a
scratch consumer and ran the author journey cold from the tarball vantage.

| North-star reckoning-hold | Where it lives | Verified |
|---|---|---|
| `import { runFactoryForTest, defineFactory } from "@pbuilder/sdk/testing"` resolves from an installed tarball; `@pbuilder/sdk/core` stays unresolvable | `package.json#exports./testing`; `test/e2e/installed-consumer.e2e.test.ts` REQ-TES-02.1/06.1 | **RAN — PASS.** Resolution matrix proven from a real `node_modules`: `./testing` carries `defineFactory`; `.`/`./commons`/`./conformance` do not; `./core` unresolvable. |
| A run yields assertable `{tree, emitted, error}`; the write-only founding bug is caught by a `result.tree` assertion | `src/testing/index.ts` `runFactoryForTest`; e2e REQ-TES-06.2 | **RAN — PASS.** Write-only factory commits to a golden tree through the *published* entry. |
| **C1 resolved and its resolution delivered** (opted-in typed factories) | `test/fake/harness-opted-in.test.ts` (ATH-11.2 + ATH-13.1/.2); spec V3 | **RAN — PASS.** Owner chose CQ2 = YES → the SUPPORT path, not a documented limitation. Schema-invalid input rejects all-or-nothing via `result.error` as an `AuthoringError`; schema-valid input runs normally; the factory's own declared `schema.json`/`packageDir` reads are scoped as observed-not-flagged, everything else fails closed. |
| The fake is reachable ONLY via `./testing`, absent from every production bundle | `test/fitness/fit-17-*` + `fit-18-*` | **RAN — PASS.** Dev-only bundle containment + single-source parity both green. |
| Positive testing-story docs (README + JSDoc) | `README.md` "Testing your factory"; `src/testing/index.ts` JSDoc | Present, runnable, two worked examples (happy path + `seed`), 0.x exemption stated, `./conformance` boundary drawn. `test/docs/*` green. |
| Revert README incremental-shipping qualifying-line (TSD-03, sequence-gated on stage-4 archive) | `README.md` diff | Delivered — the "shipping incrementally" note is removed; stage-4 has archived (confirmed by the opted-in slice's own gate). |

**No promise↔delivery drift.** Every element the foresight memo said reckoning would hold
this against is present and behaves as promised, proven from the consumer's own vantage.

## The foresight suspicion is REFUTED (not merely unraised)

Foresight filed a labelled suspicion: *absent C1's resolution, this could ship a green-tested
harness that tests bare factory bodies while the typed/validated factories Stage-4 exists to
enable remain awkward-or-untestable through it — outputs-without-the-full-outcome.*

That suspicion is now **disproven by execution**, not by paperwork. C1 was not scoped away
in silence — the owner ruled CQ2 = YES, and the delivery took the harder SUPPORT branch:
`harness-opted-in.test.ts` runs a real `packageDir`-opted-in Stage-4 factory through
`runFactoryForTest` and asserts BOTH that a schema-invalid input is rejected (as an
author-assertable `AuthoringError`) and that a valid one commits. The typed/validated path
Stage-4 exists to enable is testable through this harness. Stage-4's typed options are NO
LONGER outputs-without-outcome — the reachable, supported test surface that gives them
author-facing meaning now ships.

## Is it usable / significant? — the escalated human questions

I assert the problem is SOLVED on every axis a machine can judge. The remaining two are
worth-boundary/long-term-form judgments only the owner can set — and my suspicion on both is
POSITIVE (the thing works; the questions are about form and signaling, not about a gap).

- **CQ2 (was blocking C1): ANSWERED + HONORED.** Owner ruled YES (opted-in factories
  supported through the harness). Delivery honors it exactly (ATH-13). No longer open.

Still open for the owner's nod (neither is an `outcome-gap` — both are accepted-cost
confirmations, ADR-recorded, 0.x-exempt):

- **CQ1 (usable — ergonomics/signaling):** An author's PRODUCTION `factory.ts` imports
  `defineFactory` from a subpath literally named `./testing` until Stage 6 graduates `./core`.
  The delivery documents this openly (README + JSDoc + ADR-0033, 0.x-exempt). *Does the
  "testing" name mis-signal that `defineFactory` is test-only?* Works today; this is a
  naming-worth call, not a usability failure. Owner confirmation requested.
- **CQ3 (significant — proportionality of the standing surface):** The normative fake now
  ships inside the production npm tarball, guarded by structural fitness functions (FIT-08/
  10/17/18 + dts scan). Owner already rejected wiring `./core` and ratified ship-the-fake with
  containment (ADR-0034). *Is the permanent containment surface the right long-term form, or a
  separate `@pbuilder/testing` package / BYO-fake docs the better shape?* An accepted 0.x
  expedient by owner ruling; flagged for a deliberate long-term-form nod, not blocking.

## Verdict

`DELIVERED`. An external factory author now has a real, installable, supported way to test
the factory they write — reachability and harness both proven from a packed-tarball consumer
vantage, and the typed/opted-in path Stage-4 delivered is testable through it. This is not
shipped machinery authors can't use: I used it. No `outcome-gap`. CQ1 and CQ3 are carried to
the owner as worth-confirmations (positive suspicion), CQ2 already answered and honored.
