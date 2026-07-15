# Stdio Engine Client Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines `StdioEngineClient`'s behavior as the first real `EngineClient` port implementation:
structural port conformance, single-run overlap rejection, commit/discard acknowledgment,
`EmitRejection` reconstruction from wire error data (including the `"unknown"` degrade),
timeout handling, `tree.read` result normalization, the single-instance probe, fail-closed
frame-reassembly semantics, and the fd-1/console stdout-protocol seal.

## Requirements


### REQ-SEC-01: EngineClient Port Conformance

`StdioEngineClient` MUST implement `EngineClient`'s four methods (`emit`, `read`, `commit`,
`discard`) with the exact signatures in `src/core/engine-client.ts`, with no shape change (D2).

#### Scenario REQ-SEC-01.1: Structural conformance, observables enumerated (m1)
- GIVEN a `StdioEngineClient` instance
- WHEN it is passed anywhere an `EngineClient` is expected (e.g. `defineFactory`'s `deps.client`)
- THEN it type-checks against `EngineClient`, AND its observable behavior matches the port's contract exactly: `emit()`/`commit()`/`discard()` reject ONLY with `EmitRejection` (or the SEC-03 intent-rejection identity — never a bare `Error`) on a host rejection; `read()` resolves to `Promise<string | undefined>` and never throws for a not-found path (SEC-06); and every one of the four methods' Promises settles EXACTLY once (never both resolves and rejects)
(Previously: "behaves per the port's documented contract" with the observables left parenthetical/implicit — m1.)

### REQ-SEC-02: Single In-Flight Run (Sequential, No Pending Map)

The client's composition root MUST guard against ever starting a second run while one is in
flight (Settled #3). Because each process runs exactly one factory, bootstrapped once via argv/
bridge (WPS-09) — never via a wire-level request — this guard is a programmatic reentrancy
protection at the composition root: an attempt to invoke the run entry point a second time on an
already-running client instance MUST be rejected immediately with a stable, documented error
identity (e.g. a distinct `OverlappingRunError` class or an equivalent documented `code`
discriminant) — never silently queued, dropped, or interleaved with the first. This rejection
produces no wire frame and travels no wire error code: the second attempt never leaves the
process, so there is nothing to send over the wire for it.
(Previously: "runFactory-class request" implied a wire-level request; reconciled against WPS-09
— B1 — and given a stable error identity plus a first-run-unaffected guarantee — M11.)

#### Scenario REQ-SEC-02.1: Overlapping run rejected loudly, first run unaffected
- GIVEN a `StdioEngineClient`-backed run is currently in flight
- WHEN the composition root's run entry point is invoked a second time before the first resolves
- THEN the second invocation rejects immediately with the stable `OverlappingRunError` identity, the FIRST in-flight run continues and completes unaffected (its reverse callbacks keep dispatching/resolving normally), and no wire frame is ever sent as a result of the rejected second attempt (SC-8)

### REQ-SEC-03: Advisory Commit/Discard

`commit()`/`discard()` send `ir.commit`/`ir.discard` as intent declarations over the wire; the
host cross-checks the intent against its own run resolution and owns the transactional apply
(Settled #4, obs #2157 ruling 1). The client MUST await the host's acknowledgment before
considering the transaction phase complete, and MUST surface a host-side rejection of that
intent as a distinguishable, stable-identity failure (e.g. an `IntentRejectedError` class or an
equivalent documented `code` discriminant, distinct from `EmitRejection` and from
`OverlappingRunError`) — never silently ignored or conflated with another rejection kind.
(Previously: "a distinguishable failure" with no pinned identity — M11.)

#### Scenario REQ-SEC-03.1: Commit acknowledged
- GIVEN a factory run that emits successfully and calls `commit()`
- WHEN the host acknowledges `ir.commit`
- THEN `commit()`'s returned promise resolves and the run is considered complete (SC-1)

#### Scenario REQ-SEC-03.2: Host rejects a commit/discard intent with a stable, distinguishable identity
- GIVEN the client sends `ir.commit` for a run the host does not recognize as resolved (e.g. a protocol-violating double-commit)
- WHEN the host responds with a rejection
- THEN `commit()`'s promise rejects with the stable `IntentRejectedError` identity — never silently resolved as success, never conflated with `EmitRejection` or `OverlappingRunError`

### REQ-SEC-04: EmitRejection Mapping with `failedIndex` Precondition

A host `ir.emit` rejection (WPS-08's wire shape) MUST be reconstructed as an
`EmitRejection{code, failedIndex?, appliedCount}`, honoring the directive-vs-batch-level
precondition: `failedIndex` present only for directive-level codes (`collision`, `not-found`),
absent for batch-level codes (`unrepresentable`, `cap`, `unknown`). An out-of-contract payload —
an unrecognized `emitRejectionCode`, a `failedIndex` present alongside a batch-level code, or a
`failedIndex` that is negative or non-integer — MUST degrade to `code: "unknown"` with
`failedIndex` omitted; the client MUST NEVER guess an index and MUST NEVER crash on a malformed
rejection payload.
(Previously: silent on out-of-contract payloads — M7.)

#### Scenario REQ-SEC-04.1: Directive-level rejection carries failedIndex
- GIVEN a host rejects `ir.emit` with `data.emitRejectionCode: "collision"`, `data.failedIndex: 3`
- WHEN the client reconstructs the rejection
- THEN the resulting `EmitRejection.failedIndex === 3` and `toAuthoringError` attributes the offending directive by that index

#### Scenario REQ-SEC-04.2: Batch-level rejection carries no failedIndex
- GIVEN a host rejects `ir.emit` with `data.emitRejectionCode: "cap"` and no `failedIndex` field
- WHEN the client reconstructs the rejection
- THEN `EmitRejection.failedIndex === undefined`, never a guessed index

#### Scenario REQ-SEC-04.3: Out-of-contract payload degrades to "unknown", never crashes (M7)
- GIVEN three separate malformed rejections: (a) `data.emitRejectionCode: "bogus-code"`, (b) `data.emitRejectionCode: "cap"` WITH `data.failedIndex: 1` (a batch-level code carrying a directive-level field), (c) `data.emitRejectionCode: "collision"` WITH `data.failedIndex: -1` (negative)
- WHEN the client reconstructs each rejection
- THEN all three degrade to `EmitRejection{code: "unknown", failedIndex: undefined}` — the client never guesses an index and never throws an unhandled exception while parsing the payload

### REQ-SEC-05: Bounded-Wait Timeout Contract

The client MUST enforce a bounded wait when awaiting a host response to any outbound reverse
callback (`tree.read`, `ir.emit`, `ir.commit`, `ir.discard`). The bound MUST be injectable (a
constructor/configuration parameter), defaulting to 30 000 ms when not supplied (an SDK-chosen
placeholder pending engine-side confirmation, same provenance posture as `BATCH_CAP_BYTES`). On
expiry, the pending call MUST reject as transport-fault (EXC-01) carrying a `timeout`
discriminant on the error identity (distinguishing a timeout transport-fault from other
transport-fault causes, e.g. malformed JSON or EOF) — never hang unbounded. A response that
arrives before the bound elapses MUST resolve the call normally and clear the timer, with no
stray rejection ever raised afterward.
(Previously: silent on injectability, the timeout discriminant, and the successful-but-slow
case — M10.)

#### Scenario REQ-SEC-05.1: Hung host times out instead of hanging forever
- GIVEN a host that never responds to an outstanding `tree.read` callback
- WHEN the bound (30 000 ms default) elapses
- THEN the pending `read()` call rejects, classified transport-fault with a `timeout` discriminant, and the process is able to exit with code 3 (SC-5)

#### Scenario REQ-SEC-05.2: Slow-but-successful response resolves normally, no stray rejection (M10)
- GIVEN a host that responds to an outstanding `tree.read` callback just BEFORE the bound elapses
- WHEN the response arrives
- THEN the pending `read()` call resolves normally, the timeout timer is cleared, and no rejection is ever raised for that call afterward

### REQ-SEC-06: Not-Found vs. Empty-String vs. Content Distinction (ADR-01)

The `tree.read` response result MUST distinguish three outcomes on the wire: not-found (JSON
`null` result), an empty file (`{content: ""}`), and populated content (`{content: <string>}`).
The client MUST map `null` to `undefined` (never `""`) and `{content: ""}` to `""` (never
`undefined`).

#### Scenario REQ-SEC-06.1: Not-found maps to undefined, not empty string
- GIVEN a host responds to `tree.read` with result `null`
- WHEN `EngineClient.read()` resolves
- THEN it resolves to `undefined`, distinguishable from a resolved empty string (SC-5)

#### Scenario REQ-SEC-06.2: Empty file maps to empty string, not undefined
- GIVEN a host responds to `tree.read` with result `{content: ""}`
- WHEN `EngineClient.read()` resolves
- THEN it resolves to `""`, never `undefined`

### REQ-SEC-07: Single-Instance Realpath Probe (C8)

At handshake time, the client MUST compare the realpath of the runner's own resolved
`@pbuilder/sdk` copy against the realpath of the SDK copy the factory's module graph resolves
to, using a RESOLUTION-ONLY mechanism that determines the factory's SDK dependency WITHOUT
executing any of the factory module's own top-level code, and MUST complete this probe BEFORE
the factory import (RUN-02/RUN-03) proceeds. A mismatch MUST fail the greeting, naming both
paths in PROJECT-RELATIVE form (WPS-07's rule, including its outside-project-root fallback) —
never as absolute paths. This is a consistency check for the module-level ALS single-instance
pin (`context.ts:74`), NOT an anti-tamper/supply-chain-authenticity control (A3, out of scope).
(Previously: named "both realpaths" with no project-relative constraint, and silent on
resolution-only/before-import ordering — B4, M6.)

#### Scenario REQ-SEC-07.1: Matching SDK copies proceed
- GIVEN the runner's own SDK copy and the factory's resolved SDK copy realpath-resolve to the same file
- WHEN the probe runs
- THEN the greeting proceeds normally

#### Scenario REQ-SEC-07.2: Split SDK copies fail the greeting, naming both paths project-relative
- GIVEN the runner's SDK copy and the factory's resolved SDK copy realpath-resolve to two DIFFERENT files (e.g. a nested `node_modules` shadowing the hoisted copy)
- WHEN the probe runs
- THEN the greeting fails, the error names both paths in PROJECT-RELATIVE form (WPS-07, including the `<outside-project>` fallback if either path falls outside the root), the runner exits 1 (validation-failure, EXC-01), and no factory code executes (prevents the `outside-run` failure mode the module-level ALS split would otherwise cause on first verb)

#### Scenario REQ-SEC-07.3: Probe is resolution-only and completes before factory import (M6)
- GIVEN the probe runs at handshake time
- WHEN it resolves the factory's SDK dependency
- THEN it does so WITHOUT executing any of the factory module's own top-level code, and completes before RUN-02/RUN-03's dynamic import of the factory begins

### REQ-SEC-08: Inbound Frame Fault Handling (C7)

The client MUST reject-before-alloc on an over-cap inbound length (WPS-04), and MUST fail
closed ONLY on malformed JSON or protocol desync — WPS-03 governs routing faults (unknown-type
frames, stale/foreign response IDs), which are discarded silently on the wire with a stderr
note per WPS-03, and are NOT SEC-08 fail-closed faults. The client MUST NEVER resynchronize via
byte-scanning. Attribution of a fail-closed fault to a specific pending call is STRUCTURAL, not
content-based: under SEC-02's single-in-flight-run discipline there is at most one call pending
per reverse-callback slot at any time, so a fail-closed fault attributes to that sole pending
call by construction, never by scanning the malformed bytes for an embedded ID. If pending state
is itself ambiguous (more than one plausible candidate, or none), the fault is a transport-fault
that terminates the run rather than a per-call rejection. Additionally: if stdin reaches EOF
while a reverse callback is pending, the pending call MUST reject as transport-fault PROMPTLY —
NOT deferred to the SEC-05 timeout bound.
(Previously: SEC-08 vs. WPS-03 both claimed the unknown-type/stale-ID cases, and SEC-08.1
attributed by "a partially-parsed ID"; deleted per B3. EOF handling was entirely unspecified;
added per B5.)

#### Scenario REQ-SEC-08.1: Malformed inbound JSON fails closed, attributed structurally
- GIVEN a response frame whose body is not valid JSON
- WHEN the client's frame router processes it
- THEN the sole pending call — attributed structurally as the only outstanding call, never by scanning the malformed bytes for an ID — rejects with a classified transport-fault error; the connection itself is NOT torn down and remains usable for subsequent calls

#### Scenario REQ-SEC-08.2: Desync never triggers a byte-scan resync
- GIVEN two consecutive frames where the first's declared length undercounts its actual body
- WHEN the client reads the resulting misaligned second "frame"
- THEN it fails closed (classified transport-fault) rather than scanning forward byte-by-byte to find the next plausible frame boundary

#### Scenario REQ-SEC-08.3: Stdin EOF while a callback is pending rejects promptly, not after the timeout (B5)
- GIVEN a reverse callback (`tree.read`/`ir.emit`/`ir.commit`/`ir.discard`) is currently pending
- WHEN stdin reaches EOF (the host closes the pipe)
- THEN the pending call rejects PROMPTLY as transport-fault — observably faster than, and never waiting for, the SEC-05 timeout bound — and the runner exits 3

### REQ-SEC-09: Stdout Pollution Isolation (AC-A3)

Because BRB-02/RUN-08 capture the sole fd-1 write handle before any import, an author's write to
`process.stdout` (or any stream not routed through the captured handle) MUST NEVER be dispatched
as a wire frame — it is either isolated (redirected/discarded) or surfaces as an explicit error,
never silently corrupting the frame stream. A direct low-level write to fd 1 that bypasses
`process.stdout`/`console` entirely (e.g. `fs.writeSync(1, ...)` called by author code) is OUT
OF SCOPE for this requirement: that residual risk is accepted at the assumptions level (A2 — the
engine's own pre-import fd dup is the control for it) and is not a gap this REQ closes. This
REQ's isolation covers the `process.stdout` and `console.*` paths only.
(Previously: silent on the `fs.writeSync(1, ...)` residual and its scope boundary — m5.)

#### Scenario REQ-SEC-09.1: Author stdout/console write never corrupts a frame (m5 — zero non-frame bytes)
- GIVEN a factory writes arbitrary bytes to `process.stdout` mid-run
- WHEN the host's frame reader parses the complete session byte stream
- THEN it parses that stream with ZERO non-frame bytes ever observed — the author's bytes never appear as, inside, before, or after a dispatched frame (SC-6)

### REQ-SEC-10: Partial/Chunked Frame Reassembly

The client's frame reader MUST correctly reassemble a frame delivered across multiple OS-level
reads, whether the split falls mid-length-prefix or mid-payload, resulting in exactly one
dispatch per logical frame — including when multiple complete frames arrive coalesced within a
single OS-level read (still exactly one dispatch per logical frame, never a merged or dropped
dispatch), and including a stream that ends (EOF) after a valid length prefix but before the
full payload arrives (transport-fault; the buffered partial frame is never dispatched).
(Previously: silent on coalesced frames and on EOF mid-payload — M9, B5.)

#### Scenario REQ-SEC-10.1: Split mid-prefix reassembles to one dispatch
- GIVEN the 4-byte length prefix arrives split across two separate stdio reads (e.g. 2 bytes then 2 bytes)
- WHEN the client's reader processes both reads
- THEN exactly one frame is dispatched, with the correct reassembled length (SC-7)

#### Scenario REQ-SEC-10.2: Split mid-payload reassembles to one dispatch
- GIVEN a frame's JSON body arrives split across three separate stdio reads
- WHEN the client's reader processes all three
- THEN exactly one frame is dispatched, with the exact original payload bytes (SC-7)

#### Scenario REQ-SEC-10.3: Two coalesced frames in one read dispatch exactly twice (M9)
- GIVEN two complete frames arrive concatenated within a SINGLE OS-level read (no split)
- WHEN the client's reader processes that one read
- THEN exactly two frames are dispatched, each with its correct original payload — never one merged dispatch, never a dropped frame

#### Scenario REQ-SEC-10.4: Complete frame plus a partial next prefix dispatches one, buffers the rest (M9)
- GIVEN a single OS-level read delivers one complete frame immediately followed by the length-prefix bytes of a second, not-yet-complete frame
- WHEN the client's reader processes that read
- THEN exactly one frame is dispatched (the complete one) and the partial prefix is buffered, awaiting the rest of frame two on a subsequent read — never dispatched early, never dropped

#### Scenario REQ-SEC-10.5: Stream ends mid-frame — buffered partial is never dispatched (B5)
- GIVEN a frame's length prefix has been read (a valid, in-cap prefix) but the stream ends (EOF) before its full payload arrives
- WHEN the client detects the EOF
- THEN it classifies transport-fault, the runner exits 3, and the buffered partial frame is NEVER dispatched — no attempt is made to interpret the truncated bytes as JSON

---

