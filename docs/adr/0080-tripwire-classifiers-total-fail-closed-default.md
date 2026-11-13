# ADR-0080: Tripwire Classifiers Are Total With a Fail-Closed Default

**Status**: Accepted (scope corrected — see the note below) · **Date**: 2026-07-29 · **Change**: `runner-tripwire-invariants`

> **Scope correction (2026-08-05)**: "Would have prevented every Constraint-4 finding in both
> judging rounds" is retracted — a third round found more, and the enumerator/classifier split
> cannot detect a construct the ENUMERATOR never reaches (tagged templates were such a construct
> for two rounds). The split's real property is narrower and still worth having: it detects a
> classifier mutation that routes an ALREADY-ENUMERATED node to a pass path. Totality is relative
> to the enumerator's own closed union, never absolute. See ADR-0079's Amendment and
> `docs/runner-integrity-invariants.md#known-gaps`.

## Context

`classifySpecifier` is total by construction and has produced zero findings across two judging
rounds; `denyScan` was not, and produced every Constraint-4 finding in both. The difference is a
class property, not a property of either guard, and nothing previously prevented the next tripwire
from being written in the losing shape.

## Decision

Every tripwire classifier in this repo is total over a closed input union with the unrecognised
branch yielding a violation. Totality is proven structurally by a paired **enumerator/classifier**
split — `enumerateCapabilitySurface` (what is present) and `classifySurfaceNode` (what is admitted)
— with `FIT-CAP-TOTALITY` asserting exact structural equality of classified-node count and
present-node count, checked against an INDEPENDENTLY implemented raw count, never a threshold.
Exclusions from the surface are *claims that a node cannot yield a capability*, each named and
red-proven; they are never pass paths.

## Consequences

- Would have prevented every Constraint-4 finding in both judging rounds; a new node kind fails
  the build loudly rather than passing silently.
- Cost: two functions to keep in step, and a genuinely new construct fails the build until the
  guard learns it — deliberate friction on exactly the event that should stop a reviewer.
- Cost: exclusions are a soft spot by construction — widening one is the cheapest way to
  reintroduce default-pass. Each carries its own red-proof for that reason (`FIT-CAP-TOTALITY`'s
  own mutation, plus per-table widening red-proofs for `ADMITTED_GLOBALS` and
  `ADMITTED_MEMBER_PATHS`).

## Alternatives Considered

- **Totality as a code-review convention**: rejected — prose exhaustiveness claims are precisely
  what failed twice.
- **Single function returning `Disposition | undefined`**: rejected — the count comparison becomes
  self-referential, so the mutation that routes an unrecognised node to a pass path cannot be
  detected by the fitness function it is supposed to fail.
