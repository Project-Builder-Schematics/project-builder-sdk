Objective: decide the public locator that TypeScript-dialect ops use to reach a nested node (the decision record lives here, not in `openspec/`), then ship `addArrayElement` as its first op.
Branch: feat/ts-array-locator (from main 1685bb3). Delivery: ask-on-risk. Test runner: `bun test` (focused: `bun test test/dialects/typescript`).
Inputs: ecosystem demand survey (Engram `project-builder-sdk/ts-ops/ecosystem-demand-survey`); `openspec/` is a read-only historical archive (owner, 2026-10-28).

## Specs

S1 — Locator root: a typed root plus a JSON-style path. The root is one of three kinds — a top-level variable, an argument of a call, or a decorator — followed by a path of property keys and indices. Owner choice: "Raíz tipada + ruta (Recommended)". Shape agreed in the option preview:

```ts
addArrayElement({ variable: "appConfig", path: ["providers"] }, "provideHttpClient()")
addArrayElement({ call: "bootstrapApplication", argument: 1, path: ["providers"] }, ...)
addArrayElement({ decorator: "NgModule", path: ["imports"] }, ...)
addArrayElement({ variable: "routes", path: [] }, ...)
```

S2 — Inserted element: owner choice "Identificador o { expression } (Recommended)". A plain string is an identifier validated with `assertValidImportBinding`; `{ expression: "..." }` is parsed and must be exactly ONE expression with no syntax errors, its content author-trusted like `source`/`initializer`. Agreed examples:

```ts
addArrayElement(loc, "UserService")            // identifier, validated
addArrayElement(loc, { expression: "provideHttpClient()" })

addArrayElement(loc, "x]; process.exit(")      // rejects: not an identifier
addArrayElement(loc, { expression: "a]; evil(" })  // rejects: not one expression
```

The op adds no import; the author pairs it with `addImport` (assumption, default — owner may override).
S3 — Root ambiguity: the root must match exactly once; zero or several matches reject, as NestJS `@Module` and React `elementName` do (default — owner may override).
S4 — Path segments: owner choice "Claves + match por valor (Recommended)". A string segment is an object key; an object segment `{ key: "value" }` selects the only array element whose object literal has that property set to that string literal (zero or several → reject). No numeric indices. Agreed example:

```ts
addArrayElement(
  { variable: "routes", path: [{ path: "admin" }, "providers"] },
  "AdminGuard" )

// export const routes = [
//   { path: "", component: Home },
//   { path: "admin", providers: [AdminGuard] },  <- here
// ];
```
S5 — Missing levels: owner choice "Crear claves, rechazar el resto (Recommended)". A missing key is created (an intermediate object, or the final array); a missing call argument is created only when it is the next one; the root and a match-selected element are never invented — those reject. Agreed examples:

```ts
// export const appConfig = {};
addArrayElement({ variable: "appConfig", path: ["providers"] }, "X")
// -> export const appConfig = { providers: [X] };

// bootstrapApplication(App);
// -> bootstrapApplication(App, { providers: [X] });

// no route with path "admin" -> rejects
```
S6 — Duplicates: owner choice "No-op por estructura (Recommended)". When an existing element is the same identifier, or the same expression ignoring whitespace, line breaks, comments and trailing comma, the op does nothing (zero directives). Agreed examples:

```ts
// providers: [provideHttpClient( )]
addArrayElement(loc, { expression: "provideHttpClient()" })
// -> no change

// providers: [provideHttpClient(withFetch())]
// -> appends: different expression
```
S7 — Placement: append only, no position option. The NestJS `appendEntry` moves to a shared TypeScript helper that both dialects use, keeping NestJS output byte-identical (default — owner may override).
S8 — Error tails: `addArrayElement(<locator>) on "<path>" — <reason>. Edit it with .modify().`, with path segments echoed through the existing bounded-echo helpers (default — owner may override).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S8 | inline | done — decisions recorded in `## Specs` (this document is the decision record) | — |
| T2 | S7 | inline | done — `appendEntry` moved to `src/dialects/typescript/array-element.ts`; NestJS tests 45 pass; package baseline gains the new dist files | cb660d5 |
| T3 | S1-S8 | inline | done — RED 60 fail → GREEN 67 pass; typecheck clean; verifier PASS S1-S8 | db43b55 |
| T4 | S7 | inline | done — trailing comma read from tokens; RED 5 fail → GREEN (TS + NestJS 506 pass) | b07b1e6 |

