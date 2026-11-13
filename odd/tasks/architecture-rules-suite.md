Objective: run project-builder-architecture's `@sdk` scenarios in the SDK, as the engine and the CLI run theirs: a pinned architecture checkout, a strict pass over `@status:implemented` and a non-strict pass over `@status:designed`.
Branch: feat/architecture-rules-suite off origin/main 0ea78c7. Plan only; implementation waits for the user's answers (section 7). Runs alongside the hexagonal layout migration (`odd/tasks/hexagonal-layout.md`). Test runner: `bun test`.

## Specs

S1 — The user's request, verbatim: "Para esta caso montemos todo para correr el tema de las reglas de arquitectura".

S2 — Orchestrator brief: "Set up the SDK so it runs project-builder-architecture's rules: the .feature scenarios tagged for the SDK, the same as the engine and CLI." Plan first: how the engine and CLI do it; the TS runner choice ("prefer the lightest one that executes the Gherkin as written"; adding a dependency is risk item 5); the pin; the inventory; a slice plan, one PR each; where it lives under the hexagonal layout. Keep its files apart from S1a/S1b of the layout migration; heavy runs need the orchestrator's slot.

## Plan

### 1. How the engine and CLI do it (origin/main of each)

- Pin: a git submodule `third_party/project-builder-architecture` at a release tag (engine v0.14.0, CLI v0.13.1). Bumping is a visible commit. Nothing checks that the gitlink is a tag.
- CI: the repo is private. Engine `ci.yml:592-604` checks it out at the gitlink SHA with `secrets.ARCHITECTURE_READ_TOKEN`; the CLI runs `git submodule update` with the token through `insteadOf`. Both skip with a `::notice::` when the secret is absent (architecture `README.md:62-69`: "Where the submodule is not available, the rule suites are skipped, not failed").
- Runner: godog in a nested module behind a `rules` build tag. Two passes: `@<repo> && @status:implemented` strict (an undefined, pending or failing step fails the build) and `@<repo> && @status:designed` non-strict (reports, never fails). Recipes `just rules-implemented` / `just rules-designed`. Tag-inheritance self-tests (Feature, Rule, Scenario, Examples tags inherit; nothing selects both statuses).
- Catalog contract (`steps/CATALOG.md:3`): consumers implement the catalog's phrases and "do not invent phrasing". Neither repo checks it in code; only the strict pass's undefined-step failure enforces it.
- Lessons: cli#152 (open) — a strict pass that selects 0 scenarios exits 0 and proves nothing; needs a non-vacuity floor. Engine L6/L10/L11 — a failing implemented scenario is drift: fix the code or retag upstream, never weaken the step.
- Layout (CODE-LAYOUT:103-118): `<private code root>/acceptance/{<context>/, shared/, runner}`; steps drive public entry points or driving ports, never domain internals; nothing in production imports `acceptance/` (CL:130).

### 2. Runner choice for TypeScript under bun

| Option | Deps (npm, unpacked) | bun | CI cost | Verdict |
|---|---|---|---|---|
| `@cucumber/cucumber` 13.3 | 32 direct deps, 1.1 MB | Node CLI; runs outside `bun test`, its own reporters and loader | a second test tool and process | heavier than needed |
| `@cucumber/gherkin` 43 + `@cucumber/messages` 35 + `@cucumber/cucumber-expressions` 20.2 + `@cucumber/tag-expressions` 11 driving `bun test` | 4 packages, 3 transitive deps in total; pure JS | runs inside `bun test` | the existing job, one extra command | **recommended** |
| vitest-cucumber / quickpickle | 4-11 deps, vitest-bound | needs vitest | a second test framework | no |

The recommended set is Cucumber's own parser and matchers: `gherkin` compiles each `.feature` into pickles (Outlines expanded per `Examples` row, tags inherited exactly as Cucumber defines), `cucumber-expressions` matches the catalog's `"{name}"` phrases, `tag-expressions` evaluates `@sdk and @status:implemented`. A ~150-line driver turns each pickle into a `bun test` case. So the Gherkin runs as written, with no rewrite. All four go in `devDependencies` only: the published dependency set (fit-14) and the tarball do not change. Risk item 5 (dependencies); the justification is above.

