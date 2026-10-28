/**
 * A freshly inserted import follows the edited file's own quote kind and statement-terminating
 * semicolons; a file that shows no preference keeps the double-quote, semicolon default.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import * as react from "../../../src/dialects/react/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";

async function modifiedContent(
  path: string,
  seed: string,
  apply: () => PromiseLike<unknown>
): Promise<string | undefined> {
  const { client, emitted } = makeSpyClient({ [path]: seed });
  await defineFactory<void>(async () => {
    await apply();
  })(undefined, { client });
  const modifies = collectModifies(emitted);
  expect(modifies).toHaveLength(1);
  return modifies[0]?.modify.content;
}

describe("typescript dialect — inserted imports match the file's style", () => {
  it("single quotes, no semicolons: addTypeImport + addImport insert the same style", async () => {
    const content = await modifiedContent("src/smoke.ts", "import { a } from './a'\n", () =>
      ts.find("src/smoke.ts").addTypeImport("B", "./b").addImport("c", "./c")
    );
    expect(content).toBe("import { a } from './a'\nimport type { B } from './b'\nimport { c } from './c'\n");
  });

  it("single quotes with semicolons keep the semicolons", async () => {
    const content = await modifiedContent("a.ts", "import { a } from './a';\n", () =>
      ts.find("a.ts").addDefaultImport("X", "m")
    );
    expect(content).toBe("import { a } from './a';\nimport X from 'm';\n");
  });

  it("double quotes without semicolons drop only the semicolon", async () => {
    const content = await modifiedContent("a.ts", 'import { a } from "./a"\nconst x = 1\n', () =>
      ts.find("a.ts").addSideEffectImport("./polyfill")
    );
    expect(content).toBe('import { a } from "./a"\nimport "./polyfill"\n\nconst x = 1\n');
  });

  it("non-import statements decide the semicolon style when the file has no imports", async () => {
    const content = await modifiedContent("a.ts", "export const x = 1\n", () => ts.find("a.ts").addImport("y", "m"));
    expect(content).toBe('import { y } from "m"\n\nexport const x = 1\n');
  });

  it("a file with no evidence keeps the double-quote, semicolon default", async () => {
    const content = await modifiedContent("a.ts", "", () => ts.find("a.ts").addNamespaceImport("ns", "m"));
    expect(content).toBe('import * as ns from "m";\n');
  });

  it("a quote-kind tie keeps double quotes", async () => {
    const content = await modifiedContent("a.ts", "import a from './a';\nimport b from \"./b\";\n", () =>
      ts.find("a.ts").addImport("c", "./c")
    );
    expect(content).toBe("import a from './a';\nimport b from \"./b\";\nimport { c } from \"./c\";\n");
  });

  it("leaves existing statements untouched", async () => {
    const seed = "import { a } from \"./a\";\nimport { b } from './b'\nimport { d } from './d'\nfoo()\n";
    const content = await modifiedContent("a.ts", seed, () => ts.find("a.ts").addImport("c", "./c"));
    expect(content).toBe(
      "import { a } from \"./a\";\nimport { b } from './b'\nimport { d } from './d'\nimport { c } from './c'\n\nfoo()\n"
    );
  });
});

describe("react dialect — inserted imports match the file's style", () => {
  it("single quotes, no semicolons", async () => {
    const content = await modifiedContent("App.tsx", "import { a } from './a'\n", () =>
      react.find("App.tsx").addImport("useState", "react")
    );
    expect(content).toBe("import { a } from './a'\nimport { useState } from 'react'\n");
  });

  it("a file with no evidence keeps the double-quote, semicolon default", async () => {
    const content = await modifiedContent("App.tsx", "", () => react.find("App.tsx").addImport("useState", "react"));
    expect(content).toBe('import { useState } from "react";\n');
  });
});
