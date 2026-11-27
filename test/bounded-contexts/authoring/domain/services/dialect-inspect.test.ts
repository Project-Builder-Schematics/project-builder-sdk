/**
 * `.inspect(ast => value)`, the read escape hatch of a Dialect handle (A-128), its name reserved
 * as a handle verb (A-129, A-83) and its failures contained (A-86). Driven against a synthetic
 * line-per-entry dialect.
 */
import { describe, it, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import { defineFactory } from "../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { defineDialect, defineOpPack, query, withOps } from "../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import { dialectError } from "../../../../../src/bounded-contexts/authoring/domain/valueobjects/dialect-error.ts";
import { makeSpyClient, collectModifies } from "../../../../support/spy-client.ts";

type Lines = string[];

const ops = {
  push(ast: Lines, line: string) {
    ast.push(line);
  },
  count: query((ast: Lines) => ast.length),
};

const lines = withOps(
  defineDialect({
    extensions: [".lines"],
    ast: { parse: (source: string): Lines => source.split("\n"), print: (ast: Lines) => ast.join("\n") },
    ops: {},
  }),
  defineOpPack<Lines, typeof ops>(ops)
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

describe(".inspect() (A-128)", () => {
  it("returns what its callback returns and sees the ops chained before it, which still commit as one modify", async () => {
    let value: number | undefined;
    const outcome = await run({ "a.lines": "x" }, async () => {
      value = await lines.find("a.lines").push("y").push("z").inspect((ast) => ast.length);
    });
    expect(outcome.error).toBeUndefined();
    expect(value).toBe(3);
    expect(outcome.modifies.map((m) => m.modify.content)).toEqual(["x\ny\nz"]);
  });

  it("hands the callback the live AST, the same object .modify() gets", async () => {
    let edited: Lines | undefined;
    let inspected: Lines | undefined;
    const outcome = await run({ "a.lines": "x" }, async () => {
      const handle = lines.find("a.lines");
      handle.modify((ast) => void (edited = ast));
      await handle.inspect((ast) => void (inspected = ast));
    });
    expect(outcome.error).toBeUndefined();
    expect(inspected).toBeDefined();
    expect(inspected).toBe(edited);
  });

  it("awaits an async callback", async () => {
    let value: number | undefined;
    await run({ "a.lines": "x" }, async () => {
      value = await lines.find("a.lines").inspect(async (ast) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return ast.length;
      });
    });
    expect(value).toBe(1);
  });

  it("emits nothing on its own", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines.find("a.lines").inspect((ast) => ast.length);
    });
    expect(outcome.error).toBeUndefined();
    expect(outcome.modifies).toHaveLength(0);
  });

  it("fails the factory when the callback changes the AST, naming inspect and the file, and nothing commits", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines
        .find("a.lines")
        .push("y")
        .inspect((ast) => void ast.push("sneaky"));
    });
    expect(outcome.error?.message).toBe('dialect operation failed: inspect() must not change "a.lines"');
    expect(outcome.modifies).toHaveLength(0);
  });

  it("still fails the run when the author catches a changing callback and keeps chaining", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      const handle = lines.find("a.lines");
      await handle.inspect((ast) => void ast.push("sneaky")).catch(() => undefined);
      await handle.push("y");
    });
    expect(outcome.error?.message).toBe('dialect operation failed: inspect() must not change "a.lines"');
    expect(outcome.modifies).toHaveLength(0);
  });
});

describe(".inspect() failures (A-86)", () => {
  it("wraps a foreign throw, naming inspect and the file, without its message", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines.find("a.lines").inspect(() => {
        throw new Error("secret internal detail");
      });
    });
    expect(outcome.error?.message).toBe('dialect operation failed: inspect() on "a.lines" threw');
    expect(outcome.modifies).toHaveLength(0);
  });

  it("passes the callback's own dialectError through verbatim", async () => {
    const outcome = await run({ "a.lines": "x" }, async () => {
      await lines.find("a.lines").inspect(() => {
        throw dialectError("synthetic inspect reject");
      });
    });
    expect(outcome.error?.message).toBe("dialect operation failed: synthetic inspect reject");
  });

  it("rejects on a missing file like an op", async () => {
    const outcome = await run({}, async () => {
      await lines.find("missing.lines").inspect((ast) => ast.length);
    });
    expect(outcome.error?.message).toContain('"missing.lines" does not exist');
  });
});

describe("inspect is a handle verb (A-129, A-83)", () => {
  it("refuses an op named inspect", () => {
    const pack = { inspect: (ast: Lines) => void ast.push("x") };
    expect(() => withOps(lines, defineOpPack<Lines, typeof pack>(pack))).toThrow('op "inspect" collides with a reserved handle verb');
  });

  it("refuses a query named inspect", () => {
    const pack = { inspect: query((ast: Lines) => ast.length) };
    expect(() => withOps(lines, defineOpPack<Lines, typeof pack>(pack))).toThrow('op "inspect" collides with a reserved handle verb');
  });

  it("refuses a base dialect whose own op is named inspect", () => {
    expect(() =>
      defineDialect({
        extensions: [".lines"],
        ast: { parse: (source: string): Lines => source.split("\n"), print: (ast: Lines) => ast.join("\n") },
        ops: { inspect: (ast: Lines) => void ast.push("x") },
      })
    ).toThrow('op "inspect" collides with a reserved handle verb');
  });
});

describe("the other verbs are unchanged", () => {
  it("keeps a query and .modify() working on the handle .inspect() reads", async () => {
    let counted: number | undefined;
    let inspected: number | undefined;
    const outcome = await run({ "a.lines": "x" }, async () => {
      const handle = lines.find("a.lines");
      handle.modify((ast) => void ast.push("y"));
      inspected = await handle.inspect((ast) => ast.length);
      counted = await handle.push("z").count();
    });
    expect(outcome.error).toBeUndefined();
    expect(inspected).toBe(2);
    expect(counted).toBe(3);
    expect(outcome.modifies.map((m) => m.modify.content)).toEqual(["x\ny\nz"]);
  });

  it("types .inspect() as resolving to the callback's awaited result, with the dialect's AST", () => {
    type H = ReturnType<typeof lines.find>;
    expectTypeOf<Parameters<Parameters<H["inspect"]>[0]>[0]>().toEqualTypeOf<Lines>();
    const counted = (handle: H) => handle.inspect((ast) => ast.length);
    const first = (handle: H) => handle.inspect(async (ast) => ast[0]);
    expectTypeOf<ReturnType<typeof counted>>().toEqualTypeOf<Promise<number>>();
    expectTypeOf<ReturnType<typeof first>>().toEqualTypeOf<Promise<string | undefined>>();
  });
});
