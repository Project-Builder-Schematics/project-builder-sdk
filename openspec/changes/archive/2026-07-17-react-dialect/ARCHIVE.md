# Archive Report: react-dialect

**Archived at**: 2026-07-17T00:00:00Z  
**Verify verdict**: pass-with-followups (iteration 4)  
**Spec versions archived**: V8 (`specs/react-dialect/spec.md`, owner-signed 2026-07-17) + V2 (`specs/local-consumption/spec.md`, owner-signed 2026-07-16)

## Summary

The React (TSX/JSX) dialect closes a gap for schematic authors who need to mutate `.tsx`/JSX files — a capability the shipped TypeScript dialect covers for `.ts` only. The change ships a new dialect leaf (`src/dialects/react/`) with two v1 operations (`setJsxProp`, `addImport`), an extensible `.modify(fn)` escape hatch, a load-bearing validator subsystem with security-hardened injection boundaries, and comprehensive documentation. The specification evolved through four verification iterations and three blind adversarial-gate rounds, culminating in a correct `addImport` that adopts the existing ADR-0039 collision model verbatim (discovered only after iteration 1 missed four real defects that Council personas surfaced independently). The change represents the second consumer of the dialect infrastructure contract, proven to carry correctly across multiple AST realms with additive architecture impact. Verify verdict is correctly `pass-with-followups` — upgrading to `pass` would silently drop 18 tracked followups into oblivion.

## Specs Synced

| Domain | Action | Version | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|---|
| `react-dialect` | Created | V8 | 15 (RXD-01..15) | 0 | 0 |
| `local-consumption` | Modified | V2 | 0 | 3 (LC-01, LC-02.3, LC-03) | 0 |

**Delta validation**: The `local-consumption` MODIFIED block includes all three REQs with complete scenarios; no scenarios were removed. The change is purely additive (five → six subpaths) and non-destructive.

## Archive Location

Folder moved: `openspec/changes/react-dialect/` → `openspec/changes/archive/2026-07-17-react-dialect/`

All archived artefacts remain accessible under the new path:
- `triage.md` (L classification, sensitivity override)
- `explore.md` (deep research, AST decision, spike gate setup)
- `proposal.md` (op pair rationale, council-ratified)
- `specs/react-dialect/spec.md` (V8, owner-signed)
- `specs/local-consumption/spec.md` (V2, owner-signed)
- `design.md` (revision 2, ADRs 01-05, spike evidence)
- `north-star.md` (steward foresight, CQ-1/2/3 owner-affirmed)
- `slices.md` (S-000..S-005 contracts)
- `apply-progress.md` (six slices executed, fix iterations documented)
- `verify-in-loop-1.md` through `verify-in-loop-6.md` (iteration history)
- `verify-report.md` (final verdict `pass-with-followups`, iteration 4)
- `council-findings.md` (blind adversarial gate record, four real bugs discovered)
- `outcome-verdict.md` (steward reckoning, `aligned` + owner affirmation)

## Lessons Learned Persisted

**Four load-bearing lessons, registered to `project/lessons-learned`:**

1. **Adopt existing models instead of deriving them empirically** (pattern)
   - **What**: ADR-0039's `assertNoCollision` value-namespace predicate existed and was ratified; three verification rounds kept surfacing the identical defect class on new axes (type-only, cross-module, aliased, value-namespace). V8 adopts it verbatim rather than inventing a new technique.
   - **Why**: Gate-by-gate rediscovery wastes cycles and leaves residual exposure. When the final answer is "existing model + cross-discipline verification," that IS the model to adopt first.
   - **Where**: `addImport` collision validation; applicable to any dialect accepting foreign identifiers.
   - **Learned**: For future dialects, scan `openspec/decisions/` and `project/architectural-decisions` BEFORE the design phase; adoption candidates beat invention every time in sensitive areas.
   - **Source**: change `react-dialect` (2026-07-17), iteration history in verify-report.md

2. **Mutation-probe RED substitute needs at least one near-miss mutant, not only absence mutants** (discovery)
   - **What**: The `addImport` validator reached three gates with an assertion that was STRONGER than the validation it claimed to test. `toContain("name")` matched both the correct validator's message (containing `` `name` `` verbatim) AND a wrong validator's message (containing the substring `"name"` inside `"propName"`). Absence mutants (validator unwired) never exposed this; the near-miss mutant (wrong validator wired) did.
   - **Why**: Self-selected exams leave gaps. A substring-weak assertion is exactly the failure mode an absence mutant cannot catch — the code IS running, just under the wrong conditions.
   - **Where**: `test/dialects/react/name-validation.test.ts`, REQ-RXD-06 hostile battery verification.
   - **Learned**: When using mutation-probe RED substitutes (because true RED requires breaking working code), include at least one near-miss mutant that keeps the code structurally correct but semantically wrong. The near-miss is what catches assertion bugs.
   - **Source**: change `react-dialect` (2026-07-17), apply-progress.md fix-pass note + council-findings.md QA-5

