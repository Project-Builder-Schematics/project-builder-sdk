# Typed Options Encoding Specification

**Spec version**: V4
**Status**: V4 (2026-11-10, sdk#150, owner-approved via the orchestrator) — supersedes the signed V3 of 2026-07-18
**Change**: `typed-options-feeder`; V4 `native-json-create-options` (ADR-0082)

## Purpose

Schematic authors pass array/object-valued `create` options as native values. Since ADR-0082
(superseding ADR-0060, sdk#150) they cross the wire as native JSON, which engine ADR-0028
defines `options` to be; the SDK no longer JSON-encodes them into strings for the engine's
retired v1 string-promotion rule. This capability defines the SDK-side step at the wire
boundary: native array/object option values are validated and copied, string/number/
boolean/`null` values pass through verbatim, and non-plain-JSON values fail loud instead of
silently dropping or coercing. It applies uniformly across every author-facing surface that
emits a `create` directive.

**Wire-shape scope**: REQ-TOE-01 through REQ-TOE-06 describe the SDK-side wire SHAPE only —
they assume the engine renders/consumes that shape faithfully (the PC-PROTO-01 tether). Engine-
side rendering behaviour is out of scope and untested here.

## Requirements

### REQ-TOE-01: Composite Option Values Cross the Wire as Native JSON

The SDK MUST forward each top-level `options` value that is a native array or plain object as
native JSON — never a JSON string — in a single pass over `Object.entries(options)`, before any
`create` directive crosses the wire boundary. Each composite is copied when `create` is
called, so a later mutation of the author's value does not change the queued directive.
REQ-TOE-04's validation walks every depth in that same pass.

(Previously V1-V3: composite values were JSON-encoded into a string for the engine's v1
string-promotion rule; V4, ADR-0082, forwards them native.)

#### Scenario REQ-TOE-01.1: Native array value stays a native array

- GIVEN `options = { methods: [{ name: "load" }, { name: "save" }] }`
- WHEN options are prepared at the wire boundary
- THEN `methods` is the array `[{ name: "load" }, { name: "save" }]`

#### Scenario REQ-TOE-01.2: Native plain object value stays a native object

- GIVEN `options = { user: { name: "a" } }`
- WHEN prepared
- THEN `user` is the object `{ name: "a" }`

#### Scenario REQ-TOE-01.3: Nested composites stay native at every depth

- GIVEN `options = { methods: [{ tags: ["x", "y"] }] }`
- WHEN prepared
- THEN `methods` is `[{ tags: ["x", "y"] }]` — no level is stringified

#### Scenario REQ-TOE-01.4: Mixed composite/scalar values — order, shape, and passthrough all pinned together

- GIVEN `options` constructed with keys inserted in order `b`, `a`, `c`: `b` a composite
  (`[1, 2]`), `a` a string (`"x"`), `c` a number (`5`)
- WHEN prepared
- THEN insertion order `b`, `a`, `c` is preserved, AND `b` is the array `[1, 2]` while `a` and
  `c` pass through unmodified

#### Scenario REQ-TOE-01.5: A null-prototype object carrying composite data is forwarded as a plain object

- GIVEN `options.registry = Object.create(null)` with own enumerable properties `{ a: 1, b: 2 }`
- WHEN prepared
- THEN `registry` is a plain object `{ a: 1, b: 2 }` with `Object.prototype` — a
  null-prototype object is a dict-like data container, not rejected; rejection is reserved for
  class instances and exotic objects (REQ-TOE-04)

#### Scenario REQ-TOE-01.6: Empty composite values stay empty composites, not skipped

- GIVEN `options = { tags: [], cfg: {} }`
- WHEN prepared
- THEN `tags` is `[]` and `cfg` is `{}`

#### Scenario REQ-TOE-01.7: Empty options object is a no-op

- GIVEN `options = {}`
- WHEN encoded
- THEN the result is `{}` — no keys added, no error

#### Scenario REQ-TOE-01.8: Options entirely absent does not crash

- GIVEN a `create()`/`scaffold()` call made with no `options` argument at all
- WHEN scheduled
- THEN it schedules successfully with no error — the step tolerates an absent `options` value

#### Scenario REQ-TOE-01.9: Composites are copied when scheduled

- GIVEN `methods = [{ name: "load" }]` passed as `options.methods`
- WHEN the author pushes to or edits `methods` after the options are prepared
- THEN the prepared `methods` is still `[{ name: "load" }]`

### REQ-TOE-02: String Option Values Are Never Re-Encoded

The SDK MUST NOT apply JSON encoding to a top-level option value that is already a string —
including a pre-`JSON.stringify`'d string and a string beginning with `[` or `{` — string
values pass through byte-identical. Once the engine removes its v1 string promotion
(engine#286 D3), such a string renders as the string it is; authors pass native values instead.

#### Scenario REQ-TOE-02.1: Pre-stringified composite string passes through byte-identical

- GIVEN `options.methods = '[{"name":"load"}]'` (already a string)
- WHEN encoded
- THEN `options.methods` is the exact same string, byte-identical — never re-encoded (it must
  never become `'"[{\"name\":\"load\"}]"'`)

#### Scenario REQ-TOE-02.2: An ordinary string beginning `[`/`{` passes through unmodified

- GIVEN `options.note = "[not actually an array]"`
- WHEN encoded
- THEN `options.note` passes through verbatim — the SDK applies no protective transform

### REQ-TOE-03: Scalar and Null Option Values Pass Through Verbatim

The SDK MUST pass top-level number, boolean, and `null` option values through unmodified —
`null` MUST NEVER be JSON-stringified (it is a valid `JsonValue`, and the engine gives a
"present but null" value its own typed error).

#### Scenario REQ-TOE-03.1: Number and boolean values pass through unmodified

- GIVEN `options = { count: 3, active: true }`
- WHEN encoded
- THEN `options` equals `{ count: 3, active: true }`, same types

#### Scenario REQ-TOE-03.2: Null passes through as null, never the string "null"

- GIVEN `options = { note: null }`
- WHEN encoded
- THEN `options.note` is `null` (not the string `"null"`)

#### Scenario REQ-TOE-03.3: A non-finite number (`NaN`/`Infinity`) is a deliberate carve-out, not rejected

- GIVEN a top-level option value that is a non-finite number (`NaN`, `Infinity`, `-Infinity`)
- WHEN encoded
- THEN it passes the plain-JSON predicate (`typeof "number"`) like any other number and is NOT
  rejected by REQ-TOE-04 — this is DELIBERATE, not an oversight: rejecting non-finite numbers at
  scheduling time would make Stage-2 REQ-14.3's flush-time `unrepresentable-content` guard
  unreachable for create-options (design §4.2d)
- AND GIVEN the same non-finite number nested inside a composite (array/object) option value
- WHEN that composite is prepared
- THEN it stays a number inside the copied composite, and the flush-time round-trip guard
  rejects the batch as `unrepresentable-content` — the same outcome as a top-level non-finite
  number, never a silent `null`

### REQ-TOE-04: Loud Rejection of Non-Plain-JSON Option Values

The SDK MUST reject, at scheduling time (the `create()`/`scaffold()` call, before any directive
enters the batch), any option value — top-level or nested inside a composite value — that is
`undefined`, a function, a symbol, a `BigInt`, a circular reference, or an instance of
`Date`/`Map`/a class (non-plain-JSON). The error message MUST name the offending option key in
author vocabulary and MUST NOT be a raw serializer `TypeError`. The SDK MUST NEVER silently
drop the value (`JSON.stringify`'s default `undefined`-drop behavior) nor let a raw `TypeError`
propagate. The error's class/attribution depth (e.g. plain Error vs a richer type) is a
design decision — only the message contract is pinned here. This error-class cap — plain
`Error` acceptable now, full `AuthoringError` attribution parity registered as a followup — is
a DELIBERATE owner/pm ruling made per Stage-4 precedent (interim plain-`Error` acceptance ahead
of full attribution), not an unintentional drift from the proposal's Stage-2 `AuthoringError`
framing.

#### Scenario REQ-TOE-04.1: Top-level `undefined` option value rejects loud, naming the key

- GIVEN `options = { userMethods: undefined }`
- WHEN `create()`/`scaffold()` schedules the directive
- THEN it throws/rejects with a message naming `"userMethods"` — never silently omits the key

#### Scenario REQ-TOE-04.2: Nested `undefined` inside a composite value rejects loud

- GIVEN `options = { methods: [{ name: "load", tag: undefined }] }`
- WHEN scheduled
- THEN it rejects with a message naming the offending key — never silently drops `tag` from
  the encoded JSON

#### Scenario REQ-TOE-04.3: Function/symbol/BigInt values reject loud, not silently coerced

- GIVEN three option sets, each with one offending value: a function, a symbol, a `BigInt`
- WHEN each is scheduled
- THEN each rejects with a message naming its offending key — none produce a silently-dropped
  key, a coerced value, or a raw "Do not know how to serialize a BigInt" `TypeError` text

#### Scenario REQ-TOE-04.4: Circular reference rejects loud, not a raw TypeError

- GIVEN `options.self` is an object with a property pointing back to itself
- WHEN scheduled
- THEN it rejects with a message naming `"self"` — never the raw "Converting circular
  structure to JSON" `TypeError` text

#### Scenario REQ-TOE-04.5: Date/Map/class-instance values reject as non-plain-JSON

- GIVEN `options.when = new Date()`
- WHEN scheduled
- THEN it rejects with a message naming `"when"` — the SDK never silently coerces a `Date`
  to its ISO string (silent coercion was flagged as a masking-security risk at council)

#### Scenario REQ-TOE-04.6: Map value rejects loud, never silently accepted as an empty object

- GIVEN `options.methodRegistry` is a `Map` instance with entries
- WHEN scheduled
- THEN it rejects with a message naming `"methodRegistry"` — the SDK never silently accepts it
  as the JSON string `'{}'` (the bare `JSON.stringify(new Map())` pitfall)

#### Scenario REQ-TOE-04.7: Class instance value rejects loud, never accepted as its own-property JSON

- GIVEN `options.userProfile` is an instance of a custom class carrying own enumerable
  properties `{ x: 1 }`
- WHEN scheduled
- THEN it rejects with a message naming `"userProfile"` — never silently accepted as the JSON
  string `'{"x":1}'`; only plain objects (REQ-TOE-01.5) encode, class instances never do

#### Scenario REQ-TOE-04.8: Nested function/symbol inside a composite value rejects loud

- GIVEN `options = { methods: [{ name: "load", handler: () => {} }] }` and, separately,
  `options = { userTags: [Symbol("x")] }`
- WHEN each is scheduled
- THEN each rejects with a message naming the offending key — never silently dropped from the
  encoded JSON, the same silent-drop failure mode REQ-TOE-04.2 pins for nested `undefined`

### REQ-TOE-05: Prototype-Safe Encoding

The step MUST assemble its result per top-level entry with `Object.defineProperty` — it MUST
NOT spread or merge the options object — so an option keyed `__proto__` stays a normal own,
enumerable key without triggering prototype assignment.

#### Scenario REQ-TOE-05.1: An option keyed "__proto__" encodes as a normal own key

- GIVEN `options` carries an OWN `"__proto__"` key (e.g. via `Object.defineProperty` or
  `JSON.parse`) with a composite value
- WHEN encoded
- THEN the resulting options carries an own `"__proto__"` key holding the composite value,
  and `Object.prototype` gains no new members

### REQ-TOE-06: Consistent Encoding Across All Author-Facing Emission Surfaces

The SAME encode step MUST apply identically across `create()` inline template,
`create({templateFile})`, and `scaffold` expansion's by-value directive construction — no
surface may emit composite option values differently from another.

#### Scenario REQ-TOE-06.1: Same native-array option produces byte-identical output on both surfaces, anchored to the absolute expected string

- GIVEN the same `options = { methods: [{ name: "load" }] }`, once passed through
  `commons.create()`'s inline-template surface and once through `scaffold`'s by-value expansion
  for an equivalent file
- WHEN both directives are constructed
- THEN their `create.options.methods` fields are equal to each other, AND both equal the
  absolute anchor `[{ name: "load" }]` — cross-equality between the two surfaces alone is
  insufficient (a shared mutation could make both surfaces wrong identically)

#### Scenario REQ-TOE-06.2: `create({templateFile})` produces the same encoded output as the inline surface

- GIVEN the same `options = { methods: [{ name: "load" }] }`, once passed through
  `commons.create()`'s inline-template form and once through `create({templateFile})`
- WHEN both directives are constructed
- THEN their `create.options.methods` fields are equal to each other and to the value pinned in
  REQ-TOE-06.1 — all three author-facing surfaces converge on one output

### REQ-TOE-07: Recorded Batches Reflect Wire-Form Options

`@pbuilder/sdk/testing`'s recorded batches MUST show composite option values in their wire
form — since ADR-0082 the native arrays/objects the author passed, matching what crosses the
wire boundary via `DirectiveFactory.create()`. This
invariant applies whether a batch is recorded via a live `create()`/`scaffold()` call OR
constructed via the test-side parallel builder (`test/fake/directive-builders.ts`'s
`createOp`): recorded fake batches MUST match real factory output for the same options. The
mechanism (e.g. whether `createOp` itself calls the shared encode helper, or an equivalence
test proves the match) is a design decision, not pinned here.

#### Scenario REQ-TOE-07.1: A recorded batch's create.options shows the native value

- GIVEN a `create()` call with `options.methods = [{ name: "load" }]`, recorded via the
  testing surface
- WHEN the recorded batch is inspected
- THEN `batch[0].create.options.methods` is the native array `[{ name: "load" }]`, not a JSON
  string

#### Scenario REQ-TOE-07.2: `createOp` test builder output matches the real factory for composite options

- GIVEN `options.methods = [{ name: "load" }]` passed once to a live `create()`/`scaffold()`
  call recorded via the testing surface, and once constructed directly via
  `test/fake/directive-builders.ts`'s `createOp`
- WHEN both resulting batch entries are compared
- THEN their `create.options.methods` fields are equal — the fake builder's output
  matches real factory output for the same options, regardless of how `createOp` internally
  achieves the match

### REQ-TOE-08: `pendingDirectives()` Remains Options-Blind

`pendingDirectives()`'s plan entries MUST NOT expose `options` in any form — the options step MUST NOT create a new options-surfacing path into
`PendingDirective`.

#### Scenario REQ-TOE-08.1: A create() call with composite options produces no options field in PendingDirective

- GIVEN a `create()` call with `options.methods = [{ name: "load" }]`, run under `pendingDirectives()`
- WHEN the `PendingDirective` for that create is inspected
- THEN it carries no options-shaped field — only `verb`/`path`/`kind` (per existing
  `pendingDirectives()` contract)

### REQ-TOE-09: Documentation Teaches Native Arrays With Zero Stringify Mentions, Preserving the Testing-Observability Note

`docs/create-templates.md` MUST NOT mention `JSON.stringify` for options anywhere; the §1
example MUST pass a native array/object option value; the §Appendix "passing arrays and
objects in v1" mechanism section MUST be removed entirely. The testing-observability note
(that `@pbuilder/sdk/testing` recorded batches show composite option values as the native
values passed, REQ-TOE-07) MUST be PRESERVED — it documents observable author-facing behaviour, not
an internal mechanism, and MUST NOT be swept away as part of the stringify-removal edit.

(Previously V1: silent on whether the testing-observability note survives the stringify purge;
V2 pins it as explicitly preserved.)

#### Scenario REQ-TOE-09.1: docs/create-templates.md contains zero options-related JSON.stringify mentions

- GIVEN the final `docs/create-templates.md` file
- WHEN grepped for `JSON.stringify`
- THEN zero matches are found, AND §1's example options value is a native array (not a
  stringified one), AND no "passing arrays and objects in v1" appendix section exists

#### Scenario REQ-TOE-09.2: The testing-observability note survives the stringify purge

- GIVEN the final `docs/create-templates.md`
- WHEN inspected for the recorded-batches note (that `@pbuilder/sdk/testing` shows composite
  options as the native values passed)
- THEN the note is still present — it is preserved observable behaviour, not a removed
  internals/mechanism explanation

## Out of Scope

- Engine-side removal of the v1 promotion rule for `[`/`{`-prefixed strings (engine#286 D3) —
  it follows this change in the engine repo and is untested here.
- `pbuilder-codegen` typed-options schema changes.

## Sensitive Areas Coverage

No sensitive areas covered. This change reshapes a JSON-serializable value one layer above the
JSON-RPC wire client (`src/core/session.ts`, the registered `security (IPC)` row); the
transport/framing layer is untouched, matching triage's and explore's own crosscheck.

## Changelog

- **V4 (2026-11-10, sdk#150, ADR-0082)**: composite option values cross the wire as native JSON,
  copied when scheduled (REQ-TOE-01, new REQ-TOE-01.9); nested non-finite numbers reach the
  round-trip guard instead of becoming `null` (REQ-TOE-03.3); REQ-TOE-05/06/07/09 reworded to the
  native form. Validation (REQ-TOE-04) is unchanged.

- **V3 micro-unfreeze (post-final-verify council round)**: REQ-TOE-03.3 added, behaviour-
  recording only, no production change — owner ratification at archive.
