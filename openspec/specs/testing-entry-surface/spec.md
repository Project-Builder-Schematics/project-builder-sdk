# Delta for Testing Entry Surface

**Spec version**: V2
**Status**: signed (V2, owner, 2026-07-14)
**Change**: `bare-factory-migration`

**V1 → V2**: no change in this domain — carried forward unmodified as part of the same
unfreeze/re-sign cycle (plan-verify gate iteration 1, gaps #2/#3 land in
`author-test-harness` and `testing-story-docs`).

## Glossary Note

Pre-existing tests use "bare `defineFactory(fn)` run" to mean *no `packageDir`* (untyped
opt-out, REQ-TFO-02). This change's "bare factory" / "bare fn" means *no `defineFactory`
call at the author export site at all* — the export IS the plain
`(input) => void | Promise<void>` function. Scenarios below use "bare fn" only in the
second sense; where the first sense is meant, this delta says "no-`packageDir`" explicitly.

## REMOVED Requirements

### REQ-TES-02: `defineFactory` Reachable via `./testing` Only

(Reason: hard cut — owner direction obs #2070, 2026-07-14. `defineFactory` graduates to
runner/harness-internal vocabulary; zero external authors exist, no dual-shape shim. The
negative half of this guarantee — `defineFactory` must NOT resolve from `./testing` — is
restated, not lost, as REQ-TES-08.)

## MODIFIED Requirements

### REQ-TES-03: FIT-08 Per-Path Allowlist

FIT-08 (no-kit-bleed) MUST gain a per-path allowlist data model, replacing the single flat
`KIT_SYMBOL_NAMES` ban for every scanned path. `./testing`'s own scan MUST run with an
allowlist that is EXACTLY: VALUE exports `["runFactoryForTest"]` plus TYPE-ONLY exports
`["Batch", "Directive"]` — no other name; `defineFactory` is NO LONGER on this allowlist
(Previously: VALUE exports included `"defineFactory"`). `ContractFake` is EXPLICITLY
BANNED, as a value or as a type. Every OTHER kit symbol stays BANNED on `./testing` too.
Every OTHER author subpath (`.`, `./commons`, `./conformance`) keeps the existing full ban
UNCHANGED. The shallow fix of skipping `./testing` from the scan entirely MUST be rejected
by this REQ's own test.

#### Scenario REQ-TES-03.1: `./testing` permits only its allowlist

- GIVEN `src/testing/index.ts` exporting `runFactoryForTest` and type-only `Batch`/`Directive` — and NOT re-exporting `defineFactory`
- WHEN FIT-08 scans `./testing`
- THEN no violation is reported for any of the three

#### Scenario REQ-TES-03.1b: `defineFactory` re-exported from `./testing` is now a violation [red-proof]

- GIVEN a fixture `src/testing/index.ts` that additionally re-exports `defineFactory`
- WHEN FIT-08 scans `./testing` under the narrowed allowlist
- THEN a violation IS reported for `defineFactory`

#### Scenario REQ-TES-03.2: `./testing` still bans every non-allowlisted kit symbol [red-proof]

- GIVEN a fixture re-exporting `Session` from `../core/session.ts`
- WHEN FIT-08 scans `./testing` under its per-path allowlist
- THEN a violation IS reported for `Session`

#### Scenario REQ-TES-03.3: `./testing`'s scanned path cannot be removed instead of allowlisted

- GIVEN the per-path allowlist's set of scanned paths
- WHEN inspected for membership
- THEN `./testing`'s source path IS present

#### Scenario REQ-TES-03.4: `ContractFake` is banned regardless of export form [red-proof]

- GIVEN a fixture re-exporting `ContractFake` once as a value and once as a type-only export
- WHEN FIT-08 scans `./testing`
- THEN a violation IS reported for `ContractFake` in BOTH forms

### REQ-TES-05: FIT-04 dts Baseline Coverage

