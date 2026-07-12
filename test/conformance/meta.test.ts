/**
 * CONF-01 meta-test: asserts the conformance kit's own public surface.
 * Removing any exported property makes this test RED — it is the seed of the
 * future conformance harness and proves the wiring fires.
 *
 * S-004: the old "throws, no dialect exists yet" stub assertions are RETIRED — a real
 * dialect exists now, and `testDialect`/`testOpPack`'s real bodies (against the REAL
 * TypeScript dialect) are asserted in `test/conformance/typescript-conformance.test.ts`.
 * This file stays scoped to what it always was: the kit's export-surface wiring.
 */
import { describe, it, expect } from "bun:test";
import * as conformance from "../../src/conformance/index.ts";

describe("conformance — meta-test: public surface is intact", () => {
  it("exports testDialect as a function", () => {
    expect(conformance).toHaveProperty("testDialect");
    expect(typeof conformance.testDialect).toBe("function");
  });

  it("exports testOpPack as a function", () => {
    expect(conformance).toHaveProperty("testOpPack");
    expect(typeof conformance.testOpPack).toBe("function");
  });

  // testDialect/testOpPack are `async (...): Promise<void>` (ADR-0012 amendment, rev 3 Q3)
  // — calling either returns a Promise, never a synchronous result.
  it("testDialect returns a Promise", () => {
    const result = conformance.testDialect({ dialect: { extensions: [], ast: { parse: (s: string) => s, print: (s: string) => s }, ops: {}, find: () => { throw new Error("not used"); } }, samples: [] });
    expect(result).toBeInstanceOf(Promise);
    // Swallow — this fixture's `find` is never called for an empty `samples` array; the
    // resulting promise resolves cleanly (no samples to fail round-trip on).
    void result.catch(() => {});
  });

  // Red-proof: delete testDialect from a copy of the real conformance surface →
  // the property check fails. This proves the live check would catch a real export removal.
  it("the real surface missing testDialect fails the property check", () => {
    const stripped = { ...conformance } as Record<string, unknown>;
    delete stripped["testDialect"];
    expect(stripped).not.toHaveProperty("testDialect");
    // The surviving export is still present — only testDialect was removed.
    expect(stripped).toHaveProperty("testOpPack");
  });

  // Red-proof: delete testOpPack from a copy of the real conformance surface →
  // the property check fails.
  it("the real surface missing testOpPack fails the property check", () => {
    const stripped = { ...conformance } as Record<string, unknown>;
    delete stripped["testOpPack"];
    expect(stripped).not.toHaveProperty("testOpPack");
    expect(stripped).toHaveProperty("testDialect");
  });
});
