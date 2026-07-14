/**
 * REQ-ATH-19 (S-001): wrap-parity proof — `runFactoryForTest` MUST delegate to the exact
 * same `defineFactory` seam a manual driver invokes directly (ADR-C single-wrap-seam
 * invariant), never a parallel reimplementation. Two scenarios: happy-path parity —
 * including dialect drain→flush ordering, which only a dialect-USING factory can
 * distinguish from a no-op drain (a factory with no dialect calls cannot tell "drain ran"
 * from "drain was skipped") — and the double-fault path (factory throws `E1`, the
 * harness's own discard subsequently throws `E2`; both drivers must yield
 * `error === E1` with `error.cause === E2`).
 */
import { describe, it, expect, spyOn } from "bun:test";
import { runFactoryForTest, type RunResult } from "../../src/testing/index.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import * as ts from "../../src/dialects/typescript/index.ts";
import { golden } from "../support/golden.ts";
import { runViaManualWrap, FaultyDiscardFake } from "../support/wrap-parity-support.ts";

describe("REQ-ATH-19.1 — happy-path parity, including dialect drain→flush ordering", () => {
  it("runFactoryForTest and a manual defineFactory+client wrap yield identical {tree, emitted, error} for a dialect-using factory", async () => {
    const before = golden("add-import-before.txt");
    const after = golden("add-import-after.txt");
    const fn = async (): Promise<void> => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    };

    const viaHarness = await runFactoryForTest(fn, undefined, { seed: { "a.ts": before } });
    const viaManual = await runViaManualWrap(fn, undefined, { seed: { "a.ts": before } });

    expect(viaHarness.error).toBeUndefined();
    expect(viaManual.error).toBeUndefined();
    // Drain→flush ordering survived identically through both paths — the dialect's
    // buffered `modify` landed in the SAME committed tree, both times.
    expect(viaHarness.tree.get("a.ts")).toEqual(after);
    expect(viaManual.tree.get("a.ts")).toEqual(after);
    expect([...viaHarness.tree]).toEqual([...viaManual.tree]);
    expect(viaHarness.emitted).toEqual(viaManual.emitted);
  });
});

describe("REQ-ATH-19.2 — double-fault parity: E1 wins, E2 attached as .cause", () => {
  it("both drivers yield result.error === E1 with result.error.cause === E2", async () => {
    const e1 = new Error("factory-boom");
    const e2 = new Error("discard-boom");
    const fn = (): void => {
      throw e1;
    };

    // Path A (runFactoryForTest): production `ContractFake.discard()` never rejects on
    // its own (pure in-memory Map clears) — there is no injection point into
    // runFactoryForTest's internally-built fake, so the shared prototype method is
    // intercepted for the duration of THIS call only, then restored.
    const discardSpy = spyOn(ContractFake.prototype, "discard").mockImplementationOnce(() => {
      throw e2;
    });
    let viaHarness: RunResult;
    try {
      viaHarness = await runFactoryForTest(fn, undefined);
    } finally {
      discardSpy.mockRestore();
    }

    // Path B (manual defineFactory + client wrap): drives a hand-built `FaultyDiscardFake`
    // whose `discard()` always rejects with `e2` — the sanctioned reference-path fixture.
    const viaManual = await runViaManualWrap(fn, undefined, { fake: new FaultyDiscardFake({ seed: {} }, e2) });

    expect(viaHarness.error).toBe(e1);
    expect((viaHarness.error as Error).cause).toBe(e2);
    expect(viaManual.error).toBe(e1);
    expect((viaManual.error as Error).cause).toBe(e2);
  });
});