FIT-04's public `.d.ts` semver gate MUST cover the `./testing` surface, including its
type-only `Batch`/`Directive` re-exports. A `./testing` baseline regen that REMOVES an
export MUST be paired, in the SAME slice, with a POSITIVE assertion proving the baseline
reflects `runFactoryForTest`'s NEW signature (bare-fn parameter + optional `{seed,
packageDir}` options bag) — a removal-only diff (Previously: removal-only) is rejected as
laundering a signature change through a passing gate.

#### Scenario REQ-TES-05.1: `./testing`'s dts is diffed like every other public entry

- GIVEN a built `dist/testing/index.d.ts` and its committed baseline
- WHEN FIT-04 runs
- THEN a removed export is detected as a breaking removal, exactly as for `./commons`

#### Scenario REQ-TES-05.2: `Batch`/`Directive` participate in the baseline

- GIVEN the `./testing` dts baseline
- WHEN inspected
- THEN it includes `Batch` and `Directive` — removing either is detected as breaking

#### Scenario REQ-TES-05.3: Baseline regen is paired with a positive signature assertion [new]

- GIVEN the regenerated `./testing` baseline after `defineFactory`'s removal
- WHEN inspected
- THEN it ALSO asserts `runFactoryForTest`'s parameter list matches the new bare-fn +
  optional `{seed, packageDir}` shape — a regen that only proves the removal, without this
  positive assertion, fails this scenario

### REQ-TES-06: Installed-Consumer-Vantage e2e

A NEW e2e test MUST prove reachability from an installed consumer's own vantage: build the
package, `bun pm pack` it, install the tarball into a scratch directory, and
`import(...)` it BY PACKAGE NAME. It MUST assert `./commons` resolves, `./testing`
resolves, `@pbuilder/sdk/core` stays UNRESOLVABLE, AND cover the two FOUNDING scenarios at
this installed vantage using `runFactoryForTest` alone, passing the bare author function
directly — `defineFactory` is NEVER named at this vantage (Previously: scenarios ran via
the installed `runFactoryForTest`/`defineFactory` pair).

#### Scenario REQ-TES-06.1: Installed consumer resolves `./commons` and `./testing`, not `./core`

- GIVEN a freshly packed and scratch-installed tarball
- WHEN the scratch consumer imports `@pbuilder/sdk/commons` and `@pbuilder/sdk/testing` by package name
- THEN both resolve, and `@pbuilder/sdk/core` fails to resolve

#### Scenario REQ-TES-06.2: A write-only bare factory commits end-to-end through the published entry

- GIVEN the scratch-installed consumer, running a bare factory function (a single
  `create(...)` call, nothing else) via the installed `runFactoryForTest`
- WHEN the run resolves
- THEN `result.tree` matches a golden committed tree containing exactly the created path/content

#### Scenario REQ-TES-06.3: An all-or-nothing rejection surfaces an author-assertable error through the published entry

- GIVEN the scratch-installed consumer, running a bare factory that seeds a colliding path
  and calls `create` without force, via the installed `runFactoryForTest`
- WHEN the run resolves
- THEN `result.tree` is empty and `result.error` is assertable as an `AuthoringError`
  instance with the expected `verb`/`path`/`reason`

#### Scenario REQ-TES-06.4: A stale `defineFactory` import fails to resolve [new]

- GIVEN a scratch consumer file that writes `import { defineFactory } from "@pbuilder/sdk/testing"`
- WHEN the file is type-checked/resolved against the installed package
- THEN the named import fails to resolve — no value is bound, proving the removal is a
  compile-time signal, not merely a documentation change

## ADDED Requirements

### REQ-TES-08: `defineFactory` Unreachable via `./testing`

`defineFactory` MUST NOT be reachable, by name, from `./testing`'s built exports — this is
the positive-boundary restatement of repealed REQ-TES-02, scoped to the entry-surface
guard (FIT-08/REQ-TES-03 enforces the mechanism; this REQ pins the outcome).

#### Scenario REQ-TES-08.1: `defineFactory` absent from `./testing`'s resolved exports

- GIVEN a built package tree
- WHEN `./testing`'s module exports are enumerated
- THEN `defineFactory` is NOT among them

### REQ-TES-09: Scaffold/Expander Error Strings Reflect the Bare Contract

The three author-facing rejection strings in `src/scaffold/index.ts:22,86` and
`src/scaffold/expander.ts:57` (each currently reading `"... requires defineFactory({
packageDir })..."`) MUST be rewritten to name the SANCTIONED bare-shape action for
supplying `packageDir` (via the caller that runs the factory), and MUST NOT contain the
token `defineFactory` in any form.

#### Scenario REQ-TES-09.1: `scaffold/index.ts:22` (templateFile) rejection is rewritten

- GIVEN a factory triggering the `templateFile` missing-`packageDir` rejection
- WHEN the thrown message is inspected
- THEN it contains zero `defineFactory` tokens AND names the correct bare-shape remedy

#### Scenario REQ-TES-09.2: `scaffold/index.ts:86` (copyIn) rejection is rewritten

- GIVEN a factory triggering the `copyIn` missing-`packageDir` rejection
- WHEN the thrown message is inspected
- THEN it contains zero `defineFactory` tokens AND names the correct bare-shape remedy

#### Scenario REQ-TES-09.3: `expander.ts:57` (scaffold) rejection is rewritten

- GIVEN a factory triggering the `scaffold` missing-`packageDir` rejection
- WHEN the thrown message is inspected
- THEN it contains zero `defineFactory` tokens AND names the correct bare-shape remedy

### REQ-TES-10: `src/commons/index.ts` JSDoc Reflects the Bare Contract

`src/commons/index.ts`'s JSDoc (lines naming `defineFactory({packageDir})` at :165, 234,
274, 382, 385, 393 in the pre-change source), which feeds FIT-06/`commons.index.d.ts`'s
baseline, MUST be rewritten to zero `defineFactory` occurrences, describing the bare-shape
contract instead (same defect class as REQ-TES-09, surfaced by QA council review —
orchestrator-added scope, not a silent omission).

#### Scenario REQ-TES-10.1: `./commons`'s JSDoc carries zero `defineFactory` tokens

- GIVEN the built `./commons` entry's JSDoc-derived documentation
- WHEN scanned for the literal token `defineFactory`
- THEN zero occurrences are found
