# Run-Boundary Input Validation Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-4-typed-options`

## Purpose

Closes the "nothing validates the resolved inputs at the run boundary" gap named in the
problem statement. This is SDK-owned schema-conformance of the author's OWN input
contract — explicitly upstream of, and distinct in scope from, ADR-0018's wire-level
judgments (paths, serializability, intra-batch conflicts), which remain engine-owned
pass-through. Design must formalize this distinction as a scoping amendment to ADR-0018
(council finding arch-F1) before the pre-archive architecture audit; the REQs below assume
that scoping holds. Path-shaped string VALUES inside a resolved input are validated here
only against the declared schema type/shape — their eventual use as a wire-level path is
ADR-0018-owned engine validation, deliberately out of this domain's scope (SEC-m1), not an
omission.

## Interim Behaviour (pre-Stage-2-amendment) — see the top-level spec's consolidated clause

REQ-RBV-01, REQ-RBV-02, and REQ-RLN-02 (in the sibling `reserved-lifecycle-names` domain)
ULTIMATELY assert a public `AuthoringError` shape (its `origin`, its `reason`) that requires two
new members on Stage 2's signed, closed `AuthoringError.reason` enum, plus two new
message-template rows (REQ-AEC-07/08/09 in `specs/authoring-error-contract/spec.md`, this
change). That amendment is sequenced strictly AFTER `stage-2-error-attribution` archives (or an
explicit owner unfreeze). INTERIM (the S-000..S-005 `/build` deliverable), the rejection is
thrown as a **plain `Error`** — NOT an `AuthoringError` — whose `.message` is the EXACT pinned
REQ-AEC-09 template literal and which fails closed. Buildable and testable NOW: the rejection
SITE, fail-closed behaviour, the EXACT message literal (field/type named, never the value), and
no-echo. Deferred to S-006 (post the Stage-2 amendment): `instanceof AuthoringError`, the
`origin`, and the `reason` — tests assert NONE of the three interim. The full consolidated
statement lives in the top-level `spec.md`'s "Interim Behaviour" section. REQ-RBV-04 and
REQ-RBV-05 below carry NO such dependency; and with the plain-`Error` interim, no REQ in this
domain carries a Stage-2 build precondition — the only remaining gate is S-006's.

## Requirements

### REQ-RBV-01: Fail-Closed Validation at the Run Boundary

**Status: the `AuthoringError` shape (`instanceof`, `origin`, `reason`) is DEFERRED to S-006
(see Interim Behaviour above). Interim the rejection throws a plain `Error` with the EXACT
pinned REQ-AEC-09 message literal; the rejection SITE, fail-closed behaviour, exact message
literal, and no-echo are buildable and testable now.**

When a factory has an accompanying `schema.json`, `defineFactory` MUST validate the
resolved input `o` against it BEFORE `als.run`/`fn(o)` executes (the existing pre-`als.run`
chokepoint, `context.ts`). A resolved input that is missing a required key, has a
wrong-typed value (a present key whose value is `null` against a non-nullable declared type
is treated as WRONG-TYPED — never as equivalent to a missing key), carries an excess key,
is a non-JSON-representable value, uses a reserved lifecycle-name as a key, or uses
`__proto__`/`constructor`/`prototype` as a key MUST be rejected at this site: nothing is
staged (no directive reaches the buffer) and nothing reaches the `emit` seam. This is a
distinct site from the emit-seam `unrepresentable-content` rejection (Stage 2/ADR-0018
territory) — a test asserting this REQ MUST assert the SITE, not merely that some rejection
occurred. Template-syntax-looking string values (`${...}`, `{{...}}`) are treated as OPAQUE
DATA at this boundary — never evaluated or specially rejected/accepted on that basis; if
otherwise schema-valid they pass through as ordinary data. Interpolation-safety is out of
scope here and belongs to the unrelated `create<S>` template-rendering plane.

#### Scenario REQ-RBV-01.1: Site assertion, contrasted with the emit seam (+ author-observable outcome, BA-2)

- GIVEN a factory with a `schema.json` requiring `{ port: number }`, called with a resolved input missing `port`
- WHEN the factory is run
- THEN the run-boundary validator rejects BEFORE `fn` executes — no directive is ever buffered and the engine client's `emit` is never invoked
- AND the author observes an actionable authoring rejection: the run terminates and the thrown value propagates to their own `catch` handler (not a silent hang or an unrelated crash)
- AND this is contrasted, in the same test file, with a schema-satisfying input that fails at the SEPARATE `unrepresentable-content` emit-seam site, proving the two rejection sites are distinct

#### Scenario REQ-RBV-01.2: Wrong-typed value

- GIVEN the same schema, called with `{ port: "8080" }`
- WHEN the factory is run
- THEN the run-boundary validator rejects before `fn` executes

