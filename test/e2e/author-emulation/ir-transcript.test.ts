/**
 * Runtime tests for `test/support/ir-transcript.ts` — the capture paths the s-00
 * byte-compare can't reach: multi-flush batch ordering (REQ-ITC-01.1) and the
 * rejected-outcome branch (REQ-GCC-09 shape, R-F verbatim pass-through).
 *
 * Factories here are inline synthetic runs (never SCENARIOS entries — these are capture
 * CONTRACT tests, not corpus scenarios, so no corpus file is committed for them).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory, currentContext } from "../../../src/core/context.ts";
import { create } from "../../../src/commons/index.ts";
import { invalidInput } from "../../../src/core/authoring-error.ts";
import { captureRun } from "../../support/ir-transcript.ts";

describe("ir-transcript — multi-flush capture preserves batch order (REQ-ITC-01.1)", () => {
  it("a factory flushing three times yields three ordered batches and an in-order directive sequence", async () => {
    // Each create + explicit flush emits one single-directive batch; the run-end flush
    // is a no-op on the then-empty buffer, so exactly three batches reach the client.
    const run = defineFactory<void>(async () => {
      create("first.ts", { template: "1", options: {} });
      await currentContext().session.flush();
      create("second.ts", { template: "2", options: {} });
      await currentContext().session.flush();
      create("third.ts", { template: "3", options: {} });
      await currentContext().session.flush();
    });

    const capture = await captureRun(run, undefined);

    expect(capture.error).toBeUndefined();
    expect(capture.emitted.map((b) => b.instructions.length)).toEqual([1, 1, 1]);
    expect(capture.record.informative.batchGrouping).toEqual([
      { directiveCount: 1, protocolVersion: 1 },
      { directiveCount: 1, protocolVersion: 1 },
      { directiveCount: 1, protocolVersion: 1 },
    ]);
    // Emission order survives BOTH the raw flatten and the normalization.
    expect(capture.rawDirectives.map((d) => (d.op === "create" ? d.create.pathTemplate : d.op))).toEqual([
      "first.ts",
      "second.ts",
      "third.ts",
    ]);
    expect(
      capture.record.normative.directives.map((d) => (d.op === "create" ? d.pathTemplate : d.op))
    ).toEqual(["first.ts", "second.ts", "third.ts"]);
  });
});

describe("ir-transcript — rejected outcome carries the verbatim attribution triple (GCC-09, R-F)", () => {
  it("a collision rejection yields outcome rejected, EMPTY directives, and the verbatim reason/verb/path", async () => {
    const run = defineFactory<void>(() => {
      create("a.ts", { template: "A", options: {} });
      create("c.ts", { template: "collides", options: {} });
    });

    // Seeding c.ts makes the second create a path-collision at the emit seam, attributed
    // verb "create" / path "c.ts" by upstream — captureRun must pass all three through
    // untouched (R-F: never relativize, never rewrite).
    const capture = await captureRun(run, undefined, { "c.ts": "existing" });

    expect(capture.record.normative.outcome).toEqual("rejected");
    expect(capture.record.normative.directives).toEqual([]);
    expect(capture.record.normative.rejection).toEqual({
      reason: "path-collision",
      verb: "create",
      path: "c.ts",
    });
    expect(capture.error?.reason).toEqual("path-collision");
    // ADR-0015: a rejected run commits nothing.
    expect(capture.tree.size).toEqual(0);
  });

  it("a rejection with no attributable verb/path serializes both as null, never undefined", async () => {
    // invalidInput mints verb: undefined, path: undefined (REQ-AEC-09) — the absent-field
    // half of R-F's contract: `| undefined` accessors become explicit nulls in the record.
    const run = defineFactory<void>(() => {
      throw invalidInput("invalid input: synthetic capture-contract rejection");
    });

    const capture = await captureRun(run, undefined);

    expect(capture.record.normative.outcome).toEqual("rejected");
    expect(capture.record.normative.directives).toEqual([]);
    expect(capture.record.normative.rejection).toEqual({
      reason: "invalid-input",
      verb: null,
      path: null,
    });
  });
});
