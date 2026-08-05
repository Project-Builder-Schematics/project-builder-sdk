# Plan Verify Result

**Change**: runner-tripwire-invariants
**Iteration**: 1/3
**Mode**: plan
**Write mode**: sync (internal) — ticket bodies not composed

---

### Verdict: gaps

Judge A (problem/scope fit): 7 findings. Judge B (simulated executor): 9 questions (6 technical, 3 product). Synthesis below; full judge outputs in the session transcript, condensed faithfully here.

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | scope | in_scope item 3 (debt-register re-audit) has zero REQ + zero slice coverage — spec Open Item 3 declines it, slices ledger defers it; one of three deliverables exits the plan with no acceptance criterion or owner | triage/slices amendment: name the archive gate as the delivery vehicle WITH an acceptance criterion |
| 2 | scope | R1-7, R1-9, R1-12, R1-18 absent from all three plan artefacts (triage's own warned hazard); R1-7 (Tier-1 live escape) nowhere dispositioned | slices excluded-ledger gains the full disposition mapping |
| 3 | scope | publish-pipeline-hardening family + S-000 fall outside the triage in_scope bullets; REQ-PPI-02 touches a surface out_of_scope names | triage dated amendment recording owner rulings 2/5/6 (scope authority already exists; artefact lags) |
| 4 | scope | REQ-RMD-01.2/05.1 modify manifest machinery declared out-of-scope bullet 5 | same triage amendment: ruling 7 (spec-honesty bundle) recorded |
| 5 | problem-fit | Totality is defined against an unpinned surface — `SurfaceNodeKind` union + E1-E4 exclusions have no exact-set pin or widening red-proof; narrowing the surface keeps totality trivially true (the tail migrates to the enumerator) | spec micro-amendment: pin union + exclusions symmetric with CAP-04.4/.5 |
| 6 | problem-fit | REQ-PTH-01 keeps a spelling enumeration with no totality clause — an unrecognised output flag yields silence, not unclassifiable-construct | spec micro-amendment: default-deny over unparsed script tokens OR an explicit honest scope-limit scenario |
| 7 | scope | R1-16's E1 exclusion ships with no governing scenario (S-001.4 cites CAP-01.2 which asserts something else; spec Open Item 5's recommended scenario never written) | spec micro-amendment: the Open-Item-5 scenario |
| 8 | question-technical | Red-proof registry enumeration (the 18-set, red-proof #12) uncited from slices; identifier namespaces (R1-x/M1.x/D-x/E1-E4/TD/DR) resolvability from the executor surface unclear; node:vm fold undefined in S-001.4; checker files' closure/byte-neutrality interaction unstated; toContain-scan ordering vs parallel batch; fit-46 suite placement/latency budget | slices amendment: citations + glossary pointer to design/council artefacts (all in the change folder — make the pointers explicit) |
| 9 | question-product | (a) byte-neutrality divergence: correctness oracle vs change-control gate — who ratifies; (b) admitted-table/exclusion growth protocol vs pinned counts — allowed-with-justification requires spec unfreeze?; (c) delivery shape: S-000 as standalone merged PR first vs one branch/one PR | Owner (asked 2026-07-29) |

Routing: plan-gaps
Orchestrator action: owner answers the product questions → ONE batched amendment round (triage dated scope amendment; spec micro-amendments #5/#6/#7; slices citation/glossary/disposition fixes #1/#2/#8 + product answers baked in) → re-verify with fresh judges. Iteration 1 of 3 used.
