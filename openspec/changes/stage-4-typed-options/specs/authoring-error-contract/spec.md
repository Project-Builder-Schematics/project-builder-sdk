# Authoring Error Contract — Deferred Amendment (Cross-Change Dependency)

**Spec version**: V2
**Status**: draft (PROPOSED amendment — NOT an applied delta)
**Change**: `stage-4-typed-options`

## Purpose

`stage-2-error-attribution` owns and signs `authoring-error-contract` (V2, signed
2026-07-05) in a concurrent session/worktree; its file is READ-ONLY here and is never
edited by this change. This file records the amendment that REQ-RBV-01/02 (run-boundary
validation) and REQ-RLN-02 (reserved-name rejection) need — two new closed-enum
`reason` members plus two new message-template rows — as an explicit, sequenced
dependency, per the owner-ratified interim-throw-shape resolution (council findings arch-F2
+ PM-1, converged): the validation slice ships the FINAL error shape; there is no
provisional public throw shape.

**This is not this change's Write.** Applying the amendment is Stage 2's act, performed
via a coordinated `sdd-spec` amendment to its OWN signed spec, ONLY after
`stage-2-error-attribution` archives (or an explicit owner unfreeze of its signed spec).
The REQ-IDs below (`REQ-AEC-07`, `REQ-AEC-08`, `REQ-AEC-09`) continue Stage 2's own
`authoring-error-contract` sequence (which stops at `REQ-AEC-06` in its signed V2) —
reserved here, applied there.

## Proposed Requirements (blocked — do not implement against these until applied)

### REQ-AEC-07 (PROPOSED): `reason: "invalid-input"`

Stage 2's closed `AuthoringError.reason` enum (currently `path-collision |
path-not-found | unrepresentable-content | changes-too-large | outside-run | unknown`)
MUST gain a new member, `invalid-input`, representing a run-boundary schema-validation
rejection (REQ-RBV-01). (Renamed from V1's `invalid-options` — TW-F2: aligns with the
run-boundary-INPUT-validation domain naming and the "input contract" framing used
throughout this change, and disambiguates from `create<S>`'s unrelated `options` plane,
which this change deliberately never touches.) Growing this enum is a MAJOR change under
Stage 2's own signed semver stance (V2 cross-cutting note 4) and MUST be applied via a
coordinated amendment, never a silent edit.

#### Scenario REQ-AEC-07.1 (post-amendment, deferred)

- GIVEN the amendment has been applied to Stage 2's spec and code
- WHEN a run-boundary validation rejection (REQ-RBV-01) is thrown
- THEN the resulting `AuthoringError` has `origin: "authoring-rejected"` and `reason: "invalid-input"`

### REQ-AEC-08 (PROPOSED): `reason: "reserved-name"`

Same enum gains a second member, `reserved-name`, for REQ-RLN-02's rejection. Same
sequencing constraint as REQ-AEC-07.

#### Scenario REQ-AEC-08.1 (post-amendment, deferred)

- GIVEN the amendment has been applied
- WHEN a reserved-name rejection (REQ-RLN-02) is thrown
- THEN the resulting `AuthoringError` has `origin: "authoring-rejected"` and `reason: "reserved-name"`

### REQ-AEC-09 (PROPOSED): Input-Level & Reserved-Name Message Template Rows (4th & 5th families, TW-F1)

Stage 2's REQ-AEC-06 freezes a 3-row message-template table (directive-level, batch-level,
`outside-run`) — none of those three families fit a schema-validation or reserved-name
rejection: directive-level needs a `verb`+`path` this change doesn't have; batch-level MUST
NOT name a field, but naming the field IS the point of REQ-RBV-02's no-echo contract;
`outside-run`'s template is fixed prose. This amendment adds TWO more rows: a 4th,
INPUT-LEVEL family (governing REQ-RBV-02's rejections, `reason: "invalid-input"`) and a
5th, RESERVED-NAME family (governing REQ-RLN-02's rejections, `reason: "reserved-name"`) —
both greppable, both naming the failure concept, NEVER interpolating an undefined field,
NEVER echoing a raw supplied value:

| Family | Reason | Template |
|---|---|---|
| Input-level, type/shape mismatch | `invalid-input` | `"invalid input: {field} must be {expectedType}"` |
| Input-level, reserved/excess key | `invalid-input` | `"invalid input: {field} is a reserved or disallowed key"` |
| Reserved-name (module structure) | `reserved-name` | `"reserved lifecycle name: {name} is reserved and cannot be declared by a factory module"` |

Same sequencing as REQ-AEC-07/08: applied only after `stage-2-error-attribution` archives
(or explicit owner unfreeze), via a coordinated `sdd-spec` amendment to Stage 2's own spec.

#### Scenario REQ-AEC-09.1 (post-amendment, deferred): Input-level type-mismatch message

- GIVEN the amendment applied, a run-boundary rejection on `port` expecting `number`
- WHEN the message is inspected
- THEN it is exactly `"invalid input: port must be number"`

#### Scenario REQ-AEC-09.2 (post-amendment, deferred): Reserved-name message

- GIVEN the amendment applied, a reserved-name rejection naming `pre-execute`
- WHEN the message is inspected
- THEN it is exactly `"reserved lifecycle name: pre-execute is reserved and cannot be declared by a factory module"`

## Sequencing Gate

```
stage-2-error-attribution archives (or owner unfreeze)
        │
        ▼
coordinated sdd-spec amendment to Stage 2's signed spec (adds REQ-AEC-07/08/09 there)
        │
        ▼
REQ-RBV-01/02, REQ-RLN-02 unblock — their final `reason`/message assertions can be written
and verified; stage-4-typed-options's own slicing must gate its validation slice on this
```

`typed-factory-options`, `schema-contract-parity`, and `factory-package-shape`
(including the 4.4 e2e example) carry NO dependency on this amendment and may build
independently if Stage 2 delays (PM smallest-valuable-increment note).

## Administrative Notes (for `sdd-archive`, not this phase's Write)

- Register the Stage-2 enum-extension amendment (now including the two new message-template
  rows) as a pending change at this change's archive (not prose-only) — PM followup.
- `triage.md`'s scope block predates the 4.5/D7-split amendment (`stage-4b-testing-harness`
  carved out); reconcile the contract-of-record at archive — BA cross-artefact finding.

## Next Step

V2 renames `invalid-options`→`invalid-input` (TW-F2) and adds REQ-AEC-09, the message-
template obligation the V1 spec was missing (TW-F1 blocker) — REQ-RBV-02 and REQ-RLN-02 now
reference these frozen rows instead of asserting parallel prose contracts. This domain
remains a dependency declaration, not new behaviour, until the coordinated amendment lands.
Surface to human for review.
