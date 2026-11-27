// A-16 / CA-5 — the runner reads the declared dialects of the Frame from `--dialects`. Before the
// factory starts it resolves each declared name from the factory's directory and requires the real
// path inside the package the Lock pins; a factory may then open handles only of declared dialects.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runRunner, type RunnerIo } from "../../../../../src/bounded-contexts/runner-hosting/infrastructure/in/runner.ts";
import { enterBridge } from "../../../../../src/bounded-contexts/runner-hosting/infrastructure/in/bootstrap-bridge.ts";
import { BRIDGE_CONTRACT_VERSION } from "../../../../../src/shared-kernel/wire-protocol.ts";
import { makeInProcessHost } from "../../../../support/in-process-host.ts";

const ROOT = resolve(import.meta.dir, "../../../../..");
// Bun caches the folders `bun test` already scanned, so the run gets a folder no scan has seen.
// It sits inside this package, so the factory resolves this repo's SDK (REQ-SEC-07).
const FIXTURE_DIR = join(ROOT, `test/fixtures/frame-runner/author-dialect-run-${process.pid}`);
const POINTER = `${pathToFileURL(join(FIXTURE_DIR, "factory.js")).href}`;
const LINK = join(FIXTURE_DIR, "node_modules/@company/ini-dialect");
const NAME = "@company/ini-dialect";
const OUTSIDE = `pbuilder-runner: the factory does not start because the dialect "${NAME}" resolves outside the package the Lock pins`;

const scratch = mkdtempSync(join(tmpdir(), "runner-dialects-"));
const pinned = join(scratch, "cache/npm/@company/ini-dialect/1.0.0/package");
const other = join(scratch, "cache/npm/@company/ini-dialect/2.0.0/package");

function writeDialectCopy(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: NAME, version: "1.0.0", type: "module", main: "./index.js" }));
  writeFileSync(
    join(dir, "index.js"),
    `import { defineDialect } from ${JSON.stringify(pathToFileURL(join(ROOT, "src/dialect/index.ts")).href)};
export const ini = defineDialect({ name: ${JSON.stringify(NAME)}, extensions: [".ini"], ast: { parse: (text) => ({ text }), print: (tree) => tree.text }, ops: {} });
`
  );
}

beforeAll(() => {
  writeDialectCopy(pinned);
  writeDialectCopy(other);
  mkdirSync(join(FIXTURE_DIR, "node_modules/@company"), { recursive: true });
  copyFileSync(join(ROOT, "test/fixtures/frame-runner/author-dialect/factory.js"), join(FIXTURE_DIR, "factory.js"));
  symlinkSync(pinned, LINK, "dir");
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

function dialectsFlag(root: string): string {
  return JSON.stringify([{ name: NAME, version: "1.0.0", root: realpathSync(root) }]);
}

function unreachedIo(): RunnerIo & { stderrText(): string } {
  let stderr = "";
  return {
    input: (async function* () {})(),
    writeFrame(): void {
      throw new Error("writeFrame called — an argv gate should have rejected first");
    },
    writeStderr(text: string): void {
      stderr += text;
    },
    stderrText: () => stderr,
  };
}

describe("runner --dialects (A-16, CA-5)", () => {
  let host: ReturnType<typeof makeInProcessHost>;
  afterEach(() => {
    host = undefined as never;
  });

  it("runs a factory that edits through a declared dialect resolving inside its pinned package", async () => {
    host = makeInProcessHost({ seed: { "settings.ini": "colour=red" } });
    host.sendReady();
    const code = await runRunner(["--factory", POINTER, "--input", "{}", "--dialects", dialectsFlag(pinned)], host.io);
    expect(host.stderrText()).toEqual("");
    expect(code).toEqual(0);
    expect(host.fake.committedTree().get("settings.ini")).toEqual("colour=blue");
  });

  it("does not start the factory when a declared dialect resolves outside its pinned package", async () => {
    host = makeInProcessHost({ seed: { "settings.ini": "colour=red" } });
    host.sendReady();
    expect(await runRunner(["--factory", POINTER, "--input", "{}", "--dialects", dialectsFlag(other)], host.io)).toEqual(1);
    expect(host.stderrText()).toEqual(`${OUTSIDE}\n`);
    expect(host.fake.committedTree().get("settings.ini")).toBeUndefined();
  });

  it("does not start the factory when a declared dialect cannot be resolved at all", async () => {
    host = makeInProcessHost({ seed: { "settings.ini": "colour=red" } });
    host.sendReady();
    const flag = JSON.stringify([{ name: "@company/not-installed", version: "1.0.0", root: realpathSync(pinned) }]);
    expect(await runRunner(["--factory", POINTER, "--input", "{}", "--dialects", flag], host.io)).toEqual(1);
    expect(host.stderrText()).toContain('the dialect "@company/not-installed" resolves outside the package the Lock pins');
  });

  it("fails the run without writing when the factory's dialect is not declared", async () => {
    host = makeInProcessHost({ seed: { "settings.ini": "colour=red" } });
    host.sendReady();
    const code = await runRunner(["--factory", POINTER, "--input", "{}"], host.io);
    // A dialect rejection is no AuthoringError, so it exits as every dialect rejection does today.
    expect(code).toEqual(4);
    expect(host.stderrText()).toContain(`the dialect "${NAME}" is not declared in the Manifest`);
    expect(host.fake.committedTree().get("settings.ini")).toBeUndefined();
  });

  it("carries the bridge's dialects through the same pre-run check", async () => {
    host = makeInProcessHost({ seed: { "settings.ini": "colour=red" } });
    host.sendReady();
    const exitCode = await enterBridge(
      BRIDGE_CONTRACT_VERSION,
      { factory: POINTER, input: { kind: "inline", json: "{}" }, dialects: [{ name: NAME, version: "1.0.0", root: realpathSync(other) }] },
      { input: host.io.input, writeStderr: host.io.writeStderr },
      { captureFrameWriter: () => host.io.writeFrame, redirectConsole: () => {} }
    );
    expect(exitCode).toEqual(1);
    expect(host.stderrText()).toEqual(`${OUTSIDE}\n`);
  });

  for (const [label, value] of [
    ["not JSON", "{"],
    ["not an array", "{}"],
    ["an entry without a root", JSON.stringify([{ name: NAME, version: "1.0.0" }])],
    ["an entry whose name is empty", JSON.stringify([{ name: "", version: "1.0.0", root: "/x" }])],
  ] as const) {
    it(`rejects --dialects that is ${label} before the handshake, without echoing it`, async () => {
      const io = unreachedIo();
      expect(await runRunner(["--factory", POINTER, "--input", "{}", "--dialects", value], io)).toEqual(1);
      expect(io.stderrText()).toEqual("pbuilder-runner: --dialects must be a JSON array of {name, version, root} strings\n");
    });
  }
});