#### Scenario REQ-RBV-01.3: Excess key

- GIVEN the same schema, called with `{ port: 8080, extra: true }`
- WHEN the factory is run
- THEN the run-boundary validator rejects before `fn` executes, naming the excess key

#### Scenario REQ-RBV-01.4: Non-JSON value (distinct failure class from .2, QA-m3)

- GIVEN the same schema, called with `{ port: () => 8080 }`
- WHEN the factory is run
- THEN the run-boundary validator rejects before `fn` executes
- Note: distinct from REQ-RBV-01.2 — here the value cannot be represented as JSON at all
  (a function), vs. .2's JSON-representable-but-wrong-type case. Both reject at this SAME
  run-boundary site, which remains the raw pre-`fn` resolved input — distinct from the
  emit-seam's `unrepresentable-content` check, which operates on the STAGED DIRECTIVE BATCH
  already built from validated input, never on the raw resolved input itself.

#### Scenario REQ-RBV-01.5: Reserved-name key in resolved input

- GIVEN a resolved input carrying a key named `pre-execute`
- WHEN the factory is run
- THEN the run-boundary validator rejects before `fn` executes

#### Scenario REQ-RBV-01.6: __proto__/constructor/prototype key — fail-closed without pollution (SEC-B2)

- GIVEN a resolved input carrying a key named `__proto__` (or, in separate fixtures, `constructor` or `prototype`)
- WHEN the factory is run
- THEN the run-boundary validator rejects fail-closed before `fn` executes
- AND after the rejected run, a canary property placed on `Object.prototype` before the run remains `undefined`/unmodified — the validation path itself never pollutes the prototype chain while inspecting the hostile key

#### Scenario REQ-RBV-01.7: null / undefined / empty-string trichotomy for a required key (QA-M2)

- GIVEN a schema requiring `port: number` and a separate schema requiring a string-typed `name`, exercised with three resolved inputs: (i) `{}` (port absent), (ii) `{ port: null }`, (iii) `{ name: "" }`
- WHEN each is run
- THEN (i) rejects as MISSING (no key present); (ii) rejects as WRONG-TYPED (`null` is present but not a `number` — never treated as equivalent to missing); (iii) PASSES for the string case (an empty string is a valid, present, correctly-typed string value)

#### Scenario REQ-RBV-01.8: Template-syntax values pass through as opaque data (SEC-M3)

- GIVEN a resolved input with a schema-valid string property whose value is `"${env.PORT}"`
- WHEN the factory is run
- THEN the value is treated as ordinary schema-conformant string data — never evaluated or specially rejected — and the run proceeds if otherwise schema-valid

### REQ-RBV-02: No-Raw-Value-Echo Message Contract

**Status: the `AuthoringError` shape is DEFERRED to S-006 (see Interim Behaviour). Interim the
rejection is a plain `Error` whose exact message literal (the REQ-AEC-09 input-level template
row) is stable and asserted now; no `instanceof`/`origin`/`reason` assertion runs interim.**

A run-boundary rejection's message MUST follow the input-level template family defined in
REQ-AEC-09 (`specs/authoring-error-contract/spec.md`, this change) — it MUST name the
offending field and its expected type (or, for excess/reserved keys, the offending key
name) and MUST NEVER include the raw supplied value. (V1 asserted this as a parallel prose
contract; V2 references the frozen template row instead — TW-F1.)

#### Scenario REQ-RBV-02.1: Message names field and type, never the value

- GIVEN a resolved input with `port: "8080"` against a schema requiring `port: number`
- WHEN the rejection message is inspected
- THEN it names `port` and states the expected type `number`
- AND it does not contain the literal string `"8080"`

### REQ-RBV-03: No-Schema Opt-Out Signal

When a factory has NO accompanying `schema.json`, run-boundary validation MUST be skipped
(the opt-out is legitimate — REQ-TFO-02) — but the opt-out MUST be observable: EVERY run of
such a factory MUST emit a warning (a fixed, greppable line, naming the factory) rather than
silently doing nothing. This fires on every run, statelessly — no "first run only"
suppression (QA-M4/BA-5: a stateful once-per-factory suppression would need process- or
disk-backed tracking for no clear benefit; a stateless per-run warning is simpler and
strictly more observable). This is unblocked (no cross-change dependency) — it does not
throw an `AuthoringError`. The warning channel is STDERR (`console.warn`); the exact literal
line text is pinned by design, not by this spec — this spec pins the channel and the
required substrings (the factory's name and a phrase indicating no schema-derived input
validation ran).

#### Scenario REQ-RBV-03.1: Opt-out is loud, every run, not silent and not one-time (TW-F7)

