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
| ~~W3 · `publish.yml` repo-owner guard (`if: github.repository == '…'`) — fork-own-`main` reaches OIDC~~ **RETIRED — `stage-6-release-shape`** (2026-07-14) — S-002 landed the guard in `publish.yml` | security | XS | ~~Before first LIVE publish~~ | ~~**6.2**~~ **closed** |
| ~~W1 · REQ-PKG-01 live-resolution smoke test (pack→install→assert `/core` throws, `/commons` resolves)~~ **SUBSUMED 2026-07-12 (`stage-4b-testing-harness` archive)** — REQ-TES-06's installed-consumer-vantage e2e (`test/e2e/installed-consumer.e2e.test.ts`) delivers the same pack→install→resolution mechanic plus the two founding-bug behavioural scenarios; W1 is superseded, not duplicated | edge-case | S | ~~Before live publish~~ **closed** | ~~6.2~~ |
| W2 · FIT-01 import-graph depth — follow relative imports transitively (catch AST via `core`) | refactor | S | Before first real dialect | **5.0 (hard pre-gate)** |
| W5 · REQ-STD-01 guarding test (SECURITY verbatim sentence + dialect-doc outline) | docs | XS | — | **5.7** |
| W6 · `defineFactory` finally-flush must preserve the original `fn` error if flush also rejects | refactor | XS | — | **1.5** |
| W7 · FIT-04 unconditional `beforeAll` rebuild instead of fragile mtime gate | refactor | XS | — | **1.6** |
| ~~Pin `actions/checkout` + `actions/setup-node` to commit SHAs (match `setup-bun`)~~ **RETIRED — `stage-6-release-shape`** (2026-07-14) — S-002 SHA-pinned both actions in `publish.yml`/`ci.yml` | security | XS | — | ~~**6.2**~~ **closed** |
| ~~`dist/core/**` ships in tarball — strip or document the ADR-0009 boundary as advisory~~ **RETIRED — `stage-6-release-shape`** (2026-07-14) — documented, not stripped, per the ADR-0034 amendment (REQ-FPS-06) | docs | S | ~~At `@pbuilder/sdk-kit` extraction~~ | ~~**6.2 (strip-or-document)**~~ **closed** |
| ~~Add a `prebuild` clean so a local build can't ship stale `dist/` artifacts~~ **RETIRED — `stage-6-release-shape`** (2026-07-14) — S-000 added `package.json#scripts.prebuild` | refactor | XS | — | ~~**6.2**~~ **closed** |
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
| (1.6 verify follow-up) Confirm `BATCH_CAP_BYTES` against the real engine frame limit before freeze + consider structural no-consumer-outside-wire.ts scan. *Engine-side verified 2026-07-06: same seam as `bunipc.MaxMessageBytes` (4 MiB), values coincide; will be named as a contract value in engine PC-PROTO-01 — keep the "not engine-confirmed" flag until then* — **RE-TAGGED to PC-PROTO-01/public-package plan (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.4)**. **ADVANCE-NOTE 2026-07-15 (`stdio-engine-client` REQ-WPS-06/REQ-FEH-06)**: the value is now a MECHANICALLY-PINNED cross-repo contract — `docs/engine-sdk-wire-spec.md` § Frame-Cap Constant (WPS-06) names `BATCH_CAP_BYTES == 4194304`, and `fit-34` fails the SDK's own suite if `src/core/wire.ts`'s export ever drifts from that literal. The "not engine-confirmed" flag STAYS until PC-PROTO-01 names the value engine-side | edge-case | S | Before public-package plan freeze (PC-PROTO-01 names it) | **PC-PROTO-01 / public-package plan** |
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
| EmitRejection port conformance for the real engine client: a directive-level code without in-range `failedIndex` yields a malformed public message ("undefined failed at undefined: …") and a spurious index on batch-level codes contradicts REQ-14.3 (judgment-day CONFIRMED theoretical, both judges). Enforce the precondition in the client, or degrade to `reason: "unknown"` in `toAuthoringError`. The convention is baseline-recorded and binds the real engine client (ADR-0022 revisit) — **RE-TAGGED away from Stage 6 (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.2): no real `EngineClient` exists in this repo**. **SPLIT 2026-07-15 (`stdio-engine-client` S-005.4, REQ-LED-01)**: a real `EngineClient` now exists (`StdioEngineClient`) — its `reconstructEmitRejection` (`src/transport/stdio-engine-client.ts`) enforces EXACTLY this precondition (a directive-level code without a valid `failedIndex` degrades to `reason: "unknown"`, never a spurious index) — the SDK-SIDE half is DELIVERED. The engine-side complement (`SystemError`/`DeveloperError` → wire error shape mapping) stays cross-repo debt, unchanged | edge-case | M | Cross-repo — engine ADR-0022 revisit (PC-PROTO-01); SDK-side closed | **PARTIAL — SDK-side delivered (`stdio-engine-client`); engine-side mapping remains engine repo, cross-repo flag (with PC-PROTO-01)** |
| Positive type pins for `AuthoringError["verb"]`/`["path"]` `\| undefined` arms (`expectTypeOf`), + optional frozen pre-change baseline snapshot pattern for FIT-04 in-change regen blindness (Judge A + Judge B convergent) | refactor | S | test-only | **2 (hardening backlog)** |
| `primaryPath` source-side on rename/move/copy collisions points the author at the non-colliding path (ratified design §4.3; DX wart) — revisit whether the dialect family surfaces the colliding destination before the message contract ossifies further | other | S | — | **5 (note)** |
| `defineFactory` silently drops factory return values — plausible author mistake with zero signal today (steward) | edge-case | S | DX telemetry | **backlog** |
| Promote REQ-16 tags into the 4 untagged non-site source comments so the doc-discoverability pin can become a pure source scan (S-003 note) | refactor | S | — | **backlog (cleanup)** |
| (re-registered from stage-1) non-Error E1 + rejecting `discard()` silently drops E2 — `context.ts` double-fault machinery deliberately untouched this change (REQ-16 non-site, PM tripwire document-only) | edge-case | S | Non-blocking | **still-open** |
| (re-deferred from stage-1) round-trip/cap rejection messages could name the offending directive/field and non-finite value family | docs | S | — | **nice-to-have** |

## From `stage-3-dry-run-exposure` planning (2026-07-06) — registered at steward foresight

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| ~~(steward CQ-2, owner-ratified) Demo-moment narrative restructure: the objectives-plan end-state demo interleaves a dialect read BEFORE showing the dry-run plan — under eager-flush that shows a PARTIAL plan. Restructure the demo to call `dryRun()` before any read/dialect-open~~ **RETIRED — `stage-6-release-shape`** (2026-07-14) — S-005 reordered `openspec/objectives-plan.md`'s demo-moment paragraph (REQ-AOD-10) | docs | XS | ~~When Stage 5/6 materialize the demo~~ | ~~**6.3**~~ **closed** |
| ~~(design ADR-0026) Outside-run error enumeration omits `dryRun` — generalise the `context.ts` message (post-stage-2 shape: `AuthoringError` constructor prose) while preserving the pinned "…can only be used while a schematic is running…" substring~~ **DONE 2026-07-13 (`schematic-local-files` final-verify remediation, ITEM 7)** — `messageFor`'s `outside-run` template dropped the `(create, find, modify, remove, rename, move, copy)` enumeration entirely (now: "authoring verbs can only be used…"), so it covers `dryRun` and every future verb without a per-verb edit; pinned substring preserved byte-for-byte, no test changed | refactor | XS | ~~After stage-2 AND stage-3 merge~~ | ~~**post-merge**~~ **closed** |
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

> **SDK-side inputs now available (2026-07-15, `stdio-engine-client` REQ-LED-01)**:
> PC-PROTO-01's engine-side ratification now has concrete SDK-side artifacts to build against —
> `docs/engine-sdk-wire-design.md` rev 3 (historical decision trail, superseded sections marked)
> and the NEW normative `docs/engine-sdk-wire-spec.md` (methods, error shapes, pointer grammar,
> cap-constant naming, exit codes, bridge-contract section, wire-spec version 1). See the
> cross-repo tether row registered under `stdio-engine-client` below.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Ownership transfer (owner 2026-07-06; semantics ratified 2026-07-06 at stage-4 explore)**: lifecycle reserved names are TWO namespaces — `pre-execute`/`post-execute` are SCHEMATIC-level (factory module lifecycle hooks; enforcement in Stage 4.3, `defineFactory` runner) and `add`/`remove` are COLLECTION-level (no collection concept exists yet — L2 territory). Stage 4.3 enforces the schematic pair; the collection pair stays reserved-by-documentation and its enforcement is REGISTERED for the L2/composition stage — it must not silently vanish. Note: `remove` collides with the shipped author verb only lexically — different namespace (collection entry vs SDK API) | feature | M | 4.3 (schematic pair); L2 (collection pair) | **4.3 + L2** |
| **Ownership transfer — RESOLVED (owner 2026-07-06)**: auto-prompt parity ratified as a schema-sufficiency CONTRACT, not a feature — the guard rail stands (the SDK renders no prompts; the Go CLI renders, consuming `schema.json`), and the SDK guarantees `schema.json` carries enough to derive prompts (labels, descriptions, defaults, types). Folded into `stage-4-typed-options` scope (4.2/4.3); council requires it encoded as a fitness function, not prose | other | — | In flight (stage-4-typed-options) | **4.2** |
| **Split from `stage-4-typed-options` (re-triage trigger, owner 2026-07-06)**: `stage-4b-testing-harness` — facade harness at `./testing` (`runFactoryForTest` wrapping the ONE normative `ContractFake` + `defineFactory`, no name re-exports), ADR-0009 amendment (third audience: author-testing), 4 companion guards (FIT-08 carve-out, dev-only bundle guard, FIT-04 dts baseline, FIT-09 exports entry), fail-closed parity invariant, AND `defineFactory` reachability (unreachable from any installed package today — `./core` unwired). ★D7 direction already owner-RATIFIED (facade); the change needs its own spec/design cycle. **OWNER COMMITMENT (steward foresight CQ1, 2026-07-07): COMMITTED-NEXT — stage-4's `aligned` verdict is conditional on 4b following; if 4b slips, stage-4's outcome crystallizes as outputs-without-outcome (steward reckoning will check)** | feature | L→M | Own /plan cycle IMMEDIATELY after stage-4 | **4.5 (own change, committed-next)** |
| Stage 2 error contract is **SDK-proposed, engine-unconfirmed until PC-PROTO-01**: the six `reason` values (`path-collision`, `path-not-found`, `unrepresentable-content`, `changes-too-large`, `unknown`, `outside-run`) and rejection-metadata field names (`verb`/`path`/`reason`/`appliedCount`) await the mapping REQ (engine `SystemError`/`DeveloperError`+`DeveloperFault` ↔ wire error shape ↔ SDK `origin`+`reason`). Stated assumptions for that ADR to confirm or correct: emit-rejection ⇒ `origin: "write-rejected"` (directive-level: `path-collision`/`path-not-found`; batch-level: `unrepresentable-content`/`changes-too-large`; unmapped ⇒ degrade to `unknown` per REQ-ERM-03); `outside-run` is SDK-local `authoring-rejected`, no engine mapping. `origin` itself is SDK-relative — nothing to unfreeze. **ADVANCE-NOTE 2026-07-15 (`stdio-engine-client` REQ-LED-01)**: `docs/engine-sdk-wire-spec.md` § Error Shapes (WPS-08) now formalizes the WIRE-side half of this mapping (`error: {code: -32001, message, data: {emitRejectionCode, failedIndex?, appliedCount}}`, `emitRejectionCode` enum `collision`/`not-found`/`unrepresentable`/`cap`/`unknown`) — the SDK-proposed shapes are now a NORMATIVE, versioned wire contract both repos build against, not just an internal convention. Still engine-UNCONFIRMED until PC-PROTO-01 ratifies the engine-side `SystemError`/`DeveloperError` mapping onto it | other | — | PC-PROTO-01 ratification (non-blocking for Stage 2 build) | **2 (flag)** |

