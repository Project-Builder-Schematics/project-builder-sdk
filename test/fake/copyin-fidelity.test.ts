/**
 * REQ-BRC-06 / REQ-ATH-15 (S-003, design §Test Derivation): the by-reference directive's
 * end-to-end harness obligations — a valid copyIn lands in `result.emitted` and NEVER in
 * `result.tree` (emit-only evidence boundary, BRC-04/Q21), and a missing package-local
 * source surfaces `AuthoringError{reason:"source-not-found"}` through the harness run,
 * regardless of which layer (SDK-side containment) produced the rejection (V3 reword —
 * the fake is NOT required to re-check package disk, ADR-0045).
 */
import { describe, it, expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { copyIn, AuthoringError } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("copyin-fidelity-");

describe("REQ-ATH-15.1 — a valid by-reference directive lands in result.emitted, never in result.tree", () => {
  it("an existing source, non-colliding destination: result.emitted carries the directive, result.tree has no entry for it", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");

    const run = defineFactory<void>(() => {
      copyIn("asset.svg", "dest/asset.svg");
    }, { packageDir: dir });

    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBeUndefined();
    const copyInDirectives = result.emitted.flatMap((b) => b.instructions).filter((d) => d.op === "copyIn");
    expect(copyInDirectives).toHaveLength(1);
    expect(result.tree.has("dest/asset.svg")).toBe(false);
    expect(result.tree.size).toEqual(0);
  });
});

describe("REQ-ATH-15.2 / REQ-BRC-06.1 — a missing package-local source surfaces source-not-found through the harness", () => {
  it("copyIn on an in-ceiling source that does not exist in the package rejects with reason source-not-found", async () => {
    const dir = scratchDir();
    // No file written at "missing.svg" — an in-ceiling path (a direct child of the
    // package) that simply does not exist.

    const run = defineFactory<void>(() => {
      copyIn("missing.svg", "dest/missing.svg");
    }, { packageDir: dir });

    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("source-not-found");
    expect(result.tree.size).toEqual(0);
    expect(result.emitted).toHaveLength(0);
  });
});
