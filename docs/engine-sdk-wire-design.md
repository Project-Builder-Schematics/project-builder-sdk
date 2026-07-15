# Engine ↔ SDK Wire Design

**Wire-spec version**: 1 (rev 3 — reconciled against BUILT code, `stdio-engine-client`, 2026-07-15)
**Status**: HISTORICAL decision record. This document captured the PRE-implementation design
BEFORE `stdio-engine-client` built the wire; it is preserved as the decision trail (why
alternatives were rejected, what the tradeoffs were), not as the current contract. **The
normative text both repos now build and conformance-test against is
[`docs/engine-sdk-wire-spec.md`](./engine-sdk-wire-spec.md)** — read that document for the
CURRENT wire shape. Three of this record's original decisions were superseded during the
`stdio-engine-client` build (see `## Superseded (historical)` below); everything else here
(chain of responsibility, cross-language contracts, platform hazards) still holds. The wire
methods (`ir.emit` / `tree.read`) are not yet on the engine (ROADMAP §6); no real client ships
in `src/` at the time this record was authored (the normative implementation was the contract
fake, `src/testing/contract-fake.ts` — `stdio-engine-client` later added the first real
`EngineClient`, `StdioEngineClient`). Contributor-facing; not part of the author reading path
in `docs/README.md`.

## Topology

```
user ──► Go CLI (`builder exec @collection:schematic`)
             │  resolves collection + schematic, validates inputs against schema.json
             ▼
          Engine (Go)
             │  spawn(pbuilder-runner, argv: factory URL + validated input JSON)
             ▼
          SDK runner (Bun process)  ◄── JSON-RPC over stdio ──► Engine
```

One process per execution: the engine spawns the runner, the run happens, the process exits.
There is no long-lived SDK daemon.

## The three planes

These are independent; conflating them is the classic source of confusion here:

| Plane | Question | Owner |
|---|---|---|
| Process lifecycle | who spawns / kills the process? | Engine |
| RPC initiation | who sends requests over the pipe? | SDK — 100% of requests |
| Data flow | which way do bytes travel? | both ways, always — says nothing about the protocol |

## Superseded (historical)

> **Superseded by rev 3** (`stdio-engine-client`, 2026-07-15, REQ-WPS-11). The three decisions
> below were the pre-implementation proposal; the SHIPPED wire replaced all three. See
> `docs/engine-sdk-wire-spec.md` for what actually built. Kept here, unedited except for this
> banner, as the historical record of what was considered and why.
>
> | Proposed here (superseded) | Shipped instead |
> |---|---|
> | Newline-delimited JSON (NDJSON) framing | 4-byte big-endian length-prefix framing (`docs/engine-sdk-wire-spec.md` § Frame Grammar, WPS-01) |
> | Single-initiator directionality (the SDK initiates every request, the engine only responds) | Host-initiated topology with exactly 4 allowlisted SDK→host reverse callbacks (§ Reverse-Callback Method Schemas, WPS-05/WPS-09/WPS-10) |
> | `session.init` handshake | Versioned `ready` greeting, fail-at-greeting on mismatch (§ Ready Handshake, WPS-02) |

### Decision: JSON-RPC over stdio, single-initiator

- **Transport**: stdin/stdout of the spawned runner process. The parent-child pipes exist at
  spawn time — no ports, no discovery, no auth (the pipe is private to parent and child by
  OS design). Precedent: LSP, MCP (local mode), Terraform plugins.
- **Framing**: newline-delimited JSON (NDJSON), one message per line. Content-Length framing
  (LSP style) is unnecessary — valid JSON always escapes newlines.
- **Directionality**: single-initiator. The SDK initiates every request
  (`session.init`, `tree.read`, `ir.emit`, `commit`, `discard`); the engine only responds.
  Responses are part of the request/response cycle, not a second direction. That the engine
  owns the process (spawn/close) does not make the protocol bidirectional.
- **stdout is protocol-sacred**: once the protocol is running, nothing but JSON-RPC may be
  written to stdout — a single stray log line corrupts the stream. All SDK logging goes to
  stderr, which the engine may capture separately for diagnostics.
- **Handshake**: the runner's first message is `session.init` carrying a `protocolVersion`.
  The engine replies with its version/capabilities. A mismatch fails at the greeting with a
  clear error — never mid-apply.

#### Rejected alternatives

- **HTTP**: pays for ports, localhost auth (any local process can reach a port), and
  connection lifecycle to obtain what two file descriptors already provide.
