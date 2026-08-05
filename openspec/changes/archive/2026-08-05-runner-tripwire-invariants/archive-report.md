# Archive Report — runner-tripwire-invariants

**Change**: `runner-tripwire-invariants`  
**Archived**: 2026-08-05  
**Branch**: `feat/tripwire-evaluate` (pushed to origin)  
**Triage**: L (security override: code execution + deployment/build integrity)  
**Outcome**: **delivered-with-steward-override** — outcome-gap (problem-fit) overridden by owner on 2026-08-05

---

## Archive Operations Summary

### 1. Spec Delta Sync

**Status**: ✅ **SYNCED**

Copied delta specs from change folder to main project specs:
- `runner-integrity-manifest/spec.md`: V2 → V3 (SIGNED)
  - Added REQ-CAP-01..06 (capability surface totality, callee decidability, origin admission, etc.)
  - Included "Judgment-day scope correction" blocks retracting soundness claims and clarifying scoped properties
  - Updated REQ-PRM-01 and REQ-CST-04.2 with scope corrections
  
- `publish-pipeline-hardening/spec.md`: V3 → V4 (SIGNED)
  - Added REQ-PPI-01..05 (publish-sequence integrity, explicit rebuild, suite gate, timeout, execution order)
  - Included plan-verify and judgment-day amendments

**Verification**: Both specs now carry the final scoped text with judgment-day amendments visible. No superseded adversarial claims left in the scoped sections.

### 2. Change Folder Archive

**Status**: ✅ **ARCHIVED**

Moved change folder using `git mv`:
- From: `openspec/changes/runner-tripwire-invariants/`
- To: `openspec/changes/archive/2026-08-05-runner-tripwire-invariants/`

All 24 artefacts preserved with git history intact (renames tracked). Folder move is the proof of archive.

### 3. Outcome Documentation

**Status**: ✅ **DOCUMENTED**

Added `outcome-override.md` recording the steward reckoning verdict:
- **Gap**: decidability property (criterion 9: zero findings whose fix is "add another spelling") not met — three independent adversarial rounds found new shapes each time
- **Verdict**: `outcome-gap`, `gap_category: problem-fit`
- **Decision**: OVERRIDE — accept the partial delivery; the delivered value (publish path hardening, fail-closed manifest, whole-verbatim messages) is real and independent
- **Owner's answers**: CQ-R1..R4 recorded with explicit reasoning for each question

### 4. Lessons Learned

**Status**: ✅ **EXTRACTED**

Added 6 entries to `openspec/lessons-learned.md`:

| Lesson | Key Finding |
|--------|-------------|
| Three independent adversarial rounds | Spelling-based guards converge by enumeration and have no tail; third round proved this architecture cannot be made sound without dataflow analysis |
| Completeness ≠ soundness | Red-proofs show every node checked (completeness) but not that every checked node is correctly rejected (soundness) — different properties, both needed |
| Prose counts are not gates | A count committed to narrative is a one-time snapshot; carry counts via executed assertions only (`expect(array.length).toBe(N)`) |
| `it.skipIf()` test registration trap | Skipping at registration time makes tests invisible to audit and counters; skip at assertion level instead |
| Archive-time registrations skip cycles | Pending items require explicit transcription from prior archive register; grepping backward at design time finds them |
| Byte-neutrality and comment-only edits | `removeComments: false` in tsconfig means JSDoc comments move the digest; any change touching `src/**` re-pins the manifest |

### 5. ADR Recommendations

**Status**: ✅ **PRESENT IN SYNCED SPECS**

Three new ADRs now in the project record (all `Accepted`):
- **ADR-0079**: Capability admission replaces deny-scan (with Amendment retracting the soundness claim)
- **ADR-0080**: Tripwire classifiers are total with fail-closed default (with scope-correction note)
- **ADR-0081**: Path verdicts are resolution-based; predicates live in `scripts/` (no amendment block, but noted in code)

**Recommendation**: All three are project-durable and remain promoted to project-level decisions.

### 6. Pending Changes Verification

**Status**: ✅ **COMPLETE**

