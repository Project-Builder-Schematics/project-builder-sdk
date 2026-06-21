/**
 * SEAM-04 + SEAM-03 cross-boundary (REQ-10, REQ-11, REQ-12, REQ-13).
 * Fake unmocked on BOTH sides: a real ContractFake throws a real collision error;
 * Session's attribution wrap translates it to an AuthoringError; defineFactory propagates
 * the AuthoringError AND discards (committed tree empty). No mock on emit/attribution/commit.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create } from "../../src/commons/index.ts";

describe("SEAM-04 — error attribution (forced rejection, cross-boundary)", () => {
  it("REQ-11.1 / REQ-11.2 / REQ-13.1 — forced collision rejects with AuthoringError{verb,path}, no engine text, committed empty", async () => {
    const fake = new ContractFake({ seed: { "src/existing.ts": "old" } });

    const run = defineFactory<void>(() => {
      // Collides with the seed and no force → ContractFake throws a raw collision error.
      create("src/existing.ts", { template: "new", options: {} });
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    // REQ-11.2 — rejects with AuthoringError, not a generic Error.
    expect(caught).toBeInstanceOf(AuthoringError);
    const authoringError = caught as AuthoringError;
    // REQ-10.1 / REQ-11.1 — author vocabulary verb + path.
    expect(authoringError.verb).toEqual("create");
    expect(authoringError.path).toEqual("src/existing.ts");
    // REQ-11.1 — no engine-internal vocabulary leaks into the whole error object.
    const serialized = `${authoringError.message} ${String(authoringError.stack ?? "")}`;
    expect(serialized).not.toContain("ContractFake:");
    expect(serialized).not.toContain("OpMove");
    // REQ-12.2 / REQ-13.1 — discard fired; committed tree is empty.
    expect(fake.committedTree().size).toEqual(0);
  });
});
