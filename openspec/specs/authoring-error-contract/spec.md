# Authoring Error Contract Specification

**Spec version**: V4
**Status**: signed (2026-07-13 — owner micro-unfreeze, `schematic-local-files` archive sync)
**Change**: `stage-2-error-attribution` (amended by `stage-4-typed-options`, 2026-07-10; amended by
`schematic-local-files`, 2026-07-13)

**V3 → V4 delta (owner micro-unfreeze, 2026-07-13, via `schematic-local-files`)**: adds
REQ-AEC-10 (extends the closed `reason` enum from eight to TWELVE values — four new
`source-*` reasons for SDK-side pre-emit rejections detected by `scaffold`/`copyIn`/
`create({templateFile})`), REQ-AEC-11 (message-template rows for the four new reasons,
package-relative/no-echo, neutral `"source file …"` wording — no `"copy failed:"` prefix,
which would misattribute non-`copy` verbs), and REQ-AEC-12 (three scaffold-family misuse
modes reuse the EXISTING `invalid-input` reason — no new union member for those). Per
REQ-AEC-10's own extension, REQ-AEC-01's enum literal and REQ-AEC-05.1's leak-scan family
list are updated below to the twelve-member count (enumeration completeness only — no
REQ-AEC-01/05 scenario ID or GIVEN/WHEN structure changed).

**V2 → V3 delta (owner-authorized unfreeze, 2026-07-10)**: applies the sequenced amendment
`stage-4-typed-options`'s spec recorded as PROPOSED (its "Domain: authoring-error-contract
(MODIFIED — DEFERRED)" block) — extends the closed `reason` enum from six to eight values
(REQ-AEC-07 `invalid-input`, REQ-AEC-08 `reserved-name`) and adds REQ-AEC-09 (the 4th/5th
message-template rows, needed by `stage-4-typed-options`'s REQ-RBV-02 and REQ-RLN-02). Pure
ADDED-requirements amendment — no MODIFIED/REMOVED, every V2 REQ-ID and its content preserved
verbatim. REQ-AEC-01's enum-size wording and REQ-AEC-01.2's scenario text are updated to the
amended eight-member count (counts only — the scenario ID and its GIVEN/WHEN structure are
unchanged). Both new reasons map to `origin: "authoring-rejected"` per ADR-0021's
origin-derives-from-reason rule. Clerical completions inside V3 (same authorization, same
day): REQ-AEC-02's per-reason origin-mapping enumeration and REQ-AEC-05.1's leak-scan family
list extended to the eight-member membership — enumeration completeness only, no scenario
IDs or semantics changed.

## Purpose

Freezes the public shape of `AuthoringError`: a closed `reason` enum (★D2), an
`origin` discriminant (2.4) distinguishing an engine refusal from an SDK-side
misuse, the applied-boundary field's existence, a frozen message contract, and
promotion to a public export via `./commons`. This is the contract Stages 3-6
build on — after this stage, growing it is a semver decision, not a free edit.

## Requirements

### REQ-AEC-01: Closed Reason Enum (★D2)

`AuthoringError.reason` MUST be a closed union of exactly twelve values, ALL in
author vocabulary — zero engine/fake strings (`"serialization"`,
`"round-trip"`, `"protocol"`, `"directive"`, `"batch"`, `"emit"` are
explicitly BANNED as values):

`"path-collision" | "path-not-found" | "unrepresentable-content" | "changes-too-large" | "outside-run" | "unknown" | "invalid-input" | "reserved-name" | "source-not-found" | "source-outside-package" | "source-not-regular-file" | "source-unreadable"`

(Previously: `target-not-found` — renamed to `path-not-found` for parallelism
with `path-collision` and to kill the target-vs-source ambiguity; and
`too-many-changes` — renamed to `changes-too-large`: the cap is BYTES, and the
old name misdirected authors to split batches when they may need smaller
content. V2 → V3 amendment, 2026-07-10, coordinated with `stage-4-typed-options`:
added `invalid-input` and `reserved-name`, extending the closed union from six
to eight values — see REQ-AEC-07/08. V3 → V4 amendment, 2026-07-13, via
`schematic-local-files`: added the four `source-*` reasons, extending the
closed union from eight to twelve values — see REQ-AEC-10.)

| Value | Covers |
|---|---|
| `path-collision` | create/rename/copy/move onto an existing target without force (ADR-0017) |
| `path-not-found` | modify of a non-existent path; rename/copy/move of a non-existent source (ADR-0017) |
| `unrepresentable-content` | batch fails JSON serialization OR round-trip fidelity (ADR-0018) — one value, not two: both mean "this content can't cross the wire," and an author fixes both the same way |
| `changes-too-large` | serialized batch exceeds `BATCH_CAP_BYTES` (ADR-0019) |
| `outside-run` | a verb was called outside an active `defineFactory` run (REQ-AEC-02) |
| `unknown` | the rejection could not be classified (REQ-ERM-03 degradation) |
| `invalid-input` | a factory run's resolved input fails schema-derived validation at the run boundary (REQ-AEC-07) |
| `reserved-name` | a factory module declares a reserved lifecycle name (REQ-AEC-08) |
| `source-not-found` | an in-ceiling package-local source path does not exist (REQ-AEC-10) |
| `source-outside-package` | source resolves outside the containment ceiling (REQ-AEC-10) |
| `source-not-regular-file` | source is not a regular file per the allow-list lstat (REQ-AEC-10) |
| `source-unreadable` | an in-ceiling, regular-file source could not be read (REQ-AEC-10) |

**Semver note**: adding a 13th value later is a MAJOR change, not additive.
Authors are expected to write exhaustive `switch(reason)` blocks; TypeScript's
exhaustiveness check breaks such a switch when a new member is added, even
though nothing breaks at runtime. FIT-04's `.d.ts` gate MUST treat a `reason`
union growth as breaking. Record this stance verbatim in the D2 ADR. (The V2 →
V3 amendment that added `invalid-input`/`reserved-name` was itself such a
MAJOR change, applied deliberately via owner-authorized unfreeze — not an
exception to this stance.)

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
- THEN `reason` is always one of the eight closed values — never a raw string
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
`changes-too-large` are ALWAYS `origin: "write-rejected"`. `outside-run`,
`invalid-input`, and `reserved-name` are ALWAYS
`origin: "authoring-rejected"` (`invalid-input`/`reserved-name` added by the
V2 → V3 amendment — REQ-AEC-07/08). `unknown` is ALWAYS
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
  unrepresentable-content, changes-too-large, outside-run, unknown,
  invalid-input, reserved-name — the last two added by the V2 → V3
  amendment, REQ-AEC-07/08 — plus source-not-found, source-outside-package,
  source-not-regular-file, source-unreadable, added by the V3 → V4 amendment,
  REQ-AEC-10)
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

