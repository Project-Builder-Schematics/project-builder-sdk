# Slices: bare-factory-migration

**Triage**: L | **Spec version**: V2 — **SIGNED (owner, 2026-07-14)**; REQ-ATH-20 +
REQ-TSD-05 added per plan-verify iter 1 gaps #2/#3; REQ-ATH-20.1's scan oracle amended
post-signature to the bare-identifier form (see §16b — RESOLVED) | **Slices rev**: 3
(rev 2: Executor Context; rev 3: iter-2 resolutions addendum — 7 slices, coverage, and
build order unchanged) | **Total slices**: 7 (1 skeleton + 6 SPIDR)

**Global acceptance criterion (every slice)**: regression sentinels — `test/golden-ir/**`, `test/core/**`, `test/conformance/**`, `test/dialects/**`, the ~85 deep-import test files, and `src/core/context.ts:293-346` (frozen impl body) — show zero diff (verify-phase git-diff manifest).

---

## S-000: Walking Skeleton — bare signature + delegation + FIT-29

**Scope**: walking-skeleton | **Dimension**: — | **Requires**: nothing
**Covers**: REQ-ATH-01.1/.4/.5, REQ-ATH-17.1/.2, REQ-AOD-01.1/.2/.3, REQ-TES-05.3 (infra only, full at S-006)
**Failing-first**: `src/testing/index.ts` signature test (red: old positional `seed` arg), `test/types/runfactoryfortest-shape.test.ts` (new, red until created), `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` (new, red until guard exists), `docs/quickstart.md` fence recompile (red on bare `factory.ts`).

**Acceptance**:
- GIVEN `runFactoryForTest(fn, input, {seed?, packageDir?})` delegating to `defineFactory` internally
- WHEN called with an opted-in fixture (`packageDir` present, schema-invalid input) and an untyped fixture (no `packageDir`, same input)
- THEN opted-in rejects via `AuthoringError reason:"invalid-input"`; untyped runs byte-identical to today (ATH-17.1/.2)
- GIVEN an arity-2 old wrapped-runner value passed as `fn`
- WHEN type-checked
- THEN it fails to compile (`@ts-expect-error`, ATH-01.5); positive signature assertion also passes
- GIVEN `docs/quickstart.md`'s bare `factory.ts` + generated type
- WHEN its test runs
- THEN it passes (AOD-01.1-.3)
- GIVEN a planted `defineFactory` import from `src/commons/**`
- WHEN FIT-29 scans production code
- THEN a violation is reported; sanctioned callers (`src/core/**`, `src/testing/**`, `src/conformance/**`) stay clean

---

## S-001: Wrap-Parity Proof (REQ-ATH-19)

**Scope**: happy-path | **Dimension**: P (Path — happy vs double-fault) | **Requires**: S-000
**Covers**: REQ-ATH-19.1, REQ-ATH-19.2
**Failing-first**: `test/fake/harness-wrap-parity.test.ts` (new, red — no `wrap-parity-support.ts` yet)

**Acceptance**:
- GIVEN the same bare factory run via `runFactoryForTest` AND via a manual `defineFactory(fn,{packageDir})` + hand-built `RecordingClient`/`ContractFake`
- WHEN both complete
- THEN `{tree, emitted, error}` are identical, including dialect drain→flush ordering
- GIVEN a factory throwing `E1` where the manual driver's `FaultyDiscardFake.discard()` throws `E2`
- WHEN both paths run
- THEN both yield `error === E1` with `error.cause === E2`

---

## S-002: Harness Rule Completion + Error Strings + Commons JSDoc

**Scope**: happy-path | **Dimension**: R (Rule) | **Requires**: S-000
**Covers**: REQ-ATH-01.2/.3, REQ-ATH-06.1/.2, REQ-ATH-11.1/.2, REQ-ATH-14.1/.2, REQ-ATH-17.3, REQ-ATH-18.1/.2, REQ-TES-09.1/.2/.3, REQ-TES-10.1
**Failing-first**: `harness-result.test.ts` (throw/reject/non-function/zero-arg), `harness-in-memory-invariant.test.ts` (carve-out reads), `harness-opted-in.test.ts` (fs-read oracle), 3 `test/scaffold/*` per-message tests, `commons/index.ts` JSDoc token-scan test — all red on current wrapped-shape/`defineFactory`-naming text.

**Acceptance**:
- GIVEN sync throw / async reject after buffering
- WHEN run
- THEN discard is all-or-nothing, `result.error` is the exact original error (ATH-06)
- GIVEN opted-in reads (schema/scaffold within collection root) vs an out-of-ceiling harness read
- WHEN run
- THEN in-ceiling reads are observed-not-flagged; out-of-ceiling still trips the invariant (ATH-11/14)
- GIVEN a non-function `fn` / zero-arg `fn`
- WHEN run
- THEN plain `TypeError` / normal completion respectively (ATH-18)
- GIVEN the 3 scaffold/expander missing-`packageDir` rejections and `./commons` JSDoc
- WHEN inspected
- THEN zero `defineFactory` tokens remain; each names the caller-supplied-`packageDir` remedy (TES-09/10)

---

## S-003: Author Docs — Bare-Shape Rewrite

**Scope**: happy-path | **Dimension**: I (Interface — same contract via multiple author-facing surfaces: README, reference docs, in-editor JSDoc) | **Requires**: S-000
**Covers**: REQ-TSD-01.1-.5, REQ-TSD-02.1-.3, REQ-TSD-05.1-.3 (dry-run.md fence rewritten bare AND fence-compiling against the new `runFactoryForTest` signature; authoring-verbs/authoring-errors prose softened + zero-token scan), REQ-FPS-05.2/.3
**Failing-first**: `test/docs/doc-set-content.test.ts`, `test/docs/testing-story-docs.test.ts`, `fit-06-example-jsdoc.test.ts`, `definefactory-jsdoc.test.ts` — red on wrapped content / missing internal `@example`.

**Acceptance**:
- GIVEN README's testing section (incl. the `:40-47` scaffolding example) and `docs/{dry-run,authoring-verbs,authoring-errors}.md`
- WHEN scanned
- THEN zero `defineFactory` tokens; 0.x semver-exemption and `./testing` vs `./conformance` boundary stated; a `seed`-via-options-bag example exists
- GIVEN `runFactoryForTest`'s JSDoc and `defineFactory`'s origin JSDoc (`context.ts`)
- WHEN FIT-06 resolves the re-export cascade (now including `src/testing/index.ts`)
- THEN both carry `@example` — `runFactoryForTest`'s is author-facing bare, `defineFactory`'s re-aims internal (FPS-05.2)

