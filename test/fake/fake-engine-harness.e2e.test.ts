// Walking-skeleton e2e (S-000.8, design § 4.2b flow 1): the scripted fake host spawns the
// REAL runner bin over REAL stdio, speaks the framed wire, and proves the whole seam:
// versioned ready accepted -> one tree.read round-trips BY VALUE -> ir.emit applies ->
// advisory ir.commit acks -> exit 0. The adversarial matrix grows here in later slices.

import { describe, it, expect } from "bun:test";
import { frameHostFactory } from "../support/frame-host.ts";
import { serveSpawnedRunner } from "./fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const RUNNER_BIN = new URL("../../bin/pbuilder-runner.ts", import.meta.url).pathname;
const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;

const spawnFrameHost = frameHostFactory();

function spawnRunner(input: unknown) {
  return spawnFrameHost(
    "bun",
    ["run", RUNNER_BIN, "--factory", HAPPY_POINTER, "--input", JSON.stringify(input)],
    { cwd: PROJECT_ROOT }
  );
}

describe("walking skeleton e2e — spawned runner over real stdio", () => {
  it("completes one framed run end-to-end: ready, tree.read by value, ir.emit applies, ir.commit acks, exit 0", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "hello from seed" } });
    const host = spawnRunner({});

    const run = await serveSpawnedRunner(host, fake);

    expect(run.signal).toBeNull();
    expect(run.exitCode).toEqual(0);
    // The runner issued exactly the skeleton's reverse-callback sequence — all allowlisted (WPS-05).
    expect(run.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    // tree.read round-tripped BY VALUE: the emitted content embeds what the host served.
    expect(run.requests[0]?.params).toEqual({ path: "seed.txt" });
    expect(fake.committedTree().get("out.txt")).toEqual("read:hello from seed");
  });

  it("REQ-WPS-02.2 over real stdio: mismatched ready exits 1 naming both versions, zero callbacks dispatched", async () => {
    const fake = new ContractFake({ seed: {} });
    const host = spawnRunner({});

    const run = await serveSpawnedRunner(host, fake, { readyVersion: 999 });

    expect(run.exitCode).toEqual(1);
    expect(run.requests).toEqual([]);
    expect(run.stderr).toContain("999");
    expect(run.stderr).toContain("1");
  });
});
