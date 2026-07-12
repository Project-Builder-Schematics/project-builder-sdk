# Archive Report: stage-5b-dialect-breadth

**Archived at**: 2026-07-12 (ISO timestamp)
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed 2026-07-12)
**Steward gate**: PASS (owner affirmations recorded in outcome-verdict.md)
**Judgment-day**: APPROVED (R1 and R2 — 4 real bugs caught, all fixed pre-archive)

## Summary

`stage-5b-dialect-breadth` extends the TypeScript dialect with FIVE new structured ops (`removeImport`, `addFunction`, `addVariable`, `addClass`, and related collision diagnostics), closing the named pain: "the dialect that exists to provide type-safety forces authors down `.raw()` for every edit but one (`addImport`)."

All four delta specs (typescript-dialect V5, dialect-generics V4, modify-coalescing V4, dialect-conformance V5) have been synced into main specs. Specification amendment CQ-R3 was applied: REQ-TSD-09/10/11 collision namespaces expanded to include `enum`/`namespace` (owner ruling, correctness-positive). Four new ADRs/amendments promoted to `openspec/decisions/` (ADR-0039 new, amendments to 0037/0010/0012). 

All 13 REQs and 47 scenarios compliant with passing real-execution evidence. Suite 861 pass / 0 fail. Full build + typecheck + fitness clean. Archive-time staleness fixes applied (JSDoc, dialect-authoring-standards spec). 13 non-blocking followups registered; 4 lessons learned persisted. Code audits (verify-final + pre-PR) clean of gating severity. Folder moved to `openspec/changes/archive/2026-07-12-stage-5b-dialect-breadth/`.

## Specs Synced to Main

| Domain | File | Action | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|---|
| `typescript-dialect` | `openspec/specs/typescript-dialect/spec.md` | Delta sync → V5 | 4 (TSD-08..11) | 2 (TSD-01, TSD-04) | 0 |
| `dialect-generics` | `openspec/specs/dialect-generics/spec.md` | Delta sync → V4 | 2 (DG-06, DG-07) | 1 (DG-02) | 0 |
| `modify-coalescing` | `openspec/specs/modify-coalescing/spec.md` | Delta sync → V4 | 1 (MC-08) | 0 | 0 |
| `dialect-conformance` | `openspec/specs/dialect-conformance/spec.md` | Delta sync → V5 | 3 (DC-06..08) | 0 | 0 |
| **Total** | | | **10** | **3** | **0** |

All MODIFIED blocks validated: scenario count preserved or explicitly marked REMOVED. No destructive sync issues.

## Amendments Applied (CQ-R3 Owner Ruling)

**REQ-TSD-09/10/11 Collision Namespace Widening**
- Synced text: "VALUE-NAMESPACE declaration (`function`/`const`/`let`/`var`/`class`) OR an IMPORT BINDING"
- **Amended to**: "VALUE-NAMESPACE declaration (`function`/`const`/`let`/`var`/`class`/`enum`/`namespace`) OR an IMPORT BINDING"
- **Location**: `openspec/specs/typescript-dialect/spec.md` (line ~250 in REQ-TSD-09)
- **Rationale**: Shipped code already rejects enum/namespace collisions (TS2451); documented contract now matches implementation (owner CQ-R3 ruling at reckoning gate).

## Staleness Fixes (F3 Obligations)

1. **`src/dialects/typescript/index.ts` (lines 29-30)**
   - **Before**: JSDoc claiming "thin starter op-pack (`addImport`)"
   - **After**: Updated to "full op-pack (`removeImport`, `addFunction`, `addVariable`, `addClass`, plus `addImport`)"
   - **Rationale**: Five ops now shipped; single-op claim is stale.

2. **`openspec/specs/dialect-authoring-standards/spec.md` (REQ-DAS-01)**
   - **Lines 20-26**: Updated "starter op-pack as the worked example" to reflect five shipped ops
   - **Lines 33-35**: Op-surface scenario now lists all five ops instead of single-op-only
   - **Rationale**: Specification no longer describes the op-pack as unshipped or "thin"; all five ops are now part of the documented contract surface.

## Archive Location

- **Old**: `openspec/changes/stage-5b-dialect-breadth/` (no longer exists)
- **New**: `openspec/changes/archive/2026-07-12-stage-5b-dialect-breadth/`
- **Proof**: `git mv` verified; SRC removed, DEST exists, file count 13 artefacts preserved

## Promoted ADRs

### Accepted to Project-Level Decisions

- **ADR-0039** (NEW): Fail-loud rejection of author-incoherent dialect operations
  - Rejects `.modify()` after open AST op (row-136, silent data-loss prevention)
  - Rejects add-op collisions with value-namespace + import bindings via `dialectError` factory
  - Origin: `stage-5b-dialect-breadth` (S-001, S-002)

