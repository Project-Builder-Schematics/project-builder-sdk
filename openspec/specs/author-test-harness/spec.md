# Author Test Harness Specification

**Spec version**: V4
**Status**: signed (2026-07-13 — owner micro-unfreeze, `schematic-local-files` archive sync)
**Change**: `stage-4b-testing-harness` (amended by `schematic-local-files`, 2026-07-13)

**V3 → V4 delta (owner micro-unfreeze, 2026-07-13, via `schematic-local-files`)**: adds
REQ-ATH-14 (widens REQ-ATH-11's in-memory-only carve-out to allow-list `scaffold`/
`copyIn`/`create({templateFile})` reads within the collection root, harness-instrumented
but non-failing), REQ-ATH-15 (a by-reference directive through the harness is emit-only —
never materialized in `result.tree`; a missing package-local source surfaces
`AuthoringError` reason `source-not-found` end-to-end), and REQ-ATH-16 (the conformance
run-vehicle carries fake parity for the by-reference op). No existing REQ-ATH-ID
modified.

## Purpose

Gives schematic authors a supported, in-memory way to run their factory end-to-end and
assert on what actually happened — closing the gap where the founding write-only-factory
bug (a factory that buffers directives but is never observed to commit them) has no
author-facing test that would catch it. `runFactoryForTest` wraps the normative
`ContractFake` with spy-style batch recording; it exposes the RESULT of a run, never kit
machinery. `result.tree` is `committedTree()` ONLY — seed is never included in it; seed is
observed exclusively via the factory's own reads. Authors MAY test `packageDir`-opted-in
typed factories through this harness, not merely bare in-memory ones — REQ-ATH-11 is
scoped to harness MACHINERY (never the factory-under-test's own legitimate disk reads) and
REQ-ATH-13 supports the validation-rejection affordance.

## Requirements

### REQ-ATH-01: `runFactoryForTest` Result Shape

The system MUST expose `runFactoryForTest` (from `./testing`) accepting the function
`defineFactory` produces, the resolved input, and an optional `seed` record, and returning a
`Promise` resolving to an object exposing EXACTLY three own keys: `tree` (the committed
tree, path→content, read via the fake's own `committedTree()` — seed is NEVER included, see
Glossary), `emitted` (the `Batch[]` recorded from every `EngineClient.emit` call, in call
order), and `error` (typed `AuthoringError | unknown`, consistent with REQ-ATH-06's
original-value propagation — `undefined` on success). No kit machinery
(`Session`, `DirectiveFactory`, `EngineClient`, `ContractFake`, `RunContext`,
`currentContext`) is exposed by name — value or type — from `./testing`. The ONLY
sanctioned kit-adjacent types `./testing` re-exports are `Batch` and `Directive`, and both
are TYPE-ONLY — never as runtime values.

#### Scenario REQ-ATH-01.1: Happy-path shape

- GIVEN a factory that creates one file with fixed content
- WHEN run via `runFactoryForTest`
- THEN `result.tree` contains the created path mapped to its content
- AND `result.emitted` is a single `Batch` whose `instructions[0]` is the create directive
- AND `result.error` is `undefined`

#### Scenario REQ-ATH-01.2: Result exposes no field beyond the three

- GIVEN any `runFactoryForTest` result
- WHEN its own enumerable keys are inspected
- THEN they are EXACTLY `{tree, emitted, error}` — no additional field is present

#### Scenario REQ-ATH-01.3: `ContractFake` is not exported by name [red-proof]

- GIVEN a fixture `src/testing/index.ts` that re-exports `ContractFake`, as a value or as a type
- WHEN FIT-08 scans `./testing` under REQ-TES-03's per-path allowlist
- THEN a violation IS reported for `ContractFake`

### REQ-ATH-02: Write-Only Factory Commits at Run End

A factory that only buffers directives and returns — never calling `read` or anything
else — MUST still have its directives committed: `defineFactory`'s existing run-end flush
(REQ-KIT-05) commits on behalf of a write-only factory, and `runFactoryForTest` MUST
observe the COMMITTED result, not merely the emitted batch. This is the founding bug this
harness exists to catch.

#### Scenario REQ-ATH-02.1: Write-only factory still commits

- GIVEN a factory whose body is a single `create(...)` call and nothing else
- WHEN run via `runFactoryForTest`
- THEN `result.tree` contains the created path with its content
- AND `result.error` is `undefined`

### REQ-ATH-03: All-Or-Nothing Rejection Surfaces as Empty Tree + Attributed Error

When the fake rejects a directive (e.g. a collision), the committed tree MUST stay empty
for that run (all-or-nothing holds — nothing partial is ever committed) and `result.error`
MUST be the `AuthoringError` `toAuthoringError` produces, carrying the offending `verb`,
`path`, and closed `reason` (Stage-2's live attribution — `Session.flush` already performs
this conversion at the emit seam).

#### Scenario REQ-ATH-03.1: Collision rejects fail-closed

- GIVEN a factory that seeds `"a.ts"` and then calls `create("a.ts", ...)` without force
- WHEN run via `runFactoryForTest`
- THEN `result.tree` is empty (nothing committed)
- AND `result.error` is an `AuthoringError` with `verb: "create"`, `path: "a.ts"`, `reason: "path-collision"`

#### Scenario REQ-ATH-03.2: Multi-directive batch commits neither entry

- GIVEN a factory batch of `[create("a.ts", ...)` valid, `create("b.ts", ...)` colliding against a seeded `"b.ts"]`
- WHEN run via `runFactoryForTest`
- THEN `result.tree` contains NEITHER `"a.ts"` NOR `"b.ts"` — the valid entry is not
  partially committed alongside the rejection

### REQ-ATH-04: Seeded Read Visibility

`runFactoryForTest`'s `seed` record MUST be visible to the factory's own `find`/read calls
during the run (served from the fake's seed, tree-first, key-membership semantics per the
existing fake contract — never truthiness), but `result.tree` reflects ONLY committed
writes: an unmodified seed path is NEVER present in `result.tree`. If the factory modifies
a seeded path, the MODIFIED content — not the seed — lands in `result.tree`.

#### Scenario REQ-ATH-04.1: Seed is readable; a modify of seeded content lands in tree, the seed itself never does

- GIVEN `runFactoryForTest` called with `seed: { "a.ts": "hello" }` and a factory that reads `"a.ts"`, asserts its content is `"hello"`, then calls `modify("a.ts", "hello-modified")`
- WHEN the factory runs
- THEN the factory's own read observed `"hello"`
- AND `result.tree` contains `"a.ts" → "hello-modified"` — the committed modify, not the seed

#### Scenario REQ-ATH-04.2: Seeded empty string and absent-path read semantics

- GIVEN `seed: { "empty.ts": "" }` and a factory that reads `"empty.ts"` and `"missing.ts"` (never seeded)
- WHEN run via `runFactoryForTest`
- THEN the factory's read of `"empty.ts"` observes `""` (key-membership, not truthiness)
- AND the factory's read of `"missing.ts"` observes `undefined`

### REQ-ATH-05: Empty Factory Yields Empty Tree, No Error

A factory that neither buffers a directive nor throws MUST produce an empty `result.tree` —
seed is NEVER reflected in `result.tree` regardless of whether it is present (REQ-ATH-04) —
and `result.error === undefined`. The harness does not manufacture a rejection where the
fake's contract has none.

#### Scenario REQ-ATH-05.1: No-op factory

- GIVEN a factory whose body does nothing (returns immediately) and no seed
- WHEN run via `runFactoryForTest`
- THEN `result.tree` is empty
- AND `result.error` is `undefined`

### REQ-ATH-06: Factory Throw — Discard, Cause Preserved

When the factory function itself throws (before or after buffering directives), the
staged set MUST be discarded (`result.tree` empty for those paths) and `result.error` MUST
be the ORIGINAL thrown value — never replaced by a discard-time failure. If discard itself
also fails, its failure is attached as `.cause` on the original error (context.ts's
existing double-fault contract, REQ-10), never swapped in as the primary error.

#### Scenario REQ-ATH-06.1: Factory throw propagates unmodified

- GIVEN a factory that buffers a `create` and then throws `new Error("boom")`
- WHEN run via `runFactoryForTest`
- THEN `result.tree` does not contain the buffered create's path
- AND `result.error` is the exact `Error("boom")` instance (message preserved, not an `AuthoringError`)

### REQ-ATH-07: Fresh Fake Per Call — No Cross-Call State

Each call to `runFactoryForTest` MUST construct its OWN fake/spy instance. State from one
call (committed tree, emitted batches) MUST NOT be visible to, or influenced by, another
call — including two calls issued concurrently (each awaited independently).

#### Scenario REQ-ATH-07.1: Two sequential calls do not share state

- GIVEN two separate `runFactoryForTest` calls, each with a factory that creates a DIFFERENT path and no seed
- WHEN both calls complete
- THEN the first call's `result.tree` contains only its own path
- AND the second call's `result.tree` contains only its own path, with no trace of the first

#### Scenario REQ-ATH-07.2: Concurrent calls stay isolated

- GIVEN two `runFactoryForTest` calls started without awaiting the first before starting the second, each seeded with the SAME path but DIFFERENT content
- WHEN both promises resolve
- THEN each call's `result.tree` reflects only its own seed/mutations — neither call observes the other's content for that path

### REQ-ATH-08: Outside-Run Verb Calls Are Not Laundered

An author verb (`create`, `modify`, `find`, etc.) invoked outside the active
`runFactoryForTest` run — before it starts, after it resolves, or via a reference the
factory hands to caller-side code that later invokes it from a context never entered
through `als.run` — MUST still throw the existing `outside-run` `AuthoringError`
(`currentContext()`'s existing behaviour). Because `AsyncLocalStorage` context propagates
across microtasks and timers SCHEDULED FROM WITHIN a run, a verb call fired later via
`setTimeout`/a promise continuation started inside `fn` does NOT escape — it stays inside
the run's context and does not exercise this REQ. The escape this REQ tests is genuine loss
of the run context: the factory hands a callback to TEST code, and the test itself invokes
the verb directly, from a call stack that was never inside `als.run`.

#### Scenario REQ-ATH-08.1: Verb invoked by test code via an escaped callback still throws outside-run

- GIVEN a factory that calls a `capture(verbFn)` hook the test supplies, handing the test a
  reference to a verb-invoking closure, and otherwise does nothing else
- WHEN `runFactoryForTest` resolves, and the TEST itself then calls the captured closure
  directly in its own test-body call stack (never scheduled via `setTimeout`/a promise
  continuation started inside the run)
- THEN it throws `AuthoringError` with `reason: "outside-run"`

### REQ-ATH-09: Emission-Validity Boundaries

The harness MUST surface the fake's existing emit-time validity rejections — a
non-JSON-safe value in a directive, and a batch exceeding `BATCH_CAP_BYTES` — as
`result.error`, never as an uncaught crash of the test process.

#### Scenario REQ-ATH-09.1: Non-JSON-safe value rejects

- GIVEN a factory that stages a `create` whose options include a function value
- WHEN run via `runFactoryForTest`
- THEN `result.error` is an `AuthoringError` with `reason: "unrepresentable-content"`
- AND `result.tree` is empty

#### Scenario REQ-ATH-09.2: Batch-cap boundary

- GIVEN a factory that stages a single `create` whose serialized batch exceeds `BATCH_CAP_BYTES`
- WHEN run via `runFactoryForTest`
- THEN `result.error` is an `AuthoringError` with `reason: "changes-too-large"`
- AND a batch one byte under the cap (separate fixture) commits without error

### REQ-ATH-10: Unrendered-Template Non-Promise

A `create` directive's `template` field MUST be stored in `result.tree` EXACTLY as the
factory wrote it — never interpolated, escaped, or otherwise transformed. Rendering is the
engine's (Go CLI's) concern; the harness makes no promise about render output, documented
here so authors do not mistake `result.tree` for rendered file contents.

#### Scenario REQ-ATH-10.1: Template placeholders survive unrendered

- GIVEN a factory that calls `create("f.ts", "export const {{name}} = 1;", { name: "x" })`
- WHEN run via `runFactoryForTest`
- THEN `result.tree["f.ts"]` is the literal string `"export const {{name}} = 1;"` — the `{{name}}` placeholder is NOT substituted

### REQ-ATH-11: In-Memory-Only Invariant — Harness Machinery

The invariant governs HARNESS MACHINERY — `runFactoryForTest` itself, the fake, the
spy-recording wrapper, and the seeding path — which MUST NEVER touch the filesystem,
network, environment variables, or `process.argv`. Seeding happens ONLY via the explicit
`seed` record passed by the caller; there is no disk-backed or env-backed fallback for
seeding. **This invariant does NOT extend to the factory-under-test's OWN opted-in
behaviour**: a factory defined via `defineFactory(fn, { packageDir })` (stage-4 ADR-0029)
legitimately performs two disk reads of its own package directory, pre-`als.run`, as
stage-4's own opted-in checks — a `readdirSync` scan of `packageDir` for reserved lifecycle
names, and a `readFileSync` of the adjacent `schema.json` for run-boundary validation.
Both reads are the FACTORY's declared behaviour, not harness machinery, and
`runFactoryForTest` MUST NOT block, swallow, or misreport either of them as a harness
violation. Instrumentation still wraps the run for its FULL duration, so any I/O beyond
those two attributable, opted-in reads is still caught. Enforcement instruments,
CONCRETELY: `node:fs` and `node:net` call sites; Bun-native I/O (`Bun.write`, `Bun.file`,
`Bun.spawn`, `Bun.$`, `Bun.connect`); and the global `fetch`, all as call-interception
spies for the duration of the run. `process.env`/`process.argv` are reads, not calls —
they MUST be observed via a Proxy trap on property access placed around the global objects
for the run's duration, not a call-interception spy.

#### Scenario REQ-ATH-11.1: No filesystem/network/env/argv access during a run (non-opted-in factory)

- GIVEN a factory exercising every verb (create, modify, delete, rename, move, copy) against
  a non-trivial seed, run with `node:fs`, `node:net`, `Bun.write`, `Bun.file`, `Bun.spawn`,
  `Bun.$`, `Bun.connect`, and global `fetch` call-intercepted, and `process.env`/
  `process.argv` wrapped in a Proxy recording every property GET
- WHEN run via `runFactoryForTest`
- THEN zero calls are recorded across every instrumented I/O surface
- AND zero property-get traps fire on `process.env`/`process.argv` for the run's duration

#### Scenario REQ-ATH-11.2: Opted-in factory's own package-directory reads are observed, not flagged; harness machinery stays I/O-free

- GIVEN a factory defined via `defineFactory(fn, { packageDir: import.meta.dir })` with an
  adjacent `schema.json`, run with the SAME instrumentation as REQ-ATH-11.1 (fs/net/Bun-I/O
  call-interception + env/argv Proxy traps)
- WHEN run via `runFactoryForTest`
- THEN the TWO `node:fs` reads of the factory's own package directory — a `readdirSync`
  reserved-name scan of `packageDir` and a `readFileSync` of `<packageDir>/schema.json` —
  are recorded but do NOT fail the run or trip the invariant check
- AND every OTHER instrumented I/O surface — network, `process.env`/`process.argv` property
  access, and any disk touch attributable to `runFactoryForTest`, the fake, the spy wrapper,
  or the seeding path themselves — records zero calls/traps

### REQ-ATH-12: No-Engine-Text Extended to `result.error`

The existing no-engine-text leak scan (REQ-AEC-05, FIT-11) MUST be extended to cover
`result.error`'s object graph — using the SAME structurally-derived dictionary
(`rejection-messages.ts` values), scoped to ENGINE-INTERNAL fragments only — so a
harness-side wording change can never silently leak fake-internal text to an author.
Author-provided content (seed values, options, tree paths/content the author itself
supplied) echoing back through `result.error` or `result.tree` is expected and is NOT a
leak — the scan targets engine-internal vocabulary, never author data. This is a SEPARATE,
independently falsifiable invariant from REQ-ATH-11 (in-memory-only) — the two must be
tested independently. The harness has no diagnostic/report surface beyond `result`
(REQ-ATH-01); this REQ's scope is `result.error` only.

#### Scenario REQ-ATH-12.1: Harness result carries no leaked fragment

- GIVEN every `result.error` variant produced by REQ-ATH-03/06/09's scenarios
- WHEN each is scanned with the same whole-object-graph scan FIT-11 uses (own enumerable + non-enumerable properties, bounded `.cause` traversal)
- THEN zero dictionary fragments are found in any of them

#### Scenario REQ-ATH-12.2: Author-provided content is not mistaken for a leak

- GIVEN a factory seeded with content containing a substring never present in the
  structurally-derived dictionary, and an unrelated ATH-03 rejection producing `result.error`
- WHEN the scan runs
- THEN the author-supplied seed/tree/option content is not flagged — only dictionary
  fragments are

### REQ-ATH-13: Opted-In Factory Support — Schema-Invalid Input Rejects via `result.error`

`runFactoryForTest` MUST run a `packageDir`-opted-in factory (`defineFactory(fn, {
packageDir })`, stage-4 ADR-0029) EXACTLY as it runs a non-opted-in factory — no signature
change (`packageDir` lives in the factory's DEFINITION, never in `runFactoryForTest`'s
call). When stage-4's run-boundary validation (pre-`als.run`, `defineFactory`'s own
chokepoint) rejects a schema-invalid resolved input, the rejection MUST surface as
`result.error`, all-or-nothing per stage-4's REQ-RBV-01 rejection site: `result.tree` stays
empty and `result.emitted` stays empty — no directive is ever buffered and the engine
client's `emit` is never invoked (rejection happens strictly BEFORE `fn` runs, never at the
emit seam). `result.error` is an `AuthoringError` instance (`src/core/schema/input-rejection.ts`'s
`rejectionFor`) carrying `origin: "authoring-rejected"` and an author-assertable `reason`
(e.g. `"invalid-input"`) and `message` — asserted via `instanceof AuthoringError`, `.reason`,
`.origin`, covered by REQ-ATH-01's existing `AuthoringError | unknown` typing without
modification. A schema-VALID resolved input MUST run the opted-in factory normally —
`result.error` is `undefined`, indistinguishable from a non-opted-in factory's happy path
(REQ-ATH-01/02).

