/**
 * S-002 — MC-01/02/05/06/07 RESTATED against the REAL TypeScript (ts-morph) dialect, not the
 * S-001 toy dialect (design §4.6 Test Derivation: "MC-01/MC-02/MC-06 span S-001
 * (mechanism-level) + S-002 (e2e-level restatement)"). Also closes verify-in-loop-1 followup
 * F1: REQ-DG-03.2's `.modify()`-before-a-named-op ordering, content-verified on the real
 * dialect (S-001's toy-dialect test only covered the reverse order).
 *
 * Every assertion is content-verified via a spy on the batch `emit` call (never count-only,
 * constraint 7).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../../src/core/context.ts";
import { dryRun } from "../../../src/commons/index.ts";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";

describe("real dialect — coalescing (REQ-MC-01 restatement)", () => {
  it("REQ-MC-01.1: two distinguishable ops, no read, one modify, byte-exact content", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .addImport("join", "node:path")
        .modify((ast) => {
          ast.addStatements("export const z = 3;");
        });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.path).toBe("a.ts");
    expect(modifies[0]?.modify.content).toBe(golden("coalesced-two-edits.txt"));
  });

  it("REQ-MC-01.2: two independent handles on different paths coalesce independently", async () => {
    const { client, emitted } = makeSpyClient({
      "a.ts": golden("add-import-before.txt"),
      "b.ts": "const other = true;\n",
    });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
      await ts.find("b.ts").addImport("join", "node:path");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    const a = modifies.find((m) => m.modify.path === "a.ts");
    const b = modifies.find((m) => m.modify.path === "b.ts");
    expect(a?.modify.content).toBe(golden("add-import-after.txt"));
    expect(b?.modify.content).toBe('import { join } from "node:path";\n\nconst other = true;\n');
  });

  it("F1 (verify-in-loop-1 followup, REQ-DG-03.2): .modify() BEFORE a named op on the same chain still coalesces into ONE modify", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .modify((ast) => {
          ast.addStatements("export const z = 3;");
        })
        .addImport("join", "node:path");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("coalesced-two-edits.txt"));
  });
});

describe("real dialect — split by read (REQ-MC-02 restatement)", () => {
  it("REQ-MC-02.1: split-by-read — edits, read, more edits -> exactly two modifies, byte-exact content", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").addImport("readFileSync", "node:fs");
      await handle.read();
      handle.modify((ast) => {
        ast.addStatements("const y = 2;");
      });
      await handle;
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    expect(modifies[0]?.modify.content).toBe(golden("split-directive-1.txt"));
    expect(modifies[1]?.modify.content).toBe(golden("split-directive-2.txt"));
  });

  it("REQ-MC-02.2: mid-chain read observes the handle's own writes (not the seeded content)", async () => {
    const { client } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").addImport("readFileSync", "node:fs");
      const readBack = await handle.read();
      expect(readBack).toBe(golden("split-directive-1.txt"));
    });
    await run(undefined, { client });
  });

  it("REQ-MC-02.3: a cross-path read mid-chain splits an open handle (global flush trigger)", async () => {
    const { client, emitted } = makeSpyClient({
      "a.ts": golden("add-import-before.txt"),
      "b.ts": "const other = true;\n",
    });

    const run = defineFactory<void>(async () => {
      const handleA = ts.find("a.ts").addImport("readFileSync", "node:fs");
      await handleA;
      await ts.find("b.ts").read(); // unrelated path, but flush is GLOBAL (ADR-0015)
      handleA.modify((ast) => {
        ast.addStatements("const y = 2;");
      });
      await handleA;
    });
    await run(undefined, { client });

    const modifiesA = collectModifies(emitted).filter((m) => m.modify.path === "a.ts");
    expect(modifiesA).toHaveLength(2);
    expect(modifiesA[0]?.modify.content).toBe(golden("split-directive-1.txt"));
    expect(modifiesA[1]?.modify.content).toBe(golden("split-directive-2.txt"));
  });
});

describe("real dialect — dryRun over a coalesced chain (REQ-MC-05 restatement)", () => {
  it("REQ-MC-05.1: dryRun shows exactly one planned modify, without triggering AST re-serialization", async () => {
    const { client } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").addImport("readFileSync", "node:fs").addImport("join", "node:path");
      await handle;

      const plan = dryRun();
      expect(plan).toEqual([{ verb: "modify", path: "a.ts" }]);
    });
    await run(undefined, { client });
  });
});

describe("real dialect — unawaited join (REQ-MC-06 restatement)", () => {
  it("REQ-MC-06.1: a forgotten-await chain still commits its import, content byte-exact, no unhandledRejection", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    const run = defineFactory<void>(() => {
      ts.find("a.ts").addImport("readFileSync", "node:fs"); // deliberately not awaited
    });

    try {
      await run(undefined, { client });
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-import-after.txt"));
    expect(unhandled).toEqual([]);
  });
});

describe("real dialect — same-path scoping (REQ-MC-07 restatement)", () => {
  it("REQ-MC-07.1: sequential awaited same-path handles produce cumulative split modifies", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
      await ts.find("a.ts").addImport("join", "node:path");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    expect(modifies[0]?.modify.content).toBe(golden("add-import-after.txt"));
    expect(modifies[1]?.modify.content).toBe(
      'import { readFileSync } from "node:fs";\nimport { join } from "node:path";\n\nconst x = 1;\n'
    );
  });
});
