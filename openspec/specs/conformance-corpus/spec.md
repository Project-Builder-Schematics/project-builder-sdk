# Conformance Corpus Registry Specification

**Spec version**: V3
**Status**: SIGNED (V3 re-signed by owner 2026-07-18; evidence-driven V2→V3 corrections — see spec-summary.md log)
**Change**: `conformance-corpus`

## Purpose

Defines the `conformance/` directory at repo root: its on-disk layout, `corpus.json` registry
schema, and the fail-closed structural invariants the engine's Go loader enforces as HARD
failures (not skips). This is the registry contract — fixture *behavior* is
`conformance-fixtures`; the self-verifying test is `conformance-self-check`; byte/line-ending
guarantees are `corpus-determinism`.

## Requirements

### REQ-CCR-01: On-Disk Layout and `corpus.json` Schema

The system MUST expose `conformance/corpus.json` at repo root with shape
`{wireSpecVersion: number, fixtures: string[]}`, and one subdirectory per listed fixture id
directly under `conformance/`, each containing `manifest.json` + `factory.ts` and optionally
`seed/`, `expected/`, `schematic/{schema.json, files/}`.

#### Scenario REQ-CCR-01.1: corpus.json parses to schema

- GIVEN `conformance/corpus.json` at repo root
- WHEN parsed as JSON
- THEN it has a numeric `wireSpecVersion` and a `fixtures` array of strings

#### Scenario REQ-CCR-01.2: Each listed fixture has a matching directory

- GIVEN a `fixtures` entry `"m1-vehicle"`
- WHEN resolved on disk
- THEN `conformance/m1-vehicle/` exists with `manifest.json` and `factory.ts`

### REQ-CCR-02: Fail-Closed Structural Invariants (Mirrors Engine Loader)

The corpus MUST satisfy, at every point it is read, the three HARD-failure rules the engine's
Go loader enforces: (a) every id in `corpus.json#fixtures` MUST have a `manifest.json`; (b) every
fixture directory containing a `factory.ts` MUST have a `manifest.json`; (c) every
`manifest.json#id` MUST equal its directory name. A violation of any rule MUST be treated as a
hard failure, never silently skipped.

#### Scenario REQ-CCR-02.1: Listed id without manifest is a hard failure

- GIVEN `corpus.json#fixtures` lists `"m2-modify"`
- WHEN `conformance/m2-modify/manifest.json` does not exist
- THEN this is a rule violation (invariant a)

#### Scenario REQ-CCR-02.2: manifest id must equal dirname

- GIVEN `conformance/m1-vehicle/manifest.json` with `"id": "m1-vehicle-old"`
- WHEN checked against its directory name `m1-vehicle`
- THEN this is a rule violation (invariant c)

### REQ-CCR-03: Two-PR Delivery — PR#1 Scope Boundary

At the commit that closes PR#1, `conformance/corpus.json#fixtures` MUST list EXACTLY
`["m1-vehicle"]` — no `m2-*` id may appear until PR#2. PR#1 MUST also carry ALL cross-cutting
scaffolding: the self-check (`conformance-self-check`), `.gitattributes`
(`corpus-determinism`), `conformance/collection.json` (REQ-CCR-08 — without it every
runner-driven fixture invocation, including `m1-vehicle`'s, fails before its factory ever
executes), and `conformance/README.md`. PR#2 MUST add the four `m2-*` fixtures to the same
`corpus.json#fixtures` array, in the same commit as their artefact sets.

#### Scenario REQ-CCR-03.1: PR#1 HEAD lists only m1-vehicle

- GIVEN the commit that closes PR#1
- WHEN `conformance/corpus.json` is read
- THEN `fixtures` equals `["m1-vehicle"]` exactly

**Verification cadence note**: this scenario is a ONE-TIME PR-gate/CI check performed at PR#1's
merge (a single commit inspection), NOT part of the recurring `bun test` suite — unlike
`conformance-self-check`'s REQ-CSC series, which re-runs this class of check on every test
invocation against whatever `corpus.json` currently reads.

### REQ-CCR-04: Commit Atomicity — Every Intermediate SHA Fail-Closed Clean