3. **Blind fan-out catches what single verifiers miss** (discovery)
   - **What**: Iteration 1's verify-final pass gated on ONE item and would have shipped the change. Four independent Council personas (architect, qa-engineer, security-engineer, tech-writer) running in BLIND parallel found FOUR REAL CORRECTNESS BUGS that all singletons missed, each bug confirmed against node's real ESM parser.
   - **Why**: A single person's attention is limited; anchoring to one finding (even a real one) crowds out the systematic search. Blind fan-out is adversarial — each persona searches independently without knowing what others found, and the union of findings is stronger.
   - **Where**: `addImport` correctness across input varieties (type-only, default, namespace, aliased, value-namespace).
   - **Learned**: For L-classified changes + sensitive areas, treat the Council/judgment-day finding as the *minimum* expected surface coverage, not a confirmation pass. A single verifier passing is not sufficient; the blind gate is where the real audit happens.
   - **Source**: change `react-dialect` (2026-07-17), verify-report.md iteration history + council-findings.md

4. **The `pass-with-followups` token is load-bearing; upgrading to `pass` silently drops tracked debt** (pattern)
   - **What**: The final verify verdict is `pass-with-followups`, NOT `pass`, because 18 followups (F-2..F-8, suggestions, technical debt) must be registered into `project/pending-changes` at archive Step 9. The sdd-archive skill's Step 9 runs ONLY when verdict is `pass-with-followups` and explicitly SKIPS when verdict is `pass`. An orchestrator error ("archive requires `pass`") was caught by the verifier, who cited the skill file and refused the premise.
   - **Why**: The semantic of the two tokens is opposite the intuition: `pass` = clean, no followups to register; `pass-with-followups` = archive-ready WITH known tracked debt. Upgrading in haste loses the debt ledger.
   - **Where**: `sdd-archive/SKILL.md`, line 44 (verdict acceptance) and Step 9 (registration gate).
   - **Learned**: The verify token is a CONTROL SIGNAL that drives downstream registration logic, not a synonym for "pass vs fail". Never "upgrade" a `pass-with-followups` to `pass` without verifying that all intended followups are already registered elsewhere (they are not — Step 9 is the ONLY home for them).
   - **Source**: change `react-dialect` (2026-07-17), verify-report.md line 28-29, state.yaml orchestrator-error note

## ADRs

### Recommended for Project-Level Promotion

**ADR-01: Fidelity glue — DUPLICATE in dialect leaves, not hoisted to core**
- **Reason**: Establishes a **cross-dialect convention** for future dialect additions (reactive, TypeScript, and beyond). The ruling protects a boundary (core/commons AST-free) while remaining practical for small shared code (BOM handling, newline detection, ManipulationSettings). Guards FIT-37/FIT-38 ensure the boundary holds as the codebase grows.
- **Promotion to**: `project/architectural-decisions` as ADR-0046 (next available ID per audit)

**ADR-02: Name validation — core-resident chokepoint + no-echo helpers**
- **Reason**: Introduces a **reusable pattern** (`validatedOp` + `reject-tail`) for structurally load-bearing validation in sensitive areas. The pattern is dialect-agnostic and is the **single chokepoint** that collapses two security requirements (injection boundary + zero-echo hygiene) into one point of truth. Future dialects will use this pattern.
- **Promotion to**: `project/architectural-decisions` as ADR-0047 (next available ID)

### Remaining in Change Archive Only

- **ADR-03**: `setJsxProp` structured API (no text splice) — specific to JSX mutation, not a cross-cutting architectural pattern.
- **ADR-04**: Exports-guard minimal edit — mechanical, not a design decision for future work.
- **ADR-05**: React `addImport` shape-aware merge — operation-specific; the **cross-dialect** lesson is captured in ADR-01 + ADR-02.

## Followups Registered in project/pending-changes

Consolidated and complete per verify-report.md §9 (18 items total):

**CLOSED (explicitly NOT re-registered per briefing):**
- REQ-RXD-11.5 wording amendment (closed at V5)
- F-1 eval/arguments denylist (closed at V6)

