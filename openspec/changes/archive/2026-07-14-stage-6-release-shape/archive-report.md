# Archive Report: stage-6-release-shape

**Archived at**: 2026-07-14T12:30:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V2/V3 (local-consumption, author-onboarding-docs, factory-package-shape, publish-pipeline-hardening — all signed)

---

## Summary

Stage 6 delivers release-readiness for the `@pbuilder/sdk` authoring surface: a hardened-but-never-fired publish pipeline, a complete author docs set enabling local installation, and parity-tested `bun link` consumption alongside the existing tarball path. All 25 active requirements proven; 6 slices complete; full suite green (1122 tests). ADR-0041 (bun-link consumption ritual), ADR-0042 (publish rehearsal interlock), and ADR-0034 amendment (document-not-strip) promoted to project-level architecture (all Accepted); ADR-0040 (npm placeholder) confirmed staying Deferred. Four new capability specs synced to main: local-consumption, publish-pipeline-hardening, author-onboarding-docs, factory-package-shape (REQ-FPS-06/07 appended). Two plan-era drift-syncs resolved directly (fit-21→fit-23 filename, six→seven verb reconciliation). Non-blocking followups registered; zero `src/` changes (packaging, CI, docs, tests only).

---

## Specs Synced to Main

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| local-consumption | New | 5 (LC-01..05) | — | — |
| publish-pipeline-hardening | New | 8 (PPH-01..06, 07/08 deferred) | — | — |
| author-onboarding-docs | New | 12 (AOD-01..12) | — | — |
| factory-package-shape | ADDED | 2 (FPS-06, FPS-07) | — | — |

Total active REQs promoted: 25/25. (PPH-07/08 deferred per owner ruling CQ2, travel with public-package plan).

---

## Archive Location

`openspec/changes/archive/2026-07-14-stage-6-release-shape/`

Contains full planning artifacts (triage, explore, proposal, spec V1-V3 iterations, design rev 1-3, slices, apply-progress Runs 1-6, verify-in-loop iterations 1-4, verify-report, outcome-verdict, walkthrough-record, north-star memo, all supporting docs).

---

## Lessons Learned Persisted

Two lessons registered to `openspec/lessons-learned.md`:

- **Machine-invisible doc gaps** — the human walkthrough (steward reckoning G-2) caught 5 findings 11 prior verification agents could not, because machine legs consume metadata (harness tsconfig, fence `filename=` annotations, ambient types) a human reader never sees. Countermeasure shipped: the machine leg now uses the doc's OWN tsconfig and typechecks `factory.test.ts` directly.
- **A 3-iteration plan-verify investment paid off downstream** — findings dropped 18→3→0 across 3 plan-verify iterations; all 4 in-loop verifies then passed at iteration 1 (zero fix loops) and judgment-day was APPROVED round 1. Thorough plan-verify is a leading indicator of a low-friction build.

---

## ADRs

### Promoted to Project-Level

- **ADR-0041**: bun-link consumption contract — documented build-then-link ritual + `link:sdk` convenience script, no `prepare` script (owner ruling 2026-07-12). Applies to future changes using `bun link` as a consumption vector.
- **ADR-0042**: publish rehearsal interlock — three-part in-repo guard (W3 repo-owner condition, SHA pins, `--dry-run` retained) + go-live-precondition debt (mandatory GitHub Environment required-reviewers gate, deferred to public-package plan). Formalizes the existing dry-run-staged convention.
- **ADR-0034 AMENDMENT**: `dist/core/**` ship-not-strip (documented rationale, not stripped from tarball; `./core` stays unreachable via `exports`). Extended posture: `declarationMap: false` (REQ-PPH-05) removes 34 `.d.ts.map` entries from the tarball deliberately.

---

## Drift-Syncs (resolved directly at archive — not followups)

