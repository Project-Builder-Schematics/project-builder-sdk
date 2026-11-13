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

- Submodule `third_party/project-builder-architecture` at a release tag. It must be **v0.15.0** (to be cut by the orchestrator): v0.14.0 lacks `json-dialect.feature` and `yaml-dialect.feature` (A-20..A-53), which hold 113 of the SDK's 136 implemented scenarios.
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
| R0 | Submodule at v0.15.0; the driver; `rules:implemented` / `rules:designed` scripts; the CI `rules` job with token skip; self-tests: tag inheritance, nothing selects both statuses, pin is a tag, non-vacuity floor (cli#152), catalog match (every step definition's expression is a CATALOG.md phrase); the strict-pass ramp (section 7, D2). No step definitions yet. | 5 (deps, CI) | the self-tests; strict pass reports 0 run / 136 pending explicitly; designed pass reports 98 |
| R1 | Steps for the json and yaml suites (16 phrases): workspace files, Dialect handle, generic op table, dialect outcomes. json and yaml leave the ramp: 113 implemented scenarios run strict. | 6 if a step weakens a Then | strict pass green on 113; designed pass reports the rest |
| R2 | Steps for dialects, chaining-rules, session, stale-nodes and content-as-truth implemented scenarios (23). Ramp empty: all 136 strict. | as R1 | strict pass green on 136 |
| R3+ | Designed families as their SDK issues land: A-17 files-directory steps, runner-guard (sdk#101), invoke and codegen, execution and catalog `@sdk` phrases. Each retag to implemented goes through an architecture PR. | per family | designed → implemented, strict |

A failing implemented scenario is drift: fix the SDK or retag upstream, never weaken the step.

### 6. Where it lives

Recommended (section 7, D1): `src/acceptance/` as CODE-LAYOUT:107-118 states — `src/acceptance/runner/`, `src/acceptance/shared/`, `src/acceptance/<context>/` for `authoring`, `runner-hosting`, `execution`, `catalog` (the folders follow the rule files' contexts, CL:108, even for contexts the SDK does not implement). `tsconfig.build.json` excludes `src/acceptance/**`, so nothing reaches `dist/`. fit-49 gains an `acceptance` class: it may import public entries, and nothing in production imports it (CL:130). Step definitions drive the public entries (`@pbuilder/sdk/*` via `src/<entry>/index.ts`) and `runFactoryForTest`, never domain internals (CL:118).

## Coordination with the layout migration

Shared touchpoints: `package.json` and `bun.lock` (R0 adds 4 devDependencies and 2 scripts), `.github/workflows/ci.yml` (R0), `tsconfig.build.json` (R0 exclude), and fit-49's `test/support/layering/{classify,rules}.ts` plus `test/fitness/fit-49-layering.test.ts` (R0's `acceptance` class), which S1a also edits. S1a does not touch `package.json` or the lockfile. Proposed order: S1a merges before R0, and R0 rebases onto it for the fit-49 files.

## 7. Decisions for the user

D1 — Placement: `src/acceptance/` as CODE-LAYOUT:107 says (excluded from the build, a fit-49 `acceptance` class) **(recommended)**, or `test/acceptance/` outside the private root (simpler, but departs from CODE-LAYOUT).

D2 — Strict-pass ramp: the 136 implemented `@sdk` scenarios have no step definitions yet, so a strict pass fails from R0. Options: a shrink-only list of pending features, each row with the slice that removes it, which the strict pass skips with an explicit count, and which must hold only features with undefined steps **(recommended)**; or land R0 together with the json/yaml steps (one much larger first PR); or have the architecture repo retag them designed until the SDK steps exist (moves status upstream for a tooling gap).

D3 — Dependencies (risk item 5): the four `@cucumber/*` packages as devDependencies only **(recommended)**, or `@cucumber/cucumber` as a separate runner.

D4 — Actions outside this repo: the orchestrator cuts architecture v0.15.0; the user adds the `ARCHITECTURE_READ_TOKEN` secret to the SDK repository. Follow-up: A-17's 15 scenarios are `@status:designed @issue:sdk-149` though sdk#149 shipped in 0.14.0; whether they move to implemented depends on the engine side too (they are shared with `@engine`).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| P1 | S1, S2 | inline, two read-only explorers (engine/CLI mechanics; architecture inventory) | done | this commit |
| P2 | — | the user's answers to D1-D4 | pending | — |

Route evidence: the plan needed three repositories' evidence, beyond the inline budget, so the mapping trigger fired; the write is one document, inline.

## Log

L1 (2026-11-13, user via the orchestrator, verbatim): "Para esta caso montemos todo para correr el tema de las reglas de arquitectura". Previously this was a deferred follow-up (`odd/tasks/hexagonal-layout.md`); it is now in scope.

L2 (2026-11-13): plan written from two maps (engine/CLI origin/main; architecture origin/main 0dd9ea9) and npm metadata for the runner candidates. No source change; no heavy run.
