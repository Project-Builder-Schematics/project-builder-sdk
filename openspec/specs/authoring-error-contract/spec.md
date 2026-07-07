# Authoring Error Contract Specification

**Spec version**: V2
**Status**: signed (2026-07-06, stage-2-error-attribution)
**Change**: `stage-2-error-attribution`

## Purpose

Freezes the public shape of `AuthoringError`: a closed `reason` enum (★D2), an
`origin` discriminant (2.4) distinguishing an engine refusal from an SDK-side
misuse, the applied-boundary field's existence, a frozen message contract, and
promotion to a public export via `./commons`. This is the contract Stages 3-6
build on — after this stage, growing it is a semver decision, not a free edit.

## Requirements

### REQ-AEC-01: Closed Reason Enum (★D2)

`AuthoringError.reason` MUST be a closed union of exactly six values, ALL in
author vocabulary — zero engine/fake strings (`"serialization"`,
`"round-trip"`, `"protocol"`, `"directive"`, `"batch"`, `"emit"` are
explicitly BANNED as values):

`"path-collision" | "path-not-found" | "unrepresentable-content" | "changes-too-large" | "outside-run" | "unknown"`

(Previously: `target-not-found` — renamed to `path-not-found` for parallelism
with `path-collision` and to kill the target-vs-source ambiguity; and
`too-many-changes` — renamed to `changes-too-large`: the cap is BYTES, and the
old name misdirected authors to split batches when they may need smaller
content.)

| Value | Covers |
|---|---|
| `path-collision` | create/rename/copy/move onto an existing target without force (ADR-0017) |
| `path-not-found` | modify of a non-existent path; rename/copy/move of a non-existent source (ADR-0017) |
| `unrepresentable-content` | batch fails JSON serialization OR round-trip fidelity (ADR-0018) — one value, not two: both mean "this content can't cross the wire," and an author fixes both the same way |
| `changes-too-large` | serialized batch exceeds `BATCH_CAP_BYTES` (ADR-0019) |
| `outside-run` | a verb was called outside an active `defineFactory` run (REQ-AEC-02) |
| `unknown` | the rejection could not be classified (REQ-ERM-03 degradation) |

**Semver note**: adding a 7th value later is a MAJOR change, not additive.
Authors are expected to write exhaustive `switch(reason)` blocks; TypeScript's
exhaustiveness check breaks such a switch when a new member is added, even
though nothing breaks at runtime. FIT-04's `.d.ts` gate MUST treat a `reason`
union growth as breaking. Record this stance verbatim in the D2 ADR.

#### Scenario REQ-AEC-01.1: Every directive-level family classifies to its exact reason value — both failure forms of rename/copy/move included

- GIVEN one rejection per directive-level case: create-collision,
  modify-not-found, rename-collision, rename-source-not-found,
  copy-collision, copy-source-not-found, move-collision,
  move-source-not-found (`remove` never rejects — non-site, REQ-16)
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is EXACTLY `"path-collision"` for the four collision cases
  and EXACTLY `"path-not-found"` for the four not-found cases — asserted per
  case via `toEqual` on the value, so `"unknown"` cannot act as a silent
  sink that passes everything

#### Scenario REQ-AEC-01.2: No engine string ever appears as a reason value

- GIVEN the full set of rejections a `ContractFake` can raise today
- WHEN each is translated
- THEN `reason` is always one of the six closed values — never a raw string
  copied from the fake's message

#### Scenario REQ-AEC-01.3: Stringify-throw site classifies as unrepresentable-content

- GIVEN a batch whose `options` contains a `BigInt` (or a circular
  reference) — `JSON.stringify` itself THROWS at the fake's serialization
  guard
- WHEN the rejection is translated
- THEN `reason` is `"unrepresentable-content"`

#### Scenario REQ-AEC-01.4: Round-trip-drop site classifies as unrepresentable-content

