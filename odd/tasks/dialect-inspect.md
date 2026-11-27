# dialect-inspect

Objective: `.inspect(ast => value)`, the read escape hatch of a Dialect handle (sdk#269, iteration 2 of architecture#111).
Branch: `feat/dialect-inspect` off origin/main 781a180. Delivery: ask-on-risk. Test runner: `bun test`; rules: `bun run rules:implemented` (strict), `bun run rules:designed` (report-only).

## Specs

- S1 — Rules at architecture v0.26.4: the submodule moves from v0.25.0 to v0.26.4 in its own commit, `test: bump architecture rules to v0.26.4`.
- S2 — A-128: "`.inspect(ast => value)` hands the callback the live AST of the dialect's library and returns what it returns. After the callback the dialect prints the AST and compares; a change fails the factory, as `runQuery` does today." It reuses `runQuery` and its chain ordering and draining.
- S3 — A-129, A-83: "`inspect` joins `RESERVED_HANDLE_NAMES`, so no op or query may take the name", base dialect ops included (#268).
- S4 — A-86: "A failure inside `.inspect()` reaches the author with the `dialect operation failed: ` prefix, naming `inspect` and the file."
- S5 — A-127: "`query(fn)` already matches A-127: it only needs its scenarios bound." Existing `query(fn)` and `.modify()` behavior is unchanged.
- S6 — The read side is offered to every factory, generators too.
- S7 — Docs, types and JSDoc follow.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | inline | done: strict 496 pass / 1 skip / 0 fail, designed 190 selected, unchanged | 0fea2c8 |
| T2 | S2-S7 | inline | done: RED 14/14 fail, then GREEN; FIT-04 baseline and fit-50 snapshot updated | 0a32b75 |
| T3 | S2, S4, S5 acceptance | inline | done: 3 scenarios bound and passing | d9e93aa |

## Log

- L1 (2026-11-27): orchestrator brief for sdk#269, quoted in the specs above.
- L2 (2026-11-27): `.inspect(fn)` is `runQuery(fn, [], "inspect", ...)`, with its own wording for a change: `inspect() must not change "<path>"` (the query wording says "is a query"). A throw reads `inspect() on "<path>" threw`.
- L3 (2026-11-27): the scenarios built on `a base dialect ...`, `an op pack ...` and `the dialect implementer composes ...` stay unbound. CATALOG says those steps drive the registration surface the SDK exports (A-16), and on main the kit is internal; `feat/author-defined-dialects` exports it as `@pbuilder/sdk/dialect`. Their behavior is covered by unit tests on the kit. Binding `the author runs a .modify() callback that throws ...` and `the failure of the factory does not contain ...` made the one implemented A-86 scenario runnable, so the dialect-composition pending row (sdk#103) was stale and left; `PENDING_CEILING` is 0.
- L4 (2026-11-27): checks. typecheck exit 0; rules:implemented 494 selected, 497 pass / 0 fail / 0 skip; rules:designed 190 selected, 12 pass, 8 fail, 170 undefined (the two new failures are A-87 scenarios in dialects.feature that `the failure of the factory does not contain` now reaches). Full `bun test` fails only on FIT-40, FIT-42N, REQ-WPS-07 and fit-52, which fail the same on 781a180 here; the other failures in the full run were timeouts that pass when rerun alone.
