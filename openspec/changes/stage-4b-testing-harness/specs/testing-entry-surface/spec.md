# Testing Entry Surface Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-4b-testing-harness`

## Purpose

Wires the `./testing` subpath into the package's public surface as the third audience
(`author-testing`, ADR-0009 amendment) — the ONLY path through which `defineFactory`
becomes reachable from an installed package. `./core` stays unmapped; the guards in this
domain make containment structural (per-path allowlist, dev-only bundle scan, port-guard
allow-list) rather than convention-based, and the e2e proves reachability from an installed
consumer's own vantage point.

## Requirements

### REQ-TES-01: `./testing` Export Entry

`package.json#exports` MUST gain a `"./testing"` entry with `types` and `import` fields
pointing at the built `./testing` output, following the same shape as `.`/`./commons`/
`./conformance`. FIT-09's exact-key assertion MUST widen from 3 to exactly 4 keys:
`.`, `./commons`, `./conformance`, `./testing` — `./core` continues to be asserted absent.

#### Scenario REQ-TES-01.1: Exports map gains exactly one new key

- GIVEN the built `package.json#exports`
- WHEN its keys are inspected
- THEN they are exactly `[".", "./commons", "./conformance", "./testing"]`, sorted
- AND `"./testing"` has `types` matching `dist/testing/index.d.ts` and `import` matching `dist/testing/index.js`

### REQ-TES-02: `defineFactory` Reachable via `./testing` Only

`defineFactory` MUST be import-resolvable as `import { defineFactory } from "@pbuilder/sdk/testing"` from a BUILT package, and MUST NOT be reachable from `.`, `./commons`, or `./conformance`. `./core` stays unmapped and unresolvable by subpath — production graduation is explicitly deferred to Stage 6, not attempted here.

#### Scenario REQ-TES-02.1: `defineFactory` resolves via `./testing`, nowhere else

- GIVEN a built package tree
- WHEN `defineFactory` is looked up on the `./testing`, `.`, `./commons`, and `./conformance` module exports
- THEN it is present ONLY on `./testing`'s exports
- AND `@pbuilder/sdk/core` remains unresolvable (no `exports` entry exists for it)

### REQ-TES-03: FIT-08 Per-Path Allowlist

FIT-08 (no-kit-bleed) MUST gain a per-path allowlist data model, replacing the single flat
`KIT_SYMBOL_NAMES` ban for every scanned path. `./testing`'s own scan MUST run with an
allowlist that is EXACTLY: VALUE exports `["defineFactory", "runFactoryForTest"]` plus
TYPE-ONLY exports `["Batch", "Directive"]` (owner ruling, 2026-07-10) — no other name, and
`ContractFake` is EXPLICITLY BANNED, as a value or as a type (SEC-M3; echoed at the
harness-result-shape level in REQ-ATH-01). Every OTHER kit symbol (`Session`,
`DirectiveFactory`, `EngineClient`, `currentContext`, `defineDialect`, `defineOpPack`,
`withOps`, `ReadOps`, `WriteOps`, `WritableHandleRef`, `RunContext`) stays BANNED on
`./testing` too. Every OTHER author subpath (`.`, `./commons`, `./conformance`) keeps the
existing full ban UNCHANGED — `./testing` is not exempted from the scan, only widened by
its own allowlist. The shallow fix of skipping `./testing` from the scan entirely MUST be
rejected by this REQ's own test.

#### Scenario REQ-TES-03.1: `./testing` permits only its allowlist

- GIVEN `src/testing/index.ts` exporting `defineFactory`, `runFactoryForTest`, and
  type-only `Batch`/`Directive`
- WHEN FIT-08 scans `./testing`
- THEN no violation is reported for any of the four

#### Scenario REQ-TES-03.2: `./testing` still bans every non-allowlisted kit symbol [red-proof]

- GIVEN a fixture `src/testing/index.ts` that additionally re-exports `Session` from `../core/session.ts`
- WHEN FIT-08 scans `./testing` under its per-path allowlist
- THEN a violation IS reported for `Session`

#### Scenario REQ-TES-03.3: `./testing`'s scanned path cannot be removed instead of allowlisted [rewritten V2 — tightened to a concrete observable]

- GIVEN the per-path allowlist data model's set of scanned paths (the FIT-08 equivalent of `AUTHOR_SUBPATHS`)
- WHEN the set is inspected for membership
- THEN `./testing`'s source path IS present in it — an implementation that removes
  `./testing` from the scanned-path set entirely, rather than adding an allowlist entry
  for it, fails this membership check directly (not merely "the suite fails" abstractly)

