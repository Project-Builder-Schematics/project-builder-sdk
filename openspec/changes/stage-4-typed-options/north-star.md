# North Star — stage-4-typed-options (Steward Foresight)

**Checkpoint**: foresight (post-design, pre-slice) · **Verdict**: `aligned` (conditional — see conscience questions) · **Triage**: L · **Date**: 2026-07-06

> The durable statement of intent the RECKONING checkpoint will hold the delivered result against.
> Held against the ORIGINAL `problem_statement`, not the spec.

## This is what we're going to do (outcome terms)

Give `schema.json` **teeth** as a schematic's input contract. Today it is a decorative
file: `defineFactory<O>` takes `O` as a bare hand-supplied generic and runs `fn(o)` with
zero validation, and nothing ties `schema.json` to the factory's assumed input type or to
CLI-prompt sufficiency (three-way drift). After this change, along three planes that never
cross:

- **compile-time** — a shipped codegen bin (`pbuilder-codegen`) derives `type Input` from
  `schema.json`; the author writes `defineFactory<Input>`. `schema.json` stays the single
  hand-authored source.
- **build-time** — fitness gates make drift a BUILD FAILURE: FIT-12 (schema↔type digest
  parity), FIT-13 (schema sufficiency: type/label/enum hard-fail so the Go CLI can derive
  prompts), FIT-14/15/16 (surface + dependency-direction + always-on reserved-name scan).
- **run-time** — `defineFactory` validates the resolved input against the on-disk
  `schema.json` pre-`als.run`, fail-closed, no raw-value echo; reserved lifecycle names
  (`pre-execute`/`post-execute`) are rejected from module structure.

## How it fits (architecture)

A new runtime-side `src/core/schema/` cluster (parse/validate/sufficiency/digest/discovery)
behind the existing IR-seam; the codegen bin lives **outside** `src/` (bin→core arrow only,
FIT-15) and ships as the SDK's first executable distribution primitive (`package.json#bin`).
The one new seam is the run boundary in `defineFactory` — upstream of, and distinct from, the
emit seam the engine judges. That upstream placement is a SCOPING amendment to ADR-0018
(author-input-contract conformance is SDK-owned; wire judgments stay engine-owned), recorded
as ADR-0030. Zero runtime dependencies preserved.

## The outcome we're chasing (traced to the problem)

| Stated pain (problem_statement) | Design element | Reality at stage end |
|---|---|---|
| `schema.json` has no teeth | run-boundary validation + FIT-12/13 | **Real, in-repo** |
| bare hand-supplied `defineFactory<O>` generic | codegen bin → `type Input` | **Real** (bin ships) |
| nothing validates resolved inputs at the run boundary | fail-closed pre-`als.run` RBV | **Real** (rejection ships; `reason` string gated on Stage-2) |
| three-way drift (schema ↔ type ↔ prompts) | FIT-12 (type leg) + FIT-13 (prompt-sufficiency leg) | **Real, as contract** — SDK guarantees sufficiency; Go CLI renders |
| differentiator "one source, parity enforced" absent | the whole change | **Exists + proven in-repo e2e** — NOT reachable from an installed package (see gap) |
| transferred ownership: reserved names, zero coverage | RLN-01/02/03 + FIT-16 | **Real** (schematic pair; `add`/`remove` documented, deferred to L2) |
| pin the mechanism pre-v1 (semver-lock) — the actual "why now" | D4 = codegen bin, ratified | **Real** — the primary outcome |

**Nothing designed serves no pain**; the rev-2 security surface (emitter escaping, canary
no-echo, proto-pollution, write-containment) is proportionate hardening of the genuinely-new
supply-chain surface the bin introduces, not gold-plating.

**No shorter path to the SAME outcome**: the simpler D4 path (hand-supplied `O`, path a) was
considered and does NOT close the drift — no single source, no parity. The codegen bin is the
minimum mechanism that delivers "one source, parity enforced." Affirmed.

## The filed question (foresight)

Executed perfectly, this design RESOLVES the stated pain **in-repo**: schema.json has teeth,
drift is a contract, the mechanism is pinned, reserved names are covered. The residual is that
the differentiator is **proven but not yet author-reachable** — `defineFactory` is exported
only through the `./core` barrel, which is NOT in `package.json#exports`; an installed-package
author can run the bin but cannot import `defineFactory`. That last-mile wiring was
owner-ratified OUT of scope, into `stage-4b-testing-harness`. Hence the alignment is
**conditional on 4b following** — see conscience questions.

## What reckoning will hold this against

At pre-archive reckoning, demand: (1) the in-repo e2e proves a typed factory end-to-end
against the fake (FPS-04, retires CQ-2); (2) editing `schema.json` without regenerating breaks
the build and regenerating restores green (FIT-12 both directions); (3) sufficiency hard-fails a
property missing type/label/enum; (4) a schema-violating input is rejected pre-`als.run` with no
raw-value echo, asserted at the SITE; (5) a `pre-execute`/`post-execute` module is rejected. And
re-ask the human conscience questions below with the delivered result in hand.
