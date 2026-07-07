# Lessons Learned

Forward-looking advice curated from archived changes. Newest first.

## From `stage-3-dry-run-exposure` (2026-07-07)

### Tag pinning-only slices [characterization] at plan time — [must-fail-first] over shipped behavior is unachievable
**What**: A [must-fail-first] tag on a pinning-only slice over behavior a prior skeleton slice already
shipped is unachievable — the behavior exists, so a spec-correct test can only be born GREEN.
**Why**: Stage-3's S-000 walking skeleton shipped the entire `dryRun()` capability; S-001/S-002 added
zero production code (behaviors inherited from `currentContext()`/`pendingSnapshot()`/`Session.flush()`).
Genuine pre-impl RED was impossible, so the executor manufactured RED honestly — a deliberately-wrong
assertion failing for the RIGHT reason (assertion diff, not import/syntax error) — proving teeth, then
corrected to spec. Verify-final adjudicated this TEETH-DEVIATION legitimate: deviation-over-theatre,
not a violation.
**Where**: Any multi-slice change whose skeleton slice ships the capability and whose later slices only
pin inherited behavior.
**Learned**: At slicing time, tag pinning-only slices [characterization], reserving [must-fail-first]
for slices that add or change production behavior. When the misclassification is only discovered at
apply time, TEETH-DEVIATION (deliberately-wrong-expectation RED) is the honest fallback.

Source: change `stage-3-dry-run-exposure` (2026-07-07)

### Commit pipeline artefacts BEFORE launching evaluators with cleanup instructions
**What**: Blind evaluators instructed to "leave no trace" deleted an UNCOMMITTED pipeline artefact
(`verify-report.md`), mistaking it for their own residue.
**Why**: Uncommitted files have ambiguous ownership from an evaluator's perspective — a blanket
cleanup instruction invites over-zealous garbage collection of anything not in git history. The
committed artefacts survived untouched.
**Where**: Any orchestrated flow that launches blind judges/evaluators (judgment-day, council reviews)
with cleanup or leave-no-trace instructions.
**Learned**: Commit every pipeline artefact to the branch BEFORE launching evaluators that carry
cleanup instructions, and scope those instructions to exact paths rather than "clean up after yourself".

Source: change `stage-3-dry-run-exposure` (2026-07-07)

