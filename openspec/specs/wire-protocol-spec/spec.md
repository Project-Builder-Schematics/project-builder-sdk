# Wire Protocol Spec Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines the on-the-wire contract between the SDK's stdio transport and a conformant engine
host: the length-prefixed frame grammar, the versioned `ready` handshake, the four
reverse-callback method schemas, wire error shapes (including the `EmitRejection` mapping and
its `"unknown"` degrade), the factory-pointer grammar, the frame-cap constant contract, and the
doc-reconciliation guard binding this spec to the normative `docs/engine-sdk-wire-spec.md` text.
This is the FIRST wire-protocol domain in this project — `StdioEngineClient` is the first real
`EngineClient` implementation (see `stdio-engine-client` domain, ADR-0053..0059).

## Requirements


### REQ-WPS-01: Frame Envelope Structure

The wire MUST use a 4-byte big-endian length prefix followed by a UTF-8 JSON body, symmetric
in both directions (host→runner and runner→host). A declared/received length of zero is
malformed input, not a valid empty frame — it is handled per SEC-08's narrowed fail-closed
rule.
(Previously: silent on the zero-length case — m8.)

#### Scenario REQ-WPS-01.1: Round-trip frame integrity
- GIVEN a runner connected to a wire-conformant host over stdio
- WHEN either side sends a JSON payload via the framed writer
- THEN the receiver reads exactly 4 bytes, interprets them as an unsigned big-endian length, then reads exactly that many bytes, and `JSON.parse`s them back to the original value

