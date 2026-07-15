# Plan Verify Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Mode**: plan
**Write mode**: n/a — ticket bodies not composed (spec_source = internal)

---

## Verdict: gaps

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | problem-fit | Spec file is stamped `signed` but still carries the unresolved concurrent-draft note (header Concurrency note + Open Design Question #4): "orchestrator MUST determine which invocation's findings are authoritative". The reconciliation WAS performed (mandated V2 canonical, ghost draft discarded — engram obs #2175) but never recorded IN the spec file. A signed spec carrying a which-draft-is-authoritative flag contradicts the change's one-normative-text purpose. (Judge A) | sdd-spec — record the reconciliation verdict in the file, remove the open question |
| 2 | scope | in_scope item 6 (ledger updates: StdioEngineClient row supersession, Windows/macOS-pins row, cross-repo tether row) has slice coverage (S-005.4) but ZERO REQ coverage — no requirement or conformance assertion backs it; FEH-05's coverage map cannot see it. (Judge A) | sdd-spec — V3 surgical amendment: add a LED REQ family with falsifiable scenarios |
| 3 | scope (softer) | The normative wire-spec doc's required CONTENT (method names, error shapes, factory-pointer grammar, exit codes, bridge section) is mandated only by slice task S-005.1; only cap-naming is REQ-anchored to the doc (WPS-06/FEH-06). (Judge A) | sdd-spec — strengthen WPS-11 (or WPS-06) with a doc-section-presence check |
| 4 | question-technical (×20) | Judge B (simulated executor, slices-only surface): the slices artifact references every contract by pointer (40 REQ definitions, ADR contents, fitness-function homes, frame grammar, message shapes, error types, factory-pointer grammar, exit-code table, bridge signature, probe behavior, harness design, version constants) without an Executor Context section stating where each normative input lives. Verdict "not ready to execute" on the slices-alone surface. | sdd-slice — amend slices.md with an Executor Context section: normative-input pointers (spec.md FILE canonical, design.md ADRs/File-Changes/Test-Derivation, repo seam files), pinned version constants, harness contract pointer |
| 5 | question-technical (real gap) | Judge B #18: the pm ledger-reconciliation table (dispositions for L359/L360/L361/L350-355/L74/advance-notes/PC-PROTO-01 gloss/2 new rows) lives ONLY in engram/orchestrator transcript — no change artifact carries it; S-005.4 says "per pm table" pointing at nothing an executor can read. | sdd-slice — embed the full table verbatim in slices.md (S-005.4), with provenance |
| 6 | question-product (×3) | Judge B #21-23: wire contract frozen or being defined; what outcome is "done" measured against; ledger disposition intent. All three are ANSWERED by existing owner rulings on record (adjudication obs #2154/#2157: contract frozen, engine ratifies at PC-PROTO-01; north-star.md; propose-council table + owner continue at the propose checkpoint, L361 = verify-then-decide in-change). | sdd-slice — fold the three answers into the Executor Context (no new user decision required; provenance cited) |

Routing: plan-gaps
Orchestrator action: (a) sdd-spec V3 surgical amendment (unfreeze — gaps #1-#3), owner re-signs the delta; (b) sdd-slice amendment (gaps #4-#6). Then re-run both judges (iteration 2 of 3).