## From `stage-4-typed-options` (2026-07-11) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED (2 blind judges, 0 crit/0 major).
Steward reckoning DELIVERED (owner-affirmed 2026-07-11). The coordinated Stage-2 AEC amendment
(reason enum six→eight + REQ-AEC-09 message rows) is **CLOSED IN-CHANGE** — applied to
`openspec/specs/authoring-error-contract/spec.md` (V2→V3) on 2026-07-10 — recorded here as
completed, NOT pending (verify-report F-03).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| `AuthoringError` constructor's `message?: string` field is ungated across all eight `reason` values (compiles for any reason, weaker than the file's own exhaustive-switch idiom) — discriminated-union tightening (require `message` for `invalid-input`/`reserved-name`, forbid for the six legacy reasons) (verify-final F-01) | refactor | S | — | **next `authoring-error.ts` touch** |
| Bin `-h` short-flag alias is handled in code (`bin/pbuilder-codegen.ts:130`) but only `--help` has a test in `codegen-cli.test.ts` — add a `-h` case (verify-final F-02) | test-coverage | XS | — | **anytime** |
| The primary sufficiency gate in `generateSchema` lacks an independent mutation-guard test (the codegen-injection fix is caught by the `RECOGNIZED_KINDS` backstop, not by a test on the gate itself) — add a missing-label/enum-missing-choices refusal test (QA iter3, F-07) | test-coverage | XS | — | **anytime** |
| Numeric (non-string) `enum` `choices` (e.g. `[1,2]`) produce an unusable factory type — the generated type accepts `mode: 1`, but the run-boundary validator's `matchesType` requires `typeof value === "string"`, so both `mode:1` and `mode:"1"` are rejected; fail-safe (rejects, never accepts bad data) so LOW severity, not a security hole — `checkSufficiency` should hard-fail non-string enum choice elements (judgment-day Judge B, L-1) | edge-case | S | — | **stage-4b candidate** |
| Bin's `<dir>` relativization (`path.relative(process.cwd(), packageDir)`) leaks `../..`-style depth for out-of-tree packages — fall back to a basename-only display when relativization escapes the cwd (judgment-day Judge B, L-2; cosmetic) | refactor | XS | — | **anytime** |
| Parse/sufficiency ownership crack: a non-object property value can silently vanish from the in-memory `Schema` rather than being named as a sufficiency failure — mostly closed by the sufficiency hard-fail gate; confirm the residual is fully covered or add the missing scenario (architect, MINOR) | edge-case | S | — | **backlog (confirm residual)** |
| Glossary drift: `AuthoringError`'s `@example` names the factory input parameter `options`, contradicting this change's own `input`-contract framing (Stage-2 provenance, one-word fix) (tech-writer) | docs | XS | — | **anytime** |
| Bin `--help` output is thin — could name `schema.generated.ts` as the output and `schema.json` as the input explicitly (tech-writer, optional) | docs | XS | — | **optional** |
| Reserved-name structural scan (FIT-16 + runtime) recognizes only `.ts`/`.js` filenames — `.mjs`/`.cjs`/`.tsx` evade detection; spec-scoped to `{.ts,.js}` deliberately, so this is a documented known-limitation note, not a bug (QA nit) | docs | XS | — | **known-limitation note** |
| Planning artefacts (spec §"REQ-ID Stability", slices Coverage Check) label the REQ set "25 REQ-IDs"; the true distinct count is 23 (TFO×5, SCP×2, RBV×5, RLN×3, FPS×5, AEC×3) — an off-by-two arithmetic label; coverage itself is unaffected. Correct the label (verify-final F-06) | docs | XS | — | **doc hygiene, anytime** |

