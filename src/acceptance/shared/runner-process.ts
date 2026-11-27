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
