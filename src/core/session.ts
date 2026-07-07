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
import { toAuthoringError } from "./authoring-error.ts";

export class Session {
  readonly #client: EngineClient;
  readonly #pending: Directive[] = [];

  constructor(client: EngineClient) {
    this.#client = client;
  }

  buffer(directive: Directive): void {
    this.#pending.push(directive);
  }

  // SEAM-02 (REQ-03): a defensive copy of the pending buffer for the dry-run renderer.
  // Later mutations to #pending must NOT affect a snapshot taken earlier.
  pendingSnapshot(): readonly Directive[] {
    return this.#pending.slice();
  }

  async read(path: string): Promise<string | undefined> {
    await this.flush();
    return this.#client.read(path);
  }

  // SEAM-03 (ADR-01): thin wrappers delegating to #client. Session owns #client, so the
  // commit boundary stays inside Session — defineFactory never names #client directly.
  async commit(): Promise<void> {
    await this.#client.commit();
  }

  async discard(): Promise<void> {
    await this.#client.discard();
  }

  // Called by defineFactory after fn resolves (REQ-KIT-05). Also called by read() before
  // delegating to the client (REQ-KIT-02). SEAM-04 (ADR-02): the #client.emit call site is
  // wrapped so a raw engine rejection surfaces as an AuthoringError in author vocabulary,
  // attributed to the ACTUAL offending directive via the rejection's structured metadata
  // (emit-rejection-metadata REQ-ERM-01) — not instructions[0].
  async flush(): Promise<void> {
    if (this.#pending.length === 0) return;
    const batch: Batch = {
      protocolVersion: 1,
      force: false,
      instructions: this.#pending.splice(0),
    };
    try {
      await this.#client.emit(batch);
    } catch (raw) {
      throw toAuthoringError(raw, batch);
    }
  }
}
