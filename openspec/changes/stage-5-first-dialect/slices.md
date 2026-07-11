# Slices: Stage 5 — First Dialect: `modify` Becomes Real

**Triage**: L (owner-ruled thin scope) · **Spec**: V3 signed (7 domains, 34 REQ-IDs, 65
scenarios by direct count — see Coverage Check note) · **Design**: rev 2 · **Total slices**: 6
(1 guard + 1 skeleton + 4 SPIDR). **Revision**: 1 (initial).
**Test**: `bun test <path>` · full `bun test` · types `bunx tsc --noEmit` · build
`bun run build` (needed for FIT-04/FIT-14 dist-diffing tests).

## Executor Context (mandatory)

> Handoff-plumbing appendix, following the stage-2/stage-4 house pattern (plan-verify Judge B
> simulates executing from this file alone). The ≤800-word budget governs the slice blocks
> below (unchanged); this section is exempt — deviation noted, not silent.

### Sequencing deviates from the default S-000-is-the-skeleton convention (owner-ratified)

Per the orchestrator's ratified sequencing constraints (design §4.8, architect-corrected,
owner-signed): **S-000 is a GUARD slice (FIT-01 rebuild), not the walking skeleton.** The
skeleton is **S-001**. This is a deliberate deviation from `sdd-slice`'s normal "S-000 =
skeleton, implicit dependency for all" rule, made explicit here rather than silently
reinterpreted. S-001 does not hard-require S-000 (disjoint files, both buildable in parallel),
but **S-002 (ts-morph) requires BOTH S-000 GREEN and S-001 complete** — landing FIT-01's
transitive walk before any AST library enters `package.json` is load-bearing, not incidental
(REQ-FIT-01, design §4.8).

### The toy dialect (slice-level addition, not itemized in design's File Changes table)

Design's §4.2 file table goes straight to ts-morph — it does not name a toy/fixture dialect.
The ratified sequencing constraint requires proving the generic contract (`defineDialect`/
`defineOpPack`/`withOps`, the coalescing handle, the run-boundary join) BEFORE the risky
external dependency lands. Since `Handle<State,Ast,Ops>` is AST-type-agnostic by construction,
a toy dialect (`Ast = string[]`, `parse` = split-by-line, `print` = join-by-line, one `push`
op) is a legitimate, DESIGN-COMPLIANT instantiation of the same surface — this is a testing
strategy decision at the slicing level, not a design amendment. Toy-dialect files (new, not in
design's table): `test/fixtures/toy-dialect/index.ts`, `test/core/dialect-handle.test.ts`,
`test/e2e/toy-dialect-skeleton.e2e.test.ts`, `test/conformance/toy-dialect-smoke.test.ts`. The
toy dialect is discarded after S-001 proves the mechanism — it is NOT reused as the
conformance kit's real fixture (that's the REAL TypeScript dialect, S-004); it exists solely to
de-risk S-002's ts-morph landing.

### Mandatory reading list (read BEFORE any slice)

REQ-IDs resolve against these artefacts; **this file is the build ORDER, those are the build
CONTENT** (scenario texts live in the specs):

1. `openspec/changes/stage-5-first-dialect/specs/dialect-generics/spec.md`
2. `openspec/changes/stage-5-first-dialect/specs/modify-coalescing/spec.md`
3. `openspec/changes/stage-5-first-dialect/specs/typescript-dialect/spec.md`
4. `openspec/changes/stage-5-first-dialect/specs/dialect-conformance/spec.md`
5. `openspec/changes/stage-5-first-dialect/specs/dialect-authoring-standards/spec.md`
6. `openspec/changes/stage-5-first-dialect/specs/factory-package-shape/spec.md` (delta)
7. `openspec/changes/stage-5-first-dialect/specs/foundations-skeleton/spec.md` (delta)
8. `openspec/changes/stage-5-first-dialect/design.md` — esp. §4.1 (seam), §4.2/4.2b/4.2c (file/flow/arch changes), §4.3 (data model — `Handle<State,Ast,Ops>`, `DialectRegistry`), §4.4/4.4b (error taxonomy + frozen strings), §4.5 (ADRs 0033/0034 + amendments), §4.6 (Test Derivation), §4.7 (fitness), §4.8 (sequencing)
9. `src/core/define-dialect.ts` — current stub (thin, unparameterised `Op`/`OpPack`/`Dialect`) that S-001 rewrites to real generics
10. `src/core/context.ts` — the `defineFactory`/`RunContext`/`als` this change extends (S-001 adds `dialects: DialectRegistry` + pre-flush drain)
11. `src/core/session.ts` — `Session.read`/`buffer`/`flush`/`pendingSnapshot` — the ONLY read/write seam dialect code may touch (REQ-MC-03)
12. `src/core/base-handle.ts` + `src/core/handle-state.ts` — `ReadOps`/`WriteOps`/`WritableHandleRef` shapes the dialect `Handle` composes alongside
13. `src/conformance/index.ts` — current stub (`testDialect`/`testOpPack` throw) that S-004 fills in
14. `test/support/spy-client.ts` / `test/support/contract-fake.ts` — the `EngineClient` spy + fake every coalescing/e2e test drives (batch-`emit` spy pattern, `makeSpyClient(seed)`)
15. `test/fitness/fit-01-commons-no-ast.test.ts`, `fit-02-dialect-leaf-rule.test.ts`, `fit-06-example-jsdoc.test.ts`, `fit-08-no-kit-bleed.test.ts` — existing scanners S-000/S-002 extend (`PUBLIC_PATHS`/`KIT_SYMBOL_NAMES`/`AUTHOR_SUBPATHS` constants to update, not reinvent)

