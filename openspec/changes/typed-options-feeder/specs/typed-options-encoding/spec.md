# Typed Options Encoding Specification

**Spec version**: V3
**Status**: signed (V2, owner 2026-07-18) + V3 micro-unfreeze pending owner ratification
**Change**: `typed-options-feeder`

## Purpose

Schematic authors currently hand-`JSON.stringify` every array/object-valued `create` option
because the engine's v1 wire only promotes a string value beginning `[`/`{` into a real
structure. This capability defines the SDK-side encode step that closes that gap: native
array/object option values are JSON-encoded at the wire boundary automatically, string/number/
boolean/`null` values pass through verbatim, and non-plain-JSON values fail loud instead of
silently dropping or coercing. It applies uniformly across every author-facing surface that
emits a `create` directive.

**Wire-shape scope**: REQ-TOE-01 through REQ-TOE-06 describe the SDK-side wire SHAPE only —
they assume the engine renders/consumes that shape faithfully (the PC-PROTO-01 tether). Engine-
side rendering behaviour is out of scope and untested here.

## Requirements

### REQ-TOE-01: Shallow Top-Level Encode of Composite Option Values

The SDK MUST JSON-encode each top-level `options` value that is a native array or plain object
into a JSON string, in a single pass over `Object.entries(options)`, before any `create`
directive crosses the wire boundary. "Single pass, no recursion" describes the ENCODING
MECHANISM only — one `JSON.stringify` call per composite value, with no independent
SDK-introduced re-stringification of nested content and no restructuring beyond the top-level
wrap. It does NOT exempt nested non-plain-JSON values from validation: REQ-TOE-04's nested-value
rejection (`undefined`, function, symbol, etc.) is enforced within that same single pass — the
mechanism by which validation and encoding share one pass (e.g. a throwing `JSON.stringify`
replacer vs. a pre-walk) is a DESIGN decision, not pinned here.

(Previously V1: "no recursion into nested values" read as a blanket exemption for nested
content, which conflicted with REQ-TOE-04's nested-`undefined`/function/symbol rejection; V2
clarifies the "no recursion" scope to the ENCODING mechanism only.)

#### Scenario REQ-TOE-01.1: Native array value encodes to a JSON string

- GIVEN `options = { methods: [{ name: "load" }, { name: "save" }] }`
- WHEN options are encoded at the wire boundary
- THEN `methods` becomes the JSON string `'[{"name":"load"},{"name":"save"}]'`

#### Scenario REQ-TOE-01.2: Native plain object value encodes to a JSON string

- GIVEN `options = { user: { name: "a" } }`
- WHEN encoded
- THEN `user` becomes the JSON string `'{"name":"a"}'`

#### Scenario REQ-TOE-01.3: Nested composites ride inside the single top-level encode

- GIVEN `options = { methods: [{ tags: ["x", "y"] }] }`
- WHEN encoded
- THEN `methods` becomes the JSON string `'[{"tags":["x","y"]}]'` — the nested array is never
  independently re-stringified into a doubly-escaped form

#### Scenario REQ-TOE-01.4: Mixed composite/scalar values — order, encode, and passthrough all pinned together

- GIVEN `options` constructed with keys inserted in order `b`, `a`, `c`: `b` a composite
  (`[1, 2]`), `a` a string (`"x"`), `c` a number (`5`)
- WHEN encoded
- THEN insertion order `b`, `a`, `c` is preserved, AND `b` becomes the JSON string `'[1,2]'`
  while `a` and `c` pass through unmodified — the everyday mixed-shape call is asserted
  end-to-end, not just key order

#### Scenario REQ-TOE-01.5: A null-prototype object carrying composite data encodes (dict-like container)

- GIVEN `options.registry = Object.create(null)` with own enumerable properties `{ a: 1, b: 2 }`
  assigned onto it
- WHEN encoded
- THEN `registry` becomes the JSON string `'{"a":1,"b":2}'` — a null-prototype object is a
  plain, dict-like data container and is ENCODED, not rejected; rejection is reserved for class
  instances and exotic objects (REQ-TOE-04), never for `Object.create(null)` shapes