#### Scenario REQ-TES-03.4: `ContractFake` is banned regardless of export form [new V2, red-proof]

- GIVEN a fixture `src/testing/index.ts` that re-exports `ContractFake` alongside the
  sanctioned set, once as a value and once (separately) as a type-only export
- WHEN FIT-08 scans `./testing` under its per-path allowlist
- THEN a violation IS reported for `ContractFake` in BOTH forms

### REQ-TES-04: Dev-Only Bundle Containment Guard (FIT-17)

A NEW fitness function, FIT-17, MUST fail-closed assert that the `CONTRACT_FAKE_PREFIX`
literal is ABSENT from the minified production bundle of `.`, `./commons`, and
`./conformance`, AND — as a mandatory positive control — that the SAME literal IS PRESENT
in the `./testing` bundle. Both halves are required: a guard that only checks absence
could pass by accident (e.g. the fake never building at all); the presence check proves
the scan mechanism actually detects the literal when it should. The literal scanned MUST be
imported from `rejection-messages.ts`'s `CONTRACT_FAKE_PREFIX` export — the SAME module
FIT-11 derives its leak dictionary from — never hardcoded as a separate string in the FIT-17
test file itself (QA-m3), so the two guards cannot silently drift apart.

> **Design note (SEC-m1, non-binding on this spec)**: `sdd-design` should consider a
> SECOND structural marker (e.g. `ContractFake`'s characteristic method set) alongside the
> literal-string scan, so the guard does not depend on a single string surviving unchanged.

#### Scenario REQ-TES-04.1: Fake text absent from production bundles

- GIVEN minified `bun build` output for the `.`, `./commons`, and `./conformance` entries
- WHEN each is scanned for the `CONTRACT_FAKE_PREFIX` literal
- THEN it is absent from all three

#### Scenario REQ-TES-04.2: Positive control — fake text present in `./testing`

- GIVEN minified `bun build` output for the `./testing` entry
- WHEN scanned for the `CONTRACT_FAKE_PREFIX` literal
- THEN it IS present

#### Scenario REQ-TES-04.3: A conditional-exports mechanism is rejected [rewritten V2 — tightened to a concrete observable]

- GIVEN a fixture minified-bundle STRING (simulating a production entry's actual build
  output) that still contains the `CONTRACT_FAKE_PREFIX` literal, paired with a
  `package.json#exports` config that uses a conditional (fail-open) branch to route
  resolution away from it in the common case
- WHEN FIT-17's scan function is invoked directly against the fixture bundle string
- THEN it reports a violation — proving the guard scans actual bundle OUTPUT content, not
  the `exports` map's declared routing, so a conditional-exports approach that still
  bundles the fake into a production entry is caught

#### Scenario REQ-TES-04.4: The scanned literal is sourced structurally, not hardcoded [new V2, red-proof]

- GIVEN FIT-17's implementation
- WHEN inspected for the string literal it scans for
- THEN it is imported from `rejection-messages.ts`'s `CONTRACT_FAKE_PREFIX` export — a
  hardcoded duplicate string that could drift from that constant fails this check

### REQ-TES-05: FIT-04 dts Baseline Coverage

FIT-04's public `.d.ts` semver gate MUST be extended to cover the `./testing` surface,
INCLUDING its type-only `Batch`/`Directive` re-exports (owner ruling, 2026-07-10 — these
participate in the same breaking-removal diff as any other public export). Exact baseline
granularity (entry-only `dist/testing/index.d.ts` vs. the whole `src/testing/**` tree) is a
DESIGN decision (Stability clause, top-level spec) — this REQ requires that SOME baseline
pair for `./testing` exists and participates in the same breaking-removal diff every other
`DTS_PAIRS` entry does.

#### Scenario REQ-TES-05.1: `./testing`'s dts is diffed like every other public entry

- GIVEN a built `dist/testing/index.d.ts` and its committed baseline counterpart
- WHEN FIT-04 runs
- THEN a removed export from the `./testing` baseline is detected as a breaking removal, exactly as it would be for `./commons` or the umbrella entry

#### Scenario REQ-TES-05.2: `Batch`/`Directive` participate in the baseline [new V2]

- GIVEN the `./testing` dts baseline
- WHEN it is inspected
- THEN it includes the `Batch` and `Directive` type-only re-exports — removing either from
  a future `./testing` build is detected as a breaking removal exactly like removing
  `defineFactory` or `runFactoryForTest`

### REQ-TES-06: Installed-Consumer-Vantage e2e

A NEW e2e test MUST prove reachability from an installed consumer's own vantage: build the
package, `bun pm pack` it, install the tarball into a scratch directory, and
`import(...)` it BY PACKAGE NAME (never a relative `dist` path). It MUST assert `./commons`
resolves, `./testing` resolves, `@pbuilder/sdk/core` stays UNRESOLVABLE, AND cover the two
FOUNDING scenarios at this installed vantage (BA-M1): (a) a write-only factory committing to
a golden tree, and (b) an all-or-nothing rejection surfacing an author-assertable error
against an empty tree. This REQ SUBSUMES pending row W1's pack→install→resolution mechanic —
W1 is superseded by this REQ, not duplicated.

#### Scenario REQ-TES-06.1: Installed consumer resolves `./commons` and `./testing`, not `./core`

- GIVEN a freshly packed and scratch-installed tarball of the built package
- WHEN the scratch consumer imports `@pbuilder/sdk/commons` and `@pbuilder/sdk/testing` by package name
- THEN both imports resolve successfully
- AND importing `@pbuilder/sdk/core` by package name fails to resolve

#### Scenario REQ-TES-06.2: A write-only factory commits end-to-end through the published entry [rewritten V2 — explicit founding-bug framing]

- GIVEN the scratch-installed consumer from REQ-TES-06.1, running a factory whose body is a
  single `create(...)` call and nothing else (the founding write-only-factory case,
  REQ-ATH-02) via the installed `runFactoryForTest`/`defineFactory`
- WHEN the run resolves
- THEN `result.tree` matches a golden committed tree containing exactly the created
  path/content

#### Scenario REQ-TES-06.3: An all-or-nothing rejection surfaces an author-assertable error through the published entry [new V2]

- GIVEN the scratch-installed consumer from REQ-TES-06.1, running a factory that seeds a
  colliding path and calls `create` without force (REQ-ATH-03's shape) via the installed
  `runFactoryForTest`/`defineFactory`
- WHEN the run resolves
- THEN `result.tree` is empty
- AND `result.error` is assertable by the consumer as an `AuthoringError` instance with the
  expected `verb`/`path`/`reason`, using the installed package's own exported error type

### REQ-TES-07: FIT-10 Port-Guard Allow-List Transition [new V2, SEC-B1]

FIT-10's `EngineClient`/`EmitRejection` port-guard allow-list MUST transition, post
`ContractFake` relocation, from `test/support/contract-fake.ts` to EXACTLY
`src/testing/contract-fake.ts` — a single path, never a blanket module- or
directory-level exemption (e.g. all of `src/testing/**` or all of `src/**`). Explicitly
RULED: `src/testing/index.ts` (the facade) MUST NOT name `EngineClient` or `EmitRejection`
at all — it is NOT on the allow-list — and MUST achieve its spy-wrapping without importing
those port-internal identifiers (e.g. a locally-declared minimal structural type covering
only the methods it calls, or delegating to the fake instance without re-typing it). A
port-symbol bleed introduced in any OTHER file under `src/testing/**`, or anywhere else
under `src/**`, MUST still be caught.

#### Scenario REQ-TES-07.1: The allow-list is exactly one path

- GIVEN FIT-10's allow-list after `ContractFake`'s relocation
- WHEN inspected
- THEN it is exactly `["src/testing/contract-fake.ts"]` — no other path is present

#### Scenario REQ-TES-07.2: `src/testing/index.ts` naming `EngineClient` is caught [red-proof]

- GIVEN a fixture where `src/testing/index.ts` is rewritten to `import type { EngineClient } from "../core/engine-client.ts"`
- WHEN FIT-10 scans `src/testing/index.ts` under the single-path allow-list
- THEN a violation IS reported — `index.ts` is not the allow-listed path

#### Scenario REQ-TES-07.3: A bleed in an unrelated `src/**` file is still caught post-transition [red-proof]

- GIVEN a planted-bypass fixture under a path OTHER than `src/testing/contract-fake.ts`
  (e.g. `src/testing/helpers.ts` or `src/dry-run/plan.ts`) that imports `EngineClient` and
  calls `.emit(...)`
- WHEN FIT-10 scans under the transitioned allow-list
- THEN a violation IS reported — proving the transition to the new path did not widen into
  a directory-level or module-level exemption
