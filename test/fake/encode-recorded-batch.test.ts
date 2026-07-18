/**
 * REQ-TOE-07: `@pbuilder/sdk/testing`'s recorded batches show composite option values in
 * their encoded (wire) string form — never the author's original native array/object shape
 * — whether recorded via a live `create()`/`scaffold()` call OR constructed via the
 * test-side parallel builder (`test/fake/directive-builders.ts`'s `createOp`).
 *
 * [characterization]: TOE-07.1 is a direct consequence of S-000's `encodeOptions` wiring
 * into `DirectiveFactory.create()` (proved here, not newly driven). TOE-07.2 is proven by
 * an EQUIVALENCE test against a HAND-WRITTEN encoded anchor (ADR-03) — `createOp` stays
 * RAW and is never made to call `encodeOptions` itself, so a bug in the real encode path
 * cannot corrupt both sides of the comparison identically.
 */
import { describe, it, expect } from "bun:test";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create } from "../../src/commons/index.ts";
import { collectOps } from "../support/spy-client.ts";
import { createOp } from "./directive-builders.ts";

describe("REQ-TOE-07.1 — a recorded batch's create.options shows the encoded string [characterization]", () => {
  it("options.methods is the JSON-encoded string, not the native array", async () => {
    const result = await runFactoryForTest(() => {
      create("src/widget.ts", { template: "content", options: { methods: [{ name: "load" }] } });
    }, undefined);

    const [recorded] = collectOps(result.emitted, "create");
    expect(recorded?.create.options).toEqual({ methods: '[{"name":"load"}]' });
  });
});

describe("REQ-TOE-07.2 — createOp test builder output matches the real factory for composite options", () => {
  it("the hand-written encoded anchor byte-matches the live factory's recorded output — createOp stays RAW, never calls encodeOptions itself (ADR-03)", async () => {
    const result = await runFactoryForTest(() => {
      create("src/widget.ts", { template: "content", options: { methods: [{ name: "load" }] } });
    }, undefined);
    const [recorded] = collectOps(result.emitted, "create");

    // The absolute anchor: hand-written, not derived by calling encodeOptions — createOp's
    // third argument is written verbatim as `options` (independent oracle).
    const handBuilt = createOp("src/widget.ts", "content", { methods: '[{"name":"load"}]' });
    if (handBuilt.op !== "create") throw new Error("fixture invariant broken: expected a create directive");

    expect(recorded?.create.options).toEqual(handBuilt.create.options);
    // Also pins the anchor's exact byte form directly, not just cross-equality — mirrors
    // REQ-TOE-06.1's "cross-equality alone is insufficient" discipline.
    expect(handBuilt.create.options).toEqual({ methods: '[{"name":"load"}]' });
  });
});
