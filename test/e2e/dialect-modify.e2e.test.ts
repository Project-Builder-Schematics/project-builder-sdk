/**
 * S-002 e2e — the REAL TypeScript dialect driven outside-in against `ContractFake`,
 * mirroring `test/e2e/author-to-tree.e2e.test.ts`'s golden-committed-tree style (design
 * §4.2b Flow Changes table). This is the "big" outer-loop test the double-loop TDD ordering
 * requires before per-task unit work — S-001's toy-dialect e2e proved the SAME mechanism
 * generically; this file proves it against the shipped real dialect (ratified slices
 * constraint 2: no production/conformance code imports the toy fixture past S-001, and this
 * file does not either).
 *
 * Flow 1: chain typed dialect ops on one file -> one modify (REQ-MC-01, REQ-TSD-01/03)
 * Flow 2: .modify() either order coalesces the same (REQ-DG-03)
 * Flow 3: mid-chain read splits into exactly two modify (REQ-MC-02)
 * Flow 4: forgotten-await chain still completes + commits at run end (REQ-MC-06)
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import * as ts from "../../src/dialects/typescript/index.ts";
import { golden } from "../support/golden.ts";

describe("e2e — dialect modify (S-002, real TypeScript dialect)", () => {
  // S-000 (ts-addimport-collision) — the ported V8 happy-path algorithm (Steps 1/3/4) threads
  // through the public handle and the coalescing controller: merging into an existing
  // non-type-only named clause is byte-exact end to end. Collision (Step 2) is deferred to
  // S-001; that case completes this pair (slices.md S-005.2).
  it("Flow 1 (ts-addimport-collision S-000): addImport merges into an existing named clause through the public handle", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("merge-add-import-before.txt") } });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client: fake });

    const goldenTree = new Map([["a.ts", golden("merge-add-import-after.txt")]]);
    expect(fake.committedTree()).toEqual(goldenTree);
  });

  // ts-addimport-collision S-005.2 — the failure-path twin of the case directly above: closes
  // the "shape-safe merge + collision reject" pair through the SAME public handle (Step 2,
  // REQ-TSD-01, design §4.4). Dual observable per house convention: synchronous throw + the
  // target file byte-unchanged on re-read after the catch, no directives ever committed.
  it("Flow 1 (ts-addimport-collision S-001/S-005): addImport rejects a file-wide collision through the public handle, byte-unchanged", async () => {
    const seed = 'import { readFileSync } from "node:fs";\n';
    const fake = new ContractFake({ seed: { "a.ts": seed } });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:other");
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("already exists");
    expect((caught as Error).cause).toBeUndefined();
    expect(fake.committedTree()).toEqual(new Map());
    expect(await fake.read("a.ts")).toBe(seed);
  });

  it("Flow 1: addImport + .modify() on one file coalesce into a single committed modify", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("add-import-before.txt") } });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .addImport("join", "node:path")
        .modify((ast) => {
          ast.addStatements("export const z = 3;");
        });
    });
    await run(undefined, { client: fake });

    const goldenTree = new Map([["a.ts", golden("coalesced-two-edits.txt")]]);
    expect(fake.committedTree()).toEqual(goldenTree);
  });

  it("Flow 2: .modify() before a named op coalesces the same as after (REQ-DG-03.2)", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("add-import-before.txt") } });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .modify((ast) => {
          ast.addStatements("export const z = 3;");
        })
        .addImport("join", "node:path");
    });
    await run(undefined, { client: fake });

    // Byte-identical to Flow 1's end-state — order does not change the coalesced content.
    const goldenTree = new Map([["a.ts", golden("coalesced-two-edits.txt")]]);
    expect(fake.committedTree()).toEqual(goldenTree);
  });

  it("Flow 3: a mid-chain read splits into two modifies, cumulative, no edit lost", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("add-import-before.txt") } });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").addImport("readFileSync", "node:fs");
      const midChainContent = await handle.read();
      expect(midChainContent).toBe(golden("split-directive-1.txt")); // read-your-own-writes

      handle.modify((ast) => {
        ast.addStatements("const y = 2;");
      });
      await handle;
    });
    await run(undefined, { client: fake });

    const goldenTree = new Map([["a.ts", golden("split-directive-2.txt")]]);
    expect(fake.committedTree()).toEqual(goldenTree);
  });

  it("Flow 4: a forgotten-await chain still completes and commits at run end (REQ-MC-06)", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("add-import-before.txt") } });

    const run = defineFactory<void>(() => {
      // Deliberately NOT awaited — the run-boundary join must still commit this.
      ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client: fake });

    const goldenTree = new Map([["a.ts", golden("add-import-after.txt")]]);
    expect(fake.committedTree()).toEqual(goldenTree);
  });

  it("Flow 4: an unawaited THROWING chain rejects the run contained, no unhandledRejection", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("add-import-before.txt") } });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    const run = defineFactory<void>(() => {
      // Deliberately not awaited.
      ts.find("a.ts").modify(() => {
        throw new Error("boom");
      });
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    } finally {
      // Give any stray unhandledRejection a tick to surface before asserting its absence.
      await new Promise((resolve) => setTimeout(resolve, 10));
      process.off("unhandledRejection", onUnhandled);
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: modify() on "a.ts" threw');
    expect((caught as Error).cause).toBeUndefined();
    expect(unhandled).toEqual([]);
    expect(fake.committedTree()).toEqual(new Map());
  });
});