### Binding constraints (verbatim — violating any is a slicing/build defect)

1. **S-000 ordering gate (design §4.8, load-bearing).** `package.json#dependencies` MUST NOT
   gain `ts-morph` until FIT-01's transitive rebuild (S-000) is GREEN. S-002's first task is a
   halt-check confirming this.
2. **Toy dialect is throwaway, real dialect is not.** No slice past S-001 may import from
   `test/fixtures/toy-dialect/**` in production or conformance code — S-004's conformance
   fixtures target the REAL TypeScript dialect only (ADR-0012 amendment, ratified constraint 4).
3. **One error taxonomy, two proof sites.** The frozen-prefix contained-error wrapper
   (`"dialect operation failed: "` + structured tail, design §4.4) is implemented ONCE in
   `dialect-handle.ts` (S-001) and MUST NOT be reimplemented per-dialect; S-003's REQ-TSD-04
   restates the SAME contract against a REAL ts-morph parse failure, it does not add a new
   wrapper.
4. **Frozen guard strings (§4.4b) are copied verbatim.** The SECURITY.md `.raw()` sentence, the
   "conformance ≠ safety" caveat, and the two-realms hazard paragraph land byte-for-byte in
   S-005 — no apply-time paraphrasing.
5. **Flush-seed-rule applies to AST chains, toy or real (REQ-MC-04).** Every `find()`-only
   dialect-chain test — S-001's toy fixtures included — MUST pre-seed its target in
   `ContractFake`/the spy client; never treat it as a `create()` target.
6. **Same-path concurrency stays undefined, never asserted (REQ-MC-07).** Only the SEQUENTIAL
   awaited same-path case (cumulative split modifies) is asserted; no test may pin a specific
   last-write-wins outcome for concurrent unawaited same-path handles — that is DOCUMENTED UB,
   not a guaranteed contract.
7. **Content assertions, never count-only (QA mandate, `dialect-conformance` Theatre Criteria).**
   Every coalescing/split/conformance assertion (S-001, S-002, S-003, S-004) verifies BYTE-EXACT
   or content-diffed output against a committed golden — `instructions.length === N` alone never
   satisfies a REQ.
8. Every slice leaves the suite GREEN and `tsc --noEmit` CLEAN at its boundary; no broken
   intermediate states.

### RED-posture taxonomy (definitions — house convention, stage-2/stage-4)

- **[must-fail-first]** — write the test, watch it fail for the right reason, then implement.
- **[characterization]** — pins already-intended behavior; RED waived with justification.
- **[permanent-fixture]** — a planted red-proof that stays in the suite forever (e.g. FIT-01's
  transitive plant, FIT-17/18's orphan/join plants, `dialect-conformance`'s planted-violation
  suite).

### Load-bearing literals (copied exactly — do not paraphrase)

- **Frozen error prefix**: `"dialect operation failed: "` — tails: `raw() on "{path}" threw` ·
  `could not parse "{path}" as TypeScript` · `could not print "{path}"` ·
  `"{path}" does not exist — create it first in this run`. `.cause` MUST be `undefined`/absent.
- **Frozen subpath**: `@pbuilder/sdk/typescript` (exact — not `/ts`).
- **Frozen op signature**: `addImport(name: string, from: string)` — merges into an existing
  same-module named-import clause.
