# Delta for Author Test Harness

**Spec version**: V2
**Status**: signed (V2, owner, 2026-07-14)
**Change**: `bare-factory-migration`

**V1 → V2** (plan-verify gate iteration 1, gap #2): ADDED REQ-ATH-20 — pins the
author-emulation corpus migration's end state (bare fixtures + byte-identical regen).

## REMOVED Requirements

### REQ-ATH-13: Opted-In Factory Support — Schema-Invalid Input Rejects via `result.error`

(Reason: this REQ's text asserted "`packageDir` lives in the factory's DEFINITION, never
in `runFactoryForTest`'s call" — the migration structurally INVERTS this. Per REQ-ID
stability, a stable ID's meaning is never flipped in place; the new contract is REQ-ATH-17.
The observable guarantee this REQ protected — schema-invalid input rejects all-or-nothing
via `result.error` — is preserved, relocated to REQ-ATH-17.)

## MODIFIED Requirements

### REQ-ATH-01: `runFactoryForTest` Result Shape

The system MUST expose `runFactoryForTest` (from `./testing`) accepting: the BARE author
function `(input: Input) => void | Promise<void>` (never a `defineFactory`-wrapped
runner), the resolved input, and an optional options bag `{ seed?: Record<string,string>,
packageDir?: string }` (Previously: accepted "the function `defineFactory` produces" and a
positional `seed` third argument). `runFactoryForTest` wraps the bare function internally
by DELEGATING to the SAME `defineFactory` seam the future runner will call — never a
parallel reimplementation of the wrap logic (single-wrap-seam invariant). It returns a
`Promise` resolving to an object exposing EXACTLY three own keys: `tree`, `emitted`, and
`error` — unchanged from before. No kit machinery is exposed by name from `./testing`. The
ONLY sanctioned kit-adjacent types re-exported are `Batch` and `Directive`, type-only.

#### Scenario REQ-ATH-01.1: Happy-path shape

- GIVEN a bare factory function that creates one file with fixed content
- WHEN run via `runFactoryForTest`
- THEN `result.tree` contains the created path mapped to its content
- AND `result.emitted` is a single `Batch` whose `instructions[0]` is the create directive
- AND `result.error` is `undefined`

#### Scenario REQ-ATH-01.2: Result exposes no field beyond the three

- GIVEN any `runFactoryForTest` result
- WHEN its own enumerable keys are inspected
- THEN they are EXACTLY `{tree, emitted, error}`

#### Scenario REQ-ATH-01.3: `ContractFake` is not exported by name [red-proof]

- GIVEN a fixture re-exporting `ContractFake` from `./testing`, as a value or a type
- WHEN FIT-08 scans `./testing` under REQ-TES-03's per-path allowlist
- THEN a violation IS reported

#### Scenario REQ-ATH-01.4: `seed` survives the options-bag migration [new]

- GIVEN `runFactoryForTest(bareFn, input, { seed: { "a.ts": "x" } })` where the bare
  factory seeds a collision by calling `create("a.ts", ...)` without force
- WHEN run
- THEN `result.tree` is empty and `result.error` is an `AuthoringError` with
  `reason: "path-collision"` — proving `seed` is still read correctly once it moves from a
  positional third argument to a named field of the options bag

#### Scenario REQ-ATH-01.5: The old wrapped-runner shape is rejected at compile time [new, red-proof]

- GIVEN a value of the OLD arity-2 wrapped-runner type (`(o, deps: {client}) => Promise<void>`, what `defineFactory` used to hand back for direct harness use) passed as `runFactoryForTest`'s first argument
- WHEN the call is type-checked (`@ts-expect-error` fixture in `test/types/`)
- THEN it FAILS to compile — a widened `any`/dual-shape signature that accepts both old and
  new shapes fails this check even though REQ-ATH-01.1's positive scenario still passes

### REQ-ATH-06: Factory Throw — Discard, Cause Preserved

When the factory function itself throws OR its returned promise REJECTS (before or after
buffering directives) (Previously: covered synchronous throw only), the staged set MUST be
discarded and `result.error` MUST be the ORIGINAL thrown/rejected value — never replaced by
a discard-time failure. If discard itself also fails, its failure is attached as `.cause`
on the original error, never swapped in as the primary error.

#### Scenario REQ-ATH-06.1: Factory throw propagates unmodified

- GIVEN a factory that buffers a `create` and then throws `new Error("boom")`
- WHEN run via `runFactoryForTest`
- THEN `result.tree` does not contain the buffered create's path
- AND `result.error` is the exact `Error("boom")` instance

#### Scenario REQ-ATH-06.2: Async rejection discards identically to a sync throw [new]

- GIVEN a factory that buffers a `create` and then returns a promise that REJECTS with
  `new Error("boom-async")`
- WHEN run via `runFactoryForTest`
- THEN `result.tree` does not contain the buffered create's path (same all-or-nothing
  discard as the sync-throw case)
