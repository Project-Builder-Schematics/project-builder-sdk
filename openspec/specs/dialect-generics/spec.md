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

### REQ-DG-02: Op-pack composition — value-level intersection, compile-time enforced

`defineOpPack(ops)` MUST declare a named record of ops over one AST type; `withOps(base,
...packs)` MUST compose them onto a dialect's handle type as the INTERSECTION of all
attached op maps (ADR-0010) — an op from an unattached pack, or a typo, MUST be a compile
error. Op-name collisions across packs are OUT OF SCOPE (B2): resulting behaviour is
UNDEFINED and DEFERRED — this spec MUST NOT require a collision diagnostic.

#### Scenario REQ-DG-02.1: chain type-checks only through attached ops

- GIVEN a dialect composed via `withOps(base, addImportPack)`
- WHEN author code chains `.addImport(...)` on a `find()` handle
- THEN it type-checks; calling an op from an unattached pack does NOT type-check
  (`expectTypeOf` negative pin)

#### Scenario REQ-DG-02.2: single-pack composition has no collision to prove

- GIVEN this change composes exactly one starter op-pack onto the TypeScript dialect
- WHEN the conformance/fitness suite runs
- THEN no cross-pack collision diagnostic is asserted — a second pack triggering collision is
  committed-next (`stage-5b-dialect-breadth`)

#### Scenario REQ-DG-02.3: defineOpPack in isolation

- GIVEN `defineOpPack({ addImport: (ast, name, from) => { /* ... */ } })` called on its OWN,
  not yet composed via `withOps`
- WHEN its return value is inspected
- THEN it is a named record of ops over the declared AST type — usable standalone (e.g.
  shareable across two dialects targeting the same AST type) before any `withOps` composition
  occurs

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

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — `.raw()` | REQ-DG-03, REQ-DG-05 | Yes |
| security (third-party trust) — dialect kit boundary | REQ-DG-04 | Yes |
