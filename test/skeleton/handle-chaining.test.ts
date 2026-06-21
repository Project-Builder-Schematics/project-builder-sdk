// Runtime tests for S-003: handle chaining state machine (KIT-04 / ADR-0004).
// Verifies each write verb dispatches the correct directive and returns a handle.
// Directives are buffered; flush happens on read(). Tests call read() to force flush.

import { describe, expect, test } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";
import { ContractFake } from "../../src/core/contract-fake.ts";

function makeSpy(seed: Record<string, string> = {}): { spy: EngineClient; emitted: Batch[] } {
  const fake = new ContractFake({ seed });
  const emitted: Batch[] = [];
  const spy: EngineClient = {
    async emit(b) { emitted.push(b); await fake.emit(b); },
    async read(p) { return fake.read(p); },
  };
  return { spy, emitted };
}

describe("handle chaining — verb dispatch (S-003 / KIT-04)", () => {
  test("modify dispatches op:modify; handle.read() sees updated content", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "original" });

    const factory = defineFactory(async () => {
      const { modify } = await import("../../src/commons/index.ts");
      const handle = modify("src/foo.ts", "updated content");
      const content = await handle.read();
      expect(content).toBe("updated content");
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops).toContain("modify");
  });

  test("rename dispatches op:rename; returns a handle", async () => {
    // Do NOT seed the destination path — fake collision-checks existing targets.
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { rename, find } = await import("../../src/commons/index.ts");
      const handle = rename("src/foo.ts", "bar.ts");
      expect(typeof handle.read).toBe("function");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops).toContain("rename");
  });

  test("move dispatches op:move; returns a handle", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { move, find } = await import("../../src/commons/index.ts");
      const handle = move("src/foo.ts", "lib/");
      expect(typeof handle.read).toBe("function");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops).toContain("move");
  });

  test("copy dispatches op:copy; returns a handle", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { copy, find } = await import("../../src/commons/index.ts");
      const handle = copy("src/foo.ts", "src/bar.ts");
      expect(typeof handle.read).toBe("function");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops).toContain("copy");
  });

  test("top-level remove dispatches op:delete (wire op)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { remove, find } = await import("../../src/commons/index.ts");
      remove("src/foo.ts");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops).toContain("delete");
  });

  test("find().remove() dispatches op:delete (wire op)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { find } = await import("../../src/commons/index.ts");
      find("src/foo.ts").remove();
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops).toContain("delete");
  });

  test("rename with force passes force to directive", async () => {
    const { spy, emitted } = makeSpy({ "dummy": "x" });

    const factory = defineFactory(async () => {
      const { rename, find } = await import("../../src/commons/index.ts");
      rename("src/foo.ts", "bar.ts", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const instructions = emitted.flatMap((b) => b.instructions);
    const renameDir = instructions.find((d) => d.op === "rename");
    expect(renameDir).toBeDefined();
    if (renameDir?.op === "rename") {
      expect(renameDir.rename.force).toBe(true);
      expect(renameDir.rename.newName).toBe("bar.ts");
    }
  });

  test("copy with force passes force to directive", async () => {
    const { spy, emitted } = makeSpy({ "dummy": "x" });

    const factory = defineFactory(async () => {
      const { copy, find } = await import("../../src/commons/index.ts");
      copy("src/foo.ts", "src/bar.ts", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const instructions = emitted.flatMap((b) => b.instructions);
    const copyDir = instructions.find((d) => d.op === "copy");
    expect(copyDir).toBeDefined();
    if (copyDir?.op === "copy") {
      expect(copyDir.copy.force).toBe(true);
    }
  });

  test("handle.modify() chains — dispatches op:modify after initial op", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "v1" });

    const factory = defineFactory(async () => {
      const { modify } = await import("../../src/commons/index.ts");
      const h2 = modify("src/foo.ts", "v2");
      await h2.modify("v3").read();
    });
    await factory({}, { client: spy });

    const ops = emitted.flatMap((b) => b.instructions).map((d) => d.op);
    expect(ops.filter((op) => op === "modify")).toHaveLength(2);
  });
});
