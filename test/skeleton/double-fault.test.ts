/**
 * REQ-10: double-fault error preservation. Factory throws E1 AND discard() rejects with
 * E2 → the runner MUST reject with E1, and E1.cause is E2 (E2 neither replaces nor is
 * swallowed).
 *
 * REQ-10.2 (RED-PHASE GATE, spec cross-cutting note 7c) is not a separate test case — it is
 * the transient RED evidence of the REQ-10.1 test below, run against today's context.ts
 * (no try/catch around discard(): E2 propagates and replaces E1). Historical once GREEN lands.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create } from "../../src/commons/index.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";

// REQ-10 needs a discard-rejecting double, not a full fake reimplementation — delegates
// emit/read/commit to a real ContractFake, only discard() is overridden to reject with E2.
class DiscardRejectingClient implements EngineClient {
  readonly #inner: ContractFake;
  readonly #discardError: Error;

  constructor(inner: ContractFake, discardError: Error) {
    this.#inner = inner;
    this.#discardError = discardError;
  }

  emit(batch: Batch): Promise<void> {
    return this.#inner.emit(batch);
  }

  read(path: string): Promise<string | undefined> {
    return this.#inner.read(path);
  }

  commit(): Promise<void> {
    return this.#inner.commit();
  }

  discard(): Promise<void> {
    return Promise.reject(this.#discardError);
  }
}

describe("REQ-10 — double-fault error preservation", () => {
  it("REQ-10.1 — factory throws E1, discard() rejects with E2: rejects with E1, E1.cause is E2", async () => {
    const e1 = new Error("factory error E1");
    const e2 = new Error("discard rejection E2");
    const client = new DiscardRejectingClient(new ContractFake({ seed: {} }), e2);

    const run = defineFactory<void>(() => {
      create("src/buffered.ts", { template: "buffered", options: {} });
      throw e1;
    });

    await expect(run(undefined, { client })).rejects.toBe(e1);
    expect(e1.cause).toBe(e2);
  });

  it("REQ-10.3 (contrast) — factory throws E1, discard() resolves normally: E1 propagates unchanged, cause stays undefined", async () => {
    const e1 = new Error("factory error E1");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("src/buffered.ts", { template: "buffered", options: {} });
      throw e1;
    });

    await expect(run(undefined, { client: fake })).rejects.toBe(e1);
    expect(e1.cause).toBeUndefined();
  });

  it("REQ-10.4 (no-clobber) — E1 arrives with a pre-set cause: a discard() rejection must not replace it", async () => {
    const preExistingCause = new Error("original cause, set before the factory ran");
    const e1 = new Error("factory error E1", { cause: preExistingCause });
    const e2 = new Error("discard rejection E2");
    const client = new DiscardRejectingClient(new ContractFake({ seed: {} }), e2);

    const run = defineFactory<void>(() => {
      create("src/buffered.ts", { template: "buffered", options: {} });
      throw e1;
    });

    await expect(run(undefined, { client })).rejects.toBe(e1);
    expect(e1.cause).toBe(preExistingCause);
  });
});
