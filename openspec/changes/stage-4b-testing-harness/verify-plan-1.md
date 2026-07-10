# Plan Verify Result

**Change**: stage-4b-testing-harness
**Iteration**: 1/3
**Mode**: plan
**Write mode**: sync — ticket bodies not composed (spec_source internal)

---

## Verdict: gaps

Judge A (problem/scope fit): **no findings** — full in_scope→REQ→slice coverage map (10/10), out_of_scope respected, P1 mechanism shift correctly read as ratified amendment; S-006 deferrals disclosed, not gaps.

Judge B (simulated executor): 7 questions — no "ready to execute".

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | question-technical | Stage-4 precondition is UNMET on this base (planner artefacts merged, implementation not: no packageDir param, no @example, no FIT-14, exports unchanged) — slices say "halt if absent" but don't operationalize WHEN the check runs or which markers prove it met | sdd-slice touch: make the precondition operational — expected-unmet at planning base; /build launch gate lists concrete markers (context.ts packageDir + @example, fit-14 file, exports keys); halt `stage-4-precondition-missing` only at /build time |
| 2 | question-technical | runFactoryForTest 'factory' param semantics (raw fn vs defineFactory-returned runner) + client/seed/emitted wiring not carried by slices | sdd-slice touch: inline design §4.3's pinned facade contract (factory = the RUNNER; harness constructs fake + RecordingClient internally, spy-style recording) into S-001's card as load-bearing literals |
| 3 | question-technical | result.error runtime semantics (undefined on success; caught throw verbatim, no re-wrapping) not carried by slices | sdd-slice touch: inline into S-001 card (design §4.3 pins it) |
| 4 | question-technical | REAL CONTRADICTION: wildcard-ban-by-form (design §4.4, SEC-M1) flags src/index.ts's legitimate `export * from "./commons/index.ts"` — a scanned AUTHOR_SUBPATH | sdd-design touch: pin a specifier-exact exemption (src/index.ts may star-re-export ONLY from ./commons/index.ts — existing umbrella form; any other wildcard anywhere scanned = violation) + red-proof stays intact |
| 5 | question-technical | Canonical wording for stability-language / boundary sentences unpinned — docs tests can't go green deterministically | sdd-design or slices touch: pin token-level asserts (e.g. "0.x", "may change", "./conformance") — free authoring around required tokens |
| 6 | question-product | S-005/S-006 qualifying-line relationship + its literal text source unavailable to executor | sdd-slice touch: cite the literal's home (openspec/changes/stage-4-typed-options/specs/factory-package-shape/spec.md ~line 127, merged planner artefact); clarify 4b'S-006 REVERTS the line stage-4's own S-005 writes — 4b's S-005 does NOT write it |
| 7 | question-technical | ensureMinifiedEntry build command + entry set not carried by slices | sdd-slice touch: inline design's pin (bun build --target=node --minify per FIT-03 idiom; four src/ entries) into S-003 card |

Routing: plan-gaps
Orchestrator action: fix pass — design touch (gap 4, 5) + slices touch (gaps 1, 2, 3, 6, 7) — then iteration 2 with fresh blind judges. Iteration 1 of 3 used.
