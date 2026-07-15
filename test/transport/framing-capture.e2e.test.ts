// REQ-RUN-08/REQ-BRB-02 (judgment-day F10): captureFd1FrameWriter must be IDEMPOTENT — the
// real fd-1 write handle is cached at module scope on the FIRST capture, so a second capture
// (a second sequential enterBridge run in one engine process) still returns a writer that
// reaches the real fd 1, never the first capture's own stderr-redirecting stub. Proven over
// a REAL spawned process: the capture mutates global process state and can never run inside
// bun test's shared process (same isolation rationale as bootstrap-bridge's injectable
// protection).

import { describe, it, expect } from "bun:test";
import { frameHostFactory } from "../support/frame-host.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SCRIPT = new URL("../fixtures/capture-twice-script.ts", import.meta.url).pathname;

const spawnFrameHost = frameHostFactory();

describe("captureFd1FrameWriter — idempotent across sequential captures (judgment-day F10)", () => {
  it("two sequential capture+write cycles BOTH emit real frames on stdout", async () => {
    const host = spawnFrameHost("bun", ["run", SCRIPT], { cwd: PROJECT_ROOT });

    const first = (await host.next()) as { marker: string };
    const second = (await host.next()) as { marker: string };
    const { code } = await host.waitExit();

    expect(first).toEqual({ marker: "first-capture" });
    expect(second).toEqual({ marker: "second-capture" });
    expect(code).toEqual(0);
    // The second frame must NOT have been silently redirected to stderr.
    expect(host.stderrText()).not.toContain("second-capture");
  });
});
