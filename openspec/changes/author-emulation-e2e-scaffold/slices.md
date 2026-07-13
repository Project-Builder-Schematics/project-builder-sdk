# Slices: Author-Emulation E2E — Scaffold Family (author-emulation-e2e-scaffold)

**Triage**: L · **Spec version**: V2 SIGNED (micro-unfreeze 1) · **Total slices**: 5 (1 walking skeleton + 4 SPIDR) · **Rev**: 2 (verify-plan-1 gap closure — executor surface enriched; slice IDs, dependency order, gates, and scope UNCHANGED from rev 1)

**Executor contract (read this first)**: the apply executor IS spec/design-aware. Each slice lists its "Spec sections consumed" — the executor MUST read those exact files before implementing; this document embeds the load-bearing contracts and points to the rest. Design contract: `openspec/changes/author-emulation-e2e-scaffold/design.md` (§4.2 File Changes = decomposition contract; §4.3 record shape; §4.4 interface contracts; §4.6 test derivation; §4.7 fitness).

**Toolchain & pinned paths (all slices)**: test runner `bun test`; typecheck `tsc --noEmit`. Corpus root: `test/e2e/author-emulation/corpus/` (committed). Reports root: `test/e2e/author-emulation/reports/` (gitignored). E2E file: `test/e2e/author-emulation-scaffold.e2e.test.ts` (NEVER `scaffold.e2e.test.ts` — upstream owns it).

Build-gate legend: **UNGATED** = buildable now against the 6 pre-existing wire ops. **GATED** = requires `schematic-local-files` **judgment-day-passed + MERGED-TO-MAIN**, plus the **signature-shift tripwire** (see the BEFORE-STARTING checklist in S-003/S-004).

---

## S-000: Walking Skeleton — UNGATED Infra Spine

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing
**Covers**: ITC-01, ITC-02(path only), ITC-03, ITC-04, ITC-05, GCC-01(partial)/02/03/04/05/06/07(N/A)/09/10/11/12, RPT-02, FTG-01, FTG-02, FTG-05
**Test layers**: e2e (skeleton) + architectural (FIT-23/24/27) + unit (corpus-format)
**Spec sections consumed** (MUST read): `specs/ir-transcript-capture/spec.md` (ITC-01..05), `specs/golden-corpus-contract/spec.md` (GCC-01..12), `specs/fitness-guards/spec.md` (FTG-01/02/05), `design.md` §4.3 + §4.4 + ADR-0047/0048/0049. All spec paths relative to `openspec/changes/author-emulation-e2e-scaffold/`.

Proves the ENTIRE vehicle end-to-end with the thinnest real path: an existing fixture (`test/fixtures/typed-factory/`, 6 pre-existing wire ops only — no scaffold/copyIn/create(templateFile)) run through the new capture path, corpus-compared, fitness-guarded. Per R-B, `s-00` gets NO report — the report renderer is explicitly NOT in this slice.

**Embedded contracts**:

