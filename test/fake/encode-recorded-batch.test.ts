/**
 * REQ-TOE-07: `@pbuilder/sdk/testing`'s recorded batches show composite option values as the
 * native arrays/objects the author passed — the wire form since ADR-0082 — whether recorded
 * via a live `create()`/`scaffold()` call OR constructed via the test-side parallel builder
 * (`test/fake/directive-builders.ts`'s `createOp`).
 *
 * TOE-07.2 is proven by an EQUIVALENCE test against a HAND-WRITTEN anchor (ADR-03) —
 * `createOp` stays RAW and is never made to call `encodeOptions` itself, so a bug in the real
 * path cannot corrupt both sides of the comparison identically.
 */
import { describe, it, expect } from "bun:test";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, AuthoringError } from "../../src/commons/index.ts";
import { collectOps } from "../support/spy-client.ts";
import { createOp } from "./directive-builders.ts";

describe("REQ-TOE-07.1 — a recorded batch's create.options shows the native value", () => {
  it("options.methods is the native array, not a JSON string", async () => {
    const result = await runFactoryForTest(() => {
      create("src/widget.ts", { template: "content", options: { methods: [{ name: "load" }] } });
    }, undefined);

    const [recorded] = collectOps(result.emitted, "create");
    expect(recorded?.create.options).toEqual({ methods: [{ name: "load" }] });
  });
});

describe("REQ-TOE-07.2 — createOp test builder output matches the real factory for composite options", () => {
  it("the hand-written native anchor matches the live factory's recorded output — createOp stays RAW, never calls encodeOptions itself (ADR-03)", async () => {
    const result = await runFactoryForTest(() => {
      create("src/widget.ts", { template: "content", options: { methods: [{ name: "load" }] } });
    }, undefined);
    const [recorded] = collectOps(result.emitted, "create");

    const handBuilt = createOp("src/widget.ts", "content", { methods: [{ name: "load" }] });
    if (handBuilt.op !== "create") throw new Error("fixture invariant broken: expected a create directive");

    expect(recorded?.create.options).toEqual(handBuilt.create.options);
    expect(handBuilt.create.options).toEqual({ methods: [{ name: "load" }] });
  });
});

describe("REQ-TOE-03.3 — a non-finite number nested inside a composite option fails the flush-time round-trip guard", () => {
  it("rejects as unrepresentable-content instead of silently becoming null", async () => {
    const result = await runFactoryForTest(() => {
      create("bad.ts", { template: "x", options: { ratios: [0.5, 0 / 0] } });
    }, undefined);

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("unrepresentable-content");
  });
});

describe("REQ-TOE-03.4 — a -0 nested inside a composite option is sent as 0, as JSON would", () => {
  it("records 0 and the batch is accepted", async () => {
    const result = await runFactoryForTest(() => {
      create("pt.ts", { template: "x", options: { pt: { x: Math.round(-0.4) }, xs: [-0] } });
    }, undefined);

    expect(result.error).toBeUndefined();
    const [recorded] = collectOps(result.emitted, "create");
    const options = recorded?.create.options as { pt: { x: number }; xs: number[] };
    expect(Object.is(options.pt.x, 0)).toBe(true);
    expect(Object.is(options.xs[0], 0)).toBe(true);
  });

  it("a top-level -0 still fails the round-trip guard, as before", async () => {
    const result = await runFactoryForTest(() => {
      create("z.ts", { template: "x", options: { z: -0 } });
    }, undefined);

    expect((result.error as AuthoringError).reason).toEqual("unrepresentable-content");
  });
});
