# Slices: Remove SDK-Side Containment Enforcement (`inline-collection-marker`)

**Triage**: L · **Spec version**: V3.3 · **Design version**: V2.2 — plan-verify iteration 3 (`verify-plan-3.md`) returned `gaps` → `plan-verify-failed` (3 iterations exhausted, per-protocol escalation to human). **Ruling 14**: owner declared the plan ready-with-known-items — ALL remaining findings were traceability/accounting/doc-wording, ZERO design flaws and ZERO executor-blocking unknowns about the code (problem-fit CLEAN for 3 consecutive judge passes) — one batched mechanical amendment applies A1-A4/B1-B8 with no fourth judge round; `sdd-verify --mode=final` is the net for anything residual. Plan-verify is CLOSED for this change.
**Slices version**: V4 — amends V3 with the plan-verify-3 batch (A1-A4, B1-B8), all routed to slices per the coordinator. Ruling 15 (S-005.6 qualified verbatim) baked in.
**V3 amendment** (iteration 2, for history): resolved F3/Q6/Q7/Q8/Q9, baked in rulings 12-13 (0.2.0 bump, V3.2 batch).
**V2 amendment** (iteration 1, for history): re-ledgered 3 fit-26-gated REQ-IDs out of S-004, added 2 exclusion entries, added missing Covers citations, fixed 2 wrong REQ/path citations, gave every task a spec citation, resolved the S-000/S-001 canary-continuity sequencing, corrected the FIT-04/kit-internal citation, defined the marker-fixture-survival rule/reorder-check/corpus-regen/pointer-closure mechanisms, added a Risks section.
**Total slices**: 7 (1 walking skeleton + 6 SPIDR) — unchanged from V1/V2/V3

**Delta-file shorthand** (all under `openspec/changes/inline-collection-marker/specs/{family}/spec.md`): `MFB`=package-dir-run-anchor · `PSH`=package-source-io-hygiene · `IPF`=ir-path-well-formedness · `FSC`=folder-scaffold · `AEC`=authoring-error-contract · `FTG`=fitness-guards · `BRC`=by-reference-copy-wire · `CCR`=conformance-corpus · `CSC`=conformance-self-check · `GCC`=golden-corpus-contract · `PRC`=package-root-containment (retired, historical cite only) · `SCM`=scenario-matrix · `RBV`=run-boundary-input-validation · `CFX`=conformance-fixtures (14th family, new minimal delta at V3.2 — cross-reference amendment only, see Excluded ledger).

---

## S-000: Walking Skeleton — Inline-collection projects run (the reported bug closes)

**Scope**: walking-skeleton · **Dimension**: —
**Covers**: REQ-MFB-01/.1/.2/.3, REQ-RBV-06/.2 (REQ-RBV-06.1 retired-with-pointer, closure defined in S-006.4), REQ-IPF-01.3 (ordering), REQ-FSC-10.1–.4, REQ-RBV-04.1 (minimum subset only — full set in S-001)
**Requires**: nothing · **Test layers**: unit + integration + e2e

