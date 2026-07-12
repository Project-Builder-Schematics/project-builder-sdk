# Plan Verify Result

**Change**: stage-5b-dialect-breadth
**Iteration**: 2/3
**Mode**: plan
**Write mode**: n/a (spec_source internal) — ticket bodies not composed

---

## Verdict: gaps

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | scope | (Judge A) Row-141 kept-half has TWO components; `Session.isPending()` has an S-000 task but "batch-grouping annotation-or-assert" appears in NO slice's task list — in-scope debt with no visible build schedule. | sdd-slice (surgical: assign it a task in the slice whose files own it, per design's File Changes) |
| 2 | question-product | (Judge B) S-003 cut tripwire is not an observable stop-condition ("trending toward the XL estimate"). Executor needs the numeric criterion + watcher. | sdd-slice (quantify from the triage criteria band: L lines-estimate ~600-1200; pin threshold + who surfaces vs who invokes) |
| 3 | question-technical | (Judge B) Tension: `deep-equal.ts` "kit-internal, no barrel/subpath" vs an ADDITIVE FIT-14 `dist/core/deep-equal.*` tarball row. Is FIT-14 a shipped-file manifest or a public-export-surface baseline? | sdd-slice (VERIFY against the real FIT-14 test, then pin the correct statement — do not guess) |
| 4 | question-technical | (Judge B) S-005 leaf-rule wording ambiguous: new import-graph scanner inside `src/conformance/` vs documentation + the pre-existing FIT-01 walk. Design decided documented-limit + FIT-01; the slice's acceptance criterion reads like a runtime kit check. | sdd-slice (align the acceptance criterion with the design decision: NO new scanner in the kit) |
| 5 | question-technical | (Judge B) FIT-04/FIT-14 baseline production procedure unstated (generator script vs hand-authored byte-checked). | sdd-slice (VERIFY against package.json scripts + the FIT-04/FIT-14 tests; state the exact regeneration procedure) |

Routing: plan-gaps
Orchestrator action: all five → one surgical sdd-slice revision (items 3 and 5 verified against the repo, not drafted). Re-verify with fresh blind judges as iteration 3 (FINAL — a further `gaps` verdict halts `plan-verify-failed` to the human). Iteration 2 of 3 used.

Judge A otherwise: problem-fit clean, out_of_scope actively enforced (rows 144/141-split/prune/README/engine all verified absent). Judge B otherwise: "unusually complete build-order document" — slice boundaries, two-commit protocol, error templates, coverage all self-contained or correctly deferred.
