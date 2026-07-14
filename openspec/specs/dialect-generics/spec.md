# Delta for dialect-generics

**Spec version**: V2
**Status**: signed (owner, 2026-07-14)
**Change**: `author-write-surface`

Terminology: see `foundations-skeleton`'s Glossary — `replaceContent(content)` (wholesale-replace)
vs. `.modify(fn)` (AST escape hatch). This file's V1 prose used "wholesale-string-replace" in one
spot (REQ-DG-03) — corrected to "wholesale-replace" in V2 for consistency.

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
COLLIDES with the base handle's own vocabulary (`then`, `read`, `modify`, `raw`, `replaceContent`):
an op-pack op named `then` in particular would break the handle's `PromiseLike` join, silently
corrupting the chain's thenable contract. This reserved-name check runs at the SAME `withOps`
composition point as the cross-pack collision check above, not as a separate pass (Stage-4
reserved-names precedent). The reserved-name set is `RESERVED_HANDLE_NAMES = ["then", "read",
"raw", "modify", "replaceContent", "rename", "move", "copy", "remove"]` (exactly 9 members) —
`raw` STAYS reserved even though the `.raw(fn)` verb is removed (an op-pack op literally named
`raw` must never resolve, closing the muscle-memory collision path); `replaceContent` is ADDED
as the new wholesale-replace verb's reserved name; `modify` STAYS reserved too, now protecting
the live AST-fn escape hatch itself (an op-pack op literally named `modify` would shadow the
universal `.modify(fn)` method, not merely a retired name). The thrown collision error — for
BOTH the cross-pack collision (REQ-DG-02.4) and the reserved-name collision (this paragraph) —
MUST be a PLAIN `Error` (not `dialectError`-minted, design §4.5): it MUST NOT carry the frozen
`"dialect operation failed: "` prefix and MUST NOT be recognised by the module-private
containment brand `isContained` (`dialect-generics` REQ-DG-06) — a composition-time collision is
an AUTHOR-CODE-STRUCTURE error, surfaced synchronously outside any run, never a contained
run-time rejection; conflating the two would let a collision error be silently rethrown verbatim
by `runOp`'s passthrough branch as if it were an already-contained error.

