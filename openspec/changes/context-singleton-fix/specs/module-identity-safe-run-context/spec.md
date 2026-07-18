# Module-Identity-Safe Run-Context Specification

**Spec version**: V1
**Status**: signed (V1 signed by owner 2026-07-19)
**Change**: `context-singleton-fix`

## Purpose

Fixes the M1-blocking bug: `dist/bin/pbuilder-runner.js` and a `.ts`-source factory
(corpus src-relative import convention) resolve TWO module copies of
`src/core/context.ts` in one Bun process, each owning its own `AsyncLocalStorage`.
`defineFactory` enters one; verbs consult the other, never-entered store, and throw
"outside-run" even mid-run. This capability makes the run-context store
module-identity-safe across every realm resolving `context.ts`, leaving genuine
outside-run rejection, the single-instance topology, and everything outside
`context.ts` untouched.

## Requirements

### REQ-MIS-01: Cross-Realm Run-Context Sharing

The system MUST share exactly ONE `AsyncLocalStorage`-backed store, per process, across
every module realm (dist-compiled and src-transpiled) resolving `context.ts`, reached via
one well-known `globalThis[Symbol.for(...)]` lookup, lazily initialised on first access —
a run entered in ONE copy MUST be visible via `currentContext()` in ANY OTHER copy. The
lookup MUST NOT add an enumerable string-keyed property to `globalThis`.

#### Scenario REQ-MIS-01.1: Run entered in one realm, read from another

- GIVEN two distinct module realms resolving `context.ts` in one process (e.g. `dist/*.js`
  and `src/*.ts`, Bun-transpiled)
- WHEN `defineFactory` calls `als.run(ctx, fn)` in realm A
- THEN `currentContext()` in realm B, during that run, returns the SAME `ctx` — no
  `outside-run` throw

#### Scenario REQ-MIS-01.2: No enumerable global pollution

- GIVEN a fresh process before `context.ts` is imported
- WHEN the registry lookup runs for the first time
- THEN `Object.keys(globalThis)` is unchanged; only a symbol-keyed entry may exist

### REQ-MIS-02: Registry Key Stability

The `Symbol.for` key MUST be a single literal constant, defined once, used by every
resolution path. Once shipped it is a frozen contract — a silent edit breaks cross-realm
dedupe for consumers holding two loaded copies at different SDK versions.

#### Scenario REQ-MIS-02.1: Key literal is pinned

- GIVEN the shipped registry key constant
- WHEN a golden test reads its value
- THEN it matches the literal recorded at sign-off; any edit fails the test until
  deliberately updated

### REQ-MIS-03: Single-Instance Topology Non-Regression

For the existing single-realm topology (source runner + source factory — what every
current consumer/test exercises), the fix MUST NOT change observable behaviour: same
request sequence, exit code, committed output. Per-run isolation (sequential/concurrent
runs never leak into each other) MUST continue to hold.

#### Scenario REQ-MIS-03.1: Existing source-runner e2e unchanged

- GIVEN the existing walking-skeleton e2e (`test/fake/fake-engine-harness.e2e.test.ts`,
  single realm)
- WHEN it runs against the fixed `context.ts`
- THEN it passes with the SAME assertions: exit 0, `[tree.read, ir.emit, ir.commit]`,
  byte-identical committed output

#### Scenario REQ-MIS-03.2: Sequential runs stay isolated

- GIVEN two sequential runs in one process, each entering its own `RunContext`
- WHEN the second run's `currentContext()` is read during the second run
- THEN it returns the SECOND run's context, never a stale reference to the first

### REQ-MIS-04: Genuine Outside-Run Rejection Still Throws

Calling any authoring verb with NO enclosing `defineFactory` run anywhere in the process
MUST still throw `AuthoringError{origin: "authoring-rejected", reason: "outside-run"}`
with the existing message. The fix dedupes the store; it MUST NOT mask real outside-run
misuse.

#### Scenario REQ-MIS-04.1: Verb called with no run in progress

- GIVEN no `defineFactory` run has ever been entered
- WHEN an authoring verb (e.g. `find(...)`) is called
- THEN it throws `AuthoringError` with `reason === "outside-run"`,
  `origin === "authoring-rejected"`, message `"@pbuilder/sdk: authoring verbs can only be
  used while a schematic is running — call them inside your factory function, not at
  module load time."`

### REQ-MIS-05: Dist-Runner Two-Instance E2E Regression Proof

A new e2e MUST spawn the BUILT `dist/bin/pbuilder-runner.js` against a `.ts`-source
factory importing verbs via a src-relative path (corpus convention — the real
dist-runner/src-factory dual-realm topology). A same-copy topology MUST NOT substitute —
it cannot exercise the bug; a test built on it is false-green, non-compliant.

#### Scenario REQ-MIS-05.1: Two-instance happy path exits clean

- GIVEN the fixed dist runner spawned against the `happy` fixture factory (src-relative
  import, per corpus convention)
- WHEN the run executes
- THEN it exits 0 with `[tree.read, ir.emit, ir.commit]` and committed output matching the
  fixture's expected content

#### Scenario REQ-MIS-05.2: Pre-fix proof (one-time dev/PR-review evidence, not a standing CI assertion)

- GIVEN this SAME e2e run against `context.ts` reverted to the pre-fix plain module-scope
  `als`
- WHEN it executes
- THEN it fails — non-zero exit, `outside-run` symptom — confirming the test guards the
  real bug (strict-TDD red phase)

### REQ-MIS-06: Fail-Loud Fresh-Dist Guard

The new e2e MUST fail loudly — an actionable failure naming the missing artifact — when
`dist/bin/pbuilder-runner.js` or `dist/core/context.js` is absent at test-run time. It MUST
NOT silently skip or false-pass. The staleness-detection mechanism itself is a design
decision; this REQ pins observable failure behaviour only.

#### Scenario REQ-MIS-06.1: Missing dist artifact fails loud

- GIVEN `dist/` absent or `dist/bin/pbuilder-runner.js` missing
- WHEN the new e2e suite runs
- THEN it fails naming the missing artifact — never a silent skip or false pass

### REQ-MIS-07: Documented Non-Goals

This change MUST NOT be represented as closing: (a) residual Hazard #2 — a
SRC-constructed `AuthoringError` (via `requirePackageAnchors`, reached by
`create({templateFile})`/`scaffold`/`copyIn`) still crosses the dist/src `instanceof`
boundary misclassified, since that class-identity split lives in a DIFFERENT module
(`authoring-error.ts`) — tracked FU-4, not M1-reachable; (b) `single-instance-probe.ts`'s
same-package-root false-negative — FU-5; (c) the four sibling singletons swept in
exploration (`hadBom`, `astHandlePaths`, `runInFlight`, `realFd1Write`) — verified
benign-split, no fix required here.

#### Scenario REQ-MIS-07.1: Non-goals section present and traceable

- GIVEN the change's design/PR artefacts
- WHEN reviewed at `sdd-verify --mode=final` or archive
- THEN a "Non-Goals" section names Hazard #2 (→ FU-4), the probe false-negative (→ FU-5),
  and the sibling-singleton verdict — absence is a verify finding

## Non-Requirements

Corpus fixture changes, the `.ts`-source import convention, engine-side changes, and
compiling fixtures into the build graph stay out of scope — no REQ depends on them.
`context.ts` staying off `package.json#exports` (`@internal`, ADR-0034) MUST NOT be
violated — no REQ introduces new export surface.
