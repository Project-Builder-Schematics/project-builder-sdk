/**
 * `addReExport`, `addExportAll`, `removeExport`, and `removeExportAll`: each op's emitted
 * form, its idempotency identity, its merge target, and its collision rejects.
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

function alreadyExportedMessage(op: string, name: string): string {
  return (
    `dialect operation failed: ${op}("${name}") on "a.ts" — the file already exports a binding named "${name}"; ` +
    "TypeScript forbids two exports sharing a name. Rename or remove the existing one, or edit it with .modify()."
  );
}

describe("addReExport", () => {
  it("inserts a named re-export", async () => {
    await expectSingleModify("", (h) => h.addReExport("X", "./x"), 'export { X } from "./x";\n');
  });

  it("is a no-op on its own output", async () => {
    await expectNoOp('export { X } from "./x";\n', (h) => h.addReExport("X", "./x"));
  });

  it("merges into an existing re-export clause of the same module", async () => {
    await expectSingleModify('export { Y } from "./x";\n', (h) => h.addReExport("X", "./x"), 'export { Y, X } from "./x";\n');
  });

  it("rejects a name already re-exported from another module", async () => {
    const err = await expectReject('export { X } from "./other";\n', (h) => h.addReExport("X", "./x"));
    expect(err.message).toBe(alreadyExportedMessage("addReExport", "X"));
  });

  it("never merges into a type-only re-export clause", async () => {
    await expectSingleModify(
      'export type { Y } from "m";\n',
      (h) => h.addReExport("X", "m"),
      'export type { Y } from "m";\nexport { X } from "m";\n'
    );
  });

  it("matches an aliased specifier by its source name", async () => {
    await expectNoOp('export { X as Y } from "m";\n', (h) => h.addReExport("X", "m"));
  });

  it("rejects a name that is already the visible alias of another re-export", async () => {
    await expectReject('export { X as Y } from "m";\n', (h) => h.addReExport("Y", "m"));
  });

  it("rejects a name an exported declaration already uses", async () => {
    const err = await expectReject("export const X = 1;\n", (h) => h.addReExport("X", "./x"));
    expect(err.message).toBe(alreadyExportedMessage("addReExport", "X"));
  });

  for (const seed of ["export const { X } = { X: 1 };\n", "export const [X] = [1];\n", "export const { a: X } = { a: 1 };\n"]) {
    it(`rejects a name a destructuring export binds: ${JSON.stringify(seed)}`, async () => {
      const err = await expectReject(seed, (h) => h.addReExport("X", "./x"));
      expect(err.message).toBe(alreadyExportedMessage("addReExport", "X"));
    });
  }

  it("does not treat a destructured property key as an exported name", async () => {
    await expectSingleModify(
      "export const { a: Y } = { a: 1 };\n",
      (h) => h.addReExport("a", "./x"),
      'export const { a: Y } = { a: 1 };\n\nexport { a } from "./x";\n'
    );
  });

  it("rejects a name an `export * as` already uses", async () => {
    await expectReject('export * as X from "./other";\n', (h) => h.addReExport("X", "./x"));
  });

  it("accepts a name a non-exported declaration uses", async () => {
    await expectSingleModify("const X = 1;\n", (h) => h.addReExport("X", "./x"), 'const X = 1;\n\nexport { X } from "./x";\n');
  });
});

describe("addExportAll", () => {
  it("inserts a bare export-all", async () => {
    await expectSingleModify("", (h) => h.addExportAll("m"), 'export * from "m";\n');
  });

  it("is a no-op on its own output", async () => {
    await expectNoOp('export * from "m";\n', (h) => h.addExportAll("m"));
  });

  it("inserts a namespace export-all with `as`", async () => {
    await expectSingleModify("", (h) => h.addExportAll("m", { as: "ns" }), 'export * as ns from "m";\n');
  });

  it("is a no-op on its own `as` output", async () => {
    await expectNoOp('export * as ns from "m";\n', (h) => h.addExportAll("m", { as: "ns" }));
  });

  it("treats the bare and the `as` form as different statements", async () => {
    await expectSingleModify(
      'export * from "m";\n',
      (h) => h.addExportAll("m", { as: "ns" }),
      'export * from "m";\nexport * as ns from "m";\n'
    );
  });

  it("rejects an `as` name the file already exports", async () => {
    const err = await expectReject("export function ns(): void {}\n", (h) => h.addExportAll("m", { as: "ns" }));
    expect(err.message).toBe(alreadyExportedMessage("addExportAll", "ns"));
  });

  it("rejects an `as` name another module's `export * as` already uses", async () => {
    await expectReject('export * as ns from "other";\n', (h) => h.addExportAll("m", { as: "ns" }));
  });
});

describe("removeExport", () => {
  it("deletes the statement when it held the only specifier", async () => {
    await expectSingleModify('export { X } from "m";\n', (h) => h.removeExport("X", "m"), "");
  });

  it("keeps the statement when other specifiers remain", async () => {
    await expectSingleModify('export { X, Y } from "m";\n', (h) => h.removeExport("X", "m"), 'export { Y } from "m";\n');
  });

  it("is a no-op when the re-export is absent", async () => {
    await expectNoOp('export { Y } from "m";\n', (h) => h.removeExport("X", "m"));
  });

  it("never touches a local export or an export-all", async () => {
    await expectNoOp('const X = 1;\nexport { X };\nexport * from "m";\n', (h) => h.removeExport("X", "m"));
  });

  it("removes only the named re-export beside a same-module export-all", async () => {
    await expectSingleModify(
      'export { X } from "m";\nexport * from "m";\n',
      (h) => h.removeExport("X", "m"),
      'export * from "m";\n'
    );
  });

  it("finds the specifier on a later declaration of the same module", async () => {
    await expectSingleModify(
      'export { a } from "m";\nexport { X } from "m";\n',
      (h) => h.removeExport("X", "m"),
      'export { a } from "m";\n'
    );
  });

  it("matches an aliased specifier by its source name, not its alias", async () => {
    await expectSingleModify('export { X as Y } from "m";\n', (h) => h.removeExport("X", "m"), "");
    await expectNoOp('export { X as Y } from "m";\n', (h) => h.removeExport("Y", "m"));
  });
});

describe("removeExportAll", () => {
  it("removes a bare export-all", async () => {
    await expectSingleModify('export { a } from "n";\nexport * from "m";\n', (h) => h.removeExportAll("m"), 'export { a } from "n";\n');
  });

  it("removes a namespace export-all with `as`", async () => {
    await expectSingleModify('export * as ns from "m";\n', (h) => h.removeExportAll("m", { as: "ns" }), "");
  });

  it("leaves the `as` form alone when removing the bare form, and vice versa", async () => {
    await expectNoOp('export * as ns from "m";\n', (h) => h.removeExportAll("m"));
    await expectNoOp('export * from "m";\n', (h) => h.removeExportAll("m", { as: "ns" }));
  });

  it("is a no-op when absent, and never touches named re-exports", async () => {
    await expectNoOp('export { X } from "m";\n', (h) => h.removeExportAll("m"));
  });
});
