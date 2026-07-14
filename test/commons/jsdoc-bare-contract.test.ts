/**
 * REQ-TES-10.1 (S-002, bare-factory-migration): `src/commons/index.ts`'s JSDoc
 * (6 pre-change mentions of `defineFactory({ packageDir })`/`defineFactory` at
 * lines 165, 234, 274, 382, 385, 393) must carry zero `defineFactory` occurrences,
 * describing the bare-shape contract instead — same defect class as REQ-TES-09's
 * scaffold/expander error strings, surfaced by QA council review.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(import.meta.dir, "../../src/commons/index.ts"), "utf-8");

describe("REQ-TES-10.1 — src/commons/index.ts JSDoc carries zero defineFactory tokens", () => {
  it("the literal token 'defineFactory' does not appear anywhere in the file", () => {
    expect(SOURCE).not.toContain("defineFactory");
  });
});
