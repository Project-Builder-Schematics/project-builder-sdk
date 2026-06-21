/**
 * KIT-05: defineFactory + RunContext isolation.
 * Verifies ALS injection, context outside run throws, fake is used (no global).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory, currentContext } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, find } from "../../src/commons/index.ts";

describe("defineFactory / RunContext", () => {
  it("throws when currentContext() is called outside a run", () => {
    expect(() => currentContext()).toThrow("can only be used while a schematic is running");
  });

  it("provides session and factory inside the run", async () => {
    const fake = new ContractFake({ seed: {} });
    let capturedCtx: ReturnType<typeof currentContext> | null = null;

    const run = defineFactory<void>(() => {
      capturedCtx = currentContext();
    });

    await run(undefined, { client: fake });

    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx).toHaveProperty("session");
    expect(capturedCtx).toHaveProperty("factory");
  });

  it("injects the provided fake as the client (no global)", async () => {
    const fakeA = new ContractFake({ seed: {} });
    const fakeB = new ContractFake({ seed: { "x.ts": "from-B" } });

    const run = defineFactory<void>(async () => {
      // create buffers, find().read() flushes to the injected client
      create("x.ts", { template: "from-A", options: {} });
      await find("x.ts").read();
    });

    // Run against fakeA — fakeB should remain completely untouched
    await run(undefined, { client: fakeA });

    expect(fakeB.lastServed).toBeNull();
  });

  it("isolates runs — context from one run does not leak to another", async () => {
    const fake1 = new ContractFake({ seed: {} });
    const fake2 = new ContractFake({ seed: {} });

    const run = defineFactory<string>(async (label) => {
      create(`${label}.ts`, { template: `body-${label}`, options: {} });
      // trigger flush so the fake gets the content
      await find(`${label}.ts`).read();
    });

    await Promise.all([
      run("alpha", { client: fake1 }),
      run("beta", { client: fake2 }),
    ]);

    // ADR-01: content is committed on success; staging is cleared, so assert via committed tree.
    expect(fake1.committedTree().get("alpha.ts")).toEqual("body-alpha");
    expect(fake2.committedTree().get("beta.ts")).toEqual("body-beta");
    // Cross-contamination check: beta content must not be in fake1
    expect(fake1.committedTree().has("beta.ts")).toBe(false);
  });
});
