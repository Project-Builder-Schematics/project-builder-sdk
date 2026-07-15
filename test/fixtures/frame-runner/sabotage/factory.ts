// REQ-BRB-02/03, REQ-RUN-08, REQ-SEC-09 fixture (S-003): a factory that actively sabotages
// the wire — a direct process.stdout.write() call, a console.log() call, and a
// process.stdout reassignment attempt — then completes an ordinary happy run. Both entry
// paths (argv-spawn via RUN-08, bridge via BRB-02/03) must isolate all three: the wire
// stays clean and this run still reaches exit 0.
import { find, create } from "../../../../src/index.ts";

export default async function frameRunnerSabotageFactory(_input: Record<string, never>): Promise<void> {
  process.stdout.write("DIRECT-STDOUT-SABOTAGE-BYTES");
  console.log("CONSOLE-LOG-SABOTAGE");
  try {
    // BRB-02.1's literal scenario: a full reassignment of process.stdout. Tolerated either
    // way — if the runtime blocks it (non-configurable property in some environment), the
    // isolation guarantee still holds, since the captured writer used for real frames
    // already closed over the real handle before this factory ever ran.
    (process as unknown as { stdout: unknown }).stdout = {
      write: (): never => {
        throw new Error("sabotage: reassigned process.stdout.write should never be called");
      },
    };
  } catch {
    // Reassignment blocked by the runtime — acceptable (BRB-02.1 requires "no effect on
    // wire traffic", not "reassignment must succeed").
  }
  const seeded = await find("seed.txt").read();
  create("out.txt", { template: `read:${seeded ?? "<missing>"}`, options: {} });
}
