# Modify Coalescing Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-11 — V3; join deltas ratified)
**Change**: `stage-5-first-dialect`

## Purpose

The N-edits-to-one-modify coalescing contract for dialect handles (ADR-0006), the
read-boundary split behaviour mid-chain (ADR-0015), and the flush-seed-rule interaction for
AST-chain tests (Stage 3 §4.6b). **Read-boundary ruling (owner-pinned, non-negotiable)**: a
mid-chain read SPLITS coalescing — staged directives are non-retractable — and the trigger is
GLOBAL: any `Session.read`, on ANY path, drains the whole `#pending` buffer (ADR-0015 is not
path-scoped), so it splits every open handle with uncommitted edits, not only same-path reads.
Two invariants: (a) no edit is ever lost; (b) read-your-own-writes holds for dialect edits.

## Coverage Note (non-normative, this change)

REQ-MC-01 (N distinguishable edits on one handle, no read → exactly one modify) is worded
generically over "named ops and/or `.raw()`" and the no-reparse invariant (`#ensureLive()`
parses at most once per handle) is already structural, not op-specific. Both already cover
chains that MIX the pre-existing `addImport` with this change's new ops — no REQ-MC-01 text
change is required. Design/apply should add ONE concrete fixture proving a mixed
old-op+new-op chain coalesces correctly (test-coverage only, not a spec gap).

## Requirements

### REQ-MC-01: N distinguishable edits on one handle, no read → exactly one modify

A dialect handle chaining N ≥ 2 distinguishable edits (named ops and/or `.raw()`) with NO
intervening `Session.read` MUST emit EXACTLY ONE `modify` directive at flush, whose content
reflects ALL N edits applied in chain order (the coalesced-no-read shape).

#### Scenario REQ-MC-01.1: coalesced-no-read — two distinguishable ops, one modify, byte-exact content

- GIVEN a seeded file and `find(path).addImport(x).raw(ast => addSomethingElse(ast))` — two ops
  with DISJOINT textual footprints (the import statement vs. an unrelated appended statement)
- WHEN the run flushes (test-note: verified via a spy on the batch `emit` call)
- THEN the emitted batch's `instructions` contains EXACTLY ONE `modify` directive targeting
  `path`
- AND its `content` is BYTE-EXACT against a committed golden containing BOTH edits — a mutant
  dropping either edit's textual footprint kills this assertion, not a count-only or
  "reflects" assertion

#### Scenario REQ-MC-01.2: two independent handles on different paths coalesce independently

- GIVEN `find("a.ts").addImport(x)` and `find("b.ts").addImport(y)` in the SAME run, no read
  between them
- WHEN the run flushes
- THEN the batch contains EXACTLY TWO `modify` directives — one per path — each reflecting
  ONLY its own path's edit; no cross-contamination of content between the two handles

### REQ-MC-02: A mid-chain read SPLITS coalescing into exactly two modifies (GLOBAL trigger)

`Session.read` is a GLOBAL flush-before-read (ADR-0015): invoking it on ANY path — the SAME
path a dialect handle is accumulating edits for, or a DIFFERENT one entirely — drains the
ENTIRE `#pending` buffer. Any dialect handle with ≥1 uncommitted edit at that moment MUST first
FLUSH its current AST state as `modify` directive #1, THEN resume accumulating any further
edits into a NEW `modify` directive #2, emitted at the next flush. Two invariants are
non-negotiable: (a) **no edit is ever lost** — the union of directive #1's and directive #2's
content changes, taken together, carries every edit exactly once; (b) **read-your-own-writes
holds for dialect edits** — a mid-chain read of the SAME file the handle is editing MUST
observe the AST edits made so far, not the pre-edit disk/tree content.

#### Scenario REQ-MC-02.1: split-by-read — edits, read, more edits → exactly two modifies, byte-exact content

