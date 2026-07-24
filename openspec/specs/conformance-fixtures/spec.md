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

Across the whole corpus, factories MUST author only `modify`/`delete`/`rename`/`move` via the
public commons verbs. EXACTLY ONE case in the entire corpus — `m2-create-composition`'s
`wire-create-reject-twin` — MAY emit a wire `create` directive, as a deliberate reject probe. No
other case may emit `create`.

#### Scenario REQ-CFX-02.1: Only one create exists corpus-wide

- GIVEN all 12 cases across the 5 fixtures
- WHEN each factory's emitted directive ops are inspected
- THEN exactly one case (`m2-create-composition/wire-create-reject-twin`) emits `create`

### REQ-CFX-03: DO-NOT-COPY Header on the Reject-Probe Factory

The code path authoring the raw wire `create` in `wire-create-reject-twin` MUST carry a comment
beginning `DO-NOT-COPY` that conveys, at minimum: (a) this deliberately violates REQ-CFX-02's
one-create-corpus-wide invariant; (b) it exists as a reject PROBE, not a template; (c) it MUST
NOT be imitated by any other fixture; (d) the engine REFUSES this batch (`unrepresentable`,
REQ-CFX-04) — the exact exit path (client-side authoring-time exit 1, or host-side emit-time exit
2) is the open question REQ-CFX-09 routes to `sdd-design`'s ADR, so the comment MUST NOT assert a
specific exit code as settled fact ahead of that ADR; (e) what to copy INSTEAD when authoring a
new fixture — the positive case's `modify`/`delete`/`rename`/`move` default-export pattern. A
CLAUSE LIST, not frozen prose — the exact wording is an implementation choice as long as all five
points are conveyed. (Provenance note: this is an in-repo hygiene convention this spec proposes,
not a handoff-mandated requirement — REQ-CFX-02 already guards the invariant structurally;
`sdd-design`/the owner MAY demote this from MUST to advisory if judged unnecessary.)

(Previously: a single unstructured paragraph naming only clauses (a)-(c). V3 folds in (d) and (e)
per evidence review — (d)'s wording is deliberately hedged against REQ-CFX-09's still-open
exit-path question rather than asserting "exit 2" as the literal correction text proposed, since
that would freeze an unresolved design question inside a code comment.)

**Resolution note (archive-time)**: exit path resolved by ADR-0064 (2/unrepresentable/null,
emit-time); the temporal hedge in clause (d) is closed; the shipped comment's assertion cites
that ADR and is consistent.

#### Scenario REQ-CFX-03.1: Reject-probe code is marked with all five clauses

- GIVEN `m2-create-composition/factory.ts`'s `wire-create-reject-twin` branch
- WHEN read
- THEN a `DO-NOT-COPY`-prefixed comment precedes the raw `create` authoring and conveys clauses
  (a) through (e) — including that the engine refuses the batch and what to copy instead, without
  asserting a specific exit code the ADR has not yet resolved

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
`generated.txt` + factory `modify` of `existing.txt`, sorted). Every negative twin = `[]`.

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
`ir.discard`, not in the rejected `ir.emit` — the run does not halt before a subsequent callback,
it discards. No fixture in this corpus exercises a DOUBLE-commit, and every case that reaches
`ir.commit` does so strictly after its `ir.emit`; `singleCommit` and `emitBeforeCommit` therefore
pin `true` for all 12 cases (vacuously true wherever the callback in question never occurs).
`forbidDiscard` is NOT uniformly `true`: it pins `true` only for cases whose run reaches
`ir.commit` without any prior rejection (every POSITIVE case) plus `greeting-mismatch-twin`
(whose exit-1 greeting failure is decided before `defineFactory` is ever invoked, so no `Session`
exists to discard) — it pins `false` for every case whose run rejects mid-flight, since
`ir.discard` DOES fire for those. `callbacks[]` and `forbidDiscard` both vary per case:

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
| m2-create-composition / wire-create-reject-twin | `[ir.emit, ir.discard]` IF resolved to the exit-2 emit-time path; `[ir.discard]` IF resolved to the exit-1 authoring-time path (see REQ-CFX-09 — EITHER WAY `defineFactory`'s catch fires and issues `ir.discard`, since an authoring-time rejection is thrown from inside `fn`, which the SAME try block covers alongside `flush`/`commit`; only whether `ir.emit` was reached first differs) | `false` (either resolution) |

`tree.read` appears ONLY in `m1-vehicle`'s positive case — the sole factory whose handoff
description calls `.read()`; no other factory in the corpus reads before authoring (verified
against each fixture's own factory contract in REQ-CFX-05 through REQ-CFX-09: none of the six
corrected rows' factories call `.read()` before authoring the directive that gets rejected).

(Previously: claimed "the run halts before any subsequent callback" and "No fixture in this
corpus exercises ... an `ir.discard` call" — both FALSE. `defineFactory`'s catch calls
`ctx.session.discard()` on every flush/emit rejection, and `Session.discard()` issues `ir.discard`
via the client. V3 corrects the six reject-twin rows above per code verification —
`src/core/context.ts` ~339-361, `src/core/session.ts` ~51-53, `src/transport/stdio-engine-client.ts`
~283-284 — and removes the false universal `forbidDiscard: true` pin.)

#### Scenario REQ-CFX-13.1: A wire-mutation positive case's transcript is single-emit-single-commit

- GIVEN `m2-modify`'s positive case
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]`, `singleCommit: true`, `forbidDiscard: true`,
  `emitBeforeCommit: true`

#### Scenario REQ-CFX-13.2: A directive-level reject twin's transcript ends in a discard, not a halt

- GIVEN `m2-modify`'s not-found-twin
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]` (the rejected `ir.emit` triggers `defineFactory`'s
  all-or-nothing teardown, which issues `ir.discard` before re-throwing — the run does NOT
  silently stop at the rejected `ir.emit`), `singleCommit: true` (vacuously — zero commits),
  `forbidDiscard: false`, `emitBeforeCommit: true` (vacuously)

#### Scenario REQ-CFX-13.3: A batch-level reject twin discards identically to a directive-level one

- GIVEN `m2-delete`'s `dir-target-twin` (batch-level `unrepresentable`, `failedIndex: null`)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]` and `forbidDiscard: false`, identically to a
  directive-level twin — the discard trigger is ANY flush/emit rejection, not conditioned on
  whether the rejection is directive-level or batch-level

#### Scenario REQ-CFX-13.4: wire-create-reject-twin discards under either exit-path resolution

- GIVEN `m2-create-composition`'s `wire-create-reject-twin`, whose outcome triple is UNRESOLVED
  pending `sdd-design`'s ADR (REQ-CFX-09)
- WHEN `cases[].transcript` is inspected under EITHER candidate resolution
- THEN `ir.discard` is present as the LAST callback in both cases and `forbidDiscard: false` in
  both — `defineFactory`'s catch covers an error thrown during `fn` execution (the authoring-time
  path) exactly as it covers an error thrown by `flush()` (the emit-time path); only whether
  `ir.emit` precedes `ir.discard` in `callbacks[]` remains open until the ADR resolves it

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
