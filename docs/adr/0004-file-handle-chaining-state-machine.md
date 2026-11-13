# ADR-0004: The file handle — find-rooted lazy entry, two mutation families, type-enforced chaining

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0002 (this repo); engine `ir-delete` / `ir-move` specs and batch-conflict rules.

> **Amended by ADR-0010 (this repo)** — the sealed per-dialect subclass is replaced by an OPEN handle
> composed via op-packs; the State discriminant (`FoundHandle`/`WritableHandle`) is retained.

## Context

Most mutations operate on an existing file reached via `find()`. Not every op sequence is coherent
(a deleted file cannot then be created or modified). Illegal chains should be rejected **before any
byte is sent**.

## Decision

**Two families:**

- **find-rooted** (operate on what exists): `modify`, `rename`, `move`, `remove`. `find(path)`
  returns a **lazy** handle — no read fires until content is needed (`.read()` or a dialect op that
  must parse the AST). `rename` / `move` / `remove` are blind directives (no read).
- **introduce** (bring into existence; top-level; no read, no read-set): `create`, `copy`.

**Chaining — a type-enforced state machine:**

| After | Allowed | Forbidden |
|---|---|---|
| `find()` fresh | read · modify · rename · move · **remove** | — |
| `create()` | read · modify · rename · move | remove |
| `modify` | read · modify · rename · move | remove |
| `rename` / `move` | read · modify · rename · move | remove |
| `remove` | — (terminal) | everything |

- `remove` is valid **only on a fresh `FoundHandle`**; any prior write makes it incoherent.
- `create()` returns a `WritableHandle` (so `create().modify()` works; `create().remove()` does not
  exist).
- Enforced by distinct handle types: `FoundHandle` (has `remove`) vs `WritableHandle` (no `remove`);
  write ops return `WritableHandle`; `remove` returns `void`.
- Scope: these rules are **intra-handle** (compile-time). **Cross-handle** conflicts (two handles
  touching one path) remain the engine's runtime job (batch-conflict rules E1–E11). The SDK forbids
  up-front what it can; the engine is the backstop.

## Consequences

- Illegal chains do not compile.
- The SDK is deliberately stricter than the engine on coherence: the engine permits deleting a
  same-batch-created node (engine REQ-DEL-02.2); the SDK forbids `create→remove` because it is
  pointless.
- The `state × dialect` type space is collapsed with a generic `Handle<State, Dialect>` where
  `remove` exists only when `State = "found"` (deferred to the dialect work; does not block this).