#### Scenario REQ-WPS-01.2: Newline-in-payload survives intact
- GIVEN a JSON payload whose string values contain literal `\n` bytes
- WHEN it is sent as a framed message
- THEN the receiver reconstructs the exact original string — length-prefix framing never treats `\n` as a delimiter (the reason NDJSON was rejected, obs #2154 D1)

#### Scenario REQ-WPS-01.3: Multi-byte UTF-8 payload — prefix is a byte count, not a char count
- GIVEN a JSON payload whose string values contain multi-byte UTF-8 characters (e.g. `"€"`, 3 bytes; `"😀"`, 4 bytes)
- WHEN it is sent as a framed message
- THEN the 4-byte length prefix equals the UTF-8-serialized BYTE length of the JSON body, never the JS string's UTF-16 code-unit `.length` — the receiver reconstructs the exact original string (kills the string.length/UTF-16 mutant)

### REQ-WPS-02: Versioned Ready Handshake, Fail-At-Greeting

The `ready` notification MUST be structurally distinct from every post-boot frame (no `type`,
no `id`, `method: "ready"`) and MUST carry a `protocolVersion` integer identifying the
WIRE/transport protocol version. This `protocolVersion` is a DISTINCT number from
`Batch.protocolVersion` (the IR/emit envelope schema version, `wire.ts`) — they MUST NOT be
conflated: transport framing/handshake/method-set can evolve without forcing an IR-envelope
schema bump, and vice versa. The runner MUST reject at greeting (before any reverse callback is
dispatched) if the host's wire `protocolVersion` does not exact-match the runner's compiled-in
expected value, OR if the greeting frame is structurally invalid.

#### Scenario REQ-WPS-02.1: Matching versions proceed
- GIVEN a host sends `{method:"ready", protocolVersion: N, ...}` where N equals the runner's compiled-in wire version
- WHEN the runner receives it
- THEN the runner proceeds to serve subsequent request frames

#### Scenario REQ-WPS-02.2: Mismatch fails at greeting, zero callbacks dispatched
- GIVEN a host sends `ready` with a `protocolVersion` that does not match the runner's compiled-in value
- WHEN the runner processes the greeting
- THEN the runner exits 1 (validation-failure, EXC-01) naming BOTH versions in the error text, and dispatches zero reverse callbacks (SC-2)

#### Scenario REQ-WPS-02.3: Structurally invalid greeting fails the same way (M17)
- GIVEN a host sends a greeting frame missing `method: "ready"`, or whose `protocolVersion` is absent or non-integer
- WHEN the runner processes the greeting
- THEN it fails exactly as a version mismatch does — the runner exits 1 (validation-failure, EXC-01) and dispatches zero reverse callbacks, never attempting to interpret a partial/malformed greeting as valid

### REQ-WPS-03: Post-Boot Frame Routing

Every frame after `ready` MUST carry `type: "request" | "response"`. A frame with any other (or
missing) `type` MUST be discarded silently ON THE WIRE — never treated as a resync signal, and
never producing a wire-level error frame — but the discard MUST emit a bounded,
WPS-07-conformant note to stderr (silent to the wire counterparty, not to the operator). Host-
issued request IDs MUST be prefixed `h`; runner-issued (reverse-callback) request IDs MUST be
prefixed `s`. A response whose ID does not match a currently-pending call on the receiving side
MUST be discarded the same way (wire-silent, stderr-noted); the discard MUST NOT affect any
other pending call, and a subsequently-arriving correct response for the genuinely-pending call
MUST still resolve it normally.
(Previously: "discarded silently" with no operator-visible trace and no liveness guarantee —
B3, M16.)

#### Scenario REQ-WPS-03.1: Unknown-type frame discarded, connection stays usable
- GIVEN a frame arrives with `type: "notification"` (or absent)
- WHEN the runner's frame router processes it
- THEN the frame is discarded on the wire, a bounded WPS-07-conformant note is written to stderr, and the NEXT frame is still read and dispatched normally (no crash, no resync-by-scanning)

#### Scenario REQ-WPS-03.2: Stale/foreign response ID discarded
- GIVEN a response frame arrives whose `id` was never issued by this runner (or was already resolved)
- WHEN the router receives it
- THEN it is discarded on the wire (with a bounded stderr note per WPS-03.1's rule) and no pending call is affected

#### Scenario REQ-WPS-03.3: Genuinely-pending call still resolves after an unrelated discard (M16 liveness)
- GIVEN a stale/foreign response was discarded per WPS-03.2 while a DIFFERENT call is genuinely pending
- WHEN the correct response for the genuinely-pending call subsequently arrives
- THEN it resolves that call normally — the earlier discard had no effect on the pending call's ability to resolve

### REQ-WPS-04: Reject-Before-Alloc Oversize Handling

Both the length-prefix read AND the outbound send path MUST enforce the cap on the ENCODED
FRAME BODY — the serialized JSON the length prefix counts — BEFORE allocating a receive
buffer or writing an oversized frame. On the INBOUND leg, the declared length is checked
against `BATCH_CAP_BYTES` directly: a declared length exactly equal to `BATCH_CAP_BYTES` is
WITHIN the cap (accepted), never rejected — only strictly greater is oversize, mirroring the
engine's own `recvFrame` (`framer.go:41`, A4). On the OUTBOUND leg (V4), enforcement MUST be
DETERMINISTIC and batch-anchored: a `Batch` is accepted iff its serialized UTF-8 byte length
is at most `EMIT_BATCH_BUDGET_BYTES` = `BATCH_CAP_BYTES` −
`EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES`, where the allowance is the FIXED serialized overhead
of the `ir.emit` request envelope (`{type,id,method,params:{batch}}`) carrying the LONGEST
request id the client can mint (`s${Number.MAX_SAFE_INTEGER}`) — derived by measurement,
asserted in test, never a hand-waved literal. Consequences the implementation MUST honor:
(i) `StdioEngineClient` and `ContractFake` produce IDENTICAL accept/reject outcomes for the
same batch, ALWAYS, through ONE shared measurer (`exceedsEmitBatchBudget`, `src/core/
wire.ts`, fit-32); (ii) the outcome is independent of the request ordinal / id length; (iii)
an accepted batch's ACTUAL encoded frame body never exceeds `BATCH_CAP_BYTES`. An
over-budget batch is rejected locally, never written to the wire.
(Previously V1–V3: both legs compared the bare size against `BATCH_CAP_BYTES`; V4 re-anchors
the outbound leg per the amendment ledger item 1 — the round-1 per-frame check was
ordinal-dependent and diverged from the fake.)

#### Scenario REQ-WPS-04.1: Oversized batch rejected before the frame is written
- GIVEN a factory run produces a `Batch` built via `batchOverSerializedBytes(EMIT_BATCH_BUDGET_BYTES)` from `test/fake/batch-cap-fixtures.ts` — its serialized byte size is strictly greater than `EMIT_BATCH_BUDGET_BYTES` while its raw content byte size (`rawContentBytes`) stays BELOW the budget, and it carries the fixture's fixed multi-byte/escaping prefix
- WHEN the client attempts to emit it
- THEN the client rejects with `EmitRejection{code:"cap"}` locally and NEVER writes the oversized frame to the wire (SC-4), and `ContractFake.emit` rejects the SAME batch identically (FEH-01 parity) — this fixture shape kills both the serialized-vs-raw-content mutant (a check against raw content alone would wrongly pass) and the UTF-16-length mutant (the multi-byte prefix diverges under a code-unit measurer)

#### Scenario REQ-WPS-04.2: Oversized inbound length prefix rejected before body read
- GIVEN an inbound frame's declared length exceeds `BATCH_CAP_BYTES`
- WHEN the runner reads the 4-byte length prefix
- THEN the runner rejects immediately, classified transport-fault (EXC-01), WITHOUT allocating a buffer for or reading the declared body

#### Scenario REQ-WPS-04.3: Exactly-at-boundary batch and prefix are accepted (B7 boundary, V4 re-anchored)
- GIVEN a factory run produces a `Batch` built via `batchAtEmitBudget()` from `test/fake/batch-cap-fixtures.ts` — its serialized byte size is EXACTLY `EMIT_BATCH_BUDGET_BYTES`
- WHEN the client emits it, and separately, an inbound frame declares a length of EXACTLY `BATCH_CAP_BYTES`
- THEN the outbound batch is written to the wire — its ACTUAL encoded frame body not exceeding `BATCH_CAP_BYTES` — and the inbound frame's body is read; neither is rejected, while a `batchOverEmitBudget()` batch (one byte over the budget) IS rejected (kills the `>=`-instead-of-`>` off-by-one mutant, which would otherwise create a cross-repo interop break against the engine's own boundary handling)

#### Scenario REQ-WPS-04.4: Signed-read triangulation on the length prefix (m9)
- GIVEN an inbound frame declares a length of `0x80000000` (2 147 483 648 — negative if read as a signed 32-bit integer, but a valid large unsigned value)
- WHEN the runner reads the 4-byte length prefix
- THEN it is classified over-cap and rejected (per WPS-04.2's rule) — never accepted or misread as a negative/small length (kills a signed-read, e.g. `readInt32BE`-instead-of-`readUInt32BE`, mutant)

### REQ-WPS-05: Reverse-Callback Allowlist

The set of methods the runner may issue as reverse callbacks to the host is closed and exactly
four: `tree.read`, `ir.emit`, `ir.commit`, `ir.discard`. The runner MUST NOT issue any other
method name as a reverse callback. Per-method request/response payload shapes are defined in
REQ-WPS-10.

#### Scenario REQ-WPS-05.1: Only allowlisted methods are issued
- GIVEN a factory run exercising `read`, `emit`, `commit`, and `discard` on the `EngineClient` port
- WHEN `StdioEngineClient` realizes each call over the wire
- THEN the `method` field of every issued request frame is one of `{tree.read, ir.emit, ir.commit, ir.discard}` — no fifth method name ever appears

### REQ-WPS-06: Shared Frame-Cap Constant Naming

`BATCH_CAP_BYTES` (SDK, `src/core/wire.ts`) and the engine's `MaxMessageBytes` MUST be the same
numeric value (4 MiB = 4 194 304 bytes) and MUST be documented as a literal cross-repo
constant-naming contract in the normative wire-spec doc.

#### Scenario REQ-WPS-06.1: Value drift is caught by name, not by luck
- GIVEN the normative wire-spec doc names `BATCH_CAP_BYTES == MaxMessageBytes == 4194304`
- WHEN the conformance harness (FEH-06) asserts the SDK's exported `BATCH_CAP_BYTES` against this literal
- THEN a change to either repo's constant that breaks the equality fails the assertion, not a runtime desync (AC-TRACE)

### REQ-WPS-07: Bounded, No-Echo, Project-Relative Error Text

Any error text that crosses the wire or is written to stderr MUST be bounded to a documented
length ceiling (default 2000 characters — an SDK-chosen placeholder pending engine-side
confirmation, same provenance posture as SEC-05's timeout bound and WPS-06's
`BATCH_CAP_BYTES`), MUST NOT echo raw host/engine internals verbatim (C9) — operationally: no
stack frames, no absolute filesystem paths, no module source excerpts, and never raw peer frame
bytes — and MUST express every path as project-relative, never absolute. The length ceiling
applies to the WHOLE message INCLUDING any echoed identifier (an echoed token, e.g. an
unrecognized flag name, is truncated to a documented per-token max of 200 characters before
composition — names surface, values never, matching `bin/pbuilder-codegen.ts:134`'s
precedent). When the subject path lies outside the project root (as identified by
`relativeDir`, `src/core/context.ts:113`), the project-relative form MUST be expressed as a
`../`-relative path, or — when no relative form can be constructed (e.g. a different filesystem
root) — the documented placeholder token `<outside-project>` MUST be substituted; the runner
MUST NEVER fall back to printing the absolute path.
(Previously: no numeric ceiling, no echoed-token rule, and no rule for paths outside the
project root — M2, B4.)

#### Scenario REQ-WPS-07.1: Error text is bounded and project-relative
- GIVEN an import/run/parse failure produces an error message
- WHEN it is written to stderr or embedded in a wire error frame
- THEN the message is under the documented 2000-character ceiling and contains no absolute filesystem path

#### Scenario REQ-WPS-07.2: Realpath outside the project root never falls back to absolute (B4)
- GIVEN an error message's subject path resolves outside the project root (per `relativeDir`)
- WHEN the error text is composed
- THEN the path is expressed as a `../`-relative path, or — if no relative form exists — the placeholder token `<outside-project>` — never the absolute path

#### Scenario REQ-WPS-07.3: Echoed identifier truncated within the ceiling
- GIVEN an error message echoes a host-controlled identifier (e.g. an unrecognized argv flag, or a malformed export name) longer than 200 characters
- WHEN the message is composed
- THEN the echoed token is truncated to the documented 200-character per-token max, and the total message still stays under the 2000-character ceiling

### REQ-WPS-08: Factory-Pointer Syntax and `ir.emit` Rejection Wire Shape

The factory pointer grammar is `<url>#<export>` where `<url>` is validated per RUN-02 and
`<export>` is an optional fragment naming a non-default export (absent fragment = default
export). An `ir.emit` rejection response MUST carry `error: {code: -32001, message, data:
{emitRejectionCode: "collision"|"not-found"|"unrepresentable"|"cap"|"unknown", failedIndex?:
number, appliedCount: number}}` — a domain-classified rejection, distinguishable from the
generic transport codes (-32700 parse, -32601 unknown method, -32000 generic) already used
engine-side. `"unknown"` is the documented degrade target for an out-of-contract payload (M7,
see SEC-04) — it is a first-class member of the enum, not an ad hoc value.
(Previously: four-member enum with no documented degrade target — M7.)

#### Scenario REQ-WPS-08.1: Pointer grammar parses both forms
- GIVEN `file:///abs/path/factory.ts#namedExport` and `file:///abs/path/factory.ts` (no fragment)
- WHEN the runner parses each
- THEN the first resolves to the `namedExport` binding and the second to the module's default export

#### Scenario REQ-WPS-08.2: Domain-classified emit rejection round-trips
- GIVEN a host rejects an `ir.emit` call with `code: -32001` and `data.emitRejectionCode: "collision"`, `data.failedIndex: 2`, `data.appliedCount: 2`
- WHEN `StdioEngineClient` receives the response
- THEN it reconstructs `EmitRejection{code:"collision", failedIndex:2, appliedCount:2}` exactly, never inventing a code by parsing `message` text

#### Scenario REQ-WPS-08.3: Host explicitly sends "unknown" round-trips like any other code (M7)
- GIVEN a host rejects `ir.emit` with `data.emitRejectionCode: "unknown"` and no `failedIndex`
- WHEN `StdioEngineClient` receives the response
- THEN it reconstructs `EmitRejection{code:"unknown", failedIndex:undefined, appliedCount}` exactly — `"unknown"` round-trips like any allowlisted code, it is not special-cased into a crash

### REQ-WPS-09: Run Bootstrap Is Argv/Bridge-Only — No Host-Issued Request Method (B1, NEW)

The runner's single factory run per process is bootstrapped exclusively via the process's argv
(REQ-RUN-01) or the bridge's in-process argv-equivalent parameters (REQ-BRB-01) — NEVER via a
host-issued request frame over the wire. Consequently, the post-`ready` wire carries ONLY the
four reverse-callback methods (REQ-WPS-05) issued runner→host, and their corresponding
responses issued host→runner; the runner MUST NOT define or serve any host→runner request
method. There is no `runFactory` wire request. Elsewhere in this spec (SEC-02, EXC-01), the
phrase "run" or "in-flight run" refers to the single in-process run bootstrapped by argv/bridge,
never to a wire-level request.

#### Scenario REQ-WPS-09.1: Only reverse-callback traffic crosses the wire
- GIVEN a runner process started via argv or the bridge
- WHEN the wire session is inspected end-to-end
- THEN the only host→runner frames observed are RESPONSES to the four reverse-callback methods — zero host-issued REQUEST frames ever appear

#### Scenario REQ-WPS-09.2: A host-sent request frame is discarded, never dispatches a run
- GIVEN a host sends a frame with `type: "request"` and any `method` value post-`ready`
- WHEN the runner's frame router processes it
- THEN it is discarded per WPS-03 (unserved method) — the runner never dispatches a run, or a second run, in response to a wire request

### REQ-WPS-10: Per-Method Reverse-Callback Payload Schemas (B2, NEW)

Each of the four reverse-callback methods (WPS-05) MUST carry the following request/response
shapes on the wire:

| Method | Request `params` | Success `result` |
|---|---|---|
| `tree.read` | `{path: string}` — project-relative (WPS-07) | `null` (not-found) \| `{content: string}` (SEC-06) |
| `ir.emit` | `{batch: Batch}` — `Batch.protocolVersion` is the IR/emit envelope schema version (the WPS-02 distinctness clause); `batch.instructions` carries the directive list produced by the run | `{appliedCount: number}` on full acceptance |
| `ir.commit` | `{}` (no additional params — the intent is scoped to the current single run, SEC-02) | `{}` acknowledgment (presence of a well-formed success response, not its shape, signals success) |
| `ir.discard` | `{}` (same scoping as `ir.commit`) | `{}` acknowledgment |

Every reverse-callback SUCCESS response, for any of the four methods, MUST use the field name
`result` for its payload — the generic success envelope is `{type:"response", id, result:
<method-specific shape above>}`. Every REJECTION response MUST use the field name `error`
(WPS-08 defines `ir.emit`'s rejection shape; `ir.commit`/`ir.discard` rejections carry `error:
{code, message}` without the `emitRejectionCode` data field, which is `ir.emit`-specific).

#### Scenario REQ-WPS-10.1: `tree.read` request params round-trip
- GIVEN `StdioEngineClient` issues `tree.read` for a project-relative path `"src/foo.ts"`
- WHEN the request frame is inspected
- THEN its `params` field is exactly `{path: "src/foo.ts"}`, project-relative, never absolute

#### Scenario REQ-WPS-10.2: `ir.emit` request carries the Batch envelope with its own protocolVersion
- GIVEN a factory emits a batch
- WHEN the `ir.emit` request frame is inspected
- THEN `params.batch.protocolVersion` is present and is the IR/emit envelope schema version — distinct from the wire handshake's `protocolVersion` (WPS-02); the request frame itself carries no top-level wire-version field

#### Scenario REQ-WPS-10.3: `ir.commit`/`ir.discard` success ack uses `result`, never `error`
- GIVEN the host acknowledges `ir.commit`
- WHEN the response frame is inspected
- THEN it is a well-formed success response using the `result` field name (an empty object) — never reusing the `error` field name for a success acknowledgment

### REQ-WPS-11: Normative Wire-Spec Doc Reconciled to Rev 3 (M1, NEW)

`docs/engine-sdk-wire-design.md` MUST be reconciled to rev 3 against this spec: a structural
cross-reference scan MUST find zero live references to NDJSON framing, a single-initiator
model, or a `session.init` handshake outside of a section explicitly labeled
superseded/historical. The doc's header MUST stamp a wire-spec version identifier naming this
spec's engine build target.
(V3: this requirement's scope extends to `docs/engine-sdk-wire-spec.md` — the NEW normative wire-
spec document created alongside the rev-3 `docs/engine-sdk-wire-design.md` reconciliation above
(`design.md` task S-005.1) — distinct from that historical-reconciliation doc. WPS-11.3 pins its
required CONTENT, closing the gap where only WPS-06/FEH-06 anchored a single item, the cap
constant, to "the normative wire-spec doc" — gap #3.)

#### Scenario REQ-WPS-11.1: Zero live references to the superseded design
- GIVEN `docs/engine-sdk-wire-design.md` at rev 3
- WHEN a structural cross-reference scan runs (searching for `NDJSON`, `single-initiator`, `session.init`)
- THEN zero matches occur outside a section explicitly labeled superseded/historical

#### Scenario REQ-WPS-11.2: Header stamps the wire-spec version target
- GIVEN the doc's header
- WHEN inspected
- THEN it stamps a wire-spec version identifier matching REQ-WPS-02's `protocolVersion` value, explicitly naming the engine build target

#### Scenario REQ-WPS-11.3: Normative wire-spec doc carries every mandated section (V3, gap #3)
- GIVEN `docs/engine-sdk-wire-spec.md` (the normative doc created per `design.md` task S-005.1)
- WHEN a section-presence scan runs (the fit-31 vehicle, `design.md`/`slices.md` task S-005.3, extended to carry this check)
- THEN it finds, as named sections: the frame grammar (WPS-01), the `ready` handshake + `protocolVersion` (WPS-02), all four reverse-callback method schemas (WPS-05/WPS-10), error shapes — wire codes + `EmitRejection` mapping (WPS-08), the factory-pointer grammar (WPS-08), the exit-code taxonomy (EXC-01), the bridge contract naming `BRIDGE_CONTRACT_VERSION` (BRB-01), and the cap constant contract (`BATCH_CAP_BYTES`, WPS-06) — zero mandated sections missing

---

