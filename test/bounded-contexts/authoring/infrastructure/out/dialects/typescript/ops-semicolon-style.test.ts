/**
 * A-57: the statements an op inserts follow the file's semicolon style, as `addImport` does. A
 * file whose statements mostly omit the semicolon gets none; any other file keeps it.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../../../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../../../../../support/spy-client.ts";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";

type Handle = ReturnType<typeof ts.find>;

async function contentAfter(seed: string, apply: (handle: Handle) => PromiseLike<unknown>): Promise<string | undefined> {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  await defineFactory<void>(async () => {
    await apply(ts.find("a.ts"));
  })(undefined, { client });
  const modifies = collectModifies(emitted);
  expect(modifies).toHaveLength(1);
  return modifies[0]?.modify.content;
}

const CASES: Array<{ op: string; apply: (handle: Handle) => PromiseLike<unknown>; without: [string, string]; with: [string, string] }> = [
  {
    op: "addReExport",
    apply: (h) => h.addReExport("Y", "./y"),
    without: ["export const x = 1\n", 'export const x = 1\n\nexport { Y } from "./y"\n'],
    with: ["export const x = 1;\n", 'export const x = 1;\n\nexport { Y } from "./y";\n'],
  },
  {
    op: "addVariable",
    apply: (h) => h.addVariable("y", "2"),
    without: ["export const x = 1\n", "export const x = 1\nconst y = 2\n"],
    with: ["export const x = 1;\n", "export const x = 1;\nconst y = 2;\n"],
  },
  {
    op: "addExportAll",
    apply: (h) => h.addExportAll("./b"),
    without: ["import { a } from './a'\n", "import { a } from './a'\n\nexport * from './b'\n"],
    with: ["import { a } from './a';\n", "import { a } from './a';\n\nexport * from './b';\n"],
  },
  {
    op: "addExportAll as",
    apply: (h) => h.addExportAll("./b", { as: "b" }),
    without: ["import { a } from './a'\n", "import { a } from './a'\n\nexport * as b from './b'\n"],
    with: ["import { a } from './a';\n", "import { a } from './a';\n\nexport * as b from './b';\n"],
  },
  {
    op: "addClassProperty",
    apply: (h) => h.addClassProperty("A", "b", "2"),
    without: ["class A {}\nconst x = 1\n", "class A {\n  b = 2\n}\nconst x = 1\n"],
    with: ["class A {}\nconst x = 1;\n", "class A {\n  b = 2;\n}\nconst x = 1;\n"],
  },
];

describe("inserted statements follow the file's semicolon style (A-57)", () => {
  for (const { op, apply, without, with: withSemicolons } of CASES) {
    it(`${op} omits the semicolon in a file whose statements omit it`, async () => {
      expect(await contentAfter(without[0], apply)).toBe(without[1]);
    });

    it(`${op} keeps the semicolon in a file whose statements end with one`, async () => {
      expect(await contentAfter(withSemicolons[0], apply)).toBe(withSemicolons[1]);
    });
  }
});
