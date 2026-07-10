# Specs: stage-4b-testing-harness

**Spec version**: V3
**Status**: signed (owner, 2026-07-10 — V3 micro-unfreeze re-signed same day on
steward-foresight CQ2 = YES authorization: opted-in factories are supported through the
harness; V2's TES-07 facade-off-allow-list judgment call remains confirmed, untouched by
this unfreeze)
**Change**: `stage-4b-testing-harness`
**Triage**: L

## Upstream Ingest / Sync

`spec_source: internal` — Step 5b (upstream ingest) and Step 10b (upstream sync) do not
apply. This spec is authored directly from the proposal.

## Overview

Schematic authors cannot test the factories they write: `defineFactory` is unreachable
from any installed `@pbuilder/sdk`, and the one normative `ContractFake` is repo-internal.
This change adds a third public audience — `author-testing` — surfaced through a single
new subpath, `./testing`, exporting `defineFactory` and a new `runFactoryForTest` wrapper
that runs a factory in-memory against the normative fake and returns a result an author
can assert on directly. Four capabilities carry the work: the harness itself
(`author-test-harness`), the entry surface and its containment guards
(`testing-entry-surface`), collapsing the fake to one physical implementation
(`fake-single-source-parity`), and positive documentation
(`testing-story-docs`). **V2** applies three binding owner rulings (2026-07-10) and encodes
all council findings from V1's blind review (4 lenses: security, QA, business-analyst,
tech-writer). **V3** (micro-unfreeze, owner CQ2 = YES, 2026-07-10) resolves
steward-foresight condition C1: REQ-ATH-11's in-memory-only invariant is re-scoped to
harness MACHINERY only — never the factory-under-test's own legitimate disk read — and a
new REQ-ATH-13 lets authors test a `packageDir`-opted-in factory's (stage-4 ADR-0029)
schema-validation rejection through `result.error`.

## Glossary

- **harness**: the `./testing` facade (`runFactoryForTest` + `defineFactory`) — the
  author-facing surface this change adds. Not the fake itself.
- **the fake** / **ContractFake**: the ONE normative `EngineClient` stand-in. After this
  change it has exactly one physical implementation, under `src/testing/`. Never exported
  by name from `./testing` — value or type (SEC-M3).
- **committed tree**: the path→content map `ContractFake.commit()` promotes staged writes
  into — what `runFactoryForTest`'s `tree` result field exposes. **RECONCILED V2 (owner
  ruling, 2026-07-10)**: committed tree means COMMITTED WRITES ONLY. Seed content is
  EXPLICITLY NOT INCLUDED, regardless of whether the run reads or ignores it — seed is
  observed exclusively through the factory's own `find`/read calls, never through
  `result.tree`.
- **emitted IR**: the sequence of `Batch` values recorded from every
  `EngineClient.emit` call during a run, in call order — what `runFactoryForTest`'s
  `emitted` result field exposes. Spy-style recording (mirrors
  `test/support/spy-client.ts`'s `makeSpyClient`), not a kit type. `Batch`/`Directive`
  themselves are TYPE-ONLY documented re-exports from `./testing` (owner ruling,
  2026-07-10) — never runtime values.
- **unrendered-template non-promise**: a `create` directive's `template` field is stored
  in the tree AS WRITTEN by the author — never interpolated/rendered. Rendering is the
  engine's (Go CLI's) concern, out of this SDK's scope entirely.
- **installed-consumer-vantage**: an assertion made from the position of a real installed
  package consumer — built, packed (`bun pm pack`), installed into a scratch directory,
  and imported BY PACKAGE NAME (never a relative `dist` path). Distinct from a
  spawn-and-relative-import check, which never exercises the `exports` map.
- **fitness function**: this SDK's house term for a build/CI-time structural or contract
  check (the `FIT-NN` test files).

## Stability & 0.x Exemption Clause

`./testing` is a NEW public entry, third audience under ADR-0009's amendment
(`author-testing`). Per owner ruling P4, it ships **0.x semver-exempt** — like the kit —
until validated by real use. This keeps `runFactoryForTest`'s result-shape iteration cheap
during this phase: REQ-ATH-01's shape and REQ-TES-05's dts-baseline coverage are both
scoped so that widening the result later is NOT treated as breaking under FIT-04 while the
exemption holds. FIT-04 baseline granularity for `./testing` (entry-only `.d.ts` vs. the
whole `src/testing/**` tree) is left as an explicit **design input** — this spec requires
COVERAGE of the `./testing` surface by the semver gate, not a pinned file set. **V2**: this
exemption must be COMMUNICATED, not merely decided — REQ-TSD-01 and REQ-TSD-02 both require
it stated in the README and in `runFactoryForTest`'s JSDoc respectively (TW-M2); ADR-0032
(REQ-TSD-04) records it as the decision of record, but is no longer the ONLY place it's
said.

