// batch-cap-contract REQ-01: deterministic Batch builders for the cap boundary.
// No search, no Date/random — every fixture hits its target byte length by direct
// arithmetic on JSON-escaping ratios, so the tests stay reproducible.

import type { Batch } from "../../src/core/wire.ts";

// Fixed multi-byte + escaping prefix: 3-byte "€" plus an escaped quote, backslash, and
// newline. Present in every fixture so a UTF-16-code-unit measurer AND a measurer that
// ignores JSON escaping both diverge from the correct UTF-8-serialized-byte measure.
const PREFIX = "€\"\\\n";
// Exported so callers can seed a ContractFake with this path present — `modify`
// requires an existing target (ADR-0017 rule 2); these fixtures test the size cap,
// not modify-existence, so the target must already exist in the fake's seed.
export const FIXTURE_PATH = "cap-fixture.txt";

function envelopeBatch(content: string): Batch {
  return {
    protocolVersion: 1,
    force: false,
    instructions: [{ op: "modify", modify: { path: FIXTURE_PATH, content } }],
  };
}

function serializedBytes(batch: Batch): number {
  return Buffer.byteLength(JSON.stringify(batch), "utf8");
}

/**
 * Sum of `Buffer.byteLength` over the batch's content/template fields alone — the
 * measurement a "raw content" mutant would use instead of serializing the envelope.
 */
export function rawContentBytes(batch: Batch): number {
  return batch.instructions.reduce((sum, directive) => {
    if (directive.op === "modify") return sum + Buffer.byteLength(directive.modify.content, "utf8");
    if (directive.op === "create") return sum + Buffer.byteLength(directive.create.template, "utf8");
    return sum;
  }, 0);
}

/**
 * Builds a Batch whose serialized UTF-8 byte length is exactly `target`.
 *
 * Content = the fixed multi-byte/escaping PREFIX + ASCII "a" padding. Each padding "a"
 * contributes exactly 1 serialized byte (no escaping), so the deficit between a
 * prefix-only probe measurement and `target` closes exactly with `deficit` "a"
 * characters — one measurement, no iteration.
 */
export function batchOfSerializedBytes(target: number): Batch {
  const probeBytes = serializedBytes(envelopeBatch(PREFIX));
  const deficit = target - probeBytes;
  if (deficit < 0) {
    throw new Error(
      `batchOfSerializedBytes: target ${target} is smaller than the prefix-only batch (${probeBytes} bytes)`
    );
  }
  const batch = envelopeBatch(PREFIX + "a".repeat(deficit));
  const actual = serializedBytes(batch);
  if (actual !== target) {
    throw new Error(`batchOfSerializedBytes: expected ${target} serialized bytes, built ${actual}`);
  }
  return batch;
}

// Every caller for a given `target` (e.g. BATCH_CAP_BYTES, shared by batch-cap.test.ts
// and emit-rejection.test.ts) wants the identical batch — building it is pure/deterministic,
// so cache by target instead of re-deriving the same content on every call. Safe to share:
// no caller mutates the returned Batch.
const overCache = new Map<number, Batch>();

/**
 * Builds a Batch whose serialized UTF-8 byte length is strictly greater than `target`,
 * while its RAW content byte length (see `rawContentBytes`) stays BELOW `target` —
 * the REQ-01.2 mutant-killer. Padding with `"` characters escapes 1 raw byte into 2
 * serialized bytes (`\"`), so filling most of the content with quotes makes the raw
 * total roughly half the serialized total: comfortably under the cap while the
 * serialized size sails over it. The fixed multi-byte PREFIX stays present so the
 * UTF-16 mutant is distinguishable too.
 */
export function batchOverSerializedBytes(target: number): Batch {
  const cached = overCache.get(target);
  if (cached) return cached;

  const probeBytes = serializedBytes(envelopeBatch(PREFIX));
  // +1 so the result is strictly over `target`, not merely at it.
  const deficit = target - probeBytes + 1;
  if (deficit < 0) {
    throw new Error(
      `batchOverSerializedBytes: target ${target} is smaller than the prefix-only batch (${probeBytes} bytes)`
    );
  }
  // Each '"' pads 1 raw byte into 2 serialized bytes; an odd remainder is closed with
  // a single 1:1 "a" byte so the serialized total still lands past `target` exactly.
  const quoteCount = Math.floor(deficit / 2);
  const remainder = deficit - quoteCount * 2;
  const content = PREFIX + '"'.repeat(quoteCount) + "a".repeat(remainder);
  const batch = envelopeBatch(content);
  const actual = serializedBytes(batch);
  if (actual <= target) {
    throw new Error(`batchOverSerializedBytes: expected > ${target} serialized bytes, built ${actual}`);
  }
  overCache.set(target, batch);
  return batch;
}