A fixture's `corpus.json#fixtures` entry and its full artefact set (manifest, factory, and every
directory its manifest's cases reference) MUST land in the SAME commit. Across the branch's
entire commit history — not just HEAD — every commit MUST independently satisfy REQ-CCR-02;
no intermediate commit may list an id whose manifest/factory/referenced dirs are not yet present.

#### Scenario REQ-CCR-04.1: No orphan-listing commit exists in history

- GIVEN the full commit range from branch base to PR head
- WHEN each commit's `conformance/` tree is checked against REQ-CCR-02
- THEN every commit passes — none lists an id ahead of its artefacts

**Verification cadence note**: this scenario is a ONE-TIME PR-gate/CI check over the branch's
commit history (e.g. an interactive-rebase-range script or CI job scanning `git log`), NOT a
`bun test` suite assertion — the suite only ever sees the current worktree, never past commits.

### REQ-CCR-05: Corpus-Wide Numerics — Two-Checkpoint Cadence

The corpus's fixture/case inventory check MUST be DERIVED FROM `corpus.json#fixtures`'s own
declared list — every listed id MUST have a complete, landed artefact set, and 0 fixture
directories under `conformance/` may exist without a matching `corpus.json#fixtures` entry (0
orphan directories). This inventory-derived check MUST be GREEN at BOTH landing checkpoints: PR#1
(`corpus.json#fixtures = ["m1-vehicle"]`, 1 fixture / 2 cases) AND PR#2 (5 fixtures / 12 cases).
The ABSOLUTE numeric assertion — exactly 5 fixtures and exactly 12 cases total (`m1-vehicle`: 2,
`m2-modify`: 2, `m2-delete`: 3, `m2-rename-move`: 3, `m2-create-composition`: 2) — is a
POST-PR#2 GATE ONLY; it MUST NOT be asserted (and MUST NOT fail) against the PR#1 state, where
`corpus.json` legitimately lists only 1 fixture. (Previously: stated only the post-PR#2 absolute
count, which would fail the self-check/fitness-function at PR#1 — the corpus.json-derived
inventory check is what stays green across both checkpoints; the 5/12 absolute count applies only
once PR#2 lands.)

#### Scenario REQ-CCR-05.1: Final case count matches the handoff table (post-PR#2 gate)

- GIVEN the fully landed corpus (post PR#2)
- WHEN every fixture's `manifest.json#cases` is counted
- THEN the sum is exactly 12

#### Scenario REQ-CCR-05.2: No directory exists outside the registry

- GIVEN `conformance/` on disk
- WHEN every subdirectory is compared against `corpus.json#fixtures`
- THEN no subdirectory is absent from the list (0 orphan directories) — holds at BOTH PR#1 and
  PR#2 checkpoints

#### Scenario REQ-CCR-05.3: PR#1's 1-fixture inventory passes without the post-PR#2 count

- GIVEN the commit that closes PR#1 (`corpus.json#fixtures = ["m1-vehicle"]`)
- WHEN the inventory-derived check runs
- THEN it passes with 1 fixture / 2 cases — the exactly-5/exactly-12 assertion from
  REQ-CCR-05.1 does NOT apply yet and MUST NOT be evaluated at this checkpoint

### REQ-CCR-06: `conformance/README.md` Disambiguation

`conformance/README.md` MUST state, in its first paragraph, that this root-level directory is
the SDK↔engine live conformance corpus (submodule-consumed by the engine's Go harness) and is
DISTINCT from the published `./conformance` package export (`src/conformance/**`, the
dialect-conformance kit, ADR-0012) — naming adjacency only, no code relationship.

#### Scenario REQ-CCR-06.1: README names both surfaces explicitly

- GIVEN `conformance/README.md`
- WHEN read
- THEN it names both `conformance/` (this corpus) and `./conformance`
  (`src/conformance/**`, the published kit) and states they are unrelated

### REQ-CCR-07: `wireSpecVersion` Agreement Across the Corpus and the Wire Protocol

`conformance/corpus.json#wireSpecVersion` and EVERY fixture's `manifest.json#wireSpecVersion`
MUST all be equal, AND MUST equal the SDK's wire protocol version constant
(`WIRE_PROTOCOL_VERSION` in `src/transport/wire-protocol.ts`, currently `1`). This constant is
DISTINCT from `Batch.protocolVersion` in `src/core/wire.ts` (the IR batch-envelope field, also
currently `1` but a separate value with a separate meaning — the transport greeting's protocol
version, not the IR batch's) — do not conflate the two when implementing the agreement check. The
exact mechanism keeping the corpus's JSON literal pinned to `WIRE_PROTOCOL_VERSION` (manual sync +
a lint/test guard, a generated constant, etc.) is a design decision — this requirement pins WHAT
must agree, not HOW the agreement is enforced. (Previously: cited `src/core/wire.ts` as the
constant's location — that file holds the distinct `Batch.protocolVersion` IR field, not
`WIRE_PROTOCOL_VERSION`. Corrected per code verification: `WIRE_PROTOCOL_VERSION` is exported
from `src/transport/wire-protocol.ts`, a zero-import pure-constants module — safe for a
fitness-function import with no risk of pulling in transport machinery.)

#### Scenario REQ-CCR-07.1: All wireSpecVersion values agree corpus-wide

- GIVEN `corpus.json` and every landed fixture's `manifest.json`
- WHEN each `wireSpecVersion` value is compared
- THEN all values are equal

#### Scenario REQ-CCR-07.2: The agreed value equals the wire protocol version

- GIVEN the corpus-wide `wireSpecVersion` value from REQ-CCR-07.1
- WHEN compared against `WIRE_PROTOCOL_VERSION` (`src/transport/wire-protocol.ts`)
- THEN they are equal (currently `1`) — NOT compared against `Batch.protocolVersion`
  (`src/core/wire.ts`), a different constant

### REQ-CCR-08: `collection.json` Package-Anchor Marker (SDK-Runner Requirement)

The corpus MUST contain `conformance/collection.json` — a PRESENCE-ONLY marker file (content
ignored, never parsed) — as the shared ancestor the SDK's `defineFactory({packageDir})`
package-anchor resolution (`resolvePackageRoot`, `src/core/context.ts`, ADR-0046) walks upward to
find, starting from each fixture's own directory. `src/transport/runner.ts` UNCONDITIONALLY
passes `packageDir = dirname(<factory module URL>)` to `defineFactory` for every fixture it
invokes; without `conformance/collection.json` (or any other ancestor `collection.json`),
`resolvePackageRoot` throws `AuthoringError{reason: "invalid-input"}` (origin
`authoring-rejected` → exit 1, `src/transport/exit-codes.ts`) BEFORE the fixture's factory
function ever runs — this is an SDK-RUNNER requirement layered onto the handoff's documented
layout (`CONFORMANCE-CORPUS-HANDOFF.md` does not mention this file), NOT something the engine's Go
loader reads or is even aware of (presence-only, engine-loader-invisible). Flagged as an addition
to the handoff for the engine team's awareness — it changes nothing engine-side, but its absence
would silently break every SDK-side runner-driven fixture invocation.

#### Scenario REQ-CCR-08.1: The marker lets package-anchor resolution succeed for every fixture

- GIVEN `conformance/collection.json` exists at the corpus root
- WHEN the runner loads any fixture's factory (`packageDir = conformance/<id>/`)
- THEN `resolvePackageRoot` resolves `conformance/` as the `packageRoot` without throwing

#### Scenario REQ-CCR-08.2: A missing marker fails every fixture at exit 1, before the factory runs

- GIVEN `conformance/collection.json` is ABSENT and no other ancestor `collection.json` exists
- WHEN the runner invokes any fixture's factory
- THEN `resolvePackageRoot` throws `AuthoringError{invalid-input}`, the run exits 1, and the
  factory function itself never executes (this failure occurs before `defineFactory` constructs
  its `RunContext`/`Session`, so it is NOT a rejection this fixture's `transcript` can describe —
  it never reaches `REQ-CFX-13`'s callback machinery at all)

## Sensitive Areas Coverage

No sensitive areas covered. `security (IPC)` was flagged low-confidence at triage and confirmed
NOT touched during explore: zero lines change in `src/transport/**`, `src/core/wire.ts`, or
`docs/engine-sdk-wire-spec.md` — this domain only adds plain data files read by an external Go
harness, never executed as production TS.