- AND `result.error` is the exact rejected value

### REQ-ATH-11: In-Memory-Only Invariant — Harness Machinery

The invariant governs HARNESS MACHINERY — which MUST NEVER touch the filesystem, network,
environment variables, or `process.argv`. Seeding happens ONLY via the explicit `seed`
field of `runFactoryForTest`'s options bag; there is no disk-backed or env-backed fallback.
**This invariant does NOT extend to the factory-under-test's OWN opted-in behaviour**: a
factory run via `runFactoryForTest(fn, input, { packageDir })` (Previously: "a factory
defined via `defineFactory(fn, { packageDir })`") legitimately performs two disk reads of
its own package directory, pre-`als.run` — a `readdirSync` reserved-name scan and a
`readFileSync` of the adjacent `schema.json`. Both reads are attributable to the
`packageDir` option, not harness machinery, and `runFactoryForTest` MUST NOT block,
swallow, or misreport either as a harness violation.

#### Scenario REQ-ATH-11.1: No filesystem/network/env/argv access during a run (no `packageDir`)

- GIVEN a factory exercising every verb against a non-trivial seed, run with fs/net/Bun-I/O
  call-interception and env/argv Proxy traps, and NO `packageDir` option
- WHEN run via `runFactoryForTest`
- THEN zero calls are recorded across every instrumented I/O surface

#### Scenario REQ-ATH-11.2: `packageDir`-opted-in reads are observed, not flagged; harness stays I/O-free

- GIVEN `runFactoryForTest(fn, input, { packageDir: import.meta.dir })` with an adjacent
  `schema.json`, run with the SAME instrumentation as REQ-ATH-11.1
- WHEN run
- THEN the TWO `node:fs` reads of the package directory are recorded but do NOT fail the
  run or trip the invariant check
- AND every OTHER instrumented I/O surface records zero calls/traps

### REQ-ATH-14: In-Memory-Only Invariant Carve-Out Widened — Package-Root Reads

REQ-ATH-11's carve-out WIDENS to also allow-list disk reads performed BY a
`scaffold`/`copyIn`/`create({templateFile})` call DURING a run, provided those reads stay
within the collection/package root. When such a factory is run via `runFactoryForTest(fn,
input, { packageDir })` (Previously: "a factory defined via `defineFactory(fn, {
packageDir })`"), these reads MUST be recorded but MUST NOT fail the run or trip the
invariant check.

#### Scenario REQ-ATH-14.1: A factory's own scaffold/copyIn reads within the collection root are observed, not flagged

- GIVEN `runFactoryForTest(fn, input, { packageDir: import.meta.dir })` whose factory body
  calls `scaffold` over an adjacent `files/` folder, run with the SAME instrumentation as
  REQ-ATH-11.1
- WHEN run
- THEN the reads `scaffold` performs within the collection root are recorded but do NOT
  fail the run or trip the invariant
- AND every OTHER instrumented I/O surface still records zero calls/traps

#### Scenario REQ-ATH-14.2: A read attributable to harness machinery outside the allow-list still trips the invariant [red-proof]

- GIVEN a fixture where the harness's own instrumentation wrapper performs a disk read
  outside the collection root
- WHEN run via `runFactoryForTest`
- THEN the invariant check still fails

## ADDED Requirements

### REQ-ATH-17: `packageDir` as a `runFactoryForTest` Option — Validation and Untyped Byte-Parity

`runFactoryForTest`'s options bag MAY carry `packageDir`. When present WITH an adjacent
`schema.json`, run-boundary validation runs exactly as it did when `packageDir` lived on
`defineFactory`'s own call: a schema-invalid resolved input rejects all-or-nothing via
`result.error` (`AuthoringError`, `reason: "invalid-input"`), `result.tree`/`emitted` stay
empty, and the factory body never runs. When `packageDir` is ABSENT, the run MUST be
untyped and byte-identical to today: NO validation runs, even against a schema-shaped
INVALID input — this is the REQ-TFO-02 opt-out relocated to `runFactoryForTest`'s caller.
When `packageDir` is present but no `schema.json` exists, the loudly-schemaless warning
(REQ-RBV-03) still fires, unchanged.

#### Scenario REQ-ATH-17.1: Schema-invalid input rejects all-or-nothing when `packageDir` is present

- GIVEN `runFactoryForTest(fn, input, { packageDir: import.meta.dir })` with an adjacent
  `schema.json` requiring `{ port: number }`, called with input missing `port`
- WHEN run
- THEN `result.tree` and `result.emitted` are empty, and `result.error` is an
  `AuthoringError` with `reason: "invalid-input"`

#### Scenario REQ-ATH-17.2: Schema-shaped-invalid input RUNS unchanged when `packageDir` is absent [new, mutation-resistant]

- GIVEN the SAME schema-invalid input as REQ-ATH-17.1, but `runFactoryForTest(fn, input)`
  called with NO `packageDir` option
- WHEN run
- THEN the factory body executes normally (no validation-triggered rejection) — a mutant
  that always validates regardless of `packageDir` presence fails this scenario

#### Scenario REQ-ATH-17.3: Positive fs-read oracle proves `packageDir` was actually forwarded [new, mutation-resistant]

- GIVEN `runFactoryForTest(fn, input, { packageDir: import.meta.dir })` with an adjacent
  `schema.json`, instrumented per REQ-ATH-11.2
- WHEN run
- THEN `existsSync`, `readFileSync`, and `readdirSync` are ALL observed to fire against the
  package directory — a mutant that silently drops the forwarded `packageDir` (passing
  `undefined` through) fails this scenario even though REQ-ATH-17.1's negative-only check
  would not catch it

### REQ-ATH-18: Non-Function Export and Zero-Argument Factory — Current-Contract Pins

Per the hard-cut ruling (no runtime double-wrap/brand guard — 0.x, zero external
consumers), a non-function value passed as `runFactoryForTest`'s first argument MUST
surface as the PLAIN `TypeError` thrown by invoking it as a function (`fn(input)`) — no
custom, educational error is manufactured. A factory function that ignores its `input`
parameter (arity zero) MUST run normally, identically to any other factory.

#### Scenario REQ-ATH-18.1: A non-function export surfaces a plain TypeError [pins current/no-guard contract]

- GIVEN `runFactoryForTest(notAFunction, input)` where `notAFunction` is, e.g., a plain object
- WHEN run
- THEN the call rejects/throws a plain `TypeError` from the internal `fn(input)`
  invocation — no `AuthoringError` and no custom "not a factory function" message

#### Scenario REQ-ATH-18.2: A zero-argument factory runs normally

- GIVEN a factory function declared with no parameters, whose body ignores `input` and
  creates one file
- WHEN run via `runFactoryForTest`
- THEN `result.tree` contains the created path and `result.error` is `undefined`

### REQ-ATH-19: Wrap-Parity — `runFactoryForTest` vs Direct `defineFactory` Invocation

For the SAME bare factory function and input, running it via `runFactoryForTest` MUST
yield a `{tree, emitted, error}` triple IDENTICAL to manually wrapping the same function
via `defineFactory(fn, {packageDir})` and driving it against a manually-constructed
client — proving `runFactoryForTest` delegates to the real wrap seam rather than
reimplementing it (single-wrap-seam invariant, REQ-ATH-01). Parity MUST hold on the
double-fault path (factory throws `E1`; the harness's own discard subsequently throws
`E2`) — both paths MUST yield `result.error === E1` with `error.cause === E2` — and on
dialect `drain()` ordering, where applicable.

#### Scenario REQ-ATH-19.1: Happy-path parity

- GIVEN a bare factory and input run BOTH via `runFactoryForTest` and via a manual
  `defineFactory` + client wrap
- WHEN both complete
- THEN their `{tree, emitted, error}` triples are identical

#### Scenario REQ-ATH-19.2: Double-fault parity — original error wins, secondary attached as `.cause`

- GIVEN a factory that throws `E1`, fed through a fixture where the subsequent discard
  itself throws `E2`, run BOTH ways
- WHEN both complete
- THEN both paths yield `result.error === E1` with `result.error.cause === E2`

### REQ-ATH-20: Author-Emulation Corpus Migrates to Bare Shape — End-State Pin

Every export in `test/fixtures/author-emulation/factory.ts` (28 `export const run*`
bindings — the whole file, not only the 21 scenario-registered) and
`test/fixtures/typed-factory/factory.ts` (1 export) MUST be the bare
`(input) => void | Promise<void>` shape — zero occurrences of the bare identifier
`defineFactory` (word-boundary match, imports included) anywhere in either file. The committed corpus (`test/e2e/author-emulation/corpus/*.json`,
22 records including the skeleton) MUST be regenerated FROM these bare fixtures via
`scripts/regen-corpus.ts` and be byte-identical to the already-committed content — i.e.
running the regen script against the migrated (bare) source produces a git-clean working
tree. This REQ pins the MIGRATION's end state (bare fixtures ⇒ unchanged corpus bytes,
a freshness property); it does NOT duplicate or supersede `golden-corpus-contract`
REQ-GCC-04 (FIT-28's own-process double-run byte-determinism) or REQ-GCC-05 (the
out-of-band-only update path), which continue to own the corpus format's PERMANENT
determinism guarantee independent of this migration.

#### Scenario REQ-ATH-20.1: Author-emulation and typed-factory fixtures are fully bare

- GIVEN `test/fixtures/author-emulation/factory.ts` (28 `export const run*` bindings —
  21 scenario-registered plus 7 additional; the whole file is in scope) and
  `test/fixtures/typed-factory/factory.ts` (1 export)
- WHEN each file is scanned for the bare identifier `defineFactory` (word-boundary
  match — NEVER the substring `defineFactory(`, which the generic call form
  `defineFactory<Input>(` defeats and which matches zero even pre-migration; the exact
  trap FIT-16's 3rd-signal comment warns about)
- THEN zero occurrences of the identifier are found across both files (imports
  included) — every export bare, zero wrapped
  <!-- Oracle amended by orchestrator 2026-07-14 post-V2-signature: original token
  `defineFactory(` was vacuously zero pre-migration (slice-revision finding §16b).
  Semantic intent unchanged: fixtures are fully bare. Owner informed. -->

#### Scenario REQ-ATH-20.2: Corpus regen against bare fixtures is a git-clean no-op

- GIVEN the migrated (bare) fixtures and `scripts/regen-corpus.ts` threading
  `{packageDir}` per scenario
- WHEN the script runs and its output replaces the pre-run committed
  `test/e2e/author-emulation/corpus/*.json` (22 records)
- THEN `git status` on the corpus directory reports no changes — the regenerated bytes
  are byte-identical to what was already committed

#### Scenario REQ-ATH-20.3: A stray wrapped export fails the bare-shape scan [red-proof]

- GIVEN a fixture where one of the 21 `test/fixtures/author-emulation/factory.ts`
  exports is reverted to a `defineFactory(fn, {...})`-wrapped form
- WHEN the token scan of REQ-ATH-20.1 runs
- THEN a violation IS reported for that export — proving the scan is not vacuously green

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) | REQ-ATH-01, REQ-ATH-13 (removed), REQ-ATH-17, REQ-ATH-18, REQ-ATH-19 | Yes — `state.yaml`'s `sensitive_override` |
