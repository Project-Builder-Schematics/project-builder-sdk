# Architecture Audit — project-builder-sdk

Performed: 2026-07-14 14:41
Baseline: engram obs #2001 (mirror of `openspec/architecture.md`, "Updated: 2026-07-14 (post stage-6-release-shape, additive refresh)")
Change under audit: `author-emulation-e2e-scaffold` (L, declared `architecture_impact: additive`)
Comparison base: `origin/main` @ 064c84a (the true base — local `main` ref 04c141e is stale, pre-`schematic-local-files`; baseline commit b59fe07 is an ancestor of `origin/main`).

## Headline

Zero `src/` drift — the entire change is test-infrastructure (a third golden idiom `test/e2e/author-emulation/corpus/`, capture/format/report support modules, fitness guards FIT-24..28, an author-emulation fixture package, and the out-of-band `scripts/regen-corpus.ts`). The IR-seam boundary is respected: the capture module wraps the SDK-side `./testing` facade at the `EngineClient` port, records no by-reference bytes, and carries no engine-side knowledge. The `additive` declaration is ratified.

## Verdict

Overall: ⚠ notes (additive Testing-section delta to fold into the baseline at archive — no violations, does NOT block archive)
Categories: 8 clean · 1 note (Testing) · 0 violations

## Drift (since last scan)

- Testing: a THIRD golden idiom added — `test/e2e/author-emulation/corpus/` (22 committed IR-transcript records: `m-01`..`m-21` + `s-00`), a peer to the existing `test/golden-ir/` golden. The baseline's Testing section does not yet name it.
  Evidence: `test/e2e/author-emulation/corpus/*.transcript.json` (22 files), `test/e2e/author-emulation/corpus/coverage-manifest.md`
- Testing: fitness suite grew 23 → 28 files (+5) — FIT-24 (corpus purity), FIT-25 (single capture path), FIT-26 (report hygiene + matrix-row citations), FIT-27 (anti-tautology static scan), FIT-28 (corpus byte-determinism).
  Evidence: `test/fitness/fit-24-corpus-purity.test.ts` .. `test/fitness/fit-28-corpus-determinism.test.ts`
- Testing: new author-emulation support cluster under `test/support/` — `ir-transcript.ts` (the single capture path, R-A, FIT-25), `corpus-format.ts` (record normalization + serialization), `run-report-render.ts` (per-run report), `author-emulation-setup.ts`.
  Evidence: `test/support/{ir-transcript,corpus-format,run-report-render,author-emulation-setup}.ts`
- Testing: new author-emulation e2e leg + a real fixture author-package used to drive it.
  Evidence: `test/e2e/author-emulation-scaffold.e2e.test.ts`, `test/e2e/author-emulation/*`, `test/fixtures/author-emulation/` (`collection.json`, `schema.json`, `factory.ts`, `files/`, `templates/`, `assets/`)
- Build / Deploy: a maintainer-run, out-of-band corpus regenerator `scripts/regen-corpus.ts` — deliberately OUTSIDE the test-import graph (name does not end in `.test.ts`; never imported by any test), so the corpus can never be self-updated by a test run (the FIT-27 anti-tautology guarantee).
  Evidence: `scripts/regen-corpus.ts:1-9`
- Conventions: `.gitignore` gains `test/e2e/author-emulation/reports/` — per-run reports are a gitignored side-output while `corpus/` stays committed (RPT-02).
  Evidence: `.gitignore:29-30`

## Per-check evidence (task-directed)

1. Zero `src/` drift — CONFIRMED.
   - `git diff --name-only origin/main HEAD -- src/` → 0 files. Layers, dependency direction, and public API surface are byte-identical to the baseline.
   - `test/fitness/pkg-surface-baseline.json` is NOT in this change's diff vs `origin/main` — the frozen public package surface (`package.json#exports` 5 subpaths + `#bin`) is untouched. (It appeared only in the stale-`main` three-dot diff as merge noise from `schematic-local-files`/`stage-6`, already on `origin/main`.)
   - `tsconfig.build.json` likewise not in the vs-`origin/main` diff — same merge-noise artifact.

