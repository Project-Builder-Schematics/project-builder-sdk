# Design: Stage 6 — Release shape & DX closure (rev 3)

**Change**: `stage-6-release-shape` · **Triage**: L · **Spec**: V3 signed (four domains, PPH-07/08 deferred) · **Persona lens**: none
**Architecture impact**: additive
**Revision**: rev 3 — placeholder descoped per steward CQ2 owner ruling (supersedes rev 2's npm
placeholder seam; council-diff rulings + owner ruling on ADR-0041 from rev 2 remain applied; see
§4.12 for rev-2 design notes, still valid except where this revision marks a row deferred).

## 4.1 Architecture Overview

Stage 6 packages an already-built authoring surface — it adds NO runtime behaviour to `src/`.
Three seams, all additive: (1) a **hardened-but-never-fired publish pipeline** (`publish.yml` gains
a repo-owner guard, SHA pins, job-scoped `id-token`, retained `--dry-run`); (2) an **author docs
set** under `docs/` following the `authoring-a-dialect.md` house style; (3) a **local-consumption
proof** — the existing installed-consumer e2e grows a `bun link` leg with parity, never a reduced
smoke test. Stage-6 performs ZERO registry writes: the npm placeholder seam from rev 2 is DEFERRED
to the public-package plan (steward CQ2 owner ruling, 2026-07-12 — the `@pbuilder` scope is already
owner-controlled, so a placeholder buys no security today). The IR-seam pattern, invariant #5, the
five-subpath `exports` map, and the single `ts-morph` dependency are all untouched. `dist/core/**`
keeps shipping (documented, not stripped) because `./testing` imports `../core/context.ts` at
runtime — the ADR-0034 "ship the file, don't map it in `exports`" posture, extended.

