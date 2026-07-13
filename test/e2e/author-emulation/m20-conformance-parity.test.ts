/**
 * M-20 — `ContractFake` <-> conformance-vehicle parity, re-asserted on THIS change's OWN
 * by-reference fixture set (author-emulation-generator REQ-ATH-16.1). Richer than
 * upstream `test/conformance/copyin-parity.test.ts`'s minimal `<svg/>`-string fixture:
 * this suite drives the SAME real, committed binary asset
 * (`test/fixtures/author-emulation/assets/logo.png`) the matrix's own M-06 row
 * classifies by-reference, proving parity holds at author-emulation SCALE, not just on a
 * synthetic string.
 *
 * Verdict, not reason (mirrors upstream): `run-vehicle.ts` is architecturally barred
 * from importing `EmitRejection`/`EngineClient` (FIT-10's structural port guard), so its
 * `copyIn` collision throws a plain `Error`, not an `EmitRejection` — an
 * architecturally-forced divergence from the fake's `reason: "path-collision"`, never a
 * parity bug. This suite asserts the accept/reject verdict only.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../../src/core/context.ts";
import { copyIn, AuthoringError } from "../../../src/commons/index.ts";
import { ContractFake } from "../../support/contract-fake.ts";
import { createRunVehicle } from "../../../src/conformance/run-vehicle.ts";
import { PACKAGE_DIR } from "../../fixtures/author-emulation/factory.ts";
import type { EngineClient } from "../../../src/core/engine-client.ts";

type Verdict = "accepted" | "rejected";

// `PACKAGE_DIR` (the author-emulation fixture root) carries a `schema.json` requiring
// `name` — `defineFactory`'s run-boundary validation runs against WHATEVER input is
// passed regardless of the TS type parameter, so a schema-satisfying input is mandatory
// here even though these factory bodies never read it.
const SCHEMA_SATISFYING_INPUT = { name: "Widgets" };

async function driveVerdict(client: EngineClient, factoryBody: () => void): Promise<Verdict> {
  const run = defineFactory<typeof SCHEMA_SATISFYING_INPUT>(factoryBody, { packageDir: PACKAGE_DIR });
  try {
    await run(SCHEMA_SATISFYING_INPUT, { client });
    return "accepted";
  } catch (err) {
    // Every rejection this suite's fixtures produce (SDK-side containment, fake
    // collision, vehicle collision) surfaces as an AuthoringError — a different shape
    // would be a real bug this test should fail loudly on, not swallow.
    expect(err).toBeInstanceOf(AuthoringError);
    return "rejected";
  }
}

describe("M-20 — ContractFake <-> conformance-vehicle parity on this change's own by-reference fixtures (REQ-ATH-16.1)", () => {
  it("valid copyIn (committed asset, non-colliding destination): both surfaces accept", async () => {
    const fake = new ContractFake({ seed: {} });
    const fakeVerdict = await driveVerdict(fake, () => copyIn("assets/logo.png", "m20-parity/logo.png"));

    const { client: vehicle } = createRunVehicle({});
    const vehicleVerdict = await driveVerdict(vehicle, () => copyIn("assets/logo.png", "m20-parity/logo.png"));

    expect(fakeVerdict).toEqual("accepted");
    expect(vehicleVerdict).toEqual("accepted");
  });

  it("missing-source copyIn (in-ceiling path that does not exist): both surfaces reject", async () => {
    const fake = new ContractFake({ seed: {} });
    const fakeVerdict = await driveVerdict(fake, () =>
      copyIn("assets/does-not-exist.png", "m20-parity/missing.png")
    );

    const { client: vehicle } = createRunVehicle({});
    const vehicleVerdict = await driveVerdict(vehicle, () =>
      copyIn("assets/does-not-exist.png", "m20-parity/missing.png")
    );

    expect(fakeVerdict).toEqual("rejected");
    expect(vehicleVerdict).toEqual("rejected");
  });

  it("collision without force (destination already exists): both surfaces reject", async () => {
    const fake = new ContractFake({ seed: { "m20-parity/logo.png": "already here" } });
    const fakeVerdict = await driveVerdict(fake, () => copyIn("assets/logo.png", "m20-parity/logo.png"));

    const { client: vehicle } = createRunVehicle({ "m20-parity/logo.png": "already here" });
    const vehicleVerdict = await driveVerdict(vehicle, () => copyIn("assets/logo.png", "m20-parity/logo.png"));

    expect(fakeVerdict).toEqual("rejected");
    expect(vehicleVerdict).toEqual("rejected");
  });

  it("collision with force: true (destination already exists): both surfaces accept (overwrite)", async () => {
    const fake = new ContractFake({ seed: { "m20-parity/logo.png": "already here" } });
    const fakeVerdict = await driveVerdict(fake, () =>
      copyIn("assets/logo.png", "m20-parity/logo.png", { force: true })
    );

    const { client: vehicle } = createRunVehicle({ "m20-parity/logo.png": "already here" });
    const vehicleVerdict = await driveVerdict(vehicle, () =>
      copyIn("assets/logo.png", "m20-parity/logo.png", { force: true })
    );

    expect(fakeVerdict).toEqual("accepted");
    expect(vehicleVerdict).toEqual("accepted");
  });
});
