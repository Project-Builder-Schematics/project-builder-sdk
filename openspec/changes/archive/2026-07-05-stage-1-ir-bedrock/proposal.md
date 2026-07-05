# Proposal: Stage 1 — IR bedrock: wire correctness & fake fidelity (stage-1-ir-bedrock)

**Triage**: L · **Persona lens**: synthesis (architect / qa / ba / pm folded in)

## Intent

Every later stage — error attribution (2), dry-run (3), typed options (4), dialects (5) — freezes
semantics that Stage 1 defines. Today that bedrock is unsafe to freeze: `move` lacks `force?` on the
wire (freezing it absent is a semver mistake), the 4 MiB batch cap has no defined unit or encoding
anywhere in `src/`, emission determinism is asserted nowhere, the fake does not model the wire
(ADR-0018's JSON round-trip unimplemented), ADR-0017's fail-closed rules are silently unimplemented in
both production and the fake (a green suite hides two live bugs — `move` overwrites, `modify` of a
missing path materializes), the `EngineClient` port is the sole seam by convention but not
structurally guarded, and the four-layer test pyramid is implicit. This change proves and freezes the
IR-correctness triad (golden-IR + unmocked fake + fitness) so the engine — whenever it arrives —
receives a contract already pinned, not renegotiable.

## Scope

### In Scope
- **C1** golden-IR completeness (six verbs ± `force`, chained-handle programs, key-order) + determinism proof (1.1)
- **C2** `move` `force?` end-to-end (wire + factory + author surface) + fake fail-closed for move-collision & modify-nonexistent — ADR-0017 closure (1.3)
- **C3** batch-cap contract per **D8** + empty-batch run-end pin (1.4)
- **C4** fake wire-modeling: JSON round-trip at emit, paths verbatim, conflicts in author order — ADR-0018 (1.7)
- **C5** double-fault error preservation — W6 (1.5)
- **C6** FIT-10 structural `EngineClient` port guard (1.8)
- **C7** test-pyramid codification: four layers mapped, CI-enforced, explicit e2e suite (1.9)
- **Housekeeping (no REQ)**: 1.6 XS test-debt batch; **objectives-plan reconciliation** — 3 surgical edits so the plan reflects D8's fake-side cap enforcement: item 1.4 wording ("enforced at Session.flush" → fake at emit), Coverage O1 row 6, and the D8 row in the decision table

### Out of Scope
- Stage 2 attribution — Stage 1 proves the fake **REJECTS**; it does NOT prove the author gets an attributed `AuthoringError` (2.1 territory)
- Applied-boundary / `instructions[0]` attribution reporting (Stage 2.1); conformance kit bodies (5.6); dry-run (3.x); typed options (4.x); dialects (5.x); release/publish (6.x); the real engine wire
- Re-deciding D1/D6/D8 (ratified — implementation only) · binary `modify.content` (D8: UTF-8 text only in v1; future additive wire change)

## Capabilities (contract with sdd-spec)

Seven behavioral units map to 3 new spec domains + 2 modified. 1.6 stays outside the REQ set (mechanical debt).

### New Capabilities
- `batch-cap-contract`: 4 MiB cap = `Buffer.byteLength(JSON.stringify(batch),'utf8')`; `modify.content` UTF-8 text only; fake rejects oversized at emit (SDK never validates); empty-batch run-end pinned — D8→ADR-0019
- `boundary-pass-through`: fake round-trips each batch through JSON at emit (non-serializable → rejection, not silent drop); paths pass through unvalidated; intra-batch conflicts emit in author order — ADR-0018
- `test-pyramid-codification`: unit/fitness/integration/e2e named over the tree, each mapped to its dir, CI runs all four, explicit e2e suite added where thin

### Modified Capabilities
- `foundations-skeleton`: **GIR** — extend to six verbs ± `force`, chained-handle fixtures, `Batch` key-order assertion, determinism proof (C1); **FAKE + KIT** — implement/pin fail-closed move-collision & modify-nonexistent, `move` gains `force?` on wire + `directive-factory` + author `move()`/handle `.move` (C2, ADR-0017); **FIT** — add REQ-FIT-10 port guard (C6)
- `commit-discard-contract`: add double-fault preservation — a rejecting `discard()` after a factory throw preserves the ORIGINAL factory error (C5, W6)

## Approach

Sequence the `contract-fake.ts` bottleneck strictly: **1.3 → 1.4 → 1.7 → 1.1** — the fake's fail-closed
rules, cap modeling, and wire round-trip must freeze before 1.1 pins golden fixtures against them;
1.5 / 1.6 / 1.8 / 1.9 slice independently. Reuse existing patterns: FIT-01/FIT-08 regex import-graph
scan for FIT-10 (Approach 1a, no new tooling), byte-string `JSON.stringify` equality for the
determinism proof (Approach 2a, the stronger claim), and a test-only empty-batch pin — `Session.flush`
already no-ops on empty pending and `defineFactory` already calls `commit()` unconditionally, so 1.4's
empty-batch path is **zero production change** (mirrors the `typed-options-and-read` prove-and-freeze
precedent). **D8 resolves the one architecture tension the exploration flagged**: the cap is enforced
by the FAKE at emit, NOT at `Session.flush` — so `src/core/session.ts` gets no cap code and ADR-0018's
"SDK never validates" invariant holds; `wire.ts` documents the cap constant as a Batch-contract
property only. Decisions to formalize at design: **ADR-0019** (D8 cap unit + encoding), and the
**FIT-10 allow-list mechanism** (path allow-list vs "implements `EngineClient`" structural exception —
open technical question carried from explore) so the scanner exempts `contract-fake.ts`'s one
legitimate port import and shared wire types (`Directive` / `JsonValue`) without loosening the guard.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/wire.ts` | Modify | `move` gains `force?`; documented cap constant; phantom ADR-0028 → 0013/0017 |
| `src/core/directive-factory.ts` | Modify | `move()` threads `force?`; phantom-ADR fix |
| `src/commons/index.ts` | Modify | `move()` verb + handle `.move` gain `{ force? }` |
| `src/core/base-handle.ts` | Modify | `WriteOps.move` signature gains opts |
| `src/core/context.ts` | Modify | W6: wrap `discard()` so the original factory error survives |
| `src/core/session.ts` | Read-only | empty-batch already no-ops (pin only); NO cap check (D8 → fake enforces) |
| `test/support/contract-fake.ts` | Modify | fail-closed move/modify (0017), JSON round-trip at emit (0018), cap (D8), path/conflict fidelity |
| `test/golden-ir/{fixtures,golden-ir.test}.ts` | Modify | move ± force + chained fixtures, key-order + determinism proof; phantom-ADR fix |
| `test/fake/*.test.ts` (+ new wire-modeling file) | Modify/Create | pin fail-closed, round-trip, cap, conflict-order |
| `test/fitness/fit-10-*.test.ts` | Create | structural `EngineClient` port guard + planted-bypass red-proof |
| `test/{skeleton,e2e}/*` | Modify/Create | double-fault red-proof; explicit e2e suite (1.9) |
| `decisions/0019-batch-cap.md` · `docs/CONTRIBUTING.md` · `objectives-plan.md` · `test/conformance/meta.test.ts` | Create/Modify | ADR-0019; pyramid doc; plan reconciliation; 1.6 debt batch |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `contract-fake.ts` shared by C1/C2/C3/C4 — concurrent edits collide | High | Sequence 1.3→1.4→1.7→1.1; slice ordering, not parallel |
| FIT-10 false-positives on the fake's legitimate `EngineClient` import | High | Allow-list mechanism — carried to design as open technical question |
| Cap enforcement drifting to `Session.flush` against ADR-0018 | Medium | D8: fake enforces at emit; plan reconciliation removes "flush" wording; ADR-0019 is the single source |
| Chained-handle fixtures are a NEW multi-directive shape (today pins singles) | Medium | Restructure `fixtures.ts` first; budget explicitly; mirror #2 characterization precedent |
| JSON round-trip SILENTLY drops function/`undefined` (vs throws on circular/BigInt) — data loss reads as success | Medium | Fake COMPARES pre/post round-trip; mismatch → rejection (killer test: function-valued option must REJECT) |
| W6 not provably fixed without a rejecting-`discard()` red-proof | Medium | Write the red-proof first (must fail on today's `context.ts`) |
| Stage-boundary bleed: pinning author-facing attributed-error vocabulary annexes Stage 2 | Medium | Stage 1 scenarios assert the fake REJECTS at the seam only; zero `AuthoringError` vocabulary |

## Rollback Plan

The change is additive + test-heavy with no persistent state, no migration, and no published artifact
(publish is Stage 6). Rollback = revert the branch and validate:
1. Drop the `force?` field from `wire.ts` / `directive-factory.ts` / `commons` / `base-handle.ts` — additive and FIT-04-guarded, so removal restores the committed `.d.ts` baseline exactly; no external consumer exists pre-Stage-6-publish.
2. Revert the fake's fail-closed / round-trip / cap code — this restores the prior (permissively green) fake, re-hiding ADR-0017; acceptable as a rollback because it returns the suite to its known baseline.
3. Delete `test/fitness/fit-10-*`, the new e2e/double-fault tests, `decisions/0019-batch-cap.md`, `docs/CONTRIBUTING.md`, the `boundary-pass-through` / `batch-cap-contract` / `test-pyramid-codification` delta specs; revert the `objectives-plan.md` reconciliation.
4. Validate: full suite + FIT-01..09 green and `.d.ts` baseline unchanged at the prior commit (matching the 188-test pre-change baseline).

No step is irreversible. Post-Stage-6-publish, removing shipped `force?` would be a semver break — but publish is out of scope here, so within the Stage 1 window rollback is clean.

## Dependencies

- ADR-0017 (fail-closed) + ADR-0018 (boundary pass-through): **ratified**. D8 (cap contract): **ratified 2026-07-04**, becomes ADR-0019 at design.
- No external dependency, service, or infrastructure change.

## Success Criteria

- [ ] **C1** Each of the six `Directive` variants has ≥1 golden fixture; `move` has `force` and no-`force` fixtures; ≥1 chained-handle fixture (rename-then-move, create-then-modify); `Batch` key order (`protocolVersion, force, instructions`) asserted (O1 row 1)
- [ ] **C1** Determinism proof: same factory + inputs run twice → byte-identical `Batch` via `JSON.stringify` equality (O1 row 2)
- [ ] **C2** `test/fake/` pins unmocked + red-proofed: move onto an existing destination REJECTS without `force: true`; `modify` of a missing path REJECTS (never materializes); `move` carries `force?` on wire + factory + author surface; FIT-04 confirms additive-only (O1 rows 3, 4)
- [ ] **C4** Fake round-trips each batch through JSON at emit; a function-valued option is REJECTED at the seam (pre/post mismatch), not silently dropped; paths unvalidated; intra-batch conflicts emit in author order (O1 row 5)
- [ ] **C3** Oversized batch (>4 MiB `Buffer.byteLength(JSON.stringify(batch),'utf8')`) REJECTED by the fake with a multi-byte boundary test (exactly-at-cap passes, one-byte-over rejects); empty-factory run-end still reaches `commit()` (pinned, zero production change); ADR-0019 records unit + encoding (O1 row 6)
- [ ] **C5** A rejecting `discard()` after a factory throw preserves the ORIGINAL error, proven by a red-proof that fails on today's `context.ts` (O1 row 7)
- [ ] **C6** FIT-10 green with a planted-bypass red-proof: no module outside `src/core` names the `EngineClient` port or its `.emit`/`.commit`/`.discard` sites; the fake's legitimate import is allow-listed; `Directive`/`JsonValue` exempt (O1 row 11)
- [ ] **C7 + housekeeping** Testing doc maps unit/fitness/integration/e2e to their dirs, CI runs all four, explicit e2e suite exists; `objectives-plan.md` reconciled (item 1.4, Coverage O1 row 6, D8 row); phantom "ADR-0028" corrected to 0013/0017. Existing fitness invariants (commons-no-AST, serializable-bytes, no-tree) stay green; conformance for third parties deferred to 5.6 (O1 row 10 partial)