Reuse seam: `runScratchScript` + build/pack/install (today file-local in the e2e) is extracted to
`test/support/scratch-consumer.ts` and consumed by BOTH the e2e (tarball + new link legs) and the new
docs-as-test — de-forking rather than duplicating. The docs machine leg executes fenced blocks inside
that linked/installed consumer (package-name import), NEVER the `src/`-swap path the testing-story docs use.

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `package.json` | Modify | `prebuild` clean script (REQ-PPH-04); `scripts.link:sdk = "bun run build && bun link"` convenience script (ADR-0041); exports/files confirmed unchanged |
| `tsconfig.build.json` | Modify | `declarationMap: false` (REQ-PPH-05) |
| `.github/workflows/publish.yml` | Modify | W3 owner guard, SHA-pin checkout+setup-node, job-scoped `id-token`, retain `--dry-run` (REQ-PPH-01/02/03) |
| `.github/workflows/ci.yml` | Modify | SHA-pin `actions/checkout` (design ruling: pin it too) |
| ~~`tools/npm-placeholder/package.json`~~ | ~~Create~~ | **DEFERRED to public-package plan (steward CQ2)** — was: inert stub manifest, version `0.0.1`, no exports/scripts/deps (REQ-PPH-07/08, now deferred) |
| ~~`tools/npm-placeholder/README.md`~~ | ~~Create~~ | **DEFERRED to public-package plan (steward CQ2)** |
| ~~`tools/npm-placeholder/RUNBOOK.md`~~ | ~~Create~~ | **DEFERRED to public-package plan (steward CQ2)** — owner runbook (manual publish + immediate `npm deprecate`) travels with the deferred REQ-PPH-07.4 |
| `docs/quickstart.md` | Create | schema.json → codegen → typed `factory.ts` → passing test; `bun run link:sdk` first; links dialect doc; codegen invocation pinned to `pbuilder-codegen <package-dir>` — ONE positional arg, NO flags (REQ-AOD-01/02/04) |
| `docs/authoring-verbs.md` | Create | six verbs + read-trichotomy (REQ-AOD-03) |
| `docs/authoring-errors.md` | Create | `AuthoringError` verb/path/reason, author vocabulary (REQ-AOD-05) |
| `docs/dry-run.md` | Create | `dryRun()` from `./commons` (REQ-AOD-06) |
| `docs/authoring-a-dialect.md` | Read-only | linked as dialect-usage entry, not duplicated (REQ-AOD-04) |
| `docs/README.md` | Create | doc index — reading path + links to `authoring-a-dialect.md` (REQ-AOD-04.1) |
| `README.md` | Modify | quickstart link + dialect front-door (row 143); `dist/core` document rationale (REQ-FPS-06.2) |
| `ROADMAP.md` | Modify | release-readiness milestone (REQ-AOD-09.3) |
| `openspec/pending-changes.md` | Modify | retire 27/33/34/35/86/143; re-tag 74/56/142/175; new required-reviewers go-live entry (REQ-AOD-09) |
| `openspec/problem-statement.md` | Modify | consistency with release-readiness posture (REQ-AOD-09) |
| `openspec/objectives-plan.md` | Modify | demo narrative calls `dryRun()` before first read/dialect-open (REQ-AOD-10) |
| `openspec/sensitive-areas.md` | Modify | deployment low→medium; supply-chain notes; correct blanket sentence (REQ-AOD-12) |
| `openspec/changes/stage-6-release-shape/walkthrough-record.md` | Create | owner-recorded binary pass/fail human walkthrough (REQ-AOD-08), authored at steward-reckoning |
| `test/support/scratch-consumer.ts` | Create | shared build/pack/install + build/link + `runScratchScript` seam |
| `test/e2e/installed-consumer.e2e.test.ts` | Modify | add `bun link` leg (parity) via the `link:sdk` script (ADR-0041), `./typescript` probe, `dryRun()` invocation, bin executability (REQ-LC-01..05) |
| `test/build/build-config.test.ts` | Create | `prebuild` present, `declarationMap:false` (REQ-PPH-04.1, REQ-PPH-05.1) |
| `test/fitness/fit-14-package-surface.test.ts` | Modify | no `.d.ts.map` ships, positive no-secrets scan, `dist/core/**` present (REQ-PPH-05.2/06.1, REQ-FPS-06.1/07) |
| `test/fitness/pkg-surface-baseline.json` | Modify | regenerate AFTER prebuild-clean + declarationMap:false land (REQ-PPH-06) |
| `test/fitness/fit-23-publish-workflow-guard.test.ts` | Create | W3 guard, SHA pins (both workflows), `--dry-run`, trigger-surface (REQ-PPH-01/02/03) — **archive-time correction: shipped as `fit-23` (filename collision on `main` with `fit-21`/`fit-22` taken by `stage-5b-dialect-breadth`/`schematic-local-files`), same content and coverage** |
| ~~`test/fitness/fit-22-placeholder-inertness.test.ts`~~ | ~~Create~~ | **DEFERRED to public-package plan (steward CQ2)** — was: full stub inertness + semver floor + runbook deprecate step (REQ-PPH-07/08, now deferred) |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Read-only | five-subpath contract unchanged; confirms no exports drift |
| `test/docs/quickstart-docs.test.ts` | Create | machine leg (scratch consumer) + consumer `tsc --noEmit` leg + install-ritual checks (REQ-AOD-01.3/07/11, 02) |
| `test/docs/doc-set-content.test.ts` | Create | verb/error/dry-run/dialect token checks + planning-doc & sensitive-areas reconciliation (REQ-AOD-03/04/05/06/09/10/12, FPS-06.2) |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author: local install via `bun run link:sdk` → typed factory → passing test | Modify | REQ-LC-01..05 | `test/e2e/installed-consumer.e2e.test.ts` (extend — link leg, exercises the same `link:sdk` script) | link leg added to the existing tarball vehicle at scenario parity |
| Author: docs-only onboarding (install → typed factory using ONLY docs) | Create | REQ-AOD-01/07/08/11 | `test/docs/quickstart-docs.test.ts` (new) + `walkthrough-record.md` (human) | no docs-driven path existed |
| Maintainer: build → pack → rehearsed (never-fired) publish | Modify | REQ-PPH-01/02/03 | `test/fitness/fit-23-publish-workflow-guard.test.ts` | config/CI flow — verification is `architectural` (a live run is deliberately never fired); see note below |

