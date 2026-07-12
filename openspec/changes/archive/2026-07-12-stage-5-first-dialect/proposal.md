# Proposal: Stage 5 — First dialect: `modify` becomes real (stage-5-first-dialect)

**Triage**: L (owner-ruled thin scope) · **Persona lens**: architect + business-analyst (council)

## Intent

`modify` is a stub today: an author who needs to add an import or export a function must eject
to raw text, losing type-safety, chaining, and IR fidelity — and there is no repeatable recipe for
adding future AST libraries. Stage 5 makes `modify` real for the first dialect (TypeScript via
ts-morph) and lands the generic `defineDialect`/`defineOpPack`/`withOps` contract every later
dialect composes against. This is the O1 (IR fidelity) + O2 (DX) convergence proof and the last
blocker before release shape (Stage 6). Scope is deliberately THIN per the owner ruling: one
dialect, a minimal load-bearing op-pack, and a conformance CORE subset — breadth is a tracked
committed-next followup, not this change.

## Scope

### In Scope
- FIT-01 rebuilt as a transitive import-graph pre-gate with a planted red-proof — lands FIRST (S-000), before ts-morph enters the repo.
- D5 ratified: ts-morph as a plain PINNED runtime dependency (conditions below) + ADR.
- Real `defineDialect`/`defineOpPack`/`withOps` generics with the universal `.raw()` escape-hatch op.
- `modify` coalescing: N AST edits → ONE `modify` directive, chainable with move/copy, read path through `Session.read` (flush-before-read + read-your-own-writes, ADR-0015).
- TypeScript dialect at its own `@pbuilder/sdk/typescript` subpath + THIN op-pack (`.raw()` + `addImport`; design may argue one more).
- Conformance CORE subset bodies (`testDialect`/`testOpPack`) incl. seam-serializability.
- Minimal accurate dialect-authoring doc + REQ-STD-01 SECURITY guard test.

### Out of Scope
- A second dialect; L2+ reserved-name ops; release packaging / full exports map (Stage 6); stage-4b-testing-harness; the real engine wire.
- **Committed-next followup** (register at slice/archive): op-pack breadth (removeImport, prune-unused, add function/variable/class ±export), the 5.3 cross-pack collision diagnostic (a single pack has no collision to prove), conformance tail (adversarial samples, leaf rule, real-base-dialect rule), exhaustive authoring doc (overlaps Stage 6.3).

## Capabilities (contract with sdd-spec)

### New Capabilities
- `dialect-generics`: real defineDialect/defineOpPack/withOps + universal `.raw()` op (5.2).
- `modify-coalescing`: N AST edits coalesce to one modify directive via Session.read (5.4).
- `typescript-dialect`: TS dialect at `./typescript` subpath + thin starter op-pack (5.5).
- `dialect-conformance`: conformance kit core-subset bodies against a real dialect (5.6).
- `dialect-authoring-standards`: authoring doc + REQ-STD-01 `.raw()` SECURITY guard test (5.7).

### Modified Capabilities
- `foundations-skeleton`: FIT-01 becomes a TRANSITIVE import-graph pre-gate, not per-file bare-import only (5.0). *(spec phase confirms exact delta-spec home for the fit-01 requirement.)*
- `factory-package-shape`: `./typescript` enters `package.json#exports` via an ADR-0014 amendment — 4th subpath entry (5.1 wiring).

## Approach

Adopt exploration's **Approach 1 (handle-layer coalescing)**: the dialect's open `Handle` (ADR-0010)
owns the AST lifecycle — first op on a fresh `find()` calls `Session.read`, parses via the dialect
`ast.parse`, and pushes ONE `modify` directive through the existing `session.buffer()`, retaining the
reference; later ops mutate the AST and update only that directive's content (prefer a lazy getter at
stringify time to honour ADR-0006 "serialize once at flush" and avoid O(ops×size) re-serialization).
This keeps `Session`/`DirectiveFactory`/`EngineClient` untouched (KIT-02 stays literally true) and
matches the extraction-ready kit boundary (ADR-0009/0014). A mid-chain read does NOT coalesce across
it: N edits → read → M edits = TWO directives — both shapes are spec material. D5 is ratified as a
plain PINNED dependency (no wide caret, committed lockfile, npm provenance, leaf isolation via FIT-01);
residual two-realms hazard (authors already depending on ts-morph directly) is documented, not solved.

