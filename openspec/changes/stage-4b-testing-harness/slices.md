# Slices: Stage 4b — Testing Harness

**Triage**: L · **Spec**: V3 signed · **Design**: rev 4 · **Total slices**: 7 (1 skeleton +
5 SPIDR, 1 gated). **Revision**: 4 (iteration-3, owner-ratified: S-000 merge-gate marker 4
swapped from ADR-promotion [archive-state] to `src/core/schema/` + `#bin` [merge-state];
ADR-promotion check moved to S-006's archive gate; owner sequencing confirmation recorded).
Rev 3 (iteration-2 citations: ATH-13.1 REQ-AEC-09 literal
source path in S-006; dts-baseline snapshot mechanics in S-003). Rev 2 (iteration-1 gaps: operational stage-4
precondition markers checked at /build launch, S-001 facade-contract load-bearing literals,
FIT-17 build mechanics inlined, FIT-08 umbrella-wildcard exemption synced from design rev 4,
qualifying-line ownership clarified — stage-4 writes it, 4b only reverts).
**/build deliverable = S-000..S-005.** S-006 is deferred-blocked
(built later via `/build --scope=slice:S-006` once `stage-4-typed-options` archives +
its `context.ts`/exports-baseline state is confirmed). S-000..S-005 have **zero
Stage-2 dependency** and, per design §4.8, build strictly AFTER `stage-4-typed-options`'s
IMPLEMENTATION merges (see the operational precondition below — expected-unmet on the
planning base).
**Test**: `bun test <path>` · full `bun test` · types `bunx tsc --noEmit` · build
`bun run build` (needed by FIT-04/FIT-17/e2e via the shared build fixture).

## Executor Context (mandatory)

> Handoff-plumbing appendix (stage-2/stage-4 house pattern; exempt from the ≤800-word slice
> budget). Judge B simulates executing from this file alone.

### Stage-4 merge precondition — OPERATIONAL (design §4.8, binding; GAP-1)

**Status on this planning base: EXPECTED-UNMET.** Only stage-4's PLANNER artefacts are
merged today; its implementation is still on `feat/stage-4-typed-options`, unmerged. This is
NOT a slicing defect — the check runs **AT `/build` LAUNCH TIME**, never at plan time.

At `/build` launch, verify ALL of these concrete markers on the build base (all four are
MERGE-state evidence — stage-4 implementation files in the merged tree; archive-state
evidence like ADR promotion belongs to S-006's gate, never here):

1. `src/core/context.ts` declares `defineFactory<O>(fn, options?: { packageDir })` AND
   carries an `@example` JSDoc block on `defineFactory`.
2. `test/fitness/fit-14-package-surface.test.ts` AND `test/fitness/pkg-surface-baseline.json`
   exist (stage-4-created files).
3. `package.json#exports` reflects stage-4's merged state.
4. Stage-4's `src/core/schema/` module exists AND `package.json#bin` declares
   `pbuilder-codegen` (stage-4 S-000-created implementation, per its slices/design §4.2).

Any marker absent → HALT `stage-4-precondition-missing`; do not silently build against an
unmerged base. This precondition is DISTINCT from S-006's gate: this one requires stage-4's
implementation MERGED (gates S-000), S-006's requires stage-4 ARCHIVED (+ qualifying-line
present to revert) and is checked at S-006's start only.

**Owner sequencing confirmation — answered-of-record (2026-07-10)**: S-000..S-005 start
ONLY once `feat/stage-4-typed-options` merges to main (the four markers above + halt
`stage-4-precondition-missing` are the enforcement); S-006 additionally waits for stage-4's
ARCHIVE.

### Mandatory reading list (read BEFORE any slice)

1. `openspec/changes/stage-4b-testing-harness/spec.md` + all 4 `specs/*/spec.md` (scenario texts — this file is build ORDER, those are build CONTENT)
2. `openspec/changes/stage-4b-testing-harness/design.md` — esp. §4.2 (File Changes), §4.3 (Data Model), §4.4 (Interface Contracts), §4.5 (ADRs), §4.6/4.6a/4.6b (Test Derivation, shared-build, ATH-11 scoping), §4.8 (sequencing)
3. `openspec/decisions/0009-two-audiences-contributor-kit.md` — the boundary ADR-0033 amends
4. `test/support/contract-fake.ts`, `test/support/rejection-messages.ts`, `test/support/spy-client.ts` — exact APIs being relocated/mirrored
5. `src/core/context.ts` (`defineFactory`), `src/core/wire.ts` (`Batch`/`Directive`) — origin declarations FIT-06's cascade reaches
6. `test/fitness/fit-08-no-kit-bleed.test.ts`, `fit-10-engine-client-port-guard.test.ts`, `fit-09-pkg-exports-resolution.test.ts`, `fit-04-dts-semver-gate.test.ts`, `fit-06-example-jsdoc.test.ts`, `fit-07-no-tree-in-core.test.ts` — every fitness file this change modifies
7. `test/e2e/author-to-tree.e2e.test.ts` — the existing pyramid e2e; mirror its driving shape for the new installed-consumer e2e

### RED-posture taxonomy (definitions, reused from stage-4)

- **[must-fail-first]** — write the test, watch it fail for the right reason, then implement.
- **[characterization]** — pins already-intended behavior; RED waived with justification.
- **[permanent-fixture]** — a planted red-proof that stays in the suite forever (e.g. FIT-17's
  positive control, FIT-18's parity red-proof, FIT-08's wildcard fixture).

### Load-bearing literals (copied exactly — do not paraphrase)

- **Containment marker**: `CONTRACT_FAKE_PREFIX` — imported from `rejection-messages.ts`, NEVER re-hardcoded in FIT-17.
- **FIT-10 allow-list value**: EXACTLY the string `src/testing/contract-fake.ts` (never a `src/testing/**` glob).
- **dts negative scan**: `dist/testing/index.d.ts` MUST NOT match `\b(EngineClient|EmitRejection)\b` (FIT-04 companion assert).
- **e2e install hardening**: `bun install --ignore-scripts` + `BUN_CONFIG_REGISTRY=http://127.0.0.1:9` (non-routable) in a `.tmp-testing-e2e/` scratch dir at repo root; repo-lockfile hash UNCHANGED before/after; `afterAll` always `rm -rf` scratch+tarball.
- **RunResult shape**: `{ tree: ReadonlyMap<string,string>; emitted: Batch[]; error: AuthoringError | unknown }` — `tree` = `committedTree()` verbatim, seed NEVER included; `error` = `undefined` on success, the caught thrown value VERBATIM (no re-wrapping) on rejection; `emitted` = one `Batch` per `emit()` call, call order.
- **Facade signature/param name**: `runFactoryForTest<O>(factory, input, seed?)` — first param named `factory` (author vocabulary), frozen by FIT-04; `factory` = the RUNNER `defineFactory` returns (`(o, { client }) => Promise<void>`), never the raw fn; the caller never passes a client (harness builds fake + `RecordingClient` internally; `seed` → `ContractFakeOptions.seed`).
- **ATH-13 interim shape (stage-4 Option A carry-over)**: opted-in rejection throws a **plain `Error`** (never `AuthoringError`) with the stage-4-pinned REQ-AEC-09 message literal; `result.error` observed as `unknown`; `instanceof AuthoringError`/`reason` only assertable post stage-4 S-006.
- **FSP mechanism**: reference-identity (`===` on the class / value equality on constants) — never a behavioural parity suite.
- **Numbering**: FIT-17 (dev-only bundle), FIT-18 (fake parity) — next free after stage-4's FIT-16. ADRs 0033–0036 — next free after stage-4's 0031.

### Binding constraints (verbatim — violating any is a slicing/build defect)

1. `src/testing/index.ts` MUST NOT name `EngineClient`/`EmitRejection` — spy-wrapping via the local structural `RecordingClient` interface only (REQ-TES-07).
2. FIT-08's per-path allowlist relaxes ONLY the kit-symbol/`../core`-re-export ban; `RunResult` (locally declared) stays OUTSIDE FIT-08's universe and needs no allowlist entry — it joins FIT-06's `@example` scope instead.
3. Wildcard ban by form (SEC-M1, design rev 4): on every scanned path, ANY `export *`/`export * as` statement is a violation regardless of specifier — with ONE specifier-exact grandfathered exemption: `src/index.ts`'s umbrella `export * from "./commons/index.ts"`. Everything else stays banned by form.
4. FIT-07's glob stays PINNED to `src/core/**` — never widened to `src/testing/**`.
5. `test/support/shared-build.ts` (`ensureTscBuild`, `ensureMinifiedEntry`) is created ONCE (S-000) and reused by every consumer (S-003's FIT-04/FIT-17, S-004's e2e) — no slice re-triggers its own `bun run build`.
6. No slice besides S-006 may assert `instanceof AuthoringError`/`origin`/exact `reason` for an opted-in rejection.
7. Every slice leaves the suite GREEN and `tsc --noEmit` CLEAN at its boundary.

---

## S-000: Walking Skeleton — Fake Relocation + Installed-Consumer Spike

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing
**Covers**: TES-07(.1-.3, FIT-10 transition — full), groundwork for FSP-01/02/03 and TES-01/02/06 (formally closed in S-002/S-003/S-004)

**Acceptance**: GIVEN the relocated `ContractFake`/`rejection-messages` under `src/testing/`
WHEN the full existing suite (~25 importers + FIT-11) runs THEN it stays GREEN through the
old-path shims; GIVEN the built, packed, scratch-installed tarball WHEN a script imports
ONE symbol (`defineFactory`) from `@pbuilder/sdk/testing` by name THEN it resolves.

### Tasks
- [x] [must-fail-first] git-move `contract-fake.ts` + `rejection-messages.ts` into `src/testing/`; shim both old `test/support/` paths as pure re-exports
- [x] `fit-10-engine-client-port-guard.test.ts` Modify — allow-list transition to `src/testing/contract-fake.ts` (constraint: exact string, never a glob)
- [x] `src/testing/index.ts` Create (minimal) — re-export `defineFactory` (value) only; no `RunResult`/`runFactoryForTest` yet
- [x] `package.json#exports` Modify — add `./testing`
- [x] `openspec/decisions/0035-fake-relocation-parity-by-identity.md`, `0036-packed-tarball-e2e-lifecycle.md` Create (drafts, from design §4.5)
- [x] `test/support/shared-build.ts` Create — `ensureTscBuild()` memoized per-process
- [x] [must-fail-first] `test/e2e/installed-consumer.e2e.test.ts` Create (spike only) — build→pack→`.tmp-testing-e2e/` install (`--ignore-scripts`, non-routable registry)→import `defineFactory` by name, assert resolution
- [x] Full suite green + `tsc --noEmit` clean proof

**Executor deviation note (binding constraint #7 compliance)**: two extra fitness files
needed a same-slice update beyond this card's literal list, both because adding
`package.json#exports["./testing"]` and `src/testing/index.ts` necessarily changed observable
surface those guards pin exactly — leaving either unpatched would have left the suite RED at
this slice's boundary, violating "every slice leaves the suite GREEN" (constraint 7):
1. `test/fitness/fit-09-pkg-exports-resolution.test.ts` — widened the exact-keys assertion
   3→4 (`./testing` added) + a new dedicated `./testing` shape assertion. This is nominally
   S-003's TES-01 row, but the exports-map edit that trips it happens HERE — same precedent
   §4.8 already sets for FIT-14 ("regenerated in the SAME slice as the package.json exports
   edit"). S-003's own fit-09 task is now a verify-and-skip.
2. `test/fitness/fit-14-package-surface.test.ts` + `pkg-surface-baseline.json` — regenerated
   per §4.8's explicit same-slice instruction (the row is duplicated on S-006's task list;
   that duplicate is now a verify-and-skip too — S-006 makes no further package.json/exports
   edit that would re-trigger this baseline).

---

## S-001: Harness Result Contract — Commit/Reject/Throw/Seed Paths

**Scope**: happy-path · **Dimension**: P (Path) · **Requires**: S-000
**Covers**: ATH-01(.1,.2), ATH-02(.1), ATH-03(.1,.2), ATH-04(.1,.2), ATH-05(.1), ATH-06(.1), ATH-07(.1,.2), ATH-08(.1), ATH-09(.1,.2), ATH-10(.1)

**Acceptance**: GIVEN a write-only factory WHEN run THEN `result.tree` contains the write
(founding bug, ATH-02); GIVEN a colliding multi-directive batch WHEN run THEN `result.tree`
is empty and `result.error` is attributed (ATH-03); GIVEN a seeded read WHEN run THEN the
seed is readable but excluded from `result.tree` (ATH-04); GIVEN a factory throw WHEN run
THEN the cause is preserved unmodified (ATH-06); GIVEN two sequential/concurrent calls THEN
no cross-call state leaks (ATH-07); GIVEN a verb invoked via an escaped callback outside the
run THEN it still throws (ATH-08).

**Facade contract (load-bearing — copied exactly, GAP-2/3)**:
- Signature: `runFactoryForTest<O>(factory, input, seed?)` where **`factory` is the RUNNER
  returned by `defineFactory`** (signature `(o: O, { client }) => Promise<void>`) — NOT the
  raw author fn.
- The harness constructs the relocated `ContractFake` + a local structural `RecordingClient`
  INTERNALLY (spy-style, mirrors `test/support/spy-client.ts`'s `makeSpyClient`) — the
  caller NEVER passes a client. `seed` feeds the fake's `ContractFakeOptions.seed`.
- `RunResult` runtime semantics: `error` is `undefined` on success and the caught thrown
  value VERBATIM on rejection — no re-wrapping (ATH-06's cause-chain preservation depends
  on it); `tree` = `committedTree()` only (seed never included); `emitted` = one `Batch`
  per `emit()` call, in call order.

### Tasks
- [x] `src/testing/index.ts` Modify — elaborate to full `runFactoryForTest<O>(factory, input, seed?)` + `RunResult` per the facade contract above; local `RecordingClient` structural type (never names `EngineClient`)
- [x] [must-fail-first] `test/fake/harness-result.test.ts` Create — ATH-01/02/03/04/05/06/07/09/10
- [x] [must-fail-first] escaped-callback outside-run scenario (ATH-08)
- [x] ~4 MiB batch-cap fixture (ATH-09.2) + non-JSON-safe value reject (ATH-09.1)
- [x] unrendered-template non-promise assertion (ATH-10)

**Executor deviation note (binding constraint compliance)**: FIT-10's port-symbol scan is a
textual regex over the WHOLE source (comments included), not just code — the facade's
header comment originally spelled out the kit's port-interface/rejection-value type names in
prose to explain the structural-typing rationale, which FIT-10 flagged as a violation even
though no code referenced them. Reworded the comment to describe the mechanism without
spelling those identifiers, per binding constraint #1 (`src/testing/index.ts` MUST NOT name
them) — this constraint turned out to bind on the WHOLE file text, not just import/usage
sites. No spec/design impact; the fix is a comment-only edit, `src/testing/index.ts` diff
scope unchanged.

---

## S-002: Harness Isolation, No-Leak & Fake-Parity Invariants

**Scope**: happy-path · **Dimension**: R (Rule) · **Requires**: S-001
**Covers**: ATH-11(.1), ATH-12(.1,.2), FSP-01(.1), FSP-02(.1), FSP-03(.1), FSP-04(.1)

**Acceptance**: GIVEN a full-verb run WHEN instrumented on `fs`/`net`/`env`/`argv` THEN zero
calls/gets for the run's duration (ATH-11.1, non-opted-in); GIVEN `result.error`/report
output WHEN scanned THEN no engine-internal text leaks, author content is not
false-flagged (ATH-12); GIVEN the two `ContractFake` paths WHEN compared THEN they resolve
to the SAME reference (FSP-02) and a re-declared-body regression fails closed (FSP-04).

### Tasks
- [ ] [must-fail-first] `test/fake/harness-in-memory-invariant.test.ts` Create — spies on `node:fs`/`node:net`/`Bun.write/file/spawn/$/connect`/`fetch` + Proxy traps on `process.env`/`process.argv`
- [ ] [must-fail-first] `test/fake/harness-leak-scan.test.ts` Create — ATH-12.1/.2 (leak + author-content exemption)
- [ ] [must-fail-first] [permanent-fixture] `test/fitness/fit-18-fake-single-source-parity.test.ts` Create — FSP-01 single-source, FSP-02 `===` identity, FSP-03 dictionary single-source, FSP-04 red-proof (re-declared shim body fails)

---

## S-003: Entry-Surface Containment Guards

**Scope**: happy-path · **Dimension**: R (Rule) · **Requires**: S-001
**Covers**: TES-01(.1), ATH-01(.3), TES-03(.1-.4), TES-04(.1-.4), TES-05(.1,.2)

**Acceptance**: GIVEN the built `.`/`./commons`/`./conformance` entries WHEN minified THEN
`CONTRACT_FAKE_PREFIX` is ABSENT; GIVEN the `./testing` entry THEN it is PRESENT (positive
control, TES-04); GIVEN a facade using `export * from "./contract-fake.ts"` WHEN scanned
THEN FIT-08 flags it (SEC-M1 red-proof, TES-03) — while `src/index.ts`'s grandfathered
umbrella `export * from "./commons/index.ts"` (specifier-exact exemption, design rev 4)
stays green; GIVEN `dist/testing/index.d.ts` THEN it carries the `testing.index` baseline
pair and never matches `EngineClient`/`EmitRejection` (TES-05).

**FIT-17 mechanics (load-bearing, GAP-7)**: `ensureMinifiedEntry(entry)` =
`bun build <entry> --target=node --minify` (FIT-03 idiom — see
`test/fitness/fit-03-*.test.ts` lines ~35-56), run over the FOUR source entries
`src/index.ts`, `src/commons/index.ts`, `src/conformance/index.ts`, `src/testing/index.ts`;
the marker literal is sourced STRUCTURALLY from `rejection-messages.ts`
(`CONTRACT_FAKE_PREFIX` import), never re-hardcoded.
**dts baseline mechanics (rev 3)**: `test/fitness/dts-baseline/testing.index.d.ts` is a
COMMITTED SNAPSHOT of the built `dist/testing/index.d.ts` produced by the shared
`ensureTscBuild()` build — generated once in this slice, regenerated only manually under
the repo's one-line-diff discipline (FIT-04 idiom, lessons-learned). First-run green is
expected (baseline == current); the gate protects FUTURE changes.

### Tasks
- [ ] `test/fitness/fit-08-no-kit-bleed.test.ts` Modify — per-path allowlist data model (`SCANNED` array) + wildcard-ban-by-form (with the specifier-exact `src/index.ts` umbrella exemption) + red-proof fixture; ATH-01.3 (`ContractFake` not exported by name) red-proof
- [ ] `test/fitness/fit-09-pkg-exports-resolution.test.ts` Modify — 3→4 keys incl. `./testing`; `./core` still absent (TES-01)
- [ ] [must-fail-first] [permanent-fixture] `test/fitness/fit-17-testing-dev-only-bundle.test.ts` Create — 4-entry minified scan per the FIT-17 mechanics block above (via shared-build's `ensureMinifiedEntry`); absence + positive-control presence + `sideEffects`-absent assert
- [ ] `test/fitness/fit-04-dts-semver-gate.test.ts` Modify — add `testing.index` dts pair (`test/fitness/dts-baseline/testing.index.d.ts` Create) + negative declaration-scan companion assert; consume `shared-build`; update W7 header comment
- [ ] `test/fitness/fit-07-no-tree-in-core.test.ts` Modify — de-stale "not in dist" comment; assert glob stays `src/core/**`
- [ ] `openspec/decisions/0034-shipped-fake-containment.md` Create (draft, from design §4.5)

---

## S-004: Installed-Consumer-Vantage e2e — Founding-Bug Proof

**Scope**: happy-path · **Dimension**: I (Interface) · **Requires**: S-001
**Covers**: TES-02(.1), TES-06(.1,.2,.3)

**Acceptance**: GIVEN the scratch-installed tarball WHEN the consumer imports
`@pbuilder/sdk/commons` and `@pbuilder/sdk/testing` by name THEN both resolve and
`@pbuilder/sdk/core` fails to resolve (TES-02/06.1); GIVEN a write-only factory run through
the installed `runFactoryForTest` THEN `result.tree` matches the golden tree (TES-06.2,
founding bug); GIVEN a colliding-without-force factory THEN `result.tree` is empty and
`result.error` is assertable as `AuthoringError` via the installed package's own exported
type (TES-06.3).

### Tasks
- [ ] `test/e2e/installed-consumer.e2e.test.ts` Modify — elaborate the S-000 spike into TES-02.1 (resolution matrix) + TES-06.1/.2/.3 (founding-bug scenarios)
- [ ] golden committed-tree fixture (write-only factory) + colliding-batch fixture (all-or-nothing rejection)
- [ ] assert consumer-side `AuthoringError` narrowing via the installed package's own export

---

## S-005: Positive Testing-Story Documentation

**Scope**: happy-path · **Dimension**: R (Rule) · **Requires**: S-001
**Covers**: TSD-01(.1-.4), TSD-02(.1-.3), TSD-04(.1)

**Acceptance**: GIVEN the README testing section WHEN its example is extracted THEN it is
copy-runnable (TSD-01.1) and states the 0.x exemption + `./testing`-vs-`./conformance`
boundary (TSD-01.2-.4); GIVEN `src/testing/index.ts`'s JSDoc WHEN scanned by FIT-06 THEN
`@example` includes a rejection assertion with `instanceof AuthoringError`, `@param seed` is
documented, and the cascade reaches `defineFactory`/`Batch`/`Directive` origins (TSD-02);
GIVEN ADR-0009's amendment stub THEN it cross-references ADR-0033's third-audience text
(TSD-04). The docs tests assert **TOKEN-LEVEL strings** (design rev 4 §4.6 pins the token
set), not whole-sentence prose matches. **Qualifying-line boundary (GAP-6)**: this slice
does NOT write or touch the README incremental-shipping qualifying line — stage-4's OWN
S-005 writes it; 4b only REVERTS it, in S-006, after stage-4 archives.

### Tasks
- [ ] `README.md` Modify — testing section (copy-runnable example + seeded-read worked example + boundary + 0.x sentence); qualifying line untouched
- [ ] `src/core/wire.ts` Modify — `@example` on `Batch`/`Directive` origin decls (FIT-06 cascade)
- [ ] `test/fitness/fit-06-example-jsdoc.test.ts` Modify — `PUBLIC_PATHS` += `src/testing/index.ts`; `RunResult` in scope; stability-language assert
- [ ] [must-fail-first] `test/docs/testing-story-docs.test.ts` Create — TSD-01/02/04 copy-runnable + TOKEN-LEVEL text asserts (design rev 4 §4.6 token set)
- [ ] `openspec/decisions/0009-two-audiences-contributor-kit.md` Modify (amendment stub) + `0033-third-audience-author-testing.md` Create (draft)

---

## S-006: Opted-In Factory Support + Sequenced Reverts (GATED)

**Scope**: edge-case · **Dimension**: R (Rule) · **Requires**: S-002, S-005 — BLOCKED on
`stage-4-typed-options`'s merged `context.ts` shape (`defineFactory(fn, { packageDir })`,
ADR-0029) being present in the base AND its `@example` existing (verify; ADD + flip this
row to Modify if absent, per design §4.2 fallback clause). NOT droppable.
**Covers**: ATH-11(.2), ATH-13(.1,.2), TSD-03(.1,.2)

**Acceptance**: GIVEN an opted-in factory's own `schema.json` read WHEN the ATH-11 invariant
runs THEN it is observed-not-flagged while every other I/O surface stays fail-closed
(ATH-11.2); GIVEN a schema-invalid input WHEN run through an opted-in factory THEN it
rejects all-or-nothing via `result.error` (plain-`Error` interim, ATH-13.1) and a
schema-valid input runs indistinguishably from a bare factory (ATH-13.2); GIVEN
`stage-4-typed-options` has archived THEN the README qualifying-line is reverted
(TSD-03) — else this row stays DEFERRED, registered as a followup, never silently dropped.
**Qualifying-line ownership (GAP-6)**: stage-4's OWN S-005 WRITES the line — its byte-exact
literal lives in the merged planner artefact
`openspec/changes/stage-4-typed-options/specs/factory-package-shape/spec.md` (REQ-FPS-05.4);
4b never writes it, only reverts it here.
**ATH-13.1 interim message literal — citation (rev 3)**: the "stage-4-pinned REQ-AEC-09
message literal" lives in the merged planner artefacts
`openspec/changes/stage-4-typed-options/specs/authoring-error-contract/spec.md`
(REQ-AEC-09 template table — e.g. `"invalid input: {field} must be {expectedType}"`);
its interim plain-`Error` shape is governed by
`openspec/changes/stage-4-typed-options/spec.md` § "Interim Behaviour
(pre-Stage-2-amendment)". ATH-13.1 asserts THAT literal + the fail-closed empties.

### Tasks
- [ ] **GATE** — verify stage-4 ARCHIVE evidence: `context.ts` carries `defineFactory(fn, { packageDir })` (ADR-0029) AND stage-4's ADRs 0027–0031 are promoted from DRAFT in `openspec/decisions/` (promotion happens at stage-4's `sdd-archive` — archive-state evidence, deliberately NOT in the S-000 merge-gate); if either is absent, HALT `stage-4-precondition-missing`
- [ ] `test/fixtures/harness-opted-in/schema.json` Create — `{ port: number }`
- [ ] [must-fail-first] `test/fake/harness-opted-in.test.ts` Create — ATH-11.2 (event-allowlist predicate scoping), ATH-13.1 (schema-invalid reject, plain-`Error` message + empty tree/emitted), ATH-13.2 (schema-valid happy path)
- [ ] `src/core/context.ts` — verify `@example`; ADD if absent (row flips to Modify) so FIT-06's cascade holds
- [ ] IF `stage-4-typed-options` archived: `README.md` — revert the REQ-FPS-05.4 qualifying line (TSD-03.1); ELSE register as a followup (TSD-03.2)
- [ ] `test/fitness/fit-14-package-surface.test.ts` Modify + `pkg-surface-baseline.json` Modify — regenerate with `./testing`

---

## Build Order

| Order | Slice | Note |
|---|---|---|
| 1 | S-000 | implicit blocker for all; relocation + spike prove the two riskiest mechanics |
| 2 | S-001 | requires S-000; full result contract |
| 3 | S-002, S-003, S-004, S-005 | each requires only S-001 — parallelizable (disjoint files); sequential single-pass acceptable |
| — (deferred-blocked) | S-006 | requires S-002 + S-005; GATED on `stage-4-typed-options` archive. Built later via `/build --scope=slice:S-006`. Not droppable. |

**/build deliverable = S-000..S-005.** The change does NOT reach `sdd-verify --mode=final`/archive until S-006 lands.

## Coverage Check

ATH 15(S-001)+3(S-002)+1(S-003)+3(S-006,gated)=22 · TES 3(S-000)+11(S-003)+4(S-004)=18 ·
FSP 4(S-002) · TSD 8(S-005)+2(S-006,gated)=10 → **54/54 scenarios across 28 REQ-IDs**, no
orphans. ATH-01 spans S-001 (.1,.2) + S-003 (.3 red-proof) — a staged completion, not a
duplicate. ATH-11 spans S-002 (.1) + S-006 (.2, gated). TSD-03 is fully gated (S-006).

## Anti-Pattern Check

No horizontal/layer-named slices — each names an author-observable capability (result
contract, isolation invariants, containment, installed-consumer proof, docs). Every slice
cites ≥1 REQ-ID. No two-SPIDR-dimension slice. 7 total (target 4-7 satisfied at the upper
bound, mirroring stage-4's own 7). No slice exceeds 2 declared dependencies.

## Upstream Publication

N/A — `spec_source: internal`, Step 8b skipped.
