# Archive Report: conformance-corpus

**Archived at**: 2026-07-19T00:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V3 (signed, re-signed by owner 2026-07-18)

## Summary

The conformance corpus — a root-level `conformance/` static-contract data corpus consumed
cross-repo by the engine's Go harness — is archived. Four new domains (`conformance-corpus`,
`conformance-fixtures`, `conformance-self-check`, `corpus-determinism`) synced into
`openspec/specs/`; the owner-approved prose reconciliation was applied to
`conformance-fixtures` REQ-CFX-03/REQ-CFX-09 (exit-path hedge closed per ADR-0064). Five ADRs
(0063-0067) promoted to `openspec/decisions/`. 16 followups registered at
`openspec/pending-changes.md`. Architecture baseline refreshed (additive impact) in both
`openspec/architecture.md` and the engram baseline (obs #652). Judgment-day APPROVED at Round 2
(3 confirmed real fixes @ `caff939`). Suite: 2041 pass / 0 fail across 189 test files.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `conformance-corpus` | New | 8 | 0 | 0 |
| `conformance-fixtures` | New | 14 | 0 | 0 |
| `conformance-self-check` | New | 6 | 0 | 0 |
| `corpus-determinism` | New | 7 | 0 | 0 |

All four are pure ADDED-only delta specs (no MODIFIED/REMOVED blocks) — copied directly into
`openspec/specs/` as new full specs. Owner-approved reconciliation applied in
`conformance-fixtures/spec.md`: REQ-CFX-03 clause (d) and REQ-CFX-09's precondition each gained
a one-line resolution note closing the exit-path hedge per ADR-0064.

## Archive Location

`openspec/changes/archive/2026-07-19-conformance-corpus/`

## Lessons Learned Persisted

- A fixture corpus can catch a real shipped bug on its very first live contact — type: discovery — topic_key: `project/lessons-learned`
- Blind-judge fan-out catches what verify misses, even after verify already passed twice — type: pattern — topic_key: `project/lessons-learned`
- An Executor Context Map in slices eliminates pointer-gap friction at plan-verify — type: pattern — topic_key: `project/lessons-learned`
- ADR promotion order is independent of merge order — track ownership explicitly — type: discovery — topic_key: `project/lessons-learned`

## ADRs

### Promoted to Project-Level

- ADR-0063: Root `conformance/` as a new cross-repo static-contract layer
- ADR-0064: `wire-create-reject-twin` outcome triple = exit 2 / `unrepresentable` / null (frozen)
- ADR-0065: Per-case `factory` override for the multi-behaviour composition fixture
- ADR-0066: Structural self-check as one fitness file; typecheck sweep; corpus.json-derived inventory
- ADR-0067: `collection.json` package-anchor marker — single shared ancestor

Numbering contract (obs #1313): `conformance-corpus` owns 0063-0067 as-numbered (an
engine-signed handoff already cites "ADR-0065" by exact number — never renumbered).
`context-singleton-fix` takes 0068-0069 at its own archive.

### Recommended but Not Yet Promoted

None — all 5 design ADRs promoted.

## Followups Registered

16 followups registered at `openspec/pending-changes.md` under "From `conformance-corpus`
(2026-07-19)" — consolidated from judgment-day's ledger (engram obs #1311), including the
architect's monotonic fixture-floor item. W1 closed in-change by JD-3; W2 superseded by JD-2;
W3 (ADR-0065 scope prose) closed at this archive by the promoted ADR's generalized wording.

| # | Description | Type | Size |
|---|---|---|---|
| 1 | Strict-decoding mirror — closed-key-set whitelist per manifest level | refactor | S |
| 2 | Inline fit-40 checks → extracted validators + negative coverage | refactor | S |
| 3 | Create total-count==1 + `session.buffer` raw shape scan | test-coverage | S |
| 4 | REQ-CDT-05 POSIX-path scan gap (factory.module/schematicRoot) | test-coverage | XS |
| 5 | Monotonic fixture floor + derived absolute case counts | refactor | S |
| 6 | `seed/**` byte pinning | test-coverage | S |
| 7 | Import allow-list as a real allow-list | refactor | S |
| 8 | `manifest.json` parse-error fixture-id context | refactor | XS |
| 9 | Transcript coherence cross-checks + exitCode allow-list | test-coverage | S |
| 10 | Zero-effect schematic-cleanup open question (cross-repo) | edge-case | — |
| 11 | `greetingVersion` absent-default confirmation (cross-repo) | edge-case | — |
| 12 | Payload variety (non-ASCII/empty/deep/cap) | test-coverage | S |
| 13 | ADR-0065 scope prose — CLOSED at this archive | docs | XS |
| 14 | Engine M1 confirmation (cross-repo, non-gating) | other | — |
| 15 | Negative-suite temp-dir cleanup | test-infra | XS |
| 16 | README first-paragraph dist-early-return anchor | docs | XS |

## Final State

- Spec status: signed V3 (archived)
- Main specs updated for: `conformance-corpus`, `conformance-fixtures`, `conformance-self-check`, `corpus-determinism`
- Lessons in project memory: 4 added (topic `project/lessons-learned`, upsert obs #648)
- ADRs in project memory: 5 promoted (`openspec/decisions/0063-0067`)
- Pending changes in project memory: 16 registered
- Architecture baseline: refreshed (additive) — `openspec/architecture.md` + engram obs #652
- Suite: 2041 pass / 0 fail, 189 test files (post-archive confirmation run)