### REQ-AEC-07: `reason: "invalid-input"` (V2 → V3 amendment, 2026-07-10)

`AuthoringError.reason` MUST include `"invalid-input"` as a closed-enum member
(REQ-AEC-01, extending the closed union to eight values), representing a
run-boundary schema-validation rejection: a factory run's resolved input
fails schema-derived validation before the run begins. Per REQ-AEC-02's
origin-derivation rule (ADR-0021: `origin` derives from a CLOSED `reason` enum
via an exhaustive switch), `origin` for this reason is ALWAYS
`"authoring-rejected"` — the rejection is an SDK-side misuse detection, not an
engine round-trip refusal.

(Originally drafted as `invalid-options` during `stage-4-typed-options`
proposal/V1; renamed to `invalid-input` before this amendment applied —
disambiguates from `create<S>`'s unrelated `options` template-interpolation
plane and aligns with the run-boundary-input-validation domain naming that
consumes this reason.)

#### Scenario REQ-AEC-07.1: A run-boundary validation rejection classifies as invalid-input

- GIVEN a factory run whose resolved input fails schema-derived validation at
  the run boundary
- WHEN the rejection is translated to an `AuthoringError`
- THEN `reason` is exactly `"invalid-input"` and `origin` is
  `"authoring-rejected"`

### REQ-AEC-08: `reason: "reserved-name"` (V2 → V3 amendment, 2026-07-10)

`AuthoringError.reason` MUST include `"reserved-name"` as a closed-enum member
(REQ-AEC-01, extending the closed union to eight values), representing a
factory module declaring a reserved lifecycle name (`pre-execute` /
`post-execute`). Per REQ-AEC-02's origin-derivation rule (ADR-0021), `origin`
for this reason is ALWAYS `"authoring-rejected"` — same rationale as
REQ-AEC-07: an SDK-side misuse detection, not an engine round-trip refusal.

