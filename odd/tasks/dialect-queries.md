# dialect-queries

Objective: let a dialect declare read operations ("queries") that end a handle chain and resolve to a value, next to its write ops, without breaking any existing dialect.
Branch: `feat/dialect-queries`, stacked on `feat/css-dialect` (PR #131). Delivery: ask-on-risk. Test runner: `bun test`.

## Specs

- S1 — Two kinds of operation, additive. User (L1): "podriamos tener dos tipos de operacion? 1. la por defecto, tipo write and read. Asi no romperiamos lo que existe solo lo extenderiamos". Existing ops, packs, dialects and their handle types keep working unchanged.
- S2 — Queries are marked inside the same op pack with a `query()` wrapper (option B). User (L2): "me parece la b buddy". The descriptor, `withOps`, and its collision and reserved-name checks are unchanged and apply to queries too.
- S3 — A query method on the handle returns `Promise<R>` and ends the chain (it does not return the handle). It runs in chain order, so it sees every op chained before it on the live AST, and it neither flushes nor emits a directive.
- S4 — Containment like ops: a query's own `dialectError` passes through verbatim, any other throw becomes `<name>() on "<path>" threw`, and a failure fails the run closed. A missing file or a parse failure rejects as for ops.
- S5 — A query must not change the file: a query whose run changes the printed AST rejects, and nothing commits.
- S6 — First query: `@pbuilder/sdk/css` handles gain `getDeclaration(target, property)`; the exported pure `getDeclaration(root, target, property)` stays.
- S7 — Docs: `docs/authoring-a-dialect.md` explains `query()`; `docs/css-dialect.md` and README show the chained `getDeclaration`; the core `.d.ts` baseline (FIT-04) is updated.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1-S5, S7 (core part) | inline | done — RED (`query` not exported) then 10/10 GREEN; FIT-04 core baseline updated | d908436 |
| T2 | S6, S7 (css part) | inline | done — RED (3 fail) then 72/72 GREEN | e2b807d |

Route evidence: one understood core change plus its first consumer; T2 depends on T1, so no parallel writers.

## Log

- L1 (2026-10-28): "Ahora bien, pregunto lo siguiente: podriamos tener dos tipos de operacion? 1. la por defecto, tipo write and read. Asi no romperiamos lo que existe solo lo extenderiamos"
- L2 (2026-10-28): "me parece la b buddy" — chosen over a separate `queries` descriptor field with `withQueries`.
- L3 (2026-10-28): "vamos 1 -> 2 -> 3 -> 4" — this feature is step 3 (docs issue #30 and release PR #132 done; `.scss` is step 4).
- L4 (2026-10-28): research — handles enqueue every step on `#tail` through `#chain` (`#chain` in src/core/dialect-handle.ts), which `read()` already uses to return a value; ops dispatch from `Object.keys(ops)` (`createDialectHandle`). A dispatcher must pick `handle` or `Promise` synchronously, so the query mark must be visible at runtime (a brand), not inferred from a return type. Risk: item 4 (async ordering on the shared `#tail`) and item 3 (core handle type), so an independent verifier runs.
- L5 (2026-10-28): verification — typecheck clean; full `bun test` 3796 pass, the 7 failures are the environment ones also failing on main (FIT-40, FIT-42N x3, REQ-WPS-07 x3). Risk: item 4 (query steps share the async `#tail` queue) and item 3 (core `Handle` type).
- L6 (2026-10-28): "agregalo al #30 cuando abras el PR" — when this feature's PR opens, edit Project-Builder-Schematics/project-builder-docs#30 to add write ops vs read queries and the chained `getDeclaration(target, property)`, citing the PR.
- L7 (2026-10-28): independent verifier on d908436..e2b807d — S1-S7 PASS, no blockers. Fixed: `query()` now wraps instead of branding `fn` itself (a function reused unwrapped as a plain op turned into a query; regression test RED observed after fixing a test that swallowed its own assertion inside the run); docs no longer claim a query never flushes (a fresh handle's first step reads, which drains). Kept as advisories: a second handle on the same path does not see the first handle's still-queued ops (baseline behavior, same for read()); the read-only check compares the printed file, per S5.
- L8 (2026-10-28): native review of feat/css-dialect..cda81aa (lenses resilience, readability, reliability) approved and acknowledged (lineage review-a4110dbb22c97598). Follow-ups: tests pin a caught mutating query still failing the run and the wrap-vs-brand reuse case resolving a Promise; guide heading names both getDeclaration forms; runQuery comment re-wrapped; L4 points to symbols instead of line numbers.
