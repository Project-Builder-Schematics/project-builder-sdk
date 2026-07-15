// The runner composition root (design § 4.2, ADR-01): lives in src/transport/ — NOT bin/ —
// so BOTH entry paths (argv spawn via bin/pbuilder-runner.ts, in-process bridge in S-003)
// share this ONE validation-gate chokepoint (FIT-15 bars src/->bin/ imports).
//
// ADR-07: this file is the sanctioned production `defineFactory` caller — fit-29's
// allow-list names exactly this FILE. `context.ts`'s @internal note names "the future
// production runner" as the legitimate wrapper of that seam; this is that runner. The
// import is direct from ../core/context.ts (the sanctioned-caller idiom), never the barrel.
//
// S-002 closes the gate scope: RUN-01 (argv XOR), RUN-02 (factory URL scheme+host, via
// factory-pointer.ts), RUN-03/RUN-06 (export resolution + double-wrap, factory-pointer.ts),
// RUN-04 (input-file size-cap + fail-closed parse), RUN-07 (import-failure classification),
// SEC-07 (single-instance probe, before import), and EXC-01/02 (exit-code taxonomy via
// exit-codes.ts). RUN-05/RUN-08/SEC-02 are S-000/S-003 territory, unchanged here.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, statSync } from "node:fs";
import { defineFactory } from "../core/context.ts";
import { AuthoringError } from "../core/authoring-error.ts";
import { locateFirstJsonSyntaxError } from "../core/schema/schema-locate.ts";
import { formatLocator } from "../core/schema/schema-parse.ts";
import { FrameReader, FrameFault } from "./frame-reader.ts";
import { WIRE_PROTOCOL_VERSION, isStructurallyValidGreeting, versionMatches } from "./wire-protocol.ts";
import {
  StdioEngineClient,
  TransportFault,
  IntentRejectedError,
  OverlappingRunError,
  type FrameChannel,
} from "./stdio-engine-client.ts";
import { boundMessage, composeWithToken, toProjectRelativePath } from "./error-text.ts";
import { parseFactoryPointer, validateFactoryUrl, resolveFactoryExport } from "./factory-pointer.ts";
import { probeSingleInstance } from "./single-instance-probe.ts";
import { classifyExitCode } from "./exit-codes.ts";

export interface RunnerIo {
  /** Raw inbound byte stream (stdin on the spawned path; injectable for in-process tests). */
  input: AsyncIterable<Uint8Array>;
  /** Writes one outbound frame VALUE; encoding is the caller's captured-fd-1 writer (framing.ts). */
  writeFrame: (value: unknown) => void;
  /** Bounded operator-visible notes (stderr on the spawned path). Never the wire. */
  writeStderr: (text: string) => void;
}

// REQ-RUN-04: the SDK-chosen input-file size cap — same provenance posture as SEC-05's
// timeout bound and WPS-06's BATCH_CAP_BYTES (pending engine-side confirmation).
export const INPUT_FILE_SIZE_CAP_BYTES = 10 * 1024 * 1024; // 10 MiB

function note(io: RunnerIo, text: string): void {
  io.writeStderr(`${boundMessage(text)}\n`);
}

type ParsedInput = { kind: "inline"; json: string } | { kind: "file"; path: string };

interface ParsedArgv {
  factory: string;
  input: ParsedInput;
}

// REQ-RUN-01: `--factory <url>#<export>` required; exactly one of `--input <json>` XOR
// `--input-file <path>`; any unrecognized flag fails closed.
function parseArgv(argv: string[]): ParsedArgv | { error: string } {
  let factory: string | undefined;
  let inputJson: string | undefined;
  let inputFile: string | undefined;

  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === undefined || value === undefined) {
      return { error: `pbuilder-runner: missing value for flag "${flag ?? ""}"` };
    }
    if (flag === "--factory") factory = value;
    else if (flag === "--input") inputJson = value;
    else if (flag === "--input-file") inputFile = value;
    else return { error: composeWithToken("pbuilder-runner: unrecognized flag ", flag) };
  }

  if (factory === undefined) return { error: "pbuilder-runner: --factory is required" };
  if (inputJson !== undefined && inputFile !== undefined) {
    return { error: "pbuilder-runner: --input and --input-file are mutually exclusive — pass exactly one" };
  }
  if (inputJson === undefined && inputFile === undefined) {
    return { error: "pbuilder-runner: exactly one of --input or --input-file is required" };
  }
  return {
    factory,
    input: inputJson !== undefined ? { kind: "inline", json: inputJson } : { kind: "file", path: inputFile as string },
  };
}

type ResolvedInput = { ok: true; value: unknown } | { ok: false; message: string };

