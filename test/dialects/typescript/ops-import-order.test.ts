import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";

type Handle = ReturnType<typeof ts.find>;

async function runOn(seed: string, op: (handle: Handle) => PromiseLike<unknown>) {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await op(ts.find("a.ts"));
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("a.ts") };
}

async function expectResult(seed: string, op: (handle: Handle) => PromiseLike<unknown>, expected: string) {
  const { caught, modifies } = await runOn(seed, op);
  expect(caught).toBeUndefined();
  expect(modifies).toHaveLength(1);
  expect(modifies[0]?.modify.content).toBe(expected);
}

async function expectUnchanged(seed: string, op: (handle: Handle) => PromiseLike<unknown>) {
  const { caught, modifies, content } = await runOn(seed, op);
  expect(caught).toBeUndefined();
  expect(modifies).toHaveLength(0);
  expect(content).toBe(seed);
}

describe("addImport — position: \"sorted\"", () => {
  it("merges the name into its alphabetical place inside the braces", async () => {
    await expectResult(
      'import { BookOpen, Users } from "lucide-react";\n',
      (h) => h.addImport("LayoutDashboard", "lucide-react", { position: "sorted" }),
      'import { BookOpen, LayoutDashboard, Users } from "lucide-react";\n'
    );
  });

  it("without the option, still appends the name at the end", async () => {
    await expectResult(
      'import { BookOpen, Users } from "lucide-react";\n',
      (h) => h.addImport("LayoutDashboard", "lucide-react"),
      'import { BookOpen, Users, LayoutDashboard } from "lucide-react";\n'
    );
  });

  it("places a new declaration right after its folder siblings", async () => {
    await expectResult(
      [
        'import { http } from "msw";',
        'import { authorHandlers } from "./domains/authors.mock";',
        'import { config } from "./config";',
        "",
        "export const handlers = [];",
        "",
      ].join("\n"),
      (h) => h.addImport("bookHandlers", "./domains/books.mock", { position: "sorted" }),
      [
        'import { http } from "msw";',
        'import { authorHandlers } from "./domains/authors.mock";',
        'import { bookHandlers } from "./domains/books.mock";',
        'import { config } from "./config";',
        "",
        "export const handlers = [];",
        "",
      ].join("\n")
    );
  });

  it("places a new declaration before the first sibling that sorts after it", async () => {
    await expectResult(
      'import { authors } from "./domains/authors.mock";\nimport { users } from "./domains/users.mock";\n',
      (h) => h.addImport("books", "./domains/books.mock", { position: "sorted" }),
      'import { authors } from "./domains/authors.mock";\nimport { books } from "./domains/books.mock";\nimport { users } from "./domains/users.mock";\n'
    );
  });

  it("inserts above the comment attached to the sibling it precedes", async () => {
    await expectResult(
      'import { a } from "./a";\n// eslint-disable-next-line\nimport { c } from "./c";\n',
      (h) => h.addImport("b", "./b", { position: "sorted" }),
      'import { a } from "./a";\nimport { b } from "./b";\n// eslint-disable-next-line\nimport { c } from "./c";\n'
    );
  });

  it("puts a package import ahead of relative ones", async () => {
    await expectResult(
      'import { a } from "./a";\n',
      (h) => h.addImport("useState", "react", { position: "sorted" }),
      'import { useState } from "react";\nimport { a } from "./a";\n'
    );
  });

  it("keeps the file's quote and semicolon style", async () => {
    await expectResult(
      "import { a } from './a'\nimport { c } from './c'\n",
      (h) => h.addImport("b", "./b", { position: "sorted" }),
      "import { a } from './a'\nimport { b } from './b'\nimport { c } from './c'\n"
    );
  });

  it("with no imports in the file, lands where the default would (after a directive)", async () => {
    const seed = '"use client";\n\nexport const x = 1;\n';
    const unsorted = await runOn(seed, (h) => h.addImport("a", "./a"));
    const expected = unsorted.modifies[0]?.modify.content;
    expect(expected).toStartWith('"use client";\n\nimport { a } from "./a";');
    await expectResult(seed, (h) => h.addImport("a", "./a", { position: "sorted" }), expected!);
  });

  it("is idempotent", async () => {
    await expectUnchanged('import { a, b } from "./x";\n', (h) => h.addImport("b", "./x", { position: "sorted" }));
  });

  it("rejects an unknown position and leaves the file unchanged", async () => {
    const seed = 'import { a } from "./x";\n';
    const { caught, modifies, content } = await runOn(seed, (h) =>
      h.addImport("b", "./x", { position: "first" } as unknown as { position: "sorted" })
    );
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('`position` must be "sorted"');
    expect(modifies).toHaveLength(0);
    expect(content).toBe(seed);
  });
});

describe("sortImports", () => {
  it("sorts declarations (packages first) and the names inside each one", async () => {
    await expectResult(
      [
        'import { useState, type FC } from "react";',
        'import { b } from "./b";',
        'import { a } from "./a";',
        'import { Users, BookOpen } from "lucide-react";',
        "",
        "export const x = 1;",
        "",
      ].join("\n"),
      (h) => h.sortImports(),
      [
        'import { BookOpen, Users } from "lucide-react";',
        'import { type FC, useState } from "react";',
        'import { a } from "./a";',
        'import { b } from "./b";',
        "",
        "export const x = 1;",
        "",
      ].join("\n")
    );
  });

  it("keeps the layout of multi-line braces", async () => {
    await expectResult(
      'import {\n  Users,\n  BookOpen,\n} from "lucide-react";\n',
      (h) => h.sortImports(),
      'import {\n  BookOpen,\n  Users,\n} from "lucide-react";\n'
    );
  });

  it("sorts each blank-line group on its own", async () => {
    await expectResult(
      'import { z } from "z";\nimport { y } from "y";\n\nimport { b } from "./b";\nimport { a } from "./a";\n',
      (h) => h.sortImports(),
      'import { y } from "y";\nimport { z } from "z";\n\nimport { a } from "./a";\nimport { b } from "./b";\n'
    );
  });

  it("never moves anything across a side-effect import", async () => {
    await expectUnchanged('import { b } from "b";\nimport "./polyfills";\nimport { a } from "a";\n', (h) => h.sortImports());
  });

  it("never moves a declaration away from a comment attached to it", async () => {
    await expectUnchanged(
      'import { c } from "c";\n// eslint-disable-next-line\nimport { a } from "a";\nimport { b } from "b"; // keep\n',
      (h) => h.sortImports()
    );
  });

  it("sorts below a header comment separated by a blank line", async () => {
    await expectResult(
      '// license\n\nimport { b } from "b";\nimport { a } from "a";\n',
      (h) => h.sortImports(),
      '// license\n\nimport { a } from "a";\nimport { b } from "b";\n'
    );
  });

  it("leaves braces that contain a comment in their order", async () => {
    await expectUnchanged('import {\n  b, // why\n  a,\n} from "x";\n', (h) => h.sortImports());
  });

  it("never combines or removes declarations", async () => {
    await expectUnchanged('import { a } from "x";\nimport { b } from "x";\n', (h) => h.sortImports());
  });

  it("is a no-op on an already sorted file", async () => {
    await expectUnchanged('import { a, b } from "a";\nimport { c } from "./c";\n', (h) => h.sortImports());
  });
});
