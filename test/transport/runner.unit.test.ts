// REQ-RUN-01 (argv XOR), REQ-RUN-04 (input-file size-cap-only + line/col parse),
// REQ-RUN-07 (import-failure classification split 1-vs-4): the runner's pre-run gates,
// driven through the public `runRunner` entry with a minimal injectable io — no subprocess
// (spawn-dependent legs are S-002.6's e2e matrix).

import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, truncateSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeFrame } from "../../src/transport/framing.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";
import { runRunner, type RunnerIo } from "../../src/transport/runner.ts";
import { OverlappingRunError } from "../../src/transport/stdio-engine-client.ts";
import { makeInProcessHost } from "../support/in-process-host.ts";

const HAPPY_FIXTURE_DIR = new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname;
const HAPPY_POINTER = `file://${HAPPY_FIXTURE_DIR}factory.ts`;
const IMPORT_CRASH_POINTER = `file://${new URL("../fixtures/frame-runner/import-crash/", import.meta.url).pathname}factory.ts`;

// Stub io whose `writeFrame` always throws `guard`: every gate under test must reject
// before the runner ever writes a frame.
function stubIo(input: AsyncIterable<Uint8Array>, guard: string): RunnerIo & { stderrText(): string } {
  let stderr = "";
  return {
    input,
    writeFrame(): void {
      throw new Error(guard);
    },
    writeStderr(text: string): void {
      stderr += text;
    },
    stderrText: () => stderr,
  };
}

// Never-consulted io: the argv/input-file gates under test all reject BEFORE the greeting
// is ever awaited, so `input` yields nothing and `writeFrame` must never be called.
function unreachedIo(): RunnerIo & { stderrText(): string } {
  return stubIo(
    (async function* () {})(),
    "unreachedIo: writeFrame called — a pre-greeting gate should have rejected first"
  );
}

// A greeting-accepting io whose stdin ends immediately after — used for RUN-07's
// import-failure legs, which run AFTER the handshake (SEC-07's probe sits between the
// greeting and the import, so these fixtures self-reference this repo's own SDK copy —
// matching SEC-07.1, never triggering a split).
function greetedIo(): RunnerIo & { stderrText(): string } {
  return stubIo(
    (async function* () {
      yield encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION });
    })(),
    "greetedIo: writeFrame called — an import-failure gate should have rejected first"
  );
}

describe("REQ-RUN-01 — argv contract", () => {
  it("Scenario REQ-RUN-01.1: both --input and --input-file rejected — exit 1 before any factory import", async () => {
    const io = unreachedIo();
    const exitCode = await runRunner(
      ["--factory", HAPPY_POINTER, "--input", "{}", "--input-file", "/tmp/x.json"],
      io
    );
    expect(exitCode).toEqual(1);
    expect(io.stderrText()).toContain("--input");
    expect(io.stderrText()).toContain("--input-file");
  });

  it("Scenario REQ-RUN-01.2: an unknown flag fails closed, naming the flag, never silently continuing", async () => {
    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--unsafe-mode", "1"], io);
    expect(exitCode).toEqual(1);
    expect(io.stderrText()).toContain("--unsafe-mode");
  });

  it("Scenario REQ-RUN-01.3: neither --input nor --input-file supplied — exit 1 naming exactly one is required", async () => {
    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", HAPPY_POINTER], io);
    expect(exitCode).toEqual(1);
    expect(io.stderrText()).toContain("--input");
  });

  it("--factory omitted entirely — exit 1", async () => {
    const io = unreachedIo();
    const exitCode = await runRunner(["--input", "{}"], io);
    expect(exitCode).toEqual(1);
    expect(io.stderrText()).toContain("--factory");
  });
});

describe("REQ-RUN-04 — input-file size cap + fail-closed parse", () => {
  let dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs = [];
  });

  function scratchFile(name: string): string {
    const dir = mkdtempSync(join(tmpdir(), "run-04-"));
    dirs.push(dir);
    return join(dir, name);
  }

  it("Scenario REQ-RUN-04.1: an input-file over the 10 MiB cap is rejected before its contents are read", async () => {
    const path = scratchFile("oversized.json");
    // Sparse file: logical size over the cap, written instantly (no 10MB of real I/O). If
    // the cap check were skipped and the (zero-byte) content were parsed, the failure would
    // be a JSON parse error naming a line/column — DISTINCT wording from the cap message,
    // so the assertion below discriminates "rejected by size" from "rejected by parse".
    writeFileSync(path, "");
    truncateSync(path, 10 * 1024 * 1024 + 1);

    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input-file", path], io);

    expect(exitCode).toEqual(1);
    expect(io.stderrText()).not.toContain("line");
    expect(io.stderrText()).not.toContain("column");
  });

  it("an input-file exactly AT the 10 MiB cap is NOT rejected by the size gate (boundary)", async () => {
    const path = scratchFile("exact-cap.json");
    // Real content this time — valid JSON padded to EXACTLY the cap's byte length, so a
    // genuine JSON.parse succeeds if the size gate correctly admits it.
    const template = (pad: string): string => `{"a":"${pad}"}`;
    const overheadBytes = Buffer.byteLength(template(""), "utf-8");
    const capBytes = 10 * 1024 * 1024;
    const payload = template("x".repeat(capBytes - overheadBytes));
    expect(Buffer.byteLength(payload, "utf-8")).toEqual(capBytes);
    writeFileSync(path, payload);

    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input-file", path], io);

    // Not rejected by the SIZE gate: it proceeds far enough to await the greeting, which
    // unreachedIo's empty input starves — runRunner treats that as an invalid/absent
    // greeting (exit 1), but for a DIFFERENT reason than the size cap (proven by the
    // absence of any input-file wording in stderr).
    expect(exitCode).toEqual(1);
    expect(io.stderrText()).not.toContain("input-file");
    expect(io.stderrText()).not.toContain("cap");
  });

  it("Scenario REQ-RUN-04.2: malformed JSON in an under-cap input-file fails closed, reporting ONLY line/column — never the raw content", async () => {
    const path = scratchFile("malformed.json");
    const marker = "THIS-EXACT-TEXT-MUST-NEVER-BE-ECHOED";
    writeFileSync(path, `{"a": ${marker}, }`);

    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input-file", path], io);

    expect(exitCode).toEqual(1);
    expect(io.stderrText()).not.toContain(marker);
    expect(io.stderrText()).toMatch(/line \d+, column \d+|position unknown/);
  });
});

