// S-001: the coalescing dialect handle factory (ADR-0037, kit-internal). Owns the seam
// ADR-0006 describes: read-through-parse once, hold ONE live AST, mutate it in place across
// a chain, serialize once — lazily, memoized — at whichever flush first drains it.
//
// Kit-internal handle-factory signature is EXECUTOR LATITUDE (design §4.3, Q4, rev 4): this
// module lives under src/core/**, is never a public subpath, and its shape is not
// fitness-pinned. Only the PUBLIC `find(path)` signature and the `Handle<State, Ast, Ops>`
// TYPE (define-dialect.ts) are frozen.

import { currentContext } from "./context.ts";
import type { OpPack, Handle } from "./define-dialect.ts";
import type { Directive } from "./wire.ts";

interface DialectAst<Ast> {
  parse(source: string): Ast;
  print(ast: Ast): string;
}

// Load-bearing literal (design §4.4, slices "Frozen guard strings"): frozen prefix, `.cause`
// always absent — a fresh Error is constructed at the wrap site (stack cleanliness by
// construction), never re-wrapping the caught native/library error as `.cause` or any other
// own property (REQ-DG-05, the named leak vector).
const ERROR_PREFIX = "dialect operation failed: ";

function dialectError(tail: string): Error {
  return new Error(ERROR_PREFIX + tail);
}

// A getter-backed modify directive: `content` resolves lazily, exactly once, memoized — at
// whichever flush first `JSON.stringify`s the batch (ADR-0006's "serialize once at flush").
// `dryRun()` never triggers this: `dryRunPlan` reads only `verb`/`path` (REQ-MC-05).
function lazyModifyDirective(path: string, resolve: () => string): Directive {
  let cached: string | undefined;
  let resolved = false;
  return {
    op: "modify",
    modify: {
      path,
      get content(): string {
        if (!resolved) {
          cached = resolve();
          resolved = true;
        }
        return cached as string;
      },
    },
  };
}

/**
 * Owns the private state (`#tail`, the live AST, the open directive) behind one dialect
 * handle. `createDialectHandle` below wraps this in the public-shaped object literal the
 * `Handle<State, Ast, Ops>` type describes.
 */
class DialectHandleController<Ast, Ops extends OpPack<Ast>> {
  #tail: Promise<void> = Promise.resolve();
  readonly #dialectAst: DialectAst<Ast>;
  readonly #ops: Ops;
  readonly #path: string;
  #live: Ast | undefined;
  #openDirective: Directive | undefined;
  #registered = false;

  constructor(dialectAst: DialectAst<Ast>, ops: Ops, path: string) {
    this.#dialectAst = dialectAst;
    this.#ops = ops;
    this.#path = path;
  }

  get ops(): Ops {
    return this.#ops;
  }

