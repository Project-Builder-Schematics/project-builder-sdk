# North Star — stage-4b-testing-harness (Steward Foresight)

**Checkpoint**: foresight (post-design, pre-slice) · **Verdict**: `aligned-conditional` (one blocking design condition + 3 escalated conscience questions) · **Triage**: L · **Date**: 2026-07-10

> The durable statement of intent the RECKONING checkpoint will hold the delivered result against.
> Held against the ORIGINAL `problem_statement`, not the spec.

## This is what we're going to do (outcome terms)

Give schematic authors a way to **reach and test the factories they write**. Today two walls
block them: (1) `defineFactory` is unreachable from any installed `@pbuilder/sdk` — it lives
only in the internal `./core` kit barrel, never in `package.json#exports`; (2) even if reachable,
the one normative `ContractFake` is repo-internal (`test/support/`), so there is no supported
harness. After this change, along a single new public subpath `./testing`:

- **reachability** — `defineFactory` re-exported (value) from `./testing`; `runFactoryForTest`
  added; both importable BY PACKAGE NAME from an installed tarball. `./core` stays unmapped
  (production graduation deferred to Stage 6, owner ruling P1).
- **supported harness** — `runFactoryForTest(factory, input, seed?)` constructs a fresh
  `ContractFake`, spy-records every emit, runs the author's runner in-memory, and returns
  `{ tree (committed writes only), emitted (Batch[]), error (AuthoringError | unknown) }` — a
  result the author asserts on directly. The founding write-only-factory bug (buffered but never
  committed) is caught by asserting `result.tree` contains the file (ATH-02).
- **contained supply-chain** — the fake relocates to shipped `src/testing/` (single source,
  parity-by-identity shim), guarded fail-closed by six structural fitness functions so it never
  bleeds into `.`/`./commons`/`./conformance` bundles.
- **third audience of record** — ADR-0009 amended with a literal `author-testing` audience, own
  entry, 0.x semver-exempt.

## How it fits (architecture)

`src/testing/` joins the existing single library layer as a sibling facade (mirrors
`src/conformance/`, `src/dry-run/`). Two documented-boundary shifts lift the class to
`modifying`: ADR-0032 amends the ADR-0009 audience boundary; ADR-0034 moves a data-ownership
line (the normative fake goes test-owned/unshipped → src-owned/tarball-shipped). The single
architectural seam it crosses is the fake's ownership; containment is the fail-closed job of
FIT-08/10/17/07/04 + the dts negative-scan. Zero runtime dependencies preserved. The
installed-consumer-vantage e2e (ADR-0035: build→pack→install→import-by-name) is the only
mechanic that exercises the `exports` map from a real consumer's position.

## The outcome we're chasing (traced to the problem)

| Stated pain (problem_statement) | Design element | Outcome if executed perfectly |
|---|---|---|
| `defineFactory` unreachable from installed package | `./testing` value re-export + FIT-09 + TES-02/06 e2e | **Real, author-reachable** (import-by-name from tarball proven) |
| no supported test harness (ContractFake repo-internal) | `runFactoryForTest` + fake relocated to shipped `src/testing/` + FSP parity | **Real** — supported, single-source harness ships |
| "stage-4's typed options crystallize as outputs-without-outcome" without 4b | reachability + harness | **Reachability: served.** Testing of the typed/validated path: **PARTIAL — see condition C1** |
| (derived) shipping a fake enlarges supply-chain surface | 6 fail-closed containment guards | **Real** — proportionate hardening of the surface the remedy creates |

**Nothing designed serves no pain.** The six guards serve the derived supply-chain pain that
shipping the fake introduces — a consequence of the owner-chosen remedy (surface via `./testing`
rather than wire `./core`), not gold-plating. Proportionality itself is escalated as CQ3.

## The stage-4 conditional this change was committed to discharge

Stage-4's foresight verdict was `aligned-conditional`: its differentiator was "proven but not
yet author-reachable... conditional on 4b following." **4b's TES-06 e2e (pack→install→
import-by-name→run a factory) directly proves reachability from the installed vantage** — the
exact gap Stage-4 flagged. On the REACHABILITY axis, 4b discharges the Stage-4 conditional.

## The filed question (foresight) — and where the design stumbles

Executed perfectly, this design RESOLVES the two literal walls: authors reach `defineFactory`
and run a supported, in-memory, assertable harness. For a factory's BODY behaviour the test is
meaningfully assertable (not hollow): committed tree, emitted IR, error union all carry real
signal, and the founding bug is caught. **BUT there is one concrete, unaddressed interaction
between the harness and the very Stage-4 runner it exists to make testable:**

