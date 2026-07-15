// REQ-SEC-01/03/04/05/06/08, REQ-WPS-03/04/05/08/10: the first real EngineClient
// implementer. FIT-10's port allow-list is extended to name this file (ADR-01).
//
// ADR-03 sequential single-in-flight, single pending slot: each reverse callback writes
// exactly one request frame then awaits exactly one response frame — no pending-ID map.
// ADR-02: the SDK owns the read loop; this class receives an already-framed FrameChannel,
// never raw stdio bytes.
//
// Scope boundary (S-000, happy path only) CLOSED by S-001: routing/discard (WPS-03),
// fail-closed propagation (SEC-08), injectable timeout (SEC-05), and the EmitRejection
// precondition/degrade (SEC-04) all now hold.

import type { EngineClient } from "../core/engine-client.ts";
import type { Batch } from "../core/wire.ts";
import { exceedsBatchCap } from "../core/wire.ts";
import { EmitRejection, type EmitRejectionCode } from "../core/emit-rejection.ts";
import { type ReverseMethod, type ResponseFrame, type WireError } from "./wire-protocol.ts";
import { boundMessage } from "./error-text.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

// REQ-SEC-04: directive-level codes carry a failedIndex; batch-level codes never do.
const DIRECTIVE_LEVEL_CODES: ReadonlySet<string> = new Set(["collision", "not-found"]);
const BATCH_LEVEL_CODES: ReadonlySet<string> = new Set(["unrepresentable", "cap", "unknown"]);
const RECOGNIZED_EMIT_REJECTION_CODES: ReadonlySet<string> = new Set([...DIRECTIVE_LEVEL_CODES, ...BATCH_LEVEL_CODES]);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// REQ-SEC-04 / REQ-WPS-08.2/.3: reconstructs EmitRejection from a host's ir.emit rejection,
// honoring the directive-vs-batch-level failedIndex precondition. An out-of-contract
// payload — an unrecognized code, a failedIndex present alongside a batch-level code, or a
// failedIndex that is negative/non-integer — degrades to code:"unknown" with failedIndex
// omitted; NEVER guesses an index, NEVER crashes on a malformed payload. `"unknown"` sent
// explicitly by the host round-trips like any other allowlisted code (WPS-08.3) — it is not
// itself an out-of-contract signal.
function reconstructEmitRejection(error: WireError): EmitRejection {
  const data = error.data;
  const rawCode = data?.emitRejectionCode;
  const rawIndex = data?.failedIndex;

  const recognized = typeof rawCode === "string" && RECOGNIZED_EMIT_REJECTION_CODES.has(rawCode);
  const isDirectiveLevel = recognized && DIRECTIVE_LEVEL_CODES.has(rawCode as string);
  const indexPresent = rawIndex !== undefined;
  const indexValid = isNonNegativeInteger(rawIndex);

  const outOfContract =
    !recognized || (isDirectiveLevel && !indexValid) || (!isDirectiveLevel && indexPresent);

  if (outOfContract) {
    return new EmitRejection("unknown" as EmitRejectionCode, error.message);
  }

  const code = rawCode as EmitRejectionCode;
  return new EmitRejection(
    code,
    error.message,
    isDirectiveLevel ? { failedIndex: rawIndex as number, appliedCount: data?.appliedCount ?? 0 } : undefined
  );
}

export interface FrameChannel {
  write(value: unknown): void;
  read(): Promise<unknown>;
  // REQ-WPS-03: every wire-silent discard (unknown-type frame, stale/foreign response id)
  // still gets a bounded, WPS-07-conformant note to the OPERATOR (stderr on the spawned
  // path) — silent to the wire counterparty, never silent to the operator.
  writeStderr(text: string): void;
}

// REQ-SEC-03: stable, distinguishable identity for a host-rejected commit/discard intent —
// distinct from EmitRejection and OverlappingRunError.
export class IntentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentRejectedError";
  }
}

// REQ-SEC-02: stable, distinguishable identity for an overlapping run-entry invocation —
// thrown by runner.ts's composition-root reentrancy guard, never by this class itself
// (this file only owns the error taxonomy's identities, per design § 4.3).
export class OverlappingRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverlappingRunError";
  }
}

