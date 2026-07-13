/**
 * REQ-CCL-01..06 (S-001, design §Test Derivation): the by-value/by-reference classifier —
 * stat-gate before any content read, whole-file UTF-8/null-byte sniff, serialized-budget
 * verdict, and the `.template` render-request fail-loud carve-out (REQ-CCL-05). Unit level
 * — `classifyTransport` is called directly against real scratch files; no `defineFactory`
 * run needed (it takes `packageDir` as a plain argument). `destPath`/`options` are now
 * REQUIRED params (judgment-day iteration 1 fix, REQ-CCL-02): the budget gate measures the
 * PROSPECTIVE `create` directive, not the content string alone, so every call site below
 * threads a `destPath`/`options` pair even where the fixture's own budget math is
 * irrelevant to what's being pinned (containment/sniff/stat-gate) — arbitrary but present.
 *
 * The REQ-CCL-02.3 boundary describe block below is the ONE deliberate exception to the
 * "call classifyTransport directly" convention: the judgment-day-iteration-1 defect (a
 * content-only budget measure diverging from the ACTUAL `create` directive the expander
 * emits) is invisible to a classifyTransport-only verdict assertion — the two measures
 * only diverge once the source is wrapped in the real directive (pathTemplate + options
 * overhead) and driven through the real batch-cap emit check. It drives a real
 * `defineFactory({ packageDir })` + `scaffold()` run instead.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { writeFileSync, statSync, mkdirSync } from "node:fs";
import * as fs from "node:fs";
import { join } from "node:path";
import { classifyTransport } from "../../src/scaffold/classify-transport.ts";
import { BATCH_CAP_BYTES, serializedBatchSize } from "../../src/core/wire.ts";
import { defineFactory } from "../../src/core/context.ts";
import { scaffold } from "../../src/commons/index.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { collectOps } from "../support/spy-client.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { expectReason } from "../support/expect-reason.ts";

const scratchDir = scratchDirFactory("classify-transport-");

describe("REQ-CCL-01 — deterministic by-value/by-reference sniff", () => {
  it("REQ-CCL-01.1: valid UTF-8, no null byte, in budget → by-value", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "export const a = 1;", "utf-8");

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "a.ts",
      isTemplateMarked: false,
      destPath: "a.ts",
      options: {},
    });

    expect(result).toEqual({ verdict: "by-value", content: "export const a = 1;" });
  });

  it("REQ-CCL-01.2: invalid UTF-8 → by-reference", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "bad.bin"), Buffer.from([0xff, 0xfe, 0x00, 0x01]));

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "bad.bin",
      isTemplateMarked: false,
      destPath: "bad.bin",
      options: {},
    });

    expect(result.verdict).toEqual("by-reference");
  });

  it("REQ-CCL-01.3: invalid UTF-8 WITHOUT any null byte → by-reference (kills the null-scan-only mutant)", () => {
    const dir = scratchDir();
    const fixtures: Array<[string, number[]]> = [
      ["overlong-null.bin", [0xc0, 0x80]],
      ["lone-surrogate.bin", [0xed, 0xa0, 0x80]],
      ["lone-continuation.bin", [0x80]],
    ];
    for (const [name, bytes] of fixtures) {
      writeFileSync(join(dir, name), Buffer.from(bytes));
      expect(bytes.includes(0x00)).toBe(false);
      const result = classifyTransport({
        packageDir: dir,
        packageRoot: dir,
        relPath: name,
        isTemplateMarked: false,
        destPath: name,
        options: {},
      });
      expect(result.verdict).toEqual("by-reference");
    }
  });

  it("REQ-CCL-01.4: valid multi-byte UTF-8 → by-value (kills the ASCII-only mutant)", () => {
    const dir = scratchDir();
    const content = "café 日本語 😀";
    writeFileSync(join(dir, "multibyte.ts"), content, "utf-8");

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "multibyte.ts",
      isTemplateMarked: false,
      destPath: "multibyte.ts",
      options: {},
    });

    expect(result).toEqual({ verdict: "by-value", content });
  });

  it("REQ-FEH-01.1 (judgment-day iteration 2 fix): a UTF-8 BOM-prefixed file preserves the BOM — exact content, never stripped", () => {
    const dir = scratchDir();
    const content = "\uFEFFhi";
    writeFileSync(join(dir, "bom.ts"), content, "utf-8");

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "bom.ts",
      isTemplateMarked: false,
      destPath: "bom.ts",
      options: {},
    });

    expect(result).toEqual({ verdict: "by-value", content });
    expect((result as { verdict: "by-value"; content: string }).content.charCodeAt(0)).toEqual(0xfeff);
  });

  it("REQ-CCL-01.5: empty (0-byte) file → by-value", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "empty.ts"), "", "utf-8");

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "empty.ts",
      isTemplateMarked: false,
      destPath: "empty.ts",
      options: {},
    });

    expect(result).toEqual({ verdict: "by-value", content: "" });
  });
});

// Same measurer classify-transport.ts's budget check and the fake's real batch-cap check
// both use (`core/wire.ts`) — the batch shape for ONE `create` directive at `pathTemplate`
// with EMPTY options and no `force` (scaffold's own defaults when the author passes
// neither), given `content`. Mirrors batch-cap-chunk.test.ts's established pattern for the
// SAME measurer — not duplicated as a shared helper (that file's own local convention).
function soloDirectiveBatchSize(pathTemplate: string, content: string): number {
  return serializedBatchSize([{ op: "create", create: { pathTemplate, template: content, options: {} } }]);
}

// The fixed per-directive envelope overhead (batch wrapper + `create` wrapper +
// `pathTemplate` + empty `options`, structural characters) at `pathTemplate` — derived by
// measuring an EMPTY-content directive, so exact content lengths for precise boundary
// offsets fall out of simple subtraction.
function soloDirectiveOverhead(pathTemplate: string): number {
  return soloDirectiveBatchSize(pathTemplate, "");
}

describe("REQ-CCL-02 — frame budget, inclusive boundary", () => {
  it("REQ-CCL-02.1: same content, budget-crossing size flips classification", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "under.ts"), "a".repeat(1000), "utf-8");
    writeFileSync(join(dir, "over.ts"), "a".repeat(BATCH_CAP_BYTES + 1000), "utf-8");

    expect(
      classifyTransport({
        packageDir: dir,
        packageRoot: dir,
        relPath: "under.ts",
        isTemplateMarked: false,
        destPath: "under.ts",
        options: {},
      }).verdict
    ).toEqual("by-value");
    expect(
      classifyTransport({
        packageDir: dir,
        packageRoot: dir,
        relPath: "over.ts",
        isTemplateMarked: false,
        destPath: "over.ts",
        options: {},
      }).verdict
    ).toEqual("by-reference");
  });

  it("REQ-CCL-02.2: raw size under budget, serialized DIRECTIVE size over → by-reference", () => {
    const dir = scratchDir();
    // Each "\n" raw byte escapes to two bytes ("\\n") once JSON-serialized — pushing the
    // serialized DIRECTIVE form (content + envelope + wrapper + pathTemplate + options)
    // over budget while the raw content stays comfortably under it.
    const rawSize = Math.floor(BATCH_CAP_BYTES * 0.75);
    const destPath = "escapes.ts";
    const content = "\n".repeat(rawSize);
    writeFileSync(join(dir, "escapes.ts"), content, "utf-8");
    expect(rawSize).toBeLessThan(BATCH_CAP_BYTES);
    // Pins the DIRECTIVE-inclusive quantity the verdict is actually based on (judgment-day
    // iteration 1 fix) — not just the content's own serialized form.
    expect(soloDirectiveBatchSize(destPath, content)).toBeGreaterThan(BATCH_CAP_BYTES);

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "escapes.ts",
      isTemplateMarked: false,
      destPath,
      options: {},
    });

    expect(result.verdict).toEqual("by-reference");
  });
});

describe("REQ-CCL-02.3 — exactly-at-budget boundary, directive-inclusive, driven through a REAL emit", () => {
  it("judgment-day iteration 1 (the load-bearing proof): a file whose CONTENT serializes under budget but whose full `create` DIRECTIVE lands exactly ONE BYTE over the cap classifies by-reference and the scaffold run SUCCEEDS — not `changes-too-large`", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const destPath = "out/over.ts";
    const overhead = soloDirectiveOverhead(destPath);
    // Content sized so the DIRECTIVE (not the content alone) lands exactly one byte over
    // BATCH_CAP_BYTES; the content's OWN serialized form stays comfortably under budget —
    // this is exactly the file shape the pre-fix classifier misclassified by-value.
    const content = "a".repeat(BATCH_CAP_BYTES - overhead + 1);
    expect(Buffer.byteLength(JSON.stringify(content), "utf8")).toBeLessThan(BATCH_CAP_BYTES);
    expect(soloDirectiveBatchSize(destPath, content)).toEqual(BATCH_CAP_BYTES + 1);
    writeFileSync(join(dir, "files", "over.ts"), content, "utf-8");

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });
    const result = await runFactoryForTest(run, undefined);

    // Pre-fix (RED, judgment-day iteration 1 finding): the classifier measured only the
    // content string, saw it comfortably under budget, classified by-value — the expander
    // then flushed the lone over-cap `create` directive as its own group and the fake's
    // emit rejected `changes-too-large`, committing 0 files.
    // Post-fix (GREEN): the classifier measures the PROSPECTIVE directive, sees it one
    // byte over, classifies by-reference — the expander emits a tiny `copyIn` instead and
    // the run succeeds.
    expect(result.error).toBeUndefined();
    const copyInDirectives = collectOps(result.emitted, "copyIn");
    expect(copyInDirectives).toHaveLength(1);
    expect(copyInDirectives[0]?.copyIn).toEqual({ from: "files/over.ts", to: "out/over.ts" });
    expect(result.tree.has("out/over.ts")).toBe(false); // Q21/BRC-04: copyIn never materializes tree content in the fake
  });

  it("a file whose full `create` DIRECTIVE lands exactly AT the cap still classifies by-value and commits via `create` (inclusive `>`, not `>=`)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const destPath = "out/at.ts";
    const overhead = soloDirectiveOverhead(destPath);
    const content = "a".repeat(BATCH_CAP_BYTES - overhead);
    expect(soloDirectiveBatchSize(destPath, content)).toEqual(BATCH_CAP_BYTES);
    writeFileSync(join(dir, "files", "at.ts"), content, "utf-8");

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });
    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBeUndefined();
    expect(result.tree.get("out/at.ts")).toEqual(content);
  });
});

describe("REQ-CCL-03 — whole-file null-byte/UTF-8 scan (tail detection)", () => {
  it("REQ-CCL-03.1: text-valid head, binary tail → by-reference", () => {
    const dir = scratchDir();
    const buf = Buffer.concat([Buffer.from("a".repeat(4096), "utf-8"), Buffer.from([0x00])]);
    writeFileSync(join(dir, "tail-null.bin"), buf);

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "tail-null.bin",
      isTemplateMarked: false,
      destPath: "tail-null.bin",
      options: {},
    });

    expect(result.verdict).toEqual("by-reference");
  });

  it("REQ-CCL-03.2: tail-null beyond 64KB kills the fixed-window-sampler mutant", () => {
    const dir = scratchDir();
    const buf = Buffer.concat([Buffer.from("a".repeat(70 * 1024), "utf-8"), Buffer.from([0x00])]);
    writeFileSync(join(dir, "big-tail-null.bin"), buf);

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "big-tail-null.bin",
      isTemplateMarked: false,
      destPath: "big-tail-null.bin",
      options: {},
    });

    expect(result.verdict).toEqual("by-reference");
  });
});

describe("REQ-CCL-06 — stat-size gate before any content read", () => {
  it("REQ-CCL-06.1: an over-budget-by-stat file classifies by-reference with zero content reads", () => {
    const dir = scratchDir();
    const path = join(dir, "huge.bin");
    writeFileSync(path, "a".repeat(BATCH_CAP_BYTES + 1), "utf-8");
    const stSize = statSync(path).size;
    expect(stSize).toBeGreaterThan(BATCH_CAP_BYTES);

    // Mutation-coverage (final-verify remediation): asserting only the verdict + absent
    // `content` field lets a mutant that DELETES the stat gate survive — it would slurp the
    // whole file via readFileSync and still land on "by-reference" via the post-read
    // serialized-budget check (REQ-CCL-02), producing an identical `{ verdict }` shape.
    // Spying on readFileSync (mirrors containment.test.ts's REQ-PRC-08.1 pattern) proves the
    // stat gate itself — not a downstream check — is what stopped the read.
    const readSpy = spyOn(fs, "readFileSync");
    try {
      const result = classifyTransport({
        packageDir: dir,
        packageRoot: dir,
        relPath: "huge.bin",
        isTemplateMarked: false,
        destPath: "huge.bin",
        options: {},
      });

      expect(result.verdict).toEqual("by-reference");
      expect("content" in result).toBe(false);
      expect(readSpy).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
    }
  });
});

describe("REQ-CCL-05 — .template render-request fail-loud carve-out (never degrades to by-reference)", () => {
  it("REQ-CCL-05.1: a binary .template-marked source fails loud naming the source, never by-reference", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "logo.svg"), Buffer.from([0x00, 0x01, 0x02]));

    const err = expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          packageRoot: dir,
          relPath: "logo.svg",
          isTemplateMarked: true,
          destPath: "logo.svg",
          options: {},
        }),
      "invalid-input"
    );
    expect(err.message).toContain("logo.svg");
  });

  it("an over-budget .template-marked source fails loud, never by-reference", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "huge.template"), "a".repeat(BATCH_CAP_BYTES + 1), "utf-8");

    expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          packageRoot: dir,
          relPath: "huge.template",
          isTemplateMarked: true,
          destPath: "huge.template",
          options: {},
        }),
      "invalid-input"
    );
  });

  it("a valid text .template-marked source still classifies by-value normally", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "ok.ts.template"), "export const x = {= x =};", "utf-8");

    const result = classifyTransport({
      packageDir: dir,
      packageRoot: dir,
      relPath: "ok.ts.template",
      isTemplateMarked: true,
      destPath: "ok.ts.template",
      options: {},
    });

    expect(result).toEqual({ verdict: "by-value", content: "export const x = {= x =};" });
  });
});

describe("REQ-PRC-04 — source containment, delegated to containment.ts (S-002 hardened the S-001 placeholder)", () => {
  it("REQ-PRC-04.1: a source-relative path containing a '..' segment rejects source-outside-package", () => {
    const dir = scratchDir();

    expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          packageRoot: dir,
          relPath: "../outside.txt",
          isTemplateMarked: false,
          destPath: "outside.txt",
          options: {},
        }),
      "source-outside-package"
    );
  });

  it("REQ-PRC-04.6: an absolute source-relative path rejects source-outside-package (no '..' present)", () => {
    const dir = scratchDir();

    expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          packageRoot: dir,
          relPath: "/etc/passwd",
          isTemplateMarked: false,
          destPath: "passwd",
          options: {},
        }),
      "source-outside-package"
    );
  });
});
