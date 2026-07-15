# Specs: stdio-engine-client

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment re-signature; V3/V2 signed same day)
**Change**: `stdio-engine-client`
**Triage**: L
**Spec source**: internal (Upstream Ingest / Upstream Sync: skipped — `spec_source = internal`)

**(V4) Amendment ledger** — owner-signed micro-amendments closing judgment-day round 2
(2026-07-15); zero REQ-IDs added/removed/renumbered, all 41 V3 REQ-IDs preserved in ID:

1. **REQ-WPS-04.1/.3** — the outbound cap re-anchors to the ENCODED ir.emit FRAME BODY,
   enforced DETERMINISTICALLY via the fixed-allowance batch budget (`EMIT_BATCH_BUDGET_BYTES
   = BATCH_CAP_BYTES − EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES`, `src/core/wire.ts`); one shared
   measurer (`exceedsEmitBatchBudget`) for `StdioEngineClient` AND `ContractFake` (FEH-01
   parity). WPS-04.3's boundary scenario re-anchors from `batchOfSerializedBytes(
   BATCH_CAP_BYTES)` to the budget-anchored fixtures (`batchAtEmitBudget`/
   `batchOverEmitBudget`). Archive-sync note: the boundary shift re-anchors two ARCHIVED
   main specs' at-cap scenarios from `BATCH_CAP_BYTES` to the emit budget —
   `batch-cap-contract` REQ-01.1/REQ-04.3 and `content-classification` REQ-CCL-02.3 — sync
   their scenario text at archive.
2. **REQ-EXC-01 code-2 row** — extended to include a refused `tree.read` intent
   (`IntentRejectedError` → exit 2).
3. **REQ-RUN-07** — exit-1 wording is "could not be resolved or loaded" (covers
   `ERR_MODULE_NOT_FOUND` and Bun `ResolveMessage`/`BuildMessage`/`SyntaxError` load
   failures — a module that never RAN).
4. **REQ-BRB-02** — mechanism clause is "captures fd 1 before any factory-related import
   (armed at bridge entry)", replacing "at its own module load".
5. ERM-03 gains a transport-class carve-out (TransportFault passes through `Session.flush`
   untranslated) — `openspec/specs/emit-rejection-metadata/spec.md` is an ARCHIVED main
   spec, not edited now; sync at archive.

V2 applies consolidated council feedback (ba/qa/security, all `needs-revision`) to V1. All 35
V1 REQ-IDs are preserved unchanged in meaning; changed REQs carry an inline
`(Previously: ...)` marker. Five new REQ-IDs extend existing families (never renumbering):
WPS-09, WPS-10, WPS-11, RUN-07, RUN-08. Six NEW capabilities, zero Modified, still holds. Every
REQ below is written at the frame/behavior level; it deliberately does **not** resolve the
read-loop ownership mechanism (owner ruling #3 vs. explore Open Question 1 — ADR is design's
job) or the internal shape of `bin/pbuilder-runner.ts` vs. `bootstrap-runner-bridge` (also
design's job). Where a counterparty is needed in a scenario it is always "a wire-conformant
host" (the fake-engine harness or `ContractFake`'s shell) — no requirement implies a live
Go-engine round-trip (out of scope per proposal).

**(V3)** V3 is a surgical amendment closing plan-verify iteration-1 gaps #1–#3
(`openspec/changes/stdio-engine-client/verify-plan-1.md`) against the signed V2, `unfreeze=true`.
All 40 V2 REQ-IDs are untouched in ID; WPS-11's description gains a V3-marked scope clause plus
one new scenario (WPS-11.3). One new REQ-ID is added (REQ-LED-01, new `ledger-reconciliation`
family) — Seven NEW capabilities, zero Modified, now holds (was six in V2). Zero REQ-IDs removed,
zero renumbered. The owner re-signs this delta; V2's council-signed content is otherwise
unchanged.

> **Concurrency note (RESOLVED — V3)**: at V2 persist time, this file was found already
> overwritten by a DIFFERENT V2 draft (framed as "R1/R2 orchestrator-settled resolutions" rather
> than this invocation's B1–B7/M1–M17/m1–m9 council findings) — evidence of a concurrent/
> duplicate `sdd-spec` invocation. Orchestrator reconciliation (engram obs #2175, topic
> `sdd/stdio-engine-client/concurrent-spec-conflict`) determined: **this file's V2 (B1–B7/M1–M17/
> m1–m9) is CANONICAL**; the ghost "R1/R2" draft is **DISCARDED** — it missed B4 (the SEC-07/
> WPS-07 project-relative-path contradiction), M1 (the doc-reconciliation requirement, this
> spec's WPS-11), and M3 (direct-spawn fd-1 capture, this spec's RUN-08), and it misassigned
> RUN-07. The discarded draft is preserved for audit only (scratchpad
> `spec-V2-conflicting-draft-R1R2.md`, not part of this repo). Its one unique, codebase-verified
> finding — `ContractFake.emit()` not calling the existing `serializedBatchSize` export
> (`src/core/wire.ts:61`) for its cap check — was carried forward, not lost: it landed in
> `design.md`'s File Changes table as the `exceedsBatchBytes`/`exceedsBatchCap` single-source cap
> measurer (`src/core/wire.ts`, `src/testing/contract-fake.ts`) and fitness function fit-32
> (cap-single-source). No open question remains on this point — this note is the closure record;
> Open Design Question #4 (V2) is resolved by it, see below.

## Engine-Side Assumptions (non-normative — named so REQs that depend on them are legible)

| ID | Assumption | REQs that depend on it |
|---|---|---|
| A1 | Engine pre-validates the factory URL and `--input-file` value, and guarantees `--input-file` is always an engine-owned temp path (never author/project-controlled) | RUN-04 |
| A2 | Engine dups fd 1 before dynamic-importing the bootstrap/runner (pre-import security envelope) | BRB-02, SEC-09 |
| A3 | Supply-chain authenticity (is this SDK copy the genuine, untampered one?) is the third-party-trust sensitive-area row's control, not this change's | SEC-07 |
| A4 | Engine performs its own allowlist/containment/reject-before-alloc enforcement on its side of the wire | WPS-04, SEC-08 |

---

## Domain: wire-protocol-spec

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

## Domain: runner-exit-code-taxonomy

### REQ-EXC-01: Exit Code Taxonomy

The runner MUST exit with exactly one of the codes below, classified by the terminal error's
shape (mutually exclusive by construction — no precedence rule needed, since
`AuthoringError.origin` is a closed derived enum and transport-fault errors are a distinct
`StdioEngineClient` error class).

| Code | Category | Classified when |
|---|---|---|
| 0 | success | the run committed and the process exits cleanly |
| 1 | validation-failure | argv/factory-pointer/schema gating rejects before or during the run (`AuthoringError.origin === "authoring-rejected"`, or a pre-run RUN-01/02/03/04/07/08 gate fails), OR the greeting wire-version mismatch or structurally-invalid greeting (WPS-02.2/.3), OR the bridge contract version mismatch (BRB-01.2), OR the single-instance realpath probe failure (SEC-07.2) |
| 2 | emit-rejection | the host refused a write, an advisory commit/discard intent, or a `tree.read` intent (V4 — a `tree.read` error envelope is classified `IntentRejectedError`, SEC-06) (`AuthoringError.origin === "write-rejected"`, includes the `"unknown"` degrade, WPS-08/SEC-04) |
| 3 | transport-fault | a wire-level failure (malformed/desync/oversize/timeout/unexpected EOF, including a pending call rejected by SEC-08.3/SEC-10.5) distinct from any classified `AuthoringError` |
| 4 | crash | an unclassified exception reaches the runner's top-level catch (not an `AuthoringError`, not a transport-fault), including an author-code throw during factory import (RUN-07.2) |

Codes 3 and 4 are this spec's extension of owner ruling #2163's three-way taxonomy
(validation-failure / emit-rejection / crash): AC-A2 requires transport-fault, EmitRejection,
and author-crash to be THREE distinguishable signals, and a shared exit code for two different
failure classes would defeat that at the process boundary. This is an addition, not a reopening
— the ruling's three named categories all still map to a code.
(Previously: the code-1 column did not name the greeting/bridge/probe handshake failures
explicitly — B6.)

#### Scenario REQ-EXC-01.1: Clean run exits 0
- GIVEN a factory that emits a valid batch and returns normally
- WHEN the run completes against a wire-conformant host that commits
- THEN the runner exits 0 (SC-1)

#### Scenario REQ-EXC-01.2: Four failure classes map to four distinct codes
- GIVEN four separate runs: (a) `--input` and `--input-file` both passed, (b) a factory write collides, (c) the host sends a frame with a corrupted length prefix mid-run, (d) the factory throws a plain `TypeError`
- WHEN each run terminates
- THEN the exit codes are 1, 2, 3, 4 respectively — never the same code for two of them

#### Scenario REQ-EXC-01.3: Three handshake-time failures all classify as code 1, distinguishable only by message (B6)
- GIVEN three separate handshake-time failures: (a) a WPS-02 `protocolVersion` mismatch, (b) a BRB-01 bridge contract version mismatch, (c) a SEC-07 realpath probe split
- WHEN each terminates
- THEN all three exit 1 (validation-failure) — indistinguishable by exit code from each other or from a plain post-boot RUN-01..04 argv gate failure, distinguishable only by their error text

### REQ-EXC-02: Double-Fault Never Overrides the Original Error's Classification

When `discard()` itself fails while handling an original error (E1), the double-fault (E2) MUST
be attached as E1's `.cause` and MUST NOT change E1's exit-code classification (mirrors
`context.ts`'s existing double-fault preservation).

#### Scenario REQ-EXC-02.1: Factory crash + failed discard still exits by E1's class
- GIVEN a factory throws mid-run (E1, a `TypeError`) AND the host's `ir.discard` acknowledgment itself fails (E2)
- WHEN the runner terminates
- THEN it exits with code 4 (crash, E1's class), E2 is attached as `E1.cause`, and no partial apply is ever confirmed (SC-3)

---

## Domain: pbuilder-runner-bin

### REQ-RUN-01: Argv Contract

The bin MUST accept `--factory <url>#<export>` (required), and exactly one of `--input <json>`
XOR `--input-file <path>` (mutually exclusive, one required). Any unrecognized flag MUST fail
closed (validation-failure) rather than being silently ignored.

