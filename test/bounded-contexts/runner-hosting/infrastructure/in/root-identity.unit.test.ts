// CA-19 — the engine hands the runner of the root Frame the root's role (`--role`) and qualified
// name (`--name`), unread. With the role `evaluation` the factory's findings carry that name as
// their `source` (A-121); without `--role` the factory runs as a generator.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runRunner, type RunnerIo } from "../../../../../src/bounded-contexts/runner-hosting/infrastructure/in/runner.ts";
import { enterBridge } from "../../../../../src/bounded-contexts/runner-hosting/infrastructure/in/bootstrap-bridge.ts";
import { BRIDGE_CONTRACT_VERSION } from "../../../../../src/shared-kernel/wire-protocol.ts";
import { makeInProcessHost } from "../../../../support/in-process-host.ts";

const ROOT = resolve(import.meta.dir, "../../../../..");
// Bun caches the folders `bun test` already scanned, so the run gets a folder no scan has seen.
// It sits inside this package, so the factory resolves this repo's SDK (REQ-SEC-07).
const FIXTURE_DIR = join(ROOT, `test/fixtures/root-identity/run-${process.pid}`);
const POINTER = pathToFileURL(join(FIXTURE_DIR, "factory.js")).href;
const FINDING = { rule: "port-exists", message: "port-exists reported", severity: "error", path: "src/a.ts" };

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, "schema.json"), JSON.stringify({ properties: {} }));
  writeFileSync(join(FIXTURE_DIR, "factory.js"), `export default () => ({ items: [${JSON.stringify(FINDING)}] });\n`);
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

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

describe("runner --role and --name (CA-19)", () => {
  it("sets the source of each finding to the name the runner received, an alias included", async () => {
    const host = makeInProcessHost({ seed: { "src/a.ts": "export const a = 1;" } });
    host.sendReady();
    const argv = ["--factory", POINTER, "--input", "{}", "--role", "evaluation", "--name", "qa:hex-boundaries"];
    const code = await runRunner(argv, host.io);
    expect(host.stderrText()).toEqual("");
    expect(code).toEqual(0);
    const commit = host.requests.find((request) => request.method === "ir.commit");
    expect(commit?.params).toEqual({ result: { items: [{ ...FINDING, source: "qa:hex-boundaries" }] } });
  });

  it("carries the bridge's role and name through the same argv", async () => {
    const host = makeInProcessHost();
    host.sendReady();
    const exitCode = await enterBridge(
      BRIDGE_CONTRACT_VERSION,
      { factory: POINTER, input: { kind: "inline", json: "{}" }, role: "evaluation", name: "qa:hex-boundaries" },
      { input: host.io.input, writeStderr: host.io.writeStderr },
      { captureFrameWriter: () => host.io.writeFrame, redirectConsole: () => {} }
    );
    expect(exitCode).toEqual(0);
    const commit = host.requests.find((request) => request.method === "ir.commit");
    expect(commit?.params).toEqual({ result: { items: [{ ...FINDING, source: "qa:hex-boundaries" }] } });
  });

  it("runs the factory as a generator without --role, so a Result its schema does not declare fails the run", async () => {
    const host = makeInProcessHost();
    host.sendReady();
    const code = await runRunner(["--factory", POINTER, "--input", "{}"], host.io);
    expect(code).toEqual(1);
    expect(host.stderrText()).toContain("invalid Result");
    expect(host.requests.some((request) => request.method === "ir.commit")).toBe(false);
  });

  it("rejects --role evaluation without --name before the handshake", async () => {
    const io = unreachedIo();
    expect(await runRunner(["--factory", POINTER, "--input", "{}", "--role", "evaluation"], io)).toEqual(1);
    expect(io.stderrText()).toEqual("pbuilder-runner: --role evaluation needs --name, the qualified name collection:schematic\n");
  });
});