---

## S-004: Fixture Rewrite — typed-factory + author-emulation, bare

**Scope**: happy-path | **Dimension**: D (Data — 22 export sites converted) | **Requires**: S-000
**Covers**: REQ-FPS-04.1; enables S-005
**Failing-first**: `test/fixtures/typed-factory/factory.ts` type-check (red on wrapped export vs bare `FactoryRunner`), `scenarios.ts` compile (red — `ScenarioEntry.packageDir` not yet threaded), `fit-16-reserved-name-scan.test.ts` (3rd signal retirement — vacuous-green check).

**Acceptance**:
- GIVEN `test/fixtures/typed-factory/factory.ts` (1 export) and `test/fixtures/author-emulation/factory.ts` (21 exports)
- WHEN converted to bare `(input) => void | Promise<void>`
- THEN `scenarios.ts`'s `FactoryRunner` type compile-enforces the shape; per-scenario `packageDir` is threaded explicitly
- GIVEN `test/support/ir-transcript.ts`'s `captureRun(run, input, options?)`
- WHEN called from the corpus pipeline
- THEN it accepts the options bag; raw-rethrow divergence (line 108) unchanged
- GIVEN FIT-16's 3rd signal (`hasUntetheredDefineFactory`) and its red fixture
- WHEN fixtures carry zero `defineFactory`/`packageDir` tokens
- THEN the signal is explicitly RETIRED (assertions removed, fixture deleted) — not left silently vacuous

---

## S-005: Corpus Regen — byte-identical freshness