#### Scenario REQ-RUN-01.1: Both --input and --input-file rejected
- GIVEN argv containing both `--input '{}'` and `--input-file /tmp/x.json`
- WHEN the bin parses argv
- THEN it exits 1 (validation-failure) before any factory import is attempted

#### Scenario REQ-RUN-01.2: Unknown flag fails closed
- GIVEN argv containing `--unsafe-mode`
- WHEN the bin parses argv
- THEN it exits 1 naming the unrecognized flag, never silently continuing

#### Scenario REQ-RUN-01.3: Neither input flag supplied (m2)
- GIVEN argv containing neither `--input` nor `--input-file`
- WHEN the bin parses argv
- THEN it exits 1 (validation-failure), naming that exactly one of `--input`/`--input-file` is required, before any factory import is attempted

### REQ-RUN-02: Factory URL Scheme + Host Allowlist (C1)

The bin MUST validate that the factory pointer's URL scheme is exactly `file:` AND that the
URL's host component is empty — rejecting `file://host/path` forms (a non-empty host, which
some URL parsers resolve as a remote/UNC-style reference) as well as any non-`file:` scheme —
BEFORE dynamic-importing the module (the factory's top-level code runs at import — input
validation after import is not a containment control).
(Previously: scheme-only check, silent on the host component — m3.)

