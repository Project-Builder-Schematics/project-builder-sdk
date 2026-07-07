# Pending Changes

Followups registered from archived changes. Visible to future `/plan` grooming.

> **Groomed 2026-07-04** against the WHAT-level delivery plan (`openspec/objectives-plan.md`).
> Every row carries a **Stage** tag from that plan (or an explicit "not now"). The stage item is
> now the unit of scheduling; this file remains the debt ledger of record.

## From `typed-options-and-read` (2026-06-24) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| JD test-hardening (low): `permissive-proof.guard.test.ts` — derive the red-proof simulated line from `idiom2Lines[0]` instead of hardcoded 57; tighten `parseDiagnostics` regex / `fileMatch` for path-collision robustness (theoretical) | refactor | XS | — | **1.6** |
| CQ-2: real end-to-end typed-factory example (actual schema type, real options object, real file) vs synthetic matrix in `typed-create.test.ts` | docs | S | — | **4.4** |

> Note: `typecheck:permissive-proof` masked-exit followup (from #1 skeleton archive) is DONE — resolved by `permissive-proof.guard.test.ts` in this change. Removed from pending.

> **Retired 2026-07-06 (stage-2-error-attribution archive)**: the "read not-found is a VALUE
> (ADR-0016)" forward note is HONORED (design treated not-found as a value; `classifyContent`
> shipped); CQ-1 read-trichotomy is RETIRED — S-004 shipped `classifyContent` + `ContentState`
> (`openspec/specs/read-trichotomy-helper/`), not dropped.

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
| (1.2 verify follow-up) Extract shared `EngineClient` spy helper — duplicated across `test/golden-ir/chained-batch.test.ts` (`makeSpy`) and `test/golden-ir/determinism.test.ts` (inline) — create `test/support` helper | refactor | XS | — | **1.7 (backlog)** |
| (1.1 verify follow-up) Test-support: extract shared `EngineClient` spy helper (duplicated across chained-batch/determinism tests) | refactor | XS | — | **1.7 (backlog)** |
| (1.6 verify follow-up) Stage 6 — confirm `BATCH_CAP_BYTES` against the real engine frame limit before freeze + consider structural no-consumer-outside-wire.ts scan. *Engine-side verified 2026-07-06: same seam as `bunipc.MaxMessageBytes` (4 MiB), values coincide; will be named as a contract value in engine PC-PROTO-01 — keep the "not engine-confirmed" flag until then* | edge-case | S | Before Stage 6 freeze (PC-PROTO-01 names it) | **6** |
| (1.9 verify follow-up) Doc note: FIT-04 gate is blind to intentional-surface slices that regen baselines in the same change — additivity must be argued out-of-band | docs | XS | — | **1.6 (design note)** |

> **Retired 2026-07-06 (stage-2-error-attribution archive)**: "2.1 attribution granularity (M)"
> DELIVERED — structured `EmitRejection` metadata + actual-offender attribution shipped
> (REQ-12/14/15, ADR-0022). The "non-Error E1 E2-swallow (S)" row is RE-REGISTERED still-open
> and the "rejection-message locators (S, nice-to-have)" row is RE-DEFERRED — both moved to the
> `stage-2-error-attribution` section below.

## From `stage-2-error-attribution` (2026-07-06) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Verify-final followup #1 (FIT-04 `DTS_PAIRS` pairs for
`core.authoring-error.d.ts` + `commons.classify-content.d.ts`) was **CLOSED IN-CHANGE** by
commit `6c136aa`, confirmed by verify-in-loop-4 and the amended architecture audit — recorded
here as completed, NOT pending.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| EmitRejection port conformance for the real engine client: a directive-level code without in-range `failedIndex` yields a malformed public message ("undefined failed at undefined: …") and a spurious index on batch-level codes contradicts REQ-14.3 (judgment-day CONFIRMED theoretical, both judges). Decide at Stage 6: enforce the precondition in the client, or degrade to `reason: "unknown"` in `toAuthoringError`. The convention is baseline-recorded and binds the Stage-6 engine (ADR-0022 revisit) | edge-case | M | **Stage-6 gating** | **6** |
| Positive type pins for `AuthoringError["verb"]`/`["path"]` `\| undefined` arms (`expectTypeOf`), + optional frozen pre-change baseline snapshot pattern for FIT-04 in-change regen blindness (Judge A + Judge B convergent) | refactor | S | test-only | **2 (hardening backlog)** |
| `primaryPath` source-side on rename/move/copy collisions points the author at the non-colliding path (ratified design §4.3; DX wart) — revisit whether the dialect family surfaces the colliding destination before the message contract ossifies further | other | S | — | **5 (note)** |
| `defineFactory` silently drops factory return values — plausible author mistake with zero signal today (steward) | edge-case | S | DX telemetry | **backlog** |
| Promote REQ-16 tags into the 4 untagged non-site source comments so the doc-discoverability pin can become a pure source scan (S-003 note) | refactor | S | — | **backlog (cleanup)** |
| (re-registered from stage-1) non-Error E1 + rejecting `discard()` silently drops E2 — `context.ts` double-fault machinery deliberately untouched this change (REQ-16 non-site, PM tripwire document-only) | edge-case | S | Non-blocking | **still-open** |
| (re-deferred from stage-1) round-trip/cap rejection messages could name the offending directive/field and non-finite value family | docs | S | — | **nice-to-have** |

