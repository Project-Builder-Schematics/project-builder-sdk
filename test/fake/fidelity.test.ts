/**
 * FAKE-06: Independent fidelity suite — asserts the engine's observable wire contract.
 * Tests construct ContractFake directly (no Session/commons/context imports).
 * Exercises: FAKE-01 (eager array-order apply), FAKE-02 (Tree-first read + served tag),
 * FAKE-03 (flush-before-read round-trip), FAKE-04 (fail-closed + force, all 3 rows),
 * FAKE-05 (idempotent delete).
 *
 * Must NOT import from src/commons or src/core/session.ts.
 * Must NOT assert engine internals (tombstones, opLog, commit pass, ConflictError taxonomy).
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import type { Batch, Directive } from "../../src/core/wire.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function batch(force: boolean, ...instructions: Directive[]): Batch {
  return { protocolVersion: 1, force, instructions };
}

function createOp(path: string, content: string, force?: boolean): Directive {
  const op: { pathTemplate: string; template: string; options: Record<string, never>; force?: boolean } = {
    pathTemplate: path,
    template: content,
    options: {},
  };
  if (force !== undefined) op.force = force;
  return { op: "create", create: op };
}

function modifyOp(path: string, content: string): Directive {
  return { op: "modify", modify: { path, content } };
}

function deleteOp(path: string): Directive {
  return { op: "delete", delete: { path } };
}

function renameOp(path: string, newName: string, force?: boolean): Directive {
  const op: { path: string; newName: string; force?: boolean } = { path, newName };
  if (force !== undefined) op.force = force;
  return { op: "rename", rename: op };
}

function copyOp(from: string, to: string, force?: boolean): Directive {
  const op: { from: string; to: string; force?: boolean } = { from, to };
  if (force !== undefined) op.force = force;
  return { op: "copy", copy: op };
}

// ─── FAKE-01: eager batch apply in array order ────────────────────────────────

describe("FAKE-01 — eager batch apply in array order", () => {
  it("applies instructions in sequence: [create A, modify A] → read sees modified content", async () => {
    const fake = new ContractFake({ seed: {} });
    await fake.emit(batch(false, createOp("a.ts", "original"), modifyOp("a.ts", "modified")));

    expect(await fake.read("a.ts")).toEqual("modified");
  });

  it("seed≠staged: staged content wins when path is created over a seeded value (with force)", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "seed-content" } });
    await fake.emit(batch(true, createOp("a.ts", "staged-content", false)));

    expect(await fake.read("a.ts")).toEqual("staged-content");
  });

  it("later modify wins over earlier create within a single batch", async () => {
    const fake = new ContractFake({ seed: {} });
    await fake.emit(batch(false, createOp("x.ts", "v1"), modifyOp("x.ts", "v2"), modifyOp("x.ts", "v3")));

    expect(await fake.read("x.ts")).toEqual("v3");
  });
});

// ─── FAKE-02: Tree-first read + served-from tag ───────────────────────────────

describe("FAKE-02 — Tree-first read + served-from tag (fake-internal)", () => {
  it("returns staged content with served:tree when path was touched", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "disk" } });
    await fake.emit(batch(true, createOp("a.ts", "staged", false)));

    expect(await fake.read("a.ts")).toEqual("staged");
    expect(fake.lastServed).toEqual("tree");
  });

  it("returns seed content with served:disk for untouched seeded paths", async () => {
    const fake = new ContractFake({ seed: { "b.ts": "disk-content" } });

    expect(await fake.read("b.ts")).toEqual("disk-content");
    expect(fake.lastServed).toEqual("disk");
  });

  it("served tag is fake-internal: the raw read return is a plain string", async () => {
    const fake = new ContractFake({ seed: { "c.ts": "val" } });
    const result = await fake.read("c.ts");

    expect(typeof result).toEqual("string");
    expect(result).toEqual("val");
  });

  it("seed≠staged fixture: untouched path reads from seed (disk), touched reads from tree", async () => {
    const fake = new ContractFake({ seed: { "disk-only.ts": "disk", "both.ts": "disk" } });
    await fake.emit(batch(true, createOp("both.ts", "tree", false)));

    expect(await fake.read("disk-only.ts")).toEqual("disk");
    expect(fake.lastServed).toEqual("disk");

    expect(await fake.read("both.ts")).toEqual("tree");
    expect(fake.lastServed).toEqual("tree");
  });
});

// ─── FAKE-03: flush-before-read round-trip ────────────────────────────────────

describe("FAKE-03 — flush-before-read round-trip (observable via the fake directly)", () => {
  it("content written in emit is immediately available via read", async () => {
    const fake = new ContractFake({ seed: {} });
    await fake.emit(batch(false, createOp("src/file.ts", "export const x = 1;")));

    expect(await fake.read("src/file.ts")).toEqual("export const x = 1;");
  });

  it("multiple sequential emits accumulate correctly", async () => {
    const fake = new ContractFake({ seed: {} });
    await fake.emit(batch(false, createOp("p.ts", "first")));
    await fake.emit(batch(false, modifyOp("p.ts", "second")));

    expect(await fake.read("p.ts")).toEqual("second");
  });
});

// ─── FAKE-04: fail-closed + force precedence (all 3 rows) ────────────────────

describe("FAKE-04 — fail-closed + force precedence", () => {
  // Row 1: no force → error when target exists
  it("Row 1 (create) — no force → error when target exists in seed", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "original" } });
    await expect(
      fake.emit(batch(false, createOp("a.ts", "overwrite-attempt")))
    ).rejects.toThrow();
  });

  it("Row 1 (rename) — no force → error when destination exists", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "content-a", "b.ts": "content-b" } });
    await expect(
      fake.emit(batch(false, renameOp("a.ts", "b.ts")))
    ).rejects.toThrow();
  });

  it("Row 1 (copy) — no force → error when destination exists", async () => {
    const fake = new ContractFake({ seed: { "src.ts": "content", "dst.ts": "existing" } });
    await expect(
      fake.emit(batch(false, copyOp("src.ts", "dst.ts")))
    ).rejects.toThrow();
  });

  // Row 2: op.force=true → overwrite (envelope.force=false)
  it("Row 2 (create) — op.force=true → overwrites existing target", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "original" } });
    await fake.emit(batch(false, createOp("a.ts", "overwritten", true)));

    expect(await fake.read("a.ts")).toEqual("overwritten");
  });

  it("Row 2 (rename) — op.force=true → overwrites existing destination", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "content-a", "b.ts": "content-b" } });
    await fake.emit(batch(false, renameOp("a.ts", "b.ts", true)));

    expect(await fake.read("b.ts")).toEqual("content-a");
  });

  it("Row 2 (copy) — op.force=true → overwrites existing destination", async () => {
    const fake = new ContractFake({ seed: { "src.ts": "source-content", "dst.ts": "old" } });
    await fake.emit(batch(false, copyOp("src.ts", "dst.ts", true)));

    expect(await fake.read("dst.ts")).toEqual("source-content");
  });

  // Row 3: envelope.force=true, op.force=false (or absent) → overwrite
  it("Row 3 (create) — envelope.force=true, op.force=false → overwrites existing target", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "original" } });
    await fake.emit(batch(true, createOp("a.ts", "overwritten", false)));

    expect(await fake.read("a.ts")).toEqual("overwritten");
  });

  it("Row 3 (rename) — envelope.force=true, op.force absent → overwrites existing destination", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "content-a", "b.ts": "content-b" } });
    await fake.emit(batch(true, renameOp("a.ts", "b.ts")));

    expect(await fake.read("b.ts")).toEqual("content-a");
  });

  it("Row 3 (copy) — envelope.force=true, op.force absent → overwrites existing destination", async () => {
    const fake = new ContractFake({ seed: { "src.ts": "source-content", "dst.ts": "old" } });
    await fake.emit(batch(true, copyOp("src.ts", "dst.ts")));

    expect(await fake.read("dst.ts")).toEqual("source-content");
  });
});

// ─── FAKE-05: idempotent delete ───────────────────────────────────────────────

describe("FAKE-05 — idempotent delete", () => {
  it("delete of an absent path succeeds (does not throw)", async () => {
    const fake = new ContractFake({ seed: {} });
    await expect(
      fake.emit(batch(false, deleteOp("nonexistent.ts")))
    ).resolves.toBeUndefined();
  });

  it("double-delete of the same absent path succeeds both times", async () => {
    const fake = new ContractFake({ seed: {} });
    await fake.emit(batch(false, deleteOp("ghost.ts")));
    await expect(
      fake.emit(batch(false, deleteOp("ghost.ts")))
    ).resolves.toBeUndefined();
  });

  // ADR-01: not-found is undefined, not a throw — a deleted path reads as absent.
  it("delete of an existing tree path removes it so subsequent reads return undefined", async () => {
    const fake = new ContractFake({ seed: {} });
    await fake.emit(batch(false, createOp("file.ts", "content")));
    await fake.emit(batch(false, deleteOp("file.ts")));

    expect(await fake.read("file.ts")).toBeUndefined();
  });

  it("delete of an existing seed path removes it so subsequent reads return undefined", async () => {
    const fake = new ContractFake({ seed: { "seeded.ts": "original" } });
    await fake.emit(batch(false, deleteOp("seeded.ts")));

    expect(await fake.read("seeded.ts")).toBeUndefined();
  });

  it("double-delete of an existing path: first succeeds, second also succeeds (idempotent)", async () => {
    const fake = new ContractFake({ seed: { "target.ts": "x" } });
    await fake.emit(batch(false, deleteOp("target.ts")));
    await expect(
      fake.emit(batch(false, deleteOp("target.ts")))
    ).resolves.toBeUndefined();
  });
});
