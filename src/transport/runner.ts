// The runner composition root (design § 4.2, ADR-01): lives in src/transport/ — NOT bin/ —
// so BOTH entry paths (argv spawn via bin/pbuilder-runner.ts, in-process bridge in S-003)
// share this ONE validation-gate chokepoint (FIT-15 bars src/->bin/ imports).
//
// ADR-07: this file is the sanctioned production `defineFactory` caller — fit-29's
// allow-list names exactly this FILE. `context.ts`'s @internal note names "the future
// production runner" as the legitimate wrapper of that seam; this is that runner. The
// import is direct from ../core/context.ts (the sanctioned-caller idiom), never the barrel.
//
// Scope boundary (S-000, walking skeleton): argv parsing, pointer resolution, and failure
// exits are MINIMAL here — the full RUN-01..04/06/07 gates (factory-pointer.ts,
// exit-codes.ts, error-text.ts, single-instance-probe.ts) land in S-001/S-002 and slot in
// at this chokepoint. All failures exit 1 for now; the 0-4 taxonomy is EXC-01 (S-002).

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineFactory } from "../core/context.ts";
import { FrameReader } from "./frame-reader.ts";
import { WIRE_PROTOCOL_VERSION, isStructurallyValidGreeting, versionMatches } from "./wire-protocol.ts";
import { StdioEngineClient, type FrameChannel } from "./stdio-engine-client.ts";

export interface RunnerIo {
  /** Raw inbound byte stream (stdin on the spawned path; injectable for in-process tests). */
  input: AsyncIterable<Uint8Array>;
  /** Writes one outbound frame VALUE; encoding is the caller's captured-fd-1 writer (framing.ts). */
  writeFrame: (value: unknown) => void;
  /** Bounded operator-visible notes (stderr on the spawned path). Never the wire. */
  writeStderr: (text: string) => void;
}

// WPS-07's full error-text algorithm is S-001 scope; until then every stderr note is at
// least bounded to the documented 2000-char ceiling.
const STDERR_CEILING = 2000;

function note(io: RunnerIo, text: string): void {
  io.writeStderr(`${text.slice(0, STDERR_CEILING)}\n`);
}

interface ParsedArgv {
  factory: string;
  inputJson: string;
}

function parseArgvMinimal(argv: string[]): ParsedArgv | { error: string } {
  let factory: string | undefined;
  let inputJson: string | undefined;
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined) return { error: `pbuilder-runner: missing value for flag` };
    if (flag === "--factory") factory = value;
    else if (flag === "--input") inputJson = value;
    else return { error: `pbuilder-runner: unrecognized flag` };
  }
  if (factory === undefined) return { error: "pbuilder-runner: --factory is required" };
  return { factory, inputJson: inputJson ?? "{}" };
}

/**
 * Runs one factory over the framed wire: await versioned `ready` (WPS-02, fail-at-greeting),
 * resolve + `defineFactory`-wrap the factory export with `packageDir = dirname(factory)`
 * (RUN-05), then serve the run's reverse callbacks through `StdioEngineClient`. Returns the
 * process exit code.
 */
export async function runRunner(argv: string[], io: RunnerIo): Promise<number> {
  const parsed = parseArgvMinimal(argv);
  if ("error" in parsed) {
    note(io, parsed.error);
    return 1;
  }

  const reader = new FrameReader(io.input);
  const frames = reader.frames();

  // WPS-02: fail at greeting, BEFORE any reverse callback can dispatch — the client is not
  // even constructed until the greeting is accepted.
  const first = await frames.next();
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

  let input: unknown;
  try {
    input = JSON.parse(parsed.inputJson);
  } catch {
    note(io, "pbuilder-runner: --input is not valid JSON");
    return 1;
  }

  const [moduleUrl, fragment] = parsed.factory.split("#", 2) as [string, string | undefined];
  let moduleNamespace: Record<string, unknown>;
  try {
    moduleNamespace = (await import(moduleUrl)) as Record<string, unknown>;
  } catch {
    note(io, "pbuilder-runner: factory module could not be imported");
    return 1;
  }
  const resolved = fragment === undefined ? moduleNamespace.default : moduleNamespace[fragment];
  if (typeof resolved !== "function") {
    note(io, "pbuilder-runner: resolved factory export is not a function");
    return 1;
  }

  // RUN-05: wrap through the SAME defineFactory seam runFactoryForTest uses, anchored to
  // the factory's own directory — schema-derived validation and reserved-name checks apply
  // identically on both vehicles.
  const packageDir = dirname(fileURLToPath(new URL(moduleUrl)));
  const run = defineFactory(resolved as (o: unknown) => void | Promise<void>, { packageDir });

  const channel: FrameChannel = {
    write: io.writeFrame,
    async read(): Promise<unknown> {
      const next = await frames.next();
      if (next.done) throw new Error("wire closed while a response was pending");
      return next.value;
    },
  };
  const client = new StdioEngineClient(channel);

  try {
    await run(input, { client });
    return 0;
  } catch (err) {
    note(io, `pbuilder-runner: run failed — ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}