## Suite Cost Acknowledgement & Design Constraint (QA-M4, new V2)

Cumulative test cost across this change's fitness/e2e surface is non-trivial: the dev-only
bundle guard (REQ-TES-04) needs minified builds of FOUR entries (`.`/`./commons`/
`./conformance`/`./testing`) for its absence+presence checks; FIT-04's dts baseline
(REQ-TES-05) needs its own build; the installed-consumer-vantage e2e (REQ-TES-06) needs a
full build PLUS `bun pm pack` PLUS a scratch-dir install; and REQ-ATH-09.2's batch-cap
fixture pushes a ~4 MiB payload through a run. Taken together this is roughly 2 full
production builds, a pack+install cycle, and ~7 minified per-entry builds across the suite.
**DESIGN CONSTRAINT** (binding on `sdd-design`, not itself a REQ): REQ-TES-05 (FIT-04),
REQ-TES-04 (FIT-17), and REQ-TES-06 (the e2e) MUST share ONE build artifact wherever their
build inputs are identical, rather than each triggering its own `bun run build` —
`sdd-design` must specify the sharing mechanism (e.g. a session-scoped build fixture)
before slicing.

## Cross-Change Notes

1. **W1 subsumption.** REQ-TES-06 (installed-consumer-vantage e2e) SUBSUMES pending row
   W1's mechanic (pack→install→resolution assertions). Archive grooming for this change
   MUST rewrite/retire W1 rather than leave a duplicate open item.
2. **Sequencing.** REQ-TSD-03 (README qualifying-line revert) is sequence-gated on
   `stage-4-typed-options` archiving first (its own REQ-FPS-05.4 puts the line there). If
   this change builds before that archive lands, REQ-TSD-03's slice is DEFERRED, never
   silently dropped.
3. **Numbering.** Next free fitness number claimed here: **FIT-17** (REQ-TES-04). Next free
   ADR: **0032** (REQ-TSD-04). No collision with Stage-4's FIT-12..FIT-15 or ADR-0027..0031
   drafts.
4. **Read-only upstream.** Stage-2 (`stage-2-error-attribution`) and Stage-4
   (`stage-4-typed-options`) signed specs are NOT touched by this change. Any FIT-14
   (Stage-4 package-surface guard) interaction is a design-phase note, not a spec REQ here.
5. **Ground truth.** Written against `main@413b2aa`; Stage-4's typed-options code is
   unmerged in this worktree — this spec targets the state after that merge (Dependencies,
   proposal.md).