**Note (intentional heuristic deviation)**: the maintainer flow carries no live-runtime e2e row — by
design the publish pipeline NEVER fires (REQ-PPH-03). Its executable proof is the workflow-guard fitness
(fit-23) plus the CI `--dry-run` rehearsal. Fabricating a live-publish e2e would be theatre; the flow has
no runtime surface to drive.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `package.json#exports` (Public API) | extend | bun-link consumption reuses the five-subpath map; no new subpath | aligns |
| `package.json#scripts`, `tsconfig.build.json` (Build/Deploy) | modify | `prebuild` clean, `link:sdk` convenience script, `declarationMap:false` | aligns (ADR-0034 amendment, ADR-0041) |
| `package.json#files`/tarball (Build/Deploy) | modify | `dist/core/**` documented-not-stripped; baseline regen | aligns (ADR-0034 precedent) |
| `.github/workflows/{publish,ci}.yml` (Build/Deploy) | modify | W3 guard, SHA pins, job-scoped id-token; hardens existing dry-run-staged convention | aligns |
| ~~`tools/npm-placeholder/` (Build/Deploy tooling)~~ | ~~new~~ | **DEFERRED to public-package plan (steward CQ2)** | — |
| `docs/` (Conventions) | new | quickstart + verb/error/dry-run set | aligns (matches `authoring-a-dialect.md` house style) |
| `test/{e2e,docs,fitness,build}` + `test/support/scratch-consumer.ts` (Testing) | extend | link leg, docs-as-test, workflow guards, shared scratch seam | aligns |

All active rows `aligns`; no boundary, dependency direction, data-ownership line, or the IR-seam
pattern is modified. `tools/npm-placeholder/` is deferred to the public-package plan and no longer
touches this change's baseline.

## 4.3 Data Model

No data-model changes. New config shapes only:
- ~~Placeholder manifest: `{ name: "@pbuilder/sdk", version: "0.0.1", license: "MIT", private: false, files: ["README.md"] }` — no `exports`, no `scripts`, no `main` (or a throwing one), no `dependencies`.~~ **DEFERRED to public-package plan (steward CQ2)**.
- `package.json#scripts.prebuild = "rm -rf dist"`.
- `package.json#scripts["link:sdk"] = "bun run build && bun link"` — explicit npm script, not a lifecycle hook; nothing executes at install time (ADR-0041).

## 4.4 Interface Contracts

No public interface change. `exports`, `bin`, and every `.d.ts` are byte-stable (FIT-09/FIT-14 confirm).
Author-facing docs describe the CURRENT `./testing` import for `defineFactory` (no relocation).
**Load-bearing codegen bin contract (unchanged, pinned for docs)**: `pbuilder-codegen <package-dir>` takes
ONE positional argument and NO flags — any leading-dash arg is rejected with `USAGE` + exit 1
(`bin/pbuilder-codegen.ts:171-174`). Output is fixed: an adjacent `schema.generated.ts` exporting
`export type Input`, with success reported as `pbuilder-codegen: wrote schema.generated.ts`
(`bin/pbuilder-codegen.ts:21`). Any doc surface showing `--schema`/`--out`-style flags is factually
wrong and fails the human walkthrough (REQ-AOD-08).

## 4.5 Architecture Decisions

- **ADR-0040** — DEFERRED to the public-package plan (steward CQ2 owner ruling, 2026-07-12); the
  npm placeholder mechanics reasoning (version `0.0.1` floor, committed inert stub, manual
  publish-then-deprecate runbook) travels with that plan, not this change.
- **ADR-0041** — bun-link consumption contract: documented build-then-link ritual + `link:sdk` convenience script, no `prepare` script (owner ruling 2026-07-12).
- **ADR-0042** — publish rehearsal interlock: three-part in-repo guard + go-live-precondition debt.
- **ADR-0034 AMENDMENT** — `dist/core/**` document-not-strip + `declarationMap:false` (ship-unmapped, extended).

