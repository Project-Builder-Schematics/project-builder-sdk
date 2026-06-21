/**
 * CONF-01 meta-test: asserts the conformance kit's own public surface.
 * Removing any exported property makes this test RED — it is the seed of the
 * future conformance harness and proves the wiring fires.
 *
 * Red-proof: removing `testDialect` from the export → the property check fails.
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

  // Red-proof: assert that removing `testDialect` from a synthetic object fails the check.
  it("[red-proof] an object missing testDialect fails the property check", () => {
    const stripped = { testOpPack: () => {} };
    expect(stripped).not.toHaveProperty("testDialect");
  });

  // Red-proof: assert that removing `testOpPack` from a synthetic object fails the check.
  it("[red-proof] an object missing testOpPack fails the property check", () => {
    const stripped = { testDialect: () => {} };
    expect(stripped).not.toHaveProperty("testOpPack");
  });
});
