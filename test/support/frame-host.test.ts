// frame-host.ts unit test: exercises the async spawn+frame mechanics against a tiny,
// self-contained echo fixture (never the real runner — not built until S-000.7) so this
// module's own send/next/kill/waitExit/afterEach-cleanup behaviour is proven independently.

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frameHostFactory } from "./frame-host.ts";

const FRAMING_PATH = new URL("../../src/transport/framing.ts", import.meta.url).pathname;
const FRAME_READER_PATH = new URL("../../src/transport/frame-reader.ts", import.meta.url).pathname;

// A minimal standalone fixture (not production code): reads each framed message from stdin
// and echoes it straight back framed on stdout. Self-contained via absolute imports of the
// SDK's own framing modules so it never duplicates the codec.
function writeEchoFixture(dir: string): string {
  const scriptPath = join(dir, "echo.ts");
  writeFileSync(
    scriptPath,
    [
      `import { encodeFrame } from "${FRAMING_PATH}";`,
      `import { FrameReader } from "${FRAME_READER_PATH}";`,
      "",
      "const reader = new FrameReader(process.stdin);",
      "for await (const frame of reader.frames()) {",
      "  process.stdout.write(encodeFrame(frame));",
      "}",
    ].join("\n"),
    "utf-8"
  );
  return scriptPath;
}

// A fixture that never reads stdin and never exits on its own — proves kill()/waitExit()
// terminate a genuinely-hung process rather than one that would exit naturally anyway.
function writeHangFixture(dir: string): string {
  const scriptPath = join(dir, "hang.ts");
  writeFileSync(scriptPath, "await new Promise(() => {});\n", "utf-8");
  return scriptPath;
}

const scratchDir = mkdtempSync(join(tmpdir(), "frame-host-test-"));
afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

const spawnFrameHost = frameHostFactory();

describe("frame-host — async spawn + framed-stdio helper", () => {
  it("sends a frame and receives it echoed back, decoded", async () => {
    const scriptPath = writeEchoFixture(scratchDir);
    const host = spawnFrameHost("bun", ["run", scriptPath]);

    host.send({ hello: "world" });
    const echoed = await host.next();

    expect(echoed).toEqual({ hello: "world" });
  });

  it("sendReady() writes a well-formed ready greeting frame the peer can decode", async () => {
    const scriptPath = writeEchoFixture(scratchDir);
    const host = spawnFrameHost("bun", ["run", scriptPath]);

    host.sendReady(1);
    const echoed = await host.next();

    expect(echoed).toEqual({ method: "ready", protocolVersion: 1 });
  });

  it("preserves send/next ordering across multiple frames", async () => {
    const scriptPath = writeEchoFixture(scratchDir);
    const host = spawnFrameHost("bun", ["run", scriptPath]);

    host.send({ n: 1 });
    host.send({ n: 2 });
    host.send({ n: 3 });

    expect(await host.next()).toEqual({ n: 1 });
    expect(await host.next()).toEqual({ n: 2 });
    expect(await host.next()).toEqual({ n: 3 });
  });

  it("kill() terminates a hung process and waitExit() resolves instead of hanging", async () => {
    const scriptPath = writeHangFixture(scratchDir);
    const host = spawnFrameHost("bun", ["run", scriptPath]);

    host.kill();
    const { code, signal } = await host.waitExit(5000);

    expect(code).toBeNull();
    expect(signal).toEqual("SIGKILL");
  });
});