// REQ-SEC-05/08/10: the classified wire-fault identity. `kind` distinguishes WHY the run
// fails closed — a hung host (timeout), an inbound frame over BATCH_CAP_BYTES (oversize),
// JSON that fails to parse or a length-prefix that undercounts its own body (malformed —
// this implementation classifies both under one kind: mechanically indistinguishable once
// the misaligned bytes reach decodeFrameBody, see frame-reader.ts), and stdin ending
// mid-frame or while a callback is pending (eof).
export class TransportFault extends Error {
  readonly kind: "malformed" | "desync" | "oversize" | "timeout" | "eof";

  constructor(kind: TransportFault["kind"], message: string) {
    super(message);
    this.name = "TransportFault";
    this.kind = kind;
  }
}

export class StdioEngineClient implements EngineClient {
  readonly #io: FrameChannel;
  readonly #timeoutMs: number;
  #nextRequestId = 0;

  constructor(io: FrameChannel, opts?: { timeoutMs?: number }) {
    this.#io = io;
    this.#timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async #call(method: ReverseMethod, params: unknown): Promise<ResponseFrame> {
    const id = `s${this.#nextRequestId++}` as const;
    this.#io.write({ type: "request", id, method, params });
    return this.#awaitResponse(id);
  }

  // REQ-SEC-05: bounds the wait for the matching response. A response arriving before the
  // bound resolves normally and clears the timer — no stray rejection ever raised
  // afterward. Expiry rejects TransportFault{kind:"timeout"}; the abandoned read-loop
  // promise is left to settle on its own (never awaited again) but is defused so a LATER
  // rejection (e.g. eventual EOF) never surfaces as an unhandled rejection.
  async #awaitResponse(id: string): Promise<ResponseFrame> {
    const matching = this.#readUntilMatch(id);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new TransportFault("timeout", `timed out after ${this.#timeoutMs}ms waiting for a response to ${id}`));
      }, this.#timeoutMs);
    });
    try {
      return await Promise.race([matching, timeout]);
    } finally {
      clearTimeout(timer);
      matching.catch(() => {
        // Defused: this rejection is only interesting if `matching` won the race above;
        // when `timeout` wins instead, the abandoned promise is never awaited again.
      });
    }
  }

  // REQ-WPS-03: reads raw frames until the one matching `id` arrives, silently discarding
  // (wire-silent, stderr-noted) anything else — an unrecognized/missing type, or a
  // response for a different (stale/foreign) id. A discard never affects this call's
  // ability to keep reading (M16 liveness). Faults thrown by the channel (SEC-08, e.g. a
  // frame-reader TransportFault) propagate through unchanged.
  async #readUntilMatch(id: string): Promise<ResponseFrame> {
    for (;;) {
      const frame = await this.#io.read();
      if (typeof frame !== "object" || frame === null) {
        this.#io.writeStderr(boundMessage(`discarding non-object frame while awaiting response to ${id}`));
        continue;
      }
      const candidate = frame as Record<string, unknown>;
      if (candidate.type !== "response") {
        this.#io.writeStderr(
          boundMessage(`discarding frame with type "${String(candidate.type)}" while awaiting response to ${id}`)
        );
        continue;
      }
      if (candidate.id !== id) {
        this.#io.writeStderr(
          boundMessage(`discarding response for id "${String(candidate.id)}" while awaiting response to ${id}`)
        );
        continue;
      }
      return frame as ResponseFrame;
    }
  }

  // REQ-WPS-04.1: rejects an over-cap batch LOCALLY — never writes the oversized frame to
  // the wire. REQ-SEC-04: a host rejection reconstructs via the failedIndex precondition.
  async emit(batch: Batch): Promise<void> {
    if (exceedsBatchCap(batch)) {
      throw new EmitRejection("cap", `batch exceeds the reject-before-alloc cap — not written to the wire`);
    }
    const response = await this.#call("ir.emit", { batch });
    if (response.error !== undefined) {
      throw reconstructEmitRejection(response.error);
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
