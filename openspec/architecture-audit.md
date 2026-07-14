# Architecture Audit — project-builder-sdk
Performed: 2026-07-14
Baseline: obs #2001 (2026-07-14, post author-write-surface modifying refresh)

## Headline
No drift. Current code matches the just-refreshed baseline on every checked axis — the author-write-surface honest-verb rename is fully landed (`.raw(fn)`→`.modify(fn)`, `modify(content)`→`replaceContent(content)`), still 5 export subpaths, `RESERVED_HANDLE_NAMES` is the exact 9-member ordered array, ADR-0050/0039/0012 are on disk, and ts-morph stays leaf-isolated to `src/dialects/typescript/**`. No violations, no warnings.

## Verdict
Overall: ✓ clean
Categories: 9 clean · 0 warnings · 0 violations

## Drift (since last scan)
No drift detected. (Baseline was refreshed post-verify this same turn; current `src/` reflects it exactly.)

## Per-category status
- Layers          : ✓
- Pattern         : ✓
- Interconnection : ✓
- Data stores     : ✓
- Auth            : ✓
- Build / Deploy  : ✓
- Public API      : ✓
- Conventions     : ✓
- Testing         : ✓

## Evidence checked (audit trail)
- **Public API — 5 subpaths**: `package.json#exports` = `.`, `./commons`, `./conformance`, `./testing`, `./typescript`; `#bin` = 1 (`pbuilder-codegen`). Matches baseline "5 subpaths + 1 CLI".
- **Vocabulary rename (REQ-KIT-03)**: zero `.raw(` in `src/`; `runRaw` absent; `runModify`/`runReplaceContent` present (`src/core/dialect-handle.ts:292,309`). Public `.modify(fn)` AST escape hatch at `src/core/define-dialect.ts:65`; wholesale `replaceContent` at `src/commons/index.ts:71,102,297`. The retained `factory.modify(...)` (`src/core/directive-factory.ts:64`, `src/commons/index.ts:73,104,299`) is the WIRE-altitude `{op:"modify"}` lowering deliberately kept (REQ-AEC-13) — not the retired free verb.
- **RESERVED_HANDLE_NAMES (ADR-0050 RULING R2)**: exported ordered 9-array `["then","read","raw","modify","replaceContent","rename","move","copy","remove"]` at `src/core/define-dialect.ts:132`; `raw` retained as muscle-memory guardrail; compile-time exhaustiveness tie present.
- **ADR adherence**: `openspec/decisions/0050-handle-unfreeze-honest-write-verb-rename.md`, `0039-fail-loud-rejection-incoherent-operations.md`, `0012-conformance-kit.md` all on disk.
- **Dialect-handle dispatcher / containment seam**: `src/core/dialect-handle.ts` retains `#invokeContained` wiring (`runModify`/`runReplaceContent` route through it, :392/:396); `runReplaceContent` keeps the ADR-0039 reject-while-pending guard (:194), absent from `.modify(fn)` (REQ-MC-08.5).
- **Leaf isolation (FIT-01/FIT-02)**: `ts-morph` imported ONLY by `src/dialects/typescript/{index,ops,ast}.ts` — no reach into `src/commons/**` or the shared kit.
- **Kit-internal modules not orphans, no cycle**: `src/core/dialect-error.ts` (imported by `ops.ts`, `dialect-handle.ts`) and `src/core/deep-equal.ts` (imported by `conformance/index.ts`, `testing/contract-fake.ts`) each declare ZERO imports (pure); cross-name mentions are sibling-pattern comments only. Neither is in any barrel/subpath (correct kit-internal posture).
- **Build / Deploy**: single lockfile `bun.lock` (no conflicting lockfiles); `ts-morph@28.0.0` exact-pinned in `dependencies` and used (not dead); devDeps `expect-type` (used in `test/types/`), `@types/bun`, `typescript` — all alive. `engines.bun >= 1.0.0` declared with NO `engines.node` — deliberate Bun-native posture documented in baseline (Node is publish/install tooling for the codegen shebang); not a defect.
- **Testing rule (Handler/service without tests)**: NONE of the required-test-pattern folders (`handlers/`, `controllers/`, `services/`, `usecases/`, `repositories/`, `models/`, `routes/`, `generators/`, `middleware/`, `lambdas/`, `functions/`) exist — this is a library, not an MVC app; the rule matches zero files. 30 fitness test files present (`fit-01..28` + `fit-raw-sweep` + `definefactory-jsdoc`), matching baseline claim.

Source: engram obs (topic sdd/project-builder-sdk/architecture-audit) · against baseline obs #2001
