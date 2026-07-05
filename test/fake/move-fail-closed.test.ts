/**
 * REQ-FAKE-04 (move rows): `move` joins the fail-closed collision family — previously
 * only create/rename/copy checked the destination. `effective = envelope.force OR
 * op.force`, and dst===src is excluded from the collision check entirely (ADR-0017
 * self-move identity amendment) — a self-move is a file-preserving success, no force
 * required.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import type { Batch, Directive } from "../../src/core/wire.ts";

function batch(force: boolean, ...instructions: Directive[]): Batch {
  return { protocolVersion: 1, force, instructions };
}

function moveOp(path: string, toDir: string, force?: boolean): Directive {
  const move: { path: string; toDir: string; force?: boolean } = { path, toDir };
  if (force !== undefined) move.force = force;
  return { op: "move", move };
}

describe("REQ-FAKE-04.m1 — move onto an existing destination rejects without force", () => {
  it("rejects and leaves both source and destination content untouched", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "source content", "lib/foo.ts": "original lib content" } });

    await expect(fake.emit(batch(false, moveOp("src/foo.ts", "lib")))).rejects.toThrow(
      /move collision/
    );

    expect(await fake.read("lib/foo.ts")).toEqual("original lib content");
    expect(await fake.read("src/foo.ts")).toEqual("source content");
  });
});

describe("REQ-FAKE-04.m2 — move with op.force=true overwrites", () => {
  it("succeeds; destination holds source content, source reads absent", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "source content", "lib/foo.ts": "original lib content" } });

    await fake.emit(batch(false, moveOp("src/foo.ts", "lib", true)));

    expect(await fake.read("lib/foo.ts")).toEqual("source content");
    expect(await fake.read("src/foo.ts")).toBeUndefined();
  });
});

describe("REQ-FAKE-04.m3 — envelope.force=true, op.force absent — move overwrites (Row 3)", () => {
  it("succeeds; destination holds source content", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "source content", "lib/foo.ts": "original lib content" } });

    await fake.emit(batch(true, moveOp("src/foo.ts", "lib")));

    expect(await fake.read("lib/foo.ts")).toEqual("source content");
  });
});

describe("REQ-FAKE-04.m4 — self-move (dst === src) is a file-preserving success", () => {
  it("succeeds with no force and the original content survives", async () => {
    const fake = new ContractFake({ seed: { "src/foo.ts": "original content" } });

    await fake.emit(batch(false, moveOp("src/foo.ts", "src")));

    expect(await fake.read("src/foo.ts")).toEqual("original content");
  });
});
