# Verify In-Loop Result

**Change**: typed-options-feeder
**Iteration**: 3/3
**Scope**: S-003 (closing slice)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 6/6 (S-003.1–S-003.6, all `[x]` in slices.md rev 3)
- Scoped tests: 168/168 pass (487 expect() calls, 10 files)
- Full suite: 1962/1962 pass (4243 expect() calls, 186 files) — matches apply-progress.md's own reported count
- Typecheck: `tsc --noEmit` clean, zero errors
- Spec compliance for scope: 14/14 clauses conformant (REQ-TOE-06.1/.2, REQ-TOE-07.1/.2, REQ-TOE-08.1, REQ-TOE-09.1/.2, REQ-CCL-02.1–.4, fit-39)
- Assertion audit: clean (no tautologies/smoke-only found; TOE-06/07/08 anchor against literal strings, not mere cross-equality; fit-39 carries its own discriminating red-proof fixtures)

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive.

---

## Execution Evidence (verbatim)

### Scoped run
```
$ bun test test/scaffold/classify-transport.test.ts test/commons/encode-surface-parity.test.ts test/fake/encode-recorded-batch.test.ts test/dry-run/plan.test.ts test/docs/ test/fitness/fit-39-single-encode-site.test.ts

 168 pass
 0 fail
 487 expect() calls
Ran 168 tests across 10 files. [2.68s]
```

### Full suite
```
$ bun test

 1962 pass
 0 fail
 4243 expect() calls
Ran 1962 tests across 186 files. [45.09s]
```

### Typecheck
```
$ bun run typecheck
$ tsc --noEmit
(clean, no output, exit 0)
```

---

## REQ Conformance Table

