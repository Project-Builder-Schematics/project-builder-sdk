/**
 * Every name-bearing op validates its name-position argument with `assertValidImportBinding`
 * before any AST work, so an injection-shaped name never reaches emitted source.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../../../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../../../../../support/spy-client.ts";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";

type Handle = ReturnType<typeof ts.find>;

// The argument each op reports a rejected name under; the rest report `name`.
const ARGUMENT_NAME: Record<string, string> = { "addExportAll as": "as", "removeExportAll as": "as" };

// Ops that only look a name up, never write it: a reserved word is a name they can find (A-55).
const LOOKUP_OPS = new Set(["removeImport", "removeExport", "removeExportAll as"]);

const NAME_BEARING_OPS: Record<string, (handle: Handle, name: string) => PromiseLike<unknown>> = {
  addImport: (handle, name) => handle.addImport(name, "m"),
  addDefaultImport: (handle, name) => handle.addDefaultImport(name, "m"),
  addNamespaceImport: (handle, name) => handle.addNamespaceImport(name, "m"),
  addTypeImport: (handle, name) => handle.addTypeImport(name, "m"),
  removeImport: (handle, name) => handle.removeImport(name, "m"),
  addReExport: (handle, name) => handle.addReExport(name, "m"),
  removeExport: (handle, name) => handle.removeExport(name, "m"),
  "addExportAll as": (handle, name) => handle.addExportAll("m", { as: name }),
  "removeExportAll as": (handle, name) => handle.removeExportAll("m", { as: name }),
  addFunction: (handle, name) => handle.addFunction(name, "(): void {}"),
  addVariable: (handle, name) => handle.addVariable(name, "0"),
  addClass: (handle, name) => handle.addClass(name, ""),
};

const INJECTION_SHAPES: Record<string, string> = {
  "import breakout": 'x } from "evil"; import { y',
  "statement terminator": "x; process.exit(",
  newline: "x\ny",
  CRLF: "x\r\ny",
  "block-comment open": "x/*",
  "line comment": "x//",
  backtick: "x`",
  "single quote": "x'",
  "double quote": 'x"',
  "\\u escape": "x\\u0061",
  "zero-width": "x‌y",
  "interior whitespace": "x y",
  "leading digit": "1x",
  empty: "",
};

const RESERVED_NAMES = ["class", "eval", "__proto__", "constructor"];

async function rejectionOf(seed: string, apply: (handle: Handle) => PromiseLike<unknown>): Promise<{ err: Error; modifies: number }> {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  const run = defineFactory<void>(async () => {
    await apply(ts.find("a.ts"));
  });
  let caught: unknown;
  try {
    await run(undefined, { client });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  return { err: caught as Error, modifies: collectModifies(emitted).length };
}

async function expectContent(seed: string, apply: (handle: Handle) => PromiseLike<unknown>, expected: string): Promise<void> {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  await defineFactory<void>(async () => {
    await apply(ts.find("a.ts"));
  })(undefined, { client });
  const modifies = collectModifies(emitted);
  expect(modifies).toHaveLength(1);
  expect(modifies[0]?.modify.content).toBe(expected);
}

describe("name-position validation across every name-bearing op", () => {
  for (const [opName, apply] of Object.entries(NAME_BEARING_OPS)) {
    const argument = ARGUMENT_NAME[opName] ?? "name";
    for (const [shape, payload] of Object.entries(INJECTION_SHAPES)) {
      it(`${opName} rejects a ${shape} name before any mutation, without echoing it`, async () => {
        const { err, modifies } = await rejectionOf('import { y } from "m";\n', (handle) => apply(handle, payload));
        expect(err.message).toBe(
          `dialect operation failed: \`${argument}\` must be a valid JavaScript identifier — fix the name, or use \`.modify()\` to make this edit directly.`
        );
        expect(modifies).toBe(0);
      });
    }

    if (LOOKUP_OPS.has(opName)) continue;
    for (const reserved of RESERVED_NAMES) {
      it(`${opName} rejects the reserved name "${reserved}" before any mutation`, async () => {
        const { err, modifies } = await rejectionOf("", (handle) => apply(handle, reserved));
        expect(err.message).toContain(`\`${argument}\` "${reserved}"`);
        expect(modifies).toBe(0);
      });
    }
  }

  it("removeImport finds a binding whose imported name is a reserved word", async () => {
    await expectContent('import { default as x, y } from "m";\n', (handle) => handle.removeImport("default", "m"), 'import { y } from "m";\n');
  });

  it("removeExport finds a re-export whose name is a reserved word", async () => {
    await expectContent('export { default, y } from "m";\n', (handle) => handle.removeExport("default", "m"), 'export { y } from "m";\n');
  });

  it("removeExportAll finds a namespace export named by a reserved word", async () => {
    await expectContent('export * as default from "m";\nconst x = 1;\n', (handle) => handle.removeExportAll("m", { as: "default" }), "const x = 1;\n");
  });

  for (const op of ["addExportAll", "removeExportAll"] as const) {
    it(`${op} rejects a null \`as\` before any mutation, never reading it as absent`, async () => {
      const seed = 'export * from "m";\n';
      const { err, modifies } = await rejectionOf(seed, (handle) => handle[op]("m", { as: null as unknown as string }));
      expect(err.message).toBe(
        "dialect operation failed: `as` must be a valid JavaScript identifier — fix the name, or use `.modify()` to make this edit directly."
      );
      expect(modifies).toBe(0);
    });
  }

  it("removeImport validates before its absent-binding no-op", async () => {
    const { modifies } = await rejectionOf("", (handle) => handle.removeImport("x y", "m"));
    expect(modifies).toBe(0);
  });
});

describe("addVariable kind allow-list", () => {
  for (const kind of ["const", "let", "var"] as const) {
    it(`accepts kind "${kind}"`, async () => {
      const { client, emitted } = makeSpyClient({ "a.ts": "" });
      const run = defineFactory<void>(async () => {
        await ts.find("a.ts").addVariable("x", "1", { kind });
      });
      await run(undefined, { client });
      expect(collectModifies(emitted)[0]?.modify.content).toBe(`${kind} x = 1;\n`);
    });
  }

  it("rejects a kind outside const/let/var before any mutation, without echoing it", async () => {
    const hostileKind = "function () {}; //" as "const";
    const { err, modifies } = await rejectionOf("", (handle) => handle.addVariable("x", "1", { kind: hostileKind }));
    expect(err.message).toBe(
      'dialect operation failed: addVariable("x") on "a.ts" — `kind` must be "const", "let", or "var". Fix the option, or edit the file with .modify().'
    );
    expect(modifies).toBe(0);
  });
});
