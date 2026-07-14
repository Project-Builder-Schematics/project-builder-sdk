/**
 * batch-cap-contract REQ-01: 4 MiB cap enforced at ContractFake#emit, measured as
 * UTF-8 bytes of the serialized Batch (ADR-0019). Exactly-at-cap passes; strictly
 * over rejects. `Session.flush` performs no size check of its own — only the fake
 * (engine stand-in) judges size, matching ADR-0018.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import { replaceContent } from "../../src/commons/index.ts";
import {
  batchOfSerializedBytes,
  batchOverSerializedBytes,
  rawContentBytes,
  FIXTURE_PATH,
} from "./batch-cap-fixtures.ts";
import { rejectedRun } from "../support/rejection-capture.ts";

// `replaceContent` requires an existing target (ADR-0017 rule 2) — these fixtures exercise
// the size cap, not modify-existence, so every fake here is seeded with FIXTURE_PATH present.
function seededFake(): ContractFake {
  return new ContractFake({ seed: { [FIXTURE_PATH]: "" } });
}

describe("REQ-01.1 — exactly-at-cap batch resolves", () => {
  it("a batch serialized to exactly BATCH_CAP_BYTES is accepted at emit", async () => {
    const fake = seededFake();
    const batch = batchOfSerializedBytes(BATCH_CAP_BYTES);
    expect(Buffer.byteLength(JSON.stringify(batch), "utf8")).toEqual(BATCH_CAP_BYTES);

    await expect(fake.emit(batch)).resolves.toBeUndefined();
  });
});

describe("REQ-01.2 — one byte over rejects, even though raw content bytes total below the cap", () => {
  it("rejects a batch whose serialized size exceeds the cap while its raw content stays under it", async () => {
    const fake = seededFake();
    const batch = batchOverSerializedBytes(BATCH_CAP_BYTES);

    const raw = rawContentBytes(batch);
    const serialized = Buffer.byteLength(JSON.stringify(batch), "utf8");
    // Fixture property (mutant-killer): a raw-content measurer would wrongly pass this
    // batch — raw stays under the cap while the serialized envelope sails over it.
    expect(raw).toBeLessThan(BATCH_CAP_BYTES);
    expect(serialized).toBeGreaterThan(BATCH_CAP_BYTES);

    await expect(fake.emit(batch)).rejects.toThrow(/exceeds/);
  });
});

describe("REQ-01.3 — SDK never pre-validates; the rejection originates from the fake", () => {
  it("Session.flush calls emit() unconditionally — the oversized batch is rejected by the fake, not by session.ts", async () => {
    const fake = seededFake();
    const emitSpy = spyOn(fake, "emit");
    const overCap = batchOverSerializedBytes(BATCH_CAP_BYTES);
    const directive = overCap.instructions[0]!;
    if (directive.op !== "modify") throw new Error("fixture invariant broken: expected a modify directive");
    const { path, content } = directive.modify;

    // Goes through defineFactory → Session.flush → toAuthoringError: cap-exceeded is a
    // BATCH-level rejection (emit-rejection-metadata REQ-ERM-01.2) — no verb/path is
    // fabricated (REQ-14.3), reason is the closed value, appliedCount is 0, and the
    // message follows the batch-level template (REQ-AEC-06.2), never the fake's text.
    const caught = await rejectedRun(fake, () => {
      replaceContent(path, content);
    });
    expect(caught).toBeInstanceOf(AuthoringError);
    const authoringError = caught as AuthoringError;
    expect(authoringError.reason).toEqual("changes-too-large");
    expect(authoringError.verb).toBeUndefined();
    expect(authoringError.path).toBeUndefined();
    expect(authoringError.appliedCount).toEqual(0);
    expect(authoringError.message).toEqual("changes could not be applied: changes-too-large");
    // The fake's emit was actually invoked — Session.flush carries no SDK-side size
    // branch that would short-circuit before reaching the engine seam.
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});
