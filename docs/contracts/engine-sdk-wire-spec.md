# Engine ↔ SDK Wire Spec (Normative)

**Wire-spec version**: 1 (engine build target: PC-PROTO-01; matches `WIRE_PROTOCOL_VERSION`)
**Status**: normative — both repos build and conformance-test against this document, not
against `docs/contracts/engine-sdk-wire-design.md` (that file is now the historical decision record,
reconciled to rev 3 alongside this doc's creation — see its header).
**Reconciled against BUILT code**: `stdio-engine-client` (2026-07-15) — every shape below is
read directly off the shipped SDK code (`src/acl/irwire/**`, `src/shared-kernel/**`, `src/bounded-contexts/authoring/domain/valueobjects/wire.ts`), not proposed
from first principles. A value that drifts from here fails `fit-33`/`fit-34` at build/test
time, never a runtime desync (REQ-WPS-06/WPS-11).

This document exists because REQ-WPS-11 requires ONE normative text both repos build and
conformance-test against. It carries every section WPS-11.3 mandates: the frame grammar, the
`ready` handshake, the five reverse-callback method schemas, error shapes, the factory-pointer
grammar, the exit-code taxonomy, the bridge contract, and the frame-cap constant.

## Frame Grammar (WPS-01)

Every message — in both directions — travels as:

```
<4-byte big-endian length prefix><UTF-8 JSON body>
```

The prefix is the UTF-8 SERIALIZED byte length of the body — never the JS string's UTF-16
`.length` — so multi-byte payloads (e.g. non-ASCII characters) round-trip exactly. There is no
delimiter byte and no newline framing; the length prefix is the only frame boundary signal.
Single owner in the SDK: `src/shared-kernel/framing.ts`'s `encodeFrame`/`decodeFrameBody`.

Fault posture on a received frame: a body that fails to parse as JSON rejects the ONE pending
call (classified `malformed`) but does NOT tear the connection down — the body's boundary was
known from the prefix, the stream stays aligned, and subsequent calls proceed normally. An
oversize declared length and an EOF mid-frame are FATAL (fail-closed): no resynchronization is
ever attempted, and the reader never byte-scans for a plausible next boundary.

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

The runner waits at most 30 000 ms for the greeting (`GREETING_TIMEOUT_MS`, overridable through
`RunnerIo.greetingTimeoutMs`). A host that sends nothing in that time, and a host that closes
stdin before sending any frame, fail the run with exit 3, a transport fault: the host is hung or
gone, which is not a validation failure. Their stderr notes are plain text, without the
`pbuilder-runner: ` sentinel, so the engine classifies them by the exit code:
`the host never sent {method:"ready"} within <ms> ms; …` and
`the host closed stdin before sending {method:"ready"}; …`.

`WIRE_PROTOCOL_VERSION` (this handshake's version) is DISTINCT from `Batch.protocolVersion`
(the IR/emit envelope schema version carried inside `ir.emit`'s `params.batch` — see below);
the two are never conflated, and the greeting frame itself carries no IR-envelope version
field.

## Reverse-Callback Method Schemas (WPS-05, WPS-10)

The runner ISSUES requests; the host only ever RESPONDS — there is no host-issued request
method (WPS-09). The runner MUST NOT issue any method outside this closed set of five:

```ts
const REVERSE_CALLBACK_METHODS = ["tree.read", "tree.list", "ir.emit", "ir.commit", "ir.discard"] as const;

interface RequestFrame  { type: "request";  id: `s${number}`; method: ReverseMethod; params: unknown }
interface ResponseFrame { type: "response"; id: string; result?: unknown; error?: WireError }
```

| Method | Request `params` | Success `result` |
|---|---|---|
| `tree.read` | `{path: string}` — project-relative, never absolute | `null` (not-found) \| `{content: string}` (an empty file is `{content: ""}`, never conflated with not-found) |
| `tree.list` | `{pattern: string, ignore?: string[]}` — `*`, `?`, `**` and `{a,b}` match, every other character is literal (E-37); every `{a,b}` alternative passes the containment gate, and an escape is rejected `-32000 "path escapes workspace"` | `{paths: string[]}`: the files a `tree.read` of the same Run can open, sorted bytewise, `[]` when none matches; symbolic links are never listed (engine ADR-0070) |
| `ir.emit` | `{batch: Batch}` — `Batch.protocolVersion` is the IR/emit envelope schema version | `{appliedCount: number}` on full acceptance |
| `ir.commit` | `{}`, or `{result: <JSON>}` when the factory declares a Result (A-14); scoped to the current single run | `{}` acknowledgment |
| `ir.discard` | `{}` — same scoping as `ir.commit` | `{}` acknowledgment |

`ir.commit` carries the root factory's Result (A-14, E-39) in an optional `result` key. The key
is present only when the factory's `schema.json` declares a Result, and then holds the Result the
SDK validated at the factory boundary, so a declared `null` is sent as `"result": null`. A factory
that declares no Result sends `{}`, with no `result` key, as before. The SDK checks before sending
that the Result's JSON encoding is at most 1 MiB (1048576 bytes, E-40); the engine checks it again
on arrival. An invalid or oversized Result never reaches the wire: the factory fails with an
`AuthoringError` whose reason is `invalid-result` (exit 1), and the run discards. The field is
additive, so `WIRE_PROTOCOL_VERSION` is unchanged.

Every SUCCESS response, for any of the five methods, uses the field name `result` — never
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

## Declared Dialects (`--dialects`, A-16 / CA-5 / CA-18)

`--dialects <json>` is optional: a JSON array of the author-defined dialects the Frame's library
declares. An absent flag means none is declared. Each entry is one of:

- `{name, version, root}`, a published dialect: `root` is the absolute path of the copy the Lock
  pins. `version` is carried, not checked.
- `{kind: "local", name, root, path}`, a local dialect (CA-18): `name` is the key of its
  declaration, `root` the absolute path of the folder whose hash the engine checked against the
  Lock, and `path` the absolute path of its base file.

Every field is a non-empty string. Any other shape, an unknown `kind` included, fails as bad argv
(exit 1) with fixed text that never echoes the value.

Before the factory import, at the same point as the single-instance probe, the runner checks
each entry, resolution-only:

- A published dialect's `name` is resolved from the factory's location, and its real path must
  sit inside the real path of `root`. Otherwise the runner exits 1 with `the factory does not
  start because the dialect "<name>" resolves outside the package the Lock pins`.
- A local dialect's name is no specifier, so the real path of `path` must sit inside the real
  path of `root` instead. Otherwise the runner exits 1 with `the factory does not start because
  the dialect "<name>" resolves outside the folder of its base file`.

No file changes in either case. This keeps the dialect that runs the one the Lock records (A-4);
it is no security boundary. The runner then passes the declared names to the run: a handle of
any other author-defined dialect fails the factory when it ends, naming the dialect, and nothing
is written (exit 4, as every dialect rejection). The bridge carries the same list as
`BridgeParams.dialects` and converts it to the same flag.

## Root Role and Name (`--role`, `--name`, CA-19)

`--role <role>` and `--name <collection:schematic>` are optional, and the engine passes each as
its own argv element, only to the runner of the root Frame and only when it has a value. They are
the role the root's Collection definition entry declares and the qualified name the request
addressed the root by, an alias included, as Launch handed them to the Run. The engine never reads
them.

`--role evaluation` without `--name` fails as bad argv (exit 1) before the handshake. The runner
hands both to the run: with the role `evaluation` the factory returns its Findings and each
finding's `source` is set to `--name` (A-120, A-121). Without `--role`, or with any other role,
the factory runs as a generator. The SDK decides nothing about whether a Frame is read-only
(E-24). The bridge carries the same values as
`BridgeParams.role` and `BridgeParams.name` and converts them to the same flags.

## Exit-Code Taxonomy (EXC-01)

| Code | Meaning |
|---|---|
| 0 | success — the factory run completed and its intent was accepted |
| 1 | validation failure — bad argv, an invalid/mismatched greeting, a bridge contract version mismatch (`BridgeVersionMismatchError`, BRB-01.2), a rejected factory pointer, a rejected export, a failed single-instance probe, a malformed `--dialects`, `--role evaluation` without `--name`, a declared dialect resolving outside its pinned `root`, or a local dialect's base file outside its folder, an oversize/malformed `--input-file`, a factory module that cannot be FOUND OR LOADED (`ERR_MODULE_NOT_FOUND`, Bun's `ResolveMessage`/`BuildMessage` shapes, or a `SyntaxError` from the factory import — a module that never RAN, distinct from the module's own top-level code throwing during import, which is exit 4), or an `AuthoringError` whose `origin` **is** `"authoring-rejected"` (an SDK-side authoring misuse: `outside-session`, `invalid-input`, `reserved-name`, `invalid-result`, `source-*`) |
| 2 | emit-rejection / host refusal — an `AuthoringError` whose `origin` is NOT `"authoring-rejected"`, or an `IntentRejectedError` (the host answered `ir.commit`/`ir.discard`/`tree.read` with an error envelope); the host's own rejection message surfaces in the runner's bounded stderr note |
| 3 | transport fault — a `TransportFault` (`kind`: `malformed`, `desync` (reserved: currently indistinguishable from and reported as `malformed`), `oversize`, `timeout`, or `eof`), including one at GREETING time (a malformed/oversize/EOF-truncated first frame), no greeting within `GREETING_TIMEOUT_MS`, or stdin closed before any frame |
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

The engine does not use the bridge today: it always spawns `dist/bin/pbuilder-runner.js` as a
subprocess and reads no other SDK path besides `dist/runner-manifest.json` and `package.json`.
The bridge is the contract for an in-process host. Such a host's bootstrap dynamic-imports
`bootstrap-bridge.ts` and calls `enterBridge(expectedVersion, params, io)` exactly ONCE per run. The SDK TOLERATES sequential
re-entry within one engine process (the fd-1 capture is idempotent — the first capture's real
write handle is cached and reused). A read still parked when a run ends, after a timed-out
call for example, never takes a later run's bytes: `FrameReader` reads each source through
one shared puller, so at most one read is outstanding, and the runner closes its reader at run
end, so the parked read's chunk goes to the next run's reader
([#167](https://github.com/Project-Builder-Schematics/project-builder-sdk/issues/167)). A version mismatch
rejects IMMEDIATELY — naming both the expected and the installed bridge version — with no
protection armed and no factory-related code ever reached. On a match, the bridge arms the SAME fd-1
capture + console redirect the direct-spawn path gets (RUN-08), then hands `params` through the
SAME `RUN-01`..`RUN-04` gates the argv-spawn path uses — never a duplicated, weaker check. This
version is co-versioned with, but tracked INDEPENDENTLY of, `WIRE_PROTOCOL_VERSION` above — a
bridge-contract bump does not imply a wire-protocol bump, and vice versa.

An in-process host MUST reach `bootstrap-bridge.ts` via an absolute file-path dynamic
`import()` — never a bare package-specifier deep import (e.g.
`@pbuilder/sdk/bounded-contexts/runner-hosting/infrastructure/in/bootstrap-bridge`) — since the
package's `exports` map (`package.json`) exposes no such subpath and that import fails closed
with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The file's location under `dist/` is not a contract: it
moved in 0.15.0, so a host must not hard-code it.

## Frame-Cap Constant (WPS-06)

```ts
const BATCH_CAP_BYTES = 4194304; // 4 MiB — the frame-body cap, both legs
const EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES = 82; // fixed ir.emit envelope allowance
const EMIT_BATCH_BUDGET_BYTES = BATCH_CAP_BYTES - EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES; // 4194222
```

`BATCH_CAP_BYTES` (SDK, `src/shared-kernel/batch-cap.ts`) MUST equal the engine's `MaxMessageBytes` BY VALUE
— a shared cross-repo constant-naming contract, not merely a coincidental match. The cap
applies to the ENCODED FRAME BODY — the serialized JSON the length prefix counts — on both
legs:

- **Inbound**: a frame declaring a length strictly over `BATCH_CAP_BYTES` is rejected BEFORE
  allocation (reject-before-alloc); a declared length of exactly `BATCH_CAP_BYTES` is within
  the cap.
- **Outbound (`ir.emit`)**: enforcement is DETERMINISTIC and batch-anchored. A `Batch` is
  accepted iff its serialized UTF-8 byte length is at most `EMIT_BATCH_BUDGET_BYTES` —
  `BATCH_CAP_BYTES` minus a FIXED envelope allowance. The allowance (`82`) is the serialized
  overhead of the `ir.emit` request envelope (`{type,id,method,params:{batch}}`) carrying the
  LONGEST request id the SDK can mint (`s${Number.MAX_SAFE_INTEGER}`, 17 characters), so the
  accept/reject verdict never varies with the request ordinal (a shorter real id only leaves
  headroom), and an accepted batch's ACTUAL encoded frame body can never exceed
  `BATCH_CAP_BYTES` — exactly as the engine's own `recvFrame` would measure it. An over-budget
  batch is rejected locally (`EmitRejection{code:"cap"}`), never written to the wire.
  `ContractFake` (the engine stand-in the conformance harness delegates to) enforces the
  IDENTICAL budget through the same `exceedsEmitBatchBudget` measurer — the fake and the real
  transport cannot diverge on the same batch.

`fit-34` (`FEH-06`) fails the SDK's own test suite the moment `src/shared-kernel/batch-cap.ts`'s exported
values drift from the `4194304` / `82` literals pinned here — a build/test-time failure, never
a runtime desync against a live engine.

## Cross-Repo Build Target

Engine `PC-PROTO-01` MUST build against THIS wire-spec version (`1`) and
`docs/contracts/engine-sdk-wire-design.md` rev 3 — NOT rev 2 (rev 2 described NDJSON framing, a
single-initiator model, and a `session.init` handshake, all superseded — see that document's
`## Superseded (historical)` section). Conformance is measured by the Go side passing the same
wire vectors this repo's fake-engine harness already encodes (`test/bounded-contexts/authoring/testing/harness.test.ts` +
`test/bounded-contexts/authoring/testing/*.e2e.test.ts`) — a spawned-process, real-stdio proof requiring no Go toolchain on
the SDK side. Engine `MaxMessageBytes` MUST equal SDK `BATCH_CAP_BYTES` (`4194304`, 4 MiB) per
the Frame-Cap Constant clause above.
