# csharp-dialects

Objective: ship `@pbuilder/sdk/csharp`, `@pbuilder/sdk/aspnet` and `@pbuilder/sdk/msbuild` (project-builder-sdk#256, rules A-106 to A-118) so schematics can scaffold a hexagonal architecture in .NET.
Branch: `feat/csharp-dialects` (from main b09f199). Delivery: ask-on-risk. Test runner: `bun test`; rules: `bun run rules:designed` (the scenarios are `@status:designed`).

## Specs

Source of truth: project-builder-architecture v0.23.0 (a6ee4b2; the rules of PRs #94, #95 and #97), pinned as the `third_party/project-builder-architecture` submodule. Every scenario is tagged `@sdk @status:designed @issue:sdk-256`.

- S1 — csharp (A-106..A-114): `bounded-contexts/authoring/rules/csharp-dialect.feature`. Ops `addUsing`, `addBaseType`, `addMember`, `addConstructorParameter`.
- S2 — aspnet (A-115, A-116): `bounded-contexts/authoring/rules/aspnet-dialect.feature`. Op `addService(lifetime, service, implementation, { serviceFrom?, implementationFrom?, method? })`.
- S3 — msbuild (A-117, A-118): `bounded-contexts/authoring/rules/msbuild-dialect.feature`. Op `addProjectReference(path)`.
- S4 — Settled decisions (L1, verbatim): "C# is one more SDK dialect, not a separate C# SDK. Model it on nestjs: base dialect + withOps(csharpOps, aspnetOps)." "Parser: web-tree-sitter + tree-sitter-c-sharp 0.24.0 WASM. Not @ast-grep/lang-csharp (native, 0.0.6, grammar 0.23.1)." "ast.parse is sync; use a top-level await in the csharp module for Parser.init()/Language.load()." "Every op that takes a type name has optional `from` (namespace) and adds the using unless the file already sees it. addService uses serviceFrom and implementationFrom." "addConstructorParameter edits primary constructors only; a type with an explicit constructor rejects." "msbuild edits XML text, never calls the dotnet CLI; .sln is rejected. It needs an XML parser that preserves bytes outside the edit; none in current deps." "Dialects never read .editorconfig (A-5)."
- S5 — Distribution (L1): "The .wasm files must be listed in dist/runner-manifest.json (R-3 completeness, R-7 digests)."
- S6 — Done when (issue #256): "Every scenario of the three features passes, and the dialects pass the conformance fixture (A-11)."

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S4 | inline | done — rules RED (no step drives csharp) then 30/30 csharp scenarios GREEN on e35b5de; 72 unit tests | — |
| T2 | S2, S4 | inline (depends on T1) | done — 6/6 aspnet scenarios GREEN; 15 unit tests | — |
| T3 | S3, S4 | delegated writer (parallel with T1/T2, disjoint surface) | done — writer RED then 42 GREEN; all msbuild scenarios GREEN | — |
| T4 | S5, S6 | inline (shared files: package exports, baselines, manifest) | in progress | — |

Route evidence: T3 is an independent unit (own XML dependency, own files) of several hundred lines launched alongside T1, so the Writer trigger (a) holds. Shared files (package.json, bun.lock, fitness baselines, acceptance `DIALECTS`, README) stay with the parent.

## Log

- L1 (2026-11-25, peer session project-builder-architecture-d0 on Daniel's behalf): "Please implement project-builder-sdk#256: the csharp, aspnet and msbuild dialects (rules A-106 to A-118)." Full message holds the S4/S5 decisions and these gotchas: "Types after a file_scoped_namespace_declaration are siblings in compilation_unit, not children." "`global`/`static` on using_directive are anonymous tokens; record struct is a record_declaration with a `struct` token; primary-ctor params are an unnamed parameter_list child." "In the .feature tables, Gherkin unescapes `\\`, so the msbuild path arguments use forward slashes." "If a rule turns out wrong or unimplementable, message me (project-builder-architecture-d0) instead of diverging."
- L2 (2026-11-25): research — web-tree-sitter 0.27.2 loads tree-sitter-c-sharp 0.24.0's wasm (ABI 15) under Bun and Node and parses file-scoped namespaces, primary constructors, record structs and top-level statements without ERROR. The tree-sitter-c-sharp npm package runs `node-gyp-build` on install, so its 7.2 MB `tree-sitter-c_sharp.wasm` (MIT) is vendored, not a dependency. XML: `saxes` 6.0.0 (strict XML 1.0 well-formedness, UTF-16 offsets) for msbuild. Pin bump to 8081e4b: `rules:implemented` 418 pass, 0 fail; `rules:designed` RED baseline: every csharp/aspnet/msbuild scenario fails with "no step drives the dialect".
- L3 (2026-11-25): two csharp-dialect.feature rows broke the CATALOG conventions (A-113 source cell `\n` not `\\n`; A-107 addBaseType row listed `base` before `typeName`). Reported to the rules owner, fixed in project-builder-architecture #97; pin moved to e35b5de. The owner also wrote the msbuild empty-file behaviour into A-117/A-118 (an empty file parses with no root; addProjectReference rejects it), which the writer had implemented.
- L4 (2026-11-25): `rules:designed` on e35b5de: 202 selected, 65 pass, 10 fail (none in the three features), 127 undefined; `rules:implemented` 418 pass, 0 fail. The C# grammar wasm is vendored under the csharp adapter with its MIT license, copied to dist by `scripts/copy-dist-assets.ts` and appended to the runner manifest from `DIST_ASSETS` (30 records). fit-49: `aspnet -> csharp` added to ALLOWED_SIBLINGS; the adapter loads the wasm by path (`node:url`), not `node:fs`. Pre-existing failures on main b09f199 (same suites): FIT-42N x3 (EACCES under this environment), fit-52 drift on existing entries (left as is; only the three new entries added to the baseline), FIT-40 Bun pin (1.4.4 vs 1.3.14), REQ-FSP-01. The machine ran at load average 13-20, so build-dependent hooks hit Bun's 5 s default; reruns use `--timeout 60000`.
- L5 (2026-11-25, rules owner): "project-builder-architecture now has the release tag v0.23.0 (main a6ee4b2). You can pin the submodule to it instead of a bare commit." Pinned to v0.23.0; its authoring rules match e35b5de byte for byte (the only additions are the CLI and engine CATALOG rows for L-6/L-7). rules:designed: all csharp/aspnet/msbuild scenarios pass; rules:implemented: 418 pass, 0 fail.
