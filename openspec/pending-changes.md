# Pending Changes

Followups registered from archived changes. Visible to future `/plan` grooming.

> **Groomed 2026-07-04** against the WHAT-level delivery plan (`openspec/objectives-plan.md`).
> Every row carries a **Stage** tag from that plan (or an explicit "not now"). The stage item is
> now the unit of scheduling; this file remains the debt ledger of record.

## From `typed-options-and-read` (2026-06-24) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Forward note** (was "design input for #3"; #3 superseded): `EngineClient.read` no longer throws on not-found — it returns `undefined` (ADR-01). Error-attribution design MUST treat not-found as a return value, NOT an attributable error | other | — | **Design input for Stage 2.1** | **2.1** |
| JD test-hardening (low): `permissive-proof.guard.test.ts` — derive the red-proof simulated line from `idiom2Lines[0]` instead of hardcoded 57; tighten `parseDiagnostics` regex / `fileMatch` for path-collision robustness (theoretical) | refactor | XS | — | **1.6** |
| CQ-1: read trichotomy affordance — lint rule or named result helper for `=== undefined` to prevent callers from using truthiness-coalescing accidentally | refactor | S | — | **2.3** |
| CQ-2: real end-to-end typed-factory example (actual schema type, real options object, real file) vs synthetic matrix in `typed-create.test.ts` | docs | S | — | **4.4** |

