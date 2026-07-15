// REQ-SEC-01/03/04/05/06/08, REQ-WPS-03/04/05/08/10: the first real EngineClient
// implementer. FIT-10's port allow-list is extended to name this file (ADR-01).
//
// ADR-03 sequential single-in-flight, single pending slot: each reverse callback writes
// exactly one request frame then awaits exactly one response frame — no pending-ID map.
// Single-in-flight is ENFORCED internally (an internal dispatch chain serializes calls), not
// merely assumed from the callers' own sequencing — a concurrent caller can never interleave
// two read loops over the shared channel.
// ADR-02: the SDK owns the read loop; this class receives an already-framed FrameChannel,
// never raw stdio bytes (the ONE encode step it performs — the outbound frame body, for the
// WPS-04.1 cap check — delegates to framing.ts, the codec's single owner).
//
// Scope boundary (S-000, happy path only) CLOSED by S-001: routing/discard (WPS-03),
// fail-closed propagation (SEC-08), injectable timeout (SEC-05), and the EmitRejection
// precondition/degrade (SEC-04) all now hold.

import type { EngineClient } from "../core/engine-client.ts";
import type { Batch } from "../core/wire.ts";
import { exceedsEmitBatchBudget } from "../core/wire.ts";
import { EmitRejection, type EmitRejectionCode } from "../core/emit-rejection.ts";
import { type ReverseMethod, type ResponseFrame, type WireError } from "./wire-protocol.ts";
import { encodeFrameBody, withPreserializedBody } from "./framing.ts";
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
function isRecognizedEmitRejectionCode(value: unknown): value is EmitRejectionCode {
  return typeof value === "string" && RECOGNIZED_EMIT_REJECTION_CODES.has(value);
}

