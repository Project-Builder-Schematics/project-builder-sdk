# ADR-0002: Layered architecture — core / commons / dialects, centralized Session + DirectiveFactory

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0001 (this repo); roadmap §7 (commons vs dialects behind one dialect contract).

> **Amended by ADR-0008, ADR-0009, ADR-0010 (this repo)** — the SDK persists no tree; `core` becomes
> the `@pbuilder/sdk-kit` contributor surface (designed now, published later); the handle is OPEN
> (composed op-packs), not a sealed subclass.

## Context

Every new dialect (a proliferating concern — roadmap §7) must NOT reimplement the wire, the buffer,
or the agnostic verbs — otherwise each dialect is built from zero.

## Decision

Three layers over a shared core:

- **core (internal kit)** — owns:
  - `EngineClient` — the single transport port (`emit(batch)` + `read(path)`). The contract fake
    implements this same interface.
  - `Session` — the per-run runtime: the pending-directive buffer + the flush policy
    (flush-before-read, schematic boundary, ~4 MiB cap — engine design.md §4); holds the
    `EngineClient`. **Flush-before-read lives in exactly one place.**
  - `DirectiveFactory` — the only thing that knows ADR-0028 shapes; pure `args → directive`; one
    factory, one method per wire op.
  - `BaseFileHandle` — the file-type-agnostic ops (`read` / `rename` / `move` / `remove`),
    implemented once.
- **commons (public, agnostic)** — `find` / `create` / `copy`. No AST.
- **dialect (public, per package)** — a `BaseFileHandle` subclass adding L1 named ops + `.raw`, plus
  a serializer hook for the coalesced `modify`. The AST library lives only here.

Responsibility triad: **DirectiveFactory builds · Session buffers + transports · Handle is the
fluent surface.**

## Consequences

- A new dialect implements ~3 things (handle subclass; L1 ops + `.raw`; serializer hook); everything
  else is inherited.
- The `EngineClient` port is the seam the contract fake implements — it is what replaces a
  standalone spike (ADR-0007, this repo).
- Golden-IR assertions test `DirectiveFactory` in isolation (roadmap §1).