### 3. The pin

- Submodule `third_party/project-builder-architecture` at a release tag. It must be **v0.17.0** (amended in L8 and L9; was v0.15.0): v0.14.0 lacks `json-dialect.feature` and `yaml-dialect.feature` (A-20..A-53), which hold 113 of the SDK's 136 implemented scenarios.
- CI: a new `rules` job in `.github/workflows/ci.yml` that checks the repo out at the gitlink SHA with `ARCHITECTURE_READ_TOKEN` (the engine's pattern), skipping with a notice when the secret is absent. The SDK repository needs that secret (user action).
- Not shipped: the npm package's `files` is `dist` and `schemas`; the submodule never reaches the tarball.
- A guard the engine and CLI lack: a test that the gitlink equals a `v*` tag of the architecture repo.

### 4. Inventory at architecture 0dd9ea9

234 `@sdk` scenario definitions: **136 implemented, 98 designed** (about 339 runner cases once `Examples` rows expand). 172 distinct catalog phrases are used by `@sdk` scenarios; about 47 by the implemented ones.

| Feature | Impl | Designed | Note |
|---|---|---|---|
| authoring/json-dialect (A-20..A-38) | 58 | 2 | @issue:sdk-154, sdk-162 |
| authoring/yaml-dialect (A-39..A-53) | 55 | 0 | |
| authoring/dialects | 12 | 10 | |
| authoring/chaining-rules | 5 | 0 | |
| authoring/session | 3 | 4 | |
| authoring/content-as-truth | 2 | 9 | 5 shared with @engine |
| authoring/stale-nodes | 1 | 1 | |
| authoring/file-name-tokens (A-17) | 0 | 15 | @issue:sdk-149 (shipped in 0.14.0) — the SDK side holds; see section 7 |
| authoring/invoke, invoke-boundary | 0 | 20 | |
| runner-hosting/runner-guard (R-2) | 0 | 32 | all @issue:sdk-101, shared with @engine |
| execution/integrity-and-netting, read-set | 0 | 4 | |
| catalog/resolution-scope (CA-12) | 0 | 1 | |

The json and yaml suites need 16 phrases: the workspace file steps (inline and docstring, with and without a final newline), `the author opens the Dialect handle "{handle}" of the dialect "{dialect}" on the file "{path}"`, `the factory ends`, the generic `the author applies the op "{op}" through the Dialect handle "{handle}" with the arguments:` (argument | value table of JSON text, with the CATALOG.md:30 conventions for `a Date`, `NaN`, `fn` and `\n`), the file content assertions, and seven dialect failure outcomes (CATALOG.md:492-499). One runner-guard phrase writes `"../"` as literal text, not a parameter (CATALOG.md:614).

### 5. Slice plan (one PR each)

| Slice | Scope | Risk | Proof |
|---|---|---|---|
| R0 | Submodule at v0.17.0; the driver; `rules:implemented` / `rules:designed` scripts; the CI `rules` job with token skip; self-tests: tag inheritance, nothing selects both statuses, pin is a tag, non-vacuity floor (cli#152), catalog match (every step definition's expression is a CATALOG.md phrase); the strict-pass ramp (section 7, D2). No step definitions yet. | 5 (deps, CI): exact-version devDependencies only; independent verifier | the self-tests; fit-14 unchanged (published dependencies, tarball); strict pass reports 0 run / 136 pending explicitly; designed pass reports 98 |
| R1 | Steps for the json and yaml suites (16 phrases): workspace files, Dialect handle, generic op table, dialect outcomes. json and yaml leave the ramp: 113 implemented scenarios run strict. | 6 if a step weakens a Then | strict pass green on 113; designed pass reports the rest |
| R2 | Steps for dialects, chaining-rules, session, stale-nodes and content-as-truth implemented scenarios (23). Ramp empty: all 136 strict. | as R1 | strict pass green on 136 |
| R3+ | Designed families as their SDK issues land: A-17 files-directory steps, runner-guard (sdk#101), invoke and codegen, execution and catalog `@sdk` phrases. Each retag to implemented goes through an architecture PR. | per family | designed → implemented, strict |

A failing implemented scenario is drift: fix the SDK or retag upstream, never weaken the step.

### 6. Where it lives

Recommended (section 7, D1): `src/acceptance/` as CODE-LAYOUT:107-118 states — `src/acceptance/runner/`, `src/acceptance/shared/`, `src/acceptance/<context>/` for `authoring`, `runner-hosting`, `execution`, `catalog` (the folders follow the rule files' contexts, CL:108, even for contexts the SDK does not implement). `tsconfig.build.json` excludes `src/acceptance/**`, so nothing reaches `dist/`. fit-49 gains an `acceptance` class: it may import public entries, and nothing in production imports it (CL:130). Step definitions drive the public entries (`@pbuilder/sdk/*` via `src/<entry>/index.ts`) and `runFactoryForTest`, never domain internals (CL:118).

## Coordination with the layout migration

Shared touchpoints: `package.json` and `bun.lock` (R0 adds 4 devDependencies and 2 scripts), `.github/workflows/ci.yml` (R0), `tsconfig.build.json` (R0 exclude), and fit-49's `test/support/layering/{classify,rules}.ts` plus `test/fitness/fit-49-layering.test.ts` (R0's `acceptance` class), which S1a also edits. S1a does not touch `package.json` or the lockfile. Proposed order: S1a merges before R0, and R0 rebases onto it for the fit-49 files.

## 7. Decisions for the user

D1 — Placement: **settled by the rule (L3)** — `src/acceptance/` as CODE-LAYOUT:107 says, excluded from the build, with a fit-49 `acceptance` class.

D2 — Strict-pass ramp: **resolved (L3): the shrink-only pending-features list.** The 136 implemented `@sdk` scenarios have no step definitions yet, so a strict pass fails from R0. Options were: a shrink-only list of pending features, each row with the slice that removes it, which the strict pass skips with an explicit count, and which must hold only features with undefined steps **(recommended)**; or land R0 together with the json/yaml steps (one much larger first PR); or have the architecture repo retag them designed until the SDK steps exist (moves status upstream for a tooling gap).

D3 — Dependencies (risk item 5): **resolved (L4): the four `@cucumber/*` packages** (`gherkin`, `messages`, `cucumber-expressions`, `tag-expressions`) as devDependencies only, exact versions, driven from `bun test`; R0 proves fit-14's published dependency set unchanged and gets an independent verifier. The alternative was `@cucumber/cucumber` as a separate runner.

D4 — Actions outside this repo: **resolved (L5), amended (L8, L9): R0 pins v0.17.0** — architecture v0.15.0 is cut (annotated tag on 0dd9ea9); the SDK repository already lists an `ARCHITECTURE_READ_TOKEN` secret (created 2026-11-07), unverified; R0's CI job skips with a notice when the secret is absent or the checkout fails, as the engine's does. Follow-up: A-17's 15 scenarios are `@status:designed @issue:sdk-149` though sdk#149 shipped in 0.14.0; whether they move to implemented depends on the engine side too (they are shared with `@engine`).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| P1 | S1, S2 | inline, two read-only explorers (engine/CLI mechanics; architecture inventory) | done | this commit |
| P2 | — | the user's answers to D1-D4 | done (L3-L5) | — |
| R0a | plan §5 R0 without fit-49 and CI; D1-D4 | inline | done — self-tests 23/23, both passes run, fit-14 unchanged, manual-publish 69/69 | 202f64d |
| R0b | fit-49 `acceptance` class (classify.ts row, rules.ts rule, fit-49 case) | inline | waits for layout S1b to merge (S1b owns `test/support/layering/*`) | — |
| R0c | CI `rules` job | inline; independent verifier (risk item 5) | committed (does not depend on R0b); verifier and full suite wait for the heavy slot | this commit |

Route evidence: the plan needed three repositories' evidence, beyond the inline budget, so the mapping trigger fired; the write is one document, inline.

## Log

L1 (2026-11-13, user via the orchestrator, verbatim): "Para esta caso montemos todo para correr el tema de las reglas de arquitectura". Previously this was a deferred follow-up (`odd/tasks/hexagonal-layout.md`); it is now in scope.

L2 (2026-11-13): plan written from two maps (engine/CLI origin/main; architecture origin/main 0dd9ea9) and npm metadata for the runner candidates. No source change; no heavy run.

L3 (2026-11-13, via the orchestrator): D1 settled by the rule, not a user call — CODE-LAYOUT:107 places acceptance under `<private code root>/acceptance/`, so `src/acceptance/`, excluded from the build, with a fit-49 `acceptance` class (orchestrator checked the text at architecture main). D2, user decision verbatim: "vamos con la 1" — a shrink-only pending-features list: each row names the slice that removes it; the strict pass reports the pending count explicitly; a row is valid only while that feature's steps are really undefined, and a stale row fails; a CEILING applies, as in fit-49. No implementation until D3 and D4 are answered.

L4 (2026-11-13, user via the orchestrator, D3, verbatim): "vamos con el 1". The four `@cucumber/*` packages (`gherkin`, `messages`, `cucumber-expressions`, `tag-expressions`) as devDependencies, driven from `bun test`. Pin exact versions (no `^`), devDependencies only; R0 must prove fit-14's published dependency set unchanged. Risk item 5, so R0 gets an independent verifier.

L5 (2026-11-13, user via the orchestrator, D4, verbatim): "si dale" — architecture v0.15.0 cut and pushed (annotated, on 0dd9ea9, verified with `git cat-file -t v0.15.0` = tag). The token secret is the user's own step; `gh secret list` already shows `ARCHITECTURE_READ_TOKEN` on the SDK repository (created 2026-11-07), not verified to work, so R0's CI job keeps the skip-with-notice path. All four decisions are in. Order: R0 starts after layout S1a merges (shared fit-49 files); heavy runs need the orchestrator's slot.

L6 (2026-11-13, orchestrator correction to L5): the SDK repository already has `ARCHITECTURE_READ_TOKEN` (set 2026-11-07, the same date as the engine's and the CLI's), so the user has nothing to add. R0's CI job keeps the skip-with-notice path for forks and fork PRs, which get no secrets, but in the main repository it is expected to run; a skip on a main-repo run is a defect to investigate, not a pass.

L7 (2026-11-13, via the orchestrator): architecture #69 (A-83..A-86, dialect composition) adds CATALOG steps that, as written, need the kit (`defineDialect`, `withOps` and the rest), which is not in the published `exports`. Importing `src/core/define-dialect.ts` from step code would break CODE-LAYOUT:117 (steps use public entries or driving ports, never internals), and the path would break when layout S1b moves the kit. Choice: A-83..A-86 stay `@status:designed` in the SDK, outside the strict pass, with a pending-features row that names sdk#103 (the published registration surface) as the slice that removes it. When sdk#103 lands, the steps import that public entry. A driving port that exposes the kit only to acceptance code was not chosen: it would create a second, unpublished registration surface before sdk#103 settles the real one. Unrelated bug sdk#181 (a base op named `read` replaces `handle.read`) is outside this suite and the layout migration.

L8 (2026-11-13, user via the orchestrator, D4 amendment, verbatim): "si dale, cortá la v0.16.0". Architecture v0.16.0 is cut and pushed (annotated, at fc22dfc) and carries #67 (TypeScript rules), #68 (React), #69 (dialect composition) and #70 (composition steps moved to designed, `@issue:sdk-103`). R0 pins the submodule at v0.16.0 in place of v0.15.0.

L9 (2026-11-13, user via the orchestrator, second D4 amendment, verbatim): "si dale, cortá la v0.17.0". Architecture v0.17.0 is cut and pushed (annotated, at 0064fc2) and carries #71: css A-88..A-92, nestjs A-93..A-94, angular A-95..A-105, and the A-87 rejection wording for every dialect. With it, every SDK dialect op has a rule. R0 pins the submodule at v0.17.0, superseding L8. The inventory counts in the Plan were measured at 0dd9ea9; R0 re-measures them at v0.17.0 before setting the non-vacuity floor (the orchestrator expects about 54 more implemented scenarios).

L10 (2026-11-14, via the orchestrator): S1a merged (main 493aa76); R0 starts here, on this branch rebased onto it. Order approved: R0a (runner, submodule, devDependencies, scripts, self-tests, pending list) first; R0b (the fit-49 `acceptance` class) after S1b merges, because S1b owns `test/support/layering/*`; R0c (the CI `rules` job) last, sequenced with the CI-optimization work.

L11 (2026-11-14): inventory re-measured at v0.17.0 (0064fc2), counting runner cases (Outlines expanded): 346 `@sdk @status:implemented`, 208 `@sdk @status:designed`, none tagged both, none untagged. Implemented scenarios span 13 features: typescript 76, yaml 71, json 70, react 49, angular 28, css 18, dialects 15, nestjs 7, chaining-rules 5, session 3, content-as-truth 2, stale-nodes 1, dialect-composition 1. `IMPLEMENTED_FLOOR` is 346 and `PENDING_CEILING` 13. Slice plan amended for the dialects v0.16.0 and v0.17.0 added: R1 json and yaml; R2 dialects, chaining-rules, session, stale-nodes, content-as-truth; R3 typescript and react; R4 css, angular, nestjs; dialect-composition leaves with sdk#103 (L7); the plan's R3+ (designed families) becomes R5+.

L12 (2026-11-14): R0a choices. The two passes are `src/acceptance/runner/{implemented,designed}.rules.ts`, outside `bun test`'s default discovery, run by `bun run rules:implemented` and `bun run rules:designed`; the self-tests live in `test/acceptance/runner/` and run in the normal suite. A missing checkout skips with a `::notice::`, and fails when `RULES_REQUIRE_ARCHITECTURE=1`, which the CI `rules` job sets in the main repository (L6). Step definitions are written as their exact catalog phrase; a quoted `"{name}"` compiles to `{string}` and everything else matches literally, so a definition cannot invent phrasing. `tsconfig.json` excludes `third_party/**` (the checkout's own scripts are not SDK code) and `tsconfig.build.json` excludes `src/acceptance`. The submodule was added with `gh`'s credential helper passed per command; no git config changed.

L13 (2026-11-14, via the orchestrator): the slice amendment in L11 is confirmed. R1: json, yaml. R2: dialects, chaining-rules, session, stale-nodes, content-as-truth. R3: typescript, react. R4: css, angular, nestjs. dialect-composition stays pending until sdk#103. The designed families become R5+. R0c goes ahead before R0b; R0 goes up as one PR after the verifier.

L14 (2026-11-14): R0c adds the `rules` job to `.github/workflows/ci.yml`, after the engine's pattern: it checks the architecture repository out at the gitlink with `ARCHITECTURE_READ_TOKEN` (tags fetched for the pin self-test), then runs `bun test test/acceptance`, `rules:implemented` and, even after a strict failure, `rules:designed`, all with `RULES_REQUIRE_ARCHITECTURE=1`. Only a fork PR may skip, with a notice; a missing token in this repository fails the job (L6). The job runs in parallel with `Test, typecheck, build` and is not a required check. R0a also changed the bytes of `package.json` and `bun.lock`, which `test/fitness/manual-publish.test.ts` pins by git blob hash, so the pins were updated and folded into the R0a commit (202f64d) with an autosquash rebase, keeping every commit green; that failure was missed in the first R0a report, and `manual-publish` now passes 69/69 on 202f64d and on the branch head. Light checks: `fit-23`, `pyramid`, `manual-publish` and `security-authoring-guard` pass.
