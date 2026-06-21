# Exploration: L1 Author Surface (l1-author-surface)

**Triage**: L · **Persona lenses**: architect + qa-engineer + business-analyst (synthesized by orchestrator)
**ready_for_proposal**: partial — gated on 4 product decisions (below) that must be answered before propose.

## Cross-Change Lessons Consulted
- **Primary use case is the WRITE-ONLY factory** (no `.read()`) — foundations-skeleton's masked CRITICAL. Every L1 acceptance criterion must hold on the write-only path, not only read-your-own-write. (obs 648)
- **A lifecycle guarantee in JSDoc is an untested guarantee** — the partial-write/mid-chain contract currently lives only in `context.ts` JSDoc → today untested. Must become a REQ + GWT. (obs 648)
- **Chaining tests must assert the RETURNED handle** — rename/move returned wrong-path handles; masked by reading a "dummy" path. (obs 648)
- **Engine-fidelity asymmetries** (obs 649): fake `move` silently overwrites; fake `modify` of a missing path materializes it. Both bite L1's error surface.

## Affected Flows (A1 — the author writing factory.ts)
| Flow | Current E2E spec | Expected action |
|---|---|---|
| Write-only typed factory (import verbs → typed `create`/`move` → run-end flush → engine applies) | `test/skeleton/*` (flush exists; typed options do NOT) | Modify |
| Typed-options factory (`schema.json` → typed `options` param) | none (greenfield) | Create |
| Read-disk decision (`read(path)` → branch → mutate) | `read-your-own-write` (staged only; read-disk untested at author surface) | Modify |
| Error-to-author on rejection (author sees `rename`, not `OpMove`/`ContractFake:`) | none (raw strings bubble up) | Create |
| Mid-chain rejection (link N rejected after 1..N-1 applied eagerly) | none (unobservable today) | Create |
| Dry-run plan (author sees plan before apply) | none — **scope-ambiguous (Q2)** | Create or Defer |

## Current State (grounded in code)
- **`options` is bare `JsonValue`** (`commons/index.ts:22`, `wire.ts`, `directive-factory.ts`). Zero schema.json plumbing. The §4 differentiator does not exist yet.
- **`read()` is async end-to-end already**: `base-handle.ts ReadOps.read(): Promise<string>` → `session.read()` → `engine-client.read()`. ADR-0001 froze this as async (Accepted).
- **Errors are raw + unattributed**: the contract fake throws `ContractFake: ...` strings; `Session.read/flush` never catch; the engine's class name + `OpMove` vocabulary leak straight to the author. No attribution seam exists.
- **Mid-chain partial state is unobservable**: `flush()` splices the whole buffer into one batch; the fake applies op-by-op; a throw at op N leaves ops 1..N-1 mutated in the tree with **no signal** of the applied boundary.
- **No frame-cap anywhere**: no byte-size concept in `wire`, `session`, or the fake.

## Architecture Touchpoints (A3 — against baseline obs 652)
| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `commons/index.ts` (author verbs) | modify | typed `options` generic; surface author-error type | aligns |
| `core/session.ts` (flush + 2 client call sites) | modify | frame-cap enforcement + error-attribution chokepoint + applied-boundary | aligns |
| `core/engine-client.ts` / `wire.ts` | read-only/modify | confirm error + frame-cap stay above the seam; possible applied-boundary signal | aligns |
| `core/context.ts` (partial-write) | extend | mid-chain rejection extends the finally-flush contract | aligns |
| **Typed-options derivation (type-level)** | **new** | schema→options parity at the type level | **deviates → ADR** |
| **Error-to-author attribution seam (core)** | **new** | translate engine rejection → author-vocabulary error w/ originating directive | **deviates → ADR** |
| **Frame-cap enforcement point** | **new** | no byte-size concept exists; ownership undecided | **deviates → ADR** |
| `package.json#files` / tarball shape | modify | strip/gate `dist/core/**` before first public release (baseline anomaly, now load-bearing) | aligns (closes anomaly) |

**3 `deviates` rows** → 3 ADRs minimum in design.

## Sensitive Areas Crosscheck
No security override. Public-API contract surface is review-required (tech-writer + architect) — a stability concern, consistent with triage.

## Approaches (the load-bearing choices)
**Typed-options — RECOMMEND type-level derivation (no runtime schema read, no codegen).** Keeps `commons` dependency-free + FIT-01-clean, matches the codebase's `expect-type`/`permissive-proof` culture, ships nothing new in the tarball. Build-time codegen and runtime JSON-Schema validator both `deviate` (new build machinery / breaks FIT-01) and are unjustified at a first public release where surface minimalism is the game.

**Mid-chain error surface — RECOMMEND observable applied-boundary (QA Approach 1).** The contract must be *observable to be testable*: the applied boundary becomes a first-class value (engine returns/throws the failing op index, or per-op flush). The alternative (one opaque batch throw) makes the boundary unknowable → the error message is vague or wrong → assertions survive the bug they should catch (recurrence of the skeleton green-but-broken class). NOTE: a real applied-boundary signal likely needs a wire change → surfaces the engine §6 dependency.

**Error-attribution — seam in `core/` wrapping `EngineClient` at Session's two call sites** (single emit chokepoint per ADR-0009). Error *classes* are author-facing (re-exported); error *mapping* is core.

**Frame-cap — enforce at the `Session.flush()` boundary; value owned by the wire contract**, not a hard-coded SDK literal (ADR-0008 two-source-of-truth risk).