#### Scenario REQ-AEC-08.1: A reserved-name rejection classifies as reserved-name

- GIVEN a factory module that declares a reserved lifecycle name
- WHEN the rejection is translated to an `AuthoringError`
- THEN `reason` is exactly `"reserved-name"` and `origin` is
  `"authoring-rejected"`

### REQ-AEC-09: Input-Level & Reserved-Name Message Template Rows (V2 → V3 amendment, 2026-07-10)

REQ-AEC-06 freezes a 3-row message-template table (directive-level,
batch-level, `outside-run`); none of those three families fit a
schema-validation or reserved-name rejection: directive-level needs a
`verb`+`path` these rejections don't have; batch-level MUST NOT name a field,
but naming the offending field IS the point of the no-echo contract;
`outside-run`'s template is fixed prose. This requirement adds TWO more rows —
a 4th, INPUT-LEVEL family (`reason: "invalid-input"`) and a 5th,
RESERVED-NAME family (`reason: "reserved-name"`) — both greppable, both
naming the failure concept, NEVER interpolating an undefined field, NEVER
echoing a raw supplied value:

| Family | Reason | Template |
|---|---|---|
| Input-level, type/shape mismatch | `invalid-input` | `"invalid input: {field} must be {expectedType}"` |
| Input-level, reserved/excess key | `invalid-input` | `"invalid input: {field} is a reserved or disallowed key"` |
| Reserved-name (module structure) | `reserved-name` | `"reserved lifecycle name: {name} is reserved and cannot be declared by a factory module"` |

`{expectedType}` renders the DECLARED expectation for the field, never the
received value's kind (no-echo): a primitive typed property renders the
declared kind (`number`/`string`/`boolean`); a non-JSON value (e.g. a
function) supplied for a typed property still renders the DECLARED kind, not
the received kind; `null` supplied for a required typed property renders the
DECLARED kind (null is wrong-type, not missing — a deliberate trichotomy, not
folded into a generic "missing" case); an enum property renders
`one of: <choices joined by ", ">`.

Canary asymmetry: key NAMES may appear on an error surface (as `{field}` or
`{name}`); VALUES never.

#### Scenario REQ-AEC-09.1: Input-level type-mismatch message

- GIVEN a run-boundary rejection on a `port` field expecting `number`
- WHEN the message is inspected
- THEN it is exactly `"invalid input: port must be number"`

#### Scenario REQ-AEC-09.2: Reserved-name message

- GIVEN a reserved-name rejection naming `pre-execute`
- WHEN the message is inspected
- THEN it is exactly `"reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module"`

### REQ-AEC-10: Closed Reason Enum Extended — 4 By-Reference Reasons (V3 → V4 amendment, 2026-07-13, via `schematic-local-files`)

`AuthoringError.reason` MUST extend from eight to TWELVE closed-union values, adding
exactly: `"source-not-found"`, `"source-outside-package"`, `"source-not-regular-file"`,
`"source-unreadable"`. All four cover failures detected by the SDK's OWN pre-emit
read/stat of a package-local source (`scaffold` / `copyIn` / `create({templateFile})`) —
never an engine round-trip refusal — so, per REQ-AEC-02's origin-derivation rule
(ADR-0021), `origin` for all four is ALWAYS `"authoring-rejected"`, the same rationale
as `invalid-input`/`reserved-name`.

| Value | Covers |
|---|---|
| `source-not-found` | an IN-CEILING package-local source path that does not exist (`by-reference-copy-wire` REQ-BRC-06) — NEVER reachable for out-of-ceiling paths (`package-root-containment` REQ-PRC-07) |
| `source-outside-package` | source resolves outside the containment ceiling (`package-root-containment` REQ-PRC-04/07) — fires BEFORE any existence probe, whether or not the target exists |
| `source-not-regular-file` | source is not a regular file per the allow-list lstat (directory, FIFO, socket, device; symlinked-dir descent) (`package-root-containment` REQ-PRC-04.3/.4) |
| `source-unreadable` | an in-ceiling, regular-file source that could not be read (permission, I/O error) |

`originFor`'s exhaustive switch (`src/core/authoring-error.ts`) adds all four under the
`authoring-rejected` arm; the compile-time exhaustiveness pin test extends to the
twelve-member union.

