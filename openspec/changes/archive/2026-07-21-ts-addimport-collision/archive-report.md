# Archive Report: ts-addimport-collision

**Archived at**: 2026-07-21T00:00:00Z
**Verify verdict**: pass-with-followups (50/50 REQ coverage, suite 2136/0, 0 critical/warning findings)
**Spec version archived**: V3.2 (signed; targeted `.25` amendment owner-ratified 2026-07-21)
**Adversarial review**: APPROVED (judgment-day Round 2; Round 1 fixes `2c731b4`)
**Steward reckoning**: DELIVERED (2 conscience questions owner-affirmed)
**Architecture audit**: HUMAN OVERRIDE (`architecture-override.md` — pre-existing `engines.node`/CI mismatch, unrelated to this change; discharge obligation registered in the ledger below)

## Summary

Ports the judgment-day-approved React `addImport` four-branch algorithm into the TypeScript
leaf, replacing a naive first-match unconditional merge that silently emitted invalid TypeScript
on type-only/collision/aliased-import input. Closes a CONFIRMED `name`-splice injection on
`addImport` (REQ-TSD-13). Main spec `typescript-dialect` synced: REQ-TSD-01 widened from a
subpath/op-set statement into the full algorithm (33 scenarios), REQ-TSD-03 gains `.11`
(idempotency durability proof), REQ-TSD-13 added. Three ADRs promoted. Four lessons extracted.
Ledger fully reconciled — see the evidence table below.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `typescript-dialect` | Delta | 1 (REQ-TSD-13) | 2 (REQ-TSD-01, REQ-TSD-03) | 0 |

## Archive Location

`openspec/changes/archive/2026-07-21-ts-addimport-collision/`

## Lessons Learned Persisted (4)

- Spec claims about *existing* behaviour need an executor pin-probe, not plausibility — REQ-TSD-01.25's false "all-matches removal" claim survived 4 spec revisions until probed.
- Blind judgment-day catches fixture-combination corruption (comment+directive insertion index) that 7 in-loop verifies + a 50/50 final verify missed, because all shared the same fixture shapes.
- `ts-morph`'s statement-insertion index is comment-inclusive (`getStatementsWithComments`), not directive-inclusive — a reusable gotcha for trivia-relative insertion.
- Commit-after-every-seal + filesystem state made two host crashes lossless mid-build.

All persisted to `openspec/lessons-learned.md` under `## From \`ts-addimport-collision\` (2026-07-21)`.

## ADRs

### Promoted to Project-Level
- ADR-0070: Mirror the collision/idempotency predicate in the TS leaf + FIT-41 parity (originally ADR-01)
- ADR-0071: Inline `jsx-name-validator.ts` reuse; ARCH-2 rename debt registered (originally ADR-02)
- ADR-0072: Shebang `addImport` — fail-closed fallback shipped (originally ADR-03)

Numbering: `0068-0069` reserved for `context-singleton-fix` (unaffected); this change takes the
next free range, `0070-0072`.

## Ledger Reconciliation Evidence

| Ledger row (content) | Action | Verification |
|---|---|---|
| CONFIRMED injection surface (item 22) | PARTIAL — `addImport` closed | REQ-TSD-13.1-.4 pin the exact confirmed breakout rejected pre-mutation; siblings superseded by new raw-splice-exposure row |
| Latent collision-predicate gap (`assertNoCollision` import scan) | SUPERSEDED | `isValueNamespaceClaimed` extraction doesn't touch `assertNoCollision`'s import scan (design §4.8); re-registered as "sibling collision-scan asymmetry (Arch N4)" |
| Latent type-contamination bug (`addImport` merges into type-only decl) | CLOSED | Step 3 gates merge on `isNonTypeOnlyNamedImportClause`; REQ-TSD-01.6/.8/.26/.27 reject instead |
| Test-suite weakness (idempotency test proves determinism only) | CLOSED | REQ-TSD-03.11, seed-with-own-output, `dialect.test.ts:44` |
| Self-alias false-positive reject (React precedent) | TS side CLOSED / React unchanged | REQ-TSD-01.15 + sign-off ratification #4 (deliberate TS deviation); `src/dialects/react/ops.ts` zero-diff |
| SHARPENED merge-defect debt (whole `addImport` rewrite) | CLOSED | verify-report 50/50 REQ coverage, judgment-day APPROVED |
| TS-dialect trust-boundary JSDoc backfill | PARTIAL — `addImport` side closed | REQ-TSD-13.5; sibling-doc remainder folds into new raw-splice-exposure row |
| S-004.4 shebang-aware insertion followup | CONFIRMED persists (already registered) | present verbatim, ADR-03/ADR-0072 |

New rows registered: sibling raw-splice exposure, sibling collision-scan asymmetry (Arch N4),
F-1 (REQ-TSD prefix collision), F-2 (FIT-41 tightening), judgment-day test-hardening bundle,
judgment-day contract-pin bundle, engines.node/CI alignment (architecture-override obligation).

## Followups Registered

7 new rows registered at `openspec/pending-changes.md` § "From `ts-addimport-collision` archive
(2026-07-21)" (see table above) — all `pass-with-followups` items (F-1, F-2) plus judgment-day
INFO items plus the architecture-override discharge obligation plus the two sibling-scope rows.

## Final State

- Spec status: signed (archived), V3.2
- Main specs updated for: `typescript-dialect`
- Lessons in project memory: 4 added
- ADRs in project memory: 3 promoted (0070-0072)
- Pending changes in project memory: 7 new rows registered; 4 rows closed; 1 partial-closed to full-partial; 1 superseded; 1 confirmed-persisting
