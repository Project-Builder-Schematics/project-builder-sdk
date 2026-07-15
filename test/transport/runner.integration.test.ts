// REQ-RUN-05 (+ the skeleton's in-process happy flow and WPS-02's runner-side fail-at-
// greeting): drives runRunner IN PROCESS over an injectable io — no subprocess (spawn-
// dependent tests as late as possible; the spawned leg is fake-engine-harness.e2e.test.ts).
// The host side dispatches through test/fake/fake-engine-harness.ts's dispatchToFake —
// the ONE transport shell over ContractFake, shared with the e2e (zero re-implemented
// semantics, FEH-01 posture).

import { describe, it, expect } from "bun:test";
import { encodeFrame } from "../../src/transport/framing.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";
import { runRunner, type RunnerIo } from "../../src/transport/runner.ts";
import { dispatchToFake } from "../fake/fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import frameRunnerSchemaFactory from "../fixtures/frame-runner/schema/factory.ts";

const HAPPY_FIXTURE_DIR = new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname;
const SCHEMA_FIXTURE_DIR = new URL("../fixtures/frame-runner/schema/", import.meta.url).pathname;
const HAPPY_POINTER = `file://${HAPPY_FIXTURE_DIR}factory.ts`;
const SCHEMA_POINTER = `file://${SCHEMA_FIXTURE_DIR}factory.ts`;

// Pushable byte source: the "host->runner stdin" half of the in-process wire.
function pushableByteSource() {
  const pending: Buffer[] = [];
  let wake: (() => void) | undefined;
  let closed = false;

  const iterable: AsyncIterable<Uint8Array> = {
    async *[Symbol.asyncIterator]() {
      for (;;) {
        const chunk = pending.shift();
        if (chunk !== undefined) {
          yield chunk;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };

  return {
    iterable,
    push(chunk: Buffer): void {
      pending.push(chunk);
      wake?.();
      wake = undefined;
    },
    close(): void {
      closed = true;
      wake?.();
      wake = undefined;
    },
  };
}

interface InProcessHost {
  io: RunnerIo;
  fake: ContractFake;
  requests: Array<{ method: string; params: unknown }>;
  stderrText(): string;
}

// The in-process fake host: greeting pushed up-front; every runner-issued request frame is
// answered via dispatchToFake against the ONE ContractFake.
function makeInProcessHost(opts: { seed?: Record<string, string>; readyVersion?: number }): InProcessHost {
  const fake = new ContractFake({ seed: opts.seed ?? {} });
  const inbox = pushableByteSource();
  const requests: Array<{ method: string; params: unknown }> = [];
  let stderr = "";

  inbox.push(encodeFrame({ method: "ready", protocolVersion: opts.readyVersion ?? WIRE_PROTOCOL_VERSION }));

  const io: RunnerIo = {
    input: inbox.iterable,
    writeFrame(value: unknown): void {
      const frame = value as { id: string; method: string; params: unknown };
      requests.push({ method: frame.method, params: frame.params });
      void dispatchToFake(fake, frame).then((response) => {
        inbox.push(encodeFrame(response));
      });
    },
    writeStderr(text: string): void {
      stderr += text;
    },
  };

  return { io, fake, requests, stderrText: () => stderr };
}

describe("runner — in-process walking-skeleton flow", () => {
  it("completes one framed run end-to-end: ready accepted, tree.read by value, ir.emit applies, ir.commit acks, exit 0", async () => {
    const host = makeInProcessHost({ seed: { "seed.txt": "hello from seed" } });

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], host.io);

    expect(exitCode).toEqual(0);
    // tree.read round-tripped BY VALUE: the created file's content embeds what read() returned.
    expect(host.fake.committedTree().get("out.txt")).toEqual("read:hello from seed");
    expect(host.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(host.requests[0]?.params).toEqual({ path: "seed.txt" });
  });

  it("REQ-WPS-02.2: version mismatch exits 1 naming BOTH versions, zero reverse callbacks dispatched", async () => {
    const host = makeInProcessHost({ readyVersion: WIRE_PROTOCOL_VERSION + 1 });

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
    const exitCode = await runRunner(
      ["--factory", SCHEMA_POINTER, "--input", JSON.stringify(badInput)],
      host.io
    );

    expect(exitCode).toEqual(1);
    // Rejected at the run boundary, before the factory ran: no ir.emit ever crossed the wire.
    expect(host.requests.filter((r) => r.method === "ir.emit")).toEqual([]);
  });
});
