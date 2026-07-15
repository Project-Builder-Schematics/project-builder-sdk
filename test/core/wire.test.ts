// REQ-WPS-04 / fit-32 (cap-single-source): `serializedBatchBytes`/`exceedsBatchCap` are the
// ONE place that compares a byte count against `BATCH_CAP_BYTES` — every other cap check in
// transport + fake + harness routes through `exceedsBatchCap` (Batch, for the outbound emit
// leg, or a raw byte count, for the inbound length-prefix leg) rather than re-deriving the
// `>` comparison locally.

import { describe, it, expect } from "bun:test";
import { batchOfSerializedBytes, batchOverSerializedBytes } from "../fake/batch-cap-fixtures.ts";
import { BATCH_CAP_BYTES, exceedsBatchCap, serializedBatchBytes, serializedBatchSize } from "../../src/core/wire.ts";

describe("REQ-WPS-04 — serializedBatchBytes", () => {
  it("measures the exact UTF-8 serialized byte length of the batch envelope", () => {
    const batch = batchOfSerializedBytes(1024);
    expect(serializedBatchBytes(batch)).toEqual(1024);
  });
});

describe("REQ-WPS-04 — exceedsBatchCap (Batch overload, outbound leg)", () => {
  it("Scenario REQ-WPS-04.3 (outbound): a batch at EXACTLY BATCH_CAP_BYTES does not exceed the cap", () => {
    const batch = batchOfSerializedBytes(BATCH_CAP_BYTES);
    expect(exceedsBatchCap(batch)).toBe(false);
  });

  it("Scenario REQ-WPS-04.1: a batch strictly over BATCH_CAP_BYTES exceeds the cap", () => {
    const batch = batchOverSerializedBytes(BATCH_CAP_BYTES);
    expect(exceedsBatchCap(batch)).toBe(true);
  });
});

describe("REQ-WPS-04 — exceedsBatchCap (raw byte-count overload, inbound leg)", () => {
  it("Scenario REQ-WPS-04.3 (inbound): a declared length of EXACTLY BATCH_CAP_BYTES does not exceed the cap", () => {
    expect(exceedsBatchCap(BATCH_CAP_BYTES)).toBe(false);
  });

  it("Scenario REQ-WPS-04.2: a declared length one byte over BATCH_CAP_BYTES exceeds the cap", () => {
    expect(exceedsBatchCap(BATCH_CAP_BYTES + 1)).toBe(true);
  });

  it("Scenario REQ-WPS-04.4: a declared length of 0x80000000 (negative if signed-read) exceeds the cap, never misread as negative/small (m9)", () => {
    // 0x80000000 = 2_147_483_648 — negative as a signed 32-bit int, but a valid large
    // unsigned value; must be classified over-cap, never accepted as a small/negative length.
    expect(exceedsBatchCap(0x80000000)).toBe(true);
  });
});

describe("serializedBatchSize delegates to serializedBatchBytes (single source, no drift)", () => {
  it("returns the identical byte count serializedBatchBytes would compute for the same envelope", () => {
    const instructions = [{ op: "delete" as const, delete: { path: "a.ts" } }];
    const batch = { protocolVersion: 1 as const, force: false, instructions };
    expect(serializedBatchSize(instructions)).toEqual(serializedBatchBytes(batch));
  });
});
