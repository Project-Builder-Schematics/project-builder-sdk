Objective: ship Group 1 of the TypeScript dialect op catalog (import/export variants) plus identifier validation for every op, so barrel and import schematics need no `.modify()`.
Branch: feat/ts-import-export-ops (from origin/main 3482e52). Delivery: ask-on-risk; chain strategy asked before the first commit past ~400 lines. Test runner: `bun test` (focused: `bun test test/dialects/typescript`).
Source spec: V2 of `ts-dialect-backend-ops` (`origin/plan/ts-dialect-backend-ops` @ e86c321; read with `git show e86c321:openspec/changes/ts-dialect-backend-ops/specs/<domain>/spec.md`), amended below. Main wins wherever it ratified something later than V2 (2026-07-18).

## Specs

S1 — `addDefaultImport(name, from)`: V2 REQ-TSD-13.1-.3, .5 → `import name from "from";`. No-op when a non-type-only declaration for `from` already has default `name`. Rejects when a non-type-only declaration for `from` has a default under another name (Spec Decision 1), or when `name` is bound anywhere else (S12 collision). Merges into the first non-type-only declaration for `from` that has a clause and no default (`import X, { a } from "m"`, Spec Decision 5; also namespace-only → `import X, * as ns from "m"`, probe-verified); else a fresh declaration after any directive prologue. Overrides V2 13.4: a type-only `import type X` claim REJECTS (main posture).

S2 — `addNamespaceImport(name, from)`: V2 REQ-TSD-14.1-.7 → `import * as name from "from";`. No-op when a non-type-only declaration for `from` already has namespace `name`. Rejects when a non-type-only declaration for `from` has a namespace under another name (Spec Decision 9), or when `name` is bound anywhere else. Merges into a non-type-only default-only declaration (`import Def, * as ns from "m"`, Spec Decision 6 — probe-verified against ts-morph@28 on 2026-10-27); a declaration with named imports is never a target (ts-morph throws) → fresh separate declaration.

S3 — `addTypeImport(name, from)`: V2 REQ-TSD-15.1-.6 + ruling (b) "SEPARATE STATEMENT" + ruling (e) — no-op when any declaration for `from` binds `name` through an unaliased or self-aliased named specifier, value or type-only, inline (`{ a, type X }`) or whole-declaration, on any declaration (not only the first); rejects when `name` is bound anywhere else; else ALWAYS a fresh `import type { name } from "from";`, never merged.

S4 — `addSideEffectImport(from)`: V2 REQ-TSD-16.1-.4 → `import "from";`, own declaration, module-only identity (no-op only when a bare `import "from"` exists).

S5 — `addReExport(name, from)`: V2 REQ-TSD-17 + ruling (h) (aliased specifiers match by SOURCE name) → `export { name } from "from";`, merging into an existing non-type-only `export { … } from "from"`.

S6 — `addExportAll(from, options?)`: V2 REQ-TSD-18 amended by owner (d) "Sí, con option" → `export * from "from";` (module-only identity) or, with `{ as: "ns" }`, `export * as ns from "from";` (identity module+`as`; `ns` validated; rejects when `ns` is already exported).

S7 — `removeExport(name, from)`: V2 REQ-TSD-19 + ruling (h) → removes the named re-export, deleting the statement when it was the last specifier; absent → no-op.

S8 — `removeExportAll(from, options?)`: owner (c) "Named + export * (Recommended)" → removes `export * from "from"` (or `export * as ns from "from"` with `{ as: "ns" }`); absent → no-op.

S9 — Identifier validation (V2 REQ-TIV-01/02/03 + ruling (a) "FOLD IN", now 13 ops): every `name` and `as` argument of every op, new and existing (`removeImport`, `addFunction`, `addVariable`, `addClass` included), runs `assertValidImportBinding` before any AST work, and before any no-op. Main's validator wins over V2 text: `__proto__`/`constructor`/`prototype` REJECT (overrides V2 TIV-01.4), reject message shape is main's path-less `nameRuleTail`/`boundedFragment` (overrides V2 TIV-01.6). Escape test payloads use a literal backslash (`"x\\u0061"`).

S10 — `addVariable.kind` runtime allow-list `const | let | var` (V2 REQ-TSD-21, ruling (f)).

S11 — Arch N4 (V2 REQ-TSD-20): `assertNoCollision` detects default and namespace import bindings too.

S12 — Ordering (overrides V2 precedence paragraph): validate → idempotency → collision → mutate, the order main pins for `addImport` (REQ-TSD-01.24).

