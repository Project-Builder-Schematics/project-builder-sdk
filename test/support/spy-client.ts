// Shared EngineClient spy: records every emitted Batch while delegating
// to a real ContractFake for read/commit/discard fidelity.
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";
import { ContractFake } from "./contract-fake.ts";

export function makeSpyClient(seed: Record<string, string> = {}): { client: EngineClient; emitted: Batch[] } {
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
