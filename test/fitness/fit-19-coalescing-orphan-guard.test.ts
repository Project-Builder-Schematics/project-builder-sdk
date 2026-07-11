/**
 * FIT-19 (S-001, ADR-0037 — renumbered from the design's "FIT-17": that number is already
 * taken by fit-17-testing-dev-only-bundle.test.ts, landed by stage-4b-testing-harness on
 * main before this branch's ADR/FIT numbering was reconciled).
 *
 * Coalescing orphan guard: a dialect handle whose open directive is drained by a mid-chain
 * (or cross-path — the flush trigger is GLOBAL, ADR-0015) read MUST re-register a FRESH
 * directive — no edit lost, no double-buffer. This is `dialect-handle.ts#ensureOpen()`'s
 * identity check against `Session.pendingSnapshot()`.
 *
 * [permanent-fixture]: stays in the suite forever, independent of REQ-MC-02's own test file
 * (test/core/dialect-handle.test.ts) — belt-and-suspenders coverage tied to the ADR-0037
 * mechanism itself, not just the REQ text.
 *
 * Red-proof (verified during development, not re-toggled at runtime): commenting out
 * `ensureOpen()`'s `session.pendingSnapshot().includes(this.#openDirective)` re-registration
 * guard — i.e. reusing the drained directive reference unconditionally — makes this handle
 * keep accumulating into a directive object no longer in `#pending`; the flush this test
 * observes then emits only ONE `modify` (the pre-read state) and the post-read edit is
 * SILENTLY LOST. This test's two-modify, cumulative-content assertion is exactly what
 * catches that regression.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { makeSpyClient } from "../support/spy-client.ts";
import { toyDialect, type ToyAst } from "../fixtures/toy-dialect/index.ts";

describe("[permanent-fixture] FIT-19 — coalescing orphan guard (ADR-0037)", () => {
  it("a handle whose open directive is drained by a mid-chain read re-registers a fresh one — no edit lost, no double-buffer", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      const handle = toyDialect.find("a.toy").push("first-edit");
      await handle.read(); // drains the open directive (global flush, ADR-0015)
      handle.raw((ast) => {
        (ast as ToyAst).push("second-edit");
      });
      await handle;
    });
    await run(undefined, { client });

    const modifies = emitted
      .flatMap((b) => b.instructions)
      .filter((d): d is { op: "modify"; modify: { path: string; content: string } } => d.op === "modify");

    // No double-buffer: exactly two directives, not one (orphan reuse) and not three+
    // (a duplicate re-open).
    expect(modifies).toHaveLength(2);
    // No edit lost: directive #1 carries ONLY the pre-read edit; directive #2 is
    // CUMULATIVE — both edits present, byte-exact.
    expect(modifies[0]?.modify.content).toBe("seed\nfirst-edit");
    expect(modifies[1]?.modify.content).toBe("seed\nfirst-edit\nsecond-edit");
  });
});
