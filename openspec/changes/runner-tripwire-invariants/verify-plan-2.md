# Plan Verify Result

**Change**: runner-tripwire-invariants
**Iteration**: 2/3
**Mode**: plan
**Write mode**: sync (internal) — ticket bodies not composed

---

### Verdict: gaps

Judge A: 8 findings (A-H). Judge B: 4 questions (3 technical, 1 product). Trajectory: 16 → 12.
Judge B explicitly confirmed the iteration-1 fixes resolved cleanly (glossary, red-proof registry,
node:vm fold, toContain scope, fit-46 placement, DR-5 rule, byte-gate).

| # | Category | Description | Route |
|---|---|---|---|
| A | problem-fit | **Member admission over admitted globals is not a closed property** — `process.dlopen` classifies admitted (origin admitted, not a denied root, not in the 11-register); closing it would need a 12th spelling. Design already enumerates 28 admitted member paths — the spec never pinned member-path admission as exact-membership with red-proof | spec amendment (completes the ratified mechanism; design §admitted-tables is the source) |
| B | problem-fit | REQ-DGN-01 states a universal rule-identity property but is pinned by 2 instance scenarios only — no totality device makes a third mis-attributed rule fail loudly | spec amendment: rule-identity totality scenario (every fixture asserts its rule; produced-rule set == fixture-declared set) |
| G | problem-fit | REQ-PPI-03.2 depends on CAP-01..06 which S-000 (merged FIRST, "Requires: nothing") does not have; and no fit-46 re-run vs the new mechanism is scheduled | spec/slices: rescope PPI-03.2 to the mechanism live at S-000 time + explicit S-001 task re-running fit-46 against the new mechanism |
| B1 | question-technical | S-000 acceptance self-contradicts on `--ignore-scripts` (match unconditionally AND mismatch) | slices: fix to reading (a) — normal path matches; `--ignore-scripts` run is the red-proof that must mismatch (PPI-01's sensitivity proof); PPI-02's explicit workflow step is the second, independent guarantee |
| B3 | question-technical | Fixture arithmetic: 9 + 1 ≠ 11 pinned register members | slices: reconcile the fixture provisioning count against PRM-01.2's bijection (11 fixtures total) |
| B2 | question-technical | Batch-2 "parallelizable" but all three slices edit fit-42 files | slices: serialize the fit-42-touching message conversions into S-001 (single owner of that file) OR re-scope S-003/S-004 message work to their new fitness files only — state which |
| C | scope | Re-audit (in_scope 3) still lacks an executable criterion pre-archive; 19-row mapping lives outside the plan set | slices: import the full 23-row disposition mapping into the Excluded Ledger NOW (from propose-council §BA), archive re-verifies rather than creates |
| D | scope | FCG-01/S-004.1 rewrites generator write/error paths; Scope Amendment (b) reconciles only the RMD text fixes | triage amendment: bullet-5 reconciliation extended — the fail-closed boundary rewrite IS in_scope item 1 (R2-4 lives in that file); "machinery unchanged" applies to derivation/determinism logic, not the failure channel |
| E | scope | Ruling 3's four new denied primitives have no triage paper trail; loader-hook boundary vs out_of_scope bullet 3 unasserted | triage amendment: record ruling 3 (M2.9) in the Scope Amendment; one sentence distinguishing static denial (in) from loader observation (out, bullet 3) |
| F | scope | PPI-04 (react-conformance timeout) absent from triage file estimate; bullet-1 post-hoc reading acknowledged | triage amendment: file-estimate note; no further action (owner-ratified rulings 2/6) |
| H | scope | "Closes R2-6" vs M3.6 deferral (sibling of M3.1-M3.5) unreconciled | triage/spec note: R2-6 = the five confirmed spellings (M3.1-M3.5); M3.6 is a distinct surface (script indirection), owner-ruled OUT (ruling 3), registered — reconcile the wording where "closes R2-6" appears |
| B4 | question-product | Delivery mechanics: wait for S-000 merge? who opens the PR? branch base? | ORCHESTRATOR-RULED (operational, within the owner's ruled shape): the orchestrator opens the S-000 PR (house pattern, PR #57); the mechanism branch bases off S-000's branch IMMEDIATELY (no stall — S-001 does not depend on S-000's merge, only on its content); after S-000 merges, ONE rebase/merge of main into the mechanism branch; owner merges both PRs |

Routing: plan-gaps
Orchestrator action: one batched amendment round → iteration 3 (final) with fresh judges.
Iteration 2 of 3 used.