(Previously: the reserved-name collision set was `["then", "read", "raw", "modify", "rename",
"move", "copy", "remove"]` (8 members; illustrative prose named only `then, read, modify, raw`).
This change adds `replaceContent` (9th member) and keeps `raw` blocked as a deliberate
guardrail — owner decision, engram #2117 — even though no verb named `raw` is callable
anymore. `RESERVED_HANDLE_NAMES`'s exact array is now pinned as scenario text, not left to
illustrative prose alone. V2: added the plain-`Error`/non-`isContained` requirement on the
collision error itself (security finding), an exact-array deep-equal scenario, and an explicit
collision scenario for `modify` — V1 only exercised `then`, `raw`, and `replaceContent`
collisions, leaving the live `modify` escape hatch's own name unprotected by an explicit test.)

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
- AND the thrown error is a PLAIN `Error` — it does NOT carry the `"dialect operation failed: "`
  prefix and `isContained(thrown)` (the module-private WeakSet brand, REQ-DG-06) is `false`

#### Scenario REQ-DG-02.5: op named `then` collides with the base handle vocabulary

- GIVEN an op-pack declaring an op literally named `then`
- WHEN it is passed to `withOps(base, pack)`
- THEN it throws synchronously, and the thrown message names `then` as colliding with the
  reserved base-handle vocabulary

#### Scenario REQ-DG-02.6: reserve-both — `raw` AND `replaceContent` both collide (NEW)

- GIVEN two SEPARATE op-packs, one declaring an op literally named `raw`, the other declaring
  an op literally named `replaceContent` — each passed to its OWN `withOps(base, pack)` call
- WHEN each composition runs
- THEN BOTH throw synchronously, each thrown message naming the respective colliding op —
  `raw` collides despite the `.raw(fn)` verb no longer existing (guardrail intact); `replaceContent`
  collides as the newly reserved wholesale-replace verb name
- AND the `raw` collision's thrown message carries a one-clause hint pointing the author at the
  live escape hatch — naming `.modify(fn)` as the currently-callable AST-fn method, so a
  contributor who reaches for the retired `raw` name is redirected to what actually exists today

#### Scenario REQ-DG-02.7: `RESERVED_HANDLE_NAMES` is exactly the pinned 9-member array (NEW, V2)

- GIVEN `RESERVED_HANDLE_NAMES` as shipped
- WHEN it is compared via deep-equal (`toEqual`, never a subset/`toContain` check)
- THEN it equals exactly `["then", "read", "raw", "modify", "replaceContent", "rename", "move",
  "copy", "remove"]`, in this order — an extra or missing member fails RED

#### Scenario REQ-DG-02.8: op named `modify` collides with the live escape hatch (NEW, V2)

- GIVEN an op-pack declaring an op literally named `modify`
- WHEN it is passed to `withOps(base, pack)`
- THEN it throws synchronously, the thrown message names `modify` as colliding with the reserved
  base-handle vocabulary, and the thrown error is a PLAIN `Error` (not `isContained`, per
  REQ-DG-02.4) — this protects the LIVE `.modify(fn)` escape hatch itself, not merely a retired
  name like `raw`

### REQ-DG-03: Universal `.modify(ast => …)` escape hatch — coalesces with named ops

Every dialect handle MUST expose `.modify(fn: (ast) => void)` as the universal L2 escape hatch
(ADR-0006): `fn` receives the SAME already-parsed, already-live AST instance the handle's L1
named ops mutate — the author never re-parses or serializes. A chain mixing L1 named ops and
`.modify()` on one handle MUST coalesce into the SAME single `modify` directive as an all-L1
chain. `.modify` is FN-ONLY — a string argument MUST NOT typecheck; the dialect handle's
separate wholesale-replace verb is `.replaceContent(content: string)`
(`modify-coalescing` REQ-MC-08), a DISTINCT method, never an overload of `.modify`. `.raw` is
REMOVED from the dialect handle's type entirely — no property of that name exists, at BOTH the
type level (compile-time negative pin, REQ-DG-03.4) and the RUNTIME level (`'raw' in handle`
MUST be `false`).

(Previously: this escape hatch was named `.raw(fn: (ast) => void)`, and `modify` on the same
handle was a SEPARATE string-only wholesale-replace verb. This change swaps the names: the
fn-based AST escape hatch is now `.modify(fn)`; the string-based wholesale replace is now
`.replaceContent(content)` — two distinct methods, same as before, just renamed and with no
runtime polymorphism merging them into one overloaded `modify`. V2: REQ-DG-03.4 strengthened
from a compile-time-only pin to also require the runtime absence check — a type-level negative
alone would not catch a handle object that still carries an enumerable `raw` property at
runtime despite the type hiding it.)

#### Scenario REQ-DG-03.1: .modify shares the same AST as a preceding named op

- GIVEN `find("a.ts").addImport(...).modify(ast => { /* further mutation */ })`
- WHEN the run flushes
- THEN exactly ONE `modify` directive is emitted, and its content reflects BOTH the named-op
  mutation and the `.modify()` (AST-fn) mutation

#### Scenario REQ-DG-03.2: `.modify` first, then a named op — same coalescing, either order

- GIVEN `find("a.ts").modify(ast => { /* mutation */ }).addImport(...)` — `.modify()` (AST-fn
  form) BEFORE the named op (reverse of REQ-DG-03.1's order)
- WHEN the run flushes
- THEN exactly ONE `modify` directive is emitted, content reflecting BOTH mutations —
  coalescing holds regardless of `.modify`/named-op ordering

#### Scenario REQ-DG-03.3: `.modify` is fn-only — a string argument fails to compile (NEW)

- GIVEN a dialect handle's `.modify` method
- WHEN it is called with a string argument (`handle.modify("some content")`)
- THEN it fails to typecheck — a compile-time negative pin (`expectTypeOf`) proving `.modify`
  accepts only `(ast) => void`, never a string; the paired positive pin is REQ-DG-03.1/.2

#### Scenario REQ-DG-03.4: `.raw` is absent from the dialect Handle type AND at runtime (NEW; V2 adds the runtime half)

- GIVEN a dialect handle's type
- WHEN `handle.raw` is referenced
- THEN it fails to typecheck — a compile-time negative pin proving `.raw` no longer exists as
  a property on any dialect handle, chained or otherwise
- AND (V2) GIVEN a REAL dialect handle instance at runtime, WHEN `'raw' in handle` is evaluated,
  THEN it is `false` — the compile-time pin alone would not catch a handle object that still
  carries an enumerable (or non-enumerable) `raw` property despite the type declaration hiding it

### REQ-DG-04: Sanctioned dialect-author API surface (kit boundary, ADR-0009)

The dialect-author API — `defineDialect`, `defineOpPack`, `withOps`, and the handle's
`.modify()` (AST-fn form) — MUST be the ONLY kit-layer surface importable by a dialect package
(`./typescript` and any future dialect); `Session`/`DirectiveFactory`/`EngineClient` remain
kit-internal and MUST NOT be imported by dialect code. `REQ-FIT-08` (`foundations-skeleton`,
text UNCHANGED) already forbids kit-symbol re-export generically and extends to `./typescript`
automatically once that subpath exists — no REQ-FIT-08 text change, only a new exercised case.
This inheritance includes FIT-08's own red-proof obligation, made explicit here: a planted case
importing `Session`/`DirectiveFactory`/`EngineClient` from `src/dialects/typescript/**` MUST
fail RED against FIT-08's existing scan — not a new fitness function, an inherited one
exercised against the new subpath.

(Previously: named the escape hatch as "the handle's `.raw()`". Renamed to "the handle's
`.modify()` (AST-fn form)" — no change to the sanctioned-surface boundary itself, only to the
verb's name.)

#### Scenario REQ-DG-04.1: the TS dialect package imports only the sanctioned surface

- GIVEN `src/dialects/typescript/**`'s own import graph
- WHEN scanned
- THEN it imports only `defineDialect`/`defineOpPack`/`withOps` from
  `core/define-dialect.ts` (plus its own AST library) — no `Session`/`DirectiveFactory`/
  `EngineClient` import

### REQ-DG-05: `.modify()` execution is contained — no unguarded escape, no library leak (interim)

A `.modify(ast => …)` callback that throws, and a dialect `ast.parse`/`ast.print` failure, MUST
NOT escape the run as an unguarded native exception, and MUST NOT leak AST-library-internal
state (node identity, internal class names, stack frames naming the library's internals) in
any enumerable or non-enumerable property of the surfaced error — this explicitly includes
the error's `.cause` property: the interim plain `Error` MUST NOT carry the underlying
ts-morph/native error as `.cause` or any other own property. `.cause` is the most likely
accidental leak vector when wrapping a caught native error and MUST be asserted absent, not
merely left unmentioned.

**Interim posture (RATIFIED by owner, V2 of the prior change)**: `AuthoringError.reason`'s
closed 12-value enum (`authoring-error-contract` REQ-AEC-01) has no dialect-specific member;
growing it is MAJOR (ADR-0020), OUT OF this change's authorized Capabilities. The owner has
RATIFIED the interim: a plain `Error` with a stable, pinned prefix (`"dialect operation
failed: "`) — mirrors the `stage-4-typed-options` interim pattern used for
`reserved-lifecycle-names`/`run-boundary-input-validation` pending their own
`authoring-error-contract` amendment.

**Message tail structure (ratified, prior change; renamed here)**: after the frozen
`"dialect operation failed: "` prefix, the message TAIL MUST name the failing op and the path,
distinguishing the failure class: a throwing `.modify()` callback MUST render as
`modify() on "{path}" threw`; a dialect `ast.parse` failure MUST render as `could not parse
"{path}" as TypeScript`; a dialect `ast.print` failure MUST render as `could not print
"{path}"`. The frozen prefix itself is unchanged. `typescript-dialect` REQ-TSD-03.4
(not-found message) and REQ-TSD-04.1 (real parse-failure containment) instantiate this tail
structure against the real TypeScript dialect.

**Leak-budget constraint (positive pin, V2)**: the foreign-wrap tail — the text appended after
the frozen prefix when wrapping a FOREIGN (not-already-contained) error — interpolates ONLY the
failing op's name and the target path into the tail template above. It MUST NEVER interpolate
the caught error's own `.message`, any of its own properties, or any part of its content — the
wrap is a FRESH message built from a fixed template plus op+path, never a derivative of the
caught error's text. This is the positive counterpart to the no-leak prohibition already stated
above (which forbids specific leak vectors like `.cause`/stack frames/class names); this pin
closes the general case of the caught error's own message text being folded into the tail.

(Previously: the callback was `.raw(fn)` and the tail literal was `raw() on "{path}" threw`.
Renamed: the callback is now `.modify(fn)` and the tail literal is `modify() on "{path}"
threw` — 4 byte-exact test pins across the test suite move in lockstep with this literal, per
this change's Success Criteria. The frozen prefix, the parse-failure tail, and the
print-failure tail are UNCHANGED — only the callback-throw tail's leading verb renames. V2 adds
the leak-budget positive constraint and an async-rejecting `.modify(fn)` containment scenario —
council review noted REQ-DG-05's V1 scenarios only exercised a SYNC throw and a parse failure,
leaving an async-rejecting `.modify(fn)` callback's containment unproven.)

#### Scenario REQ-DG-05.1: a throwing .modify callback is contained

- GIVEN `find("a.ts").modify(ast => { throw new Error("boom"); })`
- WHEN the run executes
- THEN the run rejects with an `Error` whose message starts with
  `"dialect operation failed: "` and whose tail is exactly `modify() on "a.ts" threw` — naming
  the failing op (`modify`) and the path, per the tail-structure contract
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

#### Scenario REQ-DG-05.3: the foreign-wrap tail never interpolates the caught error's own message (NEW, V2)

- GIVEN `find("a.ts").modify(ast => { throw new Error("super secret internal detail"); })`
- WHEN the run rejects
- THEN the surfaced message is EXACTLY `dialect operation failed: modify() on "a.ts" threw` —
  the caught error's own message text (`"super secret internal detail"`) does NOT appear
  anywhere in the surfaced message, byte-checked, not merely absence-of-a-substring-that-
  happens-to-match

#### Scenario REQ-DG-05.4: an async-rejecting `.modify(fn)` callback is contained (NEW, V2)

- GIVEN `find("a.ts").modify(async ast => { throw new Error("boom"); })` — the callback returns
  a promise that REJECTS, not a sync throw
- WHEN the run executes (test-note: `process.on('unhandledRejection')` observed for the whole
  test)
- THEN the run rejects with the SAME pinned-prefix contained error as REQ-DG-05.1 (tail exactly
  `modify() on "a.ts" threw`), no `unhandledRejection` is observed, and ZERO batches are emitted
  for the run — mirrors REQ-DG-06.2's async-rejection containment for the `.modify()` escape
  hatch itself, not just named ops via `runOp`

### REQ-DG-06: `runOp` execution is contained — parity with `.modify()`

A named op invocation via `runOp` (the dispatcher behind every op-pack method, e.g.
`.addImport(...)`) MUST be contained IDENTICALLY to `.modify()`'s containment (REQ-DG-05): a
SYNC throw from the op function, and an ASYNC op literal's rejected returned promise (TS's
void-return compatibility admits an `async (ast, ...args) => {...}` op without a type error),
MUST both surface via the SAME pinned-prefix contained-error contract — never an uncontained
native throw, never an unhandled rejection. An async op's returned promise MUST be `await`ed
INSIDE this containment before the chain proceeds — subsequent chained ops on the SAME handle
MUST NOT run until the async op settles (author-order semantics, mirrors the run-boundary
join's existing sequencing). The contained-invoke MUST distinguish two failure origins: an
ALREADY-CONTAINED error — MUST be RETHROWN VERBATIM, unmodified, with no re-wrap and no
`.cause` attach; a FOREIGN throw MUST be wrapped FRESH (leak-sanitised, REQ-DG-05) per the
existing contract, also with no `.cause` attach. Double-wrapping
(`"dialect operation failed: dialect operation failed: ..."`) or burying a deliberate reject
under a generic `"{op}() threw"` message is a containment bug, not acceptable variance.

**Containment discriminant (security-critical, corrected V2)**: "already-contained" is decided
EXCLUSIVELY by a module-private brand — a `WeakSet<Error>` (or equivalent) populated at the
single point where this module mints a contained error, exposed only through an internal
predicate `isContained(err)`. The discriminant MUST NEVER be `message.startsWith("dialect
operation failed: ")` or any other string/prefix test on the error's message — a message-prefix
check is spoofable by any foreign code that happens to construct (or is tricked into
constructing) an `Error` whose message starts with that exact string, which would then be
rethrown VERBATIM instead of wrapped, leaking whatever the foreign error's message actually
contains under the guise of "this was already sanitised." The brand is checked by IDENTITY
(`WeakSet.has(err)`), never by inspecting the error's own content.

(Previously: this REQ's title and body named the parity target as `.raw()`. Renamed to
`.modify()` — the containment CONTRACT itself (sync throw, async rejection, deliberate-reject
passthrough, no double-wrap) is unchanged; only the escape hatch's name changed. V2 (security
finding, BLOCKING): V1 left the "already carries the frozen prefix" phrasing readable as a
message-prefix check — corrected to explicitly mandate the `WeakSet`-brand/`isContained`
discriminant and explicitly FORBID message-prefix discrimination, with a killer scenario
(REQ-DG-06.6) proving a foreign error whose message coincidentally starts with the frozen prefix
is still wrapped fresh, never rethrown verbatim.)

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
  reject) — an error minted by this module's own contained-error constructor, and therefore
  branded via `isContained` (REQ-DG-06's discriminant), its message already carrying the frozen
  `"dialect operation failed: "` prefix as a SIDE EFFECT of how it was minted, not as the test
  used to recognise it
- WHEN it runs via `runOp`
- THEN the run rejects with that EXACT message, byte-exact — never re-wrapped as
  `"dialect operation failed: dialect operation failed: ..."`, never buried under a generic
  `"{op}() threw"` message

#### Scenario REQ-DG-06.6: a foreign error with a coincidentally-prefixed message is wrapped fresh, never rethrown verbatim (NEW, V2, killer scenario)

- GIVEN an op function that throws a PLAIN, foreign `new Error('dialect operation failed: ' +
  'a message a foreign caller happened to construct with this exact prefix, e.g. by copying it
  from a stack trace or a log line')` — an error that was NEVER minted by this module, never
  added to the `isContained` `WeakSet`, but whose message text happens to start with the frozen
  prefix byte-for-byte
- WHEN it runs via `runOp`
- THEN it is treated as FOREIGN and wrapped FRESH — the run rejects with a NEW contained error
  whose tail is exactly `{op}() threw` (the generic foreign-wrap shape) — it is NOT rethrown
  verbatim, and the foreign error's own message content does NOT appear in the surfaced message
  (REQ-DG-05's leak-budget constraint) — proving the discriminant is the `isContained` brand by
  identity, never a `message.startsWith(...)` string test

### REQ-DG-07: Fail-closed run semantics after any rejection

Once ANY rejection occurs on a run — whether a `.replaceContent()` reject while an AST op is
pending (`modify-coalescing` REQ-MC-08), or an add-op collision reject (REQ-TSD-09/10/11), or
any `runOp`-contained rejection (REQ-DG-06) — the run MUST fail closed: ZERO batches are
emitted for ANY handle in the run, including edits that were enqueued and would otherwise have
flushed cleanly EARLIER in the same run (no partial commit). A further op CHAINED after the
rejection MUST NOT be attempted as a fresh operation — it MUST surface the ORIGINAL pinned
rejection, unchanged; the run is dead once any rejection occurs.

(Previously: named the guard-triggering verb as `.modify()` (REQ-MC-08). Renamed to
`.replaceContent()` — the fail-closed CONSEQUENCE (zero batches, run-wide) is unchanged; only
the verb name that triggers REQ-MC-08's guard renamed. `.modify(fn)` triggering this guard is
explicitly NOT a case — REQ-MC-08's guard scopes to `.replaceContent` only, see
`modify-coalescing` REQ-MC-08's new scenario .5.)

#### Scenario REQ-DG-07.1: row-136 replaceContent-reject is fail-closed

- GIVEN a run with an earlier handle whose edits would flush cleanly, followed by a SECOND
  handle that triggers `modify-coalescing` REQ-MC-08's reject (`.replaceContent()` while an
  AST op is pending)
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
| security (code execution) — `.modify(fn)` escape hatch redesign, `runOp` containment, run-wide fail-closed | REQ-DG-03, REQ-DG-05, REQ-DG-06, REQ-DG-07 | Yes |
| security (third-party trust) — reserve-both `RESERVED_HANDLE_NAMES`, op-pack composition | REQ-DG-02 | Yes |
