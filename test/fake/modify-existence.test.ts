/**
 * REQ-FAKE-07: `modify` of a non-existent path errors — but staging counts as existence.
 * `modify` MUST require the target to already exist (in `#tree` staging or `#seed`, and
 * not `#deleted`); it never materializes a new file (ADR-0017 rule 2 — that's `create`'s
 * job). Existence includes paths created EARLIER IN THE SAME BATCH, since the fake applies
 * eagerly in array order.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import { batchOf as batch, modifyOp, createOp } from "./directive-builders.ts";

describe("REQ-FAKE-07.1 — modify of an untouched path rejects and never materializes", () => {
  it("rejects and leaves the path absent afterward", async () => {
    const fake = new ContractFake({ seed: {} });

    await expect(fake.emit(batch(modifyOp("untouched.ts", "new content")))).rejects.toThrow(
      /modify target not found/
    );

    expect(await fake.read("untouched.ts")).toBeUndefined();
  });
});

describe("REQ-FAKE-07.2 — modify of a seeded path succeeds", () => {
  it("succeeds and applies the new content (existing behavior unchanged)", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "seed content" } });

    await fake.emit(batch(modifyOp("src/foo.ts", "updated content")));

    expect(await fake.read("src/foo.ts")).toEqual("updated content");
  });
});

describe("REQ-FAKE-07.3 — intra-batch [create X, modify X] succeeds — staging counts", () => {
  it("succeeds against an empty seed and a later read sees the modified content", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(batch(createOp("X", "content1"), modifyOp("X", "content2")));

    expect(await fake.read("X")).toEqual("content2");
  });
});
