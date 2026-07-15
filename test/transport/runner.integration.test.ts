// REQ-RUN-05 (+ the skeleton's in-process happy flow and WPS-02's runner-side fail-at-
// greeting): drives runRunner IN PROCESS over an injectable io — no subprocess (spawn-
// dependent tests as late as possible; the spawned leg is fake-engine-harness.e2e.test.ts).
// The host side dispatches through test/fake/fake-engine-harness.ts's dispatchToFake —
// the ONE transport shell over ContractFake, shared with the e2e (zero re-implemented
// semantics, FEH-01 posture).

import { describe, it, expect } from "bun:test";
import { encodeFrame } from "../../src/transport/framing.ts";
import { WIRE_PROTOCOL_VERSION, BRIDGE_CONTRACT_VERSION } from "../../src/transport/wire-protocol.ts";
import { runRunner, type RunnerIo } from "../../src/transport/runner.ts";
import { enterBridge, BridgeVersionMismatchError, type BridgeProtection } from "../../src/transport/bootstrap-bridge.ts";
import { dispatchToFake } from "../fake/fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import frameRunnerSchemaFactory from "../fixtures/frame-runner/schema/factory.ts";
import { pushableByteSource } from "../support/pushable-byte-source.ts";
import { makeInProcessHost } from "../support/in-process-host.ts";

const HAPPY_FIXTURE_DIR = new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname;
const SCHEMA_FIXTURE_DIR = new URL("../fixtures/frame-runner/schema/", import.meta.url).pathname;
const HAPPY_POINTER = `file://${HAPPY_FIXTURE_DIR}factory.ts`;
const SCHEMA_POINTER = `file://${SCHEMA_FIXTURE_DIR}factory.ts`;

// No-op protection: forwards writeFrame straight to the host's own io, and skips the REAL
// fd-1 capture/console redirect — those mutate GLOBAL process state (safe in an isolated
// spawned e2e child, unsafe in bun test's shared process). Mirrors
// single-instance-probe.ts's injectable-resolver pattern.
function testProtection(io: RunnerIo): BridgeProtection {
  return {
    captureFrameWriter: () => io.writeFrame,
    redirectConsole: () => {},
  };
}

describe("runner — in-process walking-skeleton flow", () => {
  it("completes one framed run end-to-end: ready accepted, tree.read by value, ir.emit applies, ir.commit acks, exit 0", async () => {
    const host = makeInProcessHost({ seed: { "seed.txt": "hello from seed" } });
    host.sendReady();

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], host.io);

    expect(exitCode).toEqual(0);
    // tree.read round-tripped BY VALUE: the created file's content embeds what read() returned.
    expect(host.fake.committedTree().get("out.txt")).toEqual("read:hello from seed");
    expect(host.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(host.requests[0]?.params).toEqual({ path: "seed.txt" });
  });

  it("REQ-WPS-02.2: version mismatch exits 1 naming BOTH versions, zero reverse callbacks dispatched", async () => {
    const host = makeInProcessHost({});
    host.sendReady(WIRE_PROTOCOL_VERSION + 1);

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], host.io);

    expect(exitCode).toEqual(1);
    expect(host.requests).toEqual([]);
    expect(host.stderrText()).toContain(String(WIRE_PROTOCOL_VERSION));
    expect(host.stderrText()).toContain(String(WIRE_PROTOCOL_VERSION + 1));
  });

  it("REQ-WPS-02.3: structurally invalid greeting fails exactly like a mismatch — exit 1, zero callbacks", async () => {
    const fake = new ContractFake({ seed: {} });
    const inbox = pushableByteSource();
    const requests: Array<{ method: string }> = [];
    inbox.push(encodeFrame({ protocolVersion: WIRE_PROTOCOL_VERSION })); // no method: "ready"
    const io: RunnerIo = {
      input: inbox.iterable,
      writeFrame(value: unknown): void {
        requests.push(value as { method: string });
        void dispatchToFake(fake, value as { id: string; method: string; params: unknown }).then((response) =>
          inbox.push(encodeFrame(response))
        );
      },
      writeStderr(): void {},
    };

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(1);
    expect(requests).toEqual([]);
  });
});

