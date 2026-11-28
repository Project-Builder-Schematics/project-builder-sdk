// KIT-02 / ADR-0008: holds the pending directive buffer, the EngineClient, and one content
// version per path as typed (A-7). No tree. read() flushes pending BEFORE delegating to the client.
// REQ-KIT-05: flush() is package-internal — called by defineFactory after fn resolves
// so write-only factories (no read call) still emit their batch.
//
// envelope-level `force` is part of the engine wire contract that the fake honors,
// but v1's author surface exposes only op-level `force`; this field is hard-coded false
// here because the author API has no run-wide force concept yet. The fake's Row-3 test
// (FAKE-04) is intentional engine-contract coverage, not dead-code coverage.

import type { EngineClient } from "../../ports/engine-client.ts";
import type { Batch, Directive } from "../../valueobjects/wire.ts";
import { toAuthoringError } from "../../valueobjects/authoring-error.ts";

const dirOf = (path: string): string => path.slice(0, path.lastIndexOf("/") + 1);
const baseOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

// A loop, not a /\/+$/ regex: toDir comes from the author, and that regex backtracks polynomially.
function withoutTrailingSlashes(dir: string): string {
  let end = dir.length;
  while (end > 0 && dir[end - 1] === "/") end--;
  return dir.slice(0, end);
}

/** The paths whose content a directive replaces or removes, spelled as the commons verbs spell them; a copy's source is untouched. */
function touchedPaths(directive: Directive): readonly string[] {
  switch (directive.op) {
    case "create":
      return [directive.create.pathTemplate];
    case "modify":
      return [directive.modify.path];
    case "delete":
      return [directive.delete.path];
    case "rename":
      return [directive.rename.path, dirOf(directive.rename.path) + directive.rename.newName];
    case "move":
      return [directive.move.path, `${withoutTrailingSlashes(directive.move.toDir)}/${baseOf(directive.move.path)}`];
    case "copy":
      return [directive.copy.to];
    case "copyIn":
      return [directive.copyIn.to];
  }
}

export class Session {
  readonly #client: EngineClient;
  readonly #pending: Directive[] = [];
  readonly #versions = new Map<string, number>();
  // The batches being emitted, so a read or a later flush never overtakes them.
  #emitting: Promise<void> = Promise.resolve();
  #inFlight = 0;

  constructor(client: EngineClient) {
    this.#client = client;
  }

  buffer(directive: Directive): void {
    this.#pending.push(directive);
    for (const path of touchedPaths(directive)) this.#versions.set(path, this.versionOf(path) + 1);
  }

  // A-7: how many buffered directives have changed this path's content, keyed by the path as typed.
  versionOf(path: string): number {
    return this.#versions.get(path) ?? 0;
  }

  // SEAM-02 (REQ-03): a defensive copy of the pending buffer for the pending Directives renderer.
  // Later mutations to #pending must NOT affect a snapshot taken earlier.
  pendingDirectives(): readonly Directive[] {
    return this.#pending.slice();
  }

  // Row-141 kept-half: an identity membership check against the LIVE buffer (no defensive
  // copy) for call sites that only need a yes/no answer per directive, e.g. the dialect
  // handle's orphan-guard (#ensureOpen) and row-136's modify-reject predicate.
  isPending(directive: Directive): boolean {
    return this.#pending.includes(directive);
  }

  async read(path: string): Promise<string | undefined> {
    await this.flush();
    return this.#client.read(path);
  }

  // A-131: like read(), a listing flushes first, so it sees every write buffered before it.
  async list(pattern: string, ignore?: readonly string[]): Promise<readonly string[]> {
    await this.flush();
    return this.#client.list(pattern, ignore);
  }

  // SEAM-03 (ADR-01): thin wrappers delegating to #client. Session owns #client, so the
  // commit boundary stays inside Session — defineFactory never names #client directly.
  async commit(result?: unknown): Promise<void> {
    await this.#client.commit(result);
  }

  async discard(): Promise<void> {
    await this.#client.discard();
  }

  // Called by defineFactory after fn resolves (REQ-KIT-05). Also called by read() before
  // delegating to the client (REQ-KIT-02). SEAM-04 (ADR-02): the #client.emit call site is
  // wrapped so a raw engine rejection surfaces as an AuthoringError in author vocabulary,
  // attributed to the ACTUAL offending directive via the rejection's structured metadata
  // (emit-rejection-metadata REQ-ERM-01) — not instructions[0].
  //
  // stdio-engine-client REQ-SEC-08.3/REQ-EXC-01: a TRANSPORT-class fault from the client is
  // NOT an engine rejection — it must reach the runner's classifier as-is (exit 3), never
  // degraded to AuthoringError{unknown} (exit 2). Detected by the error's stable `name`
  // identity, not `instanceof`: importing the TransportFault class here would pull the whole
  // transport client into core's (and the ./commons bundle's) module graph, inverting the
  // port direction. ERM-03's degrade still applies to everything else non-EmitRejection.
  // The batch is taken synchronously, so a read started right after this call already waits for
  // it. With no batch in flight the client's emit starts synchronously, as callers that fire a
  // flush without awaiting it (scaffold's batch cap) rely on; otherwise it waits its turn.
  flush(): Promise<void> {
    if (this.#pending.length === 0) return this.#emitting;
    const batch: Batch = {
      protocolVersion: 1,
      force: false,
      instructions: this.#pending.splice(0),
    };
    const emit = this.#inFlight === 0 ? this.#emit(batch) : this.#emitting.then(() => this.#emit(batch));
    this.#inFlight++;
    const done = (): void => {
      this.#inFlight--;
    };
    this.#emitting = emit.then(done, done);
    return emit;
  }

  async #emit(batch: Batch): Promise<void> {
    try {
      await this.#client.emit(batch);
    } catch (raw) {
      if (raw instanceof Error && raw.name === "TransportFault") throw raw;
      throw toAuthoringError(raw, batch);
    }
  }
}
