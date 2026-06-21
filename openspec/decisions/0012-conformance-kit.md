# ADR-0012: The conformance kit — `testDialect` / `testOpPack`

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0009 (open ecosystem), ADR-0010 (op-packs); roadmap §7 (fitness functions), §8
  (Strict TDD).

## Context

An open ecosystem (ADR-0009) cannot have the core team review every community dialect/op-pack. The
contract must therefore be **executable and shipped** — the substitute for central gatekeeping is a
verifiable, self-run conformance suite anyone can pass without asking permission.

## Decision

Ship `@pbuilder/sdk/conformance` exposing `testDialect(fixture)` and `testOpPack(fixture)`. The
contributor supplies a small fixture (their dialect/pack + samples + ops); the kit derives the
adversarial cases and asserts, **mutation-resistant**:

- **Parse/print no-op round-trip fidelity** — `print(parse(content)) === content` **byte-exact** (NOT
  AST-equal — AST-equal hides whitespace/comment loss).
- **Single-op fidelity + unchanged-elsewhere** — the op's effect is present AND every other region is
  byte-stable (catches over-broad mutations).
- **Coalescing to ONE `modify`** whose content reflects ALL ops in a chain (triangulated across ≥2
  distinguishable ops — count alone is insufficient).
- **Only serializable bytes cross the seam** — `JSON.parse(JSON.stringify(directive))` deep-equals
  (closures/AST nodes don't survive); no AST object, closure, or unresolved param.
- **Leaf rule** — no cross-dialect import; commons pulls no AST lib.
- **Author-vocabulary error attribution** — malformed input yields a named author/developer error,
  never a raw throw or engine-vocabulary leak.
- **Mandatory built-in adversarial samples** per declared file type (empty / comment-only / 4 MiB
  boundary / CRLF / BOM / duplicate-target) — the contributor cannot opt out.
- **Op-packs are tested against a REAL base dialect**, never a mock (the shared-single-AST seam bug
  only appears against a real AST-holder).

Conformance ≡ passing the kit. The kit's own properties are themselves under Strict TDD (remove a
property → its meta-test goes red).

## Consequences

- The conformance pass is the concrete signal a future trust-tier / capability model (roadmap §10) can
  key off — without foreclosing it.
- Keeps the ecosystem open (self-attestable, verifiable) while keeping it correct (no silent dialect
  drift).
- A future `no-network / no-fs-escape / emit-only` lint extends this kit (the open-ecosystem security
  gate).