**Design (sdd-design) must formalise, not re-derive:**
(1) an **ADR fork to present, not resolve in propose** — coalescer mechanism: dialect-handle-only
(Session untouched, KIT-02 literal) vs a Session AST-agnostic pre-flush thunk hook; serialize-before-drain
ordering is a fitness candidate either way; (2) the ADR-0014 **amendment** naming `./typescript` (frozen —
not `/ts`, not `/angular`; framework op-packs compose later via `withOps`); (3) the D5 dependency-posture
ADR; (4) the coalescing ↔ flush-seed-rule interaction (Stage 3 §4.6b) explicitly for AST chains;
(5) ts-morph determinism pins (frozen ManipulationSettings, explicit NewLineKind, no language-service
formatter in ops, version-lock gate vs goldens); (6) whether `.raw()` counts as the 2nd distinguishable
op for ADR-0012 coalescing triangulation (fallback: `removeImport`); (7) FIT-05 extended to the coalesced
modify path; (8) FIT-03 commons-bundle budget — the new subpath needs its own budget or an explicit exemption.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `test/fitness/fit-01-commons-no-ast.test.ts` | Modified | Transitive import-graph walk + planted red-proof (S-000, before ts-morph) |
| `src/core/define-dialect.ts` | Modified | Real generics (AST type param, op-pack intersection, handle factory) |
| `src/core/session.ts`, `engine-client.ts` | Read-only | Confirm read-through contract needs no signature change |
| `src/dialects/typescript/**` | New | Parse/print pair, handle, `.raw()` + `addImport`, index |
| `src/conformance/index.ts` | Modified | Real core-subset `testDialect`/`testOpPack` bodies (ADR-0012) |
| `test/golden-ir/**` | Modified | Fixtures: coalesced-one-modify + split-by-read |
| `package.json` | Modified | `./typescript` subpath + pinned ts-morph dependency + lockfile |
| `openspec/decisions/0014-*.md` | Modified | Amendment (single new subpath entry), not replacement |
| `docs/authoring-a-dialect.md`, `SECURITY.md` | Modified | REQ-STD-01 guard + `.raw()` sentence + "conformance ≠ safety" caveat |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Coalescing passes green until a real ≥2-op chain exposes it | Medium | Real ts-morph round-trips from slice 1; adversarial fixtures, not count-only asserts (ADR-0012) |
| flush-seed-rule bites AST chains (find()-only targets need pre-seeding) | Medium | Design restates §4.6b for AST sequences; never a `create()` target |
| `.raw()` executes author code — live code-execution sensitivity | High | security-engineer reviews CODE not the ADR; seam-serializability conformance rejects closure/AST smuggling |
| First runtime dep (ts-morph) supply-chain + determinism drift | Medium | Pin (no caret), lockfile, provenance, FIT-01 leaf isolation, determinism pins vs goldens |
| Two-realms hazard for authors already using ts-morph directly | Medium | Accepted + documented (owner ruling); their nodes vs SDK realm inside `.raw` |
| REQ-STD-01 ships prose-only, guard CI-unverifiable | Medium | Guard test is in-scope (5.7); success criterion gates it |
| New `./typescript` subpath is FIT-04 semver-frozen on ship | Low | Name frozen now; ADR-0014 amendment records it before first publish |
| FIT-03 bundle budget silently omits the new subpath | Low | Design assigns own budget or explicit exemption — not silent omission |

## Rollback Plan

Pre-release, greenfield, publish is `--dry-run` with zero consumers — rollback is clean.
- **Reverted**: the feature branch before merge to `main` — `src/dialects/typescript/**`, the `define-dialect.ts` generics, the `conformance` bodies, the `./typescript` `#exports` entry, the ts-morph line in `package.json` + lockfile, and the ADR-0014 amendment.
- **Safe to keep on partial rollback**: the S-000 FIT-01 transitive extension — it strictly TIGHTENS an existing guard, has no consumer surface, and is forward-compatible; leaving it in place loses nothing.
- **Validation**: `bun test` fully green post-revert; `package.json#exports` back to 3 entries; no `dependencies` block; FIT-04 baselines byte-identical to pre-change.
- **Unrecoverable data**: none — this is an author-time codegen tool; no runtime user data exists.

## Dependencies

- ts-morph (first runtime dependency, plain pinned — D5 ratified).
- ADR-0014 amendment (subpath wiring) — internal, produced in design.
- Stages 1–4 merged (satisfied per git log).

## Success Criteria

- [ ] Author chains `addImport`→`.raw` on one `find()` handle → run commits EXACTLY ONE `modify` directive (golden-IR asserts count = 1).
- [ ] A mid-chain read splits into EXACTLY TWO modify directives (coalesced-no-read and split-by-read fixtures both green).
- [ ] modify's read resolves through `Session.read`; no direct `EngineClient.read` in dialect code (fitness/test asserts).
- [ ] FIT-01 rejects a TRANSITIVE AST import reaching commons via a relative chain (planted red-proof, landed in S-000 before ts-morph).
- [ ] `./typescript` subpath resolves, is FIT-04 semver-frozen, exports map = 4 entries, ADR-0014 amendment recorded.
- [ ] Conformance CORE subset (byte-exact round-trip, single-op fidelity + unchanged-elsewhere, coalescing-to-one, seam-serializability, planted-violation-fails incl. a serializability instance) runs GREEN against the real TS dialect.
- [ ] REQ-STD-01 SECURITY guard test fails on a `.raw()` closure/AST attempting to cross the seam; SECURITY.md carries the `.raw()` sentence + "conformance ≠ safety" caveat.
- [ ] ts-morph pinned (no caret), lockfile committed, provenance on publish; full `bun test` suite green.
