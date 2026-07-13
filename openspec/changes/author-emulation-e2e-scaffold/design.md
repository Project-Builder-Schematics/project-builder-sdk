# Design: Author-Emulation E2E — Scaffold Family (author-emulation-e2e-scaffold)

**Triage**: L · **Spec**: V2 SIGNED (owner 2026-07-13) · **Persona lens**: none (architect-framed) · **Architecture impact**: additive
**rev 2 — verify-plan-2 gap closure** (rulings R-D/R-E/R-F below; no other design content moved)

## Rev 2 Rulings — Verify-Plan-2 Gap Closure (2026-07-13)

- **R-D (gap 1 — render source + S-001 gate re-partition)**: (a) The report renders from the **RAW captured wire directives** — `captureRun`'s result gains `rawDirectives: readonly Directive[]` (the flattened `emitted.flatMap(b => b.instructions)`, emission order), and `renderReport(record, rawDirectives)` derives its entry lines via `dryRunPlan(rawDirectives)` — never from the normalized `TranscriptRecord.normative.directives` and never via a parallel op→kind map (RPT-01). This resolves the type mismatch: `dryRunPlan` consumes wire `Directive[]`, which is exactly what `rawDirectives` is; the record supplies header metadata only (scenario id/slug, outcome, rejection triple). (b) Gate re-partition: the kind axis (`DryRunEntry.kind` + the 7-op `copyIn`-aware map) lands ONLY with the `schematic-local-files` merge — verified: this worktree's `src/dry-run/plan.ts` has `WIRE_TO_AUTHOR_VERB` (6 ops) and NO `kind`; `origin/feat/schematic-local-files:src/dry-run/plan.ts` adds both. **UNGATED**: renderer skeleton emitting `verb + path` via the current 6-op `dryRunPlan`, the `SEAM_DISCLAIMER`/`GAP_NOTICE` exported constants + header assembly, FIT-25/FIT-26, corpus README + manifest skeleton, `.gitignore` line, `PC-SPEC-FSC-TOKENS` row. **GATED**: the kind column, full RPT-01.1/RPT-05.1 acceptance (entry triple *including kind*, no-parallel-map proof against the LANDED kind mechanism) + their red-proofs. Test Derivation rows re-annotated accordingly.
- **R-E (gap 3 — shared scenario registry)**: New module `test/e2e/author-emulation/scenarios.ts` — **data-only, no fs, no writes**. Exports `SCENARIOS: readonly ScenarioEntry[]` with per-scenario fields `{ id, slug, run, input, seed?, expected: "committed" | "rejected", gated: boolean }` (`run` = a reference to the fixture factory variant from `test/fixtures/author-emulation/factory.ts`; `id`/`slug` feed the corpus/report stems). **Single-source contract**: `scripts/regen-corpus.ts` AND `test/e2e/author-emulation-scaffold.e2e.test.ts` BOTH iterate this one export — corpus filenames, report filenames, and expected counts all derive from it; FIT-26's GCC-01 count check reads it (committed corpus files ↔ `SCENARIOS` entries, one-to-one). FIT-25/27 standing: test-imported and data-only — it never imports the capture module (not a capture path, FIT-25-irrelevant) and performs no corpus write (FIT-27-clean by construction, still scanned like every test-reachable module).
- **R-F (gap 5 — AuthoringError accessor + path relativization)**: Accessor contract (upstream `origin/feat/schematic-local-files:src/core/authoring-error.ts`, lines 238–241): `readonly verb: AuthoringVerb | undefined`, `readonly path: string | undefined`, `readonly reason: AuthoringReason` (closed union), `readonly origin: AuthoringOrigin`. **Ruling: `captureRun` passes `reason`/`verb`/`path` through VERBATIM — it never relativizes.** Evidence the path already arrives package-relative for every scaffold-family rejection: (1) `src/scaffold/containment.ts:60–64` (upstream) — `sourceRejection`: "`path` here is ALWAYS the package-relative `relPath` (REQ-PRC-05), never an absolute filesystem path"; (2) `authoring-error.ts` `primaryPath` frozen table (~lines 139–156) returns the AUTHOR-DECLARED source-side path (`create.pathTemplate`, `copyIn.from`) — author-declared values are package-relative by construction (REQ-BRC-07 pins `copyIn.from` package-relative on the wire); (3) `invalidInput(message)` (~line 276) mints `verb: undefined, path: undefined`. Absent `verb`/`path` serialize as `null` in the rejection record (field types: `verb: string | null; path: string | null`, mirroring the accessor's `| undefined`). FIT-24's absolute-path scan is the backstop — an absolute path leaking into a record fails purity, so pass-through can never silently mask a relativization bug. **Carried note for apply**: GCC-09.1 illustrates M-13 with a concrete `path`, but upstream mints `invalid-input` with `path: undefined` — apply-time re-verify against the landed API; if M-13's record truly carries `path: null`, reconcile at spec level (record the divergence, never patch the capture to invent a path).

## Council Rulings Incorporated (2026-07-13)

- **R-A** — OWNER micro-unfreeze of REQ-ITC-01: the capture module wraps **`runFactoryForTest`** (the normative run-level recording harness — it alone exposes `tree`+`error` for GCC-09 rejection records and M-21), NOT `makeSpyClient`. `spy-client.ts` stays byte-untouched (ITC-04). Design is written to the corrected reading.
- **R-B** (design-ratified, consistent with signed text): reports are per-**matrix-row** only — `s-00` (GCC-12 skeleton) gets a corpus record but NO report (`DryRunEntry.kind` is absent by contract for the six pre-existing ops, so RPT-05's verb+path+kind line cannot hold for `s-00`).
- **R-C** (design-ratified): corpus README reserves per-family matrix-id **prefixes** (this change = `m-*`; future families get their own, e.g. `mod-*`/`mv-*`) so a future modify-family `M-01` cannot collide in the shared corpus dir.

## 4.1 — Architecture Overview

Test/docs/tooling change only — no `src/` runtime edit, no public-API change, no new runtime dependency. It adds a **run-level IR transcript-capture idiom** (a third golden idiom beside `test/golden-ir/` in-source literals and `test/dialects/typescript/golden/` byte-print files) plus the realistic author-emulation fixture that feeds it. The capture module wraps the SDK's own `runFactoryForTest(run, input, seed?) → {tree, emitted, error}` (R-A), normalizing the recorded `Batch[]` into a committed transcript record that is SIMULTANEOUSLY the regression baseline and the v0/PROVISIONAL engine-handoff contract (owner D1). Corpus directives are the **LOWERED wire directives** — `scaffold` has no wire op; its expansion into `create`/`copyIn` directives IS the handoff truth. A separate gitignored per-run report renders the same capture for humans. Architectural seam: the corpus is a new MEMBER of the existing golden-idiom family (ADR-0048).

## 4.2 — File Changes (contract with sdd-slice)

| Path | Action | Purpose |
|---|---|---|
| `test/support/ir-transcript.ts` | Create | THE single capture path — `captureRun(run, input, seed?)` wraps `runFactoryForTest`, returns `{ record, rawDirectives, tree, emitted, error }` (R-D) |
| `test/support/corpus-format.ts` | Create | `TranscriptRecord` type + `FORMAT_VERSION`, `buildRecord(capture)`, one pure `canonicalize()`/`serializeCorpus`, `parseCorpus` — shared by writer + verifiers, no fs |
| `test/support/run-report-render.ts` | Create | `renderReport(record, rawDirectives)` (R-D), `reportPathFor(id,slug)`, `REPORTS_DIR`, exported `SEAM_DISCLAIMER` + `GAP_NOTICE` constants; kind via `dryRunPlan(rawDirectives)` |
| `test/support/author-emulation-setup.ts` | Create | Setup-materializes git-hostile + oversized fixtures (empty folder, symlink, at/over-cap byte fills); teardown (AEG-07) |
| `test/fixtures/author-emulation/factory.ts` | Create | Main CRUD factory (scaffold+copyIn+create({templateFile})) + per-scenario runner variants |
| `test/fixtures/author-emulation/schema.json` | Create | Typed-options schema (Stage-4 pattern) |
| `test/fixtures/author-emulation/schema.generated.ts` | Create | `pbuilder-codegen` output — `Input` type |
| `test/fixtures/author-emulation/files/**` | Create | Template tree: chained-token filenames, `.template` text files, illustrative "wiring" text (never AST-verified) |
| `test/fixtures/author-emulation/assets/logo.png` | Create | Tiny real binary asset (by-reference copyIn, M-06) |
| `test/fixtures/author-emulation/assets/blob.bin.template` | Create | Tiny binary `.template` for the fail-loud walk (M-08) |
| `test/fixtures/author-emulation/.gitattributes` | Create | Marks `*.png`/`*.bin.template` `binary` (AEG-04) |
| `test/e2e/author-emulation/corpus/*.transcript.json` | Create | 22 committed transcripts: `s-00` skeleton + `m-01..m-21` (consolidated) |
| `test/e2e/author-emulation/corpus/coverage-manifest.md` | Create | EXERCISED + NOT-EXERCISED ledgers + FRICTION (GCC-08) |
| `test/e2e/author-emulation/corpus/README.md` | Create | 5 literal-heading sections + family-prefix reservation (GCC-11, R-C) |
| `test/e2e/author-emulation/scenarios.ts` | Create | Shared scenario REGISTRY (R-E) — data-only `SCENARIOS` export iterated by BOTH `scripts/regen-corpus.ts` and the e2e file; FIT-26/GCC-01 counts read it |
| `test/e2e/author-emulation-scaffold.e2e.test.ts` | Create | Skeleton + 21 matrix scenarios; drives `captureRun`, compares `serializeCorpus(fresh)` vs committed; writes per-row reports |
| `test/fitness/fit-23-corpus-determinism.test.ts` | Create | FIT-23 in-process double-run byte-identity (REQ-FTG-01) |
| `test/fitness/fit-24-corpus-purity.test.ts` | Create | FIT-24 binary/abs-path/nondeterministic-field scan (REQ-FTG-02) |
| `test/fitness/fit-25-single-capture-path.test.ts` | Create | FIT-25 import-scan: 3 consumers → one capture module, no second (REQ-FTG-03) |
| `test/fitness/fit-26-report-hygiene-citations.test.ts` | Create | FIT-26 gitignore + pinned report-name fn + every matrix row cited (REQ-FTG-04) |
| `test/fitness/fit-27-anti-tautology-scan.test.ts` | Create | FIT-27 no test-reachable corpus writer; regen outside graph (REQ-FTG-05) |
| `test/fixtures/red/author-emulation/**` | Create | Planted red-proof fixtures (2nd-capture-module, corpus-write-in-support, uncited-row, abs-path-corpus, nondeterministic-field) — excluded from tsconfig |
| `scripts/regen-corpus.ts` | Create | Maintainer regeneration — the ONLY writer of the corpus dir; OUTSIDE the test-imported graph, not CI-test-runnable (FIT-27) |
| `.gitignore` | Modify | Add `test/e2e/author-emulation/reports/` (R1) |
| `openspec/pending-changes.md` | Modify | Register `PC-SPEC-FSC-TOKENS` single-filter-token gap row (D3, REQ-SCM-03) |
| `src/scaffold/*`, `src/core/wire.ts`, `src/dry-run/plan.ts`, `src/testing/index.ts` | Read-only | Landed by `schematic-local-files`; consumed, never touched |

## 4.2b — Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author runs a realistic multi-file scaffold generator; run-level IR captured to committed corpus | Create | AEG-01, ITC-01/03, GCC-01..12, SCM-01..05 | `test/e2e/author-emulation-scaffold.e2e.test.ts` (new) | 21 matrix scenarios + `s-00` skeleton; distinct from upstream `scaffold.e2e.test.ts` (surgical single-op proofs) |
| Author/engine-team inspects captured IR as a gitignored per-run human report | Create | RPT-01..05 | same e2e (per-row report side-output) | seam disclaimer + gap notice; kind via `dryRunPlan`; matrix rows only (R-B) |

## 4.2c — Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `test/support/` (shared test helpers) | extend | capture/format/report/setup modules beside `spy-client.ts`/`golden.ts` | aligns |
| golden-idiom family (Testing baseline) | new | run-level `Batch[]` transcript corpus = a new MEMBER of the documented idiom family (two exist) | aligns (ADR-0048 justifies the third member) |
| `test/fixtures/` (fixture packages) | extend | author-emulation CRUD fixture beside `typed-factory/` | aligns |
| `scripts/` (maintainer tooling) | new | out-of-band corpus regeneration, outside `src/`+test graph | aligns (maintenance tooling, no library-architecture surface) |
| `src/scaffold/**`, `src/core/wire.ts`, `src/dry-run/plan.ts`, `src/testing/**` | read-only | landed dependency from `schematic-local-files`, consumed once merged | aligns (no touch) |
| `src/dialects/typescript/**`, `.raw()`/ts-morph (sensitive) | none | scope excludes dialect surface | aligns (not touched) |

No `deviates` rows: the corpus idiom joins an existing documented category rather than introducing a new architectural layer/boundary. This REFINES explore's `deviates` call — the golden-idiom category pre-exists; this is a new member, ADR-justified.

## 4.3 — Data Model (corpus record — GCC-06 canonical key order, design-ratified)

`TranscriptRecord` self-labels regions via top-level `normative`/`informative` keys (GCC-11 — a raw-file reader sees what binds). **Placement note (deviation from the council envelope list, with reason)**: `outcome` lives INSIDE `normative` (not top-level) so the entire binding region is exactly the `normative` subtree — clean GCC-11 self-labeling with no split/duplicated normative field.

```ts
const FORMAT_VERSION = 0;
interface TranscriptRecord {
  formatVersion: number;              // independent of wire protocolVersion (GCC-02)
  scenarioId: string;                 // "m-01" | "s-00"
  slug: string;                       // kebab
  normative: {
    outcome: "committed" | "rejected";              // terminal outcome (binds)
    directives: NormativeDirective[]; // ordered LOWERED wire directives, walk order (GCC-07); EMPTY on rejection (GCC-09)
    rejection?: { reason: string; verb: string | null; path: string | null }; // triple; verb/path null when unattributable (R-F, mirrors accessor's `| undefined`); origin OMITTED (derivable); NO message text
  };
  informative: { batchGrouping: { directiveCount: number; protocolVersion: number }[] }; // captured, not diff-failing
}
// NormativeDirective per-op key order (lowered wire shape):
//   create : { op, pathTemplate, template, options, force }
//   copyIn : { op, from, to, force }   // by-reference carries NO content field
```

**Envelope key order**: `formatVersion, scenarioId, slug, normative, informative`. **normative**: `outcome, directives, rejection`. **rejection**: `reason, verb, path`. **batchGrouping[]**: `directiveCount, protocolVersion` (surfaces `protocolVersion` beside the top-level `formatVersion` so GCC-02.1's two-visibly-independent-fields check has both to read).

**Canonical serialization (ADR-0049)**: UTF-8 **no BOM**, **LF**, 2-space pretty JSON, exactly one trailing newline; objects built key-by-key in the pinned order (never JS iteration order); `create.options` subtree recursively **lexicographically key-sorted** (JS integer-like-key reordering is the silent FIT-23 breaker); `force` always emitted as a boolean (default `false`). ONE pure `canonicalize()` is shared by the regen writer AND every verifier (no fs) so writer/verifier drift is impossible.

## 4.4 — Interface Contracts

- **Capture (`ir-transcript.ts`)**: `captureRun<O>(run, input, seed?) => Promise<{ record: TranscriptRecord, rawDirectives: readonly Directive[], tree, emitted: Batch[], error: unknown }>`. Internally `await runFactoryForTest(run, input, seed)` (R-A). `rawDirectives = emitted.flatMap(b=>b.instructions)` — the renderer's input (R-D). `error === undefined` → `outcome:"committed"`, `normative.directives` = the same flattened sequence normalized to lowered wire shape; `AuthoringError` → `outcome:"rejected"`, empty `directives` + attribution triple passed through VERBATIM (`reason`, `verb`|null, `path`|null — upstream already mints package-relative paths, R-F). `tree` (from `runFactoryForTest`) backs M-21's `result.tree`-empty assertion directly. `spy-client.ts` untouched (ITC-04). This module is THE single capture path (FIT-25).
- **Corpus (`corpus-format.ts`)**: `buildRecord(capture,{scenarioId,slug})`, `serializeCorpus(record):string` (calls `canonicalize`), `parseCorpus(text)`. Pure. NO write to the corpus dir anywhere in `test/**` (FIT-27).
- **Report (`run-report-render.ts`)**: `renderReport(record: TranscriptRecord, rawDirectives: readonly Directive[]): string` (R-D) — entry lines = `dryRunPlan(rawDirectives)` (`src/dry-run/plan.ts`, the frozen `WIRE_TO_AUTHOR_VERB`/kind mechanism `dryRun()` uses), giving `verb + package-relative path + kind` directly — NEVER derived from the normalized record, NEVER a parallel op→kind map (RPT-01). The kind column is merge-GATED (R-D-b); the ungated skeleton renders `verb + path` via the current 6-op map. Header emits exported `SEAM_DISCLAIMER` (literal `"IR captured at the EngineClient seam — nothing was engine-rendered"`) + `GAP_NOTICE` (three items: module-wiring, tsconfig-AST, template rendering) from single constants a test asserts verbatim (RPT-05). Three templates: success / rejection / empty. `reportPathFor(id,slug)` → `test/e2e/author-emulation/reports/<matrix-id>.<slug>.report.md` (mirrors corpus stem); `REPORTS_DIR` is the single pinned constant (FIT-26). Rendered for matrix rows only — `s-00` gets no report (R-B).
- **Regen (`scripts/regen-corpus.ts`)**: imports capture + corpus-format, iterates `SCENARIOS` from `test/e2e/author-emulation/scenarios.ts` (R-E — the same export the e2e iterates), writes `serializeCorpus` output to each corpus file. The ONLY corpus-dir writer. Not imported by any test; not on the CI test command.
- **Scenario registry (`test/e2e/author-emulation/scenarios.ts`)**: data-only (R-E) — `interface ScenarioEntry { id: string; slug: string; run: FactoryRunner; input: unknown; seed?: Record<string,string>; expected: "committed" | "rejected"; gated: boolean }`; `export const SCENARIOS: readonly ScenarioEntry[]`. No fs, no writes, no capture-module import.
- **Write-boundary partition**: corpus dir (`test/e2e/author-emulation/corpus/`) writable ONLY from `scripts/regen-corpus.ts`; reports dir (`test/e2e/author-emulation/reports/`, gitignored) writable from test-reachable code. FIT-27 scans corpus writes ONLY — it must not over-reach onto reports.

### Corpus README — 5 literal section headings (GCC-11 grep targets)
`## What This Corpus Is` · `## Normative Status` · `## How It Is Regenerated` · `## The NOT-EXERCISED Ledger` · `## Reference`. Includes the `formatVersion`↔`protocolVersion` independence sentence (GCC-02) and the family-prefix reservation sentence (R-C). Each corpus record self-labels via `normative`/`informative` keys.

### coverage-manifest.md structure (GCC-08)
- **EXERCISED** table: every `schematic-local-files` REQ-ID appearing in the matrix `Citation(s)` column → its row id(s); pre-mapped for all 21 rows + `s-00`. Operational definition of "cited" = present in a matrix row's `Citation(s)` column.
- **NOT-EXERCISED** ledger: exactly the 5 literal tokens — `module-wiring`, `tsconfig-AST`, `template rendering`, `REQ-BRC-08`, `REQ-PRC-06`.
- **FRICTION** section: ≥1 entry `{friction, disposition}` or the literal `none observed`.

### FIT failure-message taxonomy (FIT-23..27)
Every fitness failure names: guard id + broken invariant + named offender + rule cite (e.g. `FIT-27: test-reachable corpus writer — test/support/foo.ts:12 writes corpus/ — REQ-FTG-05`).

## 4.5 — Architecture Decisions

### ADR-0047: Corpus Authority — Normative Core, Informative Shell

**Status**: Proposed
**Context**: The committed corpus is both regression baseline and v0 engine-handoff contract (D1); its real consumer (the engine) does not exist until PC-PROTO-01. Over-pinning (rendered output, batch boundaries, timestamps as binding) would make incidental changes false-fail and mislead the future engine about what binds.
**Decision**: NORMATIVE (`normative` subtree) = terminal outcome + ordered lowered-wire directive sequence (create: op/pathTemplate/template/options/force; copyIn: op/from/to/force; walk order per GCC-07) + rejection triple. INFORMATIVE (`informative` subtree) = batch/chunk grouping. `formatVersion` is independent of wire `protocolVersion` (GCC-02). Rendered `{{}}`/`{= =}` output and by-reference bytes are NEVER in the corpus (ITC-03). Records self-label regions.
**Consequences**: (+) chunk-boundary drift never reads as directive drift; honest "shape only" handoff. (−) walk order is NORMATIVE though upstream does not pin it (`walk.ts` sorts) — documented risk; upstream re-pinning → format revisit via ADR. (+) v0/provisional posture avoids premature polish.
**Alternatives**: **Whole-file binding (grouping included)** — a legal re-chunk would false-fail; rejected as over-pinning. **Whole-file informative (nothing binds)** — no regression value; rejected as under-pinning. **Capture rendered output** — impossible (fake never renders) and breaks the evidence boundary.

### ADR-0048: A Third Golden Idiom — Run-Level Transcript Capture, Single Path, No Self-Heal

**Status**: Proposed
**Context**: Two golden idioms exist: `test/golden-ir/` (in-source `Directive` literals, single-directive unit) and `test/dialects/typescript/golden/` (byte-exact single-file print). Neither captures a whole realistic author RUN. A third could read as idiom drift (council flag); a self-regenerating corpus would be a tautology.
**Decision**: Add a physically separate third idiom at `test/e2e/author-emulation/corpus/` capturing the run-level `Batch[]` via `runFactoryForTest` (R-A) — a genuinely different unit (whole-run lowered-directive sequence). Exactly one capture module; corpus writer/report/e2e all import it (ITC-02/FIT-25). No test-reachable module writes the corpus dir (FIT-27 write-boundary partition); regeneration lives only in `scripts/regen-corpus.ts`; tests READ + compare, drift fails, no self-heal (GCC-05).
**Consequences**: (+) reuses the normative recording harness; matches `test/support/` convention; adds the run-level unit the other two lack; drift is a hard failure. (−) three idioms coexist (mitigated by physical separation + README) and corpus updates are a deliberate out-of-band step (intended friction). (+) reusable by future per-family e2e changes.
**Alternatives**: **Unify all idioms into one harness** — retrofits archived stages' tests, scope creep vs L (explore Approach 2). **In-test `--update` flag** — the exact tautology this prevents. **Wrap `makeSpyClient`** — no `tree`/`error`, breaks GCC-09/M-21 (superseded by R-A). All rejected.

### ADR-0049: Canonical Serialization Binds the Reader Too

**Status**: Proposed
**Context**: Determinism (GCC-04/FIT-23) and purity (GCC-06/FIT-24) require byte-identical corpus output across runs and a raw-file reader (the future engine) able to parse without hidden conventions. JS object key order and integer-like-key reordering silently break byte-determinism.
**Decision**: One pure `canonicalize()` (UTF-8 no BOM, LF, 2-space, one trailing newline, pinned key order built explicitly, `options` recursively lexicographically key-sorted, `force` always boolean) shared by the regen writer AND every verifier. The serialization is part of the contract the engine reader honors, not an internal test detail.
**Consequences**: (+) writer/verifier drift impossible; the reader has a stable grammar. (−) any format-key change is a `formatVersion`-relevant event, not a silent refactor. (+) `options` sorting kills the most common determinism regression.
**Alternatives**: **`JSON.stringify` default order** — non-deterministic across engines/keys; rejected. **Serialization as a test-only concern** — leaves the engine reader guessing; rejected (binds the reader too).

## 4.6 — Test Derivation

Level `e2e` = matrix scenario via `captureRun`+corpus compare; `architectural` = fitness/static scan or mechanical verify-final check; `unit`/`type` = fixture/compile/synthetic-record. **UNGATED** = buildable now (skeleton + infra, existing ops); **GATED** = needs `schematic-local-files` merge (scaffold/copyIn/create({templateFile})).

| REQ scenario | Level | Test | Gate |
|---|---|---|---|
| SCM-01.1 matrix=21 | architectural | fit-26 (row count+citations) | UNGATED |
| SCM-02.1 engine-gated as notes | architectural | manifest check (verify-final) | UNGATED |
| SCM-03.1 chained token vs hardcoded literal | e2e | e2e M-04 chained-token | GATED |
| SCM-04.1 no dup unit edge | architectural | fit-26 / manifest cross-check | UNGATED |
| SCM-05.1 rejection triple | e2e | e2e M-15 | GATED |
| ITC-01.1 three batches ordered | e2e | e2e capture unit (3-flush factory) | UNGATED |
| ITC-01.2 zero-emission empty record | e2e | e2e M-14 / skeleton | UNGATED |
| ITC-02.1 single capture import | architectural | fit-25 | UNGATED |
| ITC-03.1 no render/bytes assert | architectural | fit-25 + source scan | UNGATED |
| ITC-04.1 placement, spy untouched | architectural | fit-25 + path assert | UNGATED |
| ITC-05.1 no cross-family branch | architectural | fit-25 source scan | UNGATED |
| GCC-01.1 file count = rows+skeleton | architectural | fit-26 / manifest | UNGATED (skeleton) |
| GCC-02.1 formatVersion independent | unit | corpus-format unit (both fields present) | UNGATED |
| GCC-03.1 chunk-only ≠ drift | unit | corpus-format unit (normative compare) | UNGATED |
| GCC-04.1 byte determinism | architectural | fit-23 | UNGATED (skeleton) |
| GCC-05.1 drift fails, no self-heal | architectural | fit-27 + e2e compare | UNGATED |
| GCC-06.1 pure text, rel-path | architectural | fit-24 | UNGATED |
| GCC-06.2 no nondeterministic field | architectural | fit-24 | UNGATED |
| GCC-07.1 walk order normative | e2e | e2e M-01 (sorted-order assert) | GATED |
| GCC-08.1 manifest 4-point checklist | architectural | verify-final manifest check | UNGATED |
| GCC-09.1 rejection record shape | e2e | e2e M-13 | GATED |
| GCC-10.1 pinned names | architectural | fit-26 / path scan | UNGATED |
| GCC-11.1 README 5 sections+self-label | architectural | verify-final README grep | UNGATED |
| GCC-12.1 skeleton pre-merge RED-provable | e2e | e2e s-00 + fit-23/24/27 | UNGATED |
| RPT-01.1 kind derived not duplicated | unit+arch | report render unit (mixed rawDirectives incl. copyIn, kind column) + fit-26 no-parallel-map source scan | GATED (R-D-b; no-parallel-map scan part UNGATED) |
| RPT-02.1 git clean after run | architectural | fit-26 (.gitignore) + e2e | UNGATED |
| RPT-03.1 idempotent name, no collide | e2e | e2e report path (re-run + two matrix rows) | GATED |
| RPT-04.1 no aggregate committed | architectural | fit-26 / tracked-file scan | UNGATED |
| RPT-05.1 entry triple + header notices | unit | report render unit (synthetic record, literal constants) | GATED for the full triple incl. kind (R-D-b); header constants + verb+path skeleton UNGATED |
| AEG-01.1 one run, three verbs | e2e | e2e M-01 | GATED |
| AEG-01.2 seven fields fixture-wide | e2e | e2e coverage assert across scenarios | GATED |
| AEG-02.1 no modify/wiring directive | e2e | e2e M-01 transcript scan | GATED |
| AEG-03.1 typed options compile | type | fixture compiles vs `Input` (tsc) | UNGATED |
| AEG-04.1 binary gitattributes marked | architectural | fit-24 / .gitattributes assert | UNGATED |
| AEG-05.1 chained-token filename ships | architectural | fixture files scan | UNGATED |
| AEG-06.1 FRICTION section present | architectural | verify-final manifest check | UNGATED |
| AEG-07.1 empty+symlink setup-materialized | architectural | setup module + tracked-file scan | UNGATED |
| FTG-01.1 fit-23 red on nondeterminism | architectural | fit-23 red-proof | UNGATED |
| FTG-02.1 fit-24 red on abs path | architectural | fit-24 red-proof | UNGATED |
| FTG-03.1 fit-25 red on 2nd module | architectural | fit-25 red-proof | UNGATED |
| FTG-04.1 fit-26 red on uncited row | architectural | fit-26 red-proof | UNGATED |
| FTG-05.1 fit-27 red on corpus write | architectural | fit-27 red-proof | UNGATED |
| FTG-05.2 regen outside test graph | architectural | fit-27 import-graph scan (reuse scan-roots) | UNGATED |

All 39 REQs (43 scenarios) covered. Both Flow Changes (Create) gain e2e rows. UNGATED set = the walking skeleton (`s-00`) + infra spine + fitness guards + report-render units (slice input); GATED set = the 21 matrix scenarios needing the landed scaffold API.

## 4.7 — Fitness Functions

- FIT-23 corpus byte-determinism (in-process double-run) — `fit-23-*`.
- FIT-24 corpus purity (no binary/abs-path/nondeterministic field) — `fit-24-*`.
- FIT-25 single capture path (import-scan, three consumers → one module, no second) — `fit-25-*`, reuses `test/support/import-scan.ts`.
- FIT-26 report hygiene (`.gitignore` + pinned `REPORTS_DIR`/`reportPathFor` + no aggregate) + every matrix row cites a REQ/boundary — `fit-26-*`.
- FIT-27 anti-tautology (no test-reachable corpus writer; regen outside graph) — `fit-27-*`, reuses `import-scan.ts` + `scan-roots.ts`; scopes to the corpus dir ONLY (reports excluded).

Each carries a real assertion + `[red-proof]` cases (planted fixtures under `test/fixtures/red/author-emulation/**` and/or inline simulated sources), per the repo FIT convention (FIT-21 idiom), with the §4.4 failure-message taxonomy.

## 4.8 — Migration / Rollout

No migration. No DB, feature flag, or deploy ordering. Rollback = delete the new files + revert the two edited lines (`.gitignore`, `pending-changes.md`); `bun test` returns to baseline. Build gate: the 21 matrix (GATED) slices apply after `schematic-local-files` merges and re-verify against the landed API; the `s-00` skeleton + infra spine + fitness guards + report-render units (UNGATED) build now.

## 4.9 — Performance Considerations

Negligible. Oversized/at-cap fixtures (M-07/M-11) are setup-materialized (deterministic byte fills), never committed — avoids repo bloat and keeps the corpus content-free for those rows (by-reference or rejection). No 4 MiB blob is committed.

## 4.10 — Architecture Impact

**Architecture impact**: additive
**Rationale**: Adds the run-level transcript-capture idiom (new member of the Testing baseline's golden-idiom family, ADR-0048), a `test/support/` module cluster, an author-emulation fixture, and a `scripts/` maintenance dir — all `aligns`/`new-member`, zero `deviates`. No `src/` layer, boundary, dependency direction, data-ownership line, pattern, or public-API surface changes. The baseline's Testing section gains an idiom; nothing in it becomes wrong → additive (triggers `arch_refresh_post_verify` to record the third idiom).

## 4.11 — Open Questions

None.
