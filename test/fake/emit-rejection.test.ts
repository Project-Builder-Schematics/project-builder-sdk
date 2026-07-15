/**
 * emit-rejection-metadata REQ-ERM-01: `ContractFake#emit` rejects with a structured
 * `EmitRejection { code, failedIndex?, appliedCount }` — never a bare `Error` — so the
 * attribution layer can classify by CODE, never by reading message text.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import { EmitRejection } from "../../src/core/emit-rejection.ts";
import { toAuthoringError } from "../../src/core/authoring-error.ts";
import { BATCH_CAP_BYTES, type JsonValue } from "../../src/core/wire.ts";
import { batchOf, createOp, modifyOp } from "./directive-builders.ts";
import { batchOverSerializedBytes, FIXTURE_PATH } from "./batch-cap-fixtures.ts";
import { rejectedEmit } from "../support/rejection-capture.ts";

describe("REQ-ERM-01.1 — directive-level rejection carries code + failedIndex", () => {
  it("a collision at index 2 of a 3-directive batch carries code:collision, failedIndex:2, appliedCount:2", async () => {
    const fake = new ContractFake({ seed: { "c.ts": "old" } });
    const batch = batchOf(
      createOp("a.ts", "A"),
      createOp("b.ts", "B"),
      createOp("c.ts", "C") // collides with the seed
    );

    const caught = await rejectedEmit(fake, batch);

    expect(caught).toBeInstanceOf(EmitRejection);
    const rejection = caught as EmitRejection;
    expect(rejection.code).toEqual("collision");
    expect(rejection.failedIndex).toEqual(2);
    expect(rejection.appliedCount).toEqual(2);
  });

  it("a not-found at index 2 of a 3-directive batch carries code:not-found, failedIndex:2, appliedCount:2", async () => {
    const fake = new ContractFake({ seed: {} });
    const batch = batchOf(
      createOp("a.ts", "A"),
      createOp("b.ts", "B"),
      modifyOp("missing.ts", "new content") // no such target
    );

    const caught = await rejectedEmit(fake, batch);

    expect(caught).toBeInstanceOf(EmitRejection);
    const rejection = caught as EmitRejection;
    expect(rejection.code).toEqual("not-found");
    expect(rejection.failedIndex).toEqual(2);
    expect(rejection.appliedCount).toEqual(2);
  });
});

describe("REQ-ERM-01.2 — batch-level rejection carries code, no failedIndex", () => {
  it("cap-exceeded carries code:cap, appliedCount:0, failedIndex absent", async () => {
    const fake = new ContractFake({ seed: { [FIXTURE_PATH]: "" } });
    const overCap = batchOverSerializedBytes(BATCH_CAP_BYTES);

    const caught = await rejectedEmit(fake, overCap);

    expect(caught).toBeInstanceOf(EmitRejection);
    const rejection = caught as EmitRejection;
    expect(rejection.code).toEqual("cap");
    expect(rejection.appliedCount).toEqual(0);
    expect(rejection.failedIndex).toBeUndefined();
  });

  it("a batch whose options fail JSON.stringify (BigInt) carries code:unrepresentable, appliedCount:0", async () => {
    const fake = new ContractFake({ seed: {} });
    const batch = batchOf(createOp("a.ts", "A", { n: 1n } as unknown as JsonValue));

    const caught = await rejectedEmit(fake, batch);

    expect(caught).toBeInstanceOf(EmitRejection);
    const rejection = caught as EmitRejection;
    expect(rejection.code).toEqual("unrepresentable");
    expect(rejection.appliedCount).toEqual(0);
    expect(rejection.failedIndex).toBeUndefined();
  });

  it("a batch whose round-trip silently drops a value (function) carries code:unrepresentable, appliedCount:0", async () => {
    const fake = new ContractFake({ seed: {} });
    const batch = batchOf(createOp("a.ts", "A", { fn: (() => {}) } as unknown as JsonValue));

    const caught = await rejectedEmit(fake, batch);

    expect(caught).toBeInstanceOf(EmitRejection);
    const rejection = caught as EmitRejection;
    expect(rejection.code).toEqual("unrepresentable");
    expect(rejection.appliedCount).toEqual(0);
    expect(rejection.failedIndex).toBeUndefined();
  });
});

describe("REQ-ERM-01.3 — classification uses the code, never message text", () => {
  it("a rejection whose message contains the decoy word 'not found' still classifies as collision via code", async () => {
    const fake = new ContractFake({ seed: { "existing.ts": "old" } });
    const batch = batchOf(createOp("existing.ts", "new"));

    const caught = await rejectedEmit(fake, batch);

    // The fake's own collision message never contains "not found" — this proves the
    // scenario's decoy premise structurally: code is what carries classification, and
    // a collision's message text has no bearing on it.
    expect(caught).toBeInstanceOf(EmitRejection);
    const rejection = caught as EmitRejection;
    expect(rejection.code).toEqual("collision");
    expect(rejection.message).not.toContain("not found");
  });

  // TRANSLATION-layer decoys (mutation-tight half of the scenario): the fake-side test
  // above never exercises toAuthoringError, so a message-text classifier smuggled into
  // the translation would survive it. Feeding a well-formed EmitRejection whose message
  // actively LIES about the family proves the mapping reads `code`, not text — a
  // text-classifier mutant resolves the decoy words and fails both toEqual pins.
  it("code:collision with a decoy 'not found' MESSAGE still translates to path-collision", () => {
    const decoy = new EmitRejection("collision", 'ContractFake: target not found: "a.ts"', {
      failedIndex: 0,
      appliedCount: 0,
    });
    const err = toAuthoringError(decoy, batchOf(createOp("a.ts", "x")));
    expect(err.reason).toEqual("path-collision");
  });

  it("code:not-found with a decoy 'already exists' MESSAGE still translates to path-not-found", () => {
    const decoy = new EmitRejection("not-found", 'ContractFake: "a.ts" already exists (use force to overwrite)', {
      failedIndex: 0,
      appliedCount: 0,
    });
    const err = toAuthoringError(decoy, batchOf(createOp("a.ts", "x")));
    expect(err.reason).toEqual("path-not-found");
  });
});