**Scope**: happy-path | **Dimension**: D (Data) | **Requires**: S-004 (STRICT — regen only after fixtures are bare)
**Covers**: REQ-ATH-20.2 (corpus regen is a git-clean no-op against bare fixtures — spec V2, `author-test-harness` domain, added per plan-verify iter 1 gap #2); also the Migration/Rollout freshness gate; supports REQ-FPS-04.1's e2e chain. (REQ-ATH-20.1 — fixtures fully bare — is covered by S-004, not here.)
**Failing-first**: `test/fitness/fit-28-corpus-determinism.test.ts` (red — stale corpus vs regenerated) run against the current committed `*.json` before regen.

**Acceptance**:
- GIVEN `scripts/regen-corpus.ts` threading `{packageDir}` per scenario
- WHEN run against the S-004 fixtures
- THEN `test/e2e/author-emulation/corpus/*.json` (22 records) regenerate byte-identical to committed content
- GIVEN a fresh-process double-run (FIT-28)
- WHEN compared
- THEN `git status` on the corpus directory is clean (no-op regen)

---

## S-006: Export Removal — FINAL

**Scope**: edge-case | **Dimension**: R (Rule — full enforcement of "`defineFactory` unreachable via `./testing`") | **Requires**: ALL of S-001..S-005 complete (design-mandated hard precondition — zero remaining `./testing`-sourced `defineFactory` references outside sanctioned callers: docs, fences, 4 harness files, installed-consumer e2e all bare first)
**Covers**: REQ-TES-03.1/.1b/.2/.3/.4, REQ-TES-05.1/.2/.3 (removal-regen event), REQ-TES-06.1/.2/.3/.4, REQ-TES-08.1, REQ-ATH-01.3
**Failing-first**: `fit-08-no-kit-bleed.test.ts` (red — `defineFactory` still on `./testing` allowlist), `installed-consumer.e2e.test.ts` (red — `hasDefineFactory` still `true`), dts baseline diff (red — no removal detected yet).

**Acceptance**:
- GIVEN `export { defineFactory }` removed from `src/testing/index.ts` and FIT-08's `./testing` allowlist narrowed to `runFactoryForTest` + type-only `Batch`/`Directive`
- WHEN FIT-08 scans
- THEN `defineFactory`/`Session`/`ContractFake` (value and type) are violations; the narrowed allowlist itself cannot be achieved by removing `./testing` from the scan
- GIVEN a scratch-installed tarball
- WHEN a consumer writes `import { defineFactory } from "@pbuilder/sdk/testing"`
- THEN it fails to resolve; `runFactoryForTest` alone drives both founding e2e scenarios
- GIVEN the removal dts regen
- WHEN inspected
- THEN it is paired, in this SAME slice, with the positive assertion proving `runFactoryForTest`'s new signature (not a removal-only diff)

---

## Anti-Pattern Check

⚠️ Two deliberate flags, both design-mandated, not oversights:
- **S-006 depends on 5 prior slices** (>2 heuristic) — intentional: constraint 4 requires export removal to be strictly final, gated on every other surface being bare first. Re-ordering would break the hard-cut invariant (no dual-shape window).
- **S-001 (wrap-parity) kept separate from S-002 (harness rules)** despite thematic overlap in design's flow table — merging would cross-cut two SPIDR dimensions (P + R) in one slice, forbidden by Step 6.

No horizontal/layer-named slices; every slice references ≥1 REQ-ID; no slice cross-cuts two SPIDR dimensions.

## Build Order

1. S-000 (skeleton — implicit blocker for all)
2. S-001, S-002, S-003, S-004 — independent of each other, parallelizable after S-000
3. S-005 — requires S-004
4. S-006 (final) — requires S-001, S-002, S-003, S-004, S-005 all complete

---

# Executor Context — READ THIS FIRST

Every fact below was re-verified against this repo at revision time (file + line
citations, `git log` where relevant). Where a fact and the live code disagree at build
time, the live code wins — re-verify, do not force the citation. Two DISCREPANCIES were
found during this verification pass and are called out explicitly (§8b, §16b) — read
those before starting S-002/S-004, they change what "done" looks like.

## 0. Orchestrator precondition — RESOLVED

Spec V2 is **SIGNED (owner, 2026-07-14)** — all five domain files carry
`**Status**: signed (V2, owner, 2026-07-14)` at line 4, and the authoritative signature
record (covering both the V1 and V2 sign events) lives in this change's `state.yaml`
spec entry. The unsigned-spec block on `sdd-apply` is lifted; apply may start once the
plan-verify gate returns `ready`.

## 1. Mandatory reading list (before S-000)

1. `openspec/changes/bare-factory-migration/specs/*/spec.md` (5 domains, V2) — the
   scenario text IS the acceptance detail; slice acceptance criteria SUMMARIZE.
2. `openspec/changes/bare-factory-migration/design.md` (rev 1) — File Changes table
   (§4.2), Flow Changes (§4.2b), Test Derivation (§4.6), Fitness Functions (§4.7),
   Migration/Rollout (§4.8) — the slice ordering constraints there are BINDING.
3. `openspec/changes/bare-factory-migration/verify-plan-1.md` — the gap list this
   revision answers; gaps #5/#6 are owner rulings, recorded verbatim in §19 below.

## 2. `runFactoryForTest` — current signature, return shape, target signature

Current (`src/testing/index.ts:95-99`):
```ts
export async function runFactoryForTest<O>(
  factory: (o: O, deps: { client: RecordingClient }) => Promise<void>,
  input: O,
  seed?: Record<string, string>
): Promise<RunResult>
```
`RunResult` (`src/testing/index.ts:29-44`): `{ tree: ReadonlyMap<string,string>;
emitted: Batch[]; error: AuthoringError | unknown }` — UNCHANGED by this migration
(design §4.3 confirms). `RecordingClient` (`:13-18`) is a local 4-member structural
port (`emit`/`read`/`commit`/`discard`) mirroring `EngineClient` — never exported,
never imported from elsewhere; the harness builds its own instance internally
(`:100-116`) and callers never construct or pass one.

Target (design §4.3, `data-model`):
```ts
export async function runFactoryForTest<O>(
  fn: (input: O) => void | Promise<void>,
  input: O,
  options?: { seed?: Record<string, string>; packageDir?: string | URL }
): Promise<RunResult>
```
Internally: `defineFactory<O>(fn, options?.packageDir !== undefined ? { packageDir:
options.packageDir } : undefined)(input, { client })` — i.e. `runFactoryForTest`
becomes a THIN wrapper that (a) builds the SAME `client`/`fake` it builds today
(`:100-116` stays, only the caller-facing shape around it changes) and (b) calls
`defineFactory` to get the runner instead of receiving an already-wrapped runner from
the caller. `error` capture (`:118-123`) stays a plain try/catch around the
`defineFactory`-produced call.

## 3. `defineFactory` — internal contract, unchanged, frozen impl body

`src/core/context.ts:293-346`:
```ts
export function defineFactory<O>(
  fn: (o: O) => void | Promise<void>,
  options?: { packageDir?: string | URL }
): (o: O, deps: { client: EngineClient }) => Promise<void>
```
Returns `(o, { client }) => Promise<void>` — this is the exact "runner" shape
`runFactoryForTest`'s CURRENT `factory` parameter expects, confirming the harness
already knows how to drive a `defineFactory` runner; the migration's job is to have
`runFactoryForTest` PRODUCE that runner (via `defineFactory`) instead of RECEIVING one
from the caller. Body (verified, exact lines):
- `:299` `if (options?.packageDir !== undefined)` — the whole validation gate
  (`resolvePackageDir` → `checkReservedNames` → `validateAtRunBoundary` →
  `resolvePackageRoot`, `:300-306`) is INSIDE this branch; bare `defineFactory(fn)`
  (no `options`) skips it entirely (REQ-TFO-02, byte-for-byte unchanged).
- `:308-313` `RunContext` built: `{session, factory, dialects, packageAnchors}`.
- `:322-326` `als.run(ctx, () => fn(o))` → `ctx.dialects.drain()` → `session.flush()`
  → `session.commit()`, all inside one `try`.
- `:327-343` the `catch`: `session.discard()`; on a discard THROW (E2), attach as
  `err.cause` UNLESS `err` (E1) already has a cause, guarded by its own try/catch so a
  frozen/sealed E1 that rejects the `.cause` assignment still propagates E1 unchanged
  (`:335-341`); `throw err` (`:343`) always re-throws E1, never E2.

**This body is FROZEN — the migration calls `defineFactory`, it never edits
`:293-346`.** The only touch inside `context.ts` is the JSDoc block immediately above
it (`:248-292`, re-aim `@internal` + sanctioned-callers note + internal `@example`,
design §4.2 row 2) — that JSDoc range is NOT part of the frozen body.

## 4. `seed` semantics — positional today, options-bag target, corpus implications

Today: `runFactoryForTest`'s 3rd positional arg feeds `new ContractFake({ seed: seed ??
{} })` (`:100`) — `ContractFakeOptions` is `{ seed: Record<string,string> }`
(`src/testing/contract-fake.ts:26-28`, constructor `:43-45`, null-prototype copy to
defeat `Object.prototype` leakage). Target: `options?.seed` in the new bag, same
downstream feed, no fake-side change. `captureRun` (`test/support/ir-transcript.ts:63-
68`) currently takes `seed?: Record<string,string>` as its own 3rd positional and
passes it straight through (`runFactoryForTest(run, input, seed)` at `:68`) — design
§4.3 targets `captureRun<O>(run, input, options?: {seed?, packageDir?})`. Corpus
determinism implication: `seed` never varies per scenario today (no `SCENARIOS` entry
sets it beyond `M21_COLLISION_SEED_PATH`-style fixture data, which is tree-seeded
inside the factory itself, not via this parameter) — moving it into the bag is a pure
shape change, not a behavior change, so FIT-28's byte-determinism is unaffected by
this specific field.

## 5. `packageDir` semantics — anchor, ceiling, resolution forms

`packageDir` (opts-in) triggers, in order (`context.ts:299-306`): reserved-name scan
(`checkReservedNames`, sibling `pre-execute`/`post-execute` file-or-dir,
case-insensitive) → schema-boundary validation (`validateAtRunBoundary`, reads
adjacent `schema.json`, ENOENT-only opt-out) → containment-ceiling resolution
(`resolvePackageRoot`, `:132-150`, walks upward for the nearest `collection.json`
ancestor, throws `invalid-input` via `missingPackageRootMessage` if none found before
hitting the fs root). Both anchors land in `RunContext.packageAnchors: {packageDir:
resolvedDir, packageRoot}` (`:71`, `:306`, ADR-0046) — absent entirely for the untyped
bare-`defineFactory(fn)` path. Accepted forms: `string` OR `URL` — `resolvePackageDir`
(`:106-108`) converts a `URL` via `fileURLToPath`; pass `import.meta.dir` (a Bun
string), never `import.meta.url` (a file URL, common misuse, called out in the
`defineFactory` JSDoc `:265-266`). **Opted-in vs untyped is a BEHAVIORAL fork, not
cosmetic**: opted-in gets schema validation + reserved-name enforcement + containment
ceiling; untyped gets NONE of that and is byte-for-byte identical to pre-migration
behavior (REQ-TFO-02, this migration's ADR-C explicitly preserves it as a PERMANENT
tier, not a shim — see §19 ruling #6 below).

## 6. `AuthoringError` contract — fields, reason enum, what THIS change touches

`src/core/authoring-error.ts`. Fields (`:237-270`): `verb: AuthoringVerb | undefined`,
`path: string | undefined`, `reason: AuthoringReason`, `origin: AuthoringOrigin`
(derived, never producer-set), `appliedCount: number`. `AuthoringVerb` (`:30`) already
has 7 members (`create|modify|remove|rename|move|copy|copyIn` — `copyIn` landed in the
prior `schematic-local-files` change, S-003). `AuthoringReason` (`:64-76`) already has
its full closed 12: `path-collision, path-not-found, unrepresentable-content,
changes-too-large, outside-run, unknown, invalid-input, reserved-name,
source-not-found, source-outside-package, source-not-regular-file,
source-unreadable`. **This migration touches NEITHER enum** — it is wording-only.
S-002's 3 error-message rewrites (§8 below) construct `AuthoringError` via the existing
`invalidInput(message)` helper (`:276-278`), which always sets `reason: "invalid-
input"` — only the `message` string argument changes, never `verb`/`path`/`reason`.