S13 — Contract surface: op-set exact list (13 ops), README op table, `docs/authoring-a-dialect.md` (V2 REQ-DAS-01, `export * as ns` no longer forbidden; scope any substring guard away from the existing `export * as astLibrary`), `test/docs/security-authoring-guard.test.ts` op list, trust-boundary JSDoc + main REQ-TSD-13.5 guard amended (siblings' `name` is no longer raw), CHANGELOG, `openspec/specs/typescript-dialect/spec.md` with V2's REQ IDs renumbered to free ones (main already uses REQ-TSD-13, 01.5-.33, 03.11).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S11 | inline | done — RED 6 fail → GREEN | c4ba7d9 |
| T2 | S9 (existing 4 ops), S10, S13 JSDoc guard | inline | done — RED 74 fail → GREEN; verifier PASS (1 blocker fixed); native review approved + acknowledged | 5d70a6e, docs f86a524 |
| T3 | S1, S2, S3, S4, S9, S12 | inline | done — RED 33 fail → GREEN; assess medium/under_budget | 0e86623 |
| T4 | S5, S6, S7, S8, S9, S12 | inline | done — RED 100 fail → GREEN | 393b25f |
| T5 | S13 | inline | done — docs with each slice; living spec REQ-TSD-14..22, pending rows closed | f86a524, 0e86623, 393b25f, 47564db |

## Log

L1 (2026-10-27, user, verbatim): "trabajemos las que aporten mas valor" → chose "Barrels e imports"; then "y luego el de las clases".
L2 (2026-10-27): owner answers — (b) "Separada (Recommended)"; (c) "Named + export * (Recommended)"; (d) "Sí, con option".
L3: next feature after this one is Group 3 class ops (addClassMethod, addClassProperty, addConstructorParam, addDecorator, addImplements), carved out of Group 3 without Group 2.
L4: route — all tasks inline; every op lives in `ops.ts`, so there are no disjoint parallel units.
L5 (2026-10-27): plan had advanced to an unsigned spec V2 on 2026-07-18 (rulings a-h). User, verbatim: "V2 + (c)(d) de hoy (Recommended)".
L6 (2026-10-27): reconciliation explorer — main already ships V2's addImport parts (validation, type-only merge skip, REQ-TSD-01.6/.7, 03.1-.10). Conflicts resolved as recorded in S1, S2, S9, S12, S13: main's later ratifications win; V2's internal contradictions (13.4 type-only default, Decision 6 unprobed merge, collision-before-idempotency) resolved toward main's addImport posture. Risk: T2 touches item 2 (validation guards) and item 3 (existing ops now reject inputs they accepted).
L7 (2026-10-27): another session (NestJS dialect) switched the shared main checkout; work moved to worktree `project-builder-sdk-worktrees/ts-import-export-ops`. Delivery: user chose "stacked-to-main (Recommended)" — slice 1 = T1+T2, slice 2 = T3, slice 3 = T4+T5. Docs issue: project-builder-docs#24. NestJS dialect (sdk #115) inherits every TS op — its exact-op-set test will need the new ops once both land.
L8: slice 1 verified — typecheck clean, full suite 3282 pass. RDD assess (base 3482e52, committed-only): medium/under_budget; escalated item 2 → high, review due. Independent verifier launched before review.
L8 correction: the "3282 pass" in L8 ran before the CHANGELOG edit; a clean copy gave 1 change-caused failure — `test/docs/changelog-release-vehicle-guard.test.ts` forbids "## Unreleased". Changelog entries belong to the release commit; slice-1 text saved for the PR body.
L9 (2026-10-28): independent verifier on slice 1 — S9/S10/S11/S13-JSDoc PASS; blocker = changelog heading, fixed (CHANGELOG dropped), recheck 9/9 pass. Native review (lenses risk, reliability) approved and acknowledged. Advisories (later work, not reopened): `removeImport` now rejects reserved export names such as `default` (`import { default as x }` can no longer be removed by name); the absent-binding no-op test is weak; non-ASCII names (`café`) now reject (ruling g).
L10 (2026-10-28): user, verbatim: "cuando pueda baja cambios" — rebased onto origin/main c371ae8 (NestJS #115 merged; TS op pack moved to `pack.ts`, nestjs inherits it). Slice-1 commits now c4ba7d9/5d70a6e. Spec V2 Decision 6 probe-verified against ts-morph@28: `setNamespaceImport` on a default-only declaration gives `import Def, * as ns from "m"`; on one with named imports it throws. Full suite 3411 pass after T3.
L11 (2026-10-28): T4 deviation from V2 17.6 (second half): `addReExport("Y", "m")` against `export { X as Y } from "m"` REJECTS — V2's "merge as its own specifier" would emit a duplicate export, invalid TypeScript. `ts-morph` has no `getExportClause()`; bare `export *` is detected via `compilerNode.exportClause === undefined`, merge targets via `hasNamedExports()`.
L12 (2026-10-28): full suite 3511 pass, typecheck clean at ff01186; docs/fitness guards 1362 pass at 375c273. RDD assess f86a524..375c273: medium / under_budget, no review due; not escalated — the only shared-code change (addImport now uses claimedBindingError/insertImport) is behaviour-preserving and goes to the end-of-feature independent verifier's base-vs-candidate differential. Follow-up row registered in pending-changes: lookup-only names (`removeImport("default")`) rejected as reserved words. Slices: (1) c4ba7d9..f86a524, (2) ecb3fcb, (3) ff01186..375c273 + this document.
L13 (2026-10-28): end-of-feature independent verifier (f86a524 vs 375c273): differential of addImport/removeImport/addFunction/addVariable/addClass and NestJS ops byte-identical; S1, S2, S4, S6-S9, S12, S13 PASS. Two blockers: B1 `addTypeImport` ignored a local `type`/`interface` of the same name (TS2440); B2 `addReExport` missed names bound by an exported destructuring (TS2323). One correction batch: RED 5 → GREEN, folded into their slice commits (0e86623, 393b25f, spec 47564db); recheck at each slice tip: typecheck clean, TS dialect tests 304 / 408 / 408 pass; full suite 3517 pass. Advisories left as later work: `addExportAll(from, { as: null })` (out of typed domain) is not idempotent; `addReExport` over-rejects a name used only by `export default function X`; `import X = require()` is outside the claim set (pre-existing).
Final commits: slice 1 c4ba7d9, 5d70a6e, f86a524; slice 2 0e86623; slice 3 393b25f, 47564db + this document.
L14 (2026-10-28): delivered — slice 1 → #116, slice 2 → #117, slice 3 → #118, all merged to main. Version bumped to 0.5.1 (#119); user, verbatim: "Esta bien en 0.5.1". CHANGELOG `## 0.5.1` written from the PR bodies (also covers #114, #115) and pushed to main at 2088792. The two L13 advisories (`{ as: null }`, `export default function X`) registered in `openspec/pending-changes.md`. Still open: docs site project-builder-docs#24; next feature is L3 (Group 3 class ops).