- **SECURITY.md `.raw()` sentence, "conformance ≠ safety" caveat, two-realms hazard**: verbatim
  strings from design §4.4b — copy exactly, asserted as exact substrings by the guard test.
- **`RunContext.dialects: DialectRegistry`** (`register(handle)`, `drain(): Promise<void>` —
  `allSettled`, re-throws the FIRST rejection, never surfaces `unhandledRejection`).

---

## S-000: Guard — FIT-01 Rebuilt as a Transitive Import-Graph Walk

**Scope**: edge-case · **Dimension**: — (pure fitness-function hardening, no user-visible
behavior — mirrors the skill's own "no-SPIDR-split" rule for internal guard rebuilds)
**Covers**: REQ-FIT-01 · **Requires**: nothing (parallelizable with S-001)
**Test layers**: fitness (unit-level static scan)

**Acceptance**: GIVEN `src/commons/leaf.ts` (no direct AST import) relatively imports
`src/commons/helper.ts`, which DOES import `ts-morph`, WHEN the scanner runs THEN it fails RED
(transitive planted red-proof) — proving the walk, not just direct-import scanning; the
existing direct-import checks (today's `fit-01-commons-no-ast.test.ts`) stay green.

### Tasks
- [x] [must-fail-first] Rewrite `fit-01-commons-no-ast.test.ts`'s scan from per-file direct
  specifiers to a relative-import-closure GRAPH WALK (allow-list = SDK `core` public symbols +
  Node/Bun builtins; any other import at ANY depth fails)
- [x] [permanent-fixture] Two-file planted fixture (`leaf.ts` clean, `helper.ts` importing
  `ts-morph`) proving the TRANSITIVE case the old scanner could not see
- [x] Confirm the three existing red-proofs (direct ts-morph, builtins pass, `../core` passes)
  still hold under the new walk

---

## S-001: Walking Skeleton — Generic Contract, Toy Dialect, Coalescing, Run-Boundary Join

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing (S-000 gates S-002, not
this slice)
**Covers**: DG-01(.1,.2), DG-02(.1,.2,.3), DG-03(.1,.2), DG-05(.1,.2), MC-01(.1,.2),
MC-02(.1,.2,.3), MC-04(.1), MC-05(.1), MC-06(.1), MC-07(.1) — plus ADR-0034
**Test layers**: type-level + unit + one e2e smoke (toy dialect)

**Acceptance**: GIVEN a toy dialect built via real `defineDialect`/`defineOpPack`/`withOps`
WHEN an author chains `push(x).raw(f)` with no read THEN exactly one `modify` (byte-exact);
WHEN a mid-chain `.read()` occurs THEN exactly two `modify`s, cumulative, no edit lost; WHEN the
handle is never `await`ed THEN the run-end join still commits it; WHEN a `.raw()` callback
throws THEN the run rejects with the frozen-prefix `Error`, no `unhandledRejection`, `.cause`
absent.

### Tasks
- [x] [must-fail-first] `src/core/define-dialect.ts` rewrite — real `Op<Ast>`/`OpPack<Ast>`,
  frozen `DialectDescriptor`, `Handle<State,Ast,Ops>` type (intersection via `withOps`,
  `PromiseLike<void>`), `.raw()` on the type surface (DG-01, DG-02, DG-03 type-level pins)
- [x] [must-fail-first] `src/core/dialect-handle.ts` (Create) — the coalescing handle factory:
  `#tail` promise-queue chaining, read-through-parse via `Session.read` ONLY, `ensureOpen()`
  re-registration (identity check against `pendingSnapshot()`), memoized lazy `content` getter,
  the frozen-prefix contained-error wrapper (constraint 3), self-registration into
  `RunContext.dialects`
- [x] [must-fail-first] `src/core/context.ts` Modify — `RunContext.dialects: DialectRegistry`;
  `defineFactory` drains it (`allSettled`, first-rejection re-throw) BEFORE `session.flush()`,
  routing through the EXISTING discard+re-throw catch (no new catch path)
- [x] `openspec/decisions/0034-coalescing-seam-handle-owned.md` (Create) — ADR-0034 verbatim
  per design §4.5 — LANDED AS ADR-0037 (renumbered; 0033-0036 were claimed by
  stage-4b-testing-harness on main in the interim — see file header)
- [x] `test/fixtures/toy-dialect/index.ts` (Create, slice-level addition) — `Ast = string[]`,
  `parse`/`print` by newline join/split, one `push` op, composed via real `defineDialect`/
  `withOps`
- [x] `test/core/dialect-handle.test.ts` (Create) — MC-01/02/04/05/07 against the toy dialect,
  spy-on-`emit` batch inspection (constraint 7); flush-seed-rule honored (constraint 5)
- [x] [must-fail-first] `test/fitness/fit-17-coalescing-orphan-guard.test.ts` (Create) —
  drained-handle re-registration red-proof — LANDED AS `fit-19-coalescing-orphan-guard.test.ts`
  (renumbered; fit-17/18 were claimed by stage-4b-testing-harness on main)
- [x] [must-fail-first] `test/fitness/fit-18-unawaited-join-guard.test.ts` (Create) — MC-06
  happy+throwing unawaited cases; red-proof removes `dialects.drain()` — LANDED AS
  `fit-20-unawaited-join-guard.test.ts` (renumbered, see above)
- [x] `test/types/define-dialect.test.ts` Modify — DG-01.1 fifth-field compile error, DG-02.1
  attached-only `expectTypeOf` negative pin, DG-02.3 standalone `defineOpPack`, `.raw`
  presence, thenable-handle type
- [x] `test/e2e/toy-dialect-skeleton.e2e.test.ts` (Create, slice-level addition) — ONE smoke
  driving the toy dialect outside-in against `ContractFake`; `test/conformance/toy-dialect-smoke.test.ts`
  (Create) proves `testDialect`/`testOpPack` are CALLABLE against the toy fixture (signature
  smoke only — constraint 2, never DC-01..05 content assertions)

---

## S-002: The Real Dialect — ts-morph, `./typescript`, `addImport`

**Scope**: happy-path · **Dimension**: I (Interface — the same generic surface now exposed at a
new public subpath, backed by a real AST library instead of the toy one)
**Requires**: S-000 (GREEN), S-001
**Covers**: DG-04(.1), MC-03(.1,.2), TSD-01(.1,.2), TSD-02(.1,.2,.3), TSD-05(.1), TSD-06(.1),
TSD-07(.1), PKG-01, FIT-03, FIT-04, FIT-05, FIT-06, FPS-02(.1,.2) — plus ADR-0033, ADR-0014
amendment. MC-01/MC-02/MC-06 get an E2E-LEVEL RESTATEMENT here (see Coverage Check note).
**Test layers**: integration + architectural + e2e

**Acceptance**: GIVEN `package.json#dependencies={"ts-morph":"<exact>"}` + committed lockfile
WHEN `@pbuilder/sdk/typescript` is imported THEN it resolves, exposing `find` with `addImport`;
`find("a.ts").addImport("readFileSync","node:fs")` flushes to a byte-exact golden; the dialect's
own import graph contains no `Session`/`DirectiveFactory`/`EngineClient`; no direct
`EngineClient.read` call exists anywhere in `src/dialects/typescript/**`.

### Tasks
- [ ] [must-fail-first] Halt-check: confirm S-000's FIT-01 rewrite is green BEFORE this task
  proceeds (constraint 1); then `package.json` — `ts-morph` exact-pinned dependency, `./typescript`
  exports entry; commit `bun.lock`; `openspec/decisions/0033-*.md` (Create) + `0014-*.md`
  amendment (Modify)
- [ ] [must-fail-first] `src/dialects/typescript/ast.ts` (Create) — ts-morph parse/print with
  frozen `ManipulationSettings` + explicit `newLineKind`, no language-service formatter
- [ ] [must-fail-first] `src/dialects/typescript/ops.ts` (Create) — `addImport(name, from)`
  op-pack, merge-into-existing-clause idempotency (TSD-01.1/.2)
- [ ] [must-fail-first] `src/dialects/typescript/index.ts` (Create) — namespace export
  exposing `find`, composed via `defineDialect` + `withOps(addImportPack)`; async `@example`
  (FIT-06)
- [ ] `test/dialects/typescript/dialect.test.ts` (Create) — TSD-01/02 base cases + determinism
  spy (language-service formatter zero calls)
- [ ] `test/dialects/typescript/coalescing.test.ts` (Create) — MC-01/02/05 real-AST restatement
  + unawaited-join/same-path (MC-06/07) restatement, spy-on-`emit` content-verified
- [ ] `test/dialects/typescript/read-routing.test.ts` (Create) — MC-03 static scan + planted
  direct-`EngineClient.read` red-proof
- [ ] `test/dialects/typescript/golden/` (Create) — coalesced-one, split-#1/#2, addImport
  before/after goldens
- [ ] `test/e2e/dialect-modify.e2e.test.ts` (Create) — Flows 1-4 (chain→one-modify, `.raw`
  either order, mid-chain split, forgotten-await still commits)
- [ ] `test/fitness/fit-03/04/05/06/08/14-*.test.ts` Modify — `./typescript` budget constant;
  `typescript.index.d.ts` baseline; FIT-05 real-dialect coalesced-directive scenario; `PUBLIC_PATHS`
  +`typescript/index.ts`; `./typescript` kit-bleed scan + planted Session-import red-proof
  (DG-04); FIT-14 4-exports/ts-morph-dep/tarball + regenerated `pkg-surface-baseline.json`

---

## S-003: Edge Scenarios & Fidelity Boundaries

**Scope**: edge-case · **Dimension**: D (Data — edge/boundary variants of input)
**Requires**: S-002
**Covers**: TSD-03(.1–.10), TSD-04(.1)
**Test layers**: integration (golden-fixture matrix)

**Acceptance**: GIVEN each of the 10 edge rows (modify-after-create, modify-then-move, two-edits
-one-modify, modify-on-nonexistent, empty file, CRLF/BOM, 4 MiB serialized-side boundary,
CRLF+addImport, modify-then-copy, duplicate addImport) WHEN exercised THEN each behaves exactly
per its Given/When/Then; GIVEN malformed TypeScript WHEN the first op parses THEN it rejects per
REQ-DG-05's contract with the REAL ts-morph error contained (`.cause` absent).

### Tasks
- [ ] [must-fail-first] Extend `dialect.test.ts` — TSD-03.1/.2/.9 (create/move/copy interaction
  with a coalesced modify) + TSD-03.3 (two-distinguishable-edits content proof) + TSD-03.4
  (not-found pinned message)
- [ ] [must-fail-first] TSD-03.5/.6/.8 goldens — empty file, CRLF+BOM round-trip, CRLF+addImport
  newline-kind matching
- [ ] [must-fail-first] TSD-03.7 — multibyte-UTF-8 fixture sized so raw < `BATCH_CAP_BYTES` ≤
  serialized bytes (Stage-1 lesson); accept-at-cap or reject-at-cap, never silent truncation
- [ ] [must-fail-first] TSD-03.10 — duplicate `addImport(x,m)` twice on one handle → single
  import line, idempotent
- [ ] [must-fail-first] TSD-04.1 — real syntactically-invalid TypeScript fixture; parse failure
  contained per REQ-DG-05, asserted against the REAL ts-morph error (constraint 3)

---

## S-004: Conformance Core Against the Real Dialect

**Scope**: happy-path · **Dimension**: R (Rule — the conformance kit's core invariants)
**Requires**: S-002 (real dialect exists) · parallelizable with S-003 (disjoint files)
**Covers**: DC-01(.1), DC-02(.1), DC-03(.1), DC-04(.1,.2), DC-05(.1,.2) — plus ADR-0012
amendment
**Test layers**: integration (conformance harness)

**Acceptance**: GIVEN `testDialect`/`testOpPack` run against the REAL TypeScript dialect WHEN
the CORE five assertions execute THEN byte-exact round-trip, single-op fidelity +
unchanged-elsewhere, coalescing-to-one (content-verified), and seam-serializability (closure-
smuggle AND live-node-smuggle, two DISTINCT failure modes) all hold; GIVEN the planted-violation
suite THEN every fixture fails RED against its corresponding assertion.

### Tasks
- [ ] [must-fail-first] `src/conformance/index.ts` Modify — real `testDialect` body (DC-01
  byte-exact round-trip over representative samples)
- [ ] [must-fail-first] real `testOpPack` body — DC-02 (single-op + unchanged-elsewhere), DC-03
  (coalescing-to-one, content-verified, ≥2 distinguishable ops)
- [ ] [must-fail-first] DC-04 seam-serializability — `JSON.parse(JSON.stringify(directive))`
  deep-equal assertion wired into both `testDialect`/`testOpPack`
- [ ] [permanent-fixture] `test/conformance/planted/` (Create) — closure-smuggle (DC-04.1,
  silently drops) AND live-ts-morph-Node-smuggle (DC-04.2, `JSON.stringify` throws on circular
  parent pointers) — TWO DISTINCT failure modes, both mandatory
- [ ] [permanent-fixture] one planted violation per core assertion (DC-05) — round-trip,
  single-op, coalescing, serializability, PLUS the read-boundary-split violation (DC-05.2,
  silently coalesces across a mid-chain read instead of splitting)
- [ ] Rewrite `test/conformance/meta.test.ts` — replace the old "throws, no dialect exists yet"
  assertions with real-dialect-backed conformance runs (`typescript-conformance.test.ts`, Create)

---

## S-005: Authoring Docs, SECURITY Guard, Sensitive-Areas Promotion

**Scope**: edge-case · **Dimension**: R (Rule — documentation/security invariants, no new code
path; mirrors stage-4's S-005 house convention of tagging mandatory guard/doc slices edge-case)
**Requires**: S-002, S-004 (docs must describe the shipped real surface + name the conformance
kit as a verification anchor)
**Covers**: DAS-01(.1,.2,.3), DAS-02(.1), STD-01 — plus TSD-06.2 (provenance guard, same file)
**Test layers**: architectural (substring guard)

**Acceptance**: GIVEN `docs/authoring-a-dialect.md` WHEN scanned THEN it names ONLY the shipped
surface (`defineDialect`/`defineOpPack`/`withOps`/`.raw`/`addImport`), carries the two-realms
hazard section and the Async-usage section (both guard-asserted); GIVEN `SECURITY.md` THEN it
carries the `.raw()` trust sentence + "conformance ≠ safety" caveat verbatim (constraint 4);
GIVEN the CI publish job THEN it retains `--provenance` for the release carrying `ts-morph`.

### Tasks
- [ ] [must-fail-first] `docs/authoring-a-dialect.md` Modify — real content: kit-verbs
  reference, `.raw()` + trust cross-ref, coalescing observable shape, worked `addImport`
  example, two-audience split (DAS-02, no author-style demo in the contributor section),
  two-realms hazard, Async-usage section (verbatim per §4.4b)
- [ ] [must-fail-first] `SECURITY.md` Modify — `.raw()` trust sentence + "conformance ≠ safety"
  caveat, verbatim (constraint 4)
- [ ] [must-fail-first] [permanent-fixture] `test/docs/security-authoring-guard.test.ts`
  (Create) — exact-substring guards for all frozen strings (DAS-01.2/.3, DAS-02.1, STD-01) +
  workflow-substring guard for `--provenance` retention (TSD-06.2)
- [ ] Register `src/dialects/typescript/**`, `src/core/dialect-handle.ts`,
  `package.json#dependencies` at low→medium in `project/sensitive-areas` (design §4.8,
  concrete paths not a category) — orchestrator/apply-time registry update, not a test

---

## Build Order

| Order | Slice | Note |
|---|---|---|
| 1 | S-000, S-001 | parallelizable (disjoint files); S-000 need not block S-001 |
| 2 | S-002 | requires S-000 GREEN (constraint 1) + S-001 complete |
| 3 | S-003, S-004 | disjoint files — parallelizable; both require S-002 |
| 4 | S-005 | requires S-002 + S-004 |

## Coverage Check

FIT-01 1 · DG(01,02,03,05) 2+3+2+2=9 · MC(01,02,04,05,06,07) 2+3+1+1+1+1=9 [S-001] +
DG-04 1 + MC-03 2 + TSD(01,02,05,06,07) 2+3+1+2+1=9 + PKG-01 2 + FIT(03,04,05,06) 2+1+1+2=6 +
FPS-02 2 [S-002, 22] · TSD(03,04) 10+1=11 [S-003] · DC(01..05) 1+1+1+2+2=7 [S-004] ·
DAS(01,02)+STD-01 3+1+2=6 [S-005] → **1+18+22+11+7+6 = 65/65 scenarios across 34 REQ-IDs**, no
orphans (direct count from the signed specs; the orchestrator brief cited 63 — a 2-scenario
delta likely from how `foundations-skeleton`'s bulleted GIVEN/WHEN/THEN pairs were tallied;
flagged here rather than silently reconciled — see Risks).

MC-01/MC-02/MC-06 span S-001 (mechanism-level, toy dialect, unit/integration) + S-002
(e2e-level restatement, real dialect via `coalescing.test.ts`/`dialect-modify.e2e.test.ts`) —
not a duplicate, a staged completion mirroring design's own Flow Changes table (§4.2b), which
ties these REQs to the real-dialect e2e file. TSD-06 spans S-002 (.1, dependency pin) + S-005
(.2, provenance guard — same guard TEST FILE as the docs/security substrings).

## Anti-Pattern Check

No horizontal/layer-named slices — S-001 is one cohesive mechanism (generics + handle +
join), not a "core layer" grab-bag; S-002 is one cohesive vertical (real dialect end to end),
not "AST library integration". Every slice cites ≥1 REQ-ID. No two-SPIDR-dimension slice. 6
total (target 4-7 ✓, above the "≥3 excluding skeleton" floor with S-000/S-002/S-003/S-004/S-005
= 5). No slice depends on >2 others.

## Droppable Analysis

**None.** Unlike stage-2's `classifyContent` (independently spec-marked droppable) or stage-4's
gated-but-mandatory S-006, nothing in this slice set is optional: the owner ruling already
thinned scope maximally at proposal level (op-pack breadth, collision diagnostic, adversarial
samples, leaf rule, real-base-dialect rule are ALL out of scope, registered as committed-next
`stage-5b-dialect-breadth` — not slices to drop, work never sliced in). S-004 (conformance core)
and S-005 (SECURITY guard) are explicit proposal Success Criteria, not edge polish; dropping
either would ship `.raw()` — a live code-execution surface — without its seam-serializability
proof or its trust-posture documentation. PM precedent (design ratification) concurs: the
op-pack is already thin: there is nothing left to cut without violating a Success Criterion.

## Risks

- Scenario-count delta (65 direct-count vs. 63 cited) — immaterial to slicing (REQ-level
  coverage is what gates `sdd-verify`), flagged for `sdd-verify --mode=plan` to reconcile if it
  matters to Judge A/B.
- S-001's toy dialect is a slice-level invention absent from design's file table — if
  plan-verify's Judge B considers this an undisclosed design deviation rather than a sanctioned
  testing-strategy choice, the fix is scoping language in this file (done, see Executor
  Context), not a design re-run.
- S-001 carries 10 REQ-IDs and ~10 tasks in one slice — larger than the skill's "≤8
  micro-tasks" heuristic — justified because the owner-ratified sequencing bundles the generic
  contract, coalescing, and the run-boundary join into ONE indivisible proof (ADR-0034 treats
  them as one seam); splitting would fragment a single mechanism across artificial boundaries
  (mirrors stage-4 S-005's accepted 3-dependency exception).

## Upstream Publication

N/A — `spec_source: internal`, Step 8b skipped.

## Amendments (verify-plan-1, orchestrator)

- **ts-morph version resolution rule (closes Judge B micro-gap)**: S-002's first task resolves the
  exact pin as the LATEST STABLE ts-morph at S-002 start; the resolved version is recorded in three
  places atomically — `package.json` (exact, no range), the committed lockfile, and ADR-0033's
  Decision section (replacing the `<exact>` placeholder). The frozen `ManipulationSettings` values
  (design rev 3 §4.4: `newLineKind` = FROZEN per-parse DETECTION rule — pure exported
  `detectNewLineKind(source)`: CRLF iff `count("\r\n") > count("\n") − count("\r\n")`, else LF
  (tie/empty → LF); pinned quote kind/indentation; no language-service formatter) are
  constructor-pinned in `src/dialects/typescript/ast.ts` and asserted by REQ-TSD-02.2 before any
  golden is authored; all fidelity goldens are generated AGAINST that resolved pin + settings,
  making the golden suite the version-drift gate (REQ-TSD-02).
- **Scenario-count authority (closes Judge B product question)**: the SIGNED spec files under
  `specs/*/spec.md` are authoritative by direct extraction — 65 scenarios at V3 signing. The "63"
  in earlier orchestration notes was stale arithmetic (58+5) that under-counted
  foundations-skeleton's GWT bullets. Definition of done for coverage = every scenario present in
  the signed spec files at verify time; never a cached count.
- **Executor surface note**: this artefact is the build ORDER; the build CONTENT contract for
  `sdd-apply` is this file PLUS its Mandatory Reading list (signed specs, design rev 3 incl.
  §4.3/§4.4b/§4.5 verbatim strings and ADR texts, and the named `src/**`/`test/**` files). A
  build launched without that set is out of contract.

## Amendments (verify-plan-2 → design rev 3, orchestrator)

- **S-002 `ast.ts` task** additionally exports the pure `detectNewLineKind(source)` function;
  REQ-TSD-02.2 asserts it directly on LF/CRLF/tie/empty samples plus a host-OS-source static scan.
- **S-002 dialect-handle task**: the inherited write verbs (`move`/`copy`/`rename`/
  `modify(content)`/`remove`) are re-implemented on the dialect handle queuing through `#tail`
  (author order preserved: coalesced `modify` first, trailing relocation after — REQ-TSD-03.2/.9);
  they return the thenable writable dialect handle (`DialectWriteOps`, a covariant refinement of
  `WriteOps`; `remove` stays terminal). Design rev 3 §4.3 + ADR-0034 clause 1b.
- **S-004 gains a task**: `testDialect`/`testOpPack` become `async (…): Promise<void>` (ADR-0012
  amendment; fixture shapes unchanged) — regenerate the `./conformance` FIT-04 `.d.ts` baseline
  (`conformance.index.d.ts`) and switch the planted-violation wrappers to expect-reject.

## Amendments (verify-plan-3 → design rev 4, orchestrator)

- **S-004 (with S-002 baseline consequence): conformance run vehicle** — new Create task
  `src/conformance/run-vehicle.ts`: a MINIMAL kit-internal in-memory `EngineClient`
  (stage/read/commit/discard only) so `testDialect`/`testOpPack` drive a REAL coalescing run;
  NOT exported from `./conformance` (FIT-08 forbids re-export, not internal use of the port);
  `test/support/contract-fake.ts` remains the normative fake. FIT-14 `pkg-surface-baseline.json`
  regeneration captures the new `dist/conformance/run-vehicle.js` tarball entry. Design rev 4
  §4.2 + ADR-0012-amendment "Run vehicle" clause.
- **S-001 toy-smoke task reworded**: `test/conformance/toy-dialect-smoke.test.ts` = TYPE-pin
  (`expectTypeOf` vs frozen `DialectFixture`/`OpPackFixture`) + expect-throw CHARACTERIZATION of
  the still-stubbed `testDialect`'s documented error (suite stays green). "Discarded after
  S-001" means the toy's role as the skeleton proof vehicle ends; conformance's real fixture is
  the TS dialect (constraint 2 upheld).
- **S-004**: the toy-smoke test is removed/replaced by `typescript-conformance.test.ts` against
  the real dialect.
- **Amendments (verify-plan-4 → design rev 5 + spec V4)**: (a) **S-004** authors
  `OpPackFixture.exercises` (REQUIRED field, new exported `OpExercise` type — spec V4
  dialect-conformance Purpose + REQ-DC-02): an `addImport` single-op exercise (DC-02) and an
  `addImport`+`.raw` multi-op exercise (DC-03 + self-derived read-split); the FIT-04
  `conformance.index.d.ts` baseline regen now ALSO captures `exercises`/`OpExercise` (besides
  `Promise<void>`). (b) **S-001**: the toy `OpPackFixture` in the smoke test supplies a minimal
  `exercises` entry to typecheck against the required field (type-pin only; `testOpPack` still
  stubbed). (c) **S-003**: TSD-03.1 task = commons `create` then dialect `find().addImport()`
  (spec V4 wording), asserting create + ONE coalesced modify, content byte-exact = created
  content + import. (d) Canonical not-found literal is QUOTED:
  `dialect operation failed: "{path}" does not exist — create it first in this run` (spec V4
  aligned to design/slices). (e) FPS-02.2 path = `dist/dialects/typescript/**`.
- **S-001 handle mechanism note**: eager handled-marking — each op-enqueue attaches a no-op
  shadow-catch to the current `#tail` before returning (`#tail = #tail.then(op);
  #tail.catch(() => {})`), preventing the pre-drain `unhandledRejection` window; real rejection
  stays on `#tail` for author-await and drain `settle()`. FIT-18's red-proof gains a second
  independent drop (removing the eager mark). Design rev 4 §4.3/§4.7 + ADR-0034 clause (1).

## Amendments (verify-plan-5, orchestrator latitude rulings)

- **FIT-01 walk semantics (S-000)**: the transitive scanner FOLLOWS every relative-import edge
  from `src/commons/**` to any depth (including legitimate non-core SDK-internal targets such
  as `../dry-run/*` and commons-local modules — these are traversal edges, NOT violations) and
  FAILS on any BARE non-builtin specifier encountered at any depth. The invariant is "zero
  external packages reachable from commons", not "commons only imports core". This reading
  preserves the existing green suite AND catches the planted transitive `leaf → helper →
  ts-morph` red-proof. A target-allow-list reading (relative must resolve into core) is
  REJECTED — it turns today's legitimate `../dry-run` imports red.
- **FIT-03 for `./typescript` (S-002)**: build with `--packages=external` — the budget measures
  OUR dialect code (KB-scale), not ts-morph's pinned known weight; the numeric constant is
  measure-and-pin at apply (generated size + headroom, committed like this repo's other
  baselines) with the oversized-fixture red-proof sized against it. The
  no-AST-lib-specifier assertion remains scoped to the COMMONS bundle only — the `ts-morph`
  specifier is legitimately present in `/typescript` external output.
