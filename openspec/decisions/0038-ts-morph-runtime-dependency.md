# ADR-0038: ts-morph as the first runtime dependency — plain, exact-pinned (D5)

> **Renumbering note (mechanical, content unchanged)**: design.md and slices.md drafted this
> decision as "ADR-0033". By the time this batch (S-002) landed, `stage-4b-testing-harness`
> had already claimed ADRs 0033-0036 on `main` (unrelated concern: third-audience
> author-testing), and this same change's own S-001 batch had already claimed 0037 for the
> coalescing-seam decision (originally drafted as "ADR-0034") — see
> `openspec/decisions/0037-coalescing-seam-handle-owned.md`'s header for that precedent. Both
> "ADR-0033" and "ADR-0034" were independently computed as "next free slot" at design time by
> two branches that later merged in a different order. This ADR lands as **0038** (the next
> free slot at S-002 apply time — verified against `openspec/decisions/` before writing).
> Content below is verbatim from design.md §4.5's ADR-0033 block; only the number changed.

- **Status**: Accepted
- **Date**: 2026-07-12
- **Deciders**: Daniel (Hyperxq)
- **Builds on**: D5 (open runtime-dependency posture), ADR-0014 (single-package subpath shape,
  amended alongside this ADR), ADR-0037 (coalescing seam)

## Context

`modify` needs a real AST library; the repo has zero runtime `dependencies`. The open half of
D5 is the posture — plain `dependency` vs `peerDependency`.

## Decision

Declare ts-morph as a plain, EXACT-pinned `dependencies` entry (no caret/tilde), commit the
lockfile, publish with npm provenance (REQ-PKG-03, REQ-TSD-06.2), and prove FIT-01 leaf
isolation (ts-morph never reaches `src/commons/**`) BEFORE the dependency lands (S-000
ordering).

**Resolved version (Amendments, verify-plan-1)**: the exact pin is resolved as the LATEST
STABLE ts-morph at S-002 apply time — **`ts-morph@28.0.0`** (resolved 2026-07-12) — recorded
atomically in `package.json` (exact, no range), the committed `bun.lock`, and this section.

## Consequences

- (+) zero-config first-run DX for JS-project authors.
- (+) one place to gate determinism against goldens.
- (–) pins ts-morph's major → a swap is a semver-major.
- (–) two-realms hazard (a different version loaded by the author) — ACCEPTED and DOCUMENTED
  (REQ-TSD-06, design §4.4b), not solved.

## Alternatives

- *peerDependency* — worse first-run DX for a capability with zero existing adopters, pushes
  install friction onto every consumer.
- *caret range* — reintroduces the nondeterminism the pins exist to kill.
