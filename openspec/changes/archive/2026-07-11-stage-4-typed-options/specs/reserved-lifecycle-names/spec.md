# Reserved Lifecycle Names Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-4-typed-options`

## Purpose

Pre-handoff, the engine caught `pre-execute`/`post-execute` collisions at the wire;
post-handoff (2026-07-06) this is entirely SDK-owned with ZERO existing coverage —
confirmed by exploration: zero occurrences anywhere in `src/` or `test/` outside prose. An
author's naming mistake today would surface, if at all, as a confusing wire-time failure
far from its cause. This capability closes that gap for the SCHEMATIC-level pair only. The
COLLECTION-level pair (`add`/`remove`) is explicitly out of scope (registered for L2) and
REQ-RLN-03 pins that boundary so it is never silently conflated — `remove` already collides
lexically with a shipped author verb (`src/commons/index.ts:163`), and the two namespaces
must stay disjoint.

## Requirements

### REQ-RLN-01: Schematic-Level Reserved Names, Enforced From Module Structure

**Status: partially design-gated.** The reservation of `pre-execute`/`post-execute` and the
enforcement OBLIGATION are stable now (Scenarios .2–.4 are buildable immediately). The
EXACT declaration mechanism/shape (Scenario .1) cannot be RED-driven until `sdd-design`'s
ADR pins the module-structure shape — candidates: a string-keyed hooks object export
(e.g. `export const hooks = {"pre-execute": fn}`) or a filename convention (e.g. a sibling
`pre-execute.ts`). A bare camelCase export (`preExecute`) is explicitly EXCLUDED as a
candidate shape because it breaks the kebab-case token's identity.

`pre-execute` and `post-execute` MUST be reserved as schematic-level (factory-module)
lifecycle names. Enforcement MUST resolve these names from the factory package's OWN
MODULE STRUCTURE (its exports or file layout, per design) — enforcement MUST NEVER resolve
reserved-name status from resolved run-time inputs or from `schema.json` field names. (A
resolved-input key literally named `pre-execute` is a separate concern, covered by
REQ-RBV-01.5 — this REQ governs the factory module's own declared structure.)

**Kebab-case rationale (pinned, TW-F3):** the tokens stay kebab-case, not
`preExecute`/`postExecute`-cased to match this repo's internal "run"-verb camelCase
convention, because they are a CROSS-REPO CONTRACT inherited verbatim from the engine
handoff (2026-07-06) — the Go CLI and any other consumer of the handoff's naming already
expect these exact kebab-case strings; renaming them to fit local convention would break
that inherited contract for no local benefit.

#### Scenario REQ-RLN-01.1: Factory module declaring a reserved name is rejected (design-gated)

- GIVEN a factory package that declares an export (or file, per design's chosen shape) named `pre-execute`
- WHEN the package is validated
- THEN it is rejected, naming `pre-execute` as a reserved schematic-level name

#### Scenario REQ-RLN-01.2: Normal factory (no reserved names) is accepted (QA-M3)

- GIVEN a factory package that declares no export/file matching either reserved name
- WHEN the package is validated
- THEN it is accepted — no rejection

#### Scenario REQ-RLN-01.3: post-execute is independently covered (pair triangulation, QA-M3)

- GIVEN a factory package that declares an export/file named `post-execute` (a fixture
  distinct from Scenario .1's `pre-execute`)
- WHEN the package is validated
- THEN it is rejected, naming `post-execute` — proving neither reserved name's coverage is
  a mutant-surviving accident of only ever testing the other half of the pair

#### Scenario REQ-RLN-01.4: A schema.json property named pre-execute is NOT rejected by this REQ (SEC-m2)

- GIVEN a `schema.json` declaring a property key literally named `pre-execute`, and a
  factory module with no reserved-name export/file of its own
- WHEN the package is validated by this REQ's enforcement
- THEN it is NOT rejected — this REQ resolves reserved-name status from module structure
  ONLY; a schema field sharing the literal string is a separate concern (a resolved-input
  key named `pre-execute` is REQ-RBV-01.5's territory, not this REQ's) — falsifying any
  implementation that (incorrectly) also scans schema field names

### REQ-RLN-02: Reserved-Name Rejection Shape

**Status: the `AuthoringError` shape (`instanceof`, `origin`, `reason`) is DEFERRED to S-006
(see the top-level spec's Interim Behaviour clause). Interim the rejection throws a plain
`Error` with the EXACT pinned REQ-AEC-09 reserved-name template literal; rejection site and
distinguishability-by-message-literal are stable now.**

A factory package violating REQ-RLN-01 MUST be rejected with a distinguishable reason
(candidate `reserved-name`, S-006) whose message follows the reserved-name template row defined
in REQ-AEC-09 (`specs/authoring-error-contract/spec.md`, this change).

#### Scenario REQ-RLN-02.1: Rejection is distinguishable from a schema-validation rejection

- GIVEN the package from REQ-RLN-01.1
- WHEN it is rejected
- THEN the rejection is distinguishable in kind from a run-boundary schema-validation rejection (REQ-RBV-01)
- AND interim (plain-`Error` phase, S-000..S-005) that distinction is carried by the two DISTINCT pinned message literals — `reserved lifecycle name: …` (this REQ) vs. `invalid input: …` (REQ-RBV-01/02); reason/origin-based distinguishability (`instanceof AuthoringError`, `origin`, `reason`) is asserted only in S-006, post the Stage-2 amendment

### REQ-RLN-03: Collection-Level Names Are Out of Scope (Boundary Pin)

`add` and `remove` are COLLECTION-level reserved names (L2/composition territory — no
collection concept exists yet) and MUST NOT be rejected by this change's enforcement,
whether they appear as `schema.json` property keys or as existing SDK exports.

#### Scenario REQ-RLN-03.1: A schema.json property key named add is accepted (TW-F8, split)

- GIVEN a `schema.json` with a property key named `add`
- WHEN the package is validated by this change's enforcement
- THEN it is NOT rejected

#### Scenario REQ-RLN-03.2: An exported function named remove is accepted despite colliding with the shipped verb (TW-F8, split)

- GIVEN a factory package that exports a function named `remove`, lexically colliding with
  the shipped author verb (`src/commons/index.ts:163`)
- WHEN the package is validated by this change's enforcement
- THEN it is NOT rejected — pinning that `add`/`remove` enforcement is deferred to L2, not
  silently absorbed here, and that this lexical collision is tolerated by design

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation / naming boundary) | REQ-RLN-01, REQ-RLN-02, REQ-RLN-03 | Yes |

## Next Step

V2 incorporates blind spec-council feedback: REQ-RLN-01 records the kebab-case rationale
and marks its declaration-mechanism scenario design-gated, plus adds positive/pair/schema-
field-boundary scenarios; REQ-RLN-02 now references the frozen message-template row;
REQ-RLN-03's compound scenario is split per fixture. Surface to human for review.