#### Scenario REQ-RUN-02.1: file:// scheme with empty host accepted
- GIVEN `--factory file:///workspace/factory.ts`
- WHEN the bin validates the pointer
- THEN validation passes and dynamic-import proceeds

#### Scenario REQ-RUN-02.2: Non-file scheme rejected before import
- GIVEN `--factory https://evil.example/factory.ts` (or `data:`, `node:`, any non-`file://` scheme)
- WHEN the bin validates the pointer
- THEN it exits 1 WITHOUT ever calling `import()` on the target — no author code from that URL executes

#### Scenario REQ-RUN-02.3: file:// scheme with a non-empty host rejected before import (m3)
- GIVEN `--factory file://host/workspace/factory.ts` (a non-empty host component)
- WHEN the bin validates the pointer
- THEN it is rejected before import, even though its scheme is `file:` — the host component is part of the allowlist check, not just the scheme

### REQ-RUN-03: Factory Fragment/Export Validation (C2)

The bin MUST classify export resolution into exactly three distinct, actionable, load-time
failure forms, each with its own message: (a) absent fragment resolves to the default export —
MUST fail loudly if no default export exists; (b) a present fragment naming a non-existent
export MUST fail with a "missing export" message; (c) a resolved export that is not a function
MUST fail with a "malformed factory export" message.

