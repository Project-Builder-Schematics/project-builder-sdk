## Plan Verify Result

**Change**: l1-author-surface-skeleton
**Iteration**: 3/3 (LAST — iteration limit reached)
**Mode**: plan
**Write mode**: sync (n/a — ticket bodies not composed)

---

### Verdict: gaps

**Judge A (problem/scope fit)**: clean — no findings. The plan solves the stated problem
(thin end-to-end thread across all 4 seams, with the two riskiest seams — commit/discard +
error-attribution — exercised by a REAL forced rejection from day one per REQ-13/S-000). Every
in_scope item maps to ≥1 REQ and ≥1 slice; nothing exceeds out_of_scope (each boundary self-limits
with an explicit deferral marker to #2/#3/#4). Verified against real code.

**Judge B (simulated executor)**: NOT ready — 2 question-technical (down from 12 in iter-2). The
iter-2 BLOCKER (EngineClient commit/discard port) is RESOLVED and confirmed consistent with the real
files. Two NEW genuine under-specifications surfaced, both GENUINE (not isolation artifacts) but
NARROW and detail-level (not architectural):

### Real gaps (both genuine, both tractable)

1. **[question-technical] Existing inline `EngineClient` literals break when the port grows.**
   `test/skeleton/session.test.ts` (lines ~18-27 and ~45-48) contains hand-rolled `EngineClient`
   object-literals implementing ONLY `emit`/`read`. S-000.6 adds `commit()`/`discard()` as REQUIRED
   port members → those literals stop typechecking. The plan says "existing 148 tests must stay green"
   and S-000.8 runs "full suite — all green", but never lists these literals among files to touch.
   Executor is blocked between (a) update the call-sites with stub `commit`/`discard` (or swap them for
   `ContractFake`) vs (b) make the port members optional (`commit?`/`discard?`) — but (b) is UNSOUND,
   it would make `defineFactory`'s `session.commit()` call unguarded. The plan must pin (a) and name
   the sweep. (category: question-technical)

2. **[question-technical] `toAuthoringError` — fresh message vs `.cause` chain.** REQ-11.1/REQ-12.2/
   REQ-13.1 assert "no engine text (`ContractFake:`/`OpMove`) in the error". `ContractFake` throws a
   plain `Error` whose message is `ContractFake: …`. Unresolved: does `toAuthoringError` DISCARD the raw
   message and build a fresh author-vocabulary message from verb+path (no chain), or attach the raw
   error as `.cause` for debuggability? If `.cause` is attached, a test that serializes the full error
   chain still sees `ContractFake:`. The `AuthoringError` shape AND the S-000.3 assertion target
   (`.message` only vs whole error) must agree, or the slice is built one way and asserted the other.
   (category: question-technical)

### Trajectory (orchestrator honest assessment)
Iter-1 gaps were largely isolation artifacts (over-corrected via slice enrichment). Iter-2 found ONE
genuine architectural BLOCKER (the port). Iter-3 found TWO genuine but DETAIL-level gaps. The trajectory
is CONVERGING (12->2 questions; architectural->detail), not thrashing. Both remaining gaps are
"pin a decision in design+slices" — neither is an architectural hole. Resolutions are clear:
gap #1 -> update the inline literals (port stays REQUIRED); gap #2 -> fresh author message, NO `.cause`
chain in the skeleton (defer rich error context to #3), test asserts on `.message`.

### Routing
`plan-gaps` (both question-technical -> `sdd-design`). BUT the 3-iteration limit is now EXHAUSTED ->
the orchestrator emits **`plan-verify-failed`** (orchestrator-side halt) -> HUMAN. The human (present in
session) decides: authorize a final narrow design touch resolving the two pinned gaps and proceed past
the limit (human override — the designed resolution for `plan-verify-failed`), or take another path.
Spec edits this session were orchestrator amendments reconciling REQ-08 prose + REQ-02.2 mechanism with
the resolved port decision (scenarios unchanged, re-signed with amendment note).
