// REQ-BRB-01/02/03: the versioned in-process entry point the engine's embedded bootstrap
// dynamic-imports to hand off control (owner ruling #2157 point 3) — independent of the
// wire's ready.protocolVersion (WPS-02). Delegates to runner.ts's SAME composition root
// (RUN-01..04 gates) rather than re-implementing parameter validation (BRB-01.3).
//
// CRITICAL (engram discovery obs #2205): this module runs IN THE ENGINE'S OWN PROCESS
// (embedded, not spawned) — it MUST NEVER call process.exit; only bin/pbuilder-runner.ts
// (the spawned argv entry) holds that privilege. Failure is communicated exclusively via a
// thrown error or a rejected Promise — the caller (the engine's own bootstrap, out of this
// repo's scope) decides what to do with that outcome, including whether/how to exit its own
// process. test/fixtures/bridge-bootstrap-stub.ts is a TEST-ONLY stand-in playing that role
// for the e2e suite (the real engine bootstrap lives in the engine repo).
//
// Derived mechanism (design.md gives prose only, no literal signature — S-003's own call):
// fd-1 capture + console redirect (BRB-02/03) are INJECTABLE (the `protection` parameter,
// defaulting to framing.ts's real mechanism) rather than raw top-level module code. Both
// mutate GLOBAL process state (the process's stdout stream, console.*); if they ran merely
// by IMPORTING
// this module, an integration test importing it inside bun test's SHARED process would
// corrupt every other test's console/stdout output. The default still satisfies "before any
// factory-related code runs": it fires at the very start of enterBridge, strictly before
// the ONLY path to a factory import (runRunner's dynamic import()). e2e tests exercise the
// REAL default in an isolated spawned child; integration tests inject a no-op stand-in
// (mirrors single-instance-probe.ts's injectable resolver).

import { runRunner, type RunnerIo } from "./runner.ts";
import { captureFd1FrameWriter, redirectConsoleToStderr } from "./framing.ts";
import { BRIDGE_CONTRACT_VERSION } from "./wire-protocol.ts";

export class BridgeVersionMismatchError extends Error {
  constructor(expected: number, actual: number) {
    super(
      `bootstrap-bridge: contract version mismatch — bootstrap expects ${expected}, installed SDK bridge is ${actual}`
    );
    this.name = "BridgeVersionMismatchError";
  }
}

export type BridgeInput = { kind: "inline"; json: string } | { kind: "file"; path: string };

export interface BridgeParams {
  factory: string;
  input: BridgeInput;
}

export interface BridgeIo {
  input: RunnerIo["input"];
  writeStderr: RunnerIo["writeStderr"];
}

export interface BridgeProtection {
  captureFrameWriter(): RunnerIo["writeFrame"];
  redirectConsole(): void;
}

const realProtection: BridgeProtection = {
  captureFrameWriter: captureFd1FrameWriter,
  redirectConsole: redirectConsoleToStderr,
};

// REQ-BRB-01.3: converts the bridge's typed params into the SAME argv shape RUN-01's parser
// consumes — the gates below (runRunner -> parseArgv/validateFactoryUrl/...) are literally
// the argv-spawn code path, never re-implemented for the bridge.
function toArgv(params: BridgeParams): string[] {
  const argv = ["--factory", params.factory];
  if (params.input.kind === "inline") argv.push("--input", params.input.json);
  else argv.push("--input-file", params.input.path);
  return argv;
}

/**
 * REQ-BRB-01: the engine's embedded bootstrap calls this ONCE, having already dynamic-
 * imported this module, passing the bridge contract version IT expects and the
 * argv-equivalent params (factory pointer, input/input-file). Rejects immediately — no
 * protection armed, no factory-related code reached — on a version mismatch, naming both
 * versions. On a match, arms the SAME fd-1/console protection RUN-08 gives the direct-spawn
 * path (BRB-02/03), then hands the params to runner.ts's composition root through the SAME
 * RUN-01..04 gates argv uses (BRB-01.3) — never a duplicated, weaker check.
 */
export async function enterBridge(
  expectedVersion: number,
  params: BridgeParams,
  io: BridgeIo,
  protection: BridgeProtection = realProtection
): Promise<number> {
  if (expectedVersion !== BRIDGE_CONTRACT_VERSION) {
    throw new BridgeVersionMismatchError(expectedVersion, BRIDGE_CONTRACT_VERSION);
  }
  protection.redirectConsole();
  const writeFrame = protection.captureFrameWriter();
  return runRunner(toArgv(params), { input: io.input, writeFrame, writeStderr: io.writeStderr });
}
