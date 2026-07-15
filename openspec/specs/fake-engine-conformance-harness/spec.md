# Fake Engine Conformance Harness Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines the spawned-process fake-engine conformance harness: a shell over the ONE
`ContractFake` that proves the transport's in-process behavior and its real-spawned-process
behavior agree, over a single shared scenario corpus, without requiring a Go toolchain — plus
the spec-derived citation guard and the coverage map that fails loudly on drift.

## Requirements


### REQ-FEH-01: Transport Shell Over the ONE ContractFake

The harness MUST be a transport shell over `ContractFake` — it adds framing/dispatch over real
stdio and implements ZERO independent semantics (no re-implemented rejection logic, no parallel
emit/commit/discard behavior). A structural guard test MUST enforce the zero-reimplementation
constraint mechanically, not by convention alone: it scans the harness source for any
`new EmitRejection` construction and for literal copies of `ContractFake`'s rejection-message
dictionary entries. FIT-18 (single-fake parity) and FIT-10 (port guard) MUST stay green.
(Previously: the zero-independent-semantics rule had no mechanical guard — M13.)

#### Scenario REQ-FEH-01.1: Semantic parity with ContractFake
- GIVEN the same scenario run once through `ContractFake` in-process and once through the harness over a real spawned process
- WHEN both runs complete
- THEN the observable outcome (commit/reject classification, `EmitRejection` shape) is identical — the harness never diverges from `ContractFake`'s semantics (FIT-18)

#### Scenario REQ-FEH-01.2: Structural guard proves no reimplementation (M13)
- GIVEN the harness's own source code
- WHEN the structural guard test scans it
- THEN it contains no `new EmitRejection` construction and none of `ContractFake`'s rejection-message dictionary literals — proving the harness delegates to `ContractFake` rather than reimplementing its semantics

### REQ-FEH-02: Shared Scenario Corpus

The scenario corpus consumed by the in-process fake suite and by the process-boundary harness
MUST be the same definitions, imported from the SAME module path — never two independently
maintained scenario sets, even if content-identical.
(Previously: silent on same-module-path/reference-identity — M15.)

#### Scenario REQ-FEH-02.1: One corpus, two runners
- GIVEN a scenario defined once in the shared corpus (e.g. "factory crash mid-run")
- WHEN it is run via the in-process suite and separately via the process-boundary harness
- THEN both runners execute the identical scenario definition — a corpus edit changes both, never one and not the other

#### Scenario REQ-FEH-02.2: Both suites import the reference-identical corpus module (M15)
- GIVEN the in-process suite's corpus import and the harness's corpus import
- WHEN a structural guard test compares them
- THEN they are reference-identical (`===`) — the same module export, never two modules with merely matching content

### REQ-FEH-03: Spec-Derived Harness (Anti-Tautology)

Harness scenarios MUST derive from THIS spec's REQ-IDs, never from `StdioEngineClient`'s
internal implementation. A structural guard test MUST enforce this (e.g. asserting every harness
scenario cites a REQ-ID that exists in this spec). The citation guard and the FEH-05 coverage
map MUST read the SAME spec-parsed REQ-ID universe (FEH-05's parse, not a separate re-parse).
The guard MUST resolve the spec file's path such that it still works after archive (the spec
moves from `openspec/changes/stdio-engine-client/` to its post-archive main-spec location at
archive time) — via a documented lookup order, never a hardcoded pre-archive-only path.
(Previously: silent on sharing FEH-05's parse and on the post-archive path move — m7.)

#### Scenario REQ-FEH-03.1: Every harness scenario cites a real REQ-ID
- GIVEN the full harness scenario suite
- WHEN the structural guard test runs
- THEN every scenario's cited REQ-ID resolves to a requirement in this spec — a scenario with no matching REQ-ID (or one invented to match an implementation detail) fails the guard

#### Scenario REQ-FEH-03.2: Citation guard still resolves the spec after archive (m7)
- GIVEN the change has been archived (the spec file has moved from `openspec/changes/stdio-engine-client/` to its post-archive location)
- WHEN the citation guard test runs
- THEN it still resolves the correct spec file and passes — it does not hardcode the pre-archive path

### REQ-FEH-04: Real Spawned Process, Real Stdio, No Go Toolchain

The harness MUST spawn an actual OS process communicating over actual stdio pipes —
structurally distinct from any in-process fake — and MUST run with no Go toolchain present
(AC-M1, AC-M2).

#### Scenario REQ-FEH-04.1: Harness runs without Go installed
- GIVEN a CI environment with no `go` binary on PATH
- WHEN the harness's test suite runs
- THEN it completes successfully — the harness never shells out to or depends on the Go toolchain

### REQ-FEH-05: Spec-Item-to-Scenario Coverage Map

The harness MUST produce (or the test suite must assert) a coverage map from every REQ-ID in
this spec to at least one exercising scenario, with zero uncovered rows (AC-M3). The REQ-ID
universe MUST be PARSED FROM THIS SPEC DOCUMENT at test time (e.g. regex-scanning `spec.md` for
`### REQ-XX-NN` headers) — NEVER hardcoded as a literal list and NEVER derived by introspecting
the harness's or the implementation's own code. The coverage assertion MUST ALSO assert the
total parsed REQ-ID count against a maintained expected value, so a spec edit that adds or
removes REQs without a matching harness update fails loudly (a drift tripwire) instead of
silently reporting 100% coverage of a stale, smaller set.
(Previously: silent on where the REQ-ID universe comes from and on a count-drift tripwire —
M14.)

#### Scenario REQ-FEH-05.1: Zero uncovered REQ-IDs
- GIVEN the full set of REQ-IDs in this spec (WPS/EXC/RUN/BRB/SEC/FEH)
- WHEN the coverage map is generated
- THEN every REQ-ID has at least one row, and the "uncovered" count is exactly zero

#### Scenario REQ-FEH-05.2: A REQ-count drift fails loudly instead of silently passing (M14)
- GIVEN the spec document's REQ-ID count changes (a REQ is added or removed) without updating the harness's expected-count constant
- WHEN the coverage map test runs
- THEN it FAILS on the count mismatch — it never silently reports zero-uncovered against the old, now-wrong REQ set

### REQ-FEH-06: `BATCH_CAP_BYTES` Drift Test

A dedicated test MUST fail if the SDK's exported `BATCH_CAP_BYTES` value drifts from the literal
value pinned in the normative wire-spec doc (AC-TRACE, ties to WPS-06).

#### Scenario REQ-FEH-06.1: Constant drift fails the test, not a runtime desync
- GIVEN the normative doc pins `BATCH_CAP_BYTES == 4194304`
- WHEN `src/core/wire.ts`'s exported value is changed to any other number
- THEN this test fails at build/test time, before the drift could reach a runtime mismatch with the engine

---