#### Scenario REQ-ATH-13.1: Schema-invalid input rejects all-or-nothing via `result.error`

- GIVEN a factory defined via `defineFactory(fn, { packageDir: import.meta.dir })` with an
  adjacent `schema.json` requiring `{ port: number }`, run with a resolved input missing `port`
- WHEN run via `runFactoryForTest`
- THEN `result.tree` is empty and `result.emitted` is empty — no directive was ever buffered
  and the engine client's `emit` was never invoked
- AND `result.error` is an `AuthoringError` instance with `reason: "invalid-input"`,
  `origin: "authoring-rejected"`, and a descriptive `message`

#### Scenario REQ-ATH-13.2: Schema-valid input runs the opted-in factory normally

- GIVEN the same opted-in factory, called with a schema-valid resolved input `{ port: 8080 }`, whose body creates one file with fixed content
- WHEN run via `runFactoryForTest`
- THEN `result.tree` contains the created path/content and `result.error` is `undefined` —
  indistinguishable from REQ-ATH-01.1's non-opted-in happy path

### REQ-ATH-14: In-Memory-Only Invariant Carve-Out Widened — Package-Root Reads (harness allow-list)

REQ-ATH-11's carve-out (currently: a `readdirSync` reserved-name scan of `packageDir`
and a `readFileSync` of the adjacent `schema.json`, both pre-`als.run`) WIDENS to also
allow-list disk reads performed BY a `scaffold`/`copyIn`/`create({templateFile})` call
DURING a run, PROVIDED those reads stay within the collection/package root
(`package-root-containment` REQ-PRC-01/02). When such a factory is exercised via
`runFactoryForTest`, these reads MUST be recorded by the harness's I/O instrumentation
but MUST NOT fail the run or trip the in-memory-only invariant check — same treatment
as the existing two opted-in reads. Every OTHER instrumented I/O surface (network,
`process.env`/`process.argv` property access, any disk touch OUTSIDE the collection
root, or any read attributable to harness machinery itself) still records zero
calls/traps — the widened allow-list is scoped exclusively to reads within the
collection root, never a blanket exemption.

