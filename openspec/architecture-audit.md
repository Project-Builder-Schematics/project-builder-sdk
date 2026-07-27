# Architecture Audit — project-builder-sdk
Performed: 2026-07-22 09:15
Baseline: engram obs #2001 / `.atl/architecture.md` (Updated 2026-07-22, post-verify `copy-copyin-conformance-fixtures`) · HEAD ee6501f (branch `m2-copyin-banked-arm`) · diff scope `7ea80d1^..m2-copyin-banked-arm`

## Headline
No drift — the just-refreshed baseline fully reflects current code: `conformance/` grew to 6 landed fixtures on `main` (`m2-copy`) plus a 7th banked-only fixture (`m2-copyin`, ADR-0074), fit-40 is now manifest-derived (ADR-0075), ZERO `src/**` or `package.json` diff. One violation and one warning stand, BOTH pre-existing and unrelated to this change's diff (neither touches `package.json`, `bun.lock`, or `scripts/`).

## Verdict
Overall: ✗ violations
Categories: 7 clean · 1 warning · 1 violation

## Drift (since last scan)
No structural drift detected. The refreshed baseline was built directly from this audit's own re-detection, so Layers, Pattern, Interconnection, Data stores, Build/Deploy, Public API all re-detect exactly as the baseline now states. The `copy-copyin-conformance-fixtures` diff (`CONFORMANCE-CORPUS-HANDOFF.md`, `conformance/m2-copy/**`, `conformance/m2-copyin/**`, `conformance/corpus.json`, `conformance/m2-create-composition/factory.ts` [1-line import-path fix], `test/fitness/fit-40-conformance-corpus-integrity.test.ts`) lands entirely inside the pre-existing, already-documented `conformance/` layer and its self-check test file — no new layer, no new top-level directory, no new dependency, no new public export, no `src/**` touch.

## Violations (✗)
- Build / Deploy: Node version mismatch — `package.json#engines.node` declares `">=25.9.0"` but the publish workflow installs Node `"22"` (22 does not satisfy the declared floor). PRE-EXISTING — present in the 2026-07-21 audit (HEAD af74a30), predates both `ts-addimport-collision` and `copy-copyin-conformance-fixtures`; this change's diff never touches `package.json` or `.github/workflows/**`.
  Evidence: package.json:27 (`"node": ">=25.9.0"`) vs .github/workflows/publish.yml:42 (`node-version: "22"`)

## Warnings (⚠)
- Conventions: Orphan source file — `scripts/conformance-pr-gate.ts` still has zero `import`/`require`/spawn references from any code, test, CI workflow, or `package.json` script (repo-wide re-scan; only its own usage/error-text strings reference itself). PRE-EXISTING — present in the 2026-07-21 audit, unaffected by this change's diff.
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

## Rule dispositions (evidence, incl. checks specific to this change's new files)
- Dead dependency: none — no dependency added or removed by this diff (`package.json`/`bun.lock` unchanged across the full `7ea80d1^..m2-copyin-banked-arm` range).
- Stale lockfile / conflicting lockfiles: not flagged — no manifest/lockfile change in this diff; `bun.lock` (2026-07-12) vs `package.json` (2026-07-18) gap unaffected, single lockfile at root.
- Engines.node missing / Node version mismatch: engines.node still declared; mismatch still present (see Violations) — unrelated to this diff.
- Identity drift: not flagged — same 2-label posture as prior audit (`@pbuilder/sdk` vs `project-builder-sdk`), below the ≥3 threshold.
- Handler/service without tests: `conformance/m2-copy/factory.ts` and `conformance/m2-copyin/factory.ts` do NOT match any required-test pattern (no `handlers/`, `controllers/`, `services/`, `usecases/`, `repositories/`, `models/`, `routes/`, `generators/`, `middleware/`, `lambdas/`, `functions/` ancestor folder) — same exemption posture as the five pre-existing fixture factories; not flagged.
- Orphan source file (new files this diff): `conformance/m2-copy/factory.ts` and `conformance/m2-copyin/factory.ts` are NOT statically imported anywhere — by design (REQ-CFX-01: loaded from source via a `file://…factory.ts` pointer the engine's Go harness / runner dynamically resolves at spawn time, never a static import). Consistent with the pre-existing `m1-vehicle`/`m2-modify`/`m2-delete`/`m2-rename-move`/`m2-create-composition` factories, none of which were flagged in any prior audit — not flagged here either (documented pattern, not an anomaly).
- Naming inconsistency: none — every new file/directory this diff adds (`m2-copy/`, `m2-copyin/`, `expected-force/`, `expected-modify/`, `expected-verbatim/`, `assets/`, `payload.txt`, `verbatim.txt`, etc.) is kebab-case, consistent with the dominant convention.
- Orphan / undeclared directories under `conformance/`: none — `corpus.json#fixtures` on the current branch tip lists exactly the 7 directories present on disk (`m1-vehicle`, `m2-modify`, `m2-delete`, `m2-rename-move`, `m2-create-composition`, `m2-copy`, `m2-copyin`); `main`'s `corpus.json` correspondingly lists exactly its 6 landed directories. fit-40's REQ-CCR-05.2 orphan-directory check is green at both checkpoints (main 6/18, branch 59 assertions / 7 fixtures / 23 cases).
- Untyped public boundary / Endpoint without auth / queue / ORM rules: not applicable — this diff touches zero public API surface, zero `src/**`, no HTTP/queue/ORM concern.
- ORM/migrations mismatch: not applicable — no data store in this diff.

## Prior findings intentionally NOT re-litigated
The 2026-07-21 audit (HEAD af74a30) predates this refresh by several landed changes (`ts-addimport-collision` archived at `29192c2`, then `copy-copyin-conformance-fixtures`). Both of its findings (Node version mismatch, orphan `conformance-pr-gate.ts`) were re-verified fresh against current HEAD in this pass (not carried over from memory) and both still reproduce identically — confirmed via direct inspection of `package.json`, `.github/workflows/publish.yml`, and a repo-wide reference scan for `conformance-pr-gate`.