## From `stage-5-first-dialect` (2026-07-12) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED (R1 clean — 0 critical, 0 real warnings). Steward reckoning DELIVERED (4 CQs affirmed, delivered). Six followups covering `stage-5b-dialect-breadth` integration + two Stage-6 deferred items.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| [stage-5b] modify(content)-after-AST-op last-write-wins (reject or document — judgment-day confirmed both judges converged on this question; decision pending design review) | design | M | — | **5b** |
| [stage-5b] runOp async containment — the loophole is LATENT TODAY: TS void-return compatibility admits an async op in a defineOpPack literal without any type relaxation; contain like `.raw` (shared contained-invoke helper) + spec touch for the tail wording | refactor | S | — | **5b** |
| [stage-5b] DAS-01.1 negative-guard broadening beyond removeImport (scope narrowing at archive; list remains `addImport` + `.raw` only) | docs | S | — | **5b** |
| [stage-5b] TSD-04.1 own-property/stack sweep vs REAL ts-morph error tracking (executor latitude on getSyntacticDiagnostics internals) | refactor | S | — | **5b** |
| [stage-5b] mid-chain print-failure containment + "could not print" fixture (error message contract for serialization failures) | test-coverage | S | — | **5b** |
| [stage-5b] MC-01.2/TSD-03.1 batch-grouping annotation-or-assert, Session.isPending() instead of pendingSnapshot copy per op, FIT-01 extensionless-relative-import blind spot, AuthoringError{origin} promotion | refactor | M | — | **5b** |
| provenance go-live checklist (remove `--dry-run` at first real release + assert live provenance via npm attestation; dry-run staged in publish.yml) — **RE-TAGGED to PC-PROTO-01/public-package plan (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.4)** | refactor | XS | Before live publish | **PC-PROTO-01 / public-package plan** |
| ~~README front-door dialect entry (Stage 6.3 scope: new author's first view should advertise `find().addImport()`, not just stub concept)~~ **RETIRED — `stage-6-release-shape`** (2026-07-14) — S-004 added the dialect front-door link to `README.md` | docs | S | ~~When Stage 6 front-door lands~~ | ~~**6.3**~~ **closed** |
| [stage-5b] hoist the BOM/encoding round-trip from the TS dialect's WeakMap to the core handle's parse/print seam when the second dialect lands — N dialects must not re-discover it | refactor | S | — | **5b** |
| [stage-5b] the lazy modify directive retains the ts-morph Project via the memoized getter's `resolve` closure after resolution — clear the closure ref post-memoization (one-liner, memory-only, visible in in-process harnesses) | refactor | XS | — | **5b** |
| [stage-5b] extract the duplicated `deepEqual` (`src/conformance/index.ts` + `src/testing/contract-fake.ts`, both shipped) into a kit-internal shared module — has pkg-surface baseline implications, do alongside 5b | refactor | S | — | **5b** |

**Reaffirmed (already registered above, engine-handoff section, row "Split from `stage-4-typed-options`")**:
`stage-4b-testing-harness` stays **COMMITTED-NEXT** — steward reckoning CQ-3 condition: the
author-facing consumption path (`defineFactory` reachable from an installed package) + the
`./testing` harness are deferred from this change; if 4b slips indefinitely, stage-4's
differentiator stays theoretical for installed authors and CQ-1/CQ-2 (usability/significance)
should be revisited. No new row — this note ties the steward gate's condition back to the
existing pending-changes entry.

**DELIVERED 2026-07-12** — `stage-4b-testing-harness` archived; the COMMITTED-NEXT condition
above is satisfied (`defineFactory` + `runFactoryForTest` reachable from an installed package
via `./testing`, proven from a packed-tarball vantage; steward reckoning verdict `DELIVERED`).

## From `stage-5b-dialect-breadth` (2026-07-12) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED (R1: 0 critical, 4 real findings fixed in D2; R2: both judges PASS). Steward reckoning DELIVERED (7 CQs affirmed, delivered).

| Description | Type | Size | Notes |
|---|---|---|---|
| (13) mutation-gate double-print optimization (3 independent sources: dialect-handle.ts #ensureOpen gate-check print + flush print; seed lazyModifyDirective cached value with gate-check string, invalidate on subsequent fast-path hit — legitimate optimization but changes REQ-MC-05.1-asserted print counts (ADR-0037 amendment relaxation), needs design-reviewed followup, ~4MiB waste per op-chain on large files) | design | M | — |
| (14) REQ-DG-07 emit-vs-commit wording amendment + document engine-discard cross-seam rollback assumption (verify-report #4, council finding) | documentation | S | — |
| (15) RESERVED_HANDLE_NAMES hardening — Object.prototype builtins + `__proto__`/`constructor`/`prototype` rejection + null-proto pack merge (security-council finding) | refactor | M | — |
| (16) DAS-01.1 guard: derive verb set from shipped op-pack type instead of hardcoded literal (ops.ts-only config, design comment row-144) | refactor | S | — |
| (17) REQ-DC-08 real-base probe wrapper-stub gap (verify-report follows implicit contract; planted fixture incomplete) | docs | S | — |
| (18) REQ-DC-07.1 pointer assertion mutation-weak (existsSync only; need stronger predicate; confirm in final round-trip) | test | S | — |
| (19) primitive-AST dialect → uncontained TypeError at WeakMap.set (guard + contained error; info-severity, verify-report tracking) | refactor | XS | — |
| (20) FIT-08 KIT_SYMBOL_NAMES to include handlePathFor (compliance expansion, tech-writer finding) | refactor | S | — |
| (21) design §4.2b named `test/e2e/dialect-modify.e2e.test.ts` extension — never landed, coverage complete at integration level (verify coherence finding #2; document OR extend file) | documentation | S | — |
| (22) name/source TS-identifier validation on add-ops (theoretical injection hardening; security-council forward-looking note) | refactor | M | — |
| (23) defineDialect-direct ops bypass reserved-name check — route op attachment through one guarded path (design pattern, not current gap; noted for next dialect-authoring-standards REQ) | documentation | S | — |
| (24) removeImport alias-vs-exported-name asymmetry doc clause (tech-writer coherence finding; recipe docs already cover, spec-level enhancement) | documentation | S | — |
| (25) reserved-verb compose message could name the reserved set (pinned-literal change → needs spec-level decision; tech-writer nit suggesting user clarity) | documentation | S | — |
| (C-acceptance-note) CQ-R2 acceptance recorded at reckoning: `dd1d109` testOpPack behavior affirmed (six adversarial round-trips per call, probe-after-exercises ordering ACCEPTED as legitimate extension of CQ-B's "runtime rules enforced" condition) | acceptance-note | — | observed |

## From `stage-4b-testing-harness` (2026-07-12) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED (R1: 1 confirmed WARNING fixed in
`5ad8a73`; R2: both judges PASS). Steward reckoning `DELIVERED` — CQ2 (opted-in factory
support) answered YES and honored in-change (REQ-ATH-13); CQ1 and CQ3 below are carried as
owner-nod items, not gaps.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Stage-6 `./core` production graduation: `defineFactory`'s production import home stays `./testing` until then (PM M4; steward CQ1 — an author's PRODUCTION `factory.ts` imports from a path literally named `./testing`; works today, 0.x-exempt, but is a naming-worth call for the owner to confirm, not a usability failure). **OWNER-RULED 2026-07-12 (stage-6 explore gate): stays `./testing` for stage-6; graduation re-registered as a mandatory re-evaluation inside the future public-package plan (pre-live-publish gate) — candidate home `./factory` per stage-6 explore blast-radius table**. **OWNER DIRECTION (2026-07-14, engram obs #2070, registered at `stage-6-release-shape` archive)**: the graduation shape itself is now narrowed — the author exports the BARE input-receiving function (not a `defineFactory`-wrapped value); `defineFactory` becomes INTERNAL to the runner/engine, never an author-facing export; `./commons` is the wrong home for it (a runner API, not author vocabulary). Supersedes the plain `./factory` candidate-home framing above; the future public-package plan re-evaluates against this narrower direction | other | M | Pre-live-publish | **public-package plan (own change)** |
| Throw-value-shape triangulation: a factory that `throw`s `undefined` is indistinguishable from success in `result.error`, and a `null` throw is a falsy-error-consumer hazard for authors who write `if (result.error)` (QA council) | edge-case | S | — | **backlog** |
| Exotic-path pass-through pin: path-traversal (`../`), NUL-byte, and unicode-normalization-edge paths are stored verbatim by the fake with no dedicated scenario pinning that behaviour (QA council) | test-coverage | XS | — | **backlog** |
| `deepEqual`'s `key in`/bracket-access pattern in `src/testing/contract-fake.ts` (batch-payload comparison) is the SAME class of prototype-chain leak the seed-lookup fix (`fbb3053`) closed for seed reads — inherited `Object.prototype` members could spuriously match on payload keys (fix-agent flag, unconfirmed on batch path) | edge-case | XS | — | **next `contract-fake.ts` touch** |
| FIT-17's dev-only bundle guard scans minified builds of the `src/` ENTRY FILES as a proxy for `dist/` (equivalence argued via tsc's 1:1 emission, §4.7) — have it scan the shipped `dist` entries directly as the source of truth instead (security council, low severity) | refactor | S | — | **backlog (hardening)** |
| Widen `REQ-ATH-11`'s in-memory instrumentation to cover `node:child_process` (SEC-m3, executor-optional at build time — never added) and dynamic `import()` parity, alongside the existing fs/net/Bun-I/O/fetch/env/argv surfaces (security council) | refactor | S | — | **backlog (hardening)** |
| Long-term form of ship-the-fake: `ContractFake` currently ships inside the production npm tarball behind six structural containment guards (ADR-0034) — is a permanent containment surface the right long-term shape, or should it become a separate `@pbuilder/testing` package (or BYO-fake docs)? Accepted 0.x expedient by owner ruling (ADR-0034); flagged for a deliberate long-term-form nod (steward CQ3, owner-nod pending, non-blocking) | other | L | — | **re-evaluate alongside `@pbuilder/sdk-kit` extraction (6.2)** |
| `RunResult.error`'s typed union `AuthoringError \| unknown` collapses to `unknown` at the type-checker (no narrowing value from the union today) — revisit the result-shape typing once `./testing` graduates past its semver-exempt window (arch note, verify-report) — **trigger RE-POINTED at the sdk-kit extraction / public-package plan (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.5), superseding the V1 "next 0.x result-shape iteration" trigger** | refactor | XS | — | **sdk-kit extraction / public-package plan** |

## From `bare-factory-migration` (2026-07-15) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED. Steward reckoning DELIVERED (4 CQs affirmed). Architecture audit clean. Three ADRs promoted to project-level. Four non-blocking followups registered below.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| R-11 scratch-replica drift risk — the scratch-anchor replica in `test/fixtures/author-emulation/factory.ts` path skips `validateAtRunBoundary`, hardcodes the containment ceiling (`packageRoot === packageDir`), and lacks `checkReservedNames` scan-failure wrapper. Register a lockstep pin test OR a shared helper between `defineFactory`'s gate and the replica. Behavior preservation proven today (git-clean regen); the two paths can silently diverge in a future change. | refactor | S | — | **backlog** |
| Cosmetic comment-level tokens — 4 prose/comment mentions of `defineFactory` remain in `test/fake/harness-opted-in.test.ts` (:5, :17) and `test/scaffold/classify-transport.test.ts` (:5, :18), describing the migration itself. No spec scenario scans test comments; optional cleanup only. | docs | XS | — | **optional cleanup** |
| (FIT-29 namespace-import bypass) `import * as ctx from "..."` escape hatch documented or extended scan — both judgment-day judges noted theoretical: FIT-29's `specifiersResolvingInto` scan targets named imports only; namespace imports (`import * as`) would bypass the guard if an untrusted file re-exported a piped `defineFactory` binding. Verify-final ruled the risk theoretical (no production code currently namespace-imports); register as forward-looking hardening (no current violation). | security | S | — | **backlog (hardening)** |
| Spec REQ-ATH-01/17 `packageDir` type reconciliation — spec declares `packageDir?: string | URL`, runtime accepts only `string` (URL forwarding not implemented). Align the type or document the limitation (two implementations possible: explicit narrowing in JSDoc + @ts-expect-error, or genuine URL support at the validation boundary). | refactor | S | — | **doc-only or refactor, next harness touch** |

(Observation: TSD-01.4 seeded-read oracle tightening (co-occurrence check → structural match) and comments-only `defineFactory` tokens on REQ-FPS-05.2 `@example` are noted in verify-report but NOT registered as pending — the former is a refinement candidate when the second story-docs evolution occurs; the latter is correct-by-design (re-aimed internal example per REQ-FPS-05.2). Double-fault frozen/sealed-E1 branch in `context.ts:342-345` has no coverage — pre-existing, outside this change's scope.)

## From stage-6 planning grooming (2026-07-12) — owner-validated gaps

Owner use case validated in-session: schematics need to copy asset files from the schematic
package folder into the target tree (Angular Schematics' `apply(url('./files'))` mental model).
Two distinct debts surfaced:

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| `copy` verb is emit-only end-to-end: SDK emits the directive correctly, fake + conformance vehicle simulate it faithfully, but the REAL engine drops it until the apply pass lands (ADR-0013 §copy; engine-side bytes-by-reference via `SourceFS` deferred to engine ADR-0028 §copy) — green tests ≠ files copied; needs the engine apply pass plus a real-wire assertion when PC-PROTO-01 unblocks integration. **ADVANCE-NOTE 2026-07-15 (`stdio-engine-client`)**: the real-wire assertion this row awaits now has a normative wire text to assert against (`docs/engine-sdk-wire-spec.md`) — no change to this row's gating, PC-PROTO-01 is still the blocker | other | — | Engine ADR-0028 §copy apply pass | **cross-repo flag (with PC-PROTO-01)** |
| Schematic-package asset → target tree has NO mechanism: `copy` is tree→tree only (fake enforces `from` exists in the tree, FAKE-06); no `apply(url('./files'))` equivalent, no source-FS notion (ADR-0008 keeps the SDK disk-blind by design). Workaround today: author-side `readFileSync` + `create` — text only; binary assets cannot travel the text wire (ADR-0019). Candidate primitive: `SourceFS` bytes-by-reference at the engine seam. **OWNER-RULED 2026-07-12: out of stage-6 — own change** | feature | L | Engine seam contract (cross-repo) | **own change** |
| FIT-09/FIT-14 exports-guard extensibility refactor: split the frozen exact flat subpath list into a stable-core exact assert (`.`, `./commons`, `./conformance`, `./testing`) + an extensible dialect-set pattern assert, so a new dialect subpath is a one-row addition instead of a multi-file edit (package.json + FIT-09:77 + FIT-14:86-88 + baseline JSON). OWNER-RULED 2026-07-12: deferred — stage-5b adds no subpath (breadth within `./typescript`, exports byte-identical); first real consumer is a second dialect no plan contains yet | refactor | S | — | **second dialect (own trigger)** |
| **Public-package plan (own /plan cycle, owner-carved 2026-07-12 at stage-6 explore gate; EXTENDED 2026-07-12 at stage-6 steward foresight, CQ2)**: everything that makes `@pbuilder/sdk` a package OTHER PEOPLE consume — GitHub Packages dual-name config (`@project-builder-schematics/sdk` publish-time rewrite, consumer `.npmrc` auth-wart docs), live npm publish readiness + go-live interlocks (GitHub Environment reviewer gate, tag-triggered publish), `defineFactory` home re-evaluation (row above), and whatever real engine integration reveals is missing. **Now ALSO absorbs the npm placeholder publish** (deferred at steward foresight, CQ2 — the `@pbuilder` scope is already owner-controlled, so an inert stub buys no security today): the stub itself, ADR-0040's reasoning, the fit-22 inertness suite, the RUNBOOK, and the `0.0.1` semver-floor decision. Rationale: "mientras funcione el bun link… por el momento es overkill porque no está preparado para que nadie lo use." Stage-6 now keeps only: hardening of the EXISTING publish.yml surface (W3 guard, SHA pins) and the local consumption story — ZERO registry writes | feature | L | L1-readiness (post engine integration) | **own change (post-6)** |
| **GitHub Environment required-reviewers gate is a MANDATORY precondition of removing `--dry-run`** (go-live): `publish.yml`'s `--dry-run` pin (REQ-PPH-03) stays until a required-reviewers environment gate is configured on the publish job — makes security's conditional acceptance of the `--dry-run` pin durable rather than implicit. Deferred to the public-package plan (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.6) | security | XS | MANDATORY precondition of the first live publish | **public-package plan (own change)** |

## From author-emulation-e2e grooming (2026-07-13) — owner-stated program vision

Owner vision stated in-session: before engine construction resumes (post stage-6), the SDK's
trust must be stress-proven by AGGRESSIVE author-emulation e2e — write schematics the way a
real author would (reference shape: nestjs-schematics `crud-graphql-mongo` — templates, naming
transforms, module wiring, parametric options), drive them with scenario matrices from simplest
to most complex, and capture the emitted IR array at the `EngineClient` seam into a report that
serves three audiences: golden baselines in-repo, engine-handoff corpus, human inspection. The
first change (`author-emulation-e2e-scaffold`, in planning) covers the `scaffold` mutation
family only AND builds the shared IR-report infrastructure the rest reuse.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Author-emulation e2e per remaining mutation family: one change per author verb/family (`create`/`modify` incl. dialect chains, `move`/`rename`, `copy`, `remove`, `copyIn` standalone) following the scaffold change's pattern — realistic authored schematic + parametric scenario matrix (simple → complex) + IR capture into the shared report | test-coverage | M each | scaffold e2e change lands the shared report infra first | **own changes (post scaffold e2e)** |
| Combination author-emulation e2e: compositions ACROSS mutation families, simple → complex (full realistic generators combining scaffold + dialect modify + move/copy + params), same IR-report vehicle — the closest pre-engine approximation of production authoring | test-coverage | L | all per-mutation e2e changes done | **own change (capstone, pre-engine-return)** |

## From `schematic-local-files` (2026-07-13) — engine-side seam obligations, registered at S-005 ahead of archive

`schematic-local-files` delivers the SDK-side half of the row-208 primitive above (`scaffold`/
`copyIn`/`create({ templateFile })`, package-local reads by reference or by render request).
Design's own §Seam Contract section is explicit: **the engine, not the SDK, is the real
security control** for these three obligations — SDK-side containment (`src/scaffold/
containment.ts`) is DX/attribution only. All three are an **archive-gated deliverable**
(design §Migration/Rollout, product ruling Q23) — registering them here (siblings to row 208)
is a named acceptance criterion of this change's final slice, not prose intent. The owner
signs off on each at this change's archive gate.

**PC-PROTO-01** (referenced by all three rows below, gloss added at final-verify remediation
ITEM 10b for readers landing here directly): the engine's upcoming transport-protocol
ratification — real `ir.emit`/`tree.read` wire calls plus first-class error-mapping — that
unblocks real cross-repo integration; see the fuller definition above (engine handoff
`l1-completion-gaps` section).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **BRC-02 — engine ceiling re-derivation + TOCTOU closure**: the engine MUST re-derive its OWN containment ceiling for a by-reference (`copyIn`) source — open-then-fstat, never trusting the SDK-resolved `packageRoot`/`packageDir`. Anchor pin (ADR-0043 rev 2, seam clause S2): the emitted `copyIn.from` is relative to the RESOLUTION anchor (`packageDir`), not the containment ceiling (`packageRoot`) — the engine resolves `from` against its OWN re-derived `packageDir`, mirroring the SDK-side `package-root-containment` REQ-PRC-01 anchor distinction. **ADVANCE-NOTE 2026-07-15 (`stdio-engine-client`)**: no change to this row's gating — noted alongside the wire spec's Bridge Contract/build-target pins for grouping | security | M | Blocking engine apply-pass for `copyIn`/by-reference `scaffold` entries | **engine repo, cross-repo flag (with PC-PROTO-01)** |
| **BRC-08 — non-canonical path-form rejection + single-pass literal-token render**: the engine MUST reject non-canonical path forms (UNC/device/reserved-DOS/drive-relative) for BOTH the by-reference source and the rendered destination, and MUST render a `create` directive's `pathTemplate` single-pass (substituted token values are literal segments, never re-scanned as further template syntax). Canonical-form hardening is explicitly OUT of SDK scope — `package-root-containment` REQ-PRC-04/Q24 case-folds on case-insensitive platforms SDK-side only; this row is the engine-side complement. **ADVANCE-NOTE 2026-07-15 (`stdio-engine-client`)**: the frame contract (length-prefix, cap) this row's blast radius sits behind is now pinned in `docs/engine-sdk-wire-spec.md` — no change to this row's gating | security | M | Blocking engine apply-pass for `copyIn`/`scaffold`/`create({templateFile})` | **engine repo, cross-repo flag (with PC-PROTO-01)** |
| **PRC-06 — post-render destination containment**: the engine MUST enforce destination containment POST-RENDER — after token substitution, the final on-disk destination path must be re-validated against the target workspace boundary. SDK-side `validateDestinationLexical` (`package-root-containment` REQ-PRC-09) is lexical-only, pre-render, and cannot see rendered token values — it is DX/attribution only, never the security control for a rendered destination. **ADVANCE-NOTE 2026-07-15 (`stdio-engine-client`)**: unaffected by the wire contract directly; noted alongside BRC-02/BRC-08 for grouping — no change to this row's gating | security | M | Blocking engine apply-pass for `scaffold`/`create` | **engine repo, cross-repo flag (with PC-PROTO-01)** |

> **Archive sign-off (2026-07-13)**: owner RE-AFFIRMED at archive that the engine copy-apply
> pass (PC-PROTO-01-tied) is **committed-next SCHEDULED** — not merely registered debt. These
> three rows are the formal tether for that commitment; `schematic-local-files` archives on the
> strength of this scheduling affirmation (steward reckoning conscience question 1). If the
> engine-side pass does not land, the by-reference (binary) half of this change risks
> crystallizing as outputs-without-outcome — re-open this note if the schedule slips.

## From `schematic-local-files` (2026-07-13) — standalone project pending items

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| `typecheck:permissive-proof` fails 1x — `test/types/permissive-proof.ts:35` `TS2578` (unused `@ts-expect-error`). **CONFIRMED pre-existing on `main` @ `04c141e`** (byte-identical, verified in a clean worktree by `schematic-local-files` final-verify) — NOT attributable to `schematic-local-files`; registered here as a standalone project debt item | bugfix | XS | — | — |
| Judge F (judgment-day iter 3) non-blocking observation: the archived `schematic-local-files` Executor-Context §5 note ("a rename smuggling `../` … is caught") is IMPRECISE — a `rename` value whose `..` segments are fully absorbed by a multi-segment `to` actually lands the file at the workspace root, not literally "caught" as escaping. This is WITHIN contract (REQ-FSC-02 permits remap, REQ-PRC-09's workspace boundary holds, the engine post-render check is the real control) — not a code defect, only an imprecise internal note. The note lives in the SEALED archive folder (`openspec/changes/archive/2026-07-13-schematic-local-files/slices.md` §Executor Context) — not edited (archived folders are never modified after the move); registered here instead so a future reader of that note isn't misled | docs | XS | — | — |

## From `author-emulation-e2e-scaffold` (2026-07-14) — REQ-SCM-03 upstream spec-gap escalation (S-001)

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| `PC-SPEC-FSC-TOKENS`: `folder-scaffold` REQ-FSC-05 specifies only SINGLE-filter token translation (`__x@filter__` → `{= x | filter =}`), leaving multi-filter chaining (`__name@singular@dasherize__` → `{= name | singular | dasherize =}`) under-specified upstream (owner ruling D3, obs #941). Escalation target for `author-emulation-e2e-scaffold` matrix row M-04's hardcoded-literal assertion (REQ-SCM-03): if the landed pipeline does not chain, M-04 goes RED and STAYS RED — the gap escalates through this row, never a weakened assertion | spec-gap | S | — | **schematic-local-files spec followup (own unfreeze)** |

## From `author-emulation-e2e-scaffold` (2026-07-14) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED (R1: 0 critical findings). Architecture audit: notes (additive Testing-section delta, 0 violations). Steward reckoning DELIVERED (CQ-1/2/3 owner-ratified per state.yaml 2026-07-13).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Cold-start suite non-determinism root-cause investigation — transient author-emulation test failures observed at cold start, never under warm conditions; corpus proven byte-deterministic under strong regen guard (fresh-process `regen-corpus.ts` → `git diff` empty); issue is test-harness/CI-reliability concern, not a corpus or deliverable defect | test-infra | S | — | — |
| Batch-cap `4*1024*1024` literal in M-09 assertion → reference the SDK's exported `BATCH_CAP_BYTES` constant | refactor | XS | — | — |
| Judgment-day INFO (both judges converged): FIT-24 shape-scan narrower than REQ-GCC-06 wording — the spec names duration/PID/hostname as non-deterministic fields, but the corpus scan covers only `fs.writeFileSync` binary bytes + absolute-path patterns; neither duration/PID/hostname appears in practice. Document the asymmetry or broaden the scan | test-coverage | XS | — | — |
| Judgment-day INFO: FIT-24 interior-absolute-path detection + `/*` block-comment-opener refinements (edge cases in path-escape detection; low severity) | test-coverage | XS | — | — |
| FIT-27 write-primitive coverage gap — anti-tautology scan covers `fs.writeFileSync` only; does not scan `copyFileSync`/`cpSync`/`renameSync` or stream-based writes (low coverage today, edge-case risk for future corpus mutations) | test-coverage | XS | — | — |
| `test/support/import-scan.ts` `walkReachable` extension: extensionless-import resolution (`.ts` files importing `.js` files without extension); edge case not covered by FIT-01 | test-coverage | XS | — | — |
| Coverage-manifest GCC-08.1/SCM-02.1 fitness test — automated enforcer that all four manifest checklist items exist (EXERCISED, NOT-EXERCISED literals, FRICTION section); currently a manual verify-final audit step, not a test | test-coverage | S | — | — |
| GCC-03 informative-latitude test methodology (corpus-format unit) — test compares a run's output to itself under different chunk-aggregation patterns; self-comparison design limits falsifiability. Rewrite against a real multi-chunk baseline or explicitly ratify the byte-exact comparison policy as intentional | test | XS | — | — |
| /simplify skipped findings: (a) `gated` field in design review — removal needs spec-level decision before implementation (XS); (b) FIT-27 parameter-flow taint hardening — avoid importing capture path transitively in test-tree without an explicit guardian (S) | refactor | S | — | — |

**PC-SPEC-FSC-TOKENS** (already registered above under "From `author-emulation-e2e-scaffold` (2026-07-14) — REQ-SCM-03 upstream spec-gap escalation"): `folder-scaffold` REQ-FSC-05 specifies single-filter token translation only, leaving multi-filter chaining under-specified upstream. M-04 matrix row currently GREEN (pipeline chains work); escalation target if pipeline changes. No action at this archive — condition remains as stated above.

## From `stage-6-release-shape` (2026-07-14) — accepted as non-blocking at archive

Verify verdict `pass-with-followups`. Judgment-day APPROVED (round 1, 2 inline fixes, no re-judge needed). Steward reckoning DELIVERED (G-2 owner walkthrough PASS; CQ1/CQ3 reaffirmed).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| REQ-LC-05.3's red-proof is infalsifiable — it asserts only local literals, not a real failure mode (both judgment-day judges confirmed) — make it falsifiable or fold it into a comment | test-coverage | XS | — | anytime |
| Test-suite build fan-out: `bun test` triggers ~5 full clean rebuilds per run across the pack/link legs (both judgment-day judges confirmed) — share one memoized build across those legs | refactor | S | — | next build-perf pass |
| `ci.yml` lacks a `setup-node` declaration while the suite's bin-exec scenarios need an ambient Node (works today only because `ubuntu-latest` ships one) (Judge A) — declare the dependency explicitly or provision it | docs | XS | — | anytime |
| `extractFencedFiles` deviates from REQ-AOD-07.1's named shared harness (Judge B) — ratify the deviation explicitly or fold the helper into `test/support/markdown-section.ts` | refactor | S | — | anytime |
| `bun-version: latest` is unpinned in both `publish.yml` and `ci.yml` (security + architect) — pin before go-live | security | XS | Before first LIVE publish | public-package plan (own change) |
| Content-aware tarball secret scan: `fit-14`'s no-secrets assertion is filename-only, not content-scanning (security) — add a content-aware scan | security | S | Before first LIVE publish | go-live batch |
| `ROADMAP.md` §3 "Five authoring verbs" table is stale (current count is seven authoring verbs) — reconcile at the next planning-docs pass | docs | XS | — | next planning-docs pass |
| `unlinkSdk`'s global-link-store serial-execution assumption is load-bearing and undocumented (judgment-day, INFO) — document the invariant explicitly or add a reference count | docs | XS | — | anytime |

## From `ts-dialect-backend-ops` planning (2026-07-14) — dialect op-catalog ledger (owner-ratified re-cut)

Council review (architect + PM, independent convergence) found the original Tier-1 cut (11 ops
spanning 3 distinct mechanisms, ~6 implied ADRs, 11 public signatures frozen at once) to be an
XL disguised as an L. Owner re-cut the full op catalog into complexity-ordered GROUPS, each
introducing exactly ONE new difficulty; each group below is its own future change. **Group 1
(import/export variants) is the current change `ts-dialect-backend-ops`** and is therefore not
a row here. Complexity was ranked on two axes: AST difficulty AND contract difficulty
(addressing model, collision namespace, idempotency identity, frozen-kit impact) — note the
inversion on query ops: trivial AST, widest contract blast radius.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Group 1 — import/export variants**: `addDefaultImport`, `addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`, `addExportAll`, `removeExport`. New difficulty: NONE — extends the shipped `addImport`/`removeImport` mechanism verbatim (module-specifier addressing, name+module idempotency identity, ratified merge precedent), which is why it is first. **Planning PAUSED 2026-07-14 by owner after explore** — triage + explore artefacts are complete and persisted (`openspec/changes/ts-dialect-backend-ops/`, engram topics `sdd/ts-dialect-backend-ops/{triage,explore}`); four owner decisions are open and block propose: (a) fold in row (22) identifier validation — security-engineer marks halt-worthy, injection CONFIRMED not theoretical (see the security row below); (b) `addTypeImport` emitted form — separate `import type { X }` vs inline `{ type X }` modifier (the only Group-1 decision that reaches the emitted bytes, hence the hardest to reverse); (c) `removeExport` scope + the add/remove asymmetry (4 new add-import forms ship with no remove counterparts); (d) whether `addExportAll` covers `export * as ns` | feature | L | Owner decisions (a)-(d) above | **paused mid-plan — resume at propose** |
| ~~**CONFIRMED injection surface (was row (22), re-classified from theoretical)** — empirically probed against the pinned `ts-morph@28.0.0` during Group-1 explore: `name`-position arguments are spliced into emitted source RAW (unescaped). `addImport('x } from "evil"; import { y', 'b')` emits a syntactically-valid extra import from an attacker-chosen module; `print()` performs no re-validation, so nothing gates it. `from`-position args ARE string-literal-escaped by ts-morph (breakout blocked there). The mainstream author path parameterises `name` from consumer-supplied schema `options`, and `src/dialects/typescript/**` is registered `security (code execution): high` — so this is a live path, not an exotic one.~~ **PARTIALLY CLOSED 2026-07-21 (`ts-addimport-collision` archive)**: `addImport`'s `name`/`from` splice channels are CLOSED — REQ-TSD-13's `assertValidImportBinding` gate (grammar + reserved-word + denylist, `src/dialects/typescript/ops.ts`) rejects the exact confirmed breakout (`addImport('x } from "evil"; import { y', 'react')`) before any AST mutation, proven by `ops-addImport.test.ts` REQ-TSD-13.1-.4. The sibling ops (`addFunction`/`addVariable`/`addClass`) `name`/`source`/`initializer` channels remain UNVALIDATED — this change's own CHANGELOG and trust-boundary JSDoc (REQ-TSD-13.5) affirmatively name them as still-raw; superseded by the "sibling name/source/initializer raw-splice exposure" row registered below | security | M | — | **`addImport` closed; siblings — own change** |
| ~~**Latent collision-predicate gap (found at Group-1 explore, applies to SHIPPED code)** — `assertNoCollision` (`src/dialects/typescript/ops.ts`) scans import bindings via `getNamedImports()` only; it never inspects `getDefaultImport()`/`getNamespaceImport()`. Harmless today because no shipped op creates those bindings — but it is the same class of gap judgment-day round 1 already caught twice (missing enum/namespace). The moment `addDefaultImport`/`addNamespaceImport` exist, `addFunction("Foo")` will fail to detect an existing `import Foo from "m"` and emit TS2451-invalid code. **Precondition of Group 1**, not an optional hardening~~ **SUPERSEDED 2026-07-21 (`ts-addimport-collision` archive)**: `addImport` itself now has full-coverage collision detection (`boundNamesIn` walks default/namespace/named specifiers alike, REQ-TSD-01 Steps 1-2) — but `assertNoCollision`'s own import scan (consumed by `addFunction`/`addVariable`/`addClass`) is UNCHANGED, still `getNamedImports()`-only; the `isValueNamespaceClaimed` extraction this change made does not touch it. Re-registered with sharper framing as the "sibling collision-scan asymmetry (Arch N4)" row below — this row's content is fully absorbed there, do not re-triage both | bugfix | S | Blocks `addDefaultImport`/`addNamespaceImport` | **superseded — see Arch N4 row** |
| ~~**Latent type-contamination bug in shipped `addImport` (found at Group-1 explore)** — `addImport` merges into the FIRST declaration matching the module specifier (`getImportDeclaration`, singular). If that first declaration is type-only (`import type { A } from "m"`), ts-morph's `addNamedImport("B")` grafts the VALUE import B into the type-only clause → `import type { A, B }`, silently making B type-only. Unreachable today (no op creates type-only declarations); Group 1's `addTypeImport` makes it reachable.~~ **CLOSED 2026-07-21 (`ts-addimport-collision` archive)**: the shipped four-branch `addImport` (`src/dialects/typescript/ops.ts`) gates Step 3 (merge) on `isNonTypeOnlyNamedImportClause` — a type-only target declaration is never merged into; it falls through to Step 2's collision reject (REQ-TSD-01.6/.8/.26/.27) instead, proven by `ops-addImport.test.ts`. The noted add/remove asymmetry over multi-declaration modules is now an explicit, spec-pinned posture (REQ-TSD-01.25, V3.2-corrected) rather than an unstated bug — every new add-op must still state which posture it takes | bugfix | S | Reachable once `addTypeImport` exists | **closed** |
| ~~**Test-suite weakness (found at Group-1 explore)** — the shipped "idempotency" test (REQ-TSD-09.6, `ops-declarations.test.ts`) runs the op on a fresh empty file twice and compares: that proves DETERMINISM, not idempotency. It survives a mutation that deletes the `alreadyPresent` guard entirely, because it never seeds the post-state. True idempotency = seed the file with the op's own output, apply, assert ZERO emitted directives (the assertion shape `ops-removeImport.test.ts` already uses for absent-binding no-ops). Backfill for `addImport`, and do not let any new op copy the fresh-file-twice shape~~ **CLOSED 2026-07-21 (`ts-addimport-collision` archive)**: REQ-TSD-03.11 backfills exactly this — a FRESH run seeded with a prior, independent `addImport` run's own output asserts ZERO emitted directives (`test/dialects/typescript/dialect.test.ts:44`), the true seed-with-own-output idempotency proof this row specified, distinct from the pre-existing same-run duplicate-call test (`.10`) | test-coverage | S | — | **closed** |
| **Group 2 — type-level top-level declarations**: `addInterface`, `addTypeAlias`, `addEnum`. New difficulty: TYPE-namespace collision predicate (purely additive ADR-0039 amendment — the value-namespace rule stays frozen); `enum` occupies BOTH namespaces (value + type), the finest case | feature | M | After Group 1 lands (reuses its test/idempotency patterns) | **own change** |
| **Group 3 — named-container member surgery**: `addEnumMember`, `addInterfaceProperty`, `addUnionMember`, `addClassProperty`, `addClassMethod`, `addImplements`, `addDecorator`, `addConstructorParam`, `removeDeclaration`. New difficulty: mutating INSIDE containers located by top-level name (2-hop addressing, no new locator abstraction); `addConstructorParam` must create a missing constructor; `addUnionMember` has a structural precondition (alias must be a union); `removeDeclaration` is reference-blind by design (no-LS commitment) | feature | L | Group 2 (type-namespace predicate for interface/enum member semantics) | **own change** |
| **Group 4 — nested expression surgery**: `addArrayElement`, `addObjectProperty`, `setObjectProperty`, `addCallArgument`, `addStatementToFunction`. New difficulty: the PUBLIC locator/addressing abstraction — the hardest-to-reverse API decision in the catalog (design the MINIMUM addressing these ops need; a selector/query DSL is explicitly out of scope); structural idempotency identity (first non-name-keyed identity); position semantics (`addStatementToFunction`); key-conflict family (`addObjectProperty` reject/overwrite/no-op must be placed in the ADR-0039 merge-vs-reject family explicitly) | feature | L | Locator ADR at its own design phase | **own change** |
| **Group 5 — query/confirm ops**: `hasImport`, `hasDeclaration`, `hasExport`, `hasMember`. Trivial AST, widest contract blast radius: a boolean-returning op breaks the frozen kit's void/chainable `Op` contract (`src/core/define-dialect.ts`, consumed by conformance + third-party dialects) and collides with async read-through (`#ensureLive`, ADR-0037). Needs a return-channel ADR ratified BEFORE any implementation; do not smuggle as "just two more ops" | feature | L | Frozen-kit return-channel ADR (own decision) | **own change** |
| **Group 6 — composed Layer-2 ops**: `ensureImport`, `registerInArray`, `addInjectedDependency`, `addEndpoint`. Zero own AST — pure composition of Groups 1-5 atomic ops (a Layer-2 op never touches ts-morph directly); query-dependent compositions additionally gated on Group 5's return channel | feature | M | Groups 1-4 stable; Group 5 for query-dependent compositions | **own change (after atomic layer stabilizes)** |
| Framework-specific helpers (Nest/Express/TypeORM) — ruled OUT of the dialect entirely; authors compose them from primitives in userland | — | — | — | **not now (explicit non-goal)** |

> Blast-radius linkage (PM flag, applies to EVERY group above): stage-5b rows (16) DAS-01.1
> verb-set derivation, (22) `name`/`source` TS-identifier validation on add-ops, and (23)
> `defineDialect`-direct ops bypassing the reserved-name check were parked pending exactly this
> kind of op-pack widening — each group's change must fold them in or re-affirm their deferral
> explicitly, never orphan them.

## From engine↔SDK wire design (2026-07-14) — DELIVERED by `stdio-engine-client` (2026-07-15)

> **Stale preamble note (2026-07-15, REQ-LED-01)**: the paragraph below describes the
> PRE-implementation design record as it stood 2026-07-14 ("stdio JSON-RPC single-initiator")
> — that decision was SUPERSEDED by `stdio-engine-client`'s ratified wire (length-prefix
> framing, host-initiated topology with 4 allowlisted reverse callbacks, versioned `ready`; see
> `docs/engine-sdk-wire-design.md` rev 3 § Superseded (historical) + the new normative
> `docs/engine-sdk-wire-spec.md`). Left below verbatim as the historical record of what was
> proposed before the change built it — do not read it as current.

Design record: `docs/engine-sdk-wire-design.md` (stdio JSON-RPC single-initiator; runner contract
per the bare-factory owner direction, obs #2070; `collection.json` without a `schema` field —
adjacency convention per ADR-0031 owns the schema location). Cross-repo contract with the Go
CLI/engine; the wire spec is a deliverable of the change, not a prerequisite from the engine side.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| ~~`StdioEngineClient` — first real `EngineClient` implementation (JSON-RPC over stdio, NDJSON framing, `session.init` version handshake, engine rejections mapped to ADR-0022 `EmitRejection`). Ships together with: the `pbuilder-runner` bin (argv contract `--factory <url>#<export>` / `--input` / `--input-file`; resolved PROJECT-LOCAL per the single-SDK-instance pin — engine must never bundle its own SDK copy, or the module-level ALS splits and every verb throws `outside-run`; wraps the author's BARE factory export with the runner-internal `defineFactory`, supplying `packageDir = dirname(factory)` via the adjacency convention), a normative wire spec (versioned with the handshake), and a scripted fake-engine conformance harness (spawned process speaking NDJSON over real stdio — no Go required to verify). Consumes the `defineFactory` graduation direction (obs #2070, stage-4b row above)~~ **CLOSED — superseded by `stdio-engine-client`** (2026-07-15, REQ-LED-01.2): NDJSON framing → length-prefix framing (`docs/engine-sdk-wire-spec.md` § Frame Grammar, WPS-01); `session.init` version handshake → versioned `ready` (§ Ready Handshake, WPS-02); the row's undefined bootstrap mechanism → the argv/bridge composition root (`src/transport/runner.ts` + `bootstrap-bridge.ts`, WPS-09/BRB-01). See `docs/engine-sdk-wire-spec.md` (normative) + `docs/engine-sdk-wire-design.md` rev 3 (historical record) | feature | L | Before any engine-backed release | **DELIVERED — SDK half shipped by `stdio-engine-client`; engine PC-PROTO-01 is the build target, see cross-repo tether row below** |
| Factory scaffold (`pbuilder-codegen` extension or `init-schematic`) emitting a typed bare `factory.ts` (`(input: Input) => void`) plus adjacent `schema.json` — DX counterpart of the bare-export contract (authors never write `defineFactory` boilerplate; the typed signature is the compile-time anchor the wrapper's generic used to provide). **RE-HOMED 2026-07-15 (owner ruling, engram obs #2161, `stdio-engine-client` S-005.4)**: "the runner change" (`StdioEngineClient`) has now shipped without this row — re-homed to the public-package plan, its own scheduling unit | feature | S | — | **public-package plan** |
| ~~Author-surface migration to the bare-factory shape (blast radius measured 2026-07-14): rewrite the 5 author-facing docs showing the wrap (`README.md` ×7, `docs/quickstart.md` ×4, `docs/dry-run.md` ×3, `docs/authoring-verbs.md`, `docs/authoring-errors.md`) + their fenced-snippet compile tests; change `runFactoryForTest` to accept the bare `(input) => void` shape, wrapping internally via the SAME code path the runner uses (parity-by-identity, FIT-18 philosophy); drop `defineFactory` from public subpath exports + exports-guard baselines (FIT-09/FIT-14, `./testing` facade re-export). Transition guard in the runner: brand-detect an already-wrapped export and reject with an educational error (double-wrap = cryptic destructuring TypeError otherwise); guard retires once the export is gone. NOT migration work: the ~67 internal test files calling `defineFactory` directly — it remains internal API~~ **RETIRED 2026-07-15 (`stdio-engine-client` S-005.4, verified against the shipped archive)** — DELIVERED by `archive/2026-07-15-bare-factory-migration`: the 5 author-facing docs no longer show the wrap (verified: zero `defineFactory` references in `README.md`/`docs/{quickstart,dry-run,authoring-verbs,authoring-errors}.md`); `runFactoryForTest` takes an options bag (`packageDir?`) and delegates to `defineFactory` internally (ADR-0051/ADR-0052); `defineFactory` graduated out of `./testing`'s public exports to core-internal, structurally enforced by FIT-08/FIT-29 (ADR-0050); the double-wrap brand-marker transition guard exists (`src/core/context.ts`, reused by THIS change's own RUN-06/ADR-04) | docs | M | — | **closed** |

## From `author-write-surface` triage re-cut (2026-07-14) — deferred by owner decision after blind council review

The original scope bundled four changes; PM + architect independently converged on cutting to
the honest write-verb rename core (that change proceeds: `openspec/changes/author-write-surface/`).
The three deferred pieces map to EXISTING ledger homes — this section is traceability, not new rows:

| Deferred piece | Existing home | Extra condition registered here |
|---|---|---|
| Public dialect-kit subpath (`defineDialect`/`defineOpPack`/`withOps`), ADR-0009 revisit | Public-package plan / `@pbuilder/sdk-kit` extraction rows | Must state the subpath's semver posture, rework FIT-08 (no-kit-bleed) as allowlist-inversion, and confirm the `Session.emit`/`EngineClient` single-chokepoint survives exposure (architect triage note, 2026-07-14) |
| `hasImport` + query helpers | Group 5 (boolean-returning ops) | Unchanged gate: return-channel ADR ratified BEFORE implementation; sequenced after Groups 1-4 |
| Standalone op-function exports from `./typescript` (composition inside `modify(fn)` callbacks) | Follows the row-320 CONFIRMED identifier-injection validator | Do NOT widen the confirmed-vulnerable surface before the shared TS-identifier validator lands; note `modify(fn)` already gives authors full ts-morph natively, so urgency is low |

## From `author-write-surface` (2026-07-14) — accepted as non-blocking at archive

Verify verdict `pass-with-followups` (2 followups fixed at close: FIT-04 content assertion + stale comment). Judgment-day APPROVED (1 suggestion applied). Steward reckoning DELIVERED (3 conscience questions owner-ratified, outcome aligned).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Flaky `test/e2e/installed-consumer.e2e.test.ts` tarball leg — ~25% failure rate on CI; pre-existing issue, masks archive signals; root cause not in this change (manifest/corpus/build-pipe stability) | test-infra | M | — | **next build-infra / e2e harness pass** |
| `replaceContent("")` empty-content boundary untested — completeness gap in REQ-MC-01/MC-03 (empty string mutation coverage); pre-existing compliance gap | test-coverage | S | — | **test-pyramid-hardening pass** |
| `defineDialect` own-ops bypass the reserved-name guard that `withOps` enforces — latent gap in REQ-DG-02 collision namespace (own-provided ops can shadow reserved names without hitting the assertion, in-trust model); add symmetric guard or document caveat before dialect publishing | refactor | M | — | **before public `defineDialect` / op-pack publishing** |
| `openspec/sensitive-areas.md` spelling refresh: update `.raw()` escape-hatch documentation to `.modify()` (one-line) — consistency patch after honest-verb rename lands | docs | XS | — | **first sensitive-areas refresh pass** |

## From `author-write-surface` foresight gate (2026-07-14) — deferred by owner at steward checkpoint

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Importable `modify(handle, fn)` form from `./typescript` + the run-identity guard subsystem (cross-run loud reject via controller `#origin` stamp). Steward foresight (obs #2127) flagged it as ergonomics-not-honesty with the largest net-new complexity in the rename; owner deferred (obs #2128). PRIOR ART preserved: REQ-TSD-12 V3 spec text (engram obs #2119 history) + design `#origin`/`#bindOrigin` mechanism (design.md / obs #2126) — a future change starts from ratified spec+design, not zero | feature | S-M | Lands AFTER `author-write-surface` merges (needs the renamed `.modify(fn)` surface) | **own change, post-rename** |

## From `stdio-engine-client` (2026-07-15) — new rows registered at S-005.4 (REQ-LED-01)

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Windows/macOS production pins: this change's fake-engine harness and e2e suite are proven on this repo's Linux dev/CI image only — `single-instance-probe.ts`'s realpath comparison, `captureFd1FrameWriter`'s `process.stdout` stub replacement, and the spawned-process harness (`bun run <bin>` + real stdio pipes) have no cross-platform CI run yet | edge-case | S | Before any Windows/macOS production release | **deferred — public-package plan** |
| **Cross-repo tether**: engine `PC-PROTO-01` MUST build against `docs/engine-sdk-wire-design.md` rev 3 + `docs/engine-sdk-wire-spec.md` wire-spec version 1 — NOT rev 2. Conformance = the Go side passes the same wire vectors this repo's fake-engine harness (`test/fake/harness.test.ts` + `test/fake/*.e2e.test.ts`) already encodes; engine `MaxMessageBytes` MUST equal SDK `BATCH_CAP_BYTES` (4 MiB / 4194304) per the wire-spec's Frame-Cap Constant clause (WPS-06/FEH-06) | feature | — | PC-PROTO-01 (engine repo) | **engine repo, cross-repo flag (with PC-PROTO-01)** |
| ~~Pre-existing `session.ts` behavior (verify-final council, architect): a `TransportFault` surfacing during `Session.flush()`'s emit leg is degraded by the `toAuthoringError` catch-all to exit code 2 (emit-rejection) instead of 3 (transport fault) — documented in `openspec/changes/stdio-engine-client/apply-progress.md:256-263`. Future `session.ts` changes touching the emit fault path should reclassify wire faults before the catch-all rather than rediscovering this from scratch~~ **CLOSED — FIXED 2026-07-16** (judgment-day round 1, finding F1): `Session.flush` now recognizes a `TransportFault` by stable `name` identity BEFORE calling `toAuthoringError` and re-throws it untranslated (exit 3 preserved) — `src/core/session.ts`, commit `867c342`. Proven by `test/fake/exit-matrix.e2e.test.ts`'s ir.emit-pending legs. Main-spec sync: `emit-rejection-metadata` REQ-ERM-03 gained the transport-class carve-out (V3 amendment, `stdio-engine-client` archive) | edge-case | S | — | **closed** |
| Bridge sequential-rerun residual (judgment-day R2): a timed-out call's parked stdin read (`StdioEngineClient` `#danglingRead`) can survive run end on the bridge path and consume bytes of a SUBSEQUENT session if the engine reuses the same stdin iterable across sequential `enterBridge` runs in one process — paired with `docs/engine-sdk-wire-spec.md`'s once-per-run `enterBridge` claim (Bridge Contract section: re-entry tolerated, residual named); engine team to ratify the sequential-rerun lifecycle at PC-PROTO-01 | edge-case | S | PC-PROTO-01 (engine repo) | **engine repo, cross-repo flag (with PC-PROTO-01)** |

## From `stdio-engine-client` archive (2026-07-16) — verify-final, council, and judgment-day followups

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **F-1** Cold-start suite flake (pre-existing, outside this change's diff): `test/bin/codegen-static-scan.test.ts`'s unconditional `beforeAll` self-build (`bun run build` → `rm -rf dist`) intermittently errors on the first `bun test` run after a fresh install (7 tests / 8 expect() short, 1 error, 0 fail, exit 0; never reproduced warm). Fix: route through `test/support/shared-build.ts::ensureTscBuild()` (memoized) like fit-04/fit-17, or add a cold-start CI retry | test-infra | S | — | **next test-infra pass** |
| **F-2** SEC-07 probe real-resolver happy path is only exercised via the self-reference fallback branch (dead in real deployments) — primary-path MATCH is proven with an injected resolver only. Fix candidates: a `package.json` self-reference `exports` condition, or a split-package fixture whose two roots are realpath-identical | test-coverage | S | — | **next `single-instance-probe.ts` touch** |
| **F-3** `packageRootFor` (`src/transport/single-instance-probe.ts:45`) duplicates `findProjectRoot` (`bin/pbuilder-codegen.ts:79`) — unguarded twin package-root walks; extract a shared helper (touches code outside this change's scope) | refactor | S | — | **next touch of either file** |
| **F-4** `src/transport/runner.ts` uncovered arms (81.71% lines, 232-254): drive the four export-resolution message arms (and defensive argv/stat/JSON branches) through `runRunner` at runtime — classification itself is already fully proven in `factory-pointer.unit.test.ts` | test-coverage | S | — | **next `runner.ts` touch** |
| **F-5** `dist/bin` build wiring for `pbuilder-runner` deferred to the public-package plan (ADR-0058 documented deviation — the bin currently produces no `dist/` output; `package.json#bin` entry also deferred) | refactor | S | Before any public release exposing the runner bin | **HALF-DELIVERED 2026-07-18** — build wiring landed for engine integration (entry moved to `src/bin/pbuilder-runner.ts`, tsc emits thin `dist/bin/pbuilder-runner.js` resolving against `dist/transport/*.js`; ADR-0058 amendment); `package.json#bin` entry half remains with the **public-package plan** |
| Council (security): `error-text.ts`'s 200-char token-cap bounding applies to `discard()`'s note text and the factory-pointer echo, but the two truncation call sites aren't proven identical byte-for-byte against a shared fixture — theoretical drift risk if one site's cap constant is edited without the other | test-coverage | XS | — | **next `error-text.ts` touch** |
| Council (security): `reconstructEmitRejection`'s `appliedCount` carry-through (SEC-04.2) is proven for the forcing-degrade cases but not cross-checked against every `EmitRejectionCode` member as new codes are added — register a table-driven exhaustiveness test | test-coverage | XS | — | **next `EmitRejectionCode` addition** |
| Council (QA): no e2e leg drives a runner EOF (stdin closed pre-greeting or mid-run) all the way to its exit-code classification — unit-level coverage exists (`exit-codes.unit.test.ts`) but the spawned-process leg is missing | test-coverage | S | — | **next fake-engine-harness e2e pass** |
| Council (architect): `src/transport/errors.ts` extraction — `TransportFault`, `OverlappingRunError`, `IntentRejectedError`, `BridgeVersionMismatchError` currently live inline in their owning modules; a dedicated errors module would centralize the transport error taxonomy as the cluster grows | refactor | S | — | **next transport error added** |
| Council (architect): `fit-31-single-owner-framing.test.ts` now bundles the framing-ownership scan AND the WPS-11 doc-reconciliation scan AND the LED-01 ledger scan — cohesion split recommended at the next touch rather than growing a 4th concern into it | refactor | XS | — | **next `fit-31` touch** |
| Judgment-day (theoretical, unconfirmed): `Session.read()`'s `tree.read` result-shape guard trusts the host's `{content}` envelope structurally but doesn't defend against a host that returns an extra unexpected field colliding with a future SDK-side field name | edge-case | XS | — | **PC-PROTO-01 (engine repo)** |
| Judgment-day (theoretical): the greeting-phase read has no explicit timeout bound distinct from the per-call `SEC-05` timeout — a host that never sends `ready` hangs the runner indefinitely at handshake | edge-case | S | — | **next handshake-path touch** |
| Judgment-day (theoretical): a clean EOF arriving BEFORE the greeting (host process exits immediately) is not given its own named exit-code arm distinct from a mid-run EOF — worth a dedicated taxonomy entry | edge-case | XS | — | **next `exit-codes.ts` touch** |
| Judgment-day (theoretical): the desync-continuation posture (a conformant host keeps serving after a malformed frame, per SEC-08.1's recovery) has no doc-level note explaining WHY continuation is safe here vs. other fault classes that stay fatal | docs | XS | — | **next `docs/engine-sdk-wire-spec.md` touch** |
| Judgment-day (theoretical): `FrameReader`'s buffering reassembly is O(n²) over payload bytes in the worst case (repeated `Buffer.concat` on a heavily-chunked stream) — no production impact observed (no hot path, design §4.9), registered as a forward-looking perf note only | perf | XS | — | **only if profiling shows it matters** |
| Judgment-day (theoretical): WPS-11.2's header-stamp scenario doesn't pin the wire-spec doc's header to name the SPECIFIC engine build target string format, only that a target is named — a future doc edit could rename the field without failing the scan | docs | XS | — | **next `docs/engine-sdk-wire-spec.md` header touch** |
| Judgment-day (theoretical): the superseded-decisions section's "host-initiated" phrasing (rev-3 doc) could read as ambiguous between "the host initiates the TCP/process" vs. "the host initiates each wire exchange" to a reader unfamiliar with the rev-2→rev-3 history | docs | XS | — | **next wire-design.md historical-section touch** |
| Judgment-day (theoretical): the stdout stub (`as unknown as typeof process.stdout` in `framing.ts`) doesn't implement the full `Writable`/stream surface — any future author code calling an unstubbed stream method (e.g. `.cork()`) would hit `undefined is not a function` instead of a clean capture | edge-case | XS | — | **next `framing.ts` stub-surface touch** |
| Judgment-day (theoretical): RUN-04's oversize-input-file gate is a `statSync` size check before read — a TOCTOU window exists between stat and read if the file grows between the two calls; acceptable today because the input file is author-local and single-reader, revisit if that assumption (A1) changes | security | XS | — | **only if the input-file trust assumption changes** |
| Architecture audit: `test/fitness/dts-baseline` carries a stale `defineFactory` JSDoc comment predating `bare-factory-migration`'s core-internal graduation (ADR-0050) — pre-existing, carried, not introduced by this change | docs | XS | — | **next dts-baseline regen** |
| Architecture audit: `openspec/decisions/` has a PRE-EXISTING numbering collision — TWO files are both numbered `0050` (`0050-definefactory-core-internal-removal.md` and `0050-handle-unfreeze-honest-write-verb-rename.md`), predating this archive. NOT fixed here (out of this change's scope; renumbering a shipped ADR file changes its filename in history) — flag for a dedicated ADR-renumbering pass | docs | XS | — | **dedicated ADR-renumber pass** |
| Process: run `/sdd-init force=true` to raise the IPC sensitive-area confidence from `low` now that a real `EngineClient` implementation exists (design §4.8 migration-plan item) | process | XS | — | **next SDD command in this project** |
| **`.jsx` extension support for the React dialect** (deferred from `react-dialect` v1; owner-requested register 2026-07-16, mid-plan; **REAFFIRMED at react-dialect archive 2026-07-17**) — v1 gates `find()` to `.tsx` ONLY; plain-JS `.jsx` files stay unopenable by any dialect. The `.tsx` fidelity evidence does NOT transfer: `.jsx` (ScriptKind.Jsx, JS-flavored parse) is an unspiked print-fidelity surface — needs its own adversarial corpus + byte-exact spike mirroring the `.tsx` 20-sample discipline before admission. The v1 wrong-extension error already names this deferral (REQ-RXD-02). At archive of `react-dialect`, fold into the React op-catalog group plan or re-affirm standalone — never orphan (the spec Notes-for-sdd-archive cross-reference this row) | feature | M | `.jsx` fidelity spike (own corpus) | **React op-catalog follow-up plan** |

## From `react-dialect` archive (2026-07-17) — verify-final iteration 4, Council, and judgment-day followups

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **F-2** Relabel `ops.test.ts` scenario titled `REQ-RXD-11.5` to `REQ-RXD-11.6`; drop the stale "Deviation" comment; cite `06.8`/`11.6`/`15.1`/`15.2` by ID in test titles (REQ-RXD-06.5/REQ-RXD-15 traceability). Behaviours tested, IDs missing. Non-gating | docs | XS | — | **next `ops.test.ts` touch** |
| **F-3** Commits `2079023`/`5749bf2` are non-building (consumer landed before producer). HEAD typechecks clean; affects `git bisect`/apply-progress item-9 map only. Squash-on-merge resolves it. Non-gating | process | XS | — | **next PR merge to main** |
| **F-4** (widened this iteration) Add `docs/README.md` + `docs/quickstart.md` to `design.md` §4.2 file-changes table; bump `Revision: 2` → 3; **and** bump header `Spec: V4 signed` → **`V8 signed`** (now four versions stale, verify-report §8). Non-gating | docs | S | — | **next `design.md` touch** |
| **F-5** `design.md:138`'s "every react reject routes through `reject-tail.ts`, by construction" is not literally true (extension-gate rejects in `index.ts` + `ast.ts:75` throw fixed literals directly). Reword to the accurate universal, or route the permitted path echo through a bounded helper. Non-gating | docs | XS | — | **next design audit** |
| **F-6** Spec V5's changelog description of *how* message/spec agreement was achieved is inaccurate; outcome correct. Suggestion | docs | XS | — | **spec archival pass** |
| **F-7** ADR-02 `Status: Proposed` though fully implemented and verified; flip to `Accepted` at archive | docs | XS | — | **immediately (archive step)** |
| **F-8** The `assertNotReservedWord` message (and constant name `IMPORT_RESERVED_WORDS`, and test assertions) call `eval`/`arguments` "reserved words" — the exact taxonomy V6 spends a paragraph refuting. Spec-CONFORMANT (REQ-RXD-06.9 requires naming "the reserved-word rule"), not a defect. Widening the message (e.g. "reserved word or restricted in strict mode") touches 06.9's assertion → needs a spec touch, not a drive-by. Nit | docs | XS | — | **next spec touch** |
| Round-3 suggestion (1) | Set-key-safety static scan heuristics: the scan regex matches only 4 hardcoded variable names and the `//`-comment strip is greedy past string literals containing `//`. Test-only defense-in-depth; runtime code verified correct (`.has()`/`===`/`.includes()` only). Suggestion, unconfirmed | test-coverage | XS | — | **next `name-validation.test.ts` scan update** |
| Round-3 suggestion (2) | A self-alias `import { X as X } from "m"` + `addImport("X", "m")` produces a false-positive collision reject where a no-op would be ideal. SPEC-CONFORMANT (Step 1 requires UNALIASED; a self-alias is syntactically aliased), extremely rare, would need its own spec touch. Suggestion. **TS-DIALECT SIDE RATIFIED 2026-07-21 (`ts-addimport-collision` archive)**: the TS dialect's own `addImport` deliberately DEVIATES from this React posture — self-alias is Step 1 idempotent no-op by design (REQ-TSD-01.15, sign-off ratification #4), so a second dialect never reproduces this false positive. The REACT instance this row describes is UNCHANGED (`src/dialects/react/ops.ts` had zero diff this round, arm a keeps it byte-sealed) — still open, owner's call whether to broaden React to match | edge-case | XS | — | **React side: next spec amendment if prioritized; TS side: closed (ratified deviation)** |
| Element-grammar capability gap | `ELEMENT_NAME_GRAMMAR` does not admit `$`, JSX namespace (`svg:rect`), or non-ASCII component names. Capability limit, not a defect; register as a React op-catalog follow-up candidate | feature | S | — | **React op-catalog plan** |
| `getAttribute` first-match | `setJsxProp`'s upsert uses ts-morph `element.getAttribute(propName)`, which returns the first match; behaviour correct for well-formed JSX (duplicate attributes are invalid), but the semantics deserve an explicit note in the op-catalog followup | docs | XS | — | **React op-catalog follow-up** |
| ~~**SHARPENED TS-dialect `addImport` merge-defect debt — DISTINCT from pending item 22**~~ **CLOSED 2026-07-21 (`ts-addimport-collision` archive)**: `src/dialects/typescript/ops.ts`'s `addImport` is rewritten to the four-branch model (idempotency → collision → merge → create, REQ-TSD-01) — the full Defect-1/2/3 family (type-only merge, cross-module/value-namespace collision, aliased-to-different-name collision) plus the value-namespace collision this row anticipated are now closed, verified 50/50 against the signed spec (`verify-report.md`), judgment-day APPROVED. `addImport("Def","m")` no longer emits `import Def, { Def } from "m"` or any other invalid duplicate binding on ordinary input | refactor | M | — | **closed** |
| TS-dialect trust-boundary JSDoc backfill | `addFunction`/`addVariable`/`addClass` `source`/`initializer` args carry no REQ-RXD-12-equivalent trust note; backfill (distinct from item 22's validator retrofit). **PARTIAL CLOSE 2026-07-21 (`ts-addimport-collision` archive)**: `addImport`'s OWN trust-boundary JSDoc is delivered (REQ-TSD-13.5 — affirmatively names the sibling ops' `name`/`source`/`initializer` as still-raw, from `addImport`'s side). The siblings' OWN JSDoc headers remain un-backfilled — that remainder FOLDS INTO the "sibling name/source/initializer raw-splice exposure" row registered below; do not track both | docs | XS | — | **`addImport`-side closed; sibling-doc remainder — see raw-splice-exposure row below** |
| Default/mixed-import support | React `addImport` is named-only (REQ-RXD-05.4); default/mixed imports are React op-catalog follow-up scope | feature | S | — | **React op-catalog plan** |
| DOC-3 | `could not parse "X" as TypeScript` hardcoded in the dialect-GENERIC `src/core/dialect-handle.ts:178`; `test/core/dialect-handle.test.ts:328` pins the wrong text. A correct fix threads a per-dialect display name through the shared seam — the engine change this change's triage excludes. Registered pending-change | refactor | S | — | **next engine/core shared-seam change** |
| ARCH-2 | `src/core/jsx-name-validator.ts` holds JSX-specific grammars in a file-type-agnostic layer with one consumer. Not a rebuild: extend ADR-01's peer-module followup — at dialect #3, split `validatedOp`+`reject-tail` (genuinely core) from the JSX grammars (move to the leaf) | refactor | S | — | **dialect #3 arrival** |
| Subprocess-timeout debt | Pre-existing, out of scope: subprocess-bound tests declare no explicit timeout against bun's 5000ms default. Fix = explicit per-test timeouts (~30 min), NOT a raised global timeout. Environmental companion: Defender real-time-scan exclusion for the repo / `.tmp-*/` scratch dirs | test-infra | S | — | **test-infra debt pass** |

## From engine handoff `create-template-authoring-guide` (2026-07-18) — docs adaptation followup

Engine shipped the `create` template renderer + an authoring guide; adapted as the SDK's
official `docs/create-templates.md` (2026-07-18). One mechanism gap surfaced during adaptation:

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Typed feeder for array/object `create` options**: the engine's v1 wire expects array- and object-valued option values as JSON-encoded STRINGS (it promotes a string value beginning with `[` or `{` into a real array/object before rendering), while the SDK forwards `options` verbatim — so authors must `JSON.stringify` lists at the call site today (documented as the v1 mechanism in `docs/create-templates.md` § Appendix). **OWNER-RULED 2026-07-18: resolves SDK-SIDE** — call-site `JSON.stringify` is acceptable as the v1 mechanism, but the conversion belongs inside the SDK: accept native arrays/objects in `create()` and encode at the wire boundary (pairs naturally with the `pbuilder-codegen` typed-options surface). The engine-side alternative (PC-PROTO-01 ratifying native JSON option values) is no longer the preferred path — if PC-PROTO-01 lands it anyway, the feeder reduces to pass-through. On landing, update `docs/create-templates.md` § Appendix + the §1 example to native arrays | feature | S | — | **SDK-side (own change); cross-repo tether with PC-PROTO-01** |

## From `typed-options-feeder` (2026-07-18) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **AuthoringError-parity for scheduling-time option rejection** (ADR-03 Consequence): upgrade `encodeOptions`' plain-`Error` reject to a structured `AuthoringError` with `originFor` attribution, restoring the Stage-2 `unrepresentable-content` depth the interim plain Error shadows for function/BigInt/symbol create-options. Now touches **3** test sites (error-attribution, harness-result, harness-leak-scan), not the 1 originally scoped. TW-F3 (author-facing doc home for the scheduling-time reject) folds here | refactor | S | — | **S/M follow-up** |
| **ARCH-F1 (council fix round, post-final-verify)**: construction-direction fitness guard — assert that production `create` directives originate ONLY at `DirectiveFactory`. fit-39 blocks a second `encodeOptions`/options-`JSON.stringify` call site but does not block a fourth surface that hand-builds a `create` directive literal bypassing the factory entirely (`createOp`'s test-only raw construction is the sanctioned exception, ADR-03). Style precedent: FIT-15/22 | test-coverage | S | — | **next FIT suite update** |
| **QA-F3 (council fix round)**: `toJSON`-bearing plain objects reject as non-plain-JSON under this change's predicate, stricter than native `JSON.stringify` (which honors a `toJSON` method and serializes its return value instead of throwing). Document the divergence or revisit whether `toJSON`-bearing values should be admitted, when this area is next touched | docs | XS | — | **spec amendment or design-decision pass** |
| **QA-F4 (council fix round, widened by judgment-day)**: exotic inputs — a throwing getter, a hostile `Proxy`, or ~50k-deep nesting — surface their raw underlying error (stack overflow, proxy trap exception) rather than the key-named `rejectOption` contract REQ-TOE-04 promises for the documented non-plain-JSON kinds. Known limit; a depth/guard mechanism is a candidate for a future slice, not scoped here | edge-case | S | — | **advanced-options-encoding design** |
| **QA-F5 (council fix round)**: the classify-transport stat-gate's `>` boundary comparison (design §4.2c / `classify-transport.ts`) is unpinned by a dedicated exact-boundary test — benign (verdict-equivalent to `>=` for the byte-count domain in play) but worth a pinning test if that comparator is ever touched again | test-coverage | XS | — | **next content-classification touch** |
| **Scaffold budget estimator double-encode (optimization)**: scaffold by-value path encodes options twice (estimate + emit) — thread/cache the encoded result across the estimator and real factory path to avoid re-computing the same `JSON.stringify` | refactor | XS | — | **perf/refactor pass** |
| **React-dialect entries in engram architecture baseline** (pre-existing, surfaced here at obs #652): documenting that react-dialect pending items exist in the baseline obs for future cross-dialect decisions | docs | XS | — | **react-dialect archive completion** |
| **Stale IPC sensitive-area row** (sdd-init refresh needed): the registered `security (IPC)` sensitive-area row carries "no concrete code yet" — this change does not touch `src/core/session.ts` (the JSON-RPC transport), confirming the row remains aspirational | docs | XS | — | **sdd-init refresh to clarify scope** |

## From `conformance-corpus` (2026-07-19) — accepted as non-blocking at archive

Verify verdict `pass-with-followups` (2 robustness gaps + 1 documentation-debt, W1/W2/W3 —
W1 CLOSED in-change by JD-3, W2 superseded by JD-2, W3 CLOSED at this archive by ADR-0065's
generalized scope prose). Judgment-day APPROVED at Round 2 (R1: 3 confirmed real findings fixed
@ `caff939`; 1 finding refuted by orchestrator — Judge B misread commit order). Followup ledger
consolidated at judgment-day (engram obs #1311), registered below in full — 16 items, including
the architect's monotonic fixture-floor item (row 5).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| Strict-decoding mirror — closed-key-set whitelist per manifest level, rejecting unknown keys instead of silently ignoring them (JD-R2 suspect-A real; tech-writer risk #2) | refactor | S | — | **next fit-40 touch** |
| Inline fit-40 checks → extracted validators + negative coverage per rule (QA F1, judgment-day confirmed) | refactor | S | — | **next fit-40 touch** |
| Create total-count==1 + `session.buffer` raw `{op:"create"}` shape scan — widen the exactly-one-create invariant beyond the named-export heuristic | test-coverage | S | — | **next fit-40 touch** |
| REQ-CDT-05 POSIX-path scan gap: per-case `factory.module` + `schematicRoot` paths not covered (judgment-day confirmed, theoretical) | test-coverage | XS | — | **next fit-40 touch** |
| Monotonic fixture floor (corpus.json#fixtures.length MUST NOT decrease) + derive absolute case counts from the manifest set instead of a hardcoded literal (architect + judgment-day Judge A) | refactor | S | — | **next corpus-growth touch** |
| `seed/**` byte pinning — no scan currently proves seed file bytes match their documented content (QA F4) | test-coverage | S | — | **next fit-40 touch** |
| Import allow-list (REQ-CFX-01) is a deny-list in practice (bans known-bad imports) rather than a real allow-list (rejects anything not explicitly permitted) — tighten to allow-list semantics | refactor | S | — | **next fit-40 touch** |
| `manifest.json` `JSON.parse` failure doesn't name the offending fixture id in the thrown error — wrap with fixture-id context (QA F6) | refactor | XS | — | **next fit-40 touch** |
| Transcript coherence cross-checks (`callbacks[]` vs `outcome`) + an `exitCode` allow-list (only 0/1/2/3 are valid) (QA F7) | test-coverage | S | — | **next fit-40 touch** |
| Zero-effect schematic-cleanup open question: does the engine remove pre-staged-but-uncommitted files on a greeting-time exit-1 (`m1-vehicle`'s `greeting-mismatch-twin`)? Escalate to the engine team (judgment-day Judge B) | edge-case | — | Cross-repo — engine confirmation | **engine repo, cross-repo flag** |
| `greetingVersion` absent-default semantics need engine confirmation — what the engine assumes when a manifest omits the field (judgment-day Judge A) | edge-case | — | Cross-repo — engine confirmation | **engine repo, cross-repo flag** |
| Payload variety — no case exercises non-ASCII content, empty-string content, deeply-nested schematic trees, or near-cap-size payloads | test-coverage | S | — | **corpus-growth candidate** |
| ~~ADR-0065 scope prose — the ADR was written for "the multi-behaviour composition fixture" only, yet the per-case `factory` mechanism it introduces is depended on by 5/12 cases across all 4 `m2-*` fixtures~~ **CLOSED 2026-07-19 (this archive)** — `openspec/decisions/0065-per-case-factory-override-composition-fixture.md` states the generalized scope explicitly | docs | XS | — | ~~next design audit~~ **closed** |
| Engine M1 confirmation of the corpus (first real submodule-consumed run) — external, non-gating per steward reckoning CQ-3 | other | — | Engine M1 milestone | **engine repo, cross-repo flag** |
| Negative-suite (`fit-40-*.negative.test.ts`) temp-dir cleanup — confirm every `mkdtemp` fixture tree is removed on both pass and fail paths | test-infra | XS | — | **next negative-suite touch** |
| README first-paragraph anchor could name the dist-early-return guarantee (REQ-CFX-14) alongside the four-way disambiguation, for a reader who lands mid-doc | docs | XS | — | **next README touch** |

## From `ts-addimport-collision` (2026-07-21) — ADR-03 shebang-aware insertion, registered at S-004

ADR-03 (design.md) ships the pre-authorized FALLBACK for REQ-TSD-01.33: today's shebang fail-closed
containment is PINNED as a regression guard (S-004.2, `ops-addImport.test.ts`); shebang-aware
insertion is deferred as this followup, per design §4.8's migration/rollout plan (registration
brought forward to apply-time per `slices.md`'s S-004.4 task, ahead of this change's own archive).

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Shebang-aware `addImport` insertion** (ADR-03): a shebang file (`#!/usr/bin/env node`) rejects `addImport` today with a HANDLE-contained fail-closed error — ts-morph's `insertImportDeclaration` throws `ManipulationError: A syntax error was inserted` on ANY top-of-file insertion because the shebang is `SourceFile` leading trivia, not a statement, so `.21`'s directive-prologue mechanism cannot target it. A correct fix needs a DIFFERENT text-surgery mechanism (strip the shebang line → insert the import → re-prepend the shebang line, the same class of surgery `ast.ts`'s BOM handling already does) — empirically probed and confirmed distinct from `.21`'s statement-index insertion (pinned ts-morph@28.0.0, design ADR-03). Until built, `addImport` on a shebang file stays a contained reject (REQ-TSD-01.33, `ops-addImport.test.ts`) | feature | S | — | **next TypeScript dialect `addImport` change** |

## From `ts-addimport-collision` archive (2026-07-21) — verify-final, judgment-day, and ledger-reconciliation followups

Verify verdict `pass-with-followups` (50/50 REQ coverage, suite 2136/0, zero critical/warning
findings, 3 SUGGESTION followups F-1/F-2/F-3). Judgment-day APPROVED (Round 2 — Round 1 fixes
`2c731b4`; INFO/theoretical items deferred here per both judges' convergence). Steward reckoning
DELIVERED (2 conscience questions owner-affirmed 2026-07-21). Architecture audit gate resolved by
HUMAN OVERRIDE (`architecture-override.md` — pre-existing, unrelated `engines.node`/CI mismatch);
the alignment row below is that override's registered obligation.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Sibling `name`/`source`/`initializer` raw-splice exposure** (consolidates the sibling-scope remainder of the CONFIRMED-injection row above + the sibling-JSDoc remainder of the trust-boundary-backfill row above): `addFunction`/`addVariable`/`addClass`'s `name`/`source`/`initializer` arguments remain RAW-SPLICED and UNVALIDATED — this change closes the injection and adds the trust-boundary JSDoc for `addImport` ONLY (REQ-TSD-13, REQ-TSD-13.5), an asymmetry the shipped CHANGELOG and `addImport`'s own JSDoc now AFFIRMATIVELY name rather than silently leave implicit. Fix needs its own validator retrofit (the `source`/`initializer` args are free-form code, not identifiers — NOT fully validatable the way Group 1's identifier-only args are) plus each sibling op's own trust-boundary JSDoc | security | M | — | **next TypeScript dialect `addFunction`/`addVariable`/`addClass` change** |
| **Sibling collision-scan asymmetry (Arch N4)**: post-`ts-addimport-collision`, `addImport` (via `boundNamesIn`) detects default/namespace import collisions file-wide, but `assertNoCollision`'s import scan (`ops.ts:66-69`, consumed by `addFunction`/`addVariable`/`addClass`) still walks `getNamedImports()` ONLY — e.g. `import Foo from "m"` + `addFunction("Foo", …)` does not reject, emitting a TS2451-class invalid duplicate binding. The `isValueNamespaceClaimed` extraction this change made does NOT touch this scan; closing it is a separate change | bugfix | S | Blocks `addDefaultImport`/`addNamespaceImport` (same precondition the superseded row above named) | **next TypeScript dialect `addFunction`/`addVariable`/`addClass` change** |
| **F-1** REQ-ID namespace collision (traceability hygiene): `typescript-dialect` and `testing-story-docs` both use the `REQ-TSD-` prefix — `test/docs/testing-story-docs.test.ts` labels unrelated tests `REQ-TSD-01.1/.3/.4`, contaminating REQ-ID-based coverage greps for the TS dialect. Rename the docs spec's prefix (e.g. `REQ-TSTORY-`) to disambiguate | docs | XS | — | **next `testing-story-docs` touch** |
| **F-2** Tighten FIT-41 cross-module parity: add a REQ-TSD-01.14 reject-verdict parity row (currently omitted from the cross-module bucket) and align the `.28`-labeled row's fixture to the alias-vs-underlying-export semantics it's meant to represent (currently a plain alias merge, not `.28`'s exact shape). Quality tightening only — normative behaviour is already covered by dedicated unit tests (`.14`/`.28`) | test-coverage | S | — | **next `fit-41-addimport-parity.test.ts` touch** |
| **Judgment-day INFO bundle — test hardening** (Round 1 + Round 2, both judges, non-gating): (1) a positive path-clause assertion on the collision reject (mutant-resistance); (2) a zero-directives assertion inside `expectCollisionReject`; (3) a >100-char echo-bound regression test (today's bound is pinned at ≤16 chars but untested past typical-length inputs); (4) the `.28`-vs-`.29` fixture/scenario label needs a clearer distinguishing comment; (5) Step-1's `declarationsForModule` computation is reused rather than re-derived where a call site currently repeats it | test-coverage | S | — | **next `ops-addImport.test.ts` touch** |
| **Judgment-day INFO bundle — contract pins** (Round 1 + Round 2, both judges, non-gating): (1) a directive-prologue + existing-same-module-import insertion-position pin (untested combination: an import merge target that also has a leading directive); (2) shebang + directive posture wording in scenario `.33` needs tightening now that the fallback arm is confirmed shipped; (3) an ASCII-only identifier grammar i18n note — `IMPORT_RESERVED_WORDS`/the grammar regex are ASCII-only by design, undocumented as a stated limit rather than an oversight | docs | XS | — | **next `REQ-TSD-01.33` / grammar-note touch** |
| **Engines/CI version alignment** (obligation from `architecture-override.md`, HUMAN OVERRIDE 2026-07-21): `package.json:27` declares `engines.node >=25.9.0` while `.github/workflows/publish.yml:42` runs CI on `node-version: "22"` — pre-existing, unrelated to this change, but this change's archive is where the override's registration obligation is discharged. Direction (bump CI to match engines, or relax engines to match CI) is this future change's own decision to make | bugfix | XS | — | **own scoped mini-change** |
