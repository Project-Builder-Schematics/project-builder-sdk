# Proposal: Extensible E2E Harness + Modify Operator Coverage (modify-e2e-extensible)

**Triage**: L | **Persona lens**: none (architect/qa/security angles folded in)

## Intent

The SDK has one scaffolding e2e (`scaffold.e2e.test.ts`, create/copyIn only) and one dialect-leaf modify e2e (`dialect-modify.e2e.test.ts`, TypeScript only). Adding e2e coverage for a new operator or dialect today is an ad-hoc, L-sized effort because the golden-committed-tree idiom that proves a dialect leaf reaches committed bytes exists only as a hand-written one-off with no reusable seam and no enforcement. The hard requirement is that adding coverage for a future operator×dialect must be an XS/S increment. React-dialect modify has zero e2e coverage at all — a real gap, since `.modify(fn)` lives in dialect-agnostic core (`src/core/dialect-handle.ts`) and is only proven against TypeScript.

## Scope

### In Scope
- A named, two-tier extensible e2e seam generalizing the golden-committed-tree idiom (Tier A: data-driven coverage table; Tier B: bespoke behavioral flows).
- React-dialect modify coverage landing as pure Tier-A additions — the extensibility acceptance proof.
- A fit-42 coverage-fitness guard enforcing the operator×dialect Tier-A matrix, fail-closed on a declared-but-missing cell.
- QA gap fixes on the existing TS modify e2e (Tier B hardening).

### Out of Scope
- Wire-level parity / conformance corpus: no edits to `conformance/`, `test/support/conformance-validators.ts`, or `fit-40` (wire `modify` already covered, dialect-agnostic).
- Full structured-op parity: non-`.modify(fn)` operator×dialect cells are enumerated as honest gaps + followups, not implemented.
- Any production diff: `src/dialects/**` and `src/core/**` stay byte-untouched.
- e2e for rename/replaceContent/delete (future XS/S increments on this base).
- Sensitive-areas registry sync (already corrected separately, commit 3837c37).

## Capabilities (contract with sdd-spec)

### New Capabilities
- `dialect-e2e-coverage-seam`: two-tier golden-committed-tree seam; Tier A coverage table + iterating e2e; Tier A/B boundary.
- `dialect-coverage-fitness`: fit-42 guard; enumerates dialect×op cells, fails closed on missing Tier-A cell.
- `react-dialect-modify-e2e`: React `.modify(fn)` coverage as pure Tier-A rows (.tsx seeds + goldens).
- `dialect-modify-e2e-robustness`: QA hardening of the existing TS modify Tier-B flows.

### Modified Capabilities
- None (no existing spec capability governs these test files; wire-level `conformance/` specs are untouched).

## Approach

Adopt the architect's two-tier seam (explore Approach 1). Tier A is a static, declarative coverage table (`{dialect, op, seedPath, seedGolden, expectedGolden, factory}`) driven by one iterating e2e asserting `committedTree()` vs a golden Map; adding a cell = one row + two byte files. Tier B keeps the bespoke behavioral flows (coalescing, order-invariance, mid-chain split, forgotten-await, contained throw) hand-written — the XS/S extensibility claim binds to Tier A only. Walking skeleton: table + fit-42 + retrofit TS rows; React modify then lands as pure Tier-A rows, proving the claim. Goldens are produced through a single scripted regen path (mirroring `scripts/regen-corpus.ts`), never hand-maintained. **Security (hard):** the Tier-A `factory` field is an in-repo, maintainer-authored function reference — the harness NEVER dynamically imports or executes contributor-supplied modules; the file class that becomes the "unit of addition" sits behind an import allow-list guard (REQ-CFX-01 equivalent); harness confined to `test/support/**` + `test/e2e/**` + `test/fitness/**` (nothing enters `package.json#exports`, `src/conformance/index.ts`, or `src/testing/**`; FIT-08 ban stands). A dialect-leaf bug surfaced while authoring goldens = HALT + new change, never an in-place src edit.

**ADRs for sdd-design to formalise:** (1) dialect-leaf e2e seam = golden-committed-tree via ContractFake, two-tier; (2) fit-42 coverage-completeness fitness (net-new; fit-41 is parity, not completeness → DEVIATES from baseline); (3) layer boundary — conformance corpus owns wire-directive shape, golden-committed-tree owns dialect-leaf→committed-bytes.

