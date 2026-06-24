# Lessons Learned

Forward-looking advice curated from archived changes. Newest first.

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
