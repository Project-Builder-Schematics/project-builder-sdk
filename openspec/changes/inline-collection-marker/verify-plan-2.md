# Plan Verify Result

**Change**: inline-collection-marker
**Iteration**: 2/3
**Mode**: plan
**Write mode**: n/a — ticket bodies not composed (spec_source: internal)

---

## Verdict: gaps

Fresh blind judges (opus ×2, parallel). Problem-fit: CLEAN in both (Judge A: "no findings" on problem-fit; equivalence holds by construction since the mechanism is deleted, not gated). Remaining gaps below.

| # | Category | Description | Suggested route |
|---|---|---|---|
| F1 | scope (high) | PRC retirement's rg→zero acceptance criterion unsatisfiable: 4 uncovered main-spec citations (by-reference-copy-wire:174 REQ-BRC-08.2 cite of REQ-PRC-06; :179 engine-gated list PRC-06 mention; scenario-matrix:174 sensitive-areas cite; run-boundary-input-validation:10 version-note) — no delta cleans them | sdd-spec (V3.2: extend deltas or allowlist historical notes in the criterion) — owner unfreeze |
| F2 | scope | fit-43 clause letters (d)/(e) cited by slices but unlabeled/nonexistent in signed REQ-FTG-06 | sdd-spec (label clauses in V3.2) |
| F3 | scope | No task marks ADR-0046/0067 superseded (only allowlist entries presume it) | sdd-slice (S-005.5 adds dated Superseded-by-0077 headers) |
| F4 | scope | SECURITY.md/CHANGELOG deliverables have slice tasks but no REQ — verify-final has nothing to judge them against | sdd-spec (V3.2: give docs deliverables a normative home) |
| F5 | scope (low) | conformance-fixtures REQ-CFX-16:581 cites retiring REQ-CCR-08 note — no delta, no exclusion entry | sdd-spec (minimal delta or exclusion note) |
| F6 | scope (low) | Directory-message variant "exceeds scope" — REBUTTED: pre-authorized by owner ruling 6 (template wording upgrades). No change; justification recorded here. | none (closed) |
| Q1 | question-technical | Message architecture contradiction: REQ-AEC-11 variants/categories vs design §4 "messageFor derives, fixed path-only template" — variant selection mechanism undefined | sdd-design (pin mechanism: caller-supplied message via sourceRejection detail param) |
| Q2 | question-technical | runCopyIn exact statement order + which template wins when BOTH from and to escape | sdd-design (pin order + winner) |
| Q3 | question-technical | FSC-10.4 message texts: rootReadFailure's texts are root-specific; spec demands offending-entry package-relative naming | sdd-design (entry-specific texts + path computation) |
| Q4 | question-technical | copyIn "byte-exact commit" assertion not constructible (fakes never materialize copyIn bytes) | sdd-spec (V3.2: pin copyIn leg = emitted-directive shape assertion) |
| Q5 | question-technical | PSH-02.3 NUL per-verb: scaffold case not constructible via walk — sanction the classifyTransport-boundary carve-out | sdd-spec (V3.2 note, mirroring PSH-01.3's sanctioned pattern) |
| Q6 | question-technical | Corpus regen leaves FIVE stale transcripts (not one); new slug for renumbered M-17 unnamed; fit-28 doesn't gate strays | sdd-slice (procedure fix + slug + explicit stray check) |
| Q7 | question-technical | Coverage-manifest renumbering scope (shifted M-rows + new citation rows) — apply vs archive | sdd-slice (S-004.7 expanded: apply-time, full renumber) |
| Q8 | question-technical | Kit-internal baseline is removal-only → vacuous for the forbidden additive regrowth; runtime Object.keys pin task unassigned | sdd-design (positive content pin) + sdd-slice (assign run-boundary-validation.test.ts task) |
| Q9 | question-technical | S-006.3 sweep scope vs allowlist inconsistent; exact literals to sweep undefined | sdd-slice (repo-wide-minus-allowlist; two literals: the error string + source-outside-package; bare collection.json NOT swept) |
| Q10 | question-product | Version bump / release vehicle for the MAJOR narrowing (package.json 0.1.0 vs CHANGELOG preamble 0.0.0; dev-tag publishes only) | Human |

Routing: plan-gaps
Orchestrator action: Q10 + F1/F4 unfreeze → owner; spec fixes → sdd-spec V3.2; design fixes → sdd-design V2.1; slice fixes → sdd-slice V3; then iteration 3 of 3 (final).