### A worktree-scoped architecture refresh silently drops unmerged sibling surface
**What**: Refreshing the architecture baseline from inside a change worktree captures only what that
worktree sees — surface belonging to unmerged sibling branches (parallel changes) silently disappears
from the refreshed baseline.
**Why**: Stage-3's post-verify baseline refresh ran in the stage-3 worktree while stage-2 (parallel,
unmerged, architecture-impact `modifying`) was invisible to it; without a scope note, a future reader
would take the refreshed baseline as the whole truth.
**Where**: Projects running parallel changes under worktrees with an architecture baseline
(`sdd/{project}/architecture`).
**Learned**: Record the branch-scope in the baseline refresh note ("captured in {branch} worktree
context only") and re-refresh the baseline after the siblings merge — never treat a worktree-scoped
refresh as global.

Source: change `stage-3-dry-run-exposure` (2026-07-07)

## From `typed-options-and-read` (2026-06-24)

### A named derivation alias can be a structural no-op — prove the existing contract, don't add one
**What**: When a mapped type is homomorphic (`{ [K in keyof S]: S[K] }`), TypeScript already preserves
optionality, required-ness, and per-key value types. A named alias (`OptionsOf<S>`) that re-derives the
same structure is a no-op — it adds a public name without adding behaviour.
**Why**: The design assumed the skeleton's identity map needed a richer derivation for required/optional
split. Standalone `tsc` verification at apply time proved it was wrong — the map was already correct for
every signed scenario. Introducing `OptionsOf<S>` would have frozen a name whose only observable
difference (a `T | undefined` key without `?` becoming omittable) was unwanted.
**Where**: Any change that adds a type derivation over an existing mapped type before freeze.
**Learned**: Before adding a derivation alias, run the full negative matrix against the existing type.
If every scenario already holds, the deliverable is to PROVE and FREEZE the current contract (characterization
matrix + CI guard), not to add a new name. Reframe "add derivation" as "prove + freeze".

Source: change `typed-options-and-read` (2026-06-24)

### FIT-04 dts-baseline regen is the intentional-freeze proof — keep the diff to one line
**What**: When a public `.d.ts` surface changes intentionally, the baseline regen should be a 1-line
diff (the signature line only). A multi-line regen diff is a signal that unintended surface has shifted.
**Why**: The `core.base-handle.d.ts` baseline regen from `Promise<string>` to `Promise<string | undefined>`
was exactly one line. Restoring the trailing newline to match `echo`-vs-`write` differences was the only
noise. The 1-line expectation is the easiest way to sanity-check that the gate is green for the right reason.
**Where**: `test/fitness/dts-baseline/` regen after any public signature change.
**Learned**: Run `git diff` over the baseline file after regen. If more than the intended signature line
changed, investigate before claiming FIT-04 is correctly frozen.

Source: change `typed-options-and-read` (2026-06-24)

### Two blind judges independently rediscovering the same edge validates it as a real tracked boundary
**What**: When two independent judges (from different review passes, receiving no shared context) both
surface the same architectural concern, treat it as a confirmed design edge — not a defect, not noise.
**Why**: Both judgment-day judges independently identified the walking-skeleton port boundary (read-staged
/ read-your-own-writes vs read-disk) and the real-engine divergence risk. Neither had seen the other's
review. Their convergence is Bayesian evidence that the boundary is load-bearing and needs explicit tracking.
**Where**: Any L/sensitive change with multiple blind review passes.
**Learned**: When two blind judges agree on the same concern, log it as a tracked design boundary
(not a finding to suppress). The convergence is the signal.

Source: change `typed-options-and-read` (2026-06-24)

## From `l1-author-surface-skeleton` (2026-06-22)

### The plan-verify "zero Judge-B questions" bar is asymptotic for complex changes
**What**: Treat plan-verify Judge B (the slices-only simulated executor, "ANY open question → gaps")
as a residue detector, not a pass/fail gate. Judge A (problem/scope fit) is the meaningful signal.
**Why**: Judge B reads slices in isolation — the design that answers its questions is deliberately
withheld. For any non-trivial change it will always surface questions a design-aware executor wouldn't
ask, so the formal "ready needs zero findings" bar is never cleanly reachable. This skeleton took 4
iterations and a human override; iters 2–4 each resolved a *real* gap, but the tail was isolation
artefacts, not defects.
**Where**: Every M/L change's plan-verify gate.
**Learned**: Budget the 3-iteration limit for Judge A's substance; when the residue is Judge-B
isolation noise the design already answers, override with the rationale logged — don't loop chasing zero.

### A migration plan's "which tests break" prediction must be apply-verified, not trusted
**What**: When a design predicts which existing tests a contract change will break, re-run the suite at
apply time — the prediction is a hypothesis, not a fact.
**Why**: The design's Fake Migration Plan claimed read-your-own-write tests would break under the new
commit boundary. The opposite held: mid-run reads stayed green, but four *post-run* `fake.read()`
assertions broke because `commit()` clears staging before a post-run read can observe it. The
prediction was confidently wrong; only the apply run found the truth.
**Where**: Any change that reverses a behavioural contract a test suite already pins.
**Learned**: Design predicts, apply verifies. Never carry a migration prediction into archive as fact
without a green run behind it.

### Read-your-own-writes precludes rollback-by-withholding — roll back transactionally downstream
**What**: An API that flushes buffered writes mid-run to serve its own reads cannot implement
all-or-nothing by "deciding not to emit on error" — the writes are already gone downstream.
**Why**: `read()` flushed `#pending` to engine staging before every read, so a later throw had nothing
left to suppress. Rollback had to become a staging→commit/discard boundary owned by the engine (see
ADR 0015), not an SDK-side emit suppression.
**Where**: Any fluent/buffered surface with read-your-own-writes semantics.
**Learned**: If reads flush, rollback is a downstream transaction concern. Model the boundary on the
transport port; don't try to win it in the buffer.

## From `foundations-skeleton` (2026-06-21)

### Blind adversarial review escapes pipeline anchoring
**What**: Run a blind pass (judges see only the diff + signed spec, never the tests or prior review)
on any change whose tests share one happy-path shape.
**Why**: The entire council tested `read-your-own-write`, which always calls `.read()` — masking that
the session only flushed *inside* `read()`. A write-only factory (the SDK's primary use case) emitted
nothing. Only the blind judges, lacking that framing, caught it.
**Where**: Project-wide; especially fluent/lifecycle APIs.
**Learned**: Anchoring is invisible from inside the pipeline. Budget a blind round for L/sensitive changes.

### Fitness/gate tests that read build output must build first or assert freshness
**What**: Any test reading `dist/` must self-build (or assert dist is newer than src) and CI must build
before test.
**Why**: FIT-04 (the .d.ts semver gate) false-greened twice on a stale `dist/`, once masking a real
renamed-export breaking change. A gate that reads stale artifacts validates the wrong surface.
**Where**: `test/fitness/*` and any artifact-diffing test.
**Learned**: Derived-artifact tests are impure by default; make freshness explicit.

### Chaining/fluent tests must exercise the RETURNED object, not a side path
**What**: For a chaining API, the round-trip test must `.read()` the handle the verb returned.
**Why**: `rename`/`move` returned handles addressing the wrong path (basename vs full path; deleted
source). Tests read an unrelated `"dummy"` path to force a flush, so two CRITICALs shipped green.
**Where**: `src/commons` author verbs; any builder/fluent surface.
**Learned**: Asserting the emitted payload is not enough — assert behaviour through the returned value.

### Test doubles live outside the published source tree
**What**: Keep the contract fake (and any test double) out of `src/` so it never lands in `dist/`.
**Why**: `ContractFake` under `src/core/` shipped in the npm tarball and forced a fitness-function
carve-out. Moving it to `test/support/` removed both problems.
**Where**: Published packages.
**Learned**: Placement is a boundary decision; `files`/`exports` alone don't keep test code unpublished.

### Lifecycle guarantees belong in a REQ with a GWT, not a JSDoc comment
**What**: Encode run-end / teardown semantics as an explicit acceptance criterion.
**Why**: Run-end flush was promised only in the `create` JSDoc, so nothing tested it — the gap that hid
the write-only-factory bug. Making it REQ-KIT-05 with a GIVEN/WHEN/THEN closed it.
**Where**: Any API with lifecycle/flush/cleanup semantics.
**Learned**: If a guarantee isn't in the spec, it isn't tested.

## From `stage-1-ir-bedrock` (2026-07-05)

### Identity exclusion proved load-bearing via triangulation regression
**What**: When implementing fail-closed collision detection for `move`, the naive `#exists(dst)` check
without self-move identity exclusion initially passed but went RED during apply verification — proving
the identity exclusion (`dst === src` → success, no-op) kills a real mutation.
**Why**: The check was initially implemented without the identity guard, passing all green-path tests.
Only during apply triangulation (REQ-FAKE-04.m4: "self-move succeeds") did the fixture expose that
the naive check incorrectly rejected a file moving to itself. Adding the identity exclusion flipped
the test from RED → GREEN, proving the exclusion is not defensive but load-bearing.
**Where**: Any seam rule involving collision detection or identity-like comparisons (move/rename/copy
with forced overwrites, cache invalidation, dedup logic).
**Learned**: Triangulation regression (test goes RED after naive implementation, then GREEN after
adding the subtle rule) is the strongest signal that a requirement is load-bearing, not just defensive.
Budget time for triangulation during apply.

Source: change `stage-1-ir-bedrock` (2026-07-05)

### Stage-boundary markers guide cross-stage collaboration
**What**: Mark raw seam rejections with `// RAW-UNTIL-STAGE-N` comments so the next stage locates
upgrade sites without archaeology or grepping the whole change.
**Why**: This stage's five emit-seam rejections (cap-exceeded, round-trip-mismatch, move-collision,
modify-existence, stringify-throw) all carry `// RAW-UNTIL-STAGE-2.1` markers. Stage 2.1's design
can search for these markers to find exactly which raw `ContractFake:` throws need to become attributed
`AuthoringError` instances, without reading the full apply history or design.
**Where**: Multi-stage work where one stage's boundary code feeds into another stage's error handling
(e.g., seam validation → error attribution, fake behaviours → real engine mapping).
**Learned**: Explicit stage-boundary markers in code are a process pattern, not a code smell. They
close handoffs cleanly and scale with parallelism.

Source: change `stage-1-ir-bedrock` (2026-07-05)

### Seam contracts need fixture adversarialism to kill encoding mutants
**What**: Boundary fixtures for encoding/serialization logic must include multi-byte and escape-character
content specifically sized to distinguish mutants (raw-vs-serialized measurement, UTF-8 vs UTF-16).
**Why**: REQ-01 (batch cap) and REQ-02 (boundary pass-through) both require fixtures that are
intentionally constructed to fail under plausible wrong implementations. The at-cap and over-cap
fixtures have raw-content-bytes < cap < serialized-bytes, so a raw-measurement mutant passes the
over-cap boundary when it should reject. Plain-ASCII fixtures cannot distinguish this from a correct
UTF-8 implementation. Multi-byte content adds another axis (UTF-16 code-unit mutant vs byte mutant).
**Where**: Any seam test involving measurement, encoding, or serialization (JSON boundary, wire size cap,
path normalization, content type pins).
**Learned**: Fixture design for seam tests is not about happy paths — it's about killing mutants.
Adversarially construct fixtures to be wrong under plausible mutations. ASCII fixtures are never enough.

Source: change `stage-1-ir-bedrock` (2026-07-05)
