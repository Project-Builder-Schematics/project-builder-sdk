// scaffold's folder walk keeps its whole author-facing message and its symlink outcomes
// through the public verb, so moving the walk's reads behind the package-files port cannot
// change what an author sees.
import { describe, it, expect } from "bun:test";
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runFactoryForTest } from "../../../../../../src/testing/index.ts";
import { scaffold } from "../../../../../../src/commons/index.ts";
import { scratchDirFactory } from "../../../../../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("walk-messages-");

function requireNonRoot(): void {
  if (process.getuid?.() === 0) throw new Error("must run as non-root: chmod fixtures are bypassed by root");
}

async function scaffoldIn(packageDir: string, from: string) {
  return runFactoryForTest(() => scaffold({ from, to: "out" }), {}, { packageDir });
}

async function messageOf(packageDir: string, from: string): Promise<string | undefined> {
  const { error } = await scaffoldIn(packageDir, from);
  return error === undefined ? undefined : (error as Error).message;
}

describe("scaffold walk root", () => {
  it("a root that is a regular file", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "file.txt"), "x");
    expect(await messageOf(dir, "file.txt")).toEqual(
      'invalid input: scaffold "from" (file.txt) must be a folder — it resolves to a regular file'
    );
  });

  it("a root path that runs through a file", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "file.txt"), "x");
    expect(await messageOf(dir, "file.txt/sub")).toEqual(
      'invalid input: scaffold "from" (file.txt/sub) must be a folder — it resolves to a regular file'
    );
  });

  it("a root that does not exist", async () => {
    expect(await messageOf(scratchDir(), "nope")).toEqual('invalid input: scaffold "from" folder (nope) does not exist');
  });

  it("a root that cannot be listed", async () => {
    requireNonRoot();
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    chmodSync(join(dir, "files"), 0o000);
    try {
      expect(await messageOf(dir, "files")).toEqual('invalid input: scaffold "from" folder (files) could not be read');
    } finally {
      chmodSync(join(dir, "files"), 0o755);
    }
  });

  it("a symlinked root is rejected, never followed", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "real"));
    writeFileSync(join(dir, "real", "a.txt"), "a");
    symlinkSync(join(dir, "real"), join(dir, "linked"));
    expect(await messageOf(dir, "linked")).toEqual('invalid input: scaffold "from" (linked) must not be a symlinked directory');
  });
});

describe("scaffold walk entries", () => {
  it("a nested folder that cannot be listed", async () => {
    requireNonRoot();
    const dir = scratchDir();
    mkdirSync(join(dir, "files", "sub"), { recursive: true });
    chmodSync(join(dir, "files", "sub"), 0o000);
    try {
      expect(await messageOf(dir, "files")).toEqual("invalid input: scaffold entry (files/sub) could not be read");
    } finally {
      chmodSync(join(dir, "files", "sub"), 0o755);
    }
  });

  it("more than 10,000 enumerated entries", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    for (let i = 0; i <= 10_000; i++) mkdirSync(join(dir, "files", `d${i}`));
    expect(await messageOf(dir, "files")).toEqual("invalid input: scaffold walk exceeded the 10000-entry bound");
  });

  it("skips a nested symlinked folder and copies a symlinked file", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    mkdirSync(join(dir, "elsewhere"));
    writeFileSync(join(dir, "elsewhere", "inner.txt"), "inner");
    writeFileSync(join(dir, "target.txt"), "target");
    writeFileSync(join(dir, "files", "plain.txt"), "plain");
    symlinkSync(join(dir, "elsewhere"), join(dir, "files", "linked-folder"));
    symlinkSync(join(dir, "target.txt"), join(dir, "files", "linked-file.txt"));

    const { error, emitted } = await scaffoldIn(dir, "files");

    expect(error).toBeUndefined();
    const paths = emitted.flatMap((batch) => batch.instructions.map((d) => ("create" in d ? d.create.pathTemplate : JSON.stringify(d))));
    expect(paths.sort()).toEqual(["out/linked-file.txt", "out/plain.txt"]);
  });
});