  // Chains `step` onto `#tail` and EAGER-marks the updated `#tail` handled, synchronously,
  // in the same turn — before returning to the caller (ADR-0037, Q3). This closes the
  // pre-drain `unhandledRejection` window for a forgotten-`await` throwing chain; the real
  // rejection stays observable on `#tail` for author-`await` and `settle()`.
  #enqueue(step: () => void | Promise<void>): void {
    this.#tail = this.#tail.then(step);
    this.#tail.catch(() => {
      // Eager shadow-catch — intentionally empty. See module doc + ADR-0037.
    });
    this.#registerOnce();
  }

  #registerOnce(): void {
    if (this.#registered) return;
    this.#registered = true;
    currentContext().dialects.register({ settle: () => this.settle() });
  }

  async #ensureLive(): Promise<void> {
    if (this.#live !== undefined) return;
    const { session } = currentContext();
    const content = await session.read(this.#path);
    if (content === undefined) {
      throw dialectError(`"${this.#path}" does not exist — create it first in this run`);
    }
    try {
      this.#live = this.#dialectAst.parse(content);
    } catch {
      throw dialectError(`could not parse "${this.#path}" as TypeScript`);
    }
  }

  #printContained(): string {
    try {
      return this.#dialectAst.print(this.#live as Ast);
    } catch {
      throw dialectError(`could not print "${this.#path}"`);
    }
  }

  // FIT-19 orphan guard (ADR-0037): re-registers a FRESH directive whenever the prior one
  // is no longer present in the session's pending buffer (an IDENTITY check, never a value
  // check) — this is what turns a global flush mid-chain into the split-into-two-modifies
  // contract (REQ-MC-02), with no edit lost and no double-buffer.
  #ensureOpen(): void {
    const { session } = currentContext();
    if (this.#openDirective !== undefined && session.pendingSnapshot().includes(this.#openDirective)) {
      return;
    }
    this.#openDirective = lazyModifyDirective(this.#path, () => this.#printContained());
    session.buffer(this.#openDirective);
  }

  // Chaining is the WRAPPER's job (createDialectHandle, below) — these return void; the
  // wrapper's dispatchers always return the public handle object, never `this` controller.
  runOp(fn: (ast: Ast, ...args: unknown[]) => void, args: unknown[]): void {
    this.#enqueue(async () => {
      await this.#ensureLive();
      this.#ensureOpen();
      fn(this.#live as Ast, ...args);
    });
  }

  runRaw(fn: (ast: Ast) => void): void {
    this.#enqueue(async () => {
      await this.#ensureLive();
      this.#ensureOpen();
      try {
        fn(this.#live as Ast);
      } catch {
        throw dialectError(`raw() on "${this.#path}" threw`);
      }
    });
  }

  runModify(content: string): void {
    // Design rev 3 Q2 / ADR-0037 clause 1b: a raw content overwrite, sequenced through
    // #tail (author-order preservation) but deliberately NOT routed through the AST
    // coalescing machinery — its overlap with an open AST `modify` is out of tested scope
    // for this change (tracked stage-5b followup).
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      session.buffer(factory.modify({ path: this.#path, content }));
    });
  }

  runRename(newName: string, opts?: { force?: boolean }): void {
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      session.buffer(factory.rename({ path: this.#path, newName, force: opts?.force }));
    });
  }

  runMove(toDir: string, opts?: { force?: boolean }): void {
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      session.buffer(factory.move({ path: this.#path, toDir, force: opts?.force }));
    });
  }

  runCopy(to: string, opts?: { force?: boolean }): void {
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      session.buffer(factory.copy({ from: this.#path, to, force: opts?.force }));
    });
  }

  runRemove(): void {
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      session.buffer(factory.remove({ path: this.#path }));
    });
  }

  // Sequenced on #tail (author order): a mid-chain read must observe every op enqueued
  // before it. Session.read is the GLOBAL flush-before-read (ADR-0015) — this drains this
  // handle's own open directive (and every other handle's), which is exactly what makes
  // read-your-own-writes hold (REQ-MC-02.2) and what the NEXT op's #ensureOpen() detects to
  // re-register a fresh directive (the split).
  read(): Promise<string | undefined> {
    const previousTail = this.#tail;
    const result: Promise<string | undefined> = previousTail.then(async () => {
      const { session } = currentContext();
      return session.read(this.#path);
    });
    this.#tail = result.then(() => undefined);
    this.#tail.catch(() => {
      // Eager shadow-catch — see #enqueue.
    });
    this.#registerOnce();
    return result;
  }

  // Awaited by the run-boundary drain, and delegated to by `then()` for an author `await`.
  // Force-resolves the open directive's getter AFTER `#tail` settles, so a print-throw
  // surfaces here (at drain) rather than silently later.
  settle(): Promise<void> {
    return this.#tail.then(() => {
      if (this.#openDirective?.op === "modify") {
        // Trigger (and thereby memoize) the lazy getter now.
        void this.#openDirective.modify.content;
      }
    });
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.#tail.then(onfulfilled, onrejected);
  }
}

/**
 * Builds the public-shaped `Handle<"found", Ast, Ops>` object backed by a
 * `DialectHandleController`. Op methods are attached dynamically from `ops`' own keys —
 * `Object.keys(ops)` is exactly the set `OpMethods<Ast, Ops>` describes at the type level.
 */
export function createDialectHandle<Ast, Ops extends OpPack<Ast>>(
  dialectAst: { parse(source: string): Ast; print(ast: Ast): string },
  ops: Ops,
  path: string
): Handle<"found", Ast, Ops> {
  const controller = new DialectHandleController<Ast, Ops>(dialectAst, ops, path);

  // Every chaining method returns `handle` (the PUBLIC wrapper below), never the
  // controller directly — the controller's own methods return `this` (the controller
  // instance) for its own internal fluency, but the author-facing chain must keep landing
  // on an object that carries `.raw`/`.push`(op methods)/etc., which the controller itself
  // does not expose. Safe forward reference: these are closures, only evaluated when
  // called — by then `handle` below is already assigned.
  const base = {
    read: () => controller.read(),
    raw: (fn: (ast: Ast) => void) => {
      controller.runRaw(fn);
      return handle;
    },
    modify: (content: string) => {
      controller.runModify(content);
      return handle;
    },
    rename: (newName: string, opts?: { force?: boolean }) => {
      controller.runRename(newName, opts);
      return handle;
    },
    move: (toDir: string, opts?: { force?: boolean }) => {
      controller.runMove(toDir, opts);
      return handle;
    },
    copy: (to: string, opts?: { force?: boolean }) => {
      controller.runCopy(to, opts);
      return handle;
    },
    remove: () => {
      controller.runRemove();
    },
    then: (
      onfulfilled?: ((value: void) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null
    ) => controller.then(onfulfilled, onrejected),
  };

  // The op-derived members — one bound dispatcher per key in `ops` (exactly what
  // `OpMethods<Ast, Ops>` describes at the type level).
  const opMethods = Object.fromEntries(
    Object.keys(ops).map((opName) => [
      opName,
      (...args: unknown[]) => {
        controller.runOp(ops[opName] as (ast: Ast, ...a: unknown[]) => void, args);
        return handle;
      },
    ])
  );

  const handle = Object.assign({}, base, opMethods) as unknown as Handle<"found", Ast, Ops>;
  return handle;
}
