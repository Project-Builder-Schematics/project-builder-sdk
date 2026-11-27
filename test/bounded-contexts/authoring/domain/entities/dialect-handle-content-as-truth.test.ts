/**
 * A-7 — the content is the source of truth; a handle's live AST is a cache of it. Several handles
 * on one path (spelled the same way) never lose each other's edits, awaited or not.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { defineDialect, defineOpPack, withOps } from "../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import { replaceContent } from "../../../../../src/commons/index.ts";
import { makeSpyClient, collectModifies } from "../../../../support/spy-client.ts";
import { toyDialect } from "../../../../fixtures/toy-dialect/index.ts";

async function runOn(seed: string, fn: () => Promise<void> | void) {
  const { client, emitted } = makeSpyClient({ "a.toy": seed });
  let error: unknown;
  try {
    await defineFactory<void>(async () => {
      await fn();
    })(undefined, { client });
  } catch (caught) {
    error = caught;
  }
  const modifies = collectModifies(emitted);
  return { error, last: modifies.at(-1)?.modify.content, modifies };
}

describe("A-7: two handles on one path keep every edit", () => {
  it("keeps both edits when neither op is awaited", async () => {
    const { error, last } = await runOn("seed", () => {
      toyDialect.find("a.toy").push("x");
      toyDialect.find("a.toy").push("y");
    });
    expect(error).toBeUndefined();
    expect(last).toBe("seed\nx\ny");
  });

  it("keeps every edit when ops interleave a, b, a and each is awaited", async () => {
    const { error, last } = await runOn("seed", async () => {
      const a = toyDialect.find("a.toy");
      const b = toyDialect.find("a.toy");
      await a.push("x");
      await b.push("y");
      await a.push("z");
    });
    expect(error).toBeUndefined();
    expect(last).toBe("seed\nx\ny\nz");
  });

  it("keeps every edit when ops interleave a, b, a and none is awaited", async () => {
    const { error, last } = await runOn("seed", () => {
      const a = toyDialect.find("a.toy");
      const b = toyDialect.find("a.toy");
      a.push("x");
      b.push("y");
      a.push("z");
    });
    expect(error).toBeUndefined();
    expect(last).toContain("x");
    expect(last).toContain("y");
    expect(last).toContain("z");
  });

  it("re-parses after a commons write to the path, even once the handle has parsed", async () => {
    const { error, last } = await runOn("seed", async () => {
      const a = toyDialect.find("a.toy");
      await a.push("x");
      replaceContent("a.toy", "replaced");
      await a.push("y");
    });
    expect(error).toBeUndefined();
    expect(last).toBe("replaced\ny");
  });

  it("re-parses after the handle's own replaceContent", async () => {
    const { error, last } = await runOn("seed", async () => {
      const a = toyDialect.find("a.toy");
      await a.push("x").read();
      await a.replaceContent("replaced");
      await a.push("y");
    });
    expect(error).toBeUndefined();
    expect(last).toBe("replaced\ny");
  });

  it("does not re-parse or re-read when only the handle itself writes", async () => {
    let parses = 0;
    const counted = withOps(
      defineDialect({
        extensions: [".toy"],
        ast: {
          parse: (source: string) => (parses++, source.split("\n")),
          print: (ast: string[]) => ast.join("\n"),
        },
        ops: {},
      }),
      defineOpPack<string[], { push: (ast: string[], line: string) => void }>({ push: (ast, line) => void ast.push(line) })
    );
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });
    let reads = 0;
    const read = client.read.bind(client);
    client.read = (path) => (reads++, read(path));
    await defineFactory<void>(async () => {
      const a = counted.find("a.toy");
      await a.push("x");
      await a.push("y");
    })(undefined, { client });
    expect(parses).toBe(1);
    expect(reads).toBe(1);
    expect(collectModifies(emitted).map((m) => m.modify.content)).toEqual(["seed\nx\ny"]);
  });
});

describe("A-7: a write that lands while an op runs fails loudly", () => {
  it("rejects naming the file when another handle writes it during an async op", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = withOps(
      defineDialect({ extensions: [".toy"], ast: { parse: (s: string) => s.split("\n"), print: (a: string[]) => a.join("\n") }, ops: {} }),
      defineOpPack<string[], { slowPush: (ast: string[], line: string) => Promise<void>; push: (ast: string[], line: string) => void }>({
        async slowPush(ast, line) {
          await gate;
          ast.push(line);
        },
        push: (ast, line) => void ast.push(line),
      })
    );
    const { error } = await runOn("seed", async () => {
      const a = slow.find("a.toy");
      const b = slow.find("a.toy");
      await a.push("first");
      const pending = a.slowPush("late");
      await b.push("other");
      release();
      await pending;
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toStartWith("dialect operation failed: ");
    expect((error as Error).message).toContain('"a.toy"');
  });
});
