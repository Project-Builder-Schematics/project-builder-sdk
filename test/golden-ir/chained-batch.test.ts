/**
 * REQ-GIR-02: chained-handle Batch fixtures. The SUT is the FACTORY-PRODUCED batch captured
 * via an `emit` spy from a REAL `defineFactory` run — compared against the hand-written,
 * committed fixture, never fixture-vs-itself. `instructions[]` must deep-equal the fixture,
 * exact keys, in author order.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { RENAME_THEN_MOVE, CREATE_THEN_MODIFY } from "./fixtures.ts";

function makeSpy(seed: Record<string, string> = {}): { client: EngineClient; emitted: Batch[] } {
  const fake = new ContractFake({ seed });
  const emitted: Batch[] = [];
  const client: EngineClient = {
    async emit(b) {
      emitted.push(b);
      await fake.emit(b);
    },
    async read(p) {
      return fake.read(p);
    },
    async commit() {
      return fake.commit();
    },
    async discard() {
      return fake.discard();
    },
  };
  return { client, emitted };
}

describe("Chained-handle Batch fixtures (GIR-02)", () => {
  it("rename(path, newName).move(toDir) — emitted batch matches the rename-then-move fixture", async () => {
    const { client, emitted } = makeSpy({ "src/foo.ts": "content" });

    const factory = defineFactory(async () => {
      const { rename } = await import("../../src/commons/index.ts");
      await rename("src/foo.ts", "bar.ts").move("lib").read();
    });
    await factory({}, { client });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(RENAME_THEN_MOVE);
  });

  it("create(path, opts).modify(content) — emitted batch matches the create-then-modify fixture", async () => {
    const { client, emitted } = makeSpy();

    const factory = defineFactory(async () => {
      const { create } = await import("../../src/commons/index.ts");
      await create("src/gen.ts", { template: "export const x = 1;", options: {} })
        .modify("export const x = 2;")
        .read();
    });
    await factory({}, { client });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(CREATE_THEN_MODIFY);
  });
});