- **`runFactoryForTest` (the wrap target, R-A)** — `src/testing/index.ts:95`: `runFactoryForTest<O>(factory, input, seed?) → Promise<RunResult>` where `RunResult = { tree: ReadonlyMap<string,string> (committed writes ONLY, `{{}}` never rendered), emitted: Batch[] (one per emit() call, in call order), error }`. `captureRun` wraps it read-only — never alters its exports/behaviour.
- **Seed rule**: `seed?: Record<string,string>` is the `ContractFake` seed tree (path→content), passed through verbatim by `captureRun`. Determinism obligation (GCC-04/06): every corpus record is a PURE function of (fixture, input, seed) — no ambient reads, no clock, no randomness.
- **`TranscriptRecord` envelope** (design.md §4.3, key order BINDING): `formatVersion` (const `0`, independent of wire `protocolVersion`, GCC-02), `scenarioId` ("s-00" | "m-01".."m-21"), `slug` (kebab), `normative: { outcome: "committed"|"rejected", directives: NormativeDirective[] (ordered LOWERED wire directives, walk order; EMPTY on rejection), rejection?: { reason, verb: string|null, path } (no message text) }`, `informative: { batchGrouping: { directiveCount, protocolVersion }[] }`. Per-op directive key order: `create: {op, pathTemplate, template, options, force}`; `copyIn: {op, from, to, force}` (no content field).
- **Canonical serialization (ADR-0049, binds writer AND verifiers)**: UTF-8 **no BOM**, **LF**, 2-space pretty JSON, exactly one trailing newline; objects built key-by-key in the pinned order (never JS iteration order); `create.options` subtree recursively **lexicographically key-sorted**; `force` always emitted as boolean (default `false`). ONE pure `canonicalize()` shared by regen writer + every verifier; no fs inside `corpus-format.ts`.
- **README 5 literal headings (GCC-11 grep targets)**: `## What This Corpus Is` · `## Normative Status` · `## How It Is Regenerated` · `## The NOT-EXERCISED Ledger` · `## Reference`. Must include the `formatVersion`↔`protocolVersion` independence sentence (GCC-02) and the family-prefix reservation sentence (R-C: this family owns `m-*`; future families get their own prefixes).
- **coverage-manifest.md structure (GCC-08)**: EXERCISED table (every matrix-cited REQ-ID → row ids); NOT-EXERCISED ledger with exactly the 5 literals `module-wiring`, `tsconfig-AST`, `template rendering`, `REQ-BRC-08`, `REQ-PRC-06`; FRICTION section (≥1 `{friction, disposition}` entry or the literal `none observed`).
- **FIT invariants owned here** (failure messages: guard id + broken invariant + named offender + rule cite, design §4.4 taxonomy):
  - FIT-23 (REQ-FTG-01): in-process double-run of the non-gated scenario set → byte-identical corpus output; red-proof = injected nondeterministic field fixture.
  - FIT-24 (REQ-FTG-02): scan every committed corpus file for binary magic bytes, absolute-path-shaped strings, timestamp/duration/uuid/PID shapes; red-proofs = planted abs-path-corpus + nondeterministic-field fixtures.
  - FIT-27 (REQ-FTG-05): static import-graph scan (reuse `test/support/import-scan.ts` + `scan-roots.ts`) — NO test-reachable module writes the corpus dir; `scripts/regen-corpus.ts` outside the test graph, imported by no test, not on the CI test command; scoped to corpus dir ONLY (reports dir excluded); red-proof = planted corpus-write-in-support fixture.
- Red-proof fixtures live under `test/fixtures/red/author-emulation/**`, excluded from tsconfig (repo FIT-21 idiom).

**Acceptance**:
- GIVEN the existing `typed-factory` fixture run via `runFactoryForTest`
- WHEN `captureRun` wraps it and `canonicalize`/`serializeCorpus` renders the result
- THEN the committed `s-00.infra-skeleton.transcript.json` is byte-identical on re-run (FIT-23), contains no binary/abs-path/nondeterministic field (FIT-24), and no test-reachable module writes the corpus dir except `scripts/regen-corpus.ts` (FIT-27) — all three RED-provable pre-merge (GCC-12)

