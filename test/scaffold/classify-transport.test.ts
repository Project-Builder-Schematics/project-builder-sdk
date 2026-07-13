/**
 * REQ-CCL-01..06 (S-001, design §Test Derivation): the by-value/by-reference classifier —
 * stat-gate before any content read, whole-file UTF-8/null-byte sniff, serialized-budget
 * verdict, and the `.template` render-request fail-loud carve-out (REQ-CCL-05). Unit level
 * — `classifyTransport` is called directly against real scratch files; no `defineFactory`
 * run needed (it takes `packageDir` as a plain argument).
 */
import { describe, it, expect } from "bun:test";
import { writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyTransport } from "../../src/scaffold/classify-transport.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("classify-transport-");

describe("REQ-CCL-01 — deterministic by-value/by-reference sniff", () => {
  it("REQ-CCL-01.1: valid UTF-8, no null byte, in budget → by-value", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "export const a = 1;", "utf-8");

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "a.ts", isTemplateMarked: false });

    expect(result).toEqual({ verdict: "by-value", content: "export const a = 1;" });
  });

  it("REQ-CCL-01.2: invalid UTF-8 → by-reference", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "bad.bin"), Buffer.from([0xff, 0xfe, 0x00, 0x01]));

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "bad.bin", isTemplateMarked: false });

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
      const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: name, isTemplateMarked: false });
      expect(result.verdict).toEqual("by-reference");
    }
  });

  it("REQ-CCL-01.4: valid multi-byte UTF-8 → by-value (kills the ASCII-only mutant)", () => {
    const dir = scratchDir();
    const content = "café 日本語 😀";
    writeFileSync(join(dir, "multibyte.ts"), content, "utf-8");

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "multibyte.ts", isTemplateMarked: false });

    expect(result).toEqual({ verdict: "by-value", content });
  });

  it("REQ-CCL-01.5: empty (0-byte) file → by-value", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "empty.ts"), "", "utf-8");

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "empty.ts", isTemplateMarked: false });

    expect(result).toEqual({ verdict: "by-value", content: "" });
  });
});

describe("REQ-CCL-02 — frame budget, inclusive boundary", () => {
  it("REQ-CCL-02.1: same content, budget-crossing size flips classification", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "under.ts"), "a".repeat(1000), "utf-8");
    writeFileSync(join(dir, "over.ts"), "a".repeat(BATCH_CAP_BYTES + 1000), "utf-8");

    expect(classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "under.ts", isTemplateMarked: false }).verdict).toEqual(
      "by-value"
    );
    expect(classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "over.ts", isTemplateMarked: false }).verdict).toEqual(
      "by-reference"
    );
  });

  it("REQ-CCL-02.2: raw size under budget, serialized size over → by-reference", () => {
    const dir = scratchDir();
    // Each "\n" raw byte escapes to two bytes ("\\n") once JSON-serialized — pushing the
    // serialized form over budget while the raw content stays under it.
    const rawSize = Math.floor(BATCH_CAP_BYTES * 0.75);
    writeFileSync(join(dir, "escapes.ts"), "\n".repeat(rawSize), "utf-8");
    expect(rawSize).toBeLessThan(BATCH_CAP_BYTES);

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "escapes.ts", isTemplateMarked: false });

    expect(result.verdict).toEqual("by-reference");
  });

  it("REQ-CCL-02.3: exactly-at-budget boundary is inclusive — `>` not `>=`", () => {
    const dir = scratchDir();
    // Content is a bare ASCII run: JSON.stringify adds exactly 2 bytes for the wrapping
    // quotes, so `rawSize = BATCH_CAP_BYTES - 2` serializes to EXACTLY BATCH_CAP_BYTES.
    const atBudget = "a".repeat(BATCH_CAP_BYTES - 2);
    const overBudget = "a".repeat(BATCH_CAP_BYTES - 1);
    writeFileSync(join(dir, "at.ts"), atBudget, "utf-8");
    writeFileSync(join(dir, "over.ts"), overBudget, "utf-8");
    expect(Buffer.byteLength(JSON.stringify(atBudget), "utf8")).toEqual(BATCH_CAP_BYTES);
    expect(Buffer.byteLength(JSON.stringify(overBudget), "utf8")).toEqual(BATCH_CAP_BYTES + 1);

    expect(classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "at.ts", isTemplateMarked: false }).verdict).toEqual(
      "by-value"
    );
    expect(classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "over.ts", isTemplateMarked: false }).verdict).toEqual(
      "by-reference"
    );
  });
});

describe("REQ-CCL-03 — whole-file null-byte/UTF-8 scan (tail detection)", () => {
  it("REQ-CCL-03.1: text-valid head, binary tail → by-reference", () => {
    const dir = scratchDir();
    const buf = Buffer.concat([Buffer.from("a".repeat(4096), "utf-8"), Buffer.from([0x00])]);
    writeFileSync(join(dir, "tail-null.bin"), buf);

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "tail-null.bin", isTemplateMarked: false });

    expect(result.verdict).toEqual("by-reference");
  });

  it("REQ-CCL-03.2: tail-null beyond 64KB kills the fixed-window-sampler mutant", () => {
    const dir = scratchDir();
    const buf = Buffer.concat([Buffer.from("a".repeat(70 * 1024), "utf-8"), Buffer.from([0x00])]);
    writeFileSync(join(dir, "big-tail-null.bin"), buf);

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "big-tail-null.bin", isTemplateMarked: false });

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

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "huge.bin", isTemplateMarked: false });

    expect(result.verdict).toEqual("by-reference");
    expect("content" in result).toBe(false);
  });
});

describe("REQ-CCL-05 — .template render-request fail-loud carve-out (never degrades to by-reference)", () => {
  it("REQ-CCL-05.1: a binary .template-marked source fails loud naming the source, never by-reference", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "logo.svg"), Buffer.from([0x00, 0x01, 0x02]));

    let caught: unknown;
    try {
      classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "logo.svg", isTemplateMarked: true });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
    expect((caught as Error).message).toContain("logo.svg");
  });

  it("an over-budget .template-marked source fails loud, never by-reference", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "huge.template"), "a".repeat(BATCH_CAP_BYTES + 1), "utf-8");

    let caught: unknown;
    try {
      classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "huge.template", isTemplateMarked: true });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
  });

  it("a valid text .template-marked source still classifies by-value normally", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "ok.ts.template"), "export const x = {= x =};", "utf-8");

    const result = classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "ok.ts.template", isTemplateMarked: true });

    expect(result).toEqual({ verdict: "by-value", content: "export const x = {= x =};" });
  });
});

describe("REQ-PRC-04 — source containment, delegated to containment.ts (S-002 hardened the S-001 placeholder)", () => {
  it("REQ-PRC-04.1: a source-relative path containing a '..' segment rejects source-outside-package", () => {
    const dir = scratchDir();

    let caught: unknown;
    try {
      classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "../outside.txt", isTemplateMarked: false });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("source-outside-package");
    expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
  });

  it("REQ-PRC-04.6: an absolute source-relative path rejects source-outside-package (no '..' present)", () => {
    const dir = scratchDir();

    let caught: unknown;
    try {
      classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "/etc/passwd", isTemplateMarked: false });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("source-outside-package");
  });
});