**Acceptance**: GIVEN a factory in a package with NO `collection.json` anywhere on the ancestor chain (own `mkdtemp`) WHEN it runs THEN the body executes; `create`/`scaffold` commit byte-exact content; `copyIn` asserts emitted-directive shape only (spec V3.2 re-pin, B5 — the contract fake/run vehicle never materializes `copyIn` bytes, `src/testing/contract-fake.ts:237-247`, so no test may assert `copyIn`'s committed byte content).

### Tasks
- [x] S-000.1 Restore REQ-AEC-10/11/12 into `openspec/specs/authoring-error-contract/spec.md` from the archived `schematic-local-files` delta (design §9 step 0, before anything) `[AEC]`
- [x] S-000.2 Flip run-boundary expectations RED: `test/scaffold/run-boundary.test.ts`, `test/e2e/scaffold.e2e.test.ts:80`, `test/fake/harness-opted-in.test.ts` `[RBV REQ-RBV-06/.2; MFB REQ-MFB-01.1 inverse-pointer]`
- [x] S-000.3 Add `test/scaffold/inline-collection.test.ts` RED (own `mkdtemp`, full-ancestor precondition, sentinel + 3-verb scenarios) `[MFB REQ-MFB-01.1/.2/.3]`
- [x] S-000.4 `context.ts`: delete `resolvePackageRoot`/`missingPackageRootMessage`/unused imports; collapse `packageAnchors` → `{packageDir}` + land the RUNTIME positive-shape pin in `test/skeleton/run-boundary-validation.test.ts`: `Object.keys(packageAnchors)` deep-equals `["packageDir"]` (never `toBeUndefined()`) — resolves Q8's unassigned-task gap; the shape's positive content is confirmed by design V2.2 §J `[MFB REQ-MFB-01, REQ-MFB-01.3]`
- [x] S-000.5 Delete `containment.ts`; create `path-guards.ts` (`validateSourceLexical`/`statSourceForRead`/`validateDestinationLexical` + moved privates); wire the 3 screen sites (`index.ts` ×2, `expander.ts`); reorder `runCopyIn` destination-before-source `[IPF REQ-IPF-01/.3, REQ-IPF-02; PSH REQ-PSH-01/02/03 baseline wiring; PRC retirement, no successor]`
- [x] S-000.6 `walk.ts`: ruling-8 recursive-read guard (reuse `rootReadFailure`) + REQ-FSC-10.1–.4 tests `[FSC REQ-FSC-10/.1/.2/.3/.4]`
- [x] S-000.7 Land the MINIMUM canary-no-echo subset GREEN for the new path-guards baseline branches (missing/non-regular/lexical-reject via scaffold + copyIn) **first** — then delete `test/scaffold/containment.test.ts` and remove the `isWithinCeiling` import (`harness-in-memory-invariant.test.ts`). Coverage-continuity is BINDING (design §9 step 3): the no-echo obligation for these branches must never go untested even momentarily `[RBV REQ-RBV-04.1 minimum subset; PSH/IPF baseline branches]`
- [x] S-000.8 Verify `bun test`/`tsc --noEmit` green. Reorder-safety check (mechanism): `rg` `test/**` and `test/e2e/author-emulation/scenarios.ts` for a `copyIn` case combining a failing source **and** a `../`/absolute destination — if found, re-pin its expected reason to the destination-first order; if none, record "none found" in the task output `[design §4 apply-time check]`

---

## S-001: Path-guards TOTAL hardening — every source-form variant, no-echo proven

**Scope**: edge-case · **Dimension**: D (Data — failure-input variants over one guard)
**Covers**: REQ-PSH-01/.1/.2/.3, REQ-PSH-02/.1/.2/.3/.4, REQ-PSH-03/.1/.2, REQ-PSH-04/.1, REQ-IPF-01.1/.2/.4/.5/.6, REQ-IPF-02.1, REQ-IPF-03.1, REQ-RBV-04.1 (full set, atop S-000's minimum)
**Requires**: S-000 · **Test layers**: unit + integration ×3 verbs + security

**Acceptance**: GIVEN each source-form variant (FIFO, dir, missing, EACCES, NUL, broken symlink, ELOOP, in/out-of-package symlink) driven once per verb WHEN read THEN it maps to its pinned reason, no-echo, and zero raw Node errors escape.

### Tasks
- [ ] S-001.1 `statSourceForRead` TOTAL guard: EACCES/ELOOP/EMFILE/ENFILE/EINTR/NUL-byte/broken-symlink mapping (design §4 rows 0–4) `[PSH REQ-PSH-02/.2/.3/.4]`
- [ ] S-001.2 Symlink accept: in-package→in-package (PSH-03.1), in-package→outside residual positive (PSH-04.1) `[PSH REQ-PSH-03/.1/.2, REQ-PSH-04/.1]`
- [ ] S-001.3 `validateSourceLexical` segment-aware edge cases (backslash, multi-segment, leading `./`, absolute) `[IPF REQ-IPF-01.1/.2/.4/.5/.6]`
- [ ] S-001.4 Destination guard + no-absolute-on-wire `[IPF REQ-IPF-02.1, REQ-IPF-03.1]`
- [ ] S-001.5 Extend `test/security/canary-no-echo.test.ts` to the FULL hardened branch set — ELOOP, NUL, degenerate strings, REQ-FSC-10.4's recursive-walk canary — atop S-000.7's minimum subset; canary seeded in the absolute prefix `[RBV REQ-RBV-04.1 full set]`
- [ ] S-001.6 Create `test/scaffold/path-guards.test.ts` (module-level, additive to per-verb rows) `[PSH, IPF]`
- [ ] S-001.7 Verify `bun test` green

---

## S-002: Public contract narrows — `AuthoringReason` 12 → 11

**Scope**: edge-case · **Dimension**: R (Rule — closed-union business rule)
**Covers**: REQ-AEC-10/.1/.2, REQ-AEC-11/.1/.2, REQ-AEC-12/.1, REQ-MFB-01.3 (`.d.ts` pin)
**Requires**: S-000 · **Test layers**: unit + type-level + architectural

**Acceptance**: GIVEN the union shrinks to 11 members WHEN `originFor` and the FIT-04 baseline are inspected THEN both drop `source-outside-package` in the SAME commit, and no other member is affected.

### Tasks
- [ ] S-002.1 `authoring-error.ts`: drop `source-outside-package` from `originFor`/`messageFor`; fix `:40-49` TSDoc + JSDoc switch sample `[AEC REQ-AEC-10/.1/.2]`
- [ ] S-002.2 Update FIT-04 PUBLIC baseline (`core.authoring-error.d.ts`, 11 members) + bump `package.json` `0.1.0` → `0.2.0` — BOTH SAME commit as the union shrink (owner ruling 12: the version bump for this MAJOR narrowing ships in this change, not deferred; design §6 is the cited vehicle) `[AEC REQ-AEC-10.2; ruling 12]`
- [ ] S-002.3 Create `core.context.d.ts` — the kit-internal `RunContext`/`packageAnchors` single-field pin. Regen procedure: `tsc` declaration emit → copy `dist/core/context.d.ts` into the baseline location, SAME commit as the union shrink. Corrected per design §J: this is **NOT** added to FIT-04's public `DTS_PAIRS` list. This task produces ONLY the `.d.ts` baseline artifact; the RUNTIME positive-shape assertion is owned by fit-43 clause (c) + S-000.4's `test/skeleton/run-boundary-validation.test.ts` task (Q8 — the two must not be conflated) `[MFB REQ-MFB-01.3; FTG REQ-FTG-06(c)]`
- [ ] S-002.4 Register the kit-internal `{core.context.d.ts, RunContext}` pair in `fit-04-dts-semver-gate.test.ts`'s own kit-internal baseline-set list (B7, design V2.2) — a distinct registration step from S-002.3's artifact creation: the FIT-04 mechanism must be told the pair exists and where, checked but NOT semver-gated as public. SAME commit as the union shrink `[FTG REQ-FTG-06(c); design V2.2]`
- [ ] S-002.5 `test/types/authoring-reason.test.ts`: 11-member exhaustiveness pin `[AEC REQ-AEC-10.2]`
- [ ] S-002.6 `test/core/authoring-error-source.test.ts`: drop the retired fixture; land REQ-AEC-10.1, REQ-AEC-11.1, REQ-AEC-11.2, REQ-AEC-12.1 (corrected — REQ-AEC-11.3 does not exist post-V3-split) `[AEC]`
- [ ] S-002.7 Verify `bun test` + `tsc` green

---

## S-003: Full suite realigned — no stale ceiling/marker assertion survives

**Scope**: edge-case · **Dimension**: P (Path — every verb's flow re-verified end to end)
**Covers**: REQ-BRC-02/.1, REQ-BRC-06.1, REQ-BRC-07.1, REQ-BRC-08 (MODIFIED V3.2, citation-fix only — see note below), REQ-FSC-09/.1/.2, REQ-CSC-02.1/.2, scenario-matrix M-16 (re-cited)
**Requires**: S-001, S-002 · **Test layers**: unit + integration + e2e

**Acceptance**: GIVEN the full existing suite WHEN run after S-001/S-002 land THEN zero assertion references `packageRoot`/`realCeiling`/the marker, and M-16 passes under its ruling-5 citation.

**REQ-BRC-08 note (A4 Covers-completeness)**: `[SEAM] [ENGINE-GATED]`, no SDK-runnable test exists or is expected — "documented seam contract, exercised in the engine's own suite" per its own spec. V3.2's MODIFIED is a citation-fix only (its scenario stops citing the retired REQ-PRC-06, becomes self-referential) — no code/test task follows from it. Already satisfied by: SECURITY.md citing it (S-005.6) and the pre-existing, unchanged `golden-corpus-contract`/`scenario-matrix` NOT-exercised-ledger entry (REQ-GCC-08 item 3 / REQ-SCM-02.1). Listed in Covers here, not as a new task, to close the A4 staleness gap.

### Tasks
- [ ] S-003.1 `test/scaffold/{walk,expander,classify-transport,index}.test.ts`: flip ceiling/marker expectations; correct `walk.test.ts` bound arithmetic; land REQ-BRC-02.1 (`[SEAM]`, `expander.test.ts`) and re-verify REQ-FSC-09.1/.2 (`walk.test.ts`, rationale-only — behaviour unchanged, comment rewritten) `[BRC REQ-BRC-02/.1; FSC REQ-FSC-09/.1/.2]`
- [ ] S-003.2 `test/fake/{harness-opted-in,harness-in-memory-invariant}.test.ts`: ORDERED two-read assertion `[RBV REQ-RBV-06.2]`
- [ ] S-003.3 `test/support/scratch-dir.ts` + `test/fixtures/author-emulation/factory.ts`: drop the two RUNTIME marker-fabrication producers + `packageAnchors` replica; drop `canary-no-echo.test.ts`'s own local marker seed (`:43-48`). Marker-fixture survival rule: this removes FABRICATION CODE only — static ON-DISK fixture `collection.json` files elsewhere (e.g. under other test fixture trees) are NOT fabrication per fit-43 clause (d)'s scope and MUST survive, inert; only `conformance/collection.json` is deleted (S-006.2, REQ-CCR-08) `[FTG REQ-FTG-06.2 allowlist scope]`
- [ ] S-003.4 `test/support/conformance-validators.ts`: delete `checkCollectionJsonMarker` `[CSC REQ-CSC-02]`
- [ ] S-003.5 `test/fitness/fit-40-conformance-corpus-integrity.test.ts` + `.negative.test.ts`: delete marker describe/negative + REQ-CFX-14.1 filter arm `[CCR REQ-CCR-08 retirement]`
- [ ] S-003.6 `test/scaffold/filename-pipeline.test.ts`: pin `sourceRelPath`-never-altered fact `[design §4 carve-out]`
- [ ] S-003.7 `test/e2e/{scaffold,author-emulation-scaffold,error-attribution}.e2e.test.ts` + **`test/conformance/copyin-parity.test.ts`** (corrected path — existing file under `test/conformance/`, not a new e2e file): M-16 reason flip, per-verb rows `[SCM M-16; AEC REQ-AEC-11.2; BRC REQ-BRC-06.1/.07.1]`
- [ ] S-003.8 Verify `bun test` green

---

## S-004: Scenario-matrix corpus renumbered and regenerated

**Scope**: edge-case · **Dimension**: D (Data — scenario set renumbering)
**Covers**: REQ-SCM-01, REQ-SCM-02 (substance only — REQ-SCM-01.1/REQ-SCM-02.1's scenario-level proof is fit-26-gated, archive-sync; see Excluded ledger)
**Requires**: S-003 · **Test layers**: architectural (corpus determinism)

**Acceptance**: GIVEN `scenarios.ts` after M-17 deletion and renumbering WHEN `scripts/regen-corpus.ts` runs THEN transcripts regenerate clean, `fit-28` sees the matching SCENARIOS list, and the new stray/duplicate directory check finds none.

### Tasks
- [ ] S-004.1 `scenarios.ts`: delete `m-17`/no-existence-oracle row; renumber `m-18→m-17` (NEW SLUG: `missing-package-local-source`, matching the retitled row) … `m-21→m-20`; update the scratch-backed row list + range comment `[SCM]`
- [ ] S-004.2 Corpus regen procedure step (b), CORRECTED per Q6 — manual deletion is FIVE files, not one: delete the stale `m-17.*.transcript.json` through `m-21.*.transcript.json` (every renumbered row's OLD filename embeds its old id+slug, so each shift orphans one file). File deletion only, never a content edit `[SCM procedure]`
- [ ] S-004.3 Corpus regen procedure step (c): run `scripts/regen-corpus.ts` — it rewrites EVERY transcript from the (new) ids; never hand-edit transcript contents `[SCM]`
- [ ] S-004.4 `test/fitness/fit-28-corpus-determinism.test.ts`: SCENARIOS list follows `scenarios.ts` **+** a NEW one-shot stray/duplicate check (corpus regen procedure step (d)) — a directory-listing assertion (transcript dir's file set == the expected id set derived from `scenarios.ts`), modeled on `fit-40`'s directory-scan posture, added HERE because `fit-28` is an in-process double-run check that never reads the corpus directory and so cannot gate strays on its own (Q6) `[SCM; fit-28; fit-40 posture]`
- [ ] S-004.5 `test/support/corpus-format.ts`: comment `"m-21"`→`"m-20"` `[SCM]`
- [ ] S-004.6 `coverage-manifest.md` — FULL apply-time renumber, scope EXPANDED per Q7 (not just the REQ-PRC drops from V2): (a) CORRECTED per B8/design V2.2 — the renumbered M-17 row keeps its EXISTING `REQ-BRC-06.1` entry keyed to `M-17` (not a straight "move") and gains the NEW `package-source-io-hygiene` REQ-PSH-02.1 entry ALSO keyed to `M-17` — BOTH citations coexist for that row; the other shifts are plain re-keys: `REQ-FSC-09.1` to `M-18`, `REQ-ATH-16.1` to `M-19`, batch-cap (`REQ-05.1`) to `M-20`, including any prose row-lists naming the old numbers; (b) ADD new citation-ledger row — M-16's re-cite gains `ir-path-well-formedness` REQ-IPF-01.1/.2; (c) drop `REQ-PRC-04.1`/`04.6`/`07.1` + the `REQ-PRC-06` literal (unchanged from V2); (d) B1 — remove the prose line at `coverage-manifest.md:80` reading `"no collection.json found at or above"` (the retired error string, orphaned prose, not a citation) `[SCM M-16/M-17; GCC REQ-GCC-08 substance; PRC retirement]`
- [ ] S-004.7 Verify `bun test` green

---

## S-005: Regrowth/reachability guards, ADR-0077, and the cross-repo handoff

**Scope**: edge-case · **Dimension**: R (Rule — architectural invariants + policy docs)
**Covers**: REQ-FTG-06/.1/.2/.3/.4, REQ-FTG-07/.1/.2, REQ-FTG-08/.1, REQ-PSH-05/.1, REQ-MFB-02/.1
**Requires**: S-001, S-002 · **Test layers**: architectural + docs

**Acceptance**: GIVEN `src/**` after S-000–S-002 WHEN fit-43/44/45 run THEN the ceiling cannot regrow, every surviving reason is mintable, and exactly one lexical predicate exists.

### Tasks
- [ ] S-005.1 `test/support/src-invariant-scans.ts` (pure scanners) + `test/fixtures/red/src-invariant-scans/**` `[FTG]`
- [ ] S-005.2 `fit-43-no-ceiling-regrowth.test.ts` (FIT-NEW-A), clauses a–f, ALL letter-labeled and signed (`REQ-FTG-06`, spec V3.3): (a)-(c) core scan, (d) `test/**` fabrication allowlist, (f) zero-realpath scan (REQ-FTG-06.3). Clause (e) — the `openspec/specs/` `rg` sweep — SPLITS per B4/design V2.2: ship its FIXTURE PAIR in-change NOW (REQ-FTG-06.4 — a mirror fixture with a live, non-historical hit → fails; a SEPARATE allowlist-only fixture → passes, proving the sweep credits the allowlist rather than string-matching blind), while the REAL `openspec/specs/` tree run stays archive-sync (only THAT execution — against the real, not-yet-synced tree — can't go green before archive; the LOGIC being correct is provable now, via fixtures) `[FTG REQ-FTG-06/.1/.2/.3/.4]`
- [ ] S-005.3 `fit-44-authoring-reason-reachability.test.ts` (FIT-NEW-B) `[FTG REQ-FTG-07/.1/.2]`
- [ ] S-005.4 `fit-45-single-lexical-predicate.test.ts` (FIT-NEW-C) `[FTG REQ-FTG-08/.1]`
- [ ] S-005.5 `openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md` (full skeleton, design §5); append a DATED AMENDMENT NOTE to ADR-0045 (amended by ADR-0077); append a dated **"Superseded by ADR-0077 (2026-07-28)"** header to BOTH ADR-0046 AND ADR-0067 (F3 — matches the ADR-0045 amendment-note pattern; previously no task marked either superseded, only the sweep allowlist presumed it) — these three notes are what qualify ADR-0045/0046/0067 as legitimate allowlist locations for S-006.3's sweep `[design §5, ADR-0077 §H; F3 resolution]`
- [ ] S-005.6 `docs/authoring-verbs.md` — the verbatim author rule is the QUALIFIED sentence from `ir-path-well-formedness` spec V3.3 (ruling 15, resolves B9's "always" vs. published-symlink-residual tension — pull the exact string from the signed V3.3 text at execution time; do NOT use design V1/V2's unqualified "…always; everything a schematic reads lives inside its package" wording verbatim, it no longer matches the signed spec), plus the "what the boundary is now" paragraph; `docs/authoring-errors.md`, `docs/engine-sdk-wire-design.md`, `conformance/README.md`; **`SECURITY.md`** — owner ruling 9, content DECIDED (publish the full trust posture, not a summary), as FIVE distinct, FIXED, greppable phrases (matching S-005.9's docs-guard anchors exactly — same wording, not a paraphrase): (1) the SDK provides NO containment guarantee; (2) path-carrying directives are re-checked by the engine apply-time (REQ-BRC-02, verified LIVE); (3) by-value/inline content has no boundary control on either side — v1 trusted-author model; (4) symlink escape from `packageDir` is an accepted, documented residual; (5) Windows UNC/drive-relative source forms are not screened SDK-side (engine obligation REQ-BRC-08). Cross-link ADR-0077 `[PSH REQ-PSH-04, REQ-PSH-05; BRC REQ-BRC-02, REQ-BRC-08; IPF Windows-out-of-scope note; ruling 15]`
- [ ] S-005.7 `CHANGELOG.md` (3 entries + preamble amendment, entries written against the **0.2.0** bump landed in S-002.2 — owner ruling 12; not the stale 0.0.0 preamble language, each entry present as its own mechanically `rg`-greppable distinguishing phrase — matching S-005.9's check); `CONFORMANCE-CORPUS-HANDOFF.md` Addendum 3; `SDK-EXIT-CODE-CONFIRMATION.md` historical note; re-cite `openspec/pending-changes.md` rows 268-270 — owner ruling 10: this handoff is **NOTIFICATION, non-blocking** (the engine consumes the corpus via a pinned submodule; the old pin stays valid until they bump it) — no lockstep coordination gate `[design §9 CHANGELOG entries a/b/c; ruling 12]`
- [ ] S-005.8 (B2/A1) Extend the existing docs-guard vehicle (`test/docs/security-authoring-guard.test.ts` pattern) with the REQ-PSH-05.1 check: assert `SECURITY.md` contains all FIVE posture points, each matched by its own FIXED, distinguishing greppable phrase (the SAME five phrases S-005.6 writes — this task and that one must agree on wording, or the check is either vacuous or perpetually red) `[PSH REQ-PSH-05/.1]`
- [ ] S-005.9 (B3/A1) New check for REQ-MFB-02.1: `CHANGELOG.md` carries a `## 0.2.0` heading (never `## Unreleased`) containing all three S-005.7 entries by distinguishing phrase, the amended preamble, `package.json#version === "0.2.0"` (from S-002.2), AND the three ADR supersession headers from S-005.5 (ADR-0045/0046/0067) — one assertion tying the whole release-vehicle bundle together `[MFB REQ-MFB-02/.1]`
- [ ] S-005.10 Verify `bun test` green

---

## S-006: Dead-test deletion (LAST) and final sweep

**Scope**: edge-case · **Dimension**: P (Path — the old failure path is retired for good)
**Covers**: REQ-CCR-08 (retired), REQ-RBV-06.1 (pointer closure)
**Requires**: S-004, S-005 · **Test layers**: architectural (rg sweep) + full suite

**Acceptance**: GIVEN the whole change landed WHEN the sweep in S-006.3 runs THEN it returns zero unpermitted hits.

### Tasks
- [ ] S-006.1 Delete any remaining retired run-boundary assertions `[RBV]`
- [ ] S-006.2 Delete `conformance/collection.json` `[CCR REQ-CCR-08]`
- [ ] S-006.3 `rg` sweep — scope REPO-WIDE minus the allowlist (Q9). Exactly TWO literals swept: (i) the exact string `no collection.json found at or above` (zero hits required, no allowlist needed — S-004.6(d) already removes the one known prose hit); (ii) the token `source-outside-package`. The BARE token `collection.json` is deliberately NOT swept — it survives in inert on-disk fixtures and historical docs per S-003.3's survival rule. Allowlist for `source-outside-package` (unchanged base + B1 addition): superseded/amended ADRs (0045, 0046, 0067, and ADR-0077's own history sections — all three now carry their dated supersession headers per S-005.5), `CHANGELOG.md`, `SDK-EXIT-CODE-CONFIRMATION.md` (dated historical note), `CONFORMANCE-CORPUS-HANDOFF.md` (Addendum 3), `openspec/changes/**` (this change + archive — the change's own retirement deltas legitimately quote the retired term), **and `openspec/specs/** ` (B1, NEW — the main signed specs legitimately carry ~16 live historical/version-note mentions pre-archive-sync; this pre-archive sweep is NOT the check that zeroes them out — that is fit-43 clause (e)/(f)'s ARCHIVE-SYNC-time job, S-005.2)** `[Q9 resolution; B1 correction]`
- [ ] S-006.4 REQ-RBV-06.1 pointer closure — three checkable boxes: (a) `rg` confirms the delta's "→ superseded by REQ-MFB-01.1" pointer resolves to an existing REQ; (b) the dead test asserting the old missing-ancestor behaviour is deleted; (c) the `run-boundary-input-validation` delta lists the retirement `[RBV REQ-RBV-06.1]`
- [ ] S-006.5 Final full `bun test` + `tsc --noEmit` clean

---

## Build Order

| Order | Slice(s) | Note |
|---|---|---|
| 1 | S-000 | skeleton — implicit blocker for all others |
| 2 | S-001, S-002 | independent, parallel |
| 3 | S-003 | requires S-001 + S-002 |
| 4 | S-004, S-005 | S-004 requires S-003; S-005 requires S-001 + S-002 — parallel with each other |
| 5 | S-006 | requires S-004 + S-005 — final |

## Excluded from Slices (Archive-Sync Work, not apply steps)

- **fit-43 clause (e), REAL-TREE RUN ONLY** (reworded per B4) — the `openspec/specs/` `rg` sweep for `package-root-containment|REQ-PRC-|source-outside-package` executed against the REAL, not-yet-synced spec tree; would be permanently RED until archive syncs the deltas. The scan LOGIC itself is proven in-change via S-005.2's REQ-FTG-06.4 fixture pair — only running it against the real tree is archive-sync. Owned by `package-root-containment`'s post-archive-sync criterion, executed by `sdd-archive`.
- **fit-26 edits** (`fit-26-report-hygiene-citations.test.ts`) — row-count 21→20 + the NEW REQ-GCC-08.1/REQ-SCM-01.1/REQ-SCM-02.1 assertions (re-ledgered here from S-004 per plan-verify Judge A finding #1 — these three scenario-level proofs read main-family files, `scenario-matrix/spec.md` and `golden-corpus-contract/spec.md`, that only change at archive-sync; in-change execution is mechanically impossible). Lands in the archive spec-sync commit together with the files it asserts against.
- **`folder-scaffold` main-spec Purpose-section amendment** (`openspec/specs/folder-scaffold/spec.md`) — the change's own delta already states the rewritten sentence verbatim ("source hygiene is `package-source-io-hygiene`'s contract; …"); applying it to the main spec file is archive-sync work, per the delta's own "at archive sync" wording.
- **`by-reference-copy-wire` main-spec "Seam Obligations Status" REQ-BRC-02 row flip** — flipping the row to LIVE status with the first-hand-verification citation is archive-sync work, per the delta's own "at archive, this section's REQ-BRC-02 row MUST be updated" wording.
- **`by-reference-copy-wire` main-spec "Seam Obligations Status" opening-sentence REQ-PRC-06 drop** (B6/A2 — itemized SEPARATELY from the REQ-BRC-02 row-flip above; both are real edits to the same section but distinct sentences) — the section's OPENING sentence ("REQ-BRC-02, REQ-BRC-08, and `package-root-containment` REQ-PRC-06 are ENGINE-GATED") must also drop its `REQ-PRC-06` mention at archive-sync, per the V3.2 delta's own ":179" extension — rewritten to "REQ-BRC-02 [now LIVE] and REQ-BRC-08 are ENGINE-GATED."
- **`scenario-matrix` main-spec Sensitive-Areas-Coverage re-point** (B6/A2, `openspec/specs/scenario-matrix/spec.md:174`) — the main spec's Sensitive Areas Coverage sentence cites the retired `package-root-containment` by name; the V3.2 delta's own Sensitive Areas Coverage Amendment re-points it to `package-source-io-hygiene`/`ir-path-well-formedness`/`content-classification` at archive-sync, per its own "at archive-sync, this sentence MUST be re-pointed" wording.
- **`conformance-fixtures` (`CFX`) cross-reference amendment** (B6/A2) — REQ-CFX-16's prose (`openspec/specs/conformance-fixtures/spec.md:581`) cites the retired `conformance-corpus` REQ-CCR-08's marker note; the new minimal `CFX` delta's Cross-Reference Amendment RECOMMENDS option (a) — re-point to the retirement pointer — executed at archive-sync alongside the other cross-reference fixes above, per the delta's own "at archive-sync, this sentence MUST be re-pointed" wording. No behavioural scenario in REQ-CFX-16 is affected either way.

## Risks

| # | Risk | Source | Mitigation |
|---|---|---|---|
| 1 | Temp-dir ↔ real inline-collection-project equivalence is ASSERTED (REQ-MFB-01.2's "explicitly equivalent" clause) but not yet OBSERVED against a real published build; `runner.ts`'s `packageDir` derivation has no dedicated preservation test | Judge A, plan-verify-1 finding #6 (problem-fit, low) | Deferred — north-star `sdd/inline-collection-marker/north-star` D3: "a real inline-collection project runs against a published `0.0.0-dev.<sha>` build" activates at next consumer install. Not a gate criterion here; no new task or scope added. |

## Sequencing Note (RESOLVED at plan-verify iteration 1, Judge B Q5)

V1 flagged the apparent tension between design §9 step 3 (canary-no-echo/ELOOP landing, positioned before step 4+5) and step 4+5's own text (which includes deleting `containment.test.ts`, the vehicle for the OLD canary-adjacent no-echo coverage). Resolved as BINDING, not a judgment call: the MINIMUM canary-no-echo subset for the new path-guards baseline branches now lands GREEN inside **S-000.7**, ordered before that same task's deletion of `containment.test.ts` — so no window exists where the no-echo obligation is untested. S-001.5 then extends to the FULL hardened set (ELOOP, NUL, degenerate strings, REQ-FSC-10.4's recursive canary), which only needs to exist by S-006 (dead-test deletion, last). REQ-FSC-10.4's own guard **code** stays in S-000.6 (design §9 step 4+5's explicit text places the ~6-line walk.ts change there for compile reasons); this is unchanged from V1 and undisputed by plan-verify.

## Upstream Publication

N/A — `spec_source: internal`. Step 8b skipped entirely.