// REQ-RUN-04: size-cap check BEFORE reading contents; fail-closed on any JSON parse error,
// reporting ONLY the parse failure's line/column (never raw file content — mirrors
// `formatParseError`, bin/pbuilder-codegen.ts:126).
function resolveInput(input: ParsedInput): ResolvedInput {
  if (input.kind === "inline") {
    try {
      return { ok: true, value: JSON.parse(input.json) };
    } catch {
      return { ok: false, message: "pbuilder-runner: --input is not valid JSON" };
    }
  }

  // REQ-WPS-07 (judgment-day F9): fixed text + a project-relative path — NEVER the raw OS
  // error message, which embeds the absolute path (`ENOENT: ..., stat '/abs/path'`).
  const unreadable = (): ResolvedInput => ({
    ok: false,
    message: `pbuilder-runner: --input-file could not be read — ${toProjectRelativePath(input.path)} is not a readable file`,
  });

  let size: number;
  try {
    size = statSync(input.path).size;
  } catch {
    return unreadable();
  }
  if (size > INPUT_FILE_SIZE_CAP_BYTES) {
    return { ok: false, message: `pbuilder-runner: --input-file exceeds the ${INPUT_FILE_SIZE_CAP_BYTES}-byte cap` };
  }

  // Same fail-closed shape for the read itself (judgment-day F4): a stat that succeeded does
  // not guarantee a readable file (permissions, TOCTOU) — a throw here must never escape as
  // an uncaught rejection.
  let raw: string;
  try {
    raw = readFileSync(input.path, "utf-8");
  } catch {
    return unreadable();
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    const locator = locateFirstJsonSyntaxError(raw);
    return {
      ok: false,
      message: `pbuilder-runner: --input-file is not valid JSON ${formatLocator(locator?.line, locator?.column)}`,
    };
  }
}

// REQ-RUN-07: classifies a factory-module `import()` failure into RUN-07's form 1 — the
// module "cannot be found or loaded" (exits 1) — vs. an author top-level throw (exits 4).
// Form 1 covers BOTH resolution failures (`ERR_MODULE_NOT_FOUND`, Bun's `ResolveMessage`)
// AND load-time parse/build failures (judgment-day F13): a syntactically invalid module
// never RAN, so "its top-level code threw" would be factually false. Verified empirically
// in this Bun version: a syntax-error import rejects with an `AggregateError` whose
// `errors` are `BuildMessage`s (or a single bare `BuildMessage`); neither `BuildMessage`
// nor `ResolveMessage` is an `Error` instance, so the checks read `name`/`code` directly
// off any object shape (never `instanceof`-gated). `SyntaxError` covers Node's shape for
// the same failure. An author-thrown AggregateError of plain Errors matches none of these
// and still classifies as a top-level throw (exit 4).
function isModuleLoadFailure(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: unknown; name?: unknown; errors?: unknown };
  if (candidate.code === "ERR_MODULE_NOT_FOUND") return true;
  if (candidate.name === "ResolveMessage" || candidate.name === "BuildMessage") return true;
  if (err instanceof SyntaxError) return true;
  if (Array.isArray(candidate.errors)) {
    return candidate.errors.some((inner) => isModuleLoadFailure(inner));
  }
  return false;
}

// REQ-SEC-02: the composition root's own reentrancy guard. A single spawned process (the
// direct-argv path) only ever calls runRunner once by construction; the bridge is the
// realistic reentrant caller (a single long-lived engine process CAN dynamic-import and
// invoke the bridge more than once). module-level, not per-instance: "each process runs
// exactly one factory" (WPS-09) — the guard's scope is the PROCESS, matching that.
let runInFlight = false;

/**
 * Runs one factory over the framed wire: parses/validates argv and input (RUN-01/04),
 * awaits versioned `ready` (WPS-02, fail-at-greeting), probes the single-instance SDK
 * pin (SEC-07), validates + resolves the factory pointer (RUN-02/03/06/07), then
 * `defineFactory`-wraps it with `packageDir = dirname(factory)` (RUN-05) and serves the
 * run's reverse callbacks through `StdioEngineClient`. Returns the process exit code
 * (EXC-01 taxonomy).
 *
 * REQ-SEC-02: a second invocation while one is already in flight in this process REJECTS
 * immediately (never resolves to an exit code — overlap is NOT part of the EXC-01 taxonomy,
 * it never reaches the wire) with a stable `OverlappingRunError` identity, touching NEITHER
 * `io.writeFrame` NOR `io.writeStderr` — there is nothing to send over the wire for an
 * attempt that never left the process, and the first in-flight run's own io/state is
 * entirely untouched by the rejected attempt.
 */
export async function runRunner(argv: string[], io: RunnerIo): Promise<number> {
  if (runInFlight) {
    throw new OverlappingRunError(
      "pbuilder-runner: a run is already in flight in this process — overlapping run rejected"
    );
  }
  runInFlight = true;
  try {
    return await runRunnerBody(argv, io);
  } finally {
    runInFlight = false;
  }
}

