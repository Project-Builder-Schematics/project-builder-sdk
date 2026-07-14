/**
 * REQ-BRC-01/05/07, REQ-CCL-04, REQ-FEH-05 (S-003, design §Test Derivation): the
 * by-reference copy wire contract exercised against the REAL fake — directive shape
 * (source path/destination pathTemplate/force, structurally distinguishable from
 * `create`), never a content field (BRC-01.2), package-relative source paths only
 * (BRC-07), collision with/without force (BRC-05/FEH-05), and the CCL-04 escape
 * (`copyIn` preserves template-like sequences verbatim that `scaffold` would otherwise
 * render by-value).
 *
 * Uses `runFactoryForTest` (not a bare `ContractFake`) so `result.emitted` exposes the
 * exact wire `Batch`/`Directive` shapes — `dryRun()`'s `DryRunEntry` deliberately strips
 * content/force, insufficient for BRC-01.2's "scan the full serialized directive"
 * assertion.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { scaffold, copyIn, create, AuthoringError } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { collectOps } from "../support/spy-client.ts";

const scratchDir = scratchDirFactory("scaffold-fake-");

describe("REQ-BRC-01.1 — by-reference directive is distinguishable from by-value in the same batch", () => {
  it("a scaffold over one text file and one binary file emits a create AND a copyIn, each carrying its own shape", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "text.ts"), "export const a = 1;", "utf-8");
    writeFileSync(join(dir, "files", "binary.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));

    const run = (): void => {
      scaffold({ from: "files", to: "out" });
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });
    expect(result.error).toBeUndefined();

    const [createDirective] = collectOps(result.emitted, "create");
    const [copyInDirective] = collectOps(result.emitted, "copyIn");

    expect(createDirective?.create.pathTemplate).toEqual("out/text.ts");
    expect(copyInDirective?.copyIn).toEqual({ from: "files/binary.png", to: "out/binary.png" });
  });
});

describe("REQ-BRC-01.2 — the directive carries a path REFERENCE, never the source's contents", () => {
  it("a copyIn over a binary fixture with distinctive bytes: the emitted directive has no content field, and no encoded form of the bytes appears anywhere in the serialized batch", async () => {
    const dir = scratchDir();
    const marker = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
    writeFileSync(join(dir, "asset.bin"), marker);

    const run = (): void => {
      copyIn("asset.bin", "dest/asset.bin");
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });
    expect(result.error).toBeUndefined();

    const [copyInDirective] = collectOps(result.emitted, "copyIn");
    expect(Object.keys(copyInDirective!.copyIn).sort()).toEqual(["from", "to"]);

    const serialized = JSON.stringify(result.emitted);
    expect(serialized).not.toContain(marker.toString("latin1"));
    expect(serialized).not.toContain(marker.toString("base64"));
    expect(serialized).not.toContain(marker.toString("hex"));
  });
});

describe("REQ-BRC-05.1 — by-reference collision without force rejects; with force overwrites", () => {
  it("copyIn onto a pre-existing destination rejects path-collision without force; force: true overwrites", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");

    const runNoForce = (): void => {
      copyIn("asset.svg", "dest/asset.svg");
    };
    const resultNoForce = await runFactoryForTest(runNoForce, undefined, {
      packageDir: dir,
      seed: { "dest/asset.svg": "existing" },
    });

    expect(resultNoForce.error).toBeInstanceOf(AuthoringError);
    expect((resultNoForce.error as AuthoringError).reason).toEqual("path-collision");
    expect((resultNoForce.error as AuthoringError).verb).toEqual("copyIn");

    const runForce = (): void => {
      copyIn("asset.svg", "dest/asset.svg", { force: true });
    };
    const resultForce = await runFactoryForTest(runForce, undefined, {
      packageDir: dir,
      seed: { "dest/asset.svg": "existing" },
    });

    expect(resultForce.error).toBeUndefined();
  });
});

describe("REQ-BRC-07.1 — emitted source path is package-relative, never absolute", () => {
  it("copyIn's emitted 'from' never contains the package's absolute directory", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");

    const run = (): void => {
      copyIn("asset.svg", "dest/asset.svg");
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });
    expect(JSON.stringify(result.emitted)).not.toContain(dir);
  });

  it("a by-reference scaffold entry's emitted 'from' is package-relative too", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "binary.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));

    const run = (): void => {
      scaffold({ from: "files", to: "out" });
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });
    expect(JSON.stringify(result.emitted)).not.toContain(dir);
  });
});

describe("REQ-CCL-04.1 — template-like text renders via scaffold by-value; copyIn is the documented verbatim escape", () => {
  const content = "keep this literal: {= not_a_real_token =}";

  it("scaffold classifies the file by-value; the emitted create directive's template is the literal content", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "literal.txt"), content, "utf-8");

    const run = (): void => {
      scaffold({ from: "files", to: "out" });
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });
    expect(result.error).toBeUndefined();
    expect(result.tree.get("out/literal.txt")).toEqual(content);
  });

  it("the SAME file via copyIn emits a by-reference directive instead — proving the escape is reachable", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "literal.txt"), content, "utf-8");

    const run = (): void => {
      copyIn("literal.txt", "out/literal.txt");
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });
    expect(result.error).toBeUndefined();

    const [copyInDirective] = collectOps(result.emitted, "copyIn");
    expect(copyInDirective?.copyIn).toEqual({ from: "literal.txt", to: "out/literal.txt" });
    // BRC-04/Q21: never lands in result.tree, even though the source is plain text.
    expect(result.tree.has("out/literal.txt")).toBe(false);
  });
});

describe("REQ-FEH-05.1 — create({templateFile}) collision without force rejects; with force overwrites", () => {
  it("create({templateFile}) onto an existing target rejects path-collision without force; force: true overwrites", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "tpl.ts.template"), "export const x = {= x =};", "utf-8");

    const runNoForce = (): void => {
      create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 } });
    };
    const resultNoForce = await runFactoryForTest(runNoForce, undefined, {
      packageDir: dir,
      seed: { "dest.ts": "existing" },
    });

    expect(resultNoForce.error).toBeInstanceOf(AuthoringError);
    expect((resultNoForce.error as AuthoringError).reason).toEqual("path-collision");

    const runForce = (): void => {
      create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 }, force: true });
    };
    const resultForce = await runFactoryForTest(runForce, undefined, {
      packageDir: dir,
      seed: { "dest.ts": "existing" },
    });

    expect(resultForce.error).toBeUndefined();
    expect(resultForce.tree.get("dest.ts")).toEqual("export const x = {= x =};");
  });
});

describe("REQ-FEH-05.2 — copyIn collision without force rejects; with force overwrites (author-surface pin)", () => {
  it("copyIn's public commons signature exhibits the same fail-closed/force-overwrite contract the BRC-05.1 wire-level pin establishes", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");

    const runNoForce = (): void => {
      copyIn("asset.svg", "dest/asset.svg");
    };
    const resultNoForce = await runFactoryForTest(runNoForce, undefined, {
      packageDir: dir,
      seed: { "dest/asset.svg": "existing" },
    });
    expect((resultNoForce.error as AuthoringError).reason).toEqual("path-collision");

    const runForce = (): void => {
      copyIn("asset.svg", "dest/asset.svg", { force: true });
    };
    const resultForce = await runFactoryForTest(runForce, undefined, {
      packageDir: dir,
      seed: { "dest/asset.svg": "existing" },
    });
    expect(resultForce.error).toBeUndefined();
  });
});
