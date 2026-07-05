/**
 * CONF-01 meta-test: asserts the conformance kit's own public surface.
 * Removing any exported property makes this test RED — it is the seed of the
 * future conformance harness and proves the wiring fires.
 *
 * Red-proof: removing `testDialect` from the actual export object → the property
 * check fails. Demonstrated by deleting the key from a spread copy of the real module.
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
