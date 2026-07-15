// Transport shell over the ONE ContractFake (design § 4.2, FEH-01 posture): framing/dispatch
// only, ZERO re-implemented engine semantics — every method delegates to the normative
// ContractFake (src/testing/contract-fake.ts) and only shapes the WPS-10 response envelope.
// Happy dispatch only in S-000; error-shaping legs (WPS-08 rejections etc.) land in later
// slices. Shared by the in-process integration test AND the spawned e2e, so the dispatch
// exists exactly once.

import type { ContractFake } from "../../src/testing/contract-fake.ts";
import type { Batch } from "../../src/core/wire.ts";
import type { FrameHost } from "../support/frame-host.ts";

export interface HostRequestFrame {
  id: string;
  method: string;
  params: unknown;
}

export interface HostResponseFrame {
  type: "response";
  id: string;
  result: unknown;
}

/**
 * Answers ONE runner-issued reverse-callback request against the fake, per the WPS-10
 * per-method result shapes: `tree.read` → `null` | `{content}`; `ir.emit` →
 * `{appliedCount}`; `ir.commit`/`ir.discard` → `{}`.
 */
export async function dispatchToFake(fake: ContractFake, request: HostRequestFrame): Promise<HostResponseFrame> {
  if (request.method === "tree.read") {
    const { path } = request.params as { path: string };
    const content = await fake.read(path);
    return { type: "response", id: request.id, result: content === undefined ? null : { content } };
  }
  if (request.method === "ir.emit") {
    const { batch } = request.params as { batch: Batch };
    await fake.emit(batch);
    return { type: "response", id: request.id, result: { appliedCount: batch.instructions.length } };
  }
  if (request.method === "ir.commit") {
    await fake.commit();
    return { type: "response", id: request.id, result: {} };
  }
  if (request.method === "ir.discard") {
    await fake.discard();
    return { type: "response", id: request.id, result: {} };
  }
  // Happy-dispatch shell: an unexpected method is a test-setup bug, not an engine semantic.
  throw new Error(`fake-engine-harness: unexpected reverse-callback method "${request.method}"`);
}

export interface SpawnedRunSummary {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  requests: HostRequestFrame[];
}

/**
 * Serves a spawned runner's whole framed session against `fake`: sends the versioned
 * `ready` greeting, answers every request via `dispatchToFake`, and resolves when the
 * runner's stdout closes with the child's exit outcome.
 */
export async function serveSpawnedRunner(
  host: FrameHost,
  fake: ContractFake,
  opts?: { readyVersion?: number }
): Promise<SpawnedRunSummary> {
  host.sendReady(opts?.readyVersion);
  const requests: HostRequestFrame[] = [];

  for (;;) {
    let frame: unknown;
    try {
      frame = await host.next();
    } catch (err) {
      // frame-host throws its stdout-ended error when the runner exits — the session is over.
      if (err instanceof Error && err.message.startsWith("frame-host: stdout ended")) break;
      throw err;
    }
    const request = frame as HostRequestFrame;
    requests.push(request);
    host.send(await dispatchToFake(fake, request));
  }

  const { code, signal } = await host.waitExit();
  return { exitCode: code, signal, stderr: host.stderrText(), requests };
}
