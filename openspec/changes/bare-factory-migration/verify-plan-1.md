# Plan Verify Result

**Change**: bare-factory-migration
**Iteration**: 1/3
**Mode**: plan
**Write mode**: n/a (spec_source = internal) — ticket bodies not composed

---

## Verdict: gaps

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | scope | Judge A: in_scope names "FIT-09/FIT-14 baseline updates" but no REQ/slice touches them. Council context (not visible to the judge): FIT-14 is key-level (no subpath removed → correctly untouched); the real guards are FIT-08 (allowlist) + FIT-04 (dts). The scope wording is STALE, but the plan must reconcile it in writing, not by silence. | orchestrator: annotate triage scope item with the reconciliation; slices note it |
| 2 | scope | Judge A: the author-emulation corpus migration (in_scope) has slice coverage (S-004/S-005) but NO governing REQ pinning its bare-shape end state; S-005 says "Covers: —". | sdd-spec V2 (unfreeze): add corpus end-state REQ |
| 3 | scope (minor) | Judge A: docs/{dry-run,authoring-verbs,authoring-errors}.md have no dedicated REQ for their zero-defineFactory state — they live only in S-003's acceptance clause. | sdd-spec V2: fold into the same added/modified REQ set |
| 4 | question-technical (×16, grouped) | Judge B (executor surface = slices only): "not ready to execute." All 16 questions are contract/context withholding — signatures & return shapes (runFactoryForTest, defineFactory, AuthoringError, seed semantics, packageDir resolution), harness internals (RecordingClient/ContractFake assembly, double-fault rule, drain→flush ordering), fitness framework conventions (FIT-29 scanner pattern, FIT-16 retirement convention, FIT-06 cascade), fixture/corpus mechanics (22 export sites, FactoryRunner, scenarios.ts threading, regen determinism), S-006 mechanics (4 harness files, dts baseline location, installed-consumer pack/install), doc surfaces & exact wording, deep-import topology of the sentinel set. | sdd-slice revision: add §Executor Context (repo precedent: schematic-local-files slices.md §Executor Context) |
| 5 | question-product | Judge B: is the hard cut truly atomic (no dual-shape window)? | ANSWERED (owner, this session): YES — hard cut ruled, zero external authors; S-006 gating is non-negotiable. Record in slices §Executor Context. |
| 6 | question-product | Judge B: is the untyped/no-packageDir path a permanent contract or a temporary shim? | ANSWERED (owner, signed spec V1): PERMANENT — REQ-TFO-02 relocated to the caller, byte-identical; REQ-ATH-17.2. Record in slices §Executor Context. |

Routing: plan-gaps
Orchestrator action: (a) sdd-spec V2 unfreeze — add corpus end-state REQ + 3-docs zero-token REQ coverage (gaps #2/#3) → owner re-signs; (b) sdd-slice revision — add §Executor Context answering all 16 Judge-B questions with contracts/pointers/wording + FIT-09/14 reconciliation note (gaps #1/#4) + record the two answered product rulings (#5/#6); (c) re-run both judges as iteration 2. Iteration 1 of 3 used.
