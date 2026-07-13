/**
 * REQ-DRE-01.1 + REQ-DRE-01.5 — the dry-run e2e: author verbs buffer directives,
 * `dryRun()` renders them in author vocabulary before the run's end-of-run flush commits.
 * Mirrors `test/e2e/author-to-tree.e2e.test.ts`'s harness (raw `ContractFake` +
 * `defineFactory`, assertions inside `fn`).
 *
 * Run-end flush safety (design §4.6b rev 4): `defineFactory` flushes unconditionally
 * after `fn` returns — seed every modify target, never seed a create target. REQ-DRE-01.1
 * seeds `src/b.ts` (the modify target) and never `src/a.ts` (the create target would
 * collide fail-closed). REQ-DRE-01.5 seeds `src/gone.ts` so the remove targets a real file.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, modify, find, dryRun } from "../../src/commons/index.ts";

describe("e2e — dry-run plan exposure (REQ-DRE-01.1, REQ-DRE-01.5)", () => {
  it("REQ-DRE-01.1 — buffered create+modify surface in author vocabulary, buffer order", async () => {
    const fake = new ContractFake({ seed: { "src/b.ts": "old" } });

    const run = defineFactory<void>(async () => {
      create("src/a.ts", { template: "export const a = 1;", options: {} });
      modify("src/b.ts", "content");

      expect(dryRun()).toEqual([
        { verb: "create", path: "src/a.ts", kind: "rendered" },
        { verb: "modify", path: "src/b.ts" },
      ]);
    });

    await run(undefined, { client: fake });
  });

  it("REQ-DRE-01.5 — find().remove() surfaces as verb 'remove' through the accessor", async () => {
    const fake = new ContractFake({ seed: { "src/gone.ts": "content" } });

    const run = defineFactory<void>(async () => {
      find("src/gone.ts").remove();

      expect(dryRun()).toEqual([{ verb: "remove", path: "src/gone.ts" }]);
    });

    await run(undefined, { client: fake });
  });
});