#### Scenario REQ-ATH-14.1: A factory's own scaffold/copyIn reads within the collection root are observed, not flagged [SDK]

- GIVEN a factory defined via `defineFactory(fn, { packageDir: import.meta.dir })`
  whose body calls `scaffold` over an adjacent `files/` folder, run with the SAME
  fs/net/Bun-I/O/env/argv instrumentation as REQ-ATH-11.1
- WHEN run via `runFactoryForTest`
- THEN the reads `scaffold` performs within the collection root are recorded but do
  NOT fail the run or trip the invariant check
- AND every OTHER instrumented I/O surface still records zero calls/traps

#### Scenario REQ-ATH-14.2: A read attributable to harness machinery outside the allow-list still trips the invariant [SDK]

- GIVEN a fixture where the SPY/instrumentation wrapper itself (not the
  factory-under-test) performs a disk read outside the collection root
- WHEN run via `runFactoryForTest`
- THEN the invariant check still fails — the widened allow-list covers ONLY
  factory-attributable, within-collection-root reads, never harness machinery

### REQ-ATH-15: By-Reference Directive Through the Harness — Emit-Only

A valid by-reference directive run through `runFactoryForTest` MUST be recorded in
`result.emitted`; by-reference bytes MUST NEVER appear in `result.tree` or on disk —
the emit-only evidence boundary (`by-reference-copy-wire` REQ-BRC-04); simulation ends
at directive acceptance/rejection. A by-reference directive whose package-local source
does not exist MUST surface `AuthoringError` reason `source-not-found` through the
harness run (`by-reference-copy-wire` REQ-BRC-06) — the SDK-side containment/stat
validation is the legitimate origin of that rejection; the fake is NOT required to
re-check package disk.

