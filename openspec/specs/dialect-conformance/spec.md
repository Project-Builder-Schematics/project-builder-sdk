# Dialect Conformance Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-11 — V4; final-loop deltas ratified)
**Change**: `stage-5-first-dialect`

## Purpose

Real bodies for `testDialect`/`testOpPack` (ADR-0012) run against the TypeScript dialect —
the CORE conformance subset ratified by the owner: byte-exact round-trip, single-op fidelity
+ unchanged-elsewhere, coalescing-to-one-modify, seam-serializability, and
planted-violation-fails (including a serializability violation instance).
`DialectFixture`'s shape in `src/conformance/index.ts` is UNCHANGED. `OpPackFixture` gains
EXACTLY ONE additive, REQUIRED field — `exercises: readonly OpExercise[]` (with a new exported
`OpExercise` type) — the op-invocation recipe the generic kit needs to apply each op on a
seeded target: without it `testOpPack` cannot exercise the pack and its per-op assertions
(REQ-DC-02..04) would be untestable theatre. No other fixture field changes; the bodies are
what this change fills in.

## Scope Note (non-normative, this change)

The main spec's Purpose still reads "adversarial samples, the leaf rule, and the
real-base-dialect rule are OUT OF SCOPE, tracked as committed-next" (`stage-5b-dialect-breadth`
— this change). REQ-DC-06/07/08 below discharge that commitment; `sdd-archive` should refresh
the Purpose prose when this delta merges into the main spec (no Purpose-section delta mechanism
exists in this project's ADDED/MODIFIED/REMOVED convention — Requirements only).

## Requirements

### REQ-DC-01: Byte-exact round-trip fidelity

`testDialect(fixture)` MUST assert, for every sample in `fixture.samples`, that
`print(parse(sample)) === sample` BYTE-EXACT — NOT AST-equal (AST-equal hides
whitespace/comment loss).

#### Scenario REQ-DC-01.1: no-op round-trip is byte-exact

- GIVEN a `DialectFixture` with representative TS samples (incl. comments and unusual
  whitespace)
- WHEN `testDialect` runs
- THEN every sample's `print(parse(sample))` is string-identical to the original

### REQ-DC-02: Single-op fidelity + unchanged-elsewhere

`testOpPack(fixture)` MUST assert, for each op the fixture exercises, that the op's intended
effect is present in the printed output AND every OTHER region of the source is byte-stable
(catches over-broad mutations). The op-pack MUST be exercised against `fixture.baseDialect`,
a REAL dialect instance — never a mock (ADR-0012).

The fixture supplies these exercises via the REQUIRED `OpPackFixture.exercises` array. Each
exercise declares a `seed` (initial file content), an op `chain` (named ops from the pack
and/or the universal `.raw`), and the BYTE-EXACT `expect`ed printed content of the resulting
coalesced `modify` — a FULL-output comparison, never a substring, so a single assertion proves
BOTH the op's intended effect AND that every other region is byte-stable. `exercises` is
REQUIRED at the type level: a fixture omitting it does not compile, so the kit can never
silently skip its per-op assertions.

#### Scenario REQ-DC-02.1: addImport changes only the import region

- GIVEN a multi-statement TS sample and `addImport` applied via `testOpPack`
- WHEN the printed output is diffed against the original
- THEN only the import-list region differs; every other line is byte-identical

### REQ-DC-03: Coalescing to ONE modify (triangulated, content-verified)

`testDialect`/`testOpPack` MUST assert that a chain of ≥2 DISTINGUISHABLE ops (never N=1,
never a count-only assertion) coalesces to exactly one `modify` directive whose content
reflects ALL ops in the chain.

#### Scenario REQ-DC-03.1: two distinguishable ops, one modify, content-verified

- GIVEN a chain of `addImport` + `.raw()` (2 distinguishable ops) run through `testOpPack`
- WHEN the emitted batch is inspected
- THEN exactly one `modify` directive exists AND its content contains BOTH ops' effects —
  not merely `instructions.length === 1`

### REQ-DC-04: Seam-serializability (security core assertion)

`testDialect`/`testOpPack` MUST assert that only serializable bytes cross the seam:
`JSON.parse(JSON.stringify(directive))` deep-equals the directive for every op exercised
(REQ-FIT-05 precedent, extended to the coalesced path). A planted `.raw()` op that attempts
to smuggle a closure or a live AST node reference onto directive content MUST cause the
conformance suite to FAIL LOUDLY — a MANDATORY negative fixture, not optional. **Caveat
(mirrored from `foundations-skeleton` REQ-STD-01)**: passing this suite is NOT a safety
attestation — it proves the seam stays serializable, not that a dialect's `.raw()` code is
safe to execute; "conformance ≠ safety" holds for the kit itself, not only for SECURITY.md's
prose.

#### Scenario REQ-DC-04.1: planted closure-smuggling .raw fails the suite

- GIVEN a deliberately malformed op that attaches a closure reference to what would become
  directive content
- WHEN `testOpPack` runs against it
- THEN the suite FAILS — proving the assertion is live, not a no-op

#### Scenario REQ-DC-04.2: planted live-AST-node smuggling .raw fails the suite (distinct failure mode)

- GIVEN a SECOND deliberately malformed op — distinct from REQ-DC-04.1's closure — that
  attaches a LIVE ts-morph `Node` reference (with circular parent pointers) to what would
  become directive content
- WHEN `testOpPack` runs against it
- THEN the suite FAILS — via a DISTINCT failure mode from REQ-DC-04.1: `JSON.stringify`
  THROWS on the circular structure (vs. a closure silently dropping to `{}`/`undefined`) —
  both smuggling modes MUST be caught, not just one

### REQ-DC-05: Planted-violation-fails suite (incl. a serializability instance)

The conformance kit MUST ship a suite of PLANTED violations — deliberately broken
dialects/op-packs — one per core assertion (REQ-DC-01..04), each proving that
`testDialect`/`testOpPack` FAILS RED against it. REQ-DC-04.1's closure-smuggling fixture IS
the mandated serializability violation instance — it MUST NOT be omitted from the
planted-violation suite. Every planted fixture is wired via an expect-throw/expect-fail
wrapper — quarantined, never part of the green suite (mirrors `modify-coalescing`
REQ-MC-04.1's characterization-guard wording).

#### Scenario REQ-DC-05.1: every core assertion has a planted red-proof

- GIVEN the planted-violation fixture suite
- WHEN each fixture is run through the conformance kit
- THEN each one fails RED against its corresponding assertion (round-trip, single-op
  fidelity, coalescing, serializability)

#### Scenario REQ-DC-05.2: a planted read-boundary-split violation fails RED

- GIVEN a deliberately broken dialect/op-pack that emits ONE `modify` directive where the
  read-boundary split contract (`modify-coalescing` REQ-MC-02) demands TWO — i.e. it silently
  coalesces across a mid-chain read instead of splitting
- WHEN `testDialect`/`testOpPack` runs against it
- THEN the suite FAILS RED — proving the split assertion is live in the conformance kit, not
  merely inherited by name from `modify-coalescing`

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

## Theatre Criteria (explicitly forbidden — QA mandate)

The following are NOT acceptable satisfactions of REQ-DC-01..05 and MUST NOT appear in the
implementation: N=1 coalescing assertions; count-without-content assertions; a mock AST
anywhere in the suite; omission of the read-boundary split case from the coalescing proof;
a `.raw()` fixture that is positive-only (no smuggling red-proof).

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — adversarial-sample + real-dialect enforcement closes conformance-theatre gaps | REQ-DC-06, REQ-DC-08 | Yes |