#### Scenario REQ-RUN-03.1: Missing default export
- GIVEN `--factory file:///x.ts` (no fragment) and `x.ts` has no default export
- WHEN the bin resolves the pointer
- THEN it exits 1 with a message distinct from the other two forms, naming "no default export" (SC-9)

#### Scenario REQ-RUN-03.2: Missing named export
- GIVEN `--factory file:///x.ts#makeThing` and `x.ts` does not export `makeThing`
- WHEN the bin resolves the pointer
- THEN it exits 1 naming the missing export `makeThing` (SC-9)

#### Scenario REQ-RUN-03.3: Malformed (non-function) export
- GIVEN `--factory file:///x.ts#config` and `x.ts`'s `config` export is a plain object, not a function
- WHEN the bin resolves the pointer
- THEN it exits 1 naming the export as non-callable, distinct from the two missing-export forms (SC-9)

### REQ-RUN-04: Input-File Size Cap + Fail-Closed Parse (C3)

When `--input-file <path>` is used, the bin MUST check the file's size against a documented cap
(default 10 MiB / 10 485 760 bytes — an SDK-chosen placeholder pending engine-side
confirmation, same provenance posture as SEC-05/WPS-07) BEFORE reading its contents, and MUST
fail closed (reject, never partially apply) on any JSON parse error, reporting only the parse
failure's line and column (never raw file content, mirrors `formatParseError`,
`bin/pbuilder-codegen.ts:126`). Per A1, `<path>` is always an engine-owned temp path — the bin
performs no path-provenance/containment check on it.
(Previously: "documented cap" with no value, and no constraint on what the parse-error message
may contain — M2, m4.)

#### Scenario REQ-RUN-04.1: Oversized input-file rejected before read
- GIVEN an `--input-file` path whose file size exceeds the documented 10 MiB cap
- WHEN the bin processes the flag
- THEN it exits 1 without reading the file's contents into memory

#### Scenario REQ-RUN-04.2: Malformed JSON fails closed, reporting only line/column
- GIVEN an `--input-file` under the cap whose contents are not valid JSON
- WHEN the bin parses it
- THEN it exits 1, reporting only the parse error's line and column (never the raw file content), no factory import is attempted, and no partial input is passed to the factory

### REQ-RUN-05: `defineFactory` Wrap with `packageDir = dirname(factory)`

After successful export resolution (RUN-03), the bin MUST wrap the resolved bare factory export
using the internal `defineFactory`, passing `packageDir = dirname(<factory URL's filesystem
path>)` so schema-derived validation and reserved-name checks (`context.ts`) apply exactly as
they do for `runFactoryForTest`.

#### Scenario REQ-RUN-05.1: Wrapped factory's observable behavior matches packageDir-anchored runFactoryForTest (m6)
- GIVEN `--factory file:///workspace/pkg/factory.ts`
- WHEN the bin wraps the resolved export and the factory is subsequently run
- THEN its observable behavior (schema-derived validation and reserved-name checks anchored to `packageDir`) is identical to invoking the same factory via `runFactoryForTest` with `packageDir: "/workspace/pkg"` — verified by observable consequence, never by inspecting `defineFactory`'s call arguments directly (drops the white-box invocation spy)

### REQ-RUN-06: Double-Wrap Detection

The bin MUST detect when the resolved factory export is already the return value of an internal
`defineFactory` call, rather than a bare author function, and reject at load time with a message
that educates the author to export the bare function — distinct from RUN-03's
missing/malformed-export messages, and never silently invoking `wrapped(wrapped(...))`. The
detection MECHANISM (e.g. a brand marker on the wrapped return value) is a design/implementation
decision (see design ADR) — this requirement is behavior-level only: WHAT is detected and
rejected, not HOW.
(Previously: specified the mechanism as arity-sniffing `(o, deps)` vs. `(o)` — M12 drops the
mechanism from the spec and adds a negative-triangulation scenario so an incidental arity-2
bare factory is never misclassified.)

#### Scenario REQ-RUN-06.1: Already-wrapped export rejected with an educational message
- GIVEN a factory module whose target export is itself the function `defineFactory(bareFn)` returns
- WHEN the bin resolves and inspects the export before wrapping it
- THEN it exits 1 at load time with a message distinguishable from RUN-03's forms, and never executes the double-wrapped call chain

