# Architecture Audit — project-builder-sdk
Performed: 2026-07-17
Baseline: obs (2026-07-17, post react-dialect additive refresh)

## Headline
No drift against the just-refreshed baseline. The react-dialect delta is fully and correctly landed: a second dialect leaf (`src/dialects/react/`) published at `@pbuilder/sdk/react` (6th subpath, runtime surface exactly `{ find }`), two kit-internal name-grammar core modules, and a second ts-morph importer — all inside existing boundaries with no dependency-direction, layering, or unauthorized-public-surface breach. No violations, no warnings.

## Verdict
Overall: ✓ clean
Categories: 9 clean · 0 warnings · 0 violations

## Drift (since last scan)
No drift detected. (Baseline was refreshed post-verify this same turn; current `src/` reflects it exactly — 6 export subpaths, the react leaf, and the two new core modules all match.)

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
- **Public API — 6 subpaths**: `package.json#exports` = `.`, `./commons`, `./conformance`, `./testing`, `./typescript`, `./react` (`package.json:37-62`); `#bin` = 1 (`pbuilder-codegen`). `./react` → `dist/dialects/react/index.js` / `.d.ts`. Matches refreshed baseline "6 subpaths + 1 CLI".
- **`./react` runtime surface EXACTLY `{ find }`**: `src/dialects/react/index.ts:63` exports `find(path): Handle<"found", SourceFile, ReactOps>` and nothing else; `ReactOps = { setJsxProp, addImport }` — the closed two-op v1 vocabulary. First-commit DTS baseline `test/fitness/dts-baseline/react.index.d.ts` exhibits EXACTLY `find` + the two ops (FIT-04 11th pair). `pkg-surface-baseline.json` carries the `./react` map entry + `dist/dialects/react/{ast,index,ops}.{js,d.ts}` tarball entries (FIT-14).
- **Dependency direction — dialect leaf is one-way (FIT-02)**: `src/dialects/react/**` imports ONLY `../../core/*` (`define-dialect`, `dialect-error`, `jsx-name-validator`, `reject-tail`) + ts-morph + `node:path` — verified by import scan. NO sibling-dialect import: the two `dialects/typescript` string hits in the react leaf (`index.ts:3`, `ops.ts:9`) are COMMENT references only, not imports. NO reverse dependency: no file under `src/core`/`src/commons`/`src/dry-run`/`src/scaffold`/`src/testing` imports `src/dialects/**`.
- **Leaf isolation — ts-morph confined (FIT-01/FIT-37/FIT-38)**: ts-morph is imported by EXACTLY six files, all dialect-leaf `{ast,index,ops}.ts` — three typescript + three react (`rg` over `src/`). The two NEW core modules (`jsx-name-validator.ts`, `reject-tail.ts`) import ONLY sibling core modules (`dialect-error.ts`, `reject-tail.ts`) — zero ts-morph reach. FIT-37 walks the transitive graph repo-wide proving `src/core/**`/`src/commons/**` never reach ts-morph; FIT-38 pins `new Project(...)` construction to the two authorized `ast.ts` files non-vacuously.
- **Kit-internal modules not orphans, correct barrel posture**: `src/core/jsx-name-validator.ts` (imported by `src/dialects/react/ops.ts`) and `src/core/reject-tail.ts` (imported by `jsx-name-validator.ts` + `ops.ts`) are both reached — not orphans. NEITHER is re-exported by `src/core/index.ts` — correct kit-internal, no-public-symbol posture (dialect-error.ts/deep-equal.ts precedent).
- **`src/dialects/typescript/**` byte-untouched**: `git diff --name-status main..HEAD -- src/**` shows only ADDITIONS (`A`) — five new files, zero modifications, zero deletions in `src/`. The react leaf DUPLICATES the TS leaf's `ast.ts` fidelity primitives (BOM round-trip, content-derived newline, frozen ManipulationSettings, syntactic-diagnostic throw) rather than importing them (ADR-01), so the TS leaf stays diff-free.
- **Build / Deploy**: single lockfile `bun.lock` (no conflicting lockfiles). `ts-morph@28.0.0` exact-pinned in `dependencies`, used by both leaves (not dead); NO new dependency added by react-dialect. devDeps `@types/bun`/`expect-type`/`typescript` all alive. `engines.bun >= 1.0.0` with NO `engines.node` — considered against the audit's "engines.node missing" rule and NOT flagged: it is a deliberate, baseline-documented Bun-native posture (Node is publish/install tooling only for the codegen shebang), unchanged by this change, consistent with the prior clean audit.
- **Testing rule (Handler/service without tests)**: NONE of the required-test-pattern folders (`handlers/`, `controllers/`, `services/`, `usecases/`, `repositories/`, `models/`, `routes/`, `generators/`, `middleware/`, `lambdas/`, `functions/`) exist — this is a library; the rule matches zero files. The new `core/`/`dialects/` files are outside the required-test patterns, yet each is covered (`test/dialects/react/name-validation.test.ts`, `ops.test.ts`, `dialect.test.ts`, etc.). 40 fitness files present (`fit-01..38` + `fit-raw-sweep` + `definefactory-jsdoc`), matching baseline.
- **Conventions**: kebab-case filenames maintained (`jsx-name-validator.ts`, `reject-tail.ts`) — no naming-inconsistency. Public `find(path: string)` fully typed — no untyped public boundary.

## Registered followups (design debt, NOT audit violations)
These are reflected in the refreshed baseline's Conventions/Notes sections as design commitments, not structural breaches — none matches an audit anomaly rule:
- **ARCH-2** — `src/core/jsx-name-validator.ts` holds JSX-specific grammars in the file-type-agnostic `core` layer with one consumer; ADR-01's peer-module split fires at dialect #3. This is a placement/cohesion decision on the SANCTIONED dialect → core edge (the modules are AST-library-free, FIT-37), not a dependency-direction or layering violation.
- **TypeScript-leaf `addImport` naive predicate** — the pre-existing TS dialect's `addImport` can emit invalid bindings; registered for its own change. The react `addImport` deliberately does NOT repeat it (full `name` validation via `validatedOp`). No current-code rule flags this.
- **DOC-3** — `src/core/dialect-handle.ts`'s dialect-generic error path still spells a `TypeScript`-specific `as TypeScript` message; pending-change to generalize now that a second dialect shares the seam. A message-string debt, not a structural breach.

Source: engram obs (topic sdd/project-builder-sdk/architecture-audit) · against baseline obs (sdd/project-builder-sdk/architecture, 2026-07-17)
