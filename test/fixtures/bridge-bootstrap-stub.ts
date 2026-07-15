// TEST-ONLY stand-in for the ENGINE's own embedded bootstrap (out of this repo's scope) —
// exists solely so the e2e suite can exercise bootstrap-bridge.ts's REAL (non-injected)
// fd-1/console protection over REAL spawned stdio. Mirrors bin/pbuilder-runner.ts's role for
// the argv-spawn path: the ONE place in this test fixture allowed to call process.exit,
// since IT — not bootstrap-bridge.ts itself — owns this process (engram discovery obs
// #2205: the bridge module must never call process.exit).

import { enterBridge, BridgeVersionMismatchError, type BridgeParams } from "../../src/transport/bootstrap-bridge.ts";

function parseStubArgv(argv: string[]): { bridgeVersion: number; params: BridgeParams } {
  let bridgeVersion: number | undefined;
  let factory: string | undefined;
  let inputJson: string | undefined;
  let inputFile: string | undefined;

  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--bridge-version") bridgeVersion = Number(value);
    else if (flag === "--factory") factory = value;
    else if (flag === "--input") inputJson = value;
    else if (flag === "--input-file") inputFile = value;
  }

  if (bridgeVersion === undefined || Number.isNaN(bridgeVersion) || factory === undefined) {
    throw new Error("bridge-bootstrap-stub: --bridge-version and --factory are required");
  }
  const input: BridgeParams["input"] =
    inputFile !== undefined ? { kind: "file", path: inputFile } : { kind: "inline", json: inputJson ?? "{}" };
  return { bridgeVersion, params: { factory, input } };
}

if (import.meta.main) {
  const { bridgeVersion, params } = parseStubArgv(process.argv.slice(2));
  try {
    const exitCode = await enterBridge(bridgeVersion, params, {
      input: process.stdin,
      writeStderr: (text) => {
        process.stderr.write(text);
      },
    });
    process.exit(exitCode);
  } catch (err) {
    if (err instanceof BridgeVersionMismatchError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(
      `bridge-bootstrap-stub: unexpected error — ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(4);
  }
}