- **ADR-0037 amendment** (Accepted): runOp containment, fail-closed run, mutation-gated registration
  - WeakSet-branded `dialectError` factory (kit-internal `src/core/dialect-error.ts`)
  - Shared `#invokeContained` discriminator (WeakSet brand, NOT message-prefix)
  - Fail-closed poison flag on `RunContext` (cross-handle "never attempted" guarantee)
  - Mutation-gated `#ensureOpen` (zero-directive no-ops, REQ-TSD-08.4)
  - Origin: `stage-5b-dialect-breadth` (S-000..S-005)

- **ADR-0010 amendment** (Accepted): `withOps` runtime collision + reserved-name check
  - Eager synchronous composition check at `withOps` call
  - Duplicate-op detection + reserved-handle-name collision detection
  - Distinct `"op-pack composition failed: "` prefix (not WeakSet-branded, not run-contained)
  - Origin: `stage-5b-dialect-breadth` (S-004)

- **ADR-0012 amendment** (Accepted): conformance tail + `deepEqual` extraction
  - Mandatory adversarial samples (empty, comment-only, 4 MiB, CRLF, BOM, duplicate-target)
  - Real-base structural probe (identity check, non-null object return)
  - Documented-limit leaf rule (SDK ships, third-party documents)
  - `deepEqual` extraction to kit-internal `src/core/deep-equal.ts` (FIT-17 compliance)
  - Origin: `stage-5b-dialect-breadth` (S-005)

## Lessons Learned Persisted

Four cross-change lessons registered to `openspec/lessons-learned.md`:

1. **Blind council + judgment-day discovered real defects in-loop missed**
   - Type: discovery
   - Key finding: Adversarial independence (judgment-day judges read ONLY evidence) surfaces blind spots council + in-loop iteration miss. Structure every L change to include blind judgment gates.

2. **Signed spec text governs over derived tables; reconciliation costs matter**
   - Type: pattern
   - Key finding: Prose vs. table drift (REQ-DC-06 chapeau) cost a fix iteration. Reconcile before signing; re-read specs for consistency before launch.

3. **Trailing positional args after variable-arity author-facing args are structurally fragile**
   - Type: pattern
   - Key finding: Four problems (on-undefined message, multi-declaration guard, poison flag, non-null assertion) traced to `(ast, ...args)` + trailing positionals. Enforce anti-pattern in conformance kit; document in dialect-authoring-standards.

4. **State-mirror duplicate-key corruption breaks pipeline-guard**
   - Type: bugfix
   - Key finding: JSON.parse silently accepts duplicate keys. Add validation pass (schema audit) after every state write. Enforce canonical JSON; one session-start check should reject non-compliant state.

## Followups Registered

13 non-blocking tasks + 1 acceptance note registered to `openspec/pending-changes.md`:

- (13–25) Mutation-gate double-print optimization, REQ-DG-07 amendment, RESERVED_HANDLE_NAMES hardening, DAS-01.1 derive-from-type, real-base probe gap, pointer-assertion weak coverage, primitive-AST WeakMap TypeError, FIT-08 handlePathFor, e2e-file extension coherence, name/source TS-identifier validation, defineDialect-direct reserved-name routing, removeImport alias documentation, reserved-verb message naming
- Acceptance note: CQ-R2 testOpPack behavior change affirmed at reckoning

All deferred per verify-report § Followups and outcome-verdict § Escalated CQ findings.

## Final State

- **Spec status**: signed (V2, main specs now include all four delta specs)
- **Main specs updated for**: typescript-dialect (V5), dialect-generics (V4), modify-coalescing (V4), dialect-conformance (V5)
- **Lessons in project memory**: 4 new entries
- **ADRs in project memory**: 1 new ADR (0039), 3 amendments (0037/0010/0012)
- **Pending changes in project memory**: 13 tasks + 1 note
- **Architecture audit**: clean (baseline refreshed; no violations post-verify)
- **Code audit (pre-PR mode)**: clean of gating severity (4 info/nit findings, design §4.2b e2e coherence documented)

## Next Steps

Change is closed. Orchestrator can:
- Push PR with all archived artefacts + ADRs + pending-changes + lessons-learned updates
- Surface pending followups for Q3 planning (mutation-gate double-print, REQ-DG-07 wording, RESERVED hardening = M-sized cluster; others S/XS)
- No further ADR confirmation needed (all promoted ADRs are Accepted); verification ladder complete

---

**Archive prepared by**: sdd-archive skill (stage-5b-dialect-breadth, 2026-07-12)
