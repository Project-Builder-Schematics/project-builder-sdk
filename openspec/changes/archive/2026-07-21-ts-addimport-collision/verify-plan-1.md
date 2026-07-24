# Plan Verify Result

**Change**: ts-addimport-collision
**Iteration**: 1/3
**Mode**: plan
**Write mode**: n/a (spec_source: internal) — ticket bodies not composed
**Judges**: A (problem/scope fit) + B (simulated executor), blind, parallel, opus — 2026-07-21

---

### Verdict: gaps

Judge A: problem-fit CLEAN (all three stated failure modes resolved by the 4-step algorithm); no out-of-scope overreach; ONE scope finding. Judge B: did NOT state "ready to execute" — 14 technical questions + 2 product questions.

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | scope | REQ-TSD-01 scenarios `.1`/`.3`/`.4` are signed spec scenarios claimed by NO slice's Covers set. Orchestrator fact-check: all three are ALREADY SATISFIED on current main — `.1` by `test/dialects/typescript/ops-exact-set.test.ts` (exists, `toEqual`); `.3`/`.4` by the already-migrated wording (`rg '\.raw\('` over `src/dialects/typescript/{ops,index}.ts` = zero hits; `fit-raw-sweep` + existing guards keep them green). The gap is DOCUMENTARY: the justification lived only in the slicer's envelope, not in slices.md. | sdd-slice amendment — add a "Pre-satisfied scenarios" section assigning `.1`/`.3`/`.4` as verify-only (confirm-stay-green) rows with this evidence, wired into S-000.6 |
| 2 | question-technical | Judge B's Q1/Q2/Q7/Q12 — requirement bodies, the 4-step algorithm definition, ADR-01/02/03 content, Class A/B meaning are referenced by ID only. All EXIST in the committed signed artifacts (`specs/typescript-dialect/spec.md`, `design.md`) — the plan hole is that slices.md never points the executor at them nor digests the load-bearing contract. | sdd-slice amendment — "Executor context" section: artifact paths + inline digest of the 4-step algorithm and behaviour-change classes |
| 3 | question-technical | Judge B's Q3–Q6/Q8/Q9/Q11 — source-material contracts (react/ops.ts helpers, assertNoCollision body, dialectError shapes + echo rules, assertValidImportBinding contract, coalescing controller/handle surface, insertImportDeclaration availability, printer determinism). All answered by existing code + design §4.3/§4.8 + spec REQ-TSD-13's two-shape ruling; slices.md must carry the pointer digest (file paths + one-line contracts), not re-derive them. | sdd-slice amendment — same "Executor context" section |
| 4 | question-technical | Judge B's Q10/Q13/Q14 — repo conventions: runner is `bun test`; goldens are committed fixture files under `test/dialects/typescript/golden/` (house pattern); fitness tests live in `test/fitness/fit-NN-*.test.ts`, FIT-41 confirmed next free (39/40 taken); both dialects import via workspace subpath entrypoints in-repo (installed parity via `installed-consumer.e2e.test.ts`). | sdd-slice amendment — "Repo conventions" digest lines |
| 5 | question-product | Judge B: is leaving `addFunction`/`addVariable`/`addClass` raw-spliced deliberate? ALREADY OWNER-SETTLED: signed spec REQ-TSD-13 (V3.1 sign-off) mandates the affirmative still-raw JSDoc characterization and tracks sibling closure in `project/pending-changes`; steward foresight recorded the same. No re-entry needed — slices amendment cites the ratification. | none (answered — cite in slices) |
| 6 | question-product | Judge B: is shebang-as-permanent-fail-closed acceptable this release? ALREADY OWNER-ANSWERED: spec `.33` pre-authorized fallback arm (signed) AND the owner's foresight conscience answer (2026-07-21): "Aceptable, fail-closed" — insertion upgrade registered as followup (S-004.4). | none (answered — cite in slices) |

Routing: plan-gaps
Orchestrator action: single `sdd-slice` amendment covering gaps 1–4 and citing the settled answers for 5–6; then re-verify (iteration 2, both judges re-run against the amended artefact). Iteration 1 of 3 used.

Routing note (deviation from the default table, documented): the default route for `scope` is `sdd-spec` — not taken, because the spec is intact and signed; the defect is slice-artefact completeness. No `question-technical` routes to `sdd-explore`/`sdd-design` — every question has an existing answer in signed artifacts or shipped code; none reveals an unexplored area or design hole.
