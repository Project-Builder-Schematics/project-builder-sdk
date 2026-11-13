# ADR-0006: AST exposed ready-to-use; L1 named ops + L2 `.raw`; coalescing to one `modify`

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: engine design.md §2.1 / §4 (factory-of-factories, coalescing, flush); ADR-0001 (this
  repo — `modify` carries resolved content).

> **Amended by ADR-0008 (this repo)** — the coalescer's live AST is discarded (`null`) at flush; the
> SDK persists no tree.

## Context

A modify needs a parsed AST. Angular makes the author plumb parsing and serialization. We expose the
AST **ready to use**.

## Decision

The dialect handle does, hidden from the author:

```
read-through (Tree-first) → parse with the dialect lib (ts-morph/postcss) → hold ONE live AST
   → author mutates (L1 named ops OR L2 .raw) → serialize once at flush → one `modify` directive
```

- **L1 named ops** (`addImport`, `addRule`, …) are curated operations over that ready AST — the
  author never sees the AST. Library-agnostic, auditable; the 80–90% path.
- **L2 `.raw(ast => …)`** hands the **same, already-parsed** AST for anything L1 doesn't cover. The
  author mutates and returns; never parses or serializes.
- **One AST across the chain** = coalescing: `find("x.ts").addImport(...).raw(ast => …)` touches the
  same instance → a single `modify`.

## Consequences

- Coalescing per engine design.md §4 (chain → one op; serialize once at flush).
- The `DirectiveFactory` stays AST-blind: `modify` carries already-resolved content.
- L2 couples the dialect package to the AST library's major version (a library swap is a semver
  major) — the documented cost of the escape hatch.
