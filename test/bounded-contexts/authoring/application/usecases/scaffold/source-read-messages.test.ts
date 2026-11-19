// The package-local source reads behind copyIn, create({ templateFile }) and scaffold keep
// their whole author-facing message through the public verbs, so moving those reads behind
// the package-files port cannot change what an author sees.
import { describe, it, expect } from "bun:test";
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runFactoryForTest } from "../../../../../../src/testing/index.ts";
import { copyIn, create, scaffold } from "../../../../../../src/commons/index.ts";
import { EMIT_BATCH_BUDGET_BYTES } from "../../../../../../src/shared-kernel/batch-cap.ts";
import { requireNonRoot, scratchDirFactory } from "../../../../../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("source-read-");


async function messageOf(packageDir: string, run: () => void): Promise<string | undefined> {
  const { error } = await runFactoryForTest(run, {}, { packageDir });
  return error === undefined ? undefined : (error as Error).message;
}

describe("copyIn source reads", () => {
  it("a missing source", async () => {
    expect(await messageOf(scratchDir(), () => copyIn("missing.txt", "out/missing.txt"))).toEqual(
      "source file not found: missing.txt does not exist in the package"
    );
  });

  it("a path through a file is a missing source", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "file.txt"), "x");
    expect(await messageOf(dir, () => copyIn("file.txt/child.txt", "out/child.txt"))).toEqual(
      "source file not found: file.txt/child.txt does not exist in the package"
    );
  });

  it("a name too long for the filesystem is a missing source", async () => {
    const name = "a".repeat(300);
    expect(await messageOf(scratchDir(), () => copyIn(name, "out/long.txt"))).toEqual(
      `source file not found: ${name} does not exist in the package`
    );
  });

  it("a directory source", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "folder"));
    expect(await messageOf(dir, () => copyIn("folder", "out/folder"))).toEqual(
      "source file invalid: folder is a directory, not a regular file — use scaffold() to copy a folder"
    );
  });

  it("a source that is neither a file nor a directory", async () => {
    const dir = scratchDir();
    const made = Bun.spawnSync(["mkfifo", join(dir, "pipe")]);
    expect(made.exitCode).toEqual(0);
    expect(await messageOf(dir, () => copyIn("pipe", "out/pipe"))).toEqual("source file invalid: pipe is not a regular file");
  });

  it("a symlink cycle", async () => {
    const dir = scratchDir();
    symlinkSync("loop", join(dir, "loop"));
    expect(await messageOf(dir, () => copyIn("loop", "out/loop"))).toEqual(
      "source file unreadable: loop could not be read (symlink cycle)"
    );
  });

  it("a path with an invalid character never prints the path", async () => {
    expect(await messageOf(scratchDir(), () => copyIn("bad\0name.txt", "out/bad.txt"))).toEqual(
      "source file unreadable: <unprintable source path> could not be read (path contains an invalid character)"
    );
  });

  it("a non-string source or destination", async () => {
    const dir = scratchDir();
    expect(await messageOf(dir, () => copyIn(1 as unknown as string, "out/x.txt"))).toEqual(
      "invalid input: source path must be a string"
    );
    expect(await messageOf(dir, () => copyIn("x.txt", 1 as unknown as string))).toEqual(
      "invalid input: destination path must be a string"
    );
  });
});

describe("create({ templateFile }) source reads", () => {
  it("a file that can be listed but not read", async () => {
    requireNonRoot();
    const dir = scratchDir();
    writeFileSync(join(dir, "locked.ts.template"), "x");
    chmodSync(join(dir, "locked.ts.template"), 0o000);
    expect(
      await messageOf(dir, () => {
        create("out/locked.ts", { templateFile: "locked.ts.template", options: {} });
      })
    ).toEqual("source file unreadable: locked.ts.template could not be read (permission or I/O error)");
  });
});

describe("scaffold source classification", () => {
  it("an oversized .template entry fails loud instead of copying", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "big.txt.template"), "a".repeat(EMIT_BATCH_BUDGET_BYTES + 1));
    expect(await messageOf(dir, () => scaffold({ from: "files", to: "out" }))).toEqual(
      'invalid input: source "files/big.txt.template" is marked .template but is too large to render inline (over the 4 MiB limit) — render requests never silently fall back to a copy'
    );
  });

  it("a binary .template entry fails loud instead of copying", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "blob.bin.template"), Buffer.from([0x00, 0xff, 0x01]));
    expect(await messageOf(dir, () => scaffold({ from: "files", to: "out" }))).toEqual(
      'invalid input: source "files/blob.bin.template" is marked .template but is not valid text (binary content) — render requests never silently fall back to a copy'
    );
  });
});