## From `stage-3-dry-run-exposure` planning (2026-07-06) — registered at steward foresight

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| (steward CQ-2, owner-ratified) Demo-moment narrative restructure: the objectives-plan end-state demo interleaves a dialect read BEFORE showing the dry-run plan — under eager-flush that shows a PARTIAL plan. Restructure the demo to call `dryRun()` before any read/dialect-open | docs | XS | When Stage 5/6 materialize the demo | **6.3** |
| (design ADR-0026) Outside-run error enumeration omits `dryRun` — generalise the `context.ts` message (post-stage-2 shape: `AuthoringError` constructor prose) while preserving the pinned "…can only be used while a schematic is running…" substring | refactor | XS | After stage-2 AND stage-3 merge | **post-merge** |
| (design ADR-0024/0025) Single-source extraction: wire→author verb map + `DryRunVerb`/`AuthoringVerb` union duplicated across `src/dry-run/plan.ts` and `src/core/authoring-error.ts` by deliberate no-coupling rule — extract to one home once both stages are merged. Includes hoisting stage-3's mid-file imports in `src/commons/index.ts` to the top cluster (architect note) | refactor | S | After stage-2 AND stage-3 merge | **post-merge** |
| (archive 2026-07-07, judgment-day Judge A) Test hardening: REQ-DRE-02 `.d.ts` scans in `test/skeleton/dry-run-public-contract.test.ts` target the COMMITTED baseline, not fresh `dist/` output — point them at the freshly-built artifact so additive leaks can't ride a stale baseline | test | XS | — | **anytime** |
| ~~(archive 2026-07-07, blind judges) /simplify candidates for the immediate post-archive pass: renderer switch should index `WIRE_TO_AUTHOR_VERB[d.op]` instead of per-arm hardcoded keys (CONFIRMED by both judges); `Object.freeze` the map so "frozen" is literal; `DryRunEntry` example self-containment~~ **DONE 2026-07-07 `a96acc7` (/simplify pass)** — commons `@example` runnability intentionally NOT changed: REQ-DRE-04.1 mandates the `defineFactory` token and the runner isn't public until Stage 6, so a fully-runnable example is impossible today | refactor | XS | — | ~~immediate post-archive /simplify pass~~ **closed** |

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
| **Ownership transfer (owner 2026-07-06; semantics ratified 2026-07-06 at stage-4 explore)**: lifecycle reserved names are TWO namespaces — `pre-execute`/`post-execute` are SCHEMATIC-level (factory module lifecycle hooks; enforcement in Stage 4.3, `defineFactory` runner) and `add`/`remove` are COLLECTION-level (no collection concept exists yet — L2 territory). Stage 4.3 enforces the schematic pair; the collection pair stays reserved-by-documentation and its enforcement is REGISTERED for the L2/composition stage — it must not silently vanish. Note: `remove` collides with the shipped author verb only lexically — different namespace (collection entry vs SDK API) | feature | M | 4.3 (schematic pair); L2 (collection pair) | **4.3 + L2** |
| **Ownership transfer — RESOLVED (owner 2026-07-06)**: auto-prompt parity ratified as a schema-sufficiency CONTRACT, not a feature — the guard rail stands (the SDK renders no prompts; the Go CLI renders, consuming `schema.json`), and the SDK guarantees `schema.json` carries enough to derive prompts (labels, descriptions, defaults, types). Folded into `stage-4-typed-options` scope (4.2/4.3); council requires it encoded as a fitness function, not prose | other | — | In flight (stage-4-typed-options) | **4.2** |
| **Split from `stage-4-typed-options` (re-triage trigger, owner 2026-07-06)**: `stage-4b-testing-harness` — facade harness at `./testing` (`runFactoryForTest` wrapping the ONE normative `ContractFake` + `defineFactory`, no name re-exports), ADR-0009 amendment (third audience: author-testing), 4 companion guards (FIT-08 carve-out, dev-only bundle guard, FIT-04 dts baseline, FIT-09 exports entry), fail-closed parity invariant, AND `defineFactory` reachability (unreachable from any installed package today — `./core` unwired). ★D7 direction already owner-RATIFIED (facade); the change needs its own spec/design cycle. **OWNER COMMITMENT (steward foresight CQ1, 2026-07-07): COMMITTED-NEXT — stage-4's `aligned` verdict is conditional on 4b following; if 4b slips, stage-4's outcome crystallizes as outputs-without-outcome (steward reckoning will check)** | feature | L→M | Own /plan cycle IMMEDIATELY after stage-4 | **4.5 (own change, committed-next)** |
| Stage 2 error contract is **SDK-proposed, engine-unconfirmed until PC-PROTO-01**: the six `reason` values (`path-collision`, `path-not-found`, `unrepresentable-content`, `changes-too-large`, `unknown`, `outside-run`) and rejection-metadata field names (`verb`/`path`/`reason`/`appliedCount`) await the mapping REQ (engine `SystemError`/`DeveloperError`+`DeveloperFault` ↔ wire error shape ↔ SDK `origin`+`reason`). Stated assumptions for that ADR to confirm or correct: emit-rejection ⇒ `origin: "write-rejected"` (directive-level: `path-collision`/`path-not-found`; batch-level: `unrepresentable-content`/`changes-too-large`; unmapped ⇒ degrade to `unknown` per REQ-ERM-03); `outside-run` is SDK-local `authoring-rejected`, no engine mapping. `origin` itself is SDK-relative — nothing to unfreeze | other | — | PC-PROTO-01 ratification (non-blocking for Stage 2 build) | **2 (flag)** |