- **WebSockets**: all of the above plus upgrade handshake and reconnection semantics, buying
  peer-to-peer bidirectionality this design explicitly does not need.
- **Engine-initiated `run` request (daemon mode)**: a long-lived SDK process serving multiple
  runs would require the engine to initiate requests (true bidirectionality). Complexity
  without a consumer today. Revisit only if per-run spawn cost ever becomes a measured
  problem.

#### When bidirectionality WOULD be needed (future signals)

Progress notifications during long applies, engine-pushed tree-change events (watch mode), or
interactive conflict prompts. None exist in the current design. JSON-RPC notifications over
the same stdio pipe can be added later without breaking the single-initiator base.

> **Honest reversal note** (matches design.md ADR-02): this last paragraph's premise no longer
> holds as stated — the shipped wire already inverted trust (host-initiated, 4 gated reverse
> callbacks) rather than staying strictly single-initiator with bidirectionality "added later".
> Preserved verbatim as it was reasoned at the time.

## Chain of responsibility

| Stage | Owner | Responsibility |
|---|---|---|
| Resolution + input validation | Go CLI | resolve `@collection:schematic`, read `schema.json`, validate inputs, **apply defaults/coercion (sole owner)** |
| Process orchestration | Engine | spawn runner with argv (factory URL + processed input), apply emitted IRs transactionally, observe exit code |
| Composition root | Runner (`pbuilder-runner` bin) | import factory URL, resolve export, wrap bare factory with runner-internal `defineFactory`, construct `StdioEngineClient`, invoke, exit |
| Run choreography | `defineFactory` (`src/core/context.ts`) | see below |
| Author logic | factory `fn` | verbs only; never sees the transport |

### Runner contract

A new SDK bin, built to `dist/bin/`, shebang. Deliberately thin:

> **Correction (rev 3)**: this paragraph originally said "declared in `package.json#bin`",
> matching `pbuilder-codegen`'s shape. `stdio-engine-client`'s ADR-06 ships it PROVISIONAL and
> UNMAPPED instead — no `package.json#bin` entry — since the runner is engine-spawned/bridge-
> imported, not a user-facing CLI; the public `#bin` entry is registered at the public-package
> plan instead.

1. Parse argv: `--factory file:///abs/path/factory.ts#exportName` and `--input '<json>'`
   (escape hatch: `--input-file <path>` for payloads near ARG_MAX).
2. Dynamic-import the factory module; resolve the export via the `#fragment` (default export
   when absent). The export is the author's BARE input-receiving function — verify it is a
   function; fail at load time with an actionable message otherwise.
3. **Wrap it internally**: `defineFactory(fn, { packageDir: dirname(<factory module>) })`.
   Well-defined because the adjacency convention (cross-language contract §3 below) fixes
   the schema location — the runner supplies the same anchor the author's
   `import.meta.dir` would have named.
4. Construct the `StdioEngineClient` (implements the `EngineClient` port over stdio).
5. Call the wrapped run with `(input, { client })`; exit 0 on resolve, non-zero on reject.

**Authors do NOT call `defineFactory`** (owner direction, 2026-07-14 — engram obs #2070,
registered at the `stage-6-release-shape` archive; supersedes the earlier draft of this
document that made the wrapper author-mandatory with a brand check). A schematic exports
the bare, typed `(input: Input) => void | Promise<void>` function; `defineFactory` is
runner/test-harness API, never author vocabulary (its graduation out of the author surface
is tracked in the pending-changes `defineFactory` graduation row). The test harness
(`runFactoryForTest`) wraps the same bare shape, preserving test/production parity.

**Load-bearing pin — single SDK instance**: the engine MUST resolve `pbuilder-runner` from
the schematic project's OWN `node_modules` (Angular-CLI-style project-local execution),
never from an engine-bundled or global SDK copy. The internal wrap only works when the
runner's `defineFactory` (whose run context is a module-level `AsyncLocalStorage`) and the
author's imported verbs come from the SAME physical copy of `@pbuilder/sdk` — two copies
mean two ALS instances, and every verb throws `outside-run` at run time. Project-local
resolution also eliminates runner↔SDK version skew by construction: the runner version IS
the version the schematic compiled against.

### `defineFactory` responsibilities (runner-internal)

The bridge between author logic and the wire — invoked by the runner (never by the author),
receives the transport, never chooses it:

