/**
 * S-001.1 — ContractFake commit/discard unit: isolated fake-unit scenarios.
 * Exercises commit()/discard() directly — no Session, no defineFactory.
 * Tests the two-phase staging→committed model described in ADR-01.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import type { Batch } from "../../src/core/wire.ts";

function makeBatch(pathTemplate: string, template: string): Batch {
  return {
    protocolVersion: 1,
    force: false,
    instructions: [{ op: "create", create: { pathTemplate, template, options: {} } }],
  };
}

describe("ContractFake — commit/discard isolated unit (REQ-08)", () => {
  it("REQ-08.1 — commit() promotes staging→committed and clears staging", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(makeBatch("src/a.ts", "content-a"));
    // Before commit: content lives in staging, committed is empty.
    expect(fake.stagingTree().size).toEqual(1);
    expect(fake.committedTree().size).toEqual(0);

    await fake.commit();

    // After commit: staging is cleared, committed has the entry.
    expect(fake.committedTree().get("src/a.ts")).toEqual("content-a");
    expect(fake.stagingTree().size).toEqual(0);
  });

  it("REQ-08.2 — discard() clears staging; committed tree is untouched", async () => {
    const fake = new ContractFake({ seed: {} });

    // Establish a committed baseline via emit+commit.
    await fake.emit(makeBatch("src/baseline.ts", "baseline"));
    await fake.commit();

    // Stage additional content — then discard.
    await fake.emit(makeBatch("src/staged.ts", "staged"));
    expect(fake.stagingTree().size).toEqual(1);

    await fake.discard();

    // Staging is gone; committed baseline is intact.
    expect(fake.stagingTree().size).toEqual(0);
    expect(fake.committedTree().get("src/baseline.ts")).toEqual("baseline");
    expect(fake.committedTree().has("src/staged.ts")).toEqual(false);
  });

  it("REQ-08.3 — committed is independent after re-stage + discard", async () => {
    const fake = new ContractFake({ seed: {} });

    // Commit a first entry.
    await fake.emit(makeBatch("src/first.ts", "first"));
    await fake.commit();

    // Stage something new, then discard — committed must not change.
    await fake.emit(makeBatch("src/second.ts", "second"));
    await fake.discard();

    // committed still has only the first entry.
    const committed = fake.committedTree();
    expect(committed.size).toEqual(1);
    expect(committed.get("src/first.ts")).toEqual("first");
  });
});