#### Scenario REQ-TOE-01.6: Empty composite values encode to their empty JSON form, not skipped

- GIVEN `options = { tags: [], cfg: {} }`
- WHEN encoded
- THEN `tags` becomes the JSON string `'[]'` and `cfg` becomes the JSON string `'{}'` — an
  empty array/object is not falsy-skipped by a truthiness check; it encodes like any other
  composite value

#### Scenario REQ-TOE-01.7: Empty options object is a no-op

- GIVEN `options = {}`
- WHEN encoded
- THEN the result is `{}` — no keys added, no error

#### Scenario REQ-TOE-01.8: Options entirely absent does not crash

- GIVEN a `create()`/`scaffold()` call made with no `options` argument at all
- WHEN scheduled
- THEN it schedules successfully with no error — the encode step tolerates an absent `options`
  value

### REQ-TOE-02: String Option Values Are Never Re-Encoded

The SDK MUST NOT apply JSON encoding to a top-level option value that is already a string —
including a pre-`JSON.stringify`'d string and a string beginning with `[` or `{` — string
values pass through byte-identical. This is the backward-compatibility mechanism: existing
call sites that manually `JSON.stringify`'d their options keep working unchanged.

#### Scenario REQ-TOE-02.1: Pre-stringified composite string passes through byte-identical

- GIVEN `options.methods = '[{"name":"load"}]'` (already a string)
- WHEN encoded
- THEN `options.methods` is the exact same string, byte-identical — never re-encoded (it must
  never become `'"[{\"name\":\"load\"}]"'`)

#### Scenario REQ-TOE-02.2: An ordinary string beginning `[`/`{` passes through unmodified

- GIVEN `options.note = "[not actually an array]"`
- WHEN encoded
- THEN `options.note` passes through verbatim — the SDK applies no protective transform;
  the engine's own v1 promotion rule interpreting such strings downstream is a known,
  documented limit, out of scope for this change

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
- WHEN that composite is JSON-encoded
- THEN the non-finite number coerces to JSON `null` in the encoded string (plain
  `JSON.stringify` semantics, not an SDK-introduced transform) — the engine's typed
  "present but null" error makes this LOUD downstream, at render time, not silently accepted

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

The encode step MUST call `JSON.stringify(value)` directly per top-level entry — it MUST NOT
spread or merge the options object before encoding — so an option keyed `__proto__` encodes as
a normal own, enumerable key without triggering prototype assignment.

#### Scenario REQ-TOE-05.1: An option keyed "__proto__" encodes as a normal own key

- GIVEN `options` carries an OWN `"__proto__"` key (e.g. via `Object.defineProperty` or
  `JSON.parse`) with a composite value
- WHEN encoded
- THEN the resulting options carries an own `"__proto__"` key holding the JSON-encoded
  string, and `Object.prototype` gains no new members

### REQ-TOE-06: Consistent Encoding Across All Author-Facing Emission Surfaces

The SAME encode step MUST apply identically across `create()` inline template,
`create({templateFile})`, and `scaffold` expansion's by-value directive construction — no
surface may emit composite option values differently from another.

#### Scenario REQ-TOE-06.1: Same native-array option produces byte-identical output on both surfaces, anchored to the absolute expected string

- GIVEN the same `options = { methods: [{ name: "load" }] }`, once passed through
  `commons.create()`'s inline-template surface and once through `scaffold`'s by-value expansion
  for an equivalent file
- WHEN both directives are constructed
- THEN their `create.options.methods` fields are byte-identical to each other, AND both equal
  the absolute string `'[{"name":"load"}]'` — cross-equality between the two surfaces alone is
  insufficient (a shared encode-mutation could make both surfaces wrong identically)

#### Scenario REQ-TOE-06.2: `create({templateFile})` produces the same encoded output as the inline surface

- GIVEN the same `options = { methods: [{ name: "load" }] }`, once passed through
  `commons.create()`'s inline-template form and once through `create({templateFile})`
