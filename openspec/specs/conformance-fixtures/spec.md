# Conformance Fixtures Specification

**Spec version**: V4
**Status**: SIGNED (V4 — `conformance-writtenpaths-reconcile`: REQ-CFX-12 rewritten to the engine's committed-mutation-set `WrittenPaths` contract, REQ-CFX-09 pin updated; V3 re-signed by owner 2026-07-18 — see spec-summary.md log)
**Change**: `conformance-writtenpaths-reconcile`

## Purpose

Defines the behavioral contract for the five fixtures the engine drives through the real
runner: factories, cases (positive + negative twins), corpus-wide authoring constraints.
Registry-level concerns (`corpus.json`, structural invariants) live in `conformance-corpus`.

**Honesty boundary (read before the individual fixture REQs)**: this SDK deliverable is a
DECLARATION — manifest + factory + seed + expected artefacts describing what SHOULD happen.
Runner-driven outcomes (actual exit codes, actual transcripts, actual post-run workspace bytes)
are ENGINE-authoritative; see REQ-CFX-11. Acceptance scenarios for REQ-CFX-05 through REQ-CFX-09
therefore assert over the fixture's declared artefacts, not over a runner execution — this repo
has no runner-driven verification path for these fixtures.

## Requirements

### REQ-CFX-01: Factory Authoring Surface Allow-List

Every `factory.ts` MUST import the SDK ONLY via the public source umbrella
`../../src/index.ts` (relative source import, same convention as
`test/fake/conformance-corpus.ts`). A factory MUST NOT import `src/core/**`, `src/transport/**`,
`src/testing/**`, any I/O-capable Node builtin (`node:fs`, `node:net`, `node:child_process`),
call `fetch`, or read `process.env`. (Provenance: the handoff mandates the source-umbrella
import and the public-verbs-only convention; the explicit I/O/Node-builtin/`fetch`/`process.env`
ban is an SDK-imposed determinism guard THIS SPEC adds — it is not spelled out in the handoff
itself, but follows from "factories are loaded from source, never executed as production TS.")

#### Scenario REQ-CFX-01.1: Factory imports only the public umbrella

- GIVEN any `conformance/<id>/factory.ts`
- WHEN its import statements are inspected
- THEN the only SDK import is `../../src/index.ts` (or a named subpath re-exported from it)

#### Scenario REQ-CFX-01.2: A `node:fs` import is a violation

- GIVEN a factory importing `node:fs`
- WHEN checked against the allow-list
- THEN it violates REQ-CFX-01

### REQ-CFX-02: Representable-Ops-Only, Exactly One Wire `create` Corpus-Wide

Across the whole corpus, factories MUST author only `modify`/`delete`/`rename`/`move`/`copy`/
`copyIn` via the public commons verbs — `copy` and `copyIn` join the representable set per this
change, subject to REQ-CFX-17's branch-hold two-step (`copyIn` is representable-in-declaration
but its landing commit stays branch-held until the engine's `copyIn` wire-inclusion is in
flight). EXACTLY ONE case in the entire corpus — `m2-create-composition`'s
`wire-create-reject-twin` — MAY emit a wire `create` directive, as a deliberate reject probe. No
other case may emit `create`.

(Previously: representable set was `modify`/`delete`/`rename`/`move` only. This change adds
`copy`/`copyIn` per owner ruling 1/2 (2026-07-22) — the `create` exception is unchanged.)

#### Scenario REQ-CFX-02.1: Only one create exists corpus-wide

