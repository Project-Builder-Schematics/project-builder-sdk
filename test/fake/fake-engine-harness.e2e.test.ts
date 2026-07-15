// Walking-skeleton e2e (S-000.8, design § 4.2b flow 1): the scripted fake host spawns the
// REAL runner bin over REAL stdio, speaks the framed wire, and proves the whole seam:
// versioned ready accepted -> one tree.read round-trips BY VALUE -> ir.emit applies ->
// advisory ir.commit acks -> exit 0. The adversarial matrix grows here in later slices.

import { describe, it, expect } from "bun:test";
import { frameHostFactory } from "../support/frame-host.ts";
import { serveSpawnedRunner } from "./fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { BRIDGE_CONTRACT_VERSION } from "../../src/transport/wire-protocol.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const RUNNER_BIN = new URL("../../bin/pbuilder-runner.ts", import.meta.url).pathname;
const BRIDGE_STUB = new URL("../fixtures/bridge-bootstrap-stub.ts", import.meta.url).pathname;
const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;
const SABOTAGE_POINTER = `file://${new URL("../fixtures/frame-runner/sabotage/", import.meta.url).pathname}factory.ts`;

const spawnFrameHost = frameHostFactory();

function spawnRunner(input: unknown) {
  return spawnFrameHost(
    "bun",
    ["run", RUNNER_BIN, "--factory", HAPPY_POINTER, "--input", JSON.stringify(input)],
    { cwd: PROJECT_ROOT }
  );
}

function spawnRunnerWithFactory(factoryPointer: string, input: unknown) {
  return spawnFrameHost(
    "bun",
    ["run", RUNNER_BIN, "--factory", factoryPointer, "--input", JSON.stringify(input)],
    { cwd: PROJECT_ROOT }
  );
}

function spawnBridge(bridgeVersion: number, factoryPointer: string, input: unknown) {
  return spawnFrameHost(
    "bun",
    ["run", BRIDGE_STUB, "--bridge-version", String(bridgeVersion), "--factory", factoryPointer, "--input", JSON.stringify(input)],
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

describe("bridge-path e2e — bootstrap-bridge.ts over real stdio (S-003)", () => {
  it("REQ-BRB-01.1: a matching bridge version hands off cleanly — same skeleton outcome as argv-spawn", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "hello from seed" } });
    const host = spawnBridge(BRIDGE_CONTRACT_VERSION, HAPPY_POINTER, {});

    const run = await serveSpawnedRunner(host, fake);

    expect(run.signal).toBeNull();
    expect(run.exitCode).toEqual(0);
    expect(run.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(fake.committedTree().get("out.txt")).toEqual("read:hello from seed");
  });
});

describe("REQ-BRB-02/REQ-BRB-03/REQ-RUN-08/REQ-SEC-09 — author stdout/console sabotage isolated on BOTH entry paths", () => {
  it("direct-spawn path (RUN-08): a direct process.stdout.write(), console.log(), and a process.stdout reassignment never corrupt the wire; the run still completes", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "hello" } });
    const host = spawnRunnerWithFactory(SABOTAGE_POINTER, {});

    const run = await serveSpawnedRunner(host, fake);

    expect(run.signal).toBeNull();
    expect(run.exitCode).toEqual(0);
    expect(run.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(fake.committedTree().get("out.txt")).toEqual("read:hello");
    // Isolated (redirected), never silently dropped: the sabotage bytes surface on stderr.
    expect(run.stderr).toContain("DIRECT-STDOUT-SABOTAGE-BYTES");
    expect(run.stderr).toContain("CONSOLE-LOG-SABOTAGE");
  });

  it("bridge path (BRB-02/03): the SAME sabotage never corrupts the wire; the run still completes", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "hello" } });
    const host = spawnBridge(BRIDGE_CONTRACT_VERSION, SABOTAGE_POINTER, {});

    const run = await serveSpawnedRunner(host, fake);

    expect(run.signal).toBeNull();
    expect(run.exitCode).toEqual(0);
    expect(run.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(fake.committedTree().get("out.txt")).toEqual("read:hello");
    expect(run.stderr).toContain("DIRECT-STDOUT-SABOTAGE-BYTES");
    expect(run.stderr).toContain("CONSOLE-LOG-SABOTAGE");
  });
});