(ADR IDs start at 0040: 0037/0038 committed on this branch; stage-5b's plan claims 0039 on `main` — avoided per lesson #648.)

## 4.6 Test Derivation

| REQ scenario | Level | Test | Flow ref |
|---|---|---|---|
| REQ-LC-01.1/.2 (5 subpaths + /core) | e2e | `installed-consumer.e2e.test.ts` (link leg) | local-install |
| REQ-LC-02.1/.2/.3 (founding-bug parity + count) | e2e | `installed-consumer.e2e.test.ts` (link leg) | local-install |
| REQ-LC-03.1 (tarball retained + `./typescript`) | e2e | `installed-consumer.e2e.test.ts` (tarball leg) | local-install |
| REQ-LC-04.1/.2 · .3[red] (bin exec both legs) | e2e | `installed-consumer.e2e.test.ts` | local-install |
| REQ-LC-05.1/.2 · .3[red] (dryRun invocation) | e2e | `installed-consumer.e2e.test.ts` | local-install |
| REQ-PPH-01.1 · .2[red] · .3 (W3 guard + triggers) | architectural | `fit-23-publish-workflow-guard.test.ts` | maintainer |
| REQ-PPH-02.1 · .2[red] (SHA pins) | architectural | `fit-23-publish-workflow-guard.test.ts` | maintainer |
| REQ-PPH-03.1 · .2[red] (`--dry-run` pinned) | architectural | `fit-23-publish-workflow-guard.test.ts` | maintainer |
| REQ-PPH-04.1 (prebuild clean) | integration | `test/build/build-config.test.ts` | — |
| REQ-PPH-05.1 (declarationMap false) | unit | `test/build/build-config.test.ts` | — |
| REQ-PPH-05.2 (no `.d.ts.map` ships) | architectural | `fit-14-package-surface.test.ts` | — |
| REQ-PPH-06.1 (baseline zero `.d.ts.map`) | architectural | `fit-14-package-surface.test.ts` | — |
| ~~REQ-PPH-07.1–.10 (stub inertness, incl. red-proofs .9/.10)~~ | — | **DEFERRED to public-package plan (steward CQ2)** | — |
| ~~REQ-PPH-08.1 (semver floor sorts above dev)~~ | — | **DEFERRED to public-package plan (steward CQ2)** | — |
| REQ-AOD-01.1/.2/.3 (quickstart + generated type; `pbuilder-codegen <package-dir>` — one positional arg, no flags, per `bin/pbuilder-codegen.ts:171-174`) | e2e | `quickstart-docs.test.ts` (machine leg) | docs-onboarding |
| REQ-AOD-02.1/.2 (`bun run link:sdk` first, no npm install) | integration | `quickstart-docs.test.ts` | docs-onboarding |
| REQ-AOD-03.1 / 04.1 / 05.1 / 06.1/.2 (doc content) | unit | `doc-set-content.test.ts` | — |
| REQ-AOD-07.1 · .2[red] (machine leg, no src-swap) | e2e | `quickstart-docs.test.ts` | docs-onboarding |
| REQ-AOD-08.1 (human walkthrough) | manual | `walkthrough-record.md` (owner, steward-reckoning) | docs-onboarding |
| REQ-AOD-09.1–.6 (planning reconciliation) | unit | `doc-set-content.test.ts` | — |
| REQ-AOD-10.1 (demo narrative dryRun order) | unit | `doc-set-content.test.ts` | — |
| REQ-AOD-11.1 · .2[red] (consumer `tsc --noEmit`) | e2e | `quickstart-docs.test.ts` (typecheck leg) | docs-onboarding |
| REQ-AOD-12.1/.2/.3 (sensitive-areas registry) | unit | `doc-set-content.test.ts` | — |
| REQ-FPS-06.1 (dist/core in baseline) | architectural | `fit-14-package-surface.test.ts` | — |
| REQ-FPS-06.2 (document-not-strip rationale) | unit | `doc-set-content.test.ts` | — |
| REQ-FPS-07.1 · .2[red] (no-secrets tarball scan) | architectural | `fit-14-package-surface.test.ts` | — |

All ACTIVE REQ scenarios are covered (REQ-PPH-07/08 deferred, see rows above). Every Create/Modify
flow with a runtime surface (local-install, docs-onboarding) carries ≥1 e2e row; the maintainer
flow's deliberate no-runtime posture is verified `architectural` (note in 4.2b).

## 4.7 Fitness Functions

- **Publish surface hardened & never-fired**: `fit-23` (shipped filename; named `fit-21` in this design's original plan-time text, see archive-time correction on the File Changes row above) parses `publish.yml`/`ci.yml` with Bun's native `YAML.parse` (`import { YAML } from "bun"`, zero new dependency) and resolves the guard job by predicate — the job declaring `id-token: write` — before asserting on it; a commented `# if:` is simply absent from the parsed document, so it fails structurally, not by text-scan; every `uses:` is 40-hex SHA-pinned; `--dry-run` present; no `pull_request*`/`workflow_dispatch` trigger.
- ~~**Placeholder inert**: `fit-22`~~ — **DEFERRED to public-package plan (steward CQ2)**.
- **Tarball hygiene**: `fit-14` — positive credential-filename scan (`.env*`, `.npmrc`, `*.pem`, `*.key`, `.netrc`, `id_rsa*`, `*.p12`, `*.pfx`, `credentials.json`), zero `.d.ts.map`, `dist/core/**` present. The primary assertion stays "nothing outside `dist/` ships" — the pattern set is a defense-in-depth positive scan, not the sole guard.
- **Exports stable**: `fit-09`/`fit-14` — five-subpath map + single `ts-morph` dep unchanged.

## 4.8 Migration / Rollout

No DB/data migration. Strict in-repo SEQUENCING (REQ-PPH-06):
1. `prebuild` clean + `declarationMap:false` land → 2. rebuild → 3. regenerate `pkg-surface-baseline.json`
against the clean build → 4. FIT-14 asserts. Regenerating before step 2 would poison the baseline with the
34 stale `.d.ts.map` entries present today.
No registry write happens in this change — the npm placeholder (previously a leaf, manual,
out-of-band owner action) is DEFERRED to the public-package plan (steward CQ2). Rollback: revert
the merge commit. No live product publish in this change.

## 4.9 Performance Considerations

No runtime impact. Test-suite cost grows: the `bun link` leg and docs-as-test each build+link/pack a scratch
consumer — mitigated by memoizing the shared consumer in `scratch-consumer.ts` (one build/link per process,
reused across scenarios, the existing e2e's `ensureInstalledConsumer` pattern generalized).

## 4.10 Architecture Impact

**Architecture impact**: additive
**Rationale**: derived from 4.2c — every active touchpoint `aligns`; the change ADDS a `docs/` set, a
shared test helper, and new fitness tests as new baseline entries within existing layers/conventions.
No existing boundary, dependency direction, or the IR-seam pattern is modified; the `exports` map,
`ts-morph` dependency, and invariant #5 are byte-stable. ADR-0041 (consumption ritual) and ADR-0042
(interlock) introduce new mechanisms — additive-flavoured, none a pattern change; the ADR-0034
amendment extends an established posture rather than shifting it. ADR-0040 (placeholder) is deferred
to the public-package plan and no longer contributes to this change's architecture impact. Post-verify:
`arch_refresh_post_verify` prompt applies (additive); the hardened publish posture warrants a baseline
refresh.
**Note on tarball size**: this change SHRINKS the published tarball — `declarationMap: false` (ADR-0034
amendment) removes 34 `.d.ts.map` entries from the pack. That shrink is deliberate and documented here so
the post-verify baseline refresh reads it as an intended outcome of this change, not as undocumented drift.

## 4.11 Open Questions

None.

## 4.12 Design Notes / Risks (rev 2, still valid unless noted)

- **fit-23 parser** (named `fit-21` in this design's original plan-time text): uses Bun's native `YAML.parse` (`import { YAML } from "bun"`), not a hand-rolled
  comment-stripping text parser — zero new dependency, structurally correct parse; the job-resolution-
  by-predicate rule (find the job declaring `id-token: write`, assert on THAT job) is unchanged. See
  ADR-0042.
- **`bun-version` pin**: `publish.yml`'s `setup-bun` step is SHA-pinned as an action but installs a
  FLOATING Bun toolchain version. Consider pinning `bun-version` to an exact release in the same step.
  Design note only — the executor decides at apply time whether to pin and to which version.
- **No-secrets scan breadth**: `fit-14`'s positive credential-filename scan set is broadened to
  `.env*`, `.npmrc`, `*.pem`, `*.key`, `.netrc`, `id_rsa*`, `*.p12`, `*.pfx`, `credentials.json`. The
  primary assertion remains "nothing outside `dist/` ships" — the pattern list is defense-in-depth, not
  the sole guard (§4.7).
- ~~**Followup candidate for archive-time `pending-changes.md`**: a scheduled/manual CI check that runs
  `npm view @pbuilder/sdk deprecated`...~~ **MOOT for this change (rev 3)** — the placeholder itself is
  deferred to the public-package plan; this followup travels with it and will be re-registered when
  that plan runs.
