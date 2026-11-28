import { join, resolve } from "node:path";

export const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
/** The runner bin the engine spawns for one Frame. */
export const RUNNER = join(PROJECT_ROOT, "src/bin/pbuilder-runner.ts");

/** One frame as the engine writes it: a 4-byte big-endian length, then the JSON body. */
export function framed(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  const frame = Buffer.alloc(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  return frame;
}

/** The `ready` greeting the runner waits for before it loads the factory. */
export const greeting = (): Buffer => framed({ method: "ready", protocolVersion: 1 });

/** A request frame the runner sends the engine. */
export interface RunnerRequest {
  readonly id: string;
  readonly method: string;
  readonly params: {
    path?: string;
    batch?: { instructions: Array<{ op: string; create?: { pathTemplate: string; template: string } }> };
    result?: unknown;
  };
}

/** Reads every whole frame off the buffer, returning the rest. */
function takeFrames(buffer: Buffer, onFrame: (value: unknown) => void): Buffer {
  let rest = buffer;
  while (rest.length >= 4 && rest.length >= 4 + rest.readUInt32BE(0)) {
    const length = rest.readUInt32BE(0);
    onFrame(JSON.parse(rest.subarray(4, 4 + length).toString("utf-8")));
    rest = rest.subarray(4 + length);
  }
  return rest;
}

/**
 * Spawns the runner bin with `argv` and stands in for the engine on the wire: greets it, then
 * answers each request with `answer` until the runner exits.
 */
export async function serveRunner(
  argv: readonly string[],
  answer: (request: RunnerRequest) => unknown
): Promise<{ exitCode: number; stderr: string; requests: readonly RunnerRequest[] }> {
  const runner = Bun.spawn(["bun", RUNNER, ...argv], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  const requests: RunnerRequest[] = [];
  runner.stdin.write(greeting());
  runner.stdin.flush();
  let pending: Buffer = Buffer.alloc(0);
  for await (const chunk of runner.stdout) {
    pending = takeFrames(Buffer.concat([pending, chunk]), (frame) => {
      const request = frame as RunnerRequest;
      requests.push(request);
      runner.stdin.write(framed({ type: "response", id: request.id, result: answer(request) }));
      runner.stdin.flush();
    });
  }
  const exitCode = await runner.exited;
  runner.stdin.end();
  return { exitCode, stderr: await new Response(runner.stderr).text(), requests };
}
