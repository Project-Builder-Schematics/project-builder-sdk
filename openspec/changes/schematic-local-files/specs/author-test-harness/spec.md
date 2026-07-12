# Delta for Author Test Harness

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3 (owner micro-unfreeze, 2026-07-12): REQ-ATH-15 (title + body + scenario .2)
reworded — the in-fake implementation leak (`#requireExists` mirroring FAKE-06)
removed; the missing-source obligation restated end-to-end through the harness run
(SDK-side validation is the legitimate origin; the fake is not required to re-check
package disk). REQ-IDs stable.

V1 → V2: no council fixes targeted this domain — content unchanged; version bumped
for artifact-level consistency. All V1 REQ-IDs preserved.

## ADDED Requirements

### REQ-ATH-14: In-Memory-Only Invariant Carve-Out Widened — Package-Root Reads (harness allow-list)

REQ-ATH-11's carve-out (currently: a `readdirSync` reserved-name scan of `packageDir`
and a `readFileSync` of the adjacent `schema.json`, both pre-`als.run`) MUST WIDEN to
also allow-list disk reads performed BY a `scaffold`/`copyIn`/`create({templateFile})`
call DURING a run, PROVIDED those reads stay within the collection/package root
(`package-root-containment` REQ-PRC-01/02). When such a factory is exercised via
`runFactoryForTest`, these reads MUST be recorded by the harness's I/O instrumentation
but MUST NOT fail the run or trip the in-memory-only invariant check — same treatment
as the existing two opted-in reads. Every OTHER instrumented I/O surface (network,
`process.env`/`process.argv` property access, any disk touch OUTSIDE the collection
root, or any read attributable to harness machinery itself) still records zero
calls/traps — the widened allow-list is scoped exclusively to reads within the
collection root, never a blanket exemption.

#### Scenario REQ-ATH-14.1: A factory's own scaffold/copyIn reads within the collection root are observed, not flagged [SDK]

- GIVEN a factory defined via `defineFactory(fn, { packageDir: import.meta.dir })`
  whose body calls `scaffold` over an adjacent `files/` folder, run with the SAME
  fs/net/Bun-I/O/env/argv instrumentation as REQ-ATH-11.1
- WHEN run via `runFactoryForTest`
- THEN the reads `scaffold` performs within the collection root are recorded but do
  NOT fail the run or trip the invariant check
- AND every OTHER instrumented I/O surface still records zero calls/traps

#### Scenario REQ-ATH-14.2: A read attributable to harness machinery outside the allow-list still trips the invariant [SDK]

- GIVEN a fixture where the SPY/instrumentation wrapper itself (not the
  factory-under-test) performs a disk read outside the collection root
- WHEN run via `runFactoryForTest`
- THEN the invariant check still fails — the widened allow-list covers ONLY
  factory-attributable, within-collection-root reads, never harness machinery

### REQ-ATH-15: By-Reference Directive Through the Harness — Emit-Only

A valid by-reference directive run through `runFactoryForTest` MUST be recorded in
`result.emitted`; by-reference bytes MUST NEVER appear in `result.tree` or on disk —
the emit-only evidence boundary (`by-reference-copy-wire` REQ-BRC-04); simulation ends
at directive acceptance/rejection. A by-reference directive whose package-local source
does not exist MUST surface `AuthoringError` reason `source-not-found` through the
harness run (`by-reference-copy-wire` REQ-BRC-06) — the SDK-side containment/stat
validation is the legitimate origin of that rejection; the fake is NOT required to
re-check package disk.

(Previously V2: phrased as `ContractFake` FAKE-06 fidelity with an in-fake existence
check — an implementation leak; reworded at V3 to the end-to-end harness obligation.)

#### Scenario REQ-ATH-15.1: Valid by-reference directive lands in result.emitted, never in result.tree [SDK]

- GIVEN a factory that emits a valid by-reference copy (existing source, non-colliding
  destination) via `copyIn`
- WHEN run via `runFactoryForTest`
- THEN `result.emitted` contains the by-reference directive
- AND `result.tree` contains NO entry for the by-reference destination path — no
  by-reference content is ever materialized into the committed tree

#### Scenario REQ-ATH-15.2: Missing package-local source surfaces source-not-found through the harness run [SDK]

- GIVEN a factory that calls `copyIn` on an (in-ceiling) source path that does not
  exist in the package
- WHEN run via `runFactoryForTest`
- THEN `result.error` is an `AuthoringError` with `reason: "source-not-found"` —
  regardless of which layer (SDK-side validation being the legitimate origin)
  produced the rejection

### REQ-ATH-16: Conformance Vehicle Parity for the By-Reference Op

`src/conformance/run-vehicle.ts` MUST handle the by-reference directive with parity to
the fake (REQ-ATH-15): same existence/collision checks, same emit-only boundary — no
divergence between the two simulation surfaces for this new directive.

#### Scenario REQ-ATH-16.1: Conformance vehicle and fake agree on the same by-reference fixture set [SDK]

- GIVEN the SAME set of by-reference fixtures (valid, missing-source, collision) run
  through both the fake and the conformance vehicle
- WHEN compared
- THEN both surfaces produce the same accept/reject verdict per fixture
