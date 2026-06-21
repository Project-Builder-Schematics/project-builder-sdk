# ADR-0001: The SDK emits engine wire directives, not internal IR

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: engine ADR-0028 (SDK↔engine IR wire contract), engine ADR-0027 (language-agnostic
  mutation kernel; directive vs resolved IR).

## Context

The engine defines two levels (engine ADR-0027/0028): the **directive** (high-level, what crosses
the wire) and the **resolved IR** (`internal/ir.Instruction`, produced inside the engine by the
template-lowering pass). The SDK must pin which of the two it speaks.

## Decision

The SDK emits **ADR-0028 directives**, never the engine's internal `ir.Instruction`. The wire
payload is the batch envelope `{ protocolVersion, force, instructions[] }`; each instruction is a
tagged directive (`create` / `modify` / `delete` / `rename` / `move` / `copy`).

- For `create`, the directive carries `{ pathTemplate, template, options }` **unprocessed** — the
  engine hosts the template DSL and renders. The SDK has **no template engine**; `template` is an
  opaque string to it.
- `options` (the data context) **does cross the wire** for `create`. Param-blindness is a property
  of the engine **core seam**, not of the wire.
- `modify` carries already-resolved content (the AST work happens SDK-side, below the seam); the
  read happens before, as a separate read-through query.
- Reads are **async** (`await read(path)`): the read-through is an IPC callback (`fs.readFile`) that
  crosses the process boundary. This freezes the §5 sync-vs-async signature as **async**.

## Consequences

- The SDK is thinner than a templating SDK would be: for `create` it ships templates, it does not
  render them.
- The SDK's public surface versions independently from the engine via `protocolVersion`.
- The internal `ir.Instruction` shape is irrelevant to the SDK; only the ADR-0028 directive contract
  binds it.
