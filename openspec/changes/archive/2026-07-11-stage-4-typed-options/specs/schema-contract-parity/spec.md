# Schema Contract Parity Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-4-typed-options`

## Purpose

The objectives-plan's promised differentiator ("one source, parity enforced", O2) does not
exist today — nothing keeps `schema.json` ↔ the derived TypeScript type ↔ CLI-prompt
sufficiency in sync. This capability makes both drift dimensions build-time fitness
contracts, not conventions: parity (schema ↔ generated type) and sufficiency (schema ↔
what a CLI needs to render a prompt). New FIT numbers start at FIT-12 (FIT-11 is Stage 2's).

## Requirements

### REQ-SCP-01: Parity Fitness Gate (FIT-12)

A build/CI-time fitness check MUST fail when a factory's checked-in generated type is stale
relative to its `schema.json`. The mechanism MUST be a CONTENT-DIGEST comparison, not a
compiled-output text diff: at generation time the bin embeds a digest (e.g. SHA-256) of the
exact `schema.json` bytes it consumed into the generated output; the gate recomputes
`schema.json`'s digest and compares it against the embedded one — ANY difference fails,
independent of whether the change is TypeScript-type-visible. This is what makes the gate
genuinely mutation-resistant to the FIT-04 staleness-trap failure mode (lessons-learned
#648): a label/description-only schema edit produces byte-identical generated TYPE output,
and FIT-04's own `normalizeDeclarations` strips comments — so an output-text diff cannot
catch this class of drift, but a digest of the SOURCE `schema.json` can. The fitness check
MUST regenerate to a SCRATCH/temporary location and compare digests there — it MUST NEVER
mutate the committed generated artifact as a side effect of merely checking it; only an
explicit author-invoked bin run (REQ-TFO-01) updates the committed file.

> RED posture: must-fail-first. No parity/drift check exists today; FIT-12 must fail red
> against a deliberately staled fixture before the check exists, and pass green once it does.

#### Scenario REQ-SCP-01.1: Drift breaks the build (negative, load-bearing, author-framed)

- GIVEN an author edits `schema.json` (changing a property's declared type) and does NOT
  re-run the codegen bin, then runs the project's build
- WHEN the parity fitness check runs as part of that build
- THEN it FAILS, naming the specific factory package whose generated type's embedded digest
  no longer matches its `schema.json`'s recomputed digest

#### Scenario REQ-SCP-01.2: Regenerating restores green (positive, author-framed)

- GIVEN the drifted `schema.json` from REQ-SCP-01.1
- WHEN the author re-runs the bin to regenerate (updating the committed digest) and runs
  the build again
- THEN the parity fitness check PASSES

#### Scenario REQ-SCP-01.3: Content-only drift is still caught (mutation-resistance, now satisfiable via digest)

- GIVEN a `schema.json` change that alters only a sufficiency field (e.g. a property's
  `label`) without changing any TypeScript-visible type shape, committed without
  regenerating
- WHEN the parity fitness check runs
- THEN it FAILS — the recomputed `schema.json` digest differs from the embedded one,
  proving the gate compares the SOURCE schema content itself, not the compiled type shape
  (this replaces the V1 assertion that failed against a compiled-output diff, which is
  unsatisfiable: a label-only change produces byte-identical generated type text)

#### Scenario REQ-SCP-01.4: The check is non-destructive (QA-M5)

- GIVEN a deliberately staled fixture (a committed generated file whose embedded digest
  does not match its `schema.json`)
- WHEN the fitness check runs in read-only/CI mode
- THEN it FAILS, AND the committed generated file on disk is byte-identical before and
  after the check run — the check never silently "fixes" what it is verifying, and the
  staled fixture stays red until an author explicitly regenerates

### REQ-SCP-02: Schema-Sufficiency Fitness Gate (FIT-13)

For every property in a `schema.json` consumed by a factory, the sufficiency fitness check
MUST hard-fail if: the property is missing `type`; the property is missing a `label`/
`title`; an enum-typed property is missing `choices`; the property's `type` value is not
one of the schema's recognized primitive/enum kinds (an unrecognized or nonsensical `type`
string); or the property's key is `__proto__`, `constructor`, or `prototype`. It MUST NOT
fail for a property missing `default`, `required`, or `description` (advisory only).

#### Scenario REQ-SCP-02.1: Missing type fails, named

- GIVEN a `schema.json` property with no `type` field
- WHEN the sufficiency fitness check runs
- THEN it FAILS, naming the specific deficient property

#### Scenario REQ-SCP-02.2: Missing label/title fails, named (TW-F8, split from a compound scenario)

- GIVEN a `schema.json` property with a `type` but no `label`/`title`
- WHEN the sufficiency fitness check runs
- THEN it FAILS, naming the specific deficient property

#### Scenario REQ-SCP-02.3: Enum missing choices fails, named

- GIVEN an enum-typed property with no `choices` field
- WHEN the sufficiency fitness check runs
- THEN it FAILS, naming the property

#### Scenario REQ-SCP-02.4: Unrecognized/nonsensical type value fails, named (BA-6)

- GIVEN a property declaring `type: "flarb"` (not one of the schema's recognized kinds)
- WHEN the sufficiency fitness check runs
- THEN it FAILS, naming the property and the unrecognized `type` value

#### Scenario REQ-SCP-02.5: __proto__/constructor/prototype as a property key fails, named (SEC-B2)

- GIVEN a `schema.json` declaring a property whose key is `__proto__` (or, in separate
  fixtures, `constructor` or `prototype`)
- WHEN the sufficiency fitness check runs
- THEN it FAILS, naming the offending key — a schema MUST NOT declare these names as input
  properties at all

#### Scenario REQ-SCP-02.6: Advisory-only fields do not fail (positive)

- GIVEN a property that has `type` and `label` but omits `default`, `required`, and `description`
- WHEN the sufficiency fitness check runs
- THEN it PASSES

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api-stability (parity/sufficiency contract shape) | REQ-SCP-01, REQ-SCP-02 | Yes |

## Next Step

V2 incorporates blind spec-council feedback: REQ-SCP-01 now uses a content-digest mechanism
(resolving the QA-B1 unsatisfiable-scenario blocker) with an explicit non-destructive-check
clause; REQ-SCP-02 gains hard-fail coverage for prototype-pollution-shaped keys and
nonsensical `type` values, and its compound scenario is split per failure mode.
Surface to human for review.
