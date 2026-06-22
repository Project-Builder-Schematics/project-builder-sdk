# Lessons Learned

Forward-looking advice curated from archived changes. Newest first.

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
