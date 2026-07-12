// S-004 — planted violation for REQ-DC-05.2 (read-boundary-split slot). [permanent-fixture]
//
// A hand-rolled `find()` that coalesces CORRECTLY for a plain no-read chain (all ops land in
// ONE buffered directive — so this fixture passes REQ-DC-02/03's direct check, isolating the
// read-split failure specifically) but IGNORES the read boundary entirely: it defers ALL
// buffering to the very end of the chain (`.then()`), so a mid-chain `handle.read()` never
// forces a split — the run emits exactly ONE modify (cumulative, both edits merged) where
// the `modify-coalescing` REQ-MC-02 contract demands TWO. Proves REQ-DC-05.2's assertion is
// live, not inherited by name only.
//
// Test-only code: importing `currentContext` here is fine (FIT-08/FIT-10 scope `src/**`
// only, never `test/**`).
import { currentContext } from "../../../src/core/context.ts";
import type { Dialect, OpPack } from "../../../src/core/define-dialect.ts";
import type { OpPackFixture } from "../../../src/conformance/index.ts";

type AppendHandle = {
  readonly append: (line: string) => AppendHandle;
  readonly read: () => Promise<string | undefined>;
} & PromiseLike<void>;

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
        // BROKEN: no buffering happens here at all — deferred to `.then()` below.
      });
      return handle;
    },
    // Honest read — sequenced on `tail`, delegates to the REAL `session.read` (so RYOW
    // itself still holds; only the SPLIT is broken, isolating REQ-DC-05.2 specifically).
    read: (): Promise<string | undefined> => {
      const previousTail = tail;
      const result: Promise<string | undefined> = previousTail.then(async () => {
        const { session } = currentContext();
        return session.read(path);
      });
      tail = result.then(() => undefined);
      return result;
    },
    // BROKEN: the ENTIRE chain buffers exactly ONE modify, computed at the very end,
    // regardless of any mid-chain `read()` — the read observes/returns content honestly
    // but never triggers a split.
    then: (onfulfilled, onrejected) =>
      tail
        .then(async () => {
          const { session, factory } = currentContext();
          session.buffer(factory.modify({ path, content: content! }));
        })
        .then(onfulfilled, onrejected),
  };
  return handle;
}

// Empty — this fixture bypasses the ops mechanism entirely via a custom `find()` (see
// header); the exercise's `chain` names `append` structurally, not via a real op-pack entry.
export const readSplitViolationOps: OpPack = {};

export const readSplitViolationDialect: Dialect = {
  extensions: [".broken"],
  ast: {
    parse: (source: string) => source,
    print: (ast: unknown) => ast as string,
  },
  ops: readSplitViolationOps,
  find: brokenFind as unknown as Dialect["find"],
};

export const readSplitViolationFixture: OpPackFixture = {
  opPack: readSplitViolationOps,
  baseDialect: readSplitViolationDialect,
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
