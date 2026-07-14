// S-001: the coalescing dialect handle factory (ADR-0037, kit-internal). Owns the seam
// ADR-0006 describes: read-through-parse once, hold ONE live AST, mutate it in place across
// a chain, serialize once — lazily, memoized — at whichever flush first drains it.
//
// Kit-internal handle-factory signature is EXECUTOR LATITUDE (design §4.3, Q4, rev 4): this
// module lives under src/core/**, is never a public subpath, and its shape is not
// fitness-pinned. Only the PUBLIC `find(path)` signature and the `Handle<State, Ast, Ops>`
// TYPE (define-dialect.ts) are frozen.

import { currentContext } from "./context.ts";
import { dialectError, isContained } from "./dialect-error.ts";
import type { DirectiveFactory } from "./directive-factory.ts";
import type { OpPack, Handle } from "./define-dialect.ts";
import type { Session } from "./session.ts";
import type { Directive } from "./wire.ts";

interface DialectAst<Ast> {
  parse(source: string): Ast;
  print(ast: Ast): string;
}

// `.modify()`'s `fn` is typed `(ast: Ast) => void`, but TS's void-return compatibility lets an
// author pass an async function anyway — this is the runtime check that catches that case.
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

// Final-verify fix (F-1, position-independent path channel): keyed by the live AST
// instance itself, so an op can recover its handle's author-facing path WITHOUT any
// positional coupling to the op's own (variable-arity, author-optional) argument list. A
// WeakMap entry lives exactly as long as the AST instance it's keyed on (set once in
// #ensureLive, alongside `#live` itself) — no separate cleanup needed.
const astHandlePaths = new WeakMap<object, string>();

/**
 * Recovers the author-facing handle path for a live AST instance previously registered by
 * `#ensureLive` — the ONLY channel through which an op function can reach the path for its
 * own `dialectError()`-branded message (design §4.4's "on {path}" clause; unreachable any
 * other way, since `Op<Ast>` and `DialectAst.parse()` carry no path parameter). Throws if
 * called with an AST instance never registered by a handle — a contributor bug, not an
 * author-reachable state.
 */
export function handlePathFor(ast: object): string {
  const path = astHandlePaths.get(ast);
  if (path === undefined) {
    throw new Error("dialect-handle: handlePathFor() called with an unregistered AST instance");
  }
  return path;
}

