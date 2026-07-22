# ADR-0074: Authored-But-Held Branch Landing as a Distinct Debt Type

- Status: Accepted
- Date: 2026-07-22
- Deciders: Daniel (Hyperxq)
- Related: REQ-CCR-09 (m2-copy/m2-copyin landing sequence), issue #42 (recurring cross-repo pattern)

## Context

The `copy-copyin-conformance-fixtures` change must land `m2-copy` on `main` to unblock the engine's `copy-wire-inclusion` milestone. However, landing `m2-copyin` positive on `main` would ratchet the engine's submodule pin before `copyIn` is wire-included in the engine, breaking the intent of an SDK-owned fixture that proves the SDK's capability independent of engine readiness.

The change also establishes a pattern for the broader `m2-copyin` SDK-plane/engine-plane split (issue #42) that will recur with future cross-repo feature pairs.

## Decision

Author `m2-copyin` fully in this change (manifest, factory, `assets/`, `expected*` directories, all engine-plane cases) but hold its commit on an unmerged branch. Register it at archive as a distinct **authored-but-held debt row** (differentiated from a normal followup) carrying: branch name (`m2-copyin-banked-arm`), un-hold trigger (`Engine copyIn wire-inclusion in flight`), and a concrete 5-item re-validation checklist (REQ-CCR-09).

## Consequences

- (+) The critical path (`m2-copy`) is never hostage to `copyIn` timing; it can merge and unblock the engine independently.
- (+) "Fully authored" becomes a testable claim — the held branch is green in isolation at 7 fixtures / 23 cases (REQ-CCR-09.4).
- (+) Futures readers inherit a precise, actionable checklist for un-holding the branch, not a vague "finish copyIn" note.
- (-) Archive closes with half the change's scope branch-held — an honesty and debt-accounting burden.
- (-) The pattern recurs; every future paired SDK-side/engine-side feature risks a similar hold (tracking as issue #42).

## Alternatives Considered

- **`m2-copyin` as its own separate change**: Rejected by owner — SDK authoring is engine-independent; bundling keeps the pair coherent and makes the intent explicit.
- **Land `m2-copyin` on `main` and roll the pin back on-demand**: Rejected — the submodule pin ratchet is one-way in practice; rolling back creates operational friction.
- **Land `m2-copyin` with pin-safe SDK-plane cases first, add engine-plane cases later**: Rejected — the only pin-safe cases are the descoped SDK-plane rejection twins (authoring-rejected, empty transcript), which would create an empty placeholder fixture that declares green while proving nothing about `copyIn` landing bytes (QA finding).

## Origin

Promoted from change `copy-copyin-conformance-fixtures` (2026-07-22). See design.md §4.5 (ADR-02), outcome-verdict.md (CQ-1 owner ruling).