#### Scenario REQ-ATH-15.1: Valid by-reference directive lands in result.emitted, never in result.tree [SDK]

- GIVEN a factory that emits a valid by-reference copy (existing source, non-colliding
  destination) via `copyIn`
- WHEN run via `runFactoryForTest`
- THEN `result.emitted` contains the by-reference directive
- AND `result.tree` contains NO entry for the by-reference destination path — no
  by-reference content is ever materialized into the committed tree

#### Scenario REQ-ATH-15.2: Missing package-local source surfaces source-not-found through the harness run [SDK]

- GIVEN a factory that calls `copyIn` on an (in-ceiling) source path that does not
  exist in the package
- WHEN run via `runFactoryForTest`
- THEN `result.error` is an `AuthoringError` with `reason: "source-not-found"` —
  regardless of which layer (SDK-side validation being the legitimate origin)
  produced the rejection

### REQ-ATH-16: Conformance Vehicle Parity for the By-Reference Op

`src/conformance/run-vehicle.ts` MUST handle the by-reference directive with parity to
the fake (REQ-ATH-15): same existence/collision checks, same emit-only boundary — no
divergence between the two simulation surfaces for this new directive.

#### Scenario REQ-ATH-16.1: Conformance vehicle and fake agree on the same by-reference fixture set [SDK]

- GIVEN the SAME set of by-reference fixtures (valid, missing-source, collision) run
  through both the fake and the conformance vehicle
- WHEN compared
- THEN both surfaces produce the same accept/reject verdict per fixture