6. **Sensitive-areas grooming (SEC-m3, new V2).** `openspec/sensitive-areas.md` rows 1
   (security — supply-chain, "published package surface") and 6 (public-api contract,
   `package.json#exports`/`.d.ts`) MUST be updated at archive grooming: row 1 gains
   `./testing` as a published entry carrying the fake (containment stays graph-scoped, not
   a change to the row's confidence); row 6's FIT-10 allow-list note now spans `src/**`
   (REQ-TES-07), not just `src/core/**`.
7. **V3 opted-in factory dependency (steward CQ2, new V3).** REQ-ATH-13 and REQ-ATH-11.2
   depend on `stage-4-typed-options`'s MERGED `context.ts` shape (`defineFactory(fn, {
   packageDir })`, ADR-0029) — both scenarios are marked STAGE-4-MERGED-DEPENDENT and
   cannot pass on main-today, mirroring REQ-TSD-03's gate (Cross-Change Note 2). If
   stage-4's final merged opt-in shape shifts before this change builds, these scenarios
   re-verify at rebase. Stage-4's spec/design files remain READ-ONLY to this change (Note
   4, unchanged).

## REQ Index

| REQ-ID | Domain | Name | V3 Status |
|---|---|---|---|
| ATH-01 | author-test-harness | `runFactoryForTest` result shape | modified (+2 scenarios) |
| ATH-02 | author-test-harness | Write-only factory commits at run end | preserved |
| ATH-03 | author-test-harness | All-or-nothing rejection → empty tree + attributed error | modified (+1 scenario) |
| ATH-04 | author-test-harness | Seeded read visibility | modified (scenario rewritten +1 new) |
| ATH-05 | author-test-harness | Empty factory → empty tree, no error | modified (prose only) |
| ATH-06 | author-test-harness | Factory throw → discard, cause preserved | preserved |
| ATH-07 | author-test-harness | Fresh fake per call (no cross-call state) | preserved |
| ATH-08 | author-test-harness | Outside-run verb calls are not laundered | modified (scenario rewritten) |
| ATH-09 | author-test-harness | Emission-validity boundaries (non-JSON-safe, batch-cap) | preserved (cost note added) |
| ATH-10 | author-test-harness | Unrendered-template non-promise | preserved |
| ATH-11 | author-test-harness | In-memory-only invariant (harness machinery) | modified (V3 re-scope, +1 scenario) |
| ATH-12 | author-test-harness | No-engine-text extended to harness output | modified (+1 scenario, scope narrowed) |
| ATH-13 | author-test-harness | Opted-in factory support — schema-invalid input rejects via `result.error` | **NEW V3 (owner CQ2)** |
| TES-01 | testing-entry-surface | `./testing` export entry | preserved |
| TES-02 | testing-entry-surface | `defineFactory` reachable via `./testing` only | preserved |
| TES-03 | testing-entry-surface | FIT-08 per-path allowlist | modified (+1 scenario, 1 tightened) |
| TES-04 | testing-entry-surface | Dev-only bundle containment guard (FIT-17) | modified (+1 scenario, 1 tightened) |
| TES-05 | testing-entry-surface | FIT-04 dts baseline extension | modified (+1 scenario) |
| TES-06 | testing-entry-surface | Installed-consumer-vantage e2e | modified (scenario rewritten +1 new) |
| TES-07 | testing-entry-surface | FIT-10 port-guard allow-list transition | **NEW (SEC-B1)** |
| FSP-01 | fake-single-source-parity | Single ContractFake source | preserved |
| FSP-02 | fake-single-source-parity | Re-export shim reference identity | preserved |
| FSP-03 | fake-single-source-parity | `rejection-messages.ts` single source | preserved |
| FSP-04 | fake-single-source-parity | Fail-closed parity enforcement | preserved |
| TSD-01 | testing-story-docs | README testing section | modified (+3 scenarios) |
| TSD-02 | testing-story-docs | `runFactoryForTest` JSDoc coverage + `seed` `@param` + FIT-06 cascade | modified (+2 scenarios, 1 rewritten) |
| TSD-03 | testing-story-docs | README qualifying-line revert (sequence-gated) | preserved |
| TSD-04 | testing-story-docs | ADR-0009 amendment content | preserved |

Total: **28 REQ-IDs** across 4 domains (all NEW capabilities — no Modified Capabilities,
per proposal). Net growth V1→V2: +1 REQ-ID (TES-07), +17 scenarios (34 → 51). Net growth
V2→V3 (this micro-unfreeze): +1 REQ-ID (ATH-13), +3 scenarios (51 → 54).

## Delta Table (V1 → V2)

| Category | REQ-IDs |
|---|---|
| Preserved verbatim | ATH-02, ATH-06, ATH-07, ATH-09, ATH-10, TES-01, TES-02, FSP-01, FSP-02, FSP-03, FSP-04, TSD-03, TSD-04 |
| Preserved, prose amended (no scenario change) | ATH-05 |
| Scenario rewritten (same ID, content changed) | ATH-01.1, ATH-04.1, ATH-08.1, ATH-11.1, TES-03.3, TES-04.3, TES-06.2, TSD-02.1 |
| New scenario(s) added under an existing REQ | ATH-01 (+2), ATH-03 (+1), ATH-04 (+1), ATH-12 (+1), TES-03 (+1), TES-04 (+1), TES-05 (+1), TES-06 (+1), TSD-01 (+3), TSD-02 (+2) |
| New REQ-ID | TES-07 (3 new scenarios) |
| Removed | none |

## Delta Table (V2 → V3, this micro-unfreeze)

Scope is EXACTLY the steward-foresight C1 resolution (owner CQ2 = YES, 2026-07-10) — nothing
else in V2 changes.

| Category | REQ-IDs |
|---|---|
| Preserved verbatim | All 26 non-ATH-11 REQ-IDs (ATH-01..10, ATH-12, TES-01..07, FSP-01..04, TSD-01..04) |
| Re-scoped (content changed, +1 scenario) | ATH-11 (harness-machinery scoping; new Scenario .2, STAGE-4-MERGED-DEPENDENT) |
| New REQ-ID | ATH-13 (2 new scenarios, both STAGE-4-MERGED-DEPENDENT) |
| Removed | none |

## Findings Applied vs. Rejected

**All council findings (blockers, majors, minors) were ENCODED. Zero rejections.** Judgment
calls made where a finding required a decision rather than a mechanical edit:

- **SEC-B1 home**: REQ-TES-07 homed in `testing-entry-surface` (sibling to TES-03's FIT-08
  allowlist, same "structural containment for `./testing`" family), not
  `fake-single-source-parity`.
- **SEC-B1 facade ruling**: `src/testing/index.ts` is explicitly RULED OFF the FIT-10
  allow-list — it must not name `EngineClient`/`EmitRejection` at all, achieving its
  spy-wrapper via a local structural type instead. This keeps the allow-list a strict
  singleton rather than widening to a directory carve-out.
- **SEC-m1**: encoded as a non-binding **Design Note** under REQ-TES-04 (a "consider"
  finding, not a MUST) rather than a REQ clause — forcing a second structural marker into
  the spec would overstep what the finding asked for.
- **QA-M4**: encoded as an informational acknowledgement + one binding DESIGN CONSTRAINT
  sentence, not a testable REQ (the finding itself is a cost umbrella, not a behaviour).

## Domain: author-test-harness (NEW)

> Full spec: `specs/author-test-harness/spec.md`. **13 REQ-IDs (ATH-01..13), 22 scenarios
> (V2: 19)**. Encodes owner ruling 1 (committed tree = writes only), ruling 2 (Batch/Directive
> type-only, ContractFake banned), SEC-M1/QA-m1 (ATH-11 concrete instrumentation), QA-M1
> (ATH-08 concrete ALS-escape), QA-M2 (ATH-03 multi-directive all-or-nothing), QA-M3
> (ATH-04 seeded-empty/absent semantics), SEC-m2/TW-m2 (ATH-12 scope + author-content
> exemption), BA-m1/QA-m2/TW-M4 (ATH-01 result-shape precision). **V3 (owner CQ2, this
> micro-unfreeze)**: ATH-11 re-scoped to harness machinery only (+1 scenario); new
> REQ-ATH-13 (+2 scenarios) supports opted-in (`packageDir`) factories, both new scenarios
> marked STAGE-4-MERGED-DEPENDENT.

## Domain: testing-entry-surface (NEW)

> Full spec: `specs/testing-entry-surface/spec.md`. 7 REQ-IDs (TES-01..07), 18 scenarios
> (V1: 11). Adds REQ-TES-07 (SEC-B1, FIT-10 allow-list transition). Encodes ruling 2
> (TES-03's exact allowlist), SEC-M3 (ContractFake ban), SEC-M2 (see below — FIT-07 stays
> scoped to `src/core/**`, encoded as a one-line note in `explore.md`'s existing
> characterization; no REQ text refers to FIT-07 today since this domain never proposed
> widening it — confirmed no regression risk), QA-m3 (TES-04 structural sourcing), BA-m4
> (TES-03.3/TES-04.3 tightened), BA-M1 (TES-06's two founding scenarios), TW-M1 (folded into
> TSD-02's FIT-06 cascade, not duplicated here).

## Domain: fake-single-source-parity (NEW)

> Full spec: `specs/fake-single-source-parity/spec.md`. 4 REQ-IDs (FSP-01..04), 4 scenarios.
> Unchanged from V1 — no council finding targets this domain.

## Domain: testing-story-docs (NEW)

> Full spec: `specs/testing-story-docs/spec.md`. 4 REQ-IDs (TSD-01..04), 10 scenarios
> (V1: 5). Encodes TW-M2 (semver exemption in README + JSDoc), TW-m3 (README boundary
> statement vs `./conformance`), TW-M1 (FIT-06 `PUBLIC_PATHS` widening + origin-JSDoc
> cascade to `context.ts`/`wire.ts`), TW-m4 (`emitted` field-type documentation, no rename),
> ruling 3 (`seed`'s mandatory doc home — `@param` + a seeded-read example in
> README-or-JSDoc).

## SEC-M2 Note (FIT-07 glob scope)

No REQ in this spec proposes widening FIT-07's glob beyond `src/core/**`. `explore.md`
already characterizes `src/testing/**` as staying OUTSIDE that glob (Current State
section) — this V2 confirms that characterization holds and adds no contradicting REQ.
Recorded here rather than as a standalone REQ because there is no behavioural change to
specify: the ask is "stay scoped," which this spec already satisfies by omission. `design`
should carry this forward as an explicit non-regression note when FIT-07 is next touched.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) | TES-01, TES-02, TES-03, TES-05, TES-06, TES-07, ATH-01, ATH-13 | Yes |
| security (supply-chain) | TES-04, TES-06, TES-07, FSP-04, ATH-11, ATH-12 | Yes |

No sensitive-area touch found that triage/explore missed. TES-07 (V2) and ATH-13 (V3) are
both covered under existing flagged areas — no new sensitive-area surfaces, no re-triage
trigger.

## REQ-ID Stability (V1 → V2)

- **Preserved** (13): ATH-02, ATH-06, ATH-07, ATH-09, ATH-10, TES-01, TES-02, FSP-01,
  FSP-02, FSP-03, FSP-04, TSD-03, TSD-04.
- **Modified content** (13): ATH-01, ATH-03, ATH-04, ATH-05, ATH-08, ATH-11, ATH-12, TES-03,
  TES-04, TES-05, TES-06, TSD-01, TSD-02.
- **Newly added** (1): TES-07.
- **Marked REMOVED**: none.

All 26 V1 REQ-IDs are present in V2 (13 preserved + 13 modified = 26); TES-07 is the sole
addition. No ID was reused or renumbered.

## REQ-ID Stability (V2 → V3, this micro-unfreeze)

- **Preserved** (26): every V2 REQ-ID except ATH-11 (ATH-01..10, ATH-12, TES-01..07,
  FSP-01..04, TSD-01..04).
- **Modified content** (1): ATH-11 (re-scoped to harness machinery; +1 scenario).
- **Newly added** (1): ATH-13 (owner CQ2 — opted-in factory support).
- **Marked REMOVED**: none.

All 27 V2 REQ-IDs are present in V3 (26 preserved + 1 modified = 27); ATH-13 is the sole
addition. No ID was reused or renumbered — 28 REQ-IDs total in V3.

## Feedback Applied (V2)

- 3 owner rulings (committed-tree scope, Batch/Directive type-only re-export, seed doc
  home) → ATH-01, ATH-04, ATH-05, TES-03, TES-05, TSD-01, TSD-02.
- 9 blocker/major findings (SEC-B1, SEC-M1+QA-m1, SEC-M2, SEC-M3, BA-M1, QA-M1, QA-M2,
  QA-M3, QA-M4, TW-M1, TW-M2, TW-M4) → TES-07 (new), ATH-11, ATH-08, ATH-03, ATH-04,
  top-level cost section, TSD-02, TSD-01/TSD-02, ATH-01.
- 10 minor findings (BA-m1, BA-m4, QA-m2, QA-m3, SEC-m1, SEC-m2, SEC-m3, TW-m2, TW-m3,
  TW-m4) → ATH-01, TES-03/TES-04, ATH-01, TES-04, TES-04 design note, ATH-12, Cross-Change
  Note 6, ATH-12, TSD-01, TSD-02.

## Feedback Applied (V3, this micro-unfreeze)

- Owner CQ2 = YES (steward-foresight, 2026-07-10), resolving condition C1 in full: (1)
  `runFactoryForTest` supports opted-in (`packageDir`) factories — ATH-13 added; (2) ATH-11
  re-scoped to harness machinery so the factory's own legitimate schema.json read is no
  longer a contradiction; (3) the validation-testing affordance C1 asked for is delivered as
  a tested feature (ATH-13.1/.2), not an accepted limitation. No other V2 content is
  touched — this is a strict-scope micro-unfreeze, per the orchestrator's authorization.

## Sensitive Areas Coverage (see also above)

Unchanged conclusion from V1/V2: no escalation needed; TES-07 and ATH-13 both stay within
the two areas already flagged at triage.

## Drift Check Results

Not applicable — `spec_source: internal` (Step 9b skipped).

## Next Step

V3 is signed (owner re-signed on the CQ2 authorization, 2026-07-10 — this micro-unfreeze IS
the sign-off event). Ready for `sdd-design` to incorporate REQ-ATH-11's re-scope and
REQ-ATH-13's new affordance into the existing design (rev covering V2 must be revised, not
re-drafted from scratch, for these two REQ-IDs only).
