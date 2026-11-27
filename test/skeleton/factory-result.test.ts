/**
 * A-14 / E-40: the Result a factory returns, declared in `schema.json` under `result`, is
 * validated at the factory boundary and committed with `ir.commit`. Driven through the public
 * `runFactoryForTest`, whose `result` is what the run sent with its commit.
 */
import { describe, it, expect } from "bun:test";
import { create } from "../../src/commons/index.ts";
import { AuthoringError } from "../../src/commons/index.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { seedSchema } from "../support/canary.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("result-");
const CEILING = 1048576;

function packageWith(result: unknown): string {
  const dir = scratchDir();
  seedSchema(dir, result === undefined ? { properties: {} } : { properties: {}, result });
  return dir;
}

/** Writes `r.txt`, then returns `value`, so a test sees whether the staged edit survived. */
function returning<R>(value: R): () => R {
  return () => {
    create("r.txt", { template: "root", options: {} });
    return value;
  };
}

function expectInvalidResult(error: unknown, text: string): void {
  expect(error).toBeInstanceOf(AuthoringError);
  expect((error as AuthoringError).reason).toBe("invalid-result");
  expect((error as AuthoringError).origin).toBe("authoring-rejected");
  expect((error as Error).message).toStartWith("invalid Result: ");
  expect((error as Error).message).toContain(text);
}

