# Archive Report: author-emulation-e2e-scaffold

**Archived at**: 2026-07-14T00:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed, owner, 2026-07-13)

## Summary

The change adds a third golden idiom — a committed, byte-deterministic IR-transcript
corpus (`test/e2e/author-emulation/corpus/`, 22 records) capturing whole author RUNs
via the SDK's own `runFactoryForTest`, backed by five new fitness guards
(FIT-24..28), a `test/support/` capture cluster, a realistic author-emulation fixture
package, and an out-of-band `scripts/regen-corpus.ts` regenerator. Zero `src/` edits;
zero boundary or dependency-direction violations; architecture impact `additive`
(ratified by the architecture audit, 0 violations). All 39 REQs / 43 scenarios across
6 domains are now in main specs. Three ADRs (0047-0049) are promoted to Accepted.
Two non-blocking followups carry forward: a GCC-09.1 spec-illustration amendment
(closed at this archive — see below) and a cold-start suite non-determinism
investigation (registered in `pending-changes.md`).

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `author-emulation-generator` | New | 7 | 0 | 0 |
| `fitness-guards` | New | 5 | 0 | 0 |
| `golden-corpus-contract` | New | 12 | 0 | 0 |
| `ir-transcript-capture` | New | 5 | 0 | 0 |
| `run-report` | New | 5 | 0 | 0 |
| `scenario-matrix` | New | 5 | 0 | 0 |

All 6 domains were new to `openspec/specs/` (whole-delta copy, no MODIFIED/REMOVED
blocks — Step 4 validation skipped per convention).

### GCC-09.1 amendment (verify-report obligation #2, closed here)

REQ-GCC-09.1's worked illustration was reconciled to the landed behaviour: the
scenario now reads `{reason: "invalid-input", verb: null, path: null}` with the
"when attributable" hedge (both fields are `null` when the rejection reason isn't
attributable to a specific verb/path; when attributable, they carry the real values —
cross-referencing M-21's `path-collision` rejection as the concrete case). This was
applied identically to the change's delta spec and the main spec so both read
byte-identical after sync (verified via diff — clean match, no drift).

## Architecture Audit

Verdict: **notes** (0 violations, 1 note — Testing-section delta not yet folded into
baseline). `openspec/architecture.md` refreshed accordingly: Testing section fitness
count 23→28 (FIT-24..28), third golden idiom entry, support cluster, fixture
package, regen script all recorded (pre-existing on disk, verified faithful).

## Archive Location

`openspec/changes/archive/2026-07-14-author-emulation-e2e-scaffold/`

## Lessons Learned Persisted

- GateGuard 'auth' substring false-positives on unrelated paths — type: pattern — `project/lessons-learned`
- Reserve fitness-guard numbers at plan time for parallel changes — type: pattern — `project/lessons-learned`
- Persist owner CQ rulings into steward's own artefact, not just state.yaml — type: discovery — `project/lessons-learned`
- Keep instrumentation-window liveness assertions off shared capture caches — type: pattern — `project/lessons-learned`
- Archive-phase delegation needs headroom — verify envelopes against git evidence — type: discovery — `project/lessons-learned`

## ADRs

### Promoted to Project-Level

- ADR-0047: Corpus Authority — Normative Core, Informative Shell (originally ADR-0047 Proposed in this change's design)
- ADR-0048: A Third Golden Idiom — Run-Level Transcript Capture, Single Path, No Self-Heal
- ADR-0049: Canonical Serialization Binds the Reader Too

All three promoted Accepted at this archive — cross-cutting (govern the Testing
baseline's golden-idiom family and any future per-family e2e change), not specific to
this change's literal code.

### Recommended but Not Yet Promoted

None — all three design ADRs promoted.

## Followups Registered

Verify verdict was `pass-with-followups`. Registered in `openspec/pending-changes.md`
under "From `author-emulation-e2e-scaffold` (2026-07-14)":

| Description | Type | Size |
|---|---|---|
| Cold-start suite non-determinism root-cause investigation | test-infra | S |
| Batch-cap literal → `BATCH_CAP_BYTES` constant reference | refactor | XS |
| FIT-24 shape-scan narrower than REQ-GCC-06 wording (judgment-day INFO, both judges) | test-coverage | XS |
| FIT-24 interior-absolute-path + block-comment-opener refinements | test-coverage | XS |
| FIT-27 write-primitive coverage gap (`copyFileSync`/`cpSync`/`renameSync`/streams) | test-coverage | XS |
| `walkReachable` extensionless-import resolution edge case | test-coverage | XS |
| Coverage-manifest GCC-08.1/SCM-02.1 automated enforcer test | test-coverage | S |
| GCC-03 self-comparing test methodology | test | XS |
| Root `.gitattributes` `eol=lf` rule | refactor | XS |
| `gated` field spec-level decision + FIT-27 parameter-flow taint hardening | refactor | S |

`PC-SPEC-FSC-TOKENS` (upstream `folder-scaffold` REQ-FSC-05 multi-filter-chaining
gap) remains open — no action at this archive, condition unchanged (M-04 currently
GREEN).

## Risk Residuals (carried past archive)

- **Cold-start suite non-determinism**: observed twice, unreproducible warm (27
  consecutive clean runs + `--rerun-each 4`); the committed corpus is proven
  byte-deterministic under the strong fresh-process regen guard. CI-reliability
  concern, not a deliverable defect. Registered as a followup.
- **Young ADRs**: ADR-0047/0048/0049 promoted Accepted at this same archive — no
  independent validation period yet; first real test is the next per-family
  e2e change reusing this infrastructure.
- **`PC-SPEC-FSC-TOKENS`** stays open upstream (`schematic-local-files`'s own
  unfreeze item) — M-04 is the escalation target if the pipeline's multi-filter
  chaining regresses.

## Final State

- Spec status: signed (archived)
- Main specs updated for: `author-emulation-generator`, `fitness-guards`,
  `golden-corpus-contract`, `ir-transcript-capture`, `run-report`, `scenario-matrix`
- Lessons in project memory: 5 added
- ADRs in project memory: 3 promoted
- Pending changes in project memory: 10 followups registered (already present on disk from a prior session pass, verified complete)
