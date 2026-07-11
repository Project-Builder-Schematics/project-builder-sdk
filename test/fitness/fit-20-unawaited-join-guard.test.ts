/**
 * FIT-20 (S-001, ADR-0037 — renumbered from the design's "FIT-18": that number is already
 * taken by fit-18-fake-single-source-parity.test.ts, landed by stage-4b-testing-harness on
 * main before this branch's ADR/FIT numbering was reconciled).
 *
 * Unawaited-join guard (REQ-MC-06): a dialect chain the author never `await`s MUST still
 * complete and emit its `modify` at run end (the run-boundary join drains every registered
 * handle before `session.flush()`); a THROWING unawaited chain MUST reject the run with the
 * contained `"dialect operation failed: "` error and produce NO `unhandledRejection`.
 *
 * [permanent-fixture]: stays in the suite forever, independent of REQ-MC-06's own coverage
 * elsewhere — belt-and-suspenders on the ADR-0037 join mechanism itself.
 *
 * Red-proof (two INDEPENDENT drops, verified during development, not re-toggled at
 * runtime):
 *   (a) removing the `ctx.dialects.drain()` call from `defineFactory` — the happy case
 *       LOSES the edit (chain never runs before flush) and the throwing case's rejection
 *       either never surfaces or leaks as an `unhandledRejection` (no join to catch it).
 *   (b) removing the EAGER shadow-catch in `dialect-handle.ts`'s `#enqueue` while KEEPING
 *       drain — the throwing unawaited case surfaces an `unhandledRejection` in the window
 *       between the op rejecting (during `fn`) and the drain's `settle()` attaching its own
 *       observer, many ticks later.
 */
import { describe, it, expect, afterEach } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { makeSpyClient } from "../support/spy-client.ts";
import { toyDialect } from "../fixtures/toy-dialect/index.ts";

let unhandledRejections: unknown[] = [];
function onUnhandledRejection(reason: unknown): void {
  unhandledRejections.push(reason);
}

afterEach(() => {
  process.off("unhandledRejection", onUnhandledRejection);
  unhandledRejections = [];
});

describe("[permanent-fixture] FIT-20 — unawaited-join guard (ADR-0037, REQ-MC-06)", () => {
  it("a forgotten-await chain still completes and commits at run end, with no unhandledRejection", async () => {
    process.on("unhandledRejection", onUnhandledRejection);
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(() => {
      // Deliberately NOT awaited, NOT stored — the return value is dropped.
      toyDialect.find("a.toy").push("joined-edit");
    });
    await run(undefined, { client });

    // Give any stray unhandledRejection a chance to surface before asserting.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const modifies = emitted
      .flatMap((b) => b.instructions)
      .filter((d): d is { op: "modify"; modify: { path: string; content: string } } => d.op === "modify");
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("seed\njoined-edit");
    expect(unhandledRejections).toEqual([]);
  });

  it("a forgotten-await THROWING chain rejects the run contained, with no unhandledRejection", async () => {
    process.on("unhandledRejection", onUnhandledRejection);
    const { client } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      // Deliberately NOT awaited — the throwing chain's promise is dropped.
      toyDialect.find("a.toy").raw(() => {
        throw new Error("boom");
      });
      // fn stays "in flight" long enough for the chain's own async hops (read-through,
      // parse, the raw() throw) to fully settle #tail to REJECTED *before* `als.run`
      // resolves and the drain gets a chance to attach settle()'s handler — this is the
      // exact pre-drain window the eager shadow-catch exists to close (design §4.3 Q3).
      // Without it, this is where an unhandledRejection would fire.
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: raw() on "a.toy" threw');
    expect(unhandledRejections).toEqual([]);
  });
});