describe("REQ-RUN-02 — factory URL scheme + host allowlist (runtime no-import proof)", () => {
  // Carried forward from S-002's verify-in-loop-3 WARNING (test-depth gap, not a functional
  // defect): validateFactoryUrl's pure-function classification was already unit-tested, but
  // the scenario's own literal claim — "no author code from that URL executes" — lacked a
  // runtime proof. Mirrors the unreachedIo() + throw-on-import fixture pattern RUN-07/SEC-07
  // already use: IMPORT_CRASH_POINTER's factory throws unconditionally at module top level,
  // so if the runner ever actually reached `import()` for it, the run would crash (exit 4,
  // proven by REQ-RUN-07.2 above) instead of the pre-import gate's exit 1.
  const importCrashUrl = new URL("../fixtures/frame-runner/import-crash/", import.meta.url).pathname;

  it("Scenario REQ-RUN-02.2: a non-file scheme pointing at a throw-on-import fixture never imports it", async () => {
    const nonFilePointer = `https://evil.example${importCrashUrl}factory.ts`;
    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", nonFilePointer, "--input", "{}"], io);

    // Not 4 (the import-crash fixture's own exit code, REQ-RUN-07.2) — proving the fixture's
    // unconditional top-level throw never ran.
    expect(exitCode).toEqual(1);
    expect(io.stderrText()).not.toContain("threw");
  });

  it("Scenario REQ-RUN-02.3: a non-empty-host file: pointer at a throw-on-import fixture never imports it", async () => {
    const nonEmptyHostPointer = `file://host${importCrashUrl}factory.ts`;
    const io = unreachedIo();
    const exitCode = await runRunner(["--factory", nonEmptyHostPointer, "--input", "{}"], io);

    expect(exitCode).toEqual(1);
    expect(io.stderrText()).not.toContain("threw");
  });
});

describe("REQ-RUN-07 — factory module import failure classification", () => {
  it("Scenario REQ-RUN-07.1: module-not-found exits 1, bounded/project-relative stderr, no raw resolution stack", async () => {
    const missingPointer = `file://${HAPPY_FIXTURE_DIR}does-not-exist.ts`;
    const io = greetedIo();
    const exitCode = await runRunner(["--factory", missingPointer, "--input", "{}"], io);

    expect(exitCode).toEqual(1);
    expect(io.stderrText()).not.toContain(HAPPY_FIXTURE_DIR.replace(/\/$/, ""));
    expect(io.stderrText().length).toBeLessThanOrEqual(2000);
  });

  it("Scenario REQ-RUN-07.2: an author top-level throw during import exits 4, bounded/no-echo stderr", async () => {
    const io = greetedIo();
    const exitCode = await runRunner(["--factory", IMPORT_CRASH_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(4);
    expect(io.stderrText()).not.toContain("at ");
    expect(io.stderrText().length).toBeLessThanOrEqual(2000);
  });
});

describe("REQ-SEC-02 — single in-flight run, sequential fail-loud on overlap", () => {
  it("Scenario REQ-SEC-02.1: a second run-entry invocation while the first is in flight rejects OverlappingRunError immediately, touching neither writeFrame nor writeStderr; the first run is unaffected and completes", async () => {
    const first = makeInProcessHost({ seed: { "seed.txt": "sec-02" } });
    // Deliberately do NOT call first.sendReady() yet — the first run is now genuinely "in
    // flight": runRunner is suspended awaiting its greeting.
    const firstPromise = runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], first.io);

    let secondIoTouched = false;
    const secondIo: RunnerIo = {
      input: (async function* () {})(),
      writeFrame: () => {
        secondIoTouched = true;
      },
      writeStderr: () => {
        secondIoTouched = true;
      },
    };

    let caught: unknown;
    try {
      await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], secondIo);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(OverlappingRunError);
    expect(secondIoTouched).toBe(false);

    // The FIRST in-flight run continues and completes unaffected (SC-8).
    first.sendReady();
    const exitCode = await firstPromise;
    expect(exitCode).toEqual(0);
    expect(first.fake.committedTree().get("out.txt")).toEqual("read:sec-02");
  });

  it("a third invocation, attempted AFTER the first has already completed, is NOT rejected — the guard clears once the in-flight run finishes", async () => {
    const first = makeInProcessHost({ seed: { "seed.txt": "sec-02-clears" } });
    first.sendReady();
    const firstExitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], first.io);
    expect(firstExitCode).toEqual(0);

    const second = makeInProcessHost({ seed: { "seed.txt": "sec-02-clears-again" } });
    second.sendReady();
    const secondExitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], second.io);
    expect(secondExitCode).toEqual(0);
    expect(second.fake.committedTree().get("out.txt")).toEqual("read:sec-02-clears-again");
  });
});