- GIVEN a batch whose `options` contains a function or `NaN` —
  `JSON.stringify` SUCCEEDS but the round-trip compare detects the silent
  drop (note: `-0` is caught by the fake's `Object.is` compare, same site)
- WHEN the rejection is translated
- THEN `reason` is `"unrepresentable-content"` — this scenario guards the
  round-trip fake site independently of REQ-AEC-01.3's stringify-throw site;
  one scenario alone leaves the other site mutation-unguarded

#### Scenario REQ-AEC-01.5: Cap-exceeded classifies as changes-too-large

- GIVEN a batch whose serialized UTF-8 size exceeds `BATCH_CAP_BYTES`
- WHEN the rejection is translated
- THEN `reason` is EXACTLY `"changes-too-large"`

### REQ-AEC-02: Origin Discriminant (2.4)

`AuthoringError.origin` MUST be a closed union of exactly two values in
author mental-model terms:

- `"write-rejected"` — the engine evaluated the batch and refused it (maps to
  "my write was refused")
- `"authoring-rejected"` — the SDK detected the schematic itself was used
  incorrectly, independent of any engine round-trip (maps to "my authoring
  couldn't be processed")

(Previously: `"authoring-misuse"` — renamed to `"authoring-rejected"` for
parallelism with `write-rejected`; the name survives the Stage 5 dialect
family joining this origin without a MAJOR-break rename.)

`path-collision`, `path-not-found`, `unrepresentable-content`, and
`changes-too-large` are ALWAYS `origin: "write-rejected"`. `outside-run` is
ALWAYS `origin: "authoring-rejected"`. `unknown` is ALWAYS
`origin: "write-rejected"` — **deliberate, not incidental**: an unclassifiable
rejection necessarily arrived through the emit/write seam (the only place
`toAuthoringError` runs), so the write side is the honest attribution; record
this rationale in the 2.4 ADR.

The ONE concrete proof case in v1: calling a verb (`create`/`find`/etc.)
outside an active `defineFactory` run — today a plain `Error` thrown by
`currentContext()` — MUST become an `AuthoringError{origin:"authoring-rejected",
reason:"outside-run"}`. The dialect/AST family (Stage 5, ADR-0012) is a
RESERVED slot under `authoring-rejected`: the `origin` union stays exactly
these two members in v1; it is NOT implemented or tested here.

#### Scenario REQ-AEC-02.1: currentContext misuse is an AuthoringError

- GIVEN a call to `create(...)` outside any `defineFactory` run
- WHEN the call executes
- THEN it throws an `AuthoringError` with `origin: "authoring-rejected"` and
  `reason: "outside-run"`
- AND the thrown value's message still contains "can only be used while a
  schematic is running" (preserves the `test/skeleton/context.test.ts:12` pin)

#### Scenario REQ-AEC-02.2: An engine rejection is always write-rejected

- GIVEN any of the four engine-observable rejection families
- WHEN translated to an `AuthoringError`
- THEN `origin` is `"write-rejected"`

#### Scenario REQ-AEC-02.3: The two origins are distinguishable in one place

- GIVEN a single test that catches BOTH an engine rejection (e.g. a
  create-collision from a real `ContractFake` run) AND an outside-run misuse
- WHEN the two caught `AuthoringError`s' `origin` fields are compared
- THEN they differ — `"write-rejected"` vs `"authoring-rejected"` — proving
  "the author can tell them apart" in one assertion, not by inference across
  separate tests

### REQ-AEC-03: Applied-Boundary Field Exists

`AuthoringError` MUST expose `appliedCount: number`. Its full semantics
(per-batch scope, multi-flush behaviour) are specified by
`error-attribution-skeleton` REQ-15 — this requirement only freezes the
field's existence and type as part of the public contract.

The field's JSDoc MUST state that `appliedCount` counts directives applied
within the FAILING FLUSH before the offender — a DIAGNOSTIC for locating how
far the batch got, NOT a persistence promise: a rejected run discards
everything (ADR-0015/all-or-nothing), so the author uses it to locate
progress, never to reason about final committed state.

#### Scenario REQ-AEC-03.1: Field is present and numeric

- GIVEN any `AuthoringError` produced by the SDK
- WHEN its shape is inspected
- THEN `appliedCount` is present and is a `number`

#### Scenario REQ-AEC-03.2: JSDoc states diagnostic-not-persistence

- GIVEN the emitted JSDoc for `appliedCount`
- WHEN inspected
- THEN it states the count is scoped to the failing flush AND that a
  rejected run commits nothing (discard) — the count is not a survival claim

### REQ-AEC-04: Public Promotion via `./commons` + Doc Discoverability

`AuthoringError` (the class) and its supporting types (`AuthoringVerb`,
`AuthoringReason`, `AuthoringOrigin`) MUST be re-exported from
`@pbuilder/sdk/commons`. `instanceof AuthoringError` MUST work for a value
caught outside the `defineFactory` boundary that produced it. The exported
TYPE (semver/.d.ts-explicit, not prose) MUST declare
`verb: AuthoringVerb | undefined` and `path: string | undefined` — the
`undefined` arms are the batch-level contract (REQ-14.3), frozen in the
public type. FIT-04 MUST confirm the whole export is an additive-only
`.d.ts` change. The design ADR MUST record this as a deliberate ADR-0009
boundary crossing: an error DATA TYPE crossing `core` → `commons` is not a
kit-machinery leak (`EngineClient`, `Session`, `DirectiveFactory` stay
unexported).

Doc discoverability (author on-ramp):

- `AuthoringError`'s JSDoc `@example` MUST show the intended consumption
  pattern: `try/catch` + `instanceof AuthoringError` + `switch(reason)`.
- The five rejecting verbs' JSDoc (`create`, `modify`, `rename`, `move`,
  `copy`) MUST cross-reference `AuthoringError` as what a rejected call
  surfaces (`remove` is a non-site, REQ-16).

#### Scenario REQ-AEC-04.1: instanceof works across the public boundary

- GIVEN a factory run that rejects with an `AuthoringError`
- WHEN the caller imports `AuthoringError` from `@pbuilder/sdk/commons` and
  checks the caught value
- THEN `caught instanceof AuthoringError` is `true`

#### Scenario REQ-AEC-04.2: FIT-04 confirms additive-only

- GIVEN the `.d.ts` semver baseline before this change
- WHEN regenerated after `AuthoringError` is exported from `./commons`
- THEN FIT-04 reports an additive (non-breaking) diff
- AND the emitted type declares `verb: AuthoringVerb | undefined` and
  `path: string | undefined` literally

#### Scenario REQ-AEC-04.3: AuthoringError @example shows the consumption pattern

- GIVEN `AuthoringError`'s emitted JSDoc
- WHEN its `@example` block is inspected
- THEN it contains a `try/catch`, an `instanceof AuthoringError` check, and
  a `switch` over `reason`

#### Scenario REQ-AEC-04.4: Rejecting verbs cross-reference AuthoringError

- GIVEN the JSDoc of `create`, `modify`, `rename`, `move`, and `copy`
- WHEN inspected
- THEN each names `AuthoringError` as the rejection surface

### REQ-AEC-05: Whole-Object Leak Scan (FIT-11)

A fitness function MUST recursively scan the ENTIRE `AuthoringError` object
graph — own enumerable AND non-enumerable properties (including `message`
and `stack`), following `.cause` to a bounded depth with a cycle guard —
against a dictionary of every literal string `test/support/contract-fake.ts`
actually throws (`"ContractFake:"`, `"already exists"`, `"use force to
overwrite"`, `"not found"`, `"exceeds size cap"`, `"round-trip fidelity
check"`, `"JSON serialization"`). Zero matches for every rejection family.
Planted-leak fixtures MUST exist proving the scan fails red
[red-proof: **permanent-fixture**]. This REPLACES the weak
message+stack-only scan (with its dead `"OpMove"` assertion — that string
never appears in any fake rejection today) currently in
`test/skeleton/error-attribution.test.ts`.

**Naming note**: this requirement lives here (`REQ-AEC-05`), not in
`foundations-skeleton`'s `REQ-FIT-*` sequence (which stops at `REQ-FIT-09`).
The test file MAY still land as `test/fitness/fit-11-*.test.ts` (the 11th
fitness-test file, continuing that flat file-count convention) — the file
name is not the stable REQ-ID; `REQ-AEC-05` is.

#### Scenario REQ-AEC-05.1: No leak across any family

- GIVEN every rejection family (path-collision, path-not-found,
  unrepresentable-content, changes-too-large, outside-run, unknown)
- WHEN each `AuthoringError`'s full object graph is scanned
- THEN no dictionary string appears anywhere

#### Scenario REQ-AEC-05.2: Planted enumerable leak fails red

- GIVEN a deliberately modified `AuthoringError` that chains `.cause = raw`
- WHEN the scan runs
- THEN it fails, proving the scan is not a no-op

#### Scenario REQ-AEC-05.3: Planted NON-ENUMERABLE leak fails red

- GIVEN a fixture `AuthoringError` with a dictionary string planted on a
  NON-ENUMERABLE own property (e.g. `message` or `stack` set via
  `Object.defineProperty`)
- WHEN the scan runs
- THEN it fails — an `Object.keys`-only traversal mutant would pass the
  `.cause` fixture (REQ-AEC-05.2) and still miss this one

#### Scenario REQ-AEC-05.4: Cyclic cause chain terminates

- GIVEN a fixture error whose `.cause` chain forms a cycle
- WHEN the scan runs
- THEN it terminates (no infinite loop / stack overflow) and still reports
  correctly

### REQ-AEC-06: Frozen Message Contract

`AuthoringError.message` MUST follow exactly one of three templates —
stable, greppable, naming the `reason`, zero engine text (the FIT-11 scan of
REQ-AEC-05 applies to `message` too):

| Family | Template |
|---|---|
| Directive-level (`path-collision`, `path-not-found`) | `"{verb} failed at {path}: {reason}"` |
| Batch-level (`unrepresentable-content`, `changes-too-large`, `unknown`) | `"changes could not be applied: {reason}"` |
| `outside-run` | The existing prose, preserved: contains "can only be used while a schematic is running" (reconciled into this table — it is the third template, not an exception to the contract) |

The batch-level template MUST NOT interpolate `verb`/`path` — they are
`undefined` for batch-level rejections, and today's single template would
print `"undefined failed at undefined"`. When `reason` is `"unknown"`, the
message MUST additionally state that the SDK could not classify the failure.

#### Scenario REQ-AEC-06.1: Directive-level message names verb, path, and reason

- GIVEN a create-collision rejection on `"src/existing.ts"`
- WHEN the `AuthoringError.message` is inspected
- THEN it is `"create failed at src/existing.ts: path-collision"`

#### Scenario REQ-AEC-06.2: Batch-level message never prints "undefined"

- GIVEN a cap-exceeded rejection
- WHEN the message is inspected
- THEN it is `"changes could not be applied: changes-too-large"`
- AND the string `"undefined"` appears nowhere in it

#### Scenario REQ-AEC-06.3: Unknown message says the SDK could not classify

- GIVEN a rejection that degrades to `reason: "unknown"` (REQ-ERM-03)
- WHEN the message is inspected
- THEN it follows the batch-level template AND states the SDK could not
  classify the failure
