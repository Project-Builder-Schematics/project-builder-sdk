# Architecture Audit — project-builder-sdk
Performed: 2026-07-21 10:53
Baseline: openspec/architecture.md (Updated 2026-07-19, post-archive `conformance-corpus`) · HEAD af74a30 · engram unavailable this session, filesystem store

## Headline
No structural drift — the 2026-07-19 baseline fully reflects current code (transport cluster, runner-bin relocation to `src/bin/`, `engines` pin `bun 1.3.14` + `node >=25.9.0`, conformance corpus, ADRs 0053-0067); post-baseline commits (PR #41, conformance-corpus-m2) add corpus fixtures and tests inside the already-documented corpus element. One violation stands: the publish workflow installs Node 22 while `package.json#engines.node` declares `>=25.9.0`.

## Verdict
Overall: ✗ violations
Categories: 7 clean · 1 warning · 1 violation

## Drift (since last scan)
No structural drift detected. Post-baseline delta (PR #41, merged after the 2026-07-19 refresh) is content-additive within already-documented elements: four m2 corpus fixtures (`m2-modify`, `m2-delete`, `m2-rename-move`, `m2-create-composition`) under `conformance/`, FIT-40 strengthening + its negative companion, and judgment-day round-1 test gap closures. Layers, Pattern, Interconnection, Data stores, Build/Deploy, and Public API (6 subpaths + 1 mapped bin) all re-detect exactly as the baseline states. Suite grew to 190 test files / 43 fitness files.

## Violations (✗)
- Build / Deploy: Node version mismatch — `package.json#engines.node` declares `">=25.9.0"` but the publish workflow installs Node `"22"` (22 does not satisfy the declared floor).
  Evidence: package.json:27 (`"node": ">=25.9.0"`) vs .github/workflows/publish.yml:42 (`node-version: "22"`)

## Warnings (⚠)
- Conventions: Orphan source file — `scripts/conformance-pr-gate.ts` has zero `import`/`require`/spawn references from any code, test, CI workflow, or `package.json` script (repo-wide scan; only prose mentions in `openspec/**` docs, which describe it as a one-time PR gate). Its sibling `scripts/regen-corpus.ts` IS referenced (spawned by FIT-28).
  Evidence: scripts/conformance-pr-gate.ts (no reference in .github/workflows/*, package.json#scripts, src/**, test/**)

## Per-category status
- Layers          : ✓
- Pattern         : ✓
- Interconnection : ✓
- Data stores     : ✓
- Auth            : ✓
- Build / Deploy  : ✗ (1)
- Public API      : ✓
- Conventions     : ⚠ (1)
- Testing         : ✓

## Rule dispositions (evidence for the clean categories)
- Dead dependency: none — `ts-morph@28.0.0` (sole runtime dep) imported by both dialect leaves; devDeps `@types/bun` (wired via `tsconfig.json` `"types": ["bun-types"]`), `expect-type` (`test/types/*`), `typescript` (`typecheck`/`build` scripts) all alive.
- Stale lockfile: not flagged — `bun.lock` last committed 2026-07-12, `package.json` 2026-07-18 (6 days, under the >7-day threshold); the 2026-07-18 manifest change touched `engines`/`scripts` fields only, no dependency change requiring a lock update.
- Conflicting lockfiles: none — `bun.lock` is the only lockfile at root.
- Engines.node missing: not applicable — declared (package.json:27).
- Node version mismatch: FLAGGED (see Violations).
- Identity drift: not flagged — 2 distinct labels only (`@pbuilder/sdk` in package.json#name + README title + npm deploy name; `project-builder-sdk` as folder + GitHub repo slug); rule threshold is ≥3.
- Handler/service without tests: no current file matches a required-test pattern (`src/` contains no `handlers/`, `controllers/`, `services/`, `usecases/`, `repositories/`, `models/`, `routes/`, `generators/`, `middleware/`, `lambdas/`, `functions/` folders; `src/bin/` and `conformance/` are outside the pattern set).
- Naming inconsistency: none — 0 of the source files in `src/`, `bin/`, `scripts/` deviate from kebab-case.
- Auth / Endpoint / HTTP-client / queue / ORM rules: not applicable — library with no HTTP surface, no data store, no queue, no auth (insufficient evidence → omitted, per rule).
