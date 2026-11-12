Objective: migrate `@pbuilder/sdk` to the DDD + hexagonal layout of project-builder-architecture `CODE-LAYOUT.md`, as the engine and the CLI are doing. This step writes the proposal only; implementation waits for the user's approval.
Branch: docs/hexagonal-layout-proposal off origin/main 2b12435 (0.14.0); not pushed (the orchestrator pushes). Proposal: [hexagonal-layout-proposal.md](./hexagonal-layout-proposal.md). Test runner: `bun test`.

## Specs

S1 — The user's request, verbatim: "para el sdk necesito lo siguiente, necesito que hagan la misma migracion que han estado haciendo engine y cli de pasar a DDD + hexagonal. Hay que primero armar la propuesta de esta misma, necesito que apliquen las reglas del repo de arquitectura".

S2 — Scope of this step (orchestrator brief): "the proposal only. No source changes. Writing the proposal document is the only write."

S3 — The proposal contains (orchestrator brief): "1. A current-state map: every src/ module, with its role (domain / use case / adapter in/out / acl / platform / public API) and its context, with path evidence. Also the current import graph's cross-context and inward-pointing violations. 2. The target layout tree for the SDK under CODE-LAYOUT, and how the public `exports` (@pbuilder/sdk, @pbuilder/sdk/testing, the others) map onto it so the public API does NOT change. 3. The guard first: how the dependency rule gets enforced by a test, the classification table, and the starting exceptions list. 4. An ordered slice plan (S1..Sn). For each slice give the scope, its risk items, and the proof of no behavior change … 5. Open questions where the architecture rules don't decide. Name the rule or README line that's silent or ambiguous. Don't invent rules."

S4 — Sources to apply: project-builder-architecture origin/main 7ed257b (`CODE-LAYOUT.md`, `bounded-contexts/*`, Decision 19 = Discussion #1 comment 19464384); the method of engine `odd/tasks/hexagonal-layout.md` (origin/main 9b07d07) and CLI `odd/tasks/layout-contexts.md` (origin/main 081510a). Artifacts in English.

S5 — The user's layout requirement, verbatim: "aqui necesito que tengamos: docs, bounded-context (si solo hay un subdomino entonces va plano en el folder del bounded-context pero sino con el nombre del subdominio), shared-kernel". Orchestrator reading: CODE-LAYOUT:7-33, kebab-case folders (`src/bounded-contexts/<ctx>/`, `src/shared-kernel/`), each context flat while it has one subdomain, `docs/` at the root per CODE-LAYOUT:21-22.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| P1 | S1-S4 | inline, three read-only explorers for the maps (architecture rules, engine/CLI method, SDK state) | done | this commit |
| P2 | — | user approval of the proposal and answers to its open questions | pending | — |

Route evidence: the maps needed far more than the inline evidence budget (three repositories), so the mapping trigger fired; the write is one document, inline.

## Log

L1 (2026-11-12, user via the orchestrator, verbatim): "para el sdk necesito lo siguiente, necesito que hagan la misma migracion que han estado haciendo engine y cli de pasar a DDD + hexagonal. Hay que primero armar la propuesta de esta misma, necesito que apliquen las reglas del repo de arquitectura".

L2 (2026-11-12): proposal written from three maps. Key findings: the SDK implements Authoring (`bounded-contexts/authoring/README.md:5` "Repository: SDK"); whether it also has a Runner hosting folder is open (README:5 names the engine and the CLI, Discussion #1 puts "runner" in the SDK column, `runner-guard.feature` carries 32 `@sdk` tags). The runner closure (23 emitted files) and the `.d.ts`/tarball baselines follow dist paths, so moves in `src/core` and `src/transport` are risk item 3 and need the engine conformance run. Next step: the orchestrator takes the proposal and its open questions to the user.

L3 (2026-11-12, user via the orchestrator, verbatim): "aqui necesito que tengamos: docs, bounded-context (si solo hay un subdomino entonces va plano en el folder del bounded-context pero sino con el nombre del subdominio), shared-kernel". Applied: target tree uses `src/bounded-contexts/` and `src/shared-kernel/` (kebab-case per CODE-LAYOUT:29), contexts flat; shared-kernel candidates named only for Q1 = yes (`framing.ts`, `wire-protocol.ts`), otherwise empty until a first piece exists; new section 3.2 lands today's docs under `docs/` (bounded-contexts, adr, contracts, guides) and a new slice S16 moves them. Open questions left unchanged (the orchestrator takes them to the user).
