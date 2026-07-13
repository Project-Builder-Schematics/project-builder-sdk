# S-003 batch, iteration 1

## Verify In-Loop Result

**Change**: schematic-local-files
**Iteration**: 1/3
**Scope**: S-003 (batch delta: commits `74a9471` feat + `870606a` chore, diff `1d81612..HEAD`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 7/7 (S-003.1–S-003.7, `openspec/changes/schematic-local-files/slices.md:132-149`)
- Affected tests passed: 992/992 (full repo `bun test`, 119 files — in-loop budget allowed full run since it completed in ~8s)
- Typecheck (`tsc --noEmit`): clean
- Spec compliance for scope: all in-scope REQs (FSC-06.2, FEH-03..05, BRC-01/03/05/06/07, DRE-05.1/.2, DRE-06) have passing tests that assert the exact scenario text, verified by direct file reads, not apply-progress summaries
- Assertion audit: clean — no tautologies, no mock-heavy or smoke-only patterns found in the new test files

### Completeness

| Task | Evidence |
|---|---|
| S-003.1 wire+factory | `src/core/wire.ts:39` adds `{op:"copyIn"; copyIn:{from;to;force?}}`; `src/core/directive-factory.ts:110-119` `copyIn(a)` mirrors `copy(a)` exactly |
| S-003.2 AuthoringVerb/verbFor/primaryPath | `src/core/authoring-error.ts:30` (6→7, `+"copyIn"`), `primaryPath` switch (line 157-158: `case "copyIn": return directive.copyIn.from`), `verbFor` needed no change (confirmed correct — `op === "delete" ? "remove" : op` already passes `copyIn` through) |
| S-003.3 expander/classify-transport swap | `src/scaffold/expander.ts:163-175` — by-reference verdict now builds `factory.copyIn(...)`, S-001/S-002 fail-loud throw fully removed |
| S-003.4 fake/vehicle copyIn branch | `src/testing/contract-fake.ts:241-246` (dest-collision only, no `#requireExists`, no `#tree` write); `src/conformance/run-vehicle.ts:73-79` (same shape, ONLY op with new collision machinery, other 6 ops untouched — confirmed via diff) |
| S-003.5 dry-run map | `src/dry-run/plan.ts` — `DryRunVerb`+`"copyIn"`, 7th `WIRE_TO_AUTHOR_VERB` row, `kind:"copied"` always for `copyIn` |
| S-003.6 tests | `test/scaffold/scaffold-fake.test.ts`, `test/fake/copyin-fidelity.test.ts`, `test/skeleton/authoring-error.test.ts` A1 block (line 266-273) all present and pinning the right scenarios |
| S-003.7 ADR amendments | Verified no-op per apply-progress — confirmed the amendment sections already exist in `openspec/decisions/0019-*`/`0025-*`, dated 2026-07-12 |

### Specific Audit Points

**1. Watch item closure (REQ-CCL-04, carried from verify-in-loop-3, advisory) — CLOSED.**
`test/scaffold/scaffold-fake.test.ts:129-162`, `describe("REQ-CCL-04.1 — template-like text renders via scaffold by-value; copyIn is the documented verbatim escape")`. It scaffolds a file containing `{= not_a_real_token =}` and asserts it renders by-value with the literal content in `result.tree`, THEN copyIn's the SAME content and asserts a by-reference directive with the content never landing in `result.tree`. This is exactly the scenario REQ-CCL-04.1 and the design's Test Derivation table pin — the watch item did not slip.

**2. Seam anchor — `copyIn.from` is packageDir-relative — CONFIRMED, both statically and empirically.**
`src/scaffold/expander.ts:147`: `const sourceRelPath = posix.join(args.from, result.sourceRelPath);` — built from `args.from` (scaffold's own arg, itself packageDir-relative per REQ-FSC-01) and the walk-relative path, never touching `packageRoot`/ceiling. Live probe: constructed a scratch package where the containment ceiling (`collection.json`) sits at a directory 2 levels ABOVE `packageDir` (`root/packages/pkg-a`), called `copyIn("asset.svg", "dest/asset.svg")`. Emitted directive: `{"from":"asset.svg","to":"dest/asset.svg"}` — relative to `packageDir`, not to the ceiling (which would have produced `"packages/pkg-a/asset.svg"`) and not absolute. Matches ADR-0043's `[SEAM]` note and REQ-BRC-07 exactly.

**3. Fake boundary (ADR-0045) — CONFIRMED, no source re-validation.**
`src/testing/contract-fake.ts:238-245`: the `copyIn` branch calls only `#rejectIfCollides(to, ...)` — no `#requireExists(from)` call (contrast with the `copy` branch immediately above it, which does call `#requireExists`), and returns before any `#tree` write. `src/conformance/run-vehicle.ts:73-79` mirrors this. Neither fake nor vehicle reads package disk for `copyIn` — the two-phase semantics (SDK-side source validation, engine-side apply) are preserved, not smuggled together.

**4. Run-level atomicity with copyIn in the mix — CONFIRMED via code path + live probe; one ADVISORY test-coverage gap noted.**
`src/scaffold/expander.ts:176-188`: the batch-cap chunk/flush logic (`candidateBatchSize`, `session.buffer(directive)`) operates on `directive` generically — no branch on `directive.op`, so `copyIn` directives are subject to the identical chunking and atomicity path as `create`. Live probe: a scaffold mixing one `create` and one `copyIn` directive in the same batch, with the `copyIn` destination seeded to collide — result: `AuthoringError{reason:"path-collision", verb:"copyIn"}`, `result.tree.size === 0` (the `create` directive's content did not survive despite being processed first). This confirms `discard()`'s single-`#tree` rollback covers mixed-op batches.
ADVISORY (non-blocking): `test/scaffold/batch-cap-chunk.test.ts`'s dedicated REQ-05.1 cross-CHUNK atomicity test (the one exercising a genuine 2-flush split via two ~1.5MiB files) uses `create`-only fixtures — it does not include a `copyIn` directive in the mix. The mechanism is directive-agnostic by construction (confirmed above), so this is not a functional gap, but a stronger regression pin would extend that specific test to include a `copyIn` entry in one of the flushed chunks. This is S-004 test-file territory (already verified/passed) — recorded here as a suggestion for S-005 or a follow-up, not a blocker for S-003.

**5. Provenance of the reported pre-existing `typecheck:permissive-proof` failure — GENUINELY PRE-EXISTING, confirmed on `main`.**
Reproduced on HEAD: `tsc --noEmit -p tsconfig.permissive-proof.json` → `test/types/permissive-proof.ts(35,3): error TS2578: Unused '@ts-expect-error' directive.` (exit 1). Checked out `main` (`04c141e`) detached (after stashing the one pre-existing dirty file) and ran the identical command: **same file, same line, same error, same exit code**. This predates every commit in this change's batch (S-000 through S-003) — the executor's claim is correct. No bisection needed; it is red at the branch's own base commit. Restored the working tree to `feat/schematic-local-files` and popped the stash afterward — confirmed clean (`git status --porcelain` shows only the pre-existing `.sdd/state/schematic-local-files.json` diff that was present before this verify run started).

**6. `bun test` + `tsc --noEmit` + dry-run kind labels — all confirmed by direct execution.**
`bun test`: 992 pass / 0 fail, 119 files. `tsc --noEmit`: clean. Live probe exercising `scaffold()` (mixed text+binary) and `copyIn()` together: `dryRun()` returned `[{"verb":"copyIn","path":"...","kind":"copied"}, {"verb":"create","path":"...","kind":"rendered"}, {"verb":"copyIn","path":"...","kind":"copied"}]` — `create` entries always `"rendered"`, `copyIn` entries always `"copied"`, matching REQ-DRE-05.1/.2 exactly; `result.tree` contained only the `create` entry's path, confirming copyIn is emit-only end-to-end.

### `.d.ts` Baseline Regeneration Scope (per session bundle note)

`git diff 1d81612..HEAD -- test/fitness/dts-baseline/core.authoring-error.d.ts` shows exactly: `AuthoringVerb` union gains `"copyIn"` (6→7) plus one added JSDoc paragraph explaining the growth. Nothing else changed in the file. `test/fitness/pkg-surface-baseline.json` was NOT touched in this batch (confirmed via diff) — matches the claim that S-003 added zero new `src/` files.

### Self-Correction Note (process, not a code finding)

During the permissive-proof provenance check, a `git checkout <sha> -- .` / detach / checkout-back sequence used to inspect `main` left `src/core/context.ts` transiently corrupted in the working tree (`new   <RunContext>()` — the `AsyncLocalStorage` identifier missing) after switching back to the feature branch. This was caught immediately by re-running `bun test`/`tsc`, root-caused to the verification tooling sequence (not any code under review), fixed via `git checkout -- src/core/context.ts`, and re-confirmed green (992/0, clean typecheck) before concluding this report. No code change was made to the repository; the working tree ends this session in the exact state it was in at the start (only the pre-existing `.sdd/state/schematic-local-files.json` diff remains, untouched by this verify pass).

### Findings

**CRITICAL**: None.
**WARNING**: None.
**ADVISORY**:
1. `test/scaffold/batch-cap-chunk.test.ts` REQ-05.1's cross-chunk atomicity test uses only `create` directives — extending it (or a follow-up test) to include a `copyIn` directive in one of the flushed chunks would give this specific atomicity guarantee an explicit regression pin for the by-reference path, not just a structural argument. Non-blocking; the code path is directive-agnostic by construction and was independently confirmed live in this verify pass.

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive.
