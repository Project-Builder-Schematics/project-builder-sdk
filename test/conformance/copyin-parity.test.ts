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
 * `copyIn`'s SDK-side IO hygiene (`statSourceForRead`, ADR-0077 — no containment ceiling,
 * a `source-not-found` rejection on a nonexistent package-local path) rejects BEFORE any
 * directive reaches either transport's `emit()` — both surfaces therefore agree by
 * construction, never by their own collision logic. Included anyway because REQ-ATH-16.1
 * names it as one of the three fixtures the SAME set must run through both surfaces.
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

interface DriveResult {
  verdict: Verdict;
  /** The rejection's reason — `undefined` when `verdict === "accepted"`. */
  reason?: AuthoringError["reason"];
}

async function driveVerdict(
  client: EngineClient,
  packageDir: string,
  factoryBody: () => void
): Promise<DriveResult> {
  const run = defineFactory<void>(factoryBody, { packageDir });
  try {
    await run(undefined, { client });
    return { verdict: "accepted" };
  } catch (err) {
    // Every rejection this suite's fixtures produce (SDK-side hygiene, fake collision,
    // vehicle collision) surfaces as an AuthoringError — a different shape would be a real
    // bug this test should fail loudly on, not swallow.
    expect(err).toBeInstanceOf(AuthoringError);
    return { verdict: "rejected", reason: (err as AuthoringError).reason };
  }
}

describe("REQ-ATH-16.1 — fake/vehicle parity across the SAME copyIn fixture set", () => {
  it("valid copyIn (existing source, non-colliding destination): both surfaces accept", async () => {
    const dir = scratchDir();
    writeFileSync(`${dir}/asset.svg`, "<svg/>", "utf-8");

    const fake = new ContractFake({ seed: {} });
    const fakeResult = await driveVerdict(fake, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    const { client: vehicle } = createRunVehicle({});
    const vehicleResult = await driveVerdict(vehicle, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    expect(fakeResult.verdict).toEqual("accepted");
    expect(vehicleResult.verdict).toEqual("accepted");
  });

  it("missing-source copyIn (package-local path that does not exist): both surfaces reject with reason source-not-found (REQ-BRC-06.1)", async () => {
    const dir = scratchDir();
    // No file written at "missing.svg" — SDK-side IO hygiene (source-not-found) rejects
    // before either transport's emit() is ever reached, so BOTH surfaces agree on the
    // REASON here too, not merely the accept/reject verdict (unlike the collision cases
    // below, where `run-vehicle.ts`'s structural port guard forces a `reason: "unknown"`
    // divergence from the fake).

    const fake = new ContractFake({ seed: {} });
    const fakeResult = await driveVerdict(fake, dir, () => {
      copyIn("missing.svg", "dest/missing.svg");
    });

    const { client: vehicle } = createRunVehicle({});
    const vehicleResult = await driveVerdict(vehicle, dir, () => {
      copyIn("missing.svg", "dest/missing.svg");
    });

    expect(fakeResult).toEqual({ verdict: "rejected", reason: "source-not-found" });
    expect(vehicleResult).toEqual({ verdict: "rejected", reason: "source-not-found" });
  });

  it("collision without force (destination already exists): both surfaces reject", async () => {
    const dir = scratchDir();
    writeFileSync(`${dir}/asset.svg`, "<svg/>", "utf-8");

    const fake = new ContractFake({ seed: { "dest/asset.svg": "already here" } });
    const fakeResult = await driveVerdict(fake, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    const { client: vehicle } = createRunVehicle({ "dest/asset.svg": "already here" });
    const vehicleResult = await driveVerdict(vehicle, dir, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    expect(fakeResult.verdict).toEqual("rejected");
    expect(vehicleResult.verdict).toEqual("rejected");
  });

  it("collision with force: true (destination already exists): both surfaces accept (overwrite)", async () => {
    const dir = scratchDir();
    writeFileSync(`${dir}/asset.svg`, "<svg/>", "utf-8");

    const fake = new ContractFake({ seed: { "dest/asset.svg": "already here" } });
    const fakeResult = await driveVerdict(fake, dir, () => {
      copyIn("asset.svg", "dest/asset.svg", { force: true });
    });

    const { client: vehicle } = createRunVehicle({ "dest/asset.svg": "already here" });
    const vehicleResult = await driveVerdict(vehicle, dir, () => {
      copyIn("asset.svg", "dest/asset.svg", { force: true });
    });

    expect(fakeResult.verdict).toEqual("accepted");
    expect(vehicleResult.verdict).toEqual("accepted");
  });
});
