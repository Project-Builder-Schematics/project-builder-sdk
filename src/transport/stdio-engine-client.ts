// REQ-SEC-01/03/06, REQ-WPS-05/10 (S-000 happy path): the first real EngineClient
// implementer. FIT-10's port allow-list is extended to name this file (ADR-01).
//
// ADR-03 sequential single-in-flight, single pending slot: each reverse callback writes
// exactly one request frame then awaits exactly one response frame — no pending-ID map.
// ADR-02: the SDK owns the read loop; this class receives an already-framed FrameChannel,
// never raw stdio bytes.
//
// Scope boundary (S-000, happy path only — hardened in later slices):
// - emit() does not yet reconstruct EmitRejection from a host rejection (SEC-04, S-001).
// - No injectable timeout yet (SEC-05, S-001) — opts.timeoutMs is accepted for signature
//   stability across slices but unused until S-001 drives its RED test.
// - No WPS-03 routing/discard of stale or unknown-type frames (S-001) — the next frame
//   read is assumed to be the matching response, consistent with the single-in-flight
//   contract this slice covers.

import type { EngineClient } from "../core/engine-client.ts";
import type { Batch } from "../core/wire.ts";
import { EmitRejection, type EmitRejectionCode } from "../core/emit-rejection.ts";
import { type ReverseMethod, type ResponseFrame } from "./wire-protocol.ts";

export interface FrameChannel {
  write(value: unknown): void;
  read(): Promise<unknown>;
}

// REQ-SEC-03: stable, distinguishable identity for a host-rejected commit/discard intent —
// distinct from EmitRejection and (in a later slice) OverlappingRunError.
export class IntentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentRejectedError";
  }
}

export class StdioEngineClient implements EngineClient {
  readonly #io: FrameChannel;
  #nextRequestId = 0;

  constructor(io: FrameChannel, _opts?: { timeoutMs?: number }) {
    this.#io = io;
  }

  async #call(method: ReverseMethod, params: unknown): Promise<ResponseFrame> {
    const id = `s${this.#nextRequestId++}` as const;
    this.#io.write({ type: "request", id, method, params });
    return (await this.#io.read()) as ResponseFrame;
  }

  // REQ-SEC-04 (failedIndex precondition, out-of-contract degrade to "unknown") is S-001
  // scope — this happy-path implementation reconstructs EmitRejection directly from the
  // wire shape without the precondition/degrade hardening.
  async emit(batch: Batch): Promise<void> {
    const response = await this.#call("ir.emit", { batch });
    if (response.error !== undefined) {
      const data = response.error.data;
      const code = (data?.emitRejectionCode ?? "unrepresentable") as EmitRejectionCode;
      throw new EmitRejection(
        code,
        response.error.message,
        data?.failedIndex !== undefined ? { failedIndex: data.failedIndex, appliedCount: data.appliedCount ?? 0 } : undefined
      );
    }
  }

  // REQ-SEC-06: null -> undefined (not-found), {content: ""} -> "" (empty file), never
  // conflated.
  async read(path: string): Promise<string | undefined> {
    const response = await this.#call("tree.read", { path });
    const result = response.result;
    if (result === null || result === undefined) return undefined;
    return (result as { content: string }).content;
  }

  async commit(): Promise<void> {
    const response = await this.#call("ir.commit", {});
    if (response.error !== undefined) {
      throw new IntentRejectedError(response.error.message);
    }
  }

  async discard(): Promise<void> {
    const response = await this.#call("ir.discard", {});
    if (response.error !== undefined) {
      throw new IntentRejectedError(response.error.message);
    }
  }
}