2. IR-seam boundary — NOT violated.
   - `test/support/ir-transcript.ts` imports only SDK-side surfaces: `runFactoryForTest` from `src/testing/index.ts` (the `./testing` facade over `ContractFake`, the sole normative `EngineClient`), plus the `Batch`/`Directive` types from `src/core/wire.ts` and `AuthoringError` from `src/core/authoring-error.ts`. It observes the emitted wire (`result.emitted`) and the terminal tree/error — the SDK side of the seam. No engine internals, no target-tree `fs`, no second port.
   - By-reference bytes never captured: `normalizeDirective` records `copyIn` as `{ from, to, force }` only (no content field), and a non-`create`/`copyIn` op throws loudly (ITC-05). This upholds the baseline's BRC-04 evidence-boundary invariant ("no by-reference bytes in `result.tree`/corpus").
   - `scripts/regen-corpus.ts` uses the SAME single capture path (`captureRun`) — no alternate seam.

3. `additive` declaration — RATIFIED.
   - No `src/` change; no boundary, dependency-direction, data-ownership, or pattern change. `src/scaffold/` (the `schematic-local-files` leaf) already lives on `origin/main` and is untouched here.
   - The two pre-existing files modified are additive-only: `test/support/import-scan.ts` HOISTS shared helpers (`walkReachable`, `collectTsFiles`, `stripComments`) consumed by FIT-25/26/27, leaving the existing `specifiersResolvingInto` export unchanged; `.gitignore` adds one ignore rule. Everything else is new files.
   - The change introduces new TEST conventions (a third golden idiom, the single-capture-path rule FIT-25, the out-of-band-regeneration ritual FIT-27, corpus byte-determinism FIT-28) — additive within the existing four-layer testing pyramid, not a new architectural layer or seam. `additive` is the correct classification.

## Baseline-refresh delta to record at archive

Fold the following into `openspec/architecture.md` (and mirror obs #2001) at archive — Testing section, plus one Conventions line:

- Testing → golden idioms: add the THIRD golden — `test/e2e/author-emulation/corpus/` (committed IR-transcript records, peer to `test/golden-ir/`), regenerated only out-of-band via `scripts/regen-corpus.ts`.
- Testing → fitness: 23 → 28 files (+5). Add FIT-24 (corpus purity: no binary bytes / absolute paths / nondeterministic fields), FIT-25 (single capture path — one module wraps `runFactoryForTest`), FIT-26 (report hygiene + every matrix row cites a REQ/boundary), FIT-27 (anti-tautology static scan — no in-test corpus write path), FIT-28 (corpus byte-determinism).
- Testing → support cluster: `test/support/ir-transcript.ts` (single capture path), `corpus-format.ts`, `run-report-render.ts`, `author-emulation-setup.ts`.
- Testing → e2e: `test/e2e/author-emulation-scaffold.e2e.test.ts` + `test/e2e/author-emulation/*`; fixture author-package `test/fixtures/author-emulation/`.
- Build/Deploy (or a Scripts/Conventions line): `scripts/regen-corpus.ts` — out-of-band corpus regenerator, outside the test-import graph (FIT-27 guarantee).
- Conventions: a new golden-corpus authoring convention — exactly ONE module (`test/support/ir-transcript.ts`) wraps `runFactoryForTest`; the corpus is regenerated only by `scripts/regen-corpus.ts`, never by a test.
- Note (no ADR required): this change is test-infra-only; no `src/` ADR is implicated. Record `architecture_impact: additive` in the impact ledger.

## Risks

- Low. The one behavioral coupling to pre-existing code is `test/support/import-scan.ts` helper-hoisting; FIT-01/FIT-15/FIT-22 (the consumers of the untouched `specifiersResolvingInto`) still pass, and the hoist is documented as byte-identical to FIT-01's own private copies.
- Watch-item (not a violation): FIT-27 relies on `scripts/regen-corpus.ts` staying OUT of the `bun test` discovery glob (name must never end `.test.ts`) and out of the test-import graph — a future rename would break the anti-tautology guarantee. This is self-guarded by FIT-27.

Source: engram obs #2065 (topic sdd/project-builder-sdk/architecture-audit, revisions: 2) · against baseline obs #2001
