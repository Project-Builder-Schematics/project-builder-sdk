# Verify In-Loop Result

**Change**: bare-factory-migration
**Iteration**: 4 (batch 3, fresh loop — iteration 1 of this batch)
**Scope**: S-003 + S-004
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All batch-3 acceptance criteria verified with real execution. The R-3 deviation is
adjudicated **ACCEPTED as a necessary deviation** (with recorded drift-risk notes for
verify-final). The FIT-28 edit is adjudicated **sanctioned mechanical threading**, not
smuggled S-005 scope. Batch 4 (S-005 → S-006) unblocks.

---

## PRIORITY ADJUDICATION — R-3 deviation (`scratchFactoryRunner`)

### (a) Mechanical-impossibility claim → TRUE

- **Old topology** (pre-S-004, verified via `git show c875910`): `scratchFactoryRunner`
  returned an ARITY-2 runner `(input, deps) => {...}` and forwarded the OUTER caller's
  `deps` into the nested runner: `const inner = defineFactory(body, {packageDir: dir});
  await inner(input, deps)`. The nested wrap worked because the outer client was handed in.
- **New topology**: design §4.3 narrows `FactoryRunner` to bare `(input) => void |
  Promise<void>` — the scratch runner no longer RECEIVES `deps`. For a nested
  `defineFactory` call it would need a client to drive the returned runner:
  - The outer run's client is unreachable: `Session.#client` is a true ECMAScript private
    field (`src/core/session.ts:16`, `readonly #client`) with no accessor — Session's
    wrappers expose read/commit/discard/emit behavior, never the client object.
  - Building its OWN fake client would route directives into an independent fake whose
    output never reaches the outer `runFactoryForTest` capture the corpus reads —
    exactly the double-capture split the builder describes.
- R-3's rationale premise ("it is precisely the manual-wrap DRIVER class ADR-C sanctions")
  described the old topology where `scratchFactoryRunner`'s output was the OUTERMOST
  runner. S-004 (spec-mandated: REQ-ATH-20.1 whole-file bare scan + `FactoryRunner`
  compile-enforcement) makes it a CALLEE inside an already-running `defineFactory` run.
  The ruling's instruction is unimplementable without violating the signed spec.
  **Claim TRUE — the deviation is necessary in some form.**

### (b) Validation-drift risk → REAL but BOUNDED (record for verify-final)

Comparison of `defineFactory`'s opted-in gate (`context.ts`, `resolvePackageDir` →
`checkReservedNames` → `validateAtRunBoundary` → `resolvePackageRoot`) vs the replica:

| Gate | Old nested path | Replica | Drift |
|---|---|---|---|
| Reserved-name scan | `checkReservedNames` (try/catch-wrapped `findReservedSibling` + descriptive scan-failure Error) | `findReservedSibling` + `rejectionForReservedName` — the SAME exported utilities, but WITHOUT the scan-failure wrapper | Minor: an unreadable scratch dir yields a raw error instead of the `[pbuilder] could not scan...` message. Cosmetic in test-support. |
| Schema boundary | `validateAtRunBoundary` (ENOENT opt-out + loudly-schemaless warning) | **Not replicated** | Scratch dirs never ship `schema.json`, so old behavior was warning-only; the warning no longer prints. NO corpus impact (verified byte-identical). Risk: a future scratch scenario adding `schema.json` would silently skip validation. |
| Containment ceiling | `resolvePackageRoot` walk (fail-closed if no `collection.json` ancestor) | Hardcoded `{packageDir: dir, packageRoot: dir}` | Valid today (setup always writes `collection.json` at `dir` — same resolved value). Risk: a future scenario omitting that write would silently anchor instead of failing closed. |
| Anchor lifecycle | Anchors set once at run start (ADR-0046 chokepoint) | Mid-run mutation of `ctx.packageAnchors`, restored in `finally` | New pattern; single-run scoped, restored on all paths (throw included). Test-support only — production `RunContext` handling untouched. |

No production file is affected (the replica lives in `test/fixtures/**`, outside FIT-29's
scan domain by design). **Recommendation for verify-final/archive**: register a followup —
either a pin test asserting the replica's gate list stays in lockstep with
`defineFactory`'s, or extraction of a shared `establishScratchAnchors` helper.

### (c) Corpus byte-identity → TRUE (executed)

