// Thin argv entry for the engine-spawned runner (design § 4.2). Lives under src/ so tsc
// emits it to dist/bin/pbuilder-runner.js as a THIN module whose relative imports resolve
// against the sibling dist/transport/*.js files — never a self-contained bundle, which
// would ship a second copy of the runner.ts composition root (ADR-01's one-chokepoint
// invariant holds at the artifact level, not just in source). Provisional/unmapped
// (ADR-0058): deliberately NO `package.json#bin` entry, in contrast with the mapped
// `pbuilder-codegen` — the engine spawns this file by absolute path.
//
// REQ-RUN-08: the fd-1 frame writer is captured AND console.* is redirected to stderr
// FIRST, before the composition root can import any factory code — the SAME defence-in-
// depth guarantee the bridge path gives (BRB-02/03), belt-and-suspenders alongside the
// engine's own pre-import fd dup (A2). All real work lives in src/transport/runner.ts, the
// ONE validation-gate chokepoint both this entry and the bridge share (FIT-15 bars
// src/ -> bin/ imports, so the shared root cannot live here).

import { runRunner } from "../transport/runner.ts";
import { captureFd1FrameWriter, redirectConsoleToStderr } from "../transport/framing.ts";
import { classifyExitCode } from "../transport/exit-codes.ts";
import { TransportFault } from "../transport/stdio-engine-client.ts";
import { boundMessage } from "../transport/error-text.ts";

if (import.meta.main) {
  const writeFrame = captureFd1FrameWriter();
  redirectConsoleToStderr();
  let exitCode: number;
  try {
    exitCode = await runRunner(process.argv.slice(2), {
      input: process.stdin,
      writeFrame,
      writeStderr: (text) => {
        process.stderr.write(text);
      },
    });
  } catch (err) {
    // Terminal catch (judgment-day F4, EXC-01/WPS-07): nothing escaping runRunner may reach
    // Bun's default handler — that prints a raw stack trace with absolute paths and exits 1.
    // Classified + bounded instead; only a TransportFault's own (safe, runner-authored)
    // message is surfaced, anything else gets fixed text.
    const label = err instanceof TransportFault ? err.message : "run failed before completing";
    process.stderr.write(`${boundMessage(`pbuilder-runner: ${label}`)}\n`);
    exitCode = classifyExitCode(err);
  }
  // Explicit exit, not exitCode + natural drain: the host keeps our stdin pipe open, so the
  // still-live stdin reader would otherwise hold the event loop forever. Safe: every
  // outbound frame was written BEFORE its response was awaited, so nothing is left buffered
  // when runRunner resolves.
  process.exit(exitCode);
}
