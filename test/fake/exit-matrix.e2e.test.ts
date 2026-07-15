// REQ-EXC-01.2/.3 (S-002.6, trio completed S-003.5): the spawned runner's exit-code
// taxonomy, proven over REAL stdio — the four mutually-distinct failure classes (1/2/3/4)
// plus the handshake-time legs that all classify as 1 (validation-failure), indistinguishable
// by exit code, only by message text.
//
// REQ-EXC-01.3's handshake trio is now COMPLETE: S-002 covered WPS-02 mismatch + SEC-07
// probe split (a documented duo at the time, since bootstrap-bridge.ts did not exist yet);
// S-003 adds the third leg (BRB-01 bridge contract version mismatch) below, now that
// bootstrap-bridge.ts and its e2e stub (test/fixtures/bridge-bootstrap-stub.ts) exist.

import { describe, it, expect } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frameHostFactory } from "../support/frame-host.ts";
import { serveSpawnedRunner } from "./fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { encodeFrame } from "../../src/transport/framing.ts";
import { FrameReader } from "../../src/transport/frame-reader.ts";
import { WIRE_PROTOCOL_VERSION, BRIDGE_CONTRACT_VERSION } from "../../src/transport/wire-protocol.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const RUNNER_BIN = new URL("../../bin/pbuilder-runner.ts", import.meta.url).pathname;
const BRIDGE_STUB = new URL("../fixtures/bridge-bootstrap-stub.ts", import.meta.url).pathname;
const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;
const COLLIDE_POINTER = `file://${new URL("../fixtures/frame-runner/collide/", import.meta.url).pathname}factory.ts`;
const CRASH_POINTER = `file://${new URL("../fixtures/frame-runner/crash/", import.meta.url).pathname}factory.ts`;

const spawnFrameHost = frameHostFactory();

function spawnRunner(args: string[]) {
  return spawnFrameHost("bun", ["run", RUNNER_BIN, ...args], { cwd: PROJECT_ROOT });
}

function spawnBridge(bridgeVersion: number, args: string[]) {
  return spawnFrameHost("bun", ["run", BRIDGE_STUB, "--bridge-version", String(bridgeVersion), ...args], {
    cwd: PROJECT_ROOT,
  });
}

