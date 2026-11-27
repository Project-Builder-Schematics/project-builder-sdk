/**
 * A-8 — a node kept from before a re-parse fails loudly, naming the file and the remedy. The
 * handle retires the old AST through the dialect's optional `ast.retire` when it re-parses.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { defineDialect, defineOpPack, withOps } from "../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import * as ts from "../../../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../../../support/spy-client.ts";

type Lines = { lines: string[]; retired: boolean };

const retiredTrees: Lines[] = [];
const retiring = withOps(
  defineDialect({
    extensions: [".lines"],
    ast: {
      parse: (source: string): Lines => ({ lines: source.split("\n"), retired: false }),
      print: (ast: Lines): string => {
        if (ast.retired) throw new Error("printed a retired tree");
        return ast.lines.join("\n");
      },
      retire: (ast: Lines): void => {
        ast.retired = true;
        retiredTrees.push(ast);
      },
    },
    ops: {},
  }),
  defineOpPack<Lines, { push: (ast: Lines, line: string) => void }>({ push: (ast, line) => void ast.lines.push(line) })
);

async function run(seed: Record<string, string>, fn: () => Promise<void>) {
  const { client, emitted } = makeSpyClient(seed);
  let error: unknown;
  try {
    await defineFactory<void>(fn)(undefined, { client });
  } catch (caught) {
    error = caught;
  }
  return { error, modifies: collectModifies(emitted) };
}

describe("A-8: the handle retires the tree it re-parses away from", () => {
  it("retires the old tree once, after fixing the drained directive's content", async () => {
    retiredTrees.length = 0;
    const { error, modifies } = await run({ "a.lines": "seed" }, async () => {
      const a = retiring.find("a.lines");
      const b = retiring.find("a.lines");
      await a.push("x");
      await b.push("y");
      await a.push("z");
    });
    expect(error).toBeUndefined();
    expect(retiredTrees).toHaveLength(1);
    expect(modifies.map((m) => m.modify.content)).toEqual(["seed\nx", "seed\nx\ny", "seed\nx\ny\nz"]);
  });

  it("never retires the tree of a handle no other writer touched", async () => {
    retiredTrees.length = 0;
    await run({ "a.lines": "seed" }, async () => {
      await retiring.find("a.lines").push("x").push("y");
    });
    expect(retiredTrees).toHaveLength(0);
  });
});

describe("A-8: a node kept before another handle changed the file (TypeScript)", () => {
  it("fails naming the file and the remedy, and is not relocated by name", async () => {
    let kept: { rename(name: string): unknown } | undefined;
    const { error } = await run({ "a.ts": "export function main() {}" }, async () => {
      const a = ts.find("a.ts");
      const b = ts.find("a.ts");
      await a.modify((file) => {
        kept = file.getFunctionOrThrow("main");
      });
      await b.addImport("x", "./x");
      await a.addImport("y", "./y");
      await a.modify(() => {
        kept!.rename("primary");
      });
    });
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toStartWith("dialect operation failed: ");
    expect(message).toContain('"a.ts"');
    expect(message).toContain("look the node up again inside .modify()");
  });

  it("keeps a node usable when no re-parse happened in between", async () => {
    let kept: { rename(name: string): unknown } | undefined;
    const { error, modifies } = await run({ "a.ts": "export function main() {}" }, async () => {
      const a = ts.find("a.ts");
      await a.modify((file) => {
        kept = file.getFunctionOrThrow("main");
      });
      await a.modify(() => {
        kept!.rename("primary");
      });
    });
    expect(error).toBeUndefined();
    expect(modifies.at(-1)?.modify.content).toBe("export function primary() {}");
  });
});
