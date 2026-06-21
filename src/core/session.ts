// KIT-02 / ADR-0008: holds ONLY the pending directive buffer + the EngineClient.
// No path-keyed map, no tree. read() flushes pending BEFORE delegating to the client.
// REQ-KIT-05: flush() is package-internal — called by defineFactory after fn resolves
// so write-only factories (no read call) still emit their batch.
//
// envelope-level `force` is part of the engine wire contract that the fake honors,
// but v1's author surface exposes only op-level `force`; this field is hard-coded false
// here because the author API has no run-wide force concept yet. The fake's Row-3 test
// (FAKE-04) is intentional engine-contract coverage, not dead-code coverage.

import type { EngineClient } from "./engine-client.ts";
import type { Batch, Directive } from "./wire.ts";

export class Session {
  readonly #client: EngineClient;
  readonly #pending: Directive[] = [];

  constructor(client: EngineClient) {
    this.#client = client;
  }

  buffer(directive: Directive): void {
    this.#pending.push(directive);
  }

  async read(path: string): Promise<string> {
    await this.flush();
    return this.#client.read(path);
  }

  // Called by defineFactory in a finally block after fn resolves (REQ-KIT-05).
  // Also called by read() before delegating to the client (REQ-KIT-02).
  async flush(): Promise<void> {
    if (this.#pending.length === 0) return;
    const batch: Batch = {
      protocolVersion: 1,
      force: false,
      instructions: this.#pending.splice(0),
    };
    await this.#client.emit(batch);
  }
}