**REGISTERED:**
| # | Description | Type | Size | Register as | Notes |
|---|---|---|---|---|---|
| F-2 | Relabel `ops.test.ts` scenario, cite REQ-IDs by ID — traceability nit | docs | XS | pending-changes | Non-gating |
| F-3 | Non-building commits, squash-on-merge | process | XS | pending-changes | Non-gating |
| F-4 | Add docs files to design.md §4.2, bump Revision + Spec header V4→V8 | docs | XS | pending-changes | Widened this iteration |
| F-5 | Reword design.md:138 "by construction" clause | docs | XS | pending-changes | Non-gating |
| F-6 | Spec V5 changelog accuracy | docs | XS | pending-changes | Suggestion |
| F-7 | ADR-02 Status Proposed → Accepted | docs | XS | pending-changes | Suggestion |
| F-8 | Message terminology (eval/arguments) — spec-conformant | docs | XS | pending-changes | Nit |
| Round-3 sugg (1) | Set-key-safety static scan heuristics (greedy `//`-strip) | test-coverage | XS | pending-changes | Suggestion, unconfirmed |
| Round-3 sugg (2) | Self-alias `import { X as X }` false-positive collision reject | edge-case | XS | pending-changes | Suggestion, spec-conformant |
| Element-grammar gap | `$`, JSX namespace (`svg:rect`), non-ASCII component names | feature | S | pending-changes | React op-catalog follow-up scope |
| `getAttribute` first-match | Semantics note (first-match behavior for duplicate attributes) | docs | XS | pending-changes | Op-catalog follow-up |
| **TS-dialect `addImport` SHARPENED debt** | **DISTINCT from item 22** — can EMIT INVALID BINDINGS (merge-defect family, not injection-validation) | refactor | M | pending-changes | **Own separate row** — out of this change's triage scope, but load-bearing cross-dialect issue |
| TS-dialect JSDoc backfill | `addFunction`/`addVariable`/`addClass` trust-boundary notes | docs | XS | pending-changes | Distinct from item 22's validator retrofit |
| Default/mixed-import support | React `addImport` is named-only; default/mixed deferred | feature | S | pending-changes | React op-catalog follow-up scope |
| **.tsx/.jsx fold-or-reaffirm** | **ALREADY registered at row 442** — fold or reaffirm, NEVER duplicate | feature | M | **REAFFIRMED in place** | Owner requested mid-plan; spec Notes cross-reference it |
| DOC-3 | `could not parse "X" as TypeScript` hardcoded in dialect-generic path | refactor | S | pending-changes | Engine scope, pending-change per spec |
| ARCH-2 | `src/core/jsx-name-validator.ts` placement — peer-module split at dialect #3 | refactor | S | pending-changes | Archive commitment, ADR-01 extension |
| Subprocess-timeout debt | Pre-existing, no explicit timeout for bun-bound tests | test-infra | S | pending-changes | Environmental, not code defect |

**Key registration rules applied:**
- (a) `.tsx/.jsx` row at line 442 **REAFFIRMED** — the specification Notes cross-reference it verbatim; no duplication
- (b) TS-dialect `addImport` SHARPENED debt gets **OWN row**, distinct from injection-validation item 22 — one must not eclipse the other
- (c) F-1 and REQ-RXD-11.5 NOT registered — explicitly CLOSED at V5/V6
- (d) All 18 items from verify-report §9 consolidated here

## Final State

- **Spec status**: signed (V8 + V2, owner-affirmed)
- **Main specs updated**: `openspec/specs/react-dialect/spec.md` (new), `openspec/specs/local-consumption/spec.md` (modified)
- **Change folder moved**: `openspec/changes/archive/2026-07-17-react-dialect/` (verified)
- **Lessons in project memory**: 4 registered to `project/lessons-learned`
- **ADRs in project memory**: 2 promoted to `project/architectural-decisions` (ADR-0046, ADR-0047)
- **Pending changes in project memory**: 18 registered/reaffirmed to `project/pending-changes`

## Post-Archive Commitments

**Owner-affirmed next phase**: `/plan` for the TypeScript-dialect `addImport` merge-defect fix (now that the claimed model exists and makes it cheap — it's the existing `assertNoCollision` adoption pattern, proven by this change).

**Parked**: react-dictionary DX idea (engram obs #2296).

---

**Verdict**: Archive complete. The change is closed, lessons are persisted, ADRs are promoted, followups are tracked. The React dialect is ready for consumption as `@pbuilder/sdk/react`.
