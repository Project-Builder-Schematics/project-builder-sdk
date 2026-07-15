# Engine ↔ SDK Wire Spec (Normative)

**Wire-spec version**: 1 (engine build target: PC-PROTO-01; matches `WIRE_PROTOCOL_VERSION`)
**Status**: normative — both repos build and conformance-test against this document, not
against `docs/engine-sdk-wire-design.md` (that file is now the historical decision record,
reconciled to rev 3 alongside this doc's creation — see its header).
**Reconciled against BUILT code**: `stdio-engine-client` (2026-07-15) — every shape below is
read directly off the shipped SDK code (`src/transport/**`, `src/core/wire.ts`), not proposed
from first principles. A value that drifts from here fails `fit-33`/`fit-34` at build/test
time, never a runtime desync (REQ-WPS-06/WPS-11).

This document exists because REQ-WPS-11 requires ONE normative text both repos build and
conformance-test against. It carries every section WPS-11.3 mandates: the frame grammar, the
`ready` handshake, the four reverse-callback method schemas, error shapes, the factory-pointer
grammar, the exit-code taxonomy, the bridge contract, and the frame-cap constant.

## Frame Grammar (WPS-01)

Every message — in both directions — travels as:

```
<4-byte big-endian length prefix><UTF-8 JSON body>
```

The prefix is the UTF-8 SERIALIZED byte length of the body — never the JS string's UTF-16
`.length` — so multi-byte payloads (e.g. non-ASCII characters) round-trip exactly. There is no
delimiter byte and no newline framing; the length prefix is the only frame boundary signal.
Single owner in the SDK: `src/transport/framing.ts`'s `encodeFrame`/`decodeFrameBody`.

## Ready Handshake (WPS-02)

The FIRST message the runner reads MUST be a structurally valid greeting:

```ts
interface ReadyGreeting {
  method: "ready";
  protocolVersion: number; // MUST be an integer
}
```

`protocolVersion` MUST equal `WIRE_PROTOCOL_VERSION = 1` EXACTLY — never a range or a `>=`
check. A structurally invalid greeting (missing `method`, non-integer `protocolVersion`, wrong
shape) or a version mismatch fails the run AT THE GREETING — exit 1, the error naming both the
expected and the received version — before any reverse callback is ever issued. This is the
mechanism WPS-11's "divergence cannot re-materialize silently" claim rests on: a stale-engine
build fails LOUDLY at first contact, never mid-run.

`WIRE_PROTOCOL_VERSION` (this handshake's version) is DISTINCT from `Batch.protocolVersion`
(the IR/emit envelope schema version carried inside `ir.emit`'s `params.batch` — see below);
the two are never conflated, and the greeting frame itself carries no IR-envelope version
field.

## Reverse-Callback Method Schemas (WPS-05, WPS-10)

The runner ISSUES requests; the host only ever RESPONDS — there is no host-issued request
method (WPS-09). The runner MUST NOT issue any method outside this closed set of four:

```ts
const REVERSE_CALLBACK_METHODS = ["tree.read", "ir.emit", "ir.commit", "ir.discard"] as const;

interface RequestFrame  { type: "request";  id: `s${number}`; method: ReverseMethod; params: unknown }
interface ResponseFrame { type: "response"; id: string; result?: unknown; error?: WireError }
```

| Method | Request `params` | Success `result` |
|---|---|---|
| `tree.read` | `{path: string}` — project-relative, never absolute | `null` (not-found) \| `{content: string}` (an empty file is `{content: ""}`, never conflated with not-found) |
| `ir.emit` | `{batch: Batch}` — `Batch.protocolVersion` is the IR/emit envelope schema version | `{appliedCount: number}` on full acceptance |
| `ir.commit` | `{}` — no additional params; scoped to the current single run | `{}` acknowledgment |
| `ir.discard` | `{}` — same scoping as `ir.commit` | `{}` acknowledgment |

Every SUCCESS response, for any of the four methods, uses the field name `result` — never
`error` for a success acknowledgment. Every REJECTION response uses the field name `error`.
Request IDs are runner-issued, `s`-prefixed (`s0`, `s1`, `s2`, ...); exactly ONE request is in
flight at a time (ADR-03, sequential single-in-flight) — there is no pending-ID map on the SDK
side.

## Error Shapes (WPS-08)

```ts
interface WireError {
  code: number;
  message: string;
  data?: EmitRejectionData; // present only for -32001 (ir.emit rejections)
}

interface EmitRejectionData {
  emitRejectionCode: "collision" | "not-found" | "unrepresentable" | "cap" | "unknown";
  failedIndex?: number;   // directive-level codes only: "collision", "not-found"
  appliedCount: number;
}
```

An `ir.emit` rejection MUST carry `error: {code: -32001, message, data: {emitRejectionCode,
failedIndex?, appliedCount}}` — a domain-classified rejection, distinguishable from the generic
transport codes already in use engine-side (`-32700` parse error, `-32601` unknown method,
`-32000` generic error). `ir.commit`/`ir.discard` rejections carry `error: {code, message}`
WITHOUT the `data` field — that field is `ir.emit`-specific.

`"unknown"` is a first-class, round-tripping member of `emitRejectionCode` — the documented
degrade target for an out-of-contract payload (an unrecognized code, a `failedIndex` present
alongside a batch-level code, or a negative/non-integer `failedIndex`). The SDK never invents a
code by parsing `message` text, and never crashes on a malformed rejection payload; a host that
explicitly sends `"unknown"` round-trips it like any other allowlisted code.

## Factory-Pointer Grammar (WPS-08)

```
<url>#<export>
```

`<url>` MUST be a `file:` URL with an EMPTY host component — checked BEFORE any dynamic
import, since a factory module's top-level code runs at import time (input validation after
import is not a containment control). `<export>` is an OPTIONAL fragment naming a non-default
export; an absent fragment (or an empty fragment) resolves to the module's default export. The
pointer splits on the FIRST `#` only.

## Exit-Code Taxonomy (EXC-01)

| Code | Meaning |
|---|---|
| 0 | success — the factory run completed and its intent was accepted |
| 1 | validation failure — bad argv, an invalid/mismatched greeting, a rejected factory pointer, a rejected export, a failed single-instance probe, an oversize/malformed `--input-file`, a factory module that fails to RESOLVE (`ERR_MODULE_NOT_FOUND` from the factory import — distinct from the module's own top-level code throwing during import, which is exit 4), or an `AuthoringError` whose `origin` **is** `"authoring-rejected"` (an SDK-side authoring misuse: `outside-run`, `invalid-input`, `reserved-name`, `source-*`) |
| 2 | emit-rejection — an `AuthoringError` whose `origin` is NOT `"authoring-rejected"` |
| 3 | transport fault — a `TransportFault` (`kind`: `malformed`, `desync` (reserved: currently indistinguishable from and reported as `malformed`), `oversize`, `timeout`, or `eof`) |
| 4 | crash — anything else: a non-`AuthoringError`/non-`TransportFault` thrown value, including the author's factory module throwing at its own top level during import |

Classification reads ONLY the terminal error's own identity (`instanceof` checks) — it NEVER
consults `.cause`. A double-fault (e.g. a `discard()` call that itself fails while unwinding
from an original error) preserves the ORIGINAL error's exit class; the double-fault attaches as
`.cause`, invisible to the classifier.

An overlapping run-entry invocation (`OverlappingRunError`, SEC-02 — a second `runRunner`/
`enterBridge` call while one is already in flight in this process) is explicitly OUTSIDE this
taxonomy: it rejects immediately, before the in-flight run's own try/catch is ever entered, and
produces no wire frame and no exit code of its own — there is nothing to send over the wire for
an attempt that never started.

## Bridge Contract (BRB-01)

```ts
const BRIDGE_CONTRACT_VERSION = 1; // in-process JS bridge — INDEPENDENT of WIRE_PROTOCOL_VERSION
```

The engine's embedded bootstrap dynamic-imports `bootstrap-bridge.ts` and calls
`enterBridge(expectedVersion, params, io)` exactly ONCE. A version mismatch rejects
IMMEDIATELY — naming both the expected and the installed bridge version — with no protection
armed and no factory-related code ever reached. On a match, the bridge arms the SAME fd-1
capture + console redirect the direct-spawn path gets (RUN-08), then hands `params` through the
SAME `RUN-01`..`RUN-04` gates the argv-spawn path uses — never a duplicated, weaker check. This
version is co-versioned with, but tracked INDEPENDENTLY of, `WIRE_PROTOCOL_VERSION` above — a
bridge-contract bump does not imply a wire-protocol bump, and vice versa.

The engine's bootstrap MUST reach `bootstrap-bridge.ts` via an absolute file-path dynamic
`import()` — never a bare package-specifier deep import (e.g. `@pbuilder/sdk/transport/bootstrap-bridge`)
— since the package's `exports` map (`package.json`) exposes no `./transport/*` subpath and such
an import fails closed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Frame-Cap Constant (WPS-06)

```ts
const BATCH_CAP_BYTES = 4194304; // 4 MiB
```

`BATCH_CAP_BYTES` (SDK, `src/core/wire.ts`) MUST equal the engine's `MaxMessageBytes` BY VALUE
— a shared cross-repo constant-naming contract, not merely a coincidental match. An inbound
frame declaring a length over this cap is rejected BEFORE allocation (reject-before-alloc); an
outbound `Batch` over this cap is rejected locally, never written to the wire. `fit-34`
(`FEH-06`) fails the SDK's own test suite the moment `src/core/wire.ts`'s exported value drifts
from the `4194304` literal pinned here — a build/test-time failure, never a runtime desync
against a live engine.

## Cross-Repo Build Target

Engine `PC-PROTO-01` MUST build against THIS wire-spec version (`1`) and
`docs/engine-sdk-wire-design.md` rev 3 — NOT rev 2 (rev 2 described NDJSON framing, a
single-initiator model, and a `session.init` handshake, all superseded — see that document's
`## Superseded (historical)` section). Conformance is measured by the Go side passing the same
wire vectors this repo's fake-engine harness already encodes (`test/fake/harness.test.ts` +
`test/fake/*.e2e.test.ts`) — a spawned-process, real-stdio proof requiring no Go toolchain on
the SDK side. Engine `MaxMessageBytes` MUST equal SDK `BATCH_CAP_BYTES` (`4194304`, 4 MiB) per
the Frame-Cap Constant clause above.