describe("A-14 — a declared Result is validated and committed", () => {
  it("a Result matching its declaration is committed, with the factory's edits", async () => {
    const run = await runFactoryForTest(returning("hello"), {}, { packageDir: packageWith({ type: "string" }) });

    expect(run.error).toBeUndefined();
    expect(run.result).toBe("hello");
    expect(run.tree.get("r.txt")).toBe("root");
  });

  it("a declared null Result is committed as null, which is a Result", async () => {
    const run = await runFactoryForTest(returning(null), {}, { packageDir: packageWith({ type: "null" }) });

    expect(run.error).toBeUndefined();
    expect(run.result).toBeNull();
  });

  it("a type list allows each listed type", async () => {
    const declared = { type: ["string", "null"] };

    expect((await runFactoryForTest(returning(null), {}, { packageDir: packageWith(declared) })).result).toBeNull();
    expect((await runFactoryForTest(returning("x"), {}, { packageDir: packageWith(declared) })).result).toBe("x");
  });

  it("a declared object checks its properties, its required keys and refuses undeclared keys", async () => {
    const declared = {
      type: "object",
      properties: { name: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
      required: ["name"],
    };

    const ok = await runFactoryForTest(returning({ name: "a", tags: ["x"] }), {}, { packageDir: packageWith(declared) });
    expect(ok.error).toBeUndefined();
    expect(ok.result).toEqual({ name: "a", tags: ["x"] });

    expectInvalidResult((await runFactoryForTest(returning({}), {}, { packageDir: packageWith(declared) })).error, "Result.name must be string");
    expectInvalidResult(
      (await runFactoryForTest(returning({ name: "a", tags: [1] }), {}, { packageDir: packageWith(declared) })).error,
      "Result.tags[0] must be string"
    );
    expectInvalidResult(
      (await runFactoryForTest(returning({ name: "a", extra: 1 }), {}, { packageDir: packageWith(declared) })).error,
      "Result.extra is not declared"
    );
  });

  it("a Result of the wrong type fails at the boundary: nothing is emitted or committed", async () => {
    const run = await runFactoryForTest(returning("seven"), {}, { packageDir: packageWith({ type: "number" }) });

    expectInvalidResult(run.error, "Result must be number");
    expect(run.result).toBeUndefined();
    expect(run.emitted).toEqual([]);
    expect(run.tree.size).toBe(0);
  });

  it("the failure never echoes the returned value", async () => {
    const run = await runFactoryForTest(returning("SECRET-result"), {}, { packageDir: packageWith({ type: "number" }) });

    expect((run.error as Error).message).not.toContain("SECRET-result");
  });

  it("an undeclared Result (no `result` in schema.json) with a returned value fails, and nothing is written", async () => {
    const run = await runFactoryForTest(returning("hello"), {}, { packageDir: packageWith(undefined) });

    expectInvalidResult(run.error, "declares no Result");
    expect(run.result).toBeUndefined();
    expect(run.tree.size).toBe(0);
  });

  it("a bare factory (no packageDir) declares no Result, so returning a value fails too", async () => {
    const run = await runFactoryForTest(returning("hello"), {});

    expectInvalidResult(run.error, "declares no Result");
    expect(run.tree.size).toBe(0);
  });

  it("a factory that declares no Result and returns nothing runs exactly as before", async () => {
    for (const options of [{}, { packageDir: packageWith(undefined) }]) {
      const run = await runFactoryForTest(returning(undefined), {}, options);

      expect(run.error).toBeUndefined();
      expect(run.result).toBeUndefined();
      expect(run.tree.get("r.txt")).toBe("root");
    }
  });

  it("a declared Result the factory does not return fails: undefined is not JSON", async () => {
    const run = await runFactoryForTest(returning(undefined), {}, { packageDir: packageWith({ type: "string" }) });

    expectInvalidResult(run.error, "Result is undefined");
  });
});

describe("A-14 — the Result must be JSON", () => {
  const anyObject = { type: "object" };
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  const cases: Array<[string, unknown, string]> = [
    ["a function", { fn: () => 1 }, "Result.fn is a function"],
    ["a class instance", { at: new Date(0) }, "Result.at is a Date"],
    ["a Map", { m: new Map() }, "Result.m is a Map"],
    ["a cycle", cyclic, "Result.self is a cycle"],
    ["an undefined property", { gone: undefined }, "Result.gone is undefined"],
    ["a sparse array slot", { list: [1, , 3] }, "Result.list[1] is undefined"],
    ["NaN", { n: Number.NaN }, "Result.n is a non-finite number"],
    ["Infinity", { n: Number.POSITIVE_INFINITY }, "Result.n is a non-finite number"],
    ["a bigint", { n: 1n }, "Result.n is a bigint"],
    ["a symbol", { s: Symbol("s") }, "Result.s is a symbol"],
    ["an object with a toJSON method", { v: { toJSON: () => 1 } }, "Result.v has a toJSON method"],
    [
      "a getter that throws, without echoing what it threw",
      Object.defineProperty({}, "g", { enumerable: true, get: () => { throw new Error("SECRET-getter"); } }),
      "the Result could not be read",
    ],
  ];

  for (const [name, value, text] of cases) {
    it(`${name} is refused`, async () => {
      const run = await runFactoryForTest(returning(value), {}, { packageDir: packageWith(anyObject) });

      expectInvalidResult(run.error, text);
      expect((run.error as Error).message).not.toContain("SECRET");
      expect(run.tree.size).toBe(0);
    });
  }

  it("a value shared twice without a cycle is JSON", async () => {
    const shared = { a: 1 };
    const run = await runFactoryForTest(returning({ x: shared, y: shared }), {}, { packageDir: packageWith(anyObject) });

    expect(run.error).toBeUndefined();
    expect(run.result).toEqual({ x: { a: 1 }, y: { a: 1 } });
  });

  it("a function returned where a string is declared is not JSON", async () => {
    const run = await runFactoryForTest(returning(() => "hello"), {}, { packageDir: packageWith({ type: "string" }) });

    expectInvalidResult(run.error, "Result is a function");
  });
});

describe("E-40 — the Result is bounded at 1 MiB of JSON", () => {
  // A JSON string of n bytes: n - 2 ASCII characters inside the quotes.
  const ofBytes = (n: number): string => "a".repeat(n - 2);

  it("a Result exactly at the ceiling is committed", async () => {
    const run = await runFactoryForTest(returning(ofBytes(CEILING)), {}, { packageDir: packageWith({ type: "string" }) });

    expect(run.error).toBeUndefined();
    expect(JSON.stringify(run.result).length).toBe(CEILING);
  });

  it("a Result one byte past the ceiling fails naming the Result, and nothing is written", async () => {
    const run = await runFactoryForTest(returning(ofBytes(CEILING + 1)), {}, { packageDir: packageWith({ type: "string" }) });

    expectInvalidResult(run.error, "the JSON encoding of the Result is 1048577 bytes, past the 1 MiB ceiling (1048576 bytes)");
    expect(run.result).toBeUndefined();
    expect(run.tree.size).toBe(0);
  });

  it("the ceiling counts UTF-8 bytes, not characters", async () => {
    // "é" is two bytes: 2 quotes + 524288 * 2 = 1048578 bytes in 524290 characters.
    const run = await runFactoryForTest(returning("é".repeat(CEILING / 2)), {}, { packageDir: packageWith({ type: "string" }) });

    expectInvalidResult(run.error, "1048578 bytes");
  });
});

describe("A-14 — the Result declaration in schema.json", () => {
  const malformed: Array<[string, unknown]> = [
    ["an unknown type", { type: "date" }],
    ["no type", {}],
    ["a non-object declaration", "string"],
    ["required naming an undeclared property", { type: "object", properties: {}, required: ["x"] }],
  ];

  for (const [name, declared] of malformed) {
    it(`${name} fails the run as an unreadable schema, before the factory runs`, async () => {
      let ran = false;
      const run = await runFactoryForTest(
        () => {
          ran = true;
        },
        {},
        { packageDir: packageWith(declared) }
      );

      expect(run.error).toBeInstanceOf(Error);
      expect((run.error as Error).message).toContain('schema.json could not be read: invalid "result" declaration');
      expect(ran).toBe(false);
    });
  }
});
