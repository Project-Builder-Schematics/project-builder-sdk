import { describe, it, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import {
  byExtension,
  defineDialect,
  defineOpPack,
  overrideOps,
  withOps,
  withoutOps,
} from "../../src/core/define-dialect.ts";
import { defineFactory } from "../../src/core/context.ts";
import { isContained } from "../../src/core/dialect-error.ts";
import { makeSpyClient, collectModifies } from "../support/spy-client.ts";

// Two dialects over DIFFERENT AST types, the shape a `.ts` + `.html` dialect needs.
interface Lines {
  lines: string[];
}
interface Pairs {
  pairs: [string, string][];
}

const linesAst = { parse: (s: string): Lines => ({ lines: s.split("\n") }), print: (a: Lines) => a.lines.join("\n") };
const pairsAst = {
  parse: (s: string): Pairs => ({ pairs: s === "" ? [] : s.split(";").map((p) => p.split("=") as [string, string]) }),
  print: (a: Pairs) => a.pairs.map((p) => p.join("=")).join(";"),
};

const lineOps = defineOpPack<Lines, { push: (ast: Lines, line: string) => void; drop: (ast: Lines) => void }>({
  push: (ast, line) => void ast.lines.push(line),
  drop: (ast) => void ast.lines.pop(),
});
const pairOps = defineOpPack<Pairs, { set: (ast: Pairs, key: string, value: string) => void }>({
  set: (ast, key, value) => void ast.pairs.push([key, value]),
});

const txt = withOps(defineDialect({ extensions: [".txt"], ast: linesAst, ops: {} }), lineOps);
const cfg = withOps(defineDialect({ extensions: [".cfg", ".app.cfg"], ast: pairsAst, ops: {} }), pairOps);

async function run(files: Record<string, string>, edit: () => Promise<void>) {
  const { client, emitted } = makeSpyClient(files);
  let caught: unknown;
  try {
    await defineFactory<void>(edit)(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), client };
}

describe("byExtension", () => {
  it("routes each extension to its own dialect, AST and ops", async () => {
    const router = byExtension({ ".txt": txt, ".cfg": cfg });
    const { caught, modifies } = await run({ "a.txt": "x", "b.cfg": "k=v" }, async () => {
      await router.find("a.txt").push("y");
      await router.find("b.cfg").set("n", "1");
    });

    expect(caught).toBeUndefined();
    expect(modifies.map((m) => m.modify.content)).toEqual(["x\ny", "k=v;n=1"]);
    expect(router.extensions).toEqual([".txt", ".cfg"]);
  });

  it("the longest matching extension wins", async () => {
    const plain = withOps(defineDialect({ extensions: [".cfg"], ast: linesAst, ops: {} }), lineOps);
    const router = byExtension({ ".cfg": plain, ".app.cfg": cfg });
    const { modifies } = await run({ "main.app.cfg": "" }, async () => {
      await router.find("main.app.cfg").set("k", "v");
    });

    expect(modifies[0]?.modify.content).toBe("k=v");
  });

  it("a path with no routed extension rejects synchronously, naming every extension", () => {
    const router = byExtension({ ".txt": txt, ".cfg": cfg });
    let caught: unknown;
    try {
      router.find("README.md");
    } catch (err) {
      caught = err;
    }

    expect(isContained(caught)).toBe(true);
    expect((caught as Error).message).toContain(".txt, .cfg");
  });

  it("a basename that is only the extension rejects", () => {
    expect(() => byExtension({ ".txt": txt }).find("src/.txt")).toThrow(/\.txt/);
  });

  it("a key its dialect does not declare throws at composition", () => {
    expect(() => byExtension({ ".md": txt })).toThrow('dialect routing failed: ".md" is not an extension its dialect declares (.txt).');
  });

  it("types a literal path's handle by its extension", () => {
    const router = byExtension({ ".txt": txt, ".cfg": cfg });
    const _typed = () => {
      router.find("a.txt").push("x");
      router.find("b.cfg").set("k", "v");
      // @ts-expect-error — `set` belongs to the .cfg dialect, not .txt.
      router.find("a.txt").set("k", "v");
      const nested = byExtension({ ".cfg": withOps(defineDialect({ extensions: [".cfg"], ast: linesAst, ops: {} }), lineOps), ".app.cfg": cfg });
      nested.find("main.app.cfg").set("k", "v");
      // @ts-expect-error — the longer `.app.cfg` key wins, so the `.cfg` dialect's `push` is not offered.
      nested.find("main.app.cfg").push("x");
    };
    void _typed;
    expectTypeOf(router.find).toBeFunction();
  });
});

describe("withoutOps", () => {
  it("keeps the op on the handle but rejects it at call time, leaving the file unchanged", async () => {
    const limited = withoutOps(txt, ["drop"], "lines are append-only here");
    const { caught, modifies, client } = await run({ "a.txt": "x" }, async () => {
      await limited.find("a.txt").drop();
    });

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain("drop");
    expect(message).toContain(".txt");
    expect(message).toContain("lines are append-only here");
    expect(modifies).toHaveLength(0);
    expect(await client.read("a.txt")).toBe("x");
  });

  it("leaves the other ops working", async () => {
    const limited = withoutOps(txt, ["drop"], "append-only");
    const { modifies } = await run({ "a.txt": "x" }, async () => {
      await limited.find("a.txt").push("y");
    });

    expect(modifies[0]?.modify.content).toBe("x\ny");
    expect(Object.keys(limited.ops).sort()).toEqual(["drop", "push"]);
  });

  it("an op name the dialect does not have throws at composition", () => {
    expect(() => withoutOps(txt, ["wipe" as never], "x")).toThrow('withoutOps failed: the dialect has no op "wipe".');
  });
});

describe("overrideOps", () => {
  it("replaces the named op and keeps the rest", async () => {
    const shouting = overrideOps(txt, { push: (ast, line) => void ast.lines.push(line.toUpperCase()) });
    const { modifies } = await run({ "a.txt": "x" }, async () => {
      await shouting.find("a.txt").push("y");
    });

    expect(modifies[0]?.modify.content).toBe("x\nY");
    expect(shouting.extensions).toEqual([".txt"]);
  });

  it("an op name the dialect does not have throws at composition", () => {
    expect(() => overrideOps(txt, { wipe: () => {} } as never)).toThrow('overrideOps failed: the dialect has no op "wipe".');
  });
});
