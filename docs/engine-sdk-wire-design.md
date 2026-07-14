# Engine ↔ SDK Wire Design

**Status**: pre-implementation design record — captures the agreed communication design
BEFORE any plan/build has run for the wire. It is the INPUT to that future change, not its
outcome: when the wire change ships, the signed spec, design, and ADRs it produces become
normative, and this document MUST be reconciled against what was actually built (updating
the doc is in scope of that change's archive, not optional). The wire methods
(`ir.emit` / `tree.read`) are not yet on the engine (ROADMAP §6); no real client ships in
`src/` (the normative implementation is the contract fake, `src/testing/contract-fake.ts`).
Contributor-facing; not part of the author reading path in `docs/README.md`.

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

## Decision: JSON-RPC over stdio, single-initiator

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

### Rejected alternatives

- **HTTP**: pays for ports, localhost auth (any local process can reach a port), and
  connection lifecycle to obtain what two file descriptors already provide.
- **WebSockets**: all of the above plus upgrade handshake and reconnection semantics, buying
  peer-to-peer bidirectionality this design explicitly does not need.
- **Engine-initiated `run` request (daemon mode)**: a long-lived SDK process serving multiple
  runs would require the engine to initiate requests (true bidirectionality). Complexity
  without a consumer today. Revisit only if per-run spawn cost ever becomes a measured
  problem.

### When bidirectionality WOULD be needed (future signals)

Progress notifications during long applies, engine-pushed tree-change events (watch mode), or
interactive conflict prompts. None exist in the current design. JSON-RPC notifications over
the same stdio pipe can be added later without breaking the single-initiator base.

## Chain of responsibility

| Stage | Owner | Responsibility |
|---|---|---|
| Resolution + input validation | Go CLI | resolve `@collection:schematic`, read `schema.json`, validate inputs, **apply defaults/coercion (sole owner)** |
| Process orchestration | Engine | spawn runner with argv (factory URL + processed input), apply emitted IRs transactionally, observe exit code |
| Composition root | Runner (`pbuilder-runner` bin) | import factory URL, resolve export, brand check, construct `StdioEngineClient`, invoke, exit |
| Run choreography | `defineFactory` (`src/core/context.ts`) | see below |
| Author logic | factory `fn` | verbs only; never sees the transport |

### Runner contract

A new SDK bin, same shape as `pbuilder-codegen` (built to `dist/bin/`, shebang, declared in
`package.json#bin`). Deliberately thin:

1. Parse argv: `--factory file:///abs/path/factory.ts#exportName` and `--input '<json>'`
   (escape hatch: `--input-file <path>` for payloads near ARG_MAX).
2. Dynamic-import the factory module; resolve the export via the `#fragment` (default export
   when absent).
3. **Brand check**: verify the export is `defineFactory`-wrapped via
   `Symbol.for("pbuilder.factory")`. Not wrapped → fail at load time, before any wire
   traffic, with an actionable message telling the author exactly what to write.
4. Construct the `StdioEngineClient` (implements the `EngineClient` port over stdio).
5. Call `run(input, { client })`; exit 0 on resolve, non-zero on reject.

The runner does NOT receive the package dir: the schema-validation anchor travels inside the
factory closure (the author's `{ packageDir: import.meta.dir }` option).

Bare factory functions are NOT auto-wrapped. `defineFactory`'s option tiers are author-side
semantics (`{ packageDir }` opts into validation; omitting options is the documented untyped
opt-out, REQ-TFO-02) — a runner auto-wrap would have to guess that tier, silently changing
semantics, and authors would test one shape while production ran another. One canonical
shape; a loud, early, actionable error for deviations. (Defense in depth already exists: any
verb outside a run throws `AuthoringError { authoring-rejected, outside-run }`,
REQ-AEC-02.1.)

### `defineFactory` responsibilities

The bridge between author logic and the wire — receives the transport, never chooses it:

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

## Platform and hazards

- **Bun required for the runner**: author factories are raw `.ts`; Bun imports TypeScript
  natively (matches the package's `engines.bun`-only posture). Supporting Node would require
  on-the-fly transpilation in the runner — a decision for the day someone asks.
- **Dual-package hazard**: the runner lives in one physical copy of `@pbuilder/sdk`; the
  schematic's factory imports `defineFactory` from its own `node_modules` copy. The design
  survives this: the ALS context is self-contained in the factory's closure, and the
  `EngineClient` port is satisfied structurally across copies. The one identity-sensitive
  piece is the brand — hence `Symbol.for(...)` (process-global symbol registry), never a
  module-local `Symbol(...)`.

## Open questions

- Brand versioning (`Symbol.for("pbuilder.factory.v1")`?) vs. relying on the
  `session.init` protocol version alone.
- Exit-code taxonomy for the runner (validation failure vs. emit rejection vs. crash).
- Final call on `--input-file` threshold and whether the engine always uses it.
- Where the wire spec (method names, error shapes, pointer syntax) lives so both codebases
  test against one normative text.
