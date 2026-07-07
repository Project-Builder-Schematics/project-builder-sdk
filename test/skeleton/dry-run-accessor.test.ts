/**
 * REQ-DRE-01.4 — `dryRun()` called with no active `defineFactory` run propagates the
 * same outside-run error every other author verb raises (`currentContext()`,
 * `src/core/context.ts:20-24`) — no accessor-specific try/catch or fallback.
 *
 * S-002 extends this file with the buffer-state variants (REQ-DRE-01.2/.3); this slice
 * (S-001) covers REQ-DRE-01.4 only — no run, no flush, no harness needed.
 */
import { describe, it, expect } from "bun:test";
import { dryRun } from "../../src/commons/index.ts";

describe("dry-run accessor — outside-run propagation (REQ-DRE-01.4)", () => {
  it("throws the standard outside-run error when called with no active run", () => {
    expect(() => dryRun()).toThrow("can only be used while a schematic is running");
  });
});
