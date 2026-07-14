# Delta for modify-coalescing

**Spec version**: V2
**Status**: signed (owner, 2026-07-14)
**Change**: `author-write-surface`

## MODIFIED Requirements

### REQ-MC-01: N distinguishable edits on one handle, no read → exactly one modify

A dialect handle chaining N ≥ 2 distinguishable edits (named ops and/or `.modify(fn)`) with NO
intervening `Session.read` MUST emit EXACTLY ONE `modify` directive at flush, whose content
reflects ALL N edits applied in chain order (the coalesced-no-read shape).

(Previously: worded over "named ops and/or `.raw()`". Renamed to `.modify(fn)` — the
AST-fn escape hatch's coalescing behavior is unchanged, only its call name renamed
(`dialect-generics` REQ-DG-03).)

#### Scenario REQ-MC-01.1: coalesced-no-read — two distinguishable ops, one modify, byte-exact content

- GIVEN a seeded file and `find(path).addImport(x).modify(ast => addSomethingElse(ast))` — two
  ops with DISJOINT textual footprints (the import statement vs. an unrelated appended
  statement)
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

(Previously: scenarios' example chains called `.raw(ast => …)`. Renamed to `.modify(ast => …)`
— the split-coalescing CONTRACT is unchanged, only the escape hatch's call name renamed.)

#### Scenario REQ-MC-02.1: split-by-read — edits, read, more edits → exactly two modifies, byte-exact content

- GIVEN a seeded file and a chain: `addImport(x)` (adds an import statement only) → `.read()`
  (mid-chain, SAME path) → `modify(ast => addSomethingElse(ast))` (appends an unrelated
  statement only — the two ops' textual footprints are DISJOINT)
- WHEN the run flushes (test-note: verified via a spy on the batch `emit` call)
- THEN the emitted batch's `instructions` contains EXACTLY TWO `modify` directives targeting
  the same path, in order
- AND directive #1's `content` is BYTE-EXACT against a committed golden containing ONLY the
  import edit (NOT the `.modify()`-callback edit); directive #2's `content` is BYTE-EXACT
  against a second committed golden containing BOTH the import AND the callback edit —
  cumulative content is correct end to end, not merely "reflects" the edits

#### Scenario REQ-MC-02.2: mid-chain read observes the handle's own writes

- GIVEN the same chain as REQ-MC-02.1
- WHEN the mid-chain `.read()` resolves
- THEN its returned content reflects the `addImport` edit already applied — NOT the original
  seeded content

#### Scenario REQ-MC-02.3: cross-path read mid-chain splits an open handle

- GIVEN two seeded files `a.ts`/`b.ts`, a chain `find("a.ts").addImport(x)` left with an
  uncommitted edit, THEN `Session.read("b.ts")` (a read on a DIFFERENT path, unrelated to the
  open handle), THEN `find("a.ts")` resumes with `.modify(ast => addSomethingElse(ast))`
- WHEN the run flushes
- THEN the batch contains EXACTLY TWO `modify` directives targeting `a.ts`, cumulative content
  correct per REQ-MC-02's invariants — the SAME split as a same-path read, because the flush
  triggered by `b.ts`'s read is global
- AND the `a.ts` handle correctly re-opens and continues accumulating into directive #2 after
  the cross-path read — no error, no dropped state

### REQ-MC-03: modify's read routes through Session.read only

Dialect code (the handle factory, named ops, `.modify()`) MUST NEVER call `EngineClient.read`
directly — every read, including the coalescing handle's internal read-through-parse, MUST
route through `Session.read` (flush-before-read, ADR-0015, REQ-KIT-02).

(Previously: listed `.raw()` among the dialect-code call sites. Renamed to `.modify()` —
the routing constraint itself is unchanged.)

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

### REQ-MC-06: Unawaited dialect chains are joined at run end

A dialect chain whose handle is not `await`ed by the author MUST still complete and emit its
`modify` at run end — the run drains all outstanding dialect handles before the final flush.
An unawaited chain that THROWS MUST reject the run with the contained
`"dialect operation failed: "` error and MUST NOT surface an `unhandledRejection`.

(Previously: the second, throwing example chain called `.raw(ast => { throw ... })`. Renamed
to `.modify(ast => { throw ... })` — the run-end join and no-unhandledRejection guarantees are
unchanged.)

#### Scenario REQ-MC-06.1: forgotten-await joins at run end; a throwing unawaited chain rejects contained, no unhandledRejection

- GIVEN a chain `find(path).addImport(x)` called WITHOUT `await` (the author drops the
  returned handle/promise)
- WHEN the run resolves (test-note: `process.on('unhandledRejection')` observed for the whole
  test)
- THEN the run commits the import — content asserted BYTE-EXACT against a committed golden,
  not merely a directive-count assertion
- AND no `unhandledRejection` is observed for this successful case

- GIVEN a SECOND, separately-run chain whose unawaited handle THROWS (e.g.
  `find(path).modify(ast => { throw new Error("boom"); })` called without `await`)
- WHEN the run resolves
- THEN the run REJECTS with an `Error` whose message starts with the contained
  `"dialect operation failed: "` prefix (`dialect-generics` REQ-DG-05's contract)
- AND no `unhandledRejection` is observed — the run-end join re-throws the rejection into the
  SAME rejection path the run already surfaces, not a separate unhandled channel

### REQ-MC-08: `.replaceContent(content)` rejects when an AST op is pending on the same handle

A dialect handle's `.replaceContent(content)` MUST REJECT with a `dialectError` (frozen
`"dialect operation failed: "` prefix — NOT the public `AuthoringError`; growing
`AuthoringError.reason`'s closed enum is a separate, deferred amendment, per owner ruling) when
an AST-op directive is currently OPEN (buffered, not yet drained by a read or flush) on the
SAME handle. This supersedes the historical silent last-write-wins, where `.replaceContent()`'s
own buffered directive wins array-order and the AST edit is silently dropped. The rejection is
ASYMMETRIC and narrowly scoped: `.replaceContent()` called when NO AST op is pending on the
handle is UNCHANGED and continues to work; `.read()` DRAINS the pending AST op first (the
documented escape route — calling `.replaceContent()` AFTER a `.read()` is a legitimate
sequential edit, not a collision); an AST op enqueued AFTER `.replaceContent()` (the REVERSE
order) stays defined as today, unaffected by this REQ. This guard is SCOPED EXCLUSIVELY to
`.replaceContent()` — it MUST NOT attach to `.modify(fn)` (`dialect-generics` REQ-DG-03): a
`.modify(fn)` call following an open AST op is itself another AST edit on the SAME live
instance and coalesces normally per REQ-MC-01, never triggering this reject. `.replaceContent`
is also STRING-ONLY — a function argument MUST NOT typecheck; `.modify` is fn-only
(`dialect-generics` REQ-DG-03.3) — these are two distinct methods, never one overloaded verb.

> Non-normative implementation note (characterisation baseline): the historical behaviour —
> two directives land, array-order applies, the wholesale-replace directive wins over the
> buffered AST edit, and the AST edit is silently lost — is pinned by a CHARACTERISATION test
> that lands FIRST in the implementing slice (GREEN, describing prior code as evidence for the
> RED→GREEN transition). That characterisation test is then REPLACED by this REQ's reject
> scenarios in the SAME slice. The last-write-wins behaviour it captures is NOT itself a
> normative scenario of this spec (it contradicts REQ-MC-08's reject contract) — it exists
> solely as RED-phase evidence and a rollback reference, not as a shipped contract.
>
> See `dialect-generics` REQ-DG-07 for this rejection's run-wide fail-closed consequence (zero
> batches across the entire run, not just this handle).

(Previously: this REQ named the wholesale-replace verb `.modify(content)`. Renamed to
`.replaceContent(content)` — the reject CONTRACT (asymmetric, scoped to AST-op-pending,
`.read()` as documented escape, reverse-order unaffected) is otherwise unchanged. NEW in this
change: an explicit scenario (.5) proving the guard is ABSENT from `.modify(fn)` — the silent
data-loss risk this change's council review flagged as highest-integrity-risk is closed by
this negative proof, not left implicit. V2 (security finding, BLOCKING): REQ-MC-08.1
strengthened from "the addImport edit is never silently discarded" — a claim about intent — to
an OBSERVABLE state assertion: the reject fires BEFORE the wholesale directive is ever buffered,
the run emits ZERO batches (binding this scenario to `dialect-generics` REQ-DG-07's fail-closed
run semantics), and no `{op:"modify"}` directive carrying the wholesale content is ever
buffered or emitted for this handle. The rejection message is also now pinned byte-exact in the
new vocabulary, with an assertion that it does NOT contain `.modify(` — proving the message
correctly names the STRING-ONLY verb as the rejected one, never the AST-fn escape hatch.)

#### Scenario REQ-MC-08.1: replaceContent rejects while an AST op is open — before buffering, zero batches (strengthened, V2)

- GIVEN `find(path).addImport(x)` (an open AST op, undrained) followed immediately by
  `.replaceContent(rawContent)` on the SAME handle
- WHEN the chain runs
- THEN it REJECTS with the pinned `dialectError` prefix and the BYTE-EXACT tail: `cannot
  .replaceContent() "{path}" while a structured edit is pending — the pending edit would be
  lost; call .read() to commit it first, then .replaceContent()`
- AND the reject fires BEFORE `.replaceContent()`'s wholesale directive is ever buffered on the
  handle's pending state — never buffered-then-discarded, never buffered-then-rejected
- AND the run emits ZERO batches for ANY handle in the run at settle time (binds to
  `dialect-generics` REQ-DG-07's fail-closed, run-wide consequence) — not merely "this handle's
  edit is preserved," but no partial commit anywhere
- AND no `{op:"modify"}` directive carrying the `.replaceContent()` wholesale content is ever
  buffered or emitted — the `addImport` edit is never silently discarded, and neither is the
  rejected wholesale-replace content smuggled through some other path
- AND the rejection message does NOT contain the substring `.modify(` — proving the message
  correctly names `.replaceContent()` as the rejected call, never conflating it with the
  AST-fn escape hatch it is scoped away from (REQ-MC-08.5)

#### Scenario REQ-MC-08.2: replaceContent with no pending AST op is unaffected

- GIVEN a freshly-opened handle with NO AST op yet enqueued
- WHEN `.replaceContent(content)` is called
- THEN it succeeds exactly as before — a regression guard proving the reject is scoped, not a
  blanket ban on `.replaceContent()`

#### Scenario REQ-MC-08.3: read() drains, then replaceContent() succeeds (documented escape)

- GIVEN `find(path).addImport(x)` followed by `.read()` (draining the pending AST op) followed
  by `.replaceContent(newContent)`
- WHEN the chain runs
- THEN both directives commit — the `.read()` is the documented escape route, not a workaround
  being blocked

#### Scenario REQ-MC-08.4: reverse order stays defined

- GIVEN `find(path).replaceContent(content)` followed by `.addImport(x)` (AST op AFTER
  replaceContent)
- WHEN the chain runs
- THEN it behaves exactly as before (unaffected by this REQ) — the restriction is directional,
  not symmetric

#### Scenario REQ-MC-08.5: the guard is ABSENT from `.modify(fn)` — silent-data-loss negative (NEW)

- GIVEN `find(path).addImport(x)` (an open AST op, undrained) followed immediately by
  `.modify(ast => addSomethingElse(ast))` on the SAME handle — the AST-fn escape hatch, NOT
  `.replaceContent`
- WHEN the chain runs
- THEN it does NOT reject — the two AST edits coalesce into ONE `modify` directive per
  REQ-MC-01, content reflecting BOTH the `addImport` and the `.modify()` callback's mutation;
  this proves the REQ-MC-08 guard is scoped exclusively to `.replaceContent()` and never
  swallows a legitimate `.modify(fn)` chain as if it were a conflicting wholesale replace

#### Scenario REQ-MC-08.6: `.replaceContent` is string-only — a function argument fails to compile (NEW)

- GIVEN a dialect handle's `.replaceContent` method
- WHEN it is called with a function argument (`handle.replaceContent(ast => {})`)
- THEN it fails to typecheck — the paired negative to `dialect-generics` REQ-DG-03.3's
  `.modify` fn-only pin, proving neither method accepts the other's argument shape

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — coalescing seam correctness (prevents silent data loss); guard scoped to `.replaceContent`, proven absent from `.modify(fn)` | REQ-MC-08 | Yes |
