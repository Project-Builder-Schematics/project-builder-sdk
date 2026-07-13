# Judgment-day iter-1 classifier fix, iteration 1

**Change**: schematic-local-files
**Iteration**: 1/3
**Scope**: classifier budget fix delta — commits `d759961` (fix), `1fb4aec` (batch-cap-chunk test reconstruction), `4637f05` (apply-progress)
**Mode**: in-loop (Strict TDD)
**Branch**: feat/schematic-local-files

---

## Verdict: PASS

All five adversarial confirmations hold under independently-constructed fixtures and mutation testing, not just re-reading the fix author's own tests.

### 1. Fix correctness and completeness — CONFIRMED

Read `src/scaffold/classify-transport.ts:142-160` (post-fix). The budget check builds a `prospectiveDirective: Directive` (`{ op: "create", create: { pathTemplate: destPath, template: content, options, ...forceEntry(force) } }`) and measures it via `serializedBatchSize([prospectiveDirective])` — the exact helper `src/testing/contract-fake.ts:65-66` uses at emit (`Buffer.byteLength(JSON.stringify(batch), "utf8")` over the full `Batch` envelope). `destPath`/`options`/`force` are threaded from `expander.ts:146-160` (destPath computed before classify, reordered from the source-only call it replaces) and `scaffold/index.ts:63-78`'s `readTemplateFile` (now taking `destPath`/`options`/`force`, called from `commons/index.ts:196`'s `create({templateFile})` branch).

Built an independent fixture (not reusing the fix author's `test/scaffold/classify-transport.test.ts`): a file whose content JSON-serializes comfortably under `BATCH_CAP_BYTES` but whose full `create` directive — with a realistic, non-trivial `options` payload (`{moduleName, author, tags: [...], nested: {...}}`, not the fix author's own empty-`{}` fixtures) — lands over cap by ~100 bytes of margin (not just 1 byte). Drove it through a real `defineFactory({packageDir})` + `scaffold()` run against `runFactoryForTest` (real `ContractFake`, not a mock):

- `result.error` is `undefined` — the run **succeeds**.
- Exactly one `copyIn` directive is emitted (by-reference route), not a `create`.

**Regression proof**: checked out the parent commit (`2e9fca5`, pre-fix) into an isolated `git worktree` and ran the byte-identical fixture against the pre-fix `classifyTransport`/`expander.ts`/`commons/index.ts`. Result: `result.error.reason === "changes-too-large"` — the run **fails**, exactly the defect the fix claims to close. Post-fix, the same fixture succeeds. This is a genuine before/after proof, not a description taken on faith.

Also confirmed the `.template`/`templateFile` render path (REQ-CCL-05/FEH-02): built a `templateFile` fixture sized the same way (content under cap, directive with realistic options over cap) and drove it through `create("out/rendered.ts", { templateFile: "...", options })`. Result: `result.error` is an `AuthoringError` with `reason: "invalid-input"`, zero `copyIn` directives emitted — it fails loud, never silently degrades to by-reference. Matches `readTemplateFile`'s `failMessages` always being set (unconditional on the caller, not gated on `isTemplateMarked`) in `scaffold/index.ts:73-76`.

### 2. No over-correction regression — CONFIRMED

Same independent-fixture harness: a comfortably-small text file (`"export const tiny = 1;"`) with a realistic (non-empty) `options` payload still classifies by-value — `result.tree.get("out/tiny.ts")` equals the source content verbatim, zero `copyIn` directives emitted. The fix moved the boundary to include real directive overhead; it did not push ordinary small files to by-reference.

### 3. Scrutiny of the batch-cap-chunk.test.ts reconstruction (`1fb4aec`) — CONFIRMED, with one documented scope note

Read `test/scaffold/batch-cap-chunk.test.ts` in full (not just the diff). REQ-04.2 and REQ-04.3's "one byte over" tests now buffer their over-cap directive via a direct `create()` call **before** `scaffold()` runs (never reaching `classifyTransport`), sized so its own solo batch alone exceeds `BATCH_CAP_BYTES`, then scaffold a trivial `tiny.ts` alongside it.

**(a) Still exercises the over-cap-single-directive flush path — yes, and more directly than before.** Traced `expander.ts:135-142` (`pendingCount`/`pendingSize` seeded from `session.pendingSnapshot()`) and the flush guard at `expander.ts:188-193` (`if (pendingCount > 0 && pendingSize + directiveSize + 1 > BATCH_CAP_BYTES)`). Because the oversized directive is pre-buffered, `pendingCount === 1` when `tiny.ts` is processed, so the guard's condition is true and it calls `session.flush()` **explicitly, mid-run** — a code path the *pre-1fb4aec* test never touched (the old solo-scaffolded-file version had `pendingCount === 0` for its one file, so the mid-run guard never fired; the old test's rejection only ever came from `defineFactory`'s unconditional run-end flush). The reconstruction is not a downgrade — it exercises *more* of `expander.ts`'s own machinery than the version it replaced.