1. **`fit-21` → `fit-23` filename correction**: `design.md` rev 3 and ADR-0042's Decision prose updated to name the shipped `fit-23-publish-workflow-guard.test.ts`, with the filename-collision provenance (vs `stage-5b-dialect-breadth`/`schematic-local-files`) noted inline. Content/coverage unchanged.
2. **Verb/reason vocabulary reconciliation**: `openspec/specs/author-onboarding-docs/spec.md` REQ-AOD-03 updated "six author verbs" → "all seven author verbs" (adds `copyIn`), scenario updated 7→8 elements, provenance note added. Shipped docs already documented seven; spec text now matches.
3. **`north-star.md` §2 editorial note**: one line noting the npm-placeholder seam (of the four named) was deferred at foresight CQ2 — history not rewritten, only annotated.

## Followups Registered

Registered to `openspec/pending-changes.md`, new `stage-6-release-shape` section (8 rows) plus one existing row enriched:

1. REQ-LC-05.3 red-proof falsifiability (local literals only) — judgment-day, both judges.
2. Test-suite build fan-out (~5 clean rebuilds/run) — share one memoized build — both judges.
3. `ci.yml` lacks `setup-node`; bin-exec scenarios need ambient Node — Judge A.
4. `extractFencedFiles` deviates from REQ-AOD-07.1's named harness — ratify or fold in — Judge B.
5. `bun-version: latest` unpinned in both workflows — pin before go-live — security + architect.
6. Content-aware tarball secret scan (fit-14 is filename-only) — go-live batch — security.
7. ROADMAP §3 "Five authoring verbs" table stale (current: seven) — next planning-docs pass.
8. `unlinkSdk` serial-execution assumption undocumented — document or reference-count — judgment-day INFO.
9. **Row enrichment** (not new): `defineFactory` graduation row in `stage-4b-testing-harness` section enriched with the owner's 2026-07-14 direction (engram obs #2070) — author exports the bare input-receiving function; `defineFactory` becomes internal to the runner/engine; `./commons` is the wrong home.

The judgment-day "wire-term case-sensitivity" observation was NOT registered separately — its rationale is already inline in `test/docs/doc-set-content.test.ts`'s `WIRE_INTERNAL_TERMS` comment (resolved-by-documentation).

---

## Final State

- **Spec status**: signed (archived)
- **Main specs updated**: 4 domains (local-consumption, publish-pipeline-hardening, author-onboarding-docs, factory-package-shape)
- **Lessons in project memory**: 2 added (machine-invisible doc gaps; plan-verify investment pays off)
- **ADRs in project memory**: 3 promoted (ADR-0041, ADR-0042, ADR-0034 amendment) — all Accepted; ADR-0040 confirmed Deferred
- **Pending changes registered**: 8 new followup rows + 1 existing row enriched (defineFactory graduation direction) + pre-existing rows
- **Folder moved**: `openspec/changes/archive/2026-07-14-stage-6-release-shape/`

**Build & Tests**: 1122 pass / 0 fail, typecheck clean (Strict TDD verified).

---

## Hybrid Mirror Reconciliation

Planner artefacts (triage/explore/proposal/spec/design) lack engram mirrors despite hybrid mode (flagged at verify-in-loop-1). Did NOT backfill full contents — saved ONE engram observation (topic `sdd/stage-6-release-shape/planner-artefacts-index`) indexing archived file paths as canonical source.

---

## Architecture Baseline Refresh (ADDITIVE)

Updated `openspec/architecture.md` (zero-violation audit, obs #2065): publish-pipeline hardened posture + SHA-pin convention (Build/Deploy); fit-23, scratch-consumer seam, docs-as-test + build-config suites (Testing); `docs/` author doc set convention (Conventions); ADR ledger additions (0041/0042/0034-amendment). No topology rewrite (src/ diff-free).

---

## Next Steps

1. **Followups visible to future planning**: 8 new items + 1 enriched row now in `openspec/pending-changes.md` for grooming and prioritization.
2. **Lessons documented**: 2 entries in `openspec/lessons-learned.md` for future reference — validation gates must include human-vantage checks; plan-verify investment is a leading indicator of build quality.
3. **Go-live precondition tracked**: the GitHub Environment required-reviewers gate remains a MANDATORY precondition of ever removing `--dry-run` from `publish.yml` (ADR-0042), booked to the public-package plan.

Change closed and archived. Ready for PR publication (if applicable).
