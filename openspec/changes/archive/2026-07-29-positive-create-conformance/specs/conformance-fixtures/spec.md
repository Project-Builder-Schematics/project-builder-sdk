# Delta for Conformance Fixtures

**Change**: `positive-create-conformance`
**Base spec version**: V4 (`openspec/specs/conformance-fixtures/spec.md`)

## MODIFIED Requirements

### Requirement: Representable-Ops-Only, Wire `create` Quarantined To One Sanctioned Site

Across the whole corpus, factories MUST author only `modify`/`delete`/`rename`/`move`/`copy`/
`copyIn` via the public commons verbs, PLUS wire `create` — but `create` MUST be authored ONLY
inside `m2-create-composition/factory.ts`'s quarantined named-export blocks (the ADR-0065
case-level `factory` override mechanism), never via any fixture's default-export factory and
never from any file outside that one sanctioned site. `wire-create-reject-twin` is one such
quarantined case (a deliberate reject probe); any number of ADDITIONAL positive create cases MAY
be quarantined in the SAME sanctioned file, each authored via its own named export. No case
OUTSIDE the sanctioned file's quarantine may ever emit `create`.

(Previously: EXACTLY ONE case in the entire corpus — `wire-create-reject-twin` — was permitted
to emit `create`; no positive create case existed and the invariant was framed as a corpus-wide
cardinality ceiling of one. This change relaxes that ceiling from "exactly one case,
corpus-wide" to "any number of cases, but only inside one sanctioned file's quarantine," per the
engine's `sdk-wire-create` handoff — obs #1695 — making the wire op generally representable and
requiring the SDK corpus to prove a positive path. The representable-ops list and the
`copy`/`copyIn` branch-hold clause are unchanged from V4.)

#### Scenario: Every `create()`-authoring case is quarantined inside the sanctioned file

- GIVEN every case across every fixture CURRENTLY listed in `corpus.json#fixtures` (a
  manifest-derived count, never a hardcoded literal)
