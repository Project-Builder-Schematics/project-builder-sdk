# Design: stdio-engine-client

**Change**: `stdio-engine-client` | **Triage**: L | **Spec**: V2 (signed, owner 2026-07-15, 40 REQs)
**Persona lens**: architect (+ security, qa, tech-writer inputs) | **Status**: ok
**Architecture impact**: modifying

## 4.1 Architecture Overview

This builds the SDK half of the engine-integration seam: the first real `EngineClient`
(`StdioEngineClient`), the `pbuilder-runner` composition root, the in-process
bootstrap↔runner bridge, and a spawned-process conformance harness — all against the ratified
wire (length-prefix framing, host-initiated topology with 4 allowlisted reverse callbacks,
versioned `ready` fail-at-greeting). It reuses the existing seam wholesale: the `EngineClient`
port (`src/core/engine-client.ts`), `Session`, `DirectiveFactory`, `wire.ts`, `EmitRejection`,
and the normative `ContractFake` are unchanged in shape (D2). Four genuinely new mechanisms
land: a length-prefix frame codec + streaming reassembler, host-initiated reverse-callback
dispatch (first inversion of the single-initiator assumption), a dynamic-import bootstrap
bridge, and a streaming spawned-process harness.

**The seam it crosses** (Shape C, settled #1): the engine-embedded bootstrap owns boot, the
`ready` greeting, the security envelope, and the pre-import fd-1 dup; the SDK owns *everything
post-`ready`*. New home: `src/transport/` (a new leaf beside `core`, ADR-01), keeping `src/core`
pure and matching the ADR-0035 relocation precedent. The runner composition root lives in
`src/transport/` (not `bin/`) so BOTH entry paths — argv-spawn (`bin/pbuilder-runner.ts`) and
the in-process bridge — share ONE validation-gate chokepoint (FIT-15 bars `src/`→`bin/`, so the
shared root cannot live in `bin/`).

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/transport/framing.ts` | Create | Single owner of frame encode/decode: 4-byte BE length prefix + UTF-8 JSON body; reject-before-alloc cap check via `exceedsBatchCap`; captured-fd-1 writer (WPS-01/04) |
| `src/transport/frame-reader.ts` | Create | Streaming reassembler over raw stdin chunks → logical frames (split/coalesced/EOF-mid-frame, SEC-10); never byte-scans (SEC-08.2) |
| `src/transport/wire-protocol.ts` | Create | `WIRE_PROTOCOL_VERSION`, `BRIDGE_CONTRACT_VERSION` consts; `REVERSE_CALLBACK_METHODS` closed set; ready-greeting + frame-type guards (WPS-02/03/05/09) |
| `src/transport/stdio-engine-client.ts` | Create | `StdioEngineClient implements EngineClient`: reverse-callback dispatch, single pending slot, injectable timeout, EmitRejection mapping, WPS-03 routing, SEC-06/08 (SEC-01..10) |
| `src/transport/error-text.ts` | Create | WPS-07 bounded/no-echo/project-relative formatter (2000-char ceiling, 200-char token cap, `<outside-project>` fallback) |
| `src/transport/exit-codes.ts` | Create | EXC-01/02 terminal classifier: error shape → code 0–4; double-fault `.cause` preservation |
| `src/transport/factory-pointer.ts` | Create | `<url>#<export>` grammar (WPS-08), `file:`+empty-host allowlist (RUN-02), export resolution 3-form (RUN-03), double-wrap brand check (RUN-06), import-failure split (RUN-07) |
| `src/transport/single-instance-probe.ts` | Create | SEC-07 resolution-only realpath probe (`import.meta.resolve` + `createRequire` fallback), before-import (ADR-05) |
| `src/transport/runner.ts` | Create | Composition root: argv/param gates (RUN-01/04), `defineFactory` wrap `packageDir=dirname` (RUN-05), single-in-flight guard (SEC-02), fd-1/console capture (RUN-08), wires gates→exit codes |
| `src/transport/bootstrap-bridge.ts` | Create | Versioned in-process entry (BRB-01): version check, fd-1 capture (BRB-02), console redirect (BRB-03), hands params to `runner.ts` root |
| `bin/pbuilder-runner.ts` | Create | Thin argv entry: fd-1/console capture then `process.argv`→`runner.ts`. Provisional/unmapped (dist/bin, NO `package.json#bin`, ADR-06) |
| `src/core/wire.ts` | Modify | Add `serializedBatchBytes(batch)` + `exceedsBatchCap(batch)` single-source cap measurer; `serializedBatchSize` delegates (WPS-04/06) |
| `src/core/context.ts` | Modify | `defineFactory` stamps a non-enumerable brand marker on its returned wrapper (RUN-06 detection, ADR-04) |
| `src/testing/contract-fake.ts` | Modify | Route the emit cap check through `exceedsBatchCap` (single-source, FEH-01 parity) |
| `test/support/frame-host.ts` | Create | New async spawn + frame stdin/stdout helper; ready-greeting sync barrier; `afterEach` kill + bounded exit await (no streaming infra exists — `spawnCapture` is one-shot) |
| `test/fake/fake-engine-harness.ts` | Create | Transport shell over the ONE `ContractFake` — framing/dispatch only, zero re-implemented semantics (FEH-01/04) |
| `test/transport/*.unit.test.ts` | Create | Red-first units: framing, frame-reader, wire-protocol, error-text, exit-codes, factory-pointer, single-instance-probe, stdio-engine-client |
| `test/fake/harness.test.ts` | Create | FEH-01/02/03/05: parity vs ContractFake, shared-corpus `===`, spec-derived citation guard, spec-parsed coverage map + count tripwire |
| `test/fake/fake-engine-harness.e2e.test.ts` | Create | Walking-skeleton e2e (LAST): spawn runner → greeting → framed round-trip by-value → advisory commit → exit 0; adversarial matrix |
| `test/fitness/fit-{30..35}-*.test.ts` | Create | New fitness: stdout-sacred scan, single-owner-of-framing, cap-single-source, bridge-version pin, BATCH_CAP drift (FEH-06), sequential-guard (fit-35 — fit-29 is taken by the pre-existing sanctioned-definefactory-caller check) |
| `test/fitness/fit-10-engine-client-port-guard.test.ts` | Modify | Extend allow-list by EXACTLY one path (`src/transport/stdio-engine-client.ts`) with a red-proof update (ADR-01) |
| `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` | Modify | Extend `ALLOWLISTED_ROOTS` by EXACTLY one path (`src/transport/runner.ts`) so RUN-05's `defineFactory` wrap in the runner root is sanctioned, with a red-proof that an unrelated `src/transport/**` file is still flagged (ADR-07) |
| `docs/engine-sdk-wire-design.md` | Modify | rev 2 → rev 3 (WPS-11): NDJSON/single-initiator/`session.init` moved under superseded headings; header stamps wire-spec version |
| `docs/engine-sdk-wire-spec.md` | Create | Normative versioned wire spec: methods, error shapes, pointer grammar, cap-constant naming, exit codes, bridge-contract section (settled #7) |
| `openspec/pending-changes.md` | Modify | Promote StdioEngineClient row; add deferred Windows/macOS-pins + public-package-bin rows |
| `src/core/engine-client.ts` | Read-only | Port contract to implement unchanged (D2) |
| `src/core/session.ts` | Read-only | read-your-own-writes flush flow (SEC-06 context) |
| `src/core/emit-rejection.ts` | Read-only | `EmitRejection{code,failedIndex?,appliedCount}` mapping target |
| `src/core/authoring-error.ts` | Read-only | `toAuthoringError` classification the runner honors (EXC-01 code 1/2) |
| `test/fake/batch-cap-fixtures.ts` | Read-only | `batchOf/OverSerializedBytes` fixtures for WPS-04 |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Engine-spawned runner: bootstrap → `ready` → bridge handoff → factory run → 4 reverse callbacks → advisory commit → exit 0 | Create | WPS-01/02/05/09/10, BRB-01..03, SEC-01/03, EXC-01.1 | `test/fake/fake-engine-harness.e2e.test.ts` | the walking skeleton |
| Direct-spawn runner (argv entry, no bridge): fd-1 capture → argv/pointer gates → factory run → callbacks → exit | Create | RUN-01/02/03/08, EXC-01.2/.3 | `test/fake/fake-engine-harness.e2e.test.ts` (argv leg) | RUN-08 parity with bridge |
| Fake-engine conformance run: scripted host ↔ real spawned process over real stdio (no Go) | Create | FEH-01..06, WPS-04, SEC-08/09/10 | `test/fake/harness.test.ts` + `.e2e.test.ts` | adversarial matrix vehicle |
| In-process author loop (`runFactoryForTest` + `ContractFake`) | Read-only | SEC-01 parity | existing `test/e2e/*` | parity target (FIT-18), unchanged |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/transport/` (new leaf) | new | first real `EngineClient` + framing + runner root; a top-level structure the baseline lacks | deviates → ADR-01 |
| `test/fitness/fit-10` port allow-list | modify | +1 path (`stdio-engine-client.ts`) — the guarded boundary changes | deviates → ADR-01 |
| `test/fitness/fit-29` defineFactory allow-list | modify | +1 path (`runner.ts`) — the sanctioned-`defineFactory`-caller boundary admits the runner root (RUN-05) | deviates → ADR-07 |
| `src/core/engine-client.ts` (port) | none | D2: port shape survives; callbacks map onto the 4 methods | aligns |
| `src/core/wire.ts` | extend | single-source cap measurer beside `BATCH_CAP_BYTES` | aligns |
| `src/core/context.ts` (`defineFactory`) | modify | non-enumerable brand marker on returned wrapper (additive) | aligns → ADR-04 |
| `src/testing/contract-fake.ts` | extend | cap check via shared measurer | aligns |
| `bin/` (build-time tooling) | extend | 2nd bin sibling of `pbuilder-codegen.ts`, provisional-unmapped | aligns → ADR-06 |
| commit/discard as advisory-over-wire | modify (semantic) | ADR-0015 amendment; NO code change to the choreography | aligns → ADR-03 |
| `docs/engine-sdk-wire-design.md` | modify | rev 3 (doc header mandates it) | aligns |

## 4.3 Data Model

```ts
// src/transport/wire-protocol.ts
export const WIRE_PROTOCOL_VERSION = 1;      // ready.protocolVersion (transport) — DISTINCT from Batch.protocolVersion (IR)
export const BRIDGE_CONTRACT_VERSION = 1;    // in-process JS bridge; independent of the wire (BRB-01)
export const REVERSE_CALLBACK_METHODS = ["tree.read", "ir.emit", "ir.commit", "ir.discard"] as const;
type ReverseMethod = (typeof REVERSE_CALLBACK_METHODS)[number];

interface ReadyGreeting { method: "ready"; protocolVersion: number }        // no type, no id (WPS-02)
interface RequestFrame  { type: "request";  id: `s${number}`; method: ReverseMethod; params: unknown }
interface ResponseFrame { type: "response"; id: string; result?: unknown; error?: WireError }
interface WireError { code: number; message: string; data?: EmitRejectionData }  // -32001 → data (WPS-08)
interface EmitRejectionData { emitRejectionCode: "collision"|"not-found"|"unrepresentable"|"cap"|"unknown"; failedIndex?: number; appliedCount: number }

// src/core/wire.ts (additions)
export function serializedBatchBytes(batch: Batch): number;   // JSON.stringify + Buffer.byteLength(utf8)
export function exceedsBatchCap(batch: Batch): boolean;       // serializedBatchBytes(batch) > BATCH_CAP_BYTES  (single source)

// src/transport/stdio-engine-client.ts
class StdioEngineClient implements EngineClient {
  constructor(io: FrameChannel, opts?: { timeoutMs?: number });   // timeoutMs default 30_000 (SEC-05)
  emit(batch: Batch): Promise<void>;  read(path: string): Promise<string | undefined>;
  commit(): Promise<void>;  discard(): Promise<void>;
}
class OverlappingRunError extends Error {}   // SEC-02 stable identity
class IntentRejectedError extends Error {}   // SEC-03 stable identity (distinct from EmitRejection)
class TransportFault extends Error { readonly kind: "malformed"|"desync"|"oversize"|"timeout"|"eof" }  // SEC-05/08/10
```

No persistence, no schema, no DB. `EmitRejection`/`AuthoringError`/`Batch`/`Directive` unchanged.

## 4.4 Interface Contracts

- **Reverse-callback wire shapes** (WPS-10): `tree.read {path}` → `null` | `{content}`;
  `ir.emit {batch}` → `{appliedCount}` | `error{-32001,data}`; `ir.commit {}`/`ir.discard {}` →
  `{}` ack | `error{code,message}`. IDs runner-issued `s`-prefixed; single in-flight (SEC-02).
- **`pbuilder-runner` argv** (RUN-01): `--factory <url>#<export>` (required) XOR `--input <json>`/
  `--input-file <path>` (exactly one). Unknown flag → exit 1. Exit taxonomy EXC-01: 0 success,
  1 validation, 2 emit-rejection, 3 transport-fault, 4 crash.
- **Bridge entry** (BRB-01): stable versioned in-process export the engine bootstrap imports;
  params traverse the SAME RUN-01..04 gates as argv. No `runFactory` wire request exists (WPS-09).
- **Error taxonomy the caller sees**: `EmitRejection` (emit), `IntentRejectedError` (commit/
  discard), `OverlappingRunError` (reentrancy), `TransportFault{kind}` (wire). All settle once (SEC-01).

## 4.5 Architecture Decisions

### ADR-01: Transport home `src/transport/` + FIT-10 allow-list +1 [NEW]
**Status**: Proposed. **Context**: `StdioEngineClient` is the first real `EngineClient`; FIT-10
guards the port with a one-entry path allow-list ("the one legitimate implementer"), framed as
guarding a spoofable structural shortcut, not one more reviewed path. `src/core/` placement is
zero-churn but reverses ADR-0035 (which relocated `ContractFake` out of core-adjacent code).
**Decision**: land the transport cluster in a new `src/transport/` leaf; extend FIT-10's
allow-list by EXACTLY one path (`src/transport/stdio-engine-client.ts`) with a red-proof update
proving the widened list still catches an unrelated bleed. **Consequences**: +keeps `src/core`
pure, transport independently testable; −a new top-level dir + a reviewed guard edit (deviates,
triggers post-build baseline refresh). Enables the engine-integration seam to grow without
polluting choreography. **Alternatives**: `src/core/` (reverses ADR-0035, hides transport beside
pure choreography); structural `implements` exemption (rejected upstream as spoofable).

### ADR-02: SDK owns the raw stdio read loop post-`ready` (single reader) [NEW — resolves explore OQ1]
**Status**: Proposed. **Context**: explore OQ1 left the read-loop boundary open — does
`StdioEngineClient` do its own stdio I/O, or receive already-framed callbacks injected by the
engine? rev-2 of the wire doc rejected engine-initiated bidirectionality. **Decision**: under
Shape C (settled #1) the SDK owns everything post-`ready`; `frame-reader.ts` owns the single
async reader over fd 0 and `framing.ts` owns the single writer over the captured fd 1. The
engine bootstrap hands off in-process (bridge) and does NOT remain an in-process framing
intermediary. **Honest reversal note**: rev-2's rejection of engine-initiated bidirectionality
no longer holds because the adjudication inverted trust — the host is now the trusted initiator
and the runner issues only 4 *allowlisted* reverse callbacks (WPS-05), a gated inversion, not
open bidirectionality. **Consequences**: +one reader, structural attribution (SEC-08); −the SDK
must own reassembly (SEC-10). **Alternatives**: engine-injected framed callbacks (re-couples the
in-process boundary the bridge just cleanly severed).

### ADR-03: Sequential single-in-flight, single pending slot, no pending-map [RATIFIES settled #2]
**Status**: Proposed. **Context**: the Go host keeps an ID-keyed pending map for *host*
concurrency (sidecar.go); the runner runs exactly one factory (WPS-09) and the engine sidecar
skeleton blocks per callback (sidecar.ts:80-104). **Decision**: one pending slot per reverse
callback; a second run-entry invocation rejects immediately with `OverlappingRunError` (SEC-02),
first run unaffected; commit/discard are advisory intents the engine owns (ADR-0015 amendment,
no choreography code change). **Consequences**: +no map, fail-loud overlap; −no host-side
pipelining (out of scope). **Alternatives**: ID-keyed pending map (unneeded complexity for a
single-run process; contradicts the sequential wire clause).

### ADR-04: Double-wrap detection via brand marker on `defineFactory`'s return [NEW]
**Status**: Proposed. **Context**: RUN-06 requires rejecting an already-`defineFactory`-wrapped
export; V2 dropped V1's arity-sniffing (an arity-2 bare factory would misclassify, RUN-06.2).
**Decision**: `defineFactory` stamps a non-enumerable, non-configurable brand symbol on its
returned wrapper; the runner rejects at load if the resolved export carries it. **Consequences**:
+arity-independent, robust; −a tiny surface addition to `context.ts` (invisible to callers).
**Alternatives**: arity-sniffing (spec rejected it, M12); `instanceof` (wrapper is a plain
closure, not a class); `.toString()` scan (brittle, minifier-fragile).

### ADR-05: Single-instance probe = resolution-only realpath, before import [NEW]
**Status**: Proposed. **Context**: SEC-07 needs to compare the runner's `@pbuilder/sdk` realpath
against the factory's resolved copy WITHOUT executing factory top-level code, before import, to
protect the module-level ALS pin (`context.ts:74` `als` singleton). **Decision**:
`import.meta.resolve(factoryUrl-anchored "@pbuilder/sdk")` + `fs.realpathSync`, compared to the
runner's own resolved realpath; **fallback** `module.createRequire(factoryUrl).resolve(...)` if
Bun's `import.meta.resolve` semantics prove unavailable. **Design assumption**: Bun exposes a
resolve-without-execute path; unverifiable from this repo, so the fallback is designed in, not
guessed. **Consequences**: +no author code runs on split (prevents outside-run on first verb);
−realpath is a syscall at handshake. **Alternatives**: import-then-compare (runs author code —
defeats the control); trusting a version string (not a same-instance guarantee).

### ADR-06: Provisional unmapped runner bin (dist/bin, no `package.json#bin`) [RATIFIES settled #4]
**Status**: Proposed. **Context**: the runner ships in `dist/` but is engine-spawned/bridge-
imported, not a user CLI; a public `#bin` entry is a public-package concern. **Decision**:
build to `dist/bin/pbuilder-runner.js`, add NO `package.json#bin` entry, leave FIT-14 (package-
surface baseline) untouched; register the `#bin` at the public-package plan. **Consequences**:
+no premature public surface, FIT-14 stable; −the bin is reachable only by path until then.
**Alternatives**: add `#bin` now (churns FIT-14, exposes an unstable CLI pre-1.0).

### ADR-07: Runner root is a sanctioned `defineFactory` caller — FIT-29 allow-list +1 [AMENDMENT — resolves the S-000.7 `architectural-conflict`]
**Status**: Proposed. **Context**: RUN-05 requires the runner composition root — `src/transport/runner.ts`
per ADR-01 — to wrap the resolved bare factory using the internal `defineFactory`. The pre-existing
production fitness `fit-29` confines `defineFactory`-binding imports to `ALLOWLISTED_ROOTS = [src/core,
src/testing, src/conformance]` (scan surface `src/**` + `bin/**`), so `runner.ts` importing `defineFactory`
is flagged as unsanctioned. This is NOT a re-open of the plan-verify iter-2 "fit-29 untouched" ruling —
that resolved a fitness-NUMBERING collision only; the pre-existing guard blocking RUN-05's specified path
was never adjudicated. `context.ts`'s own `@internal` note already names "the future production runner" as
a legitimate wrapper of this seam (`context.ts:262-265`); `runner.ts` IS that runner. **Decision**: extend
`fit-29`'s `ALLOWLISTED_ROOTS` by EXACTLY one path — the FILE `src/transport/runner.ts` (not the whole
`src/transport/` dir) — mirroring ADR-01's FIT-10 +1 treatment, with a red-proof that a planted
`defineFactory` import from an unrelated transport file (`src/transport/framing.ts`) is STILL flagged.
`runner.ts` imports `defineFactory` directly from `../core/context.ts` — the established sanctioned-caller
idiom (`src/testing/index.ts`, `src/conformance/index.ts` both import it that way, fit-29 positive
controls), never through the barrel. **Consequences**: +honors fit-29's intent (defineFactory stays
confined to NAMED sanctioned callers; every other transport file is still scanned); +reuses a ratified,
already-executed mechanism (S-000.5 did the identical FIT-10 +1); +zero `src/core` churn (no collision with
S-002's `context.ts` brand-marker edit); −one more reviewed guard edit (deviates, already within this
change's `modifying` impact). The single-file entry survives fit-29's own non-vacuity guard (`src/commons/index.ts`
stays in the scan set). **Alternatives**: a `src/core/`-resident wrapper the runner calls (rejected — pushes
production-runner composition into `src/core/`, reversing ADR-01's core-purity rationale and colliding with
S-002's `context.ts` edits; an indirection existing only to dodge a fitness check, adding a core export absent
from §4.3); relocate `runner.ts` into `src/core/` (rejected — directly reverses ADR-01).

## 4.6 Test Derivation (outside-in)

Every REQ-ID covered; multi-scenario REQs noted in-cell, grouped by family/vehicle.

| REQ-ID | Scenario(s) | Level | Test | Flow ref |
|---|---|---|---|---|
| WPS-01 (.1/.2/.3) | round-trip, newline-intact, UTF-8 byte-count | unit | `test/transport/framing.unit.test.ts` | — |
| WPS-02 (.1/.2/.3) | match / mismatch / malformed greeting | unit | `test/transport/wire-protocol.unit.test.ts` | — |
| WPS-03 (.1/.2/.3) | unknown-type discard, stale-ID discard, liveness | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| WPS-04 (.1/.2/.3/.4) | oversize out/in, exact-cap boundary, signed-read `0x80000000` | unit | `test/transport/framing.unit.test.ts` | — |
| WPS-05 (.1) | only 4 methods issued | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| WPS-06 (.1) | cap named==valued | architectural | `test/fitness/fit-34-batch-cap-drift.test.ts` (FEH-06) | — |
| WPS-07 (.1/.2/.3) | bounded, outside-root `../`/`<outside-project>`, token cap | unit | `test/transport/error-text.unit.test.ts` | — |
| WPS-08 (.1/.2/.3) | pointer grammar, rejection round-trip, `unknown` | unit | `test/transport/factory-pointer.unit.test.ts` | — |
| WPS-09 (.1/.2) | only reverse traffic, host request discarded | integration | `test/fake/harness.test.ts` | skeleton |
| WPS-10 (.1/.2/.3) | tree.read params, ir.emit batch pv, ack uses `result` | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| WPS-11 (.1/.2) | zero live superseded refs, header stamp | architectural | `test/fitness/fit-31-single-owner-framing.test.ts` (doc-scan leg) | — |
| EXC-01 (.1/.2/.3) | exit 0; 4-class 1/2/3/4; 3 handshake→1 | integration | `test/fake/fake-engine-harness.e2e.test.ts` | skeleton |
| EXC-02 (.1) | crash + failed discard → E1 class, `.cause` | unit | `test/transport/exit-codes.unit.test.ts` | — |
| RUN-01 (.1/.2/.3) | both-input, unknown-flag, neither-input | unit | `test/transport/runner.unit.test.ts` | — |
| RUN-02 (.1/.2/.3) | file empty-host ok, non-file rejected, non-empty-host rejected pre-import | unit | `test/transport/factory-pointer.unit.test.ts` | — |
| RUN-03 (.1/.2/.3) | missing default / named / non-function | unit | `test/transport/factory-pointer.unit.test.ts` | — |
| RUN-04 (.1/.2) | oversize input-file, malformed JSON line/col | unit | `test/transport/runner.unit.test.ts` | — |
| RUN-05 (.1) | wrapped behavior == packageDir runFactoryForTest | integration | `test/transport/runner.integration.test.ts` | — |
| RUN-05 (sanction) | runner root is an allowlisted `defineFactory` caller; unrelated transport file still flagged | architectural | `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` (ADR-07 +1 + red-proof) | — |
| RUN-06 (.1/.2) | already-wrapped rejected, arity-2 bare NOT misclassified | unit | `test/transport/factory-pointer.unit.test.ts` | — |
| RUN-07 (.1/.2) | module-not-found→1, author top-level throw→4 | unit | `test/transport/runner.unit.test.ts` | — |
| RUN-08 (.1/.2) | direct-spawn fd-1/console before import, author reassign no hijack | e2e | `test/fake/fake-engine-harness.e2e.test.ts` (argv leg) | direct-spawn |
| BRB-01 (.1/.2/.3) | match handoff, mismatch loud, bridge params traverse gates | integration | `test/transport/runner.integration.test.ts` | skeleton |
| BRB-02 (.1) | author reassign process.stdout no hijack | e2e | `test/fake/fake-engine-harness.e2e.test.ts` | skeleton |
| BRB-03 (.1) | console.log never reaches wire | e2e | `test/fake/fake-engine-harness.e2e.test.ts` | skeleton |
| SEC-01 (.1) | port conformance, settles once | unit+type | `test/transport/stdio-engine-client.unit.test.ts` + `test/types/*` | — |
| SEC-02 (.1) | overlapping run rejected, first unaffected | unit | `test/transport/runner.unit.test.ts` | — |
| SEC-03 (.1/.2) | commit ack, intent rejection stable identity | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| SEC-04 (.1/.2/.3) | directive-level idx, batch-level none, degrade `unknown` | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| SEC-05 (.1/.2) | hung timeout→3, slow-success no stray reject | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| SEC-06 (.1/.2) | null→undefined, `{content:""}`→"" | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| SEC-07 (.1/.2/.3) | match proceed, split fail project-relative, resolution-only before import | unit | `test/transport/single-instance-probe.unit.test.ts` | — |
| SEC-08 (.1/.2/.3) | malformed JSON structural, no byte-scan, EOF prompt | unit | `test/transport/stdio-engine-client.unit.test.ts` | — |
| SEC-09 (.1) | author stdout/console zero non-frame bytes | e2e | `test/fake/fake-engine-harness.e2e.test.ts` | skeleton |
| SEC-10 (.1/.2/.3/.4/.5) | split-prefix/payload, coalesced x2, complete+partial, EOF-mid | unit | `test/transport/frame-reader.unit.test.ts` | — |
| FEH-01 (.1/.2) | parity, structural no-reimpl guard | integration+arch | `test/fake/harness.test.ts` | conformance |
| FEH-02 (.1/.2) | one corpus two runners, `===` identity | architectural | `test/fake/harness.test.ts` | conformance |
| FEH-03 (.1/.2) | every scenario cites real REQ, post-archive path | architectural | `test/fake/harness.test.ts` | conformance |
| FEH-04 (.1) | runs without Go | integration | `test/fake/harness.test.ts` | conformance |
| FEH-05 (.1/.2) | zero uncovered, count-drift tripwire | architectural | `test/fake/harness.test.ts` | conformance |
| FEH-06 (.1) | BATCH_CAP drift fails | architectural | `test/fitness/fit-34-batch-cap-drift.test.ts` | — |

Every Create/Modify flow (4.2b) has ≥1 e2e row (skeleton, direct-spawn, conformance).

## 4.7 Fitness Functions

- **stdout-protocol-sacred** (`fit-30`): static scan — no `console.log`/`process.stdout.write` in
  `src/transport/**` runtime path except `framing.ts`'s single captured-fd-1 writer (red-proof).
- **single-owner-of-framing** (`fit-31`): only `framing.ts` encodes/decodes the length prefix;
  also the WPS-11 doc-scan leg (zero live NDJSON/`single-initiator`/`session.init` outside
  superseded sections; header stamps `WIRE_PROTOCOL_VERSION`).
- **cap-single-source** (`fit-32`): `BATCH_CAP_BYTES` imported from `wire.ts`, never a numeric
  literal, across transport + fake + harness; the `> cap` comparison lives only in `exceedsBatchCap`.
- **bridge-version pin** (`fit-33`): `BRIDGE_CONTRACT_VERSION` asserted against the value declared
  in the wire-spec doc's bridge section (co-versioned, settled #7); distinct from
  `WIRE_PROTOCOL_VERSION` (BRB-01 independence honored — the pin is doc-declared, not numeric equality).
- **sequential-model fail-loud** (`fit-35` + unit): a 2nd run-entry invocation rejects `OverlappingRunError`
  with the first run intact (SEC-02). (fit-35, not fit-29: `fit-29-sanctioned-definefactory-caller.test.ts`
  pre-exists — collision resolved at plan-verify iteration 2.)
- **FIT-10 allow-list +1** (modified): red-proof that the widened list still catches an unrelated bleed.
- **FIT-29 allow-list +1** (`fit-29`, modified, ADR-07): `ALLOWLISTED_ROOTS` gains EXACTLY the file
  `src/transport/runner.ts` so RUN-05's `defineFactory` wrap in the runner root is sanctioned; red-proof
  that a planted `defineFactory` import from an unrelated `src/transport/**` file (`framing.ts`) is still
  flagged (single-file entry, not a dir widening — the non-vacuity guard on `src/commons/index.ts` stays intact).
- **BATCH_CAP drift** (`fit-34`, FEH-06/WPS-06): SDK `BATCH_CAP_BYTES` == doc literal `4194304`.

## 4.8 Migration / Rollout

Purely additive — no DB, no data, no runtime consumer yet (the engine ships S5 in its own cycle).
Rollback: `git revert` deletes the new bin/client/harness/helper, restores rev-2 doc, reverts
the FIT-10 +1 line and ledger edits. **Doc rev-3 deliverable** (WPS-11, migration-plan item):
rewrite `docs/engine-sdk-wire-design.md` — the three reversed decisions (NDJSON→length-prefix,
single-initiator→host-initiated+4 callbacks, `session.init`→versioned `ready`) move under
explicit `## Superseded (historical)` headings with `> Superseded by rev 3` notes; the header
stamps `wire-spec version: 1` naming the engine build target. Post-verify: refresh the
architecture baseline (`src/transport/` new leaf, modifying impact) and re-run `/sdd-init
force=true` to raise the IPC sensitive-area confidence from `low`.

## 4.9 Performance Considerations

One syscall realpath at handshake (SEC-07); single reader loop, no polling; framing is O(n) over
payload bytes with reject-before-alloc bounding memory to `BATCH_CAP_BYTES`. Timeout default
30 000 ms (injectable) prevents unbounded hangs. No hot path — a run is one factory execution.

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: derived from 4.2c — the new `src/transport/` leaf is a structure the baseline
lacks (deviates → ADR-01) and the FIT-10 guarded boundary is modified (deviates → ADR-01);
existing layers (`core` port, `wire`, `context`, `testing`) are only extended/aligned and the
`EngineClient` port shape is unchanged (D2). No documented boundary is removed and the layered
IR-seam pattern survives (reverse callbacks are a new *realization* of the existing port, not a
pattern replacement) — hence modifying, not breaking. Triggers `arch_refresh_post_verify`.

## 4.11 Open Questions

None.
