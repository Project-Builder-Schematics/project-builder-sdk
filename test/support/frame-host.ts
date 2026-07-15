// Async spawn + framed-stdio helper (design §4.2 test/support/frame-host.ts): the scripted
// fake host used by the walking-skeleton e2e (and later slices) to talk length-prefix
// frames to a REAL spawned process over REAL stdio. No streaming spawn helper existed before
// this — `test/support/canary.ts`'s `spawnCapture` is one-shot (`spawnSync`), unsuited to a
// live framed conversation.
//
// `frameHostFactory()` mirrors `test/support/scratch-dir.ts`'s `scratchDirFactory()` shape:
// call it ONCE at module scope, use the returned `spawnFrameHost` per test, and every host it
// spawned is killed + bounded-awaited automatically in an `afterEach` — a test never leaks a
// live child process into the next one.

import { afterEach } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { encodeFrame } from "../../src/transport/framing.ts";
import { FrameReader } from "../../src/transport/frame-reader.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";

const KILL_WAIT_TIMEOUT_MS = 2000;

export interface FrameHost {
  /** Writes `value` as one framed message to the process's stdin. */
  send(value: unknown): void;
  /**
   * The greeting barrier: writes the `ready` handshake frame the runner waits for before
   * doing anything else (WPS-02). Defaults to the SDK's own compiled-in wire version, so a
   * caller exercising the mismatch/malformed-greeting paths overrides explicitly.
   */
  sendReady(protocolVersion?: number): void;
  /** Resolves with the next decoded frame from the process's stdout, in arrival order. */
  next(): Promise<unknown>;
  /** Text accumulated on stderr so far (never mixed with stdout — WPS-03's stderr notes land here). */
  stderrText(): string;
  /** SIGKILLs the process immediately (idempotent — a no-op if already exited). */
  kill(): void;
  /** Resolves once the process exits, or after `timeoutMs` (default 5000) with `code: null`. */
  waitExit(timeoutMs?: number): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

interface TrackedHost {
  child: ChildProcessWithoutNullStreams;
}

function buildFrameHost(child: ChildProcessWithoutNullStreams): FrameHost {
  let stderrBuffer = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString("utf-8");
  });

  const reader = new FrameReader(child.stdout);
  const frames = reader.frames();

  return {
    send(value: unknown): void {
      child.stdin.write(encodeFrame(value));
    },
    sendReady(protocolVersion: number = WIRE_PROTOCOL_VERSION): void {
      child.stdin.write(encodeFrame({ method: "ready", protocolVersion }));
    },
    async next(): Promise<unknown> {
      const { value, done } = await frames.next();
      if (done) {
        throw new Error(`frame-host: stdout ended before a frame arrived (stderr: ${stderrBuffer})`);
      }
      return value;
    },
    stderrText(): string {
      return stderrBuffer;
    },
    kill(): void {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    },
    async waitExit(timeoutMs = 5000): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
      if (child.exitCode !== null || child.signalCode !== null) {
        return { code: child.exitCode, signal: child.signalCode };
      }
      const outcome = await Promise.race([
        once(child, "exit").then(([code, signal]) => ({ code: code as number | null, signal: signal as NodeJS.Signals | null })),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      return outcome ?? { code: null, signal: null };
    },
  };
}

/**
 * Registers ONE `afterEach` hook (call once per test file, at module scope — mirrors
 * `scratchDirFactory`) and returns a `spawnFrameHost` function. Every host that function
 * spawns is SIGKILLed and bounded-awaited (2s) after each test, so a hung or forgotten
 * process never survives into the next test.
 */
export function frameHostFactory(): (
  command: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
) => FrameHost {
  let tracked: TrackedHost[] = [];

  afterEach(async () => {
    const toClean = tracked;
    tracked = [];
    await Promise.all(
      toClean.map(async ({ child }) => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
        await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, KILL_WAIT_TIMEOUT_MS))]);
      })
    );
  });

  return (command: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): FrameHost => {
    // `env` omitted (undefined) preserves node:child_process's own default — inherit
    // `process.env` — so every pre-existing caller is byte-behavior-identical (FEH-04 is the
    // first caller to ever pass a restricted env, to prove the runner needs no Go toolchain).
    const child = spawn(command, args, { cwd: opts?.cwd, env: opts?.env, stdio: ["pipe", "pipe", "pipe"] });
    tracked.push({ child });
    return buildFrameHost(child);
  };
}
