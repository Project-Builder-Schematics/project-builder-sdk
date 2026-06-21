# ADR-0013: Author-verb to wire-op lowering table

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0028 (SDK↔engine IR wire contract; canonical wire-op shapes),
  ADR-0001 (SDK emits wire directives), ADR-0003 (dialect resolution).
- Formalises: what S-001 (DirectiveFactory) implemented and GIR-01 golden-tested.

## Context

The author surface (`@pbuilder/sdk/commons`) exposes ergonomic verbs (`find`, `create`, `modify`,
`remove`, `rename`, `move`, `copy`). Each verb call is intercepted by the `RunContext`'s
`DirectiveFactory` and translated to an ADR-0028 wire directive before being buffered in the
`Session`. The mapping is a one-to-one lowering table — no control flow, no template evaluation
(the engine owns that), no AST involvement. S-001 implemented this table; this ADR makes it
canonical and explicit.

Two vocabularies coexist:

- **Author vocabulary** — the ergonomic verbs authors write in schematics (`remove`, `rename`, etc.)
- **Wire vocabulary** — the ADR-0028 op names the engine receives (`delete`, `rename`, etc.)

They differ in one key place: author `remove` → wire op `delete`. This is intentional:
"delete" is jargon; "remove" is the author-friendly synonym.

## Decision

### Lowering table

| Author call (commons) | `DirectiveFactory` method | Wire op emitted | Payload fields |
|---|---|---|---|
| `find(path)` | — (returns `FoundHandle`; no directive emitted until a write or `.remove()` is called) | — | — |
| `create(path, {template, options, force?})` | `factory.create({pathTemplate, template, options, force?})` | `op:"create"` | `{ pathTemplate, template, options, force? }` |
| `modify(path, content)` | `factory.modify({path, content})` | `op:"modify"` | `{ path, content }` |
| `remove(path)` / `find(path).remove()` | `factory.remove({path})` | **`op:"delete"`** | `{ path }` |
| `rename(path, newName, {force?}?)` | `factory.rename({path, newName, force?})` | `op:"rename"` | `{ path, newName, force? }` |
| `move(path, toDir)` | `factory.move({path, toDir})` | `op:"move"` | `{ path, toDir }` |
| `copy(from, to, {force?}?)` | `factory.copy({from, to, force?})` | `op:"copy"` | `{ from, to, force? }` |

### Batch envelope

Every `Session.flush()` emits a single `Batch`:

```ts
{ protocolVersion: 1, force: boolean, instructions: Directive[] }
```

`force` on the envelope is the global flag (set by engine CLI `--force`). Per-op `force` fields
(present on `create`, `rename`, `copy`) are op-scoped overrides. Precedence:
`effective = envelope.force OR op.force` (ADR-0028).

### `find` is read-only — no directive emitted at call time

`find(path)` returns a `FoundHandle` immediately without buffering any directive. A directive is
buffered only when the caller invokes a write method (`.modify()`, `.rename()`, `.move()`,
`.copy()`) or `.remove()` on the returned handle. `find(path).read()` flushes pending directives
before delegating to `EngineClient.read` — it does not emit a directive of its own (the read query
is a protocol-level concern separate from the mutation batch, per ADR-0028 M1).

### `remove` → `op:"delete"` is the only vocabulary divergence

Author verb `remove` maps to wire op `delete`. This is the sole case where the author verb name
and the wire op name differ. The `DirectiveFactory.remove({path})` method is the locus of this
translation; the golden-IR tests (GIR-01) assert `op:"delete"` not `op:"remove"`.

### `copy` — shape registered, apply deferred

The `copy` wire shape `{ from, to, force? }` is defined and golden-tested. The engine-side
application (bytes-by-reference via `SourceFS`) is deferred to vNext (ADR-0028 §copy).
The SDK emits the directive correctly; the engine drops it until the apply pass is implemented.

## Consequences

- The table is the single source of truth for `DirectiveFactory` implementors and golden-IR test
  authors. Any deviation between this table and `src/core/directive-factory.ts` is a bug.
- Adding a new author verb requires a corresponding row in this table and a new `DirectiveFactory`
  method — the table gates the wire contract.
- `find` being read-only (no directive at call time) is an invariant the `Session` enforces:
  only `buffer(directive)` calls add to the pending queue.