**(b) Not vacuous — confirmed by mutation.** Mutated the actual rejection authority, `src/testing/contract-fake.ts:66` (`if (size > BATCH_CAP_BYTES)` → `if (false && size > BATCH_CAP_BYTES)`), in an isolated worktree and re-ran `test/scaffold/batch-cap-chunk.test.ts`: both the REQ-04.2 test and REQ-04.3's "one byte over" test **failed** (`expect(caught).toBeInstanceOf(AuthoringError)` → received `undefined`), proving they genuinely depend on the cap being enforced, not on incidental setup. Reverted cleanly (`git checkout --`).

**(c) Mutating the expander's group-cap flush guard — mixed result, worth flagging.** Mutated `expander.ts:188` (`if (pendingCount > 0 && ...)` → `if (false && pendingCount > 0 && ...)`, i.e. fully disabling the mid-run chunking guard) in an isolated worktree and re-ran the whole file:
- REQ-04.1 (aggregate-under-cap-but-chunked) and REQ-05.1 (cross-chunk atomicity) **failed** as expected — they genuinely depend on the guard's mid-run timing.
- REQ-04.2 and both REQ-04.3 tests **still passed**.

This is not a defect introduced by `1fb4aec` — it is a pre-existing property of REQ-04.2/04.3's design, true of both the old and new test bodies: `expander.ts`'s flush guard is documented in its own code as "a lowering heuristic, not a second size authority" (`expander.ts:73-76`); the actual rejection is always the fake's independent, unconditional `size > BATCH_CAP_BYTES` check at emit (`contract-fake.ts:65-66`), reached either via the guard's mid-run flush or via `defineFactory`'s always-fires run-end flush. Since a batch containing the oversized directive is over cap whether flushed mid-run or at run-end, REQ-04.2/04.3 correctly prove "a solo over-cap group still rejects" (their actual REQ-ID claim) without needing the *chunking timing* logic to be correct — that timing property is REQ-04.1/05.1's job, and those two DO catch guard mutations. Reverted cleanly (`git checkout --`). No finding raised — this is a scope clarification, not a gap; REQ-04.2/04.3 test what they claim to test.

### 4. Spec conformance — CONFIRMED

`openspec/changes/schematic-local-files/specs/content-classification/spec.md` REQ-CCL-02 ("Frame Budget — Symbolic, a Lowering Heuristic Only") already reads: *"The budget is a LOWERING HEURISTIC evaluated against realistic SERIALIZED-batch size (envelope + JSON-escaping overhead included, never raw content bytes alone); the engine/fake emit cap (`BATCH_CAP_BYTES`, `batch-cap-contract`) remains the SOLE size authority."* This text was already envelope-inclusive and never restated a raw byte constant — the fix conforms to it without needing a spec change. `git diff --stat 2e9fca5 681bd27 -- openspec/changes/schematic-local-files/specs/` returns empty — no spec files were touched anywhere in the delta, confirming the commit message's "no spec text change" claim.

REQ-CCL-02.2 and REQ-CCL-02.3's scenario prose in the spec ("serialized frame budget," "serialized measure lands EXACTLY at the budget") is generic enough to already cover the directive-inclusive interpretation; the test-level pins (`soloDirectiveBatchSize`/`soloDirectiveOverhead` helpers, REQ-CCL-02.3 now driving a real `defineFactory`+`scaffold()` run) now correctly target that quantity — verified in the `d759961` diff of `test/scaffold/classify-transport.test.ts`.

### 5. Full suite, typecheck, fitness — CONFIRMED

- `bun test`: **1049 pass, 0 fail**, 2018 `expect()` calls, 123 files, 9.64s. Matches expectation exactly.
- `bunx tsc --noEmit`: clean, zero output.
- `bun test test/fitness/`: **276 pass, 0 fail** (subset already counted in the 1049 total) — FIT-04/FIT-14 and the rest of the fitness suite all green.

---

## Findings

None. No CRITICAL, WARNING, or SUGGESTION issues found against the delta under review.

## Orchestrator action

Exit loop. This delta (the classifier budget fix + its test reconstruction) is sound: the fix is correct, complete, matches the emit authority exactly, does not over-correct, its own regression fixture is independently reproducible pre/post-fix, the reconstructed batch-cap-chunk tests are non-vacuous and mutation-tested (with one documented, non-blocking scope note about which REQ-IDs actually depend on the mid-run chunking guard's timing vs. the fake's independent cap check), spec conformance holds with zero spec drift, and the full suite/typecheck/fitness gate is green.
