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

### REQ-CCR-05: Corpus-Wide Numerics — Manifest-Derived Cadence, Monotonic Floor, and Retirement of Dead Hardcoded Gates

The corpus's fixture/case inventory check MUST be DERIVED FROM `corpus.json#fixtures`'s own
declared list — every listed id MUST have a complete, landed artefact set, and 0 fixture
directories under `conformance/` may exist without a matching `corpus.json#fixtures` entry (0
orphan directories). Both the fixture COUNT and the total case COUNT MUST be computed from the
CURRENTLY-landed manifest set at check time — NEVER asserted as a hardcoded absolute literal —
so the check stays green at every landing checkpoint without a spec/test edit merely to update a
number (pending-changes row 502: "Monotonic fixture floor ... + derive absolute case counts from
the manifest set instead of a hardcoded literal"). Additionally, `corpus.json#fixtures.length`
MUST NOT DECREASE across the corpus's commit history (monotonic floor) — a shrinking fixture
count is always a hard failure, never a legitimate state. Any hardcoded absolute-count
early-return gate left over from a prior checkpoint scheme (e.g. an `if
(corpus.fixtures.length !== N) return` guard) MUST be DELETED, not left in place as vacuous
dead code that can never go RED.

**Honesty note on what REQ-CCR-05.1 actually proves (added V2, QA)**: the manifest-derived sum
check (REQ-CCR-05.1) compares the corpus's OWN declared case counts against ITSELF — it is an
orphan/consistency guard (nothing is uncounted, nothing double-counts), and by construction it
CANNOT fail RED on a case-count-shape drift (e.g. an author quietly deleting a twin case). The
per-fixture behavioral-contract blocks (`conformance-fixtures` REQ-CFX-05 through REQ-CFX-09,
REQ-CFX-15, REQ-CFX-16) are the LOAD-BEARING guard against that: they pin each case's exact
name/outcome/transcript shape and go RED if any is altered or missing. REQ-CCR-05 only proves
the inventory is internally consistent, never that any individual case is behaviorally correct.

Known checkpoints to date: PR#1 (1 fixture / 2 cases), PR#2 (5 fixtures / 12 cases), THIS
change's `m2-copy` landing on `main` (6 fixtures / 18 cases — `m2-copyin`'s 5 cases, extended
from 4 by the 2026-07-22 owner-ruling addition of `dest-dir-twin`, are AUTHORED but branch-held
per `conformance-fixtures` REQ-CFX-17/REQ-CCR-09, and MUST NOT be counted in `main`'s inventory
until its own un-hold commit lands — a future checkpoint of 7 fixtures / 23 cases this change
does not itself reach).

(Previously: pinned an ABSOLUTE hardcoded assertion — exactly 5 fixtures / 12 cases — as a
POST-PR#2 gate distinct from the derived inventory check. This change REMOVES the hardcoded
absolute assertion entirely in favor of a fully manifest-derived count PLUS the monotonic-floor
invariant PLUS mandatory deletion of dead early-return gates, so no future fixture landing —
including `m2-copyin`'s eventual un-hold at 7 fixtures / 23 cases — requires another
literal-count edit or leaves stale dead code behind. V2 also adds the honesty note above
distinguishing this REQ's orphan/consistency role from REQ-CFX's load-bearing behavioral role,
per QA council feedback.)

#### Scenario REQ-CCR-05.1: Derived case count is an internal-consistency check, not a behavioral guard

- GIVEN whatever set of fixtures `corpus.json#fixtures` CURRENTLY lists (1, 5, 6, or 7, as the
  corpus grows)
