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
| T1 | S1-S5, S7 (core part) | inline | done — RED (`query` not exported) then 10/10 GREEN; FIT-04 core baseline updated | feat(core) commit |
| T2 | S6, S7 (css part) | inline | pending | |

Route evidence: one understood core change plus its first consumer; T2 depends on T1, so no parallel writers.

## Log

- L1 (2026-10-28): "Ahora bien, pregunto lo siguiente: podriamos tener dos tipos de operacion? 1. la por defecto, tipo write and read. Asi no romperiamos lo que existe solo lo extenderiamos"
- L2 (2026-10-28): "me parece la b buddy" — chosen over a separate `queries` descriptor field with `withQueries`.
- L3 (2026-10-28): "vamos 1 -> 2 -> 3 -> 4" — this feature is step 3 (docs issue #30 and release PR #132 done; `.scss` is step 4).
- L4 (2026-10-28): research — handles enqueue every step on `#tail` through `#chain` (src/core/dialect-handle.ts:127), which `read()` already uses to return a value; ops dispatch from `Object.keys(ops)` (dialect-handle.ts:422). A dispatcher must pick `handle` or `Promise` synchronously, so the query mark must be visible at runtime (a brand), not inferred from a return type. Risk: item 4 (async ordering on the shared `#tail`) and item 3 (core handle type), so an independent verifier runs.
