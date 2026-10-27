Objective: ship `@pbuilder/sdk/angular`, a dialect that extends the TypeScript dialect with Angular v22 ops (delivery 1: component metadata, root providers, routes).
Branch: feat/angular-dialect (from main 864ed17). Delivery: ask-on-risk, chain strategy stacked-to-main. Test runner: `bun test` (focused: `bun test test/dialects/angular test/conformance/angular-conformance.test.ts`).
Inputs: Nx/Angular CLI generator research and Angular v22 docs (via the `angular-cli` MCP), summarized in `## Log`.

## Specs

S1 — Code + imports. Owner choice, verbatim: "expr + imports". Every op that inserts code takes `(element, imports?)`: `element` is an identifier string or `{ expression: string }`, exactly as `addArrayElement` accepts; `imports` is an optional list of `{ name, from }` named imports, each added with `addImport`'s rules. Example agreed in the conversation:

```ts
.addRootProvider({ expression: "provideHttpClient(withFetch())" }, [
  { name: "provideHttpClient", from: "@angular/common/http" },
  { name: "withFetch", from: "@angular/common/http" },
])
```

S2 — `addComponentImport(element, imports?)`: appends to `imports` of the file's only `@Component`, creating the metadata object or the array when missing; an equal element is a no-op (the `addArrayElement` rules: zero or several `@Component` reject).

S3 — `addComponentProvider(element, imports?)`: same as S2, for `providers`.

S4 — `addRootProvider(element, imports?)`: appends to the application's root `providers`. The root is the file's only top-level variable typed `ApplicationConfig` (annotation or `satisfies`); when there is none, the only `bootstrapApplication(...)` call's second argument, created when missing. When that argument is an identifier (an `appConfig` imported from another file) it rejects and names the module to open instead. Several `ApplicationConfig` variables, or neither shape, reject. (Default — owner may override.)

S5 — `addRoute({ path, component, from })`: imports `component` from `from` and adds `{ path: "<path>", component: <component> }` to the file's only top-level variable typed `Routes` or `Route[]` (annotation or `satisfies`). (Default — owner may override.)

S6 — `addLazyRoute({ path, loadComponent | loadChildren, export? })`: adds `{ path, loadComponent: () => import("<from>") }`, or `.then((m) => m.<export>)` when `export` is given; exactly one of `loadComponent`/`loadChildren`. No import is added. (Default — owner may override.)

S7 — Route ordering. Angular v22 docs: "The first route that matches wins, and the router stops searching." A new route is inserted before a top-level `{ path: "**" }` route; otherwise it is appended. (Default — owner may override.)

S8 — Route duplicates and paths. An equal route (token comparison, as `addArrayElement`) is a no-op; a different route with the same `path` rejects. A `path` starting with `/` rejects (Angular rejects it at runtime). (Default — owner may override.)

S9 — Error tails follow the house format: `<op>(...) on "<file>" — <reason>. Edit it with .modify().`

S10 — Packaging: `./angular` export, author guide `docs/angular-dialect.md`, README section, surface baselines — the same shape as `./nestjs`.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S4, S9 | inline | done — RED (module missing) → GREEN 13 pass; TS + NestJS 510 still pass after extracting `appendArrayElement` | d135392 (PR 1) |
| T2 | S1, S5-S9 | inline | done — RED 13 fail → GREEN 27 pass (angular); typecheck clean | PR 2 (feat/angular-dialect-02-routes) |
| T3 | S10 | inline | done — `./angular` export, guide, README, FIT-02/04/09/14 + package hash repinned; full suite 3636 pass, 7 fail = the same 7 that fail on main 864ed17 | d135392 (PR 1; route docs + d.ts baseline in PR 2) |

Route evidence: one behavior chain on one branch, each unit under ~400 lines and dependent on the previous one, so no writer trigger fires; all inline.

## Log

L1 (2026-10-28, user, verbatim): "buddy necesito crear un nuevo dialect que extienda de typescript. Necesito uno para angular, pero necesito que primero hagas un research de nx/generators para el de angular"
L2 (2026-10-28, user, verbatim): "Okay primero creemos el dialecto de angular, cual seria la lista de todas las operaciones que podriamos hacer?"
L3 (2026-10-28, user, verbatim): "expr + imports, arrancá con la entrega 1" — delivery 1 = addComponentImport, addComponentProvider, addRootProvider, addRoute, addLazyRoute.
L4 (2026-10-28): research — Nx decorator helpers all funnel into `_addSymbolToDecoratorMetadata`; Angular CLI `addRootProvider` follows `bootstrapApplication` to `appConfig` and creates `providers` when missing; Angular v22 recommends standalone over NgModule, the 2025 file-name style (`app.ts`), lazy routes. HTML templates and signals are out of delivery 1 (signals = delivery 2, needs a class-member base op the TypeScript dialect lacks).
L5 (2026-10-28): `addArrayElement` (`src/dialects/typescript/array-element.ts`) already locates `{ variable | call | decorator }` roots, creates missing keys, dedups by tokens and keeps layout; Angular ops compose it instead of re-implementing. A rejected op fails the whole session (`src/core/dialect-handle.ts` `#chain`), so no partial file reaches disk.
L6 (2026-10-28): Engram mirror pending — `mem_current_project` is ambiguous for this directory; waiting for the owner to pick a project.
L7 (2026-10-28): native assess over 864ed17..6ac159c (untracked `.mcp.json`/`.atl` cache excluded) → risk medium (`configuration_change` package.json), review_due false (`under_budget`). Risk line: item 3 — `appendArrayElement` was extracted from `addArrayElement`, shared with existing behavior; independent verifier launched over S1-S10 with a differential check against 864ed17.
L8 (2026-10-28, user, verbatim): "Si porfa como PRs encadenados" — stacked-to-main. Slices: PR 1 = `appendArrayElement` extraction + component/root-provider ops + `./angular` publish (FIT-08 requires every dialect entrypoint published, so the dialect cannot land unpublished); PR 2 = route ops + their guide section + d.ts baseline. Commits get rebuilt along these slices after the verifier reports.
L9 (2026-10-28): independent verifier — S1-S10 PASS, no blockers; `addArrayElement` differential vs 864ed17 over 13 inputs IDENTICAL. Advisories applied: normalized the `./angular` export block in package.json and the pkg baseline (hash repinned), split the docs index sentence, documented that quote style decides route equality. Left as is: the wildcard insertion copies the `**` line's indent; an import conflict surfaces the `addImport` message; `Readonly<Routes>` is not recognized.
L10 (2026-10-28): history rebuilt into the stacked slices (the branch was never pushed): PR 1 `feat/angular-dialect-01-core` → main (756 changed lines, size:exception — FIT-08 requires the dialect to ship published, so ops, export, baselines and guide land together); PR 2 `feat/angular-dialect-02-routes` → PR 1.
