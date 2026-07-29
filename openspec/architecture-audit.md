# Architecture Audit — project-builder-sdk
Performed: 2026-07-29 (pre-archive `arch_audit_gate` for change `inline-collection-marker`)
Baseline: engram obs #652 + `openspec/architecture.md` (both Updated 2026-07-29, refreshed in this same pass — `architecture_impact: breaking`, ADR-0077) · HEAD `a4f90c9` (branch `main`)

## Headline
No structural drift — the baseline was refreshed from this audit's own re-detection, and every architectural claim it makes about `inline-collection-marker` verifies against the tree (`containment.ts` absent, `path-guards.ts` present, `RunContext.packageAnchors = { packageDir }`, `AuthoringReason` at 11 members, `conformance/collection.json` deleted, version `0.2.0`, fit-43/44/45 present and green). Zero violations; three pre-existing warnings stand, none of them touched by this change's diff — an unenforced `engines.bun` pin in both CI workflows, the still-unreferenced `scripts/conformance-pr-gate.ts`, and duplicate number prefixes in `openspec/decisions/`. The prior audit's Node-version violation (`">=25.9.0"` vs `node-version: "22"`) is RESOLVED — `publish.yml` now installs Node `"25"`.

## Verdict
Overall: ⚠ warnings
Categories: 7 clean · 2 warnings · 0 violations

## Drift (since last scan)
No structural drift against the baseline. The baseline was rewritten in this same pass directly from the re-detection below, so Layers, Pattern, Interconnection, Data stores, Build/Deploy and Public API re-detect exactly as it states.

Drift against the PREVIOUS audit (2026-07-22, HEAD `ee6501f`) — recorded because the baseline had not been refreshed since 2026-07-21 and four archived changes accumulated behind it:
- Build / Deploy: prior VIOLATION resolved — `publish.yml`'s `node-version` moved `"22"` → `"25"`, now satisfying `engines.node: ">=25.9.0"`.
  Evidence: .github/workflows/publish.yml:42
- Build / Deploy: `build` gained a third step `build:manifest` (`bun scripts/generate-runner-manifest.ts`, chained last) and ships `dist/runner-manifest.json`; package version `0.1.0` → `0.2.0`.
  Evidence: package.json:88-90 (`"build"`), package.json:3 (`"version"`)
- Layers: `src/scaffold/containment.ts` REMOVED, `src/scaffold/path-guards.ts` ADDED (leaf now six modules); `scripts/` grew the runner-closure cluster (`derive-runner-closure.ts`, `generate-runner-manifest.ts`, `regen-closure-baseline.ts`); `docs/runner-integrity-invariants.md` added.
  Evidence: src/scaffold/ (6 files), scripts/ (5 files), docs/ (10 files)
- Layers: `conformance/collection.json` DELETED (ADR-0077 §D retires ADR-0067); `conformance/corpus.json#fixtures` now enumerates seven directories, matching disk exactly.
  Evidence: conformance/corpus.json:3, conformance/ (7 fixture dirs, no collection.json)
- Public API: `AuthoringReason` narrowed 12 → 11 (`source-outside-package` retired).
  Evidence: src/core/authoring-error.ts:73-84 (union), :109-131 (`originFor` exhaustive switch, `never` default)
- Interconnection: NEW cross-repo contract edge `engine host → dist/runner-manifest.json` (`manifestVersion: 1`, 24 entries); containment ceiling relocated to the engine's apply-time re-derivation.
  Evidence: docs/runner-integrity-invariants.md:1-14, openspec/specs/by-reference-copy-wire/spec.md:59 (REQ-BRC-02)
- Testing: suite 2136/192 files → 2398/201 files; fitness 44 → 61 files (`fit-42`, `fit-43`, `fit-44`, `fit-45` + negatives).
  Evidence: test/fitness/ (61 .ts files), openspec/changes/inline-collection-marker/verify-report.md:50-51

## Warnings (⚠)
- Build / Deploy: `engines.bun` is an EXACT pin (`"1.3.14"`) but neither CI workflow pins bun — both install `bun-version: latest`, so the declared engine is unenforced and CI can silently run a bun the package declares incompatible. Distinct from the resolved Node finding: `latest` is unresolved at audit time, so this is an unenforced-pin finding, not a confirmed version contradiction. PRE-EXISTING — this change's diff touches `package.json` only for the `version` field, never `engines` or `.github/workflows/**`.
  Evidence: package.json:26 (`"bun": "1.3.14"`) vs .github/workflows/ci.yml:23 and .github/workflows/publish.yml:38 (`bun-version: latest`)
- Conventions: Orphan source file — `scripts/conformance-pr-gate.ts` still has zero `import`/`require`/spawn references from any source file, test, CI workflow, or `package.json#scripts`; only prose in `openspec/**` mentions it. PRE-EXISTING — reproduces identically to the 2026-07-21 and 2026-07-22 audits, unaffected by this change's diff.
  Evidence: scripts/conformance-pr-gate.ts (repo-wide reference scan excluding `dist/**` and `openspec/changes/**` returns only openspec/architecture.md, openspec/pending-changes.md, openspec/architecture-audit.md)