- WHEN each factory file corpus-wide is inspected for `create(` calls
- THEN every such call lies inside `m2-create-composition/factory.ts`, and within that file,
  inside a case-referenced named-export function block (never the file's default export);
  `wire-create-reject-twin`'s call and any additional positive-case calls both satisfy this — no
  file outside the sanctioned site authors `create()` anywhere

(Previously named "Only one create exists corpus-wide," asserting exactly one case emits
`create`. Renamed and reworded because the cardinality ceiling itself changed — the sanctioned
site remains a hard invariant, the case COUNT inside it does not.)

#### Scenario: Cardinality sync sites for the create quarantine (NEW)

- GIVEN the commit that first lands a positive create case in the sanctioned file
- WHEN `conformance/README.md`'s create-cardinality sentence, `m2-create-composition/factory.ts`'s
  DO-NOT-COPY clause (a) text, and `fit-40`'s clause-(a) `CLAUSE_KEYWORDS` regex are read
- THEN all three describe the QUARANTINE invariant (one sanctioned file, not "exactly one
  create") in the SAME commit — mirroring the sync-site discipline REQ-CFX-17 already
  established for the representable-ops set, applied here to the cardinality wording instead

### Requirement: DO-NOT-COPY Header on the Reject-Probe Factory

The code path authoring the DELIBERATELY-REJECTED wire `create` in `wire-create-reject-twin`
MUST carry a comment beginning `DO-NOT-COPY` that conveys, at minimum: (a) authoring a `create()`
call anywhere OUTSIDE this file's quarantined named-export blocks violates the sanctioned-file
quarantine invariant (REQ-CFX-02); (b) THIS SPECIFIC case exists as a deliberate REJECT PROBE —
the same file MAY also contain a legitimate positive create case in a separate named export,
which this warning does NOT cover; (c) the reject probe's exact rejection-triggering shape (its
unrepresentable template/options) MUST NOT be imitated when authoring a new positive create
case — copy the file's positive create export's pattern instead; (d) the engine REFUSES this
specific probe's batch — the exact rejection code and whether it is triggered by an
unrepresentable template or a `force` field is resolved by ADR-0064 (amended if
`sdd-design`/`sdd-slice` add a `force: true` disposition per the open staleness question below);
(e) what to copy INSTEAD when authoring a new fixture — the corpus's representable ops
(`modify`/`delete`/`rename`/`move`/`copy`/`copyIn`) via a default-export factory, OR, if the new
fixture specifically needs a wire `create`, this file's positive create pattern. A CLAUSE LIST,
not frozen prose — exact wording is an implementation choice as long as all five points are
conveyed.

(Previously: clause (a) cited "the one-create-corpus-wide invariant" and clause (e) omitted any
mention of a legitimate create pattern to copy, because no positive create case existed. Both
reworded to reflect the quarantine-not-cardinality invariant from the modified REQ-CFX-02 above.
Clauses (b)-(d)'s substance is otherwise unchanged; clause (d) additionally routes to the
reject-twin force-staleness resolution `sdd-design` must make — see REQ-CFX-09 below.)

### Requirement: `m2-create-composition` Behavioral Contract

`class: composition`, `lowering: schematic`. Seed: `existing.txt = "orig"`. Schematic:
`schema.json {"schema_version":"1","name":"compose","variables":[]}`,
`files/generated.txt = "generated"` (the CREATE half comes from engine lowering — the factory
MUST NOT author it). Factory: `modify` of `existing.txt` → `"composed"`. `writtenPaths` pin:
REQ-CFX-12.

A second, DISTINCT positive case (provisional name `positive-create-composite` / named export
`createComposite` — `sdd-design` MAY rename either without invalidating this requirement)
authors a wire `create` via the SAME public `create()` verb, inside its own quarantined
named-export block in `m2-create-composition/factory.ts` (ADR-0065 mechanism), passing at least
one composite (array or plain-object) option value that exercises `encodeOptions`'s
JSON-stringify branch (REQ-TOE-01) — the corpus's first case to do so. `writtenPaths` pin:
REQ-CFX-12.

| Case | exitCode | emitRejectionCode | failedIndex | expected |
|---|---|---|---|---|
| positive | 0 | null | null | `{generated.txt: "generated", existing.txt: "composed"}`, `writtenPaths: ["existing.txt", "generated.txt"]` exactly |
| wire-create-reject-twin | 2 (ADR-0064, resolved) | `unrepresentable` | null | `"zero-effect"` — disposition re-confirmed per REQ-CFX-09.5 below |
| positive-create-composite (provisional) | 0 | null | null | byte-exact declared path + content (REQ-CFX-11 honesty boundary); options composite, `encodeOptions`-exercising |

**PRECONDITION for freezing `wire-create-reject-twin`'s outcome triple (design-blocking, not a
spec defect)**: the entire outcome triple `(exitCode, emitRejectionCode, failedIndex)` for this
twin — not just the exit digit — is contingent on an unresolved question: does the raw wire
`create` batch entry get intercepted CLIENT-SIDE before it ever reaches emit (an
`AuthoringError` with `origin: "authoring-rejected"` → **exit 1**, per
`docs/engine-sdk-wire-spec.md` EXC-01, and NO `ir.emit` call is ever issued), or does it reach
the host and get rejected AT emit time (an `IntentRejectedError` / emit-rejection → **exit 2**,
`unrepresentable`, batch-level, no `failedIndex`, WITH one `ir.emit` call issued and rejected)?
`sdd-design` MUST resolve this via ADR BEFORE the triple is frozen for implementation. This does
NOT block freezing the POSITIVE cases (unaffected) or the rest of this fixture's contract.

**Fail-closed clause**: any verification pass (in-loop, final, or the self-check) MUST treat an
UNRESOLVED outcome-triple placeholder as FAILED — never a silent pass. If design resolves the
path to client-side authoring-time rejection (exit 1), the handoff's exit-2 claim AS WRITTEN
becomes UNSATISFIABLE for this fixture — this MUST be escalated as a cross-repo followup to the
engine team, never silently adjusted in this corpus without that escalation.

**Resolution note (archive-time, carried from V4)**: exit path resolved by ADR-0064
(2/unrepresentable/null, emit-time); the temporal hedge is closed; the shipped comment's
assertion cites that ADR and is consistent — for the case as it stood BEFORE this change.

**Transcript note (see REQ-CFX-13.4)**: whichever path design resolves this case to, this twin's
`transcript.callbacks[]` ends in `ir.discard` — `defineFactory`'s catch (`src/core/context.ts`)
runs on ANY error thrown from `fn`/`flush`/`commit`, so it fires identically whether the
rejection is thrown from inside `fn` (authoring-time) or from `flush()` (emit-time); only
whether `ir.emit` precedes `ir.discard` in the array differs by resolution. The EXIT-CODE
resolution (1 vs 2) stays the open question this REQ routes to `sdd-design`'s ADR — the discard
fact does not resolve it.

