// KIT-05: Ambient RunContext via AsyncLocalStorage.
// defineFactory returns a runner that builds the context and runs fn inside the ALS.
// The EngineClient is injected by the caller (test passes the fake) — no module global.

import { AsyncLocalStorage } from "node:async_hooks";
import type { EngineClient } from "./engine-client.ts";
import { DirectiveFactory } from "./directive-factory.ts";
import { Session } from "./session.ts";
import { AuthoringError } from "./authoring-error.ts";

export interface RunContext {
  session: Session;
  factory: DirectiveFactory;
}

const als = new AsyncLocalStorage<RunContext>();

// REQ-AEC-02.1 (2.4): a verb called outside any defineFactory run is SDK-side misuse,
// independent of any engine round-trip — an AuthoringError{authoring-rejected,outside-run},
// not a plain Error. The prose lives in authoring-error.ts's outside-run message template
// (the third template, REQ-AEC-06); this is the one call site that reaches it.
export function currentContext(): RunContext {
  const ctx = als.getStore();
  if (ctx === undefined) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "outside-run",
      appliedCount: 0,
    });
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
      // REQ-10: double-fault preservation. A discard() rejection (E2) must never replace
      // or swallow the factory's original error (E1) — attach it as cause and re-throw E1.
      try {
        await ctx.session.discard();
      } catch (discardErr) {
        // Never clobber a pre-existing cause chain on E1, and never let a frozen/sealed
        // E1 throw on assignment replace E1 itself — either way E1 must survive unchanged.
        if (err instanceof Error && err.cause === undefined) {
          try {
            err.cause = discardErr;
          } catch {
            // E1 rejected the assignment (frozen/sealed) — propagate E1 unchanged.
          }
        }
      }
      throw err;
    }
  };
}
