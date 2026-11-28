/**
 * A-120 to A-126: an evaluation factory, run through `runFactoryForTest` with the role
 * `evaluation`. One test per rule, plus the previous behaviour of the options it shares.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFactoryForTest } from "../../../../src/testing/index.ts";
import { AuthoringError, create, glob } from "../../../../src/commons/index.ts";
import * as typescript from "../../../../src/dialects/typescript/index.ts";

const EVALUATION = { role: "evaluation", name: "app:hex-boundaries" } as const;
const SEED = { "src/a.ts": "export const a = 1;", "src/a.test.ts": "export const t = 1;", "lib/b.ts": "export const b = 1;" };

const finding = (rule: string, path?: string) => ({ rule, message: `${rule} reported`, severity: "error", ...(path === undefined ? {} : { path }) });

function rejection(error: unknown): AuthoringError {
  expect(error).toBeInstanceOf(AuthoringError);
  return error as AuthoringError;
}

describe("A-120: the role fixes the Result as Findings", () => {
  it("fails a factory whose findings do not match the Findings shape", async () => {
    const run = () => ({ items: [{ ...finding("port-exists", "src/a.ts"), severity: "info" }] });
    const result = await runFactoryForTest(run, {}, { ...EVALUATION, seed: SEED });
    expect(rejection(result.error).reason).toBe("invalid-result");
    expect(result.error).toHaveProperty("message", "invalid Result: Result.items[0].severity must be one of: error, warning");
    expect(result.result).toBeUndefined();
  });

  it("fails an evaluation factory that returns nothing", async () => {
    const result = await runFactoryForTest(() => {}, {}, EVALUATION);
    expect(rejection(result.error).reason).toBe("invalid-result");
  });

  it("keeps a generator that declares no Result returning nothing", async () => {
    const result = await runFactoryForTest(() => {}, {});
    expect(result.error).toBeUndefined();
    expect(result.result).toBeUndefined();
  });
});

describe("A-121: the SDK sets the source of every finding", () => {
  it("sets the source to the qualified name and keeps findings that share a rule", async () => {
    const run = () => ({ items: [finding("port-exists", "src/a.ts"), finding("port-exists", "lib/b.ts")] });
    const result = await runFactoryForTest(run, {}, { ...EVALUATION, seed: SEED });
    expect(result.error).toBeUndefined();
    expect(result.result as unknown).toEqual({
      items: [
        { ...finding("port-exists", "src/a.ts"), source: "app:hex-boundaries" },
        { ...finding("port-exists", "lib/b.ts"), source: "app:hex-boundaries" },
      ],
    });
  });

  it("rejects a finding whose author sets its source, and commits nothing", async () => {
    const run = () => {
      create("out.txt", { template: "x", options: {} });
      return { items: [{ ...finding("port-exists"), source: "app:other" }] };
    };
    const result = await runFactoryForTest(run, {}, EVALUATION);
    expect(rejection(result.error).reason).toBe("invalid-result");
    expect(result.error).toHaveProperty("message", "invalid Result: Result.items[0].source is set by the SDK, and a finding may not set it");
    expect(result.tree.size).toBe(0);
  });

  it("refuses the role evaluation without the qualified name", async () => {
    await expect(runFactoryForTest(() => ({ items: [] }), {}, { role: "evaluation" })).rejects.toThrow("an evaluation factory needs options.name");
  });
});

describe("A-122: the role imposes the inputs include and exclude", () => {
  const packageDirs: string[] = [];
  afterEach(() => {
    for (const dir of packageDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function packageDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "evaluation-factory-"));
    packageDirs.push(dir);
    writeFileSync(join(dir, "schema.json"), JSON.stringify({ properties: { strict: { type: "boolean", label: "Strict" } } }));
    return dir;
  }

  it("hands the factory the scope inputs its schema.json does not declare", async () => {
    let received: unknown;
    const run = (input: unknown) => {
      received = input;
      return { items: [] };
    };
    const input = { strict: true, include: ["src/**"], exclude: ["**/*.test.ts"] };
    const result = await runFactoryForTest(run, input, { ...EVALUATION, packageDir: packageDir() });
    expect(result.error).toBeUndefined();
    expect(received).toEqual(input);
  });

  it("rejects a scope input that is not an array of strings", async () => {
    const result = await runFactoryForTest(() => ({ items: [] }), { include: "src/**" }, EVALUATION);
    expect(rejection(result.error).reason).toBe("invalid-input");
    expect(result.error).toHaveProperty("message", "invalid input: include must be an array of strings");
  });

  it("keeps rejecting include as an undeclared input of a generator", async () => {
    const result = await runFactoryForTest(() => {}, { strict: true, include: ["src/**"] }, { packageDir: packageDir() });
    expect(rejection(result.error).reason).toBe("invalid-input");
  });
});

