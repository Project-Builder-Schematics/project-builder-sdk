/**
 * Pyramid REQ-04.1 — the one true e2e: factory → defineFactory → FAKE virtual tree →
 * committed golden end-state. No engine anywhere: `ContractFake` stands in for the engine
 * at the exact seam a real `EngineClient` would occupy (see `test/support/contract-fake.ts`).
 *
 * Characterization test (spec cross-cutting note, RED-waived): both scenarios exercise
 * author-surface behavior that already exists (create/modify since the founding skeleton,
 * move-with-force since S-1.3) — this file proves and freezes it as the pyramid's e2e layer,
 * it does not drive new production code.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, modify, move } from "../../src/commons/index.ts";

describe("e2e — author-to-tree (pyramid REQ-04.1)", () => {
  it("create then modify commits a golden end-state tree", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("src/greeting.ts", {
        template: "export const greeting = '{{value}}';",
        options: { value: "hello" },
      });
      modify("src/greeting.ts", "export const greeting = 'hello, world';");
    });

    await run(undefined, { client: fake });

    const golden = new Map([["src/greeting.ts", "export const greeting = 'hello, world';"]]);
    expect(fake.committedTree()).toEqual(golden);
  });

  it("move with force overwrites an existing destination — golden end-state (REQ-KIT-03.*, REQ-FAKE-04.m1-m3)", async () => {
    const fake = new ContractFake({
      seed: {
        "src/utils/helper.ts": "export const helper = 1;",
        "src/shared/helper.ts": "export const helper = 0; // stale",
      },
    });

    const run = defineFactory<void>(() => {
      move("src/utils/helper.ts", "src/shared", { force: true });
    });

    await run(undefined, { client: fake });

    const golden = new Map([["src/shared/helper.ts", "export const helper = 1;"]]);
    expect(fake.committedTree()).toEqual(golden);
  });
});
