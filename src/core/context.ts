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
 * All-or-nothing contract (ADR-01): on success the full directive batch is committed;
 * if `fn` throws (or the run-end flush rejects), the staged set is discarded and the
 * engine commits NOTHING. The original (or attributed) error propagates to the caller —
 * a thrown factory never leaves a partial set of mutations committed.
 */
export function defineFactory<O>(
  fn: (o: O) => void | Promise<void>
): (o: O, deps: { client: EngineClient }) => Promise<void> {
  return async (o, { client }) => {
    const ctx: RunContext = {
      session: new Session(client),
      factory: new DirectiveFactory(),
    };
    // ADR-01: no `finally` — success (commit) and failure (discard) are distinct paths.
    // The final flush is INSIDE the try, so a flush-time emit rejection (already an
    // AuthoringError via Session.flush) skips commit() and routes to discard + re-throw.
    try {
      await als.run(ctx, () => fn(o));
      await ctx.session.flush();
      await ctx.session.commit();
    } catch (err) {
      await ctx.session.discard();
      throw err;
    }
  };
}