## 7. Double-fault rule + drain→flush ordering — exact wrap-parity assertions

Rule (context.ts `:327-343`, ADR-0037 comment `:19-25`): on any throw inside the try
(`fn` throw, dialect-drain rejection, flush rejection), `session.discard()` runs; if
`discard()` itself rejects (E2), E2 is attached as `err.cause` UNLESS E1 already has a
`.cause` set, and the assignment itself is guarded (frozen/sealed E1 survives
unchanged). `err` (E1) is ALWAYS what gets re-thrown (`:343`) — never E2 directly.
REQ-ATH-19.2's assertion, precisely: `result.error === E1` AND `result.error.cause ===
E2`. Drain ordering (`:322-326`): `als.run` → `dialects.drain()` (awaits every
registered dialect handle's `settle()` via `Promise.allSettled`, first rejection
re-thrown, `:41-49`) → `session.flush()` → `session.commit()` — the drain happens
BETWEEN run-completion and flush, so an unawaited-but-registered dialect chain still
completes and its directives land in the SAME flush. REQ-ATH-19.1's wrap-parity
assertion needs a dialect-using factory specifically to prove this ordering survives
identically through both the `runFactoryForTest` path and a manual
`defineFactory`-direct path (design §4.6) — a factory with no dialect calls cannot
distinguish "drain ran" from "drain was a no-op".

`test/support/wrap-parity-support.ts` (NEW, S-001) must: (a) call `defineFactory(fn,
{packageDir})` DIRECTLY (never re-wrap via `runFactoryForTest` — a re-wrapping
reference would silently reintroduce double-wrap and pass the parity test on a lie,
design ADR-C); (b) hand-build a `RecordingClient`-shaped object over a fresh
`ContractFake({seed})` (mirror `src/testing/index.ts:100-116` structurally, do not
import the private interface — it is unexported); (c) provide a `FaultyDiscardFake`
variant whose `discard()` rejects, for the E1/E2 fixture.

## 8. FIT-29 (NEW) — implementation recipe

Design §4.7: scan surface PRODUCTION ONLY (`src/**` + `bin/**`), for imports of the
`defineFactory` binding resolving into `src/core/context.ts` (or its barrel,
`src/core/index.ts`), allowlist `src/core/**`, `src/testing/**`, `src/conformance/**`.
`test/**` is categorically outside the scan domain.

Idiom to copy (already established, 3 precedents, all reuse
`test/support/import-scan.ts`'s `specifiersResolvingInto(source, fromDir, target)`):
- `test/fitness/fit-15-bin-core-direction.test.ts` (`:1-9` header, `:34-38`
  `importsFromBin` helper, `:40-52` per-file `it()` loop) — walks EVERY file under a
  root, flags any resolving INTO a forbidden target directory/file. FIT-29 is the same
  shape with the polarity/allowlist inverted: walk `src/**`+`bin/**`, flag files
  resolving `defineFactory` INTO `context.ts`/`core/index.ts` UNLESS the importing
  file itself is under one of the 3 allowlisted roots.
- `test/fitness/fit-21-context-no-dialect-handle-import.test.ts` — same idiom, single
  forbidden target.
- `specifiersResolvingInto` itself (`test/support/import-scan.ts:29-40`) resolves
  relative specifiers only (`if (!specifier.startsWith(".")) continue`) — bare/package
  specifiers can never match, which is correct here (a production file importing
  `defineFactory` always does so via a relative path to `core/context.ts` or
  `core/index.ts`, never a package specifier, since this is all inside one package).
- Red-proof fixture placement: follow FIT-15's inline-fixture-source pattern
  (`:54-60`, a template literal string passed directly to `specifiersResolvingInto`,
  no fixture FILE needed) rather than FIT-16's `test/fixtures/red/**` file-based
  pattern — FIT-15/21/22 never use fixture files for their red-proofs, only FIT-16
  does (because FIT-16 red-proofs call a DIFFERENT function, `findReservedSibling`,
  against real directory structure). A "planted `defineFactory` import from
  `src/commons/**`" red-proof should therefore be an inline fixture string, not a new
  file under `src/commons/`.

## 8b. DISCREPANCY — FIT-06 already scans `src/testing/index.ts` (design says "Modify")

Design §4.2 lists `test/fitness/fit-06-example-jsdoc.test.ts` as **Modify**:
"`PUBLIC_PATHS` += `src/testing/index.ts`; origin-cascade to `context.ts`". Verified
against the live file: `PUBLIC_PATHS` (`test/fitness/fit-06-example-jsdoc.test.ts:28-
33`) **already includes** `join(ROOT, "testing/index.ts")` at line 31, and the file
already carries THREE REQ-TSD-02.1/.2/.3-labeled tests (`:320-385`) asserting
`runFactoryForTest`'s JSDoc has `@param seed`, contains `"0.x"` + `"semver-exempt"`,
and a complete `@example`. `git log` shows this landed in commit `5ad8a73` ("fix
(testing): judgment-day r1 — @example assertion + FIT-06 seed/assertion guards...").
**This is NOT new work — it is already done, ahead of this change.** Consequence for
S-003: no `PUBLIC_PATHS` edit is needed; but the REQ-TSD-02.1 test does a LITERAL
`toMatch(/@param\s+seed\b/)` match against the JSDoc — when `seed` moves into the
options bag, the JSDoc's `@param` tag wording must keep a literal `seed` token
reachable by that regex (e.g. `@param options.seed` still contains `seed`, so it
matches; but do not rename the field to something that breaks the substring) or this
test itself needs a companion edit. Verify this test still passes after S-000/S-002's
JSDoc rewrite — do not assume it is inert just because the file isn't newly "created".

## 9. Fitness framework conventions — how FIT-06/08/16/28 scan today

- **FIT-06** (`fit-06-example-jsdoc.test.ts`): regex-based JSDoc block extractor over 4
  `PUBLIC_PATHS` (commons, conformance, testing, typescript dialect), resolves
  re-exports (`export {X} from './y'` and the two-step import+export pattern) to their
  ORIGIN file's JSDoc, not the re-export line (`buildReExportMap`, `:121-165`). Every
  public export needs `@example` unless tagged `@internal`.
- **FIT-08** (`fit-08-no-kit-bleed.test.ts`): per-path `{valueAllow, typeAllow}`
  allowlist (`SCANNED`, `:42-55`) scanned for (a) any wildcard re-export (banned by
  form, one exemption: `src/index.ts`'s `export * from "./commons/index.ts"`) and (b)
  named-export brace lists containing a `KIT_SYMBOL_NAMES` entry not on that path's
  allowlist for its export form. `./testing`'s CURRENT allowlist (`:47-50`):
  `valueAllow: ["defineFactory", "runFactoryForTest"]`, `typeAllow: ["Batch",
  "Directive"]`. S-006's narrowing = drop `"defineFactory"` from `valueAllow`.
- **FIT-16** (`fit-16-reserved-name-scan.test.ts`): 2 signals over `ALWAYS_ON_SCAN_ROOTS`
  — reserved-sibling walk (`findReservedSibling`, stays) + the 3rd signal
  `hasUntetheredDefineFactory` (`:29-31`, `source.includes("defineFactory") &&
  !source.includes("packageDir")` — substring on the BARE identifier, deliberately NOT
  `"defineFactory("`, see §16b below for why that distinction matters) — RETIRE this
  3rd signal per ADR-A (remove its 2 assertions at `:41-44` from the `ALWAYS_ON_SCAN_
  ROOTS` loop AND its red-proof pair at `:66-76`, AND delete `test/fixtures/red/
  reserved/untethered-factory.ts` — same commit, never one without the other; removing
  only the fixture crashes the red-proof's `readFileSync` at `:67`).
- **FIT-28** (`fit-28-corpus-determinism.test.ts`): fresh-process double-run byte-
  compare — untouched by this migration structurally, but its INPUT (the corpus) is
  what S-005 regenerates and re-asserts clean against.

## 10. The fixture export sites — current shape, target shape, `FactoryRunner`, threading

Current wrapped shape (`test/fixtures/author-emulation/factory.ts:44-61`, representative):
```ts
export const runM01 = defineFactory<Input>(
  (input) => { /* ...scaffold/copyIn/create calls... */ },
  { packageDir: PACKAGE_DIR }
);
```
Target bare shape: `export const runM01 = (input: Input) => { /* same body */ };` —
`packageDir` moves OUT of the fixture entirely, into the per-scenario `ScenarioEntry`
in `scenarios.ts` (see §11).

`FactoryRunner` type (`test/e2e/author-emulation/scenarios.ts:40`, current):
```ts
export type FactoryRunner = (input: any, deps: { client: any }) => Promise<void>;
```
Target (design §4.3): `export type FactoryRunner = (input: any) => void |
Promise<void>;` — this type is what COMPILE-ENFORCES the fixture migration (design
§4.7: "Author fixtures need no token scan here — `scenarios.ts`'s bare `FactoryRunner`
type COMPILE-enforces their migration").

`scratchFactoryRunner` (`:168-185`, a local helper, NOT exported) internally calls
`defineFactory<Input>(body, { packageDir: dir })` at `:178` to build a
scratch-temp-dir-backed runner for the git-hostile/oversized scenarios (M-07/M-09/M-14/
M-19/M-18/M-21/M-12Oversized/M-17*/WalkOrderDiscriminator). Its `body` parameter is
ALREADY the bare `(input) => void | Promise<void>` shape passed in by each of its
callers — `scratchFactoryRunner` itself is the one place in this file that still calls
`defineFactory` after the migration (it constructs its OWN scratch `packageDir` at
runtime, so it cannot be threaded through `ScenarioEntry.packageDir` the way the other
19 direct exports are). Confirm at build time whether `scratchFactoryRunner`'s internal
`defineFactory` call needs to become a `runFactoryForTest`-style delegation too, or
stays as a direct `defineFactory` call (production test-support code, not part of the
public surface FIT-29 restricts) — design does not explicitly rule on this; treat it as
in-scope for S-004 to decide and record the decision in apply-progress, not silently.

Per-scenario `packageDir` threading: `ScenarioEntry` (`scenarios.ts:42-53`) gains
`packageDir?: string` (design §4.3); for the 19 direct-`defineFactory` fixtures this is
`PACKAGE_DIR` (`= import.meta.dir`, `:24`) passed at the `SCENARIOS` array entry level
instead of at the `defineFactory` call site; `s-00` (skeleton, `typed-factory/
factory.ts`) needs its own package dir similarly threaded.

## 10b. Exact count — 22 "export sites" means the SCENARIO-registered subset, not every export

`test/e2e/author-emulation/scenarios.ts:9-31` imports exactly 21 named runners from
`author-emulation/factory.ts` (`runM01, runM02Defaults, runM03..runM21, runM20Valid`)
plus 1 from `typed-factory/factory.ts` (`run`, aliased `skeletonRun`) = the "22 export
sites" figure design/spec use (also pinned as REQ-ATH-20.1's "22 exports total").
**The fixture FILE itself has MORE than 21 runner exports** — `author-emulation/
factory.ts` declares 28 `export const run*` bindings total (verified: `rg -n
"^export const run" test/fixtures/author-emulation/factory.ts` → 28 matches). The
other 7 (`runM02MissingFrom`, `runM02MissingTo`, `runM11OverCap`, `runM12Oversized`,
`runM16Absolute`, `runM17Existing`, `runWalkOrderDiscriminator`) are consumed directly
by the e2e test file for one-off assertions, NOT wired into `SCENARIOS`/the corpus
pipeline. **REQ-ATH-20.1's acceptance criterion is scanned across the WHOLE file**
("zero occurrences... anywhere in either file") — so ALL 28 (not just the 21 that feed
`SCENARIOS`) must convert to bare, plus `scratchFactoryRunner`'s own internal call
(§10). Do not stop at 21/22 — that count describes the corpus-registered subset only.

## 11. `scenarios.ts` `ScenarioEntry` + `captureRun` — structure and the raw-rethrow pin

`ScenarioEntry` (`scenarios.ts:42-53`): `{id, slug, run: FactoryRunner, input: unknown,
seed?: Record<string,string>, expected: "committed"|"rejected", gated: boolean}`.
`gated` controls whether `regen-corpus.ts` skips a scenario (`scripts/regen-
corpus.ts:17`, `if (scenario.gated) continue`) — all current entries have `gated:
false` (the matrix surface already landed in a prior change; this migration does not
flip any `gated` flags).

`captureRun<O>(run, input, seed?)` (`test/support/ir-transcript.ts:63-68`): calls
`runFactoryForTest(run, input, seed)` (`:68`) and normalizes the result. **The
raw-rethrow divergence at line 108** (`throw result.error;`, the function's LAST line)
fires when `result.error` is neither `undefined` nor an `AuthoringError` instance — a
non-`AuthoringError` throw is treated as a FACTORY BUG, not a scenario outcome, and
propagates unchanged rather than being mis-recorded (`:59-61` comment). This divergence
is explicitly called out in design/verify-plan as MUST-PRESERVE — do not swallow it
while threading the options bag through `captureRun`'s signature.

## 12. `scripts/regen-corpus.ts` mechanics + byte-identity guarantee

`scripts/regen-corpus.ts:14-28`: iterates `SCENARIOS`, skips `gated` entries, calls
`captureRun(scenario.run, scenario.input, scenario.seed)`, builds a `TranscriptRecord`
via `buildRecord` (`test/support/corpus-format.ts:165-176`), serializes via
`serializeCorpus` (`:183-185`: `` `${JSON.stringify(canonicalize(record), null,
2)}\n` `` — UTF-8, LF, 2-space, exactly one trailing newline, ADR-0049), writes to
`corpusFileNameFor(id, slug)` = `` `${id}.${slug}.transcript.json` `` (`:198-200`, the
ONE pinned naming format shared by writer/e2e-compare/FIT-26). `canonicalize`
(`:134-`) rebuilds the record as a plain object with a FIXED key order
(`formatVersion, scenarioId, slug, normative, informative`) — this fixed-order
reconstruction, not sorted-key JSON, is what makes the output deterministic across
runs; `JSON.stringify`'s own key order otherwise follows insertion order, so
`canonicalize`'s explicit field list is the actual determinism mechanism. Ordering
rule for this migration: regen MUST run strictly after S-004's fixture conversion —
running it against still-wrapped fixtures would either fail to compile (once
`FactoryRunner` is narrowed) or, if run before the type change, would silently
regenerate against the OLD behavior and mask a real migration bug.

## 13. S-006 mechanics — 4 harness files, dts baseline, installed-consumer inversion

**The 4 harness consumer files** (design §4.2 row 30, verified: `fd . test/fake -e ts |
rg harness` → exactly these 4): `test/fake/harness-leak-scan.test.ts`, `test/fake/
harness-result.test.ts`, `test/fake/harness-opted-in.test.ts`, `test/fake/harness-in-
memory-invariant.test.ts`. **All 4 currently import BOTH `defineFactory` AND
`runFactoryForTest` from `../../src/testing/index.ts`** (verified via `rg -n "import.*
defineFactory" test/fake/*.test.ts` — every one resolves through `./testing`, NOT
`../../src/core/context.ts` directly). After S-002 converts each file's own test
factories to bare `(input) => ...` functions, these files stop needing a `defineFactory`
import at all (a bare test factory is a plain arrow function — `runFactoryForTest`
alone drives it) — this is WHY S-006's export removal is safe for them: by the time
S-006 runs, none of the 4 should still import `defineFactory` from `./testing`. If any
still does when you reach S-006, that is the build-order violation the slice's
"Requires: ALL of S-001..S-005" gate exists to catch.

