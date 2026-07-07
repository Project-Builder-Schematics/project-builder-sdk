# Plan Verify Result

**Change**: stage-3-dry-run-exposure
**Iteration**: 1/3
**Mode**: plan
**Write mode**: sync (spec_source internal) — ticket bodies not composed

---

## Verdict: gaps

Judge A (problem/scope fit): **no findings.** Problem-fit affirmed (dead-code-to-reachable transition real and tested via REQ-DRE-01.5 e2e); all three in_scope items covered by REQs and slices; nothing exceeds out_of_scope (both creep vectors — DryRunVerb locality, context.ts read-only — deliberately fenced). One cosmetic note, explicitly not a finding: scope's literal "FIT-09 … updated" is satisfied as reconfirmed-green permanent fixtures, the correct consequence of D3's additive no-subpath shape.

Judge B (simulated executor, followed the slices' Executor Context reading list — 11 files): **3 question-technical.** No product questions ("all open items are technical scaffolding gaps"; contracts and literals pinned).

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | question-technical | `vocabulary-consistency.test.ts` mechanism undefined: design shows `WIRE_TO_AUTHOR_VERB` as UNEXPORTED const, yet the test needs it importable at runtime; and "DryRunVerb members === map values" has no runtime representation (type is erased) — export the map (without barrel/commons re-export)? runtime six-verb const? or compile-time `satisfies` check? Exporting changes plan.ts surface → touches the .d.ts baseline regen in the same slice. | sdd-design (rev 3 — normative decision) |
| 2 | question-technical | Run-harness scaffolding for active-run tests (e2e + skeleton): how to inject EngineClient, enter ambient run, buffer, call dryRun() inside fn, trigger read()-flush — reading list has context.ts/session.ts but NO existing e2e/skeleton test nor the shared spy-client/directive-builders helpers standardized at /simplify. Reuse canonical harness (where?) or inline noop client? | sdd-design (document convention) + slices Executor Context reading-list update |
| 3 | question-technical | test/types compile-time test convention: plain .ts surviving `tsc --noEmit` vs bun-test `it()` block required; `@ts-expect-error`/`expectTypeOf`/`satisfies` idiom — no test/types precedent in the reading list. | sdd-design (document convention) + slices Executor Context reading-list update |

Routing: plan-gaps
Orchestrator action: all three routed to `sdd-design` rev 3 (question 1 is a normative design decision; 2-3 are executor-surface conventions to pin), then `sdd-slice` updates the Executor Context appendix (reading list + pinned idioms), then re-verify (iteration 2). Iteration 1 of 3 used.

## Protocol note

Judge B followed the slices artefact's own mandatory reading list from iteration 1 (stage-2 lesson: mirrors the real /build executor surface; resolves the slices-only asymptote structurally). Judges received file paths as their only inputs (blindness preserved; no orchestrator reasoning shared).
