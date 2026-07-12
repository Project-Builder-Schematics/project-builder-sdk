# Dialect Generics Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-11 — V3; join deltas ratified)
**Change**: `stage-5-first-dialect`

## Purpose

Real `defineDialect`/`defineOpPack`/`withOps` generics (ADR-0010) replacing today's thin
stub, plus the universal `.raw()` escape hatch (ADR-0006). This is the contract every later
dialect composes against — `typescript-dialect` is its first, thin consumer.

## Requirements

### REQ-DG-01: Frozen dialect descriptor shape + entry verb

A dialect MUST be declared via `defineDialect({ extensions, ast: { parse, print }, ops })` —
FROZEN descriptor shape (ADR-0010, ADR-0006; architect vocabulary freeze). The dialect's
entry verb into a chain MUST be `find` — obtained by calling `find(path)` on a dialect
module's namespace import (ADR-0003), never a separate dialect-specific entry function.

#### Scenario REQ-DG-01.1: descriptor shape is frozen at the type level

- GIVEN a dialect built with `defineDialect({ extensions, ast: { parse, print }, ops })`
- WHEN its shape is inspected
- THEN it has exactly `extensions`/`ast.parse`/`ast.print`/`ops` — a fifth top-level field is
  a compile error (type-level pin)

#### Scenario REQ-DG-01.2: find is the entry verb

- GIVEN a TS dialect module imported by namespace
- WHEN `dialect.find(path)` is called inside a run
- THEN it returns an open `Handle<State, Ast, Ops>` (ADR-0010) — no dialect-specific entry
  function exists

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

### REQ-DG-03: Universal `.raw(ast => …)` escape hatch — coalesces with named ops

Every dialect handle MUST expose `.raw(fn: (ast) => void)` as the universal L2 escape hatch
(ADR-0006): `fn` receives the SAME already-parsed, already-live AST instance the handle's L1
named ops mutate — the author never re-parses or serializes. A chain mixing L1 named ops and
`.raw()` on one handle MUST coalesce into the SAME single `modify` directive as an all-L1
chain.

#### Scenario REQ-DG-03.1: .raw shares the same AST as a preceding named op

- GIVEN `find("a.ts").addImport(...).raw(ast => { /* further mutation */ })`
- WHEN the run flushes
- THEN exactly ONE `modify` directive is emitted, and its content reflects BOTH the named-op
  mutation and the `.raw` mutation

#### Scenario REQ-DG-03.2: `.raw` first, then a named op — same coalescing, either order

- GIVEN `find("a.ts").raw(ast => { /* mutation */ }).addImport(...)` — `.raw()` BEFORE the
  named op (reverse of REQ-DG-03.1's order)
- WHEN the run flushes
- THEN exactly ONE `modify` directive is emitted, content reflecting BOTH mutations —
  coalescing holds regardless of `.raw`/named-op ordering

### REQ-DG-04: Sanctioned dialect-author API surface (kit boundary, ADR-0009)

The dialect-author API — `defineDialect`, `defineOpPack`, `withOps`, and the handle's
`.raw()` — MUST be the ONLY kit-layer surface importable by a dialect package (`./typescript`
and any future dialect); `Session`/`DirectiveFactory`/`EngineClient` remain kit-internal and
MUST NOT be imported by dialect code. `REQ-FIT-08` (`foundations-skeleton`, text UNCHANGED)
already forbids kit-symbol re-export generically and extends to `./typescript` automatically
once that subpath exists — no REQ-FIT-08 text change, only a new exercised case. This
inheritance includes FIT-08's own red-proof obligation, made explicit here: a planted case
importing `Session`/`DirectiveFactory`/`EngineClient` from `src/dialects/typescript/**` MUST
fail RED against FIT-08's existing scan — not a new fitness function, an inherited one
exercised against the new subpath.

#### Scenario REQ-DG-04.1: the TS dialect package imports only the sanctioned surface

- GIVEN `src/dialects/typescript/**`'s own import graph
- WHEN scanned
- THEN it imports only `defineDialect`/`defineOpPack`/`withOps` from
  `core/define-dialect.ts` (plus its own AST library) — no `Session`/`DirectiveFactory`/
  `EngineClient` import

### REQ-DG-05: `.raw()` execution is contained — no unguarded escape, no library leak (interim)

A `.raw(ast => …)` callback that throws, and a dialect `ast.parse`/`ast.print` failure, MUST
NOT escape the run as an unguarded native exception, and MUST NOT leak AST-library-internal
state (node identity, internal class names, stack frames naming the library's internals) in
any enumerable or non-enumerable property of the surfaced error — this explicitly includes
the error's `.cause` property: the interim plain `Error` MUST NOT carry the underlying
ts-morph/native error as `.cause` or any other own property. `.cause` is the most likely
accidental leak vector when wrapping a caught native error and MUST be asserted absent, not
merely left unmentioned.

**Interim posture (RATIFIED by owner, V2)**: `AuthoringError.reason`'s closed 8-value enum
(`authoring-error-contract` REQ-AEC-01) has no dialect-specific member; growing it is MAJOR
(ADR-0020), OUT OF this change's authorized Capabilities. The owner has RATIFIED the interim:
a plain `Error` with a stable, pinned prefix (`"dialect operation failed: "`) — mirrors the
`stage-4-typed-options` interim pattern used for `reserved-lifecycle-names`/
`run-boundary-input-validation` pending their own `authoring-error-contract` amendment (landed
V3, 2026-07-10). Promoting to a real `AuthoringError{origin:"authoring-rejected"}` (ADR-0021's
reserved slot) needs its own coordinated amendment — registered as committed-next
(`stage-5b-dialect-breadth`), not an open question for this change.

**Message tail structure (ratified, V3)**: after the frozen `"dialect operation failed: "`
prefix, the message TAIL MUST name the failing op and the path, distinguishing the failure
class: a throwing `.raw()` callback MUST render as `raw() on "{path}" threw`; a dialect
`ast.parse` failure MUST render as `could not parse "{path}" as TypeScript`; a dialect
`ast.print` failure MUST render as `could not print "{path}"`. The frozen prefix itself is
unchanged. `typescript-dialect` REQ-TSD-03.4 (not-found message) and REQ-TSD-04.1 (real
parse-failure containment) instantiate this tail structure against the real TypeScript
dialect — the sole dialect this change ships.

#### Scenario REQ-DG-05.1: a throwing .raw callback is contained

- GIVEN `find("a.ts").raw(ast => { throw new Error("boom"); })`
- WHEN the run executes
- THEN the run rejects with an `Error` whose message starts with
  `"dialect operation failed: "` and whose tail is exactly `raw() on "a.ts" threw` — naming
  the failing op (`raw`) and the path, per the tail-structure contract
- AND no AST-library-internal class name or a stack frame referencing the library's own
  module path appears anywhere in the error's message or enumerable/non-enumerable
  properties
- AND the error's `.cause` property is `undefined` (or absent) — the underlying native/library
  error is NOT attached as `.cause` or any other own property, enumerable or not

#### Scenario REQ-DG-05.2: unparseable content is contained the same way

- GIVEN a `find()` targeting a file whose content the dialect's `ast.parse` rejects
  (malformed source)
- WHEN the first op executes
- THEN the run rejects the same way as REQ-DG-05.1 — same pinned prefix, same no-leak
  guarantee (including `.cause` being `undefined`/absent, per REQ-DG-05.1)

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
