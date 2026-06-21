// KIT-02 / ADR-0008: holds ONLY the pending directive buffer + the EngineClient.
// No path-keyed map, no tree. read() flushes pending BEFORE delegating to the client.

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
    await this.#flush();
    return this.#client.read(path);
  }

  async #flush(): Promise<void> {
    if (this.#pending.length === 0) return;
    const batch: Batch = {
      protocolVersion: 1,
      force: false,
      instructions: this.#pending.splice(0),
    };
    await this.#client.emit(batch);
  }
}
