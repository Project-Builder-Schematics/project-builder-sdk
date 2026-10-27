/**
 * `addDefaultImport`, `addNamespaceImport`, `addTypeImport`, and `addSideEffectImport`: each
 * op's emitted form, its idempotency identity, its merge targets, and its collision rejects.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";

type Handle = ReturnType<typeof ts.find>;

async function expectSingleModify(seed: string, apply: (handle: Handle) => PromiseLike<unknown>, expected: string) {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  await defineFactory<void>(async () => {
    await apply(ts.find("a.ts"));
  })(undefined, { client });

  const modifies = collectModifies(emitted);
  expect(modifies).toHaveLength(1);
  expect(modifies[0]?.modify.content).toBe(expected);
}

async function expectNoOp(seed: string, apply: (handle: Handle) => PromiseLike<unknown>) {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  await defineFactory<void>(async () => {
    await apply(ts.find("a.ts"));
  })(undefined, { client });

  expect(collectModifies(emitted)).toHaveLength(0);
  expect(await client.read("a.ts")).toBe(seed);
}

async function expectReject(seed: string, apply: (handle: Handle) => PromiseLike<unknown>): Promise<Error> {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await apply(ts.find("a.ts"));
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toStartWith("dialect operation failed: ");
  expect(collectModifies(emitted)).toHaveLength(0);
  expect(await client.read("a.ts")).toBe(seed);
  return caught as Error;
}

function claimedMessage(op: string, name: string): string {
  return (
    `dialect operation failed: ${op}("${name}") on "a.ts" — a value or import binding named "${name}" already exists; ` +
    "TypeScript forbids two bindings sharing a name. Rename or remove the existing one, or edit it with .modify()."
  );
}

describe("addDefaultImport", () => {
  it("inserts a default import", async () => {
    await expectSingleModify("", (h) => h.addDefaultImport("X", "m"), 'import X from "m";\n');
  });

  it("is a no-op when the module already has that default import", async () => {
    await expectNoOp('import X from "m";\n', (h) => h.addDefaultImport("X", "m"));
  });

  it("rejects when the module already has a default import under another name", async () => {
    const err = await expectReject('import Y from "m";\n', (h) => h.addDefaultImport("X", "m"));
    expect(err.message).toBe(
      'dialect operation failed: addDefaultImport("X") on "a.ts" — "m" already has a default import named "Y"; ' +
        "a module has one default export. Use that name, or remove the existing import first."
    );
  });

  it("merges into a named-only declaration of the same module", async () => {
    await expectSingleModify('import { a } from "m";\n', (h) => h.addDefaultImport("X", "m"), 'import X, { a } from "m";\n');
  });

  it("merges into a namespace-only declaration of the same module", async () => {
    await expectSingleModify('import * as ns from "m";\n', (h) => h.addDefaultImport("X", "m"), 'import X, * as ns from "m";\n');
  });

  it("rejects a type-only default import of the same name", async () => {
    const err = await expectReject('import type X from "m";\n', (h) => h.addDefaultImport("X", "m"));
    expect(err.message).toBe(claimedMessage("addDefaultImport", "X"));
  });

  it("never merges into a type-only declaration — inserts a separate one", async () => {
    await expectSingleModify(
      'import type { A } from "m";\n',
      (h) => h.addDefaultImport("X", "m"),
      'import type { A } from "m";\nimport X from "m";\n'
    );
  });

  it("rejects a name declared as a function", async () => {
    const err = await expectReject("function X(): void {}\n", (h) => h.addDefaultImport("X", "m"));
    expect(err.message).toBe(claimedMessage("addDefaultImport", "X"));
  });

  it("rejects a name imported from another module", async () => {
    await expectReject('import { X } from "other";\n', (h) => h.addDefaultImport("X", "m"));
  });

  it("accepts a name only an interface uses", async () => {
    await expectSingleModify("interface X {}\n", (h) => h.addDefaultImport("X", "m"), 'import X from "m";\n\ninterface X {}\n');
  });

  it("keeps a directive prologue first", async () => {
    await expectSingleModify(
      '"use client";\nconst x = 1;\n',
      (h) => h.addDefaultImport("X", "m"),
      '"use client";\n\nimport X from "m";\n\nconst x = 1;\n'
    );
  });
});

describe("addNamespaceImport", () => {
  it("inserts a namespace import", async () => {
    await expectSingleModify("", (h) => h.addNamespaceImport("ns", "m"), 'import * as ns from "m";\n');
  });

  it("is a no-op when the module already has that namespace import", async () => {
    await expectNoOp('import * as ns from "m";\n', (h) => h.addNamespaceImport("ns", "m"));
  });

  it("opens a separate declaration beside named imports of the same module", async () => {
    await expectSingleModify(
      'import { a } from "m";\n',
      (h) => h.addNamespaceImport("ns", "m"),
      'import { a } from "m";\nimport * as ns from "m";\n'
    );
  });

  it("rejects when the module already has a namespace import under another name", async () => {
    const err = await expectReject('import * as other from "m";\n', (h) => h.addNamespaceImport("ns", "m"));
    expect(err.message).toBe(
      'dialect operation failed: addNamespaceImport("ns") on "a.ts" — "m" already has a namespace import named "other"; ' +
        "use that name, or remove the existing import first."
    );
  });

  it("rejects a named import of the same name before opening a declaration", async () => {
    const err = await expectReject('import { ns } from "m";\n', (h) => h.addNamespaceImport("ns", "m"));
    expect(err.message).toBe(claimedMessage("addNamespaceImport", "ns"));
  });

  it("is a no-op on its own two-declaration output", async () => {
    await expectNoOp('import { a } from "m";\nimport * as ns from "m";\n', (h) => h.addNamespaceImport("ns", "m"));
  });

  it("merges into a default-only declaration of the same module", async () => {
    await expectSingleModify('import Def from "m";\n', (h) => h.addNamespaceImport("ns", "m"), 'import Def, * as ns from "m";\n');
  });

  it("rejects a name declared as a const", async () => {
    await expectReject("const ns = 1;\n", (h) => h.addNamespaceImport("ns", "m"));
  });
});

describe("addTypeImport", () => {
  it("inserts a type-only import", async () => {
    await expectSingleModify("", (h) => h.addTypeImport("X", "m"), 'import type { X } from "m";\n');
  });

  it("is a no-op on its own output", async () => {
    await expectNoOp('import type { X } from "m";\n', (h) => h.addTypeImport("X", "m"));
  });

  it("is a no-op against an inline type specifier", async () => {
    await expectNoOp('import { type X } from "m";\n', (h) => h.addTypeImport("X", "m"));
  });

  it("is a no-op against a value import of the same name", async () => {
    await expectNoOp('import { X } from "m";\n', (h) => h.addTypeImport("X", "m"));
  });

  it("is a no-op against a mixed inline clause", async () => {
    await expectNoOp('import { a, type X } from "m";\n', (h) => h.addTypeImport("X", "m"));
  });

  it("finds the match on a later declaration of the same module", async () => {
    await expectNoOp('import { a } from "m";\nimport type { X } from "m";\n', (h) => h.addTypeImport("X", "m"));
  });

  it("never merges, even into an existing type-only declaration", async () => {
    await expectSingleModify(
      'import type { A } from "m";\n',
      (h) => h.addTypeImport("X", "m"),
      'import type { A } from "m";\nimport type { X } from "m";\n'
    );
  });

  it("rejects a name declared as a class", async () => {
    const err = await expectReject("class X {}\n", (h) => h.addTypeImport("X", "m"));
    expect(err.message).toBe(claimedMessage("addTypeImport", "X"));
  });

  it("rejects a name aliased from the same module", async () => {
    await expectReject('import { Y as X } from "m";\n', (h) => h.addTypeImport("X", "m"));
  });

  for (const seed of ["type X = 1;\n", "interface X {}\n"]) {
    it(`rejects a name a local type declaration uses: ${JSON.stringify(seed)}`, async () => {
      const err = await expectReject(seed, (h) => h.addTypeImport("X", "m"));
      expect(err.message).toBe(claimedMessage("addTypeImport", "X"));
    });
  }
});

describe("addSideEffectImport", () => {
  it("inserts a side-effect import", async () => {
    await expectSingleModify("", (h) => h.addSideEffectImport("m"), 'import "m";\n');
  });

  it("is a no-op when the side-effect import exists", async () => {
    await expectNoOp('import "m";\n', (h) => h.addSideEffectImport("m"));
  });

  it("adds its own declaration beside a named import of the same module", async () => {
    await expectSingleModify('import { a } from "m";\n', (h) => h.addSideEffectImport("m"), 'import { a } from "m";\nimport "m";\n');
  });

  it("is a no-op on its own output beside a named import", async () => {
    await expectNoOp('import { a } from "m";\nimport "m";\n', (h) => h.addSideEffectImport("m"));
  });

  it("escapes a hostile module specifier instead of breaking out of the string", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });
    await defineFactory<void>(async () => {
      await ts.find("a.ts").addSideEffectImport('m"; import "evil');
    })(undefined, { client });
    expect(collectModifies(emitted)[0]?.modify.content).toBe('import "m\\"; import \\"evil";\n');
  });
});