describe("REQ-RUN-05 — defineFactory wrap with packageDir = dirname(factory)", () => {
  it("Scenario REQ-RUN-05.1 (valid input): the runner-wrapped factory's committed content is identical to packageDir-anchored runFactoryForTest", async () => {
    const seed = { "seed.txt": "parity" };
    const input = { name: "widget" };

    const viaHarness = await runFactoryForTest(frameRunnerSchemaFactory, input, {
      seed,
      packageDir: SCHEMA_FIXTURE_DIR,
    });
    expect(viaHarness.error).toBeUndefined();

    const host = makeInProcessHost({ seed });
    host.sendReady();
    const exitCode = await runRunner(["--factory", SCHEMA_POINTER, "--input", JSON.stringify(input)], host.io);

    expect(exitCode).toEqual(0);
    expect(host.fake.committedTree().get("out.txt")).toEqual(viaHarness.tree.get("out.txt"));
    expect(host.fake.committedTree().get("out.txt")).toEqual("read:parity:name:widget");
  });

  it("Scenario REQ-RUN-05.1 (schema-rejected input): both vehicles reject — validation is anchored to the SAME packageDir", async () => {
    const seed = { "seed.txt": "parity" };
    const badInput = { name: 42 };

    const viaHarness = await runFactoryForTest(
      frameRunnerSchemaFactory as (input: unknown) => Promise<void>,
      badInput,
      { seed, packageDir: SCHEMA_FIXTURE_DIR }
    );
    expect(viaHarness.error).toBeDefined();
    expect(viaHarness.emitted).toEqual([]);

    const host = makeInProcessHost({ seed });
    host.sendReady();
    const exitCode = await runRunner(
      ["--factory", SCHEMA_POINTER, "--input", JSON.stringify(badInput)],
      host.io
    );

    expect(exitCode).toEqual(1);
    // Rejected at the run boundary, before the factory ran: no ir.emit ever crossed the wire.
    expect(host.requests.filter((r) => r.method === "ir.emit")).toEqual([]);
  });
});

describe("REQ-EXC-01 — a host rejection of ir.commit classifies as exit 2, message surfaced (judgment-day F3)", () => {
  it("the host answers ir.commit with an error envelope: exit 2 (host-refused intent), the rejection message reaches stderr", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "commit-reject" } });
    const inbox = pushableByteSource();
    let stderr = "";
    const io: RunnerIo = {
      input: inbox.iterable,
      writeFrame(value: unknown): void {
        const frame = value as { id: string; method: string; params: unknown };
        if (frame.method === "ir.commit") {
          inbox.push(
            encodeFrame({
              type: "response",
              id: frame.id,
              error: { code: -32000, message: "commit refused: run not resolved" },
            })
          );
          return;
        }
        void dispatchToFake(fake, frame).then((response) => inbox.push(encodeFrame(response)));
      },
      writeStderr(text: string): void {
        stderr += text;
      },
    };
    inbox.push(encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION }));

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(2);
    expect(stderr).toContain("commit refused: run not resolved");
  });
});

describe("REQ-BRB-01 — versioned bridge entry, bridge params traverse the SAME gates argv uses", () => {
  it("Scenario REQ-BRB-01.1: a matching bridge version hands off cleanly to the SAME skeleton outcome as argv-spawn", async () => {
    const host = makeInProcessHost({ seed: { "seed.txt": "hello from seed" } });
    host.sendReady();

    const exitCode = await enterBridge(
      BRIDGE_CONTRACT_VERSION,
      { factory: HAPPY_POINTER, input: { kind: "inline", json: "{}" } },
      { input: host.io.input, writeStderr: host.io.writeStderr },
      testProtection(host.io)
    );

    expect(exitCode).toEqual(0);
    expect(host.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(host.fake.committedTree().get("out.txt")).toEqual("read:hello from seed");
  });

  it("Scenario REQ-BRB-01.2: a mismatched bridge version rejects loudly, naming both versions, before any protection/factory-related code runs", async () => {
    const mismatchedVersion = BRIDGE_CONTRACT_VERSION + 1;
    let protectionTouched = false;
    const untouchableProtection: BridgeProtection = {
      captureFrameWriter: () => {
        protectionTouched = true;
        return () => {};
      },
      redirectConsole: () => {
        protectionTouched = true;
      },
    };

    let caught: unknown;
    try {
      await enterBridge(
        mismatchedVersion,
        { factory: HAPPY_POINTER, input: { kind: "inline", json: "{}" } },
        { input: (async function* () {})(), writeStderr: () => {} },
        untouchableProtection
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(BridgeVersionMismatchError);
    expect((caught as Error).message).toContain(String(mismatchedVersion));
    expect((caught as Error).message).toContain(String(BRIDGE_CONTRACT_VERSION));
    expect(protectionTouched).toBe(false);
  });

  it("Scenario REQ-BRB-01.3: a bridge-delivered non-file:// factory pointer is rejected by the SAME RUN-02 gate argv uses", async () => {
    const host = makeInProcessHost({});
    host.sendReady();

    const exitCode = await enterBridge(
      BRIDGE_CONTRACT_VERSION,
      { factory: "https://evil.example/factory.ts", input: { kind: "inline", json: "{}" } },
      { input: host.io.input, writeStderr: host.io.writeStderr },
      testProtection(host.io)
    );

    expect(exitCode).toEqual(1);
    expect(host.requests).toEqual([]);
  });
});