- GIVEN a seeded file and a chain: `addImport(x)` (adds an import statement only) → `.read()`
  (mid-chain, SAME path) → `raw(ast => addSomethingElse(ast))` (appends an unrelated statement
  only — the two ops' textual footprints are DISJOINT)
- WHEN the run flushes (test-note: verified via a spy on the batch `emit` call)
- THEN the emitted batch's `instructions` contains EXACTLY TWO `modify` directives targeting
  the same path, in order
- AND directive #1's `content` is BYTE-EXACT against a committed golden containing ONLY the
  import edit (NOT the raw-edit); directive #2's `content` is BYTE-EXACT against a second
  committed golden containing BOTH the import AND the raw-edit — cumulative content is correct
  end to end, not merely "reflects" the edits

#### Scenario REQ-MC-02.2: mid-chain read observes the handle's own writes

- GIVEN the same chain as REQ-MC-02.1
- WHEN the mid-chain `.read()` resolves
- THEN its returned content reflects the `addImport` edit already applied — NOT the original
  seeded content

#### Scenario REQ-MC-02.3: cross-path read mid-chain splits an open handle

- GIVEN two seeded files `a.ts`/`b.ts`, a chain `find("a.ts").addImport(x)` left with an
  uncommitted edit, THEN `Session.read("b.ts")` (a read on a DIFFERENT path, unrelated to the
  open handle), THEN `find("a.ts")` resumes with `.raw(ast => addSomethingElse(ast))`
- WHEN the run flushes
- THEN the batch contains EXACTLY TWO `modify` directives targeting `a.ts`, cumulative content
  correct per REQ-MC-02's invariants — the SAME split as a same-path read, because the flush
  triggered by `b.ts`'s read is global
- AND the `a.ts` handle correctly re-opens and continues accumulating into directive #2 after
  the cross-path read — no error, no dropped state

### REQ-MC-03: modify's read routes through Session.read only

Dialect code (the handle factory, named ops, `.raw()`) MUST NEVER call `EngineClient.read`
directly — every read, including the coalescing handle's internal read-through-parse, MUST
route through `Session.read` (flush-before-read, ADR-0015, REQ-KIT-02).

#### Scenario REQ-MC-03.1: no direct EngineClient.read in dialect code

- GIVEN the full import/call graph of `src/dialects/typescript/**`
- WHEN scanned for `EngineClient` read-site calls
- THEN none exist outside `core/session.ts`'s own delegation

#### Scenario REQ-MC-03.2: a planted direct-EngineClient.read call turns the scan RED

- GIVEN a planted fixture file under `src/dialects/typescript/**` that calls
  `EngineClient.read` directly, bypassing `Session.read` — quarantined, never part of the
  green suite (mirrors REQ-MC-04.1's characterization-guard wording)
- WHEN REQ-MC-03.1's scan runs against it
- THEN the scan FAILS RED — proving the assertion is live, not a no-op

### REQ-MC-04: flush-seed-rule applies to AST-chain tests

Any test driving a `find()`-only dialect chain MUST pre-seed its target path in the
`ContractFake` — NEVER treat it as a `create()` target — per the Stage 3 §4.6b
flush-seed-rule: `defineFactory`'s unconditional run-end `flush()` will hit the fake's
fail-closed `modify`-target-existence check (ADR-0017) even after in-`fn` assertions already
passed, if the target was never seeded.

**Timing, reconciled with `typescript-dialect` REQ-TSD-03.4**: this run-end backstop is
deliberately layered UNDER the dialect handle's OWN first-op existence check. A truly-absent
target surfaces to the author at FIRST OP — synchronously in chain terms, via `Session.read`
returning `undefined` for the missing path (REQ-TSD-03.4's pinned author-facing rejection).
The ADR-0017 fake's run-end check is the engine-side backstop for whatever reaches flush
un-rejected. The flush-seed-rule above remains the operative TEST-AUTHORING guidance
regardless of which layer fires first for a given fixture.

#### Scenario REQ-MC-04.1: an unseeded find()-only AST chain fails at run-end flush

- GIVEN a dialect chain test that forgets to seed its target
- WHEN the run resolves
- THEN it rejects at the run-end flush with the ADR-0017 not-found rejection — documented as
  a characterization guard proving the rule, not left as a fixture in the passing suite

### REQ-MC-05: `dryRun()` mid-chain is side-effect-free and cheap over a coalesced chain

An author calling `dryRun()` mid-chain over a coalescing dialect handle MUST see the planned
`modify` (verb + path) for that handle WITHOUT triggering AST re-serialization as a side
effect — `dryRun()` stays cheap and observation-only regardless of how many ops the handle has
accumulated. `Session.pendingSnapshot()` (consumed by `dryRun()`) MUST NOT force early
evaluation of a pending `modify` directive's `content`; it reads only `verb`/`path`.

> Non-normative implementation note: the coalescing handle satisfies this contract by
> computing `content` via a lazy getter evaluated exactly once, at flush/stringify time
> (ADR-0006's "serialize once at flush" honored literally) — the mechanism, not itself the
> contract.

#### Scenario REQ-MC-05.1: dryRun over a coalesced chain shows ONE planned modify, no early serialization

- GIVEN a chain with ≥2 accumulated edits on one handle (a pending, un-flushed coalesced
  `modify` directive)
- WHEN `dryRun()` is called mid-chain
- THEN the author-visible plan shows EXACTLY ONE planned `modify` entry (verb `modify`, the
  handle's path) for that handle
- AND the AST is not re-serialized as a side effect (test-note: a spy on the lazy getter
  records zero calls)

### REQ-MC-06: Unawaited dialect chains are joined at run end

A dialect chain whose handle is not `await`ed by the author MUST still complete and emit its
`modify` at run end — the run drains all outstanding dialect handles before the final flush.
An unawaited chain that THROWS MUST reject the run with the contained
`"dialect operation failed: "` error and MUST NOT surface an `unhandledRejection`.

#### Scenario REQ-MC-06.1: forgotten-await joins at run end; a throwing unawaited chain rejects contained, no unhandledRejection

- GIVEN a chain `find(path).addImport(x)` called WITHOUT `await` (the author drops the
  returned handle/promise)
- WHEN the run resolves (test-note: `process.on('unhandledRejection')` observed for the whole
  test)
- THEN the run commits the import — content asserted BYTE-EXACT against a committed golden,
  not merely a directive-count assertion
- AND no `unhandledRejection` is observed for this successful case

- GIVEN a SECOND, separately-run chain whose unawaited handle THROWS (e.g.
  `find(path).raw(ast => { throw new Error("boom"); })` called without `await`)
- WHEN the run resolves
- THEN the run REJECTS with an `Error` whose message starts with the contained
  `"dialect operation failed: "` prefix (REQ-DG-05's contract)
- AND no `unhandledRejection` is observed — the run-end join re-throws the rejection into the
  SAME rejection path the run already surfaces, not a separate unhandled channel

### REQ-MC-07: Same-path scoping — sequential awaited handles are defined, concurrent handles are not

SEQUENTIAL, AWAITED handles on the same path are DEFINED: the second handle's read observes
the first's staged edit (read-your-own-writes), producing cumulative split modifies.
CONCURRENT (unawaited, unordered) handles on the SAME path are UNDEFINED BEHAVIOUR
(last-write-wins) and OUT OF SCOPE — the author MUST `await` between same-path handles for
defined ordering.

#### Scenario REQ-MC-07.1: sequential awaited same-path handles produce cumulative split modifies

- GIVEN a seeded file and `await find(path).addImport(x)` immediately followed by a SECOND,
  separately-awaited `await find(path).addImport(y)` on the SAME path
- WHEN the run flushes
- THEN the batch contains EXACTLY TWO `modify` directives targeting `path`, in order —
  directive #2's content is cumulative (BOTH imports present), no edit is lost

> Non-normative boundary note: CONCURRENT (unawaited, same-path) handles are explicitly OUT OF
> SCOPE per this requirement — no test asserts a specific outcome for that case; the
> author-facing guidance (MUST `await` between same-path handles) is the operative contract,
> not a pinned last-write-wins assertion.

### REQ-MC-08: `.modify(content)` rejects when an AST op is pending on the same handle

A dialect handle's `.modify(content)` MUST REJECT with a `dialectError` (frozen
`"dialect operation failed: "` prefix — NOT the public `AuthoringError`; growing
`AuthoringError.reason`'s closed enum is a separate, deferred amendment, per owner ruling) when
an AST-op directive is currently OPEN (buffered, not yet drained by a read or flush) on the
SAME handle. This supersedes today's silent last-write-wins, where `.modify()`'s own buffered
directive wins array-order and the AST edit is silently dropped. The rejection is ASYMMETRIC
and narrowly scoped: `.modify()` called when NO AST op is pending on the handle is UNCHANGED
and continues to work; `.read()` DRAINS the pending AST op first (the documented escape route —
calling `.modify()` AFTER a `.read()` is a legitimate sequential edit, not a collision); an AST
op enqueued AFTER `.modify()` (the REVERSE order) stays defined as today, unaffected by this
REQ.

> Non-normative implementation note (characterisation baseline): TODAY's behaviour — two
> directives land, array-order applies, the `.modify()` (`raw`) directive wins over the buffered
> AST edit, and the AST edit is silently lost — is pinned by a CHARACTERISATION test that lands
> FIRST in the implementing slice (GREEN, describing current code as evidence for the RED→GREEN
> transition). That characterisation test is then REPLACED by this REQ's reject scenarios in the
> SAME slice. The last-write-wins behaviour it captures is NOT itself a normative scenario of
> this spec (it contradicts REQ-MC-08's reject contract) — it exists solely as RED-phase
> evidence and a rollback reference, not as a shipped contract.
>
> See REQ-DG-07 for this rejection's run-wide fail-closed consequence (zero batches across the
> entire run, not just this handle).

#### Scenario REQ-MC-08.1: modify rejects while an AST op is open

- GIVEN `find(path).addImport(x)` (an open AST op, undrained) followed immediately by
  `.modify(rawContent)` on the SAME handle
- WHEN the chain runs
- THEN it REJECTS with the pinned `dialectError` prefix and a tail naming the conflict — the
  `addImport` edit is NEVER silently discarded

#### Scenario REQ-MC-08.2: modify with no pending AST op is unaffected

- GIVEN a freshly-opened handle with NO AST op yet enqueued
- WHEN `.modify(content)` is called
- THEN it succeeds exactly as today — a regression guard proving the reject is scoped, not a
  blanket ban on `.modify()`

#### Scenario REQ-MC-08.3: read() drains, then modify() succeeds (documented escape)

- GIVEN `find(path).addImport(x)` followed by `.read()` (draining the pending AST op) followed
  by `.modify(newContent)`
- WHEN the chain runs
- THEN both directives commit — the `.read()` is the documented escape route, not a workaround
  being blocked

#### Scenario REQ-MC-08.4: reverse order stays defined

- GIVEN `find(path).modify(content)` followed by `.addImport(x)` (AST op AFTER modify)
- WHEN the chain runs
- THEN it behaves exactly as today (unaffected by this REQ) — the restriction is directional,
  not symmetric

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — coalescing seam correctness (prevents silent data loss) | REQ-MC-08 | Yes |
