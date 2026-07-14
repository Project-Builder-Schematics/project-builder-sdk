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
| (1.6 verify follow-up) Confirm `BATCH_CAP_BYTES` against the real engine frame limit before freeze + consider structural no-consumer-outside-wire.ts scan. *Engine-side verified 2026-07-06: same seam as `bunipc.MaxMessageBytes` (4 MiB), values coincide; will be named as a contract value in engine PC-PROTO-01 — keep the "not engine-confirmed" flag until then* — **RE-TAGGED to PC-PROTO-01/public-package plan (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.4)** | edge-case | S | Before public-package plan freeze (PC-PROTO-01 names it) | **PC-PROTO-01 / public-package plan** |
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
| EmitRejection port conformance for the real engine client: a directive-level code without in-range `failedIndex` yields a malformed public message ("undefined failed at undefined: …") and a spurious index on batch-level codes contradicts REQ-14.3 (judgment-day CONFIRMED theoretical, both judges). Enforce the precondition in the client, or degrade to `reason: "unknown"` in `toAuthoringError`. The convention is baseline-recorded and binds the real engine client (ADR-0022 revisit) — **RE-TAGGED away from Stage 6 (`stage-6-release-shape`, 2026-07-14, REQ-AOD-09.2): no real `EngineClient` exists in this repo** | edge-case | M | Cross-repo — engine ADR-0022 revisit (PC-PROTO-01) | **engine repo, cross-repo flag (with PC-PROTO-01)** |
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
| **BRC-02 — engine ceiling re-derivation + TOCTOU closure**: the engine MUST re-derive its OWN containment ceiling for a by-reference (`copyIn`) source — open-then-fstat, never trusting the SDK-resolved `packageRoot`/`packageDir`. Anchor pin (ADR-0043 rev 2, seam clause S2): the emitted `copyIn.from` is relative to the RESOLUTION anchor (`packageDir`), not the containment ceiling (`packageRoot`) — the engine resolves `from` against its OWN re-derived `packageDir`, mirroring the SDK-side `package-root-containment` REQ-PRC-01 anchor distinction | security | M | Blocking engine apply-pass for `copyIn`/by-reference `scaffold` entries | **engine repo, cross-repo flag (with PC-PROTO-01)** |
| **BRC-08 — non-canonical path-form rejection + single-pass literal-token render**: the engine MUST reject non-canonical path forms (UNC/device/reserved-DOS/drive-relative) for BOTH the by-reference source and the rendered destination, and MUST render a `create` directive's `pathTemplate` single-pass (substituted token values are literal segments, never re-scanned as further template syntax). Canonical-form hardening is explicitly OUT of SDK scope — `package-root-containment` REQ-PRC-04/Q24 case-folds on case-insensitive platforms SDK-side only; this row is the engine-side complement | security | M | Blocking engine apply-pass for `copyIn`/`scaffold`/`create({templateFile})` | **engine repo, cross-repo flag (with PC-PROTO-01)** |
| **PRC-06 — post-render destination containment**: the engine MUST enforce destination containment POST-RENDER — after token substitution, the final on-disk destination path must be re-validated against the target workspace boundary. SDK-side `validateDestinationLexical` (`package-root-containment` REQ-PRC-09) is lexical-only, pre-render, and cannot see rendered token values — it is DX/attribution only, never the security control for a rendered destination | security | M | Blocking engine apply-pass for `scaffold`/`create` | **engine repo, cross-repo flag (with PC-PROTO-01)** |

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
| Root `.gitattributes` eol=lf rule for cross-platform corpus determinism — Windows CRLF line-ending mode in `.gitattributes` could introduce platform-specific corpus divergence; add `* eol=lf` to enforce Unix line-endings on checkout | refactor | XS | — | — |
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

## From engine↔SDK wire design (2026-07-14) — registered from design discussion, no change yet

Design record: `docs/engine-sdk-wire-design.md` (stdio JSON-RPC single-initiator; runner contract
per the bare-factory owner direction, obs #2070; `collection.json` without a `schema` field —
adjacency convention per ADR-0031 owns the schema location). Cross-repo contract with the Go
CLI/engine; the wire spec is a deliverable of the change, not a prerequisite from the engine side.

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| `StdioEngineClient` — first real `EngineClient` implementation (JSON-RPC over stdio, NDJSON framing, `session.init` version handshake, engine rejections mapped to ADR-0022 `EmitRejection`). Ships together with: the `pbuilder-runner` bin (argv contract `--factory <url>#<export>` / `--input` / `--input-file`; resolved PROJECT-LOCAL per the single-SDK-instance pin — engine must never bundle its own SDK copy, or the module-level ALS splits and every verb throws `outside-run`; wraps the author's BARE factory export with the runner-internal `defineFactory`, supplying `packageDir = dirname(factory)` via the adjacency convention), a normative wire spec (versioned with the handshake), and a scripted fake-engine conformance harness (spawned process speaking NDJSON over real stdio — no Go required to verify). Consumes the `defineFactory` graduation direction (obs #2070, stage-4b row above) | feature | L | Before any engine-backed release | **not now — later engine-backed milestone (ROADMAP §6)** |
| Factory scaffold (`pbuilder-codegen` extension or `init-schematic`) emitting a typed bare `factory.ts` (`(input: Input) => void`) plus adjacent `schema.json` — DX counterpart of the bare-export contract (authors never write `defineFactory` boilerplate; the typed signature is the compile-time anchor the wrapper's generic used to provide) | feature | S | — | with the runner change |
| Author-surface migration to the bare-factory shape (blast radius measured 2026-07-14): rewrite the 5 author-facing docs showing the wrap (`README.md` ×7, `docs/quickstart.md` ×4, `docs/dry-run.md` ×3, `docs/authoring-verbs.md`, `docs/authoring-errors.md`) + their fenced-snippet compile tests; change `runFactoryForTest` to accept the bare `(input) => void` shape, wrapping internally via the SAME code path the runner uses (parity-by-identity, FIT-18 philosophy); drop `defineFactory` from public subpath exports + exports-guard baselines (FIT-09/FIT-14, `./testing` facade re-export). Transition guard in the runner: brand-detect an already-wrapped export and reject with an educational error (double-wrap = cryptic destructuring TypeError otherwise); guard retires once the export is gone. NOT migration work: the ~67 internal test files calling `defineFactory` directly — it remains internal API | docs | M | — | **with the `defineFactory` graduation (public-package plan) — consumes obs #2070** |
