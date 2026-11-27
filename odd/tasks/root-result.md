# root-result

Objective: the SDK side of the Result channel (sdk#95, the Result-type half of sdk#96; iteration 4 of architecture#111). Engine side: engine#332, same wire shape.
Branch: `feat/root-result` off origin/main 6fa2889 (0.18.0). Delivery: ask-on-risk. Test runner: `bun test`; rules: `bun run rules:implemented` (strict), `bun run rules:designed` (report-only).

## Specs

- S1 — Rules at architecture v0.26.6: the submodule moves in its own first commit, `test: bump architecture rules to v0.26.6`.
- S2 — Wire: "the Result rides as an optional `result` key in the params of the existing `ir.commit` request: `ir.commit {"result": <JSON>}`, the key present only when the schematic declares a Result (a declared `null` sends `"result": null`). No new method, no `WIRE_PROTOCOL_VERSION` change." The SDK-owned wire spec is updated first.
- S3 — "`defineFactory` becomes generic over the Result: `fn: (o) => R | Promise<R>`, returns `Promise<R>`, so `runFactoryForTest` can read it. Order on success: `r = await fn(o)`, drain, validate the Result at the boundary, flush, `commit(r)`. An invalid Result takes the existing failure path (discard, rethrow): nothing is written."
- S4 — A-14 validation: "the Result is declared in `schema.json` (add a Result section; `parseSchema` today models only `properties`); validate it with the same boundary validator family as inputs. JSON only: a structural walk rejecting functions, class instances, cycles, `undefined`, non-finite numbers." Leave a seam for a role-imposed Result schema (Findings, sdk#270); Findings not implemented.
- S5 — "A factory that returns a value (anything but `undefined`) while declaring no Result fails at its boundary and nothing is written. A bare `defineFactory(fn)` with no schema never sends a Result." Audit the SDK's own factories and tests for accidental returns.
- S6 — "A declared `null` Result is valid and is sent as `null`; no Result means the key is absent."
- S7 — E-40: "the Result's JSON encoding is at most 1 MiB (1048576 bytes; exactly at the ceiling is allowed). The SDK checks it before sending and fails with an error that names the Result."
- S8 — A new AuthoringError reason `invalid-result` for an invalid or oversized Result; the runner exits as for other developer errors (exit 1, origin `authoring-rejected`).
- S9 — Ports additive: `EngineClient.commit(result?)`, `StdioEngineClient.commit` sends `{result}` only when declared, `Session.commit(result?)`.
- S10 — A-15 local part (sdk#96): codegen emits the schematic's `Result` type from the declared Result; no Result type when none is declared. Typed invoke waits on sdk#94.
- S11 — A factory returning nothing behaves exactly as before; the wire sends `ir.commit {}` (no key) when no Result is declared. Docs, JSDoc, public-api snapshot and FIT-04 baselines follow.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | inline | done: rules:implemented 507 pass / 0 fail; rules:designed 193 selected, 10 pass, 8 fail, 175 undefined (unchanged failures) | a920923 |
| T2 | S2-S9, S11 | inline | done: RED 31/31 new tests fail, then GREEN | 5c7ecfe (spec), b3be3f6 |
| T3 | S10 | inline | done: RED 3 codegen tests fail, then GREEN | 050bdff |
| T4 | acceptance steps for A-14 root, E-39, E-40, A-15 | inline | done: 12 designed scenarios bound and passing | d23a887 |

## Log

- L1 (2026-11-27): orchestrator brief for iteration 4 of architecture#111 (sdk#95, sdk#96 Result type), quoted in the specs above.
- L2 (2026-11-27): design choices. `schema.json` gets an optional top-level `result`, a JSON Schema subset: `type` (one of string, number, boolean, null, object, array, or a list), `properties` (closes the object to those keys), `required` (keys that must be present; JSON Schema default optional), `items`. An invalid declaration fails like an unreadable schema (`invalid "result" declaration`). `checkResult(declared, value)` takes the declaration as a parameter, the seam for a role-imposed Findings schema (sdk#270). A bare `defineFactory(fn)` declares no Result, so returning a value fails there too (A-14 applied uniformly). The committed Result is a copy parsed from its JSON encoding, so what is sent is what was checked. `RunResult.result` is what the run sent with `ir.commit`.
- L3 (2026-11-27): the runner closure admits only listed primitives (constraint 4): `Buffer.byteLength` instead of `TextEncoder`, `value - value === 0` instead of `Number.isFinite`, `instanceof Date/Map` instead of `constructor.name`. The toJSON and throwing-getter tests were written after the code, so they had no RED.
- L4 (2026-11-27): acceptance. The root steps spawn the real runner and stand in for the engine on the wire; "Launch receives" is the `result` the runner sent with `ir.commit`. Child scenarios (A-13, the A-14 child ones) and the typed-invoke step of A-15 stay undefined: they need `invoke` (sdk#94). rules:designed 193 selected: 22 pass (was 10), 8 fail (the same pre-existing ones), 163 undefined.
- L5 (2026-11-27): the first full run showed the Result check as a new runner-closure file broke FIT-42/PMF-02/DLV-01/FIT-14 (28 closure files pinned); the check moved into schema-validate.ts, which was already in the closure, so the closure contract is unchanged. The acceptance package wrote a `collection.json` literal that fit-43 forbids in src/; it was not needed and is gone. Audit: no factory in the suite, fixtures or docs returned a value by accident (no "declares no Result" failure in two full runs); there are no examples/ or templates/ in this repo. Checks: typecheck exit 0; rules:implemented 507 pass / 0 fail; rules:designed 193 selected, 22 pass, 8 fail (pre-existing), 163 undefined; full `bun test` 4605 pass / 33 fail, the failures being FIT-40, FIT-42N, REQ-WPS-07 (unit and the exit-matrix canary e2e, failing on the base too), fit-52 and the closure-count ones fixed above, which pass when rerun (291/291 across the ten affected files).
- L6 (2026-11-27): verifier blockers, one correction batch. definefactory-jsdoc.test.ts matched `defineFactory<O>(` only, so REQ-FPS-05.2/.3 never ran; the pattern now matches `defineFactory<O, R = void>(`. FIT-07 flagged the `Record<string, unknown>` casts in schema-validate.ts; they use a local `JsonObject` index-signature alias. The verifier's probes are test/skeleton/factory-result-probes.test.ts. Optional Result keys: codegen keeps `key?: T`; the README states that such a key may be left out but never set to `undefined` (the smaller change; `exactOptionalPropertyTypes` is the author's tsconfig choice).
