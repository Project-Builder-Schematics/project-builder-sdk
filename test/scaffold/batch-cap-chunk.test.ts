/**
 * REQ-04/REQ-05 (S-004, design §Test Derivation, batch-cap-contract delta spec): aggregate
 * scaffold size never blocks by itself (REQ-04.1) — the expander chunks via mid-run
 * `session.flush()` calls; a single group whose OWN batch exceeds the cap still rejects,
 * unchanged (REQ-04.2); the `>` (not `>=`) boundary is inclusive at the GROUP level, same
 * as the existing per-file boundary (REQ-04.3); a later-chunk failure commits nothing from
 * earlier, already-flushed chunks (REQ-05.1, run-level all-or-nothing survives chunking).
 *
 * Boundary fixtures compute their exact byte lengths algorithmically (mirroring the
 * established REQ-CCL-02.3 pattern) rather than hardcoding magic numbers — the envelope
 * overhead of ONE `create` directive (fixed `pathTemplate`, empty `options`, no `force`
 * key) is measured directly via the SAME serialization the production accumulator and the
 * fake's `emit` both use (`Buffer.byteLength(JSON.stringify(batch), "utf8")`).
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, AuthoringError } from "../../src/commons/index.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import type { Batch } from "../../src/core/wire.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("batch-cap-chunk-");

// Mirrors expander.ts's own `candidateBatchSize` measurement exactly — the batch shape
// for ONE `create` directive at `pathTemplate`, given `content`.
function soloBatchSize(pathTemplate: string, content: string): number {
  const batch: Batch = {
    protocolVersion: 1,
    force: false,
    instructions: [{ op: "create", create: { pathTemplate, template: content, options: {} } }],
  };
  return Buffer.byteLength(JSON.stringify(batch), "utf8");
}

// The fixed per-directive JSON envelope overhead (path template + structural characters)
// for an EMPTY-content `create` directive at `pathTemplate` — used to derive exact
// content lengths that land a solo-group batch at precise boundary offsets.
function soloEnvelopeOverhead(pathTemplate: string): number {
  return soloBatchSize(pathTemplate, "");
}

describe("REQ-04.1 — aggregate scaffold size exceeding the cap never blocks, as long as no single group does", () => {
  it("three files whose COMBINED size exceeds BATCH_CAP_BYTES, but no flushed group does, all commit — none dropped/duplicated/reordered", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    // 1.5 MiB each, ASCII (no JSON-escaping surprises): 3 files ≈ 4.5 MiB combined,
    // comfortably over BATCH_CAP_BYTES (4 MiB); any 2-file group (~3 MiB) still fits.
    const perFile = Math.floor(1.5 * 1024 * 1024);
    const names = ["a.ts", "b.ts", "c.ts"];
    for (const [i, name] of names.entries()) {
      writeFileSync(join(dir, "files", name), String(i).repeat(perFile), "utf-8");
    }

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBeUndefined();
    expect(result.emitted.length).toBeGreaterThan(1); // proves chunking actually happened
    for (const batch of result.emitted) {
      const size = Buffer.byteLength(JSON.stringify(batch), "utf8");
      expect(size).toBeLessThanOrEqual(BATCH_CAP_BYTES);
    }
    // Exactly one directive per enumerated source file — none dropped, duplicated, or
    // reordered relative to walk order (alphabetical, per walk.ts's sort).
    const allInstructions = result.emitted.flatMap((b) => b.instructions);
    expect(allInstructions.length).toEqual(3);
    expect(allInstructions.map((d) => (d.op === "create" ? d.create.pathTemplate : undefined))).toEqual([
      "out/a.ts",
      "out/b.ts",
      "out/c.ts",
    ]);
    expect(result.tree.get("out/a.ts")).toEqual("0".repeat(perFile));
    expect(result.tree.get("out/b.ts")).toEqual("1".repeat(perFile));
    expect(result.tree.get("out/c.ts")).toEqual("2".repeat(perFile));
  });
});

describe("REQ-04.2 — a single group whose OWN batch exceeds the cap still rejects, unchanged", () => {
  it("a lone file whose CONTENT passes the per-file classify budget, but whose wrapped solo-group batch exceeds BATCH_CAP_BYTES, rejects changes-too-large", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const pathTemplate = "out/a.ts";
    const overhead = soloEnvelopeOverhead(pathTemplate);
    // Content itself: `overhead` bytes UNDER the cap, so ITS OWN serialized form passes
    // classify-transport's CCL-02 per-file budget (by-value) — the wrapped BATCH is what
    // pushes it over.
    const content = "a".repeat(BATCH_CAP_BYTES - overhead + 1);
    expect(Buffer.byteLength(JSON.stringify(content), "utf8")).toBeLessThan(BATCH_CAP_BYTES);
    expect(soloBatchSize(pathTemplate, content)).toEqual(BATCH_CAP_BYTES + 1);
    writeFileSync(join(dir, "files", "a.ts"), content, "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("changes-too-large");
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("REQ-04.3 — exactly-at-cap group passes; one byte over rejects (inclusive '>' boundary, group level)", () => {
  it("a solo-group batch landing EXACTLY at BATCH_CAP_BYTES passes", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const pathTemplate = "out/at.ts";
    const overhead = soloEnvelopeOverhead(pathTemplate);
    const content = "a".repeat(BATCH_CAP_BYTES - overhead);
    expect(soloBatchSize(pathTemplate, content)).toEqual(BATCH_CAP_BYTES);
    writeFileSync(join(dir, "files", "at.ts"), content, "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree().get("out/at.ts")).toEqual(content);
  });

  it("a solo-group batch landing ONE BYTE over BATCH_CAP_BYTES rejects changes-too-large", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const pathTemplate = "out/over.ts";
    const overhead = soloEnvelopeOverhead(pathTemplate);
    const content = "a".repeat(BATCH_CAP_BYTES - overhead + 1);
    expect(soloBatchSize(pathTemplate, content)).toEqual(BATCH_CAP_BYTES + 1);
    writeFileSync(join(dir, "files", "over.ts"), content, "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("changes-too-large");
  });
});

describe("REQ-05.1 — cross-chunk atomicity: a later-chunk failure commits nothing from earlier, already-flushed chunks", () => {
  it("a scaffold spanning ≥2 flushes, where a SECOND-flush directive collides, ends with an empty result.tree", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    // Two ~1.5 MiB files force a chunk boundary between them (first flush covers the
    // first file's group; the second is emitted on a LATER flush that will collide).
    const perFile = Math.floor(1.5 * 1024 * 1024);
    writeFileSync(join(dir, "files", "a.ts"), "A".repeat(perFile), "utf-8");
    writeFileSync(join(dir, "files", "b.ts"), "B".repeat(perFile), "utf-8");

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    // Seed a PRE-EXISTING "out/b.ts" so the second file's directive collides on emit —
    // "out/a.ts" has no seed, so the FIRST flush succeeds and stages content before the
    // SECOND flush (or the run-end flush) rejects.
    const result = await runFactoryForTest(run, undefined, { "out/b.ts": "existing" });

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("path-collision");
    expect(result.tree.size).toEqual(0);
  });
});