async function runRunnerBody(argv: string[], io: RunnerIo): Promise<number> {
  const parsed = parseArgv(argv);
  if ("error" in parsed) {
    note(io, parsed.error);
    return 1;
  }

  const resolvedInput = resolveInput(parsed.input);
  if (!resolvedInput.ok) {
    note(io, resolvedInput.message);
    return 1;
  }

  const { url: moduleUrl, exportName } = parseFactoryPointer(parsed.factory);
  const urlValidation = validateFactoryUrl(moduleUrl);
  if (!urlValidation.ok) {
    note(io, `pbuilder-runner: ${urlValidation.message}`);
    return 1;
  }

  const reader = new FrameReader(io.input);
  const frames = reader.frames();

  // WPS-02: fail at greeting, BEFORE any reverse callback can dispatch — the client is not
  // even constructed until the greeting is accepted. A TRANSPORT fault at greeting time
  // (judgment-day F4) — an oversize/0x80000000 length prefix (thrown, WPS-04.2/.4), EOF
  // mid-frame (thrown), or a malformed greeting body (yielded as a FrameFault) — classifies
  // exit 3 with a bounded note (EXC-01, WPS-07), never an uncaught rejection's raw stack.
  // A clean EOF or a structurally-wrong-but-valid frame stays exit 1 (WPS-02.3).
  let first: IteratorResult<unknown>;
  try {
    first = await frames.next();
  } catch (err) {
    note(
      io,
      `pbuilder-runner: ${err instanceof TransportFault ? err.message : "transport fault while awaiting the greeting"}`
    );
    return classifyExitCode(err);
  }
  if (!first.done && first.value instanceof FrameFault) {
    note(io, `pbuilder-runner: ${first.value.fault.message}`);
    return classifyExitCode(first.value.fault);
  }
  if (first.done || !isStructurallyValidGreeting(first.value)) {
    note(io, `pbuilder-runner: invalid greeting — expected {method:"ready", protocolVersion:<integer>}`);
    return 1;
  }
  if (!versionMatches(first.value)) {
    note(
      io,
      `pbuilder-runner: wire protocol version mismatch — host sent ${first.value.protocolVersion}, ` +
        `runner expects ${WIRE_PROTOCOL_VERSION}`
    );
    return 1;
  }

  // REQ-SEC-07: handshake-time, resolution-only, BEFORE the factory import proceeds.
  const probe = probeSingleInstance(moduleUrl);
  if (!probe.ok) {
    note(io, `pbuilder-runner: ${probe.message}`);
    return 1;
  }

  let moduleNamespace: Record<string, unknown>;
  try {
    moduleNamespace = (await import(moduleUrl)) as Record<string, unknown>;
  } catch (err) {
    if (isModuleLoadFailure(err)) {
      note(io, "pbuilder-runner: factory module could not be resolved or loaded");
      return 1;
    }
    note(io, "pbuilder-runner: factory module's top-level code threw during import");
    return 4;
  }

  const exportResolution = resolveFactoryExport(moduleNamespace, exportName);
  if (!exportResolution.ok) {
    switch (exportResolution.kind) {
      case "missing-default-export":
        note(io, "pbuilder-runner: factory module has no default export");
        return 1;
      case "missing-named-export":
        note(io, composeWithToken("pbuilder-runner: factory module has no export named ", exportResolution.exportName));
        return 1;
      case "not-callable":
        note(
          io,
          composeWithToken(
            "pbuilder-runner: resolved factory export is not a function — malformed factory export: ",
            exportResolution.exportName ?? "default"
          )
        );
        return 1;
      case "double-wrapped":
        note(
          io,
          "pbuilder-runner: resolved factory export is already wrapped by defineFactory — export the BARE " +
            "factory function instead, the runner wraps it internally"
        );
        return 1;
    }
  }

  // RUN-05: wrap through the SAME defineFactory seam runFactoryForTest uses, anchored to
  // the factory's own directory — schema-derived validation and reserved-name checks apply
  // identically on both vehicles.
  const packageDir = dirname(fileURLToPath(new URL(moduleUrl)));
  const run = defineFactory(exportResolution.fn, { packageDir });

  const channel: FrameChannel = {
    write: io.writeFrame,
    writeStderr: io.writeStderr,
    async read(): Promise<unknown> {
      const next = await frames.next();
      // REQ-SEC-08.3: a clean EOF (frames() completes with nothing buffered) while a
      // reverse callback is pending is itself a fault — the reader only ever gets asked
      // to read again when a callback IS pending (StdioEngineClient's routing loop).
      if (next.done) throw new TransportFault("eof", "wire closed while a response was pending");
      // REQ-SEC-08.1: a malformed frame body rejects THIS read (the sole pending call,
      // attributed structurally) — the reader itself stays alive for subsequent calls.
      if (next.value instanceof FrameFault) throw next.value.fault;
      return next.value;
    },
  };
  const client = new StdioEngineClient(channel);

  try {
    await run(resolvedInput.value, { client });
    return 0;
  } catch (err) {
    // EXC-01/02: classification reads ONLY err's own identity — a double-fault `.cause`
    // (context.ts's discard-after-throw path) never overrides E1's class. IntentRejectedError
    // (judgment-day F3): the host's refusal message surfaces — bounded by note() — instead
    // of being swallowed into a generic "run failed".
    const label =
      err instanceof AuthoringError || err instanceof TransportFault || err instanceof IntentRejectedError
        ? err.message
        : "run failed";
    note(io, `pbuilder-runner: ${label}`);
    return classifyExitCode(err);
  }
}