**Condition C1 (design-misalignment risk — route to `sdd-design` or owner ruling BEFORE slice):**
Stage-4's `defineFactory` is `defineFactory<O>(fn, options?)` with two tiers — bare
`defineFactory(fn)` runs purely in-memory (as today), but `defineFactory(fn, { packageDir })`
opts into **disk-discovered** `schema.json` reading + run-boundary input validation BEFORE
`als.run` (Stage-4 design §4.1 / ADR-0029: "disk-discovered schema; fail-closed"). 4b's design
models "the runner" as a pure in-memory function (`await factory(input, { client })`) and is
SILENT on this. Consequences the planner MUST decide:
  1. **Does `runFactoryForTest` support opted-in (`packageDir`) factories at all?** Its signature
     has no `packageDir` channel and the spec never mentions the option tier.
  2. **ATH-11 collision.** ATH-11 asserts the harness touches ZERO filesystem and that "seeding
     happens ONLY via the explicit `seed` record; there is no disk-backed fallback." An opted-in
     factory reads `schema.json` from disk during the run — contradicting that framing for any
     real typed factory. ATH-11's language needs scoping to the harness MACHINERY vs the
     factory-under-test, or the harness must define how it neutralizes/handles the disk read.
  3. **No affordance to TEST input validation** — the core teeth Stage-4 delivered. There is no
     ATH scenario for "given a schema-invalid input, my schematic rejects it." If validation
     testing is IN scope, 4b must add the affordance + scenario (and can turn the latent conflict
     into a tested feature: RBV rejection surfaced as `result.error`). If OUT of scope (Stage-4's
     own `typed-factory.e2e.test.ts` owns it), that must be an EXPLICIT documented limitation, not
     silence — otherwise the "test their factories" promise is quietly scoped to factory-body-only.

C1 does not invalidate the change's purpose — a bare-factory author gets a fully working harness
today, and reachability is genuinely delivered. But it is a correctness landmine (an author WILL
run a production opted-in factory through the harness) that must be resolved before build, not
discovered at reckoning.

## What reckoning will hold this against

1. `import { runFactoryForTest, defineFactory } from "@pbuilder/sdk/testing"` resolves from an
   installed tarball; `@pbuilder/sdk/core` stays unresolvable (TES-02/06, FIT-09).
2. A factory run through `runFactoryForTest` yields an assertable `{tree, emitted, error}`, and
   the write-only-factory founding bug is caught by a `result.tree` assertion (ATH-02).
3. **C1 is resolved and its resolution is delivered**: either the harness demonstrably supports
   opted-in typed factories (with ATH-11 scoped honestly + a validation-rejection scenario), OR a
   documented limitation states the harness tests factory bodies against a fresh fake and defers
   input-validation testing to the SDK's own gates.
4. The fake is reachable ONLY via `./testing` and absent from every production bundle (FIT-17).
5. Re-ask CQ1–CQ3 below with the delivered result in hand.

## Escalated conscience questions (human-only — the gate does not pass on these until answered)

- **CQ1 (usable):** An author's PRODUCTION `factory.ts` must import `defineFactory` from
  `@pbuilder/sdk/testing` (a subpath literally named "testing") until Stage 6 graduates `./core`.
  Is that ergonomics acceptable for 0.x, or does it mis-signal that `defineFactory` is test-only?
- **CQ2 (usable/significant — decides C1's scope):** Should authors be able to TEST their
  factory's input-validation (the core value Stage-4 added) through `runFactoryForTest` — assert
  "a schema-invalid input is rejected"? If yes, 4b must add the affordance; if no, that's an
  accepted limitation and "test your factory" is scoped to body-behaviour only. Only the owner can
  set this worth boundary.
- **CQ3 (significant):** Shipping the normative `ContractFake` inside the production npm tarball,
  guarded by six structural fitness functions, is a heavyweight remedy for "make a test helper
  importable." Is the permanent containment surface proportionate, or is it a signal that a
  separate `@pbuilder/testing` package (or bring-your-own-fake docs) delivers the same author
  outcome with less standing risk? (Owner already rejected wiring `./core`; this asks whether the
  ship-the-fake shape itself is the right long-term form or an accepted 0.x expedient.)

**Suspicion (labelled, not a verdict):** absent C1's resolution, this smells like it could ship a
green-tested harness that tests bare factory bodies while the typed/validated factories Stage-4
exists to enable remain awkward-or-untestable through it — outputs-without-the-full-outcome. I do
not assert it; I file it for the human and the planner to close before slice.
