# slnx-add-project-single-type-services

Objective: implement project-builder-sdk#261 (msbuild `addProject`, rule A-119) and #262 (aspnet `addService` single-type registrations, rule A-116 as changed).
Branch: `feat/slnx-add-project-single-type-services` (from main eb5b7bf, carries 627fc62). Delivery: ask-on-risk. Test runner: `bun test`; rules: `bun run rules:designed` / `bun run rules:implemented`.

## Specs

Source of truth: project-builder-architecture PR #107, merge commit 31d376f, pinned as the `third_party/project-builder-architecture` submodule. New scenarios are tagged `@sdk @status:designed` with `@issue:sdk-261` or `@issue:sdk-262`.

- S1 — A-116 (sdk#262), `bounded-contexts/authoring/rules/aspnet-dialect.feature`: "When `implementation` is left out or equals `service`, the op writes `<receiver>.Add<lifetime><service>();`, and the rest of this rule takes `service` as the implementation." "`Add<lifetime><service>()` and `Add<lifetime><service, service>()` are the same registration. A registration of the same lifetime, service and implementation, called with no arguments, already in those statements leaves the file as it is. One of the same service and implementation rejects when it has another lifetime or passes arguments, such as a factory, whatever its lifetime."
- S2 — A-119 (sdk#261), `bounded-contexts/authoring/rules/msbuild-dialect.feature`: "`addProject(path, options)` adds `<Project Path="path" />` to a file whose root element is `Solution`; any other root, or no root element, rejects." Placement, the `folder` option and idempotency exactly as the rule text states.
- S3 — Docs: the `msbuild.find` and `aspnet.find` JSDoc, `docs/guides/msbuild-dialect.md`, `docs/guides/aspnet-dialect.md` and README describe the new behaviour.
- S4 — Done when: every `@issue:sdk-261` and `@issue:sdk-262` scenario passes under `rules:designed`, and the existing suite stays green.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T0 | — | inline | done — pinned to v0.25.0 (5b9dda2, holds PR #107 and #108); rules:implemented 496/0; pin fitness tests green | f4ac768, see L5 |
| T1 | S1, S3 | inline | done — 11 unit tests RED then GREEN (aspnet 30/30); every sdk-262 scenario passes | 87bc389 |
| T2 | S2, S3 | inline | done — 28 unit tests RED then GREEN (msbuild 67/67); every sdk-261 scenario passes; API snapshot and bundle baselines updated | f91235c, 4769244 |

Route evidence: each unit is about 100-200 changed lines and they share the docs and README, so the Writer trigger does not hold; the parent writes inline.

## Log

- L1 (2026-11-27, Daniel): "buddy puedes revisar los ultimos dos issues que estan en el repo" — then "esperemos a architecture para que actualices tambien lo que sea necesario ahi".
- L2 (2026-11-27, peer session architecture): "The rules for sdk#261 and sdk#262 are merged into project-builder-architecture main as PR #107 (merge commit 31d376f), so you can implement them now. [...] Their new scenarios are tagged @status:designed with @issue:sdk-261 or @issue:sdk-262; flip each one to @status:implemented once it passes."
- L3 (2026-11-27): baseline on the new pin had 10 `bun test` failures unrelated to the dialects (Bun pin, bundle size of `.`/commons, FIT-42N, REQ-WPS-07 absolute paths, timeouts, the uncommitted pin). After T2 the same set remains, plus the pin's `v*` tag check. `rules:designed`: 6 -> 20 pass, no aspnet or msbuild failure. Next: architecture tags a release holding 31d376f and flips the sdk-261/262 scenarios to implemented; then re-pin to that tag. Engram mirror: see L4.
- L4 (2026-11-27, peer session architecture, Daniel's decision): A-119 changed in architecture PR #108: "a solution folder name: `/` followed by one or more non-empty segments that each end in `/`, such as `/src/` or `/src/Core/`. Any other value rejects, `/` and `/src//` included." Done in 4769244: 3 RED cases then GREEN (msbuild 70/70); `rules:implemented` 496/0 against PR #108 (194902e). Next: re-pin to v0.25.0 once Daniel merges #108 and architecture cuts the tag. Engram mirror: project `project-builder-sdk` (Daniel's choice).
- L5 (2026-11-27): re-pinned the submodule to v0.25.0 (5b9dda2); rules:implemented 496/0. Engram mirror saved (topic odd/slnx-add-project-single-type-services/tasks, project project-builder-sdk).