#### Scenario REQ-AEC-10.1: Each of the four new reasons classifies exactly and maps to authoring-rejected [SDK]

- GIVEN one fixture per new reason: missing in-ceiling source, out-of-ceiling source,
  directory-as-source, and an unreadable source exercised via the fake/conformance
  simulation or an injected read-failure (EACCES) seam — never a chmod-based CI
  fixture (chmod fixtures are unreliable under root-running CI and container umasks)
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly the corresponding new value and `origin` is
  `"authoring-rejected"` for all four

#### Scenario REQ-AEC-10.2: originFor exhaustiveness pin extends to 12 members [SDK]

- GIVEN the compile-time exhaustiveness test (`test/types/authoring-reason.test.ts`)
- WHEN the `reason` union is extended to twelve members
- THEN `originFor`'s switch statement compiles only when all twelve arms are handled
  — a missing arm fails the build

### REQ-AEC-11: Message Template Rows for the 4 New Reasons (V3 → V4 amendment, 2026-07-13, via `schematic-local-files`)

REQ-AEC-06/09's message-template table gains four rows, one per new reason, all
package-relative and no-echo (never the raw source content, never an absolute path,
never a raw OS errno string beyond a described category):

| Family | Reason | Template |
|---|---|---|
| Source missing (in-ceiling only) | `source-not-found` | `"source file not found: {path} does not exist in the package"` |
| Source outside package | `source-outside-package` | `"source file outside package: {path} resolves outside the package boundary"` |
| Source not a regular file | `source-not-regular-file` | `"source file invalid: {path} is not a regular file"` |
| Source unreadable | `source-unreadable` | `"source file unreadable: {path} could not be read"` |

`{path}` is always package-relative (never absolute), per `package-root-containment`
REQ-PRC-05.

**No-existence-oracle clause**: for a path resolving OUTSIDE the containment ceiling, the
ONLY reachable reason/template is `source-outside-package`, regardless of whether the
target exists — the `source-not-found` row is reachable EXCLUSIVELY for in-ceiling paths.
The not-found vs outside-package pair MUST NEVER differentiate existing from
non-existing out-of-ceiling targets (`package-root-containment` REQ-PRC-07).

#### Scenario REQ-AEC-11.1: Each new-reason message follows its exact template, path relative [SDK]

- GIVEN one rejection per new reason, each with a known package-relative source path
- WHEN each message is inspected
- THEN it matches its exact template with the path substituted, and contains no
  absolute filesystem path

### REQ-AEC-12: Scaffold-Family Failures Reuse the EXISTING `invalid-input` Reason (V3 → V4 amendment, 2026-07-13, via `schematic-local-files`) [OWNER]

The following scaffold-family failure modes MUST map to the EXISTING `invalid-input`
reason (`origin: "authoring-rejected"` per REQ-AEC-07's established derivation) —
owner-ruled 2026-07-12; they are author-misuse-of-the-authoring-surface failures, not
new source-access families, so the MAJOR union extension stays EXACTLY the four
`source-*` members of REQ-AEC-10 and the union arithmetic stays exactly TWELVE:

| Failure mode | Ruled by | REQ |
|---|---|---|
| `templateFile` binary/oversized fail-loud | [OWNER] | `file-escape-hatches` REQ-FEH-02 |
| Zero files after include/exclude filter | [OWNER] | `folder-scaffold` REQ-FSC-04 |
| Missing `collection.json` ancestor | [OWNER] | `package-root-containment` REQ-PRC-03 |
| `.template` sniff-fail inside a scaffold walk | same family | `content-classification` REQ-CCL-05 |
| Intra-scaffold destination collision | same family | `folder-scaffold` REQ-FSC-08 |
| Walk entry-count bound exceeded | same family | `folder-scaffold` REQ-FSC-09 |

#### Scenario REQ-AEC-12.1: The three owner-ruled modes classify as invalid-input, authoring-rejected [SDK]

- GIVEN one rejection per owner-ruled mode: a binary `templateFile`, a filter set
  eliminating every entry, and a package with no `collection.json` ancestor
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly `"invalid-input"` and `origin` is
  `"authoring-rejected"` for all three
- AND the compile-time union pin still counts exactly twelve members — none of these
  modes minted a new reason
