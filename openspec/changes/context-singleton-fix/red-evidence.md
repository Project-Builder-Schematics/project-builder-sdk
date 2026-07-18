# Pre-fix RED proof (REQ-MIS-05.2)

Captured 2026-07-19, task S-000.3, against `src/core/context.ts` BEFORE the fix (module-scope
`const als = new AsyncLocalStorage<RunContext>()`, unmodified). Stages here per the Executor
Context Map — rides into the PR description once the PR exists (after S-001 lands).

## Command 1 — the actual test file via `bun test`

```
bun test test/fake/dist-runner-dual-realm.e2e.test.ts
```

Output (verbatim):

```
bun test v1.3.14 (0d9b296a)

test/fake/dist-runner-dual-realm.e2e.test.ts:
41 |     const host = spawnDistRunner({});
42 |
43 |     const run = await serveSpawnedRunner(host, fake);
44 |
45 |     expect(run.signal).toBeNull();
46 |     expect(run.exitCode).toEqual(0);
                              ^
error: expect(received).toEqual(expected)

Expected: 0
Received: 4

      at <anonymous> (/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/test/fake/dist-runner-dual-realm.e2e.test.ts:46:26)
(fail) dist-runner dual-realm regression e2e — built dist runner + src-relative factory (REQ-MIS-01/REQ-MIS-05) > REQ-MIS-05.1: two-instance happy path exits clean — same request sequence and committed output as the source-runner e2e [67.42ms]

 0 pass
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [465.00ms]
```

`bun test` process exit code: `1` (assertion failure — the test correctly failed for the
right reason, not an import/syntax/setup error).

## Command 2 — one-off driver script isolating the SPAWNED RUNNER's own exit code + stderr

The test assertion above only proves `run.exitCode !== 0`. To capture the runner's actual
exit code and stderr verbatim (for the PR description), a throwaway driver script
(`.tmp-red-capture.ts`, deleted after use, never committed) replayed the same spawn +
frame-serve sequence outside the `bun:test` harness:

```
=== RED CAPTURE EVIDENCE ===
exitCode: 4
requests: ["ir.discard"]
stderr: "[pbuilder] factory at test/fixtures/frame-runner/happy: no schema.json found — running WITHOUT schema-derived input validation\npbuilder-runner: run failed\n"
```

## Interpretation (mechanism, not just symptom)

The spawned `dist/bin/pbuilder-runner.js` process exits **4** (unclassified crash), never
reaches `tree.read`, and issues exactly one reverse callback: `ir.discard` (the failure
short-circuits before any directive is emitted, then `defineFactory`'s catch discards the
empty batch). This matches the dual-realm mechanism from design §4.1 exactly:

1. `dist/bin/pbuilder-runner.js` dynamic-imports the `happy` factory by its `file://…factory.ts`
   pointer (src-relative import, corpus convention).
2. `defineFactory` — resolved through the DIST runner's OWN `dist/core/context.js` copy —
   enters its run on ITS module-scope `als`.
3. The factory's `find("seed.txt").read()` call resolves `currentContext()` through the SRC
   copy (`src/core/context.ts`, reached via the factory's `../../../../src/index.ts` import) —
   a DIFFERENT module realm with its OWN never-entered `als`. `als.getStore()` there is
   `undefined`, so `currentContext()` throws `AuthoringError{origin:"authoring-rejected",
   reason:"outside-run"}` — but this AuthoringError instance was constructed by the SRC
   realm's `authoring-error.ts` class.
4. That error propagates up through `defineFactory`'s catch (dist realm) → `ctx.session.discard()`
   fires (the observed lone `ir.discard` request) → the original error re-throws → reaches
   `runner.ts`'s top-level catch (also dist realm).
5. `runner.ts`'s catch does `err instanceof AuthoringError` using the DIST realm's own
   `AuthoringError` class — this is **false**, because `err` is a SRC-realm instance. The
   catch's label therefore falls to the generic `"run failed"` (not the outside-run message
   text) and `classifyExitCode(err)` — same cross-realm `instanceof` failure — falls through
   every branch to the `return 4` default.

Two symptoms of the SAME dual-realm root cause: (a) the run fails at all (dedupe missing —
what this change fixes), AND (b) the failure's own error-classification also misfires
cross-realm (a distinct, DOCUMENTED residual — design's Non-Goals "Residual Hazard #2" /
FU-4 — not claimed to be closed by this change; that hazard is specifically about
`requirePackageAnchors`-reached errors, but the SAME `instanceof` mechanism is visibly at
play here too). The fix (S-000.4) closes (a) by deduping the `als` store itself, so
`currentContext()` never throws in the happy-path dual-realm topology at all — the
`instanceof` misclassification in the catch path becomes moot for THIS scenario because the
throw it would misclassify never happens.

Confirms the new e2e guards the real bug (strict-TDD RED phase, REQ-MIS-05.2): the test
fails pre-fix for the right reason (a real dual-realm run-context failure, not a harness/
import/setup problem), and is expected to pass post-fix (S-000.5).

## PR description material

### Non-Goals (REQ-MIS-07, verbatim from design.md)

- **Residual Hazard #2** — a SRC-constructed `AuthoringError` via `requirePackageAnchors`
  (`create({templateFile})`/`scaffold`/`copyIn`) still crosses the dist/src `instanceof`
  boundary misclassified; that class-identity split lives in `authoring-error.ts`, is NOT M1-reachable →
  **FU-4**.
- **`single-instance-probe.ts` same-package-root false-negative** → **FU-5**.
- **Sibling singletons** (`hadBom`, `astHandlePaths`, `runInFlight`, `realFd1Write`) — swept in
  exploration, verified benign-split, no fix required here.
- **Version-qualified registry key** (ADR-01) — followup once a runtime version constant exists.

(Traceability note: the RED-capture mechanism trace above §Interpretation independently
observed the SAME `instanceof` cross-realm miss Hazard #2 names — for `currentContext()`'s
own outside-run throw, not `requirePackageAnchors`. This is consistent with, not a
contradiction of, Non-Goal (a): Hazard #2 is scoped to the `requirePackageAnchors` family
specifically staying open; the `currentContext()` throw itself is CLOSED by this change — in
the post-fix happy path it never fires at all, so its `instanceof` handling downstream never
gets exercised in the dual-realm topology this change guards.)
