/**
 * REQ-ATH-16 (S-005, design §Test Derivation): the fake (`ContractFake`) and the
 * conformance kit's own `run-vehicle.ts` transport MUST agree on the ACCEPT/REJECT
 * verdict for the SAME by-reference (`copyIn`) fixture set — valid, missing-source,
 * collision without/with force (REQ-ATH-16.1).
 *
 * Verdict, not reason: `run-vehicle.ts` is architecturally BARRED from importing
 * `EmitRejection`/`EngineClient` (FIT-10's structural port guard, `fit-10-engine-client-
 * port-guard.test.ts` — the allow-list is EXACTLY `src/testing/contract-fake.ts`), so its
 * `copyIn` collision case throws a plain `Error`, not an `EmitRejection`. Through
 * `Session.flush()`'s `toAuthoringError` translation, a non-`EmitRejection` rejection
 * degrades to `reason: "unknown"` — an architecturally-forced divergence from the fake's
 * `reason: "path-collision"`, not a parity bug. REQ-ATH-16.1's own scenario text pins
 * "the same accept/reject verdict per fixture", never an identical `AuthoringReason` —
 * this suite asserts exactly that binary contract, never reason equality.
 *
 * The missing-source fixture is NOT a fake/vehicle-distinguishing case in practice:
 * `copyIn`'s SDK-side containment (`validateSourceContainment`) rejects BEFORE any
 * directive reaches either transport's `emit()` (ADR-0045 division of labor) — both
 * surfaces therefore agree by construction, never by their own collision logic. Included
 * anyway because REQ-ATH-16.1 names it as one of the three fixtures the SAME set must run
 * through both surfaces.
 */
import { describe, it, expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { defineFactory } from "../../src/core/context.ts";
import { copyIn, AuthoringError } from "../../src/commons/index.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { createRunVehicle } from "../../src/conformance/run-vehicle.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";

const scratchDir = scratchDirFactory("copyin-parity-");

type Verdict = "accepted" | "rejected";

async function driveVerdict(
  client: EngineClient,
  packageDir: string,
  factoryBody: () => void
): Promise<Verdict> {
  const run = defineFactory<void>(factoryBody, { packageDir });
  try {
    await run(undefined, { client });
    return "accepted";
  } catch (err) {
    // Every rejection this suite's fixtures produce (SDK-side containment, fake collision,
    // vehicle collision) surfaces as an AuthoringError — a different shape would be a real
    // bug this test should fail loudly on, not swallow.
    expect(err).toBeInstanceOf(AuthoringError);
    return "rejected";
  }
}

describe("REQ-ATH-16.1 — fake/vehicle parity across the SAME copyIn fixture set", () => {
  it("valid copyIn (existing source, non-colliding destination): both surfaces accept", async () => {
    const dir = scratchDir();
    writeFileSync(`${dir}/asset.svg`, "<svg/>", "utf-8");

    const fake = new ContractFake({ seed: {} });
    const fakeVerdict = await driveVerdict(fake, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    const { client: vehicle } = createRunVehicle({});
    const vehicleVerdict = await driveVerdict(vehicle, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    expect(fakeVerdict).toEqual("accepted");
    expect(vehicleVerdict).toEqual("accepted");
  });

  it("missing-source copyIn (in-ceiling path that does not exist): both surfaces reject", async () => {
    const dir = scratchDir();
    // No file written at "missing.svg" — SDK-side containment rejects before either
    // transport's emit() is ever reached (ADR-0045).

    const fake = new ContractFake({ seed: {} });
    const fakeVerdict = await driveVerdict(fake, dir, () => {
      copyIn("missing.svg", "dest/missing.svg");
    });

    const { client: vehicle } = createRunVehicle({});
    const vehicleVerdict = await driveVerdict(vehicle, dir, () => {
      copyIn("missing.svg", "dest/missing.svg");
    });

    expect(fakeVerdict).toEqual("rejected");
    expect(vehicleVerdict).toEqual("rejected");
  });

  it("collision without force (destination already exists): both surfaces reject", async () => {
    const dir = scratchDir();
    writeFileSync(`${dir}/asset.svg`, "<svg/>", "utf-8");

    const fake = new ContractFake({ seed: { "dest/asset.svg": "already here" } });
    const fakeVerdict = await driveVerdict(fake, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    const { client: vehicle } = createRunVehicle({ "dest/asset.svg": "already here" });
    const vehicleVerdict = await driveVerdict(vehicle, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    expect(fakeVerdict).toEqual("rejected");
    expect(vehicleVerdict).toEqual("rejected");
  });

  it("collision with force: true (destination already exists): both surfaces accept (overwrite)", async () => {
    const dir = scratchDir();
    writeFileSync(`${dir}/asset.svg`, "<svg/>", "utf-8");

    const fake = new ContractFake({ seed: { "dest/asset.svg": "already here" } });
    const fakeVerdict = await driveVerdict(fake, dir, () => {
      copyIn("asset.svg", "dest/asset.svg", { force: true });
    });

    const { client: vehicle } = createRunVehicle({ "dest/asset.svg": "already here" });
    const vehicleVerdict = await driveVerdict(vehicle, dir, () => {
      copyIn("asset.svg", "dest/asset.svg", { force: true });
    });

    expect(fakeVerdict).toEqual("accepted");
    expect(vehicleVerdict).toEqual("accepted");
  });
});
