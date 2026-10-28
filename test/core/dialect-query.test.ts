/**
 * Queries: ops marked with `query()` end the chain and resolve to a value (odd/tasks/
 * dialect-queries.md, S1-S5). Driven against a synthetic line-per-entry dialect.
 */
import { describe, it, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import { defineFactory } from "../../src/core/context.ts";
import { defineDialect, defineOpPack, query, withOps } from "../../src/core/define-dialect.ts";
import { dialectError } from "../../src/core/dialect-error.ts";
import { makeSpyClient, collectModifies } from "../support/spy-client.ts";

type Lines = string[];

const ops = {
  push(ast: Lines, line: string) {
    ast.push(line);
  },
  count: query((ast: Lines) => ast.length),
  lineAt: query((ast: Lines, index: number) => ast[index]),
  slowCount: query(async (ast: Lines) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return ast.length;
  }),
  rejecting: query((): number => {
    throw dialectError("synthetic query reject");
  }),
  foreignThrow: query((): number => {
    throw new Error("internal detail");
  }),
  mutating: query((ast: Lines) => ast.push("sneaky")),
};
const pack = defineOpPack<Lines, typeof ops>(ops);

const lines = withOps(
  defineDialect({
    extensions: [".lines"],
    ast: { parse: (source: string): Lines => source.split("\n"), print: (ast: Lines) => ast.join("\n") },
    ops: {},
  }),
  pack
);

async function run(seed: Record<string, string>, body: () => Promise<void>) {
  const { client, emitted } = makeSpyClient(seed);
  let error: Error | undefined;
  try {
    await defineFactory<void>(body)(undefined, { client });
  } catch (caught) {
    error = caught as Error;
  }
  return { error, modifies: collectModifies(emitted) };
}

describe("queries (S1-S5)", () => {
  it("resolves to a value read from the file, and emits nothing", async () => {
    let value: number | undefined;
    const outcome = await run({ "a.lines": "x\ny" }, async () => {
      value = await lines.find("a.lines").count();
    });
    expect(outcome.error).toBeUndefined();
    expect(value).toBe(2);
    expect(outcome.modifies).toHaveLength(0);
  });

  it("sees the ops chained before it, which still commit as one modify", async () => {
    let value: string | undefined;
    const outcome = await run({ "a.lines": "x" }, async () => {
      value = await lines.find("a.lines").push("y").push("z").lineAt(2);
    });
    expect(outcome.error).toBeUndefined();
    expect(value).toBe("z");
    expect(outcome.modifies.map((m) => m.modify.content)).toEqual(["x\ny\nz"]);
  });

  it("awaits an async query", async () => {
    let value: number | undefined;
    await run({ "a.lines": "x" }, async () => {
      value = await lines.find("a.lines").push("y").slowCount();
    });
    expect(value).toBe(2);
  });

  it("lets later ops on the same handle keep coalescing after an awaited query", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      const handle = lines.find("a.lines");
      if ((await handle.push("y").count()) === 2) await handle.push("z");
    });
    expect(outcome.error).toBeUndefined();
    expect(outcome.modifies.map((m) => m.modify.content)).toEqual(["x\ny\nz"]);
  });

  it("passes a query's own dialectError through verbatim and fails the run", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines.find("a.lines").push("y").rejecting();
    });
    expect(outcome.error?.message).toBe("dialect operation failed: synthetic query reject");
    expect(outcome.modifies).toHaveLength(0);
  });

  it("wraps a foreign throw without leaking its message", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines.find("a.lines").foreignThrow();
    });
    expect(outcome.error?.message).toBe('dialect operation failed: foreignThrow() on "a.lines" threw');
  });

  it("rejects a query that changes the file, and nothing commits", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines.find("a.lines").push("y").mutating();
    });
    expect(outcome.error?.message).toBe('dialect operation failed: mutating() is a query and must not change "a.lines"');
    expect(outcome.modifies).toHaveLength(0);
  });

  it("rejects a query on a missing file like an op", async () => {
    const outcome = await run({}, async () => {
      await lines.find("missing.lines").count();
    });
    expect(outcome.error?.message).toContain('"missing.lines" does not exist');
  });

  it("leaves the wrapped function a plain op wherever it is reused unwrapped", async () => {
    const touch = (ast: Lines) => void ast.length;
    const reused = { asQuery: query(touch), asOp: touch };
    const dialect = withOps(lines, defineOpPack<Lines, typeof reused>(reused));
    let chained = false;
    await run({ "a.lines": "x" }, async () => {
      const handle = dialect.find("a.lines");
      chained = handle.asOp() === handle;
    });
    expect(chained).toBe(true);
  });

  it("is checked against reserved handle verbs like any op", () => {
    const reserved = { read: query((ast: Lines) => ast.length) };
    expect(() => withOps(lines, defineOpPack<Lines, typeof reserved>(reserved))).toThrow(
      'op "read" collides with a reserved handle verb'
    );
  });

  it("types a query as Promise-returning and an op as chainable", () => {
    type H = ReturnType<typeof lines.find>;
    expectTypeOf<ReturnType<H["lineAt"]>>().toEqualTypeOf<Promise<string | undefined>>();
    expectTypeOf<ReturnType<H["slowCount"]>>().toEqualTypeOf<Promise<number>>();
    expectTypeOf<Parameters<H["lineAt"]>>().toEqualTypeOf<[index: number]>();
    expectTypeOf<ReturnType<H["push"]>>().toHaveProperty("count");
  });
});