function reconstructEmitRejection(error: WireError): EmitRejection {
  const data = error.data;
  const rawCode = data?.emitRejectionCode;
  const rawIndex = data?.failedIndex;

  if (!isRecognizedEmitRejectionCode(rawCode)) {
    return new EmitRejection("unknown", error.message);
  }

  const isDirectiveLevel = DIRECTIVE_LEVEL_CODES.has(rawCode);
  const indexPresent = rawIndex !== undefined;
  const indexValid = isNonNegativeInteger(rawIndex);

  if ((isDirectiveLevel && !indexValid) || (!isDirectiveLevel && indexPresent)) {
    return new EmitRejection("unknown", error.message);
  }

  return new EmitRejection(
    rawCode,
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

// Module-private control-flow signal: ends an ABANDONED read loop (its caller already
// rejected via timeout) without consuming the frame it was awaiting. Never escapes this
// module — the abandoned loop's promise is defused in #awaitResponse.
class AbandonedCallSignal {}

interface CallState {
  abandoned: boolean;
}

export class StdioEngineClient implements EngineClient {
  readonly #io: FrameChannel;
  readonly #timeoutMs: number;
  #nextRequestId = 0;
  // ADR-03 single-in-flight, enforced HERE: every dispatch chains behind the previous one,
  // so two concurrent public calls can never interleave writes/reads on the shared channel.
  #chain: Promise<unknown> = Promise.resolve();
  // A channel read left pending by a timed-out (abandoned) call. The successor call adopts
  // it instead of issuing a second concurrent read — the frame that eventually satisfies it
  // is consumed exactly once, by the live call, never discarded by a zombie loop.
  #danglingRead: Promise<unknown> | undefined;

  constructor(io: FrameChannel, opts?: { timeoutMs?: number }) {
    this.#io = io;
    this.#timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  #enqueue<T>(dispatch: () => Promise<T>): Promise<T> {
    const run = this.#chain.then(dispatch);
    // The chain must survive a failed dispatch (the failure belongs to that call alone).
    this.#chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async #call(method: ReverseMethod, params: unknown): Promise<ResponseFrame> {
    return this.#enqueue(() => {
      const id = `s${this.#nextRequestId++}` as const;
      this.#io.write({ type: "request", id, method, params });
      return this.#awaitResponse(id);
    });
  }

  // REQ-SEC-05: bounds the wait for the matching response. A response arriving before the
  // bound resolves normally and clears the timer — no stray rejection ever raised
  // afterward. Expiry rejects TransportFault{kind:"timeout"} and marks the call ABANDONED:
  // its read loop stops at the next frame WITHOUT consuming it (no zombie loop discarding a
  // successor's response). The abandoned promise is defused so a later settle never
  // surfaces as an unhandled rejection.
  async #awaitResponse(id: string): Promise<ResponseFrame> {
    const call: CallState = { abandoned: false };
    const matching = this.#readUntilMatch(id, call);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new TransportFault("timeout", `timed out after ${this.#timeoutMs}ms waiting for a response to ${id}`));
      }, this.#timeoutMs);
    });
    try {
      return await Promise.race([matching, timeout]);
    } catch (err) {
      // Timeout won (or the loop itself rejected — then the loop is already finished and
      // this flag is inert): stop the loop before it can consume a successor's frame.
      call.abandoned = true;
      throw err;
    } finally {
      clearTimeout(timer);
      matching.catch(() => {
        // Defused: this rejection is only interesting if `matching` won the race above;
        // when `timeout` wins instead, the abandoned promise is never awaited again.
      });
    }
  }

  // Reads one frame off the shared channel, adopting a dangling read left behind by an
  // abandoned predecessor. An abandoned call NEVER consumes: the settled read stays parked
  // in #danglingRead for the live successor.
  async #readNextFrame(call: CallState): Promise<unknown> {
    const read = (this.#danglingRead ??= this.#io.read());
    let frame: unknown;
    try {
      frame = await read;
    } catch (err) {
      this.#danglingRead = undefined;
      throw call.abandoned ? new AbandonedCallSignal() : err;
    }
    if (call.abandoned) throw new AbandonedCallSignal();
    this.#danglingRead = undefined;
    return frame;
  }

  // REQ-WPS-03: reads raw frames until the one matching `id` arrives, silently discarding
  // (wire-silent, stderr-noted) anything else — an unrecognized/missing type, or a
  // response for a different (stale/foreign) id. A discard never affects this call's
  // ability to keep reading (M16 liveness). Faults thrown by the channel (SEC-08, e.g. a
  // frame-reader TransportFault) propagate through unchanged.
  async #readUntilMatch(id: string, call: CallState): Promise<ResponseFrame> {
    const discard = (what: string): void => {
      this.#io.writeStderr(boundMessage(`discarding ${what} while awaiting response to ${id}`));
    };
    for (;;) {
      const frame = await this.#readNextFrame(call);
      if (typeof frame !== "object" || frame === null) {
        discard("non-object frame");
        continue;
      }
      const candidate = frame as Record<string, unknown>;
      if (candidate.type !== "response") {
        discard(`frame with type "${String(candidate.type)}"`);
        continue;
      }
      if (candidate.id !== id) {
        discard(`response for id "${String(candidate.id)}"`);
        continue;
      }
      return frame as ResponseFrame;
    }
  }

  // REQ-WPS-04.1 (spec V4, judgment-day R2): the outbound cap is enforced via the ONE
  // deterministic batch-anchored measurer (`exceedsEmitBatchBudget`, wire.ts) — the SAME
  // check `ContractFake.emit` runs (FEH-01 parity), independent of this call's request-id
  // length. The budget reserves a fixed allowance bounding every possible envelope's
  // overhead, so an accepted batch's ENCODED FRAME BODY can never exceed BATCH_CAP_BYTES
  // (the inbound leg's measure). An over-budget batch is rejected LOCALLY — no id minted,
  // nothing written to the wire. On acceptance the frame body is serialized exactly ONCE
  // and handed to the writer (withPreserializedBody). REQ-SEC-04: a host rejection
  // reconstructs via the failedIndex precondition.
  async emit(batch: Batch): Promise<void> {
    const response = await this.#enqueue(() => {
      if (exceedsEmitBatchBudget(batch)) {
        throw new EmitRejection(
          "cap",
          "serialized ir.emit batch exceeds the outbound frame-body budget — not written to the wire"
        );
      }
      const id = `s${this.#nextRequestId++}` as const;
      const frame = { type: "request", id, method: "ir.emit", params: { batch } };
      this.#io.write(withPreserializedBody(frame, encodeFrameBody(frame)));
      return this.#awaitResponse(id);
    });
    if (response.error !== undefined) {
      throw reconstructEmitRejection(response.error);
    }
  }

  // REQ-SEC-06: null -> undefined (not-found), {content: ""} -> "" (empty file), never
  // conflated. A host REJECTION (error envelope, WPS-10) throws the same host-refusal
  // identity commit/discard use — never silently resolved as not-found (the trichotomy
  // stays three-way; a refusal is not an absence).
  async read(path: string): Promise<string | undefined> {
    const response = await this.#call("tree.read", { path });
    if (response.error !== undefined) {
      throw new IntentRejectedError(response.error.message);
    }
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
