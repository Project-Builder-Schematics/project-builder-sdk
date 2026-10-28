Objective: Angular delivery 3 — `@NgModule` metadata ops, and NgModule-style routes for `addRoute`/`addLazyRoute`.
Branch: feat/angular-ngmodule (from main 3c00ef8). Delivery: single-pr (as delivery 2). Test runner: `bun test` (focused: `bun test test/dialects/angular`).
Inputs: delivery-1 catalog (group E) and Nx `addRouteToNgModule`; Angular v22 NgModule guide (https://angular.dev/guide/ngmodules/overview).

## Specs

S1 — `addNgModuleImport`, `addDeclaration`, `addNgModuleProvider`, `addNgModuleExport`, `addBootstrap`, each `(element, imports?)`: append to `imports`, `declarations`, `providers`, `exports`, `bootstrap` of the file's only `@NgModule`, creating the metadata or the array when missing, with the delivery-1 `(element, imports?)` rules (S1 of `odd/tasks/angular-dialect.md`). Names: `addNgModuleImport`/`addNgModuleProvider`/`addNgModuleExport` avoid the inherited `addImport` and the component ops. (Default — owner may override.)

S2 — Route target fallback: when the file has no top-level variable typed `Routes`/`Route[]`, `addRoute`/`addLazyRoute` use the routes of the only `RouterModule.forRoot(...)`/`forChild(...)` call: its inline array, or a same-file top-level variable it names whose initializer is an array. Ordering, duplicate and path rules are unchanged. (Default — owner may override.)

S3 — The "no routes" reject names both shapes: `no top-level variable typed Routes or Route[] and no RouterModule.forRoot or forChild call was found`. Several `forRoot`/`forChild` calls reject.

S4 — Route text is validated as exactly one expression before any placement, including the insertion before `**` (verifier advisory, delivery 1).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S4 | inline | done — RED 10 fail → GREEN 75 pass (angular); full suite 3701 pass, 7 fail = the 7 failing on main | PR #128 |
| T2 | — | inline | done — Project-Builder-Schematics/project-builder-docs#29 (Angular guide, both locales; addClassProperty in the TS op lists) | — |

Risk: item 3 — S2/S3 change a published op's output (a file that rejected now gets edited; the reject message changes). Independent verifier required.

## Log

L1 (2026-10-28, user, verbatim): "sigue con el grupo 3. Y si necesitas crear un issue en docs dale"
L2 (2026-10-28): `appendArrayElement` roots only accept an identifier callee, so the `RouterModule.forRoot` inline array is appended with `appendEntry` directly.
L3 (2026-10-28): independent verifier — S1-S4 PASS, no blockers. Differential vs 3c00ef8 over 37 published-op inputs: 26 successes byte-identical, 9 rejects unchanged, 2 rejects take the S3 message by design. Advisory applied: documented that an aliased `RouterModule` import is not recognized. Left as is: `@NgModule(METADATA)` rejects with the generic locator message; any `RouterModule.forRoot` call in the file counts, not only inside `@NgModule`.