**NEW — engine `sdk-wire-create` staleness question**: `wire-create-reject-twin`'s factory
(`createRejectProbe`) calls `create()` with no `force` field. ADR-0064 froze its outcome under
the OLD engine, which rejects EVERY wire `create` unconditionally. The engine handoff (obs
#1695) states the NEW `sdk-wire-create` engine makes plain creates generally representable and
rejects the WHOLE BATCH only when a `force` field is present. Under the new semantics, this
EXACT probe call (no force, no stated collision) would exit 0 instead of `(2, "unrepresentable",
null)` — silently invalidating the pinned triple. No artefact in this repo currently states the
probe needs a `force: true` addition to remain a valid rejection. `sdd-design` MUST resolve this
via ADR (amending ADR-0064 if it adds `force: true`) BEFORE the corpus lands — this is a genuine
scope-affecting discovery, not a pre-existing open question this change merely inherits.

(Previously: this REQ described only the composition-positive case and the reject twin; the
`positive-create-composite` row, its own paragraph, and the `sdk-wire-create` staleness note are
all new. The composition-positive case's own contract, the design-blocking exit-path
precondition, the fail-closed clause, and the transcript note are otherwise unchanged from V4.)

#### Scenario: Positive case declares one commit, two composed halves

- GIVEN `m2-create-composition`'s manifest + schematic-staged `generated.txt` + seed
  `existing.txt` + `expected/`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares a single `ir.commit` flush, `outcome.exitCode: 0`, both files at
  their final content in `expected/`, `outcome.writtenPaths = ["existing.txt", "generated.txt"]`

#### Scenario: Reject-twin's outcome triple is pinned only after design resolves the path

- GIVEN the factory authors a raw `{op: "create", ...}` batch entry
- WHEN `sdd-design` resolves the authoring-time-vs-emit-time question via ADR
- THEN the manifest's `wire-create-reject-twin` outcome triple is pinned to the RESOLVED values
  (exit 1 + no `ir.emit` issued, OR exit 2 + `unrepresentable` + batch-level no `failedIndex`) —
  it MUST NOT remain the UNRESOLVED placeholder past that point

#### Scenario: An unresolved triple fails verification, never passes silently

- GIVEN `wire-create-reject-twin`'s outcome triple is still UNRESOLVED at verification time
- WHEN any verify pass (in-loop, final, or the self-check) runs
- THEN it reports FAILED for this case — never a quiet pass

#### Scenario: A second positive case authors a quarantined create with composite options (NEW)

- GIVEN `m2-create-composition/factory.ts`'s new named-export case (provisional
  `createComposite`)
- WHEN its authored directive is inspected
- THEN it calls the public `create()` verb with `factory.export` neither `null` nor
  `"createRejectProbe"`, at least one composite (array or plain-object) option value,
  `outcome.exitCode: 0`, `outcome.emitRejectionCode: null`, and a byte-exact declared path +
  content in its `expected/`-scoped directory

#### Scenario: `wire-create-reject-twin`'s outcome triple stays valid under the engine's new create semantics (NEW)

