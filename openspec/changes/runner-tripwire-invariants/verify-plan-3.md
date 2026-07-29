# Plan Verify Result

**Change**: runner-tripwire-invariants
**Iteration**: 3/3 — FINAL. Verdict `gaps` → halt `plan-verify-failed`, escalated to owner per protocol.
**Mode**: plan
**Write mode**: sync (internal)

---

### Verdict: gaps (escalation)

Trajectory: 16 (iter 1) → 12 (iter 2) → 14 (iter 3). The count did not converge to zero, but the
NATURE converged: iteration-3 findings are refinements, documented residuals, and build-mechanics
precision — zero design flaws, zero executor-blocking unknowns about the mechanism.

### Judge A (7 findings) — orchestrator classification

| # | Finding | Class |
|---|---|---|
| A1 | PTH-01 closes R2-6 via a committed flag-shape grammar with an EXPLICIT scope-limit sentence — an honest, documented enumeration residual, not a silent one (deliberately chosen at iteration 1 over full default-deny, which would misflag ordinary flags) | documented residual (owner-viewable) |
| A2 | Member-path admission depth ≥2 semantics unstated (all red-proofs are depth-1) | REAL — one-sentence spec clarification |
| A3 | DGN-01 totality is corpus-relative, not structural (a violation path with no fixture cannot mis-attribute loudly) | acknowledged limit — materially stronger than before; structural diagnostics totality = diminishing returns |
| A4 | Publish family has a scope arm (Amendment a) but the problem_statement paragraph was never amended | bookkeeping — one sentence |
| A5 | in_scope item 3 delivered via the archive gate, not a slice — "documented substitution, not a silent gap" (judge's own words); mapping now plan-resident | documented substitution (owner-ruled) |
| A6 | "Close R2-6" partial by ruling 3 (M3.6 out) — "owner-ruled and consistently cross-referenced… not a contradiction" (judge's own words) | already ruled |
| A7 | FCG-01's temp-then-rename governs the SUCCESS write path; bullet-5 reconciliation names only the failure channel; bounded by the byte-gate | bookkeeping — reconciliation sentence |

### Judge B (7 questions) — orchestrator classification

| # | Question | Class |
|---|---|---|
| B1 | fit-46 scratch-target isolation design (where stamp/rebuild write so the real tree is never touched; R1-12's bad example noted) | REAL — build-mechanics, decidable in amendment |
| B2 | Red-proof partition off-by-one: S-001.8 says 6 CST-04.x items; the quoted range #10-#16 is SEVEN | REAL — arithmetic error, must fix |
| B3 | Red-proof tagging/registry convention (49/49 unmeasurable without one; must predate the first RED commit) | REAL — decidable in amendment |
| B4 | node:vm denied by two mechanisms — single or double violation, which rule identity (feeds DGN-01.3's multiset) | REAL — decidable in amendment |
| B5 | Failing-fixture invocation boundary for fit-46/PPI-03.2 (green suite proving a failing run blocks publish) | REAL — build-mechanics, decidable |
| B6 | Byte-gate semantics: REGENERATE from a live walk vs hash the committed file — hashing proves nothing about the rewrite | REAL — the sharpest one; the gate must regenerate |
| B7 | Stalled-S-000 fallback (mechanism PR base if S-000 unmerged at cycle close) | question-product → owner |

### Orchestrator assessment

Every REAL item above is mechanically amendable in ONE batch with no judgment latitude; the
remaining A-findings are residuals the owner has already ruled on or documented substitutions the
judges themselves call deliberate. This matches the parent cycle's terminal state (ruling 14:
"ready-with-known-items" — all residual findings traceability/accounting, zero design flaws) —
with the difference that this plan's problem-fit core (CAP totality, callee decidability,
origin+member admission, fail-closed atomicity) drew ZERO findings in iteration 3.

Escalated to owner 2026-07-29.

---

## Owner ruling addendum (2026-07-29)

**Ruling**: READY-WITH-KNOWN-ITEMS + one final mechanical batch, NO fourth judge round —
verify final + judgment-day are the net (same terminal pattern as the parent cycle's
ruling 14). B7 ruled: the mechanism PR opens STACKED against S-000's branch even if S-000
is unmerged at cycle close; it retargets to `main` once S-000 merges.

**Batch applied (2026-07-29, all additive + dated, zero signed REQ text edited)**:

| Item | Disposition |
|---|---|
| B2 | Partition arithmetic corrected against the real `fit-42-*.negative` describes — true CST-04.x count is 8 (an 8th item, `#18`, sat outside the quoted range); S-002.6 checksum propagated (7+3=10; 8+10=18) |
| B6 | Byte-gate procedure pinned in slices + spec: fresh `dist/` build → live closure walk → REGENERATE → compare to `bf6c983c…a530`; hashing the committed file proves nothing |
| B3 | Red-proof tag convention: `"REQ-<ID> [red-proof]: …"` in test titles, decided before the first RED commit; 49/49 = tagged-title count == registry size |
| B4 | node:vm single-emit, rule = `constraint-4-inadmissible-origin` (its only surface presence is a `module-specifier` node, never a callee) — a deliberate rule-identity change for that fixture row, consequences for DGN-01.3/PRM-01.2 recorded |
| B1/B5 | fit-46 scratch-tree isolation (mkdtemp copy; real package.json/dist never touched; R1-12 cited as anti-example) + failing-fixture proof as child invocation inside scratch |
| A2 | Orchestrator-resolved after the batch agent's honest halt: `ADMITTED_MEMBER_PATHS` entries are FULL recorded paths at any depth; admission is exact full-path membership, NEVER prefix-inherited — the only reading consistent with D-2's worked example (`process.stdout.write.bind`, verified live at `dist/transport/framing.js:69`), REQ-PRM-01's "every member path" doctrine, and the change's own goal (prefix inheritance would readmit `process.stdout.constructor.constructor(…)` and reopen the Function-constructor escape). Spec block under REQ-CAP-04.8 + design.md doc-comment note |
| A4 | problem_statement amended: publish path's zero-test surface (W2) named as part of the pain |
| A7 | FCG bullet-5 reconciliation: temp-then-rename governs the SUCCESS write path too, bounded by the byte gate |

**Known residuals accepted by ruling**: A1 (PTH-01 flag-grammar scope-limit — documented),
A3 (DGN-01 corpus-relative totality), A5 (in_scope 3 via archive gate), A6 (R2-6 partial per
ruling 3). `design.md` §6(c) carries the same B2 undercount — noted, design already flags
Test-Derivation staleness in-file; ground truth for the build is `slices.md` + the real
fit-42 files.

### Verdict: ready (owner-ruled)
