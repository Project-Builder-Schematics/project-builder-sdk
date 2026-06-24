# Archive Report: typed-options-and-read

**Archived at**: 2026-06-24
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed)

## Summary

Sub-change #2 of the `l1-author-surface` program — typed options prove+freeze and read trichotomy — is
complete and archived. It proves and freezes the `create<S>` homomorphic map contract via a full 7-scenario
matrix (positive + negative + CI regression guard), introduces `find(path).read(): Promise<string | undefined>`
with the branchable not-found/empty trichotomy, and evolves the EngineClient port signature (ADR-01).
Verify-final passed (12/12 signed REQ scenarios covered, adversarial review by two blind judges passed
with no blocking findings, architecture baseline refreshed). Integration gate #2 passed.
`typed-create-skeleton` main spec updated (REQ-01 V1→V2 + REQ-03 added; no `OptionsOf<S>`);
`read-from-disk` main spec created new.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `typed-create-skeleton` | Delta | REQ-03 (new) | REQ-01 (V1→V2, scenarios 01.1-01.3 preserved + 01.4-01.7 appended) | 0 |
| `read-from-disk` | New | REQ-RD-01, RD-02, RD-03 | 0 | 0 |

F-01 resolved: main spec's `typed-create-skeleton/spec.md` now reads `{ [K in keyof S]: S[K] }` — no
`OptionsOf<S>` anywhere in the requirement body or scenarios.

## Archive Location

`openspec/changes/archive/2026-06-24-typed-options-and-read/`

## Lessons Learned Persisted

3 entries appended to `openspec/lessons-learned.md`:
- "A named derivation alias can be a structural no-op — prove the existing contract, don't add one" (discovery)
- "FIT-04 dts-baseline regen is the intentional-freeze proof — keep the diff to one line" (pattern)
- "Two blind judges independently rediscovering the same edge validates it as a real tracked boundary" (pattern)

## ADRs

### Promoted to Project-Level
- **ADR-0016** — Read Signature Freeze: Async (ratifies ADR-0001) + Nullable `undefined`
  (originally ADR-01 in this change). Promoted: cross-cutting port contract, affects all future
  read-site design in the SDK and any downstream real engine implementation at §6.
  File: `openspec/decisions/0016-read-signature-async-nullable-undefined.md`

## Followups Registered

| Description | Type | Size | Gating? |
|---|---|---|---|
| **#3 forward note**: `EngineClient.read` → `undefined` on not-found; #3 error-attribution MUST treat not-found as a return value | other | — | Design input for #3 |
| JD test-hardening: `permissive-proof.guard.test.ts` red-proof line derived from scan, not hardcoded | refactor | XS | — |
| CQ-1: lint rule / named helper for `=== undefined` read trichotomy affordance | refactor | S | — |
| CQ-2: real typed-factory example vs synthetic matrix in `typed-create.test.ts` | docs | S | — |

**Removed**: `typecheck:permissive-proof` masked-exit followup from #1 skeleton — DONE, resolved by
`permissive-proof.guard.test.ts` in this change.

## Pre-PR Audit

Covered by `sdd-verify --mode=final` (Step 11b code-audit, clean: 0 Bug/MAJOR/Architecture findings over
the full #2 diff). F-01 (stale `spec.md` frozen-contract line) resolved at archive — synced to the delta
spec's authoritative wording. No unaddressed blocking findings.

## Upstream Sync

Skipped — `spec_source = internal`. No upstream to sync.

## Final State

- Spec status: signed (archived); 2 capabilities updated in `openspec/specs/`
- Lessons in project memory: 3 added to `openspec/lessons-learned.md`
- ADRs: 1 promoted (ADR-0016); none remaining unreviewed
- Pending changes: 4 registered (1 removed/resolved from prior)
- Program: `l1-author-surface` #2 done; #3 `error-and-commit-contract` is next
