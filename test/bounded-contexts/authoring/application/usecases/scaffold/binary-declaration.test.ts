/**
 * #163: scaffold copies byte for byte only the files the author declares in `binary`; every
 * other file renders. Size and options never turn a render into a copy: a file that cannot be
 * rendered, or does not fit one emit frame, rejects naming it.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scaffold, AuthoringError } from "../../../../../../src/commons/index.ts";
import { runFactoryForTest } from "../../../../../../src/testing/index.ts";
import { collectOps } from "../../../../../support/spy-client.ts";
import { scratchDirFactory } from "../../../../../support/scratch-dir.ts";
import { EMIT_BATCH_BUDGET_BYTES } from "../../../../../../src/shared-kernel/batch-cap.ts";
import type { ScaffoldOptions } from "../../../../../../src/commons/index.ts";

const scratchDir = scratchDirFactory("scaffold-binary-");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

/** A package whose `files` folder holds `entries` (path → content), scaffolded into `out`. */
async function scaffolded(entries: Record<string, string | Buffer>, options: Omit<ScaffoldOptions, "from" | "to"> = {}) {
  const dir = scratchDir();
  for (const [path, content] of Object.entries(entries)) {
    mkdirSync(join(dir, "files", path, ".."), { recursive: true });
    writeFileSync(join(dir, "files", path), content);
  }
  return runFactoryForTest(() => scaffold({ from: "files", to: "out", ...options }), undefined, { packageDir: dir });
}

function rejection(error: unknown): AuthoringError {
  expect(error).toBeInstanceOf(AuthoringError);
  expect((error as AuthoringError).reason).toBe("invalid-input");
  return error as AuthoringError;
}

describe("scaffold binary — declared files are copied byte for byte", () => {
  it("copies a declared file and renders the rest", async () => {
    const result = await scaffolded({ "logo.png": PNG, "a.ts": "export const a = 1;\n" }, { binary: ["logo.png"] });
    expect(result.error).toBeUndefined();
    expect(collectOps(result.emitted, "copyIn").map((d) => d.copyIn)).toEqual([{ from: "files/logo.png", to: "out/logo.png" }]);
    expect(collectOps(result.emitted, "create").map((d) => d.create.pathTemplate)).toEqual(["out/a.ts"]);
  });

  it("matches globs against the path inside the source folder", async () => {
    const result = await scaffolded({ "img/a.png": PNG, "img/b.png": PNG }, { binary: ["**/*.png"] });
    expect(result.error).toBeUndefined();
    expect(collectOps(result.emitted, "copyIn").map((d) => d.copyIn.from)).toEqual(["files/img/a.png", "files/img/b.png"]);
  });

  it("copies a declared text file verbatim instead of rendering it", async () => {
    const result = await scaffolded({ "raw.txt": "{= .name =}\n" }, { binary: ["raw.txt"] });
    expect(result.error).toBeUndefined();
    expect(collectOps(result.emitted, "create")).toHaveLength(0);
    expect(collectOps(result.emitted, "copyIn")).toHaveLength(1);
  });

  it("allows a pattern that matches nothing", async () => {
    const result = await scaffolded({ "a.ts": "export const a = 1;\n" }, { binary: ["*.png"] });
    expect(result.error).toBeUndefined();
    expect(collectOps(result.emitted, "create")).toHaveLength(1);
  });
});

describe("scaffold binary — rejections", () => {
  it("rejects an undeclared file that is not text, suggesting the declaration", async () => {
    const result = await scaffolded({ "img/logo.png": PNG });
    expect(rejection(result.error).message).toBe(
      'invalid input: source "files/img/logo.png" is not valid text, so it cannot be rendered — ' +
        'declare it in scaffold\'s binary option (binary: ["img/logo.png"]) to copy it byte for byte'
    );
    expect(result.emitted).toHaveLength(0);
  });

  it("rejects a file declared binary that is also marked .template", async () => {
    const result = await scaffolded({ "a.ts.template": "export const a = 1;\n" }, { binary: ["*.template"] });
    expect(rejection(result.error).message).toBe(
      'invalid input: source "files/a.ts.template" is marked .template, which asks for rendering, ' +
        "and declared binary, which asks for a byte-for-byte copy — remove one of the two"
    );
    expect(result.emitted).toHaveLength(0);
  });

  it("rejects a text file too large for one emit frame, naming it and its size, instead of copying it", async () => {
    const size = EMIT_BATCH_BUDGET_BYTES + 1;
    const result = await scaffolded({ "big.txt": "a".repeat(size) });
    expect(rejection(result.error).message).toBe(
      `invalid input: source "files/big.txt" (${size} bytes) does not fit in one emit frame once rendered ` +
        `(the limit is ${EMIT_BATCH_BUDGET_BYTES} bytes) — make it smaller, or declare it in scaffold's binary option to copy it byte for byte`
    );
    expect(result.emitted).toHaveLength(0);
  });

  it("rejects a file that fits alone but not with its options, never copying it", async () => {
    const size = EMIT_BATCH_BUDGET_BYTES - 1024;
    const result = await scaffolded({ "near.txt": "a".repeat(size) }, { options: { pad: "b".repeat(2048) } });
    expect(rejection(result.error).message).toContain(`source "files/near.txt" (${size} bytes) does not fit in one emit frame once rendered`);
    expect(collectOps(result.emitted, "copyIn")).toHaveLength(0);
  });

  it("rejects a binary option that is not an array of strings", async () => {
    const result = await scaffolded({ "a.ts": "x\n" }, { binary: "*.png" as unknown as string[] });
    expect(rejection(result.error).message).toBe('invalid input: scaffold "binary" must be an array of strings');
  });
});