## ADR Candidates (5 — at the L ceiling)
1. Typed options derived at the type level (no runtime read, no codegen).
2. Error-attribution seam wraps `EngineClient` inside `core`.
3. `read()` ratified **async** — a *confirming* ADR citing ADR-0001, NOT a fresh decision.
4. Frame-cap enforced at flush boundary, value owned by the wire contract.
5. Mid-chain partial-state semantics on rejection (no rollback; observable applied-boundary).

## Fitness Functions (extend/new)
- Extend FIT-01 (commons-no-AST) to catch an accidental runtime JSON-Schema validator (W2 transitive-import upgrade becomes load-bearing).
- New: error *classes* author-facing, mapping logic NOT kit-bled (parallels FIT-08).
- New: frame-cap forces a flush at the wire boundary.
- FIT-04 (.d.ts semver gate) guards every new exported name — the dts-baseline must be regenerated deliberately.
- Type-level: positive (`expect-type`) + negative (`permissive-proof`) proofs for schema→options parity.

## Risks
- **HIGH** — mid-chain contract untestable-by-construction if design keeps an opaque one-batch throw (highest QA risk).
- **HIGH** — `dist/core/**` ships in the tarball; at first public release new core symbols become bypassable public surface, semver-locked. Architect: close at L1, not at kit extraction.
- **HIGH** — typed-options landing dictates dependency direction; a runtime validator can't live in `commons` (FIT-01).
- **MED** — frame-cap boundary tests are vacuous unless the contract fake models the cap (FAKE-fidelity false-green).
- **MED** — W6 double-fault (finally-flush rejects, original error lost) sits on the mid-chain error path.
- **MED** — read-disk currently asserted only at the fake level (FAKE-02), never through the author `read(path)` surface.

## Open Questions
- **type: product (BLOCKING)** — Q1 `read()` is already frozen async (ADR-0001 + full stack). Ratify-and-document (recommended) or genuinely re-open (requires unfreezing ADR-0001 — larger than L1)?
- **type: product (BLOCKING)** — Q2 Is the §9 dry-run plan in L1, or deferred to T-M2? §9 demo features it; §9.2/scope omits it; it renders from the coalesced-IR view that T-M2 owns. Recommend defer.
- **type: product** — Q3 Mid-chain rejection contract: error enumerates applied ops + states the tree is partially mutated, no rollback (transparency, recommended, consistent with ADR-0001/0008) — or a stronger guarantee?
- **type: product/scope** — Q4 Close the `dist/core/**` tarball leak at L1 (strip/gate exports), or keep deferred to kit extraction?
- **type: technical** — frame-cap = engine wire-contract value vs SDK constant (+ inclusive/exclusive boundary). [→ spec/design]
- **type: technical** — schema.json → typed options resolution: author-time type derivation, independent of any runtime file lookup. [→ spec/design]
- **type: technical** — pin/fix/defer the two engine-fidelity asymmetries (fake `move` silent-overwrite, `modify` materializes-missing). [→ spec/design]
- **type: technical** — fix W6 (preserve original `fn` error when finally-flush also rejects) within L1? [→ spec/design]

## Product Decisions (resolved with user — 2026-06-21)
- **Q1 → validate async with EVIDENCE, not by decree.** read() stays async, but L1 does NOT inherit ADR-0001 by decree — it runs a SPIKE (§9.0) to gather the read-through evidence and RATIFY async, then writes a confirming ADR citing ADR-0001. (Adds a spike to L1.) The IPC process-boundary makes sync infeasible; the spike documents that rather than asserting it.
- **Q2 → dry-run plan IS in L1.** Rendered author-side from the commons directive buffer (`Session.#pending`), AST-blind, in author vocabulary (rename shows as rename). SCOPE GUARD: renders commons directives ONLY — no dialect ops / `.raw` (those stay T-M2). No T-M2 coalescing needed (commons verbs are already discrete directives). (Adds the dry-run plan capability to L1.)
- **Q3 → all-or-nothing COMMIT contract.** A failed run (uncaught error) commits NOTHING; the partial set lives only in the discarded staging tree. ACTIONS: reword `context.ts` partial-write contract (from "no rollback, partial applied" → "staging is transactional; a failed run commits nothing"); MODEL commit/discard in the contract fake so L1 can test it; mark the engine §6 dependency (real transactional commit is an engine deliverable). The caught-and-continue path (author catches mid-chain error and proceeds with partial staging) is the author's responsibility — spec defines the messaging.
- **Q4 → close the dist/core tarball leak at L1.** Strip/gate `dist/core/**` from the published tarball before the first public release (was a deferred followup; promoted into L1).

### Technical questions → injected into spec/design
- Frame-cap = engine wire-contract value (confirm), NOT an SDK-invented constant (+ inclusive/exclusive boundary).
- Typed-options = type-level derivation, author-time, independent of any runtime file-location lookup.
- Engine-fidelity asymmetries (fake `move` silent-overwrite; `modify` materializes-missing) — pin/fix/defer for the error surface.
- W6 double-fault — fix (preserve original `fn` error when finally-flush also rejects) within L1.

## Ready for Proposal
**Status**: READY — all 4 product questions resolved (above); 4 technical questions injected into spec/design. Carry the 3 `deviates` rows as ADRs + the 5 ADR candidates. Budget a blind judgment-day pass for the error half (obs 648). NOTE: Q1 (spike) + Q2 (dry-run plan) + the commit-model-in-fake (Q3) GROW L1 beyond the original triage estimate — propose/slice must re-check whether this is still L or has crossed into XL (decompose).