- GIVEN every case across every fixture CURRENTLY listed in `corpus.json#fixtures` (a
  manifest-derived count, never a hardcoded literal — consistent with `conformance-corpus`
  REQ-CCR-05's generalization)
- WHEN each factory's emitted directive ops are inspected
- THEN exactly one case (`m2-create-composition/wire-create-reject-twin`) emits `create`

### REQ-CFX-03: DO-NOT-COPY Header on the Reject-Probe Factory

The code path authoring the raw wire `create` in `wire-create-reject-twin` MUST carry a comment
beginning `DO-NOT-COPY` that conveys, at minimum: (a) this deliberately violates REQ-CFX-02's
one-create-corpus-wide invariant; (b) it exists as a reject PROBE, not a template; (c) it MUST
NOT be imitated by any other fixture; (d) the engine REFUSES this batch (`unrepresentable`,
REQ-CFX-04) — the exact exit path is resolved by ADR-0064 (2/unrepresentable/null, emit-time);
(e) what to copy INSTEAD when authoring a new fixture — the positive case's
`modify`/`delete`/`rename`/`move`/`copy`/`copyIn` default-export pattern, widening IN STEP with
REQ-CFX-02's representable set (REQ-CFX-17) — before `copyIn` un-holds, a new fixture wanting the
by-reference shape copies `m2-copy`'s already-merged pattern, not `m2-copyin`'s held one. A
CLAUSE LIST, not frozen prose — the exact wording is an implementation choice as long as all five
points are conveyed.

(Previously: clause (e) named only `modify`/`delete`/`rename`/`move`. This change widens it to
include `copy`/`copyIn` per REQ-CFX-02's expanded representable set, with the branch-hold caveat
for `copyIn` specifically.)

**Branch-hold clarification (spec-internal only, TW, 2026-07-22)**: the parenthetical guidance
above about `copyIn`'s branch-hold status (REQ-CFX-17) is guidance for THIS SPEC's readers and
for whoever authors a FUTURE fixture — it is NEVER text that belongs in the on-`main`
`DO-NOT-COPY` comment itself. At the `m2-copy`-landing step, the shipped comment's clause (e)
names ONLY `modify`/`delete`/`rename`/`move`/`copy` — no mention of `copyIn`, no
planning/sequencing noise of any kind. The comment is an EXTERNAL, on-disk contract read by any
engine-team member browsing the file; it states current fact, never roadmap.

**Resolution note (archive-time, carried from V3)**: exit path resolved by ADR-0064; the shipped
comment's assertion cites that ADR and is consistent.

#### Scenario REQ-CFX-03.1: Reject-probe code is marked with all five clauses

- GIVEN `m2-create-composition/factory.ts`'s `wire-create-reject-twin` branch
- WHEN read
- THEN a `DO-NOT-COPY`-prefixed comment precedes the raw `create` authoring and conveys clauses
  (a) through (e) — clause (e) naming the CURRENT representable set at the time of reading,
  never a stale one

### REQ-CFX-04: `manifest.json` Outcome Triple Internal Consistency

For every case, `outcome.exitCode`, `outcome.emitRejectionCode`, and `outcome.failedIndex` MUST
satisfy: `exitCode === 2` IF AND ONLY IF `emitRejectionCode !== null`; `failedIndex` MUST be an
integer when `emitRejectionCode` is a directive-level code (`not-found`, `collision`) and MUST
be `null` when `emitRejectionCode` is a batch-level code (`unrepresentable`).

#### Scenario REQ-CFX-04.1: exit 2 requires a non-null rejection code

- GIVEN a case with `outcome.exitCode: 2`
- WHEN `outcome.emitRejectionCode` is inspected
- THEN it is one of `collision`/`not-found`/`unrepresentable` (never `null`) — this enumeration
  is CORPUS-SCOPED (the three codes this corpus's fixtures exercise), not the full wire-spec
  `emitRejectionCode` enum (`docs/engine-sdk-wire-spec.md` WPS-08 also lists `cap`/`unknown`,
  neither of which any fixture in this corpus emits)

#### Scenario REQ-CFX-04.2: Batch-level code has no failedIndex

- GIVEN a case with `emitRejectionCode: "unrepresentable"`
- WHEN `outcome.failedIndex` is inspected
- THEN it is `null`

### REQ-CFX-05: `m1-vehicle` Behavioral Contract

`class: handshake`, `lowering: schematic`. Seed: none. Schematic:
`schema.json {"schema_version":"1","name":"m1","variables":[]}`, `files/out.txt = "v1"`. ONE
factory (`find("out.txt").read()` then `modify` to `"v2"`) MUST serve BOTH cases unmodified —
the engine flips `greetingVersion`, never the factory. Transcript pins for both cases live in
REQ-CFX-13 (this REQ owns bytes/exit/writtenPaths; REQ-CFX-13 owns the callback sequence).

| Case | greetingVersion | exitCode | expected | writtenPaths |
|---|---|---|---|---|
| positive | 1 | 0 | `out.txt = "v2"` | `["out.txt"]` |
| greeting-mismatch-twin | 2 | 1 | `"empty"` (zero files) | — |

#### Scenario REQ-CFX-05.1: Positive case's declared artefacts round-trip v1→v2

- GIVEN `m1-vehicle`'s manifest (greetingVersion 1) + schematic-staged `out.txt = "v1"` +
  `expected/out.txt`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/out.txt` byte-equals `"v2"`,
  `outcome.writtenPaths = ["out.txt"]` — a DECLARATION; runner-driven proof is engine-side
  (REQ-CFX-11)

#### Scenario REQ-CFX-05.2: Greeting-mismatch twin declares no authoring

- GIVEN the SAME factory referenced by the manifest, greeting-mismatch-twin (greetingVersion 2)
- WHEN the case's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 1`, `expected: "empty"` (zero files) — the
  factory itself is unchanged; only the declared greetingVersion differs

### REQ-CFX-06: `m2-modify` Behavioral Contract

`class: wire-mutation`, `lowering: none`. Seed: `target.txt = "orig"`, `sibling.txt = "keep"`.
Factory: `modify` of `target.txt` → `"replaced"`. `writtenPaths` pin: REQ-CFX-12.

| Case | exitCode | emitRejectionCode | failedIndex | expected |
|---|---|---|---|---|
| positive | 0 | null | null | `{target.txt: "replaced", sibling.txt: "keep"}` |
| not-found-twin | 2 | `not-found` | 0 | `"zero-effect"` (modify of `missing.txt`) |

#### Scenario REQ-CFX-06.1: Positive case declares a target-only replace

- GIVEN `m2-modify`'s manifest + seed (`target.txt`, `sibling.txt`) + `expected/`
- WHEN the fixture's declared artefacts are inspected
- THEN `outcome.exitCode: 0`, `expected/target.txt = "replaced"`, `expected/sibling.txt`
  byte-identical to seed

#### Scenario REQ-CFX-06.2: Not-found twin declares a zero-effect rejection

- GIVEN the not-found-twin's manifest entry targets `missing.txt`
- WHEN inspected
- THEN `outcome.exitCode: 2`, `emitRejectionCode: "not-found"`, `failedIndex: 0`,
  `expected: "zero-effect"` (both seed files, unchanged — REQ-CFX-10)

### REQ-CFX-07: `m2-delete` Behavioral Contract

`class: wire-mutation`, `lowering: none`. Seed: `target.txt = "gone"`, `sibling.txt = "keep"`,
`adir/child.txt = "x"`. Factory: `delete` of `target.txt`. `writtenPaths` pin: REQ-CFX-12.

| Case | exitCode | emitRejectionCode | failedIndex | expected |
|---|---|---|---|---|
| positive | 0 | null | null | `{sibling.txt, adir/child.txt}`, target absent |
| not-found-twin | 2 | `not-found` | 0 | `"zero-effect"` (delete of `missing.txt`) |
| dir-target-twin | 2 | `unrepresentable` | null | `"zero-effect"` (delete of `adir`) |

#### Scenario REQ-CFX-07.1: Positive case declares target-only removal

- GIVEN `m2-delete`'s manifest + 3-entry seed + `expected/`
- WHEN the fixture's declared artefacts are inspected
- THEN `outcome.exitCode: 0`, `expected/` omits `target.txt`, retains `sibling.txt` +
  `adir/child.txt` byte-identical to seed

#### Scenario REQ-CFX-07.2: Dir-target twin declares an unrepresentable rejection

- GIVEN the dir-target-twin's manifest entry targets `adir` (a directory)
- WHEN inspected
- THEN `outcome.exitCode: 2`, `emitRejectionCode: "unrepresentable"`, `failedIndex: null`
  (batch-level), `expected: "zero-effect"`

### REQ-CFX-08: `m2-rename-move` Behavioral Contract

`class: wire-mutation`, `lowering: none`. Seed: `src.txt = "payload"`, `occupied.txt = "taken"`,
`adir/child.txt = "x"`. Factory: `rename` of `src.txt` → `dst.txt` (or the wire-equivalent
`move` verb, IF design selects it and the resulting destination shape is identical).
`writtenPaths` pin: REQ-CFX-12.

| Case | exitCode | emitRejectionCode | failedIndex | expected |
|---|---|---|---|---|
| positive | 0 | null | null | `{dst.txt: "payload", occupied.txt: "taken", adir/child.txt: "x"}`, src absent |
| collision-twin | 2 | `collision` | 0 | `"zero-effect"` (dest = `occupied.txt`, no force) |
| dir-source-twin | 2 | `unrepresentable` | null | `"zero-effect"` (source = `adir`) |

(Previously: `collision-twin`'s `failedIndex` was documented as "present" without a value. V2
pins it to `0` — the single-directive batch of this factory has exactly one entry, so a
directive-level rejection always indexes it at 0, matching the `not-found-twin` pattern
elsewhere in the corpus.)

#### Scenario REQ-CFX-08.1: Positive case declares an exact-bytes rename

- GIVEN `m2-rename-move`'s manifest + seed (`src.txt = "payload"`) + `expected/`
- WHEN the fixture's declared artefacts are inspected
- THEN `outcome.exitCode: 0`, `expected/` omits `src.txt`, `expected/dst.txt` byte-equals
  `"payload"`

#### Scenario REQ-CFX-08.2: Collision twin declares a directive-level rejection

- GIVEN the collision-twin's manifest entry targets existing `occupied.txt`, no `force`
- WHEN inspected
- THEN `outcome.exitCode: 2`, `emitRejectionCode: "collision"`, `failedIndex: 0`,
  `expected: "zero-effect"`

### REQ-CFX-09: `m2-create-composition` Behavioral Contract

`class: composition`, `lowering: schematic`. Seed: `existing.txt = "orig"`. Schematic:
`schema.json {"schema_version":"1","name":"compose","variables":[]}`,
`files/generated.txt = "generated"` (the CREATE half comes from engine lowering — the factory
MUST NOT author it). Factory: `modify` of `existing.txt` → `"composed"`. `writtenPaths` pin:
REQ-CFX-12.

| Case | exitCode | emitRejectionCode | failedIndex | expected |
|---|---|---|---|---|
| positive | 0 | null | null | `{generated.txt: "generated", existing.txt: "composed"}`, `writtenPaths: ["existing.txt", "generated.txt"]` exactly |
| wire-create-reject-twin | **UNRESOLVED — see below** | `unrepresentable` | null | `"zero-effect"` |

**PRECONDITION for freezing `wire-create-reject-twin`'s outcome triple (design-blocking, not a
spec defect)**: the entire outcome triple `(exitCode, emitRejectionCode, failedIndex)` for this
twin — not just the exit digit — is contingent on an unresolved question: does the raw wire
`create` batch entry (REQ-CFX-02's sole exception) get intercepted CLIENT-SIDE before it ever
reaches emit (an `AuthoringError` with `origin: "authoring-rejected"` → **exit 1**, per
`docs/engine-sdk-wire-spec.md` EXC-01, and NO `ir.emit` call is ever issued), or does it reach
the host and get rejected AT emit time (an `IntentRejectedError` / emit-rejection → **exit 2**,
`unrepresentable`, batch-level, no `failedIndex`, WITH one `ir.emit` call issued and rejected)?
The handoff's literal text claims exit 2 (see the row above), but does not resolve WHICH client
code path the "raw wire create authored via normal create authoring or
`currentContext().session.buffer`" actually traverses. `sdd-design` MUST resolve this via ADR
BEFORE the triple is frozen for implementation. This does NOT block freezing the POSITIVE case
(unaffected) or the rest of this fixture's contract.

**Fail-closed clause**: any verification pass (in-loop, final, or the self-check) MUST treat an
UNRESOLVED outcome-triple placeholder as FAILED — never a silent pass. If design resolves the
path to client-side authoring-time rejection (exit 1), the handoff's exit-2 claim AS WRITTEN
becomes UNSATISFIABLE for this fixture — this MUST be escalated as a cross-repo followup to the
engine team (`project-builder-engine`), never silently adjusted in this corpus without that
escalation.

**Resolution note (archive-time)**: exit path resolved by ADR-0064 (2/unrepresentable/null,
emit-time); the temporal hedge is closed; the shipped comment's assertion cites that ADR and is
consistent.

**Transcript note (see REQ-CFX-13.4)**: whichever path design resolves this case to, this twin's
`transcript.callbacks[]` ends in `ir.discard` — `defineFactory`'s catch (`src/core/context.ts`)
runs on ANY error thrown from `fn`/`flush`/`commit`, so it fires identically whether the rejection
is thrown from inside `fn` (authoring-time) or from `flush()` (emit-time); only whether `ir.emit`
precedes `ir.discard` in the array differs by resolution. The EXIT-CODE resolution (1 vs 2) stays
the open question this REQ routes to `sdd-design`'s ADR — the discard fact does not resolve it.

#### Scenario REQ-CFX-09.1: Positive case declares one commit, two composed halves

- GIVEN `m2-create-composition`'s manifest + schematic-staged `generated.txt` + seed
  `existing.txt` + `expected/`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares a single `ir.commit` flush, `outcome.exitCode: 0`, both files at
  their final content in `expected/`, `outcome.writtenPaths = ["existing.txt", "generated.txt"]`

#### Scenario REQ-CFX-09.2: Reject-twin's outcome triple is pinned only after design resolves the path

- GIVEN the factory authors a raw `{op: "create", ...}` batch entry (REQ-CFX-02's sole exception)
- WHEN `sdd-design` resolves the authoring-time-vs-emit-time question via ADR
- THEN the manifest's `wire-create-reject-twin` outcome triple is pinned to the RESOLVED values
  (exit 1 + no `ir.emit` issued, OR exit 2 + `unrepresentable` + batch-level no `failedIndex`) —
  it MUST NOT remain the UNRESOLVED placeholder past that point

#### Scenario REQ-CFX-09.3: An unresolved triple fails verification, never passes silently

- GIVEN `wire-create-reject-twin`'s outcome triple is still UNRESOLVED at verification time
- WHEN any verify pass (in-loop, final, or the self-check) runs
- THEN it reports FAILED for this case — never a quiet pass

### REQ-CFX-10: Zero-Effect vs Empty Expected Semantics

`"zero-effect"` MUST mean: the post-run workspace's bytes are IDENTICAL to the pre-run seed
(used for reject cases whose seed is non-empty). `"empty"` MUST mean: the post-run workspace
contains ZERO files (used only when the case's own pre-run state is itself empty). These are
distinct values and MUST NOT be used interchangeably when authoring `manifest.json#cases[].expected`.

#### Scenario REQ-CFX-10.1: zero-effect on a non-empty seed keeps all seed files

- GIVEN `m2-modify`'s not-found-twin (seed: `target.txt`, `sibling.txt`)
- WHEN the case rejects
- THEN `expected: "zero-effect"` means both seed files remain, unchanged — NOT zero files

### REQ-CFX-11: Honesty Boundary — Runner-Driven Outcomes Are Engine-Authoritative

ALL runner-driven outcomes — exit codes, transcripts (callback sequences), and post-run
workspace effects — for every case in this corpus are ENGINE-authoritative: this SDK repo has
no runner-driven execution path to prove them. The SDK's deliverable IS the DECLARATION —
`manifest.json` + `factory.ts` + `seed/` + `expected/` describing the intended contract; the
structural self-check (`conformance-self-check`) proves the declaration is INTERNALLY
CONSISTENT and well-formed, never that the engine will actually produce these bytes/exit
codes/transcripts. This generalizes the schematic-bytes-specific rule below to the WHOLE
behavioral contract (REQ-CFX-05 through REQ-CFX-09's exit codes, transcripts, and workspace
effects included). `expected/` bytes for cases whose fixture has `lowering: schematic`
(`m1-vehicle`'s rendered `out.txt`, `m2-create-composition`'s `generated.txt`) MUST additionally
be documented as hand-authored against the manifest/handoff spec — no SDK-side schematic-
lowering implementation exists to prove those bytes either. Success criteria for this change
MUST NOT claim any of these values are SDK-verified in the runner-driven sense; first real
verification happens only when the engine's Go harness runs the fixture.

#### Scenario REQ-CFX-11.1: Schematic bytes are declared unverified SDK-side

- GIVEN `m1-vehicle/expected/out.txt` and `m2-create-composition/expected/generated.txt`
- WHEN the change's documentation/success-criteria is reviewed
- THEN both are explicitly marked engine-authoritative, not SDK-proven

#### Scenario REQ-CFX-11.2: Exit codes and transcripts are declared, not proven

- GIVEN any case's `outcome.exitCode` and `transcript.callbacks` in a landed `manifest.json`
- WHEN the change's success-criteria is reviewed
- THEN they are documented as the SDK's DECLARED contract, with engine-side execution as the
  only source of runner-driven proof — never claimed as SDK-verified behavior

**Informative note (not a REQ — read alongside the honesty boundary above)**: EVERY fixture run,
positive or negative, emits a `[pbuilder] factory at <dir>: no schema.json found — running
WITHOUT schema-derived input validation` warning to stderr. `validateAtRunBoundary`
(`src/core/context.ts`) checks for `schema.json` ADJACENT to the factory's own directory
(`schemaPathFor`, `src/core/schema/schema-discovery.ts`: `join(packageDir, "schema.json")`) — no
fixture in this corpus places one there; the two `lowering: schematic` fixtures' `schema.json`
lives at `schematic/schema.json`, a DIFFERENT path this check never consults. This warning is
EXPECTED, harmless output on every run — not a failure signal, and not something this corpus's
manifest or self-check makes any claim about. The engine team should not read its presence in a
fixture's stderr as a defect.

### REQ-CFX-12: `writtenPaths` Rule — Committed-Mutation Set (all six op classes)

`outcome.writtenPaths` for a case MUST list **every workspace-relative path touched by a committed
mutation during the run** — derived from the committed set across all six op classes
(`create` / `modify` / `rename` / `delete` / `copyIn` / `copy`), **including engine-side
schematic-lowered `create` staging** — deduplicated and **sorted** (the self-check and the engine
harness compare positionally, so order is part of the contract). This mirrors the engine's
`Result.WrittenPaths` contract (`project-builder-engine`, `mutation-event-streaming`): *"every
`Success==true` committed entry's `Op.Path`, deduplicated and sorted, covering all six
`PlannedOp.Class` values — unlike the old pre-run `OpCreate`-only batch."*

Per-op-class semantics (engine-confirmed, code-grounded):

- A committed `modify` or `delete` lists its target path. A `delete` lists the **removed** path —
  the contract is the committed *set*, not "bytes written".
- A committed `rename`/`move` lists **only the destination** path. The source becomes a moved-away
  tombstone (`StatusMovedAway`) that `PlanOf` skips and never enters the committed journal, so
  `WrittenPaths` never sees it.
- A `create` followed by a `modify` of the **same** path deduplicates to a single entry.
- A rejected or discarded run commits nothing, so its `writtenPaths` is `[]`.

Pinned values, every positive case: `m1-vehicle` = `["out.txt"]` (schematic-lowered `create` of
`out.txt` + factory `modify` of the same `out.txt` → deduped to one entry); `m2-modify` =
`["target.txt"]`; `m2-delete` = `["target.txt"]`; `m2-rename-move` = `["dst.txt"]`;
`m2-create-composition` = `["existing.txt", "generated.txt"]` (schematic-lowered `create` of
`generated.txt` + factory `modify` of `existing.txt`, sorted). Each committed case of `m2-copy`
and `m2-copyin` lists its `copy`/`copyIn` **destination** (the by-reference `assets/` source is
read, never written, so it is absent): `m2-copy` positive = `["dst.txt"]`, collision-with-force =
`["occupied.txt"]`, copy-then-modify = `["dst2.txt"]`; `m2-copyin` positive = `["dst.txt"]`,
verbatim-content = `["dst2.txt"]`, collision-with-force = `["occupied.txt"]`. Every negative twin =
`[]`.

#### Scenario REQ-CFX-12.1: Same-path create+modify deduplicates to one entry

- GIVEN `m1-vehicle`'s positive case (schematic-lowered `create` of `out.txt`, then a factory
  `modify` of `out.txt`)
- WHEN `outcome.writtenPaths` is inspected
- THEN it equals `["out.txt"]` exactly — the two committed mutations on the same path deduplicate

#### Scenario REQ-CFX-12.2: Wire-mutation positive cases pin their committed target path

- GIVEN `m2-modify` (modify `target.txt`), `m2-delete` (delete `target.txt`), or `m2-rename-move`
  (rename `src.txt` → `dst.txt`) positive case
- WHEN `outcome.writtenPaths` is inspected
- THEN `m2-modify` = `["target.txt"]`, `m2-delete` = `["target.txt"]`, `m2-rename-move` =
  `["dst.txt"]` — the rename lists the destination only; its source is absent (moved-away tombstone)

### REQ-CFX-13: Transcript Oracle — Every Case Carries a Full `transcript` Object

For EVERY case (positive and negative twin) in EVERY fixture's `manifest.json`,
`cases[].transcript` MUST be present with the full shape: ordered `callbacks[]` (the
reverse-callback methods ISSUED during the run, in order, regardless of whether the response was
success or rejection — a rejected `ir.emit` still counts as issued), `singleCommit` (boolean),
`forbidDiscard` (boolean), `emitBeforeCommit` (boolean).

A REJECTED run does NOT simply halt at the rejected callback: `defineFactory`'s catch
(`src/core/context.ts` ~339-361, ADR-01, all-or-nothing teardown) unconditionally runs `await
ctx.session.discard()` on ANY error thrown by `fn`, `dialects.drain()`, `session.flush()`, or
`session.commit()` before re-throwing. `Session.discard()` (`src/core/session.ts`) delegates to
the client's `discard()`, which for `StdioEngineClient` (`src/transport/stdio-engine-client.ts`
~283-284) issues an `ir.discard` reverse callback. A rejected case's transcript therefore ends in
`ir.discard`, not in the rejected `ir.emit`. A batch carrying MULTIPLE directives that all
succeed (e.g. `m2-copy`'s `copy-then-modify` case, or `m2-create-composition`'s two composed
halves) is still flushed via a SINGLE `ir.emit` covering the whole directive array — the engine
applies the array's entries STRICTLY SEQUENTIALLY in array order (engine-confirmed, ruling 3(b))
— so `copy-then-modify`'s transcript has the SAME shape as any other single-commit positive case,
not a doubled `ir.emit`. `singleCommit` and `emitBeforeCommit` therefore pin `true` for all cases
in the corpus (vacuously true wherever the callback in question never occurs). `forbidDiscard`
pins `true` only for cases whose run reaches `ir.commit` without any prior rejection plus
`greeting-mismatch-twin` (decided pre-`defineFactory`) — it pins `false` for every case whose run
rejects mid-flight. `callbacks[]` and `forbidDiscard` both vary per case:

| Fixture / Case | `callbacks[]` | `forbidDiscard` |
|---|---|---|
| m1-vehicle / positive | `[tree.read, ir.emit, ir.commit]` | `true` |
| m1-vehicle / greeting-mismatch-twin | `[]` (decided pre-`defineFactory`, no session) | `true` |
| m2-modify / positive | `[ir.emit, ir.commit]` | `true` |
| m2-modify / not-found-twin | `[ir.emit, ir.discard]` | `false` |
| m2-delete / positive | `[ir.emit, ir.commit]` | `true` |
| m2-delete / not-found-twin | `[ir.emit, ir.discard]` | `false` |
| m2-delete / dir-target-twin | `[ir.emit, ir.discard]` | `false` |
| m2-rename-move / positive | `[ir.emit, ir.commit]` | `true` |
| m2-rename-move / collision-twin | `[ir.emit, ir.discard]` | `false` |
| m2-rename-move / dir-source-twin | `[ir.emit, ir.discard]` | `false` |
| m2-create-composition / positive | `[ir.emit, ir.commit]` | `true` |
| m2-create-composition / wire-create-reject-twin | `[ir.emit, ir.discard]` IF resolved to the exit-2 emit-time path; `[ir.discard]` IF resolved to the exit-1 authoring-time path (see REQ-CFX-09) | `false` (either resolution) |
| m2-copy / positive | `[ir.emit, ir.commit]` | `true` |
| m2-copy / collision-with-force | `[ir.emit, ir.commit]` | `true` |
| m2-copy / collision-no-force-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copy / missing-source-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copy / dir-source-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copy / copy-then-modify | `[ir.emit, ir.commit]` (ONE flush, two directives applied in array order) | `true` |
| m2-copyin / positive | `[ir.emit, ir.commit]` | `true` |
| m2-copyin / verbatim-content | `[ir.emit, ir.commit]` | `true` |
| m2-copyin / collision-with-force | `[ir.emit, ir.commit]` | `true` |
| m2-copyin / collision-no-force-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copyin / dest-dir-twin | `[ir.emit, ir.discard]` | `false` |

`tree.read` appears ONLY in `m1-vehicle`'s positive case — no other factory in the corpus,
including `m2-copy`/`m2-copyin`, reads before authoring the directive.

(Previously: table did not include `m2-copy`/`m2-copyin` rows, and the prose did not describe
multi-directive single-flush sequencing. Both added by this change; the six pre-existing rows and
their rationale are unchanged. V2 adds the `m2-copyin / dest-dir-twin` row per the 2026-07-22
owner-ruling extension — a directive-level rejection, same shape as every other
directive-level twin in this table.)

#### Scenario REQ-CFX-13.1: A wire-mutation positive case's transcript is single-emit-single-commit

- GIVEN `m2-modify`'s positive case
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]`, `singleCommit: true`, `forbidDiscard: true`,
  `emitBeforeCommit: true`

#### Scenario REQ-CFX-13.2: A directive-level reject twin's transcript ends in a discard, not a halt

- GIVEN `m2-modify`'s not-found-twin
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]`, `singleCommit: true` (vacuously), `forbidDiscard:
  false`, `emitBeforeCommit: true` (vacuously)

#### Scenario REQ-CFX-13.3: A batch-level reject twin discards identically to a directive-level one

- GIVEN `m2-delete`'s `dir-target-twin` (batch-level `unrepresentable`, `failedIndex: null`)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]` and `forbidDiscard: false`, identically to a
  directive-level twin

#### Scenario REQ-CFX-13.4: wire-create-reject-twin discards under either exit-path resolution

- GIVEN `m2-create-composition`'s `wire-create-reject-twin`
- WHEN `cases[].transcript` is inspected under EITHER candidate resolution
- THEN `ir.discard` is present as the LAST callback in both cases and `forbidDiscard: false` in
  both

#### Scenario REQ-CFX-13.5: A two-directive positive batch is a single flush, not a doubled emit

- GIVEN `m2-copy`'s `copy-then-modify` case (one batch, `copy` then `modify` on the same dest)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]` exactly once each — the two directives share ONE
  flush, applied sequentially in array order (ruling 3(b)), never two `ir.emit` calls

### REQ-CFX-14: Factory Build Isolation and Export Convention

Every `factory.ts` MUST `export default` its factory function (a named export requires an
explicit `"factory": {"export": "name"}` in the manifest — avoid unless necessary, per the
handoff). `conformance/**` MUST sit OUTSIDE `bun run build` output — factories are loaded from
SOURCE by Bun at runner-spawn time, never bundled — and `bun install --frozen-lockfile && bun
run build` MUST stay green with `conformance/` present in the tree (handoff delivery-item 2).

#### Scenario REQ-CFX-14.1: Build stays green with the corpus present

- GIVEN `conformance/` landed at repo root
- WHEN `bun install --frozen-lockfile && bun run build` runs
- THEN it exits 0 and no `conformance/**` file appears in the build output tree

### REQ-CFX-15: `m2-copy` Behavioral Contract (owner ruling 1, 2026-07-22)

`class: wire-mutation`, `lowering: none`. Seed: `src.txt = "payload"`, `occupied.txt = "taken"`,
`adir/child.txt = "x"` (mirrors `m2-rename-move`'s seed, ADR-0065 per-case `factory` override).
UNLIKE `rename`/`move`, `copy`'s positive case MUST leave the source path INTACT — the
destination receives a byte-identical copy; the source is NEVER removed. `writtenPaths` pin:
REQ-CFX-12 (`[]` for every case — pure wire-mutation, no schematic lowering, per ruling 3(a)).

| Case | exitCode | emitRejectionCode | failedIndex | expected | notes |
|---|---|---|---|---|---|
| positive | 0 | null | null | `dst.txt="payload"`, `src.txt="payload"` (unchanged), `occupied.txt="taken"`, `adir/child.txt="x"` | source survives the copy |
| collision-with-force | 0 | null | null | `occupied.txt="payload"` (overwritten), `src.txt` unchanged | `force:true` targets an existing destination |
| collision-no-force-twin | 2 | `collision` | 0 | `"zero-effect"` | dest = `occupied.txt`, no `force` |
| missing-source-twin | 2 | `not-found` | 0 | `"zero-effect"` | source = `missing.txt` |
| dir-source-twin | 2 | `unrepresentable` | null | `"zero-effect"` | source = `adir` (a directory) |
| copy-then-modify | 0 | null | null | final dest bytes = the MODIFY directive's content, never the copy's | ONE batch, two directives: `copy(src→dst2)` then `modify(dst2,…)`; intra-batch apply is STRICTLY SEQUENTIAL in array order (engine-confirmed, ruling 3(b)) — proves array-order collapse, not a race |

#### Scenario REQ-CFX-15.1: Positive case declares an exact-bytes copy, source intact

- GIVEN `m2-copy`'s manifest + seed (`src.txt = "payload"`) + `expected/`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN `outcome.exitCode: 0`, `expected/dst.txt` byte-equals `"payload"`, `expected/src.txt`
  ALSO byte-equals `"payload"` (source never removed) — a DECLARATION (REQ-CFX-11)

#### Scenario REQ-CFX-15.2: Collision-with-force overwrites and exits 0

- GIVEN the collision-with-force case targets existing `occupied.txt` with `force:true`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/occupied.txt` byte-equals the
  source's content — a DECLARATION (REQ-CFX-11)

#### Scenario REQ-CFX-15.3: Collision-no-force twin rejects fail-closed

- GIVEN the collision-no-force-twin targets existing `occupied.txt`, no `force`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "collision"`,
  `failedIndex: 0`, `expected: "zero-effect"`

#### Scenario REQ-CFX-15.4: Missing-source twin rejects not-found

- GIVEN the missing-source-twin's source path does not exist in the seed
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "not-found"`,
  `failedIndex: 0`, `expected: "zero-effect"`

#### Scenario REQ-CFX-15.5: Directory-source twin rejects unrepresentable

- GIVEN the dir-source-twin's source is `adir` (a directory)
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "unrepresentable"`,
  `failedIndex: null` (batch-level), `expected: "zero-effect"`

#### Scenario REQ-CFX-15.6: Copy-then-modify collapses to the modify's bytes (declaration, not a runtime claim)

- GIVEN a single batch authoring `copy(src→dst2)` immediately followed by
  `modify(dst2, "final")` in the SAME array
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/dst2.txt` byte-equals `"final"`
  (the modify's content, never the copy's intermediate bytes) — the collapse is a DECLARATION
  traced from the engine-confirmed sequential array-order fact (ruling 3(b)), not an SDK-run
  proof; one flush, `singleCommit: true`

### REQ-CFX-16: `m2-copyin` Behavioral Contract — Engine-Plane Cases Only (owner ruling 2, extended 2026-07-22)

`class: wire-mutation`, `lowering: none`. Structurally novel: introduces a PACKAGE-LOCAL
in-fixture source directory (`assets/`) — the bytes `copyIn` references live INSIDE the fixture
package itself, resolved against `packageDir` = the fixture's own directory. [SEAM] The engine's
Go fixture loader treats unknown files/dirs inside a fixture dir as INERT (engine-confirmed,
ruling 3(c)) — an in-fixture `assets/` source needs ZERO schema changes; flagged for engine-team
awareness, same posture as `conformance-corpus` REQ-CCR-08's `collection.json` note. 5
engine-plane cases are in scope (extended from 4 by the 2026-07-22 owner-ruling addition of
`dest-dir-twin`) — SDK-plane twins remain explicitly DESCOPED (see Followups; a deliberate,
recorded exclusion, never a silent gap). The fixture id `m2-copyin` is DELIBERATELY a single
token — `copyIn` is ONE verb, not a compound `copy` + `in` operation — a future reader MUST NOT
"correct" it to `m2-copy-in`, which would falsely echo the two-op `m2-rename-move` fixture's
naming shape (that fixture names two DISTINCT verbs; this one names one).

**Fixture layout (bytes pinned to the exact byte, mirroring REQ-CFX-15's precision)**:

- `assets/payload.txt = "by-reference-payload"` — package-local by-reference source (used by
  `positive`, `collision-with-force`, `dest-dir-twin`)
- `assets/verbatim.txt = "Hello {= name =}!"` — contains a literal template-token sequence in
  the `folder-scaffold` REQ-FSC-05 syntax (ground truth: REQ-FSC-05's token-translation form is
  `{= x =}` / `{= x | filter =}`), used only by `verbatim-content`
- `seed/occupied.txt = "taken"` — pre-existing destination for the collision cases
- `seed/existing-dir/child.txt = "x"` — a pre-existing DIRECTORY at the path `dest-dir-twin`
  targets as its destination

| Case | exitCode | emitRejectionCode | failedIndex | expected | notes |
|---|---|---|---|---|---|
| positive | 0 | null | null | `dst.txt = "by-reference-payload"`; `occupied.txt`/`existing-dir/child.txt` unchanged | dest is a genuinely NEW path — see REQ-CFX-12 |
| verbatim-content | 0 | null | null | `dst2.txt = "Hello {= name =}!"` byte-identical, token present verbatim | proves REQ-CCL-04's documented escape; fit-40 MUST assert token PRESENCE in both source and expected — byte-equality alone is tautological (Scenario .2) |
| collision-with-force | 0 | null | null | `occupied.txt = "by-reference-payload"` (overwritten) | `force:true` |
| collision-no-force-twin | 2 | `collision` | 0 | `"zero-effect"` | dest = `occupied.txt`, no `force` |
| dest-dir-twin | 2 | `collision` | 0 | `"zero-effect"` | dest = `existing-dir` (an existing DIRECTORY in seed) — owner-confirmed: the engine treats a directory destination as a DESTINATION COLLISION, indexed to directive 0, NOT `unrepresentable` |

**This is `copyIn`'s ONLY engine-plane rejection twin.** `copyIn` has NO `unrepresentable`-coded
twin in this corpus, unlike `m2-copy`'s directory-SOURCE case — a reviewer MUST NOT read that
absence as a gap: a directory SOURCE is rejected SDK-side pre-emit (source-side,
`authoring-rejected`, descoped below, never reaches the engine), while a directory DESTINATION
is the one case that DOES reach the engine, and the engine resolves it to `collision`, never
`unrepresentable`.

**Descope note (owner ruling 2, non-gating)**: SOURCE-side rejections
(containment-escape, missing-source, a directory SOURCE) are SDK-plane — declared
`(1,null,null,[])` + empty transcript, `AuthoringError.origin: "authoring-rejected"` before any
emit — and remain explicitly DESCOPED from this corpus (see Followups). Only the
DESTINATION-side cases (collision-with-force/no-force/dest-dir) are engine-plane and therefore
fixture-worthy.

`writtenPaths` pin: REQ-CFX-12 (`[]` for every exit-0 case, including `positive`, whose
destination is a genuinely new path — see REQ-CFX-12's tightened governing clause).

#### Scenario REQ-CFX-16.1: Positive case declares by-reference bytes landing at a new path

- GIVEN `m2-copyin`'s manifest + `assets/payload.txt = "by-reference-payload"` + `expected/`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/dst.txt` byte-equals
  `"by-reference-payload"`, `outcome.writtenPaths: []` — a DECLARATION (REQ-CFX-11); the first
  real proof is the engine's Go harness at pin-advance

#### Scenario REQ-CFX-16.2: Verbatim-content case declares the token present, unrendered, in BOTH source and expected

- GIVEN `assets/verbatim.txt = "Hello {= name =}!"` (a REQ-FSC-05-shaped token)
- WHEN the fixture's declared artefacts are inspected
- THEN `expected/dst2.txt` is byte-IDENTICAL to the source AND both are asserted to contain the
  literal `{= name =}` sequence — token PRESENCE, not byte-equality alone (an
  `expected == source` check alone would pass even for an unrelated file pair; the token proves
  by-reference bypasses the by-value template engine that would otherwise have rendered it)

#### Scenario REQ-CFX-16.3: Collision-with-force overwrites and exits 0

- GIVEN the collision-with-force case targets existing `occupied.txt = "taken"` with
  `force:true`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 0`, `expected/occupied.txt` byte-equals
  `"by-reference-payload"`

#### Scenario REQ-CFX-16.4: Collision-no-force twin rejects fail-closed

- GIVEN the collision-no-force-twin targets existing `occupied.txt`, no `force`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "collision"`,
  `failedIndex: 0`, `expected: "zero-effect"`

#### Scenario REQ-CFX-16.5: Dest-dir twin rejects as a collision, never unrepresentable

- GIVEN the dest-dir-twin targets `existing-dir`, a pre-existing DIRECTORY in `seed/`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "collision"`
  (owner-confirmed engine behaviour — NOT `unrepresentable`), `failedIndex: 0`,
  `expected: "zero-effect"`

### REQ-CFX-17: Representable-Ops Sync Sites — Consistency and Branch-Hold Two-Step

Widening the corpus's representable-ops set MUST update, in the SAME commit that widens it,
every site that ENFORCEABLY documents the current op set: (a) `conformance/README.md`'s
representable-ops sentence; (b) `m2-create-composition/factory.ts`'s DO-NOT-COPY clause (e)
("what to copy instead", REQ-CFX-03); (c) `fit-40`'s clause-(e) consistency check — which MUST
itself be TIGHTENED in the same commit, not merely re-read. `fit-40`'s existing clause-(e) check
(`test/fitness/fit-40-conformance-corpus-integrity.test.ts` ~line 296) is a PREFIX regex
(`/modify\/delete\/rename\/move/`) that matches a SUBSTRING of clause (e)'s text and therefore
stays green whether or not `copy`/`copyIn` are present — as WRITTEN TODAY its enforcement of a
widened set is illusory (verified by reading the check: it never asserts the ABSENCE of
anything, only the presence of the original four verbs). This change's landing steps MUST
tighten the regex alongside the clause text: the `m2-copy`-landing commit requires the regex to
positively match `copy`'s presence (e.g. `/move\/copy/` or equivalent), and `m2-copyin`'s
un-hold commit requires it to additionally match `copyIn`'s presence — widening clause (e)'s
prose WITHOUT correspondingly tightening the regex does NOT satisfy this REQ.

Because this change's two fixtures land on DIFFERENT schedules (REQ-CCR-09): `copy` MUST be
added to every sync site (README, clause (e) text, and its regex) in the SAME commit `m2-copy`
lands on `main`; `copyIn` MUST NOT be added to ANY sync site until the commit that un-holds
`m2-copyin` from its branch — a sync site claiming `copyIn` representable while `m2-copyin`'s
commit is still branch-held is a false declaration, worse than an omission.

**Not sync sites (verified, this REQ does NOT extend to them)**: the SDK's author-facing verb
docs — `docs/README.md:9`, `docs/quickstart.md` (Next Steps, ~line 179-180), and
`docs/authoring-verbs.md:9` — already enumerate `copy`/`copyIn` among the SDK's seven author
verbs. This is an AUTHOR-SURFACE enumeration (what verbs exist to call), NOT a
wire-representability contract (what this corpus declares the engine can actually land) — the
two claims serve different audiences, and holding the docs to this REQ's sync discipline would
conflate them. This is PRE-EXISTING drift (the docs already present `copyIn` as fully working
while it yields zero bytes pre-engine-inclusion), not introduced by this change — see Followups
for its disposition. `CONFORMANCE-CORPUS-HANDOFF.md:96-97` references "the representable-ops-only
quarantine" by NAME only, without enumerating the actual op list — it cannot go stale as the set
widens and is therefore not a sync site either.

#### Scenario REQ-CFX-17.1: `copy` lands in every sync site, regex included, with `m2-copy`'s commit

- GIVEN the commit that lands `m2-copy` on `main`
- WHEN README, the DO-NOT-COPY clause (e) text, and `fit-40`'s clause-(e) regex are read
- THEN all three name/match `copy` as representable, in that SAME commit — the regex change is
  not deferred to a later cleanup commit

#### Scenario REQ-CFX-17.2: `copyIn` is absent from every sync site while branch-held — enforced by commit sequencing, not a test guard

- GIVEN `main` at any point before `m2-copyin`'s un-hold commit merges
- WHEN the same three sync sites are read
- THEN none of them names/matches `copyIn` as representable — this is enforced ENTIRELY by
  which commits have merged (commit sequencing); NO `fit-40` assertion polices a
  must-NOT-appear guard for `copyIn`, and none should be assumed to exist

## Sensitive Areas Coverage

No sensitive areas covered. Factories run under the real runner only when the ENGINE spawns it
(out of this repo's control); no production `src/transport/**` code changes.

## Open Technical Questions (routed to `sdd-design`)

- `wire-create-reject-twin`'s real exit path (authoring-time exit 1 vs emit-time exit 2) — see
  REQ-CFX-09's precondition and REQ-CFX-13's conditional `callbacks[]` row (V3: `[ir.discard]` vs
  `[ir.emit, ir.discard]` — `ir.discard` now confirmed present under EITHER resolution; only
  whether `ir.emit` precedes it remains open). This is the SAME open question as V1/V2, now
  stated as a hard precondition rather than a soft "correctness-grade flag" (QA blind-review
  finding QA-B1).
- Whether the engine CLEANS pre-staged schematic files on a greeting-time exit-1 (e.g.
  `m1-vehicle`'s `greeting-mismatch-twin`: `out.txt` is pre-staged by schematic lowering before
  the greeting check runs, yet `expected: "empty"` declares zero files post-run) — design must
  confirm whether "empty" describes the COMMITTED workspace only, or whether the engine also
  removes physically pre-staged-but-uncommitted files on this exit path.
