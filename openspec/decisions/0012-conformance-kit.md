# ADR-0012: The conformance kit — `testDialect` / `testOpPack`

- Status: Accepted (amended 2026-07-12 — real CORE bodies shipped, see "Amendment" below)
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0009 (open ecosystem), ADR-0010 (op-packs); roadmap §7 (fitness functions), §8
  (Strict TDD).

## Amendment (2026-07-12, `stage-5-first-dialect`, S-004): CORE subset now, tail deferred

**Context**: `testDialect`/`testOpPack` shipped as frozen-signature stubs (throwing) until a
real dialect existed to validate the adversarial cases against. Stage 5's TypeScript dialect
is that dialect.

**Decision**: Fill the frozen signatures with FIVE core assertions — byte-exact round-trip
(REQ-DC-01), single-op fidelity + unchanged-elsewhere (REQ-DC-02), coalescing-to-one
content-verified (REQ-DC-03, ≥2 distinguishable ops), seam-serializability (REQ-DC-04,
including MANDATORY closure- AND live-node-smuggle red-proofs, two distinct failure modes),
and the read-boundary split (REQ-DC-05.2) — plus a planted-violation suite (one red-proof per
assertion, `test/conformance/planted/`). Fixture SHAPES stay frozen (`DialectFixture`
unchanged); `OpPackFixture` gains ONE additive REQUIRED field, `exercises: readonly
OpExercise[]` (new exported `OpExercise` type) — the op-invocation recipe the generic kit needs
to actually apply each op on a seeded target (without it `testOpPack`'s per-op assertions would
be untestable theatre). Both functions become `async (...): Promise<void>` — observing
DC-03/DC-04 requires awaiting a REAL async coalescing run (the handle's `#tail`, the
run-boundary join, and `Session.flush` are all async); a synchronous body could only inspect
the emitted batch via a mock/bypass, which this ADR and REQ-TSD-07 (ContractFake-only) forbid.
Planted violations surface as promise REJECTIONS, not sync throws.

**Run vehicle**: the five assertions need to observe an EMITTED, coalesced batch, which
requires a real transport driving `Session.flush`/`commit`. The kit ships a MINIMAL
kit-internal in-memory transport, `src/conformance/run-vehicle.ts`, implementing only the
stage/read/commit/discard semantics DC-01..05 exercise — NOT exported from `./conformance`
(internal port use is FIT-08-legal; re-export is not), so it grows the shipped tarball by
exactly one file and no public symbol. It does NOT replace `test/`'s `ContractFake`: that stays
the normative, full-fidelity fake for the SDK's own test suite; the run vehicle is a separate,
deliberately thin implementation whose own fidelity is pinned by the kit's assertions running
the REAL dialect through it (a divergence would fail DC-01..05, not hide).

**Adversarial samples, the leaf rule, and the real-base-dialect rule** (beyond "op-packs tested
against a real dialect, never a mock" — already held from day one) remain OUT OF SCOPE,
tracked as committed-next (`stage-5b-dialect-breadth`).

**Consequences**: (+) the `.raw()` code-execution invariant ships in CORE, not a deferred tail;
(+) "conformance ≠ safety" is asserted in-kit, not only in prose (SECURITY.md). (–) partial
coverage — a tracked followup, not a silent gap. (–) `./conformance`'s public signatures change
`void` → `Promise<void>` — a signature-touching FIT-04 baseline update
(`conformance.index.d.ts`), landed as an explicit S-004 task.

**Alternatives considered**: deferring all bodies (rejected — leaves the security-core seam
assertion unshipped while `.raw()` goes live); shipping the full adversarial battery now
(rejected — the XL breadth the owner ruling defers to `stage-5b-dialect-breadth`); relocating
`ContractFake` to `src/` for the run vehicle (rejected — drags full FAKE-01..06 semantics +
test-support coupling into the shipped surface for five assertions that need a fraction of
it).

The body below (originally accepted 2026-06-21) is otherwise unchanged.

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