### Tasks
- [ ] S-000.1 `test/support/ir-transcript.ts` — `captureRun(run,input,seed?) → { record, tree, emitted, error }` wraps `runFactoryForTest`; `error === undefined` → `outcome:"committed"`, `directives = emitted.flatMap(b=>b.instructions)` normalized to lowered wire shape; `AuthoringError` → `outcome:"rejected"`, empty directives + attribution triple. No cross-family branching (ITC-05).
- [ ] S-000.2 `test/support/corpus-format.ts` — `TranscriptRecord` + `FORMAT_VERSION`, `canonicalize()`, `buildRecord(capture,{scenarioId,slug})`, `serializeCorpus`, `parseCorpus` (pure, no fs)
- [ ] S-000.3 `scripts/regen-corpus.ts` — sole corpus-dir writer, iterates the scenario registry, outside test graph
- [ ] S-000.4 `test/e2e/author-emulation-scaffold.e2e.test.ts` — skeleton scenario only, compares `serializeCorpus(fresh)` vs committed bytes; no report call
- [ ] S-000.5 Commit `corpus/s-00.infra-skeleton.transcript.json` + `corpus/README.md` (5 headings above) + `corpus/coverage-manifest.md` (skeleton state: NOT-EXERCISED 5 literals + FRICTION `none observed` placeholder)
- [ ] S-000.6 `test/fitness/fit-23-corpus-determinism.test.ts`, `fit-24-corpus-purity.test.ts`, `fit-27-anti-tautology-scan.test.ts` + red-proof fixtures
- [ ] S-000.7 `.gitignore` — add `test/e2e/author-emulation/reports/`

---

## S-001: Report Rendering, Fitness Hardening & Governance Docs

**Scope**: happy-path · **Dimension**: Rule · **Requires**: S-000
**Covers**: RPT-01, RPT-04, RPT-05, ITC-02(full, FIT-25), FTG-03, FTG-04, GCC-08, GCC-11(depth), SCM-03(registration half), AEG-06(protocol half)
**Spec sections consumed** (MUST read): `specs/run-report/spec.md` (RPT-01..05), `specs/fitness-guards/spec.md` (FTG-03/04), `specs/golden-corpus-contract/spec.md` (GCC-08/11), `specs/scenario-matrix/spec.md` (SCM-03 + the 21-row table FIT-26 scans), `design.md` §4.4 (report contract + templates).

Owns the report renderer + all RPT REQs. Bundled with FIT-25/26 because both mechanically require `run-report-render.ts`'s exported `REPORTS_DIR`/`reportPathFor` to exist — a real dependency, not convenience grouping. Also owns the `PC-SPEC-FSC-TOKENS` registration and finalizes the README lowering section (north-star reckoning hook #3: teach that `scaffold` has NO wire op — its expansion into `create`/`copyIn` directives IS the corpus truth).

**Embedded contracts**:

