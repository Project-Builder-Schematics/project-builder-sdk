# Plan Verify Result

**Change**: inline-collection-marker
**Iteration**: 1/3
**Mode**: plan
**Write mode**: n/a — ticket bodies not composed (spec_source: internal)

---

## Verdict: gaps

Two blind judges (opus, parallel, anti-anchored). Judge A: problem-fit CONFIRMED (plan solves the stated problem at mechanism level; no out_of_scope violations). Findings/questions below.

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | scope | REQ-SCM-01.1/SCM-02.1/GCC-08.1 verified ONLY by fit-26 edits assigned to archive-sync (excluded work) — yet S-004 claims Covers; GCC-08.1 in no Covers line | sdd-slice (re-ledger: in-change check scoped to change folder, or explicit exclusion + Covers removal) |
| 2 | scope | folder-scaffold Purpose amendment + by-reference-copy-wire Seam Obligations update: neither sliced nor in the exclusion ledger | sdd-slice (add exclusion entries or tasks) |
| 3 | scope | REQ-BRC-02/.1 and REQ-FSC-09/.1/.2 in no Covers line (tests exist in design §7; S-003.1 touches the files) | sdd-slice (Covers lines) |
| 4 | scope | S-002.5 cites REQ-AEC-11.3 — does not exist post-V3 split (11.1/11.2 only) | sdd-slice (fix citation) |
| 5 | scope | fit-43 clause (f) (zero-realpath scan) is a shipped hard gate with no signed REQ behind it | sdd-spec (owner micro-unfreeze: add clause to REQ-FTG-06) — pending owner |
| 6 | problem-fit (low) | Temp-dir ↔ real inline-project equivalence asserted, not observed (runner.ts packageDir derivation unpinned) | sdd-slice (note; optionally pin runner derivation in a preservation test) |
| 7-16 | question-technical | Judge B Q1-Q10: per-task spec citations missing; S-003.7 wrong path (copyin-parity lives in test/conformance/); S-006.3 sweep contradicts S-005.7 dated notes (needs exact allowlist); ADR-0045 supersession/sweep status; S-000 coverage-continuity vs design §9 step 3 (no-echo subset must land inside S-000); S-002.3 contradicts design §J (kit-internal baseline set, NOT FIT-04 public list); marker-fixture survival rule (10 on disk, 1 deleted — clause (d) allowlist must name survivors); S-000.8 reorder-check mechanism; corpus regen file-layout procedure (regen owns filenames vs git mv); REQ-RBV-06.1 pointer-closure definition | sdd-slice (all resolvable from design/spec; slice artefact must carry the answers) |
| 17 | question-product | SECURITY.md content: publish the full trust posture (no SDK containment guarantee; engine owns path-directives; by-value uncovered; symlink residual; Windows forms unscreened)? | Human |
| 18 | question-product | Union 12→11: lockstep engine/corpus update before merge, or drift window with Addendum 3 as notification? | Human |

Routing: plan-gaps
Orchestrator action: product questions → owner; clause (f) → owner unfreeze decision; technical gaps → sdd-slice amendment (design refs in hand); then re-verify (iteration 2 of 3).