- WHEN every listed fixture's `manifest.json#cases` is counted
- THEN the sum equals the DERIVED total for that exact set — this proves the inventory is
  self-consistent; it does NOT prove any individual case's outcome/transcript shape is correct
  (that is `conformance-fixtures` REQ-CFX-05..09/15/16's job)

#### Scenario REQ-CCR-05.2: No directory exists outside the registry

- GIVEN `conformance/` on disk
- WHEN every subdirectory is compared against `corpus.json#fixtures`
- THEN no subdirectory is absent from the list (0 orphan directories) — holds at every
  checkpoint

#### Scenario REQ-CCR-05.3: Each checkpoint is evaluated only against its own derived count

- GIVEN any landed checkpoint (e.g. the commit that closes PR#1, or the commit that lands
  `m2-copy`)
- WHEN the inventory-derived check runs at THAT commit
- THEN it passes using that commit's OWN fixture/case counts — a later checkpoint's count is
  never evaluated against an earlier commit, and vice versa

#### Scenario REQ-CCR-05.4: Fixture count never decreases across commit history

- GIVEN the corpus's `corpus.json#fixtures.length` across the branch's commit history, in order
- WHEN each value is compared to its predecessor
- THEN each is greater than or equal to the previous — a decrease is a hard failure, never a
  legitimate state

**Verification cadence note** (added V2, mirrors REQ-CCR-04's): this is a ONE-TIME PR-gate/review
check over the branch's commit history (e.g. a `git log`-scanning CI job), NOT a `bun test`
suite assertion — `fit-40` only ever inspects the CURRENT worktree and cannot read git history,
so it structurally cannot enforce this scenario itself.

#### Scenario REQ-CCR-05.5: No dead hardcoded checkpoint gates remain (added V2)

- GIVEN `test/fitness/fit-40-conformance-corpus-integrity.test.ts`'s source
- WHEN scanned for absolute-count early-return guards from prior checkpoint schemes (e.g.
  `corpus.fixtures.length !== 5` / `!== 1`)
- THEN none remain — any such guard is either deleted or replaced by the manifest-derived check
  above; a vacuous dead-code guard that can never go RED is itself a violation of this REQ

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

### REQ-CCR-09: `m2-copy`/`m2-copyin` Landing Sequence — Branch-Hold Boundary, Two Done-Definitions (owner ruling 4, extended 2026-07-22)

This change bundles two fixtures with DIFFERENT landing destinies, mirroring REQ-CCR-03's
PR#1/PR#2 precedent: `m2-copy` MUST land on `main` in a commit that ALSO lists it in
`corpus.json#fixtures` (REQ-CCR-04 atomicity) and MUST NOT depend on any `m2-copyin` artefact —
its PR is independently mergeable. `m2-copyin` MUST be fully authored (manifest, factory,
`assets/`, `expected/`, now 5 cases per the 2026-07-22 owner-ruling extension adding
`dest-dir-twin`) in the SAME change, but its landing commit MUST stay on an UNMERGED branch/PR —
`corpus.json#fixtures` on `main` MUST NOT list `m2-copyin` until the engine's `copyIn`
wire-inclusion is in flight (owner-accepted un-hold trigger).

Two SEPARATE done-definitions apply — neither substitutes for the other:

| | `m2-copy` (main) | `m2-copyin` (branch-held) |
|---|---|---|
| Landing | Merged to `main`, own commit, own `corpus.json` entry | Authored + committed on a named branch; commit NOT merged |
| `corpus.json` on `main` | Lists `m2-copy` | Does NOT list `m2-copyin` |
| `fit-40` on `main` | Green at the 6-fixture / 18-case checkpoint (REQ-CCR-05) | N/A on `main` — verified in ISOLATION on its own branch at 7 fixtures / 23 cases (REQ-CCR-09.4) |
| Un-hold trigger | N/A — already done | Engine `copyIn` wire-inclusion in flight |
| Re-validation before un-hold | N/A | The 5-item checklist below |
| Pending-changes registration at archive | N/A — delivered | Registers as an authored-but-held debt row (distinct debt type from a normal followup): branch name, un-hold trigger, the checklist below |

**Un-hold re-validation checklist (concrete, 2026-07-22)** — enumerated so an un-hold executor
reading only this debt row does not miss a step:

1. Rebase and re-validate `m2-copyin`'s commit against the THEN-current `conformance/` schema
   and REQ set (schema/REQs may have changed while held).
2. `fit-40` green at the THEN-current manifest-derived checkpoint (REQ-CCR-05) — not
   necessarily the 7-fixture/23-case figure frozen at authoring time, which may itself have
   shifted if further fixtures landed while `m2-copyin` was held.
3. Add `copyIn` to ALL `conformance-fixtures` REQ-CFX-17 sync sites (the README sentence, the
   DO-NOT-COPY clause (e) text, AND its regex) IN the un-hold commit — cross-referenced
   explicitly here because an un-hold executor reading only this row, not REQ-CFX-17 itself,
   must not miss it.
4. Confirm the engine's `copyIn` wire-inclusion is ACTUALLY in flight (the un-hold trigger
   itself) before merging.
5. Re-verify the two owner-pinned-but-engine-unconfirmed rejection codes against ACTUAL engine
   behaviour before treating them as settled: `m2-copy`'s `missing-source-twin`
   (`"not-found"`) AND `m2-copyin`'s `dest-dir-twin` (`"collision"`) — both are owner-confirmed
   CODE-READING declarations (ruling 3 / its 2026-07-22 extension), not yet
   engine-harness-proven.

#### Scenario REQ-CCR-09.1: m2-copy's PR never references an m2-copyin artefact

- GIVEN `m2-copy`'s merge commit to `main`
- WHEN its diff and factory imports are inspected
- THEN nothing under `conformance/m2-copyin/` is referenced or required for `m2-copy` to
  build/test green

#### Scenario REQ-CCR-09.2: m2-copyin's commit stays unmerged, corpus.json unchanged on main

- GIVEN the branch carrying `m2-copyin`'s full artefact set
- WHEN `main`'s `corpus.json#fixtures` is read
- THEN it does NOT list `m2-copyin` — the branch commit is not merged

#### Scenario REQ-CCR-09.3: Archive registers m2-copyin as authored-but-held debt, with the checklist attached

- GIVEN this change reaches `sdd-archive`
- WHEN `project/pending-changes` is reviewed
- THEN it carries an explicit row for `m2-copyin`: branch name, un-hold trigger (engine
  `copyIn` wire-inclusion in flight), AND the 5-item re-validation checklist above (verbatim
  or by reference) — never omitted as if `m2-copyin` were simply done

#### Scenario REQ-CCR-09.4: The held branch commit is independently testable at authoring time

- GIVEN `m2-copyin`'s branch commit, in isolation, before any un-hold
- WHEN `fit-40` runs against THAT branch's worktree
- THEN it is GREEN at 7 fixtures / 23 cases total (5 fixtures / 12 cases pre-existing +
  `m2-copy`'s 6 + `m2-copyin`'s 5) — "fully authored" is a TESTABLE claim distinguishing held
  DEBT (complete, verified, merely gated on timing) from unfinished work (which would fail
  this check)

## Sensitive Areas Coverage

No sensitive areas covered. `security (IPC)` was flagged low-confidence at triage and confirmed
NOT touched during explore: zero lines change in `src/transport/**`, `src/core/wire.ts`, or
`docs/engine-sdk-wire-spec.md` — this domain only adds plain data files read by an external Go
harness, never executed as production TS.