1. **Run-boundary gate** (when `packageDir` given): resolve dir, reserved-name check,
   schema validation of input, containment-ceiling anchor (ADR-0046). All before `fn` runs;
   fails closed.
2. **Run-context construction**: `Session(client)`, `DirectiveFactory`, dialect registry.
3. **Ambient context**: `als.run` scoping so author verbs resolve the session implicitly.
4. **Run-end pipeline**: `dialects.drain()` → `session.flush()` (buffered directives emit as
   one batch) → transaction.
5. **All-or-nothing transaction choreography** (ADR-0015): `commit()` on success;
   `discard()` + re-throw of the ORIGINAL error on any throw, with double-fault preservation
   (a failing discard attaches as `cause`, never clobbers the author's error).

Non-responsibilities: factory resolution, argv, transport construction, process management.

## Cross-language contracts (Go ↔ TS)

Two things stopped being internal conventions and became wire-level contracts the moment the
Go side started producing what the TS side consumes. Both must be specified once, versioned
with the protocol, and conformance-tested on both sides:

1. **Factory pointer syntax** (`./factory.ts#exportName`, default export when no fragment).
   Go resolves it to an absolute URL; TS parses the fragment and resolves the export. Pin:
   behavior with no fragment, missing export, invalid fragment.
2. **JSON Schema validation semantics**. Two implementations (Go library + TS
   `validateAtRunBoundary`) WILL drift on `format`, coercion, and defaults unless pinned:
   same JSON Schema draft on both sides; the **CLI is the sole owner of defaults/coercion**
   (it delivers processed inputs); the SDK-side check is a strict conformance check that
   never mutates the input. Dual validation is intentional, not redundant: CLI = UX
   fail-fast before spawning; SDK = contract self-defense (the same factory runs under
   `runFactoryForTest` and the conformance run-vehicle with no CLI in front).
3. **`collection.json` carries NO `schema` field** (deviation from Angular schematics,
   decided 2026-07-14). A schematic entry declares only the factory pointer; the CLI derives
   the schema location by the SDK's package-shape convention: `schema.json` adjacent to the
   factory module (ADR-0031, canonical and non-configurable). Rationale: in this SDK the
   adjacent `schema.json` is also the SOURCE of the generated `Input` type
   (`pbuilder-codegen` → `schema.generated.ts`, digest-pinned by FIT-12) and of
   `defineFactory`'s run-boundary validation — an independent `schema` pointer in
   `collection.json` would let the CLI validate against a different file than the one the
   factory compiled and self-validates against, turning the generated type into a lie.
   Angular affords a free-floating schema because its factories are host-validated and
   untyped; this SDK is typed end-to-end, and adjacency is what keeps the chain sound. One
   fact, one owner: the package shape defines the location, the CLI consumes the convention.

## Platform and hazards

- **Bun required for the runner**: author factories are raw `.ts`; Bun imports TypeScript
  natively (matches the package's `engines.bun`-only posture). Supporting Node would require
  on-the-fly transpilation in the runner — a decision for the day someone asks.
- **Dual-package hazard**: `defineFactory`'s run context is a module-level
  `AsyncLocalStorage`, and author verbs resolve it from THEIR copy of the SDK. With the
  runner-internal wrap, correctness therefore DEPENDS on the single-SDK-instance pin above
  (project-local runner resolution): an engine-bundled runner wrapping a factory whose
  verbs come from a different copy fails with `outside-run` at the first verb. The
  `EngineClient` port itself is copy-tolerant (structural typing); the ALS is not.

## Open questions

- ~~`defineFactory`'s graduation home once it leaves the author surface~~ **RESOLVED** —
  `archive/2026-07-15-bare-factory-migration` graduated it to core-internal, removed from
  `./testing`'s public exports (ADR-0050).
- ~~Exit-code taxonomy for the runner (validation failure vs. emit rejection vs. crash).~~
  **RESOLVED** — `docs/engine-sdk-wire-spec.md` § Exit-Code Taxonomy (EXC-01), implemented in
  `src/transport/exit-codes.ts`.
- Final call on `--input-file` threshold and whether the engine always uses it. **PARTIALLY
  RESOLVED**: the SDK-side cap (`10 MiB`, `src/transport/runner.ts`) is set; whether the engine
  always routes through `--input-file` vs. inline `--input` is still an engine-side call.
- ~~Where the wire spec (method names, error shapes, pointer syntax) lives so both codebases
  test against one normative text.~~ **RESOLVED** — `docs/engine-sdk-wire-spec.md`.
