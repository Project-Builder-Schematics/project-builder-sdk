# Emit Rejection Metadata Specification

**Spec version**: V2
**Status**: signed (2026-07-06, stage-2-error-attribution)
**Change**: `stage-2-error-attribution`

## Purpose

Defines the PORT-INTERNAL rejection shape at the `EngineClient.emit` seam —
`src/core` vocabulary that lets the attribution layer identify WHICH directive
failed, WHY (a closed code, not message text), and how many already applied,
without changing the `emit(): Promise<void>` signature (exploration's
recommended Approach 2). This shape is a contributor-kit concern (ADR-0009):
it MUST NEVER cross to `./commons`. The real engine client (Stage 6) will need
to honor the same convention — flagged as a revisit point in the design ADR.

## Requirements

### REQ-ERM-01: Structured Rejection Shape at emit() — `EmitRejection`

The port-internal rejection type is named **`EmitRejection`** (exact
identifier — frozen so FIT-10's structural scan can target it; see
REQ-ERM-02). Its shape:

`EmitRejection { code: EmitRejectionCode; failedIndex?: number; appliedCount: number }`

`EmitRejectionCode` is a CLOSED port-internal set:
`"collision" | "not-found" | "unrepresentable" | "cap"`. Each fake throw site
sets its `code` at the throw site itself. Classification of the public
`reason` happens EXCLUSIVELY by mapping `code` → `reason` (a total mapping:
`collision`→`path-collision`, `not-found`→`path-not-found`,
`unrepresentable`→`unrepresentable-content`, `cap`→`changes-too-large`;
absent/unrecognized code → `unknown`). Reading the engine's message TEXT for
classification is BANNED — metadata alone cannot otherwise distinguish
rename/copy/move collision from not-found, and string-parsing was rejected
twice (explore Approach 3, ADR-0016's rejected alternative).

When an `EngineClient` implementation rejects a DIRECTIVE-LEVEL failure
(`code: "collision" | "not-found"`, encountered mid-loop while applying
`batch.instructions`), the `EmitRejection` MUST carry `failedIndex` (the
array index of the offending directive) and
`appliedCount === failedIndex` (every directive before it in THIS batch
applied successfully).

When an `EngineClient` implementation rejects a BATCH-LEVEL failure
(`code: "unrepresentable" | "cap"`, detected before the apply loop starts),
the `EmitRejection` MUST carry `appliedCount: 0` and MUST NOT carry a
`failedIndex` — there is no directive to blame for a whole-batch rejection.

#### Scenario REQ-ERM-01.1: Directive-level rejection carries code + failedIndex

- GIVEN a batch of 3 directives where the fake rejects the directive at
  index 2 (a collision, or a not-found)
- WHEN `emit` rejects
- THEN the thrown `EmitRejection` has `code` `"collision"` (or
  `"not-found"`), `failedIndex: 2`, and `appliedCount: 2`

#### Scenario REQ-ERM-01.2: Batch-level rejection carries code, no failedIndex

- GIVEN a batch that exceeds `BATCH_CAP_BYTES`, and separately a batch whose
  serialized/round-tripped form is not fidelity-safe
- WHEN each `emit` rejects
- THEN the thrown `EmitRejection` has `code: "cap"` /
  `code: "unrepresentable"` respectively, `appliedCount: 0`, and
  `failedIndex` absent

#### Scenario REQ-ERM-01.3: Classification uses the code, never message text

- GIVEN an `EngineClient` double that rejects with a well-formed
  `EmitRejection{code: "collision", ...}` whose message text is a decoy
  (e.g. contains the words "not found")
- WHEN the rejection is translated
- THEN `reason` is `"path-collision"` — proving the mapping reads `code`,
  not the message

### REQ-ERM-02: Port-Internal — Never Crosses to `./commons`

`EmitRejection` and `EmitRejectionCode` MUST be defined in `src/core`.
FIT-10's structural `EngineClient` port guard MUST extend to the
`EmitRejection` identifier: no module outside `src/core` names it directly,
except `test/support/contract-fake.ts`'s already-allow-listed import. The
`toAuthoringError` translation lives in `src/core/authoring-error.ts`
(invoked from `Session.flush`) and is the ONLY consumer that reads `code`/
`failedIndex`/`appliedCount` off an `EmitRejection` and translates them into
the public `AuthoringError` shape (`verb`, `path`, `appliedCount`, `reason`,
`origin`).

#### Scenario REQ-ERM-02.1: Structural scan allows only the port + the fake

- GIVEN the `src/**` tree
- WHEN the port-guard fitness scan runs
- THEN no module outside `src/core` and the allow-listed fake references
  the `EmitRejection` identifier

### REQ-ERM-03: Non-Error / Malformed Rejection Degradation

`toAuthoringError` (in `src/core/authoring-error.ts`) MUST NOT crash when
the rejection value does not carry the `EmitRejection` shape (a bare string,
number, `undefined`, or an `Error` without `code`/`failedIndex`/
`appliedCount`). In every such case it MUST still produce a valid
`AuthoringError` with `reason: "unknown"`, `origin: "write-rejected"`,
`verb: undefined`, `path: undefined`, `appliedCount: 0`.

#### Scenario REQ-ERM-03.1: Non-Error string rejection degrades gracefully

- GIVEN an `EngineClient.emit` that rejects with a bare string (not an
  `Error`, no metadata)
- WHEN `Session.flush` translates the rejection
- THEN it throws a valid `AuthoringError` with `reason: "unknown"` — it does
  NOT throw a `TypeError` while trying to read `code`/`failedIndex` off the
  string

#### Scenario REQ-ERM-03.2: Metadata-less Error still degrades

- GIVEN an `EngineClient.emit` that rejects with a plain `new Error("boom")`
  carrying no `code`/`failedIndex`/`appliedCount`
- WHEN translated
- THEN the resulting `AuthoringError` has `reason: "unknown"`,
  `appliedCount: 0`, and no engine text from `"boom"` anywhere in its object
  graph (FIT-11, REQ-AEC-05)

#### Scenario REQ-ERM-03.3: `throw undefined` degrades gracefully

- GIVEN an `EngineClient.emit` that rejects with `undefined` (`throw
  undefined` — a legal, metadata-less, non-object rejection)
- WHEN translated
- THEN no `TypeError` is thrown during translation AND the resulting
  `AuthoringError` has `reason: "unknown"` and `appliedCount: 0`

#### Scenario REQ-ERM-03.4: `throw 42` degrades gracefully

- GIVEN an `EngineClient.emit` that rejects with the number `42`
- WHEN translated
- THEN the resulting `AuthoringError` has `reason: "unknown"` and
  `appliedCount: 0` — a string-only degradation guard that still crashes on
  numbers (or `undefined`, REQ-ERM-03.3) fails these scenarios
