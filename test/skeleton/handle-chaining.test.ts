// Runtime tests for S-003: handle chaining state machine (KIT-04 / ADR-0004).
// Verifies each write verb dispatches the correct directive AND the correct payload.
// Directives are buffered; flush happens on read(). Tests call read() to force flush.
//
// Payload assertions (per REQ-KIT-03 author→factory mapping):
//   modify: { path, content }
//   rename: { path, newName, force? }
//   move:   { path, toDir }
//   copy:   { from, to, force? }
//   delete: { path }

import { describe, expect, test } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch, Directive } from "../../src/core/wire.ts";
import { makeSpyClient } from "../support/spy-client.ts";

function makeSpy(seed: Record<string, string> = {}): { spy: EngineClient; emitted: Batch[] } {
  const { client, emitted } = makeSpyClient(seed);
  return { spy: client, emitted };
}

function collectDirectives(emitted: Batch[]): Directive[] {
  return emitted.flatMap((b) => b.instructions);
}

describe("handle chaining — verb dispatch (S-003 / KIT-04)", () => {
  test("modify dispatches op:modify with correct path and content; handle.read() sees updated content", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "original" });

    const factory = defineFactory(async () => {
      const { modify } = await import("../../src/commons/index.ts");
      const handle = modify("src/foo.ts", "updated content");
      const content = await handle.read();
      expect(content).toBe("updated content");
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "modify");
    expect(dir).toBeDefined();
    if (dir?.op === "modify") {
      expect(dir.modify.path).toBe("src/foo.ts");
      expect(dir.modify.content).toBe("updated content");
    }
  });

  test("rename dispatches op:rename with correct path and newName; returns a handle", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { rename, find } = await import("../../src/commons/index.ts");
      const handle = rename("src/foo.ts", "bar.ts");
      expect(typeof handle.read).toBe("function");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "rename");
    expect(dir).toBeDefined();
    if (dir?.op === "rename") {
      expect(dir.rename.path).toBe("src/foo.ts");
      expect(dir.rename.newName).toBe("bar.ts");
      expect(dir.rename.force).toBeUndefined();
    }
  });

  test("move dispatches op:move with correct path and toDir; returns a handle", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { move, find } = await import("../../src/commons/index.ts");
      const handle = move("src/foo.ts", "lib/");
      expect(typeof handle.read).toBe("function");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.path).toBe("src/foo.ts");
      expect(dir.move.toDir).toBe("lib/");
    }
  });

  test("copy dispatches op:copy with correct from and to; returns a handle", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { copy, find } = await import("../../src/commons/index.ts");
      const handle = copy("src/foo.ts", "src/bar.ts");
      expect(typeof handle.read).toBe("function");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "copy");
    expect(dir).toBeDefined();
    if (dir?.op === "copy") {
      expect(dir.copy.from).toBe("src/foo.ts");
      expect(dir.copy.to).toBe("src/bar.ts");
      expect(dir.copy.force).toBeUndefined();
    }
  });

  test("top-level remove dispatches op:delete with correct path (wire op)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { remove, find } = await import("../../src/commons/index.ts");
      remove("src/foo.ts");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "delete");
    expect(dir).toBeDefined();
    if (dir?.op === "delete") {
      expect(dir.delete.path).toBe("src/foo.ts");
    }
  });

  test("find().remove() dispatches op:delete with correct path (wire op)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { find } = await import("../../src/commons/index.ts");
      find("src/foo.ts").remove();
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "delete");
    expect(dir).toBeDefined();
    if (dir?.op === "delete") {
      expect(dir.delete.path).toBe("src/foo.ts");
    }
  });

  test("rename with force passes force:true to directive payload", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { rename, find } = await import("../../src/commons/index.ts");
      rename("src/foo.ts", "bar.ts", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "rename");
    expect(dir).toBeDefined();
    if (dir?.op === "rename") {
      expect(dir.rename.path).toBe("src/foo.ts");
      expect(dir.rename.newName).toBe("bar.ts");
      expect(dir.rename.force).toBe(true);
    }
  });

  test("copy with force passes force:true to directive payload", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { copy, find } = await import("../../src/commons/index.ts");
      copy("src/foo.ts", "src/bar.ts", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "copy");
    expect(dir).toBeDefined();
    if (dir?.op === "copy") {
      expect(dir.copy.from).toBe("src/foo.ts");
      expect(dir.copy.to).toBe("src/bar.ts");
      expect(dir.copy.force).toBe(true);
    }
  });

  test("handle.modify() chains — dispatches op:modify twice with correct payloads", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "v1" });

    const factory = defineFactory(async () => {
      const { modify } = await import("../../src/commons/index.ts");
      const h2 = modify("src/foo.ts", "v2");
      await h2.modify("v3").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const modifyDirs = dirs.filter((d) => d.op === "modify");
    expect(modifyDirs).toHaveLength(2);
    if (modifyDirs[0]?.op === "modify" && modifyDirs[1]?.op === "modify") {
      expect(modifyDirs[0].modify.content).toBe("v2");
      expect(modifyDirs[1].modify.content).toBe("v3");
      // Both target the same path
      expect(modifyDirs[0].modify.path).toBe("src/foo.ts");
      expect(modifyDirs[1].modify.path).toBe("src/foo.ts");
    }
  });

  // C3 / C4 chained-read round-trips (ADR-0004 contract). These tests MUST fail
  // before the path-fix and pass after.
  test("rename().read() returns the content at the renamed destination (C3 chained-read)", async () => {
    const { spy } = makeSpy({ "src/foo.ts": "hello rename" });

    const factory = defineFactory(async () => {
      const { rename } = await import("../../src/commons/index.ts");
      // rename is basename-only: destination is src/bar.ts, not bar.ts
      const content = await rename("src/foo.ts", "bar.ts").read();
      expect(content).toBe("hello rename");
    });
    await factory({}, { client: spy });
  });

  test("find().rename().read() returns the content at the renamed destination (C3 FoundHandle)", async () => {
    const { spy } = makeSpy({ "src/foo.ts": "found rename" });

    const factory = defineFactory(async () => {
      const { find } = await import("../../src/commons/index.ts");
      const content = await find("src/foo.ts").rename("bar.ts").read();
      expect(content).toBe("found rename");
    });
    await factory({}, { client: spy });
  });

  test("move().read() returns the content at the move destination (C4 chained-read)", async () => {
    const { spy } = makeSpy({ "src/foo.ts": "hello move" });

    const factory = defineFactory(async () => {
      const { move } = await import("../../src/commons/index.ts");
      // destination is lib/foo.ts
      const content = await move("src/foo.ts", "lib/").read();
      expect(content).toBe("hello move");
    });
    await factory({}, { client: spy });
  });

  test("find().move().read() returns the content at the move destination (C4 FoundHandle)", async () => {
    const { spy } = makeSpy({ "src/foo.ts": "found move" });

    const factory = defineFactory(async () => {
      const { find } = await import("../../src/commons/index.ts");
      const content = await find("src/foo.ts").move("lib/").read();
      expect(content).toBe("found move");
    });
    await factory({}, { client: spy });
  });

  test("move with force passes force:true to directive payload (REQ-KIT-03.1 — free function)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { move, find } = await import("../../src/commons/index.ts");
      move("src/foo.ts", "lib/", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.path).toBe("src/foo.ts");
      expect(dir.move.toDir).toBe("lib/");
      expect(dir.move.force).toBe(true);
    }
  });

  test("move omits force key when opts not provided (REQ-KIT-03.3 — free function)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { move, find } = await import("../../src/commons/index.ts");
      move("src/foo.ts", "lib/");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.force).toBeUndefined();
    }
  });

  test("WritableHandle.move with force passes force:true to directive payload (REQ-KIT-03.2)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "v1", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { modify, find } = await import("../../src/commons/index.ts");
      modify("src/foo.ts", "v2").move("lib", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.toDir).toBe("lib");
      expect(dir.move.force).toBe(true);
    }
  });

  test("FoundHandle.move with force passes force:true to directive payload (REQ-KIT-03.2)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { find } = await import("../../src/commons/index.ts");
      find("src/foo.ts").move("lib", { force: true });
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.toDir).toBe("lib");
      expect(dir.move.force).toBe(true);
    }
  });

  test("WritableHandle.move omits force key when opts not provided (REQ-KIT-03.3 — handle form)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "v1", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { modify, find } = await import("../../src/commons/index.ts");
      modify("src/foo.ts", "v2").move("lib");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.toDir).toBe("lib");
      expect(dir.move.force).toBeUndefined();
    }
  });

  test("FoundHandle.move omits force key when opts not provided (REQ-KIT-03.3 — handle form)", async () => {
    const { spy, emitted } = makeSpy({ "src/foo.ts": "content", "dummy": "x" });

    const factory = defineFactory(async () => {
      const { find } = await import("../../src/commons/index.ts");
      find("src/foo.ts").move("lib");
      await find("dummy").read();
    });
    await factory({}, { client: spy });

    const dirs = collectDirectives(emitted);
    const dir = dirs.find((d) => d.op === "move");
    expect(dir).toBeDefined();
    if (dir?.op === "move") {
      expect(dir.move.toDir).toBe("lib");
      expect(dir.move.force).toBeUndefined();
    }
  });

  test("copy().read() returns the content at the copy destination (symmetry check)", async () => {
    const { spy } = makeSpy({ "src/foo.ts": "hello copy" });

    const factory = defineFactory(async () => {
      const { copy } = await import("../../src/commons/index.ts");
      const content = await copy("src/foo.ts", "src/bar.ts").read();
      expect(content).toBe("hello copy");
    });
    await factory({}, { client: spy });
  });
});
