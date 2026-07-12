# Delta for dialect-generics

**Spec version**: V4
**Draft revision**: V2 (owner ruling #4 + council feedback applied 2026-07-12)
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-5b-dialect-breadth`

## MODIFIED Requirements

### REQ-DG-02: Op-pack composition — value-level intersection, compile-time enforced, RUNTIME collision-checked

`defineOpPack(ops)` MUST declare a named record of ops over one AST type; `withOps(base,
...packs)` MUST compose them onto a dialect's handle type as the INTERSECTION of all attached
op maps (ADR-0010) — an op from an unattached pack, or a typo, MUST be a compile error.
`withOps` MUST additionally perform a RUNTIME, fail-closed collision check at composition time:
if two or more of the packs passed to ONE `withOps` call declare the SAME op name, `withOps`
MUST throw synchronously with a readable message naming the colliding op — composition never
silently resolves to whichever pack happened to be spread last. Shipped packs remain disjoint
BY CONVENTION (ADR-0010) and are not expected to collide in practice; the diagnostic exists to
catch the case when a THIRD-PARTY pack (or a test fixture) does. The collision proof's fixture
packs MUST be typed over the REAL `SourceFile` Ast and MUST live in the test suite only, never
inside `src/conformance/**` (ADR-0012 amendment — no toy-dialect fixture in conformance code).
Composition MUST ALSO reject — via the SAME synchronous fail-closed throw — an op whose name
COLLIDES with the base handle's own vocabulary (`then`, `read`, `modify`, `raw`): an op-pack op
named `then` in particular would break the handle's `PromiseLike` join, silently corrupting the
chain's thenable contract. This reserved-name check runs at the SAME `withOps` composition point
as the cross-pack collision check above, not as a separate pass (Stage-4 reserved-names
precedent).

(Previously: op-name collisions across packs were explicitly OUT OF SCOPE — "resulting
behaviour is UNDEFINED and DEFERRED; this spec MUST NOT require a collision diagnostic." This
change fulfills that deferred commitment: the diagnostic is now required, proven RED and GREEN.)

#### Scenario REQ-DG-02.1: chain type-checks only through attached ops

- GIVEN a dialect composed via `withOps(base, addImportPack)`
- WHEN author code chains `.addImport(...)` on a `find()` handle
- THEN it type-checks; calling an op from an unattached pack does NOT type-check
  (`expectTypeOf` negative pin)

#### Scenario REQ-DG-02.2: disjoint real packs compose cleanly (GREEN)

- GIVEN two REAL, disjoint op-packs, both typed over the real `SourceFile` Ast, composed via
  `withOps(base, packA, packB)`
- WHEN the composition runs
- THEN no collision diagnostic fires — the compose succeeds cleanly, no false positive

#### Scenario REQ-DG-02.3: defineOpPack in isolation

- GIVEN `defineOpPack({ addImport: (ast, name, from) => { /* ... */ } })` called on its OWN,
  not yet composed via `withOps`
- WHEN its return value is inspected
- THEN it is a named record of ops over the declared AST type — usable standalone (e.g.
  shareable across two dialects targeting the same AST type) before any `withOps` composition
  occurs

#### Scenario REQ-DG-02.4: colliding packs throw synchronously (RED)

- GIVEN two op-packs, BOTH typed over the real `SourceFile` Ast, that deliberately declare the
  SAME op name — a TEST-SUITE-ONLY colliding fixture pair, never shipped, never inside
  `src/conformance/**`
- WHEN they are passed to ONE `withOps(base, packA, packB)` call
- THEN it throws synchronously, and the thrown message names the colliding op

#### Scenario REQ-DG-02.5: op named `then` collides with the base handle vocabulary

- GIVEN an op-pack declaring an op literally named `then`
- WHEN it is passed to `withOps(base, pack)`
- THEN it throws synchronously, and the thrown message names `then` as colliding with the
  reserved base-handle vocabulary

## ADDED Requirements

### REQ-DG-06: `runOp` execution is contained — parity with `.raw()`

A named op invocation via `runOp` (the dispatcher behind every op-pack method, e.g.
`.addImport(...)`) MUST be contained IDENTICALLY to `.raw()`'s containment (REQ-DG-05): a SYNC
throw from the op function, and an ASYNC op literal's rejected returned promise (TS's
void-return compatibility admits an `async (ast, ...args) => {...}` op without a type error),
MUST both surface via the SAME pinned-prefix contained-error contract — never an uncontained
native throw, never an unhandled rejection. An async op's returned promise MUST be `await`ed
INSIDE this containment before the chain proceeds — subsequent chained ops on the SAME handle
MUST NOT run until the async op settles (author-order semantics, mirrors the run-boundary
join's existing sequencing). The contained-invoke MUST distinguish two failure origins: an
ALREADY-CONTAINED error — its message already carries the frozen
`"dialect operation failed: "` prefix (e.g. a `dialectError` an op deliberately throws, such as
REQ-TSD-09's collision reject) — MUST be RETHROWN VERBATIM, unmodified, with no re-wrap and no
`.cause` attach; a FOREIGN throw (any error whose message does NOT already carry that prefix)
MUST be wrapped generically per the existing contract, also with no `.cause` attach.
Double-wrapping (`"dialect operation failed: dialect operation failed: ..."`) or burying a
deliberate reject under a generic `"{op}() threw"` message is a containment bug, not acceptable
variance.

#### Scenario REQ-DG-06.1: sync throw from a named op is contained

- GIVEN an op function that throws synchronously
- WHEN it runs via `runOp`
- THEN the run rejects with the pinned `"dialect operation failed: "` prefix, tail naming the
  op — no raw native throw escapes; `.cause` is `undefined`/absent AND the message contains no
  ts-morph internal class names, stack frames, or absolute fs paths (REQ-DG-05.1 discipline)

#### Scenario REQ-DG-06.2: async op rejection is contained, zero unhandledRejection, zero batches

- GIVEN an op function returning a promise that REJECTS
- WHEN the chain runs (test-note: `process.on('unhandledRejection')` observed for the whole
  test)
- THEN the run rejects with the pinned-prefix contained error AND no `unhandledRejection` is
  observed; `.cause` is `undefined`/absent AND the message contains no ts-morph internal class
  names, stack frames, or absolute fs paths; AND ZERO batches are emitted for the run — an async
  rejection MUST NOT commit as a false success

#### Scenario REQ-DG-06.3: async op resolution lands in the single coalesced modify

- GIVEN an op function returning a promise that RESOLVES after mutating the AST
- WHEN the chain flushes
- THEN the mutation is present in the ONE coalesced `modify` directive's content — the
  run-boundary join correctly awaits it before printing

#### Scenario REQ-DG-06.4: async op blocks subsequent chained ops until settled

- GIVEN a chain `find(path).asyncOp().syncOp()` where `asyncOp` resolves after a delay
- WHEN the chain runs
- THEN `syncOp`'s mutation is applied AFTER `asyncOp`'s (order-of-effect observable in the
  printed content) — chained ops never race an outstanding async op

#### Scenario REQ-DG-06.5: deliberate-reject passthrough, no double-wrap

- GIVEN an op function that deliberately throws a `dialectError` (e.g. REQ-TSD-09's collision
  reject, message already carrying the frozen `"dialect operation failed: "` prefix)
- WHEN it runs via `runOp`
- THEN the run rejects with that EXACT message, byte-exact — never re-wrapped as
  `"dialect operation failed: dialect operation failed: ..."`, never buried under a generic
  `"{op}() threw"` message

### REQ-DG-07: Fail-closed run semantics after any rejection

Once ANY rejection occurs on a run — whether a `.modify()` reject while an AST op is pending
(REQ-MC-08), or an add-op collision reject (REQ-TSD-09/10/11), or any `runOp`-contained
rejection (REQ-DG-06) — the run MUST fail closed: ZERO batches are emitted for ANY handle in the
run, including edits that were enqueued and would otherwise have flushed cleanly EARLIER in the
same run (no partial commit). A further op CHAINED after the rejection MUST NOT be attempted as
a fresh operation — it MUST surface the ORIGINAL pinned rejection, unchanged; the run is dead
once any rejection occurs.

#### Scenario REQ-DG-07.1: row-136 modify-reject is fail-closed

- GIVEN a run with an earlier handle whose edits would flush cleanly, followed by a SECOND
  handle that triggers REQ-MC-08's reject (`.modify()` while an AST op is pending)
- WHEN the run settles
- THEN ZERO batches are emitted for BOTH handles — the earlier, otherwise-clean handle's edits
  do NOT flush

#### Scenario REQ-DG-07.2: add-op collision reject is fail-closed

- GIVEN a run with an earlier handle whose edits would flush cleanly, followed by a SECOND
  handle that triggers an add-op collision reject (REQ-TSD-09/10/11)
- WHEN the run settles
- THEN ZERO batches are emitted for BOTH handles

#### Scenario REQ-DG-07.3: a further chained op after rejection surfaces the original rejection

- GIVEN a rejected run (any of the above triggers) with a FURTHER op chained after the
  rejecting op on the SAME or a DIFFERENT handle
- WHEN the run is awaited
- THEN it surfaces the SAME original pinned rejection message — not a new/different error, and
  the further op's own effect is never observed

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — `.raw()`, `runOp`, run-wide fail-closed semantics | REQ-DG-06, REQ-DG-07 | Yes |
| security (third-party trust) — op-pack composition across shipped and third-party packs | REQ-DG-02 | Yes |