- WHEN both directives are constructed
- THEN their `create.options.methods` fields are byte-identical to each other and to the value
  pinned in REQ-TOE-06.1 — all three author-facing surfaces converge on one encoded output

### REQ-TOE-07: Recorded Batches Reflect Wire-Form (Encoded) Options

`@pbuilder/sdk/testing`'s recorded batches MUST show composite option values in their encoded
(wire) string form — matching what actually crosses the wire boundary via
`DirectiveFactory.create()` — never the author's original native array/object shape. This
invariant applies whether a batch is recorded via a live `create()`/`scaffold()` call OR
constructed via the test-side parallel builder (`test/fake/directive-builders.ts`'s
`createOp`): recorded fake batches MUST match real factory output for the same options. The
mechanism (e.g. whether `createOp` itself calls the shared encode helper, or an equivalence
test proves the match) is a design decision, not pinned here.

#### Scenario REQ-TOE-07.1: A recorded batch's create.options shows the encoded string

- GIVEN a `create()` call with `options.methods = [{ name: "load" }]`, recorded via the
  testing surface
- WHEN the recorded batch is inspected
- THEN `batch[0].create.options.methods` is the JSON-encoded string `'[{"name":"load"}]'`,
  not the native array

#### Scenario REQ-TOE-07.2: `createOp` test builder output matches the real factory for composite options

- GIVEN `options.methods = [{ name: "load" }]` passed once to a live `create()`/`scaffold()`
  call recorded via the testing surface, and once constructed directly via
  `test/fake/directive-builders.ts`'s `createOp`
- WHEN both resulting batch entries are compared
- THEN their `create.options.methods` fields are byte-identical — the fake builder's output
  matches real factory output for the same options, regardless of how `createOp` internally
  achieves the match

### REQ-TOE-08: `dryRun()` Remains Options-Blind

`dryRun()`'s plan entries MUST NOT expose `options` in any form (encoded or native) — the
encode step introduced by this change MUST NOT create a new options-surfacing path into
`DryRunEntry`.

#### Scenario REQ-TOE-08.1: A create() call with composite options produces no options field in DryRunEntry

- GIVEN a `create()` call with `options.methods = [{ name: "load" }]`, run under `dryRun()`
- WHEN the `DryRunEntry` for that create is inspected
- THEN it carries no options-shaped field — only `verb`/`path`/`kind` (per existing
  `dryRun()` contract)

### REQ-TOE-09: Documentation Teaches Native Arrays With Zero Stringify Mentions, Preserving the Testing-Observability Note

`docs/create-templates.md` MUST NOT mention `JSON.stringify` for options anywhere; the §1
example MUST pass a native array/object option value; the §Appendix "passing arrays and
objects in v1" mechanism section MUST be removed entirely. The testing-observability note
(that `@pbuilder/sdk/testing` recorded batches show composite option values in their encoded
wire form, REQ-TOE-07) MUST be PRESERVED — it documents observable author-facing behaviour, not
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
  options in their encoded wire form)
- THEN the note is still present — it is preserved observable behaviour, not a removed
  internals/mechanism explanation

## Out of Scope

- Engine-side native-JSON promotion changes (PC-PROTO-01) — the engine's v1 promotion rule
  for `[`/`{`-prefixed strings is unchanged and untested here.
- `pbuilder-codegen` typed-options schema changes.
- Deep/recursive per-leaf encoding — the shallow, top-level-only walk is BY DESIGN (REQ-TOE-01).
- SDK-side protection for ordinary string literals that happen to begin `[`/`{` — REQ-TOE-02.2
  documents this as a known, engine-owned limit; the SDK does not guard against it.

## Sensitive Areas Coverage

No sensitive areas covered. This change reshapes a JSON-serializable value one layer above the
JSON-RPC wire client (`src/core/session.ts`, the registered `security (IPC)` row); the
transport/framing layer is untouched, matching triage's and explore's own crosscheck.

## Changelog

- **V3 micro-unfreeze (post-final-verify council round)**: REQ-TOE-03.3 added, behaviour-
  recording only, no production change — owner ratification at archive.