- GIVEN a factory with no `schema.json` in its package
- WHEN the factory is run
- THEN the run succeeds (opt-out, not an error)
- AND a warning line is emitted on STDERR naming the factory as running without
  schema-derived input validation
- AND a test captures and asserts the warning fires again, identically, on a SECOND run of
  the same factory (proving statelessness) and on a run of a SECOND, different factory
  with no schema.json (proving the warning is per-factory, not global-once)

### REQ-RBV-04: Canary-Seeded No-Echo Verification (Cross-Domain, SEC-B1/QA-m2)

The no-echo guarantee (REQ-RBV-02, and by the same mechanism REQ-TFO-04's
no-raw-content-echo and `reserved-lifecycle-names` REQ-RLN-02's rejection message) MUST be
verified by a DICTIONARY-SEEDED CANARY SCAN, not by checking for the absence of one or two
known literal strings. Test fixtures MUST seed a unique canary token into every schema
field name/value AND into the resolved-input value under test, then drive EVERY rejection
branch this change introduces (all REQ-RBV-01 sub-scenarios, REQ-TFO-04's bin error path,
REQ-RLN-02's rejection) and assert the canary token appears on NO error surface: not the
message, not `.stack`, not any structured field, not captured stdout, not captured stderr.
Key NAMES may legitimately appear in a rejection surface (e.g. naming the offending field);
VALUES must never appear — this asymmetry is deliberate (SEC-m3), not an oversight.

#### Scenario REQ-RBV-04.1: Canary scan across every rejection branch

- GIVEN a unique canary token seeded as a resolved-input VALUE and driven through every
  rejection branch (REQ-RBV-01.1 through .7, REQ-TFO-04.1, REQ-RLN-02.1)
- WHEN each rejection's full error surface (message, `.stack`, structured fields, captured
  stdout/stderr) is scanned for the canary token
- THEN it is found in none of them

#### Scenario REQ-RBV-04.2: Key names may appear, values never (asymmetry pin)

- GIVEN a resolved input with an excess key literally named after the canary token
- WHEN the rejection is inspected
- THEN the KEY NAME may legitimately appear (naming the offending key is required per
  REQ-RBV-01.3) — the never-appears assertion is scoped to VALUES, never key names

### REQ-RBV-05: Fail-Closed on Malformed or Empty Schema at the Run Boundary (SEC-B3/QA-m4)

A `schema.json` that is PRESENT but unparseable (invalid JSON, or a shape that is not a
valid schema) at run time MUST cause the run to be REJECTED fail-closed — silently passing
validation, or silently falling back to the REQ-RBV-03 no-schema opt-out, is explicitly
PROHIBITED. A `schema.json` that is present, valid JSON, and declares ZERO properties (an
empty/degenerate schema) is DISTINCT from having no `schema.json` at all: it is NOT treated
as the REQ-RBV-03 opt-out — validation runs (trivially passing, since no properties are
declared) AND the SAME loud-warning mechanism as REQ-RBV-03 fires, using text that
distinguishes "empty schema" from "no schema" so an author never conflates the two.

**Known limitation (orphan-schema evasion, noted not closed):** a `schema.json` that exists
on disk but is NOT in the canonical adjacent location (REQ-FPS-01) is invisible to the
validator — it is simply not found, and the REQ-RBV-03 opt-out warning fires as if none
existed. This is a known evasion path inherent to filesystem-based discovery; REQ-FPS-01's
canonical-location convention is the mitigation (the opt-out warning is the signal an
author should notice), not a full close.

#### Scenario REQ-RBV-05.1: Present-but-unparseable schema.json fails closed

- GIVEN a `schema.json` containing invalid JSON
- WHEN a factory in that package is run
- THEN the run is rejected fail-closed before `fn` executes
- AND the rejection message names the file and the parse problem without echoing the
  file's raw invalid content (mirrors REQ-TFO-04's bin discipline)

#### Scenario REQ-RBV-05.2: Empty schema is distinct from no schema

- GIVEN a `schema.json` containing valid JSON with zero declared properties
- WHEN the factory is run
- THEN the run succeeds (no property to violate) AND a warning fires whose text
  distinguishes "schema declares zero properties" from REQ-RBV-03's "no schema.json
  present" warning

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation at the run boundary) | REQ-RBV-01, REQ-RBV-02, REQ-RBV-03, REQ-RBV-04, REQ-RBV-05 | Yes |

## Next Step

V2 incorporates blind spec-council feedback: canary-seeded no-echo verification and
fail-closed malformed/empty-schema handling are new REQs (RBV-04/05); REQ-RBV-01 gains
prototype-pollution, null-trichotomy, and template-syntax-opacity scenarios; REQ-RBV-03
drops "first run" for stateless per-run warning; REQ-RBV-02 now references the frozen
message-template row instead of a parallel prose contract. Surface to human for review.
