// src/transport/wire-protocol.ts — wire-level constants, frame shapes, and structural
// guards (WPS-02/03/05/09). design.md § 4.3 Data Model gives these signatures verbatim.

export const WIRE_PROTOCOL_VERSION = 1; // ready.protocolVersion (transport) — DISTINCT from Batch.protocolVersion (IR)
export const BRIDGE_CONTRACT_VERSION = 1; // in-process JS bridge; independent of the wire (BRB-01)
export const REVERSE_CALLBACK_METHODS = ["tree.read", "ir.emit", "ir.commit", "ir.discard"] as const;
export type ReverseMethod = (typeof REVERSE_CALLBACK_METHODS)[number];

export interface ReadyGreeting {
  method: "ready";
  protocolVersion: number;
}

export interface RequestFrame {
  type: "request";
  id: `s${number}`;
  method: ReverseMethod;
  params: unknown;
}

export interface EmitRejectionData {
  emitRejectionCode: "collision" | "not-found" | "unrepresentable" | "cap" | "unknown";
  failedIndex?: number;
  appliedCount: number;
}

export interface WireError {
  code: number;
  message: string;
  data?: EmitRejectionData;
}

export interface ResponseFrame {
  type: "response";
  id: string;
  result?: unknown;
  error?: WireError;
}

// REQ-WPS-02.3: structural validity is method === "ready" plus an integer protocolVersion —
// no other shape (missing field, wrong type, non-integer version) qualifies.
export function isStructurallyValidGreeting(value: unknown): value is ReadyGreeting {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.method === "ready" && typeof candidate.protocolVersion === "number" && Number.isInteger(candidate.protocolVersion);
}

// REQ-WPS-02.1/.2: an exact match against the runner's compiled-in wire version — never a
// range or a >= check.
export function versionMatches(greeting: ReadyGreeting): boolean {
  return greeting.protocolVersion === WIRE_PROTOCOL_VERSION;
}

// REQ-WPS-05: the runner MUST NOT issue any reverse-callback method outside this closed set.
export function isReverseMethod(value: string): value is ReverseMethod {
  return (REVERSE_CALLBACK_METHODS as readonly string[]).includes(value);
}