**Technical questions handed to spec/design:** async `.modify` callback semantics (verify in `src/core/dialect-handle.ts`); `replaceContent` cell counting in the matrix (avoid double-count vs the wire layer); `.tsx` seed constraint + golden newline/BOM for ALL React rows; whether the coalescing op-count assertion routes through `test/support/ir-transcript.ts` (present — viability confirmed by design); explicit Tier A/B boundary so fit-42 does not flag bespoke Tier-B flows as missing.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `test/support/` (new seam module) | New | Tier-A coverage table + iterating harness + allow-list guard |
| `test/e2e/dialect-modify.e2e.test.ts` | Modified | retrofit under seam; add QA robustness cases; behavior unchanged |
| `test/e2e/` React modify e2e (name TBD) | New | React `.modify(fn)` Tier-A rows |
| `src/dialects/react/golden/*` (or test-owned goldens dir) | New | .tsx seed + expected goldens, script-generated |
| `test/fitness/fit-42-*.test.ts` | New | coverage-completeness guard (number reserved, re-verify at slice) |
| `test/support/golden.ts`, `ir-transcript.ts` | Read-only/reuse | already accept dir override / transcript introspection |
| `conformance/**`, `test/support/conformance-validators.ts`, `fit-40` | Read-only | out of scope — wire layer untouched |
| `src/dialects/**`, `src/core/**`, `src/conformance/**`, `src/testing/**` | Read-only | byte-untouched (production + public API frozen) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Merge-order collision with in-flight `copy-copyin-conformance-fixtures` (held on `m2-copyin-banked-arm`) | Low | Staying out of `conformance/` keeps it LOW; recommend landing copy-copyin first or branching from its tip — branching from main forces a 3-way merge on corpus.json/fit-40 |
| fit-42 number taken before landing (lesson #2086) | Medium | Ceiling is fit-41 today; re-verify the number across all branches immediately before slice/apply |
| Golden churn / hand-maintained bytes drift | Medium | Single scripted regen path (mirror `scripts/regen-corpus.ts`); no hand-authored goldens |
| Scope creep to full structured-op parity blows the 5-7 slice target | Medium | Spec pins non-`.modify` cells as honest gaps + followups, not implementation |
| React's 2 ops can't reproduce all four TS behavioral flows | Low | Tier-A binds only to `.modify(fn)`; Tier-B flows authored per dialect's real capability |
| Dialect-leaf bug surfaces during golden authoring | Low | HALT → new change; never edit byte-sealed `src/dialects/**` |

## Rollback Plan

This change is purely additive test infrastructure confined to `test/**`; no production code, public API, migrations, or persisted data are touched. Rollback is per-artefact and clean:
1. Revert the fit-42 guard file — removes the new enforcement; no other test depends on it.
2. Revert the React modify e2e file + its generated goldens directory.
3. Revert the seam module in `test/support/` and un-retrofit `dialect-modify.e2e.test.ts` back to its committed pre-change form (recover from git — the file is not deleted, only re-wrapped), discarding the QA robustness cases.
4. Validate: `bun test` is green on the reverted tree (matching the pre-change baseline), `git diff` against the merge-base shows an empty diff for `src/**` and `conformance/**`, and no `fit-42` file remains.
No forward-compatible remnants need to stay; no data is unrecoverable (test-only change).

## Dependencies

- None hard. Recommended (not blocking): land `copy-copyin-conformance-fixtures` before this, or branch this from its tip, to avoid a 3-way merge — this worktree branches from `origin/main` and stays out of `conformance/`, so no live file collision exists today.

## Success Criteria

- [ ] React-dialect `.modify(fn)` e2e lands as Tier-A rows only — zero new Tier-B/bespoke code for React (the extensibility proof).
- [ ] fit-42 fails closed when a declared dialect×op Tier-A cell has no matching golden row (proven by a deliberate-deletion negative test).
- [ ] Universal `.modify(fn)` cells present and green for BOTH TypeScript and React.
- [ ] Every non-`.modify` operator×dialect cell is enumerated as an explicit honest gap (REQ-CFX-11 style) with a tracked followup — zero silent gaps.
- [ ] Five QA fixes landed on the TS modify e2e: coalescing IR-op-count assertion, multi-file build isolation, awaited partial-mutation-throw atomicity, no-op modify, deterministic rejection capture (no `setTimeout`).
  > **Superseded by spec V1 (PM council ruling), carried into V2**: narrowed to 3 in-scope (coalescing IR-op-count assertion, awaited partial-mutation-throw atomicity, deterministic rejection capture scoped to the four canonical flows only) + 2 dropped to followup (multi-file build isolation, no-op modify) — see `dialect-modify-e2e-robustness` spec REQ-DMR-01..03 and its Followups table.
- [ ] `git diff` for `src/dialects/**` and `src/core/**` is empty (byte-untouched).
- [ ] All goldens are produced by a single scripted regen path — zero hand-authored golden bytes.
- [ ] Full `bun test` suite green.
