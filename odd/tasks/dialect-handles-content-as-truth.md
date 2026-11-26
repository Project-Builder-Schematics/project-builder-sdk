# dialect-handles-content-as-truth

Objective: fix project-builder-sdk#93 (two Dialect handles on one file silently lose edits) under rules A-7 and A-8, for the paths as typed; canonical paths wait for project-builder-engine#226.
Branch: `fix/dialect-handles-content-as-truth` (from main fbc6ef9). Delivery: ask-on-risk. Test runner: `bun test`; rules: `bun run rules:designed` / `bun run rules:implemented`.

## Specs

Source of truth: project-builder-architecture v0.25.0 (submodule pin). Issue decision (sdk#93 comment, 2026-10-01): "The Session keeps one map from canonical path to content. A dialect handle holds a reference to its entry and a cached AST tagged with the content version it was built from, and re-parses before an op when that version changed, after flushing pending edits." "Until that lands the SDK can key by the path as typed and fix the same-spelling cases; `./a.ts` versus `a.ts` needs the engine change."

- S1 — A-7, `content-as-truth.feature`, `@issue:sdk-93` without `@engine`: "Two variables of the same dialect on one file keep both edits when their ops are not awaited"; "Interleaved ops on two handles, each awaited, keep every edit"; "Interleaved ops on two handles that are not awaited keep every edit"; "A commons handle and a Dialect handle on one file keep both edits".
- S2 — A-8, `stale-nodes.feature`: "A node kept before another handle changed the file fails loudly, and is not relocated by name".
- S3 — A-11 conformance, `dialects.feature`: "A Dialect whose stale nodes stay usable is rejected".
- S4 — Keep: "A single handle chains its ops into one content write and reads the file once" and every `@status:implemented` scenario stay green.
- Out of scope: every scenario tagged `@issue:engine-226` (two spellings, rename/move).

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | — | delegated explorer (Mapping trigger: session, handle, flush and commons flow exceed the inline budget) | done — map returned; cause confirmed at `#ensureLive`'s early return | — |
| T2 | S1, S4 | inline (one behavior across Session and handle) | done — 9 unit tests RED then GREEN; the 3 S1 ops scenarios pass; rules:implemented 496/0 | see L3 |
| T4 | S1, S4 | inline (verifier correction batch) | done — 5 RED then GREEN: F1, F2, idle sync emit | see L5 |
| T3 | S2, S3 | inline (depends on T2's re-parse) | done — 3 RED then GREEN; A-8 and the conformance scenario pass; conformance 78/0 | see L4 |

Risk: item 4 (async ordering of handle ops and flushes); an independent verifier runs after the change's own checks.

## Log

- L1 (2026-11-27, Daniel): "podemos clasificar los issues en cuales son bugs?" — then, on the recommendation to start with #93: "Si dale".
- L2 (2026-11-27): RED on v0.25.0: the three ops scenarios of S1 fail on `toContain`; S3 fails with "no dialect plants the defect \"node kept from before a re-parse is still usable\"". engine#226 is OPEN.
- L3 (2026-11-27): T2. Session versions each path as typed (every directive touching it moves it) and serializes flushes so a read never overtakes an emit. A handle is fresh only for the Session and version it parsed; each step loops `while (!#isFresh()) await #reparse()` and runs a sync op plus #ensureOpen in that same turn. A write landing during an async op rejects loudly. A drained directive prints the AST it was built from. Changed an existing pin: run-context "one handle reused across two runs" expected run 1's edit inside run 2 (`seed\none\ntwo`); under A-7 it is `seed\ntwo`, and a new test covers a handle that wrote nothing in run 1.
- L4 (2026-11-27): T3. Optional `ast.retire(ast)` on the dialect descriptor (`DialectAst`), called on the tree a handle re-parsed away from, after the drained directive's content is fixed; the ts-morph dialects forget the old `SourceFile`. A failing `.modify()` after a re-parse names the remedy "look the node up again inside .modify()". The conformance kit gains `staleNode: { seed, keep, use }` (A-11) and the planted defect "node kept from before a re-parse is still usable". Guards touched on purpose: FIT-07 exempts only the Session's `Map<string, number>` version counter (ADR-0008 amended: no content kept, every read still an engine round-trip); FIT-04 baseline for define-dialect (additive); fit-52 baselines for the dialect bundles (+0.7 to 1.1 KB, shared handle code). `rules:designed` 4 -> 9 pass; the remaining failures there are engine-226 (two spellings) and #182. Full `bun test`: only the environment failures that predate this branch, plus load-flaky tests (tarball e2e, FIT-46, REQ-FSP-01) that pass alone.
- L5 (2026-11-27): independent verifier (risk item 4) against fbc6ef9: S1-S4 met under its probes, the baseline losing 4 of 6 edits across 3 handles and returning stale queries. One regression, F1: an edit after the handle's own rename or move, with its prior edit still pending, failed with "does not exist" where the baseline joined the pending edit. Fixed (the handle's own relocation does not move its version while its edit is pending). Also fixed F2 (pre-existing): a commons rename or move onto a handle's path now moves that path's version. Advisories F3/F4 (order across unawaited writers) documented in the authoring guide; F5 (stale expander comment) resolved by emitting synchronously again when no batch is in flight. Recheck limited to F1: its probe is a committed test and passes. Verifier scratch removed.