- Conventions: Duplicate number prefixes in `openspec/decisions/` — the numbered-ADR convention requires a unique prefix per record, but four numbers each carry two files. Reported as ONE finding (a single convention-integrity breach) with its four data points inline, per the Identity-drift precedent. PRE-EXISTING and already recorded in the baseline as flagged-for-renumber; `0050` predates this refresh, and `0073`/`0074`/`0075` arose because `copy-copyin-conformance-fixtures` and `runner-integrity-manifest` archived three days apart and both renumbered from their in-change `ADR-01..04`. Not introduced by this change (which owns `0077` alone; `0078` came from `positive-create-conformance`).
  Evidence: openspec/decisions/ — `0050-definefactory-core-internal-removal.md` + `0050-handle-unfreeze-honest-write-verb-rename.md`; `0073-assets-package-local-in-fixture-source-directory.md` + `0073-runner-closure-derived-from-emitted-realm.md`; `0074-authored-but-held-branch-landing-as-distinct-debt.md` + `0074-manifest-generator-in-scripts-chained-last.md`; `0075-constraint-1-ships-structural-not-loader-observed.md` + `0075-manifest-derived-fitness-counts.md`

## Per-category status
- Layers          : ✓
- Pattern         : ✓
- Interconnection : ✓
- Data stores     : ✓
- Auth            : ✓
- Build / Deploy  : ⚠ (1)
- Public API      : ✓
- Conventions     : ⚠ (2)
- Testing         : ✓

## Rule dispositions (evidence)
- Dead dependency: none — the sole runtime dependency `ts-morph@28.0.0` is imported by `src/dialects/typescript/{ast,index,ops}.ts` and `src/dialects/react/{ast,index,ops}.ts`. `src/core/dialect-handle.ts` matched a text scan for "ts-morph" but the hit is a COMMENT at line 60, not an import — leaf isolation holds and `fit-37` confirms it live (6/6 pass). The two `index.ts` hits are `import type` (erased by tsc). devDeps `expect-type` (test/types/**), `@types/bun`, `typescript` all in use.
- Stale lockfile: NOT flagged. `bun.lock` last changed 2026-07-12 vs `package.json` 2026-07-28 (>7 days), but the intervening `package.json` diff contains no dependency change — only `exports`-map and `version` edits — so the lockfile correctly reflects the current dependency graph. Positive evidence of non-staleness; reporting it would be a false positive.
- Conflicting lockfiles: none — `bun.lock` is the only lockfile at root.
- Engines.node missing: not applicable — `engines.node: ">=25.9.0"` is declared.
- Node version mismatch: RESOLVED since the prior audit — `publish.yml:42` now installs `node-version: "25"`, which satisfies `">=25.9.0"`. `ci.yml` declares no Node (bun-only job), so no second comparison exists.
- Identity drift: not flagged — two distinct labels (`@pbuilder/sdk` in `package.json:2` and the README title; `project-builder-sdk` as repo/folder name), below the ≥3 threshold. Unchanged posture from prior audits.
- Auth imported-but-not-wired / Endpoint without auth: not applicable — no auth layer, no HTTP surface (0 REST / GraphQL / WS / gRPC).
- Dev mode in prod deploy: not applicable — no webpack/rollup/vite config in the repo; `bun build` is invoked with explicit flags only.
- Multiple HTTP clients / Queue trigger without handler / Handler without queue trigger: not applicable — no frontend layer, no IaC, no queue.
- ORM/migrations mismatch: not applicable — no data store, no ORM, no migrations directory.
- Handler/service without tests: ZERO findings — no directory in `src/**`, `test/**`, `bin/**`, `scripts/**` or `conformance/**` matches any required-test pattern (`handlers/`, `controllers/`, `services/`, `usecases/`, `use-cases/`, `repositories/`, `models/`, `routes/`, `generators/`, `middleware/`, `lambdas/`, `functions/`). Verified by directory-name scan, not assumed.
- Untyped public boundary: not applicable — no REST/GraphQL endpoint exists to carry an `any`/`unknown` request body. The `.d.ts` public surface is baselined by FIT-04 (11 pairs) and pinned by FIT-14.
- Naming inconsistency: none — every `.ts` filename under `src/` matches the dominant kebab-case rule (zero deviations across 58 files).
- Orphan source file: one finding (`scripts/conformance-pr-gate.ts`, see Warnings). NOT flagged: `src/bin/pbuilder-runner.ts` (a spawn entry point with no static importer BY DESIGN, ADR-0058 — the engine invokes `dist/bin/pbuilder-runner.js` by absolute path, and `scripts/derive-runner-closure.ts` names it as the closure ROOT); `conformance/**/factory.ts` (seven fixtures, dynamically resolved at spawn time per REQ-CFX-01, consistent with every prior audit); `scripts/{derive-runner-closure,generate-runner-manifest,regen-closure-baseline,regen-corpus}.ts` (all referenced from `package.json#scripts`, `test/**`, or each other).
- Architectural invariants (live re-verification, not read from the baseline): fit-02 (dialect leaf), fit-10 (EngineClient port allow-list), fit-15 (bin→core direction), fit-22 (scaffold one-way leaf), fit-29 (sanctioned `defineFactory` callers), fit-37 (core/commons AST-free), fit-43 (no-ceiling-regrowth), fit-44 (AuthoringReason reachability), fit-45 (single lexical predicate) — 178 tests across 8 files, 0 fail. The boundary rules the baseline asserts are mechanically true at this HEAD.
- Baseline dual-store integrity: engram obs #652 and `openspec/architecture.md` were written in the same pass and carry the same date stamp, repairing the divergence recorded in obs #1241. The committed file (66 737 chars) exceeds engram's 50 000-char observation limit, so the engram copy is a declared compressed mirror rather than a byte-identical twin; the mirror's preamble names the committed file canonical.
