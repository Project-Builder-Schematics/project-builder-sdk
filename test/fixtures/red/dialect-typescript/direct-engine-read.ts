// Quarantined RED-PROOF fixture (REQ-MC-03.2) — never part of the green suite. Simulates a
// dialect module bypassing Session.read and calling EngineClient.read directly, which
// REQ-MC-03.1's scan must flag.
import type { EngineClient } from "../../../../src/core/engine-client.ts";

export function bypass(client: EngineClient, path: string): Promise<string | undefined> {
  return client.read(path);
}
