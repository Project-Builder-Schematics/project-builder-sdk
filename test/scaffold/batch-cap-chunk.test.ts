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
 *
 * Judgment-day iteration 1 fix (content-classification REQ-CCL-02): classify-transport's
 * per-file budget now measures the PROSPECTIVE `create` DIRECTIVE (envelope + wrapper +
 * pathTemplate + options), not the content string alone — so a file `scaffold` walks can
 * no longer classify by-value while its own emitted directive individually exceeds
 * `BATCH_CAP_BYTES`: classify-transport now routes it by-reference FIRST. The REQ-04.2 /
 * REQ-04.3 "solo group exceeds cap" scenarios below can therefore no longer be reconstructed
 * from a SCAFFOLDED file alone — they reconstruct the over-cap group from a directive
 * buffered OUTSIDE scaffold's own per-file classify gate (a direct `create()` call with an
 * inline oversized `template`, which never goes through `classifyTransport`), seeded into
 * the session BEFORE `scaffold()` runs — proving the expander's OWN flush/group mechanism
 * still propagates a genuinely over-cap group's rejection, independent of classify-transport.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, scaffold, AuthoringError } from "../../src/commons/index.ts";
import { BATCH_CAP_BYTES, serializedBatchSize } from "../../src/core/wire.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { collectOps } from "../support/spy-client.ts";
import { rejectedRun } from "../support/rejection-capture.ts";

const scratchDir = scratchDirFactory("batch-cap-chunk-");

// The SAME measurer the expander's accumulator consumes — the batch shape for ONE
// `create` directive at `pathTemplate`, given `content`.
function soloBatchSize(pathTemplate: string, content: string): number {
  return serializedBatchSize([{ op: "create", create: { pathTemplate, template: content, options: {} } }]);
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
  it("a directive buffered BEFORE scaffold runs, whose own solo batch alone exceeds BATCH_CAP_BYTES, flushes as its own over-cap group and rejects changes-too-large — proven independent of classify-transport (a direct create() call, never classified)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "tiny.ts"), "export const tiny = 1;", "utf-8");
    const pathTemplate = "pre-existing.ts";
    const overhead = soloEnvelopeOverhead(pathTemplate);
    // An inline-template create() call never reaches classify-transport (no source file,
    // no by-value/by-reference decision) — sized so its OWN solo batch already exceeds the
    // cap, then buffered BEFORE scaffold's walk starts.
    const bigTemplate = "a".repeat(BATCH_CAP_BYTES - overhead + 1);
    expect(soloBatchSize(pathTemplate, bigTemplate)).toEqual(BATCH_CAP_BYTES + 1);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create(pathTemplate, { template: bigTemplate, options: {} });
      // scaffold's expander seeds its pending-size accumulator from this ALREADY-buffered,
      // already-over-cap directive (`session.pendingSnapshot()`) — its very first file
      // triggers a flush of that pre-existing group before adding anything of its own.
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

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

  it("a group landing ONE BYTE over BATCH_CAP_BYTES rejects changes-too-large (contrast fixture: a scaffolded file this close to the cap now classifies by-reference FIRST, per REQ-CCL-02 — so, symmetrically with REQ-04.2 above, the over-cap group is reconstructed from a directive buffered outside scaffold's own classify gate)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "tiny.ts"), "export const tiny = 1;", "utf-8");
    const pathTemplate = "pre-existing-over.ts";
    const overhead = soloEnvelopeOverhead(pathTemplate);
    const bigTemplate = "a".repeat(BATCH_CAP_BYTES - overhead + 1);
    expect(soloBatchSize(pathTemplate, bigTemplate)).toEqual(BATCH_CAP_BYTES + 1);
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create(pathTemplate, { template: bigTemplate, options: {} });
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("changes-too-large");
  });
});

describe("REQ-05.1 — cross-chunk atomicity: a later-chunk failure commits nothing from earlier, already-flushed chunks", () => {
  it("a scaffold spanning ≥2 flushes, where a SECOND-flush directive collides, ends with an empty result.tree", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    // Two ~2.2 MiB files: COMBINED (~4.4 MiB) exceeds BATCH_CAP_BYTES (4 MiB), so the
    // accumulator genuinely flushes BETWEEN them — a.ts's group flushes mid-run BEFORE
    // b.ts is even buffered. (A prior 1.5+1.5 MiB fixture stayed under the 4 MiB cap
    // combined, so only ONE flush ever fired — at run end — and this scenario never
    // actually exercised cross-chunk rollback; a mutant letting each flush commit
    // independently would have passed unnoticed. 2.2+2.2 MiB forces a real second,
    // separately-flushed group.)
    const perFile = Math.floor(2.2 * 1024 * 1024);
    writeFileSync(join(dir, "files", "a.ts"), "A".repeat(perFile), "utf-8");
    writeFileSync(join(dir, "files", "b.ts"), "B".repeat(perFile), "utf-8");
    // Third, tiny BINARY file — walks last (alphabetical sort), classifies by-reference,
    // and lands in b.ts's group (negligible size next to the MiB-scale text files, well
    // under any remaining cap headroom). Proves the S-004 chunked-flush accumulator
    // (`candidateBatchSize`) correctly measures a MIXED create+copyIn batch — every prior
    // REQ-04/05 fixture in this file is pure-create — rather than silently mismeasuring or
    // dropping the copyIn directive when it shares a flush group with a create.
    writeFileSync(join(dir, "files", "c-binary.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    // Seed a PRE-EXISTING "out/b.ts" so the second file's directive collides on emit —
    // "out/a.ts" has no seed, so the FIRST flush succeeds and stages content before the
    // SECOND flush (or the run-end flush) rejects.
    const result = await runFactoryForTest(run, undefined, { "out/b.ts": "existing" });

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("path-collision");
    // Genuine chunk boundary: a.ts's group flushed mid-run, separately from b.ts/c's
    // run-end group — TWO emit() calls, not one. (This is what a 1.5+1.5 MiB fixture
    // could never prove: combined under the cap, everything rides one run-end flush and
    // this assertion would be vacuously 1.)
    expect(result.emitted.length).toBeGreaterThan(1);
    // Cross-chunk rollback: the SECOND flush's collision discards the WHOLE staging
    // tree, including a.ts's content the FIRST (already-succeeded) flush staged —
    // nothing commits from either chunk.
    expect(result.tree.size).toEqual(0);

    // The mixed batch was genuinely built and flushed (not skipped/mismeasured) — the
    // copyIn directive for the binary file is present among what was emitted, and (Q21/
    // BRC-04) never materializes tree content regardless of the run's overall outcome.
    const copyInDirectives = collectOps(result.emitted, "copyIn");
    expect(copyInDirectives).toHaveLength(1);
    expect(copyInDirectives[0]?.copyIn).toEqual({ from: "files/c-binary.png", to: "out/c-binary.png" });
    expect(result.tree.has("out/c-binary.png")).toBe(false);
  });
});
