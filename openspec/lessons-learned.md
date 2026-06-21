# Lessons Learned

Forward-looking advice curated from archived changes. Newest first.

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