> Note: `typecheck:permissive-proof` masked-exit followup (from #1 skeleton archive) is DONE — resolved by `permissive-proof.guard.test.ts` in this change. Removed from pending.

## From `foundations-skeleton` (2026-06-21) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| W3 · `publish.yml` repo-owner guard (`if: github.repository == '…'`) — fork-own-`main` reaches OIDC | security | XS | **Before first LIVE publish** | **6.2** |
| W1 · REQ-PKG-01 live-resolution smoke test (pack→install→assert `/core` throws, `/commons` resolves) | edge-case | S | Before live publish | **6.2** |
| W2 · FIT-01 import-graph depth — follow relative imports transitively (catch AST via `core`) | refactor | S | Before first real dialect | **5.0 (hard pre-gate)** |
| W5 · REQ-STD-01 guarding test (SECURITY verbatim sentence + dialect-doc outline) | docs | XS | — | **5.7** |
| W6 · `defineFactory` finally-flush must preserve the original `fn` error if flush also rejects | refactor | XS | — | **1.5** |
| W7 · FIT-04 unconditional `beforeAll` rebuild instead of fragile mtime gate | refactor | XS | — | **1.6** |
| Pin `actions/checkout` + `actions/setup-node` to commit SHAs (match `setup-bun`) | security | XS | — | **6.2** |
| `dist/core/**` ships in tarball — strip or document the ADR-0009 boundary as advisory | docs | S | At `@pbuilder/sdk-kit` extraction | **6.2 (strip-or-document)** |
| Add a `prebuild` clean so a local build can't ship stale `dist/` artifacts | refactor | XS | — | **6.2** |
| `test/conformance/meta.test.ts` — drop the tautological `[red-proof]` label | docs | XS | — | **1.6** |
| `withOps` op-name collision diagnostic (ADR-0010) | refactor | S | T-M2 | **5.3** |

### Fake-semantics questions (REFRAMED 2026-07-04 — was "resolve against the real engine")

The problem statement makes the contract fake the **legitimate counterpart**, so these can no
longer defer to a real engine. **★ DECISION D1 is RATIFIED — ADR-0017** (fail-closed; `move`
gains `force?`; `modify` requires existence). Stage 1.3 closes the fake to match.

| Question | Stage |
|---|---|
| Fake `move` silently overwrites an existing destination — ratified fail-closed + `force` (ADR-0017) | **1.3 (implement)** |
| Fake `modify` of a non-existent path materializes the file — ratified as ERROR (ADR-0017) | **1.3 (implement)** |

## From `stage-1-ir-bedrock` (2026-07-05) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| (1.4 verify follow-up) Stage 2.1 — attribution granularity: `session.ts` attributes every emit rejection to `instructions[0]` and `authoring-error.ts` discards the raw offender string; Stage 2.1 must carry offending directive/index in a structured rejection and treat `authoring-error.ts` as in-scope | refactor | M | Stage 2.1 design gate | **2.1** |
| (1.4 verify follow-up) Stage 2.1 — non-Error E1 + rejecting `discard()` silently drops E2; context-ts guard limitation; verify-pass with caveat in design/apply notes | edge-case | S | Non-blocking, document in 2.1 | **2.1** |
| (1.4 verify follow-up) Stage 2.1 — round-trip/cap rejection messages could name the offending directive/field and non-finite value family | docs | S | — | **2.1 (nice-to-have)** |
| (1.2 verify follow-up) Extract shared `EngineClient` spy helper — duplicated across `test/golden-ir/chained-batch.test.ts` (`makeSpy`) and `test/golden-ir/determinism.test.ts` (inline) — create `test/support` helper | refactor | XS | — | **1.7 (backlog)** |
| (1.1 verify follow-up) Test-support: extract shared `EngineClient` spy helper (duplicated across chained-batch/determinism tests) | refactor | XS | — | **1.7 (backlog)** |
| (1.6 verify follow-up) Stage 6 — confirm `BATCH_CAP_BYTES` against the real engine frame limit before freeze + consider structural no-consumer-outside-wire.ts scan. *Engine-side verified 2026-07-06: same seam as `bunipc.MaxMessageBytes` (4 MiB), values coincide; will be named as a contract value in engine PC-PROTO-01 — keep the "not engine-confirmed" flag until then* | edge-case | S | Before Stage 6 freeze (PC-PROTO-01 names it) | **6** |
| (1.9 verify follow-up) Doc note: FIT-04 gate is blind to intentional-surface slices that regen baselines in the same change — additivity must be argued out-of-band | docs | XS | — | **1.6 (design note)** |

## From `stage-3-dry-run-exposure` planning (2026-07-06) — registered at steward foresight

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| (steward CQ-2, owner-ratified) Demo-moment narrative restructure: the objectives-plan end-state demo interleaves a dialect read BEFORE showing the dry-run plan — under eager-flush that shows a PARTIAL plan. Restructure the demo to call `dryRun()` before any read/dialect-open | docs | XS | When Stage 5/6 materialize the demo | **6.3** |
| (design ADR-0026) Outside-run error enumeration omits `dryRun` — generalise the `context.ts` message (post-stage-2 shape: `AuthoringError` constructor prose) while preserving the pinned "…can only be used while a schematic is running…" substring | refactor | XS | After stage-2 AND stage-3 merge | **post-merge** |
| (design ADR-0024/0025) Single-source extraction: wire→author verb map + `DryRunVerb`/`AuthoringVerb` union duplicated across `src/dry-run/plan.ts` and `src/core/authoring-error.ts` by deliberate no-coupling rule — extract to one home once both stages are merged. Includes hoisting stage-3's mid-file imports in `src/commons/index.ts` to the top cluster (architect note) | refactor | S | After stage-2 AND stage-3 merge | **post-merge** |
| (archive 2026-07-07, judgment-day Judge A) Test hardening: REQ-DRE-02 `.d.ts` scans in `test/skeleton/dry-run-public-contract.test.ts` target the COMMITTED baseline, not fresh `dist/` output — point them at the freshly-built artifact so additive leaks can't ride a stale baseline | test | XS | — | **anytime** |
| (archive 2026-07-07, blind judges) /simplify candidates for the immediate post-archive pass: renderer switch should index `WIRE_TO_AUTHOR_VERB[d.op]` instead of per-arm hardcoded keys (CONFIRMED by both judges); `Object.freeze` the map so "frozen" is literal; `@example` runnability polish in commons JSDoc + `DryRunEntry` example self-containment | refactor | XS | — | **immediate post-archive /simplify pass** |

## From engine handoff `l1-completion-gaps` (2026-07-06) — cross-repo contract notes

Engine-repo explore + owner decisions, transferred 2026-07-06. Engine references: engine
ADR-0027 (schematic runs in the SDK runtime), ADR-0028 (`create` carries already-resolved
`options`), ADR-0029 (templating renders `options` opaquely, fail-closed), and the upcoming
**PC-PROTO-01** (transport protocol — real `ir.emit`/`tree.read` + first-class error-mapping
REQ, mirrored ADR expected here like the ADR-0028 adoption). Real-wire integration unblocks
at PC-PROTO-01; engine sequencing before it: producer-fate ADR → PC-TM-01 templating →
`Engine.Execute` (S5).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Ownership transfer (owner 2026-07-06)**: lifecycle reserved names (`add`/`remove`/`pre-execute`/`post-execute`) — the engine never sees the schematic model (engine ADR-0027/0028), so reserved-name enforcement is SDK-side. Covered by NO current stage item; natural home is 4.3 (factory package shape / `defineFactory` runner). Scope it at the Stage 4.3 design gate | feature | M | Stage 4.3 design gate | **4.3** |
| **Ownership transfer — CONFLICT, owner call needed**: auto-prompt parity from `schema.json` was in the transferred engine-ROADMAP bullet, but "prompt UX from `schema.json`" sits in this plan's out-of-scope guard rails (`objectives-plan.md` §Out of scope). Owner must either amend the guard rail (new Stage 4 item) or re-route it (the Go CLI renders prompts; the schema is SDK-owned — parity could be a contract, not a feature here) | other | — | Owner ratification | **not now (conflict)** |
| Stage 2 error contract is **SDK-proposed, engine-unconfirmed until PC-PROTO-01**: the six `reason` values (`path-collision`, `path-not-found`, `unrepresentable-content`, `changes-too-large`, `unknown`, `outside-run`) and rejection-metadata field names (`verb`/`path`/`reason`/`appliedCount`) await the mapping REQ (engine `SystemError`/`DeveloperError`+`DeveloperFault` ↔ wire error shape ↔ SDK `origin`+`reason`). Stated assumptions for that ADR to confirm or correct: emit-rejection ⇒ `origin: "write-rejected"` (directive-level: `path-collision`/`path-not-found`; batch-level: `unrepresentable-content`/`changes-too-large`; unmapped ⇒ degrade to `unknown` per REQ-ERM-03); `outside-run` is SDK-local `authoring-rejected`, no engine mapping. `origin` itself is SDK-relative — nothing to unfreeze | other | — | PC-PROTO-01 ratification (non-blocking for Stage 2 build) | **2 (flag)** |