describe("REQ-EXC-01.2 — four failure classes map to four distinct exit codes", () => {
  it("(a) --input and --input-file together: exit 1, before any factory import", async () => {
    const host = spawnRunner(["--factory", HAPPY_POINTER, "--input", "{}", "--input-file", "/tmp/x.json"]);
    host.sendReady();
    const { code } = await host.waitExit();
    expect(code).toEqual(1);
    expect(host.stderrText()).toContain("--input-file");
  });

  it("(b) a factory write collision: exit 2 (emit-rejection)", async () => {
    const fake = new ContractFake({ seed: {} });
    const host = spawnRunner(["--factory", COLLIDE_POINTER, "--input", "{}"]);
    const run = await serveSpawnedRunner(host, fake);
    expect(run.exitCode).toEqual(2);
  });

  it("(c) a corrupted length prefix mid-run (host sends a frame whose declared body doesn't parse as JSON): exit 3 (transport-fault)", async () => {
    // FrameHost (test/support/frame-host.ts) only ever writes VALID frames (encodeFrame) —
    // by design, every other e2e test speaks real frames. This leg needs to write
    // deliberately INVALID bytes, so it spawns its own raw child directly rather than
    // extending the shared helper's contract for one negative case.
    const child = spawn("bun", ["run", RUNNER_BIN, "--factory", HAPPY_POINTER, "--input", "{}"], {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    try {
      child.stdin.write(encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION }));

      // Wait for the happy fixture's first reverse callback (tree.read) to arrive on
      // stdout before replying — proves the corruption lands MID-RUN, not at the greeting.
      // Uses the SAME FrameReader the production client relies on (not a raw "data" event,
      // which could fire on a partial chunk) — reliable framing, still a raw child process.
      const reader = new FrameReader(child.stdout);
      const frames = reader.frames();
      const request = (await frames.next()).value as { method: string };
      expect(request.method).toEqual("tree.read");

      // frame-reader.ts (S-001) classifies an undecodable body as
      // TransportFault{kind:"malformed"}; this propagates UNWRAPPED through
      // Session.read() (never through Session.flush()'s toAuthoringError degrade — see
      // apply-progress Discoveries) straight to the runner's catch, classified by
      // exit-codes.ts as code 3.
      const garbage = Buffer.from("not-json");
      const corruptFrame = Buffer.alloc(4 + garbage.length);
      corruptFrame.writeUInt32BE(garbage.length, 0);
      garbage.copy(corruptFrame, 4);
      child.stdin.write(corruptFrame);

      const [code] = (await Promise.race([
        once(child, "exit"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out waiting for exit")), 5000)),
      ])) as [number | null];

      expect(code).toEqual(3);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  });

  it("(d) a plain author TypeError thrown mid-run: exit 4 (crash)", async () => {
    const fake = new ContractFake({ seed: {} });
    const host = spawnRunner(["--factory", CRASH_POINTER, "--input", "{}"]);
    const run = await serveSpawnedRunner(host, fake);
    expect(run.exitCode).toEqual(4);
  });
});

describe("REQ-EXC-01.3 — handshake-time failures all classify as code 1 (trio: WPS-02 + SEC-07 + BRB-01)", () => {
  it("WPS-02 protocolVersion mismatch: exit 1, zero reverse callbacks dispatched", async () => {
    const fake = new ContractFake({ seed: {} });
    const host = spawnRunner(["--factory", HAPPY_POINTER, "--input", "{}"]);
    const run = await serveSpawnedRunner(host, fake, { readyVersion: WIRE_PROTOCOL_VERSION + 1 });
    expect(run.exitCode).toEqual(1);
    expect(run.requests).toEqual([]);
  });

  it("SEC-07 single-instance probe split: exit 1, zero reverse callbacks dispatched, the factory's own code never imported", async () => {
    // A factory OUTSIDE this repo with its own node_modules/@pbuilder/sdk — a genuinely
    // different package instance than the spawned runner ships as (mirrors
    // single-instance-probe.unit.test.ts's split fixture). The package's index.js throws
    // at top level: if the probe ever imported it, that throw would surface distinctly.
    const dir = mkdtempSync(join(tmpdir(), "exit-matrix-split-"));
    try {
      const sdkDir = join(dir, "node_modules", "@pbuilder", "sdk");
      mkdirSync(sdkDir, { recursive: true });
      writeFileSync(join(sdkDir, "package.json"), JSON.stringify({ name: "@pbuilder/sdk", version: "0.0.0", main: "index.js" }));
      writeFileSync(join(sdkDir, "index.js"), 'throw new Error("split SDK copy executed");');
      writeFileSync(join(dir, "factory.ts"), 'throw new Error("factory module executed — SEC-07 should have blocked this");');

      const fake = new ContractFake({ seed: {} });
      const host = spawnRunner(["--factory", `file://${dir}/factory.ts`, "--input", "{}"]);
      const run = await serveSpawnedRunner(host, fake);

      expect(run.exitCode).toEqual(1);
      expect(run.requests).toEqual([]);
      expect(run.stderr).not.toContain("factory module executed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("BRB-01 bridge contract version mismatch: exit 1, naming both versions, zero reverse callbacks dispatched, factory never imported", async () => {
    const mismatchedVersion = BRIDGE_CONTRACT_VERSION + 1;
    // CRASH_POINTER's factory throws unconditionally at import — real proof (not inference)
    // that a version mismatch rejects BEFORE any factory-related code runs: if the mismatch
    // check were ever bypassed, this run would surface the crash fixture's own throw instead.
    // No greeting is ever sent — the mismatch check runs before ANY stdin read, so nothing
    // here depends on the wire's handshake at all.
    const host = spawnBridge(mismatchedVersion, ["--factory", CRASH_POINTER, "--input", "{}"]);
    const { code } = await host.waitExit();

    expect(code).toEqual(1);
    expect(host.stderrText()).toContain(String(mismatchedVersion));
    expect(host.stderrText()).toContain(String(BRIDGE_CONTRACT_VERSION));
    expect(host.stderrText()).not.toContain("frame-runner crash fixture");
  });
});
