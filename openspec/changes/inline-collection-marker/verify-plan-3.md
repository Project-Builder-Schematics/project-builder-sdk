# Plan Verify Result

**Change**: inline-collection-marker
**Iteration**: 3/3 (FINAL)
**Mode**: plan
**Write mode**: n/a

---

## Verdict: gaps → plan-verify-failed (3 iterations exhausted — escalated to human per protocol)

Problem-fit: CLEAN for the third consecutive judge pass ("the reported failure has exactly one origin… S-000.4 deletes it; the surviving walk cannot resurrect the failure"). ALL remaining findings are traceability/accounting or doc-wording — zero design flaws, zero executor-blocking unknowns about the CODE.

Convergence: iter 1 = 18 entries → iter 2 = 16 → iter 3 = 12, but NEW entries keep being minted by the fixes themselves (V3.2's REQ-PSH-05/REQ-MFB-02/REQ-FTG-06.4 now need their own coverage — the accounting is self-propagating).

| # | Category | Description |
|---|---|---|
| A1 | scope | REQ-PSH-05 + REQ-MFB-02 (born in V3.2) signed [red-today] but no slice Covers/test task (vehicle exists: test/docs/security-authoring-guard.test.ts pattern) |
| A2 | scope | Two V3.2 archive-sync amendments unledgered (scenario-matrix Sensitive-Areas re-point; conformance-fixtures cross-ref) + BRC ledger entry under-describes :179 edit |
| A3 | scope | ADR/docs/handoff deliverables have tasks but no REQ (supersession headers qualify the sweep allowlist — silent skip undetectable) |
| A4 | scope | Stale Covers: FTG-06.3/.4, MODIFIED REQ-BRC-08 uncited |
| A5 | scope (low) | AEC-11 message upgrades = owner-waved (ruling 6), not scope-declared — record as such |
| B1 | question-technical | Sweep self-contradiction: source-outside-package has 12 live hits in openspec/specs/ pre-archive + S-000.1's restore ADDS 4; coverage-manifest:80 prose hit — allowlist must gain openspec/specs/** (pre-archive) + manifest line task |
| B2/B3 | question-technical | = A1 (who owns the PSH-05/MFB-02 checks, which anchors) |
| B4 | question-technical | FTG-06.4 is fixture-driven → green-able in-change; slices exclude clause (e) wholesale — split: .4 fixture pair in fit-43 now, real-tree sweep stays archive-sync |
| B5 | question-technical | S-000 Acceptance + design §7 still say byte-exact for copyIn leg; spec V3.2 re-pinned to directive-shape — text alignment |
| B6 | question-technical | = A2 + conformance-fixtures either/or (re-point vs historical) needs deciding |
| B7 | question-technical | fit-04 kit-internal registration task unassigned + .d.ts regen procedure |
| B8 | question-technical | Coverage-manifest REQ-BRC-06.1 entry: stays keyed to M-17 alongside the new PSH-02.1 cite, re-keyed, or dropped |
| B9 | question-product | Verbatim author rule ("always") vs published symlink residual — same reader, opposing promises; qualify authoring-verbs.md or keep unqualified with SECURITY.md carrying the caveat — OWNER |

Routing: plan-verify-failed → human. Options: (1) owner declares ready-with-known-items — one batched mechanical amendment applies A1-A4/B1-B8 with NO fourth judge round (all items are deterministic bookkeeping; the batch is the fix list itself); (2) further re-phases (protocol-pure but past the ceremony-proportionality line); (3) descope decision.
