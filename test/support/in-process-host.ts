// Shared in-process fake host over the ONE ContractFake (extracted from
// runner.integration.test.ts, S-003) — mirrors test/support/frame-host.ts's role for the
// spawned-process e2e, but in-process (no subprocess): every runner-issued request frame is
// answered via dispatchToFake, the same transport shell the spawned e2e uses (FEH-01
// posture, zero re-implemented semantics). The greeting is DEFERRED — callers call
// `sendReady()` explicitly (mirrors FrameHost's own convention) so a run can be held
// genuinely "in flight" (SEC-02's overlap tests, fit-35) before it proceeds.

import { encodeFrame } from "../../src/transport/framing.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";
import type { RunnerIo } from "../../src/transport/runner.ts";
import { dispatchToFake } from "../fake/fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { pushableByteSource } from "./pushable-byte-source.ts";

export interface InProcessHost {
  io: RunnerIo;
  fake: ContractFake;
  requests: Array<{ method: string; params: unknown }>;
  stderrText(): string;
  /** Writes the versioned `ready` handshake frame the runner waits for (WPS-02). */
  sendReady(protocolVersion?: number): void;
}

export function makeInProcessHost(opts: { seed?: Record<string, string> } = {}): InProcessHost {
  const fake = new ContractFake({ seed: opts.seed ?? {} });
  const inbox = pushableByteSource();
  const requests: Array<{ method: string; params: unknown }> = [];
  let stderr = "";

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

  return {
    io,
    fake,
    requests,
    stderrText: () => stderr,
    sendReady(protocolVersion: number = WIRE_PROTOCOL_VERSION): void {
      inbox.push(encodeFrame({ method: "ready", protocolVersion }));
    },
  };
}