- `bun test test/fitness/fit-28-corpus-determinism.test.ts` → **2 pass, 0 fail**.
- `bun scripts/regen-corpus.ts` → all 22 records written; `git status
  test/e2e/author-emulation/corpus/` → **EMPTY** (byte-identical no-op; nothing to
  checkout — tree returned to committed state by itself).
- Committed corpus content untouched on the branch (`git diff --name-only <merge-base>
  -- corpus/` empty) — S-005's regen event was NOT smuggled.

### (d) Verdict → ACCEPT as necessary deviation

The builder disclosed rather than hid it, the rationale is verified true, behavior is
proven preserved (corpus byte-identity + suite), and the replica uses the same exported
primitives where possible. Orchestrator bookkeeping: annotate §20 R-3 as superseded by
this adjudication (Planner-level note, no code change), and carry the drift-risk followup
into verify-final.

## SECOND ADJUDICATION — FIT-28 edit → SANCTIONED mechanical threading

`git show c875910` on `fit-28-corpus-determinism.test.ts`: the `Pick` type gains
`"packageDir"`, and the positional `scenario.seed` becomes `{seed, packageDir}` at the two
`captureRun` call sites. No assertion, oracle, process-spawn mechanics, or corpus content
changed. Identical mechanical threading in `scripts/regen-corpus.ts` and
`corpus-format.test.ts`. Without this threading, S-004's `captureRun` signature change
would not compile — it is S-004's own compile obligation, not S-005 scope. S-005's real
deliverable (the regen freshness gate against bare fixtures, run as its own slice event)
remains intact and unperformed.

---

## Standard Batch Verification

### Evidence Table

| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` | **1275 pass / 6 fail** — matches claim exactly |
| 6 failures = pre-existing S-006 bucket | test-name diff vs batch-2 log | **Identical 6 names** (installed-consumer tarball REQ-TES-06.2/.3, REQ-LC-05.2/.1, REQ-LC-02.1/.2) — zero new failures |
| Typecheck | `bun run typecheck` | **exit 0, zero errors** — matches claim (batch-2's 12 FactoryRunner errors were S-004's declared type-level RED; now green) |
| Regression sentinels (R-5) | four-glob `git diff --name-only` | **Empty** |
| Frozen body `:293-346` | `git diff <merge-base> -- src/core/context.ts` | ONE hunk, `@@ -259,6 +259,11 @@` — purely ADDITIVE `@internal` + sanctioned-callers JSDoc inside the editable `:248-292` (old-file coords); **zero old-file lines in `:293-346` touched**; body shifted +5 lines, content byte-identical |
| Deep-import sweep | per-file diff over every `test/**` importer of `core/context.ts` | All touched importers plan-sanctioned: fixture `factory.ts` (S-004 itself — now imports `currentContext`, not `defineFactory`), `typed-factory.e2e.test.ts` (S-004: fixture went bare, so the e2e performs the ONE manual wrap itself — ADR-C driver class, `test/**` outside FIT-29), `ir-transcript.test.ts` (R-9), scaffold hosts (batch-2 additive), `wrap-parity-support.ts` (S-001). Zero §16-named sentinels touched |
| Batch-3 test set (11 files) | `bun test <11 files>` | **138 pass, 0 fail** |

### S-003 (REQ-TSD-01/02/05, FPS-05.2/.3, AOD carry-over)

| Criterion | Evidence | Result |
|---|---|---|
| Zero `defineFactory` tokens in README + docs/{quickstart,dry-run,authoring-verbs,authoring-errors}.md | `rg -c defineFactory` over all 5 | **0 in all 5** |
| 0.x semver-exemption stated | `README.md:84` ("ships `0.x`, semver-exempt...") | ✅ |
| `./testing` vs `./conformance` boundary stated | `README.md:86-87` | ✅ |
| seed-via-options-bag example | `README.md:114-130` (`runFactoryForTest(run, undefined, { seed })`) | ✅ |
| dry-run fence COMPILES against new signature | `testing-story-docs.test.ts` REQ-TSD-05.1 — real `bunx tsc --noEmit` spawn against an isolated tsconfig over the extracted fence (not a token scan); ran green | ✅ |
| `runFactoryForTest` `@example` author-facing bare | `src/testing/index.ts` — example body is `const run = (input) => {...}`, zero wrap; FIT-06's REQ-TSD-02.x tests pass | ✅ |
| `defineFactory` JSDoc: LITERAL `@internal` + sanctioned-callers note + internal example | diff hunk shows `@internal Sanctioned callers only — src/core/**, src/testing/**, src/conformance/**` naming FIT-29; existing bin-to-typed `@example` retained (the internally-aimed wrap+drive pattern per Executor Context §15); `definefactory-jsdoc.test.ts` + FIT-06 cascade pass | ✅ |
| Edit confined to `:248-292` | hunk analysis above | ✅ |

### S-004 (REQ-FPS-04.1, ATH-20.1 enablement, FIT-16 retirement)

| Criterion | Evidence | Result |
|---|---|---|
| ALL 28 + 1 exports bare | I ran R-4's scan myself: `rg -now '\bdefineFactory\b'` (word-boundary, whole file incl. comments) over both fixture files → **ZERO occurrences — nothing remains, not even in `scratchFactoryRunner`'s internals** (the replica uses `currentContext`/`findReservedSibling`/`rejectionForReservedName`); 28 `export const run*` confirmed | ✅ (stronger than the R-3-conditional carve-out anticipated) |
| Committed ATH-20.1 scan per R-4 | `author-emulation-scaffold.e2e.test.ts:414-450` — `/\bdefineFactory\b/`, whole-file, both files, WITH red-proof (wrapped export caught) + no-false-negative (generic call form caught, paren-anchored proven blind) + no-false-positive (fused identifier not matched) | ✅ |
| `FactoryRunner` narrowed | `scenarios.ts` — `(input: any) => void \| Promise<void>`; typecheck exit 0 proves compile-enforcement | ✅ |
| `ScenarioEntry.packageDir` threaded | `scenarios.ts` diff — field added with JSDoc; `PACKAGE_DIR` threaded per non-scratch row; absent for scratch rows (documented) | ✅ |
| `captureRun` options bag + raw-rethrow preserved | `ir-transcript.ts` — `options?: {seed?, packageDir?}`; last line still `throw result.error;` with the factory-bug comment intact | ✅ |
| FIT-16 3rd-signal retirement ATOMIC | `git show c875910`: `hasUntetheredDefineFactory` fn + both `ALWAYS_ON_SCAN_ROOTS` assertions + red-proof pair + `readFileSync` import removed AND `test/fixtures/red/reserved/untethered-factory.ts` deleted — ONE commit; retirement rationale documented in the file header; reserved-sibling signal + its fixtures untouched | ✅ |

### Strict TDD (in-loop audit)

**Verdict**: ok
**Delta scope**: 10 test files + 2 fixture files, 3 impl-adjacent files (docs/JSDoc only — zero production logic)

- Failing-first: S-003's declared red set (`.tmp-readme-copy` example, doc-content scans,
  FIT-06 seed-regex leg) was RED in the batch-2 suite state (verified in
  verify-in-loop-3's buckets) → green now. S-004's declared type-level RED (12 typecheck
  errors on `FactoryRunner`/fixtures in batch 2) → 0 now. Genuine red→green on both slices.
- Banned patterns: none. The ATH-20.1 scan asserts via `toEqual({path, matched: false})`
  (path-labeled, not bare boolean); fence-compile throws with full tsc output on failure.
- Triangulation: ATH-20.1 has positive + red-proof + two adversarial controls; FIT-16
  retirement is deletion (no new logic to triangulate).

## Findings

None blocking. Two items recorded for verify-final:

1. **WARNING (recorded, non-blocking)** — R-3 replica drift risk (see adjudication (b)):
   the scratch-anchor replica can diverge from `defineFactory`'s gate over time
   (unwrapped scan failure; skipped `validateAtRunBoundary`; hardcoded ceiling). Register
   a followup: lockstep pin test or shared helper.
2. **NOTE** — §20 R-3 should be annotated as superseded by this adjudication so S-005/S-006
   executors and verify-final do not flag the deviation as an unruled violation.

---

## Orchestrator action

Exit the batch-3 loop. Batch 4 (S-005 → S-006, strictly ordered) may start. Iteration 1 of
3 used for this batch. Reminder for batch 4: S-005 is the regen freshness gate (expect a
no-op — already spot-proven here, but the slice's own FIT-28-red-first evidence should be
run against the pre-regen committed corpus per its Failing-first line); S-006 requires the
removal dts regen PAIRED with the positive signature assertion in the same slice, and the
FIT-08 `valueAllow` narrowing.