- **Kind derivation (RPT-01)**: map each committed directive through `dryRunPlan` — `src/dry-run/plan.ts` (in this worktree now; `dryRunPlan(snapshot)` at :83, frozen `WIRE_TO_AUTHOR_VERB` table at :61; the `DryRunEntry.kind` field `"rendered"|"copied"` is upstream-ADDED and lands with the `schematic-local-files` merge). NEVER a parallel hand-rolled op→kind map. `rendered`/`copied` are the author-facing strings; `by-value`/`by-reference` never appear on a report.
- **Header literals (RPT-05, assert verbatim from exported constants)**:
  - `SEAM_DISCLAIMER` = `"IR captured at the EngineClient seam — nothing was engine-rendered"`
  - `GAP_NOTICE` = the three-item not-exercised notice naming exactly: `module-wiring`, `tsconfig-AST`, `template rendering` (mirrors the manifest's NOT-EXERCISED ledger).
- **Report path**: `reportPathFor(id,slug)` → `test/e2e/author-emulation/reports/<matrix-id>.<slug>.report.md` (mirrors corpus stem); `REPORTS_DIR` is the single pinned constant. Three templates: success / rejection / empty. Matrix rows only — `s-00` never gets a report (R-B).
- **FIT invariants owned here**:
  - FIT-25 (REQ-FTG-03): import-scan `scripts/regen-corpus.ts`, `run-report-render.ts`, and the e2e file → all three resolve the SAME `test/support/ir-transcript.ts`; no second capture module anywhere in the change's tree; red-proof = planted 2nd-capture-module fixture.
  - FIT-26 (REQ-FTG-04): (a) `.gitignore` carries `test/e2e/author-emulation/reports/`; (b) report filename derives only from `REPORTS_DIR`/`reportPathFor` (no ad-hoc literals); (c) every row of the `specs/scenario-matrix/spec.md` table cites ≥1 REQ-ID or owner boundary D1-D4; red-proof = uncited-row fixture.
- **`PC-SPEC-FSC-TOKENS` row (register verbatim in `openspec/pending-changes.md`, REQ-SCM-03 deliverable)**:

  > | `PC-SPEC-FSC-TOKENS`: `folder-scaffold` REQ-FSC-05 specifies only SINGLE-filter token translation (`__x@filter__` → `{= x | filter =}`), leaving multi-filter chaining (`__name@singular@dasherize__` → `{= name | singular | dasherize =}`) under-specified upstream (owner ruling D3, obs #941). Escalation target for `author-emulation-e2e-scaffold` matrix row M-04's hardcoded-literal assertion (REQ-SCM-03): if the landed pipeline does not chain, M-04 goes RED and STAYS RED — the gap escalates through this row, never a weakened assertion | spec-gap | S | — | **schematic-local-files spec followup (own unfreeze)** |

**Acceptance**:
- GIVEN a synthetic success/rejection/empty `TranscriptRecord`
- WHEN `renderReport` runs THEN every entry shows verb+path+kind (derived via `dryRunPlan`, never a parallel map) and the header carries `SEAM_DISCLAIMER` + the 3-item `GAP_NOTICE` verbatim (RPT-05)
- GIVEN `scripts/regen-corpus.ts`, `run-report-render.ts`, and the e2e test file
- WHEN import-scanned THEN all three resolve the same `ir-transcript.ts` (FIT-25); a planted 2nd capture module fails it
- GIVEN the signed 21-row matrix table WHEN FIT-26 runs THEN every row's citation is confirmed and `.gitignore`/`REPORTS_DIR` hygiene holds
- GIVEN `openspec/pending-changes.md` WHEN inspected THEN the `PC-SPEC-FSC-TOKENS` row above exists

### Tasks
- [ ] S-001.1 `test/support/run-report-render.ts` — `renderReport`, 3 templates, exported `SEAM_DISCLAIMER`/`GAP_NOTICE` constants, `REPORTS_DIR`/`reportPathFor`
- [ ] S-001.2 RPT unit tests (synthetic records; literal-constant asserts)
- [ ] S-001.3 `test/fitness/fit-25-single-capture-path.test.ts` + red-proof
- [ ] S-001.4 `test/fitness/fit-26-report-hygiene-citations.test.ts` + red-proof
- [ ] S-001.5 `corpus/coverage-manifest.md` full EXERCISED/NOT-EXERCISED/FRICTION structure + `corpus/README.md` scaffold→create/copyIn lowering section
- [ ] S-001.6 Register the `PC-SPEC-FSC-TOKENS` row (verbatim above) in `openspec/pending-changes.md`

---

## S-002: Author-Emulation Fixture — Data Variants

**Scope**: happy-path · **Dimension**: Data · **Requires**: S-000
**Covers**: AEG-03, AEG-04, AEG-05, AEG-07 (non-executing fixture content only — `factory.ts` itself is GATED, deferred to S-003)
**Spec sections consumed** (MUST read): `specs/author-emulation-generator/spec.md` (AEG-03/04/05/07), `design.md` §4.2 fixture rows + §4.9 (setup-materialized oversized fills).

Owns fixture-package authoring for everything that does NOT require calling `scaffold`/`copyIn`/`create(templateFile)`.

**Embedded contracts**:

- **Codegen invocation (AEG-03, Stage-4 pattern)**: `bun bin/pbuilder-codegen.ts test/fixtures/author-emulation` (bin `pbuilder-codegen` → `dist/bin/pbuilder-codegen.js`; dev runs the TS source directly). Worked example: `test/fixtures/typed-factory/` — `schema.json` → `schema.generated.ts` with the `AUTO-GENERATED by pbuilder-codegen` + `@schema-digest sha256:...` header exporting `Input`. Options objects type-check against `Input` at `tsc --noEmit` (compile-time guarantee, no runtime assert).
- **Chained-token semantics (AEG-05 / D3)**: the on-disk source filename `__name@singular@dasherize__.entity.ts.template` is the INPUT (the author's file); the emitted `pathTemplate` token `{= name | singular | dasherize =}` is the OUTPUT the pipeline should produce. This slice ships the INPUT filename only; the assertion lives in S-003 (M-04).
- **Git-hostile materialization (AEG-07)**: empty folder + symlink + at/over-cap byte fills are created by `author-emulation-setup.ts` at test setup and torn down after — NEVER committed (no 4 MiB blob in the repo, design §4.9). Symlink creation may be platform-unavailable → skip with the skip recorded (M-19 note).

**Acceptance**:
- GIVEN `schema.json` + generated `Input` type WHEN a synthetic options object is authored THEN it compiles under `tsc --noEmit` (AEG-03.1)
- GIVEN the fixture's `files/` tree and `.gitattributes` WHEN inspected THEN a `__name@singular@dasherize__`-style filename exists (AEG-05.1) and `*.png`/`*.bin.template` are `.gitattributes`-marked `binary` (AEG-04.1)
- GIVEN `author-emulation-setup.ts` WHEN invoked THEN it materializes+tears down an empty folder and a symlink (AEG-07.1), neither committed

### Tasks
- [ ] S-002.1 `test/fixtures/author-emulation/schema.json` + `schema.generated.ts` (via the codegen invocation above)
- [ ] S-002.2 `test/fixtures/author-emulation/files/**` incl. the chained-token filename + `.template` text files (illustrative "wiring" text only — never AST-verified, AEG-02)
- [ ] S-002.3 `assets/logo.png` (tiny real binary) + `assets/blob.bin.template` + `.gitattributes` marking both patterns `binary`
- [ ] S-002.4 `test/support/author-emulation-setup.ts` — empty-folder + symlink + deterministic byte-fill materialize/teardown

---

## S-003: Scaffold Matrix — Generation & Classification Happy Paths **[GATED]**

**Scope**: happy-path · **Dimension**: Path · **Requires**: S-001, S-002
**Covers**: matrix rows below (11) + RPT-03 (first slice with ≥2 concurrent named reports)
**Spec sections consumed** (MUST read): `specs/scenario-matrix/spec.md` — its 21-row table is the AUTHORITATIVE row source (GWT per row lives there, not here); `specs/author-emulation-generator/spec.md` (AEG-01/02); `design.md` §4.6 GATED rows.

**BEFORE STARTING (gate-check protocol — signature-shift tripwire)**:
1. Verify `schematic-local-files` judgment-day PASSED and the change is MERGED TO MAIN (`git log origin/main` shows the merge; this worktree's base includes it).
2. Re-verify against landed `src/`: `ScaffoldArgs` still `{from, to, options, include, exclude, rename, force}`; `copyIn(...)` wire op signature; `create({templateFile})` overload present.
3. Re-verify `DryRunEntry.kind` (`"rendered"|"copied"`) present on `src/dry-run/plan.ts`.
4. ANY shift from the shapes this plan captured → HALT to orchestrator (`architectural-conflict`), do not adapt silently.

**Rows owned (id — citation column, from the authoritative table)**: M-01 — D2; REQ-FSC-01.2; REQ-FEH-01.1; REQ-FEH-03.1 · M-02 — REQ-FSC-01.1/.2/.3 · M-03 — REQ-FSC-03.1 · M-04 — REQ-FSC-05.1 · M-05 — REQ-CCL-01.1/.2; REQ-BRC-01.1 · M-06 — REQ-CCL-01.2; REQ-BRC-01.2 · M-07 — REQ-CCL-06.1; REQ-ATH-14.1 · M-09 — batch-cap REQ-04.1 · M-14 — REQ-FSC-04.1 · M-19 — REQ-FSC-09.1 · M-20 — REQ-ATH-16.1.

**Embedded contracts**:
- **Chained-token assertion (M-04, REQ-SCM-03)**: assert the emitted `pathTemplate` against the HARDCODED test-source literal `{= name | singular | dasherize =}` — never corpus-derived (green-by-construction trap), never engine-rendered. If the landed pipeline does not chain: the test goes RED and STAYS RED; escalate via the `PC-SPEC-FSC-TOKENS` row (registered in S-001, exists either way).
- All scenario assertions are directive-SHAPE only (ITC-03): op, paths, literal untranslated tokens, force, options-echo — never rendered `{{}}`/`{= =}` output, never by-reference bytes.

**Acceptance** (outer e2e red-first, Strict TDD):
- GIVEN the author-emulation factory run via `runFactoryForTest` (M-01) WHEN captured THEN `scaffold+copyIn+create(templateFile)` all commit and the `create(templateFile)` destination filename token appears verbatim in `pathTemplate`
- GIVEN M-04's chained-token source filename WHEN scaffolded THEN `pathTemplate` matches the hardcoded literal above (RED-stays-RED policy on non-chaining)
- GIVEN two distinct matrix rows' reports rendered in the same run WHEN `reports/` is inspected THEN both exist as distinctly named `<matrix-id>.<slug>.report.md` files, and a same-scenario re-run leaves exactly one file (RPT-03)

### Tasks
- [ ] S-003.1 `test/fixtures/author-emulation/factory.ts` — single CRUD `defineFactory({packageDir})` + per-scenario runner variants; fixture-wide all 7 `ScaffoldArgs` fields non-default at least once (AEG-01.2); zero `modify` directives (AEG-02)
- [ ] S-003.2 M-01, M-04, M-05, M-06, M-07 e2e scenarios (RED first)
- [ ] S-003.3 M-02, M-03, M-09, M-14, M-19, M-20 e2e scenarios
- [ ] S-003.4 Regen + commit the 11 corpus transcripts (`scripts/regen-corpus.ts`, review diff) + update `coverage-manifest.md` EXERCISED ledger

---

## S-004: Scaffold Matrix — Batch-Cap, Containment & Rejection Boundaries **[GATED]**

**Scope**: edge-case · **Dimension**: Rule · **Requires**: S-003
**Covers**: matrix rows below (10) + REQ-SCM-05 (attribution triple)
**Spec sections consumed** (MUST read): `specs/scenario-matrix/spec.md` (authoritative table + SCM-05), `specs/golden-corpus-contract/spec.md` (GCC-09 rejection record), `design.md` §4.3 rejection shape.

**BEFORE STARTING**: run the same 4-step gate-check protocol as S-003 (judgment-day passed + merged to main + signature re-verify + `DryRunEntry.kind` present; any shift → HALT).

**Rows owned (id — citation column)**: M-08 — REQ-CCL-05.1 · M-10 — batch-cap REQ-04.2 · M-11 — batch-cap REQ-04.3 · M-12 — REQ-FEH-02.1/.2 · M-13 — REQ-FSC-04.2 · M-15 — REQ-FSC-08.1 · M-16 — REQ-PRC-04.1/04.6 · M-17 — REQ-PRC-07.1 · M-18 — REQ-BRC-06.1 · M-21 — batch-cap REQ-05.1.

**Embedded contracts**:
- **Rejection record (GCC-09)**: corpus file = `outcome: "rejected"`, EMPTY `directives`, `rejection: { reason (closed AuthoringReason), verb (string|null when unattributable), path (package-relative) }` — NO free-text message. Every rejection row's e2e assertion covers the FULL triple (SCM-05) — reason alone is incomplete.
- **M-21 (cross-chunk atomicity)**: scaffold spanning ≥2 flushes, SECOND flush rejects → `result.tree` empty (first chunk discarded), `result.error` carries the attributed rejection — this is exactly why `captureRun` wraps `runFactoryForTest` (R-A).
- Oversized/at-cap fixtures (M-10/M-11) use S-002's setup-materialized deterministic byte fills — never committed.

**Acceptance**:
- GIVEN matrix row M-15 (intra-scaffold collision) WHEN its rejection is asserted THEN `reason` (`invalid-input`), the attributed `verb`, and the primary package-relative `path` are all checked (SCM-05), matching the committed GCC-09 rejection triple
- GIVEN M-21 WHEN run via `runFactoryForTest` THEN `result.tree` is empty and `result.error` carries the attributed rejection

### Tasks
- [ ] S-004.1 M-08, M-10, M-11 e2e scenarios (RED first)
- [ ] S-004.2 M-12, M-13, M-15 e2e scenarios (full attribution-triple assertions)
- [ ] S-004.3 M-16, M-17, M-18, M-21 e2e scenarios
- [ ] S-004.4 Regen + commit the 10 rejection/boundary corpus transcripts + finalize `coverage-manifest.md` EXERCISED ledger (all 21 rows) + FRICTION section real content (AEG-06 — `none observed` only if genuinely nothing surfaced; reckoning hook #2)

---

## Build Order

| Order | Slice | Gate | Parallelizable with |
|---|---|---|---|
| 1 | S-000 | UNGATED | — (blocks all) |
| 2 | S-001 | UNGATED | S-002 |
| 2 | S-002 | UNGATED | S-001 |
| 3 | S-003 | GATED | — |
| 4 | S-004 | GATED | — |

## Droppable Tail (fallback only — owner D4 goal is the full 21-row matrix)

If capacity tightens, drop in this order — **never the corpus infra or S-000/S-001/S-002**:
1. M-17 (no-existence-oracle — overlaps M-16/M-18's containment family)
2. M-11 (exactly-at-cap boundary — marginal extension of M-09/M-10)
3. M-20 (ContractFake parity re-assertion — conformance nice-to-have, not new behavior)

## SPIDR Dimensions Used

| Dimension | Count | Slices |
|---|---|---|
| Rule | 2 | S-001, S-004 |
| Data | 1 | S-002 |
| Path | 1 | S-003 |

## Anti-Pattern Check

Pass — no horizontal/layer-named slices (each names user/owner-visible behavior); every slice cites ≥1 REQ-ID; no slice crosses two SPIDR dimensions; no slice depends on >2 others (S-003 depends on 2, all others ≤1; S-000 implicit everywhere); 5 total (within 4-7 for L); 4 excluding skeleton (at the floor — justified: most matrix content is GATED and further row-level fragmentation would add dependency-chain overhead without proportionate value; the droppable tail already gives row-level fallback granularity).

## Scope Guards Confirmed

Zero `src/` rows across all slices (`src/scaffold/**`, `wire.ts`, `dry-run/plan.ts`, `testing/index.ts` stay read-only, per design §4.2). No slice branches on non-scaffold families (ITC-05, enforced by FIT-25's scan). No slice unifies `test/golden-ir/`/`test/dialects/typescript/golden/` with this corpus (ADR-0048: physically separate third idiom). **"standalone copyIn" disambiguation (verify-plan-1 Judge A, triage.md rev)**: the out_of_scope boundary is "copyIn-as-its-own-family" — a FUTURE dedicated per-family change; the standalone `copyIn(...)` CALL inside this change's fixture (REQ-AEG-01, S-003) is in-scope by triage in_scope item 1.

## Upstream Publication

N/A — `spec_source = internal`. Step 8b skipped.