| REQ-ID | Check | Evidence | Result |
|---|---|---|---|
| TOE-06.1/.2 | Byte-identical across 3 surfaces, ABSOLUTE anchor | `test/commons/encode-surface-parity.test.ts` — `ANCHOR_METHODS = '[{"name":"load"}]'`; each of inline/scaffold-by-value/templateFile asserted `.toEqual({ methods: ANCHOR_METHODS })` individually (literal-string anchor), THEN cross-checked against each other — not mere cross-equality alone | ✅ COMPLIANT |
| TOE-07.1 | Recorded batch shows encoded string | `test/fake/encode-recorded-batch.test.ts` — `recorded.create.options` equals `{ methods: '[{"name":"load"}]' }` | ✅ COMPLIANT |
| TOE-07.2 | `createOp` stays raw, parity via hand-written anchor | Confirmed `git diff 3ec58d2 -- test/fake/directive-builders.ts` is EMPTY — file untouched by S-003. Parity test uses `createOp(..., { methods: '[{"name":"load"}]' })` (hand-written string, not derived by calling `encodeOptions`) | ✅ COMPLIANT |
| TOE-08.1 | Absence of `options` in `DryRunEntry` | `test/dry-run/plan.test.ts` — `expect(entry).toEqual({ verb, path, kind })` (exact-shape, not partial) + `expect(Object.keys(entry).sort()).toEqual(["kind","path","verb"])`, with an upstream sanity check proving the source directive's options were genuinely non-trivial (not a vacuous pass) | ✅ COMPLIANT |
| TOE-09.1 | Docs: appendix gone, §1 native array, zero `JSON.stringify` | `rg "JSON.stringify\|Appendix\|appendix" docs/create-templates.md` → zero matches. §1 example: `methods: [{ name: "load" }, { name: "save" }]` (native array, line 64) | ✅ COMPLIANT |
| TOE-09.2 | Observability note present, TW-F4-safe | Note present (lines 83–85): "Recorded batches from `@pbuilder/sdk/testing` show these values already in their encoded wire form..." — lowercase "batches" mid-sentence (not sentence-initial capitalized `Batches`/`Directive`), observable-behavior framing (WHAT you'll see), no "the SDK converts/encodes for you" mechanism explanation. `bun test test/docs/` (71 tests, includes `WIRE_INTERNAL_TERMS` scan) green | ✅ COMPLIANT |
| CCL-02.1–.3 | Regression — existing budget-crossing/escaping-inflation/at-cap behavior unchanged | No new production code for .1–.3; scoped + full suite both green, including `classify-transport.test.ts`'s pre-existing CCL-02.1/.2/.3 describe blocks | ✅ COMPLIANT (regression clean) |
| CCL-02.4 | Budget measures post-encode bytes | `git diff 3ec58d2 -- src/scaffold/classify-transport.ts`: `options: encodeOptions(options)` now feeds the `prospectiveDirective` measured by `serializedBatchSize` (was raw `options` before). Unit test (`classifyTransport()` verdict) + integration test (real `scaffold()` run, graceful `copyIn` fallback, no `options` field on the by-reference directive) both green | ✅ COMPLIANT |
| fit-39 | Single encode site, self-proving detector | `test/fitness/fit-39-single-encode-site.test.ts` run directly: sanity checks confirm `directive-factory.ts` defines + `classify-transport.ts` calls `encodeOptions`; full `src/` scan finds zero violations outside the 2-file allow-list; 4 red-proof fixtures inline (2 must-flag: planted `encodeOptions(...)` call, planted options-targeting `JSON.stringify`; 2 must-not-flag: bare comment/import, unrelated `JSON.stringify` on a different field) all pass, proving the detector discriminates rather than trivially passing | ✅ COMPLIANT |

## Measurement Adjudication

verify-plan-3 recorded the classify-transport measurement-time choice (throw-vs-size-only) as design-equivalent, deferring to the Executor. Apply chose: call the shared `encodeOptions` directly inside `classifyTransport` (throws on non-encodable values, same function real `create()` emission uses), documented in apply-progress.md's "Measurement-Choice Rationale" section.

Verified:
- **Does not break CCL-02.1–.3**: those scenarios never carry non-encodable option values (plain strings/composites of encodable content), so the throw path is never on their route — confirmed by the scoped + full suite both passing with zero regressions in `classify-transport.test.ts`'s pre-existing CCL-02.1/.2/.3 blocks.
- **New failure mode is strictly earlier + spec-consistent (TOE-04 scheduling-time contract)**: `classifyTransport` runs per-file inside the expander's loop, BEFORE any directive is buffered into a batch. REQ-TOE-04 requires rejection "at scheduling time... before any directive enters the batch" — throwing during classification satisfies this at least as early as, and typically earlier than, waiting for a by-value verdict to reach `factory.create()`. No spec clause requires the rejection point to be exactly at `factory.create()` — REQ-TOE-04's own text calls the mechanism-of-where-in-the-pipeline a design decision.
- **Single source of truth**: reusing `encodeOptions` (rather than a parallel size-only encoder) means the measured bytes can never drift from the real encoded bytes, and makes `classify-transport.ts` a fit-39-SANCTIONED second call site rather than introducing a duplicate encoding implementation.

Adjudication: the chosen implementation is sound and matches the recorded design-equivalence; no follow-up needed.

## Docs Coherence

`docs/create-templates.md` reads coherently post-surgery:
- No dangling appendix references anywhere in the file (confirmed via `rg`).
- §1's cross-reference to the now-deleted appendix is removed along with the appendix itself.
- The observability note sits naturally at the end of "One options object drives both fields," immediately after the native-array example it describes.
- `bun test test/docs/` — 71/71 pass, including the `WIRE_INTERNAL_TERMS` wire-term ban scan (`EmitRejection`, `Directive`, `Batch`, `\bdelete\b`) and the new TW-F4 sentence-initial-capitalization guards.

## Cross-Check: Files Touched

`git diff 3ec58d2 --stat` (tracked) + untracked file list matches S-003's declared "Files Touched" table in apply-progress.md EXACTLY:

Tracked (modified): `docs/create-templates.md`, `src/scaffold/classify-transport.ts`, `test/commons/encode-surface-parity.test.ts`, `test/dry-run/plan.test.ts`, `test/scaffold/classify-transport.test.ts`
Untracked (created): `test/docs/encode-options-docs.test.ts`, `test/fake/encode-recorded-batch.test.ts`, `test/fitness/fit-39-single-encode-site.test.ts`

No file outside this list was touched. `test/fake/directive-builders.ts` confirmed untouched (empty diff) — `createOp` stays raw per ADR-03.

## Findings

None. Zero CRITICAL, zero WARNING, zero SUGGESTION.