**dts baseline location**: `test/fitness/dts-baseline/testing.index.d.ts` (verified,
sibling files: `commons.classify-content.d.ts`, `commons.index.d.ts`, `conformance.
index.d.ts`, `core.authoring-error.d.ts`, `core.base-handle.d.ts`, `core.handle-
state.d.ts`, `index.d.ts`, `typescript.index.d.ts`). Regen/compare mechanism (FIT-04,
`test/fitness/fit-04-dts-semver-gate.test.ts:1-28`): `ensureTscBuild()` runs `bun run
build` ONCE per test process (memoized, shared with installed-consumer e2e); comparison
strips comments/blank lines (`normalizeDeclarations`, `:49-59`) and treats any baseline
line ABSENT from the current `.d.ts` as a breaking removal. Regen is MANUAL — no npm
script: `bun run build`, then copy each `dist/**/*.d.ts` over its committed counterpart
(mapping in the file's own header comment, `:19-24`). **Two SEPARATE regen events**
this migration needs (design §4.8): the SIGNATURE-change regen (S-000, new
`runFactoryForTest` shape) and the REMOVAL regen (S-006, `defineFactory` gone) — do not
collapse them into one diff, and the removal regen must land in the SAME slice as the
positive signature assertion (REQ-TES-05.3), not a removal-only diff.

**Installed-consumer e2e inversion**: `test/e2e/installed-consumer.e2e.test.ts:248-256`
— `results.testing?.hasDefineFactory` currently asserted `true` (`:250`); post-S-006
this flips to the file asserting `false` there and `true` nowhere (`defineFactory`
resolves from NO subpath post-removal). The probe mechanism itself
(`"defineFactory" in mod`, `:225`) needs no change — only the expected booleans invert.
`results.root/.commons/.conformance/.typescript` are ALREADY `false` today (`:252-260`)
and stay `false`.

## 14. Doc surfaces inventory — current locations, exact replacement wording

| Surface | Current `defineFactory` usage | Line(s) |
|---|---|---|
| `README.md` scaffolding example | `import { defineFactory } from "@pbuilder/sdk/testing"`, `defineFactory<{name:string}>((input)=>{...}, {packageDir: import.meta.dir})` | `:40-47` |
| `README.md` testing section | `Import defineFactory and runFactoryForTest...`, 2 code blocks (opted-in + untyped-with-seed, 3rd positional `seed`) | `:91-131` |
| `docs/quickstart.md` step 5 | `import { defineFactory } from "@pbuilder/sdk/testing"`; `defineFactory<Input>((input)=>{...})` (packageDir NOT yet on this call — quickstart's factory is already untyped-tier today); prose "`defineFactory` currently ships from `./testing`; it will graduate to a core entry..." | `:131-151` |
| `docs/quickstart.md` step 6 | `runFactoryForTest(run, {...})` | `:153-168` |
| `docs/dry-run.md` | `import { defineFactory }...`, `defineFactory(() => {...})`, prose "only be called inside an active `defineFactory` run" | `:19,22,40` |
| `docs/authoring-verbs.md` | prose "Only usable inside a `defineFactory({ packageDir })` run." | `:78` |
| `docs/authoring-errors.md` | `import { runFactoryForTest }...`, prose "An authoring verb was called outside an active `defineFactory` run." | `:8,51` |
| `src/scaffold/index.ts` `readTemplateFile` | `` `invalid input: templateFile "${relPath}" requires defineFactory({ packageDir }) — there is no resolution anchor to read a package-local file against` `` | `:20-25` (fn `:20`, message body `:22`) |
| `src/scaffold/index.ts` `copyIn` | `"invalid input: copyIn requires defineFactory({ packageDir }) — there is no resolution anchor to read a package-local file against"` | `:84-89` (fn `:84`, message `:86`) |
| `src/scaffold/expander.ts` `scaffold` | `"invalid input: scaffold requires defineFactory({ packageDir }) — there is no resolution anchor to read package-local files against"` | `:55-59` (fn `:55`, message `:57`) |
| `src/commons/index.ts` JSDoc | 6 `defineFactory({ packageDir })` mentions | `:165, 234, 274, 382, 385, 393` |

**Exact replacement wording** (design ADR-B, verbatim, runtime-neutral — never names
`runFactoryForTest` or a future runner by name, since both will use it): `` "<verb> has
no package directory to resolve … against — pass `packageDir` to the call that runs
this factory"`` — keep the existing `"invalid input: "` prefix each current message
already has. Apply this pattern to all 3 scaffold/expander messages (§ above), adapting
`<verb>` to `templateFile`/`copyIn`/`scaffold` per site, preserving each message's own
detail clause (e.g. `templateFile "${relPath}"`).

## 15. FIT-06 cascade + the two mandated `@example` directions

Per design §4.7/§4.6: `runFactoryForTest`'s `@example` must be AUTHOR-FACING BARE (a
bare `(input) => {...}` factory passed directly, no `defineFactory` wrapping in the
example body) — the CURRENT example (`src/testing/index.ts:70-93`) still shows
`defineFactory<{name:string}>((input) => {...})` wrapped and passed to
`runFactoryForTest`; this needs rewriting to the bare shape. `defineFactory`'s OWN
`@example` (`context.ts:277-291`, currently shows `defineFactory<Input>((input) => {...},
{packageDir: import.meta.dir})`, which is already internally-flavored — it demonstrates
the wrap+drive pattern) gets re-aimed with `@internal` + a sanctioned-callers note in
its JSDoc block (`:248-292`, ABOVE the frozen `:293-346` body — the JSDoc edit does not
touch the frozen range). FIT-06's re-export cascade (§8b, §9) already resolves
`src/testing/index.ts`'s `export { defineFactory } from "../core/context.ts"` (`:47`)
to `context.ts`'s origin JSDoc for the `@example` check — this is why `defineFactory`
needs its OWN valid `@example` even after being marked `@internal` in spirit (FIT-06's
`@internal` tag skips the check ONLY if the tag is actually present in the JSDoc,
`fit-06-example-jsdoc.test.ts:87`, `hasJsDocTag(jsdoc, "@internal")` — so the JSDoc
MUST literally add `@internal`, not just prose-describe internal status, or FIT-06
still demands `@example` there regardless — which it will have anyway per the
re-aimed internal example).

## 16. Deep-import topology — sentinel files confirmed to bypass `./testing`

Verified (`rg -n "import.*defineFactory" test/golden-ir test/core test/conformance
test/dialects test/skeleton`): every regression-sentinel file that imports
`defineFactory` does so via `import { defineFactory } from "../../src/core/context.ts"`
(or the 3-level-up form under `test/dialects/typescript/`) — e.g. `test/conformance/
typescript-conformance.test.ts:23`, `test/core/dialect-handle.test.ts:17`, `test/
skeleton/write-only-factory.test.ts:7`, `test/golden-ir/determinism.test.ts:10`, `test/
golden-ir/chained-batch.test.ts:8`, `test/skeleton/reserved-lifecycle-names.test.ts:13`,
`test/skeleton/dry-run-accessor.test.ts:11`, `test/skeleton/read-trichotomy.test.ts:10`
— **none of these ~85 deep-import sentinel files import `defineFactory` from
`./testing`**. This CONFIRMS design's premise: S-006's `./testing` export removal
cannot force a diff in the frozen-set sentinel files, because they never went through
that facade in the first place. **Contrast with §13**: the 4 harness consumer files
DO currently import through `./testing` — they are the ones that must convert (§13),
not the sentinels.

## 16b. DISCREPANCY — REQ-ATH-20.1's "literal token `defineFactory(`" scan is vacuously green today

`specs/author-test-harness/spec.md:256` (REQ-ATH-20.1, added V2): "WHEN each file is
scanned for the literal token `` `defineFactory(` `` THEN zero occurrences are found."
**Verified this is already true, right now, before any migration work**:
`rg -no "defineFactory\(" test/fixtures/author-emulation/factory.ts` → exactly ONE
match, and it is inside a comment (`:2`, `` `defineFactory({packageDir})` throughout ``
prose). Every REAL call site uses the GENERIC form `defineFactory<Input>(` — the `<`
sits between the identifier and the `(`, so the literal substring `defineFactory(`
never appears at a call site today, wrapped or not. **If the executor implements
REQ-ATH-20.1's check exactly as worded, it is a no-op fitness function that passes
whether or not the migration happens** — the same trap FIT-16's OWN 3rd-signal comment
already warns about (`fit-16-reserved-name-scan.test.ts:22-28`: "Anchored on the bare
identifier, NOT `defineFactory(`... a literal `defineFactory(` substring would never
match a typed call and silently never flag anything"). **Fix**: scan for the bare
identifier `defineFactory` (matching FIT-16's own established convention), not the
`defineFactory(`-with-paren substring, when implementing whatever check backs REQ-
ATH-20.1 (likely inside S-004's fixture-conversion verification, not a new fitness
file — design does not assign REQ-ATH-20.1 a dedicated FIT-number). This is a spec
wording defect, not a design defect — design.md itself never uses the literal-paren
form for this scan. Flag to the orchestrator; does not block this slices revision, but
DOES need a decision before S-004's acceptance test is written (write it against the
bare identifier, not the literal wording).

## 17. Commons signatures — unaffected by this migration

`src/commons/index.ts` verb signatures (`scaffold`, `copyIn`, `create`) are UNCHANGED
by this migration — only their JSDoc's `defineFactory({ packageDir })` mentions
(§14 table) reword. The verbs still read anchors via `currentContext()` +
`requirePackageAnchors()` (`src/core/context.ts:80-102`), which is itself untouched.

## 18. `expander.ts`/`scaffold/index.ts` — no behavioral change, message-only

Both files' orchestration logic (`walk → filename-pipeline → classify → emit`,
`readTemplateFile`, `runCopyIn`) is untouched by this migration — S-002's only edit to
either file is the `noResolutionAnchorMessage`/`noResolutionAnchorForCopyInMessage`
string bodies (§14 table), never their call structure or the `requirePackageAnchors`
call sites themselves.

## 19. Product rulings (settled — do not re-open)

- **Ruling #5 (owner, this session) — the hard cut is ATOMIC, non-negotiable.** No
  dual-shape window: `defineFactory` is never simultaneously importable from
  `./testing` AND absent. S-006's "Requires: ALL of S-001..S-005 complete" gate is this
  ruling's structural enforcement — do not relax it to allow a partial/parallel export
  window "to de-risk the final slice". Zero external authors exist (0.x, unpublished),
  so there is no compatibility cost to paying this atomically.
- **Ruling #6 (owner, signed spec V1, ADR-C) — the untyped/no-`packageDir` path is a
  PERMANENT contract, not a temporary shim.** REQ-TFO-02 (bare `defineFactory(fn)`
  byte-for-byte unchanged) relocates to REQ-ATH-17.2 under the new caller-anchored
  shape but is not deprecated, sunset, or flagged for removal — it is the intentional
  "escape hatch" tier for factories with no schema-derived validation needs, permanently
  alongside the opted-in tier. Do not add deprecation warnings, `@deprecated` JSDoc
  tags, or TODO-remove comments to this path during S-000/S-002.
- **Scope reconciliation (verify-plan-1 gap #1)**: `in_scope` names "FIT-09/FIT-14
  baseline updates" — this wording is STALE and out of sync with design. Both FIT-09
  (`test/fitness/fit-09-pkg-exports-resolution.test.ts`, REQ-PKG-01 — asserts the
  `package.json#exports` map SHAPE: which SUBPATHS the package exposes and which dist
  file each maps to) and FIT-14 (`fit-14-package-surface.test.ts` — package-surface
  exports/deps/files/bin baseline, KEY-LEVEL) are correctly UNTOUCHED by this
  migration: this change removes no SUBPATH (`./testing` still exists, still maps to
  `dist/testing/index.js`) and adds no dependency — it only narrows which NAMED
  symbols `./testing` exports internally, which is FIT-08's (not FIT-09's or FIT-14's)
  territory. Any slice that finds itself editing `package.json#exports`,
  `pkg-surface-baseline.json`, or FIT-09's expected subpath list for this change
  should treat that as a design smell and halt for re-triage rather than proceeding.
  The REAL guards enforcing this migration's surface changes are **FIT-08** (the
  `./testing` VALUE allowlist narrowing, §9) and **FIT-04** (the `.d.ts` diff, §13) —
  both already covered by S-006's acceptance criteria and REQ-TES-03/REQ-TES-05. No
  slice or REQ change is warranted; this is a scope-wording correction only, recorded
  here so the orchestrator can close gap #1 without a spec edit.

---

## §20. Iteration-2 Resolutions Addendum (orchestrator, 2026-07-14 — supersedes any conflicting note above)

**R-1 (Judge B Q1)**: Spec V2 is SIGNED (owner, 2026-07-14). §0 updated. Apply unblocked pending `ready`.

**R-2 (Judge B Q2/Q3 — the executor's real input surface)**: The `sdd-apply` launch inputs INCLUDE the signed spec V2 (`specs/*/spec.md` — the Given/When/Then scenario text IS the acceptance detail) and `design.md` (File Changes §4.2, Flow Changes §4.2b, Test Derivation §4.6, Fitness §4.7, Migration §4.8). These documents are withheld only from the plan-verify judges by protocol, never from the executor. The apply agent MUST read both before the first line of code.

**R-3 (Judge B Q4 — scratchFactoryRunner, RULED)**: `scratchFactoryRunner` STAYS a direct `defineFactory` caller. Rationale: it is test-support infrastructure under `test/**` (outside FIT-29's production-only scan by construction), it is precisely the manual-wrap driver class ADR-C sanctions for reference paths, and routing it through `runFactoryForTest` would recurse the harness under test. S-004 converts its CONSUMERS' exported factories to bare; the runner itself keeps wrapping internally — consistent with the single-wrap-seam (one implementation, `defineFactory`, called directly by test-side drivers).

**R-4 (Judge B Q5 — ATH-20.1 oracle, RESOLVED)**: The spec was amended post-signature (semantic intent unchanged, owner informed): the scan oracle is the bare identifier `defineFactory` with word-boundary match, imports included, whole-file scope (28 `export const run*` bindings in author-emulation + 1 typed-factory). NEVER the substring `defineFactory(` (vacuously zero pre-migration — the §16b finding). Write S-004's acceptance test to the identifier form. §16b's "needs a decision" is CLOSED by this ruling.

**R-5 (Judge B Q6 — test commands + sentinel mechanism)**: Runner: Bun. `bun test` (full suite), `bun test <path/to/file.test.ts>` (single file — the TDD red/green unit), `bun run typecheck` (`tsc --noEmit`), `bun run build` (two-step tsc + bun build, needed by pack/link e2e legs). Regression-sentinel manifest: executed at `sdd-verify` (in-loop and final), NOT a committed test — `git diff --name-only <merge-base main...HEAD> -- test/golden-ir test/core test/conformance test/dialects` must be empty, plus a hunk-range check that no diff touches `src/core/context.ts:293-346` (JSDoc `:250-292` is legitimately editable). The ~85 deep-import files are covered by the four directory globs above plus `test/fake/commit-discard.test.ts`-class files listed in §16.

**R-6 (Judge B Q7 — @param seed regex, RULED)**: The seed JSDoc moves to the options-bag form `@param options.seed`. The pre-existing FIT-06 assertion `toMatch(/@param\s+seed\b/)` (REQ-TSD-02.1 leg) is updated IN S-002 to `/@param\s+options\.seed\b/` — `test/fitness/fit-06-example-jsdoc.test.ts` is already in the legitimately-edited set (§8b), and the regex update ships in the same slice as the JSDoc rewrite so the guard never goes green-on-stale or red-on-correct.

**R-7 (Judge A — FIT-09/14 triage wording)**: `triage.md`'s in_scope line now carries the reconciliation inline (see triage.md — orchestrator annotation 2026-07-14). §19's reconciliation stands.

**R-8 (Judge A — REQ-TSD-05 traceability)**: S-003's `Covers:` line now cites REQ-TSD-05.1-.3 explicitly, including the dry-run fence-compile leg.
