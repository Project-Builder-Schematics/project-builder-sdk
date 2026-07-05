/**
 * REQ-GIR-03: emission determinism proof + envelope key-order golden pin.
 * [characterization / RED-waived — determinism pre-exists (Session.flush builds a single
 * plain object per run); this file proves it and freezes it, per the `typed-options-and-read`
 * #2 precedent.] Self-consistency alone is insufficient — the byte output ALSO must equal one
 * committed golden string, fixing envelope key order (protocolVersion, force, instructions)
 * literally.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { GOLDEN_DETERMINISM_STRING } from "./fixtures.ts";

// Fresh fake + fresh client each call — determinism must hold across independent runs,
// not merely within one shared instance.
async function runTwoDirectiveFactory(): Promise<Batch> {
  const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
  let captured: Batch | undefined;
  const client: EngineClient = {
    async emit(b) {
      captured = b;
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

  const factory = defineFactory(async () => {
    const { rename } = await import("../../src/commons/index.ts");
    await rename("src/foo.ts", "bar.ts").move("lib").read();
  });
  await factory({}, { client });

  if (captured === undefined) throw new Error("no batch captured — emit was never called");
  return captured;
}

describe("Golden-IR emission determinism (GIR-03)", () => {
  it("same factory + inputs run twice against fresh fakes produce byte-identical serialized Batch", async () => {
    const batch1 = await runTwoDirectiveFactory();
    const batch2 = await runTwoDirectiveFactory();

    expect(JSON.stringify(batch1)).toEqual(JSON.stringify(batch2));
  });

  it("matches the committed golden byte-string, key order included (protocolVersion, force, instructions)", async () => {
    const batch = await runTwoDirectiveFactory();

    expect(JSON.stringify(batch)).toEqual(GOLDEN_DETERMINISM_STRING);
  });
});