describe("A-123: every glob result is narrowed to the scope", () => {
  async function globbed(input: unknown, through: (pattern: string) => Promise<unknown[]>): Promise<string[]> {
    const run = async () => {
      for (const handle of await through("**/*.ts")) await (handle as { read(): Promise<unknown> }).read();
      return { items: [] };
    };
    const result = await runFactoryForTest(run, input, { ...EVALUATION, seed: SEED });
    expect(result.error).toBeUndefined();
    return [...result.reads.keys()];
  }

  it("keeps what include names less what exclude names, through commons and a Dialect", async () => {
    const scope = { include: ["src/**"], exclude: ["src/**/*.test.ts"] };
    expect(await globbed(scope, (pattern) => glob(pattern))).toEqual(["src/a.ts"]);
    expect(await globbed(scope, (pattern) => typescript.glob(pattern))).toEqual(["src/a.ts"]);
  });

  it("keeps every file but the excluded ones without include, and narrows nothing without either", async () => {
    expect(await globbed({ exclude: ["**/*.test.ts"] }, (pattern) => glob(pattern))).toEqual(["lib/b.ts", "src/a.ts"]);
    expect(await globbed({}, (pattern) => glob(pattern))).toEqual(["lib/b.ts", "src/a.test.ts", "src/a.ts"]);
  });

  it("leaves a generator's glob unnarrowed by inputs named include", async () => {
    let paths: number | undefined;
    const run = async (input: { include: string[] }) => {
      paths = (await glob("**/*.ts")).length;
      void input;
    };
    await runFactoryForTest(run, { include: ["src/**"] }, { seed: SEED });
    expect(paths).toBe(3);
  });
});

describe("A-124: a finding whose path falls outside the scope is dropped", () => {
  it("drops findings outside include or inside exclude, and keeps one without a path", async () => {
    const run = () => ({ items: [finding("in-scope", "src/a.ts"), finding("out-of-scope", "lib/b.ts"), finding("dropped", "src/a.test.ts"), finding("missing")] });
    const result = await runFactoryForTest(run, { include: ["src/**"], exclude: ["**/*.test.ts"] }, { ...EVALUATION, seed: SEED });
    expect(result.error).toBeUndefined();
    expect((result.result as { items: Array<{ rule: string }> }).items.map((item) => item.rule)).toEqual(["in-scope", "missing"]);
  });

  it("drops nothing without include and exclude", async () => {
    const run = () => ({ items: [finding("a", "src/a.ts"), finding("b", "lib/b.ts")] });
    const result = await runFactoryForTest(run, {}, EVALUATION);
    expect((result.result as { items: unknown[] }).items.length).toBe(2);
  });
});

describe("A-125 / A-126: find is not narrowed, and every verb is offered", () => {
  it("opens a file outside the scope and stages edits", async () => {
    let content: unknown;
    const run = async () => {
      content = await typescript.find("src/port.ts").read();
      create("scratch.ts", { template: "x", options: {} });
      return { items: [] };
    };
    const result = await runFactoryForTest(run, { include: ["src/adapter.ts"] }, { ...EVALUATION, seed: { "src/port.ts": "export interface Port {}" } });
    expect(result.error).toBeUndefined();
    expect(content).toBe("export interface Port {}");
    expect(result.tree.get("scratch.ts")).toBe("x");
  });
});
