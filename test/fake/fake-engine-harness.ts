// Transport shell over the ONE ContractFake (design § 4.2, FEH-01 posture): framing/dispatch
// only, ZERO re-implemented engine semantics — every method delegates to the normative
// ContractFake (src/testing/contract-fake.ts) and only shapes the WPS-10 response envelope.
// `ir.emit`'s error-shaping leg (S-002, EXC-01.2 item b): a ContractFake rejection is
// caught and shaped into the WPS-08 wire error envelope, same as a real engine host would
// — read/commit/discard stay happy-dispatch-only (their own error legs are S-003+ scope,
// no REQ in this slice needs them). Shared by the in-process integration test AND the
// spawned e2e, so the dispatch exists exactly once.

import type { ContractFake } from "../../src/testing/contract-fake.ts";
import type { Batch } from "../../src/core/wire.ts";
import type { FrameHost } from "../support/frame-host.ts";
import { EmitRejection } from "../../src/core/emit-rejection.ts";

export interface HostRequestFrame {
  id: string;
  method: string;
  params: unknown;
}

export interface HostResponseFrame {
  type: "response";
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: { emitRejectionCode: string; failedIndex?: number; appliedCount: number } };
}

// REQ-WPS-08: the wire's fixed JSON-RPC-style error code for an ir.emit rejection.
const EMIT_REJECTION_ERROR_CODE = -32001;

/**
 * Answers ONE runner-issued reverse-callback request against the fake, per the WPS-10
 * per-method result shapes: `tree.read` → `null` | `{content}`; `ir.emit` →
 * `{appliedCount}` | `error{-32001,data}`; `ir.commit`/`ir.discard` → `{}`.
 */
export async function dispatchToFake(fake: ContractFake, request: HostRequestFrame): Promise<HostResponseFrame> {
  if (request.method === "tree.read") {
    const { path } = request.params as { path: string };
    const content = await fake.read(path);
    return { type: "response", id: request.id, result: content === undefined ? null : { content } };
  }
  if (request.method === "ir.emit") {
    const { batch } = request.params as { batch: Batch };
    try {
      await fake.emit(batch);
      return { type: "response", id: request.id, result: { appliedCount: batch.instructions.length } };
    } catch (err) {
      if (err instanceof EmitRejection) {
        return {
          type: "response",
          id: request.id,
          error: {
            code: EMIT_REJECTION_ERROR_CODE,
            message: err.message,
            data: { emitRejectionCode: err.code, failedIndex: err.failedIndex, appliedCount: err.appliedCount },
          },
        };
      }
      throw err;
    }
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
