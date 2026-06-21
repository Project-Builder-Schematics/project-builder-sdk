// KIT-05: Ambient RunContext via AsyncLocalStorage.
// defineFactory returns a runner that builds the context and runs fn inside the ALS.
// The EngineClient is injected by the caller (test passes the fake) — no module global.

import { AsyncLocalStorage } from "node:async_hooks";
import type { EngineClient } from "./engine-client.ts";
import { DirectiveFactory } from "./directive-factory.ts";
import { Session } from "./session.ts";

export interface RunContext {
  session: Session;
  factory: DirectiveFactory;
}

const als = new AsyncLocalStorage<RunContext>();

export function currentContext(): RunContext {
  const ctx = als.getStore();
  if (ctx === undefined) {
    throw new Error(
      "@pbuilder/sdk: file verbs (create, find, modify, remove, rename, move, copy) " +
      "can only be used while a schematic is running — " +
      "call them inside your factory function, not at module load time."
    );
  }
  return ctx;
}

/**
 * Builds a run-context and runs the factory inside it, flushing buffered
 * directives at run end (REQ-KIT-05) — a write-only factory still emits.
 *
 * Partial-write contract (v1): the flush runs in a `finally`, so if `fn` throws
 * after buffering some directives, those directives are STILL emitted — the
 * engine applies eagerly and there is no rollback at the seam. A factory that
 * throws mid-run may leave a partial set of file mutations applied; the original
 * error propagates. Authors who need all-or-nothing must guard inside `fn`.
 */
export function defineFactory<O>(
  fn: (o: O) => void | Promise<void>
): (o: O, deps: { client: EngineClient }) => Promise<void> {
  return async (o, { client }) => {
    const ctx: RunContext = {
      session: new Session(client),
      factory: new DirectiveFactory(),
    };
    // REQ-KIT-05: flush in finally so write-only factories (no read call) still emit.
    // The flush in Session#read (REQ-KIT-02) remains as an additional trigger.
    try {
      await als.run(ctx, () => fn(o));
    } finally {
      await ctx.session.flush();
    }
  };
}