- GIVEN the engine's `sdk-wire-create` change makes plain wire `create` generally representable
  and rejects a batch only when a `force` field is present (per engine handoff obs #1695)
- WHEN `sdd-design` resolves, via ADR, whether `createRejectProbe` needs a `force: true` addition
- THEN the manifest's `wire-create-reject-twin` entry and its factory call are updated
  consistently with that resolution — the triple MUST NOT ship contradicting the stated new
  engine semantics, and the DO-NOT-COPY comment's clause (d) cites whichever rejection cause is
  actually resolved

### Requirement: `writtenPaths` Rule — Committed-Mutation Set (all six op classes)

`outcome.writtenPaths` for a case MUST list **every workspace-relative path touched by a
committed mutation during the run** — derived from the committed set across all six op classes
(`create` / `modify` / `rename` / `delete` / `copyIn` / `copy`), **including engine-side
schematic-lowered `create` staging** — deduplicated and **sorted** (the self-check and the
engine harness compare positionally, so order is part of the contract). This mirrors the
engine's `Result.WrittenPaths` contract (`project-builder-engine`, `mutation-event-streaming`):
*"every `Success==true` committed entry's `Op.Path`, deduplicated and sorted, covering all six
`PlannedOp.Class` values — unlike the old pre-run `OpCreate`-only batch."*

Per-op-class semantics (engine-confirmed, code-grounded):

- A committed `modify` or `delete` lists its target path. A `delete` lists the **removed** path —
  the contract is the committed *set*, not "bytes written".
- A committed `rename`/`move` lists **only the destination** path. The source becomes a
  moved-away tombstone (`StatusMovedAway`) that `PlanOf` skips and never enters the committed
  journal, so `WrittenPaths` never sees it.
- A `create` followed by a `modify` of the **same** path deduplicates to a single entry.
- A rejected or discarded run commits nothing, so its `writtenPaths` is `[]`.

Pinned values, every positive case: `m1-vehicle` = `["out.txt"]` (schematic-lowered `create` of
`out.txt` + factory `modify` of the same `out.txt` → deduped to one entry); `m2-modify` =
`["target.txt"]`; `m2-delete` = `["target.txt"]`; `m2-rename-move` = `["dst.txt"]`;
`m2-create-composition` = `["existing.txt", "generated.txt"]` (schematic-lowered `create` of
`generated.txt` + factory `modify` of `existing.txt`, sorted); `m2-create-composition`'s new
`positive-create-composite` case (provisional name) = its own declared create path only — a
genuinely new path no other case touches, so no dedup collision (design/slice pins the exact
literal when the case's path is chosen). Each committed case of `m2-copy` and `m2-copyin` lists
its `copy`/`copyIn` **destination** (the by-reference `assets/` source is read, never written, so
it is absent): `m2-copy` positive = `["dst.txt"]`, collision-with-force = `["occupied.txt"]`,
copy-then-modify = `["dst2.txt"]`; `m2-copyin` positive = `["dst.txt"]`, verbatim-content =
`["dst2.txt"]`, collision-with-force = `["occupied.txt"]`. Every negative twin = `[]`.

(Previously: the pinned-values list did not include the new `positive-create-composite` case.
All other pinned values and the per-op-class semantics are unchanged from V4.)

#### Scenario: Same-path create+modify deduplicates to one entry

- GIVEN `m1-vehicle`'s positive case (schematic-lowered `create` of `out.txt`, then a factory
  `modify` of `out.txt`)
- WHEN `outcome.writtenPaths` is inspected
- THEN it equals `["out.txt"]` exactly — the two committed mutations on the same path deduplicate

#### Scenario: Wire-mutation positive cases pin their committed target path

- GIVEN `m2-modify` (modify `target.txt`), `m2-delete` (delete `target.txt`), or
  `m2-rename-move` (rename `src.txt` → `dst.txt`) positive case
- WHEN `outcome.writtenPaths` is inspected
- THEN `m2-modify` = `["target.txt"]`, `m2-delete` = `["target.txt"]`, `m2-rename-move` =
  `["dst.txt"]` — the rename lists the destination only; its source is absent (moved-away
  tombstone)

#### Scenario: A new quarantined positive-create case pins a genuinely new `writtenPaths` entry (NEW)

- GIVEN `m2-create-composition`'s new positive-create case's declared create path
- WHEN `outcome.writtenPaths` is inspected
- THEN it lists exactly that one new path, sorted alongside any co-committed paths in that case's
  own batch, and it collides with no OTHER case's pinned path in this requirement's table

### Requirement: Transcript Oracle — Every Case Carries a Full `transcript` Object

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
| m2-create-composition / positive-create-composite (provisional, NEW) | `[ir.emit, ir.commit]` | `true` |
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

(Previously: table did not include the `positive-create-composite` row. All other rows and the
prose are unchanged from V4.)

#### Scenario: A wire-mutation positive case's transcript is single-emit-single-commit

- GIVEN `m2-modify`'s positive case
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]`, `singleCommit: true`, `forbidDiscard: true`,
  `emitBeforeCommit: true`

#### Scenario: A directive-level reject twin's transcript ends in a discard, not a halt

- GIVEN `m2-modify`'s not-found-twin
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]`, `singleCommit: true` (vacuously), `forbidDiscard:
  false`, `emitBeforeCommit: true` (vacuously)

#### Scenario: A batch-level reject twin discards identically to a directive-level one

- GIVEN `m2-delete`'s `dir-target-twin` (batch-level `unrepresentable`, `failedIndex: null`)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]` and `forbidDiscard: false`, identically to a
  directive-level twin

#### Scenario: wire-create-reject-twin discards under either exit-path resolution

- GIVEN `m2-create-composition`'s `wire-create-reject-twin`
- WHEN `cases[].transcript` is inspected under EITHER candidate resolution
- THEN `ir.discard` is present as the LAST callback in both cases and `forbidDiscard: false` in
  both

#### Scenario: A two-directive positive batch is a single flush, not a doubled emit

- GIVEN `m2-copy`'s `copy-then-modify` case (one batch, `copy` then `modify` on the same dest)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]` exactly once each — the two directives share ONE
  flush, applied sequentially in array order (ruling 3(b)), never two `ir.emit` calls

#### Scenario: A quarantined positive-create case's transcript is single-emit-single-commit (NEW)

- GIVEN `m2-create-composition`'s new positive-create case
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]`, `singleCommit: true`, `forbidDiscard: true`,
  `emitBeforeCommit: true` — the same shape as any other single-directive positive case
