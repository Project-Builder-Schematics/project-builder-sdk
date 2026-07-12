// S-004 — planted violation for REQ-DC-05 (coalescing slot, REQ-DC-03). [permanent-fixture]
//
// A hand-rolled `find()` that does NOT coalesce at all: every op call independently buffers
// its OWN `modify` directive instead of reusing/accumulating a shared open one. A 2-op chain
// therefore emits TWO `modify` directives where the contract demands exactly ONE — proves
// REQ-DC-03's "coalescing-to-one" assertion is live, not a no-op.
//
// Deliberately bypasses `defineDialect`/`createDialectHandle` (the real, correctly-coalescing
// machinery) — this fixture needs a Dialect-shaped object whose `find()` is WRONG on purpose,
// which the real factory cannot produce. Test-only code: importing `currentContext` here is
// fine (FIT-08/FIT-10 scope `src/**` only, never `test/**`).
import { currentContext } from "../../../src/core/context.ts";
import type { Dialect, OpPack } from "../../../src/core/define-dialect.ts";
import type { OpPackFixture } from "../../../src/conformance/index.ts";

type AppendHandle = { readonly append: (line: string) => AppendHandle } & PromiseLike<void>;

function brokenFind(path: string): AppendHandle {
  let content: string | undefined;
  let tail: Promise<void> = Promise.resolve();

  function enqueue(step: () => Promise<void>): void {
    tail = tail.then(step);
  }

  async function ensureLoaded(): Promise<void> {
    if (content !== undefined) return;
    const { session } = currentContext();
    content = (await session.read(path)) ?? "";
  }

  const handle: AppendHandle = {
    // Chainable (returns `handle`), mirroring every real dialect op method.
    append: (line: string): AppendHandle => {
      enqueue(async () => {
        await ensureLoaded();
        content = content + line;
        // BROKEN: buffers a FRESH modify directive on EVERY call — never coalesces into a
        // shared, reused open directive the way the real dialect-handle.ts does.
        const { session, factory } = currentContext();
        session.buffer(factory.modify({ path, content: content! }));
      });
      return handle;
    },
    then: (onfulfilled, onrejected) => tail.then(onfulfilled, onrejected),
  };
  return handle;
}

// Empty — this fixture bypasses the ops mechanism entirely via a custom `find()` (see
// header); the exercise's `chain` names `append` structurally, not via a real op-pack entry.
export const coalescingViolationOps: OpPack = {};

export const coalescingViolationDialect: Dialect = {
  extensions: [".broken"],
  ast: {
    parse: (source: string) => source,
    print: (ast: unknown) => ast as string,
  },
  ops: coalescingViolationOps,
  find: brokenFind as unknown as Dialect["find"],
};

export const coalescingViolationFixture: OpPackFixture = {
  opPack: coalescingViolationOps,
  baseDialect: coalescingViolationDialect,
  exercises: [
    {
      seed: "base\n",
      chain: [
        { op: "append", args: ["-A"] },
        { op: "append", args: ["-B"] },
      ],
      expect: "base\n-A-B",
    },
  ],
};
