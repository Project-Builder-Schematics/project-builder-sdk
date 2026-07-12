# Delta for dialect-conformance

**Spec version**: V5
**Draft revision**: V2 (no content change — carried forward unmodified from V1)
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-5b-dialect-breadth`

## Scope Note (non-normative, this change)

The main spec's Purpose still reads "adversarial samples, the leaf rule, and the
real-base-dialect rule are OUT OF SCOPE, tracked as committed-next" (`stage-5b-dialect-breadth`
— this change). REQ-DC-06/07/08 below discharge that commitment; `sdd-archive` should refresh
the Purpose prose when this delta merges into the main spec (no Purpose-section delta mechanism
exists in this project's ADDED/MODIFIED/REMOVED convention — Requirements only).

## ADDED Requirements

### REQ-DC-06: Mandatory adversarial samples — contributor cannot opt out

The conformance kit MUST inject SIX mandatory adversarial samples — empty file, comment-only
file, a 4 MiB serialized-boundary sample (REQ-TSD-03.7 precedent), CRLF, a UTF-8 BOM, and a
duplicate-target case — into EVERY `testDialect`/`testOpPack` run, regardless of what samples
the contributor's own fixture supplies. The contributor MUST NOT be able to opt out of or
override this injection — the six samples are ADDITIVE to, never a replacement for, the
fixture's own `samples`/`exercises`.

#### Scenario REQ-DC-06.1: injected samples run even when the fixture supplies none of them

- GIVEN a minimal fixture whose own `samples` array contains none of the six adversarial shapes
- WHEN `testDialect` runs
- THEN all six mandatory samples are STILL exercised (test-note: a spy/count on the underlying
  assertions proves six additional cases ran beyond the fixture's own)

#### Scenario REQ-DC-06.2: a fixture cannot suppress injection

- GIVEN a fixture that attempts to configure away the injected samples
- WHEN the fixture type is inspected
- THEN it has no field capable of disabling injection — a compile-level guarantee, not merely
  a runtime default

### REQ-DC-07: Leaf rule — no cross-dialect import, commons pulls no AST library

The conformance kit MUST assert that a dialect/op-pack under test imports NOTHING from another
dialect's package, and that `@pbuilder/sdk/commons` imports NOTHING from any AST library
(ts-morph or otherwise) — the leaf-isolation guarantee FIT-01 already proves structurally for
`src/commons/**`, restated here as a conformance-kit-level check any THIRD-PARTY dialect can
self-run without access to this repo's own fitness-function source.

**Design flag**: the kit's in-memory run vehicle (ADR-0012 amendment) cannot perform a full
static import-graph analysis the way a source-tree fitness function can. This REQ pins the
RUNTIME-OBSERVABLE guarantee only; design decides the verification mechanism — a separate
static entry point the kit ships alongside the runtime assertions, or a documented limit that
this rule is proven for the SDK's own shipped dialect (via FIT-01) and only DOCUMENTED, not
runtime-enforced, for third-party dialects. Either resolution satisfies this REQ; the scenario
below is written at the observable-outcome level so it holds under both.

#### Scenario REQ-DC-07.1: the shipped TypeScript dialect passes the leaf check

- GIVEN the TypeScript dialect run through the conformance kit's leaf rule (whichever mechanism
  design selects)
- WHEN it executes
- THEN it reports no cross-dialect import and no AST-library import from `commons` — mirrors
  FIT-01's existing structural finding, now surfaced through the conformance kit itself

### REQ-DC-08: Real-base-dialect rule — extended to `testDialect`

REQ-DC-02 already requires `testOpPack` to exercise ops against `fixture.baseDialect`, a REAL
dialect instance, never a mock. This REQ extends the SAME guarantee to `testDialect`: the kit
MUST verify the fixture's `parse`/`print` pair is NOT a stub/mock implementation before running
the round-trip assertions — closing the gap where a fixture author could pass trivial identity
functions and still pass REQ-DC-01's round-trip check vacuously.

**Design flag**: the exact verification mechanism (a type-level brand distinguishing a real
dialect's AST from a bare `unknown`, or a runtime probe exercising a known real-dialect
behaviour) is a design decision, mirroring REQ-DC-07's design flag above.

#### Scenario REQ-DC-08.1: a vacuous identity-function fixture is rejected

- GIVEN a `DialectFixture` whose `parse`/`print` are both the identity function (a deliberately
  trivial non-real dialect)
- WHEN `testDialect` runs
- THEN it FAILS — the real-base-dialect check catches it before the round-trip assertion could
  vacuously pass

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — adversarial-sample + real-dialect enforcement closes conformance-theatre gaps | REQ-DC-06, REQ-DC-08 | Yes |
