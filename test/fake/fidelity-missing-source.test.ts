/**
 * C2 + B3: ContractFake fidelity for missing-source operations and path normalization.
 *
 * C2 (FAKE-06 fidelity): rename/move/copy over a MISSING source must throw, not
 * silently write empty content. The real engine cannot operate on non-existent files.
 *
 * B3: move("src/foo.ts", "lib/") with a trailing-slash toDir must resolve to
 * "lib/foo.ts", not "lib//foo.ts".
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import { batch, renameOp, copyOp, moveOp } from "./directive-builders.ts";

// ─── C2: missing-source errors ───────────────────────────────────────────────

describe("C2 — FAKE-06 fidelity: missing-source ops throw (not silent empty)", () => {
  it("rename over a missing source throws a not-found error", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(false, renameOp("nonexistent.ts", "other.ts")))
    ).rejects.toThrow(/rename source not found/);
  });

  it("rename over a missing source throws even with op.force=true (force is destination, not source)", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(false, renameOp("nonexistent.ts", "other.ts", true)))
    ).rejects.toThrow(/rename source not found/);
  });

  it("rename over a missing source throws even with envelope.force=true", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(true, renameOp("nonexistent.ts", "other.ts")))
    ).rejects.toThrow(/rename source not found/);
  });

  it("copy over a missing source throws a not-found error", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(false, copyOp("nonexistent.ts", "dest.ts")))
    ).rejects.toThrow(/copy source not found/);
  });

  it("copy over a missing source throws even with op.force=true", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(false, copyOp("nonexistent.ts", "dest.ts", true)))
    ).rejects.toThrow(/copy source not found/);
  });

  it("move over a missing source throws a not-found error", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(false, moveOp("nonexistent.ts", "lib")))
    ).rejects.toThrow(/move source not found/);
  });

  it("rename of an existing seed path succeeds and removes the source", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
    await fake.emit(batch(false, renameOp("src/foo.ts", "bar.ts")));

    expect(await fake.read("src/bar.ts")).toEqual("content");
    // ADR-01: the renamed-away source reads as absent (undefined), not a throw.
    expect(await fake.read("src/foo.ts")).toBeUndefined();
  });

  it("copy of an existing seed path succeeds and keeps the source", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
    await fake.emit(batch(false, copyOp("src/foo.ts", "src/bar.ts")));

    expect(await fake.read("src/foo.ts")).toEqual("content");
    expect(await fake.read("src/bar.ts")).toEqual("content");
  });

  it("move of an existing seed path succeeds and removes the source", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
    await fake.emit(batch(false, moveOp("src/foo.ts", "lib")));

    expect(await fake.read("lib/foo.ts")).toEqual("content");
    // ADR-01: the moved-away source reads as absent (undefined), not a throw.
    expect(await fake.read("src/foo.ts")).toBeUndefined();
  });
});

// ─── B3: trailing-slash toDir normalization ───────────────────────────────────

describe("B3 — move toDir trailing-slash normalization", () => {
  it("move with trailing-slash toDir resolves to a clean path (no double-slash)", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
    await fake.emit(batch(false, moveOp("src/foo.ts", "lib/")));

    // Must be "lib/foo.ts", not "lib//foo.ts"
    expect(await fake.read("lib/foo.ts")).toEqual("content");
    // ADR-01: the un-normalized double-slash path never existed → undefined, not a throw.
    expect(await fake.read("lib//foo.ts")).toBeUndefined();
  });

  it("move without trailing slash also produces a clean path", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
    await fake.emit(batch(false, moveOp("src/foo.ts", "lib")));

    expect(await fake.read("lib/foo.ts")).toEqual("content");
  });

  it("rename dst path is built with path.join (no double-slash from dirname)", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "content" } });
    await fake.emit(batch(false, renameOp("src/foo.ts", "bar.ts")));

    // dirname("src/foo.ts") = "src", result must be "src/bar.ts" not "src//bar.ts"
    expect(await fake.read("src/bar.ts")).toEqual("content");
  });
});
