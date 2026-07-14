# Archive Report: author-write-surface

**Archived at**: 2026-07-14 (ISO date stamp)
**Verify verdict**: pass-with-followups
**Spec version archived**: V4 (7 domains signed, 2026-07-14)
**Triage**: L
**Scope**: 60 files, 9 impl commits + 1 simplify pass

---

## Summary

The `author-write-surface` change delivered an honest write-API rename across the public dialect `Handle` and commons `WriteOps` surfaces: `modify(content)` → `replaceContent(content)` (wholesale-replace verb) and `.raw(fn)` → `.modify(fn)` (AST-edit escape hatch). The change is mechanically complete and correctly gated via a new FIT-04 baseline pair (`core.define-dialect.d.ts`), with all 23 active requirements covered by runtime-passing tests under Strict TDD discipline. The spec was owner-narrowed at the post-design foresight gate to the honesty clause only (importable `modify` and run-identity mechanism deferred per obs #2128 via REQ-TSD-12 tombstone). Steward reckoning confirms full outcome alignment. Two low-severity verify-report followups (FIT-04 content assertion for the new baseline pair, stale comment fix at `dialect-handle.ts:194`) were already fixed in commit 100b623; judgment-day round-1 produced one suggestion (applied commit 4544eb5). Archive sealed.

---

## Specs Synced

| Domain | Type | Operation |
|---|---|---|
| `foundations-skeleton` | MODIFIED | REQ-KIT-03, REQ-GIR-02, REQ-FIT-04, REQ-STD-01: honest-verb rename surface, scope-reduction amendment (REQ-TSD-12 tombstone, REQ-DAS-01 importable doc clause removal) |
| `dialect-generics` | MODIFIED | REQ-DG-02/03/04/05/06/07: escape-hatch and coalescing renamed, collision detection, compliance pins |
| `modify-coalescing` | MODIFIED | REQ-MC-01/02/03/06/08: rename guard relocation to `.replaceContent`, absence proof for `.modify(fn)` |
| `typescript-dialect` | MODIFIED | REQ-TSD-01/03/04: collision hint and edge-suite, scope-reduction amendment (REQ-TSD-12 tombstone, importable form deferred) |
| `dialect-conformance` | MODIFIED | REQ-DC-02/03/04: chain-step discriminant rename, misroute test, coalesce validation |
| `dialect-authoring-standards` | MODIFIED | REQ-DAS-01: doc surfaces narrowed to chained `.modify(fn)` form (importable deferred per obs #2128) |
| `authoring-error-contract` | MODIFIED | REQ-AEC-13 (ADDED): wire-op `verb:"modify"` label pin, documentation obligation across 3 surfaces |

**Archive location**: `openspec/changes/archive/2026-07-14-author-write-surface/`

---

## Lessons Learned Persisted

1. **Plan under-enumeration recurs across mechanical changes** (type: pattern)
   - *What*: Slice task counts computed at plan time diverge from actual executor discoveries; literal occurrence counts via `grep` are unreliable; mechanical/rename-shaped changes are most prone to this.
   - *Why*: The plan-phase enumerate-by-reading is manual and error-prone; executor re-validates and discovers gaps (19 discovered during apply, not pre-enumerated).
   - *Where*: Applies to any refactor/rename touching >20 files; project-wide remediation.
   - *Learned*: For future mechanical changes, mandate executor repo-wide `rg` sweep as the single source of truth for rename campaigns (files containing the old symbol), not text plan estimates. Discovered gap count is the audit signal.
   - *Source*: change `author-write-surface` (2026-07-14), explore obs #2111, apply-progress gap audit

2. **Rename-shaped changes don't always achieve "natural RED" without proof scaffolds** (type: discovery)
   - *What*: Some renamed behaviors (like discriminant key changes in published contracts) can't be adequately proven with RED-first test structure without pre-building the renamed surface and running the test against both old+new states.
   - *Why*: The scenario (e.g., `{raw:...}` vs `{modify:...}` discriminant misroute) is only Red if both forms exist; pure forward-first assumes new state only.
   - *Where*: Public contract changes and published union types; REQ-DC-02.2 (discriminant-misroute, planted fixture) is the pattern.
   - *Learned*: For rename-to-published-API: Temporary-mutation proof (build both old+new, run scenario against new, assert old would have failed) is the sanctioned adaptation. Documented as a valid RED alternative in REQ-DC-02.2's character (ADR-0051 pending). Don't force forward-only when the scenario demands coverage of both forms.
   - *Source*: change `author-write-surface` (2026-07-14), design appendix, slices S-003/S-004 REQ-DC-02.2 character

3. **Fitness sweeps need non-vacuity floors or they pass silently** (type: discovery)
   - *What*: Corpus-based fitness checks (e.g., `.raw` substring sweep across docs) risk matching zero files and exiting with a pass, masking incomplete coverage if the target was never added to the corpus.
   - *Why*: `rg` is forgiving; no hits is not an error condition; absence of the `old_string` is silent.
   - *Where*: FIT guard tests and doc-compliance sweeps; QA council live-proof required for new guards.
   - *Learned*: Fitness sweeps must assert floor > 0 (e.g., ROADMAP has ≥6 `.raw` mentions that must migrate). Guard test addition requires explicit case statement (e.g., `fit-raw-sweep.test.ts` RED-first on "should find ≥5 ROADMAP `.raw` cases"). Do NOT rely on absence-pass as validation.
   - *Source*: change `author-write-surface` (2026-07-14), verify-report FIT-04 discovery, design 4.7 fitness functions

---

## ADRs

### Promoted to Project-Level

- **ADR-0050**: Handle unfreeze — honest write-verb rename (NEW, created during apply commit 9f76323)
  - *Status*: Signed, promotion approved
  - *Summary*: Establishes the decision to unfreeze the frozen `Handle` type, rename `modify(content)`→`replaceContent`, and `raw(fn)`→`modify(fn)` as distinct non-overloaded methods; re-freeze via FIT-04 10th baseline pair. Rationale: pre-1.0 window, honesty in public authoring API.
  - *Origin*: change `author-write-surface` (2026-07-14)

### Amendments to Existing ADRs (In-Place, Not New)

- **ADR-0039** (Fail-loud rejection for incoherent operations): Guard relocation amendment
  - *Changed*: Guard target renamed from `runModify(content)` to `runReplaceContent(content)`; message text updated to byte-exact REQ-MC-08.1 specification.
  - *Not changed*: The rejection semantics and the semantic that guards wholesale-replace, not the AST-escape verb.
  - *Amended by*: change `author-write-surface` (2026-07-14), commit 4544eb5

- **ADR-0012** (Conformance kit): Chain-step discriminant amendment
  - *Changed*: `ConformanceCase.chain` step union renamed from `{raw:(ast)=>void}` to `{modify:(ast)=>void}`; dispatch updated to `"modify" in step ? handle.modify(...)`.
  - *Not changed*: The conformance contract's role or the dispatch pattern.
  - *Amended by*: change `author-write-surface` (2026-07-14), commit 9f76323

---

## Followups Registered

**Verdict**: pass-with-followups. Two followups were fixed during apply (commit 100b623); four pre-existing issues registered as project-level pending changes:

| Description | Type | Size | Status |
|---|---|---|---|
| Add content assertion to `fit-04-dts-semver-gate.test.ts` for new `core.define-dialect.d.ts` baseline (non-vacuousness) | edge-case | S | ✅ FIXED (100b623) |
| Fix stale comment at `src/core/dialect-handle.ts:194` (runModify → runReplaceContent) | edge-case | XS | ✅ FIXED (100b623) |
| Flaky `test/e2e/installed-consumer.e2e.test.ts` tarball leg (~25% failure, pre-existing, masks archive signals) | edge-case | M | 🔲 PENDING (pre-existing, out-of-scope) |
| `replaceContent("")` empty-content boundary untested (pre-existing compliance gap) | edge-case | S | 🔲 PENDING (pre-existing) |
| `defineDialect` own-ops bypass the reserved-name guard that `withOps` enforces (latent, in-trust model) | refactor | M | 🔲 PENDING (add symmetric guard or doc caveat before dialect publishing) |
| `openspec/sensitive-areas.md` spelling refresh: `.raw()` escape-hatch documentation (one-line) | docs | XS | 🔲 PENDING |

---

## Final State

- **Spec status**: 7 domains, all V4 signed, synced to main `openspec/specs/`
- **Main specs updated for**: foundations-skeleton, dialect-generics, modify-coalescing, typescript-dialect, dialect-conformance, dialect-authoring-standards, authoring-error-contract
- **Lessons in project memory**: 3 entries (plan-enumeration, rename-RED scaffold, fitness-sweep non-vacuity)
- **ADRs in project memory**: 1 promotion (ADR-0050), 2 amendments noted (ADR-0039, ADR-0012)
- **Pending changes in project memory**: 6 registered (2 fixed at close, 4 pre-existing deferred)
- **Architecture impact**: modifying (Handle frozen-type unfreeze, conformance chain-step published contract change)
- **Verify final verdict**: pass-with-followups (all 23 active REQs covered, suite 1259 pass / 0 fail, twice green)
- **Judgment-day verdict**: APPROVED (round 1 suggestion applied)

---

## Archive Integrity

✅ Change folder moved: `openspec/changes/archive/2026-07-14-author-write-surface/` (verified via git mv)
✅ Spec sync complete: 7 domains copied to main
✅ Lessons extracted and persisted
✅ ADRs promoted and amendments noted
✅ Pending changes registered
✅ Archive report written and sealed