// A getter-backed modify directive: `content` resolves lazily, exactly once, memoized — at
// whichever flush first `JSON.stringify`s the batch (ADR-0006's "serialize once at flush").
// `dryRun()` never triggers this: `dryRunPlan` reads only `verb`/`path` (REQ-MC-05).
//
// Row-145: `resolve` is nulled out immediately after its one use (rather than a separate
// `resolved` boolean) — the memoized getter's closure retained the ts-morph `Project` (via
// this print callback's own closure over the live AST) for the directive's entire lifetime
// even after resolving; nulling the reference makes the `Project`/live AST GC-eligible as
// soon as the content is known. Memory-only, no observable behavioral change (see
// test/core/dialect-handle.test.ts's row-145 note — deliberately untested there).
function lazyModifyDirective(path: string, resolveFn: () => string): Directive {
  let cached: string | undefined;
  let resolve: (() => string) | undefined = resolveFn;
  return {
    op: "modify",
    modify: {
      path,
      get content(): string {
        if (resolve !== undefined) {
          cached = resolve();
          resolve = undefined;
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
  // Mutation-gate baseline (ADR-0037 clause 2), seeded from #ensureLive's own read — the
  // ORIGINAL file content, before any op runs. #ensureOpen compares a fresh print against
  // this to decide whether an op actually changed anything (REQ-TSD-08.4's zero-directive
  // no-op) — never re-derived from a print-after-parse (would cost a redundant print).
  #lastEmittedText: string | undefined;

  constructor(dialectAst: DialectAst<Ast>, ops: Ops, path: string) {
    this.#dialectAst = dialectAst;
    this.#ops = ops;
    this.#path = path;
  }

  get ops(): Ops {
    return this.#ops;
  }

  // The ONE containment primitive (ADR-0037, Q3): chains `step` onto `#tail` and
  // EAGER-marks the updated `#tail` handled, synchronously, in the same turn — before
  // returning to the caller. This closes the pre-drain `unhandledRejection` window for a
  // forgotten-`await` throwing chain; the real rejection stays observable on `#tail` for
  // author-`await` and `settle()`, and on the returned step-result promise for callers
  // (like `read()`) that surface the step's value.
  //
  // F2 poison flag (ADR-0037 amendment, REQ-DG-07.3): every step and every read() route
  // through this ONE wrapper. SAME-handle fail-closed sequencing is emergent — a rejected
  // `#tail` already skips `guardedStep` via ordinary promise-chain semantics, no flag
  // needed. The flag exists for the CROSS-handle case: a different handle's `#tail` is
  // independent, so without this check its step WOULD run (mutate/buffer) even though
  // nothing ever commits. `ctx.runFailure` is consulted at step entry (never attempted as a
  // fresh operation) and set FIRST-WINS on catch (the earliest rejection in the run is the
  // one every later op/read surfaces, unchanged).
  #chain<T>(step: () => T | Promise<T>): Promise<T> {
    const guardedStep = async (): Promise<T> => {
      const ctx = currentContext();
      if (ctx.runFailure !== undefined) {
        throw ctx.runFailure.reason;
      }
      try {
        return await step();
      } catch (err) {
        if (ctx.runFailure === undefined) {
          ctx.runFailure = { reason: err };
        }
        throw ctx.runFailure.reason;
      }
    };
    const result = this.#tail.then(guardedStep);
    this.#tail = result.then(() => undefined);
    this.#tail.catch(() => {
      // Eager shadow-catch — intentionally empty. See module doc + ADR-0037.
    });
    this.#registerOnce();
    return result;
  }

  #enqueue(step: () => void | Promise<void>): void {
    void this.#chain(step);
  }

  #bufferDirective(build: (factory: DirectiveFactory) => Directive): void {
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      session.buffer(build(factory));
    });
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
    astHandlePaths.set(this.#live as object, this.#path);
    this.#lastEmittedText = content;
  }

  #printContained(): string {
    try {
      return this.#dialectAst.print(this.#live as Ast);
    } catch {
      throw dialectError(`could not print "${this.#path}"`);
    }
  }

  // Shared predicate (row-141/row-136): is this handle's own AST-op directive still
  // buffered, undrained? #ensureOpen consults it to skip re-registration while the prior
  // directive is still pending; runModify consults the SAME check to reject a conflicting
  // .modify() (ADR-0039). `session` is passed in rather than re-derived via currentContext()
  // — both call sites already have it in scope from their own context lookup.
  #hasOpenPendingDirective(session: Session): boolean {
    return this.#openDirective !== undefined && session.isPending(this.#openDirective);
  }

  // FIT-19 orphan guard (ADR-0037): re-registers a FRESH directive whenever the prior one
  // is no longer present in the session's pending buffer (an IDENTITY check, never a value
  // check) — this is what turns a global flush mid-chain into the split-into-two-modifies
  // contract (REQ-MC-02), with no edit lost and no double-buffer.
  //
  // Mutation gate (ADR-0037 clause 2, row-141): registration only happens if the op
  // actually changed the print vs #lastEmittedText — a true no-op (e.g. removeImport on an
  // absent binding) never registers, so its run emits ZERO directives (REQ-TSD-08.4). Must
  // be called AFTER the op has run (never before) so the print reflects its effect.
  //
  // Judgment-day round 2 (convergence fix, generalizes round 1's Issue 1): a directive can
  // drain WITHOUT this handle's own read() ever running — a DIFFERENT handle's read() is
  // ALSO a global flush-before-read (ADR-0015) and drains this handle's open directive too.
  // So the "was it drained?" re-baseline can't live only in read() (round 1's fix) — it has
  // to run HERE, right before the gate, for BOTH drain sources. When #hasOpenPendingDirective
  // is false but #openDirective is still set, the prior directive was drained (by either
  // path) since it was last registered: re-baseline #lastEmittedText to its content — the
  // getter memoized the print the instant flush's JSON.stringify walked it (module doc,
  // "serialize once ... at whichever flush first" — the value is already fixed, no fresh
  // print needed nor possible after the op already mutated the live AST past it) — and clear
  // #openDirective so the zero-directive gate below re-evaluates against the fresh baseline
  // instead of unconditionally re-registering a byte-identical directive.
  #ensureOpen(): void {
    const { session } = currentContext();
    if (this.#hasOpenPendingDirective(session)) {
      return;
    }
    if (this.#openDirective !== undefined) {
      if (this.#openDirective.op === "modify") {
        this.#lastEmittedText = this.#openDirective.modify.content;
      }
      this.#openDirective = undefined;
    }
    if (this.#printContained() === this.#lastEmittedText) {
      return;
    }
    this.#openDirective = lazyModifyDirective(this.#path, () => this.#printContained());
    session.buffer(this.#openDirective);
  }

  // Shared containment primitive (ADR-0037 amendment clause 1): runs `fn`, awaits a
  // thenable result INSIDE the try (so an async op's rejection is contained, never an
  // unhandled rejection), and on catch discriminates by the WeakSet brand (`isContained`,
  // NEVER `message.startsWith`) — a caught error already carrying the brand (an author's
  // deliberate `dialectError` reject) is RETHROWN VERBATIM (REQ-DG-06.5, no double-wrap, no
  // `.cause`); any foreign error is wrapped fresh via `dialectError(foreignTail)`.
  async #invokeContained(fn: () => unknown, foreignTail: string): Promise<void> {
    try {
      const result: unknown = fn();
      if (isThenable(result)) {
        await result;
      }
    } catch (caught) {
      if (isContained(caught)) throw caught;
      throw dialectError(foreignTail);
    }
  }

  // Chaining is the WRAPPER's job (createDialectHandle, below) — these return void; the
  // wrapper's dispatchers always return the public handle object, never `this` controller.
  // `opName` names the tail for BOTH the foreign-wrap message (constraint: `{op}() on
  // "{path}" threw`) and #ensureOpen runs AFTER the op (never before) — the mutation gate
  // needs the op's effect already applied to compare against the baseline.
  //
  // Final-verify fix (F-1): the author-facing path is NEVER threaded as a runtime arg to
  // `fn` — a trailing positional arg collided with the `options` slot whenever an
  // add-op's OWN optional trailing param was omitted (the common call form), silently
  // rendering "on \"undefined\"" in the collision message. The path channel is now
  // POSITION-INDEPENDENT: `astHandlePaths` (module scope above), keyed by the live AST
  // instance itself, set once in #ensureLive. An op needing the path for its own
  // dialectError()-branded message calls the exported `handlePathFor(ast)` — no arity
  // coupling to the author's own (variable, optional) argument list, so this is immune to
  // however many params the author did or didn't supply.
  runOp(fn: (ast: Ast, ...args: unknown[]) => void, args: unknown[], opName: string): void {
    this.#enqueue(async () => {
      await this.#ensureLive();
      await this.#invokeContained(
        () => fn(this.#live as Ast, ...args),
        `${opName}() on "${this.#path}" threw`
      );
      this.#ensureOpen();
    });
  }

  // Council fix pass (security note 1, ADR-0037): an ASYNC `fn` is awaited INSIDE the SAME
  // shared containment `runOp` uses (`#invokeContained`) — the enqueued step already runs
  // in the async `#tail` chain, so awaiting is natural. Without this, `fn`'s returned
  // promise floats unobserved: a rejection surfaces as an uncontained `unhandledRejection`
  // (leaking the raw internal message) while the run COMMITS as if successful, and a
  // resolve-after-delay's mutation may race the print.
  runModify(fn: (ast: Ast) => void): void {
    this.#enqueue(async () => {
      await this.#ensureLive();
      await this.#invokeContained(() => fn(this.#live as Ast), `modify() on "${this.#path}" threw`);
      this.#ensureOpen();
    });
  }

  // ADR-0039 (row-136, amended by ADR-0050): rejects when this handle's own open AST-op
  // directive is STILL PENDING (undrained) — the IDENTICAL predicate #ensureOpen already
  // tests. This guard follows the SEMANTICS (wholesale replace clobbering a pending
  // structured edit), not the verb spelling — it lives here, never on `.modify(fn)`
  // (REQ-MC-08.5: `.modify(fn)` coalesces freely, no guard). Checked INSIDE the enqueued
  // step (not at call time): #openDirective is only set once addImport's own async step has
  // actually run, which #tail sequencing guarantees has happened by the time THIS step
  // executes. `.read()` remains the documented escape (it drains the pending directive
  // first, so a `.replaceContent()` chained after a `.read()` is unaffected).
  runReplaceContent(content: string): void {
    this.#enqueue(() => {
      const { session, factory } = currentContext();
      if (this.#hasOpenPendingDirective(session)) {
        throw dialectError(
          `cannot .replaceContent() "${this.#path}" while a structured edit is pending — the pending edit would be lost; call .read() to commit it first, then .replaceContent()`
        );
      }
      session.buffer(factory.modify({ path: this.#path, content }));
    });
  }

  runRename(newName: string, opts?: { force?: boolean }): void {
    this.#bufferDirective((factory) => factory.rename({ path: this.#path, newName, force: opts?.force }));
  }

  runMove(toDir: string, opts?: { force?: boolean }): void {
    this.#bufferDirective((factory) => factory.move({ path: this.#path, toDir, force: opts?.force }));
  }

  runCopy(to: string, opts?: { force?: boolean }): void {
    this.#bufferDirective((factory) => factory.copy({ from: this.#path, to, force: opts?.force }));
  }

  runRemove(): void {
    this.#bufferDirective((factory) => factory.remove({ path: this.#path }));
  }

  // Sequenced on #tail (author order): a mid-chain read must observe every op enqueued
  // before it. Session.read is the GLOBAL flush-before-read (ADR-0015) — this drains this
  // handle's own open directive (and every other handle's), which is exactly what makes
  // read-your-own-writes hold (REQ-MC-02.2). The drain itself needs no re-baseline here:
  // #ensureOpen (judgment-day round 2) detects a drained-but-still-set #openDirective on
  // the NEXT op, from EITHER drain source (this handle's own read(), like this one, or a
  // different handle's), and re-baselines from the drained directive's memoized content —
  // one mechanism instead of two subtly different ones.
  read(): Promise<string | undefined> {
    return this.#chain(async () => {
      const { session } = currentContext();
      return session.read(this.#path);
    });
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
  dialectAst: DialectAst<Ast>,
  ops: Ops,
  path: string
): Handle<"found", Ast, Ops> {
  const controller = new DialectHandleController<Ast, Ops>(dialectAst, ops, path);

  // Every chaining method returns `handle` (the PUBLIC wrapper below), never the
  // controller directly — the author-facing chain must keep landing on an object that
  // carries `.modify`/`.push`(op methods)/etc., which the controller itself does not expose.
  // Safe forward reference: these are closures, only evaluated when called — by then
  // `handle` below is already assigned.
  const base = {
    read: () => controller.read(),
    modify: (fn: (ast: Ast) => void) => {
      controller.runModify(fn);
      return handle;
    },
    replaceContent: (content: string) => {
      controller.runReplaceContent(content);
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
        controller.runOp(ops[opName] as (ast: Ast, ...a: unknown[]) => void, args, opName);
        return handle;
      },
    ])
  );

  const handle = Object.assign({}, base, opMethods) as unknown as Handle<"found", Ast, Ops>;
  return handle;
}