The 23-row register from `slices.md` (Excluded Ledger) was re-audited at archive and all dispositions re-verified:
- 4 `CLOSED-BY-MECHANISM` (R1-7, R1-16, R1-17, `node:vm` altitude fold)
- 13 `CLOSED-BY-FIX` (R2-3..5, R1-5..6, R1-8, R1-10..11, R1-13, R1-15, two spec deviations)
- 4 `OUT-WITH-REASON` (R1-9, R1-12, R1-14, R1-18)
- 1 `archive-verifies` (architecture baseline refresh)
- 1 `RE-REGISTERED` (meta-finding: mechanism wants a structural invariant, not shape scanner) → feeds `capability-admission-oracle`

**New registrations** (owed by slices.md and verify-report.md):
- `capability-admission-oracle` (FIT-CAP-ORACLE): deferred soundness work, high-priority, own scoped change
- JD-1..JD-9: Judgment-day findings (safe-terminal predicate, computed member-access dataflow, enumeration totality, shared-build concurrency, shorthand property exclusion, false citation, publish-job naming, asymmetric multi-publish handling, prose count verification)
- M3.6, R1-14, fitness functions (FIT-NO-CHECKER, FIT-SINGLE-PREDICATE, FIT-RULE-REACHABILITY, FIT-BASELINE-NOT-SELF-HEALING)
- S-002.3, FU-6/8/10/11, and two carry-forward items from prior cycle (0.1.0 manifest shipping, user-reachable diagnostic)
- **CQ-R4**: Cross-repo notification to engine about Constraint-4 scope-down (not a code change; obligation to inform)

All present in `openspec/pending-changes.md`. Zero rows left unchecked or lost.

### 7. S-002.3 Decision

**Status**: ✅ **DEFERRED WITH EVIDENCE**

**Task**: Anchor-site code comment (`src/transport/single-instance-probe.ts`) — deferred because editing `src/**` moves `dist/**` bytes and breaks REQ-CAP-06 byte-neutrality gate.

**Evidence**: 
- Byte-neutrality gate is still pinned to literal: `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde`
- `removeComments: false` in both tsconfigs means any source edit moves manifest bytes
- This change's own REQ-CAP-06 enforces byte-identical freshbuild

**Decision**: Cannot land in this cycle. Registered as pending change with reason. Can only land in a change legitimately allowed to re-pin the manifest.

**Record**: Already in `openspec/pending-changes.md` line 729 under "S-002.3" with full explanation.

### 8. Gate Verification

**Status**: ✅ **ALL PASS**

**Test suite**: 
```
2652 pass / 0 fail
7378 expect() calls across 202 files
```
Expected: 2652 pass / 0 fail ✅

**Typecheck**:
```
bunx tsc --noEmit
```
Clean, zero diagnostics ✅

**Fresh-build digest**:
```
$ bun run build
$ sha256sum dist/runner-manifest.json
31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde
```
Expected: `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde` ✅
File count: 118 files, all byte-identical ✅

---

## What Was Synced

### Main Specs Updated
- `openspec/specs/runner-integrity-manifest/spec.md` — copied full V3 delta spec with scope corrections
- `openspec/specs/publish-pipeline-hardening/spec.md` — copied full V4 delta spec with amendments

**No superseded claims left in the synced text.** Every scope correction block is in place; every amendment is carried.

### Lessons Learned Added
Added 6 dated entries to `openspec/lessons-learned.md` (all marked "Source: change `runner-tripwire-invariants`, 2026-08-05")

### Pending Changes Register
All 23 rows re-verified + new dispositions + owed registrations all present in `openspec/pending-changes.md`

---

## Summary

| Item | Status |
|------|--------|
| Spec sync (delta → main) | ✅ Complete |
| Folder move (git mv) | ✅ Complete |
| Outcome override documented | ✅ Complete |
| Lessons learned extracted | ✅ 6 entries |
| ADRs recommended | ✅ 3 (all project-durable) |
| Pending changes verified | ✅ 23-row register + JD-1..JD-9 + owed items |
| S-002.3 decision | ✅ Deferred with evidence |
| Test gate | ✅ 2652/0 |
| Typecheck gate | ✅ Clean |
| Byte-neutrality gate | ✅ 31cd5382…f333fde, 118 files |

**All gates pass. Change is archive-complete and ready for PR #64 merge.**

---

**Archive executed**: 2026-08-05  
**Branch**: feat/tripwire-evaluate, pushed to origin  
**Commit**: 68bb4f8
