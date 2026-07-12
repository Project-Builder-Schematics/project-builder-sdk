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
| ~~W1 · REQ-PKG-01 live-resolution smoke test (pack→install→assert `/core` throws, `/commons` resolves)~~ **SUBSUMED 2026-07-12 (`stage-4b-testing-harness` archive)** — REQ-TES-06's installed-consumer-vantage e2e (`test/e2e/installed-consumer.e2e.test.ts`) delivers the same pack→install→resolution mechanic plus the two founding-bug behavioural scenarios; W1 is superseded, not duplicated | edge-case | S | ~~Before live publish~~ **closed** | ~~6.2~~ |
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
| provenance go-live checklist (remove `--dry-run` at first real release + assert live provenance via npm attestation; dry-run staged in publish.yml) | refactor | XS | Before live publish | **6.2** |
| README front-door dialect entry (Stage 6.3 scope: new author's first view should advertise `find().addImport()`, not just stub concept) | docs | S | When Stage 6 front-door lands | **6.3** |
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
| Stage-6 `./core` production graduation: `defineFactory`'s production import home stays `./testing` until then (PM M4; steward CQ1 — an author's PRODUCTION `factory.ts` imports from a path literally named `./testing`; works today, 0.x-exempt, but is a naming-worth call for the owner to confirm, not a usability failure). **OWNER-RULED 2026-07-12 (stage-6 explore gate): stays `./testing` for stage-6; graduation re-registered as a mandatory re-evaluation inside the future public-package plan (pre-live-publish gate) — candidate home `./factory` per stage-6 explore blast-radius table** | other | M | Pre-live-publish | **public-package plan (own change)** |
| Throw-value-shape triangulation: a factory that `throw`s `undefined` is indistinguishable from success in `result.error`, and a `null` throw is a falsy-error-consumer hazard for authors who write `if (result.error)` (QA council) | edge-case | S | — | **backlog** |
| Exotic-path pass-through pin: path-traversal (`../`), NUL-byte, and unicode-normalization-edge paths are stored verbatim by the fake with no dedicated scenario pinning that behaviour (QA council) | test-coverage | XS | — | **backlog** |
| `deepEqual`'s `key in`/bracket-access pattern in `src/testing/contract-fake.ts` (batch-payload comparison) is the SAME class of prototype-chain leak the seed-lookup fix (`fbb3053`) closed for seed reads — inherited `Object.prototype` members could spuriously match on payload keys (fix-agent flag, unconfirmed on batch path) | edge-case | XS | — | **next `contract-fake.ts` touch** |
| FIT-17's dev-only bundle guard scans minified builds of the `src/` ENTRY FILES as a proxy for `dist/` (equivalence argued via tsc's 1:1 emission, §4.7) — have it scan the shipped `dist` entries directly as the source of truth instead (security council, low severity) | refactor | S | — | **backlog (hardening)** |
| Widen `REQ-ATH-11`'s in-memory instrumentation to cover `node:child_process` (SEC-m3, executor-optional at build time — never added) and dynamic `import()` parity, alongside the existing fs/net/Bun-I/O/fetch/env/argv surfaces (security council) | refactor | S | — | **backlog (hardening)** |
| Long-term form of ship-the-fake: `ContractFake` currently ships inside the production npm tarball behind six structural containment guards (ADR-0034) — is a permanent containment surface the right long-term shape, or should it become a separate `@pbuilder/testing` package (or BYO-fake docs)? Accepted 0.x expedient by owner ruling (ADR-0034); flagged for a deliberate long-term-form nod (steward CQ3, owner-nod pending, non-blocking) | other | L | — | **re-evaluate alongside `@pbuilder/sdk-kit` extraction (6.2)** |
| `RunResult.error`'s typed union `AuthoringError \| unknown` collapses to `unknown` at the type-checker (no narrowing value from the union today) — revisit the result-shape typing at the next 0.x result-shape iteration once `./testing` graduates past its semver-exempt window (arch note, verify-report) | refactor | XS | — | **next 0.x result-shape iteration** |

## From stage-6 planning grooming (2026-07-12) — owner-validated gaps

Owner use case validated in-session: schematics need to copy asset files from the schematic
package folder into the target tree (Angular Schematics' `apply(url('./files'))` mental model).
Two distinct debts surfaced:

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| `copy` verb is emit-only end-to-end: SDK emits the directive correctly, fake + conformance vehicle simulate it faithfully, but the REAL engine drops it until the apply pass lands (ADR-0013 §copy; engine-side bytes-by-reference via `SourceFS` deferred to engine ADR-0028 §copy) — green tests ≠ files copied; needs the engine apply pass plus a real-wire assertion when PC-PROTO-01 unblocks integration | other | — | Engine ADR-0028 §copy apply pass | **cross-repo flag (with PC-PROTO-01)** |
| Schematic-package asset → target tree has NO mechanism: `copy` is tree→tree only (fake enforces `from` exists in the tree, FAKE-06); no `apply(url('./files'))` equivalent, no source-FS notion (ADR-0008 keeps the SDK disk-blind by design). Workaround today: author-side `readFileSync` + `create` — text only; binary assets cannot travel the text wire (ADR-0019). Candidate primitive: `SourceFS` bytes-by-reference at the engine seam. **OWNER-RULED 2026-07-12: out of stage-6 — own change** | feature | L | Engine seam contract (cross-repo) | **own change** |
| FIT-09/FIT-14 exports-guard extensibility refactor: split the frozen exact flat subpath list into a stable-core exact assert (`.`, `./commons`, `./conformance`, `./testing`) + an extensible dialect-set pattern assert, so a new dialect subpath is a one-row addition instead of a multi-file edit (package.json + FIT-09:77 + FIT-14:86-88 + baseline JSON). OWNER-RULED 2026-07-12: deferred — stage-5b adds no subpath (breadth within `./typescript`, exports byte-identical); first real consumer is a second dialect no plan contains yet | refactor | S | — | **second dialect (own trigger)** |
| **Public-package plan (own /plan cycle, owner-carved 2026-07-12 at stage-6 explore gate; EXTENDED 2026-07-12 at stage-6 steward foresight, CQ2)**: everything that makes `@pbuilder/sdk` a package OTHER PEOPLE consume — GitHub Packages dual-name config (`@project-builder-schematics/sdk` publish-time rewrite, consumer `.npmrc` auth-wart docs), live npm publish readiness + go-live interlocks (GitHub Environment reviewer gate, tag-triggered publish), `defineFactory` home re-evaluation (row above), and whatever real engine integration reveals is missing. **Now ALSO absorbs the npm placeholder publish** (deferred at steward foresight, CQ2 — the `@pbuilder` scope is already owner-controlled, so an inert stub buys no security today): the stub itself, ADR-0040's reasoning, the fit-22 inertness suite, the RUNBOOK, and the `0.0.1` semver-floor decision. Rationale: "mientras funcione el bun link… por el momento es overkill porque no está preparado para que nadie lo use." Stage-6 now keeps only: hardening of the EXISTING publish.yml surface (W3 guard, SHA pins) and the local consumption story — ZERO registry writes | feature | L | L1-readiness (post engine integration) | **own change (post-6)** |