#### Scenario REQ-RUN-06.2: A bare arity-2 factory is NOT misclassified as already-wrapped (M12 negative triangulation)
- GIVEN a bare arity-1 factory `(o) => {}`, AND separately a bare factory written with an unused second parameter `(o, _unused) => {}`
- WHEN the bin resolves and inspects each export
- THEN NEITHER is rejected by the double-wrap check — both are ordinary bare factories and proceed to normal wrapping (proves the detection is not implemented as arity-sniffing, since arity alone would misclassify the second one)

### REQ-RUN-07: Factory Module Import Failure Classification (M4, NEW)

When the bin's dynamic `import()` of the (allowlisted, RUN-02) factory module itself throws,
the bin MUST classify the failure into exactly two forms: a module that could not be RESOLVED
OR LOADED (V4 — `ERR_MODULE_NOT_FOUND`, or a Bun `ResolveMessage`/`BuildMessage`/
`SyntaxError` load failure: a module that never RAN) exits 1 (validation-failure); an
exception thrown by the factory module's own top-level code (author code executing at import
time) exits 4 (crash). In both cases, the stderr text MUST be bounded, no-echo, and
project-relative (WPS-07) — never a raw import stack trace.

#### Scenario REQ-RUN-07.1: Module-not-found exits 1
- GIVEN `--factory file:///workspace/missing.ts` pointing to a nonexistent file
- WHEN the bin imports it
- THEN it exits 1, with bounded, project-relative stderr text stating the module could not be resolved — no raw Node resolution stack

#### Scenario REQ-RUN-07.2: Author top-level throw at import exits 4
- GIVEN a factory module whose top-level code throws a plain `Error` during import (an author-level throw, not a resolution failure)
- WHEN the bin imports it
- THEN it exits 4 (crash), with bounded, project-relative stderr text — never a raw import stack trace, never an absolute path, never a module source excerpt

### REQ-RUN-08: Fd-1 Capture and Console Redirect When the Bin Is the Process Entry (M3, NEW)

When `pbuilder-runner-bin` is itself the process entry point (directly spawned per RUN-01 — not
reached via the bridge), it MUST capture its own reference to the process's fd-1 write handle,
and MUST redirect `console.*` to stderr, BEFORE any factory import — the same guarantee BRB-02/
BRB-03 provide on the bridge path. This is defence-in-depth: whichever path reaches the runner,
the same fd-1/console protection applies before the factory's top-level code can run.

#### Scenario REQ-RUN-08.1: Direct-spawn entry captures fd-1 and redirects console before import
- GIVEN `pbuilder-runner-bin` is spawned directly (no bridge)
- WHEN it starts
- THEN it captures the fd-1 write handle and redirects `console.*` to stderr BEFORE argv parsing proceeds to a factory import — identical guarantee to BRB-02/BRB-03's bridge-path behavior

#### Scenario REQ-RUN-08.2: Author reassignment cannot hijack the wire on the direct-spawn path
- GIVEN the bin has captured fd-1 and redirected console at direct-spawn entry
- WHEN a factory reassigns `process.stdout` or calls `console.log` post-import
- THEN wire frames still reach the captured handle unchanged and console output appears on stderr only — identical outcome to the bridge path (BRB-02.1/BRB-03.1)

---

## Domain: bootstrap-runner-bridge

### REQ-BRB-01: Versioned Bridge Entry Contract

