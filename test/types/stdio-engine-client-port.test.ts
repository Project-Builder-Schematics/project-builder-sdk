// REQ-SEC-01 type leg (design § 4.6: "unit+type"): StdioEngineClient must satisfy the
// EngineClient port with the EXACT signatures — no shape change (D2). Characterization pin:
// the behavioural conformance was RED-driven in test/transport/stdio-engine-client.unit.test.ts;
// this locks the compile-time contract so a future signature drift fails here by name.
import { describe, it } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";
import { StdioEngineClient } from "../../src/transport/stdio-engine-client.ts";

describe("REQ-SEC-01 — StdioEngineClient port conformance (type level)", () => {
  it("an instance is assignable to EngineClient", () => {
    expectTypeOf<InstanceType<typeof StdioEngineClient>>().toMatchTypeOf<EngineClient>();
  });

  it("the four methods carry the port's exact signatures", () => {
    expectTypeOf<StdioEngineClient["emit"]>().toEqualTypeOf<(batch: Batch) => Promise<void>>();
    expectTypeOf<StdioEngineClient["read"]>().toEqualTypeOf<(path: string) => Promise<string | undefined>>();
    expectTypeOf<StdioEngineClient["commit"]>().toEqualTypeOf<() => Promise<void>>();
    expectTypeOf<StdioEngineClient["discard"]>().toEqualTypeOf<() => Promise<void>>();
  });
});