## Log

L1 (2026-10-28, user, verbatim): "vamos con eso" — start the Group 4 locator ADR with `addArrayElement` first, after accepting the reorder ("Si me gusta").
L2 (2026-10-28, user, verbatim): "para este repo ya no quiero que sigamos sdd, usemos gente-ai"; "no, déjalo como archivo histórico" — no openspec edits; the ADR is recorded in this document and `docs/`.
L3 (2026-10-28): exploration map — JSON/YAML address nodes with `JsonPath = readonly (string | number)[]` (`src/core/json-value.ts:5`), printed with `formatPath`; NestJS `locate` (`src/dialects/nestjs/ops.ts:33`) and `appendEntry` (`:51`) already append layout-preserving entries to array/object literals; the kit passes op args unvalidated (`src/core/dialect-handle.ts:425`), so locator validation is the op's job. Adding a TS op touches 10 files (ops.ts, pack.ts, index.ts JSDoc, a new ops test, ops-exact-set, ops-name-validation, security-authoring-guard, README, docs/authoring-a-dialect.md, docs/nestjs-dialect.md) plus CHANGELOG at release.
L4 (2026-10-28): S1 decided by the owner (option "Raíz tipada + ruta (Recommended)").
L5 (2026-10-28): S2 decided by the owner (option "Identificador o { expression } (Recommended)"). S3, S7, S8 set to the repo's existing conventions as defaults, reported to the owner for override.
L6 (2026-10-28): S4 decided by the owner (option "Claves + match por valor (Recommended)").
L7 (2026-10-28): S5 decided by the owner (option "Crear claves, rechazar el resto (Recommended)").
L8 (2026-10-28): S6 decided by the owner (option "No-op por estructura (Recommended)"). Design closed; a separate ADR file would only repeat `## Specs`, so this document is the decision record and the public explanation goes to `docs/authoring-a-dialect.md` with T3. Risk: item 2 (the `{ expression }` parse guard is a security gate) and item 3 (T2 moves code NestJS ops use) — T2 and T3 commit separately; T3 gets an independent verifier.
L9 (2026-10-28): T2 + T3 committed (cb660d5, 5fb1b83). Full suite at 5fb1b83: 3578 pass, 8 fail — FIT-14 (new dist files, change-caused) folded into cb660d5 and green; the other 7 reproduce at the base or are environmental (local Bun 1.4.4 vs the 1.3.14 pin; worktree-path e2e and runner-closure tests; quickstart timeout under load, green on rerun). `gentle-ai review assess` 1685bb3..HEAD committed-only: high (executable change in `src/core/jsx-name-validator.ts`, escalated item 2), review due. Independent verifier launched before review.
L10 (2026-10-28): independent verifier — S1-S8 PASS, no blockers; 52 `{ expression }` breakout probes rejected; 1,440-case NestJS/TS differential byte-identical to 1685bb3. Advisories: (1) a comma inside a comment after the last entry misplaces `appendEntry`'s insert (pre-existing in NestJS); (2) root names and path keys echoed unbounded — an S8 gap, fixed into the feature commit (now db43b55); (3) `{ expression: "a <!-- b" }` accepted (author-trusted, S2); (4) ts-morph `addArgument` drops a call's trailing comma and joins a multi-line argument list — valid output.
L11 (2026-10-28): owner on advisory 1: "Arreglarlo en esta rama (Recommended)" — T4, own commit b07b1e6; NestJS output changes only where it was invalid or landed inside a comment.