The bridge MUST expose a stable, versioned in-process entry point that the engine's embedded
bootstrap dynamic-imports to hand off control (the "second versioned contract", owner ruling
#2157 point 3) — an in-process JS-level contract, independent of the wire's `ready.
protocolVersion` (WPS-02). A version mismatch between what the bootstrap expects and what the
installed SDK's bridge provides MUST fail loudly, naming both versions. Parameters arriving via
the bridge (factory pointer, `--input`/`--input-file`-equivalent) MUST traverse the SAME
RUN-01..RUN-04 validation gates as argv-supplied parameters — those gates live at the
composition root shared by both entry paths, never duplicated or bypassed inside the bridge's
own parameter handling.
(Previously: silent on whether bridge-delivered parameters traverse the argv gates — M5.)

#### Scenario REQ-BRB-01.1: Matching bridge versions hand off cleanly
- GIVEN the bootstrap expects bridge contract version N and the installed SDK's bridge is version N
- WHEN the bootstrap dynamic-imports the bridge entry point
- THEN control passes to `pbuilder-runner-bin`'s composition root with the argv-equivalent parameters (factory pointer, input/input-file)

#### Scenario REQ-BRB-01.2: Mismatched bridge version fails loudly
- GIVEN the bootstrap expects bridge contract version N and the installed SDK's bridge reports version M ≠ N
- WHEN the bootstrap invokes the entry point
- THEN the bridge rejects before any factory-related code runs, naming both N and M, exiting 1 (validation-failure, EXC-01)

#### Scenario REQ-BRB-01.3: Bridge-delivered parameters traverse the same gates as argv (M5)
- GIVEN the bridge hands off a factory pointer with a non-`file://` scheme (a RUN-02 violation)
- WHEN `pbuilder-runner-bin`'s composition root receives the bridge-delivered parameters
- THEN it is rejected by the SAME gate (RUN-02) that would reject it from argv — the bridge path does not bypass or re-implement a separate, weaker check

### REQ-BRB-02: Fd-1 Capture Before Import (C5)

The bridge MUST capture its own reference to the process's fd-1 write handle before any
factory-related import (armed at bridge entry — V4; previously "at its own module load", which
would mutate global process state as a side effect of merely importing the module) — before it
imports `pbuilder-runner-bin` or the factory — as belt-and-suspenders alongside the engine's
own dup (A2). All frame writes for the lifetime of the process MUST route only through that
captured handle; a later reassignment of `process.stdout` by author code MUST NOT be able to
redirect wire writes.

#### Scenario REQ-BRB-02.1: Author reassignment of process.stdout cannot hijack the wire
- GIVEN the bridge has captured the fd-1 handle at bridge entry (V4), before any factory-related import
- WHEN a factory (post-import) reassigns or monkey-patches `process.stdout`
- THEN `StdioEngineClient`'s outbound frames still reach the captured handle unchanged — the reassignment has no effect on wire traffic

### REQ-BRB-03: Console Redirect Before Import (C6)

The bridge MUST redirect `console.*` to stderr before importing `pbuilder-runner-bin`/the
factory, as belt-and-suspenders alongside the engine's own dup (A2).

#### Scenario REQ-BRB-03.1: console.log never reaches the wire
- GIVEN the bridge has redirected `console.*` to stderr before import
- WHEN a factory calls `console.log("debug")` during its run
- THEN the text appears on stderr and no frame is written to stdout as a result of that call

---

## Domain: stdio-engine-client

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

## Domain: fake-engine-conformance-harness

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

## Domain: ledger-reconciliation (V3, gap #2 — NEW)

### REQ-LED-01: Pending-Changes Ledger Reconciled to This Change's Dispositions (V3, NEW)

The change MUST reconcile `openspec/pending-changes.md` against the disposition table carried in
`sdd/stdio-engine-client/slices` (task S-005.4): closing the `StdioEngineClient` row (L359) with
a supersession note naming the decisions this spec supersedes (NDJSON framing, the `session.init`
handshake, and the row's undefined bootstrap mechanism), and creating two new rows — a deferred
Windows/macOS-pins row and a cross-repo tether row naming the engine's build target (the rev-3
`docs/engine-sdk-wire-design.md` and the `docs/engine-sdk-wire-spec.md` version this change
ships, WPS-11.2). This requirement is a documentation/process artifact, not a wire behavior: it
is verified by `sdd-verify --mode=final` evidence and a fit-31-style ledger-presence scan
(`slices.md` task S-005.3), NEVER by the fake-engine-conformance-harness's wire-scenario corpus
(FEH-01..05). FEH-05's coverage map still parses and counts REQ-LED-01 (its rule regex-scans
this file's `### REQ-XX-NN` headers, and this header matches), so its expected-count constant
updates from 40 to 41 — but LED-01's exercising evidence is the ledger scan, not a harness
scenario; a future FEH-05 implementation MUST account for this non-harness-verified REQ-ID
rather than misreport it "uncovered."

#### Scenario REQ-LED-01.1: Tether and Windows/macOS-pins rows exist, naming the build target
- GIVEN the change has landed (`slices.md` S-005 complete)
- WHEN `openspec/pending-changes.md` is scanned
- THEN it contains a cross-repo tether row naming "engine PC-PROTO-01 MUST build against rev-3 + wire-spec v{N}" (the `docs/engine-sdk-wire-design.md` rev and the `docs/engine-sdk-wire-spec.md` version stamped per WPS-11.2), AND a Windows/macOS-pins deferred row — both assertable by a mechanical scan, not by reading intent

#### Scenario REQ-LED-01.2: Closed StdioEngineClient row carries a supersession note
- GIVEN the pre-change `StdioEngineClient` row (L359) named NDJSON framing, a `session.init` handshake, and no bootstrap/bridge mechanism
- WHEN the row is closed by this change
- THEN it carries a supersession note explicitly naming all three superseded decisions (NDJSON → length-prefix framing WPS-01, `session.init` → versioned `ready` WPS-02, and the row's undefined bootstrap → the argv/bridge mechanism WPS-09/BRB-01) — so a future reader is never misled into thinking the row's original design shipped

---

## REQ-ID Stability

V1 assigned 35 REQ-IDs across six capabilities, first version, no prior spec. V2 preserves ALL
35 V1 REQ-IDs unchanged in meaning — content updates are marked inline with `(Previously: ...)`.
Five new REQ-IDs extend existing families, assigned as the next available ID per family — never
renumbering, never reusing a removed ID (none were removed). V3 (this version) preserves ALL 40
V2 REQ-IDs unchanged in meaning, marks its one WPS-11 content addition inline with `(V3: ...)`,
and adds one new REQ-ID (LED-01) in a new seventh family:

| Family | Capability | V1 REQ-IDs | V2 additions | V3 additions | Current REQ-IDs |
|---|---|---|---|---|---|
| WPS | wire-protocol-spec | WPS-01 .. WPS-08 | WPS-09, WPS-10, WPS-11 | — (WPS-11 description + WPS-11.3 scenario added, no new ID) | WPS-01 .. WPS-11 |
| EXC | runner-exit-code-taxonomy | EXC-01 .. EXC-02 | — | — | EXC-01 .. EXC-02 |
| RUN | pbuilder-runner-bin | RUN-01 .. RUN-06 | RUN-07, RUN-08 | — | RUN-01 .. RUN-08 |
| BRB | bootstrap-runner-bridge | BRB-01 .. BRB-03 | — | — | BRB-01 .. BRB-03 |
| SEC | stdio-engine-client | SEC-01 .. SEC-10 | — | — | SEC-01 .. SEC-10 |
| FEH | fake-engine-conformance-harness | FEH-01 .. FEH-06 | — | — | FEH-01 .. FEH-06 |
| LED | ledger-reconciliation | — | — | LED-01 | LED-01 |

Total: 35 (V1) → 40 (V2) → 41 (V3) REQs. V3 adds exactly one new REQ-ID (LED-01); zero removed,
zero renumbered. V4 (this version) adds ZERO REQ-IDs — it is a content-only micro-amendment to
WPS-04, EXC-01, RUN-07, and BRB-02 per the header Amendment ledger; the count stays 41.

## Coverage Check

### Capability → REQ (every capability has ≥1 REQ)

| Capability | REQ count (V1 → V2 → V3) |
|---|---|
| wire-protocol-spec | 8 → 11 → 11 |
| runner-exit-code-taxonomy | 2 → 2 → 2 |
| pbuilder-runner-bin | 6 → 8 → 8 |
| bootstrap-runner-bridge | 3 → 3 → 3 |
| stdio-engine-client | 10 → 10 → 10 |
| fake-engine-conformance-harness | 6 → 6 → 6 |
| ledger-reconciliation | — → — → 1 |
| **Total** | **35 → 40 → 41** |

### REQ → Scenario (every REQ has ≥1 scenario)

All 41 REQs above carry at least one `#### Scenario` block. REQs with more than one failure
mode/case now carry two to five scenarios each; notably RUN-01 (3), RUN-02 (3), RUN-03 (3),
RUN-06 (2), EXC-01 (3), WPS-02 (3), WPS-04 (4), WPS-07 (3), WPS-08 (3), WPS-11 (3, V3 adds
WPS-11.3), SEC-02 (1, tightened), SEC-04 (3), SEC-05 (2), SEC-07 (3), SEC-08 (3), SEC-10 (5),
LED-01 (2, V3 new).

### BA Acceptance Criteria → REQ (obs #2164 seed material)

| AC | REQ(s) |
|---|---|
| AC-E1 (buildable from spec+doc alone) | WPS-01..11 (full frame/handshake/method/error-shape/schema grammar) |
| AC-E2 (doc↔spec zero contradiction) | WPS-02 (dual-version pin resolves the doc's stale single-version framing), WPS-11 (mechanical rev-3 reconciliation check, M1) |
| AC-E3 (cap constant named+valued) | WPS-06, FEH-06 |
| AC-A1 (factory crash → original error, discard advised, non-zero exit, double-fault as cause) | EXC-01, EXC-02, SEC-03 |
| AC-A2 (transport fault / EmitRejection / crash = 3 distinguishable signals) | EXC-01 (codes 2/3/4), SEC-08, SEC-10 (EOF/coalesced additions) |
| AC-A3 (author stdout write never corrupts a frame) | SEC-09, BRB-02, RUN-08 |
| AC-M1 (harness needs no Go toolchain) | FEH-04 |
| AC-M2 (real spawned process + real stdio) | FEH-04 |
| AC-M3 (spec→scenario coverage map, zero uncovered) | FEH-05 (V3: expected count 40 → 41; LED-01 is parsed into the universe but is NOT harness-scenario-exercised — see LED-01's coverage-vehicle note) |
| AC-TRACE (test fails on `BATCH_CAP_BYTES` drift) | FEH-06, WPS-06 |

### BA Scenarios SC-1..SC-9 → REQ

| Scenario | REQ(s) |
|---|---|
| SC-1 clean run end-to-end | EXC-01.1, SEC-03.1, FEH-01.1 |
| SC-2 greeting version mismatch | WPS-02.2, WPS-02.3 |
| SC-3 factory crash mid-run | EXC-02.1 |
| SC-4 oversized batch rejected before write | WPS-04.1 |
| SC-5 read of not-found path | SEC-06.1, SEC-05.1 |
| SC-6 stdout pollution isolated | SEC-09.1 |
| SC-7 partial/chunked frame reassembly | SEC-10.1, SEC-10.2 |
| SC-8 overlapping run | SEC-02.1 |
| SC-9 factory-pointer three failure forms | RUN-03.1, RUN-03.2, RUN-03.3 |

## Sensitive Areas Coverage

Flagged at triage: `security (IPC)` (the override that forced L) and `security (code
execution)` adjacency.

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (IPC) | WPS-01..11, SEC-01..10, BRB-01..03 | Yes |
| security (code execution) adjacency | RUN-02, RUN-03, RUN-05, RUN-06, RUN-07, RUN-08 | Yes |

## Drift Check Results

N/A — `spec_source = internal`, Step 9b skipped.

## Open Design Questions Carried Forward (not resolved by this spec)

- Read-loop ownership boundary (explore Open Question 1, owner ruling #3): whether `StdioEngineClient` does its own raw stdio I/O or receives already-framed callback injection from an engine-side dispatch loop. Every REQ above is written at the frame/behavior level precisely so it holds under either resolution — `sdd-design` picks the mechanism and writes the ADR.
- `StdioEngineClient`'s home directory (`src/core/` vs. `src/transport/`) and the corresponding FIT-10 allow-list extension — explore recommends `src/transport/`; the ADR is design's to write (proposal "Open for design").
- REQ-RUN-06's double-wrap detection mechanism (e.g. a brand marker on `defineFactory`'s return value) is explicitly deferred to design's ADR — V2 dropped the V1 arity-sniffing mechanism from the spec (M12) precisely to keep this open.
- ~~Concurrent-draft reconciliation~~ — **RESOLVED (V3)**: see the header Concurrency note. Canonical: this file's V2 (B1–B7/M1–M17/m1–m9). Discarded: the ghost "R1/R2" draft. Its one unique finding (`ContractFake.emit()`/`serializedBatchSize`) was carried into `design.md`'s cap single-source measurer. Audit trail: engram obs #2175, topic `sdd/stdio-engine-client/concurrent-spec-conflict`.

## Next Step

**(V3)** This is a delta amendment to a previously-signed spec (`unfreeze=true`). Surface to the
owner for DELTA re-signature (the V2-signed content is unchanged; only the three amended sections
— Concurrency note, REQ-LED-01, WPS-11.3 — are new review surface). Design, slice, and apply
artefacts already exist against V2 (`design.md`, `slices.md` S-005.1..5.4) and are NOT
invalidated by this amendment — `slices.md` S-005.4 already names the ledger-reconciliation
disposition table LED-01 now formalizes, and `design.md`/`slices.md` S-005.1/S-005.3 already
scope the normative wire-spec doc WPS-11.3 now pins. Once re-signed, resume at
`sdd-verify --mode=plan` iteration 2 per the orchestrator's routing plan (`verify-plan-1.md`).
